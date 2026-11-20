// «Descargar pacientes que no regresaron» (Indicadores, 20/11/2026): filasNoRegresaron. Datos inventados.
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar, plano } = require('./cargar');
const { cita, seg, reglas } = require('./fixtures');
const L = cargar();

const fila = o => Object.assign({ DNI: '40111222', ESPECIALIDAD: 'HEMATOLOGÍA', NOMBRE: 'ROSA PRUEBA QUISPE', TELEFONOS: '', MEDICO_ULTIMO: 'Dra. KAREN DIANA MATOS PEÑA',
  PRIMERA_CITA: '2026-05-04', ULTIMA_CITA: '2026-07-01', N_REALIZADAS: 1, PROXIMA_ESPERADA: '2026-07-31', VENCE: '2026-08-15', DIAS_ATRASO: 20,
  PROXIMA_AGENDADA: '', ESTADO: 'VENCIDO', N_SEGUIMIENTOS: 0, ULTIMO_SEGUIMIENTO: '', PENDIENTE: '', CIERRE: '', FECHA_CIERRE: '' }, o);

test('filasNoRegresaron: solo VENCIDO, ANTIGUO y CERRADO; lo demás no es «no regresó»', () => {
  const estados = ['VENCIDO', 'ANTIGUO', 'CERRADO', 'AL DÍA', 'POR VENCER', 'AGENDADO', 'PAGO REALIZADO', 'RECUPERADO', 'ALTA', 'FALLECIDO',
    'SIN ATENCIÓN', 'vencido', ''];
  const filas = plano(L.filasNoRegresaron(estados.map((ESTADO, i) => fila({ DNI: String(40000000 + i), ESTADO, CIERRE: ESTADO === 'CERRADO' ? 'SIN CONTACTO' : '' })), {}));
  assert.deepEqual(filas.map(f => f.ESTADO).sort(), ['ANTIGUO', 'CERRADO', 'VENCIDO']);
  // Un CERRADO por «Falleció» (fila vieja) tampoco: no se le escribe a un paciente fallecido.
  assert.deepEqual(plano(L.filasNoRegresaron([fila({ ESTADO: 'CERRADO', CIERRE: 'FALLECIÓ' })], {})), []);
  assert.deepEqual(plano(L.filasNoRegresaron(undefined, undefined)), []);
});

test('filasNoRegresaron: grupo por consultas, columnas, cierre solo en los cerrados y lo más reciente primero', () => {
  const tel = { '40111222': ['987654321', '912345678'] };
  const filas = plano(L.filasNoRegresaron([
    fila({ DNI: '040111222', N_REALIZADAS: 1, ULTIMA_CITA: '2026-07-01', CIERRE: 'basura' }),
    fila({ DNI: '41000111', NOMBRE: 'ANA PRUEBA DÍAZ', N_REALIZADAS: 3, ULTIMA_CITA: '2026-08-10', ESTADO: 'ANTIGUO', DIAS_ATRASO: 'x' }),
    fila({ DNI: '42000111', NOMBRE: 'LUIS PRUEBA VEGA', N_REALIZADAS: 2, ULTIMA_CITA: '2026-08-10', ESTADO: 'CERRADO', CIERRE: 'SE ATIENDE EN OTRO LUGAR',
      FECHA_CIERRE: '2026-09-20', N_SEGUIMIENTOS: 2, ULTIMO_SEGUIMIENTO: '2026-09-20 10:15' })
  ], tel));
  assert.deepEqual(filas.map(f => [f.DNI, f.GRUPO]), [['41000111', 'VARIAS'], ['42000111', 'VARIAS'], ['40111222', 'UNA']],
    'por última consulta (más reciente primero) y, a igual fecha, por nombre');
  assert.deepEqual(Object.keys(filas[0]), ['DNI', 'NOMBRE', 'ESPECIALIDAD', 'MEDICO_ULTIMO', 'PRIMERA_CITA', 'ULTIMA_CITA', 'N_REALIZADAS', 'GRUPO',
    'PROXIMA_ESPERADA', 'DIAS_ATRASO', 'ESTADO', 'CIERRE', 'FECHA_CIERRE', 'N_SEGUIMIENTOS', 'ULTIMO_SEGUIMIENTO', 'TELEFONOS']);
  assert.equal(filas[0].DIAS_ATRASO, 0, 'nunca NaN');
  assert.deepEqual([filas[1].CIERRE, filas[1].FECHA_CIERRE, filas[1].ULTIMO_SEGUIMIENTO], ['SE ATIENDE EN OTRO LUGAR', '2026-09-20', '2026-09-20']);
  assert.deepEqual([filas[2].CIERRE, filas[2].FECHA_CIERRE], ['', ''], 'un vencido no lleva motivo de cierre');
  assert.equal(filas[2].TELEFONOS, '987654321 / 912345678', 'los del DNI (normDni), unidos con « / »');
  assert.equal(filas[1].TELEFONOS, '');
});

test('filasNoRegresaron con armarPacientes y telefonosPorDni: el número equivocado no sale y el agregado a mano va primero', () => {
  const R = reglas(L), HOY = '2026-11-20';
  const citas = [cita({ fecha: '2026-08-01' }), cita({ fecha: '2026-09-01' }),   // 40111222: dos consultas, vencida
    cita({ dni: '41000111', nombre: 'ANA PRUEBA DÍAZ', fecha: '2026-01-10' }),       // una sola, hace más de 180 días: ANTIGUO
    cita({ dni: '42000111', nombre: 'LUIS PRUEBA VEGA', fecha: '2026-11-01' })];     // al día: fuera
  const inds = [{ DNI: '40111222', TELEFONO: '987654321', FECHA: '2026-06-01', TIPO: 'HIERRO', ESTADO: 'ACEPTÓ' },
    { DNI: '40111222', TELEFONO: '912345678', FECHA: '2026-06-01', TIPO: 'HIERRO', ESTADO: 'ACEPTÓ' }];
  const segs = [Object.assign(seg({ fecha: '2026-10-20' }), { RESULTADO: 'NÚMERO EQUIVOCADO', ACCION: 'TELEFONO', MOTIVO: 'NÚMERO EQUIVOCADO', TELEFONO: '912345678' })];
  const manual = [{ ID: 'TEL-000001', FECHA_HORA: '2026-11-02 09:00', DNI: '40111222', TELEFONO: '955111222', ANULADO: '' }];
  const telefonos = L.telefonosPorDni(inds, [], segs, manual);
  const pac = L.armarPacientes(citas, inds, segs, R, HOY, [], {}, {}, {}, manual);
  const filas = plano(L.filasNoRegresaron(pac, telefonos));
  assert.deepEqual(filas.map(f => [f.DNI, f.ESTADO, f.GRUPO, f.N_REALIZADAS]), [['40111222', 'VENCIDO', 'VARIAS', 2], ['41000111', 'ANTIGUO', 'UNA', 1]]);
  assert.equal(filas[0].TELEFONOS, '955111222 / 987654321', 'sin el equivocado; el agregado a mano primero, como en el tablero');
  assert.deepEqual([filas[0].PRIMERA_CITA, filas[0].ULTIMA_CITA, filas[0].PROXIMA_ESPERADA], ['2026-08-01', '2026-09-01', '2026-10-01']);
  assert.ok(filas[0].DIAS_ATRASO > 0);
});
