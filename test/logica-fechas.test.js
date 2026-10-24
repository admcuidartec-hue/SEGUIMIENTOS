// Fechas escritas a mano en las hojas (caso 60): nunca un mes basura ni un NaN. Datos inventados.
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar, plano } = require('./cargar');
const { cita, reglas } = require('./fixtures');
const L = cargar();
const HOY = '2026-10-23';

test('fechaIso rechaza las fechas que no existen', () => {
  assert.equal(L.fechaIso('2026-02-31'), '');
  assert.equal(L.fechaIso('2026-13-01'), '');
  assert.equal(L.fechaIso('2026-00-10'), '');
  assert.equal(L.fechaIso('2028-02-29'), '2028-02-29');
  assert.equal(L.fechaIso('2026-02-29'), '');
  assert.equal(L.fechaIso('31/02/2026'), '');
});

test('mesDe: solo de una fecha válida', () => {
  assert.equal(L.mesDe('2026-10-05'), '2026-10');
  assert.equal(L.mesDe('31/02/2026'), '');
  assert.equal(L.mesDe(''), '');
});

test('normalizarFechas: las columnas de fecha quedan en yyyy-mm-dd o vacías', () => {
  const filas = [{ FECHA: '31/02/2026', FECHA_INICIO: '2026-11-02', FECHA_HORA: 'ayer', NOTA: '31/02/2026' },
    { FECHA: '2026-10-05 10:00', FECHA_HORA: '2026-10-05 10:00' }];
  const r = plano(L.normalizarFechas(filas, { FECHA: 1, FECHA_INICIO: 1 }, { FECHA_HORA: 1 }));
  assert.deepEqual(r, [{ FECHA: '', FECHA_INICIO: '2026-11-02', FECHA_HORA: '', NOTA: '31/02/2026' },
    { FECHA: '2026-10-05', FECHA_HORA: '2026-10-05 10:00' }]);
});

test('resumenPorMes: una fecha mal escrita no crea un mes', () => {
  const inds = [{ ID: 'I1', DNI: '5', TIPO: 'PROCEDIMIENTO', DETALLE: 'AMO', ESTADO: 'COTIZÓ', FECHA: '31/02/2026' },
    { ID: 'I2', DNI: '5', TIPO: 'HIERRO', ESTADO: 'COTIZÓ', FECHA: '2026-10-01' }];
  const r = plano(L.resumenPorMes([cita({ dni: '5', fecha: '2026-09-01' }), cita({ dni: '6', fecha: 'mañana' })], inds, [], reglas(L), HOY));
  assert.deepEqual([...new Set(r.map(f => f.MES))].sort(), ['2026-09', '2026-10']);
});

test('pendientesIndicacion: una fecha mal escrita no da «Cotizó hace NaN días»', () => {
  const inds = [{ ID: 'I1', DNI: '5', TIPO: 'PROCEDIMIENTO', DETALLE: 'AMO', ESTADO: 'COTIZÓ', FECHA: '31/02/2026', NOMBRE: 'X' },
    { ID: 'I2', DNI: '6', TIPO: 'HIERRO', ESTADO: 'COTIZÓ', FECHA: '2026-10-13', NOMBRE: 'Y' }];
  const p = plano(L.pendientesIndicacion([], inds, [], reglas(L), HOY, [], {}));
  assert.deepEqual(p.map(x => [x.DNI, x.DIAS]), [['6', 10]]);
  p.forEach(x => Object.keys(x).forEach(k => assert.ok(!/NaN/.test(String(x[k])), k + ': ' + x[k])));
});

test('armarSeries ignora las citas sin fecha válida', () => {
  const s = plano(L.armarSeries([cita({ dni: '7', fecha: 'mañana' }), cita({ dni: '7', fecha: '2026-09-01' })]));
  assert.deepEqual(Object.values(s)[0].realizadas.map(c => c.FECHA), ['2026-09-01']);
});

test('los lectores de las hojas normalizan las fechas y descartan la cita sin fecha', () => {
  const ctx = cargar(['Logica.gs', 'Registro.gs', 'Resultados.gs', 'Tablero.gs', 'Enfermeria.gs', 'Codigo.gs', 'RegistroServidor.gs', 'EnfermeriaServidor.gs']);
  const H = {
    CITAS: [{ IDCITA: 'C1', DNI: '0005', FECHA: 'mañana', ESTADO: '' }, { IDCITA: 'C2', DNI: '5', FECHA: '2026-09-01', ESTADO: 'REALIZADO' }],
    INDICACIONES: [{ ID: 'I1', DNI: '5', FECHA: '31/02/2026', TIPO: 'procedimiento', ESTADO: 'COTIZÓ' }],
    SEGUIMIENTOS: [{ ID: 'S1', DNI: '5', FECHA_HORA: '', FECHA_PROXIMA: 'pronto' }],
    SESIONES: [{ ID: 'SES1', FECHA: 'ayer', FECHA_HORA: '2026-10-01 10:00' }],
    ALTAS: [{ ID: 'A1', DNI: '5', FECHA: '2026-10-01', FECHA_RETORNO: 'nunca' }],
    REGISTROS: [{ ID: 'R1', DNI: '5', FECHA: '2026-02-30', FECHA_INICIO: '2026-10-30', TIPO: 'HIERRO' }],
    ENFERMERIA: [{ ID: 'E1', DNI: '5', FECHA_HORA: 'x' }]
  };
  ctx.leerObjetos_ = n => (H[n] || []).map(o => Object.assign({}, o));
  ctx.leerOpcional_ = ctx.leerObjetos_;
  assert.deepEqual(plano(ctx.leerCitas_()).map(c => c.IDCITA), ['C2']);
  assert.equal(ctx.leerIndicaciones_()[0].FECHA, '');
  assert.equal(ctx.leerSeguimientos_()[0].FECHA_PROXIMA, '');
  assert.equal(ctx.leerSesiones_()[0].FECHA, '');
  assert.equal(ctx.leerAltas_()[0].FECHA_RETORNO, '');
  assert.deepEqual([ctx.leerRegistros_()[0].FECHA, ctx.leerRegistros_()[0].FECHA_INICIO], ['', '2026-10-30']);
  assert.equal(ctx.leerEnfermeria_()[0].FECHA_HORA, '');
});

test('diasEntre con una fecha inválida da 0, no NaN', () => {
  assert.equal(L.diasEntre('31/02/2026', HOY), 0);
  assert.equal(L.diasEntre('', HOY), 0);
  assert.equal(L.diasEntre('2026-10-13', HOY), 10);
});

test('kpiIndicaciones y kpiRecuperacion: sin fecha válida no hay fila (ni MES vacío)', () => {
  const inds = [{ ID: 'I1', DNI: '5', TIPO: 'PROCEDIMIENTO', DETALLE: 'AMO', ESTADO: 'COTIZÓ', FECHA: '31/02/2026' },
    { ID: 'I2', DNI: '5', TIPO: 'HIERRO', ESTADO: 'COTIZÓ', FECHA: '2026-10-01' }];
  assert.deepEqual(plano(L.kpiIndicaciones(inds, [])).map(f => f.MES), ['2026-10']);
  const segs = [{ ID: 'S1', FECHA_HORA: '', DNI: '5', ESPECIALIDAD: 'HEMATOLOGÍA', ACCION: 'HECHO' },
    { ID: 'S2', FECHA_HORA: '2026-10-05 10:00', DNI: '5', ESPECIALIDAD: 'HEMATOLOGÍA', ACCION: 'HECHO' }];
  assert.deepEqual(plano(L.kpiRecuperacion(segs, [cita({ dni: '5', fecha: '2026-09-01' })], HOY)).map(f => f.MES), ['2026-10']);
});
