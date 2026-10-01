// test/logica-base.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar } = require('./cargar');
const L = cargar();

test('normTexto quita tildes, espacios sobrantes y pasa a mayúsculas', () => {
  assert.equal(L.normTexto('  Hematología  médica\n'), 'HEMATOLOGIA MEDICA');
  assert.equal(L.normTexto(null), '');
  assert.equal(L.normTexto(undefined), '');
});

test('normDni: un DNI numérico pierde los ceros a la izquierda; el extranjero se conserva', () => {
  assert.equal(L.normDni('06174169'), '6174169');
  assert.equal(L.normDni(6174169), '6174169');
  assert.equal(L.normDni(' pe3111043 '), 'PE3111043');
  assert.equal(L.normDni('40.111.222'), '40111222');
  assert.equal(L.normDni(''), '');
});

test('normTelefono deja solo los dígitos y quita el 51', () => {
  assert.equal(L.normTelefono('978 826 985'), '978826985');
  assert.equal(L.normTelefono(945365292), '945365292');
  assert.equal(L.normTelefono('+51 978 826 985'), '978826985');
  assert.equal(L.normTelefono(''), '');
  assert.equal(L.normTelefono('123'), '');
});

test('fechaIso entiende el formato de SOFDOC y el de la capa de datos', () => {
  assert.equal(L.fechaIso('2026-09-28 | 02:00 PM'), '2026-09-28');
  assert.equal(L.fechaIso('2026-09-28 14:05'), '2026-09-28');
  assert.equal(L.fechaIso('2026-09-28'), '2026-09-28');
  assert.equal(L.fechaIso('25/2/2026'), '');
  assert.equal(L.fechaIso(null), '');
});

test('diasEntre y sumarDias cruzan meses y años', () => {
  assert.equal(L.diasEntre('2026-01-31', '2026-03-01'), 29);
  assert.equal(L.diasEntre('2026-03-01', '2026-01-31'), -29);
  assert.equal(L.sumarDias('2026-12-20', 45), '2027-02-03');
  assert.equal(L.mesDe('2026-09-28'), '2026-09');
});
