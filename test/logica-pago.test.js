// Etapa 3: «Pagó» y el embudo de seis fases. Datos inventados.
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar, plano } = require('./cargar');
const { cita, seg, reglas } = require('./fixtures');
const L = cargar();
const R = Object.assign(reglas(L), { maxSeguimientos: 2 });
const HOY = '2026-10-06';

const res = (fecha, resultado, o) => Object.assign(seg({ fecha }), { RESULTADO: resultado, ACCION: resultado === 'PAGO' ? 'PAGO' : 'HECHO' }, o);
const pago = (fecha, o) => res(fecha, 'PAGO', Object.assign({ FECHA_PROXIMA: fecha }, o));

test('resultadoDe y accionPara: «Pagó» es su propio grupo y escribe ACCION = PAGO', () => {
  const r = plano(L.resultadoDe(pago('2026-10-01', { FECHA_PROXIMA: '2026-09-30' })));
  assert.deepEqual([r.resultado, r.grupo, r.fecha, r.fechaProxima, r.motivo], ['PAGO', 'PAGO', '2026-10-01', '2026-09-30', '']);
  assert.equal(L.resultadoDe(res('2026-10-01', 'pago')).resultado, 'PAGO', 'sin tildes ni mayúsculas');
  assert.equal(L.accionPara('PAGO', true), 'PAGO');
  assert.ok(plano(L.ORDEN_RESULTADOS).includes('PAGO'));
});

test('leerCiclo: el pago queda en el ciclo, cuenta como intento y no decide la agenda', () => {
  const c = plano(L.leerCiclo([res('2026-09-20', 'NO CONTESTÓ'), pago('2026-10-01')], R, HOY));
  assert.equal(c.pago, '2026-10-01');
  assert.equal(c.agenda, null, 'el reintento de antes del pago ya no cuenta');
  assert.equal(c.cierre, null);
  assert.equal(c.intentos, 2);
  assert.equal(plano(L.leerCiclo([], R, HOY)).pago, '', 'sin pago');
});

test('leerCiclo: después de pagar, «no contestó» y «lo pensará» no lo hacen retroceder ni lo cierran solo', () => {
  const s = [pago('2026-08-01'), res('2026-08-10', 'NO CONTESTÓ'), res('2026-08-20', 'NO CONTESTÓ'), res('2026-08-30', 'NO CONTESTÓ')];
  const c = plano(L.leerCiclo(s, R, HOY));
  assert.equal(c.pago, '2026-08-01');
  assert.equal(c.cierre, null, 'un paciente que pagó no se cierra por tiempo');
  assert.equal(c.agenda, null);
  const p = plano(L.leerCiclo([pago('2026-10-01'), res('2026-10-02', 'LO PENSARÁ', { FECHA_PROXIMA: '2026-10-09' })], R, HOY));
  assert.equal(p.agenda, null);
  assert.equal(p.pago, '2026-10-01');
});

test('leerCiclo: una cita agendada después del pago manda; un cierre explícito también', () => {
  const ag = plano(L.leerCiclo([pago('2026-10-01'), res('2026-10-02', 'AGENDÓ CITA', { FECHA_PROXIMA: '2026-10-10' })], R, HOY));
  assert.deepEqual(ag.agenda, { tipo: 'CITA', fecha: '2026-10-10', intento: 0 });
  assert.equal(ag.pago, '2026-10-01');
  const vencida = plano(L.leerCiclo([pago('2026-09-01'), res('2026-09-02', 'AGENDÓ CITA', { FECHA_PROXIMA: '2026-09-10' })], R, HOY));
  assert.equal(vencida.agenda, null);
  assert.equal(vencida.citaVencida, '2026-09-10');
  const cierre = plano(L.leerCiclo([pago('2026-10-01'), Object.assign(res('2026-10-02', 'FALLECIÓ'), { ACCION: 'DESCARTADO' })], R, HOY));
  assert.equal(cierre.cierre.motivo, 'FALLECIÓ');
});

test('estadoDeSerie: reevaluación vencida que pagó → PAGO REALIZADO; una cita de SOFDOC gana', () => {
  const serieDe = c => Object.values(L.armarSeries(c))[0];
  const c = [cita({ fecha: '2026-07-01' })];
  const e = plano(L.estadoDeSerie(serieDe(c), [pago('2026-10-01')], R, HOY));
  assert.deepEqual([e.estado, e.pago], ['PAGO REALIZADO', '2026-10-01']);
  const conCita = plano(L.estadoDeSerie(serieDe(c.concat([cita({ fecha: '2026-10-12', estado: 'AGENDADO' })])), [pago('2026-10-01')], R, HOY));
  assert.equal(conCita.estado, 'AGENDADO');
  // Muy atrasada (pasaría a ANTIGUO): pagó, así que sigue en el tablero.
  const vieja = plano(L.estadoDeSerie(serieDe([cita({ fecha: '2025-12-01' })]), [pago('2026-10-01')], R, HOY));
  assert.equal(vieja.estado, 'PAGO REALIZADO');
  const p = plano(L.armarPacientes(c, [], [pago('2026-10-01')], R, HOY))[0];
  assert.deepEqual([p.ESTADO, p.FECHA_PAGO], ['PAGO REALIZADO', '2026-10-01']);
});

const CAT2 = L.catalogosDesdeFilas(['USUARIOS', 'DOCTOR', 'DOCTOR_SOFDOC'], [['MAGALY', 'Dr. Elí Cabanillas', 'Dr. ELÍ FABRIZIO CABANILLAS HUALPA']]);
const regi = o => Object.assign({ ID: 'REG-000001', FECHA: '2026-09-20', ASESORA: 'MAGALY', DOCTOR: 'Dr. Elí Cabanillas', NOMBRE: 'ROSA QUISPE',
  DNI: '40111222', CONTACTO: '987654321', TIPO: 'HIERRO', DETALLE: 'HIERRO CARBOXIMALTOSA', MARCA: 'FERINJECT', SESIONES: '3', ANULADO: '' }, o);
const pend = (registros, seguimientos, hoy) => plano(L.pendientesRegistro({ registros, sesiones: [], seguimientos, citas: [cita({ fecha: '2026-09-01' })],
  reglas: R, hoy: hoy || HOY, telefonos: { '40111222': ['987654321'] }, catalogos: CAT2 }));

test('pendientesRegistro: un cotizado que pagó → PAGO REALIZADO; al aceptar (FECHA_INICIO) pasa a AGENDADO', () => {
  const p = pend([regi()], [pago('2026-10-01', { ESPECIALIDAD: 'HIERRO', REFERENCIA: 'REG-000001' })])[0];
  assert.deepEqual([p.ESTADO, p.FECHA_PAGO], ['PAGO REALIZADO', '2026-10-01']);
  const prog = pend([regi({ FECHA_INICIO: '2026-10-12' })], [pago('2026-10-01', { ESPECIALIDAD: 'HIERRO', REFERENCIA: 'REG-000001' })])[0];
  assert.equal(prog.ESTADO, 'AGENDADO');
  const viejo = pend([regi({ FECHA: '2026-01-10' })], [pago('2026-10-01', { ESPECIALIDAD: 'HIERRO', REFERENCIA: 'REG-000001' })])[0];
  assert.equal(viejo.ESTADO, 'PAGO REALIZADO', 'no queda ANTIGUO');
});

test('pendientesRegistro: pagó, aceptó y no vino a su 1.ª sesión → vuelve a PAGO REALIZADO (el pago es del ciclo de la cotización)', () => {
  const p1 = pago('2026-09-25', { ESPECIALIDAD: 'HIERRO', REFERENCIA: 'REG-000001' });
  const acepto = res('2026-09-26', 'ACEPTÓ', { ESPECIALIDAD: 'HIERRO', REFERENCIA: 'REG-000001', FECHA_PROXIMA: '2026-09-28' });
  const r = regi({ FECHA_INICIO: '2026-09-28' });
  const noVino = pend([r], [p1, acepto])[0];
  assert.deepEqual([noVino.ESTADO, noVino.FECHA_PAGO, noVino.MOTIVO_PENDIENTE], ['PAGO REALIZADO', '2026-09-25', '']);
  assert.equal(pend([r], [p1, acepto], '2026-09-29')[0].ESTADO, 'AGENDADO', 'dentro de la gracia sigue en Agendado');
  // Tres «No contestó» después de la fecha no lo cierran solo: pagó.
  const nc = ['2026-10-01', '2026-10-02', '2026-10-03'].map(f => res(f, 'NO CONTESTÓ', { ESPECIALIDAD: 'HIERRO', REFERENCIA: 'REG-000001' }));
  assert.equal(pend([r], [p1, acepto].concat(nc))[0].ESTADO, 'PAGO REALIZADO');
  // Un cierre explícito sí lo cierra.
  const cierre = res('2026-10-02', 'NO DESEA REALIZARSE', { ESPECIALIDAD: 'HIERRO', REFERENCIA: 'REG-000001', MOTIVO: 'NO DESEA REALIZARSE' });
  assert.equal(pend([r], [p1, acepto, cierre])[0].ESTADO, 'CERRADO');
  // Un «No desea realizarse» mientras esperaba su fecha (antes de FECHA_INICIO, después de aceptar) lo cierra; uno anterior al «Aceptó», no.
  const antes = res('2026-09-27', 'NO DESEA REALIZARSE', { ESPECIALIDAD: 'HIERRO', REFERENCIA: 'REG-000001', MOTIVO: 'NO DESEA REALIZARSE', FECHA_HORA: '2026-09-27 09:00' });
  assert.equal(pend([regi({ FECHA_INICIO: '2026-10-20' })], [acepto, antes])[0].ESTADO, 'CERRADO');
  const previo = res('2026-09-24', 'NO DESEA REALIZARSE', { ESPECIALIDAD: 'HIERRO', REFERENCIA: 'REG-000001', MOTIVO: 'NO DESEA REALIZARSE' });
  assert.equal(pend([regi({ FECHA_INICIO: '2026-10-20' })], [previo, acepto])[0].ESTADO, 'AGENDADO');
  // Ya empezado, el pago de la cotización no cuenta para el ciclo de la sesión siguiente.
  const enCurso = plano(L.pendientesRegistro({ registros: [r], seguimientos: [p1, acepto], citas: [cita({ fecha: '2026-09-01' })], reglas: R, hoy: HOY,
    sesiones: [{ ID: 'SES-000001', ID_REGISTRO: 'REG-000001', NUMERO: 1, FECHA: '2026-09-28', FECHA_HORA: '2026-09-28 10:00', ANULADO: '' }],
    telefonos: { '40111222': ['987654321'] }, catalogos: CAT2 }))[0];
  assert.equal(enCurso.FECHA_PAGO, '');
});

test('pendientesIndicacion: una cotización del historial que pagó → PAGO REALIZADO', () => {
  const hist = { ID: 'IND-1', FECHA: '2026-09-01', TIPO: 'HIERRO', DETALLE: 'HIERRO', CANTIDAD: '', MEDICO_SOLICITANTE: '', NOMBRE: 'X',
    TELEFONO: '987654321', ESTADO: 'COTIZÓ', DNI: '40111222', EMPAREJAMIENTO: 'AUTOMÁTICO' };
  const p = plano(L.pendientesIndicacion([cita({ fecha: '2026-08-01' })], [hist], [pago('2026-10-02', { ESPECIALIDAD: 'HIERRO' })], R, HOY))[0];
  assert.deepEqual([p.ESTADO, p.FECHA_PAGO], ['PAGO REALIZADO', '2026-10-02']);
});

const pac = o => Object.assign({ DNI: '1', ESPECIALIDAD: 'HEMATOLOGÍA', NOMBRE: 'ROSA QUISPE', MEDICO_ULTIMO: 'Dr. X', ULTIMA_CITA: '2026-08-01',
  PROXIMA_ESPERADA: '2026-08-31', DIAS_ATRASO: 21, ESTADO: 'VENCIDO', N_SEGUIMIENTOS: 1, PENDIENTE: '', AGENDA: '', FECHA_AGENDA: '', INTENTO: 0,
  CIERRE: '', FECHA_CIERRE: '', FECHA_PAGO: '' }, o);
const REEV = { TIPO_SEGUIMIENTO: 'REEVALUACION' };

test('columnaDe: Contactado (llamar, reintentar, sin respuesta) y Pago realizado; Agendado solo con fecha real', () => {
  const col = o => L.columnaDe(Object.assign(pac(o), REEV));
  assert.equal(col({ ESTADO: 'AGENDADO', AGENDA: 'LLAMAR' }), 'CONTACTADO');
  assert.equal(col({ ESTADO: 'AGENDADO', AGENDA: 'REINTENTAR' }), 'CONTACTADO');
  assert.equal(col({ ESTADO: 'AGENDADO', AGENDA: 'SIN RESPUESTA' }), 'CONTACTADO');
  assert.equal(col({ ESTADO: 'AGENDADO', AGENDA: 'CITA' }), 'AGENDADO');
  assert.equal(col({ ESTADO: 'AGENDADO', AGENDA: 'CITA', N_SEGUIMIENTOS: 0 }), '', 'cita de SOFDOC sin seguimiento');
  assert.equal(col({ ESTADO: 'PAGO REALIZADO', FECHA_PAGO: '2026-10-01' }), 'PAGO_REALIZADO');
  const reg = o => Object.assign({ ID_REGISTRO: 'REG-1', TIPO_SEGUIMIENTO: 'HIERRO', ESTADO: 'AGENDADO' }, o);
  assert.equal(L.columnaDe(reg({ AGENDA: 'LLAMAR' })), 'CONTACTADO');
  assert.equal(L.columnaDe(reg({ AGENDA: 'SESION' })), 'AGENDADO');
  assert.equal(L.columnaDe(reg({ AGENDA: 'CONTROL' })), 'AGENDADO');
  assert.equal(L.columnaDe(reg({ ESTADO: 'PAGO REALIZADO' })), 'PAGO_REALIZADO');
});

test('etiquetaDe: Contactado conserva sus textos; Pago realizado dice cuándo pagó', () => {
  const et = (o, c) => L.etiquetaDe(Object.assign(pac(o), REEV, { COLUMNA: c }), R, HOY);
  assert.equal(et({ AGENDA: 'LLAMAR', FECHA_AGENDA: '2026-10-12' }, 'CONTACTADO'), 'Llamar el lun 12/10');
  assert.equal(et({ AGENDA: 'REINTENTAR', FECHA_AGENDA: '2026-10-21', INTENTO: 1 }, 'CONTACTADO'), 'Reintentar el 21/10 · intento 1 de 2');
  assert.equal(et({ AGENDA: 'SIN RESPUESTA', FECHA_AGENDA: '2026-10-21' }, 'CONTACTADO'), 'Sin respuesta · se cierra el 21/10');
  assert.equal(et({ ESTADO: 'PAGO REALIZADO', FECHA_PAGO: '2026-10-01' }, 'PAGO_REALIZADO'), 'Pagó el 01/10 · falta agendar');
});

test('armarTablero: seis columnas, con sus cifras; el pago cuenta en la meta del día', () => {
  const t = plano(L.armarTablero({ reglas: R, hoy: HOY, citas: [], vigentes: {}, pendientes: [],
    seguimientos: [pago(HOY, { RESPONSABLE: 'ANA' })],
    pacientes: [pac({ DNI: '1' }), pac({ DNI: '2', ESTADO: 'AGENDADO', AGENDA: 'LLAMAR', FECHA_AGENDA: '2026-10-12' }),
      pac({ DNI: '3', ESTADO: 'PAGO REALIZADO', FECHA_PAGO: '2026-10-01' }), pac({ DNI: '4', ESTADO: 'AGENDADO', AGENDA: 'CITA', FECHA_AGENDA: '2026-10-09' })] }));
  assert.deepEqual(Object.keys(t.columnas), ['POR_CONTACTAR', 'CONTACTADO', 'PAGO_REALIZADO', 'AGENDADO', 'EN_TRATAMIENTO', 'COMPLETADO']);
  assert.deepEqual(['POR_CONTACTAR', 'CONTACTADO', 'PAGO_REALIZADO', 'AGENDADO'].map(c => t.columnas[c].map(x => x.DNI)), [['1'], ['2'], ['3'], ['4']]);
  assert.equal(t.columnas.PAGO_REALIZADO[0].FECHA_CLAVE, '2026-10-01');
  assert.deepEqual([t.cifras.porContactar, t.cifras.contactados, t.cifras.pagados, t.cifras.agendados], [1, 1, 1, 1]);
  assert.equal(t.cifras.hechosHoy, 1, 'el pago es un seguimiento hecho del día');
  assert.deepEqual(t.cifras.hechosHoyPor, { ANA: 1 });
});

test('armarTablero: un pago no cuenta como «volvió» tras el seguimiento', () => {
  const citas = [cita({ dni: '9', fecha: '2026-08-01' }), cita({ dni: '9', fecha: '2026-10-02' })];
  const t = plano(L.armarTablero({ reglas: R, hoy: HOY, citas, vigentes: {}, pendientes: [], pacientes: [], seguimientos: [pago('2026-09-20', { DNI: '9' })] }));
  assert.equal(t.columnas.COMPLETADO.length, 0);
});

const CAT = { usuarios: ['MAGALY'], motivos: [], doctores: [] };
const val = (o, tarj) => plano(L.validarResultado(Object.assign({ usuario: 'magaly', dni: '40111222', especialidad: 'Hematología', referencia: '',
  resultado: 'PAGO', fecha: HOY, nota: '' }, o), { catalogos: CAT, hoy: HOY, tarjetas: [Object.assign({ DNI: '40111222', ESPECIALIDAD: 'HEMATOLOGÍA', TELEFONOS: '987654321' }, tarj)] }));

test('validarResultado: «Pagó» en Por contactar y Contactado, con su fecha; no en las demás', () => {
  const v = val({}, { COLUMNA: 'POR_CONTACTAR' });
  assert.equal(v.error, '');
  assert.deepEqual([v.fila.RESULTADO, v.fila.FECHA_PROXIMA, v.fila.MOTIVO], ['PAGO', HOY, '']);
  assert.equal(val({ fecha: '2026-09-10' }, { COLUMNA: 'CONTACTADO' }).error, '');
  assert.equal(plano(L.validarResultado({ usuario: 'magaly', dni: '40111222', especialidad: 'HIERRO', referencia: 'REG-1', resultado: 'PAGO', fecha: HOY },
    { catalogos: CAT, hoy: HOY, tarjetas: [{ DNI: '40111222', ESPECIALIDAD: 'HIERRO', ID_REGISTRO: 'REG-1', TIPO_SEGUIMIENTO: 'HIERRO', COLUMNA: 'POR_CONTACTAR', ESTADO_REGISTRO: 'COTIZADO' }] })).error, '', 'vale para hierro');
  assert.match(val({}, { COLUMNA: 'PAGO_REALIZADO', FECHA_PAGO: '2026-10-01' }).error, /Ya figura el pago del 01\/10/);
  assert.match(val({}, { COLUMNA: 'AGENDADO' }).error, /ya tiene fecha/);
  assert.match(val({}, { COLUMNA: 'EN_TRATAMIENTO' }).error, /ya tiene fecha/);
  assert.match(val({ fecha: '' }, { COLUMNA: 'POR_CONTACTAR' }).error, /Falta la fecha del pago/);
  assert.match(val({ fecha: '2026-10-07' }, { COLUMNA: 'POR_CONTACTAR' }).error, /de hace 30 días a hoy/);
  assert.match(val({ fecha: '2026-09-05' }, { COLUMNA: 'POR_CONTACTAR' }).error, /de hace 30 días a hoy/);
});

test('reglas: META_CUMPLIMIENTO_TRATAMIENTO_PCT, 95 por omisión', () => {
  assert.equal(L.reglasDesdeFilas(['PARAMETRO', 'VALOR'], []).metaTratamiento, 95);
  assert.equal(L.reglasDesdeFilas(['PARAMETRO', 'VALOR'], [['META_CUMPLIMIENTO_TRATAMIENTO_PCT', 90]]).metaTratamiento, 90);
  assert.equal(L.reglasDesdeFilas(['PARAMETRO', 'VALOR'], [['META_CUMPLIMIENTO_TRATAMIENTO_PCT', 140]]).metaTratamiento, 100);
});
