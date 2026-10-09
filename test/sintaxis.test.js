// test/sintaxis.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar } = require('./cargar');

test('Logica.gs y Codigo.gs cargan juntos y exponen las funciones públicas', () => {
  const ctx = cargar(['Logica.gs', 'Registro.gs', 'Resultados.gs', 'Tablero.gs', 'Codigo.gs', 'RegistroServidor.gs', 'ResultadoServidor.gs']);
  for (const f of ['doGet', 'bootstrap', 'getBandeja', 'getPaciente', 'buscar', 'marcarSeguimiento',
    'descartar', 'confirmarEmparejamiento', 'getKpi', 'getResumen',
    'guardarRegistro', 'marcarSesion', 'anularRegistro', 'anularSesion', 'darDeAlta', 'anularAlta', 'getRegistrosHoy', 'buscarPacienteRegistro',
    'registrarResultado', 'anularResultado', 'getTablero', 'asignarDniIndicacion']) {
    assert.equal(typeof ctx[f], 'function', f);
  }
  assert.equal(ctx.CONFIG.SS_ID, '1L8fY-NXWE1agakIPEdqoLnLry0-lvYr0Z-9JfsfGxRM');
  assert.equal(ctx.CONFIG.HIERRO_ID, '1FrJ9oXyeHLLABqLcSA2VyXry-x_ZeFow6LsSACeJw8o');
});

test('Menu.gs carga con los otros y expone las funciones del menú', () => {
  const ctx = cargar(['Logica.gs', 'Registro.gs', 'Resultados.gs', 'Tablero.gs', 'Codigo.gs', 'RegistroServidor.gs', 'ResultadoServidor.gs', 'Menu.gs']);
  for (const f of ['onOpen', 'actualizar', 'verificar', 'prepararHojas', 'importarIndicaciones', 'importarLoQueFalta']) {
    assert.equal(typeof ctx[f], 'function', f);
  }
  const base = ctx.hojasBase_();
  assert.deepEqual(Object.keys(base), ['CITAS', 'PACIENTES', 'INDICACIONES', 'SEGUIMIENTOS', 'BITACORA', 'CONTACTOS_CRM', 'KPI', 'REGISTROS', 'SESIONES', 'ALTAS']);
  for (const f of ['actualizacionDiaria', 'activarDiaria']) assert.equal(typeof ctx[f], 'function', f);
});
