const { chromium } = require('../node_modules/playwright');
const rutas = require('./rutas');
const fs = require('fs');
const OUT = __dirname + '/tutorial-chp/public/ger/';
const meta = {};
const URL = 'file://' + require('path').resolve(__dirname, '../src/Index.html');
(async () => {
  const nav = await chromium.launch({ args: ['--lang=es-PE'], env: Object.assign({}, process.env, { LANG: 'es_PE.UTF-8', LANGUAGE: 'es' }) });
  const nuevo = async (vp, modo, dsf) => {
    const ctx = await nav.newContext({ viewport: vp, deviceScaleFactor: dsf || 1.25, reducedMotion: 'reduce', locale: 'es-PE' });
    await rutas(ctx); const p = await ctx.newPage();
    p.on('pageerror', e => console.log('ERR', e.message));
    await p.addInitScript(m => { localStorage.setItem('seg.usuario', 'MAGALY'); localStorage.setItem('seg.modo', m); }, modo);
    await p.goto(URL); await p.waitForFunction(() => S.fase === 'listo'); await p.waitForTimeout(500);
    await p.addStyleTag({ content: '#aviso{visibility:hidden!important}' });
    return p;
  };
  const p = await nuevo({ width: 1600, height: 1000 }, 'claro');
  const rect = async sel => { const l = typeof sel === 'string' ? p.locator(sel).first() : sel; const b = await l.boundingBox(); return b && { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
  const shot = async (n, boxes, pg) => { const q = pg || p; await q.waitForTimeout(500); await q.screenshot({ path: OUT + n + '.png' }); const m = {}; for (const [k, s] of Object.entries(boxes || {})) m[k] = await rect(s); meta[n] = m; console.log(n, JSON.stringify(m)); };
  const abrir = async id => {
    await p.evaluate(id => { S.lim = { rec: 99, mes: 99, ant: 99 }; pintarTablero(); const e = [...document.querySelectorAll('#tablero [data-card]')].find(e => e.dataset.card === id); e.scrollIntoView({ block: 'center' }); e.click(); }, id);
    await p.waitForFunction(() => document.getElementById('panel').classList.contains('abierto')); await p.waitForTimeout(350);
  };
  const cerrar = async () => { await p.keyboard.press('Escape'); await p.keyboard.press('Escape'); await p.waitForTimeout(450); };

  await shot('g01-tablero', { kpis: '#kpis', meta: '#metadia', seg: '#seg', fmed: '#fmed', fmes: '#fmes', fesp: '#fesp', tablero: '#tablero' });
  await p.selectOption('#fmed', { index: 1 }); await p.waitForTimeout(400);
  await shot('g02-tablero-medico', { kpis: '#kpis', fmed: '#fmed', tablero: '#tablero' });
  await p.selectOption('#fmed', { index: 0 }); await p.waitForTimeout(300);
  const reev = await p.evaluate(() => S.pacientes.find(x => x.col === 1 && x.t === 'reev' && !x.oculto).id);
  await abrir(reev);
  await shot('g03-panel', { panel: '#panel', alerta: '#panel .alerta', acciones: '#panel .acc:not(.cierra)', cierres: '#panel .acc.cierra' });
  await cerrar();
  await abrir('REG-000002'); await p.locator('#panel [data-ficha]').click(); await p.waitForTimeout(1000);
  await shot('g05-ficha', { titulo: '#ficha h1, #ficha h2', ficha: '#ficha' });
  await p.evaluate(() => { DEMO._registroConSesiones(); ir('registro', true); }); await p.waitForTimeout(600);
  await shot('g04-registro', { tabs: '[data-rtab="indicacion"]', lista: '#rlista' });
  await p.evaluate(() => ir('indicadores', true)); await p.waitForTimeout(1500);
  for (const k of ['resumen', 'llegan', 'campanas', 'procs', 'recup', 'motivos', 'sinpac']) {
    await p.locator(`#iseg [data-tab="${k}"]`).click(); await p.waitForTimeout(900);
    await shot('i-' + k, { tabs: '#iseg', panel: '#ipanel', imed: '#imed', imprimir: '#iimprimir' });
  }
  // Resumen imprimible
  await p.evaluate(() => { armarImprimible(); document.documentElement.classList.add('imp-listo'); });
  await p.emulateMedia({ media: 'print' }); await p.waitForTimeout(800);
  await p.screenshot({ path: OUT + 'g06-imprimible.png', fullPage: true }); console.log('g06');
  await p.emulateMedia({ media: 'screen' });
  // Celular y modo oscuro
  const m = await nuevo({ width: 390, height: 844 }, 'claro', 2);
  await m.screenshot({ path: OUT + 'g07-movil.png' }); console.log('g07');
  const o = await nuevo({ width: 1600, height: 1000 }, 'oscuro');
  await o.screenshot({ path: OUT + 'g08-oscuro.png' }); console.log('g08');
  fs.writeFileSync(OUT + 'meta.json', JSON.stringify(meta, null, 1));
  await nav.close();
})();
