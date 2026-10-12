const { chromium } = require('../node_modules/playwright');
const rutas = require('./rutas');
(async () => {
  const nav = await chromium.launch({ args: ['--lang=es-PE'] });
  const ctx = await nav.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1.25, reducedMotion: 'reduce', locale: 'es-PE' });
  await rutas(ctx); const p = await ctx.newPage();
  await p.addInitScript(() => { localStorage.setItem('seg.usuario', 'MAGALY'); localStorage.setItem('seg.modo', 'claro'); });
  await p.goto('file://' + require('path').resolve(__dirname, '../src/Index.html')); await p.waitForFunction(() => S.fase === 'listo'); await p.waitForTimeout(500);
  await p.evaluate(() => ir('indicadores', true)); await p.waitForTimeout(1500);
  await p.locator('#iseg [data-tab="procs"]').click(); await p.waitForTimeout(800);
  await p.locator('#ipanel button', { hasText: 'Por médico' }).click(); await p.waitForTimeout(800);
  await p.screenshot({ path: __dirname + '/tutorial-chp/public/ger/i-procs-medico.png' });
  const b = await p.locator('#ipanel table').first().boundingBox(); console.log(JSON.stringify(b));
  await nav.close();
})();
