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

const { cita } = require('./fixtures');

test('armarPacientes: un número equivocado sin más contacto cierra; con otro teléfono sigue', () => {
  const citas = [cita({ fecha: '2026-07-01' })];
  const inds = [{ DNI: '40111222', TELEFONO: '987654321', FECHA: '2026-06-01', TIPO: 'HIERRO', ESTADO: 'ACEPTÓ' }];
  const marca = equivocado('2026-09-28', '987654321');
  const p = plano(L.armarPacientes(citas, inds, [marca], reglas(L), '2026-10-01'))[0];
  assert.deepEqual([p.ESTADO, p.CIERRE, p.FECHA_CIERRE, p.TELEFONOS], ['CERRADO', 'NÚMERO EQUIVOCADO', '2026-09-28', '']);
  const otro = inds.concat([{ DNI: '40111222', TELEFONO: '912345678', FECHA: '2026-06-01', TIPO: 'HIERRO', ESTADO: 'ACEPTÓ' }]);
  const q = plano(L.armarPacientes(citas, otro, [marca], reglas(L), '2026-10-01'))[0];
  assert.deepEqual([q.ESTADO, q.TELEFONOS], ['VENCIDO', '912345678']);
});

const CAT = { usuarios: ['MAGALY'], motivos: [], doctores: [{ doctor: 'Dra. Karen Matos', sofdoc: '' }] };
const TARJ = [{ DNI: '40111222', ESPECIALIDAD: 'HEMATOLOGÍA', TELEFONOS: '987654321 / 912345678' },
  { DNI: '40111222', ESPECIALIDAD: 'HIERRO', ID_REGISTRO: 'REG-000001', TELEFONOS: '' }];
const val = o => plano(L.validarResultado(Object.assign({ usuario: 'magaly', dni: '40111222', especialidad: 'Hematología', referencia: '',
  resultado: 'no contestó', nota: '' }, o), { catalogos: CAT, hoy: '2026-10-06', tarjetas: TARJ }));

test('validarResultado: mensajes de cada error', () => {
  assert.match(val({ usuario: 'X' }).error, /Elija quién es usted/);
  assert.match(val({ dni: '' }).error, /Falta el DNI/);
  assert.match(val({ especialidad: 'NUTRICIÓN' }).error, /no está en la lista/);
  assert.match(val({ resultado: 'quizás' }).error, /Elija qué pasó/);
  assert.match(val({ resultado: 'LO HIZO', fecha: '2026-10-06' }).error, /solo para hierro y procedimientos/);
  assert.match(val({ resultado: 'LO PENSARÁ' }).error, /Falta la fecha para volver a llamar/);
  assert.match(val({ resultado: 'LO PENSARÁ', fecha: '2026-10-06' }).error, /de mañana a 90 días/);
  assert.match(val({ resultado: 'AGENDÓ CITA', fecha: '2026-10-05' }).error, /de hoy a 180 días/);
  assert.match(val({ resultado: 'ALTA MÉDICA', doctor: 'Dr. Nadie' }).error, /Elija el doctor/);
  assert.match(val({ resultado: 'NÚMERO EQUIVOCADO' }).error, /Elija cuál teléfono/);
  assert.match(val({ resultado: 'NÚMERO EQUIVOCADO', telefono: '955555555' }).error, /no es de este paciente/);
  assert.match(val({ resultado: 'NO DESEA CONTINUAR', motivo: '  ' }).error, /Escriba el motivo/);
  assert.match(val({ especialidad: 'HIERRO', referencia: 'REG-000001', resultado: 'LO HIZO', fecha: '2026-10-07' }).error, /no puede ser futura/);
});

test('validarResultado: la fila que se guarda', () => {
  const v = val({ resultado: 'lo pensara', fecha: '2026-10-09', nota: ' llamar tarde ' });
  assert.equal(v.error, '');
  assert.deepEqual(v.fila, { DNI: '40111222', ESPECIALIDAD: 'HEMATOLOGÍA', RESPONSABLE: 'MAGALY', MOTIVO: '', NOTA: 'llamar tarde', REFERENCIA: '',
    RESULTADO: 'LO PENSARÁ', FECHA_PROXIMA: '2026-10-09', TELEFONO: '', ANULADO: '', MOTIVO_ANULACION: '' });
  const nd = val({ resultado: 'NO DESEA CONTINUAR', motivo: 'Lo ve otro médico', nota: 'amable' }).fila;
  assert.deepEqual([nd.MOTIVO, nd.NOTA], ['NO DESEA CONTINUAR', 'Motivo: Lo ve otro médico · amable']);
  const ne = val({ resultado: 'NÚMERO EQUIVOCADO', telefono: '51987654321' }).fila;
  assert.deepEqual([ne.MOTIVO, ne.TELEFONO], ['NÚMERO EQUIVOCADO', '987654321']);
  const al = val({ especialidad: 'HIERRO', referencia: 'REG-000001', resultado: 'ALTA MÉDICA', doctor: 'dra. karen matos' }).fila;
  assert.deepEqual([al.MOTIVO, al.NOTA, al.REFERENCIA], ['ALTA MÉDICA', 'Alta: Dra. Karen Matos', 'REG-000001']);
});

test('accionPara y validarAnulacionResultado', () => {
  assert.equal(L.accionPara('LO PENSARÁ', true), 'HECHO');
  assert.equal(L.accionPara('NÚMERO EQUIVOCADO', true), 'TELEFONO');
  assert.equal(L.accionPara('NÚMERO EQUIVOCADO', false), 'DESCARTADO');
  assert.equal(L.accionPara('FALLECIÓ', true), 'DESCARTADO');
  const a = Object.assign(res('2026-10-01', 'NO CONTESTÓ'), { ID: 'SEG-1' });
  const b = Object.assign(res('2026-10-03', 'LO PENSARÁ'), { ID: 'SEG-2' });
  const m = Object.assign(res('2026-10-02', 'FALLECIÓ', { ESPECIALIDAD: 'NUTRICIÓN' }), { ID: 'SEG-3' });
  assert.equal(L.validarAnulacionResultado('SEG-2', [a, b, m]), '');
  assert.match(L.validarAnulacionResultado('SEG-1', [a, b, m]), /Solo se puede anular el último/);
  assert.equal(L.validarAnulacionResultado('SEG-3', [a, b, m, Object.assign(res('2026-10-04', 'NO CONTESTÓ', { ESPECIALIDAD: 'NUTRICIÓN' }), { ID: 'SEG-4' })]), '', 'un falleció siempre se puede anular');
  assert.match(L.validarAnulacionResultado('SEG-9', [a]), /No encontré SEG-9/);
  assert.match(L.validarAnulacionResultado('SEG-1', [Object.assign({}, a, { ANULADO: 'SÍ' })]), /ya estaba anulado/);
});

test('resumenAntiguos cuenta las filas por clase', () => {
  const r = plano(L.resumenAntiguos([seg({ fecha: '2026-09-01' }), seg({ fecha: '2026-09-02', accion: 'DESCARTADO', motivo: 'OTRO' }),
    seg({ fecha: '2026-09-03', accion: 'DESCARTADO', motivo: 'FALLECIÓ' }), res('2026-10-01', 'LO PENSARÁ'),
    Object.assign(res('2026-10-02', 'NO CONTESTÓ'), { ANULADO: 'SÍ' })]));
  assert.deepEqual(r, { hechos: 1, descartes: 1, fallecidos: 1, nuevos: 1, anulados: 1 });
});

test('validarAnulacionResultado: una acción desconocida no rompe; solo se anula si es la última', () => {
  const raro = (id, h) => ({ ID: id, FECHA_HORA: h, DNI: '1', ESPECIALIDAD: 'HEMATOLOGÍA', ACCION: 'XYZ', REFERENCIA: '' });
  const lista = [raro('SEG-1', '2026-10-01 09:00'), raro('SEG-2', '2026-10-02 09:00')];
  assert.equal(L.validarAnulacionResultado('SEG-2', lista), '');
  assert.match(L.validarAnulacionResultado('SEG-1', lista), /Solo se puede anular el último/);
});

test('validarResultado: «Aceptó» y «No desea realizarse» solo en hierro y procedimiento; «Agendó cita» solo en reevaluación', () => {
  const t = (o) => Object.assign({ DNI: '40111222', ESPECIALIDAD: 'HIERRO', TIPO_SEGUIMIENTO: 'HIERRO', ID_REGISTRO: 'REG-000010', ESTADO: 'PENDIENTE',
    ESTADO_REGISTRO: 'COTIZADO' }, o);
  const d = tarjetas => ({ catalogos: { usuarios: ['MAGALY'], doctores: [] }, hoy: '2026-10-09', tarjetas });
  const p = o => Object.assign({ usuario: 'MAGALY', dni: '40111222', especialidad: 'HIERRO', referencia: 'REG-000010' }, o);
  const ok = L.validarResultado(p({ resultado: 'ACEPTÓ', fecha: '2026-10-12', sesiones: 3 }), d([t()]));
  assert.deepEqual([ok.error, ok.fila.RESULTADO, ok.fila.FECHA_PROXIMA, ok.fila.NOTA], ['', 'ACEPTÓ', '2026-10-12', 'Sesiones: 3']);
  assert.match(L.validarResultado(p({ resultado: 'ACEPTÓ', fecha: '2026-10-01' }), d([t()])).error, /de hoy a 180 días/);
  assert.match(L.validarResultado(p({ resultado: 'AGENDÓ CITA', fecha: '2026-10-12' }), d([t()])).error, /solo para reevaluaciones/);
  assert.equal(L.validarResultado(p({ resultado: 'AGENDÓ CITA', fecha: '2026-10-12' }), d([t({ ESTADO: 'POR REEVALUAR' })])).error, '');
  const no = L.validarResultado(p({ resultado: 'NO DESEA REALIZARSE', motivo: 'precio' }), d([t()]));
  assert.deepEqual([no.error, no.fila.MOTIVO, no.fila.NOTA], ['', 'NO DESEA REALIZARSE', 'Motivo: precio']);
  const reev = { DNI: '40111222', ESPECIALIDAD: 'HEMATOLOGÍA', TIPO_SEGUIMIENTO: 'REEVALUACION' };
  assert.match(L.validarResultado(p({ especialidad: 'HEMATOLOGÍA', referencia: '', resultado: 'ACEPTÓ', fecha: '2026-10-12' }), d([reev])).error,
    /solo para hierro y procedimientos/);
});

test('resultadoDe y leerCiclo: «No desea realizarse» cierra; «Aceptó» sigue', () => {
  const s = (r, o) => Object.assign({ ID: 'SEG-' + r, FECHA_HORA: '2026-10-09 10:00', RESULTADO: r, ANULADO: '' }, o);
  assert.equal(L.resultadoDe(s('NO DESEA REALIZARSE')).grupo, 'CIERRE');
  assert.equal(L.resultadoDe(s('ACEPTÓ', { FECHA_PROXIMA: '2026-10-12' })).grupo, 'SIGUE');
  assert.equal(L.leerCiclo([s('NO DESEA REALIZARSE')], reglas(L), '2026-10-09').cierre.motivo, 'NO DESEA REALIZARSE');
});

test('validarResultado: «Aceptó» solo en un registro cotizado o programado; en curso, «Agendó cita» agenda la próxima sesión', () => {
  const t = (o) => Object.assign({ DNI: '40111222', ESPECIALIDAD: 'HIERRO', TIPO_SEGUIMIENTO: 'HIERRO', ID_REGISTRO: 'REG-000010', ESTADO: 'PENDIENTE',
    ESTADO_REGISTRO: 'EN CURSO', HECHAS: 1, SESIONES: 3 }, o);
  const d = tarjetas => ({ catalogos: { usuarios: ['MAGALY'], doctores: [] }, hoy: '2026-10-09', tarjetas });
  const p = o => Object.assign({ usuario: 'MAGALY', dni: '40111222', especialidad: 'HIERRO', referencia: 'REG-000010' }, o);
  assert.equal(L.validarResultado(p({ resultado: 'ACEPTÓ', fecha: '2026-10-12' }), d([t()])).error,
    'El tratamiento ya empezó: use «Agendó cita» para la próxima sesión.');
  const ag = L.validarResultado(p({ resultado: 'AGENDÓ CITA', fecha: '2026-10-12' }), d([t()]));
  assert.deepEqual([ag.error, ag.fila.FECHA_PROXIMA, ag.fila.REFERENCIA], ['', '2026-10-12', 'REG-000010']);
  assert.equal(L.validarResultado(p({ resultado: 'ACEPTÓ', fecha: '2026-10-12' }), d([t({ ESTADO_REGISTRO: 'PROGRAMADO', HECHAS: 0 })])).error, '');
  assert.match(L.validarResultado(p({ resultado: 'AGENDÓ CITA', fecha: '2026-10-12' }), d([t({ ESTADO_REGISTRO: 'COTIZADO', HECHAS: 0 })])).error,
    /solo para reevaluaciones/);
});
