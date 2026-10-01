// test/logica-citas.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar, plano } = require('./cargar');
const L = cargar();

const ENC = ['FECHA DE REGISTRO', 'IDCITA', 'ESTADO DE CITA', 'FECHA DE ATENCION | HORA', 'CANAL DE ATENCIÓN',
  'CAMPAÑA', 'CONVENIO', 'MODALDIAD', 'PACIENTE', 'PRECIO DE CITA', 'MOVILIDAD', 'DESCUENTO DE CITA',
  'PAGO REALIZADO', 'PAGO RESTANTE', 'ESTADO DE PAGO', 'DNI DEL PACIENTE', 'TIPO PACIENTE',
  'ESPECIALIDAD MEDICA', 'MEDICO', 'MARCA', 'REGISTRADO POR'];

function fila(o) {
  return [o.reg || '2026-09-01 10:00', o.id, o.estado || 'Realizado', o.fecha, 'Canal Digital', '00_NINGUNO',
    '00_Ninguno', 'CLÍNICA', o.nombre || 'ROSA ELENA QUISPE HUAMAN', 200, 0, 0, 200, 0, 'PAGO COMPLETO',
    o.dni === undefined ? '40111222' : o.dni, 'NUEVO PACIENTE', o.esp || 'HEMATOLOGÍA',
    o.medico || 'Dra. KAREN DIANA MATOS PEÑA', 'Centro Hematológico del Perú', 'MAGALY'];
}

test('limpiarCitas normaliza IDCITA, DNI, fecha, estado y nombre', () => {
  const r = L.limpiarCitas(ENC, [fila({ id: 'cim1', fecha: '2026-09-28 | 02:00 PM', dni: ' 040111222 ', nombre: 'ROSA  ELENA ' })], {});
  assert.deepEqual(plano(r.faltantes), []);
  assert.equal(r.citas.length, 1);
  const c = r.citas[0];
  assert.equal(c.IDCITA, 'CIM1');
  assert.equal(c.DNI, '40111222');
  assert.equal(c.FECHA, '2026-09-28');
  assert.equal(c.ESTADO, 'REALIZADO');
  assert.equal(c.NOMBRE, 'ROSA ELENA');
  assert.equal(c.ESPECIALIDAD, 'HEMATOLOGÍA');
  assert.equal(c.MODALIDAD, 'CLÍNICA');
  assert.deepEqual(plano(Object.keys(c)), plano(L.COLUMNAS_CITAS));
});

test('encabezado incompleto: no devuelve citas y nombra la columna que falta', () => {
  const enc = ENC.filter(c => c !== 'DNI DEL PACIENTE');
  const r = L.limpiarCitas(enc, [fila({ id: 'C1', fecha: '2026-09-28 | 09:00 AM' })], {});
  assert.deepEqual(plano(r.faltantes), ['DNI DEL PACIENTE']);
  assert.equal(r.citas.length, 0);
});

test('filas sin IDCITA, DNI o fecha válida se cuentan como inválidas', () => {
  const r = L.limpiarCitas(ENC, [
    fila({ id: '', fecha: '2026-09-28 | 09:00 AM' }),
    fila({ id: 'C2', fecha: '2026-09-28 | 09:00 AM', dni: '' }),
    fila({ id: 'C3', fecha: 'mañana' }),
    fila({ id: 'C4', fecha: '2026-09-28 | 09:00 AM' })
  ], {});
  assert.equal(r.invalidas, 3);
  assert.deepEqual(plano(r.citas.map(c => c.IDCITA)), ['C4']);
});

test('IDCITA repetido: gana el registro más reciente, en cualquier orden', () => {
  const vieja = fila({ id: 'C5', fecha: '2026-09-28 | 09:00 AM', estado: 'Agendado', reg: '2026-09-01 10:00' });
  const nueva = fila({ id: 'C5', fecha: '2026-09-28 | 09:00 AM', estado: 'Realizado', reg: '2026-09-05 08:00' });
  assert.equal(L.limpiarCitas(ENC, [vieja, nueva], {}).citas[0].ESTADO, 'REALIZADO');
  assert.equal(L.limpiarCitas(ENC, [nueva, vieja], {}).citas[0].ESTADO, 'REALIZADO');
});

test('el alias de médico unifica ELI y ELÍ', () => {
  const alias = {};
  alias[L.normTexto('Dr. ELI FABRIZIO CABANILLAS HUALPA')] = 'Dr. ELÍ FABRIZIO CABANILLAS HUALPA';
  const r = L.limpiarCitas(ENC, [
    fila({ id: 'C6', fecha: '2026-09-01 | 09:00 AM', medico: 'Dr. ELI FABRIZIO CABANILLAS HUALPA' }),
    fila({ id: 'C7', fecha: '2026-09-02 | 09:00 AM', medico: 'Dr. ELÍ FABRIZIO CABANILLAS HUALPA' })
  ], alias);
  assert.deepEqual(plano(r.citas.map(c => c.MEDICO)), ['Dr. ELÍ FABRIZIO CABANILLAS HUALPA', 'Dr. ELÍ FABRIZIO CABANILLAS HUALPA']);
});

function c(id, fecha, estado, reg) {
  return { IDCITA: id, DNI: '40111222', NOMBRE: 'ROSA', FECHA: fecha, ESTADO: estado, ESPECIALIDAD: 'HEMATOLOGÍA',
    MEDICO: 'X', MODALIDAD: '', TIPO_PACIENTE: '', MARCA: '', PAGO: '', ESTADO_PAGO: '', REGISTRADO_POR: '', FECHA_REGISTRO: reg };
}

test('fusionarCitas conserva las citas que ya no vienen en el pegado', () => {
  const previas = [c('A', '2026-07-01', 'REALIZADO', '2026-06-20 10:00'), c('B', '2026-09-01', 'AGENDADO', '2026-08-20 10:00')];
  const nuevas = [c('B', '2026-09-01', 'REALIZADO', '2026-09-01 12:00'), c('C', '2026-09-15', 'AGENDADO', '2026-09-10 09:00')];
  const r = L.fusionarCitas(previas, nuevas);
  assert.deepEqual(plano(r.citas.map(x => x.IDCITA)), ['A', 'B', 'C']);
  assert.equal(r.citas[1].ESTADO, 'REALIZADO');
  assert.equal(r.nuevas, 1);
  assert.equal(r.cambiadas, 1);
});

test('fusionarCitas ignora una versión más vieja de la misma cita', () => {
  const r = L.fusionarCitas([c('B', '2026-09-01', 'REALIZADO', '2026-09-01 12:00')], [c('B', '2026-09-01', 'AGENDADO', '2026-08-20 10:00')]);
  assert.equal(r.citas[0].ESTADO, 'REALIZADO');
  assert.equal(r.cambiadas, 0);
  assert.equal(r.nuevas, 0);
});
