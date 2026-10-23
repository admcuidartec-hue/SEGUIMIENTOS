// Rendimiento con un libro grande (casos 47-50 de la batería de 50): lo que se precalcula da lo mismo que el cálculo directo,
// y no crece con registros × citas. Datos inventados.
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar, plano } = require('./cargar');
const { reglas } = require('./fixtures');

const MED = ['Dr. ELÍ FABRIZIO CABANILLAS HUALPA', 'Dra. KAREN DIANA MATOS PEÑA', 'Dr. JUVENAL HANAMPA ROQUE'];
const CAT = { usuarios: ['ANA'], motivos: [], alias: {}, procedimientos: ['AMO'], tratamientos: ['HIERRO SACARATO'], marcas: {},
  doctores: [{ doctor: 'Dr. Elí Cabanillas', sofdoc: MED[0] }, { doctor: 'Dra. Karen Matos', sofdoc: MED[1] }, { doctor: 'Dr. Juvenal Hanampa', sofdoc: MED[2] },
    { doctor: 'Dra. Sin Citas', sofdoc: 'Dra. NADIE' }, { doctor: 'Particular', sofdoc: '' }] };
const HOY = '2026-10-22';

/** Un libro como el de grande.js (más chico si se pide): citas en dos especialidades, registros de cinco doctores, sesiones. */
function libro(L, nCitas, nReg) {
  const citas = [], registros = [], sesiones = [], seguimientos = [];
  for (let i = 0; i < nCitas; i++) {
    const p = i % 3000;
    citas.push({ IDCITA: 'C' + i, DNI: String(99900000 + p), NOMBRE: 'PACIENTE ' + p, FECHA: L.sumarDias(HOY, -(20 + (i * 7) % 400)),
      ESTADO: i % 11 ? 'REALIZADO' : 'AGENDADO', ESPECIALIDAD: i % 4 ? 'HEMATOLOGÍA' : (i % 8 ? 'REUMATOLOGÍA' : 'reumatologia'), MEDICO: MED[i % 3], MODALIDAD: 'CLÍNICA' });
  }
  citas.sort((a, b) => (a.FECHA < b.FECHA ? -1 : 1));
  let ses = 0;
  for (let i = 0; i < nReg; i++) {
    const f = L.sumarDias(HOY, -(5 + (i % 150))), id = 'REG-' + String(i + 1).padStart(6, '0'), tipo = ['HIERRO', 'PROCEDIMIENTO', 'CONTROL'][i % 3];
    registros.push({ ID: id, FECHA_HORA: f + ' 10:00', FECHA: f, ASESORA: 'ANA', DOCTOR: CAT.doctores[i % 5].doctor, NOMBRE: 'REGISTRO ' + i,
      DNI: String(99900000 + i * 3), CONTACTO: String(910000000 + i), TIPO: tipo, DETALLE: tipo === 'HIERRO' ? 'HIERRO SACARATO' : tipo === 'CONTROL' ? 'CONTROL' : 'AMO',
      MARCA: '', SESIONES: tipo === 'HIERRO' ? 3 : tipo === 'CONTROL' ? 0 : 1, ANULADO: i % 17 ? '' : 'SÍ', MOTIVO_ANULACION: '',
      FECHA_INICIO: i % 5 === 1 ? L.sumarDias(f, 3) : '', EXAMENES: '', FECHA_RETORNO: tipo === 'CONTROL' ? L.sumarDias(f, 15) : '', EDITADO: '' });
    const k = tipo === 'HIERRO' ? i % 4 : tipo === 'PROCEDIMIENTO' && i % 2 ? 1 : 0;
    for (let s = 1; s <= Math.min(k, 3); s++) {
      ses++; const fs = L.sumarDias(f, (s - 1) * 7);
      sesiones.push({ ID: 'SES-' + String(ses).padStart(6, '0'), FECHA_HORA: fs + ' 11:00', ID_REGISTRO: id, NUMERO: s, FECHA: fs, ASESORA: 'ANA', NOTA: '', ANULADO: '', MOTIVO_ANULACION: '' });
    }
    if (i % 7 === 0) seguimientos.push({ ID: 'SEG-' + i, FECHA_HORA: L.sumarDias(f, 8) + ' 09:00', DNI: String(99900000 + i * 3), ESPECIALIDAD: tipo, RESPONSABLE: 'ANA',
      ACCION: 'HECHO', MOTIVO: '', NOTA: '', REFERENCIA: id, RESULTADO: 'NO CONTESTÓ', FECHA_PROXIMA: '', TELEFONO: '', ANULADO: '', MOTIVO_ANULACION: '' });
  }
  return { citas, registros, sesiones, seguimientos };
}

/** La versión directa de antes: recorre todas las citas por cada registro. Es la referencia de la equivalencia. */
function especialidadesDirecto(L) {
  return function (medico, citas) {
    const out = {}, m = L.normTexto(medico);
    if (!m) return out;
    (citas || []).forEach(c => { if (L.normTexto(c.MEDICO) === m && c.ESPECIALIDAD) out[L.normTexto(c.ESPECIALIDAD)] = c.ESPECIALIDAD; });
    return out;
  };
}

const datos = (L, b) => ({ registros: b.registros, sesiones: b.sesiones, seguimientos: b.seguimientos, citas: b.citas, reglas: reglas(L), hoy: HOY,
  telefonos: {}, catalogos: CAT, usuarios: {} });

test('especialidadesDeMedico_ con el índice = recorrer todas las citas, para cada médico (también el que no tiene citas y el vacío)', () => {
  const L = cargar();
  const b = libro(L, 600, 0), directo = especialidadesDirecto(L), indice = L.indiceEspecialidadesMedico(b.citas);
  for (const m of MED.concat(['dr. elí fabrizio cabanillas hualpa', 'Dra. NADIE', '', 'Particular'])) {
    assert.deepEqual(plano(L.especialidadesDeMedico_(m, b.citas, indice)), directo(m, b.citas), m);
    assert.deepEqual(plano(L.especialidadesDeMedico_(m, b.citas)), directo(m, b.citas), m + ' (sin índice)');
  }
});

test('pendientesRegistro con el índice da exactamente lo mismo que con el cálculo directo de antes', () => {
  const L = cargar(), R = cargar();
  R.especialidadesDeMedico_ = especialidadesDirecto(R);
  R.indiceEspecialidadesMedico = () => undefined;
  const b = libro(L, 1500, 300);
  const nuevo = plano(L.pendientesRegistro(datos(L, b))), antes = plano(R.pendientesRegistro(datos(R, b)));
  assert.equal(nuevo.length, antes.length);
  assert.ok(nuevo.length > 200);
  assert.deepEqual(nuevo, antes);
});

test('pendientesRegistro con 1000 registros y 5000 citas no tarda segundos (antes, 8 s: registros × citas)', () => {
  const L = cargar();
  const b = libro(L, 5000, 1000), d = datos(L, b);
  L.pendientesRegistro(d);   // calentar
  const t = Date.now();
  L.pendientesRegistro(d);
  const ms = Date.now() - t;
  assert.ok(ms < 800, 'tardó ' + ms + ' ms');
});

test('Enfermería: contactos y cifras con el índice por sesión = recorriendo la hoja por cada sesión; y sin segundos de espera', () => {
  const L = cargar(), R = cargar();
  R.filasPorSesion_ = () => undefined;
  const b = libro(L, 300, 900), enfermeria = [];
  const sesH = b.sesiones.filter(s => b.registros.find(r => r.ID === s.ID_REGISTRO).TIPO === 'HIERRO');
  for (let i = 0; i < 2000; i++) {
    const s = sesH[i % sesH.length], r = b.registros.find(x => x.ID === s.ID_REGISTRO), dia = [1, 3, 5][i % 3];
    enfermeria.push({ ID: 'ENF-' + i, FECHA_HORA: L.sumarDias(s.FECHA, dia + (i % 4 === 0 ? 1 : 0)) + ' 12:00', ID_REGISTRO: r.ID, ID_SESION: i % 13 ? s.ID : ' ' + s.ID + ' ',
      NUMERO_SESION: s.NUMERO, DNI: r.DNI, DIA: dia, RESULTADO: i % 5 ? 'CONTACTADO' : 'NO CONTESTO', REACCION_TIPO: i % 5 ? (i % 7 ? 'NINGUNA' : 'MEDIATA') : '',
      REACCION: i % 7 ? '' : 'Fiebre', NOTA: '', ENFERMERA: 'ENF', ANULADO: i % 11 ? '' : 'SÍ', MOTIVO_ANULACION: '' });
  }
  const d = X => ({ registros: b.registros, sesiones: b.sesiones, enfermeria, seguimientos: b.seguimientos, hoy: HOY, reglas: reglas(X), telefonos: {}, catalogos: CAT });
  for (const hoy of [HOY, '2026-09-20']) {
    const dl = Object.assign(d(L), { hoy }), dr = Object.assign(d(R), { hoy });
    assert.deepEqual(plano(L.contactosEnfermeria(dl)), plano(R.contactosEnfermeria(dr)));
    assert.deepEqual(plano(L.cifrasEnfermeria(dl)), plano(R.cifrasEnfermeria(dr)));
  }
  const t = Date.now();
  L.contactosEnfermeria(d(L)); L.cifrasEnfermeria(d(L));
  assert.ok(Date.now() - t < 400, 'tardó ' + (Date.now() - t) + ' ms');
});

test('La tarjeta de un paciente calculada solo con sus filas (soloDelPaciente_) = la del tablero entero, para cada paciente', () => {
  const S = cargar(['Logica.gs', 'Registro.gs', 'Resultados.gs', 'Tablero.gs', 'Enfermeria.gs', 'Codigo.gs', 'RegistroServidor.gs', 'ResultadoServidor.gs', 'EnfermeriaServidor.gs']);
  const b = libro(S, 1200, 240), segs = b.seguimientos.slice();
  const RES = ['NO CONTESTÓ', 'LO PENSARÁ', 'AGENDÓ CITA', 'PAGO', 'NÚMERO EQUIVOCADO', 'FALLECIÓ', 'SE ATIENDE EN OTRO LUGAR'];
  for (let i = 0; i < 900; i++) {
    const c = b.citas[(i * 13) % b.citas.length], r = RES[i % RES.length], f = S.sumarDias(HOY, -(i % 40));
    segs.push({ ID: 'SEG-R' + i, FECHA_HORA: f + ' 1' + (i % 10) + ':00', DNI: c.DNI, ESPECIALIDAD: c.ESPECIALIDAD, RESPONSABLE: 'ANA', ACCION: 'HECHO', MOTIVO: '', NOTA: '',
      REFERENCIA: '', RESULTADO: r, FECHA_PROXIMA: r === 'LO PENSARÁ' || r === 'AGENDÓ CITA' ? S.sumarDias(HOY, 3 + (i % 9)) : r === 'PAGO' ? f : '',
      TELEFONO: r === 'NÚMERO EQUIVOCADO' ? String(900000000 + Number(c.DNI) - 99900000) : '', ANULADO: i % 23 ? '' : 'SÍ', MOTIVO_ANULACION: '' });
  }
  const indicaciones = b.citas.filter((c, i) => i % 5 === 0).map((c, i) => ({ ID: 'IND-' + i, FECHA: S.sumarDias(c.FECHA, 2), TIPO: i % 2 ? 'HIERRO' : 'PROCEDIMIENTO',
    DETALLE: 'SANGRÍA', CANTIDAD: 1, MEDICO_SOLICITANTE: c.MEDICO, ASESORA: 'ANA', NOMBRE: c.NOMBRE, TELEFONO: String(900000000 + Number(c.DNI) - 99900000),
    ESTADO: i % 3 ? 'COTIZÓ' : 'ACEPTÓ', OBSERVACIONES: '', DNI: c.DNI, EMPAREJAMIENTO: 'CONFIRMADO', ORIGEN: '' }));
  const altas = b.citas.filter((c, i) => i % 41 === 0).map((c, i) => ({ ID: 'ALT-' + i, FECHA_HORA: HOY + ' 08:00', FECHA: S.sumarDias(HOY, -(i % 30)), DNI: c.DNI,
    ESPECIALIDAD: c.ESPECIALIDAD, DOCTOR: 'Dra. Karen Matos', REGISTRADO_POR: 'ANA', NOTA: '', ANULADO: '', MOTIVO_ANULACION: '',
    DECISION: ['ALTA', 'ALTA 6 MESES', 'NUEVA REEVALUACION'][i % 3], FECHA_RETORNO: i % 3 === 2 ? S.sumarDias(HOY, 20) : '' }));
  const crudo = () => ({ hoy: HOY, reglas: reglas(S), catalogos: CAT, citas: b.citas, indicaciones, seguimientosTodos: segs,
    seguimientos: segs.filter(s => !S.anulado_(s)), contactos: [{ DNI: 'X', DNI_PACIENTE: b.citas[3].DNI, TELEFONO: '911222333' }], registros: b.registros,
    sesiones: b.sesiones, altas, enfermeria: [] });
  const todo = plano(S.armarTablero(S.derivar_(crudo())));
  const dnis = [...new Set(b.citas.map(c => c.DNI).concat(b.registros.map(r => r.DNI)))].filter((x, i) => i % 3 === 0);
  let comparadas = 0;
  for (const dni of dnis) {
    const solo = plano(S.armarTablero(S.derivar_(S.soloDelPaciente_(crudo(), dni))));
    for (const c of Object.keys(todo.columnas)) {
      const a = todo.columnas[c].filter(t => t.DNI === dni), s = solo.columnas[c];
      assert.deepEqual(s, a, dni + ' en ' + c);
      comparadas += a.length;
    }
    assert.deepEqual(solo.cerrados, todo.cerrados.filter(t => t.DNI === dni), dni + ' cerrados');
  }
  assert.ok(comparadas > 250, 'comparadas ' + comparadas);
});
