// Buscador de la pestaña Pacientes. Datos inventados.
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar, plano } = require('./cargar');
const { cita } = require('./fixtures');
const L = cargar();

const fuentes = () => ({
  citas: [
    cita({ dni: '40111222', nombre: 'JUANA ROSA BERNILLA RODRIGUEZ', fecha: '2026-07-01' }),
    cita({ dni: '40333444', nombre: 'CARMEN SOFÍA TORRES DÍAZ', fecha: '2026-08-01' }),
    cita({ dni: '40111222', nombre: 'JUANA ROSA BERNILLA RODRIGUEZ', fecha: '2026-09-01' })
  ],
  registros: [
    { DNI: '41555666', NOMBRE: 'PEDRO PABLO QUISPE', ANULADO: '' },
    { DNI: '41777888', NOMBRE: 'ANULADO PÉREZ', ANULADO: 'SÍ' }
  ],
  indicaciones: [
    { DNI: '42999000', NOMBRE: 'LUCÍA HUAMÁN ROJAS' },
    { DNI: '', NOMBRE: 'SIN DNI HUAMÁN' }
  ]
});
const buscar = q => plano(L.buscarEnPacientes(q, fuentes()));

test('buscarEnPacientes: todas las palabras, en cualquier orden y sin tildes', () => {
  assert.deepEqual(buscar('Juana Bernilla'), [{ DNI: '40111222', NOMBRE: 'JUANA ROSA BERNILLA RODRIGUEZ' }]);
  assert.deepEqual(buscar('bernilla juana'), [{ DNI: '40111222', NOMBRE: 'JUANA ROSA BERNILLA RODRIGUEZ' }]);
  assert.deepEqual(buscar('sofia diaz').map(r => r.DNI), ['40333444']);
  assert.deepEqual(buscar('juana pérez'), [], 'una palabra que no está deja fuera al paciente');
});

test('buscarEnPacientes: el DNI se encuentra con una parte, al inicio o en medio', () => {
  assert.deepEqual(buscar('40111').map(r => r.DNI), ['40111222']);
  assert.deepEqual(buscar('3344').map(r => r.DNI), ['40333444']);
  assert.deepEqual(buscar('12'), [], 'menos de 3 caracteres no busca');
});

test('buscarEnPacientes: también quien solo está en Registro o en el historial, sin anulados ni filas sin DNI', () => {
  assert.deepEqual(buscar('pedro quispe'), [{ DNI: '41555666', NOMBRE: 'PEDRO PABLO QUISPE' }]);
  assert.deepEqual(buscar('huaman'), [{ DNI: '42999000', NOMBRE: 'LUCÍA HUAMÁN ROJAS' }]);
  assert.deepEqual(buscar('anulado'), []);
});

test('buscarEnPacientes: un paciente una vez, primero el de cita más reciente, hasta 20', () => {
  const muchos = { citas: Array.from({ length: 30 }, (_, i) => cita({ dni: String(50000000 + i), nombre: 'ANA PRUEBA ' + i, fecha: '2026-09-' + String(1 + (i % 28)).padStart(2, '0') })) };
  const r = plano(L.buscarEnPacientes('ana prueba', muchos));
  assert.equal(r.length, 20);
  assert.equal(new Set(r.map(x => x.DNI)).size, 20);
  assert.equal(buscar('juana').length, 1);
});
