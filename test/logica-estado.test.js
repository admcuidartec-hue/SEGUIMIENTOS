// test/logica-estado.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar, plano } = require('./cargar');
const { cita, seg, reglas } = require('./fixtures');
const L = cargar();

const serieDe = citas => Object.values(L.armarSeries(citas))[0];
const est = (citas, segs, hoy) => L.estadoDeSerie(serieDe(citas), segs, reglas(L), hoy).estado;

test('reglas: especialidad con o sin tilde es la misma', () => {
  const r = reglas(L);
  assert.equal(L.plazoDe(r, 'Reumatología').vence, 90);
  assert.equal(L.plazoDe(r, 'HEMATOLOGIA').esperado, 30);
  assert.equal(L.plazoDe(r, 'NUTRICIÓN').vence, 45);
});

test('reglas: sin filas se usan los valores por defecto', () => {
  const r = L.reglasDesdeFilas(['ESPECIALIDAD'], []);
  assert.deepEqual(plano(r), { plazos: { '*': { esperado: 30, vence: 45 } }, espera: 15, maxSeguimientos: 3, corte: 180, corteIndicaciones: 180, metaRetorno: 60, esperaCotizacion: 7, diasEntreSesiones: 7, graciaAgenda: 2, metaDiaria: 15 });
});

test('reglas: META_DIARIA_SEGUIMIENTOS se lee de REGLAS', () => {
  assert.equal(L.reglasDesdeFilas(['PARAMETRO', 'VALOR'], [['META_DIARIA_SEGUIMIENTOS', 20]]).metaDiaria, 20);
});

test('reglas: VENCE nunca queda antes que ESPERADO', () => {
  const r = L.reglasDesdeFilas(['ESPECIALIDAD', 'ESPERADO_DIAS', 'VENCE_DIAS'], [['NUTRICION', 40, 20]]);
  assert.equal(L.plazoDe(r, 'NUTRICIÓN').vence, 40);
});

test('catalogosDesdeFilas lee usuarios, motivos y alias', () => {
  const c = plano(L.catalogosDesdeFilas(['USUARIOS', 'MOTIVOS_DESCARTE', 'MEDICO_ALIAS', 'MEDICO_NOMBRE'], [
    ['MAGALY', 'OTRO', 'Dr. ELI FABRIZIO CABANILLAS HUALPA', 'Dr. ELÍ FABRIZIO CABANILLAS HUALPA'],
    ['ANA', '', '', '']
  ]));
  assert.deepEqual(c, {
    usuarios: ['MAGALY', 'ANA'],
    motivos: ['OTRO'],
    alias: { 'DR. ELI FABRIZIO CABANILLAS HUALPA': 'Dr. ELÍ FABRIZIO CABANILLAS HUALPA' },
    doctores: [], procedimientos: [], tratamientos: [], marcas: {}
  });
});

test('AL DÍA, POR VENCER, VENCIDO y ANTIGUO según los días', () => {
  const c = [cita({ fecha: '2026-08-01' })];
  assert.equal(est(c, [], '2026-08-20'), 'AL DÍA');
  assert.equal(est(c, [], '2026-09-05'), 'POR VENCER');
  assert.equal(est(c, [], '2026-09-15'), 'VENCIDO');
  assert.equal(est(c, [], '2027-03-14'), 'VENCIDO');
  assert.equal(est(c, [], '2027-03-15'), 'ANTIGUO');
});

test('fechas calculadas de la serie', () => {
  const e = plano(L.estadoDeSerie(serieDe([cita({ fecha: '2026-08-01' })]), [], reglas(L), '2026-10-01'));
  assert.equal(e.ultima, '2026-08-01');
  assert.equal(e.esperada, '2026-08-31');
  assert.equal(e.vence, '2026-09-15');
  assert.equal(e.atraso, 16);
});

test('cita futura agendada → AGENDADO; agendada en el pasado no cuenta', () => {
  assert.equal(est([cita({ fecha: '2026-07-01' }), cita({ fecha: '2026-10-10', estado: 'AGENDADO' })], [], '2026-10-01'), 'AGENDADO');
  assert.equal(est([cita({ fecha: '2026-07-01' }), cita({ fecha: '2026-08-10', estado: 'AGENDADO' })], [], '2026-10-01'), 'VENCIDO');
});

test('«no contestó» → AGENDADO (reintentar) durante la espera; después vuelve a VENCIDO', () => {
  const c = [cita({ fecha: '2026-07-01' })];
  const e = plano(L.estadoDeSerie(serieDe(c), [seg({ fecha: '2026-09-20' })], reglas(L), '2026-10-01'));
  assert.equal(e.estado, 'AGENDADO');
  assert.deepEqual(e.agenda, { tipo: 'REINTENTAR', fecha: '2026-10-05', intento: 1 });
  assert.equal(est(c, [seg({ fecha: '2026-09-10' })], '2026-10-01'), 'VENCIDO');
  assert.equal(L.estadoDeSerie(serieDe(c), [seg({ fecha: '2026-09-10' })], reglas(L), '2026-10-01').intentos, 1);
});

test('tercer intento sin respuesta: AGENDADO (se cierra el…) durante su espera, luego CERRADO', () => {
  const c = [cita({ fecha: '2026-05-01' })];
  const s = [seg({ fecha: '2026-07-01' }), seg({ fecha: '2026-08-01' }), seg({ fecha: '2026-09-25' })];
  assert.equal(est(c, s, '2026-10-01'), 'AGENDADO');
  const e = plano(L.estadoDeSerie(serieDe(c), s, reglas(L), '2026-10-10'));
  assert.deepEqual([e.estado, e.cierre, e.fechaCierre], ['CERRADO', 'SIN RESPUESTA', '2026-10-10']);
});

test('descarte explícito → CERRADO con su motivo; si vuelve después, deja de estarlo', () => {
  const d = seg({ fecha: '2026-09-01', accion: 'DESCARTADO', motivo: 'SE ATIENDE EN OTRO LUGAR' });
  const e = plano(L.estadoDeSerie(serieDe([cita({ fecha: '2026-07-01' })]), [d], reglas(L), '2026-10-01'));
  assert.deepEqual([e.estado, e.cierre, e.fechaCierre], ['CERRADO', 'SE ATIENDE EN OTRO LUGAR', '2026-09-01']);
  assert.equal(est([cita({ fecha: '2026-07-01' }), cita({ fecha: '2026-09-20' })], [d], '2026-10-01'), 'AL DÍA');
});

test('fallecido va antes que el alta; sin contacto cierra; la cita de SOFDOC gana sobre «lo pensará»', () => {
  const c = [cita({ fecha: '2026-07-01' })];
  const s = serieDe(c);
  assert.equal(L.estadoDeSerie(s, [], reglas(L), '2026-10-01', { ID: 'ALT-1' }, { fallecido: true }).estado, 'FALLECIDO');
  const sc = plano(L.estadoDeSerie(s, [], reglas(L), '2026-10-01', null, { sinContacto: '2026-09-28' }));
  assert.deepEqual([sc.estado, sc.cierre, sc.fechaCierre], ['CERRADO', 'NÚMERO EQUIVOCADO', '2026-09-28']);
  const pensara = Object.assign(seg({ fecha: '2026-09-28' }), { RESULTADO: 'LO PENSARÁ', FECHA_PROXIMA: '2026-10-20' });
  const conCita = serieDe(c.concat([cita({ fecha: '2026-10-08', estado: 'AGENDADO' })]));
  assert.deepEqual(plano(L.estadoDeSerie(conCita, [pensara], reglas(L), '2026-10-01')).agenda, { tipo: 'CITA', fecha: '2026-10-08', intento: 0 });
  assert.deepEqual(plano(L.estadoDeSerie(s, [pensara], reglas(L), '2026-10-01')).agenda, { tipo: 'LLAMAR', fecha: '2026-10-20', intento: 0 });
});

test('agendó y vino: la consulta nueva abre otro ciclo (RECUPERADO)', () => {
  const ag = Object.assign(seg({ fecha: '2026-09-20' }), { RESULTADO: 'AGENDÓ CITA', FECHA_PROXIMA: '2026-09-25' });
  assert.equal(est([cita({ fecha: '2026-07-01' }), cita({ fecha: '2026-09-25' })], [ag], '2026-10-01'), 'RECUPERADO');
});

test('volvió tras un seguimiento → RECUPERADO hasta que vuelve a vencer', () => {
  const c = [cita({ fecha: '2026-07-01' }), cita({ fecha: '2026-09-10' })];
  const s = [seg({ fecha: '2026-08-20' })];
  assert.equal(est(c, s, '2026-10-01'), 'RECUPERADO');
  assert.equal(est(c, s, '2026-10-25'), 'VENCIDO');
});

test('especialidades separadas: nutrición no cuenta como reevaluación de hematología', () => {
  const s = L.armarSeries([cita({ fecha: '2026-07-01' }), cita({ fecha: '2026-09-25', esp: 'NUTRICIÓN' })]);
  assert.equal(Object.keys(s).length, 2);
  assert.equal(L.estadoDeSerie(s['40111222|HEMATOLOGIA'], [], reglas(L), '2026-10-01').estado, 'VENCIDO');
});

test('una serie solo con citas anuladas queda SIN ATENCIÓN', () => {
  assert.equal(est([cita({ fecha: '2026-07-01', estado: 'ANULADO' })], [], '2026-10-01'), 'SIN ATENCIÓN');
});

test('reglas: GRACIA_AGENDA_DIAS se lee de REGLAS', () => {
  const r = L.reglasDesdeFilas(['PARAMETRO', 'VALOR'], [['GRACIA_AGENDA_DIAS', 3]]);
  assert.equal(r.graciaAgenda, 3);
});

test('COLUMNAS_SEGUIMIENTOS y COLUMNAS_PACIENTES crecen solo al final', () => {
  const C = cargar(['Logica.gs', 'Registro.gs', 'Resultados.gs', 'Tablero.gs', 'Codigo.gs']);
  assert.deepEqual(plano(C.COLUMNAS_SEGUIMIENTOS), ['ID', 'FECHA_HORA', 'DNI', 'ESPECIALIDAD', 'RESPONSABLE', 'ACCION', 'MOTIVO', 'NOTA',
    'REFERENCIA', 'RESULTADO', 'FECHA_PROXIMA', 'TELEFONO', 'ANULADO', 'MOTIVO_ANULACION']);
  assert.deepEqual(plano(L.COLUMNAS_PACIENTES).slice(16), ['CIERRE', 'FECHA_CIERRE', 'AGENDA', 'FECHA_AGENDA', 'INTENTO']);
  assert.equal(C.COLUMNAS_FECHA.FECHA_PROXIMA, 1);
  assert.equal(C.COLUMNAS_FECHA.FECHA_AGENDA, 1);
  assert.equal(C.COLUMNAS_FECHA.FECHA_CIERRE, 1);
  assert.equal(C.COLUMNAS_NUMERICAS.INTENTO, 1);
});
