// Resumen mensual de la pantalla «Resumen». Datos inventados.
// Regla acordada (b): un paciente que no volvió cuenta en el mes de su última consulta.
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar, plano } = require('./cargar');
const { cita, seg, reglas, MEDICO } = require('./fixtures');
const L = cargar();

const HOY = '2026-10-02';
const CITAS = [
  cita({ dni: '1', fecha: '2026-07-05' }), cita({ dni: '1', fecha: '2026-07-20' }), cita({ dni: '1', fecha: '2026-08-10' }),
  cita({ dni: '2', fecha: '2026-07-10' }),
  cita({ dni: '3', fecha: '2026-09-25' })
];
const fila = (r, mes) => r.find(x => x.MES === mes && x.MEDICO === MEDICO);

test('reevaluación: cuenta en el mes de la última consulta, separando nuevos y en control', () => {
  const r = plano(L.resumenPorMes(CITAS, [], [], reglas(L), HOY));
  const jul = fila(r, '2026-07'), ago = fila(r, '2026-08'), set = fila(r, '2026-09');
  assert.deepEqual([jul.NUEVOS, jul.NUEVOS_NO, jul.NUEVOS_CURSO, jul.CONTROL, jul.CONTROL_NO], [1, 1, 0, 1, 0]);
  assert.deepEqual([ago.NUEVOS, ago.CONTROL, ago.CONTROL_NO, ago.CONTROL_CURSO], [0, 1, 1, 0]);
  assert.deepEqual([set.NUEVOS, set.NUEVOS_NO, set.NUEVOS_CURSO], [1, 0, 1]);
});

test('hierro y procedimientos: no siguió = cotizó y nunca aceptó; una vez por paciente y mes', () => {
  const ind = o => Object.assign({ TIPO: 'HIERRO', DETALLE: 'HIERRO', MEDICO_SOLICITANTE: '', EMPAREJAMIENTO: 'AUTOMÁTICO' }, o);
  const inds = [
    ind({ ID: 'I1', FECHA: '2026-07-11', ESTADO: 'COTIZÓ', DNI: '1' }),
    ind({ ID: 'I2', FECHA: '2026-07-15', ESTADO: 'ACEPTÓ', DNI: '1' }),
    ind({ ID: 'I3', FECHA: '2026-07-12', ESTADO: 'COTIZÓ', DNI: '2' }),
    ind({ ID: 'I4', FECHA: '2026-07-21', ESTADO: 'COTIZÓ', DNI: '1', TIPO: 'PROCEDIMIENTO', DETALLE: 'AMO + BIOPSIA' })
  ];
  const jul = fila(plano(L.resumenPorMes(CITAS, inds, [], reglas(L), HOY)), '2026-07');
  assert.deepEqual([jul.HIERRO, jul.HIERRO_NO, jul.PROC, jul.PROC_NO], [2, 1, 1, 1]);
});

test('recuperados: seguimientos hechos en el mes y cuántos volvieron', () => {
  const segs = [seg({ dni: '2', fecha: '2026-09-01' }), seg({ dni: '1', fecha: '2026-09-28' })];
  const citas = CITAS.concat([cita({ dni: '2', fecha: '2026-09-15' })]);
  const set = fila(plano(L.resumenPorMes(citas, [], segs, reglas(L), HOY)), '2026-09');
  assert.deepEqual([set.SEGUIMIENTOS, set.RECUPERADOS], [2, 1]);
});

test('las filas van del mes más reciente al más antiguo y todo número es entero', () => {
  const r = plano(L.resumenPorMes(CITAS, [], [], reglas(L), HOY));
  assert.deepEqual(r.map(x => x.MES), ['2026-09', '2026-08', '2026-07']);
  assert.ok(r.every(x => Object.keys(x).every(k => k === 'MES' || k === 'MEDICO' || Number.isInteger(x[k]))));
});
