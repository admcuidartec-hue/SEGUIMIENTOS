// «Agregar teléfono» (11/11/2026): la hoja TELEFONOS en telefonosPorDni, sus reglas y la reapertura de «Sin contacto válido».
// Datos inventados.
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar, plano } = require('./cargar');
const { cita, seg, reglas } = require('./fixtures');
const L = cargar();
const R = Object.assign(reglas(L), { maxSeguimientos: 2 });
const HOY = '2026-11-11';

const tel = (ID, FECHA_HORA, TELEFONO, o) => Object.assign({ ID, FECHA_HORA, DNI: '40111222', TELEFONO, NOTA: '', USUARIO: 'MAGALY', ANULADO: '' }, o);
const res = (fechaHora, resultado, o) => Object.assign(seg({ fecha: fechaHora.slice(0, 10) }), { ID: 'SEG-' + fechaHora + resultado, FECHA_HORA: fechaHora,
  RESULTADO: resultado, ACCION: 'HECHO' }, o);
const equivocado = (fechaHora, t, ultimo) => res(fechaHora, 'NÚMERO EQUIVOCADO', { TELEFONO: t, ACCION: ultimo ? 'DESCARTADO' : 'TELEFONO', MOTIVO: 'NÚMERO EQUIVOCADO' });
const inds = t => t.map(x => ({ DNI: '40111222', TELEFONO: x, FECHA: '2026-06-01', TIPO: 'HIERRO', ESTADO: 'ACEPTÓ' }));

test('telefonosPorDni: los agregados a mano van primero, el más reciente antes; sin anulados ni repetidos', () => {
  const manual = [tel('TEL-000001', '2026-11-05 09:00', '955 111 222'), tel('TEL-000002', '2026-11-10 16:30', '+51 966-333-444'),
    tel('TEL-000003', '2026-11-11 08:00', '977555666', { ANULADO: 'SÍ' }), tel('TEL-000004', '2026-11-09 10:00', '987654321'),
    tel('TEL-000005', '2026-11-11 09:00', '911222333', { DNI: '09997401' })];
  const crm = [{ DNI_PACIENTE: '40111222', TELEFONO: '912000111' }];
  const t = plano(L.telefonosPorDni(inds(['987654321']), crm, [], manual));
  assert.deepEqual(t['40111222'], ['966333444', '987654321', '955111222', '912000111'], 'el repetido queda en su lugar de agregado, una vez');
  assert.deepEqual(t['9997401'], ['911222333'], 'el DNI con normDni');
  // Sin la hoja (antes de «Preparar hojas»), como antes.
  assert.deepEqual(plano(L.telefonosPorDni(inds(['987654321']), crm, []))['40111222'], ['987654321', '912000111']);
  // A igual hora, el de ID mayor primero.
  const empate = plano(L.telefonosPorDni([], [], [], [tel('TEL-000001', '2026-11-10 10:00', '955111222'), tel('TEL-000002', '2026-11-10 10:00', '966333444')]));
  assert.deepEqual(empate['40111222'], ['966333444', '955111222']);
});

test('telefonosPorDni: «Número equivocado» vale para los agregados, comparando fecha y hora', () => {
  const marca = [equivocado('2026-11-10 10:00', '955111222')];
  const antes = [tel('TEL-000001', '2026-11-10 09:59', '955111222')], despues = [tel('TEL-000002', '2026-11-10 10:05', '955111222')];
  assert.deepEqual(plano(L.telefonosPorDni([], [], marca, antes))['40111222'], undefined, 'agregado antes de la marca: fuera');
  assert.deepEqual(plano(L.telefonosPorDni([], [], marca, despues))['40111222'], ['955111222'], 'agregado después, el mismo día: vuelve');
  // Vuelto a agregar, el número vale aunque el CRM lo siga trayendo marcado.
  assert.deepEqual(plano(L.telefonosPorDni([], [{ DNI_PACIENTE: '40111222', TELEFONO: '955111222' }], marca, despues))['40111222'], ['955111222']);
  // Marcado después de agregarlo, sale; y la ficha lo muestra tachado.
  const tarde = [equivocado('2026-11-10 11:00', '955111222')];
  const t = plano(L.telefonosPorDni([], [], tarde, despues));
  assert.equal(t['40111222'], undefined);
  assert.deepEqual(plano(L.telefonosDescartados(L.marcasTelefono(tarde), t))['40111222'], ['955111222']);
});

test('telefonoAgregadoMal: solo un número, con las mismas reglas que el contacto de Registro', () => {
  assert.equal(L.telefonoAgregadoMal(''), 'Escriba el teléfono.');
  assert.equal(L.telefonoAgregadoMal('   '), 'Escriba el teléfono.');
  assert.match(L.telefonoAgregadoMal('@rosa.q'), /^Aquí va solo un número de teléfono \(9 dígitos\); un @usuario se registra como contacto en Registro\.$/);
  assert.match(L.telefonoAgregadoMal('987 abc 321'), /^Aquí va solo un número/);
  assert.equal(L.telefonoAgregadoMal('98765432'), 'El teléfono debe tener 9 dígitos.');
  assert.equal(L.telefonoAgregadoMal('9876543210'), 'El teléfono debe tener 9 dígitos.');
  assert.equal(L.telefonoAgregadoMal({ x: 1 }), 'El teléfono debe ser un texto.');
  for (const ok of ['987654321', '987 654 321', '987-654-321', '+51 987 654 321', '(01) 433-2210', 987654321]) assert.equal(L.telefonoAgregadoMal(ok), '', String(ok));
});

test('dnisConocidos: citas, historial, registros y altas sin anular', () => {
  const k = plano(L.dnisConocidos({ citas: [cita({ fecha: '2026-07-01', dni: '40111222' })], indicaciones: [{ DNI: '41000111' }, { DNI: '' }],
    registros: [{ DNI: '09997401', ANULADO: '' }, { DNI: '42000000', ANULADO: 'SÍ' }], altas: [{ DNI: '43000000', ANULADO: '' }, { DNI: '44000000', ANULADO: 'SI' }] }));
  assert.deepEqual(Object.keys(k).sort(), ['40111222', '41000111', '43000000', '9997401']);
});

test('validarTelefonoAgregado: DNI conocido, número, nota y si ya estaba', () => {
  const ctx = { conocidos: { 40111222: 1, 9997401: 1, 41999000: 1 }, telefonos: { 40111222: ['987654321'] },
    muertos: { 41999000: { fecha: '2026-09-24', quien: 'ANA' } } };
  const v = o => plano(L.validarTelefonoAgregado(Object.assign({ dni: '40111222', telefono: '955 111 222', nota: ' es de la hija ' }, o), ctx));
  assert.deepEqual(v({}), { error: '', fila: { DNI: '40111222', TELEFONO: '955111222', NOTA: 'es de la hija' }, yaEstaba: false });
  assert.equal(v({ telefono: '+51 987-654-321' }).yaEstaba, true, 'el mismo número en otra grafía');
  assert.equal(v({ dni: '' }).error, 'Falta el DNI del paciente.');
  assert.equal(v({ dni: '9997401' }).error, '', 'el DNI que llega de una tarjeta, ya sin su cero, vale');
  assert.equal(v({ dni: '09997401' }).error, '');
  assert.equal(v({ dni: '1234567' }).error, 'El DNI debe tener 8 dígitos (o el carné de extranjería, de 9 a 12 caracteres).');
  assert.equal(v({ dni: '45678901' }).error, 'El DNI 45678901 no está en SOFDOC, en Registro ni en el historial: revise que esté bien escrito.');
  assert.match(v({ dni: '41999000' }).error, /^Este paciente figura como fallecido desde el 24\/09\/2026/);
  assert.equal(v({ telefono: '@rosa' }).error.slice(0, 18), 'Aquí va solo un nú');
  assert.equal(v({ telefono: '9876' }).error, 'El teléfono debe tener 9 dígitos.');
  assert.equal(v({ nota: 'x'.repeat(2001) }).error, 'La nota va hasta 2000 caracteres (tiene 2001).');
  assert.equal(v({ nota: '' }).fila.NOTA, '');
});

test('reevaluación cerrada por «Sin contacto válido»: un teléfono agregado la reabre con «Nuevo contacto»; uno anulado, no', () => {
  const citas = [cita({ fecha: '2026-07-01' })], segs = [res('2026-10-20 10:00', 'SIN CONTACTO', { ACCION: 'DESCARTADO', MOTIVO: 'SIN CONTACTO',
    NOTA: 'Contactos al cerrar: ninguno' })];
  const p = plano(L.armarPacientes(citas, [], segs, R, HOY))[0];
  assert.deepEqual([p.ESTADO, p.CIERRE], ['CERRADO', 'SIN CONTACTO']);
  const manual = [tel('TEL-000001', '2026-11-11 09:30', '955111222')];
  const q = plano(L.armarPacientes(citas, [], segs, R, HOY, [], {}, {}, {}, manual))[0];
  assert.deepEqual([q.ESTADO, q.CIERRE, q.NUEVO_CONTACTO, q.TELEFONOS, q.N_SEGUIMIENTOS], ['VENCIDO', '', '955111222', '955111222', 0]);
  const anulado = plano(L.armarPacientes(citas, [], segs, R, HOY, [], {}, {}, {}, [Object.assign({}, manual[0], { ANULADO: 'SÍ' })]))[0];
  assert.equal(anulado.ESTADO, 'CERRADO');
});

test('«Número equivocado» del último número: un teléfono agregado después lo reabre; el mismo número agregado antes, no', () => {
  const citas = [cita({ fecha: '2026-07-01' })];
  const segs = [equivocado('2026-11-01 10:00', '987654321', true)];
  assert.equal(plano(L.armarPacientes(citas, inds(['987654321']), segs, R, HOY))[0].CIERRE, 'NÚMERO EQUIVOCADO');
  const otro = plano(L.armarPacientes(citas, inds(['987654321']), segs, R, HOY, [], {}, {}, {}, [tel('TEL-000001', '2026-11-11 09:00', '955111222')]))[0];
  assert.deepEqual([otro.ESTADO, otro.NUEVO_CONTACTO, otro.TELEFONOS], ['VENCIDO', '955111222', '955111222']);
  // El mismo número, confirmado con el paciente y agregado después de la marca, vuelve (y la reabre: no estaba al cerrar).
  const mismo = plano(L.armarPacientes(citas, inds(['987654321']), segs, R, HOY, [], {}, {}, {}, [tel('TEL-000001', '2026-11-11 09:00', '987654321')]))[0];
  assert.deepEqual([mismo.ESTADO, mismo.TELEFONOS], ['VENCIDO', '987654321']);
  const viejo = plano(L.armarPacientes(citas, inds(['987654321']), segs, R, HOY, [], {}, {}, {}, [tel('TEL-000001', '2026-10-30 09:00', '987654321')]))[0];
  assert.equal(viejo.CIERRE, 'NÚMERO EQUIVOCADO', 'agregado antes de la marca: sigue fuera');
});

test('hierro del historial cerrado sin contacto: un teléfono agregado lo reabre (pendientesIndicacion)', () => {
  const citas = [cita({ fecha: '2026-07-01' })];
  const cot = [{ DNI: '40111222', TELEFONO: '', FECHA: '2026-09-20', TIPO: 'PROCEDIMIENTO', DETALLE: 'AMO', ESTADO: 'COTIZÓ' }];
  const segs = [res('2026-10-28 10:00', 'SIN CONTACTO', { ACCION: 'DESCARTADO', MOTIVO: 'SIN CONTACTO', NOTA: 'Contactos al cerrar: ninguno', ESPECIALIDAD: 'PROCEDIMIENTO' })];
  assert.equal(plano(L.pendientesIndicacion(citas, cot, segs, R, HOY, []))[0].ESTADO, 'CERRADO');
  const q = plano(L.pendientesIndicacion(citas, cot, segs, R, HOY, [], {}, [tel('TEL-000001', '2026-11-11 09:00', '955111222')]))[0];
  assert.deepEqual([q.ESTADO, q.NUEVO_CONTACTO, q.TELEFONOS], ['PENDIENTE', '955111222', '955111222']);
});

test('Enfermería: el teléfono agregado aparece en la fila del contacto, antes que el del registro', () => {
  const r = { ID: 'REG-000001', FECHA_HORA: '2026-11-01 09:00', FECHA: '2026-11-01', ASESORA: 'MAGALY', DOCTOR: 'Dra. X', NOMBRE: 'ROSA QUISPE', DNI: '40111222',
    CONTACTO: '@rosa.q', TIPO: 'HIERRO', DETALLE: 'HIERRO SACARATO', MARCA: '', SESIONES: '2', ANULADO: '' };
  const s = { ID: 'SES-000001', FECHA_HORA: '2026-11-10 10:00', ID_REGISTRO: 'REG-000001', NUMERO: '1', FECHA: '2026-11-10', ASESORA: 'MAGALY', ANULADO: '' };
  const c = t => plano(L.contactosEnfermeria({ registros: [r], sesiones: [s], enfermeria: [], seguimientos: [], hoy: HOY, reglas: R, telefonos: t, catalogos: {} }))[0];
  assert.deepEqual([c({}).TELEFONOS, c({}).USUARIO], ['', '@rosa.q']);
  const t = plano(L.telefonosPorDni([], [], [], [tel('TEL-000001', '2026-11-11 09:00', '955111222')]));
  assert.equal(c(t).TELEFONOS, '955111222');
});
