// Servidor de «Agregar teléfono» (11/11/2026) con dobles de las hojas: roles, validación, idempotencia, repetidos y la reapertura
// de «Sin contacto válido». Datos inventados.
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar, plano } = require('./cargar');
const { cita, reglas } = require('./fixtures');

const CAT = { usuarios: ['MAGALY', 'ENFERMERA PRUEBA', 'MARKETING'], enfermeria: ['ENFERMERA PRUEBA'], consulta: ['MARKETING'], motivos: [], alias: {},
  doctores: [{ doctor: 'Dra. Karen Matos', sofdoc: 'Dra. KAREN DIANA MATOS PEÑA' }], procedimientos: ['SANGRÍA'], tratamientos: ['HIERRO SACARATO'],
  marcas: {}, reacciones: ['Náuseas'] };
const REG1 = { ID: 'REG-000001', FECHA_HORA: '2026-11-01 09:00', FECHA: '2026-11-01', ASESORA: 'MAGALY', DOCTOR: 'Dra. Karen Matos', NOMBRE: 'ROSA QUISPE',
  DNI: '40111222', CONTACTO: '987654321', TIPO: 'HIERRO', DETALLE: 'HIERRO SACARATO', MARCA: '', SESIONES: '3', ANULADO: '' };
// Jorge solo está en SOFDOC, sin teléfono; su reevaluación se cerró por «Sin contacto válido».
const SIN_CONTACTO = { ID: 'SEG-000001', FECHA_HORA: '2026-11-02 10:00', DNI: '40222333', ESPECIALIDAD: 'HEMATOLOGÍA', RESPONSABLE: 'MAGALY',
  ACCION: 'DESCARTADO', MOTIVO: 'SIN CONTACTO', NOTA: 'Contactos al cerrar: ninguno', REFERENCIA: '', RESULTADO: 'SIN CONTACTO', FECHA_PROXIMA: '',
  TELEFONO: '', ANULADO: '' };

function servidor(hojas) {
  const ctx = cargar(['Logica.gs', 'Registro.gs', 'Resultados.gs', 'Tablero.gs', 'Enfermeria.gs', 'Codigo.gs', 'RegistroServidor.gs',
    'ResultadoServidor.gs', 'EnfermeriaServidor.gs', 'TelefonosServidor.gs']);
  const L = cargar();
  const base = Object.assign({ REGISTROS: [REG1], SEGUIMIENTOS: [SIN_CONTACTO], TELEFONOS: [], BITACORA: [] }, hojas || {});
  const escrito = { TELEFONOS: [], BITACORA: [], anulados: [] };
  const lock = { tomado: 0, veces: 0 };
  const leer = n => (base[n] || []).concat(escrito[n] || []).map(x => Object.assign({}, x));
  const leidas = [];
  ctx.MEMO = {};
  ctx.datos_ = () => { leidas.push('datos'); return ctx.derivar_({ hoy: '2026-11-11', catalogos: CAT, reglas: reglas(L),
    citas: [cita({ fecha: '2026-09-01' }), cita({ fecha: '2026-07-01', dni: '40222333', nombre: 'JORGE MENDOZA' })],
    indicaciones: [], contactos: [], registros: leer('REGISTROS'), sesiones: [], altas: [], enfermeria: [],
    seguimientosTodos: leer('SEGUIMIENTOS'), seguimientos: leer('SEGUIMIENTOS'), telefonosManual: ctx.leerTelefonos_() }); };
  ctx.exigirColumnas_ = n => { assert.equal(lock.tomado, 1, 'revisa la hoja con el candado tomado'); if (hojas && hojas.sinHoja) throw new Error('Falta la hoja "' + n + '". Use el menú Seguimientos → Preparar hojas.'); };
  ctx.bloquear_ = () => { lock.tomado++; lock.veces++; return { releaseLock: () => { lock.tomado--; } }; };
  ctx.SpreadsheetApp = { flush: () => {} };
  ctx.leerTelefonos_ = () => leer('TELEFONOS').map(x => Object.assign(x, { DNI: ctx.normDni(x.DNI), TELEFONO: ctx.normTelefono(x.TELEFONO) }));
  ctx.leerOpcional_ = leer;
  ctx.conOp_ = (n, cols) => cols.concat(['OP']);
  ctx.anexarObjeto_ = (n, cols, o) => { assert.equal(lock.tomado, 1, 'se escribe con el candado tomado'); escrito[n].push(plano(o)); };
  ctx.bitacora_ = (u, a, d, op) => escrito.BITACORA.push({ USUARIO: u, ACCION: a, DETALLE: d, OP: op || '' });
  ctx.fechaHoraTexto_ = () => '2026-11-11 10:30';
  ctx.marcarAnulado_ = (n, id, motivo) => {
    assert.equal(lock.tomado, 1);
    const f = escrito.TELEFONOS.concat(base.TELEFONOS).find(x => x.ID === id);
    if (!f) throw new Error('No encontré ' + id + '.');
    if (ctx.anulado_(f)) throw new Error(id + ' ya estaba anulado.');
    f.ANULADO = 'SÍ'; f.MOTIVO_ANULACION = motivo;
    escrito.anulados.push([n, id, motivo]);
  };
  return { ctx, escrito, lock, leidas };
}

const pedir = o => Object.assign({ usuario: 'MAGALY', dni: '40111222', telefono: '955 111 222', nota: 'es de la hija', op: 'OP-tel-000001' }, o);

test('agregarTelefono: escribe TEL-… con candado, bitácora sin el número completo y devuelve la lista con el agregado primero', () => {
  const { ctx, escrito, lock } = servidor();
  const r = plano(ctx.agregarTelefono(pedir()));
  assert.deepEqual(escrito.TELEFONOS, [{ DNI: '40111222', TELEFONO: '955111222', NOTA: 'es de la hija', ID: 'TEL-000001', FECHA_HORA: '2026-11-11 10:30',
    USUARIO: 'MAGALY', ANULADO: '', MOTIVO_ANULACION: '', OP: 'OP-tel-000001' }]);
  assert.deepEqual([r.ok, r.id, r.telefonos], [true, 'TEL-000001', ['955111222', '987654321']]);
  assert.deepEqual(escrito.BITACORA, [{ USUARIO: 'MAGALY', ACCION: 'AGREGAR TELÉFONO', DETALLE: 'TEL-000001 · DNI 40111222 · …222 · es de la hija', OP: 'OP-tel-000001' }]);
  assert.doesNotMatch(escrito.BITACORA[0].DETALLE, /955111222/);
  assert.deepEqual([lock.tomado, lock.veces], [0, 1]);
  // El siguiente toma el ID siguiente; la enfermera también agrega.
  const e = plano(ctx.agregarTelefono(pedir({ usuario: 'enfermera prueba', telefono: '+51 966 333 444', nota: '', op: 'OP-tel-000002' })));
  assert.deepEqual([e.id, escrito.TELEFONOS[1].USUARIO, e.telefonos], ['TEL-000002', 'ENFERMERA PRUEBA', ['966333444', '955111222', '987654321']]);
});

test('agregarTelefono: solo consulta no puede, y nada se lee ni se escribe; quien no está, «Elija quién es usted»', () => {
  const { ctx, escrito, lock, leidas } = servidor();
  assert.throws(() => ctx.agregarTelefono(pedir({ usuario: 'MARKETING' })), /^Error: Usuario de solo consulta: no puede modificar datos\.$/);
  assert.throws(() => ctx.anularTelefono({ usuario: 'MARKETING', id: 'TEL-000001', motivo: 'x' }), /^Error: Usuario de solo consulta: no puede modificar datos\.$/);
  assert.throws(() => ctx.agregarTelefono(pedir({ usuario: 'NADIE' })), /^Error: Elija quién es usted en el selector de arriba\.$/);
  assert.throws(() => ctx.agregarTelefono(pedir({ usuario: '' })), /Elija quién es usted/);
  assert.deepEqual([escrito.TELEFONOS.length, escrito.BITACORA.length, lock.veces], [0, 0, 0]);
  assert.ok(leidas.length <= 4, 'solo el catálogo');
});

test('agregarTelefono: valida antes de tomar el candado (DNI, número, nota)', () => {
  const { ctx, escrito, lock } = servidor();
  const casos = [[{ dni: '' }, /Falta el DNI del paciente\./], [{ dni: '45678901' }, /no está en SOFDOC, en Registro ni en el historial/],
    [{ dni: '1234567' }, /El DNI debe tener 8 dígitos/], [{ telefono: '' }, /Escriba el teléfono\./], [{ telefono: '@rosa.q' }, /un @usuario se registra/],
    [{ telefono: '98765' }, /El teléfono debe tener 9 dígitos\./], [{ nota: 'x'.repeat(2001) }, /La nota va hasta 2000 caracteres/],
    [{ nota: { a: 1 } }, /La nota debe ser un texto\./]];
  for (const [o, m] of casos) assert.throws(() => ctx.agregarTelefono(pedir(o)), m, JSON.stringify(o).slice(0, 40));
  assert.deepEqual([escrito.TELEFONOS.length, lock.veces], [0, 0]);
  // Un paciente con «Falleció» vigente: como las demás escrituras.
  const m = servidor({ SEGUIMIENTOS: [Object.assign({}, SIN_CONTACTO, { ID: 'SEG-9', DNI: '40111222', RESULTADO: 'FALLECIÓ', MOTIVO: 'FALLECIÓ', NOTA: '' })] });
  assert.throws(() => m.ctx.agregarTelefono(pedir()), /figura como fallecido/);
});

test('agregarTelefono: el mismo op no escribe otra fila; un número ya vigente (de cualquier fuente) tampoco', () => {
  const { ctx, escrito } = servidor();
  const a = plano(ctx.agregarTelefono(pedir()));
  const b = plano(ctx.agregarTelefono(pedir()));
  assert.deepEqual([b.ok, b.repetida, b.id, b.telefonos], [true, true, a.id, ['955111222', '987654321']]);
  assert.equal(escrito.TELEFONOS.length, 1);
  // Otro op con el mismo número (otra grafía): ya estaba.
  const c = plano(ctx.agregarTelefono(pedir({ telefono: '955-111-222', op: 'OP-tel-000003' })));
  assert.deepEqual([c.ok, c.yaEstaba, c.telefonos], [true, true, ['955111222', '987654321']]);
  // El del registro (CONTACTO) también es un teléfono vigente.
  const d = plano(ctx.agregarTelefono(pedir({ telefono: '987654321', op: 'OP-tel-000004' })));
  assert.equal(d.yaEstaba, true);
  assert.deepEqual([escrito.TELEFONOS.length, escrito.BITACORA.length], [1, 1]);
  // Lo escrito entretanto por otra pestaña se ve dentro del candado.
  const x = servidor();
  const original = x.ctx.leerTelefonos_;
  x.ctx.leerTelefonos_ = () => x.lock.tomado ? original().concat([{ ID: 'TEL-000007', FECHA_HORA: '2026-11-11 10:29', DNI: '40111222', TELEFONO: '955111222', ANULADO: '' }]) : original();
  const y = plano(x.ctx.agregarTelefono(pedir()));
  assert.deepEqual([y.yaEstaba, x.escrito.TELEFONOS.length], [true, 0]);
});

test('agregarTelefono sin la hoja TELEFONOS: pide «Preparar hojas» y no escribe nada', () => {
  const { ctx, escrito } = servidor({ sinHoja: true });
  assert.throws(() => ctx.agregarTelefono(pedir()), /Falta la hoja "TELEFONOS"\. Use el menú Seguimientos → Preparar hojas\./);
  assert.deepEqual([escrito.TELEFONOS.length, escrito.BITACORA.length], [0, 0]);
});

test('agregarTelefono reabre la tarjeta cerrada por «Sin contacto válido» y el tablero deja de decir «Sin teléfono»', () => {
  const { ctx } = servidor();
  const antes = plano(ctx.armarTablero(ctx.datos_()));
  assert.deepEqual(antes.cerrados.filter(c => c.DNI === '40222333').map(c => c.CIERRE), ['SIN CONTACTO']);
  const r = plano(ctx.agregarTelefono(pedir({ dni: '40222333', nota: 'WhatsApp' })));
  assert.deepEqual(r.telefonos, ['955111222']);
  const t = plano(ctx.armarTablero(ctx.datos_()));
  const j = ctx.todasLasTarjetas(t).filter(x => x.DNI === '40222333');
  assert.deepEqual(plano(j.map(x => [x.COLUMNA, x.TELEFONOS, x.SIN_CONTACTO, x.ETIQUETA])), [['POR_CONTACTAR', '955111222', false, 'Nuevo contacto: 955111222']]);
  assert.equal(t.cerrados.filter(c => c.DNI === '40222333').length, 0);
  // La ficha lo trae primero, con quién y la nota.
  ctx.leerIndicaciones_ = () => [];
  const p = plano(ctx.getPaciente('40222333'));
  assert.deepEqual(p.telefonos, ['955111222']);
  assert.deepEqual(p.telefonosAgregados.map(x => [x.ID, x.TELEFONO, x.USUARIO, x.NOTA]), [['TEL-000001', '955111222', 'MAGALY', 'WhatsApp']]);
});

test('anularTelefono («Deshacer»): solo TEL-…, con motivo y candado; el número sale y el reintento no vuelve a escribir', () => {
  const { ctx, escrito, lock } = servidor();
  ctx.agregarTelefono(pedir({ dni: '40222333' }));
  assert.throws(() => ctx.anularTelefono({ usuario: 'MAGALY', id: 'SEG-000001', motivo: 'x' }), /Aquí solo se anulan teléfonos agregados \(TEL-…\)\./);
  assert.throws(() => ctx.anularTelefono({ usuario: 'MAGALY', id: 'TEL-000001', motivo: '' }), /Escriba el motivo de la anulación\./);
  const r = plano(ctx.anularTelefono({ usuario: 'ENFERMERA PRUEBA', id: 'TEL-000001', motivo: 'Deshecho al momento', op: 'OP-anular-tel-1' }));
  assert.deepEqual([r.ok, r.telefonos], [true, []]);
  assert.deepEqual(escrito.anulados, [['TELEFONOS', 'TEL-000001', 'Deshecho al momento']]);
  assert.deepEqual(escrito.BITACORA.map(b => [b.ACCION, b.DETALLE]).slice(-1), [['ANULAR TELÉFONO', 'TEL-000001 · Deshecho al momento']]);
  assert.equal(lock.tomado, 0);
  // El reintento con el mismo op (la respuesta se perdió): vale como hecho.
  ctx.leerOpcional_ = n => n === 'BITACORA' ? escrito.BITACORA : [];
  assert.equal(plano(ctx.anularTelefono({ usuario: 'MAGALY', id: 'TEL-000001', motivo: 'Deshecho al momento', op: 'OP-anular-tel-1' })).repetida, true);
  assert.throws(() => ctx.anularTelefono({ usuario: 'MAGALY', id: 'TEL-000001', motivo: 'otra vez', op: 'OP-anular-tel-2' }), /ya estaba anulado/);
  // La tarjeta vuelve a quedar cerrada sin contacto.
  const t = plano(ctx.armarTablero(ctx.datos_()));
  assert.deepEqual(t.cerrados.filter(c => c.DNI === '40222333').map(c => c.CIERRE), ['SIN CONTACTO']);
});

test('«Número equivocado» sobre un teléfono agregado: sale de la lista y, si era el último, la tarjeta queda sin contacto', () => {
  const { ctx } = servidor({ TELEFONOS: [{ ID: 'TEL-000001', FECHA_HORA: '2026-11-03 09:00', DNI: '40222333', TELEFONO: '955111222', NOTA: '', USUARIO: 'MAGALY', ANULADO: '' }],
    SEGUIMIENTOS: [Object.assign({}, SIN_CONTACTO, { ID: 'SEG-000002', FECHA_HORA: '2026-11-05 10:00', RESULTADO: 'NÚMERO EQUIVOCADO', ACCION: 'DESCARTADO',
      MOTIVO: 'NÚMERO EQUIVOCADO', TELEFONO: '955111222', NOTA: '' })] });
  const d = ctx.datos_();
  assert.equal(d.telefonos['40222333'], undefined);
  const t = plano(ctx.armarTablero(d));
  assert.deepEqual(t.cerrados.filter(c => c.DNI === '40222333').map(c => c.CIERRE), ['NÚMERO EQUIVOCADO']);
});
