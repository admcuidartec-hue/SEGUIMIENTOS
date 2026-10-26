// Funciones del servidor de la pestaña Registro, con dobles de las hojas. Datos inventados.
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar, plano } = require('./cargar');
const { cita, reglas } = require('./fixtures');

const CAT = { usuarios: ['MAGALY'], motivos: ['OTRO'], alias: {},
  doctores: [{ doctor: 'Dra. Karen Matos', sofdoc: 'Dra. KAREN DIANA MATOS PEÑA' }],
  procedimientos: ['SANGRÍA'], tratamientos: ['HIERRO SACARATO'], marcas: {} };
const REG4 = { ID: 'REG-000004', FECHA_HORA: '2026-10-01 09:00', FECHA: '2026-10-01', ASESORA: 'MAGALY', DOCTOR: 'Dra. Karen Matos',
  NOMBRE: 'ROSA QUISPE', DNI: '40111222', CONTACTO: '987654321', TIPO: 'PROCEDIMIENTO', DETALLE: 'SANGRÍA', MARCA: '', SESIONES: '1', ANULADO: '' };

function servidor(extra, hojas) {
  const ctx = cargar(['Logica.gs', 'Registro.gs', 'Resultados.gs', 'Tablero.gs', 'Enfermeria.gs', 'Codigo.gs', 'RegistroServidor.gs', 'EnfermeriaServidor.gs']);
  const escrito = { REGISTROS: [], SESIONES: [], ALTAS: [], SEGUIMIENTOS: [], BITACORA: [], anulados: [] };
  const lock = { tomado: 0 };
  const L = cargar(['Logica.gs', 'Registro.gs', 'Resultados.gs', 'Tablero.gs']);
  ctx.datos_ = () => Object.assign({ hoy: '2026-10-05', catalogos: CAT, reglas: reglas(L), citas: [cita({ fecha: '2026-09-01' })],
    registros: [REG4], sesiones: [], altas: [], vigentes: {}, indicacionesTodas: [], contactos: [] }, extra);
  ctx.exigirColumnas_ = () => {};
  ctx.bloquear_ = () => { lock.tomado++; return { releaseLock: () => { lock.tomado--; } }; };
  ctx.leerOpcional_ = n => ((hojas || {})[n] || []).concat(escrito[n] || []);
  ctx.leerSeguimientos_ = () => ((hojas || {}).SEGUIMIENTOS || []).concat(escrito.SEGUIMIENTOS);
  ctx.exigirHojaPreparada_ = () => {};
  ctx.anexarObjeto_ = (n, cols, o) => { assert.equal(lock.tomado, 1, 'se escribe con el candado tomado'); escrito[n].push(plano(o)); };
  ctx.bitacora_ = (u, a, d) => escrito.BITACORA.push([u, a, d]);
  ctx.fechaHoraTexto_ = () => '2026-10-05 10:30';
  ctx.SpreadsheetApp = { flush: () => {} };
  ctx.marcarAnulado_ = (n, id, motivo) => { assert.equal(lock.tomado, 1); escrito.anulados.push([n, id, motivo]); };
  return { ctx, escrito, lock };
}
const datosReg = o => Object.assign({ usuario: 'MAGALY', dni: '40111222', nombre: 'Rosa Quispe', contacto: '987654321', fecha: '2026-10-05',
  doctor: 'Dra. Karen Matos', procedimiento: 'SANGRÍA', tratamiento: '', sesiones: '', marca: '' }, o);

test('guardarRegistro: lo inválido no toma el candado ni escribe', () => {
  const { ctx, escrito, lock } = servidor();
  assert.throws(() => ctx.guardarRegistro(datosReg({ usuario: '' })), /Elija quién es usted/);
  assert.deepEqual([escrito.REGISTROS.length, lock.tomado], [0, 0]);
});

test('guardarRegistro: avisa del duplicado sin escribir; confirmado escribe con IDs leídos dentro del candado', () => {
  const { ctx, escrito } = servidor({}, { REGISTROS: [REG4, Object.assign({}, REG4, { ID: 'REG-000009', DNI: '40999888' })] });
  assert.deepEqual(plano(ctx.guardarRegistro(datosReg())), { ok: false, duplicado: { ID: 'REG-000004', FECHA: '2026-10-01', TEXTO: 'Sangría' } });
  assert.equal(escrito.REGISTROS.length, 0);
  const r = plano(ctx.guardarRegistro(datosReg({ confirmado: true, tratamiento: 'HIERRO SACARATO', sesiones: '2' })));
  assert.equal(r.ok, true);
  assert.deepEqual(escrito.REGISTROS.map(x => [x.ID, x.FECHA_HORA, x.TIPO]),
    [['REG-000010', '2026-10-05 10:30', 'PROCEDIMIENTO'], ['REG-000011', '2026-10-05 10:30', 'HIERRO']], 'otra asesora guardó REG-000009 entretanto');
  assert.deepEqual(r.registros.map(x => x.TEXTO), ['Sangría', 'Hierro sacarato × 2 sesiones']);
  assert.deepEqual(escrito.BITACORA.map(b => b[1]), ['REGISTRO', 'REGISTRO']);
});

test('marcarSesion: numera la siguiente sesión y no deja pasar de las indicadas', () => {
  const { ctx, escrito } = servidor({}, { REGISTROS: [REG4] });
  const r = plano(ctx.marcarSesion({ usuario: 'MAGALY', id: 'REG-000004', fecha: '2026-10-04', nota: 'ok' }));
  assert.deepEqual([r.ok, r.completo], [true, true]);
  assert.deepEqual(escrito.SESIONES.map(s => [s.ID, s.ID_REGISTRO, s.NUMERO, s.FECHA, s.ASESORA]), [['SES-000001', 'REG-000004', 1, '2026-10-04', 'MAGALY']]);
  assert.throws(() => ctx.marcarSesion({ usuario: 'MAGALY', id: 'REG-000004', fecha: '2026-10-05' }), /todas sus sesiones/);
  assert.throws(() => ctx.marcarSesion({ usuario: 'MAGALY', id: 'REG-000999', fecha: '2026-10-05' }), /No encontré/);
});

test('anular: motivo obligatorio; solo la última sesión; las altas antiguas por descarte no se anulan aquí', () => {
  const s = (id, n) => ({ ID: id, ID_REGISTRO: 'REG-000004', NUMERO: String(n), FECHA: '2026-10-0' + n, ANULADO: '' });
  const { ctx, escrito } = servidor({}, { REGISTROS: [REG4], SESIONES: [s('SES-000001', 1), s('SES-000002', 2)] });
  assert.throws(() => ctx.anularRegistro({ usuario: 'MAGALY', id: 'REG-000004', motivo: ' ' }), /motivo/);
  ctx.anularRegistro({ usuario: 'MAGALY', id: 'REG-000004', motivo: 'Error de DNI' });
  assert.throws(() => ctx.anularSesion({ usuario: 'MAGALY', id: 'SES-000001', motivo: 'x' }), /última sesión/);
  ctx.anularSesion({ usuario: 'MAGALY', id: 'SES-000002', motivo: 'Fecha equivocada' });
  assert.throws(() => ctx.anularAlta({ usuario: 'MAGALY', id: 'SEG-1', motivo: 'x' }), /descarte antiguo/);
  assert.deepEqual(escrito.anulados, [['REGISTROS', 'REG-000004', 'Error de DNI'], ['SESIONES', 'SES-000002', 'Fecha equivocada']]);
});

test('darDeAlta: valida y escribe ALT-…', () => {
  const { ctx, escrito } = servidor();
  assert.throws(() => ctx.darDeAlta({ usuario: 'MAGALY', dni: '40111222', especialidad: 'HEMATOLOGÍA', doctor: '', fecha: '2026-10-05' }), /doctor/);
  const r = plano(ctx.darDeAlta({ usuario: 'MAGALY', dni: '40111222', especialidad: 'HEMATOLOGÍA', doctor: 'Dra. Karen Matos', fecha: '2026-10-05', nota: '' }));
  assert.equal(r.alta.ID, 'ALT-000001');
  assert.deepEqual(escrito.ALTAS.map(a => [a.ID, a.DNI, a.ESPECIALIDAD, a.DOCTOR, a.REGISTRADO_POR]), [['ALT-000001', '40111222', 'HEMATOLOGÍA', 'Dra. Karen Matos', 'MAGALY']]);
});

test('getRegistrosHoy: registros y altas de hoy, lo más reciente primero', () => {
  const ayer = Object.assign({}, REG4, { ID: 'REG-000003', FECHA_HORA: '2026-10-04 18:00' });
  const hoy1 = Object.assign({}, REG4, { ID: 'REG-000005', FECHA_HORA: '2026-10-05 09:15', ANULADO: 'SÍ', MOTIVO_ANULACION: 'Error de digitación' });
  const alta = { ID: 'ALT-000001', FECHA_HORA: '2026-10-05 11:00', FECHA: '2026-10-05', DNI: '40111222', ESPECIALIDAD: 'HEMATOLOGÍA',
    DOCTOR: 'Dra. Karen Matos', REGISTRADO_POR: 'MAGALY', ANULADO: '' };
  const { ctx } = servidor({ registros: [ayer, hoy1], altas: [alta] });
  const lista = plano(ctx.getRegistrosHoy());
  const campos = x => ({ ID: x.ID, HORA: x.HORA, ASESORA: x.ASESORA, NOMBRE: x.NOMBRE, DNI: x.DNI, TEXTO: x.TEXTO, ANULADO: x.ANULADO, MOTIVO_ANULACION: x.MOTIVO_ANULACION });
  assert.deepEqual(lista.map(campos), [
    { ID: 'ALT-000001', HORA: '11:00', ASESORA: 'MAGALY', NOMBRE: 'ROSA ELENA QUISPE HUAMAN', DNI: '40111222', TEXTO: 'Alta médica · HEMATOLOGÍA · Dra. Karen Matos', ANULADO: false, MOTIVO_ANULACION: '' },
    { ID: 'REG-000005', HORA: '09:15', ASESORA: 'MAGALY', NOMBRE: 'ROSA QUISPE', DNI: '40111222', TEXTO: 'Sangría', ANULADO: true, MOTIVO_ANULACION: 'Error de digitación' }]);
  assert.deepEqual([lista[0].TIPO, lista[0].FECHA], ['DECISION', '2026-10-05']);
});

test('buscarPacienteRegistro: datos del paciente conocido y propuesta de doctor', () => {
  const c = [cita({ fecha: '2026-09-01', medico: 'Dra. KAREN DIANA MATOS PEÑA' })];
  const { ctx } = servidor({ citas: c, telefonos: { '40111222': ['912345678'] }, seguimientos: [] });
  assert.deepEqual(plano(ctx.buscarPacienteRegistro('40111222')), { encontrado: true, nombre: 'ROSA ELENA QUISPE HUAMAN', telefonos: ['912345678'],
    ultimaFecha: '2026-09-01', ultimoMedico: 'Dra. KAREN DIANA MATOS PEÑA', doctor: 'Dra. Karen Matos',
    especialidades: [{ especialidad: 'HEMATOLOGÍA', alta: false }], fallecido: '' });
  assert.deepEqual(plano(ctx.buscarPacienteRegistro('40000000')), { encontrado: false, fallecido: '' });
});

test('marcarAnulado_ escribe SÍ y el motivo en la fila de ese ID, y no anula dos veces', () => {
  const ctx = cargar(['Logica.gs', 'Registro.gs', 'Codigo.gs', 'RegistroServidor.gs', 'EnfermeriaServidor.gs']);
  const v = [['ID', 'ANULADO', 'MOTIVO_ANULACION'], ['REG-000001', '', ''], ['REG-000002', '', '']];
  ctx.hoja_ = () => ({ getDataRange: () => ({ getValues: () => v.map(f => f.slice()) }),
    getRange: (r, c) => ({ setValue: x => { v[r - 1][c - 1] = x; } }) });
  ctx.marcarAnulado_('REGISTROS', 'REG-000002', 'Error');
  assert.deepEqual(v[2], ['REG-000002', 'SÍ', 'Error']);
  assert.throws(() => ctx.marcarAnulado_('REGISTROS', 'REG-000002', 'x'), /ya estaba anulado/);
  assert.throws(() => ctx.marcarAnulado_('REGISTROS', 'REG-000009', 'x'), /No encontré/);
});

test('revisión final: cada escritura se confirma (flush) antes de soltar el candado', () => {
  const { ctx, lock } = servidor({}, { REGISTROS: [REG4] });
  const orden = [];
  ctx.SpreadsheetApp = { flush: () => orden.push('flush') };
  ctx.bloquear_ = () => { lock.tomado++; return { releaseLock: () => { orden.push('suelta'); lock.tomado--; } }; };
  ctx.guardarRegistro(datosReg({ confirmado: true }));
  ctx.marcarSesion({ usuario: 'MAGALY', id: 'REG-000004', fecha: '2026-10-04' });
  ctx.darDeAlta({ usuario: 'MAGALY', dni: '40111222', especialidad: 'HEMATOLOGÍA', doctor: 'Dra. Karen Matos', fecha: '2026-10-05' });
  ctx.anularRegistro({ usuario: 'MAGALY', id: 'REG-000004', motivo: 'x' });
  ctx.anularAlta({ usuario: 'MAGALY', id: 'ALT-000001', motivo: 'x' });
  assert.deepEqual(orden, Array(5).fill(['flush', 'suelta']).flat());
});

test('revisión final: dos altas simultáneas — la segunda se rechaza dentro del candado', () => {
  const vigente = { ID: 'ALT-000001', FECHA_HORA: '2026-10-05 10:00', FECHA: '2026-10-05', DNI: '40111222', ESPECIALIDAD: 'HEMATOLOGÍA',
    DOCTOR: 'Dra. Karen Matos', REGISTRADO_POR: 'ANA', ANULADO: '' };
  const { ctx, escrito } = servidor({}, { ALTAS: [vigente] });
  assert.throws(() => ctx.darDeAlta({ usuario: 'MAGALY', dni: '40111222', especialidad: 'HEMATOLOGÍA', doctor: 'Dra. Karen Matos', fecha: '2026-10-05' }),
    /ya tiene un alta vigente/);
  assert.equal(escrito.ALTAS.length, 0);
});

test('guardarRegistro: procedimientos[] y un tratamiento en el mismo envío escriben exactamente tres filas; hierro sin marca va sin MARCA', () => {
  const cat = Object.assign({}, CAT, { procedimientos: ['SANGRÍA', 'AMO'], tratamientos: ['HIERRO SACARATO', 'HIERRO CARBOXIMALTOSA'],
    marcas: { 'HIERRO CARBOXIMALTOSA': ['FERINJECT', 'GENÉRICO'] } });
  const { ctx, escrito } = servidor({ catalogos: cat, registros: [] }, { REGISTROS: [] });
  // La forma exacta que manda la pestaña Registro: procedimientos[], tratamiento, sesiones y marca.
  const r = plano(ctx.guardarRegistro({ usuario: 'MAGALY', dni: '40111222', nombre: 'Rosa Quispe', contacto: '+51987654321', fecha: '2026-10-05',
    doctor: 'Dra. Karen Matos', procedimientos: ['SANGRÍA', 'AMO'], tratamiento: 'HIERRO CARBOXIMALTOSA', sesiones: 2, marca: 'FERINJECT' }));
  const base = { FECHA_HORA: '2026-10-05 10:30', FECHA: '2026-10-05', ASESORA: 'MAGALY', DOCTOR: 'Dra. Karen Matos', NOMBRE: 'ROSA QUISPE',
    DNI: '40111222', CONTACTO: '+51987654321', ANULADO: '', MOTIVO_ANULACION: '', FECHA_INICIO: '', EXAMENES: '', FECHA_RETORNO: '', EDITADO: '' };
  assert.deepEqual(escrito.REGISTROS.map(x => Object.fromEntries(Object.entries(x).sort())), [
    Object.assign({ ID: 'REG-000001', TIPO: 'PROCEDIMIENTO', DETALLE: 'SANGRÍA', MARCA: '', SESIONES: 1 }, base),
    Object.assign({ ID: 'REG-000002', TIPO: 'PROCEDIMIENTO', DETALLE: 'AMO', MARCA: '', SESIONES: 1 }, base),
    Object.assign({ ID: 'REG-000003', TIPO: 'HIERRO', DETALLE: 'HIERRO CARBOXIMALTOSA', MARCA: 'FERINJECT', SESIONES: 2 }, base)
  ].map(x => Object.fromEntries(Object.entries(x).sort())));
  assert.equal(r.ok, true);
  assert.deepEqual(r.registros.map(x => x.ID), ['REG-000001', 'REG-000002', 'REG-000003']);
  assert.deepEqual(escrito.BITACORA.map(b => b[1]), ['REGISTRO', 'REGISTRO', 'REGISTRO']);
  // Hierro sin marca en CATALOGOS: MARCA vacía; con una marca escrita, se rechaza sin escribir.
  const s2 = servidor({ catalogos: cat, registros: [] }, { REGISTROS: [] });
  plano(s2.ctx.guardarRegistro({ usuario: 'MAGALY', dni: '40111222', nombre: 'Rosa Quispe', contacto: '987654321', fecha: '2026-10-05',
    doctor: 'Dra. Karen Matos', procedimientos: [], tratamiento: 'HIERRO SACARATO', sesiones: 3, marca: '' }));
  assert.deepEqual(s2.escrito.REGISTROS.map(x => [x.TIPO, x.DETALLE, x.MARCA, x.SESIONES]), [['HIERRO', 'HIERRO SACARATO', '', 3]]);
  assert.throws(() => s2.ctx.guardarRegistro({ usuario: 'MAGALY', dni: '40111222', nombre: 'Rosa Quispe', contacto: '987654321', fecha: '2026-10-05',
    doctor: 'Dra. Karen Matos', procedimientos: [], tratamiento: 'HIERRO SACARATO', sesiones: 3, marca: 'FERINJECT', confirmado: true }), /no lleva marca/);
  assert.equal(s2.escrito.REGISTROS.length, 1);
});

/* ---- Buscador y DNI a mano para las indicaciones sin paciente ---- */
test('buscar: todas las palabras en cualquier orden, y también quien solo está en Registro', () => {
  const { ctx } = servidor({ citas: [cita({ fecha: '2026-09-01', nombre: 'ROSA ELENA QUISPE HUAMAN' })], indicaciones: [] });
  assert.deepEqual(plano(ctx.buscar('rosa quispe')), [{ DNI: '40111222', NOMBRE: 'ROSA ELENA QUISPE HUAMAN' }]);
  const { ctx: c2 } = servidor({ citas: [], indicaciones: [], registros: [Object.assign({}, REG4, { DNI: '41555666', NOMBRE: 'PEDRO PRUEBA' })] });
  assert.deepEqual(plano(c2.buscar('5556')), [{ DNI: '41555666', NOMBRE: 'PEDRO PRUEBA' }]);
});

function hojaIndicaciones() {
  const v = [['ID', 'FECHA', 'NOMBRE', 'TELEFONO', 'DNI', 'EMPAREJAMIENTO'],
    ['IND-0120', '2026-05-04', 'PAOLA PRUEBA', '956000111', '', 'SIN CANDIDATO']];
  return { v, getDataRange: () => ({ getValues: () => v.map(f => f.slice()) }),
    getRange: (r, c) => { const g = { setNumberFormat: () => g, setValue: x => { v[r - 1][c - 1] = x; return g; } }; return g; } };
}

test('asignarDniIndicacion: escribe el DNI con el candado y lo deja CONFIRMADO; un DNI desconocido no se acepta', () => {
  const { ctx, escrito, lock } = servidor({ indicaciones: [] });
  const sh = hojaIndicaciones();
  ctx.hoja_ = () => { assert.equal(lock.tomado, 1, 'se lee la hoja con el candado tomado'); return sh; };
  assert.throws(() => ctx.asignarDniIndicacion({ usuario: '', id: 'IND-0120', dni: '40111222' }), /Elija quién es usted/);
  assert.throws(() => ctx.asignarDniIndicacion({ usuario: 'MAGALY', id: 'IND-0120', dni: '49999999' }), /no está en SOFDOC ni en Registro/);
  assert.equal(lock.tomado, 0, 'suelta el candado aunque falle');
  assert.deepEqual(plano(ctx.asignarDniIndicacion({ usuario: 'MAGALY', id: 'IND-0120', dni: '40 111 222' })), { ok: true, dni: '40111222' });
  assert.deepEqual(sh.v[1].slice(4), ['40111222', 'CONFIRMADO']);
  assert.deepEqual(escrito.BITACORA, [['MAGALY', 'EMPAREJAMIENTO', 'IND-0120 → 40111222 (a mano)']]);
  assert.throws(() => ctx.asignarDniIndicacion({ usuario: 'MAGALY', id: 'IND-0120', dni: '40111222' }), /ya tiene paciente/);
});

test('exigirColumnas_: sin las columnas nuevas de REGISTROS no se escribe', () => {
  const ctx = cargar(['Logica.gs', 'Registro.gs', 'Resultados.gs', 'Tablero.gs', 'Enfermeria.gs', 'Codigo.gs', 'RegistroServidor.gs', 'EnfermeriaServidor.gs']);
  ctx.hoja_ = () => ({ getRange: () => ({ getValues: () => [['ID', 'FECHA_HORA', 'FECHA']] }), getLastColumn: () => 3 });
  assert.throws(() => ctx.exigirColumnas_('REGISTROS', ctx.COLUMNAS_REGISTROS), /Falta preparar las hojas/);
});

test('darDeAlta: guarda la decisión y su fecha de retorno', () => {
  const { ctx, escrito } = servidor();
  ctx.darDeAlta({ usuario: 'MAGALY', dni: '40111222', especialidad: 'HEMATOLOGÍA', doctor: 'Dra. Karen Matos', fecha: '2026-10-05',
    decision: 'NUEVA REEVALUACION', fechaRetorno: '2026-11-20' });
  assert.deepEqual(escrito.ALTAS.map(a => [a.DECISION, a.FECHA_RETORNO]), [['NUEVA REEVALUACION', '2026-11-20']]);
});

test('darDeAlta: tras una «nueva reevaluación» se puede dar otra alta (la relectura dentro del candado usa la decisión)', () => {
  const previa = { ID: 'ALT-000001', FECHA_HORA: '2026-10-05 10:00', FECHA: '2026-10-05', DNI: '40111222', ESPECIALIDAD: 'HEMATOLOGÍA',
    DOCTOR: 'Dra. Karen Matos', REGISTRADO_POR: 'ANA', ANULADO: '', DECISION: 'NUEVA REEVALUACION', FECHA_RETORNO: '2026-11-20' };
  const { ctx, escrito } = servidor({}, { ALTAS: [previa] });
  ctx.darDeAlta({ usuario: 'MAGALY', dni: '40111222', especialidad: 'HEMATOLOGÍA', doctor: 'Dra. Karen Matos', fecha: '2026-10-05' });
  assert.deepEqual(escrito.ALTAS.map(a => a.DECISION), ['ALTA']);
});

test('editarRegistro: relee dentro del candado, escribe solo lo cambiado, marca EDITADO y deja una línea por campo', () => {
  const { ctx, escrito, lock } = servidor({}, { REGISTROS: [REG4] });
  const celdas = [];
  ctx.leerRegistros_ = () => [REG4];
  ctx.leerSesiones_ = () => [];
  ctx.actualizarCeldas_ = (h, id, c) => { assert.equal(lock.tomado, 1); celdas.push([h, id, plano(c)]); };
  const r = plano(ctx.editarRegistro({ usuario: 'MAGALY', id: 'REG-000004', cambios: { contacto: '912000111', sesiones: 2 } }));
  assert.equal(r.ok, true);
  assert.deepEqual(celdas, [['REGISTROS', 'REG-000004', { CONTACTO: '912000111', SESIONES: 2, EDITADO: '2026-10-05 10:30' }]]);
  assert.deepEqual(escrito.BITACORA.map(b => b[2]), ['REG-000004 · CONTACTO: 987654321 → 912000111', 'REG-000004 · SESIONES: 1 → 2']);
  assert.deepEqual(plano(ctx.editarRegistro({ usuario: 'MAGALY', id: 'REG-000004', cambios: { contacto: '987654321' } })), { ok: false, sinCambios: true });
  ctx.leerRegistros_ = () => [Object.assign({}, REG4, { ANULADO: 'SÍ' })];
  assert.throws(() => ctx.editarRegistro({ usuario: 'MAGALY', id: 'REG-000004', cambios: { contacto: '912000111' } }), /anulado/);
  assert.equal(lock.tomado, 0);
});

test('getRegistros: hoy o un mes, con los datos para editar', () => {
  const sep = Object.assign({}, REG4, { ID: 'REG-000002', FECHA_HORA: '2026-09-20 11:00', FECHA: '2026-09-20' });
  const hoy = Object.assign({}, REG4, { FECHA_HORA: '2026-10-05 09:00' });   // el arnés usa hoy = 2026-10-05
  const { ctx } = servidor({ registros: [hoy, sep], altas: [] });
  assert.deepEqual(plano(ctx.getRegistros({ periodo: '2026-09' })).map(x => x.ID), ['REG-000002']);
  const deHoy = plano(ctx.getRegistros({ periodo: 'HOY' }));
  assert.deepEqual(deHoy.map(x => [x.ID, x.CONTACTO, x.SESIONES]), [['REG-000004', '987654321', 1]]);
  assert.deepEqual(plano(ctx.getRegistrosHoy()).map(x => x.ID), ['REG-000004']);
});

/* ---------- Marcar la sesión y agendar la siguiente en un paso ---------- */
const REG8 = Object.assign({}, REG4, { ID: 'REG-000008', TIPO: 'HIERRO', DETALLE: 'HIERRO SACARATO', SESIONES: '3' });

test('marcarSesion con próxima: guarda la sesión y agenda la siguiente en la misma llamada y el mismo candado', () => {
  const { ctx, escrito, lock } = servidor({}, { REGISTROS: [REG8] });
  let tomas = 0;
  const bloquear = ctx.bloquear_;
  ctx.bloquear_ = () => { tomas++; return bloquear(); };
  const r = plano(ctx.marcarSesion({ usuario: 'MAGALY', id: 'REG-000008', fecha: '2026-10-05', nota: 'bien', proxima: '2026-10-12' }));
  assert.equal(tomas, 1, 'un solo candado');
  assert.equal(lock.tomado, 0);
  assert.deepEqual([r.ok, r.completo, r.sesion.ID, r.sesion.NUMERO], [true, false, 'SES-000001', 1]);
  assert.deepEqual(escrito.SESIONES.map(s => [s.ID, s.NUMERO, s.FECHA, s.NOTA]), [['SES-000001', 1, '2026-10-05', 'bien']]);
  const g = escrito.SEGUIMIENTOS[0];
  assert.equal(escrito.SEGUIMIENTOS.length, 1);
  assert.match(g.ID, /^SEG-\d+-\d+$/);
  assert.deepEqual([g.FECHA_HORA, g.DNI, g.ESPECIALIDAD, g.RESPONSABLE, g.ACCION, g.RESULTADO, g.FECHA_PROXIMA, g.REFERENCIA, g.NOTA],
    ['2026-10-05 10:30', '40111222', 'HIERRO', 'MAGALY', 'HECHO', 'AGENDÓ CITA', '2026-10-12', 'REG-000008', 'Agendada al marcar la sesión 1 (SES-000001)']);
  assert.deepEqual(r.agenda, g, 'la respuesta trae la agenda (no «seguimiento»: Deshacer anula la sesión, no solo la agenda)');
  assert.equal(r.seguimiento, undefined);
  assert.deepEqual(escrito.BITACORA.map(b => b[1]), ['SESIÓN', 'RESULTADO']);
  // El tablero, con lo escrito: Agendado «Sesión 2 el lun 12/10».
  const d = { registros: [REG8], sesiones: escrito.SESIONES, seguimientos: escrito.SEGUIMIENTOS, citas: [cita({ fecha: '2026-09-01' })], reglas: reglas(ctx),
    hoy: '2026-10-05', telefonos: { 40111222: ['987654321'] }, catalogos: CAT };
  const f = plano(ctx.pendientesRegistro(d))[0];
  assert.deepEqual([f.ESTADO, f.AGENDA, f.FECHA_AGENDA], ['AGENDADO', 'SESION', '2026-10-12']);
  assert.equal(ctx.etiquetaDe(Object.assign(f, { COLUMNA: 'AGENDADO' }), reglas(ctx), '2026-10-05'), 'Sesión 2 el lun 12/10');
  // La sesión 2 se marca después (sin próxima): sale de Agendado.
  ctx.fechaHoraTexto_ = () => '2026-10-12 11:00';
  const antes = ctx.datos_;
  ctx.datos_ = () => Object.assign(antes(), { hoy: '2026-10-12' });
  plano(ctx.marcarSesion({ usuario: 'MAGALY', id: 'REG-000008', fecha: '2026-10-12' }));
  assert.equal(escrito.SEGUIMIENTOS.length, 1, 'sin próxima no se agenda nada');
  const f2 = plano(ctx.pendientesRegistro(Object.assign(d, { hoy: '2026-10-12', sesiones: escrito.SESIONES })))[0];
  assert.deepEqual([f2.ESTADO, f2.AGENDA, f2.HECHAS], ['EN TRATAMIENTO', '', 2]);
});

test('marcarSesion con próxima inválida o en la última sesión: no escribe nada y lo dice en español', () => {
  const { ctx, escrito, lock } = servidor({}, { REGISTROS: [REG8, REG4] });
  assert.throws(() => ctx.marcarSesion({ usuario: 'MAGALY', id: 'REG-000008', fecha: '2026-10-05', proxima: '2026-10-05' }),
    /^Error: La próxima sesión debe ser después de la sesión que marca \(05\/10\/2026\)\.$/);
  assert.throws(() => ctx.marcarSesion({ usuario: 'MAGALY', id: 'REG-000008', fecha: '2026-10-05', proxima: '2027-04-04' }),
    /La próxima sesión va hasta 180 días después de la sesión\./);
  assert.throws(() => ctx.marcarSesion({ usuario: 'MAGALY', id: 'REG-000008', fecha: '2026-10-05', proxima: '12/10' }), /no es válida/);
  assert.throws(() => ctx.marcarSesion({ usuario: 'MAGALY', id: 'REG-000008', fecha: '2026-10-02', proxima: '2026-10-04' }),
    /^Error: La próxima sesión no puede ser anterior a hoy\.$/, 'hoy es 05/10');
  assert.deepEqual([escrito.SESIONES.length, escrito.SEGUIMIENTOS.length, lock.tomado], [0, 0, 0]);
  // Con una sola sesión indicada, la que se marca es la última.
  assert.throws(() => ctx.marcarSesion({ usuario: 'MAGALY', id: 'REG-000004', fecha: '2026-10-05', proxima: '2026-10-12' }),
    /Es la última sesión del tratamiento: no hay una próxima que agendar\./);
  assert.deepEqual([escrito.SESIONES.length, escrito.SEGUIMIENTOS.length], [0, 0]);
});

test('anularSesion anula también la próxima que se agendó al marcarla (Deshacer deshace las dos cosas)', () => {
  const s1 = { ID: 'SES-000001', FECHA_HORA: '2026-10-05 10:30', ID_REGISTRO: 'REG-000008', NUMERO: '1', FECHA: '2026-10-05', ANULADO: '' };
  const ligada = { ID: 'SEG-1', FECHA_HORA: '2026-10-05 10:30', DNI: '40111222', ESPECIALIDAD: 'HIERRO', REFERENCIA: 'REG-000008', RESULTADO: 'AGENDÓ CITA',
    FECHA_PROXIMA: '2026-10-12', NOTA: 'Agendada al marcar la sesión 1 (SES-000001)', ANULADO: '' };
  const otra = Object.assign({}, ligada, { ID: 'SEG-2', NOTA: 'Agendada al marcar la sesión 1 (SES-000001)', REFERENCIA: 'REG-000099' });
  const manual = Object.assign({}, ligada, { ID: 'SEG-3', NOTA: '', FECHA_HORA: '2026-10-04 09:00' });   // anterior a la sesión
  const { ctx, escrito } = servidor({}, { REGISTROS: [REG8], SESIONES: [s1], SEGUIMIENTOS: [ligada, otra, manual] });
  ctx.anularSesion({ usuario: 'MAGALY', id: 'SES-000001', motivo: 'Deshecho al momento' });
  assert.deepEqual(escrito.anulados, [['SESIONES', 'SES-000001', 'Deshecho al momento'],
    ['SEGUIMIENTOS', 'SEG-1', 'Deshecho al momento (se anuló la sesión SES-000001)']]);
  assert.deepEqual(escrito.BITACORA.map(b => b[1]), ['ANULAR SESIÓN', 'ANULAR RESULTADO']);
});

test('marcarSesion con próxima: si falla la escritura de la agenda, la sesión queda marcada y se avisa (sin lanzar)', () => {
  const { ctx, escrito, lock } = servidor({}, { REGISTROS: [REG8] });
  const anexar = ctx.anexarObjeto_;
  ctx.anexarObjeto_ = (n, cols, o) => { if (n === 'SEGUIMIENTOS') throw new Error('Servicio no disponible'); anexar(n, cols, o); };
  const r = plano(ctx.marcarSesion({ usuario: 'MAGALY', id: 'REG-000008', fecha: '2026-10-05', proxima: '2026-10-12' }));
  assert.deepEqual([r.ok, r.sesion.ID, r.completo, r.agenda], [true, 'SES-000001', false, undefined]);
  assert.equal(r.agendaError, 'No se pudo agendar la próxima sesión: Servicio no disponible');
  assert.deepEqual([escrito.SESIONES.length, escrito.SEGUIMIENTOS.length, lock.tomado], [1, 0, 0]);
});

test('anularSesion anula también un «Agendó cita» sin liga escrito después de esa sesión (agendaba la que le seguía)', () => {
  const s1 = { ID: 'SES-000001', FECHA_HORA: '2026-10-01 10:00', ID_REGISTRO: 'REG-000008', NUMERO: '1', FECHA: '2026-10-01', ANULADO: '' };
  const s2 = { ID: 'SES-000002', FECHA_HORA: '2026-10-03 10:00', ID_REGISTRO: 'REG-000008', NUMERO: '2', FECHA: '2026-10-03', ANULADO: '' };
  const g = (ID, FECHA_HORA, o) => Object.assign({ ID, FECHA_HORA, DNI: '40111222', ESPECIALIDAD: 'HIERRO', REFERENCIA: 'REG-000008',
    RESULTADO: 'AGENDÓ CITA', FECHA_PROXIMA: '2026-10-12', NOTA: '', ANULADO: '' }, o);
  const hojas = { REGISTROS: [REG8], SESIONES: [s1, s2], SEGUIMIENTOS: [
    g('SEG-1', '2026-10-02 09:00'),                               // antes de la sesión 2: agendaba la 2, ya hecha
    g('SEG-2', '2026-10-04 11:00'),                               // después: agendaba la 3
    g('SEG-3', '2026-10-04 12:00', { RESULTADO: 'NO CONTESTÓ', FECHA_PROXIMA: '' }),
    g('SEG-4', '2026-10-04 13:00', { REFERENCIA: 'REG-000099' }),
    g('SEG-5', '2026-10-04 14:00', { ANULADO: 'SÍ' })] };
  const { ctx, escrito } = servidor({}, hojas);
  ctx.anularSesion({ usuario: 'MAGALY', id: 'SES-000002', motivo: 'Error' });
  assert.deepEqual(escrito.anulados, [['SESIONES', 'SES-000002', 'Error'], ['SEGUIMIENTOS', 'SEG-2', 'Error (se anuló la sesión SES-000002)']]);
});

test('anularRegistro anula en el mismo candado su agenda viva: la próxima sesión ligada y un «Agendó cita» que aún no pasó', () => {
  const s1 = { ID: 'SES-000001', FECHA_HORA: '2026-10-02 10:00', ID_REGISTRO: 'REG-000008', NUMERO: '1', FECHA: '2026-10-02', ANULADO: '' };
  const g = (ID, o) => Object.assign({ ID, FECHA_HORA: '2026-10-02 10:00', DNI: '40111222', ESPECIALIDAD: 'HIERRO', REFERENCIA: 'REG-000008',
    RESULTADO: 'AGENDÓ CITA', FECHA_PROXIMA: '2026-10-09', NOTA: '', ANULADO: '' }, o);
  const hojas = { REGISTROS: [REG8], SESIONES: [s1], SEGUIMIENTOS: [
    g('SEG-1', { NOTA: 'Agendada al marcar la sesión 1 (SES-000001)' }),   // ligada a su sesión
    g('SEG-2', { FECHA_HORA: '2026-10-03 09:00', FECHA_PROXIMA: '2026-10-20' }), // agenda sin liga, aún viva
    g('SEG-3', { FECHA_HORA: '2026-09-20 09:00', FECHA_PROXIMA: '2026-09-25' }), // ya pasó: es historia
    g('SEG-4', { RESULTADO: 'NO CONTESTÓ', FECHA_PROXIMA: '' }),
    g('SEG-5', { REFERENCIA: 'REG-000099', NOTA: 'Agendada al marcar la sesión 1 (SES-000009)' })] };
  const { ctx, escrito, lock } = servidor({}, hojas);
  ctx.anularRegistro({ usuario: 'MAGALY', id: 'REG-000008', motivo: 'Paciente equivocado' });
  assert.deepEqual(escrito.anulados, [['REGISTROS', 'REG-000008', 'Paciente equivocado'],
    ['SEGUIMIENTOS', 'SEG-1', 'Paciente equivocado (se anuló el registro REG-000008)'],
    ['SEGUIMIENTOS', 'SEG-2', 'Paciente equivocado (se anuló el registro REG-000008)']]);
  assert.deepEqual(escrito.BITACORA.map(b => b[1]), ['ANULAR REGISTRO', 'ANULAR RESULTADO', 'ANULAR RESULTADO']);
  assert.equal(lock.tomado, 0);
});

test('anularSesion: una sesión de un registro anulado no se anula (las hechas siguen contando el día en que se hicieron)', () => {
  const s1 = { ID: 'SES-000001', FECHA_HORA: '2026-10-02 10:00', ID_REGISTRO: 'REG-000008', NUMERO: '1', FECHA: '2026-10-02', ANULADO: '' };
  const { ctx, escrito } = servidor({}, { REGISTROS: [Object.assign({}, REG8, { ANULADO: 'SÍ' })], SESIONES: [s1], SEGUIMIENTOS: [] });
  assert.throws(() => ctx.anularSesion({ usuario: 'MAGALY', id: 'SES-000001', motivo: 'x' }), /^Error: El registro REG-000008 está anulado: sus sesiones ya no se anulan\.$/);
  assert.deepEqual(escrito.anulados, []);
});

test('marcarSesion: con la sesión que vio la persona, una 2.ª pestaña que marca la misma se rechaza («ya se registró»)', () => {
  const R3 = Object.assign({}, REG4, { TIPO: 'HIERRO', DETALLE: 'HIERRO SACARATO', SESIONES: '3' });
  const { ctx, escrito } = servidor({}, { REGISTROS: [R3] });
  ctx.marcarSesion({ usuario: 'MAGALY', id: 'REG-000004', fecha: '2026-10-04', sesion: 1 });
  assert.throws(() => ctx.marcarSesion({ usuario: 'MAGALY', id: 'REG-000004', fecha: '2026-10-05', sesion: 1 }), /La sesión 1 ya se registró; recargue\./);
  assert.throws(() => ctx.marcarSesion({ usuario: 'MAGALY', id: 'REG-000004', fecha: '2026-10-05', sesion: 3 }), /no es la siguiente \(es la 2\)/);
  ctx.marcarSesion({ usuario: 'MAGALY', id: 'REG-000004', fecha: '2026-10-05', sesion: '2' });
  ctx.marcarSesion({ usuario: 'MAGALY', id: 'REG-000004', fecha: '2026-10-05' });   // sin número (llamada antigua): la siguiente
  assert.deepEqual(escrito.SESIONES.map(s => s.NUMERO), [1, 2, 3]);
  assert.throws(() => ctx.marcarSesion({ usuario: 'MAGALY', id: 'REG-000004', fecha: '2026-10-05', sesion: 3 }), /La sesión 3 ya se registró/);
});

/* ---- Idempotencia (op), todo o nada y la BITACORA después de guardar (batería de 50, casos 33, 34 y 36) ---- */
function conOp(extra, hojas) {
  const S = servidor(extra, hojas);
  S.ctx.conOp_ = (n, cols) => cols.concat(['OP']);
  // La BITACORA como filas (con su OP), para que se pueda buscar una anulación ya hecha.
  S.ctx.bitacora_ = (u, a, d, op) => S.escrito.BITACORA.push({ USUARIO: u, ACCION: a, DETALLE: d, OP: op || '' });
  S.ctx.marcarAnulado_ = (n, id, motivo) => {
    assert.equal(S.lock.tomado, 1);
    const f = (S.escrito[n] || []).concat((hojas || {})[n] || []).find(x => x.ID === id);
    if (f && S.ctx.anulado_(f)) throw new Error(id + ' ya estaba anulado.');
    if (f) { f.ANULADO = 'SÍ'; f.MOTIVO_ANULACION = motivo; }
    S.escrito.anulados.push([n, id, motivo]);
  };
  return S;
}

test('guardarRegistro con op: el reintento (respuesta perdida) devuelve lo guardado sin escribir otra vez ni avisar de duplicado', () => {
  const { ctx, escrito } = conOp();
  const p = datosReg({ dni: '40999000', procedimiento: '', procedimientos: ['SANGRÍA'], tratamiento: 'HIERRO SACARATO', sesiones: '2', op: 'OP-prueba-1' });
  const r1 = plano(ctx.guardarRegistro(p));
  const r2 = plano(ctx.guardarRegistro(p));
  assert.equal(escrito.REGISTROS.length, 2);
  assert.deepEqual(escrito.REGISTROS.map(x => x.OP), ['OP-prueba-1#1', 'OP-prueba-1#2']);
  assert.equal(r2.repetida, true);
  assert.deepEqual(r2.registros.map(x => [x.ID, x.TEXTO]), r1.registros.map(x => [x.ID, x.TEXTO]));
  // Otro op (otra pulsación, otro día): sí avisa del duplicado.
  assert.equal(plano(ctx.guardarRegistro(Object.assign({}, p, { op: 'OP-prueba-2' }))).duplicado.ID, r1.registros[0].ID);
});

test('guardarRegistro: si falla la 2.ª fila, se anula lo escrito en esa llamada y dice que no quedó nada; el reintento no es «duplicado»', () => {
  const { ctx, escrito } = conOp();
  const anexar = ctx.anexarObjeto_;
  let n = 0;
  ctx.anexarObjeto_ = (h, cols, o) => { if (h === 'REGISTROS' && ++n === 2) throw new Error('Service Spreadsheets timed out while accessing document.'); return anexar(h, cols, o); };
  const p = datosReg({ dni: '40999000', procedimiento: '', procedimientos: ['SANGRÍA'], tratamiento: 'HIERRO SACARATO', sesiones: '2', fecha: '2026-10-03', fechaInicio: '2026-10-04' });
  assert.throws(() => ctx.guardarRegistro(p), /timed out.*No quedó nada guardado: se deshizo lo escrito\./);
  assert.deepEqual(escrito.anulados.map(a => [a[0], a[1]]), [['SESIONES', 'SES-000001'], ['REGISTROS', 'REG-000001']]);
  assert.deepEqual(escrito.BITACORA, [], 'sin líneas de lo que se deshizo');
  const r = plano(ctx.guardarRegistro(p));
  assert.equal(r.ok, true, 'lo anulado no cuenta como duplicado');
  assert.deepEqual(r.registros.map(x => x.ID), ['REG-000002', 'REG-000003']);
  assert.deepEqual(r.sesiones.map(x => x.ID_REGISTRO), ['REG-000002', 'REG-000003']);
});

test('guardarRegistro: el aviso de duplicado se revisa otra vez dentro del candado (dos registros del mismo AMO a la vez)', () => {
  const { ctx, escrito } = conOp({ registros: [] }, { REGISTROS: [REG4] });   // lo leído antes del candado aún no tenía REG-000004
  assert.deepEqual(plano(ctx.guardarRegistro(datosReg())), { ok: false, duplicado: { ID: 'REG-000004', FECHA: '2026-10-01', TEXTO: 'Sangría' } });
  assert.equal(escrito.REGISTROS.length, 0);
});

test('si falla solo la BITACORA después de guardar, la respuesta es ok con aviso (nunca «No se guardó» habiendo guardado)', () => {
  const C = cargar(['Logica.gs', 'Registro.gs', 'Resultados.gs', 'Tablero.gs', 'Enfermeria.gs', 'Codigo.gs']);
  C.MEMO = {}; C.fechaHoraTexto_ = () => '2026-10-05 10:30'; C.conOp_ = (n, c) => c;
  C.anexarObjeto_ = () => { throw new Error('Service Spreadsheets timed out.'); };
  assert.doesNotThrow(() => C.bitacora_('MAGALY', 'RESULTADO', 'x', 'OP-123456'));
  assert.deepEqual(plano(C.avisos_({ ok: true })), { ok: true, aviso: 'Se guardó, pero no se pudo escribir la BITACORA: Service Spreadsheets timed out.' });
  C.MEMO = {};
  assert.deepEqual(plano(C.avisos_({ ok: true })), { ok: true }, 'sin fallos, sin aviso');
});

test('marcarSesion y las anulaciones con op: el reintento no marca otra sesión ni falla con «ya estaba anulado»', () => {
  const R3 = Object.assign({}, REG4, { TIPO: 'HIERRO', DETALLE: 'HIERRO SACARATO', SESIONES: '3' });
  const { ctx, escrito } = conOp({}, { REGISTROS: [R3] });
  const a = plano(ctx.marcarSesion({ usuario: 'MAGALY', id: 'REG-000004', fecha: '2026-10-04', sesion: 1, op: 'OP-ses-0001' }));
  const b = plano(ctx.marcarSesion({ usuario: 'MAGALY', id: 'REG-000004', fecha: '2026-10-04', sesion: 1, op: 'OP-ses-0001' }));
  assert.deepEqual([escrito.SESIONES.length, b.repetida, b.sesion.ID, b.completo], [1, true, a.sesion.ID, false]);
  ctx.anularSesion({ usuario: 'MAGALY', id: a.sesion.ID, motivo: 'Fecha equivocada', op: 'OP-anu-0001' });
  assert.deepEqual(plano(ctx.anularSesion({ usuario: 'MAGALY', id: a.sesion.ID, motivo: 'Fecha equivocada', op: 'OP-anu-0001' })), { ok: true, repetida: true });
  assert.throws(() => ctx.anularSesion({ usuario: 'MAGALY', id: a.sesion.ID, motivo: 'x', op: 'OP-anu-0002' }), /ya estaba anulada/);
  ctx.anularRegistro({ usuario: 'MAGALY', id: 'REG-000004', motivo: 'Error', op: 'OP-anu-0003' });
  assert.deepEqual(plano(ctx.anularRegistro({ usuario: 'MAGALY', id: 'REG-000004', motivo: 'Error', op: 'OP-anu-0003' })), { ok: true, repetida: true });
  assert.equal(escrito.anulados.length, 2);
});

test('guardarRegistro: si al deshacer falla la anulación de una SESIÓN, el reintento con el mismo op la anula (caso 7 de la batería de 80)', () => {
  const { ctx, escrito } = conOp();
  const anexar = ctx.anexarObjeto_, anular = ctx.marcarAnulado_;
  let n = 0, fallarDeshacer = true;
  ctx.anexarObjeto_ = (h, cols, o) => { if (h === 'REGISTROS' && ++n === 2) throw new Error('Service Spreadsheets timed out.'); return anexar(h, cols, o); };
  ctx.marcarAnulado_ = (h, id, m) => { if (fallarDeshacer && h === 'SESIONES') throw new Error('Service Spreadsheets timed out.'); return anular(h, id, m); };
  ctx.leerSesiones_ = () => escrito.SESIONES;
  const p = datosReg({ dni: '40999000', procedimiento: '', tratamiento: 'HIERRO SACARATO', procedimientos: ['SANGRÍA'], sesiones: '2', fecha: '2026-10-03', fechaInicio: '2026-10-03', op: 'OP-huerfana-1' });
  assert.throws(() => ctx.guardarRegistro(p), /Además no se pudo deshacer todo/);
  assert.deepEqual(escrito.SESIONES.filter(s => !ctx.anulado_(s)).map(s => s.ID_REGISTRO), ['REG-000001'], 'quedó viva la sesión de un registro anulado');
  fallarDeshacer = false;
  const r = plano(ctx.guardarRegistro(p));
  assert.equal(r.ok, true);
  assert.ok(escrito.anulados.some(a => a[0] === 'SESIONES' && a[1] === 'SES-000001'), 'el reintento anula la sesión que quedó');
  assert.deepEqual(escrito.SESIONES.filter(s => !ctx.anulado_(s)).map(s => s.ID_REGISTRO), ['REG-000002', 'REG-000003']);
});

test('guardarRegistro: tras un doble fallo (falla la 2.ª fila y deshacer la 1.ª), el reintento con el mismo op no dice «guardado» a medias: anula lo vivo y escribe todo (caso 6)', () => {
  const { ctx, escrito } = conOp();
  const anexar = ctx.anexarObjeto_, anular = ctx.marcarAnulado_;
  let n = 0, fallarDeshacer = true;
  ctx.anexarObjeto_ = (h, cols, o) => { if (h === 'REGISTROS' && ++n === 2) throw new Error('Service Spreadsheets timed out.'); return anexar(h, cols, o); };
  ctx.marcarAnulado_ = (h, id, m) => { if (fallarDeshacer && h === 'REGISTROS') throw new Error('Service Spreadsheets timed out.'); return anular(h, id, m); };
  const p = datosReg({ dni: '40999000', procedimiento: '', procedimientos: ['SANGRÍA'], tratamiento: 'HIERRO SACARATO', sesiones: '2', op: 'OP-doble-1' });
  assert.throws(() => ctx.guardarRegistro(p), /Además no se pudo deshacer todo/);
  assert.deepEqual(escrito.REGISTROS.filter(r => !ctx.anulado_(r)).map(r => [r.ID, r.OP]), [['REG-000001', 'OP-doble-1#1']], 'quedó viva la 1.ª');
  fallarDeshacer = false;
  const r = plano(ctx.guardarRegistro(p));
  assert.equal(r.ok, true);
  assert.notEqual(r.repetida, true, 'no es «repetida»: la primera vez quedó a medias');
  assert.deepEqual(r.registros.map(x => x.ID), ['REG-000002', 'REG-000003']);
  assert.deepEqual(escrito.REGISTROS.filter(x => !ctx.anulado_(x)).map(x => [x.ID, x.OP]), [['REG-000002', 'OP-doble-1#1'], ['REG-000003', 'OP-doble-1#2']]);
  assert.ok(escrito.anulados.some(a => a[0] === 'REGISTROS' && a[1] === 'REG-000001'), 'lo que quedó vivo del intento anterior se anula');
  // Y el siguiente reintento (respuesta perdida) ya sí es «repetida» con todo.
  const r3 = plano(ctx.guardarRegistro(p));
  assert.deepEqual([r3.repetida, r3.registros.map(x => x.ID)], [true, ['REG-000002', 'REG-000003']]);
});

test('guardarRegistro: si no puede anular lo que quedó a medias de un intento anterior, rechaza con un mensaje claro (caso 6)', () => {
  const { ctx, escrito } = conOp({}, { REGISTROS: [Object.assign({}, REG4, { ID: 'REG-000007', DNI: '40999000', OP: 'OP-doble-2#1' })] });
  ctx.marcarAnulado_ = () => { throw new Error('Service Spreadsheets timed out.'); };
  const p = datosReg({ dni: '40999000', procedimiento: '', procedimientos: ['SANGRÍA'], tratamiento: 'HIERRO SACARATO', sesiones: '2', op: 'OP-doble-2' });
  assert.throws(() => ctx.guardarRegistro(p), /quedó a medias.*revise Registrados/);
  assert.equal(escrito.REGISTROS.length, 0);
});

test('con «Falleció» vigente, el servidor rechaza un registro nuevo y marcar sesión; anulado el fallecimiento, deja (caso 38)', () => {
  const muerto = { ID: 'SEG-9', FECHA_HORA: '2026-10-02 10:00', DNI: '40111222', ESPECIALIDAD: 'HEMATOLOGÍA', RESPONSABLE: 'RACHEL', ACCION: 'DESCARTADO', RESULTADO: 'FALLECIÓ', MOTIVO: 'FALLECIÓ' };
  const { ctx, escrito } = servidor({ seguimientos: [muerto] }, { REGISTROS: [REG4] });
  const msg = /figura como fallecido desde el 02\/10\/2026: para registrar, primero anule «Falleció» en su ficha\./;
  assert.throws(() => ctx.guardarRegistro(datosReg({ confirmado: true })), msg);
  assert.throws(() => ctx.marcarSesion({ usuario: 'MAGALY', id: 'REG-000004', fecha: '2026-10-04' }), msg);
  assert.deepEqual([escrito.REGISTROS.length, escrito.SESIONES.length], [0, 0]);
  const vivo = servidor({ seguimientos: [Object.assign({}, muerto, { ANULADO: 'SÍ' })].filter(s => !s.ANULADO) }, { REGISTROS: [REG4] });
  assert.equal(plano(vivo.ctx.guardarRegistro(datosReg({ confirmado: true }))).ok, true);
  assert.equal(plano(vivo.ctx.marcarSesion({ usuario: 'MAGALY', id: 'REG-000004', fecha: '2026-10-04' })).ok, true);
});

test('tipos incorrectos se rechazan en vez de convertirse: motivo o nota objeto, número de sesión no entero (caso 58)', () => {
  const { ctx, escrito } = servidor({}, { REGISTROS: [Object.assign({}, REG4, { SESIONES: '3' })] });
  assert.throws(() => ctx.anularRegistro({ usuario: 'MAGALY', id: 'REG-000004', motivo: { a: 1 } }), /El motivo debe ser un texto\./);
  assert.throws(() => ctx.anularRegistro({ usuario: 'MAGALY', id: 'REG-000004', motivo: ['x'] }), /El motivo debe ser un texto\./);
  assert.throws(() => ctx.marcarSesion({ usuario: 'MAGALY', id: 'REG-000004', fecha: '2026-10-04', nota: { x: 1 } }), /La nota debe ser un texto\./);
  for (const sesion of ['dos', 1.5, [1], { k: 1 }, '0', -1]) {
    assert.throws(() => ctx.marcarSesion({ usuario: 'MAGALY', id: 'REG-000004', fecha: '2026-10-04', sesion }), /El número de sesión no es válido; recargue\./, String(sesion));
  }
  assert.deepEqual([escrito.SESIONES.length, escrito.anulados.length], [0, 0]);
  assert.equal(plano(ctx.marcarSesion({ usuario: 'MAGALY', id: 'REG-000004', fecha: '2026-10-04', sesion: '1' })).ok, true, '«1» como texto vale');
  const L = cargar();
  assert.equal(L.largoMal_({ a: 1 }, 2000, 'La nota'), 'La nota debe ser un texto.');
  assert.equal(L.largoMal_(12, 2000, 'La nota'), '');
  assert.equal(L.largoMal_(null, 2000, 'La nota'), '');
});

test('con «Falleció» vigente también se rechazan la decisión del médico, Editar y asignar DNI (con el mismo mensaje); anular sí se puede', () => {
  const muerto = { ID: 'SEG-9', FECHA_HORA: '2026-10-01 09:00', DNI: '40111222', ESPECIALIDAD: 'HEMATOLOGÍA', RESULTADO: 'FALLECIÓ', ACCION: 'DESCARTADO', MOTIVO: 'FALLECIÓ', ANULADO: '' };
  const { ctx, escrito, lock } = servidor({ seguimientos: [muerto], indicaciones: [] }, { REGISTROS: [REG4] });
  const MSG = /^Error: Este paciente figura como fallecido desde el 01\/10\/2026: para registrar, primero anule «Falleció» en su ficha\.$/;
  assert.throws(() => ctx.darDeAlta({ usuario: 'MAGALY', dni: '40111222', especialidad: 'HEMATOLOGÍA', doctor: 'Dra. Karen Matos', fecha: '2026-10-05', decision: 'ALTA 6 MESES' }), MSG);
  ctx.leerRegistros_ = () => [REG4];
  ctx.leerSesiones_ = () => [];
  ctx.actualizarCeldas_ = () => { throw new Error('no debía escribir'); };
  assert.throws(() => ctx.editarRegistro({ usuario: 'MAGALY', id: 'REG-000004', cambios: { contacto: '912000111' } }), MSG);
  const sh = hojaIndicaciones();
  ctx.hoja_ = () => sh;
  assert.throws(() => ctx.asignarDniIndicacion({ usuario: 'MAGALY', id: 'IND-0120', dni: '40111222' }), MSG);
  assert.deepEqual(sh.v[1].slice(4), ['', 'SIN CANDIDATO']);
  ctx.anularRegistro({ usuario: 'MAGALY', id: 'REG-000004', motivo: 'Error' });
  assert.deepEqual([escrito.ALTAS.length, escrito.anulados.length, lock.tomado], [0, 1, 0]);
});

test('darDeAlta: una segunda decisión del mismo día y especialidad se rechaza dentro del candado, aunque la primera no deje alta vigente (caso 41)', () => {
  const nr = { ID: 'ALT-000001', FECHA_HORA: '2026-10-05 10:29', FECHA: '2026-10-05', DNI: '40111222', ESPECIALIDAD: 'HEMATOLOGÍA', DOCTOR: 'Dra. Karen Matos',
    REGISTRADO_POR: 'ANA', DECISION: 'NUEVA REEVALUACION', FECHA_RETORNO: '2026-12-05', ANULADO: '', OP: 'OP-otra-0001' };
  const { ctx, escrito } = servidor({}, { ALTAS: [nr] });   // lo leído antes del candado aún no la tenía (carrera)
  ctx.leerAltas_ = () => [nr];
  const p = { usuario: 'MAGALY', dni: '40111222', especialidad: 'HEMATOLOGÍA', doctor: 'Dra. Karen Matos', fecha: '2026-10-05', decision: 'ALTA 1 AÑO', op: 'OP-mia-0001' };
  assert.throws(() => ctx.darDeAlta(p), /^Error: Ya se registró una decisión hoy para esta especialidad; anúlela para cambiarla\.$/);
  assert.equal(escrito.ALTAS.length, 0);
  // Anulada la primera, sí.
  nr.ANULADO = 'SÍ';
  assert.equal(plano(ctx.darDeAlta(p)).ok, true);
  // Otra especialidad, sí.
  const { ctx: c2 } = servidor({}, {});
  c2.leerAltas_ = () => [Object.assign({}, nr, { ANULADO: '', ESPECIALIDAD: 'REUMATOLOGÍA' })];
  assert.equal(plano(c2.darDeAlta(p)).ok, true);
});
