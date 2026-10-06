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
  const ctx = cargar(['Logica.gs', 'Registro.gs', 'Resultados.gs', 'Tablero.gs', 'Codigo.gs', 'RegistroServidor.gs']);
  const escrito = { REGISTROS: [], SESIONES: [], ALTAS: [], BITACORA: [], anulados: [] };
  const lock = { tomado: 0 };
  const L = cargar(['Logica.gs', 'Registro.gs', 'Resultados.gs', 'Tablero.gs']);
  ctx.datos_ = () => Object.assign({ hoy: '2026-10-05', catalogos: CAT, reglas: reglas(L), citas: [cita({ fecha: '2026-09-01' })],
    registros: [REG4], sesiones: [], altas: [], vigentes: {}, indicacionesTodas: [], contactos: [] }, extra);
  ctx.bloquear_ = () => { lock.tomado++; return { releaseLock: () => { lock.tomado--; } }; };
  ctx.leerOpcional_ = n => ((hojas || {})[n] || []).concat(escrito[n] || []);
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
  const hoy1 = Object.assign({}, REG4, { ID: 'REG-000005', FECHA_HORA: '2026-10-05 09:15', ANULADO: 'SÍ' });
  const alta = { ID: 'ALT-000001', FECHA_HORA: '2026-10-05 11:00', FECHA: '2026-10-05', DNI: '40111222', ESPECIALIDAD: 'HEMATOLOGÍA',
    DOCTOR: 'Dra. Karen Matos', REGISTRADO_POR: 'MAGALY', ANULADO: '' };
  const { ctx } = servidor({ registros: [ayer, hoy1], altas: [alta] });
  assert.deepEqual(plano(ctx.getRegistrosHoy()), [
    { ID: 'ALT-000001', HORA: '11:00', ASESORA: 'MAGALY', NOMBRE: 'ROSA ELENA QUISPE HUAMAN', DNI: '40111222', TEXTO: 'Alta médica · HEMATOLOGÍA · Dra. Karen Matos', ANULADO: false },
    { ID: 'REG-000005', HORA: '09:15', ASESORA: 'MAGALY', NOMBRE: 'ROSA QUISPE', DNI: '40111222', TEXTO: 'Sangría', ANULADO: true }]);
});

test('buscarPacienteRegistro: datos del paciente conocido y propuesta de doctor', () => {
  const c = [cita({ fecha: '2026-09-01', medico: 'Dra. KAREN DIANA MATOS PEÑA' })];
  const { ctx } = servidor({ citas: c, indicacionesTodas: [{ DNI: '40111222', TELEFONO: '912345678' }] });
  assert.deepEqual(plano(ctx.buscarPacienteRegistro('40111222')), { encontrado: true, nombre: 'ROSA ELENA QUISPE HUAMAN', telefonos: ['912345678'],
    ultimaFecha: '2026-09-01', ultimoMedico: 'Dra. KAREN DIANA MATOS PEÑA', doctor: 'Dra. Karen Matos',
    especialidades: [{ especialidad: 'HEMATOLOGÍA', alta: false }] });
  assert.deepEqual(plano(ctx.buscarPacienteRegistro('40000000')), { encontrado: false });
});

test('marcarAnulado_ escribe SÍ y el motivo en la fila de ese ID, y no anula dos veces', () => {
  const ctx = cargar(['Logica.gs', 'Registro.gs', 'Codigo.gs', 'RegistroServidor.gs']);
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
