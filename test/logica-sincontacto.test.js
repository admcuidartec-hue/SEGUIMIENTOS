// Cierre «Sin contacto válido» y su reapertura automática al aparecer un contacto nuevo. Datos inventados.
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar, plano } = require('./cargar');
const { cita, seg, reglas } = require('./fixtures');
const L = cargar();
const R = Object.assign(reglas(L), { maxSeguimientos: 2 });
const HOY = '2026-10-06';

const res = (fecha, resultado, o) => Object.assign(seg({ fecha }), { ID: 'SEG-' + fecha + resultado, RESULTADO: resultado, ACCION: 'HECHO' }, o);
const sinContacto = (fecha, nota, o) => res(fecha, 'SIN CONTACTO', Object.assign({ ACCION: 'DESCARTADO', MOTIVO: 'SIN CONTACTO', NOTA: nota }, o));
const CAT = { usuarios: ['MAGALY'], motivos: [], doctores: [] };
const TARJ = [{ DNI: '40111222', ESPECIALIDAD: 'HEMATOLOGÍA', TELEFONOS: '', USUARIO: '' },
  { DNI: '40111222', ESPECIALIDAD: 'HIERRO', ID_REGISTRO: 'REG-000001', TELEFONOS: '987654321', USUARIO: '@rosa.q' }];
const val = o => plano(L.validarResultado(Object.assign({ usuario: 'magaly', dni: '40111222', especialidad: 'Hematología', referencia: '',
  resultado: 'SIN CONTACTO', nota: '' }, o), { catalogos: CAT, hoy: HOY, tarjetas: TARJ }));

test('«Sin contacto válido»: un cierre para todos los tipos, con nota opcional y los contactos que había al cerrar', () => {
  const r = L.RESULTADOS['SIN CONTACTO'];
  assert.deepEqual([r.nombre, r.grupo, r.pide, r.soloIndicacion], ['SIN CONTACTO', 'CIERRE', '', false]);
  assert.ok(plano(L.ORDEN_RESULTADOS).includes('SIN CONTACTO'));
  const v = val({});
  assert.equal(v.error, '');
  assert.deepEqual([v.fila.RESULTADO, v.fila.MOTIVO, v.fila.NOTA], ['SIN CONTACTO', 'SIN CONTACTO', 'Contactos al cerrar: ninguno']);
  const h = val({ especialidad: 'HIERRO', referencia: 'REG-000001', resultado: 'sin contacto', nota: ' no existe en WhatsApp ' });
  assert.equal(h.fila.NOTA, 'Contactos al cerrar: 987654321 / @rosa.q · no existe en WhatsApp');
  assert.equal(L.accionPara('SIN CONTACTO', true), 'DESCARTADO');
  assert.deepEqual(plano(L.contactosAlCerrar('Contactos al cerrar: 987654321 / @rosa.q · no existe')), ['987654321', '@rosa.q']);
  assert.deepEqual(plano(L.contactosAlCerrar('Contactos al cerrar: ninguno')), []);
  assert.deepEqual(plano(L.contactosAlCerrar('otra nota')), []);
});

test('leerCiclo: cerrado mientras no aparezca un contacto nuevo; con uno nuevo se reabre y empieza un ciclo nuevo', () => {
  const filas = [res('2026-09-01', 'NO CONTESTÓ'), res('2026-09-03', 'PAGO', { ACCION: 'PAGO', FECHA_PROXIMA: '2026-09-03' }),
    sinContacto('2026-09-10', 'Contactos al cerrar: 987654321')];
  const cerrado = plano(L.leerCiclo(filas, R, HOY, ['987654321']));
  assert.deepEqual(cerrado.cierre, { motivo: 'SIN CONTACTO', fecha: '2026-09-10', quien: 'MAGALY' });
  assert.equal(plano(L.leerCiclo(filas, R, HOY)).cierre.motivo, 'SIN CONTACTO', 'sin la lista de contactos, cerrado como siempre');
  const abierto = plano(L.leerCiclo(filas, R, HOY, ['987654321', '@rosa.q']));
  assert.deepEqual([abierto.cierre, abierto.agenda, abierto.pago, abierto.intentos], [null, null, '', 0], 'lo de antes del cierre ya no cuenta');
  assert.deepEqual(abierto.nuevoContacto, ['@rosa.q']);
  // Lo que se registra después es el ciclo nuevo.
  const despues = plano(L.leerCiclo(filas.concat([res('2026-10-02', 'NO CONTESTÓ')]), R, HOY, ['987654321', '@rosa.q']));
  assert.deepEqual([despues.agenda, despues.intentos, despues.nuevoContacto], [{ tipo: 'REINTENTAR', fecha: '2026-10-17', intento: 1 }, 1, undefined]);
});

const inds = tel => tel.map(t => ({ DNI: '40111222', TELEFONO: t, FECHA: '2026-06-01', TIPO: 'HIERRO', ESTADO: 'ACEPTÓ' }));

test('reevaluación: «Sin contacto válido» la saca del tablero; un teléfono nuevo del CRM la devuelve a Por contactar con «Nuevo contacto»', () => {
  const citas = [cita({ fecha: '2026-07-01' })], segs = [sinContacto('2026-10-02', 'Contactos al cerrar: ninguno')];
  const p = plano(L.armarPacientes(citas, [], segs, R, HOY))[0];
  assert.deepEqual([p.ESTADO, p.CIERRE, p.FECHA_CIERRE], ['CERRADO', 'SIN CONTACTO', '2026-10-02']);
  const t = plano(L.armarTablero({ pacientes: [p], pendientes: [], seguimientos: segs, citas, vigentes: {}, reglas: R, hoy: HOY }));
  assert.deepEqual(t.cerrados.map(c => [c.CIERRE, c.SIN_CONTACTO]), [['SIN CONTACTO', true]]);
  assert.deepEqual([t.cifras.cerradosMes, t.cifras.cerradosSinContacto], [1, 1]);
  const crm = [{ DNI_PACIENTE: '40111222', TELEFONO: '912345678' }];
  const q = plano(L.armarPacientes(citas, [], segs, R, HOY, crm))[0];
  assert.deepEqual([q.ESTADO, q.CIERRE, q.NUEVO_CONTACTO, q.N_SEGUIMIENTOS], ['VENCIDO', '', '912345678', 0]);
  const t2 = plano(L.armarTablero({ pacientes: [q], pendientes: [], seguimientos: segs, citas, vigentes: {}, reglas: R, hoy: HOY, contactos: crm }));
  assert.deepEqual(t2.columnas.POR_CONTACTAR.map(x => x.ETIQUETA), ['Nuevo contacto: 912345678']);
  assert.equal(t2.cerrados.length, 0);
  // Muy atrasada (más que CORTE_BANDEJA_DIAS) igual vuelve: la reabrió un contacto nuevo.
  const vieja = plano(L.armarPacientes([cita({ fecha: '2026-01-05' })], [], [sinContacto('2026-06-01', 'Contactos al cerrar: ninguno')], R, HOY, crm))[0];
  assert.equal(vieja.ESTADO, 'VENCIDO');
});

test('hierro y procedimiento del historial y de Registro: se reabren con un @usuario o un teléfono nuevos (Registro o Editar)', () => {
  const citas = [cita({ fecha: '2026-07-01' })];
  const cot = [{ DNI: '40111222', TELEFONO: '', FECHA: '2026-09-20', TIPO: 'PROCEDIMIENTO', DETALLE: 'AMO', ESTADO: 'COTIZÓ' }];
  const segs = [sinContacto('2026-09-28', 'Contactos al cerrar: ninguno', { ESPECIALIDAD: 'PROCEDIMIENTO' })];
  assert.equal(plano(L.pendientesIndicacion(citas, cot, segs, R, HOY, []))[0].ESTADO, 'CERRADO');
  const q = plano(L.pendientesIndicacion(citas, cot, segs, R, HOY, [], { 40111222: '@rosa.q' }))[0];
  assert.deepEqual([q.ESTADO, q.CIERRE, q.NUEVO_CONTACTO], ['PENDIENTE', '', '@rosa.q']);
  // Registro: el contacto del registro (editado después) es nuevo.
  const r = { ID: 'REG-000001', FECHA: '2026-09-01', ASESORA: 'MAGALY', DOCTOR: 'Dr. X', NOMBRE: 'ROSA QUISPE', DNI: '40111222', CONTACTO: '987654321',
    TIPO: 'PROCEDIMIENTO', DETALLE: 'AMO', SESIONES: '1', ANULADO: '' };
  const sr = [sinContacto('2026-09-28', 'Contactos al cerrar: 987654321', { ESPECIALIDAD: 'PROCEDIMIENTO', REFERENCIA: 'REG-000001' })];
  const d = regs => plano(L.pendientesRegistro({ registros: regs, sesiones: [], seguimientos: sr, citas, reglas: R, hoy: HOY, telefonos: {}, catalogos: CAT }))[0];
  assert.deepEqual([d([r]).ESTADO, d([r]).CIERRE], ['CERRADO', 'SIN CONTACTO'], 'el mismo número que no servía no la reabre');
  const ed = d([Object.assign({}, r, { CONTACTO: '955111222' })]);
  assert.deepEqual([ed.ESTADO, ed.NUEVO_CONTACTO], ['PENDIENTE', '955111222']);
});

test('«Número equivocado» del último número: cerrado como sin contacto (motivo NÚMERO EQUIVOCADO) y se reabre igual con un contacto nuevo', () => {
  const citas = [cita({ fecha: '2026-07-01' })];
  // Antes del número equivocado, un «No contestó»: tras reabrir no cuenta (ciclo nuevo).
  const segs = [res('2026-09-20', 'NO CONTESTÓ'), res('2026-10-02', 'NÚMERO EQUIVOCADO', { TELEFONO: '987654321', ACCION: 'DESCARTADO', MOTIVO: 'NÚMERO EQUIVOCADO' })];
  const p = plano(L.armarPacientes(citas, inds(['987654321']), segs, R, HOY))[0];
  assert.deepEqual([p.ESTADO, p.CIERRE], ['CERRADO', 'NÚMERO EQUIVOCADO']);
  const t = plano(L.armarTablero({ pacientes: [p], pendientes: [], seguimientos: segs, citas, vigentes: {}, reglas: R, hoy: HOY }));
  assert.deepEqual(t.cerrados.map(c => [c.CIERRE, c.SIN_CONTACTO]), [['NÚMERO EQUIVOCADO', true]]);
  const q = plano(L.armarPacientes(citas, inds(['987654321', '912345678']), segs, R, HOY))[0];
  assert.deepEqual([q.ESTADO, q.NUEVO_CONTACTO, q.AGENDA, q.N_SEGUIMIENTOS], ['VENCIDO', '912345678', '', 0]);
  // Con otro número que quedaba (ACCION TELEFONO), no es un cierre ni hay «nuevo contacto».
  const otro = [res('2026-09-28', 'NÚMERO EQUIVOCADO', { TELEFONO: '987654321', ACCION: 'TELEFONO' })];
  const o = plano(L.armarPacientes(citas, inds(['987654321', '912345678']), otro, R, HOY))[0];
  assert.deepEqual([o.ESTADO, o.NUEVO_CONTACTO], ['VENCIDO', '']);
});

test('kpiMotivos: «Sin contacto válido» cuenta en los motivos de cierre de todos los tipos', () => {
  const segs = [sinContacto('2026-09-28', 'x'), sinContacto('2026-09-29', 'x', { ESPECIALIDAD: 'HIERRO', DNI: '40999888' }),
    res('2026-09-29', 'SE ATIENDE EN OTRO LUGAR', { ACCION: 'DESCARTADO', MOTIVO: 'SE ATIENDE EN OTRO LUGAR', ESPECIALIDAD: 'HIERRO' })];
  assert.deepEqual(plano(L.kpiMotivos(segs)), [{ MOTIVO: 'SIN CONTACTO', N: 2 }]);
});
