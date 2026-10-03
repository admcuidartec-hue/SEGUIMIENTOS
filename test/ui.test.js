// Interfaz «editorial» (propuesta 2a de Claude Design) en modo DEMO. Datos inventados.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ARCHIVO = path.join(__dirname, '..', 'src', 'Index.html');

async function abrir(opciones = {}) {
  const navegador = await chromium.launch();
  const pagina = await navegador.newPage({ viewport: opciones.viewport || { width: 1440, height: 900 } });
  const errores = [];
  pagina.on('pageerror', e => errores.push(e.message));
  await pagina.goto('file://' + ARCHIVO, { waitUntil: 'domcontentloaded' });
  await pagina.waitForSelector('.fila');
  return { navegador, pagina, errores };
}
const filas = p => p.locator('#lista .fila .nombre').allTextContents();

test('bandeja: filas en el orden del diseño y agrupadas por urgencia', async () => {
  const { navegador, pagina, errores } = await abrir();
  try {
    assert.deepEqual(await filas(pagina), ['LUIS ALBERTO RAMOS VEGA', 'ROSA ELENA QUISPE HUAMÁN', 'JORGE LUIS MENDOZA PAREDES', 'CARMEN SOFÍA TORRES DÍAZ']);
    assert.deepEqual(await pagina.locator('#lista .grupo h2').allTextContents(), ['Recientes', 'Hace 1 a 2 meses', 'Más antiguos']);
    const luis = await pagina.locator('.fila', { hasText: 'LUIS ALBERTO' }).textContent();
    assert.match(luis, /Nuevo · Dra\. La Torre · Debía volver el 11\/09\/2026 · hace 20 días/);
    assert.match(await pagina.locator('.fila', { hasText: 'ROSA ELENA' }).textContent(), /En control · Dr\. Cabanillas/);
    assert.equal(await pagina.locator('.fila', { hasText: 'LUIS ALBERTO' }).locator('.m').count(), 2, 'círculo + triángulo');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('sin elegir usuario no se puede marcar Hecho', async () => {
  const { navegador, pagina } = await abrir();
  try {
    await pagina.locator('.fila button.hecho').first().click();
    await pagina.waitForSelector('#aviso:not([hidden])');
    assert.match(await pagina.locator('#aviso').textContent(), /Elija quién es usted/);
    assert.equal((await filas(pagina)).length, 4);
  } finally { await navegador.close(); }
});

test('Hecho quita la fila, suma en «hechos hoy» y no abre el panel', async () => {
  const { navegador, pagina, errores } = await abrir();
  try {
    await pagina.selectOption('#usuario', 'MAGALY');
    await pagina.locator('.fila button.hecho').first().click();
    await pagina.waitForFunction(() => document.querySelectorAll('#lista .fila').length === 3);
    assert.equal(await pagina.locator('#c-hechos').textContent(), '1');
    assert.equal(await pagina.locator('#c-atender').textContent(), '3');
    assert.equal(await pagina.locator('#panel').isVisible(), false);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('panel: clic en la fila lo abre con el detalle; oculta los teléfonos de la lista; Esc lo cierra', async () => {
  const { navegador, pagina } = await abrir();
  try {
    await pagina.locator('.fila', { hasText: 'LUIS ALBERTO' }).click();
    await pagina.waitForSelector('#panel:not([hidden])');
    const p = await pagina.locator('#panel').innerText();
    assert.match(p, /LUIS ALBERTO RAMOS VEGA/);
    assert.match(p, /Paciente nuevo · no volvió a su 1\.ª reevaluación/);
    assert.match(p, /hace 20 días que no vuelve/);
    assert.match(p, /Procedimiento pendiente\. AMO \+ BIOPSIA: cotizó y no lo hizo/);
    assert.match(p, /923456789/);
    assert.equal(await pagina.locator('#lista .fila .tel').first().isVisible(), false);
    await pagina.keyboard.press('Escape');
    await pagina.waitForSelector('#panel', { state: 'hidden' });
  } finally { await navegador.close(); }
});

test('atajos: Enter abre, ↓ cambia de paciente, H marca hecho y pasa al siguiente', async () => {
  const { navegador, pagina, errores } = await abrir();
  try {
    await pagina.selectOption('#usuario', 'ANA');
    await pagina.locator('#v-bandeja h1').click();
    await pagina.keyboard.press('Enter');
    await pagina.waitForSelector('#panel:not([hidden])');
    assert.match(await pagina.locator('#panel h2').textContent(), /LUIS ALBERTO/);
    await pagina.keyboard.press('ArrowDown');
    assert.match(await pagina.locator('#panel h2').textContent(), /ROSA ELENA/);
    await pagina.keyboard.press('h');
    await pagina.waitForFunction(() => document.querySelectorAll('#lista .fila').length === 3);
    assert.match(await pagina.locator('#panel h2').textContent(), /JORGE LUIS/);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('descartar desde el panel pide motivo y no suma en «hechos hoy»', async () => {
  const { navegador, pagina } = await abrir();
  try {
    await pagina.selectOption('#usuario', 'RACHEL');
    await pagina.locator('.fila', { hasText: 'JORGE LUIS' }).click();
    await pagina.locator('#p-descartar').click();
    await pagina.locator('[data-motivo="NÚMERO EQUIVOCADO"]').click();
    await pagina.waitForFunction(() => document.querySelectorAll('#lista .fila').length === 3);
    assert.equal(await pagina.locator('#c-hechos').textContent(), '0');
  } finally { await navegador.close(); }
});

test('copiar el teléfono muestra «Copiado ✓» y no abre el panel', async () => {
  const { navegador, pagina } = await abrir();
  try {
    await pagina.locator('.fila', { hasText: 'LUIS ALBERTO' }).locator('[data-copiar]').click();
    await pagina.waitForFunction(() => /Copiado ✓/.test(document.querySelector('#lista [data-copiar]').textContent));
    assert.equal(await pagina.locator('#panel').isVisible(), false);
  } finally { await navegador.close(); }
});

test('«Ver ficha completa» lleva a la ficha y permite confirmar el emparejamiento', async () => {
  const { navegador, pagina, errores } = await abrir();
  try {
    await pagina.selectOption('#usuario', 'ANA');
    await pagina.locator('.fila', { hasText: 'JORGE LUIS' }).click();
    await pagina.locator('#p-ficha').click();
    await pagina.waitForSelector('#ficha .confirmar');
    assert.match(await pagina.locator('#ficha').textContent(), /¿Es esta la misma persona\?/);
    await pagina.locator('#ficha [data-confirmar][data-dni="40222333"]').click();
    await pagina.waitForFunction(() => !document.querySelector('#ficha .confirmar') && document.querySelector('#ficha h1'));
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

test('resumen: el Dr. Eli ve sus pacientes; navega por mes; el mes en curso se anuncia', async () => {
  const { navegador, pagina, errores } = await abrir();
  try {
    await pagina.selectOption('#usuario', 'DR. ELI CABANILLAS');
    assert.equal((await filas(pagina)).length, 1, 'la bandeja queda en sus pacientes');
    await pagina.locator('.nav button[data-vista="resumen"]').click();
    await pagina.waitForSelector('#r-mes-actual');
    assert.equal(await pagina.locator('#r-med').inputValue(), 'Dr. ELÍ FABRIZIO CABANILLAS HUALPA');
    assert.equal(await pagina.locator('#r-mes-actual').textContent(), 'setiembre 2026');
    await pagina.locator('#r-ant').click();
    assert.equal(await pagina.locator('#r-mes-actual').textContent(), 'agosto 2026');
    const t = await pagina.locator('#resumen').textContent();
    assert.match(t, /47%/);
    assert.match(t, /de sus pacientes de agosto no volvieron a su reevaluación/);
    assert.match(t, /33 de 70 · nuevos 24 de 40 · en control 9 de 30/);
    assert.match(t, /mes a mes/i);
    assert.match(t, /setiembre está en curso: a 35 pacientes aún no les toca volver/);
    assert.equal(await pagina.locator('.r-fila').count(), 3);
    await pagina.selectOption('#r-med', '');
    assert.match(await pagina.locator('#resumen').textContent(), /59 de 125/);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('detalle: pinta sus cinco secciones y filtra sin errores', async () => {
  const { navegador, pagina, errores } = await abrir();
  try {
    await pagina.locator('.nav button[data-vista="tablero"]').click();
    await pagina.waitForSelector('#tablero table');
    const texto = await pagina.locator('#tablero').textContent();
    for (const t of ['¿Vuelven los pacientes nuevos?', 'Procedimientos', 'Recuperación', 'Motivos de descarte', 'Procedimientos sin paciente']) {
      assert.ok(texto.includes(t), t);
    }
    assert.ok(texto.includes('38%'), 'pacientes nuevos de junio, 1.ª reevaluación: 15/40');
    await pagina.selectOption('#t-esp', 'REUMATOLOGÍA');
    assert.ok((await pagina.locator('#tablero').textContent()).includes('33%'), 'reumatología: 2/6');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('las palabras «cohorte» y «atraso» no aparecen en ninguna pantalla', async () => {
  const { navegador, pagina } = await abrir();
  try {
    let texto = await pagina.locator('body').innerText();
    for (const [v, sel] of [['resumen', '#r-mes-actual'], ['tablero', '#tablero table']]) {
      await pagina.locator(`.nav button[data-vista="${v}"]`).click();
      await pagina.waitForSelector(sel);
      texto += await pagina.locator('body').innerText();
    }
    assert.doesNotMatch(texto, /cohorte|atraso/i);
  } finally { await navegador.close(); }
});

test('celular: el panel ocupa la pantalla con «‹ Volver» y no hay scroll horizontal', async () => {
  const { navegador, pagina, errores } = await abrir({ viewport: { width: 390, height: 844 } });
  try {
    assert.ok(await pagina.evaluate(() => document.documentElement.scrollWidth <= 390));
    await pagina.locator('.fila', { hasText: 'ROSA ELENA' }).click();
    await pagina.waitForSelector('#panel:not([hidden])');
    const caja = await pagina.locator('#panel').boundingBox();
    assert.ok(caja.width >= 389 && caja.x <= 1, 'panel a pantalla completa');
    assert.match(await pagina.locator('#panel .cerrar').textContent(), /‹ Volver/);
    await pagina.locator('#panel .cerrar').click();
    await pagina.waitForSelector('#panel', { state: 'hidden' });
    for (const v of ['resumen', 'tablero']) {
      await pagina.locator(`.nav button[data-vista="${v}"]`).click();
      await pagina.waitForTimeout(150);
      assert.ok(await pagina.evaluate(() => document.documentElement.scrollWidth <= 390), v);
    }
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('no hay colores escritos a mano fuera de la paleta', () => {
  const html = fs.readFileSync(ARCHIVO, 'utf8');
  const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
  const resto = css.replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/:root\{[^}]*\}/, '').replace(/html\[data-modo="oscuro"\]\{[^}]*\}/, '');
  assert.equal(resto.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g), null);
});

test('detalle: campañas y canales que traen pacientes que vuelven, con filtro de médico', async () => {
  const { navegador, pagina, errores } = await abrir();
  try {
    await pagina.locator('.nav button[data-vista="tablero"]').click();
    await pagina.waitForSelector('#tablero table');
    const seccion = pagina.locator('.seccion', { hasText: '¿Qué campañas traen pacientes que vuelven?' });
    let t = await seccion.textContent();
    assert.match(t, /FACEBOOK ADS\s*35\s*37%/);
    assert.match(t, /Sin lead en el CRM/);
    assert.match(t, /Por campaña/);
    await pagina.selectOption('#t-med', 'Dr. ELÍ FABRIZIO CABANILLAS HUALPA');
    t = await pagina.locator('.seccion', { hasText: '¿Qué campañas traen pacientes que vuelven?' }).textContent();
    assert.match(t, /FACEBOOK ADS\s*20\s*45%/);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});
