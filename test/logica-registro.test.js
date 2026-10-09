// Pestaña Registro: lógica pura. Datos inventados.
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar, plano } = require('./cargar');
const { cita, seg, reglas } = require('./fixtures');
const L = cargar(['Logica.gs', 'Registro.gs', 'Resultados.gs', 'Tablero.gs']);

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
    { FECHA: '2026-10-04', ASESORA: 'MAGALY', DOCTOR: 'Dr. Elí Cabanillas', NOMBRE: 'ROSA QUISPE', DNI: '40111222', CONTACTO: '987654321',
      MARCA: '', ANULADO: '', MOTIVO_ANULACION: '', FECHA_INICIO: '', EXAMENES: '', FECHA_RETORNO: '', EDITADO: '', TIPO: 'PROCEDIMIENTO', DETALLE: 'SANGRÍA', SESIONES: 1 },
    { FECHA: '2026-10-04', ASESORA: 'MAGALY', DOCTOR: 'Dr. Elí Cabanillas', NOMBRE: 'ROSA QUISPE', DNI: '40111222', CONTACTO: '987654321',
      MARCA: 'FERINJECT', ANULADO: '', MOTIVO_ANULACION: '', FECHA_INICIO: '', EXAMENES: '', FECHA_RETORNO: '', EDITADO: '', TIPO: 'HIERRO', DETALLE: 'HIERRO CARBOXIMALTOSA', SESIONES: 3 }]);
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
  assert.deepEqual(e(reg(), []), { estado: 'COTIZADO', hechas: 0, total: 3, ultima: '', inicio: '' });
  assert.deepEqual(e(reg(), [ses(1, '2026-09-25')]), { estado: 'EN CURSO', hechas: 1, total: 3, ultima: '2026-09-25', inicio: '' });
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

test('validarSesion: un control no tiene sesiones', () => {
  const c = reg({ TIPO: 'CONTROL', DETALLE: 'CONTROL', SESIONES: '0', FECHA_RETORNO: '2026-10-16' });
  assert.equal(L.validarSesion(c, [], '2026-10-04', HOY), 'Un control no tiene sesiones.');
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

test('pendientesRegistro: en curso es EN TRATAMIENTO hasta los 7 días de la última sesión; completo vuelve como COMPLETADO', () => {
  const s = [ses(1, '2026-09-29')];
  assert.equal(pend([reg()], s)[0].ESTADO, 'EN TRATAMIENTO');
  const p = pend([reg()], [ses(1, '2026-09-26')])[0];
  assert.deepEqual([p.ESTADO, p.ESTADO_REGISTRO, p.HECHAS, p.SESIONES, p.ULTIMA_SESION, p.DIAS, p.ATRASO], ['PENDIENTE', 'EN CURSO', 1, 3, '2026-09-26', 9, 2]);
  const c = pend([reg({ SESIONES: '1' })], [ses(1, '2026-09-28')]);
  assert.deepEqual([c.length, c[0].ESTADO, c[0].ULTIMA_SESION], [1, 'COMPLETADO', '2026-09-28']);
  assert.deepEqual(pend([reg({ ANULADO: 'SÍ' })]), []);
});

test('pendientesRegistro: trae ULTIMA_SESION_ID, la última sesión válida, para «Anular la última»', () => {
  assert.equal(pend([reg()])[0].ULTIMA_SESION_ID, '', 'sin sesiones, vacío');
  assert.equal(pend([reg()], [ses(1, '2026-09-26'), ses(2, '2026-09-29')])[0].ULTIMA_SESION_ID, 'SES-000002');
  assert.equal(pend([reg()], [ses(1, '2026-09-26'), ses(2, '2026-09-29', { ANULADO: 'SÍ' })])[0].ULTIMA_SESION_ID, 'SES-000001', 'la anulada no cuenta');
});

test('pendientesRegistro: seguimientos por REFERENCIA, contados desde la fecha que corresponde', () => {
  const r = [reg({ FECHA: '2026-09-01' })];
  const sg = (fecha, o) => Object.assign(seg({ fecha, esp: 'HIERRO' }), { REFERENCIA: 'REG-000001' }, o);
  assert.equal(pend(r, [], [sg('2026-10-01')])[0].ESTADO, 'AGENDADO');
  assert.equal(pend(r, [], [sg('2026-10-01', { REFERENCIA: 'REG-000777' })])[0].ESTADO, 'PENDIENTE', 'de otro registro');
  assert.equal(pend(r, [], [sg('2026-09-10', { ACCION: 'DESCARTADO', MOTIVO: 'OTRO' })])[0].ESTADO, 'CERRADO');
  assert.equal(pend(r, [], [sg('2026-09-05'), sg('2026-09-15'), sg('2026-09-20')])[0].ESTADO, 'CERRADO', '3 intentos, espera cumplida');
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

test('validarAlta: consultas en esa especialidad, doctor del catálogo, fecha válida y sin alta vigente', () => {
  const citas = [cita({ fecha: '2026-08-01' }), cita({ fecha: '2026-09-10' })];
  const p = o => Object.assign({ usuario: 'magaly', dni: '40111222', especialidad: 'hematologia', doctor: 'Dr. Elí Cabanillas', fecha: '2026-09-10', nota: ' ok ' }, o);
  const v = (o, vig) => plano(L.validarAlta(p(o), CAT, citas, vig || {}, HOY));
  assert.deepEqual(v({}).alta, { FECHA: '2026-09-10', DNI: '40111222', ESPECIALIDAD: 'HEMATOLOGÍA', DOCTOR: 'Dr. Elí Cabanillas',
    REGISTRADO_POR: 'MAGALY', NOTA: 'ok', ANULADO: '', MOTIVO_ANULACION: '', DECISION: 'ALTA', FECHA_RETORNO: '' });
  assert.match(v({ usuario: '' }).error, /Elija quién es usted/);
  assert.match(v({ especialidad: 'REUMATOLOGÍA' }).error, /no tiene consultas realizadas en REUMATOLOGÍA/);
  assert.match(v({ doctor: '' }).error, /doctor que da el alta/);
  assert.match(v({ fecha: '2026-10-06' }).error, /futura/);
  assert.match(v({ fecha: '2026-09-09' }).error, /anterior a la última consulta \(10\/09\/2026\)/);
  assert.match(v({}, { '40111222|HEMATOLOGIA': { FECHA: '2026-09-10' } }).error, /ya tiene un alta vigente/);
});

test('altasVigentes: sin anular y sin consultas posteriores; los descartes «ALTA MÉDICA» también cuentan', () => {
  const citas = [cita({ fecha: '2026-08-01' }), cita({ dni: '40222333', fecha: '2026-08-01' }), cita({ dni: '40222333', fecha: '2026-09-20' })];
  const alta = o => Object.assign({ ID: 'ALT-000001', FECHA: '2026-08-01', DNI: '40111222', ESPECIALIDAD: 'HEMATOLOGÍA', DOCTOR: 'Dr. Elí Cabanillas',
    REGISTRADO_POR: 'MAGALY', ANULADO: '' }, o);
  assert.deepEqual(Object.keys(plano(L.altasVigentes([alta()], [], citas))), ['40111222|HEMATOLOGIA']);
  assert.deepEqual(plano(L.altasVigentes([alta({ ANULADO: 'SÍ' })], [], citas)), {});
  assert.deepEqual(plano(L.altasVigentes([alta({ DNI: '40222333' })], [], citas)), {}, 'volvió después del alta');
  const desc = Object.assign(seg({ fecha: '2026-08-05', accion: 'DESCARTADO', motivo: 'Alta médica' }), {});
  const v = plano(L.altasVigentes([], [desc], citas))['40111222|HEMATOLOGIA'];
  assert.deepEqual([v.FECHA, v.DOCTOR, v.REGISTRADO_POR], ['2026-08-05', '', 'MAGALY']);
  const descHierro = Object.assign(seg({ fecha: '2026-08-05', esp: 'HIERRO', accion: 'DESCARTADO', motivo: 'ALTA MÉDICA' }), {});
  assert.deepEqual(plano(L.altasVigentes([], [descHierro], citas)), {});
});

test('estado ALTA: va antes que DESCARTADO y saca la serie de la bandeja', () => {
  const citas = [cita({ fecha: '2026-06-01' })];
  const vig = L.altasVigentes([{ ID: 'ALT-000001', FECHA: '2026-06-01', DNI: '40111222', ESPECIALIDAD: 'HEMATOLOGÍA', ANULADO: '' }], [], citas);
  const segs = [seg({ fecha: '2026-08-01', accion: 'DESCARTADO', motivo: 'OTRO' })];
  const p = plano(L.armarPacientes(citas, [], segs, reglas(L), HOY, [], vig));
  assert.equal(p[0].ESTADO, 'ALTA');
  assert.deepEqual(plano(L.ordenarBandeja(p)), []);
  assert.equal(plano(L.armarPacientes(citas, [], [], reglas(L), HOY))[0].ESTADO, 'VENCIDO', 'sin altas, como antes');
});

test('indicacionesDeRegistros: cotizado = COTIZÓ, en curso o completo = ACEPTÓ; anulado no cuenta', () => {
  const r = [reg({ ID: 'REG-000001', FECHA: '2026-09-01' }), reg({ ID: 'REG-000002', FECHA: '2026-10-01' }),
    reg({ ID: 'REG-000003', SESIONES: '1', CONTACTO: '@rosa.q', DOCTOR: 'Dra. Karen Matos – Particular' }), reg({ ID: 'REG-000004', ANULADO: 'SÍ' })];
  const s = [ses(1, '2026-09-25', { ID_REGISTRO: 'REG-000003' })];
  const i = plano(L.indicacionesDeRegistros(r, s, CAT, reglas(L), HOY));
  assert.deepEqual(i.map(x => [x.ID, x.ESTADO, x.COMPLETO, x.EN_ESPERA]),
    [['REG-000001', 'COTIZÓ', 'NO', ''], ['REG-000002', 'COTIZÓ', 'NO', 'SÍ'], ['REG-000003', 'ACEPTÓ', 'SÍ', '']]);
  assert.deepEqual([i[0].TIPO, i[0].DETALLE, i[0].CANTIDAD, i[0].MEDICO_SOLICITANTE, i[0].TELEFONO, i[0].ORIGEN, i[0].DNI, i[0].FECHA],
    ['HIERRO', 'HIERRO CARBOXIMALTOSA', 3, 'Dr. ELÍ FABRIZIO CABANILLAS HUALPA', '987654321', 'REGISTROS', '40111222', '2026-09-01']);
  assert.deepEqual([i[2].TELEFONO, i[2].MEDICO_SOLICITANTE], ['', 'Dra. Karen Matos – Particular']);
});

test('kpiIndicaciones: completadas; lo que está en espera no se mide todavía', () => {
  const i = [
    { FECHA: '2026-09-01', TIPO: 'HIERRO', DETALLE: 'HIERRO CARBOXIMALTOSA', MEDICO_SOLICITANTE: 'Dr. A', ESTADO: 'ACEPTÓ', COMPLETO: 'NO' },
    { FECHA: '2026-09-02', TIPO: 'HIERRO', DETALLE: 'HIERRO CARBOXIMALTOSA', MEDICO_SOLICITANTE: 'Dr. A', ESTADO: 'ACEPTÓ', COMPLETO: 'SÍ' },
    { FECHA: '2026-09-03', TIPO: 'HIERRO', DETALLE: 'HIERRO CARBOXIMALTOSA', MEDICO_SOLICITANTE: 'Dr. A', ESTADO: 'COTIZÓ', COMPLETO: 'NO', EN_ESPERA: 'SÍ' }];
  assert.deepEqual(plano(L.kpiIndicaciones(i, [])), [{ MES: '2026-09', TIPO: 'HIERRO', DETALLE: 'HIERRO CARBOXIMALTOSA', GRUPO: 'HIERRO CARBOXIMALTOSA', MEDICO: 'Dr. A',
    INDICADAS: 2, ACEPTADAS: 2, COMPLETADAS: 1 }]);
});

test('cohortes: un alta vigente no cuenta como «no volvió», en la etapa en que se dio', () => {
  const citas = [cita({ dni: '1', fecha: '2026-06-01' }),
    cita({ dni: '2', fecha: '2026-06-01' }), cita({ dni: '2', fecha: '2026-06-20' }), cita({ dni: '3', fecha: '2026-06-02' })];
  const vig = L.altasVigentes([{ FECHA: '2026-06-01', DNI: '1', ESPECIALIDAD: 'HEMATOLOGÍA', ANULADO: '' },
    { FECHA: '2026-06-20', DNI: '2', ESPECIALIDAD: 'HEMATOLOGÍA', ANULADO: '' }], [], citas);
  const k = plano(L.kpiCohortes(citas, reglas(L), HOY, vig));
  assert.deepEqual(k.map(r => [r.ETAPA, r.ELEGIBLES, r.VOLVIERON, r.ALTAS]), [[1, 2, 1, 1], [2, 0, 0, 1]]);
});

test('resumenPorMes: altas aparte y hierro completado', () => {
  const citas = [cita({ dni: '1', fecha: '2026-07-01' }), cita({ dni: '2', fecha: '2026-07-02' })];
  const vig = L.altasVigentes([{ FECHA: '2026-07-01', DNI: '1', ESPECIALIDAD: 'HEMATOLOGÍA', ANULADO: '' }], [], citas);
  const ind = o => Object.assign({ TIPO: 'HIERRO', DETALLE: 'HIERRO CARBOXIMALTOSA', MEDICO_SOLICITANTE: 'Dra. KAREN DIANA MATOS PEÑA' }, o);
  const inds = [ind({ ID: 'R1', FECHA: '2026-07-03', DNI: '1', ESTADO: 'ACEPTÓ', COMPLETO: 'SÍ' }),
    ind({ ID: 'R2', FECHA: '2026-07-04', DNI: '2', ESTADO: 'ACEPTÓ', COMPLETO: 'NO' }),
    ind({ ID: 'R3', FECHA: '2026-07-05', DNI: '3', ESTADO: 'COTIZÓ', COMPLETO: 'NO', EN_ESPERA: 'SÍ' })];
  const jul = plano(L.resumenPorMes(citas, inds, [], reglas(L), HOY, vig)).find(x => x.MES === '2026-07' && x.MEDICO === 'Dra. KAREN DIANA MATOS PEÑA');
  assert.deepEqual([jul.NUEVOS, jul.NUEVOS_NO, jul.NUEVOS_ALTA, jul.HIERRO, jul.HIERRO_NO, jul.HIERRO_COMPLETO], [2, 1, 1, 2, 0, 1]);
});

test('el texto de pendiente de una reevaluación nombra el hierro registrado, no «Ferinject» a ciegas', () => {
  const p = L.pendientesPorDni([{ DNI: '1', TIPO: 'HIERRO', DETALLE: 'HIERRO SACARATO', ESTADO: 'COTIZÓ', FECHA: '2026-09-01', CANTIDAD: 2 }]);
  assert.equal(p['1'][0], 'Hierro sacarato ×2: cotizó y no lo hizo');
});

test('revisarCatalogos: marcas sin su tratamiento, sin doctores y el motivo ALTA MÉDICA', () => {
  assert.deepEqual(plano(L.revisarCatalogos(CAT)), ['✓ Catálogos de Registro: 3 doctores, 2 procedimientos, 3 tratamientos.']);
  const malo = L.catalogosDesdeFilas(['USUARIOS', 'MOTIVOS_DESCARTE', 'TRATAMIENTOS', 'MARCAS'],
    [['MAGALY', 'ALTA MÉDICA', 'HIERRO SACARATO', 'HIERRO OTRO | MARCA X']]);
  assert.deepEqual(plano(L.revisarCatalogos(malo)), [
    '✗ CATALOGOS no tiene doctores (columnas DOCTOR y DOCTOR_SOFDOC). Use «Preparar hojas».',
    '✗ La marca «MARCA X» apunta a «HIERRO OTRO», que no está en TRATAMIENTOS.',
    '✗ «ALTA MÉDICA» sigue en MOTIVOS_DESCARTE: ahora el alta se registra con «Dar de alta». Use «Preparar hojas».']);
});

test('revisión final: un registro aún en su espera no marca «cotizó y no lo hizo» en la reevaluación', () => {
  const p = L.pendientesPorDni([{ DNI: '1', TIPO: 'HIERRO', DETALLE: 'HIERRO SACARATO', ESTADO: 'COTIZÓ', FECHA: '2026-10-04', CANTIDAD: 2, EN_ESPERA: 'SÍ' }]);
  assert.deepEqual(plano(p), {});
});

test('validarRegistro: varios procedimientos dan una fila cada uno; el singular sigue funcionando', () => {
  const cat = Object.assign({}, CAT, { procedimientos: ['SANGRÍA', 'AMO', 'BIOPSIA'] });
  const v = plano(L.validarRegistro(Object.assign(base(), { procedimiento: '', procedimientos: ['amo', 'Biopsia'] }), cat, HOY));
  assert.equal(v.error, '');
  assert.deepEqual(v.filas.map(f => [f.TIPO, f.DETALLE]), [['PROCEDIMIENTO', 'AMO'], ['PROCEDIMIENTO', 'BIOPSIA']]);
  assert.match(L.validarRegistro(Object.assign(base(), { procedimientos: ['XYZ'] }), cat, HOY).error, /«XYZ» no está en CATALOGOS/);
  assert.equal(L.validarRegistro(Object.assign(base(), { procedimientos: ['AMO', 'amo'] }), cat, HOY).filas.length, 1, 'sin repetidos');
});

test('pendientesRegistro: un registro de hierro trae TRATAMIENTO y MARCA en frase; el procedimiento, vacíos', () => {
  const reg = (id, tipo, detalle, marca) => ({ ID: id, FECHA_HORA: '2026-09-25 09:00', FECHA: '2026-09-25', ASESORA: 'MAGALY', DOCTOR: 'Dr. Elí Cabanillas',
    NOMBRE: 'ROSA', DNI: '40111222', TIPO: tipo, CONTACTO: '987654321', DETALLE: detalle, MARCA: marca, SESIONES: 1 });
  const p = pend([reg('REG-000001', 'HIERRO', 'HIERRO CARBOXIMALTOSA', 'FERINJECT'), reg('REG-000002', 'PROCEDIMIENTO', 'SANGRÍA', '')]);
  const h = p.find(x => x.ID_REGISTRO === 'REG-000001'), s = p.find(x => x.ID_REGISTRO === 'REG-000002');
  assert.deepEqual([h.TRATAMIENTO, h.MARCA], ['Hierro carboximaltosa', 'Ferinject']);
  assert.deepEqual([s.TRATAMIENTO, s.MARCA], ['', '']);
});

const CAT3 = { usuarios: ['MAGALY'], doctores: [{ doctor: 'Dra. Karen Matos', sofdoc: 'Dra. KAREN DIANA MATOS PEÑA' }],
  procedimientos: ['SANGRÍA'], tratamientos: ['HIERRO SACARATO'], marcas: {} };
const base3 = o => Object.assign({ usuario: 'MAGALY', dni: '40111222', nombre: 'Rosa Prueba', contacto: '987654321', fecha: '2026-10-09', doctor: 'Dra. Karen Matos' }, o);

test('validarRegistro: control + laboratorio con exámenes y fecha de retorno', () => {
  const v = L.validarRegistro(base3({ tipo: 'CONTROL', examenes: ' hemograma,  ferritina ', fechaRetorno: '2026-10-24' }), CAT3, '2026-10-09');
  assert.equal(v.error, '');
  assert.deepEqual(plano(v.filas).map(f => [f.TIPO, f.DETALLE, f.EXAMENES, f.FECHA_RETORNO, f.SESIONES]),
    [['CONTROL', 'CONTROL', 'hemograma, ferritina', '2026-10-24', 0]]);
  assert.match(L.validarRegistro(base3({ tipo: 'CONTROL', fechaRetorno: '' }), CAT3, '2026-10-09').error, /fecha de retorno/);
  assert.match(L.validarRegistro(base3({ tipo: 'CONTROL', fechaRetorno: '2026-10-09' }), CAT3, '2026-10-09').error, /después de hoy/);
});

test('validarRegistro: la fecha de la primera sesión es opcional, de hoy en adelante', () => {
  const v = L.validarRegistro(base3({ tratamiento: 'HIERRO SACARATO', sesiones: 3, fechaInicio: '2026-10-12' }), CAT3, '2026-10-09');
  assert.equal(plano(v.filas)[0].FECHA_INICIO, '2026-10-12');
  assert.equal(plano(L.validarRegistro(base3({ procedimiento: 'SANGRÍA' }), CAT3, '2026-10-09').filas)[0].FECHA_INICIO, '');
  assert.match(L.validarRegistro(base3({ procedimiento: 'SANGRÍA', fechaInicio: '2026-10-01' }), CAT3, '2026-10-09').error, /no puede ser pasada/);
});

test('estadoRegistro: COTIZADO, PROGRAMADO, EN CURSO y COMPLETO; los antiguos sin fecha de inicio no cambian', () => {
  const r = o => Object.assign({ ID: 'REG-1', FECHA: '2026-10-01', SESIONES: '3', ANULADO: '', FECHA_INICIO: '' }, o);
  const s = n => ({ ID: 'SES-' + n, ID_REGISTRO: 'REG-1', NUMERO: String(n), FECHA: '2026-10-0' + (n + 1), ANULADO: '' });
  assert.equal(L.estadoRegistro(r(), []).estado, 'COTIZADO');
  assert.deepEqual(plano(L.estadoRegistro(r({ FECHA_INICIO: '2026-10-12' }), [])), { estado: 'PROGRAMADO', hechas: 0, total: 3, ultima: '', inicio: '2026-10-12' });
  assert.equal(L.estadoRegistro(r(), [s(1)]).estado, 'EN CURSO', 'un registro antiguo con sesiones sigue EN CURSO');
  assert.equal(L.estadoRegistro(r({ FECHA_INICIO: '2026-10-12' }), [s(1), s(2), s(3)]).estado, 'COMPLETO');
  assert.equal(L.estadoRegistro(r({ TIPO: 'CONTROL', SESIONES: '0', FECHA_RETORNO: '2026-10-24' }), []).estado, 'PROGRAMADO');
});

test('textoRegistro de un control', () => {
  assert.equal(L.textoRegistro({ TIPO: 'CONTROL', DETALLE: 'CONTROL', EXAMENES: 'hemograma' }), 'Control + laboratorio · hemograma');
  assert.equal(L.textoRegistro({ TIPO: 'CONTROL', DETALLE: 'CONTROL', EXAMENES: '' }), 'Control + laboratorio');
});

function dReg(registros, sesiones, citas, hoy, segs) {
  return { registros, sesiones: sesiones || [], citas: citas || [], seguimientos: segs || [], reglas: reglas(L), hoy,
    telefonos: { 40111222: ['987654321'] }, catalogos: CAT3 };
}
const REGH = o => Object.assign({ ID: 'REG-000010', FECHA: '2026-10-01', ASESORA: 'MAGALY', DOCTOR: 'Dra. Karen Matos', NOMBRE: 'ROSA PRUEBA',
  DNI: '40111222', CONTACTO: '987654321', TIPO: 'HIERRO', DETALLE: 'HIERRO SACARATO', MARCA: '', SESIONES: '2', ANULADO: '', FECHA_INICIO: '' }, o);
const SES = (n, f) => ({ ID: 'SES-00000' + n, ID_REGISTRO: 'REG-000010', NUMERO: String(n), FECHA: f, ANULADO: '' });
const filaH = d => plano(L.pendientesRegistro(d))[0];

test('pendientesRegistro: programado → Agendado «Sesión»; pasada la gracia sin sesión → Por contactar «No vino»', () => {
  const r = REGH({ FECHA_INICIO: '2026-10-12' });
  const a = filaH(dReg([r], [], [], '2026-10-10'));
  assert.deepEqual([a.ESTADO, a.AGENDA, a.FECHA_AGENDA], ['AGENDADO', 'SESION', '2026-10-12']);
  assert.equal(filaH(dReg([r], [], [], '2026-10-14')).ESTADO, 'AGENDADO', 'dentro de la gracia de 2 días');
  const f = filaH(dReg([r], [], [], '2026-10-15'));
  assert.deepEqual([f.ESTADO, f.MOTIVO_PENDIENTE], ['PENDIENTE', 'NO VINO']);
});

test('pendientesRegistro: completo → Completado con fecha para reevaluar; a los 30 días → POR REEVALUAR; si volvió → Completado', () => {
  const r = REGH({ FECHA_INICIO: '2026-10-02' }), ses = [SES(1, '2026-10-02'), SES(2, '2026-10-09')];
  const antes = filaH(dReg([r], ses, [], '2026-10-20'));
  assert.deepEqual([antes.ESTADO, antes.FECHA_REEVALUAR], ['COMPLETADO', '2026-11-08']);
  assert.equal(filaH(dReg([r], ses, [], '2026-11-08')).ESTADO, 'POR REEVALUAR');
  const volvio = filaH(dReg([r], ses, [cita({ fecha: '2026-11-05' })], '2026-11-20'));
  assert.deepEqual([volvio.ESTADO, volvio.VOLVIO], ['COMPLETADO', '2026-11-05']);
});

test('pendientesRegistro: «Agendó cita» sobre POR REEVALUAR lo deja en Agendado', () => {
  const r = REGH({ FECHA_INICIO: '2026-10-02' }), ses = [SES(1, '2026-10-02'), SES(2, '2026-10-09')];
  const sg = { ID: 'SEG-1', FECHA_HORA: '2026-11-09 10:00', DNI: '40111222', ESPECIALIDAD: 'HIERRO', RESPONSABLE: 'MAGALY', ACCION: 'HECHO',
    REFERENCIA: 'REG-000010', RESULTADO: 'AGENDÓ CITA', FECHA_PROXIMA: '2026-11-15', ANULADO: '' };
  const f = filaH(dReg([r], ses, [], '2026-11-10', [sg]));
  assert.deepEqual([f.ESTADO, f.AGENDA, f.FECHA_AGENDA], ['AGENDADO', 'CITA', '2026-11-15']);
});

test('pendientesRegistro: control + laboratorio → Agendado; vencido → Por contactar; con consulta → Completado', () => {
  const c = REGH({ TIPO: 'CONTROL', DETALLE: 'CONTROL', SESIONES: '0', EXAMENES: 'hemograma', FECHA_RETORNO: '2026-10-16' });
  const a = filaH(dReg([c], [], [], '2026-10-10'));
  assert.deepEqual([a.ESTADO, a.AGENDA, a.FECHA_AGENDA, a.TIPO_SEGUIMIENTO], ['AGENDADO', 'CONTROL', '2026-10-16', 'CONTROL']);
  const v = filaH(dReg([c], [], [], '2026-10-19'));
  assert.deepEqual([v.ESTADO, v.MOTIVO_PENDIENTE], ['PENDIENTE', 'CONTROL VENCIDO']);
  const ok = filaH(dReg([c], [], [cita({ fecha: '2026-10-15' })], '2026-10-19'));
  assert.deepEqual([ok.ESTADO, ok.VOLVIO], ['COMPLETADO', '2026-10-15']);
});

test('pendientesRegistro: un registro antiguo sin fecha de inicio sigue como hasta hoy', () => {
  const r = REGH();
  assert.equal(filaH(dReg([r], [], [], '2026-10-05')).ESTADO, 'EN ESPERA');
  assert.equal(filaH(dReg([r], [], [], '2026-10-09')).ESTADO, 'PENDIENTE');
  assert.equal(filaH(dReg([r], [SES(1, '2026-10-03')], [], '2026-10-05')).ESTADO, 'EN TRATAMIENTO');
});

test('validarAlta: cuatro decisiones; la nueva reevaluación pide fecha de retorno futura', () => {
  const citas = [cita({ fecha: '2026-10-01' })];
  const p = o => Object.assign({ usuario: 'MAGALY', dni: '40111222', especialidad: 'HEMATOLOGÍA', doctor: 'Dra. Karen Matos', fecha: '2026-10-05' }, o);
  const ok = d => plano(L.validarAlta(p(d), CAT3, citas, {}, '2026-10-09'));
  assert.deepEqual([ok({}).alta.DECISION, ok({}).alta.FECHA_RETORNO], ['ALTA', '']);
  assert.deepEqual([ok({ decision: 'ALTA 6 MESES' }).alta.DECISION, ok({ decision: 'ALTA 6 MESES' }).alta.FECHA_RETORNO], ['ALTA 6 MESES', '2027-04-05']);
  assert.equal(ok({ decision: 'alta 1 año' }).alta.FECHA_RETORNO, '2027-10-05');
  assert.equal(ok({ decision: 'NUEVA REEVALUACION', fechaRetorno: '2026-11-20' }).alta.FECHA_RETORNO, '2026-11-20');
  assert.match(L.validarAlta(p({ decision: 'NUEVA REEVALUACION' }), CAT3, citas, {}, '2026-10-09').error, /fecha de retorno/);
  assert.match(L.validarAlta(p({ decision: 'NUEVA REEVALUACION', fechaRetorno: '2026-10-09' }), CAT3, citas, {}, '2026-10-09').error, /después de hoy/);
  assert.match(L.validarAlta(p({ decision: 'OTRA' }), CAT3, citas, {}, '2026-10-09').error, /Elija la decisión/);
});

test('decisionesDeAlta: ventanas de 6 meses y 1 año, nueva reevaluación, y una consulta posterior las anula', () => {
  const R = reglas(L), citas = [cita({ fecha: '2026-10-01' })];
  const a = (dec, ret) => ({ ID: 'ALT-1', FECHA: '2026-10-05', DNI: '40111222', ESPECIALIDAD: 'HEMATOLOGÍA', DOCTOR: 'Dra. X', DECISION: dec, FECHA_RETORNO: ret, ANULADO: '' });
  const k = '40111222|HEMATOLOGIA';
  let r = plano(L.decisionesDeAlta([a('ALTA 6 MESES', '2027-04-05')], citas, R, '2027-02-01'));
  assert.ok(r.vigentes[k] && !r.retornos[k], 'antes de la ventana: alta vigente');
  r = plano(L.decisionesDeAlta([a('ALTA 6 MESES', '2027-04-05')], citas, R, '2027-03-10'));
  assert.deepEqual([!!r.vigentes[k], r.retornos[k]], [false, { fecha: '2027-04-05', tipo: '6 MESES' }]);
  r = plano(L.decisionesDeAlta([a('NUEVA REEVALUACION', '2026-11-20')], citas, R, '2026-10-09'));
  assert.deepEqual([!!r.vigentes[k], r.retornos[k]], [false, { fecha: '2026-11-20', tipo: 'REEVALUACION' }]);
  r = plano(L.decisionesDeAlta([a('ALTA 6 MESES', '2027-04-05')], citas.concat([cita({ fecha: '2026-12-01' })]), R, '2027-03-10'));
  assert.deepEqual([!!r.vigentes[k], !!r.retornos[k]], [false, false], 'volvió a consulta: la decisión ya se cumplió');
});

test('decisionesDeAlta: 1 AÑO usa su ventana; sin fecha de retorno se trata como alta simple (sin NaN)', () => {
  const R = reglas(L), citas = [cita({ fecha: '2026-10-01' })];
  const a = (dec, ret) => ({ ID: 'ALT-1', FECHA: '2026-10-05', DNI: '40111222', ESPECIALIDAD: 'HEMATOLOGÍA', DOCTOR: 'Dra. X', DECISION: dec, FECHA_RETORNO: ret, ANULADO: '' });
  const k = '40111222|HEMATOLOGIA';
  let r = plano(L.decisionesDeAlta([a('ALTA 1 AÑO', '2027-10-05')], citas, R, '2027-09-10'));
  assert.deepEqual([!!r.vigentes[k], r.retornos[k]], [false, { fecha: '2027-10-05', tipo: '1 AÑO' }]);
  r = plano(L.decisionesDeAlta([a('ALTA 1 AÑO', '2027-10-05')], citas, R, '2027-08-01'));
  assert.ok(r.vigentes[k] && !r.retornos[k]);
  r = plano(L.decisionesDeAlta([a('ALTA 6 MESES', '')], citas, R, '2027-03-10'));
  assert.ok(r.vigentes[k] && !r.retornos[k], 'sin fecha: alta simple');
});

test('validarEdicionRegistro: lo editable, el DNI fijo, sesiones no menos que las hechas, anulado no', () => {
  const r = REGH({ SESIONES: '3' }), ses = [SES(1, '2026-10-02'), SES(2, '2026-10-05')];
  const v = (c, x) => plano(L.validarEdicionRegistro(x || r, c, ses, CAT3, '2026-10-09'));
  assert.deepEqual(v({ sesiones: 4, contacto: '912 000 111' }), { error: '', cambios: { SESIONES: 4, CONTACTO: '912000111' }, antes: { SESIONES: '3', CONTACTO: '987654321' } });
  assert.match(v({ dni: '40999888' }).error, /anule el registro/);
  assert.match(v({ sesiones: 1 }).error, /Ya hizo 2 sesiones/);
  assert.match(v({ doctor: 'Dr. Nadie' }).error, /doctor de la lista/);
  assert.match(v({ asesora: 'X' }).error, /No se puede cambiar/);
  assert.match(v({ nombre: 'otra' }, REGH({ ANULADO: 'SÍ' })).error, /anulado/);
  assert.deepEqual(v({ sesiones: '3' }).cambios, {}, 'igual al actual no es un cambio');
});

test('validarEdicionRegistro: un valor igual al actual no se valida (el formulario manda todos los campos)', () => {
  const ses = [SES(1, '2026-10-02')];
  const v = (r, c) => plano(L.validarEdicionRegistro(r, c, ses, CAT3, '2026-10-09'));
  const trat = REGH({ FECHA_INICIO: '2026-10-02' });
  assert.deepEqual(v(trat, { fechaInicio: '2026-10-02', fecha: '2026-10-01', contacto: '912000111' }),
    { error: '', cambios: { CONTACTO: '912000111' }, antes: { CONTACTO: '987654321' } });
  const ctl = REGH({ TIPO: 'CONTROL', DETALLE: 'CONTROL', SESIONES: 0, EXAMENES: 'HEMOGRAMA', FECHA_RETORNO: '2026-10-05' });
  assert.deepEqual(v(ctl, { fechaRetorno: '2026-10-05', examenes: 'HEMOGRAMA', contacto: '912000111' }).cambios, { CONTACTO: '912000111' });
  assert.match(v(ctl, { fechaRetorno: '2026-10-06' }).error, /después de hoy/);
});

test('contacto: un teléfono se guarda sin espacios ni signos, al registrar y al editar; un usuario queda tal cual', () => {
  assert.equal(L.contactoNormal_(' 987 654-321 '), '987654321');
  assert.equal(L.contactoNormal_('+51 (987) 654.321'), '+51987654321');
  assert.equal(L.contactoNormal_('  @rosa.q  '), '@rosa.q');
  assert.equal(L.validarRegistro(base({ contacto: '987 654 321', procedimiento: 'AMO' }), CAT, HOY).filas[0].CONTACTO, '987654321');
  const v = c => plano(L.validarEdicionRegistro(REGH(), c, [], CAT3, '2026-10-09'));
  assert.deepEqual(v({ contacto: '987 654 321' }).cambios, {}, 'el mismo número con espacios no es un cambio');
  assert.deepEqual(v({ contacto: '912 000-111' }).cambios, { CONTACTO: '912000111' });
  assert.deepEqual(v({ contacto: '@rosa.q' }).cambios, { CONTACTO: '@rosa.q' });
  assert.match(v({ contacto: '  ' }).error, /teléfono o usuario/);
});

test('validarEdicionRegistro: al cambiar el tratamiento sin enviar la marca, la marca se revalida', () => {
  const cat = Object.assign({}, CAT3, { tratamientos: ['HIERRO SACARATO', 'HIERRO CARBOXIMALTOSA'], marcas: { 'HIERRO CARBOXIMALTOSA': ['FERINJECT', 'MONOFER'] } });
  const v = (r, c) => plano(L.validarEdicionRegistro(r, c, [], cat, '2026-10-09'));
  assert.match(v(REGH(), { detalle: 'HIERRO CARBOXIMALTOSA' }).error, /Elija la marca/);
  assert.deepEqual(v(REGH({ DETALLE: 'HIERRO CARBOXIMALTOSA', MARCA: 'FERINJECT' }), { detalle: 'HIERRO SACARATO' }).cambios, { DETALLE: 'HIERRO SACARATO', MARCA: '' });
  assert.deepEqual(v(REGH(), { detalle: 'HIERRO CARBOXIMALTOSA', marca: 'monofer' }).cambios, { DETALLE: 'HIERRO CARBOXIMALTOSA', MARCA: 'MONOFER' });
});

// Ronda final de la Etapa 2.
const KAREN = 'Dra. KAREN DIANA MATOS PEÑA', HANAMPA = 'Dr. JUVENAL HANAMPA ROQUE';
const CTL = o => REGH(Object.assign({ TIPO: 'CONTROL', DETALLE: 'CONTROL', SESIONES: '0', EXAMENES: 'hemograma', FECHA_RETORNO: '2026-10-16' }, o));

test('pendientesRegistro: un control vuelve solo con una consulta POSTERIOR al registro y en la especialidad de su doctor', () => {
  const previa = cita({ fecha: '2026-09-30', medico: KAREN });
  const mismoDia = filaH(dReg([CTL()], [], [previa, cita({ fecha: '2026-10-01', medico: KAREN })], '2026-10-10'));
  assert.deepEqual([mismoDia.ESTADO, mismoDia.AGENDA, mismoDia.VOLVIO], ['AGENDADO', 'CONTROL', ''], 'la consulta del mismo día no es la vuelta');
  const volvio = filaH(dReg([CTL()], [], [previa, cita({ fecha: '2026-10-20', medico: KAREN })], '2026-10-25'));
  assert.deepEqual([volvio.ESTADO, volvio.VOLVIO], ['COMPLETADO', '2026-10-20']);
  const otra = filaH(dReg([CTL()], [], [previa, cita({ fecha: '2026-10-20', esp: 'REUMATOLOGÍA', medico: HANAMPA })], '2026-10-25'));
  assert.deepEqual([otra.ESTADO, otra.MOTIVO_PENDIENTE], ['PENDIENTE', 'CONTROL VENCIDO'], 'otra especialidad no cierra el control');
  const sinDoc = filaH(dReg([CTL({ DOCTOR: 'Dr. Desconocido' })], [], [cita({ fecha: '2026-10-20', esp: 'REUMATOLOGÍA', medico: HANAMPA })], '2026-10-25'));
  assert.deepEqual([sinDoc.ESTADO, sinDoc.VOLVIO], ['COMPLETADO', '2026-10-20'], 'si no se sabe la especialidad, cualquiera vale');
});

test('pendientesRegistro: sin teléfonos conocidos del DNI, el CONTACTO del registro es su teléfono (salvo que esté marcado)', () => {
  const d = Object.assign(dReg([CTL({ DNI: '40999111', CONTACTO: '912000333' })], [], [], '2026-10-19'), { telefonos: {} });
  const f = filaH(d);
  assert.deepEqual([f.ESTADO, f.TELEFONOS], ['PENDIENTE', '912000333']);
  const tab = plano(L.armarTablero({ reglas: d.reglas, hoy: d.hoy, pacientes: [], pendientes: [f], citas: [], seguimientos: [], telefonos: {} }));
  assert.equal(tab.columnas.POR_CONTACTAR[0].SIN_CONTACTO, false);
  const marca = { ID: 'SEG-9', FECHA_HORA: '2026-10-18 10:00', DNI: '40999111', ESPECIALIDAD: 'CONTROL', RESPONSABLE: 'MAGALY', ACCION: 'TELEFONO',
    REFERENCIA: 'REG-000010', RESULTADO: 'NÚMERO EQUIVOCADO', TELEFONO: '912000333', ANULADO: '' };
  const m = filaH(Object.assign(d, { seguimientos: [marca] }));
  assert.deepEqual([m.ESTADO, m.CIERRE, m.TELEFONOS], ['CERRADO', 'NÚMERO EQUIVOCADO', ''], 'un número marcado no vuelve por el CONTACTO');
});

test('pendientesRegistro: un completo cuya fecha de reevaluar pasó hace más de CORTE_INDICACIONES_DIAS es ANTIGUO', () => {
  const r = REGH({ FECHA: '2026-01-02', FECHA_INICIO: '2026-01-05' }), ses = [SES(1, '2026-01-05'), SES(2, '2026-01-12')];
  // Reevaluar el 11/02/2026; el corte es de 180 días.
  assert.equal(filaH(dReg([r], ses, [], '2026-08-10')).ESTADO, 'POR REEVALUAR', '180 días: todavía');
  assert.equal(filaH(dReg([r], ses, [], '2026-08-11')).ESTADO, 'ANTIGUO', '181 días: fuera del tablero');
});

/* ---------- Marcar la sesión y agendar la siguiente en un paso ---------- */
const SESH = (n, f, hora, o) => Object.assign({ ID: 'SES-00000' + n, FECHA_HORA: hora || f + ' 12:00', ID_REGISTRO: 'REG-000010', NUMERO: String(n), FECHA: f,
  ASESORA: 'MAGALY', NOTA: '', ANULADO: '' }, o);
const AGENDA_SES = (hora, proxima, o) => Object.assign({ ID: 'SEG-' + hora.replace(/\D/g, ''), FECHA_HORA: hora, DNI: '40111222', ESPECIALIDAD: 'HIERRO',
  RESPONSABLE: 'MAGALY', ACCION: 'HECHO', MOTIVO: '', NOTA: '', REFERENCIA: 'REG-000010', RESULTADO: 'AGENDÓ CITA', FECHA_PROXIMA: proxima,
  TELEFONO: '', ANULADO: '' }, o);
const R3 = () => REGH({ SESIONES: '3' });
const etqAgendado = f => L.etiquetaDe(Object.assign({}, f, { COLUMNA: 'AGENDADO' }), reglas(L), f.hoy);

test('validarProximaSesion: después de la sesión, hasta 180 días, y nunca tras la última', () => {
  const e = L.estadoRegistro(R3(), [SESH(1, '2026-10-02')]);
  assert.equal(L.validarProximaSesion(e, '2026-10-09', '2026-10-16'), '');
  assert.equal(L.validarProximaSesion(e, '2026-10-09', 'mañana'), 'La fecha de la próxima sesión no es válida.');
  assert.equal(L.validarProximaSesion(e, '2026-10-09', '2026-10-09'), 'La próxima sesión debe ser después de la sesión que marca (09/10/2026).');
  assert.equal(L.validarProximaSesion(e, '2026-10-09', '2026-10-01'), 'La próxima sesión debe ser después de la sesión que marca (09/10/2026).');
  assert.equal(L.validarProximaSesion(e, '2026-10-09', '2027-04-08'), 'La próxima sesión va hasta 180 días después de la sesión.');
  assert.equal(L.validarProximaSesion(e, '2026-10-09', '2027-04-07'), '', '180 días justos');
  const penultima = L.estadoRegistro(R3(), [SESH(1, '2026-10-02'), SESH(2, '2026-10-05')]);
  assert.equal(L.validarProximaSesion(penultima, '2026-10-09', '2026-10-16'), 'Es la última sesión del tratamiento: no hay una próxima que agendar.');
});

test('filaProximaSesion: la misma fila que «Agendó cita» sobre un registro en curso, ligada a su sesión', () => {
  const f = plano(L.filaProximaSesion(R3(), { ID: 'SES-000007', NUMERO: 1 }, '2026-10-16', 'MAGALY'));
  assert.deepEqual(f, { DNI: '40111222', ESPECIALIDAD: 'HIERRO', RESPONSABLE: 'MAGALY', MOTIVO: '', NOTA: 'Agendada al marcar la sesión 1 (SES-000007)',
    REFERENCIA: 'REG-000010', RESULTADO: 'AGENDÓ CITA', FECHA_PROXIMA: '2026-10-16', TELEFONO: '', ANULADO: '', MOTIVO_ANULACION: '' });
  assert.equal(L.sesionLigada(f), 'SES-000007');
  assert.equal(L.sesionLigada({ RESULTADO: 'NO CONTESTÓ', NOTA: 'SES-000007' }), '', 'solo un «Agendó cita» se liga a una sesión');
  assert.equal(L.sesionLigada({ RESULTADO: 'AGENDÓ CITA', NOTA: '' }), '');
});

test('pendientesRegistro: sesión marcada con la próxima agendada → Agendado «Sesión 2 el …»; al marcar la 2, sale de Agendado', () => {
  const ses1 = SESH(1, '2026-10-09', '2026-10-09 10:30');
  const ag = AGENDA_SES('2026-10-09 10:30', '2026-10-16', { NOTA: 'Agendada al marcar la sesión 1 (SES-000001)' });
  const a = filaH(dReg([R3()], [ses1], [], '2026-10-09', [ag]));
  assert.deepEqual([a.ESTADO, a.ESTADO_REGISTRO, a.AGENDA, a.FECHA_AGENDA, a.HECHAS], ['AGENDADO', 'EN CURSO', 'SESION', '2026-10-16', 1]);
  assert.equal(etqAgendado(Object.assign(a, { hoy: '2026-10-09' })), 'Sesión 2 el vie 16/10');
  // Vino el 16 y se marca la sesión 2: deja Agendado y vuelve a En tratamiento con la próxima estimada.
  const ses2 = SESH(2, '2026-10-16', '2026-10-16 11:00');
  const b = filaH(dReg([R3()], [ses1, ses2], [], '2026-10-16', [ag]));
  assert.deepEqual([b.ESTADO, b.AGENDA, b.HECHAS], ['EN TRATAMIENTO', '', 2]);
  // La última sesión lo completa.
  const c = filaH(dReg([R3()], [ses1, ses2, SESH(3, '2026-10-20', '2026-10-20 09:00')], [], '2026-10-20', [ag]));
  assert.deepEqual([c.ESTADO, c.ESTADO_REGISTRO, c.AGENDA], ['COMPLETADO', 'COMPLETO', '']);
});

test('pendientesRegistro: un «Agendó cita» del mismo día deja de valer cuando se registra después la sesión agendada', () => {
  // A las 9 agendó la sesión 2 para hoy; a las 15 vino y se marcó con fecha de hoy. Antes, la fecha sola lo dejaba en Agendado.
  const ses1 = SESH(1, '2026-10-02', '2026-10-02 10:00');
  const ag = AGENDA_SES('2026-10-09 09:00', '2026-10-09');
  assert.equal(filaH(dReg([R3()], [ses1], [], '2026-10-09', [ag])).AGENDA, 'SESION', 'antes de marcarla, agendada');
  const b = filaH(dReg([R3()], [ses1, SESH(2, '2026-10-09', '2026-10-09 15:00')], [], '2026-10-09', [ag]));
  assert.deepEqual([b.ESTADO, b.AGENDA, b.HECHAS], ['EN TRATAMIENTO', '', 2]);
  // Marcada en el mismo minuto que se agendó: la liga con su sesión la deja fuera igual.
  const ligada = AGENDA_SES('2026-10-09 10:30', '2026-10-16', { NOTA: 'Agendada al marcar la sesión 1 (SES-000001)' });
  const c = filaH(dReg([R3()], [SESH(1, '2026-10-09', '2026-10-09 10:30'), SESH(2, '2026-10-09', '2026-10-09 10:30')], [], '2026-10-09', [ligada]));
  assert.deepEqual([c.ESTADO, c.AGENDA], ['EN TRATAMIENTO', '']);
});

test('pendientesRegistro: la próxima agendada al marcar una sesión anulada no cuenta (Deshacer no deja una agenda mentirosa)', () => {
  const ag = AGENDA_SES('2026-10-09 10:30', '2026-10-16', { NOTA: 'Agendada al marcar la sesión 2 (SES-000002)' });
  const s1 = SESH(1, '2026-10-05', '2026-10-05 10:00'), s2 = SESH(2, '2026-10-09', '2026-10-09 10:30', { ANULADO: 'SÍ' });
  const f = filaH(dReg([R3()], [s1, s2], [], '2026-10-09', [ag]));
  assert.deepEqual([f.ESTADO, f.AGENDA, f.HECHAS], ['EN TRATAMIENTO', '', 1]);
  // Sin sesiones válidas (se anuló la primera) tampoco: el registro programado vuelve a su «Sesión 1».
  const ag1 = AGENDA_SES('2026-10-09 10:30', '2026-10-16', { NOTA: 'Agendada al marcar la sesión 1 (SES-000001)' });
  const p = filaH(dReg([REGH({ SESIONES: '3', FECHA_INICIO: '2026-10-09' })], [SESH(1, '2026-10-09', '2026-10-09 10:30', { ANULADO: 'SÍ' })], [], '2026-10-09', [ag1]));
  assert.deepEqual([p.ESTADO, p.ESTADO_REGISTRO, p.AGENDA, p.FECHA_AGENDA], ['AGENDADO', 'PROGRAMADO', 'SESION', '2026-10-09']);
});

test('pendientesRegistro: si pasa la fecha agendada sin marcar la sesión, vuelve a Por contactar «No vino a su sesión 2»', () => {
  const ses1 = SESH(1, '2026-10-09', '2026-10-09 10:30');
  const ag = AGENDA_SES('2026-10-09 10:30', '2026-10-12', { NOTA: 'Agendada al marcar la sesión 1 (SES-000001)' });
  assert.equal(filaH(dReg([R3()], [ses1], [], '2026-10-14', [ag])).ESTADO, 'AGENDADO', 'dentro de la gracia de 2 días');
  const f = filaH(dReg([R3()], [ses1], [], '2026-10-15', [ag]));
  assert.deepEqual([f.ESTADO, f.MOTIVO_PENDIENTE, f.FECHA_FALTA, f.DIAS, f.ATRASO], ['PENDIENTE', 'NO VINO', '2026-10-12', 3, 0]);
  assert.equal(L.etiquetaDe(Object.assign({}, f, { COLUMNA: 'POR_CONTACTAR' }), reglas(L), '2026-10-15'), 'No vino a su sesión 2 (12/10)');
  // El programado que no vino sigue diciendo su primera sesión.
  const p = filaH(dReg([REGH({ FECHA_INICIO: '2026-10-12' })], [], [], '2026-10-15'));
  assert.equal(L.etiquetaDe(Object.assign({}, p, { COLUMNA: 'POR_CONTACTAR' }), reglas(L), '2026-10-15'), 'No vino a su sesión 1 (12/10)');
});
