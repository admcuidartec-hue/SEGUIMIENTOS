// Documentos, largos máximos y caracteres invisibles (batería de 50, casos 42 y 44). Datos inventados.
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar, plano } = require('./cargar');
const { reglas } = require('./fixtures');

const L = cargar();
const CAT = L.catalogosDesdeFilas(['USUARIOS', 'DOCTOR', 'DOCTOR_SOFDOC', 'PROCEDIMIENTOS'], [['ANA', 'Dra. Karen Matos', 'Dra. KAREN DIANA MATOS PEÑA', 'AMO']]);
const reg = o => Object.assign({ usuario: 'ANA', dni: '40111222', nombre: 'Rosa Quispe', contacto: '987654321', fecha: '2026-10-05', doctor: 'Dra. Karen Matos',
  procedimientos: ['AMO'] }, o);
const err = o => L.validarRegistro(reg(o), CAT, '2026-10-05').error;

test('documentoMal: el mismo mensaje que el formulario, por qué no vale cada documento', () => {
  const DOC = 'El DNI debe tener 8 dígitos (o el carné de extranjería, de 9 a 12 caracteres).';
  assert.equal(L.documentoMal('1234567'), DOC);
  assert.equal(L.documentoMal('AB123456'), DOC);
  assert.equal(L.documentoMal('12.345.678'), '');
  assert.equal(L.documentoMal('CE-001234567'), '');
  assert.equal(L.documentoMal('1234567890123'), 'El documento tiene 13 caracteres: el carné de extranjería va de 9 a 12.');
  assert.equal(L.documentoMal('ÑA1234567'), 'El documento solo lleva letras de la A a la Z (sin Ñ ni tildes), números, espacios, puntos o guiones.');
  assert.equal(L.documentoMal('0012345678'), 'El documento 0012345678 empieza con 0 y se confundiría con el DNI 12345678. ' +
    'Si es un DNI, escriba sus 8 dígitos; si es un carné de extranjería, escríbalo con sus letras (p. ej. CE0012345678).');
  assert.equal(L.documentoMal('09961003'), '', 'un DNI de 8 dígitos con su cero sigue valiendo');
  assert.equal(err({ dni: 'ÑA1234567' }), L.documentoMal('ÑA1234567'), 'validarRegistro dice lo mismo');
  assert.equal(err({ dni: '0012345678' }), L.documentoMal('0012345678'));
});

test('largos máximos: nombre 120 y notas, motivos y exámenes 2000, con su aviso', () => {
  assert.equal(err({ nombre: 'A'.repeat(121) }), 'El nombre va hasta 120 caracteres (tiene 121).');
  assert.equal(err({ nombre: 'A'.repeat(120) }), '');
  assert.equal(L.validarRegistro(reg({ tipo: 'CONTROL', fechaRetorno: '2026-10-20', examenes: 'x'.repeat(2001), procedimientos: [] }), CAT, '2026-10-05').error,
    'Los exámenes van hasta 2000 caracteres (tiene 2001).');
  const tarjeta = { DNI: '40111222', ESPECIALIDAD: 'HEMATOLOGÍA', TELEFONOS: '987654321', COLUMNA: 'POR_CONTACTAR' };
  const res = o => L.validarResultado(Object.assign({ usuario: 'ana', dni: '40111222', especialidad: 'Hematología', resultado: 'LO PENSARÁ', fecha: '2026-10-10' }, o),
    { catalogos: CAT, hoy: '2026-10-05', tarjetas: [tarjeta] }).error;
  assert.equal(res({ nota: 'n'.repeat(60000) }), 'La nota va hasta 2000 caracteres (tiene 60000).');
  assert.equal(res({ resultado: 'NO DESEA CONTINUAR', motivo: 'm'.repeat(2001) }), 'El motivo va hasta 2000 caracteres (tiene 2001).');
  assert.equal(L.largoMal_('x'.repeat(2000), 2000, 'La nota'), '');
});

test('textoLimpio_ quita caracteres de control y de dirección (U+202E y similares); el tabulador y los saltos son espacios', () => {
  assert.equal(L.textoLimpio_('ROSA\u0000 BELL\u0007 ‮ANIDAN‬ ZERO​WIDTH\tTAB\r\nCRLF﻿'), 'ROSA BELL ANIDAN ZEROWIDTH TAB CRLF');
  assert.equal(L.textoLimpio_('Ñahui-O\'Higgins'), 'Ñahui-O\'Higgins');
  assert.equal(plano(L.validarRegistro(reg({ nombre: 'Rosa‮ Bell\u0000' }), CAT, '2026-10-05').filas)[0].NOMBRE, 'ROSA BELL');
});

test('formasMasFrecuentes: la misma especialidad con y sin tilde sale una vez, con la forma más usada', () => {
  const { cargar, plano } = require('./cargar');
  const L2 = cargar();
  assert.deepEqual(plano(L2.formasMasFrecuentes({ 'HEMATOLOGÍA': 5, 'HEMATOLOGIA': 2, 'Hematología ': 1, 'REUMATOLOGIA': 3, 'REUMATOLOGÍA': 3, 'NUTRICIÓN': 1 })),
    ['HEMATOLOGÍA', 'NUTRICIÓN', 'REUMATOLOGÍA']);
});
