// test/logica-kpi.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar, plano } = require('./cargar');
const { cita, seg, reglas, MEDICO } = require('./fixtures');
const L = cargar();

test('cohortes: solo cuentan los pacientes a quienes ya les tocaba volver', () => {
  const citas = [
    cita({ dni: '1', fecha: '2026-07-01' }), cita({ dni: '1', fecha: '2026-07-25' }),
    cita({ dni: '2', fecha: '2026-07-10' }),
    cita({ dni: '4', fecha: '2026-09-25' })
  ];
  const k = plano(L.kpiCohortes(citas, reglas(L), '2026-10-01'));
  assert.deepEqual(k, [
    { COHORTE: '2026-07', ESPECIALIDAD: 'HEMATOLOGÍA', MEDICO, ETAPA: 1, ELEGIBLES: 2, VOLVIERON: 1 },
    { COHORTE: '2026-07', ESPECIALIDAD: 'HEMATOLOGÍA', MEDICO, ETAPA: 2, ELEGIBLES: 1, VOLVIERON: 0 }
  ]);
});

test('indicaciones: sin médico solicitante se usa el de la última cita anterior', () => {
  const citas = [cita({ dni: '1', fecha: '2026-06-01', medico: 'Dr. A' }), cita({ dni: '1', fecha: '2026-08-01', medico: 'Dr. B' })];
  const base = { TIPO: 'HIERRO', DETALLE: 'HIERRO', MEDICO_SOLICITANTE: '' };
  const inds = [
    Object.assign({ FECHA: '2026-07-01', ESTADO: 'COTIZÓ', DNI: '1' }, base),
    Object.assign({ FECHA: '2026-07-15', ESTADO: 'ACEPTÓ', DNI: '1' }, base),
    Object.assign({ FECHA: '2026-07-20', ESTADO: 'COTIZÓ', DNI: '' }, base)
  ];
  assert.deepEqual(plano(L.kpiIndicaciones(inds, citas)), [
    { MES: '2026-07', TIPO: 'HIERRO', DETALLE: 'HIERRO', MEDICO: 'Dr. A', INDICADAS: 2, ACEPTADAS: 1 },
    { MES: '2026-07', TIPO: 'HIERRO', DETALLE: 'HIERRO', MEDICO: 'SIN MÉDICO', INDICADAS: 1, ACEPTADAS: 0 }
  ]);
});

test('recuperación: volvió si hay cita realizada o agendada después del seguimiento', () => {
  const citas = [cita({ dni: '1', fecha: '2026-07-01' }), cita({ dni: '1', fecha: '2026-09-12' }), cita({ dni: '2', fecha: '2026-07-01' })];
  const segs = [seg({ dni: '1', fecha: '2026-09-01' }), seg({ dni: '2', fecha: '2026-09-01' }),
    seg({ dni: '2', fecha: '2026-09-20', accion: 'DESCARTADO', motivo: 'OTRO' })];
  assert.deepEqual(plano(L.kpiRecuperacion(segs, citas)), [
    { MES: '2026-09', RESPONSABLE: 'MAGALY', ESPECIALIDAD: 'HEMATOLOGÍA', MEDICO, VOLVIO: 1, DIAS: 11 },
    { MES: '2026-09', RESPONSABLE: 'MAGALY', ESPECIALIDAD: 'HEMATOLOGÍA', MEDICO, VOLVIO: 0, DIAS: '' }
  ]);
});

test('motivos de descarte, de mayor a menor', () => {
  const segs = [seg({ fecha: '2026-09-01', accion: 'DESCARTADO', motivo: 'A' }), seg({ fecha: '2026-09-02', accion: 'DESCARTADO', motivo: 'B' }),
    seg({ dni: '9', fecha: '2026-09-03', accion: 'DESCARTADO', motivo: 'A' }), seg({ fecha: '2026-09-04' })];
  assert.deepEqual(plano(L.kpiMotivos(segs)), [{ MOTIVO: 'A', N: 2 }, { MOTIVO: 'B', N: 1 }]);
});

test('calcularKpi lista las indicaciones sin candidato', () => {
  const inds = [{ ID: 'IND-1', FECHA: '2026-05-04', TIPO: 'HIERRO', DETALLE: 'HIERRO', NOMBRE: 'PAOLA RIVERA', TELEFONO: '956789012',
    EMPAREJAMIENTO: 'SIN CANDIDATO', DNI: '', ESTADO: 'COTIZÓ', MEDICO_SOLICITANTE: '' }];
  const k = plano(L.calcularKpi([], inds, [], reglas(L), '2026-10-01'));
  assert.deepEqual(k.sinCandidato, [{ ID: 'IND-1', FECHA: '2026-05-04', TIPO: 'HIERRO', NOMBRE: 'PAOLA RIVERA', TELEFONO: '956789012' }]);
});

test('filasHojaKpi: todas las filas tienen 7 columnas y la tasa es una fracción', () => {
  const kpi = { cohortes: [{ COHORTE: '2026-07', ESPECIALIDAD: 'H', MEDICO: 'M', ETAPA: 1, ELEGIBLES: 4, VOLVIERON: 2 }],
    indicaciones: [{ MES: '2026-07', TIPO: 'HIERRO', DETALLE: 'HIERRO', MEDICO: 'M', INDICADAS: 0, ACEPTADAS: 0 }],
    recuperacion: [], motivos: [], sinCandidato: [] };
  const f = plano(L.filasHojaKpi(kpi));
  assert.ok(f.every(r => r.length === 7));
  assert.equal(f[2][6], 0.5);
  assert.equal(f[f.length - 1][6], '');
});
