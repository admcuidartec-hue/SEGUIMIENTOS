// Pestaña Registro: lógica pura. Datos inventados.
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar, plano } = require('./cargar');
const { cita, seg, reglas } = require('./fixtures');
const L = cargar(['Logica.gs', 'Registro.gs']);

const HOY = '2026-10-05';
const CAT = L.catalogosDesdeFilas(
  ['USUARIOS', 'MOTIVOS_DESCARTE', 'DOCTOR', 'DOCTOR_SOFDOC', 'PROCEDIMIENTOS', 'TRATAMIENTOS', 'MARCAS'],
  [['MAGALY', 'OTRO', 'Dr. Elí Cabanillas', 'Dr. ELÍ FABRIZIO CABANILLAS HUALPA', 'SANGRÍA', 'HIERRO SACARATO', 'HIERRO CARBOXIMALTOSA | FERINJECT'],
   ['ANA', '', 'Dra. Karen Matos – Particular', '', 'AMO', 'HIERRO CARBOXIMALTOSA', 'HIERRO CARBOXIMALTOSA | LIKFER'],
   ['', '', 'Dra. Karen Matos', 'Dra. KAREN DIANA MATOS PEÑA', '', 'HIERRO DERISOMALTOSA', 'HIERRO DERISOMALTOSA | MONOFER']]);
const base = o => Object.assign({ usuario: 'magaly', fecha: '2026-10-04', dni: '40111222', nombre: ' rosa  quispe ',
  contacto: '987 654 321', doctor: 'Dr. Elí Cabanillas', procedimiento: '', tratamiento: '', sesiones: '', marca: '' }, o);

test('catalogosDesdeFilas lee doctores, procedimientos, tratamientos y marcas por tratamiento', () => {
  const c = plano(CAT);
  assert.deepEqual(c.doctores, [
    { doctor: 'Dr. Elí Cabanillas', sofdoc: 'Dr. ELÍ FABRIZIO CABANILLAS HUALPA' },
    { doctor: 'Dra. Karen Matos – Particular', sofdoc: '' },
    { doctor: 'Dra. Karen Matos', sofdoc: 'Dra. KAREN DIANA MATOS PEÑA' }]);
  assert.deepEqual(c.procedimientos, ['SANGRÍA', 'AMO']);
  assert.deepEqual(c.tratamientos, ['HIERRO SACARATO', 'HIERRO CARBOXIMALTOSA', 'HIERRO DERISOMALTOSA']);
  assert.deepEqual(c.marcas, { 'HIERRO CARBOXIMALTOSA': ['FERINJECT', 'LIKFER'], 'HIERRO DERISOMALTOSA': ['MONOFER'] });
});

test('reglas: espera de cotización y días entre sesiones, 7 por omisión', () => {
  const r = L.reglasDesdeFilas(['PARAMETRO', 'VALOR'], [['ESPERA_COTIZACION_DIAS', 10], ['DIAS_ENTRE_SESIONES', 5]]);
  assert.deepEqual([r.esperaCotizacion, r.diasEntreSesiones], [10, 5]);
  const d = L.reglasDesdeFilas([], []);
  assert.deepEqual([d.esperaCotizacion, d.diasEntreSesiones], [7, 7]);
});

test('siguienteId sigue al mayor y respeta el prefijo', () => {
  assert.equal(L.siguienteId([], 'REG'), 'REG-000001');
  assert.equal(L.siguienteId(['REG-000007', 'REG-000002', 'SES-000099', ''], 'REG'), 'REG-000008');
});

test('validarRegistro: procedimiento y tratamiento en un formulario son dos filas limpias', () => {
  const r = plano(L.validarRegistro(base({ procedimiento: 'sangria', tratamiento: 'Hierro Carboximaltosa', sesiones: '3', marca: 'ferinject' }), CAT, HOY));
  assert.equal(r.error, '');
  assert.deepEqual(r.filas, [
    { FECHA: '2026-10-04', ASESORA: 'MAGALY', DOCTOR: 'Dr. Elí Cabanillas', NOMBRE: 'ROSA QUISPE', DNI: '40111222', CONTACTO: '987 654 321',
      MARCA: '', ANULADO: '', MOTIVO_ANULACION: '', TIPO: 'PROCEDIMIENTO', DETALLE: 'SANGRÍA', SESIONES: 1 },
    { FECHA: '2026-10-04', ASESORA: 'MAGALY', DOCTOR: 'Dr. Elí Cabanillas', NOMBRE: 'ROSA QUISPE', DNI: '40111222', CONTACTO: '987 654 321',
      MARCA: 'FERINJECT', ANULADO: '', MOTIVO_ANULACION: '', TIPO: 'HIERRO', DETALLE: 'HIERRO CARBOXIMALTOSA', SESIONES: 3 }]);
});

test('validarRegistro rechaza lo que no se puede guardar', () => {
  const err = o => L.validarRegistro(base(o), CAT, HOY).error;
  assert.match(err({ usuario: 'PEDRO', procedimiento: 'AMO' }), /Elija quién es usted/);
  assert.match(err({ dni: '1234', procedimiento: 'AMO' }), /8 dígitos/);
  assert.match(err({ nombre: ' ', procedimiento: 'AMO' }), /nombre/);
  assert.match(err({ contacto: '', procedimiento: 'AMO' }), /teléfono o usuario/);
  assert.match(err({ fecha: '2026-10-06', procedimiento: 'AMO' }), /futura/);
  assert.match(err({ doctor: 'Dr. Nadie', procedimiento: 'AMO' }), /doctor/);
  assert.match(err({}), /procedimiento, un tratamiento o ambos/);
  assert.match(err({ procedimiento: 'CARIOTIPO' }), /no está en CATALOGOS/);
  assert.match(err({ tratamiento: 'HIERRO SACARATO', sesiones: '0' }), /sesiones/);
  assert.match(err({ tratamiento: 'HIERRO SACARATO', sesiones: '21' }), /sesiones/);
  assert.match(err({ tratamiento: 'HIERRO CARBOXIMALTOSA', sesiones: '2', marca: 'MONOFER' }), /FERINJECT o LIKFER/);
  assert.match(err({ tratamiento: 'HIERRO SACARATO', sesiones: '2', marca: 'FERINJECT' }), /no lleva marca/);
  assert.equal(err({ tratamiento: 'HIERRO SACARATO', sesiones: '12' }), '');
  assert.equal(err({ dni: 'CE00123456', procedimiento: 'AMO' }), '', 'carné de extranjería');
  assert.match(L.validarRegistro(null, CAT, HOY).error, /Faltan los datos/);
});

test('duplicadoReciente: misma indicación del mismo DNI, sin anular, a 7 días o menos', () => {
  const fila = { DNI: '40111222', TIPO: 'HIERRO', DETALLE: 'HIERRO CARBOXIMALTOSA', FECHA: '2026-10-05' };
  const previo = o => Object.assign({ ID: 'REG-000001', DNI: '40111222', TIPO: 'HIERRO', DETALLE: 'HIERRO CARBOXIMALTOSA', FECHA: '2026-09-29', ANULADO: '' }, o);
  assert.equal(L.duplicadoReciente([previo()], fila).ID, 'REG-000001');
  assert.equal(L.duplicadoReciente([previo({ FECHA: '2026-09-27' })], fila), null, '8 días');
  assert.equal(L.duplicadoReciente([previo({ ANULADO: 'SÍ' })], fila), null);
  assert.equal(L.duplicadoReciente([previo({ DETALLE: 'HIERRO SACARATO' })], fila), null);
  assert.equal(L.duplicadoReciente([previo({ DNI: '40222333' })], fila), null);
});

test('textoRegistro y médico del registro', () => {
  assert.equal(L.textoRegistro({ TIPO: 'HIERRO', DETALLE: 'HIERRO CARBOXIMALTOSA', MARCA: 'FERINJECT', SESIONES: 3 }), 'Hierro carboximaltosa · Ferinject × 3 sesiones');
  assert.equal(L.textoRegistro({ TIPO: 'HIERRO', DETALLE: 'HIERRO SACARATO', MARCA: '', SESIONES: '1' }), 'Hierro sacarato × 1 sesión');
  assert.equal(L.textoRegistro({ TIPO: 'PROCEDIMIENTO', DETALLE: 'SANGRÍA', SESIONES: 1 }), 'Sangría');
  assert.equal(L.medicoDeRegistro({ DOCTOR: 'Dr. Elí Cabanillas' }, CAT), 'Dr. ELÍ FABRIZIO CABANILLAS HUALPA');
  assert.equal(L.medicoDeRegistro({ DOCTOR: 'Dra. Karen Matos – Particular' }, CAT), 'Dra. Karen Matos – Particular');
  assert.equal(L.doctorPropuesto(CAT, 'Dra. KAREN DIANA MATOS PEÑA'), 'Dra. Karen Matos', 'no el particular');
  assert.equal(L.doctorPropuesto(CAT, 'Dr. OTRO'), '');
});

const reg = o => Object.assign({ ID: 'REG-000001', FECHA: '2026-09-20', ASESORA: 'MAGALY', DOCTOR: 'Dr. Elí Cabanillas', NOMBRE: 'ROSA QUISPE',
  DNI: '40111222', CONTACTO: '987654321', TIPO: 'HIERRO', DETALLE: 'HIERRO CARBOXIMALTOSA', MARCA: 'FERINJECT', SESIONES: '3', ANULADO: '' }, o);
const ses = (numero, fecha, o) => Object.assign({ ID: 'SES-00000' + numero, ID_REGISTRO: 'REG-000001', NUMERO: String(numero), FECHA: fecha, ANULADO: '' }, o);

test('estadoRegistro: cotizado, en curso, completo y anulado; una sesión anulada no cuenta', () => {
  const e = (r, s) => plano(L.estadoRegistro(r, s));
  assert.deepEqual(e(reg(), []), { estado: 'COTIZADO', hechas: 0, total: 3, ultima: '' });
  assert.deepEqual(e(reg(), [ses(1, '2026-09-25')]), { estado: 'EN CURSO', hechas: 1, total: 3, ultima: '2026-09-25' });
  assert.equal(e(reg(), [ses(1, '2026-09-25'), ses(2, '2026-10-01'), ses(3, '2026-10-04')]).estado, 'COMPLETO');
  assert.equal(e(reg(), [ses(1, '2026-09-25', { ANULADO: 'SÍ' })]).estado, 'COTIZADO');
  assert.equal(e(reg({ ANULADO: 'SÍ' }), []).estado, 'ANULADO');
  assert.equal(e(reg(), [ses(1, '2026-09-25', { ID_REGISTRO: 'REG-000009' })]).hechas, 0, 'sesión de otro registro');
});

test('validarSesion: ni completo, ni anulado, ni antes del registro o de la sesión previa, ni futura', () => {
  const v = (r, s, f) => L.validarSesion(r, s, f, HOY);
  assert.equal(v(reg(), [], '2026-09-20'), '');
  assert.match(v(null, [], HOY), /No encontré/);
  assert.match(v(reg({ ANULADO: 'SÍ' }), [], HOY), /anulado/);
  assert.match(v(reg({ SESIONES: '1' }), [ses(1, '2026-09-25')], HOY), /todas sus sesiones/);
  assert.match(v(reg(), [], '2026-09-19'), /anterior al registro \(20\/09\/2026\)/);
  assert.match(v(reg(), [ses(1, '2026-09-25')], '2026-09-24'), /anterior a la sesión previa \(25\/09\/2026\)/);
  assert.match(v(reg(), [], '2026-10-06'), /futura/);
  assert.match(v(reg(), [], ''), /Falta la fecha/);
});

test('validarAnulacionSesion: solo la última sesión válida de su registro', () => {
  const s = [ses(1, '2026-09-25'), ses(2, '2026-10-01')];
  assert.equal(L.validarAnulacionSesion('SES-000002', s).error, '');
  assert.match(L.validarAnulacionSesion('SES-000001', s).error, /Solo se puede anular la última sesión/);
  assert.match(L.validarAnulacionSesion('SES-000009', s).error, /No encontré/);
  assert.match(L.validarAnulacionSesion('SES-000002', [ses(1, '2026-09-25'), ses(2, '2026-10-01', { ANULADO: 'SÍ' })]).error, /ya estaba anulada/);
});

const CAT2 = L.catalogosDesdeFilas(['USUARIOS', 'DOCTOR', 'DOCTOR_SOFDOC'], [['MAGALY', 'Dr. Elí Cabanillas', 'Dr. ELÍ FABRIZIO CABANILLAS HUALPA']]);
const pend = (registros, sesiones, seguimientos, hoy) => plano(L.pendientesRegistro({
  registros, sesiones: sesiones || [], seguimientos: seguimientos || [], citas: [cita({ fecha: '2026-09-01' })], reglas: reglas(L),
  hoy: hoy || HOY, telefonos: { '40111222': ['987654321'] }, catalogos: CAT2 }));

test('pendientesRegistro: un cotizado entra a los 7 días, con lo que necesita la bandeja', () => {
  assert.equal(pend([reg({ FECHA: '2026-09-29' })])[0].ESTADO, 'EN ESPERA', '6 días');
  const p = pend([reg({ FECHA: '2026-09-28' })])[0];
  assert.equal(p.ESTADO, 'PENDIENTE');
  assert.equal(p.ID_REGISTRO, 'REG-000001');
  assert.equal(p.ESPECIALIDAD, 'HIERRO');
  assert.equal(p.TIPO_SEGUIMIENTO, 'HIERRO');
  assert.equal(p.DETALLE, 'Hierro carboximaltosa · Ferinject × 3 sesiones');
  assert.equal(p.MEDICO_ULTIMO, 'Dr. ELÍ FABRIZIO CABANILLAS HUALPA');
  assert.equal(p.ESPECIALIDAD_CONSULTA, 'HEMATOLOGÍA');
  assert.equal(p.TELEFONOS, '987654321');
  assert.equal(p.USUARIO, '');
  assert.equal(p.DIAS, 7);
  assert.equal(p.ESTADO_REGISTRO, 'COTIZADO');
  assert.equal(p.NOMBRE, 'ROSA ELENA QUISPE HUAMAN', 'el nombre de SOFDOC si lo hay');
});

test('pendientesRegistro: en curso entra a los 7 días de la última sesión; completo y anulado no entran', () => {
  const s = [ses(1, '2026-09-29')];
  assert.equal(pend([reg()], s)[0].ESTADO, 'EN ESPERA');
  const p = pend([reg()], [ses(1, '2026-09-28')])[0];
  assert.deepEqual([p.ESTADO, p.ESTADO_REGISTRO, p.HECHAS, p.SESIONES, p.ULTIMA_SESION, p.DIAS], ['PENDIENTE', 'EN CURSO', 1, 3, '2026-09-28', 7]);
  assert.deepEqual(pend([reg({ SESIONES: '1' })], [ses(1, '2026-09-28')]), []);
  assert.deepEqual(pend([reg({ ANULADO: 'SÍ' })]), []);
});

test('pendientesRegistro: seguimientos por REFERENCIA, contados desde la fecha que corresponde', () => {
  const r = [reg({ FECHA: '2026-09-01' })];
  const sg = (fecha, o) => Object.assign(seg({ fecha, esp: 'HIERRO' }), { REFERENCIA: 'REG-000001' }, o);
  assert.equal(pend(r, [], [sg('2026-10-01')])[0].ESTADO, 'CONTACTADO');
  assert.equal(pend(r, [], [sg('2026-10-01', { REFERENCIA: 'REG-000777' })])[0].ESTADO, 'PENDIENTE', 'de otro registro');
  assert.equal(pend(r, [], [sg('2026-09-10', { ACCION: 'DESCARTADO', MOTIVO: 'OTRO' })])[0].ESTADO, 'DESCARTADO');
  assert.equal(pend(r, [], [sg('2026-09-05'), sg('2026-09-15'), sg('2026-09-20')])[0].ESTADO, 'DESCARTADO', '3 intentos, espera cumplida');
  const p = pend(r, [ses(1, '2026-09-20')], [sg('2026-09-10')])[0];
  assert.deepEqual([p.ESTADO, p.N_SEGUIMIENTOS], ['PENDIENTE', 0], 'tras una sesión los intentos empiezan de cero');
});

test('pendientesRegistro: un usuario que no es teléfono va aparte y pasado el corte queda ANTIGUO', () => {
  const p = pend([reg({ DNI: '40999888', CONTACTO: '@rosa.q', FECHA: '2026-09-01' })])[0];
  assert.deepEqual([p.TELEFONOS, p.USUARIO, p.NOMBRE], ['', '@rosa.q', 'ROSA QUISPE']);
  assert.equal(pend([reg({ FECHA: '2026-03-01' })])[0].ESTADO, 'ANTIGUO');
});

test('validarAccion distingue las filas de registro por su referencia', () => {
  const cat = { usuarios: ['MAGALY'], motivos: ['OTRO'], alias: {} };
  const lista = [{ DNI: '40111222', ESPECIALIDAD: 'HIERRO', ID_REGISTRO: 'REG-000001' }, { DNI: '40111222', ESPECIALIDAD: 'HIERRO' }];
  const v = p => L.validarAccion(Object.assign({ usuario: 'MAGALY', dni: '40111222', especialidad: 'HIERRO' }, p), cat, 'HECHO', lista);
  assert.equal(v({ referencia: 'REG-000001' }), '');
  assert.equal(v({}), '', 'el histórico, sin referencia');
  assert.match(v({ referencia: 'REG-000002' }), /no está en la lista/);
  assert.match(L.validarAccion({ usuario: 'MAGALY', dni: '40111222', especialidad: 'HIERRO' }, cat, 'HECHO', [lista[0]]), /no está en la lista/);
});

test('pendientesIndicacion: el ACEPTÓ de un registro cierra el histórico y sus seguimientos no se mezclan', () => {
  const hist = { ID: 'IND-1', FECHA: '2026-08-01', TIPO: 'HIERRO', DETALLE: 'HIERRO', CANTIDAD: '', MEDICO_SOLICITANTE: '', NOMBRE: 'X',
    TELEFONO: '', ESTADO: 'COTIZÓ', DNI: '40111222', EMPAREJAMIENTO: 'AUTOMÁTICO' };
  const desdeReg = Object.assign({}, hist, { ID: 'REG-000001', FECHA: '2026-09-01', ESTADO: 'ACEPTÓ', ORIGEN: 'REGISTROS' });
  const cotReg = Object.assign({}, hist, { ID: 'REG-000002', FECHA: '2026-09-01', ESTADO: 'COTIZÓ', ORIGEN: 'REGISTROS', DNI: '40222333' });
  const citas = [cita({ fecha: '2026-07-01' })];
  assert.equal(L.pendientesIndicacion(citas, [hist], [], reglas(L), HOY).length, 1);
  assert.equal(L.pendientesIndicacion(citas, [hist, desdeReg], [], reglas(L), HOY).length, 0);
  assert.equal(L.pendientesIndicacion(citas, [cotReg], [], reglas(L), HOY).length, 0, 'lo cotizado en Registro lo lleva pendientesRegistro');
  const conRef = Object.assign(seg({ fecha: '2026-10-01', esp: 'HIERRO' }), { REFERENCIA: 'REG-000001' });
  assert.equal(plano(L.pendientesIndicacion(citas, [hist], [conRef], reglas(L), HOY))[0].N_SEGUIMIENTOS, 0);
});
