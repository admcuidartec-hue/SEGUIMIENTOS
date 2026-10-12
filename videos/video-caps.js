const { chromium } = require('../node_modules/playwright');
const rutas = require('./rutas');
const fs = require('fs');
const OUT = __dirname + '/tutorial-chp/public/cap/';
const meta = {};
(async () => {
  const nav = await chromium.launch({ args: ['--lang=es-PE'], env: Object.assign({}, process.env, { LANG: 'es_PE.UTF-8', LANGUAGE: 'es' }) });
  const ctx = await nav.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1.25, reducedMotion: 'reduce', locale: 'es-PE' });
  await rutas(ctx); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('seg.usuario', 'MAGALY'); localStorage.setItem('seg.modo', 'claro'); });
  await p.goto('file://' + require('path').resolve(__dirname, '../src/Index.html')); await p.waitForFunction(() => S.fase === 'listo'); await p.waitForTimeout(500);
  await p.addStyleTag({ content: '#aviso{visibility:hidden!important}' });
  const rect = async sel => { const l = typeof sel === 'string' ? p.locator(sel).first() : sel; const b = await l.boundingBox(); return b && { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
  const shot = async (n, boxes) => { await p.waitForTimeout(450); await p.screenshot({ path: OUT + n + '.png' }); const m = {}; for (const [k, s] of Object.entries(boxes || {})) m[k] = await rect(s); meta[n] = m; console.log(n, JSON.stringify(m)); };
  const abrir = async id => {
    await p.evaluate(id => { S.lim = { rec: 99, mes: 99, ant: 99 }; pintarTablero(); const e = [...document.querySelectorAll('#tablero [data-card]')].find(e => e.dataset.card === id); e.scrollIntoView({ block: 'center' }); e.click(); }, id);
    await p.waitForFunction(() => document.getElementById('panel').classList.contains('abierto')); await p.waitForTimeout(350);
  };
  const cerrar = async () => { await p.keyboard.press('Escape'); await p.keyboard.press('Escape'); await p.waitForTimeout(450); };
  const tarjeta = id => `#tablero [data-card="${id}"]`;

  await p.evaluate(() => { S.lim = { rec: 99, mes: 99, ant: 99 }; pintarTablero(); });
  await shot('t01-tablero', { usuario: '#usuario', col1: '.col[data-col="1"] h2', col2: '.col[data-col="2"] h2', col3: '.col[data-col="3"] h2', col4: '.col[data-col="4"] h2', filtros: '#fmes', meta: '#metadia' });
  // Caso 1: reevaluación
  const reev = await p.evaluate(() => S.pacientes.find(x => x.col === 1 && x.t === 'reev' && !x.oculto).id);
  await abrir(reev);
  await shot('c1a-panel', { panel: '#panel', copiar: p.locator('#panel button', { hasText: 'Copiar' }), acciones: '#panel .acc:not(.cierra)', agendo: '#panel [data-acc="agendo"]' });
  await p.locator('#panel [data-acc="agendo"]').click(); await p.waitForTimeout(300);
  await shot('c1b-agendo', { panel: '#panel', fecha: '#panel .paso input[type=date], #panel input[type=date]', confirmar: '#panel [data-confirmar]' });
  await p.locator('#panel [data-confirmar]').click(); await p.waitForTimeout(900); await cerrar();
  await p.evaluate(id => document.querySelector(`#tablero [data-card="${id}"]`).scrollIntoView({ block: 'center' }), reev);
  await shot('c1c-agendado', { tarjeta: tarjeta(reev) });
  // Caso 2: hierro aceptó
  await abrir('REG-000021');
  await shot('c2a-panel', { panel: '#panel', acepto: '#panel [data-acc="acepto"]', nodesea: '#panel [data-acc="nodesea"]' });
  await p.locator('#panel [data-acc="acepto"]').click(); await p.waitForTimeout(300);
  await shot('c2b-acepto', { panel: '#panel', fecha: '#panel input[type=date]', confirmar: '#panel [data-confirmar]' });
  await p.locator('#panel [data-confirmar]').click(); await p.waitForTimeout(900); await cerrar();
  await p.evaluate(() => document.querySelector('#tablero [data-card="REG-000021"]').scrollIntoView({ block: 'center' }));
  await shot('c2c-agendado', { tarjeta: tarjeta('REG-000021') });
  // Caso 3: día de la sesión con próxima
  await abrir('REG-000021');
  const prox = await p.evaluate(() => masDias(S.hoy, 7));
  await p.fill('#pfp', prox); await p.waitForTimeout(200);
  await shot('c3a-sesion', { panel: '#panel', fecha: '#pfs', proxima: '#pfp', marcar: '#panel [data-marcar-sesion]', cambiar: p.locator('#panel button', { hasText: 'Cambiar fecha' }) });
  await p.locator('#panel [data-marcar-sesion]').click(); await p.waitForTimeout(1200); await cerrar();
  await p.evaluate(() => { S.lim = { rec: 99, mes: 99, ant: 99 }; pintarTablero(); document.querySelector('#tablero [data-card="REG-000021"]').scrollIntoView({ block: 'center' }); });
  await shot('c3b-sesion2', { tarjeta: tarjeta('REG-000021') });
  // Caso 4: por reevaluar
  await abrir('REG-000022');
  await shot('c4-porreevaluar', { panel: '#panel', alerta: '#panel .alerta', agendo: '#panel [data-acc="agendo"]' });
  await cerrar();
  // Caso 5: control + laboratorio
  await p.evaluate(() => { DEMO._registroConSesiones(); ir('registro', true); }); await p.waitForTimeout(600);
  await p.locator('[data-rtab="control"]').click(); await p.waitForTimeout(300);
  await p.fill('#rdni', '40111222'); await p.waitForSelector('text=Paciente conocido'); await p.waitForTimeout(300);
  await p.locator('#rmed').selectOption({ index: 1 }); await p.fill('#rexamenes', 'Hemograma, ferritina'); await p.waitForTimeout(300);
  await shot('c5a-control', { form: 'form, #rform', dni: '#rdni', conocido: 'text=Paciente conocido', examenes: '#rexamenes', retorno: '#rretorno', boton: '#rgo' });
  await p.locator('#rgo').click(); await p.waitForTimeout(1200);
  await shot('c5b-registrado', { lista: '#rlista', fila: '#rlista li >> nth=0' });
  // Caso 6: decisión del médico
  await p.locator('[data-rtab="decision"]').click(); await p.waitForTimeout(300);
  await p.fill('#adni', '40111222'); await p.waitForTimeout(900);
  const esp = p.locator('#aesps [data-esp]:not([disabled])').first(); if (await esp.count()) await esp.click();
  await p.locator('#amed').selectOption({ index: 1 });
  await p.locator('input[name="rdec"][value="ALTA 6 MESES"]').check({ force: true }); await p.waitForTimeout(400);
  await shot('c6-decision', { dni: '#adni', esp: '#aesps', decs: '.decs', opcion: p.locator('label.dec', { hasText: '6 meses' }), nota: '.nota-dec', boton: '#rgo' });
  // Caso 7: editar
  await p.locator('[data-rtab="indicacion"]').click(); await p.waitForTimeout(400);
  const fila = p.locator('#rlista [data-editar]').first(); await fila.click(); await p.waitForTimeout(400);
  await p.locator('#rlista label', { hasText: 'Teléfono' }).locator('input').fill('912 345 678'); await p.locator('#rlista label', { hasText: 'Teléfono' }).locator('input').blur(); await p.waitForTimeout(200);
  await shot('c7-editar', { lista: '#rlista', fila: p.locator('#rlista li').filter({ has: p.locator('button', { hasText: 'Guardar cambios' }) }), telefono: p.locator('#rlista label', { hasText: 'Teléfono' }), guardar: p.locator('#rlista button', { hasText: 'Guardar cambios' }) });
  fs.writeFileSync(OUT + 'meta.json', JSON.stringify(meta, null, 1));
  if (errs.length) console.log('ERRORES', errs);
  await nav.close();
})();
