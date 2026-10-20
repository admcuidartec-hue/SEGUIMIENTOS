// Servidor de Enfermería y la primera sesión ya aplicada, con dobles de las hojas. Datos inventados.
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar, plano } = require('./cargar');
const { cita, reglas } = require('./fixtures');

const CAT = { usuarios: ['MAGALY', 'ENFERMERA PRUEBA'], motivos: [], alias: {}, doctores: [{ doctor: 'Dra. Karen Matos', sofdoc: 'Dra. KAREN DIANA MATOS PEÑA' }],
  procedimientos: ['SANGRÍA'], tratamientos: ['HIERRO SACARATO'], marcas: {}, reacciones: ['Náuseas', 'Cefalea', 'Otra'] };
const REG1 = { ID: 'REG-000001', FECHA_HORA: '2026-10-01 09:00', FECHA: '2026-10-01', ASESORA: 'MAGALY', DOCTOR: 'Dra. Karen Matos', NOMBRE: 'ROSA QUISPE',
  DNI: '40111222', CONTACTO: '987654321', TIPO: 'HIERRO', DETALLE: 'HIERRO SACARATO', MARCA: '', SESIONES: '3', ANULADO: '' };
const SES1 = { ID: 'SES-000001', FECHA_HORA: '2026-10-03 10:00', ID_REGISTRO: 'REG-000001', NUMERO: '1', FECHA: '2026-10-03', ASESORA: 'MAGALY', ANULADO: '' };

function servidor(hojas) {
  const ctx = cargar(['Logica.gs', 'Registro.gs', 'Resultados.gs', 'Tablero.gs', 'Enfermeria.gs', 'Codigo.gs', 'RegistroServidor.gs',
    'ResultadoServidor.gs', 'EnfermeriaServidor.gs']);
  const L = cargar();
  const base = Object.assign({ REGISTROS: [REG1], SESIONES: [SES1], ENFERMERIA: [], SEGUIMIENTOS: [] }, hojas || {});
  const escrito = { REGISTROS: [], SESIONES: [], ENFERMERIA: [], SEGUIMIENTOS: [], BITACORA: [], anulados: [] };
  const lock = { tomado: 0, flush: 0 };
  const leer = n => (base[n] || []).concat(escrito[n] || []);
  ctx.datos_ = () => ctx.derivar_({ hoy: '2026-10-05', catalogos: CAT, reglas: reglas(L), citas: [cita({ fecha: '2026-09-01' })],
    indicaciones: [], contactos: [], registros: leer('REGISTROS'), sesiones: leer('SESIONES'), altas: [], enfermeria: leer('ENFERMERIA'),
    seguimientosTodos: leer('SEGUIMIENTOS'), seguimientos: leer('SEGUIMIENTOS') });
  ctx.exigirColumnas_ = () => {};
  ctx.bloquear_ = () => { lock.tomado++; return { releaseLock: () => { lock.tomado--; } }; };
  ctx.SpreadsheetApp = { flush: () => { lock.flush++; } };
  ctx.leerOpcional_ = leer;
  ctx.leerRegistros_ = () => leer('REGISTROS');
  ctx.leerSesiones_ = () => leer('SESIONES');
  ctx.leerSeguimientos_ = () => leer('SEGUIMIENTOS');
  ctx.leerEnfermeria_ = () => leer('ENFERMERIA');
  ctx.anexarObjeto_ = (n, cols, o) => { assert.equal(lock.tomado, 1, 'se escribe con el candado tomado'); escrito[n].push(plano(o)); };
  ctx.bitacora_ = (u, a, d) => escrito.BITACORA.push([u, a, d]);
  ctx.fechaHoraTexto_ = () => '2026-10-05 10:30';
  ctx.marcarAnulado_ = (n, id, motivo) => { assert.equal(lock.tomado, 1); escrito.anulados.push([n, id, motivo]); };
  return { ctx, escrito, lock };
}

const datosReg = o => Object.assign({ usuario: 'MAGALY', dni: '40999888', nombre: 'Ana Flores', contacto: '987000111', fecha: '2026-10-02',
  doctor: 'Dra. Karen Matos', procedimiento: '', tratamiento: 'HIERRO SACARATO', sesiones: '2', marca: '', confirmado: true }, o);

test('guardarRegistro con la primera sesión pasada: crea el registro y marca la sesión 1 en el mismo candado', () => {
  const { ctx, escrito, lock } = servidor();
  const r = plano(ctx.guardarRegistro(datosReg({ fechaInicio: '2026-10-03' })));
  assert.equal(r.ok, true);
  assert.deepEqual(escrito.REGISTROS.map(x => [x.ID, x.FECHA_INICIO]), [['REG-000002', '2026-10-03']]);
  assert.deepEqual(escrito.SESIONES.map(s => [s.ID, s.ID_REGISTRO, s.NUMERO, s.FECHA, s.ASESORA]), [['SES-000002', 'REG-000002', 1, '2026-10-03', 'MAGALY']]);
  assert.deepEqual(escrito.BITACORA.map(b => b[1]), ['REGISTRO', 'SESIÓN']);
  assert.deepEqual(r.sesiones.map(s => s.ID), ['SES-000002']);
  assert.deepEqual([lock.tomado, lock.flush], [0, 1]);
  // Hoy o futura: programada, sin sesión.
  const h = servidor();
  h.ctx.guardarRegistro(datosReg({ fechaInicio: '2026-10-05' }));
  assert.deepEqual([h.escrito.REGISTROS.length, h.escrito.SESIONES.length], [1, 0]);
  // Anterior al registro: no escribe nada.
  const a = servidor();
  assert.throws(() => a.ctx.guardarRegistro(datosReg({ fechaInicio: '2026-10-01' })), /anterior a la fecha del registro/);
  assert.deepEqual([a.escrito.REGISTROS.length, a.lock.tomado], [0, 0]);
});

test('getEnfermeria: los contactos pendientes en orden de llamada y el catálogo de reacciones', () => {
  const { ctx } = servidor();
  const r = plano(ctx.getEnfermeria());
  assert.deepEqual(r.contactos.map(c => [c.CLAVE, c.GRUPO]), [['SES-000001|1', 'VENCIDO'], ['SES-000001|3', 'PROXIMO'], ['SES-000001|5', 'PROXIMO']]);
  assert.deepEqual(r.reacciones, ['Náuseas', 'Cefalea', 'Otra']);
  assert.equal(r.hoy, '2026-10-05');
});

test('registrarContactoEnfermeria: valida, escribe ENF-… con candado y bitácora; el contacto sale de la lista', () => {
  const { ctx, escrito, lock } = servidor();
  assert.throws(() => ctx.registrarContactoEnfermeria({ usuario: 'ENFERMERA PRUEBA', clave: 'SES-000001|1', resultado: 'CONTACTADO', reaccionTipo: 'MEDIATA', reacciones: [] }),
    /Elija al menos una reacción/);
  assert.equal(lock.tomado, 0);
  const r = plano(ctx.registrarContactoEnfermeria({ usuario: 'ENFERMERA PRUEBA', clave: 'SES-000001|1', resultado: 'CONTACTADO', reaccionTipo: 'MEDIATA',
    reacciones: ['Cefalea'], nota: 'leve' }));
  const f = escrito.ENFERMERIA[0];
  assert.deepEqual([f.ID, f.FECHA_HORA, f.ID_SESION, f.DIA, f.RESULTADO, f.REACCION_TIPO, f.REACCION, f.ENFERMERA],
    ['ENF-000001', '2026-10-05 10:30', 'SES-000001', 1, 'CONTACTADO', 'MEDIATA', 'Cefalea', 'ENFERMERA PRUEBA']);
  assert.deepEqual(escrito.BITACORA[0].slice(0, 2), ['ENFERMERA PRUEBA', 'ENFERMERÍA']);
  assert.equal(r.fila.ID, 'ENF-000001');
  assert.deepEqual(r.contactos.map(c => c.CLAVE), ['SES-000001|3', 'SES-000001|5']);
  assert.deepEqual(r.contactos[0].REACCIONES, [{ DIA: 1, TIPO: 'MEDIATA', REACCION: 'Cefalea' }]);
  // Un segundo «contactado» del mismo día ya no se acepta (se relee dentro del candado).
  assert.throws(() => ctx.registrarContactoEnfermeria({ usuario: 'ENFERMERA PRUEBA', clave: 'SES-000001|1', resultado: 'CONTACTADO', reaccionTipo: 'NINGUNA' }),
    /ya no está en la lista/);
  // «No contestó» se queda en la lista, con su cuenta.
  const n = plano(ctx.registrarContactoEnfermeria({ usuario: 'ENFERMERA PRUEBA', clave: 'SES-000001|3', resultado: 'NO CONTESTO' }));
  assert.equal(n.contactos.find(c => c.CLAVE === 'SES-000001|3').NO_CONTESTO, 1);
  assert.equal(escrito.ENFERMERIA[1].ID, 'ENF-000002');
});

test('anularContactoEnfermeria: solo ENF-…, con motivo y candado', () => {
  const { ctx, escrito } = servidor({ ENFERMERIA: [{ ID: 'ENF-000001', ID_SESION: 'SES-000001', DIA: 1, RESULTADO: 'CONTACTADO', ANULADO: '' }] });
  assert.throws(() => ctx.anularContactoEnfermeria({ usuario: 'ENFERMERA PRUEBA', id: 'SEG-1', motivo: 'x' }), /ENF-/);
  assert.throws(() => ctx.anularContactoEnfermeria({ usuario: 'ENFERMERA PRUEBA', id: 'ENF-000001', motivo: '' }), /Escriba el motivo/);
  assert.deepEqual(plano(ctx.anularContactoEnfermeria({ usuario: 'ENFERMERA PRUEBA', id: 'ENF-000001', motivo: 'Deshecho al momento' })), { ok: true });
  assert.deepEqual(escrito.anulados, [['ENFERMERIA', 'ENF-000001', 'Deshecho al momento']]);
});

test('marcarSesion con reacción durante la aplicación: la sesión y la fila de ENFERMERIA (DIA 0) en el mismo candado', () => {
  const { ctx, escrito } = servidor();
  assert.throws(() => ctx.marcarSesion({ usuario: 'MAGALY', id: 'REG-000001', fecha: '2026-10-05', reaccion: { hubo: true, reacciones: ['Otra'] } }), /Escriba cuál fue la reacción/);
  assert.equal(escrito.SESIONES.length, 0, 'una reacción inválida no deja la sesión a medias');
  const r = plano(ctx.marcarSesion({ usuario: 'MAGALY', id: 'REG-000001', fecha: '2026-10-05', reaccion: { hubo: true, reacciones: ['Náuseas'] } }));
  assert.equal(r.sesion.ID, 'SES-000002');
  assert.deepEqual(escrito.ENFERMERIA.map(f => [f.ID_SESION, f.NUMERO_SESION, f.DIA, f.REACCION_TIPO, f.REACCION, f.ENFERMERA]),
    [['SES-000002', 2, 0, 'INMEDIATA', 'Náuseas', 'MAGALY']]);
  assert.equal(r.reaccion.ID, 'ENF-000001');
  // Sin reacción, como siempre.
  const s = servidor();
  s.ctx.marcarSesion({ usuario: 'MAGALY', id: 'REG-000001', fecha: '2026-10-05', reaccion: { hubo: false } });
  assert.deepEqual([s.escrito.SESIONES.length, s.escrito.ENFERMERIA.length], [1, 0]);
});

test('getPaciente trae las filas de Enfermería del DNI; getResumen suma las cifras de Enfermería', () => {
  const { ctx } = servidor({ ENFERMERIA: [{ ID: 'ENF-000001', FECHA_HORA: '2026-10-04 09:00', ID_REGISTRO: 'REG-000001', ID_SESION: 'SES-000001', NUMERO_SESION: 1,
    DNI: '40111222', DIA: 1, RESULTADO: 'CONTACTADO', REACCION_TIPO: 'INMEDIATA', REACCION: 'Náuseas', ENFERMERA: 'ENFERMERA PRUEBA', ANULADO: '' }] });
  ctx.leerIndicaciones_ = () => [];
  const p = plano(ctx.getPaciente('40111222'));
  assert.deepEqual(p.enfermeria.map(f => [f.ID, f.DIA, f.REACCION]), [['ENF-000001', 1, 'Náuseas']]);
  const r = plano(ctx.getResumen());
  const oct = r.filas.find(f => f.MES === '2026-10' && f.MEDICO === 'Dra. KAREN DIANA MATOS PEÑA');
  assert.deepEqual([oct.REAC_PAC, oct.REAC_INM, oct.ENF_DEBIDOS, oct.ENF_A_TIEMPO], [1, 1, 1, 1], 'solo el día 1 (04/10) ya tocaba, y se cumplió ese día');
});
