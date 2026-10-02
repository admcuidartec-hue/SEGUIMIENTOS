// test/ui.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ARCHIVO = path.join(__dirname, '..', 'src', 'Index.html');

async function abrir() {
  const navegador = await chromium.launch();
  const pagina = await navegador.newPage();
  const errores = [];
  pagina.on('pageerror', e => errores.push(e.message));
  await pagina.goto('file://' + ARCHIVO, { waitUntil: 'domcontentloaded' });
  await pagina.waitForSelector('.tarjeta');
  return { navegador, pagina, errores };
}

test('la bandeja de demostración muestra 4 pacientes en el orden del diseño', async () => {
  const { navegador, pagina, errores } = await abrir();
  try {
    const nombres = await pagina.locator('.tarjeta h3').allTextContents();
    assert.deepEqual(nombres, ['LUIS ALBERTO RAMOS VEGA', 'ROSA ELENA QUISPE HUAMÁN', 'JORGE LUIS MENDOZA PAREDES', 'CARMEN SOFÍA TORRES DÍAZ']);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('sin elegir usuario no se puede marcar el seguimiento', async () => {
  const { navegador, pagina } = await abrir();
  try {
    await pagina.locator('.tarjeta button.hecho').first().click();
    await pagina.waitForSelector('#aviso:not([hidden])');
    assert.match(await pagina.locator('#aviso').textContent(), /Elija quién es usted/);
    assert.equal(await pagina.locator('.tarjeta').count(), 4);
  } finally { await navegador.close(); }
});

test('«Seguimiento hecho» quita la tarjeta y suma en el contador', async () => {
  const { navegador, pagina, errores } = await abrir();
  try {
    await pagina.selectOption('#usuario', 'MAGALY');
    await pagina.locator('.tarjeta button.hecho').first().click();
    await pagina.waitForFunction(() => document.querySelectorAll('.tarjeta').length === 3);
    assert.equal(await pagina.locator('#contador .cifra b').nth(1).textContent(), '1');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('descartar pide motivo y quita la tarjeta', async () => {
  const { navegador, pagina } = await abrir();
  try {
    await pagina.selectOption('#usuario', 'RACHEL');
    await pagina.locator('.tarjeta button.descartar').first().click();
    await pagina.waitForSelector('#dlg-descartar[open]');
    await pagina.selectOption('#dlg-motivo', 'SE ATIENDE EN OTRO LUGAR');
    await pagina.locator('#dlg-descartar button[value="ok"]').click();
    await pagina.waitForFunction(() => document.querySelectorAll('.tarjeta').length === 3);
  } finally { await navegador.close(); }
});

test('la ficha muestra la confirmación de emparejamiento y la resuelve', async () => {
  const { navegador, pagina, errores } = await abrir();
  try {
    await pagina.selectOption('#usuario', 'ANA');
    await pagina.locator('.tarjeta h3', { hasText: 'JORGE LUIS MENDOZA PAREDES' }).click();
    await pagina.waitForSelector('#ficha .confirmar');
    assert.match(await pagina.locator('#ficha').textContent(), /¿Es esta la misma persona\?/);
    await pagina.locator('#ficha [data-confirmar][data-dni="40222333"]').click();
    await pagina.waitForFunction(() => !document.querySelector('#ficha .confirmar') && document.querySelector('#ficha h2'));
    assert.match(await pagina.locator('#ficha').textContent(), /945112233/);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('el buscador encuentra por nombre y por DNI', async () => {
  const { navegador, pagina } = await abrir();
  try {
    await pagina.locator('.nav button[data-vista="ficha"]').click();
    await pagina.fill('#q', 'flores');
    await pagina.waitForSelector('#resultados [data-abrir="40555666"]');
    await pagina.fill('#q', '40333');
    await pagina.waitForSelector('#resultados [data-abrir="40333444"]');
  } finally { await navegador.close(); }
});

test('no hay colores escritos a mano fuera de la paleta', () => {
  const html = fs.readFileSync(ARCHIVO, 'utf8');
  const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
  const resto = css.replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/:root\{[^}]*\}/, '').replace(/html\[data-modo="oscuro"\]\{[^}]*\}/, '');
  assert.equal(resto.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g), null);
});

test('el tablero pinta sus cinco secciones y filtra sin errores', async () => {
  const { navegador, pagina, errores } = await abrir();
  try {
    await pagina.locator('.nav button[data-vista="tablero"]').click();
    await pagina.waitForSelector('#tablero table');
    const texto = await pagina.locator('#tablero').textContent();
    for (const t of ['¿Vuelven los pacientes nuevos?', 'Procedimientos', 'Recuperación', 'Motivos de descarte', 'Procedimientos sin paciente']) {
      assert.ok(texto.includes(t), t);
    }
    assert.ok(texto.includes('38%'), 'cohorte 2026-06, reevaluación 1: 15/40');
    await pagina.selectOption('#t-esp', 'REUMATOLOGÍA');
    await pagina.waitForFunction(() => document.querySelector('#t-esp').value === 'REUMATOLOGÍA');
    assert.ok((await pagina.locator('#tablero').textContent()).includes('33%'), 'reumatología: 2/6');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});


test('la tarjeta dice qué se perdió y cuándo debía volver', async () => {
  const { navegador, pagina } = await abrir();
  try {
    const luis = await pagina.locator('.tarjeta', { hasText: 'LUIS ALBERTO RAMOS VEGA' }).textContent();
    assert.match(luis, /Paciente nuevo · no volvió a su 1\.ª reevaluación/);
    assert.match(luis, /Debía volver el 11\/09\/2026 · hace 20 días que no vuelve/);
    assert.match(luis, /Procedimiento pendiente: AMO \+ BIOPSIA: cotizó y no lo hizo/);
    const rosa = await pagina.locator('.tarjeta', { hasText: 'ROSA ELENA QUISPE HUAMÁN' }).textContent();
    assert.match(rosa, /En control · faltó a su 2\.ª reevaluación/);
  } finally { await navegador.close(); }
});

test('las palabras «cohorte» y «atraso» ya no aparecen en ninguna pantalla', async () => {
  const { navegador, pagina } = await abrir();
  try {
    let texto = await pagina.locator('body').innerText();
    for (const v of ['resumen', 'tablero']) {
      await pagina.locator(`.nav button[data-vista="${v}"]`).click();
      await pagina.waitForSelector(v === 'resumen' ? '.resumen-tarjeta' : '#tablero table');
      texto += await pagina.locator('body').innerText();
    }
    assert.doesNotMatch(texto, /cohorte|atraso/i);
  } finally { await navegador.close(); }
});

test('resumen: el Dr. Eli lo ve filtrado en sus pacientes, con cantidad y porcentaje del mes', async () => {
  const { navegador, pagina, errores } = await abrir();
  try {
    await pagina.selectOption('#usuario', 'DR. ELI CABANILLAS');
    assert.equal(await pagina.locator('.tarjeta').count(), 1, 'la bandeja queda en sus pacientes');
    await pagina.locator('.nav button[data-vista="resumen"]').click();
    await pagina.waitForSelector('.resumen-tarjeta');
    assert.equal(await pagina.locator('#r-med').inputValue(), 'Dr. ELÍ FABRIZIO CABANILLAS HUALPA');
    assert.equal(await pagina.locator('.resumen-tarjeta').count(), 4);
    await pagina.selectOption('#r-mes', '2026-08');
    const texto = await pagina.locator('#resumen').innerText();
    assert.match(texto, /47%/);
    assert.match(texto, /33 de 70 pacientes/);
    assert.match(texto, /Mes a mes/);
    await pagina.selectOption('#r-med', '');
    assert.match(await pagina.locator('#resumen').innerText(), /59 de 125 pacientes/);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});
