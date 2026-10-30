// «Recién registrados · en espera» y el buscador del tablero cuando no hay tarjeta (29/10/2026). Datos inventados.
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar, plano } = require('./cargar');
const { cita, reglas } = require('./fixtures');
const L = cargar();
const HOY = '2026-10-29';
const CAT = L.catalogosDesdeFilas(['USUARIOS', 'DOCTOR', 'DOCTOR_SOFDOC'], [['RACHEL', 'Dra. Karen Matos', 'Dra. KAREN DIANA MATOS PEÑA']]);

// El caso de Rachel: un hierro (Ferinject × 1) registrado ayer, sin fecha de primera sesión.
const REG = o => Object.assign({ ID: 'REG-000050', FECHA_HORA: '2026-10-28 16:20', FECHA: '2026-10-28', ASESORA: 'RACHEL', DOCTOR: 'Dra. Karen Matos',
  NOMBRE: 'LUCÍA PRUEBA ÑAHUI', DNI: '07123456', CONTACTO: '987111222', TIPO: 'HIERRO', DETALLE: 'HIERRO CARBOXIMALTOSA', MARCA: 'FERINJECT',
  SESIONES: '1', ANULADO: '', FECHA_INICIO: '' }, o);
const SEG = o => Object.assign({ ID: 'SEG-1', FECHA_HORA: HOY + ' 10:00', DNI: '7123456', ESPECIALIDAD: 'HIERRO', RESPONSABLE: 'RACHEL', ACCION: 'HECHO',
  MOTIVO: '', NOTA: '', REFERENCIA: 'REG-000050', RESULTADO: 'NO CONTESTÓ', FECHA_PROXIMA: '', TELEFONO: '', ANULADO: '' }, o);
const pend = (registros, segs, hoy) => plano(L.pendientesRegistro({ registros, sesiones: [], seguimientos: segs || [], citas: [], reglas: reglas(L),
  hoy: hoy || HOY, telefonos: {}, catalogos: CAT }));
const tablero = (pendientes, hoy) => plano(L.armarTablero({ pacientes: [], pendientes, seguimientos: [], citas: [], vigentes: {}, reglas: reglas(L), hoy: hoy || HOY }));

test('pendientesRegistro: el cotizado en espera dice hasta cuándo (FIN_ESPERA = FECHA + ESPERA_COTIZACION_DIAS)', () => {
  const f = pend([REG()])[0];
  assert.deepEqual([f.ESTADO, f.DIAS, f.FIN_ESPERA], ['EN ESPERA', 1, '2026-11-04']);
  assert.equal(pend([REG()], [], '2026-11-04')[0].ESTADO, 'PENDIENTE', 'vencida la espera, a Por contactar');
  assert.equal(pend([REG()], [], '2026-11-04')[0].FIN_ESPERA, '', 'solo mientras espera');
});

test('pendientesRegistro: un resultado durante la espera adelanta el ciclo (la espera termina al primer contacto)', () => {
  // «No contestó»: a Contactado, como siempre.
  const nc = pend([REG()], [SEG()])[0];
  assert.deepEqual([nc.ESTADO, nc.AGENDA, nc.N_SEGUIMIENTOS], ['AGENDADO', 'REINTENTAR', 1]);
  // «Lo pensará» con la fecha ya pasada y la espera sin vencer: vuelve a Por contactar, no a «en espera».
  const lp = pend([REG({ FECHA: '2026-10-25' })], [SEG({ FECHA_HORA: '2026-10-26 10:00', RESULTADO: 'LO PENSARÁ', FECHA_PROXIMA: '2026-10-28' })])[0];
  assert.deepEqual([lp.ESTADO, lp.FIN_ESPERA], ['PENDIENTE', '']);
  // «Pagó»: Pago realizado (antes se quedaba «en espera», invisible).
  const pg = pend([REG()], [SEG({ ACCION: 'PAGO', RESULTADO: 'PAGO', FECHA_PROXIMA: HOY })])[0];
  assert.deepEqual([pg.ESTADO, pg.FECHA_PAGO], ['PAGO REALIZADO', HOY]);
  // Un cierre: cerrado.
  const nd = pend([REG()], [SEG({ ACCION: 'DESCARTADO', RESULTADO: 'NO DESEA REALIZARSE', MOTIVO: 'NO DESEA REALIZARSE' })])[0];
  assert.equal(nd.ESTADO, 'CERRADO');
});

test('armarTablero: los en espera van en su propio grupo (enEspera), fuera de la cifra de Por contactar', () => {
  const hoyMismo = pend([REG({ ID: 'REG-000051', DNI: '41000222', FECHA: HOY })])[0];
  const ayer = pend([REG()])[0];
  const viejo = pend([REG({ ID: 'REG-000052', DNI: '41000333', FECHA: '2026-10-20' })])[0];   // ya venció: Por contactar
  const t = tablero([hoyMismo, ayer, viejo]);
  assert.deepEqual(t.columnas.POR_CONTACTAR.map(x => x.CLAVE), ['REG-000052']);
  assert.equal(t.cifras.porContactar, 1, 'la cifra de la franja no cambia');
  assert.equal(t.cifras.enEspera, 2);
  assert.deepEqual(t.enEspera.map(x => [x.CLAVE, x.COLUMNA, x.EN_ESPERA, x.ETIQUETA]), [
    ['REG-000050', 'POR_CONTACTAR', true, 'Cotizó hace 1 día · se le escribe desde el 04/11'],
    ['REG-000051', 'POR_CONTACTAR', true, 'Cotizó hoy · se le escribe desde el 05/11']], 'la que vence antes, primero');
  assert.equal(t.enEspera[0].MES, '2026-10', 'trae lo que usan los filtros');
  assert.equal(t.enEspera[0].SIN_CONTACTO, false);
  assert.equal(t.columnas.POR_CONTACTAR[0].EN_ESPERA, undefined);
  // todasLasTarjetas: columnas y en espera, para validar resultados y devolver la tarjeta movida.
  assert.deepEqual(plano(L.todasLasTarjetas(L.armarTablero({ pacientes: [], pendientes: [hoyMismo, ayer, viejo], seguimientos: [], citas: [], vigentes: {},
    reglas: reglas(L), hoy: HOY }))).map(x => x.CLAVE).sort(), ['REG-000050', 'REG-000051', 'REG-000052']);
});

test('armarTablero: vencida la espera la tarjeta pasa sola al grupo normal', () => {
  const t = tablero(pend([REG()], [], '2026-11-04'), '2026-11-04');
  assert.deepEqual([t.enEspera.length, t.columnas.POR_CONTACTAR.map(x => x.ETIQUETA)], [0, ['Cotizó hace 7 días']]);
});

/* ---------- Buscador del tablero: por qué no está ---------- */

const C = cargar(['Logica.gs', 'Registro.gs', 'Resultados.gs', 'Tablero.gs', 'Enfermeria.gs', 'Codigo.gs']);
function derivado(o) {
  return C.derivar_(Object.assign({ hoy: HOY, catalogos: CAT, reglas: reglas(C), citas: [], indicaciones: [], contactos: [], registros: [], sesiones: [],
    altas: [], seguimientos: [], seguimientosTodos: [] }, o));
}
const fuera = (d, q) => plano(C.fueraDeTablero(d, C.armarTablero(d), q));

test('fueraDeTablero: el hierro de Rachel está en el tablero (en espera), con DNI con o sin ceros y por nombre', () => {
  const d = derivado({ registros: [REG()] });
  for (const q of ['07123456', '7123456', 'lucia nahui', 'ÑAHUI']) {
    const r = fuera(d, q);
    assert.equal(r.pacientes.length, 1, q);
    assert.deepEqual([r.pacientes[0].DNI, r.pacientes[0].EN_TABLERO, r.pacientes[0].DNI_PARCIAL], ['7123456', true, '…3456'], q);
    assert.deepEqual(r.pacientes[0].FRANJAS, ['Por contactar · Recién registrados · en espera'], q);
  }
});

test('fueraDeTablero: no existe', () => {
  const r = fuera(derivado({ registros: [REG()] }), 'zzzz');
  assert.deepEqual([r.pacientes, r.total], [[], 0]);
});

test('fueraDeTablero: los motivos de quien existe pero no tiene tarjeta', () => {
  const dni = '40111222';
  const citas = [cita({ dni, fecha: '2026-10-20' })];   // reevaluación al día: debe volver el 19/11
  const motivos = o => fuera(derivado(Object.assign({ citas }, o)), dni).pacientes[0];
  const p = motivos({});
  assert.equal(p.EN_TABLERO, false);
  assert.deepEqual(p.MOTIVOS, ['su reevaluación de Hematología todavía no vence (debe volver el 19/11)']);
  assert.equal(p.NOMBRE, 'ROSA ELENA QUISPE HUAMAN');

  // Alta médica vigente (la de este mes está en Completado: sí tiene tarjeta).
  assert.equal(motivos({ altas: [{ ID: 'ALT-0', FECHA_HORA: '2026-10-27 10:00', FECHA: '2026-10-27', DNI: dni, ESPECIALIDAD: 'HEMATOLOGÍA', DOCTOR: 'Dra. Karen Matos',
    DECISION: 'ALTA', ANULADO: '' }] }).EN_TABLERO, true);
  const alta = motivos({ citas: [cita({ dni, fecha: '2026-09-10' })], altas: [{ ID: 'ALT-1', FECHA_HORA: '2026-09-15 10:00', FECHA: '2026-09-15', DNI: dni, ESPECIALIDAD: 'HEMATOLOGÍA', DOCTOR: 'Dra. Karen Matos',
    DECISION: 'ALTA', ANULADO: '' }] });
  assert.deepEqual(alta.MOTIVOS, ['tiene alta médica vigente (Hematología, 15/09)']);

  // Seguimiento cerrado con «Sin contacto válido».
  const cerrado = motivos({ citas: [cita({ dni, fecha: '2026-08-01' })], seguimientos: [{ ID: 'SEG-2', FECHA_HORA: '2026-10-28 09:00', DNI: dni, ESPECIALIDAD: 'HEMATOLOGÍA',
    RESPONSABLE: 'RACHEL', ACCION: 'DESCARTADO', MOTIVO: 'SIN CONTACTO', NOTA: 'Contactos al cerrar: ninguno', REFERENCIA: '', RESULTADO: 'SIN CONTACTO', FECHA_PROXIMA: '',
    TELEFONO: '', ANULADO: '' }] });
  assert.deepEqual(cerrado.MOTIVOS, ['seguimiento cerrado de su reevaluación de Hematología: Sin contacto válido (28/10)']);

  // Cita agendada en SOFDOC (sin seguimiento): no es trabajo del tablero.
  const ag = motivos({ citas: [cita({ dni, fecha: '2026-08-01' }), cita({ dni, fecha: '2026-11-03', estado: 'AGENDADO' })] });
  assert.deepEqual(ag.MOTIVOS, ['tiene cita agendada el 03/11 (Hematología)']);

  // Falleció: solo eso.
  const f = motivos({ seguimientos: [{ ID: 'SEG-3', FECHA_HORA: '2026-10-10 09:00', DNI: dni, ESPECIALIDAD: 'HEMATOLOGÍA', RESPONSABLE: 'RACHEL', ACCION: 'DESCARTADO',
    MOTIVO: 'FALLECIÓ', NOTA: '', REFERENCIA: '', RESULTADO: 'FALLECIÓ', FECHA_PROXIMA: '', TELEFONO: '', ANULADO: '' }] });
  assert.deepEqual(f.MOTIVOS, ['falleció (10/10/2026)']);

  // Completó su tratamiento el mes pasado (ya no está en Completado de este mes) y aún no toca reevaluar: dos motivos.
  const ses = [{ ID: 'SES-1', ID_REGISTRO: 'REG-000060', NUMERO: '1', FECHA: '2026-09-28', FECHA_HORA: '2026-09-28 10:00', ASESORA: 'RACHEL', ANULADO: '' }];
  const comp = fuera(derivado({ hoy: '2026-10-05', citas: [cita({ dni, fecha: '2026-09-15' })], registros: [REG({ ID: 'REG-000060', DNI: dni, FECHA: '2026-09-20' })],
    sesiones: ses }), dni).pacientes[0];
  assert.equal(comp.EN_TABLERO, false);
  assert.deepEqual(comp.MOTIVOS, ['su reevaluación de Hematología todavía no vence (debe volver el 15/10)',
    'completó su tratamiento de hierro (28/09) · reevaluar el 28/10']);
});

test('fueraDeTablero: varios pacientes por nombre, hasta 5, con el total', () => {
  const regs = Array.from({ length: 7 }, (_, i) => REG({ ID: 'REG-00007' + i, DNI: '4200000' + i, NOMBRE: 'PEDRO PRUEBA ' + 'ABCDEFG'[i], FECHA: '2026-09-01',
    CONTACTO: '9871112' + (10 + i) }));
  const r = fuera(derivado({ registros: regs, seguimientos: regs.map((g, i) => SEG({ ID: 'SEG-' + i, DNI: g.DNI, REFERENCIA: g.ID, FECHA_HORA: '2026-10-01 10:00',
    ACCION: 'DESCARTADO', RESULTADO: 'NO DESEA REALIZARSE', MOTIVO: 'NO DESEA REALIZARSE' })) }), 'pedro prueba');
  assert.equal(r.total, 7);
  assert.equal(r.pacientes.length, 5);
  assert.deepEqual(r.pacientes[0].MOTIVOS, ['seguimiento cerrado de su hierro: No desea realizarse (01/10)']);
});
