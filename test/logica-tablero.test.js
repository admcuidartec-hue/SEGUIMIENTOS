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
  assert.equal(et(pac({ AGENDA: '', FECHA_AGENDA: '', PROXIMA_AGENDADA: '2026-10-08' }), 'AGENDADO'), 'Cita el jue 08/10');
  assert.equal(et(reg(), 'EN_TRATAMIENTO'), 'Sesión 1 de 3 · faltan 2 · próxima ~09/10');
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
  assert.deepEqual(t.cifras, { porContactar: 1, agendados: 2, enTratamiento: 1, completadosMes: 1, cerradosMes: 1, hechosHoy: 0, hechosHoyPor: {} });
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

test('armarTablero: deduplicación de COMPLETADO por CLAVE, manteniendo la tarjeta con FECHA_CLAVE más reciente', () => {
  const citas = [cita({ dni: '14', fecha: '2026-08-01' }), cita({ dni: '14', fecha: '2026-10-02' })];
  const segs = [seg({ dni: '14', fecha: '2026-09-20' }), seg({ dni: '14', fecha: '2026-10-05', accion: 'HECHO' })];
  const vigentes = { '14|HEMATOLOGIA': { ID: 'ALT-000002', FECHA: '2026-10-04', DNI: '14', ESPECIALIDAD: 'HEMATOLOGÍA', DOCTOR: 'Dra. X' } };
  const t = tablero({ pacientes: [pac({ DNI: '14' })], citas, seguimientos: segs, vigentes });
  const completados = t.columnas.COMPLETADO;
  assert.equal(completados.length, 1, 'una sola tarjeta tras deduplicación');
  assert.ok(completados[0].ETIQUETA.startsWith('Alta médica'), 'etiqueta es la del alta (FECHA_CLAVE más reciente)');
  assert.equal(t.cifras.completadosMes, 1, 'métrica de completados cuenta después de deduplicación');
});

test('cada tarjeta lleva TELEFONOS_DESCARTADOS y SIN_CONTACTO; sin d.telefonos no se rompe', () => {
  const p1 = Object.assign(pac(), { DNI: '5', USUARIO: '' });
  const sinTel = tablero({ pacientes: [p1] }).columnas.POR_CONTACTAR[0];
  assert.deepEqual([sinTel.TELEFONOS_DESCARTADOS, sinTel.SIN_CONTACTO], [[], true]);
  const marca = { ID: 'SEG-1', FECHA_HORA: '2026-10-05 09:00', DNI: '5', ESPECIALIDAD: 'HEMATOLOGÍA', RESULTADO: 'NÚMERO EQUIVOCADO', TELEFONO: '987654321', ACCION: 'TELEFONO' };
  const t = tablero({ pacientes: [p1], seguimientos: [marca], telefonos: { 5: ['912345678'] } }).columnas.POR_CONTACTAR[0];
  assert.deepEqual([t.TELEFONOS_DESCARTADOS, t.SIN_CONTACTO], [['987654321'], false]);
  const u = tablero({ pacientes: [Object.assign(p1, { USUARIO: 'Madre' })] }).columnas.POR_CONTACTAR[0];
  assert.equal(u.SIN_CONTACTO, false);
});

test('armarTablero: hechosHoyPor cuenta por persona resultados, sesiones y altas de hoy, sin anulados', () => {
  const segs = [Object.assign(seg({ dni: '1', fecha: HOY, quien: 'MAGALY' }), { RESULTADO: 'NO CONTESTÓ' }),
    Object.assign(seg({ dni: '2', fecha: HOY, quien: 'MAGALY' }), { RESULTADO: 'FALLECIÓ', ACCION: 'DESCARTADO' }),
    Object.assign(seg({ dni: '3', fecha: HOY, quien: 'RACHEL' }), { RESULTADO: 'LO PENSARÁ', ANULADO: 'SÍ' }),
    seg({ dni: '4', fecha: '2026-10-05', quien: 'RACHEL' })];
  const sesiones = [{ ID: 'SES-1', FECHA_HORA: HOY + ' 09:00', ASESORA: 'RACHEL', ANULADO: '' }];
  const altas = [{ ID: 'ALT-1', FECHA_HORA: HOY + ' 10:00', REGISTRADO_POR: 'MAGALY', ANULADO: '' }];
  assert.deepEqual(tablero({ seguimientos: segs, sesiones, altas }).cifras.hechosHoyPor, { MAGALY: 3, RACHEL: 1 });
});

test('armarTablero: nombre en cerrados de fallecidos y en altas sin serie; procedimiento completo «Se hizo el …»', () => {
  const citas = [cita({ dni: '11', fecha: '2026-09-01', nombre: 'ANA PRUEBA UNO' }), cita({ dni: '12', fecha: '2026-09-02', nombre: 'LUIS PRUEBA DOS' })];
  const segs = [seg({ dni: '11', fecha: '2026-10-05', accion: 'DESCARTADO', motivo: 'FALLECIÓ' })];
  const vigentes = { '12|NUTRICION': { ID: 'ALT-2', FECHA: '2026-10-04', DNI: '12', ESPECIALIDAD: 'NUTRICIÓN', DOCTOR: '' } };
  const proc = reg({ ID_REGISTRO: 'REG-000009', DNI: '13', ESPECIALIDAD: 'PROCEDIMIENTO', TIPO_SEGUIMIENTO: 'PROCEDIMIENTO',
    ESTADO: 'COMPLETADO', ESTADO_REGISTRO: 'COMPLETO', SESIONES: 1, HECHAS: 1, ULTIMA_SESION: '2026-10-03' });
  const t = tablero({ citas, seguimientos: segs, vigentes, pendientes: [proc] });
  assert.equal(t.cerrados.find(x => x.DNI === '11').NOMBRE, 'ANA PRUEBA UNO');
  assert.equal(t.columnas.COMPLETADO.find(x => x.DNI === '12').NOMBRE, 'LUIS PRUEBA DOS');
  assert.equal(t.columnas.COMPLETADO.find(x => x.DNI === '13').ETIQUETA, 'Se hizo el 03/10');
});

test('etiquetaDe y columnaDe: sesión programada, no vino, por reevaluar, control y en tratamiento', () => {
  const R2 = reglas(L), hoy = '2026-10-15';
  const f = o => Object.assign({ TIPO_SEGUIMIENTO: 'HIERRO', HECHAS: 0, SESIONES: 3 }, o);
  const et = o => { const t = f(o); t.COLUMNA = L.columnaDe(t); return [t.COLUMNA, L.etiquetaDe(t, R2, hoy)]; };
  assert.deepEqual(et({ ESTADO: 'AGENDADO', AGENDA: 'SESION', FECHA_AGENDA: '2026-10-16' }), ['AGENDADO', 'Sesión 1 el vie 16/10']);
  assert.deepEqual(et({ ESTADO: 'PENDIENTE', MOTIVO_PENDIENTE: 'NO VINO', FECHA_INICIO: '2026-10-12' }), ['POR_CONTACTAR', 'No vino a su sesión 1 (12/10)']);
  assert.deepEqual(et({ ESTADO: 'POR REEVALUAR', ULTIMA_SESION: '2026-09-10', HECHAS: 3 }), ['POR_CONTACTAR', 'Por reevaluar · terminó el 10/09']);
  assert.deepEqual(et({ TIPO_SEGUIMIENTO: 'CONTROL', ESTADO: 'AGENDADO', AGENDA: 'CONTROL', FECHA_AGENDA: '2026-10-16' }), ['AGENDADO', 'Control con resultados el vie 16/10']);
  assert.deepEqual(et({ TIPO_SEGUIMIENTO: 'CONTROL', ESTADO: 'PENDIENTE', MOTIVO_PENDIENTE: 'CONTROL VENCIDO', FECHA_INICIO: '2026-10-10' }),
    ['POR_CONTACTAR', 'Debía volver con resultados el 10/10']);
  assert.deepEqual(et({ ESTADO: 'EN TRATAMIENTO', HECHAS: 1, ULTIMA_SESION: '2026-10-12' }), ['EN_TRATAMIENTO', 'Sesión 1 de 3 · faltan 2 · próxima ~19/10']);
});

test('armarTablero: POR REEVALUAR reemplaza la reevaluación del mismo paciente; cada tarjeta trae su MES', () => {
  const R2 = reglas(L);
  const reev = { DNI: '40111222', ESPECIALIDAD: 'HEMATOLOGÍA', NOMBRE: 'ROSA PRUEBA', ESTADO: 'VENCIDO', N_SEGUIMIENTOS: 0, DIAS_ATRASO: 5,
    PROXIMA_ESPERADA: '2026-10-01', ULTIMA_CITA: '2026-08-20' };
  const porReev = { ID_REGISTRO: 'REG-000010', DNI: '40111222', ESPECIALIDAD: 'HIERRO', TIPO_SEGUIMIENTO: 'HIERRO', ESTADO: 'POR REEVALUAR',
    ESPECIALIDAD_CONSULTA: 'HEMATOLOGÍA', ULTIMA_SESION: '2026-09-01', HECHAS: 2, SESIONES: 2, N_SEGUIMIENTOS: 0, DIAS: 3, FECHA_COTIZACION: '2026-08-25' };
  const tab = plano(L.armarTablero({ reglas: R2, hoy: '2026-10-09', pacientes: [reev], pendientes: [porReev], citas: [], seguimientos: [], telefonos: {} }));
  assert.deepEqual(tab.columnas.POR_CONTACTAR.map(t => [t.CLAVE, t.MES]), [['REG-000010', '2026-08']]);
});

test('armarTablero: la tarjeta de un registro por reevaluar reemplaza la reevaluación aunque esté en Agendado', () => {
  const R2 = reglas(L);
  const reev = { DNI: '40111222', ESPECIALIDAD: 'HEMATOLOGÍA', NOMBRE: 'ROSA PRUEBA', ESTADO: 'VENCIDO', N_SEGUIMIENTOS: 0, DIAS_ATRASO: 5,
    PROXIMA_ESPERADA: '2026-10-01', ULTIMA_CITA: '2026-08-20' };
  const agendada = { ID_REGISTRO: 'REG-000010', DNI: '40111222', ESPECIALIDAD: 'HIERRO', TIPO_SEGUIMIENTO: 'HIERRO', ESTADO: 'AGENDADO',
    ESTADO_REGISTRO: 'COMPLETO', FECHA_REEVALUAR: '2026-10-01', AGENDA: 'CITA', FECHA_AGENDA: '2026-10-15', N_SEGUIMIENTOS: 1,
    ESPECIALIDAD_CONSULTA: 'HEMATOLOGÍA', ULTIMA_SESION: '2026-09-01', HECHAS: 2, SESIONES: 2, DIAS: 3, FECHA_COTIZACION: '2026-08-25' };
  const tab = plano(L.armarTablero({ reglas: R2, hoy: '2026-10-09', pacientes: [reev], pendientes: [agendada], citas: [], seguimientos: [], telefonos: {} }));
  assert.deepEqual(tab.columnas.POR_CONTACTAR.map(t => t.CLAVE), []);
  assert.deepEqual(tab.columnas.AGENDADO.map(t => t.CLAVE), ['REG-000010']);
  // Antes de su fecha de reevaluar (completado) no reemplaza nada.
  const antes = Object.assign({}, agendada, { FECHA_REEVALUAR: '2026-10-20' });
  const tab2 = plano(L.armarTablero({ reglas: R2, hoy: '2026-10-09', pacientes: [reev], pendientes: [antes], citas: [], seguimientos: [], telefonos: {} }));
  assert.deepEqual(tab2.columnas.POR_CONTACTAR.map(t => t.CLAVE), ['40111222|HEMATOLOGÍA']);
});
