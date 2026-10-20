// Enfermería: la primera sesión ya aplicada (A) y el seguimiento tras cada sesión de hierro (B). Datos inventados.
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar, plano } = require('./cargar');
const { reglas } = require('./fixtures');
const L = cargar(['Logica.gs', 'Registro.gs', 'Resultados.gs', 'Tablero.gs', 'Enfermeria.gs']);
const HOY = '2026-10-10';
const R = reglas(L);

/* ---------------- A. Primera sesión con fecha pasada ---------------- */

const CAT = L.catalogosDesdeFilas(['USUARIOS', 'DOCTOR', 'DOCTOR_SOFDOC', 'TRATAMIENTOS', 'PROCEDIMIENTOS', 'REACCIONES'],
  [['MAGALY', 'Dra. Karen Matos', 'Dra. KAREN DIANA MATOS PEÑA', 'HIERRO SACARATO', 'SANGRÍA', 'Náuseas'],
   ['ENFERMERA PRUEBA', '', '', '', '', 'Cefalea'], ['', '', '', '', '', 'Otra']]);
const reg = o => Object.assign({ usuario: 'magaly', fecha: '2026-10-08', dni: '40111222', nombre: 'Rosa Quispe', contacto: '987654321',
  doctor: 'Dra. Karen Matos', procedimiento: '', tratamiento: 'HIERRO SACARATO', sesiones: '3', marca: '' }, o);

test('A: primera sesión pasada (desde la fecha del registro): se programa y se marca la sesión 1 hecha', () => {
  const v = plano(L.validarRegistro(reg({ fechaInicio: '2026-10-09' }), CAT, HOY));
  assert.equal(v.error, '');
  assert.equal(v.sesionHecha, '2026-10-09');
  assert.equal(v.filas[0].FECHA_INICIO, '2026-10-09');
  assert.equal(plano(L.validarRegistro(reg({ fechaInicio: '2026-10-08' }), CAT, HOY)).sesionHecha, '2026-10-08', 'el mismo día del registro vale');
});

test('A: primera sesión anterior a la fecha del registro: se rechaza', () => {
  assert.equal(L.validarRegistro(reg({ fechaInicio: '2026-10-07' }), CAT, HOY).error,
    'La primera sesión no puede ser anterior a la fecha del registro (08/10/2026).');
});

test('A: hoy o futura: programada como siempre, sin sesión hecha', () => {
  const h = plano(L.validarRegistro(reg({ fechaInicio: HOY }), CAT, HOY));
  assert.deepEqual([h.error, h.sesionHecha, h.filas[0].FECHA_INICIO], ['', '', HOY]);
  const f = plano(L.validarRegistro(reg({ fechaInicio: '2026-10-20' }), CAT, HOY));
  assert.deepEqual([f.error, f.sesionHecha, f.filas[0].FECHA_INICIO], ['', '', '2026-10-20']);
  assert.match(L.validarRegistro(reg({ fechaInicio: '2027-06-01' }), CAT, HOY).error, /180 días/);
  assert.equal(plano(L.validarRegistro(reg({}), CAT, HOY)).sesionHecha, '', 'sin fecha: cotizado');
});

/* ---------------- B. Contactos de enfermería ---------------- */

test('reglas: ENFERMERIA_DIAS («1,3,5») y ENFERMERIA_CORTE_DIAS (10); catálogo de reacciones', () => {
  assert.deepEqual(plano(R.diasEnfermeria), [1, 3, 5]);
  assert.equal(R.corteEnfermeria, 10);
  const r = L.reglasDesdeFilas(['PARAMETRO', 'VALOR'], [['ENFERMERIA_DIAS', '1, 2,7'], ['ENFERMERIA_CORTE_DIAS', 4]]);
  assert.deepEqual([plano(r.diasEnfermeria), r.corteEnfermeria], [[1, 2, 7], 4]);
  assert.deepEqual(plano(L.reglasDesdeFilas(['PARAMETRO', 'VALOR'], [['ENFERMERIA_DIAS', 'nada']]).diasEnfermeria), [1, 3, 5], 'sin números, los de siempre');
  assert.deepEqual(plano(CAT.reacciones), ['Náuseas', 'Cefalea', 'Otra']);
  assert.ok(plano(L.catalogosDesdeFilas(['USUARIOS'], [['MAGALY']]).reacciones).includes('Flebitis'), 'sin la columna, la lista inicial');
  assert.equal(plano(L.REACCIONES_INICIALES).length, 14);
});

const REG = (id, o) => Object.assign({ ID: id, FECHA: '2026-10-01', DNI: '40111222', NOMBRE: 'ROSA QUISPE', CONTACTO: '987654321', TIPO: 'HIERRO',
  DETALLE: 'HIERRO CARBOXIMALTOSA', MARCA: 'FERINJECT', SESIONES: '3', ANULADO: '', DOCTOR: 'Dra. Karen Matos' }, o);
const SES = (id, reg, n, fecha, o) => Object.assign({ ID: id, ID_REGISTRO: reg, NUMERO: String(n), FECHA: fecha, FECHA_HORA: fecha + ' 11:00', ASESORA: 'MAGALY', ANULADO: '' }, o);
const ENF = (id, ses, dia, resultado, o) => Object.assign({ ID: id, FECHA_HORA: HOY + ' 09:00', ID_REGISTRO: 'REG-000001', ID_SESION: ses, NUMERO_SESION: 1,
  DNI: '40111222', DIA: dia, RESULTADO: resultado, REACCION_TIPO: 'NINGUNA', REACCION: '', NOTA: '', ENFERMERA: 'ENFERMERA PRUEBA', ANULADO: '' }, o);
const contactos = o => plano(L.contactosEnfermeria(Object.assign({ registros: [REG('REG-000001')], sesiones: [SES('SES-000001', 'REG-000001', 1, '2026-10-07')],
  enfermeria: [], seguimientos: [], hoy: HOY, reglas: R, telefonos: { '40111222': ['987654321'] }, catalogos: CAT }, o)));

test('contactosEnfermeria: sesión + 1, + 3 y + 5 días, en orden de llamada (vencidos, hoy, próximos)', () => {
  const c = contactos();
  assert.deepEqual(c.map(x => [x.DIA, x.FECHA, x.GRUPO]), [[1, '2026-10-08', 'VENCIDO'], [3, '2026-10-10', 'HOY'], [5, '2026-10-12', 'PROXIMO']]);
  assert.deepEqual([c[0].CLAVE, c[0].ID_REGISTRO, c[0].ID_SESION, c[0].NUMERO_SESION, c[0].NOMBRE, c[0].TELEFONOS, c[0].TRATAMIENTO, c[0].MARCA, c[0].SESIONES, c[0].NO_CONTESTO],
    ['SES-000001|1', 'REG-000001', 'SES-000001', 1, 'ROSA QUISPE', '987654321', 'Hierro carboximaltosa', 'Ferinject', 3, 0]);
  // Dos sesiones: el vencido más antiguo primero; dentro de un mismo día, por nombre.
  const dos = contactos({ registros: [REG('REG-000001'), REG('REG-000002', { DNI: '40999888', NOMBRE: 'ANA FLORES' })],
    sesiones: [SES('SES-000001', 'REG-000001', 1, '2026-10-07'), SES('SES-000002', 'REG-000002', 1, '2026-10-07'), SES('SES-000003', 'REG-000001', 2, '2026-10-09')] });
  assert.deepEqual(dos.map(x => x.CLAVE), ['SES-000002|1', 'SES-000001|1', 'SES-000002|3', 'SES-000001|3', 'SES-000003|1',
    'SES-000002|5', 'SES-000001|5', 'SES-000003|3', 'SES-000003|5']);
});

test('contactosEnfermeria: «contactado» lo cumple; «no contestó» lo deja con su cuenta; las anuladas no cuentan', () => {
  const c = contactos({ enfermeria: [ENF('ENF-000001', 'SES-000001', 1, 'CONTACTADO', { REACCION_TIPO: 'MEDIATA', REACCION: 'Cefalea · Náuseas' }),
    ENF('ENF-000002', 'SES-000001', 3, 'NO CONTESTO'), ENF('ENF-000003', 'SES-000001', 3, 'NO CONTESTO'),
    ENF('ENF-000004', 'SES-000001', 5, 'CONTACTADO', { ANULADO: 'SÍ' })] });
  assert.deepEqual(c.map(x => [x.DIA, x.NO_CONTESTO]), [[3, 2], [5, 0]]);
  assert.deepEqual(c[0].REACCIONES, [{ DIA: 1, TIPO: 'MEDIATA', REACCION: 'Cefalea · Náuseas' }], 'la reacción de un contacto previo de esa sesión');
  // La reacción durante la aplicación (DIA 0) también se muestra.
  const a = contactos({ enfermeria: [ENF('ENF-000005', 'SES-000001', 0, 'CONTACTADO', { REACCION_TIPO: 'INMEDIATA', REACCION: 'Mareo' })] });
  assert.deepEqual(a[0].REACCIONES, [{ DIA: 0, TIPO: 'INMEDIATA', REACCION: 'Mareo' }]);
  assert.equal(a.length, 3, 'el DIA 0 no cumple ningún contacto');
});

test('contactosEnfermeria: no muestra registros o sesiones anulados, otros tipos, fallecidos, lo viejo ni lo lejano', () => {
  assert.equal(contactos({ registros: [REG('REG-000001', { ANULADO: 'SÍ' })] }).length, 0);
  assert.equal(contactos({ sesiones: [SES('SES-000001', 'REG-000001', 1, '2026-10-07', { ANULADO: 'SÍ' })] }).length, 0);
  assert.equal(contactos({ registros: [REG('REG-000001', { TIPO: 'PROCEDIMIENTO' })] }).length, 0, 'solo hierro');
  const muerto = { ID: 'SEG-1', FECHA_HORA: '2026-10-09 10:00', DNI: '40111222', ESPECIALIDAD: 'HEMATOLOGÍA', ACCION: 'DESCARTADO', RESULTADO: 'FALLECIÓ', ANULADO: '' };
  assert.equal(contactos({ seguimientos: [muerto] }).length, 0);
  // Corte: lo que tocaba hace más de ENFERMERIA_CORTE_DIAS no se muestra; lo que toca en más de 7 días, todavía no.
  const viejo = contactos({ sesiones: [SES('SES-000001', 'REG-000001', 1, '2026-09-27')] });
  assert.deepEqual(viejo.map(x => [x.DIA, x.FECHA]), [[3, '2026-09-30'], [5, '2026-10-02']], 'el día 1 (28/09) tocaba hace 12 días');
  const lejos = contactos({ sesiones: [SES('SES-000001', 'REG-000001', 1, '2026-10-14')] });
  assert.deepEqual(lejos.map(x => x.DIA), [1, 3], 'el día 5 (19/10) toca en 9 días');
});

const val = (p, o) => plano(L.validarContactoEnfermeria(Object.assign({ usuario: 'enfermera prueba', clave: 'SES-000001|3', resultado: 'CONTACTADO',
  reaccionTipo: 'NINGUNA', reacciones: [], nota: '' }, p), Object.assign({ catalogos: CAT, hoy: HOY, contactos: contactos() }, o)));

test('validarContactoEnfermeria: la fila que se guarda', () => {
  const v = val({});
  assert.equal(v.error, '');
  assert.deepEqual(v.fila, { ID_REGISTRO: 'REG-000001', ID_SESION: 'SES-000001', NUMERO_SESION: 1, DNI: '40111222', DIA: 3, RESULTADO: 'CONTACTADO',
    REACCION_TIPO: 'NINGUNA', REACCION: '', NOTA: '', ENFERMERA: 'ENFERMERA PRUEBA', ANULADO: '', MOTIVO_ANULACION: '' });
  const r = val({ reaccionTipo: 'mediata', reacciones: ['cefalea', 'Náuseas'], nota: ' leve ' });
  assert.deepEqual([r.error, r.fila.REACCION_TIPO, r.fila.REACCION, r.fila.NOTA], ['', 'MEDIATA', 'Cefalea · Náuseas', 'leve']);
  const n = val({ resultado: 'no contesto', reaccionTipo: 'INMEDIATA', reacciones: ['Cefalea'] });
  assert.deepEqual([n.error, n.fila.RESULTADO, n.fila.REACCION_TIPO, n.fila.REACCION], ['', 'NO CONTESTO', '', ''], 'sin contacto no hay reacción que registrar');
});

test('validarContactoEnfermeria: mensajes de cada error', () => {
  assert.match(val({ usuario: 'X' }).error, /Elija quién es usted/);
  assert.match(val({ clave: 'SES-000009|1' }).error, /ya no está en la lista/);
  assert.match(val({ resultado: 'TAL VEZ' }).error, /Elija si contestó/);
  assert.match(val({ reaccionTipo: 'GRAVE' }).error, /Elija si tuvo reacción/);
  assert.match(val({ reaccionTipo: 'INMEDIATA' }).error, /Elija al menos una reacción/);
  assert.match(val({ reaccionTipo: 'INMEDIATA', reacciones: ['Dolor de muelas'] }).error, /no está en el catálogo/);
  assert.match(val({ reaccionTipo: 'MEDIATA', reacciones: ['Otra'] }).error, /Escriba cuál fue la reacción/);
  assert.equal(val({ reaccionTipo: 'MEDIATA', reacciones: ['Otra'], nota: 'Hormigueo' }).error, '');
});

test('reaccionAplicacion y validarAnulacionEnfermeria', () => {
  assert.deepEqual(plano(L.reaccionAplicacion(null, CAT)), { error: '', fila: null }, 'sin reacción, nada');
  assert.deepEqual(plano(L.reaccionAplicacion({ hubo: false }, CAT)), { error: '', fila: null });
  const r = plano(L.reaccionAplicacion({ hubo: true, reacciones: ['Mareo', 'Náuseas'] }, CAT));
  assert.match(r.error, /no está en el catálogo/, 'Mareo no está en este catálogo de prueba');
  const ok = plano(L.reaccionAplicacion({ hubo: true, reacciones: ['Náuseas'], nota: 'al minuto' }, CAT));
  assert.deepEqual(ok, { error: '', fila: { DIA: 0, RESULTADO: 'CONTACTADO', REACCION_TIPO: 'INMEDIATA', REACCION: 'Náuseas', NOTA: 'al minuto' } });
  assert.match(L.reaccionAplicacion({ hubo: true, reacciones: [] }, CAT).error, /Elija al menos una reacción/);
  const filas = [ENF('ENF-000001', 'SES-000001', 1, 'CONTACTADO'), ENF('ENF-000002', 'SES-000001', 3, 'NO CONTESTO', { ANULADO: 'SÍ' })];
  assert.equal(L.validarAnulacionEnfermeria('ENF-000001', filas), '');
  assert.match(L.validarAnulacionEnfermeria('ENF-000002', filas), /ya estaba anulado/);
  assert.match(L.validarAnulacionEnfermeria('ENF-000009', filas), /No encontré/);
});

test('cifrasEnfermeria: pacientes con reacción por tipo y contactos a tiempo, por mes de la sesión y médico', () => {
  const regs = [REG('REG-000001'), REG('REG-000002', { DNI: '40999888' })];
  const ses = [SES('SES-000001', 'REG-000001', 1, '2026-10-01'), SES('SES-000002', 'REG-000002', 1, '2026-10-02'), SES('SES-000003', 'REG-000001', 2, '2026-09-20')];
  const enf = [
    ENF('ENF-1', 'SES-000001', 0, 'CONTACTADO', { REACCION_TIPO: 'INMEDIATA', REACCION: 'Náuseas' }),
    ENF('ENF-2', 'SES-000001', 1, 'CONTACTADO', { FECHA_HORA: '2026-10-02 09:00', REACCION_TIPO: 'MEDIATA', REACCION: 'Cefalea' }),   // a tiempo
    ENF('ENF-3', 'SES-000001', 3, 'CONTACTADO', { FECHA_HORA: '2026-10-06 09:00' }),                                              // tarde (tocaba el 04)
    ENF('ENF-4', 'SES-000002', 1, 'CONTACTADO', { DNI: '40999888', ID_REGISTRO: 'REG-000002', FECHA_HORA: '2026-10-03 10:00', REACCION_TIPO: 'MEDIATA', REACCION: 'Mareo' }),
    ENF('ENF-5', 'SES-000002', 3, 'NO CONTESTO', { DNI: '40999888', ID_REGISTRO: 'REG-000002', FECHA_HORA: '2026-10-05 10:00' })];
  const c = plano(L.cifrasEnfermeria({ registros: regs, sesiones: ses, enfermeria: enf, hoy: HOY, reglas: R, catalogos: CAT }));
  const oct = c['2026-10|Dra. KAREN DIANA MATOS PEÑA'];
  // Octubre: 2 sesiones × 3 días; ya tocaban (hasta hoy, 10/10) los 6; a tiempo: SES-1 día 1 y SES-2 día 1.
  assert.deepEqual(oct, { REAC_PAC: 2, REAC_INM: 1, REAC_MED: 2, ENF_DEBIDOS: 6, ENF_A_TIEMPO: 2 });
  assert.deepEqual(c['2026-09|Dra. KAREN DIANA MATOS PEÑA'], { REAC_PAC: 0, REAC_INM: 0, REAC_MED: 0, ENF_DEBIDOS: 3, ENF_A_TIEMPO: 0 });
  const filas = plano(L.resumenConEnfermeria([{ MES: '2026-10', MEDICO: 'Dra. KAREN DIANA MATOS PEÑA', HIERRO: 2 }], c));
  assert.equal(filas.find(f => f.MES === '2026-10').ENF_A_TIEMPO, 2);
  assert.equal(filas.find(f => f.MES === '2026-09').ENF_DEBIDOS, 3, 'un mes sin fila en el resumen se agrega');
  assert.ok(plano(L.CAMPOS_RESUMEN).slice(-5).join() === 'REAC_PAC,REAC_INM,REAC_MED,ENF_DEBIDOS,ENF_A_TIEMPO', 'campos nuevos al final');
});
