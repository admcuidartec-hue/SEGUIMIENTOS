// Hierro y procedimientos como listas propias de la bandeja. Datos inventados.
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar, plano } = require('./cargar');
const { cita, seg, reglas } = require('./fixtures');
const L = cargar();

const ind = o => Object.assign({ ID: 'IND', FECHA: '2026-09-01', TIPO: 'HIERRO', DETALLE: 'HIERRO', CANTIDAD: '', MEDICO_SOLICITANTE: '',
  ASESORA: 'LORENA', NOMBRE: 'ROSA QUISPE', TELEFONO: '', ESTADO: 'COTIZÓ', OBSERVACIONES: '', DNI: '40111222', EMPAREJAMIENTO: 'AUTOMÁTICO' }, o);
const HOY = '2026-10-01';
const pend = (citas, inds, segs, hoy) => plano(L.pendientesIndicacion(citas, inds, segs || [], reglas(L), hoy || HOY));

test('pendientesIndicacion: una fila por DNI y tipo, con lo que necesita la bandeja', () => {
  const citas = [cita({ fecha: '2026-08-20', medico: 'Dr. ELÍ FABRIZIO CABANILLAS HUALPA' }), cita({ fecha: '2026-09-25' })];
  const inds = [
    ind({ ID: 'IND-1', FECHA: '2026-08-25', CANTIDAD: 2, TELEFONO: '987654321' }),
    ind({ ID: 'IND-2', FECHA: '2026-09-01', CANTIDAD: 2 }),
    ind({ ID: 'IND-3', FECHA: '2026-08-25', TIPO: 'PROCEDIMIENTO', DETALLE: 'AMO + BIOPSIA' })
  ];
  const p = pend(citas, inds);
  assert.equal(p.length, 2);
  const h = p.find(x => x.TIPO_SEGUIMIENTO === 'HIERRO');
  assert.equal(h.ESPECIALIDAD, 'HIERRO');
  assert.equal(h.DNI, '40111222');
  assert.equal(h.NOMBRE, 'ROSA ELENA QUISPE HUAMAN');
  assert.equal(h.TELEFONOS, '987654321');
  assert.equal(h.FECHA_COTIZACION, '2026-09-01');
  assert.equal(h.DIAS, 30);
  assert.equal(h.DETALLE, 'Hierro (Ferinject) ×2');
  assert.equal(h.MEDICO_ULTIMO, 'Dr. ELÍ FABRIZIO CABANILLAS HUALPA', 'médico de la consulta anterior a la cotización');
  assert.equal(h.ESPECIALIDAD_CONSULTA, 'HEMATOLOGÍA');
  assert.equal(h.ULTIMA_CITA, '2026-09-25');
  assert.equal(h.ESTADO, 'PENDIENTE');
  assert.equal(h.N_SEGUIMIENTOS, 0);
  const pr = p.find(x => x.TIPO_SEGUIMIENTO === 'PROCEDIMIENTO');
  assert.equal(pr.ESPECIALIDAD, 'PROCEDIMIENTO');
  assert.equal(pr.DETALLE, 'AMO + BIOPSIA');
});

test('pendientesIndicacion: también trae los teléfonos del CRM', () => {
  const contactos = [{ DNI_PACIENTE: '40111222', TELEFONO: '955111222' }];
  const p = plano(L.pendientesIndicacion([], [ind({ TELEFONO: '987654321' })], [], reglas(L), HOY, contactos));
  assert.equal(p[0].TELEFONOS, '987654321 / 955111222');
});

test('pendientesIndicacion: aceptado después, sin DNI o sin fecha no entra', () => {
  const inds = [
    ind({ FECHA: '2026-09-01' }), ind({ FECHA: '2026-09-03', ESTADO: 'ACEPTÓ' }),
    ind({ DNI: '', TIPO: 'PROCEDIMIENTO' }),
    ind({ DNI: '40222333', FECHA: '' })
  ];
  assert.deepEqual(pend([cita({ fecha: '2026-08-01' })], inds), []);
});

test('pendientesIndicacion: una cotización nueva tras un aceptado vuelve a estar pendiente', () => {
  const inds = [ind({ FECHA: '2026-07-01', ESTADO: 'ACEPTÓ' }), ind({ FECHA: '2026-09-10' })];
  const p = pend([cita({ fecha: '2026-06-01' })], inds);
  assert.equal(p.length, 1);
  assert.equal(p[0].FECHA_COTIZACION, '2026-09-10');
});

test('pendientesIndicacion: el médico solicitante gana; sin cita usa el nombre de la indicación', () => {
  const p = pend([], [ind({ DNI: '40999888', NOMBRE: 'PEDRO SALAS', MEDICO_SOLICITANTE: 'Dra. KAREN DIANA MATOS PEÑA' })]);
  assert.equal(p[0].NOMBRE, 'PEDRO SALAS');
  assert.equal(p[0].MEDICO_ULTIMO, 'Dra. KAREN DIANA MATOS PEÑA');
  assert.equal(p[0].ESPECIALIDAD_CONSULTA, '');
});

test('pendientesIndicacion: los seguimientos de su tipo dan CONTACTADO y DESCARTADO; los de reevaluación no cuentan', () => {
  const citas = [cita({ fecha: '2026-08-01' })];
  const inds = [ind({ FECHA: '2026-08-01' })];
  const s = (fecha, accion) => seg({ fecha, esp: 'HIERRO', accion });
  assert.equal(pend(citas, inds, [seg({ fecha: '2026-09-28' })])[0].ESTADO, 'PENDIENTE', 'seguimiento de HEMATOLOGÍA');
  let p = pend(citas, inds, [s('2026-09-28')])[0];
  assert.equal(p.ESTADO, 'CONTACTADO');
  assert.equal(p.N_SEGUIMIENTOS, 1);
  assert.equal(p.ULTIMO_SEGUIMIENTO, '2026-09-28');
  assert.equal(pend(citas, inds, [s('2026-09-01')])[0].ESTADO, 'PENDIENTE', 'pasada la espera vuelve');
  assert.equal(pend(citas, inds, [s('2026-09-01', 'DESCARTADO')])[0].ESTADO, 'DESCARTADO');
  assert.equal(pend(citas, inds, [s('2026-08-20'), s('2026-09-05'), s('2026-09-12')])[0].ESTADO, 'DESCARTADO', '3 intentos');
  assert.equal(pend(citas, inds, [s('2026-07-20', 'DESCARTADO')])[0].ESTADO, 'PENDIENTE', 'un descarte anterior a la cotización no cuenta');
});

test('pendientesIndicacion: pasado CORTE_INDICACIONES_DIAS queda ANTIGUO', () => {
  const r = L.reglasDesdeFilas(['PARAMETRO', 'VALOR'], [['CORTE_INDICACIONES_DIAS', 20]]);
  assert.equal(r.corteIndicaciones, 20);
  assert.equal(L.reglasDesdeFilas([], []).corteIndicaciones, 180);
  const p = plano(L.pendientesIndicacion([], [ind({ FECHA: '2026-09-01' })], [], r, HOY));
  assert.equal(p[0].ESTADO, 'ANTIGUO');
});

test('META_RETORNO_PCT se lee de REGLAS y vale 60 por omisión', () => {
  assert.equal(L.reglasDesdeFilas([], []).metaRetorno, 60);
  assert.equal(L.reglasDesdeFilas(['PARAMETRO', 'VALOR'], [['META_RETORNO_PCT', 55]]).metaRetorno, 55);
});

test('ordenarBandeja une reevaluaciones vencidas con hierro y procedimientos pendientes', () => {
  const ps = [
    { DNI: '1', ESPECIALIDAD: 'HEMATOLOGÍA', ESTADO: 'VENCIDO', N_SEGUIMIENTOS: 0, PENDIENTE: '', DIAS_ATRASO: 3 },
    { DNI: '2', ESPECIALIDAD: 'HEMATOLOGÍA', ESTADO: 'AL DÍA', N_SEGUIMIENTOS: 0, PENDIENTE: '', DIAS_ATRASO: 0 }
  ];
  const pe = [
    { DNI: '2', ESPECIALIDAD: 'HIERRO', TIPO_SEGUIMIENTO: 'HIERRO', ESTADO: 'PENDIENTE', N_SEGUIMIENTOS: 0, DIAS: 40 },
    { DNI: '3', ESPECIALIDAD: 'PROCEDIMIENTO', TIPO_SEGUIMIENTO: 'PROCEDIMIENTO', ESTADO: 'CONTACTADO', N_SEGUIMIENTOS: 1, DIAS: 10 },
    { DNI: '4', ESPECIALIDAD: 'PROCEDIMIENTO', TIPO_SEGUIMIENTO: 'PROCEDIMIENTO', ESTADO: 'PENDIENTE', N_SEGUIMIENTOS: 1, DIAS: 5 }
  ];
  const b = plano(L.ordenarBandeja(ps, pe));
  assert.deepEqual(b.map(t => t.DNI + ' ' + t.TIPO_SEGUIMIENTO), ['2 HIERRO', '1 REEVALUACION', '4 PROCEDIMIENTO']);
});

test('validarAccion acepta un seguimiento de hierro de la lista', () => {
  const cat = { usuarios: ['MAGALY'], motivos: ['OTRO'], alias: {} };
  const lista = [{ DNI: '40111222', ESPECIALIDAD: 'HIERRO' }];
  assert.equal(L.validarAccion({ usuario: 'MAGALY', dni: '40111222', especialidad: 'HIERRO' }, cat, 'HECHO', lista), '');
  assert.match(L.validarAccion({ usuario: 'MAGALY', dni: '40111222', especialidad: 'PROCEDIMIENTO' }, cat, 'HECHO', lista), /no está en la lista/);
});

test('kpiRecuperacion no cuenta los seguimientos de hierro ni de procedimientos', () => {
  const citas = [cita({ fecha: '2026-07-01' }), cita({ fecha: '2026-09-20' })];
  const segs = [seg({ fecha: '2026-09-01', esp: 'HIERRO' }), seg({ fecha: '2026-09-02', esp: 'PROCEDIMIENTO' }), seg({ fecha: '2026-09-03' })];
  const r = plano(L.kpiRecuperacion(segs, citas, HOY));
  assert.equal(r.length, 1);
  assert.equal(r[0].ESPECIALIDAD, 'HEMATOLOGÍA');
});

test('pendientesIndicacion: una cotización con fecha futura (error de tipeo) cuenta con 0 días', () => {
  const p = pend([], [ind({ FECHA: '2027-08-05' })]);
  assert.equal(p[0].DIAS, 0);
});

test('META_RETORNO_PCT se limita a 0–100', () => {
  assert.equal(L.reglasDesdeFilas(['PARAMETRO', 'VALOR'], [['META_RETORNO_PCT', 600]]).metaRetorno, 100);
});

test('kpiMotivos solo cuenta los descartes de reevaluación', () => {
  const segs = [seg({ fecha: '2026-09-01', accion: 'DESCARTADO', motivo: 'OTRO' }),
    seg({ fecha: '2026-09-02', esp: 'HIERRO', accion: 'DESCARTADO', motivo: 'OTRO' })];
  assert.deepEqual(plano(L.kpiMotivos(segs)), [{ MOTIVO: 'OTRO', N: 1 }]);
});
