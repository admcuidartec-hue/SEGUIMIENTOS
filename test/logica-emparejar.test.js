// test/logica-emparejar.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar, plano } = require('./cargar');
const L = cargar();

const CITAS = [
  { DNI: '40111222', NOMBRE: 'ROSA ELENA QUISPE HUAMAN' },
  { DNI: '40222333', NOMBRE: 'JORGE LUIS MENDOZA PAREDES' },
  { DNI: '40999888', NOMBRE: 'JORGE MENDOZA SALAS' },
  { DNI: '6174169', NOMBRE: 'MARIA DEL PILAR RIOS DE LA CRUZ' }
];
const I = () => L.construirIndiceNombres(CITAS);

test('un único candidato → AUTOMÁTICO aunque falten palabras', () => {
  const r = L.emparejar('Rosa Quispe', I());
  assert.equal(r.estado, 'AUTOMÁTICO');
  assert.equal(r.dni, '40111222');
});

test('las tildes y las partículas no estorban', () => {
  assert.equal(L.emparejar('MARÍA PILAR RÍOS CRUZ', I()).dni, '6174169');
});

test('dos candidatos → POR CONFIRMAR, sin DNI', () => {
  const r = plano(L.emparejar('JORGE MENDOZA', I()));
  assert.equal(r.estado, 'POR CONFIRMAR');
  assert.equal(r.dni, '');
  assert.deepEqual(r.candidatos.map(c => c.dni).sort(), ['40222333', '40999888']);
});

test('una sola palabra nunca es AUTOMÁTICO', () => {
  const r = L.emparejar('ROSA', I());
  assert.equal(r.estado, 'POR CONFIRMAR');
  assert.equal(r.dni, '');
});

test('sin coincidencia → SIN CANDIDATO', () => {
  const r = L.emparejar('PEDRO CASTILLO', I());
  assert.equal(r.estado, 'SIN CANDIDATO');
  assert.equal(r.candidatos.length, 0);
});

test('indicacionesDesdeHierro lee por encabezado y salta filas vacías', () => {
  const enc = ['FECHA', '', 'ASESOR ', 'NOMBRE ', 'TELÉFONO ', 'CANTIDAD', '¿ACEPTARON? ¿COTIZACIÓN?', 'OBSERVACIONES '];
  const filas = [
    ['2026-04-18 00:00', 'abril', 'LORENA', 'ROSA ELENA QUISPE HUAMAN', '987 654 321', 2, 'COTIZARON', 'VA A COORDINAR'],
    ['', '', '', '', '', '', '', ''],
    ['2026-04-20 00:00', 'abril', 'MAGALY', 'JORGE MENDOZA', 912345678, 1, 'ACEPTARON', '']
  ];
  const r = plano(L.indicacionesDesdeHierro('HIERRO', enc, filas, 1));
  assert.equal(r.length, 2);
  assert.deepEqual(r[0], {
    ID: 'IND-0001', FECHA: '2026-04-18', TIPO: 'HIERRO', DETALLE: 'HIERRO', CANTIDAD: 2, MEDICO_SOLICITANTE: '',
    ASESORA: 'LORENA', NOMBRE: 'ROSA ELENA QUISPE HUAMAN', TELEFONO: '987654321', ESTADO: 'COTIZÓ',
    OBSERVACIONES: 'VA A COORDINAR', DNI: '', EMPAREJAMIENTO: '', ORIGEN: 'HIERRO!2'
  });
  assert.equal(r[1].ID, 'IND-0002');
  assert.equal(r[1].ORIGEN, 'HIERRO!4');
  assert.equal(r[1].ESTADO, 'ACEPTÓ');
});

test('PROCEDIMIENTOS usa TIPO DE EXÁMENES como detalle y sigue la numeración', () => {
  const enc = ['FECHA', '', 'ASESOR ', 'NOMBRE ', 'TELÉFONO ', 'TIPO DE EXÁMENES', '¿ACEPTARON? ¿COTIZACIÓN?', 'OBSERVACIONES '];
  const r = plano(L.indicacionesDesdeHierro('PROCEDIMIENTOS', enc,
    [['2026-05-02 00:00', 'mayo', 'LORENA', 'ROSA QUISPE', '947 176 392', 'AMO + BIOPSIA ', 'COTIZARON', '']], 8));
  assert.equal(r[0].ID, 'IND-0008');
  assert.equal(r[0].TIPO, 'PROCEDIMIENTO');
  assert.equal(r[0].DETALLE, 'AMO + BIOPSIA');
  assert.equal(r[0].CANTIDAD, '');
});

test('aplicarEmparejamientos respeta lo confirmado y el DNI escrito a mano', () => {
  const inds = [
    { NOMBRE: 'ROSA QUISPE', DNI: '', EMPAREJAMIENTO: '' },
    { NOMBRE: 'JORGE MENDOZA', DNI: '40999888', EMPAREJAMIENTO: 'CONFIRMADO' },
    { NOMBRE: 'CUALQUIERA', DNI: '06174169', EMPAREJAMIENTO: '' },
    { NOMBRE: 'JORGE MENDOZA', DNI: '', EMPAREJAMIENTO: '' }
  ];
  const n = L.aplicarEmparejamientos(inds, I());
  assert.equal(n, 3);
  assert.equal(inds[0].DNI, '40111222');
  assert.equal(inds[0].EMPAREJAMIENTO, 'AUTOMÁTICO');
  assert.equal(inds[1].DNI, '40999888');
  assert.equal(inds[2].DNI, '6174169');
  assert.equal(inds[2].EMPAREJAMIENTO, 'CONFIRMADO');
  assert.equal(inds[3].EMPAREJAMIENTO, 'POR CONFIRMAR');
  assert.equal(L.aplicarEmparejamientos(inds, I()), 0);
});
