// test/logica-pacientes.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar, plano } = require('./cargar');
const { cita, seg, reglas } = require('./fixtures');
const L = cargar();

const ind = o => Object.assign({ ID: 'IND', FECHA: '2026-07-01', TIPO: 'HIERRO', DETALLE: 'HIERRO', CANTIDAD: '', MEDICO_SOLICITANTE: '',
  ASESORA: 'LORENA', NOMBRE: 'X', TELEFONO: '', ESTADO: 'COTIZÓ', OBSERVACIONES: '', DNI: '40111222', EMPAREJAMIENTO: 'AUTOMÁTICO' }, o);

test('armarPacientes: teléfonos y pendientes vienen de las indicaciones emparejadas', () => {
  const citas = [cita({ fecha: '2026-07-01' }), cita({ dni: '40222333', nombre: 'JORGE LUIS MENDOZA PAREDES', fecha: '2026-09-20' })];
  const inds = [
    ind({ ID: 'IND-1', CANTIDAD: 2, TELEFONO: '987654321' }),
    ind({ ID: 'IND-2', TIPO: 'PROCEDIMIENTO', DETALLE: 'AMO + BIOPSIA', TELEFONO: '912345678' }),
    ind({ ID: 'IND-3', TELEFONO: '987654321' }),
    ind({ ID: 'IND-4', DNI: '', TELEFONO: '999999999' })
  ];
  const p = plano(L.armarPacientes(citas, inds, [], reglas(L), '2026-10-01'));
  const rosa = p.find(x => x.DNI === '40111222');
  assert.deepEqual(Object.keys(rosa), plano(L.COLUMNAS_PACIENTES));
  assert.equal(rosa.TELEFONOS, '987654321 / 912345678');
  assert.equal(rosa.PENDIENTE, 'Hierro (Ferinject) ×2: cotizó y no lo hizo; AMO + BIOPSIA: cotizó y no lo hizo; Hierro (Ferinject): cotizó y no lo hizo');
  assert.equal(rosa.ESTADO, 'VENCIDO');
  assert.equal(rosa.DIAS_ATRASO, 47);
  assert.equal(rosa.N_REALIZADAS, 1);
  assert.equal(p.find(x => x.DNI === '40222333').ESTADO, 'AL DÍA');
});

test('hierro aceptado después de cotizado ya no es pendiente', () => {
  const inds = [ind({ FECHA: '2026-07-01' }), ind({ FECHA: '2026-07-05', ESTADO: 'ACEPTÓ' })];
  const p = L.armarPacientes([cita({ fecha: '2026-07-01' })], inds, [], reglas(L), '2026-10-01');
  assert.equal(p[0].PENDIENTE, '');
});

test('armarPacientes cuenta los seguimientos posteriores a la última cita', () => {
  const p = L.armarPacientes([cita({ fecha: '2026-07-01' })], [], [seg({ fecha: '2026-09-10' })], reglas(L), '2026-10-01');
  assert.equal(p[0].N_SEGUIMIENTOS, 1);
  assert.equal(p[0].ULTIMO_SEGUIMIENTO, '2026-09-10');
});

test('ordenarBandeja: primer intento antes; con pendiente antes; menos atraso antes', () => {
  const ps = [
    { DNI: '1', ESTADO: 'VENCIDO', N_SEGUIMIENTOS: 1, PENDIENTE: 'x', DIAS_ATRASO: 1 },
    { DNI: '2', ESTADO: 'VENCIDO', N_SEGUIMIENTOS: 0, PENDIENTE: '', DIAS_ATRASO: 3 },
    { DNI: '3', ESTADO: 'VENCIDO', N_SEGUIMIENTOS: 0, PENDIENTE: 'x', DIAS_ATRASO: 90 },
    { DNI: '4', ESTADO: 'VENCIDO', N_SEGUIMIENTOS: 0, PENDIENTE: '', DIAS_ATRASO: 2 },
    { DNI: '5', ESTADO: 'AL DÍA', N_SEGUIMIENTOS: 0, PENDIENTE: '', DIAS_ATRASO: 0 }
  ];
  assert.deepEqual(plano(L.ordenarBandeja(ps).map(p => p.DNI)), ['3', '4', '2', '1']);
});

test('validarAccion exige usuario del catálogo y, al descartar, un motivo del catálogo', () => {
  const cat = { usuarios: ['MAGALY', 'DR. ELI CABANILLAS'], motivos: ['SE ATIENDE EN OTRO LUGAR'], alias: {} };
  assert.match(L.validarAccion({ usuario: '', dni: '1', especialidad: 'X' }, cat, 'HECHO'), /Elija quién/);
  assert.match(L.validarAccion({ usuario: 'PEDRO', dni: '1', especialidad: 'X' }, cat, 'HECHO'), /no está en CATALOGOS/);
  assert.match(L.validarAccion({ usuario: 'MAGALY', dni: '', especialidad: 'X' }, cat, 'HECHO'), /DNI/);
  assert.equal(L.validarAccion({ usuario: 'magaly', dni: '1', especialidad: 'X' }, cat, 'HECHO'), '');
  assert.match(L.validarAccion({ usuario: 'MAGALY', dni: '1', especialidad: 'X', motivo: '' }, cat, 'DESCARTADO'), /motivo/);
  assert.equal(L.validarAccion({ usuario: 'MAGALY', dni: '1', especialidad: 'X', motivo: 'Se atiende en otro lugar' }, cat, 'DESCARTADO'), '');
  assert.match(L.validarAccion(null, cat, 'HECHO'), /Elija quién/);
});

test('limpiarParaEnvio convierte NaN, Infinity, null y undefined en vacío', () => {
  assert.deepEqual(plano(L.limpiarParaEnvio({ a: NaN, b: [1, Infinity, null], c: { d: undefined, e: 'x', f: 0 } })),
    { a: '', b: [1, '', ''], c: { d: '', e: 'x', f: 0 } });
});
