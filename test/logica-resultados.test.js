// Resultados de «¿Qué pasó?» y ciclo de intentos. Datos inventados.
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar, plano } = require('./cargar');
const { seg, reglas } = require('./fixtures');
const L = cargar();
const R = Object.assign(reglas(L), { maxSeguimientos: 2 });

const res = (fecha, resultado, o) => Object.assign(seg({ fecha }), { RESULTADO: resultado, ACCION: 'HECHO' }, o);

test('resultadoDe: fila nueva, con tildes o sin ellas', () => {
  const r = plano(L.resultadoDe(res('2026-10-01', 'lo pensara', { FECHA_PROXIMA: '2026-10-09' })));
  assert.deepEqual([r.resultado, r.grupo, r.fecha, r.fechaProxima, r.antiguo], ['LO PENSARÁ', 'SIGUE', '2026-10-01', '2026-10-09', false]);
  assert.equal(L.resultadoDe(res('2026-10-01', 'Agendó cita')).resultado, 'AGENDÓ CITA');
});

test('resultadoDe: filas antiguas sin RESULTADO', () => {
  assert.deepEqual(plano(L.resultadoDe(seg({ fecha: '2026-09-01' }))).resultado, 'NO CONTESTÓ');
  assert.equal(L.resultadoDe(seg({ fecha: '2026-09-01' })).antiguo, true);
  const f = plano(L.resultadoDe(seg({ fecha: '2026-09-01', accion: 'DESCARTADO', motivo: 'Falleció' })));
  assert.deepEqual([f.resultado, f.grupo, f.motivo], ['FALLECIÓ', 'CIERRE', 'FALLECIÓ']);
  const o = plano(L.resultadoDe(seg({ fecha: '2026-09-01', accion: 'DESCARTADO', motivo: 'SE ATIENDE EN OTRO LUGAR' })));
  assert.deepEqual([o.resultado, o.grupo, o.motivo], ['DESCARTADO', 'CIERRE', 'SE ATIENDE EN OTRO LUGAR']);
});

test('resultadoDe: anulada o desconocida no cuenta; número equivocado sin teléfono es un cierre', () => {
  assert.equal(L.resultadoDe(res('2026-10-01', 'NO CONTESTÓ', { ANULADO: 'SÍ' })), null);
  assert.equal(L.resultadoDe(Object.assign(seg({ fecha: '2026-10-01' }), { ACCION: 'TELEFONO' })), null);
  assert.equal(L.resultadoDe(res('2026-10-01', 'NÚMERO EQUIVOCADO', { TELEFONO: '987654321' })).grupo, 'TELEFONO');
  assert.equal(L.resultadoDe(res('2026-10-01', 'NÚMERO EQUIVOCADO', { TELEFONO: '' })).grupo, 'CIERRE');
});

test('leerCiclo: sin filas', () => {
  assert.deepEqual(plano(L.leerCiclo([], R, '2026-10-05')), { intentos: 0, ultimo: '', cierre: null, agenda: null, loHizo: '' });
});

test('leerCiclo: un «no contestó» espera la reintentada; pasada la espera ya no hay agenda', () => {
  const c = plano(L.leerCiclo([res('2026-10-01', 'NO CONTESTÓ')], R, '2026-10-05'));
  assert.deepEqual(c.agenda, { tipo: 'REINTENTAR', fecha: '2026-10-16', intento: 1 });
  assert.equal(c.intentos, 1);
  assert.equal(L.leerCiclo([res('2026-10-01', 'NO CONTESTÓ')], R, '2026-10-16').agenda, null);
});

test('leerCiclo: dos «no contestó» seguidos se cierran solos al cumplir la espera', () => {
  const dos = [res('2026-09-01', 'NO CONTESTÓ'), res('2026-09-20', 'NO CONTESTÓ')];
  assert.deepEqual(plano(L.leerCiclo(dos, R, '2026-10-01')).agenda, { tipo: 'SIN RESPUESTA', fecha: '2026-10-05', intento: 2 });
  assert.deepEqual(plano(L.leerCiclo(dos, R, '2026-10-05')).cierre, { motivo: 'SIN RESPUESTA', fecha: '2026-10-05', quien: '' });
});

test('leerCiclo: «lo pensará» en medio reinicia la cuenta', () => {
  const s = [res('2026-09-01', 'NO CONTESTÓ'), res('2026-09-05', 'LO PENSARÁ', { FECHA_PROXIMA: '2026-09-10' }), res('2026-09-20', 'NO CONTESTÓ')];
  const c = plano(L.leerCiclo(s, R, '2026-10-01'));
  assert.equal(c.cierre, null);
  assert.deepEqual(c.agenda, { tipo: 'REINTENTAR', fecha: '2026-10-05', intento: 1 });
  assert.equal(c.intentos, 3);
});

test('leerCiclo: lo pensará y agendó, con su fecha y la gracia', () => {
  const p = [res('2026-10-01', 'LO PENSARÁ', { FECHA_PROXIMA: '2026-10-08' })];
  assert.deepEqual(plano(L.leerCiclo(p, R, '2026-10-07')).agenda, { tipo: 'LLAMAR', fecha: '2026-10-08', intento: 0 });
  assert.equal(L.leerCiclo(p, R, '2026-10-08').agenda, null, 'el día de llamar vuelve a Por contactar');
  const a = [res('2026-10-01', 'AGENDÓ CITA', { FECHA_PROXIMA: '2026-10-08' })];
  assert.equal(L.leerCiclo(a, R, '2026-10-10').agenda.tipo, 'CITA', 'gracia de 2 días');
  assert.equal(L.leerCiclo(a, R, '2026-10-11').agenda, null);
});

test('leerCiclo: cierre, lo hizo, y el número equivocado no decide', () => {
  const c = [res('2026-09-01', 'SE ATIENDE EN OTRO LUGAR', { ACCION: 'DESCARTADO', RESPONSABLE: 'RACHEL' }),
    res('2026-09-02', 'NÚMERO EQUIVOCADO', { ACCION: 'TELEFONO', TELEFONO: '987654321' })];
  assert.deepEqual(plano(L.leerCiclo(c, R, '2026-10-01')).cierre, { motivo: 'SE ATIENDE EN OTRO LUGAR', fecha: '2026-09-01', quien: 'RACHEL' });
  assert.equal(L.leerCiclo(c, R, '2026-10-01').ultimo, '2026-09-02');
  assert.equal(L.leerCiclo([res('2026-10-01', 'LO HIZO', { FECHA_PROXIMA: '2026-09-30' })], R, '2026-10-05').loHizo, '2026-09-30');
  const nd = res('2026-10-01', 'NO DESEA CONTINUAR', { ACCION: 'DESCARTADO', MOTIVO: 'NO DESEA CONTINUAR' });
  assert.equal(L.leerCiclo([nd], R, '2026-10-05').cierre.motivo, 'NO DESEA CONTINUAR');
});

const equivocado = (fecha, tel, dni) => res(fecha, 'NÚMERO EQUIVOCADO', { TELEFONO: tel, ACCION: 'TELEFONO', DNI: dni || '40111222' });

test('telefonosPorDni: quita el número marcado; vuelve si llega por un registro posterior', () => {
  const inds = [{ DNI: '40111222', TELEFONO: '987654321', FECHA: '2026-09-01' }, { DNI: '40111222', TELEFONO: '912345678', FECHA: '2026-09-01' }];
  const contactos = [{ DNI_PACIENTE: '40111222', TELEFONO: '51987654321' }];
  const segs = [equivocado('2026-10-01', '987654321')];
  assert.deepEqual(plano(L.telefonosPorDni(inds, contactos, segs)), { 40111222: ['912345678'] });
  assert.deepEqual(plano(L.telefonosPorDni(inds, contactos)), { 40111222: ['987654321', '912345678'] }, 'sin seguimientos, como antes');
  const nuevo = inds.concat([{ DNI: '40111222', TELEFONO: '987654321', FECHA: '2026-10-03', ORIGEN: 'REGISTROS' }]);
  assert.deepEqual(plano(L.telefonosPorDni(nuevo, [], segs))['40111222'], ['912345678', '987654321']);
  const anulado = [Object.assign(equivocado('2026-10-01', '987654321'), { ANULADO: 'SÍ' })];
  assert.deepEqual(plano(L.telefonosPorDni(inds, [], anulado))['40111222'], ['987654321', '912345678']);
});

test('sinContacto_ y telefonosDescartados', () => {
  const marcas = L.marcasTelefono([equivocado('2026-09-20', '987654321'), equivocado('2026-10-01', '912345678')]);
  assert.deepEqual(plano(marcas), { 40111222: { 987654321: '2026-09-20', 912345678: '2026-10-01' } });
  assert.equal(L.sinContacto_('40111222', marcas, {}, ''), '2026-10-01');
  assert.equal(L.sinContacto_('40111222', marcas, { 40111222: ['955555555'] }, ''), '', 'le queda otro');
  assert.equal(L.sinContacto_('40111222', marcas, {}, '@rosa.q'), '', 'le queda el usuario');
  assert.equal(L.sinContacto_('40999888', marcas, {}, ''), '', 'nunca tuvo teléfono: no es «sin contacto»');
  assert.deepEqual(plano(L.telefonosDescartados(marcas, { 40111222: ['912345678'] })), { 40111222: ['987654321'] });
});

test('fallecidos: filas nuevas y antiguas; la anulada no cuenta', () => {
  const nueva = res('2026-10-01', 'FALLECIÓ', { ACCION: 'DESCARTADO', MOTIVO: 'FALLECIÓ', ID: 'SEG-9', RESPONSABLE: 'RACHEL' });
  const antigua = seg({ dni: '40333444', fecha: '2026-08-01', accion: 'DESCARTADO', motivo: 'FALLECIÓ' });
  const anulada = Object.assign(res('2026-10-02', 'FALLECIÓ', { DNI: '40555666' }), { ANULADO: 'SÍ' });
  assert.deepEqual(plano(L.fallecidos([nueva, antigua, anulada])), {
    40111222: { fecha: '2026-10-01', quien: 'RACHEL', id: 'SEG-9' },
    40333444: { fecha: '2026-08-01', quien: 'MAGALY', id: antigua.ID }
  });
});
