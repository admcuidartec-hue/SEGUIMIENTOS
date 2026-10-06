// Hallazgos de la revisión final. Datos inventados.
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar, plano } = require('./cargar');
const { cita, seg } = require('./fixtures');
const L = cargar();

const INDICE = () => L.construirIndiceNombres([
  { DNI: '40111222', NOMBRE: 'ROSA ELENA QUISPE HUAMAN' },
  { DNI: '40222333', NOMBRE: 'JORGE LUIS MENDOZA PAREDES' },
  { DNI: '40999888', NOMBRE: 'JORGE MENDOZA SALAS' }
]);

test('un DNI escrito a mano en una fila SIN CANDIDATO o POR CONFIRMAR se respeta', () => {
  const inds = [
    { NOMBRE: 'PAOLA RIVERA', DNI: '45678901', EMPAREJAMIENTO: 'SIN CANDIDATO' },
    { NOMBRE: 'JORGE MENDOZA', DNI: '40999888', EMPAREJAMIENTO: 'POR CONFIRMAR' }
  ];
  assert.equal(L.aplicarEmparejamientos(inds, INDICE()), 2);
  assert.deepEqual(plano(inds.map(i => [i.DNI, i.EMPAREJAMIENTO])), [['45678901', 'CONFIRMADO'], ['40999888', 'CONFIRMADO']]);
});

test('completarIds asigna IND-nnnn siguientes solo a las filas con nombre y sin ID', () => {
  const filas = [{ ID: 'IND-0003', NOMBRE: 'A' }, { ID: '', NOMBRE: 'B' }, { ID: 'IND-0010', NOMBRE: 'C' }, { ID: '', NOMBRE: '' }, { ID: '', NOMBRE: 'D' }];
  assert.equal(L.completarIds(filas), 2);
  assert.deepEqual(plano(filas.map(f => f.ID)), ['IND-0003', 'IND-0011', 'IND-0010', '', 'IND-0012']);
});

test('buscarFilaParaConfirmar exige ID, fila POR CONFIRMAR y un DNI que sea candidato', () => {
  const enc = ['ID', 'NOMBRE', 'DNI', 'EMPAREJAMIENTO'];
  const filas = [['', '', '', ''], ['IND-0001', 'JORGE MENDOZA', '', 'POR CONFIRMAR'], ['IND-0002', 'ROSA QUISPE', '40111222', 'AUTOMÁTICO']];
  const f = (id, dni) => plano(L.buscarFilaParaConfirmar(enc, filas, id, dni, INDICE()));
  assert.match(f('', '40222333').error, /indicación/);
  assert.match(f('IND-0099', '40222333').error, /No encontré/);
  assert.match(f('IND-0002', '40111222').error, /ya no está por confirmar/);
  assert.match(f('IND-0001', '40111222').error, /no es candidato/);
  assert.deepEqual(f('IND-0001', '40999888'), { fila: 1, error: '' });
});

test('textoSeguro neutraliza fórmulas en el texto que llega del navegador', () => {
  assert.equal(L.textoSeguro('=IMPORTXML("x")'), "'=IMPORTXML(\"x\")");
  assert.equal(L.textoSeguro('+51 999'), "'+51 999");
  assert.equal(L.textoSeguro('-'), "'-");
  assert.equal(L.textoSeguro('@a'), "'@a");
  assert.equal(L.textoSeguro('Llamará mañana'), 'Llamará mañana');
  assert.equal(L.textoSeguro(12), 12);
});

test('celdaParaHoja_ escribe el texto ya neutralizado', () => {
  const C = cargar(['Logica.gs', 'Registro.gs', 'Resultados.gs', 'Tablero.gs', 'Codigo.gs']);
  assert.equal(C.celdaParaHoja_('=1+1', 'NOTA'), "'=1+1");
});

test('validarAccion rechaza un paciente o especialidad que no está en la lista', () => {
  const cat = { usuarios: ['MAGALY'], motivos: ['OTRO'], alias: {} };
  const pacientes = [{ DNI: '40111222', ESPECIALIDAD: 'HEMATOLOGÍA' }];
  assert.match(L.validarAccion({ usuario: 'MAGALY', dni: '1', especialidad: 'HEMATOLOGÍA' }, cat, 'HECHO', pacientes), /no está en la lista/);
  assert.equal(L.validarAccion({ usuario: 'MAGALY', dni: '40111222', especialidad: 'HEMATOLOGIA' }, cat, 'HECHO', pacientes), '');
});

test('recuperación: una cita agendada que ya pasó no cuenta como retorno', () => {
  const citas = [cita({ fecha: '2026-07-01' }), cita({ fecha: '2026-09-05', estado: 'AGENDADO' })];
  const r = plano(L.kpiRecuperacion([seg({ fecha: '2026-09-01' })], citas, '2026-10-01'));
  assert.equal(r[0].VOLVIO, 0);
});

test('recuperación: tres seguimientos y un retorno cuentan una sola vez, con la fecha del retorno', () => {
  const citas = [cita({ fecha: '2026-05-01' }), cita({ fecha: '2026-09-12' })];
  const segs = [seg({ fecha: '2026-07-01' }), seg({ fecha: '2026-08-01' }), seg({ fecha: '2026-09-01' })];
  const r = plano(L.kpiRecuperacion(segs, citas, '2026-10-01'));
  assert.equal(r.length, 1);
  assert.equal(r[0].MES, '2026-07');
  assert.equal(r[0].VOLVIO, 1);
  assert.equal(r[0].DIAS, 73);
  assert.equal(r[0].FECHA_RETORNO, '2026-09-12');
});
