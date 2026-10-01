// test/sintaxis.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar } = require('./cargar');

test('Logica.gs y Codigo.gs cargan juntos y exponen las funciones públicas', () => {
  const ctx = cargar(['Logica.gs', 'Codigo.gs']);
  for (const f of ['doGet', 'bootstrap', 'getBandeja', 'getPaciente', 'buscar', 'marcarSeguimiento',
    'descartar', 'confirmarEmparejamiento', 'getKpi']) {
    assert.equal(typeof ctx[f], 'function', f);
  }
  assert.equal(ctx.CONFIG.SS_ID, '1L8fY-NXWE1agakIPEdqoLnLry0-lvYr0Z-9JfsfGxRM');
  assert.equal(ctx.CONFIG.HIERRO_ID, '1FrJ9oXyeHLLABqLcSA2VyXry-x_ZeFow6LsSACeJw8o');
});

test('Menu.gs carga con los otros y expone las funciones del menú', () => {
  const ctx = cargar(['Logica.gs', 'Codigo.gs', 'Menu.gs']);
  for (const f of ['onOpen', 'actualizar', 'verificar', 'prepararHojas', 'importarIndicaciones']) {
    assert.equal(typeof ctx[f], 'function', f);
  }
  const base = ctx.hojasBase_();
  assert.deepEqual(Object.keys(base), ['CITAS', 'PACIENTES', 'INDICACIONES', 'SEGUIMIENTOS', 'BITACORA', 'KPI']);
});
