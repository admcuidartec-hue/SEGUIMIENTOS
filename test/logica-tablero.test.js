// Tablero de cuatro columnas. Datos inventados.
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar, plano } = require('./cargar');
const { cita, seg, reglas } = require('./fixtures');
const L = cargar();
const HOY = '2026-10-06';
const R = Object.assign(reglas(L), { maxSeguimientos: 2 });

const pac = o => Object.assign({ DNI: '1', ESPECIALIDAD: 'HEMATOLOGÍA', NOMBRE: 'ROSA QUISPE', MEDICO_ULTIMO: 'Dr. X', ULTIMA_CITA: '2026-08-01',
  PROXIMA_ESPERADA: '2026-08-31', DIAS_ATRASO: 21, ESTADO: 'VENCIDO', N_SEGUIMIENTOS: 0, PENDIENTE: '', AGENDA: '', FECHA_AGENDA: '', INTENTO: 0,
  CIERRE: '', FECHA_CIERRE: '' }, o);
const reg = o => Object.assign({ ID_REGISTRO: 'REG-000001', DNI: '2', ESPECIALIDAD: 'HIERRO', TIPO_SEGUIMIENTO: 'HIERRO', NOMBRE: 'ANA FLORES',
  ESTADO: 'EN TRATAMIENTO', ESTADO_REGISTRO: 'EN CURSO', SESIONES: 3, HECHAS: 1, ULTIMA_SESION: '2026-10-02', DIAS: 4, N_SEGUIMIENTOS: 0, ATRASO: 0,
  AGENDA: '', FECHA_AGENDA: '', INTENTO: 0, CIERRE: '', FECHA_CIERRE: '' }, o);
const tablero = o => plano(L.armarTablero(Object.assign({ pacientes: [], pendientes: [], seguimientos: [], citas: [], vigentes: {}, reglas: R, hoy: HOY }, o)));

test('columnaDe: cada estado a su columna', () => {
  assert.equal(L.columnaDe(Object.assign(pac(), { TIPO_SEGUIMIENTO: 'REEVALUACION' })), 'POR_CONTACTAR');
  assert.equal(L.columnaDe(Object.assign(pac({ ESTADO: 'AGENDADO', N_SEGUIMIENTOS: 1 }), { TIPO_SEGUIMIENTO: 'REEVALUACION' })), 'AGENDADO');
  assert.equal(L.columnaDe(Object.assign(pac({ ESTADO: 'AGENDADO', N_SEGUIMIENTOS: 0 }), { TIPO_SEGUIMIENTO: 'REEVALUACION' })), '', 'cita de SOFDOC sin seguimiento: no es del tablero');
  assert.equal(L.columnaDe(reg()), 'EN_TRATAMIENTO');
  assert.equal(L.columnaDe(reg({ ESTADO: 'PENDIENTE', ATRASO: 2 })), 'POR_CONTACTAR');
  for (const e of ['EN ESPERA', 'CERRADO', 'FALLECIDO', 'ANTIGUO', 'COMPLETADO']) assert.equal(L.columnaDe(reg({ ESTADO: e })), '', e);
});

test('etiquetaDe: textos de cada columna', () => {
  const et = (t, col) => L.etiquetaDe(Object.assign(t, { COLUMNA: col }), R, HOY);
  assert.equal(et(Object.assign(pac(), { TIPO_SEGUIMIENTO: 'REEVALUACION' }), 'POR_CONTACTAR'), 'Debía volver el 31/08 · hace 36 días');
  assert.equal(et(reg({ ESTADO_REGISTRO: 'COTIZADO', DIAS: 16 }), 'POR_CONTACTAR'), 'Cotizó hace 16 días');
  assert.equal(et(reg({ ATRASO: 3 }), 'POR_CONTACTAR'), 'Sesión 2 de 3 · atrasada 3 días');
  assert.equal(et(reg({ ATRASO: 1 }), 'POR_CONTACTAR'), 'Sesión 2 de 3 · atrasada 1 día');
  assert.equal(et(reg({ ATRASO: 0 }), 'POR_CONTACTAR'), 'Sesión 2 de 3 · tocaba hoy');
  assert.equal(et(pac({ AGENDA: 'CITA', FECHA_AGENDA: '2026-10-08' }), 'AGENDADO'), 'Cita el jue 08/10');
  assert.equal(et(pac({ AGENDA: 'LLAMAR', FECHA_AGENDA: '2026-10-12' }), 'AGENDADO'), 'Llamar el lun 12/10');
  assert.equal(et(pac({ AGENDA: 'REINTENTAR', FECHA_AGENDA: '2026-10-21', INTENTO: 1 }), 'AGENDADO'), 'Reintentar el 21/10 · intento 1 de 2');
  assert.equal(et(pac({ AGENDA: 'SIN RESPUESTA', FECHA_AGENDA: '2026-10-21', INTENTO: 2 }), 'AGENDADO'), 'Sin respuesta · se cierra el 21/10');
  assert.equal(et(reg(), 'EN_TRATAMIENTO'), 'Sesión 2 de 3 · próxima ~09/10');
});

test('armarTablero: reparte, ordena y cuenta', () => {
  const t = tablero({
    pacientes: [pac({ DNI: '1' }), pac({ DNI: '3', ESTADO: 'AGENDADO', N_SEGUIMIENTOS: 1, AGENDA: 'LLAMAR', FECHA_AGENDA: '2026-10-20' }),
      pac({ DNI: '4', ESTADO: 'AGENDADO', N_SEGUIMIENTOS: 1, AGENDA: 'CITA', FECHA_AGENDA: '2026-10-08' }),
      pac({ DNI: '5', ESTADO: 'CERRADO', CIERRE: 'SE ATIENDE EN OTRO LUGAR', FECHA_CIERRE: '2026-10-02' }),
      pac({ DNI: '6', ESTADO: 'CERRADO', CIERRE: 'SIN RESPUESTA', FECHA_CIERRE: '2026-09-30' })],
    pendientes: [reg(), reg({ ID_REGISTRO: 'REG-000002', DNI: '7', ESTADO: 'COMPLETADO', ESTADO_REGISTRO: 'COMPLETO', HECHAS: 3, ULTIMA_SESION: '2026-10-03' }),
      reg({ ID_REGISTRO: 'REG-000003', DNI: '8', ESTADO: 'COMPLETADO', ESTADO_REGISTRO: 'COMPLETO', HECHAS: 3, ULTIMA_SESION: '2026-09-20' })]
  });
  assert.deepEqual(t.columnas.POR_CONTACTAR.map(x => x.CLAVE), ['1|HEMATOLOGÍA']);
  assert.deepEqual(t.columnas.AGENDADO.map(x => x.DNI), ['4', '3'], 'la fecha más cercana primero');
  assert.deepEqual(t.columnas.EN_TRATAMIENTO.map(x => x.CLAVE), ['REG-000001']);
  assert.deepEqual(t.columnas.COMPLETADO.map(x => [x.CLAVE, x.ETIQUETA]), [['REG-000002', 'Completó el tratamiento']], 'solo lo de este mes');
  assert.deepEqual(t.cifras, { porContactar: 1, agendados: 2, enTratamiento: 1, completadosMes: 1, cerradosMes: 1, hechosHoy: 0 });
  assert.deepEqual(t.cerrados.map(x => [x.DNI, x.CIERRE]), [['5', 'SE ATIENDE EN OTRO LUGAR']]);
});

test('armarTablero: completados del mes por retorno tras seguimiento, alta y «lo hizo»; fallecidos en cerrados', () => {
  const citas = [cita({ dni: '9', fecha: '2026-08-01' }), cita({ dni: '9', fecha: '2026-10-02' }), cita({ dni: '10', fecha: '2026-10-03' })];
  const segs = [seg({ dni: '9', fecha: '2026-09-20' }), seg({ dni: '11', fecha: '2026-10-05', accion: 'DESCARTADO', motivo: 'FALLECIÓ' }),
    Object.assign(seg({ dni: '9', fecha: HOY }), { RESULTADO: 'LO PENSARÁ', ESPECIALIDAD: 'NUTRICIÓN' })];
  const vigentes = { '12|HEMATOLOGIA': { ID: 'ALT-000001', FECHA: '2026-10-04', DNI: '12', ESPECIALIDAD: 'HEMATOLOGÍA', DOCTOR: 'Dra. Karen Matos' } };
  const hist = reg({ ID_REGISTRO: '', DNI: '13', ESPECIALIDAD: 'PROCEDIMIENTO', TIPO_SEGUIMIENTO: 'PROCEDIMIENTO', ESTADO: 'COMPLETADO', FECHA_LOHIZO: '2026-10-01' });
  const t = tablero({ citas, seguimientos: segs, vigentes, pendientes: [hist] });
  assert.deepEqual(t.columnas.COMPLETADO.map(x => [x.DNI, x.ETIQUETA]), [
    ['12', 'Alta médica · Dra. Karen Matos'], ['9', 'Volvió el 02/10'], ['13', 'Lo hizo el 01/10']]);
  assert.equal(t.cifras.cerradosMes, 1, 'el fallecido');
  assert.equal(t.cifras.hechosHoy, 1);
});
