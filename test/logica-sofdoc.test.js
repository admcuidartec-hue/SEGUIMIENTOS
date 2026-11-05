// «Verificar»: hasta qué fecha llega SOFDOC. Datos inventados.
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar, plano } = require('./cargar');
const L = cargar();

const c = (FECHA, ESTADO) => ({ FECHA, ESTADO, DNI: '40111222' });
const HOY = '2026-11-05';

test('al día: la última cita REALIZADO de hasta hoy manda; una agendada futura no la adelanta y se informa aparte', () => {
  const l = plano(L.lineasSofdoc([c('2026-11-01', 'REALIZADO'), c('2026-11-04', 'Realizado'), c('2026-11-05', 'PROGRAMADO'),
    c('2026-12-20', 'PROGRAMADO')], HOY, []));
  assert.deepEqual(l, ['✓ SOFDOC: citas realizadas hasta el 04/11/2026 (ayer).', 'ℹ SOFDOC: hay citas agendadas hasta el 20/12/2026.']);
});

test('atrasada más de 2 días: aviso con qué hacer', () => {
  const [l] = L.lineasSofdoc([c('2026-10-28', 'REALIZADO'), c('2026-10-30', 'CANCELADO')], HOY, []);
  assert.equal(l, '⚠ SOFDOC: citas realizadas hasta el 28/10/2026, hace 8 días. Exporte de SOFDOC, péguelo en la «Hoja 1» y use «Actualizar».');
});

test('sin citas realizadas, o con fechas inválidas: ✗', () => {
  assert.match(L.lineasSofdoc([c('mañana', 'REALIZADO'), c('2026-11-20', 'PROGRAMADO')], HOY, [])[0], /^✗ SOFDOC: CITAS no tiene ninguna cita realizada/);
  assert.match(L.lineasSofdoc([], HOY, [])[0], /^✗/);
});

test('la última carga es la más reciente que trajo citas nuevas: ni la de las 7:00 que releyó la misma «Hoja 1», ni un error', () => {
  const cargas = [
    { FECHA_HORA: '2026-11-03 10:12', USUARIO: 'MENÚ', ACCION: 'ACTUALIZAR', DETALLE: '900 filas leídas, 340 citas nuevas, 2 cambiadas' },
    { FECHA_HORA: '2026-11-04 07:00', USUARIO: 'AUTOMÁTICO', ACCION: 'ACTUALIZAR', DETALLE: '900 filas leídas, 0 citas nuevas, 0 cambiadas' },
    { FECHA_HORA: '2026-11-04 09:00', USUARIO: 'MAGALY', ACCION: 'SEGUIMIENTO', DETALLE: '900 filas leídas, 5 citas nuevas' },
    { FECHA_HORA: '2026-11-05 07:00', USUARIO: 'AUTOMÁTICO', ACCION: 'ACTUALIZAR', DETALLE: 'Error: 1 citas nuevas' }
  ];
  assert.deepEqual(plano(L.lineasSofdoc([c('2026-11-05', 'REALIZADO')], HOY, cargas)), ['✓ SOFDOC: citas realizadas hasta el 05/11/2026 (hoy).',
    'ℹ SOFDOC: última carga con citas nuevas el 03/11/2026 10:12 (MENÚ): 340 citas nuevas.']);
  const una = [{ FECHA_HORA: '2026-11-05 11:40', USUARIO: 'MENÚ', ACCION: 'ACTUALIZAR', DETALLE: '901 filas leídas, 1 citas nuevas' }];
  assert.equal(L.lineasSofdoc([c('2026-11-05', 'REALIZADO')], HOY, cargas.concat(una))[1],
    'ℹ SOFDOC: última carga con citas nuevas el 05/11/2026 11:40 (MENÚ): 1 cita nueva.');
});
