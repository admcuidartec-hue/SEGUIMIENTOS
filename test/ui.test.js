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

const tipo = (p, t) => p.locator(`.tipos button[data-tipo="${t}"]`).click();

test('bandeja: filas en el orden del diseño y agrupadas por urgencia', async () => {
  const { navegador, pagina, errores } = await abrir();
  try {
    await tipo(pagina, 'REEVALUACION');
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
    assert.equal((await filas(pagina)).length, 7);
  } finally { await navegador.close(); }
});

test('Hecho quita la fila, suma en «hechos hoy» y no abre el panel', async () => {
  const { navegador, pagina, errores } = await abrir();
  try {
    await pagina.selectOption('#usuario', 'MAGALY');
    await pagina.locator('.fila button.hecho').first().click();
    await pagina.waitForFunction(() => document.querySelectorAll('#lista .fila').length === 6);
    assert.equal(await pagina.locator('#c-hechos').textContent(), '1');
    assert.equal(await pagina.locator('#c-atender').textContent(), '6');
    assert.equal(await pagina.locator('#panel').isVisible(), false);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('panel: clic en la fila lo abre con el detalle; oculta los teléfonos de la lista; Esc lo cierra', async () => {
  const { navegador, pagina } = await abrir();
  try {
    await pagina.locator('.fila', { hasText: 'LUIS ALBERTO' }).first().click();
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
    await pagina.waitForFunction(() => document.querySelectorAll('#lista .fila').length === 6);
    assert.match(await pagina.locator('#panel h2').textContent(), /ANA MARÍA/);
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
    await pagina.waitForFunction(() => document.querySelectorAll('#lista .fila').length === 6);
    assert.equal(await pagina.locator('#c-hechos').textContent(), '0');
  } finally { await navegador.close(); }
});

test('copiar el teléfono muestra «Copiado ✓» y no abre el panel', async () => {
  const { navegador, pagina } = await abrir();
  try {
    await pagina.locator('.fila', { hasText: 'LUIS ALBERTO' }).first().locator('[data-copiar]').click();
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
    assert.deepEqual(await filas(pagina), ['ROSA ELENA QUISPE HUAMÁN', 'ANA MARÍA FLORES RÍOS', 'ROSA ELENA QUISPE HUAMÁN'], 'la bandeja queda en sus pacientes');
    await pagina.locator('.nav button[data-vista="resumen"]').click();
    await pagina.waitForSelector('#r-mes-actual');
    assert.equal(await pagina.locator('#r-med').inputValue(), 'Dr. ELÍ FABRIZIO CABANILLAS HUALPA');
    assert.equal(await pagina.locator('#r-mes-actual').textContent(), 'setiembre 2026');
    await pagina.locator('#r-ant').click();
    assert.equal(await pagina.locator('#r-mes-actual').textContent(), 'agosto 2026');
    const t = await pagina.locator('#resumen').textContent();
    assert.match(t, /47%/);
    assert.match(t, /de sus pacientes de agosto no volvieron a su reevaluación/);
    assert.match(t, /33 de 70 pacientes/);
    assert.match(t, /Nuevos 24 de 40\s*En control 9 de 30/);
    assert.match(t, /mes a mes/i);
    assert.match(t, /Meta: que vuelva el 60 %/);
    assert.match(await pagina.locator('.mm-col[data-mes="2026-09"]').textContent(), /en curso · a 35 aún no les toca volver/);
    assert.match(await pagina.locator('.mm-col[data-mes="2026-08"]').textContent(), /47%\s*agosto\s*cerrado/);
    assert.equal(await pagina.locator('.r-metrica').count(), 3);
    await pagina.selectOption('#r-med', '');
    assert.match(await pagina.locator('#resumen').textContent(), /59 de 125/);
    await pagina.locator('.mm-col[data-mes="2026-07"]').click();
    assert.equal(await pagina.locator('#r-mes-actual').textContent(), 'julio 2026');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('detalle: pinta sus cinco secciones y filtra sin errores', async () => {
  const { navegador, pagina, errores } = await abrir();
  try {
    await pagina.locator('.nav button[data-vista="tablero"]').click();
    await pagina.waitForSelector('#tablero table');
    const texto = await pagina.locator('#tablero').textContent();
    for (const t of ['¿Hasta dónde llegan los pacientes nuevos?', 'Procedimientos', 'Recuperación', 'Motivos de descarte', 'Procedimientos sin paciente']) {
      assert.ok(texto.includes(t), t);
    }
    assert.ok(texto.includes('25 · 63%'), 'pacientes nuevos de junio que no volvieron nunca: 25/40');
    await pagina.selectOption('#t-esp', 'REUMATOLOGÍA');
    assert.ok((await pagina.locator('#tablero').textContent()).includes('4 · 67%'), 'reumatología: 4/6');
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
    await pagina.locator('.fila', { hasText: 'ROSA ELENA' }).first().click();
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

test('bandeja: botones por tipo con su número; hierro y procedimientos son listas propias', async () => {
  const { navegador, pagina, errores } = await abrir();
  try {
    const textos = await pagina.locator('.tipos button').allTextContents();
    assert.deepEqual(textos.map(t => t.replace(/\s+/g, ' ').trim()),
      ['Todos 7', 'Reevaluaciones 4', 'Hierro (Ferinject) 2', 'Procedimientos 1']);
    await tipo(pagina, 'HIERRO');
    assert.deepEqual(await filas(pagina), ['ANA MARÍA FLORES RÍOS', 'ROSA ELENA QUISPE HUAMÁN']);
    assert.match(await pagina.locator('.fila', { hasText: 'ANA MARÍA' }).textContent(),
      /Hierro \(Ferinject\) · Dr\. Cabanillas · Cotizó el 15\/09\/2026 · hace 16 días/);
    assert.deepEqual(await pagina.locator('#lista .grupo span').allTextContents(),
      ['cotizado hace 30 días o menos · 1 paciente', 'cotizado hace 31 a 60 días · 1 paciente']);
    await tipo(pagina, 'PROCEDIMIENTO');
    assert.deepEqual(await filas(pagina), ['LUIS ALBERTO RAMOS VEGA']);
    await pagina.locator('.fila').click();
    const p = await pagina.locator('#panel').innerText();
    assert.match(p, /Procedimiento: AMO \+ BIOPSIA · cotizó y no lo hizo/);
    assert.match(p, /hace 50 días que cotizó/);
    assert.doesNotMatch(p, /no volvió a su/);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('bandeja: «Hecho» en una fila de hierro la quita solo de la lista de hierro', async () => {
  const { navegador, pagina, errores } = await abrir();
  try {
    await pagina.selectOption('#usuario', 'MAGALY');
    await tipo(pagina, 'HIERRO');
    await pagina.locator('.fila', { hasText: 'ROSA ELENA' }).locator('button.hecho').click();
    await pagina.waitForSelector('#aviso:not([hidden])');
    assert.match(await pagina.locator('#aviso').textContent(), /Seguimiento registrado: ROSA ELENA/);
    assert.deepEqual(await filas(pagina), ['ANA MARÍA FLORES RÍOS']);
    assert.match(await pagina.locator('.tipos button[data-tipo="HIERRO"]').textContent(), /1/);
    await tipo(pagina, 'REEVALUACION');
    assert.ok((await filas(pagina)).includes('ROSA ELENA QUISPE HUAMÁN'), 'su reevaluación sigue pendiente');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('resumen en computadora (3a): cifra grande a la izquierda y tres métricas en columnas', async () => {
  const { navegador, pagina, errores } = await abrir();
  try {
    await pagina.locator('.nav button[data-vista="resumen"]').click();
    await pagina.waitForSelector('.r-metrica');
    const grande = await pagina.locator('.r-grande').boundingBox();
    const m = await Promise.all([0, 1, 2].map(i => pagina.locator('.r-metrica').nth(i).boundingBox()));
    assert.ok(m.every(b => b.x > grande.x + grande.width), 'las métricas van a la derecha');
    assert.ok(m[0].y === m[1].y && m[1].y === m[2].y && m[0].x < m[1].x && m[1].x < m[2].x, 'en una fila');
    const col = await pagina.locator('.mm-col[data-mes="2026-08"] .mm-barra').boundingBox();
    assert.ok(col.height > col.width / 4 && col.height > 40, 'barra vertical');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('detalle: hasta dónde llegó cada paciente nuevo; las partes suman el total del mes', async () => {
  const { navegador, pagina, errores } = await abrir();
  try {
    await pagina.locator('.nav button[data-vista="tablero"]').click();
    await pagina.waitForSelector('#tablero table');
    const seccion = pagina.locator('.seccion', { hasText: '¿Hasta dónde llegan los pacientes nuevos?' });
    const cab = (await seccion.locator('th').allInnerTexts()).map(t => t.trim());
    assert.deepEqual(cab, ['Mes de la primera consulta', 'Pacientes nuevos', 'Reparto', 'No volvió nunca', 'Volvió a 1 reevaluación',
      'Volvió a 2 reevaluaciones', 'Volvió a 3 o más', 'Aún en plazo']);
    const fila = async texto => (await seccion.locator('tr', { hasText: texto }).innerText()).replace(/\s+/g, ' ').trim();
    assert.equal(await fila('junio 2026'), 'junio 2026 40 25 · 63% 7 · 18% 3 · 8% 5 · 13% 0');
    assert.equal(await fila('julio 2026'), 'julio 2026 58 39 · 67% 8 · 14% 0 0 11 · 19%');
    assert.equal(await fila('Total'), 'Total 146 100 · 68% 15 · 10% 3 · 2% 5 · 3% 23 · 16%');
    assert.equal(await seccion.locator('tr', { hasText: 'setiembre 2026' }).count(), 0, 'mes sin nadie con plazo vencido');
    assert.equal(await seccion.locator('tr', { hasText: 'junio 2026' }).locator('.reparto i').count(), 4, 'sin segmentos vacíos');
    assert.match(await seccion.locator('tr', { hasText: 'junio 2026' }).locator('.reparto i').first().getAttribute('title'),
      /No volvió nunca: 25 \(63%\)/);
    assert.match((await seccion.locator('.historia').innerText()).replace(/\s+/g, ' '),
      /Otros 50 pacientes nuevos tampoco han vuelto, pero todavía están dentro de su plazo/);
    await pagina.selectOption('#t-esp', 'REUMATOLOGÍA');
    assert.equal(await fila('Total'), 'Total 6 4 · 67% 0 0 0 2 · 33%');
    assert.doesNotMatch(await seccion.locator('.historia').innerText(), /Otros/);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('detalle: el relato «de cada 100 pacientes nuevos» con su dibujo de 100 cuadritos', async () => {
  const { navegador, pagina, errores } = await abrir();
  try {
    await pagina.locator('.nav button[data-vista="tablero"]').click();
    await pagina.waitForSelector('#tablero table');
    const h = pagina.locator('.historia');
    const t = (await h.innerText()).replace(/\s+/g, ' ');
    assert.match(t, /De cada 100 pacientes nuevos, 68 no vuelven nunca después de su primera consulta/);
    assert.match(t, /32 vuelven a su 1\.ª reevaluación, 17 llegan a la 2\.ª y 10 a la 3\.ª/);
    assert.match(t, /Donde más se pierden es en el primer regreso: el 68% no vuelve después de la primera consulta/);
    assert.match(t, /Quien vuelve una vez tiende a seguir: el 53% vuelve también a la 2\.ª/);
    assert.match(t, /El mes con más pacientes perdidos fue agosto 2026 \(75% no volvió\); el mejor, junio 2026 \(63%\)/);
    assert.match(t, /La meta es que vuelva el 60%; hoy vuelve el 32%/);
    assert.equal(await h.locator('.waffle i').count(), 100);
    assert.equal(await h.locator('.waffle i.paso1').count(), 68);
    assert.equal(await h.locator('.waffle i.paso4').count(), 10);
    await pagina.selectOption('#t-med', 'Dr. ELÍ FABRIZIO CABANILLAS HUALPA');
    assert.match((await h.innerText()).replace(/\s+/g, ' '), /De cada 100 pacientes nuevos del Dr\. Cabanillas/);
    await pagina.selectOption('#t-esp', 'REUMATOLOGÍA');
    await pagina.selectOption('#t-med', '');
    assert.match((await pagina.locator('.historia').innerText()).replace(/\s+/g, ' '), /Son pocos pacientes \(6\): tome estas cifras con cautela/);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});
