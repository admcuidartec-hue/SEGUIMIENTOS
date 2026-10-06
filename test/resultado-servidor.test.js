// Servidor de «¿Qué pasó?» con dobles de las hojas. Datos inventados.
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar, plano } = require('./cargar');
const { cita, reglas } = require('./fixtures');

const CAT = { usuarios: ['MAGALY', 'RACHEL'], motivos: [], alias: {}, doctores: [{ doctor: 'Dra. Karen Matos', sofdoc: '' }],
  procedimientos: [], tratamientos: [], marcas: {} };

function servidor(hoja, extraEnHoja, registros, cabecera) {
  const ctx = cargar(['Logica.gs', 'Registro.gs', 'Resultados.gs', 'Tablero.gs', 'Codigo.gs', 'RegistroServidor.gs', 'ResultadoServidor.gs', 'Menu.gs']);
  const escrito = { SEGUIMIENTOS: [], BITACORA: [], anulados: [], llamadas: [] };
  const lock = { tomado: 0, flush: 0 };
  const L = cargar();
  const enHoja = hoja || [];
  const altas = [], sesiones = [];
  ctx.datos_ = () => ctx.derivar_({ hoy: '2026-10-06', catalogos: CAT, reglas: Object.assign(reglas(L), { maxSeguimientos: 2 }),
    citas: [cita({ fecha: '2026-07-01' })], indicaciones: [{ DNI: '40111222', TELEFONO: '987654321', FECHA: '2026-06-01', TIPO: 'HIERRO', ESTADO: 'ACEPTÓ' },
      { DNI: '40111222', TELEFONO: '912345678', FECHA: '2026-06-01', TIPO: 'HIERRO', ESTADO: 'ACEPTÓ' }],
    contactos: [], registros: registros || [], sesiones: sesiones.slice(), altas: altas.slice(), seguimientosTodos: enHoja.slice(), seguimientos: enHoja.filter(s => !L.anulado_(s)) });
  ctx.hoja_ = () => ({});
  ctx.encabezado_ = () => cabecera || ctx.COLUMNAS_SEGUIMIENTOS.slice();
  ctx.bloquear_ = () => { lock.tomado++; return { releaseLock: () => { lock.tomado--; } }; };
  ctx.SpreadsheetApp = { flush: () => { lock.flush++; } };
  ctx.leerSeguimientos_ = () => enHoja.concat(extraEnHoja || [], escrito.SEGUIMIENTOS);
  ctx.anexarObjeto_ = (n, cols, o) => { assert.equal(lock.tomado, 1, 'se escribe con el candado tomado'); escrito[n].push(plano(o)); };
  ctx.bitacora_ = (u, a, d) => escrito.BITACORA.push([u, a, d]);
  ctx.fechaHoraTexto_ = () => '2026-10-06 10:30';
  ctx.marcarAnulado_ = (n, id, motivo) => { assert.equal(lock.tomado, 1); escrito.anulados.push([n, id, motivo]); };
  ctx.darDeAlta = p => { escrito.llamadas.push(['darDeAlta', plano(p)]); altas.push({ ID: 'ALT-000001', FECHA: p.fecha, DNI: p.dni, ESPECIALIDAD: p.especialidad, DOCTOR: p.doctor }); return { ok: true, alta: { ID: 'ALT-000001' } }; };
  ctx.marcarSesion = p => { escrito.llamadas.push(['marcarSesion', plano(p)]); sesiones.push({ ID: 'SES-000001', FECHA_HORA: p.fecha + ' 10:30', ID_REGISTRO: p.id, NUMERO: sesiones.length + 1, FECHA: p.fecha, ASESORA: p.usuario, NOTA: p.nota || '', ANULADO: '', MOTIVO_ANULACION: '' }); return { ok: true, sesion: { ID: 'SES-000001' }, completo: false }; };
  return { ctx, escrito, lock };
}
const p = o => Object.assign({ usuario: 'MAGALY', dni: '40111222', especialidad: 'HEMATOLOGÍA', referencia: '', resultado: 'NO CONTESTÓ' }, o);

test('registrarResultado: lo inválido no toma el candado', () => {
  const { ctx, escrito, lock } = servidor();
  assert.throws(() => ctx.registrarResultado(p({ resultado: 'quizás' })), /Elija qué pasó/);
  assert.deepEqual([escrito.SEGUIMIENTOS.length, lock.tomado, lock.flush], [0, 0, 0]);
});

test('registrarResultado: escribe la fila, la bitácora, suelta con flush y devuelve la tarjeta movida', () => {
  const { ctx, escrito, lock } = servidor();
  const r = plano(ctx.registrarResultado(p({ resultado: 'lo pensará', fecha: '2026-10-09' })));
  assert.equal(r.ok, true);
  const s = escrito.SEGUIMIENTOS[0];
  assert.match(s.ID, /^SEG-\d+-\d+$/);
  assert.deepEqual([s.FECHA_HORA, s.ACCION, s.RESULTADO, s.FECHA_PROXIMA], ['2026-10-06 10:30', 'HECHO', 'LO PENSARÁ', '2026-10-09']);
  assert.deepEqual(escrito.BITACORA, [['MAGALY', 'RESULTADO', '40111222 · HEMATOLOGÍA · LO PENSARÁ']]);
  assert.deepEqual([lock.tomado, lock.flush], [0, 1]);
  assert.deepEqual([r.tarjeta.COLUMNA, r.tarjeta.ETIQUETA], ['AGENDADO', 'Llamar el vie 09/10']);
});

test('número equivocado: con otro teléfono sigue (TELEFONO); el último cierra (DESCARTADO), releyendo dentro del candado', () => {
  const { ctx, escrito } = servidor();
  ctx.registrarResultado(p({ resultado: 'NÚMERO EQUIVOCADO', telefono: '987654321' }));
  assert.equal(escrito.SEGUIMIENTOS[0].ACCION, 'TELEFONO');
  // Otra asesora, con datos de antes de la primera marca, marca el otro número.
  const r = plano(ctx.registrarResultado(p({ resultado: 'NÚMERO EQUIVOCADO', telefono: '912345678' })));
  assert.equal(escrito.SEGUIMIENTOS[1].ACCION, 'DESCARTADO');
  assert.equal(r.tarjeta, '', 'cerrada: ya no está en el tablero');
});

test('alta médica de una reevaluación y «lo hizo» de un registro van a sus funciones', () => {
  const { ctx, escrito } = servidor();
  const a = plano(ctx.registrarResultado(p({ resultado: 'ALTA MÉDICA', doctor: 'Dra. Karen Matos', fecha: '2026-10-06' })));
  assert.equal(a.alta.ID, 'ALT-000001');
  assert.ok('tarjeta' in a, 'devuelve la tarjeta recalculada');
  assert.equal(a.tarjeta.COLUMNA, 'COMPLETADO', 'con el alta la reevaluación sale de las abiertas');
  assert.match(a.tarjeta.ETIQUETA, /Alta médica/);
  assert.deepEqual(escrito.llamadas[0][1], { usuario: 'MAGALY', dni: '40111222', especialidad: 'HEMATOLOGÍA', doctor: 'Dra. Karen Matos', fecha: '2026-10-06', nota: '' });
  assert.equal(escrito.SEGUIMIENTOS.length, 0);
});

test('anularResultado: solo SEG-, motivo obligatorio, el último de su seguimiento', () => {
  const hoja = [{ ID: 'SEG-1', FECHA_HORA: '2026-10-01 09:00', DNI: '40111222', ESPECIALIDAD: 'HEMATOLOGÍA', RESULTADO: 'NO CONTESTÓ', ACCION: 'HECHO', REFERENCIA: '' },
    { ID: 'SEG-2', FECHA_HORA: '2026-10-02 09:00', DNI: '40111222', ESPECIALIDAD: 'HEMATOLOGÍA', RESULTADO: 'NO CONTESTÓ', ACCION: 'HECHO', REFERENCIA: '' }];
  const { ctx, escrito, lock } = servidor(hoja);
  assert.throws(() => ctx.anularResultado({ usuario: 'MAGALY', id: 'ALT-1', motivo: 'x' }), /resultados de seguimiento/);
  assert.throws(() => ctx.anularResultado({ usuario: 'MAGALY', id: 'SEG-2', motivo: '' }), /Escriba el motivo/);
  assert.throws(() => ctx.anularResultado({ usuario: 'MAGALY', id: 'SEG-1', motivo: 'error' }), /Solo se puede anular el último/);
  assert.equal(lock.tomado, 0, 'el candado se suelta también con error');
  assert.deepEqual(plano(ctx.anularResultado({ usuario: 'MAGALY', id: 'SEG-2', motivo: 'Deshecho al momento' })), { ok: true });
  assert.deepEqual(escrito.anulados, [['SEGUIMIENTOS', 'SEG-2', 'Deshecho al momento']]);
});

test('datos_ deja fuera las anuladas; marcarSeguimiento y descartar siguen funcionando', () => {
  const hoja = [{ ID: 'SEG-1', FECHA_HORA: '2026-10-05 09:00', DNI: '40111222', ESPECIALIDAD: 'HEMATOLOGÍA', ACCION: 'HECHO', ANULADO: 'SÍ' }];
  const { ctx, escrito } = servidor(hoja);
  assert.equal(ctx.datos_().pacientes[0].ESTADO, 'VENCIDO', 'el intento anulado no cuenta');
  ctx.marcarSeguimiento(p({}));
  assert.deepEqual([escrito.SEGUIMIENTOS[0].RESULTADO, escrito.SEGUIMIENTOS[0].ACCION], ['NO CONTESTÓ', 'HECHO']);
  ctx.descartar(p({ motivo: 'SE ATIENDE EN OTRO LUGAR' }));
  assert.deepEqual([escrito.SEGUIMIENTOS[1].RESULTADO, escrito.SEGUIMIENTOS[1].ACCION], ['SE ATIENDE EN OTRO LUGAR', 'DESCARTADO']);
});

test('getTablero devuelve las columnas listas para enviar', () => {
  const { ctx } = servidor();
  const t = plano(ctx.getTablero());
  assert.deepEqual(t.columnas.POR_CONTACTAR.map(x => x.CLAVE), ['40111222|HEMATOLOGÍA']);
});

test('registrarResultado: vuelve a validar dentro del candado con la hoja releída', () => {
  const muerto = { ID: 'SEG-9', FECHA_HORA: '2026-10-06 09:00', DNI: '40111222', ESPECIALIDAD: 'HEMATOLOGÍA', RESULTADO: 'FALLECIÓ', ACCION: 'DESCARTADO', REFERENCIA: '' };
  const { ctx, escrito, lock } = servidor([], [muerto]);
  assert.throws(() => ctx.registrarResultado(p({})), /no está en la lista/);
  assert.deepEqual([escrito.SEGUIMIENTOS.length, lock.tomado], [0, 0]);
});

test('registrarResultado: una tarjeta ya cerrada no acepta resultados y no toma el candado', () => {
  const cerrada = { ID: 'SEG-5', FECHA_HORA: '2026-10-05 09:00', DNI: '40111222', ESPECIALIDAD: 'HEMATOLOGÍA', RESULTADO: 'SE ATIENDE EN OTRO LUGAR',
    MOTIVO: 'SE ATIENDE EN OTRO LUGAR', ACCION: 'DESCARTADO', REFERENCIA: '' };
  const { ctx, escrito, lock } = servidor([cerrada]);
  assert.throws(() => ctx.registrarResultado(p({})), /no está en la lista/);
  assert.deepEqual([escrito.SEGUIMIENTOS.length, lock.tomado, lock.flush], [0, 0, 0]);
});

test('«lo hizo» de un registro va a marcarSesion y no escribe en SEGUIMIENTOS', () => {
  const reg = { ID: 'REG-000004', FECHA_HORA: '2026-09-25 09:00', FECHA: '2026-09-25', ASESORA: 'MAGALY', DOCTOR: 'Dra. Karen Matos',
    DNI: '40111222', TIPO: 'HIERRO', CONTACTO: '987654321', DETALLE: '', SESIONES: 1 };
  const { ctx, escrito } = servidor([], [], [reg]);
  const tarjeta = ctx.datos_().pendientes[0];
  assert.ok(tarjeta && tarjeta.ID_REGISTRO === 'REG-000004', 'hay tarjeta de registro');
  const r = plano(ctx.registrarResultado(p({ especialidad: tarjeta.ESPECIALIDAD, referencia: 'REG-000004', resultado: 'LO HIZO', fecha: '2026-10-06', nota: 'ok' })));
  assert.deepEqual(escrito.llamadas, [['marcarSesion', { usuario: 'MAGALY', id: 'REG-000004', fecha: '2026-10-06', nota: 'ok' }]]);
  assert.equal(escrito.SEGUIMIENTOS.length, 0);
  assert.ok('tarjeta' in r, 'devuelve la tarjeta recalculada');
  assert.equal(r.tarjeta.COLUMNA, 'COMPLETADO', 'era la última sesión');
  assert.match(r.tarjeta.ETIQUETA, /Completó el tratamiento/);
});

test('«lo hizo» de una sesión que no es la última deja la tarjeta en tratamiento', () => {
  const reg = { ID: 'REG-000004', FECHA_HORA: '2026-09-25 09:00', FECHA: '2026-09-25', ASESORA: 'MAGALY', DOCTOR: 'Dra. Karen Matos',
    DNI: '40111222', TIPO: 'HIERRO', CONTACTO: '987654321', DETALLE: '', SESIONES: 2 };
  const { ctx } = servidor([], [], [reg]);
  const r = plano(ctx.registrarResultado(p({ especialidad: 'HIERRO', referencia: 'REG-000004', resultado: 'LO HIZO', fecha: '2026-10-06' })));
  assert.equal(r.tarjeta.COLUMNA, 'EN_TRATAMIENTO');
});

test('hojas sin preparar: registrar y anular se niegan, no escriben y sueltan el candado', () => {
  const hoja = [{ ID: 'SEG-2', FECHA_HORA: '2026-10-02 09:00', DNI: '40111222', ESPECIALIDAD: 'HEMATOLOGÍA', RESULTADO: 'NO CONTESTÓ', ACCION: 'HECHO', REFERENCIA: '' }];
  const cab = cargar(['Logica.gs', 'Registro.gs', 'Resultados.gs', 'Tablero.gs', 'Codigo.gs', 'Menu.gs']).COLUMNAS_SEGUIMIENTOS.slice(0, -2);
  const { ctx, escrito, lock } = servidor(hoja, [], [], cab);
  assert.throws(() => ctx.registrarResultado(p({})), /Falta preparar las hojas: en el Sheets, menú Seguimientos → Preparar hojas\./);
  assert.throws(() => ctx.anularResultado({ usuario: 'MAGALY', id: 'SEG-2', motivo: 'x' }), /Falta preparar las hojas/);
  assert.deepEqual([escrito.SEGUIMIENTOS.length, escrito.anulados.length, escrito.BITACORA.length, lock.tomado], [0, 0, 0, 0]);
});

test('descartar desde una pestaña vieja conserva el motivo original en MOTIVO', () => {
  const { ctx, escrito } = servidor();
  ctx.descartar(p({ motivo: 'NÚMERO EQUIVOCADO' }));
  const s = escrito.SEGUIMIENTOS[0];
  assert.deepEqual([s.RESULTADO, s.ACCION, s.MOTIVO], ['NO DESEA CONTINUAR', 'DESCARTADO', 'NÚMERO EQUIVOCADO']);
  const o = servidor();
  o.ctx.descartar(p({ motivo: '' }));
  assert.equal(o.escrito.SEGUIMIENTOS[0].MOTIVO, 'OTRO');
});

test('un campo motivo del payload nuevo no cambia MOTIVO de un resultado normal', () => {
  const { ctx, escrito } = servidor();
  ctx.registrarResultado(p({ resultado: 'NO DESEA CONTINUAR', motivo: 'COSTO' }));
  assert.equal(escrito.SEGUIMIENTOS[0].MOTIVO, 'NO DESEA CONTINUAR');
});

test('bootstrap: reglas con las siete claves y metaDiaria 15; getPaciente trae telefonos', () => {
  const { ctx } = servidor();
  const b = plano(ctx.bootstrap());
  assert.deepEqual(Object.keys(b.reglas).sort(), ['diasEntreSesiones', 'esperaCotizacion', 'espera', 'graciaAgenda', 'maxSeguimientos', 'metaDiaria', 'metaRetorno'].sort());
  assert.equal(b.reglas.metaDiaria, 15);
  assert.deepEqual(plano(ctx.getPaciente('40111222')).telefonos, ['987654321', '912345678']);
});

test('getPaciente: sin consultas, el nombre sale del registro más reciente y, si no hay, de la indicación más reciente', () => {
  const reg = (ID, FECHA, NOMBRE) => ({ ID, FECHA_HORA: FECHA + ' 10:00', FECHA, ASESORA: 'MAGALY', DOCTOR: 'Dra. Karen Matos', NOMBRE, DNI: '45000111',
    CONTACTO: '987000111', TIPO: 'PROCEDIMIENTO', DETALLE: 'SANGRÍA', MARCA: '', SESIONES: 1, ANULADO: '', MOTIVO_ANULACION: '' });
  const { ctx } = servidor([], [], [reg('REG-000002', '2026-09-20', 'ANA LUCÍA PÉREZ ROJAS'), reg('REG-000001', '2026-08-01', 'ANA PEREZ')]);
  const r = plano(ctx.getPaciente('45000111'));
  assert.equal(r.nombre, 'ANA LUCÍA PÉREZ ROJAS');
  assert.equal(r.registros.length, 2);
  // Solo en INDICACIONES: la más reciente.
  const base = ctx.datos_;
  ctx.datos_ = () => {
    const d = base();
    d.indicaciones = d.indicaciones.concat([{ DNI: '45000222', NOMBRE: 'LUIS VIEJO', FECHA: '2026-05-01', TIPO: 'HIERRO', ESTADO: 'COTIZÓ' },
      { DNI: '45000222', NOMBRE: 'LUIS ALBERTO NUEVO', FECHA: '2026-07-01', TIPO: 'HIERRO', ESTADO: 'COTIZÓ' }]);
    return d;
  };
  assert.equal(plano(ctx.getPaciente('45000222')).nombre, 'LUIS ALBERTO NUEVO');
  // Con consultas manda la consulta.
  assert.equal(plano(ctx.getPaciente('40111222')).nombre, plano(ctx.getPaciente('40111222')).citas.slice(-1)[0].NOMBRE);
});
