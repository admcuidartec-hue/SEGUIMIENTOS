// Importar lo que falta de la base de hierro (una sola vez, sin duplicar). Datos inventados.
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar, plano } = require('./cargar');
const L = cargar();

const ENC_HIERRO = ['FECHA', '', 'ASESOR ', 'NOMBRE ', 'TELÉFONO ', 'CANTIDAD', '¿ACEPTARON? ¿COTIZACIÓN?', 'OBSERVACIONES '];
const ENC_NUEVO = ['FECHA', 'ASESOR ', 'NOMBRE ', 'DNI', 'TELÉFONO ', 'CANTIDAD', '¿ACEPTARON? ¿COTIZACIÓN?', 'TIPO DE HIERRO ', 'MÉDICO SOLICITANTE', 'OBSERVACIÓN'];

test('indicacionesDesdeHierro: «HIERRO EV DIARIO» es hierro, como la antigua «HIERRO»', () => {
  const r = plano(L.indicacionesDesdeHierro('HIERRO EV DIARIO', ENC_HIERRO, [['2026-04-18', 'abril', 'LORENA', 'ROSA QUISPE', 945000111, 2, 'ACEPTARON', '']]));
  assert.deepEqual([r[0].TIPO, r[0].DETALLE, r[0].CANTIDAD, r[0].TELEFONO, r[0].ESTADO, r[0].ORIGEN],
    ['HIERRO', 'HIERRO', 2, '945000111', 'ACEPTÓ', 'HIERRO EV DIARIO!2']);
});

test('indicacionesDesdeHierro: «HIERRO NUEVO» trae DNI, médico y tipo de hierro', () => {
  const r = plano(L.indicacionesDesdeHierro('HIERRO NUEVO ', ENC_NUEVO,
    [['2026-09-30', 'RACHEL', 'ANA LUZ PRUEBA', 41222333, '992 000 111', 1, 'COTIZARON', 'FERINJECT', 'ELI CABANILLAS', '1 FRASCO + COLOCACIÓN']]));
  assert.deepEqual([r[0].TIPO, r[0].DETALLE, r[0].DNI, r[0].MEDICO_SOLICITANTE, r[0].TELEFONO, r[0].ESTADO, r[0].OBSERVACIONES],
    ['HIERRO', 'HIERRO', '41222333', 'ELI CABANILLAS', '992000111', 'COTIZÓ', 'FERINJECT · 1 FRASCO + COLOCACIÓN']);
  L.aplicarEmparejamientos(r, L.construirIndiceNombres([]));
  assert.equal(r[0].EMPAREJAMIENTO, 'CONFIRMADO', 'el DNI de la fila se respeta');
});

test('indicacionesQueFaltan: solo lo que no está, por fecha, nombre, tipo y detalle', () => {
  const ya = [{ FECHA: '2026-05-02', NOMBRE: 'Feliciana Prueba', TIPO: 'PROCEDIMIENTO', DETALLE: 'AMO + BIOPSIA' }];
  const fuente = [
    { FECHA: '2026-05-02 00:00', NOMBRE: 'FELICIANA  PRUEBA', TIPO: 'PROCEDIMIENTO', DETALLE: 'amo + biopsia' },
    { FECHA: '2026-05-03', NOMBRE: 'FELICIANA PRUEBA', TIPO: 'PROCEDIMIENTO', DETALLE: 'AMO + BIOPSIA' },
    { FECHA: '2026-05-02', NOMBRE: 'FELICIANA PRUEBA', TIPO: 'HIERRO', DETALLE: 'HIERRO' }
  ];
  assert.deepEqual(plano(L.indicacionesQueFaltan(ya, fuente)).map(i => [i.FECHA, i.TIPO]), [['2026-05-03', 'PROCEDIMIENTO'], ['2026-05-02', 'HIERRO']]);
});

test('indicacionesQueFaltan: dos filas iguales en la base cuentan dos veces; importar dos veces no duplica', () => {
  const fila = { FECHA: '2026-06-01', NOMBRE: 'LUIS PRUEBA', TIPO: 'HIERRO', DETALLE: 'HIERRO' };
  const nuevas = plano(L.indicacionesQueFaltan([fila], [fila, Object.assign({}, fila)]));
  assert.equal(nuevas.length, 1, 'ya había una: falta la segunda');
  assert.deepEqual(plano(L.indicacionesQueFaltan([fila, fila], [fila, fila])), []);
});

test('buscarFilaParaAsignar: solo SIN CANDIDATO y un DNI conocido', () => {
  const enc = ['ID', 'NOMBRE', 'DNI', 'EMPAREJAMIENTO'];
  const filas = [['IND-0001', 'PAOLA PRUEBA', '', 'SIN CANDIDATO'], ['IND-0002', 'LUIS PRUEBA', '40111222', 'AUTOMÁTICO']];
  const conocidos = { 40111222: 1, 41222333: 1 };
  assert.deepEqual(plano(L.buscarFilaParaAsignar(enc, filas, 'IND-0001', '41222333', conocidos)), { fila: 0, error: '' });
  assert.match(L.buscarFilaParaAsignar(enc, filas, 'IND-0001', '49999999', conocidos).error, /no está en SOFDOC ni en Registro/);
  assert.match(L.buscarFilaParaAsignar(enc, filas, 'IND-0002', '41222333', conocidos).error, /ya tiene paciente/);
  assert.match(L.buscarFilaParaAsignar(enc, filas, 'IND-0009', '41222333', conocidos).error, /No encontré/);
});
