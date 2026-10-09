/* ==========================================================================
   RESULTADOS DE «¿QUÉ PASÓ?»

   Lo que registra la asesora al contactar. Cada resultado hace algo distinto
   (pide una fecha, marca un teléfono, cierra el seguimiento), por eso la lista
   vive aquí y no en CATALOGOS. Funciones puras: se prueban en Node.
   ========================================================================== */

var RESULTADOS = {
  'NO CONTESTO':              { nombre: 'NO CONTESTÓ',              grupo: 'SIGUE',    pide: '',         soloIndicacion: false },
  'LO PENSARA':               { nombre: 'LO PENSARÁ',               grupo: 'SIGUE',    pide: 'FECHA',    soloIndicacion: false },
  'AGENDO CITA':              { nombre: 'AGENDÓ CITA',              grupo: 'SIGUE',    pide: 'FECHA',    soloIndicacion: false, soloReevaluacion: true },
  'LO HIZO':                  { nombre: 'LO HIZO',                  grupo: 'SIGUE',    pide: 'FECHA',    soloIndicacion: true },
  'ACEPTO':                   { nombre: 'ACEPTÓ',                   grupo: 'SIGUE',    pide: 'FECHA',    soloIndicacion: true },
  'ALTA MEDICA':              { nombre: 'ALTA MÉDICA',              grupo: 'CIERRE',   pide: 'DOCTOR',   soloIndicacion: false },
  'NUMERO EQUIVOCADO':        { nombre: 'NÚMERO EQUIVOCADO',        grupo: 'TELEFONO', pide: 'TELEFONO', soloIndicacion: false },
  'SE ATIENDE EN OTRO LUGAR': { nombre: 'SE ATIENDE EN OTRO LUGAR', grupo: 'CIERRE',   pide: '',         soloIndicacion: false },
  'FALLECIO':                 { nombre: 'FALLECIÓ',                 grupo: 'CIERRE',   pide: '',         soloIndicacion: false },
  'NO DESEA CONTINUAR':       { nombre: 'NO DESEA CONTINUAR',       grupo: 'CIERRE',   pide: 'MOTIVO',   soloIndicacion: false },
  'NO DESEA REALIZARSE':      { nombre: 'NO DESEA REALIZARSE',      grupo: 'CIERRE',   pide: 'MOTIVO',   soloIndicacion: true }
};
var ORDEN_RESULTADOS = ['NO CONTESTÓ', 'LO PENSARÁ', 'AGENDÓ CITA', 'LO HIZO', 'ACEPTÓ', 'ALTA MÉDICA', 'NÚMERO EQUIVOCADO',
  'SE ATIENDE EN OTRO LUGAR', 'FALLECIÓ', 'NO DESEA CONTINUAR', 'NO DESEA REALIZARSE'];

/**
 * Qué significa una fila de SEGUIMIENTOS. Las antiguas (sin RESULTADO) se leen
 * como antes: HECHO es un intento sin respuesta; DESCARTADO, un cierre con su motivo.
 * Una fila anulada, o con una ACCION que no decide nada, devuelve null.
 */
function resultadoDe(s) {
  if (!s || anulado_(s)) return null;
  var base = { fecha: fechaIso(s.FECHA_HORA), fechaHora: String(s.FECHA_HORA || ''), fechaProxima: fechaIso(s.FECHA_PROXIMA),
    telefono: normTelefono(s.TELEFONO), quien: textoLimpio_(s.RESPONSABLE), id: textoLimpio_(s.ID) };
  function con(o) { Object.keys(o).forEach(function (k) { base[k] = o[k]; }); return base; }
  var r = RESULTADOS[normTexto(s.RESULTADO)];
  if (r) {
    // Sin teléfono que marcar, un «número equivocado» es un cierre, como antes.
    var grupo = r.grupo === 'TELEFONO' && !base.telefono ? 'CIERRE' : r.grupo;
    return con({ resultado: r.nombre, grupo: grupo, motivo: grupo === 'SIGUE' ? '' : r.nombre, antiguo: false });
  }
  var accion = normTexto(s.ACCION);
  if (accion === 'HECHO') return con({ resultado: 'NO CONTESTÓ', grupo: 'SIGUE', motivo: '', antiguo: true });
  if (accion === 'DESCARTADO') {
    var fallecio = normTexto(s.MOTIVO) === 'FALLECIO';
    return con({ resultado: fallecio ? 'FALLECIÓ' : 'DESCARTADO', grupo: 'CIERRE',
      motivo: fallecio ? 'FALLECIÓ' : (textoLimpio_(s.MOTIVO) || 'SIN MOTIVO'), antiguo: true });
  }
  return null;
}

/** Números marcados como equivocados, por paciente: { dni: { telefono: fecha de la última marca } }. */
function marcasTelefono(seguimientos) {
  var out = {};
  (seguimientos || []).forEach(function (s) {
    var r = resultadoDe(s);
    if (!r || r.resultado !== 'NÚMERO EQUIVOCADO' || !r.telefono) return;
    var dni = normDni(s.DNI);
    out[dni] = out[dni] || {};
    if (!out[dni][r.telefono] || r.fecha > out[dni][r.telefono]) out[dni][r.telefono] = r.fecha;
  });
  return out;
}

/** Los marcados que ya no están entre los teléfonos vigentes: la ficha los muestra tachados. */
function telefonosDescartados(marcas, telefonos) {
  var out = {};
  Object.keys(marcas || {}).forEach(function (dni) {
    var quedan = (telefonos || {})[dni] || [];
    var fuera = Object.keys(marcas[dni]).filter(function (t) { return quedan.indexOf(t) < 0; });
    if (fuera.length) out[dni] = fuera;
  });
  return out;
}

/**
 * Fecha de la última marca si el paciente se quedó sin ningún contacto por marcas de
 * «número equivocado»; '' si le queda un teléfono o un usuario, o si nunca se marcó nada.
 */
function sinContacto_(dni, marcas, telefonos, usuario) {
  var m = (marcas || {})[dni];
  if (!m || ((telefonos || {})[dni] || []).length || textoLimpio_(usuario)) return '';
  return Object.keys(m).reduce(function (a, t) { return m[t] > a ? m[t] : a; }, '');
}

/** Pacientes con un «falleció» vigente (nuevo o antiguo): { dni: { fecha, quien, id } }. */
function fallecidos(seguimientos) {
  var out = {};
  (seguimientos || []).forEach(function (s) {
    var r = resultadoDe(s);
    if (!r || r.resultado !== 'FALLECIÓ') return;
    var dni = normDni(s.DNI);
    if (!out[dni] || r.fecha > out[dni].fecha) out[dni] = { fecha: r.fecha, quien: r.quien, id: r.id };
  });
  return out;
}

/**
 * Lee los seguimientos de UN ciclo: los posteriores a la última consulta, a la
 * cotización o a la última sesión, según el tipo. Gana el último resultado que
 * decide; un «número equivocado» con teléfono no decide (lo resuelve sinContacto_).
 */
function leerCiclo(lista, reglas, hoy) {
  var filas = (lista || []).map(resultadoDe).filter(Boolean).sort(function (a, b) {
    return a.fechaHora < b.fechaHora ? -1 : a.fechaHora > b.fechaHora ? 1 : 0;
  });
  var out = { intentos: 0, ultimo: '', cierre: null, agenda: null, loHizo: '' };
  if (!filas.length) return out;
  out.ultimo = filas[filas.length - 1].fecha;
  var decisivas = filas.filter(function (r) { return r.grupo !== 'TELEFONO'; });
  out.intentos = decisivas.filter(function (r) { return r.grupo === 'SIGUE'; }).length;
  var u = decisivas[decisivas.length - 1];
  if (!u) return out;
  if (u.grupo === 'CIERRE') { out.cierre = { motivo: u.motivo, fecha: u.fecha, quien: u.quien }; return out; }
  if (u.resultado === 'LO HIZO') { out.loHizo = u.fechaProxima || u.fecha; return out; }
  var seguidos = 0;
  for (var i = decisivas.length - 1; i >= 0 && decisivas[i].resultado === 'NO CONTESTÓ'; i--) seguidos++;
  if (seguidos >= reglas.maxSeguimientos) {
    var cierra = sumarDias(u.fecha, reglas.espera);
    if (hoy >= cierra) out.cierre = { motivo: 'SIN RESPUESTA', fecha: cierra, quien: '' };
    else out.agenda = { tipo: 'SIN RESPUESTA', fecha: cierra, intento: seguidos };
    return out;
  }
  if (u.resultado === 'NO CONTESTÓ') {
    var vuelve = sumarDias(u.fecha, reglas.espera);
    if (hoy < vuelve) out.agenda = { tipo: 'REINTENTAR', fecha: vuelve, intento: seguidos };
    return out;
  }
  if (u.resultado === 'LO PENSARÁ' && u.fechaProxima && hoy < u.fechaProxima) {
    out.agenda = { tipo: 'LLAMAR', fecha: u.fechaProxima, intento: 0 };
  }
  if (u.resultado === 'AGENDÓ CITA' && u.fechaProxima) {
    if (hoy <= sumarDias(u.fechaProxima, reglas.graciaAgenda)) out.agenda = { tipo: 'CITA', fecha: u.fechaProxima, intento: 0 };
    else out.citaVencida = u.fechaProxima;   // pasó sin que nadie la marcara: pendientesRegistro lo lee como «No vino»
  }
  return out;
}

/** Lo que la asesora eligió en «¿Qué pasó?», revisado. La tarjeta se busca como en la bandeja. */
function validarResultado(p, d) {
  function no(m) { return { error: m, fila: null, tarjeta: null }; }
  if (!p) return no('Faltan los datos.');
  var quien = enLista_(d.catalogos.usuarios, p.usuario);
  if (!quien) return no('Elija quién es usted en el selector de arriba.');
  var dni = normDni(p.dni);
  if (!dni) return no('Falta el DNI del paciente.');
  if (!normTexto(p.especialidad)) return no('Falta la especialidad.');
  var ref = textoLimpio_(p.referencia);
  var t = (d.tarjetas || []).filter(function (x) {
    return x.DNI === dni && normTexto(x.ESPECIALIDAD) === normTexto(p.especialidad) && (ref ? x.ID_REGISTRO === ref : !x.ID_REGISTRO);
  })[0];
  if (!t) return no('Ese paciente no está en la lista. Recargue la página.');
  var r = RESULTADOS[normTexto(p.resultado)];
  if (!r) return no('Elija qué pasó.');
  var tipoT = t.TIPO_SEGUIMIENTO || normTexto(t.ESPECIALIDAD);
  var esIndicacion = !!TIPOS_INDICACION[normTexto(t.ESPECIALIDAD)] && tipoT !== 'CONTROL';
  var porReevaluar = t.ESTADO === 'POR REEVALUAR' || tipoT === 'CONTROL';
  if (r.soloIndicacion && (!esIndicacion || porReevaluar)) return no('«' + frase_(r.nombre) + '» es solo para hierro y procedimientos.');
  // Un tratamiento empezado ya no se «acepta»: la próxima sesión se agenda.
  var empezado = !!t.ID_REGISTRO && esIndicacion && !porReevaluar && ['COTIZADO', 'PROGRAMADO'].indexOf(t.ESTADO_REGISTRO) < 0;
  if (r.soloReevaluacion && esIndicacion && !porReevaluar && !empezado) return no('«Agendó cita» es solo para reevaluaciones. Use «Aceptó».');
  if (r.nombre === 'ACEPTÓ' && empezado) return no('El tratamiento ya empezó: use «Agendó cita» para la próxima sesión.');
  var hoy = d.hoy, f = fechaIso(p.fecha), nota = textoLimpio_(p.nota);
  var fila = { DNI: dni, ESPECIALIDAD: t.ESPECIALIDAD, RESPONSABLE: quien, MOTIVO: r.grupo === 'SIGUE' ? '' : r.nombre, NOTA: nota,
    REFERENCIA: ref, RESULTADO: r.nombre, FECHA_PROXIMA: '', TELEFONO: '', ANULADO: '', MOTIVO_ANULACION: '' };
  if (r.nombre === 'LO PENSARÁ') {
    if (!f) return no('Falta la fecha para volver a llamar.');
    if (f <= hoy || f > sumarDias(hoy, 90)) return no('La fecha para volver a llamar va de mañana a 90 días.');
    fila.FECHA_PROXIMA = f;
  }
  if (r.nombre === 'AGENDÓ CITA') {
    if (!f) return no('Falta la fecha de la cita.');
    if (f < hoy || f > sumarDias(hoy, 180)) return no('La fecha de la cita va de hoy a 180 días.');
    fila.FECHA_PROXIMA = f;
  }
  if (r.nombre === 'LO HIZO') {
    if (!f) return no('Falta la fecha de la sesión.');
    if (f > hoy) return no('La fecha de la sesión no puede ser futura.');
    fila.FECHA_PROXIMA = f;
  }
  if (r.nombre === 'ACEPTÓ') {
    if (!f) return no('Falta la fecha de inicio.');
    if (f < hoy || f > sumarDias(hoy, 180)) return no('La fecha de inicio va de hoy a 180 días.');
    fila.FECHA_PROXIMA = f;
    if (p.sesiones !== undefined && p.sesiones !== '') {
      var n = Number(p.sesiones);
      if (!(n >= 1 && n <= MAX_SESIONES && Math.floor(n) === n)) return no('Indique cuántas sesiones (de 1 a ' + MAX_SESIONES + ').');
      fila.NOTA = unirNota_('Sesiones: ' + n, nota);
    }
  }
  if (r.nombre === 'NO DESEA REALIZARSE') {
    var motivoR = textoLimpio_(p.motivo);
    if (!motivoR) return no('Escriba el motivo.');
    fila.NOTA = unirNota_('Motivo: ' + motivoR, nota);
  }
  if (r.nombre === 'ALTA MÉDICA') {
    var doc = (d.catalogos.doctores || []).filter(function (x) { return normTexto(x.doctor) === normTexto(p.doctor); })[0];
    if (!doc) return no('Elija el doctor que da el alta.');
    fila.NOTA = unirNota_('Alta: ' + doc.doctor, nota);
  }
  if (r.nombre === 'NÚMERO EQUIVOCADO') {
    var tel = normTelefono(p.telefono);
    if (!tel) return no('Elija cuál teléfono está equivocado.');
    if (String(t.TELEFONOS || '').split(' / ').indexOf(tel) < 0) return no('Ese teléfono no es de este paciente.');
    fila.TELEFONO = tel;
  }
  if (r.nombre === 'NO DESEA CONTINUAR') {
    var motivo = textoLimpio_(p.motivo);
    if (!motivo) return no('Escriba el motivo.');
    fila.NOTA = unirNota_('Motivo: ' + motivo, nota);
  }
  return { error: '', fila: fila, tarjeta: t };
}

function unirNota_(a, b) { return b ? a + ' · ' + b : a; }

/** ACCION que se escribe junto al resultado, para que las cifras antiguas sigan igual. */
function accionPara(resultado, quedanContactos) {
  var r = RESULTADOS[normTexto(resultado)];
  if (!r) return '';
  if (r.grupo === 'SIGUE') return 'HECHO';
  if (r.grupo === 'TELEFONO') return quedanContactos ? 'TELEFONO' : 'DESCARTADO';
  return 'DESCARTADO';
}

/** Se anula el último resultado de su seguimiento; un «falleció», siempre (vale para todo el paciente). */
function validarAnulacionResultado(id, seguimientos) {
  var lista = seguimientos || [];
  var s = lista.filter(function (x) { return x.ID === id; })[0];
  if (!s) return 'No encontré ' + id + '.';
  if (anulado_(s)) return id + ' ya estaba anulado.';
  var rs = resultadoDe(s);
  if (rs && rs.resultado === 'FALLECIÓ') return '';
  var mismo = lista.filter(function (x) {
    return !anulado_(x) && normDni(x.DNI) === normDni(s.DNI) && normTexto(x.ESPECIALIDAD) === normTexto(s.ESPECIALIDAD) &&
      textoLimpio_(x.REFERENCIA) === textoLimpio_(s.REFERENCIA);
  }).sort(porFechaHora_);
  return mismo[mismo.length - 1].ID === id ? '' : 'Solo se puede anular el último resultado de este seguimiento.';
}

/** Para «Verificar»: cuántas filas hay de cada clase. No reescribe ninguna. */
function resumenAntiguos(seguimientos) {
  var out = { hechos: 0, descartes: 0, fallecidos: 0, nuevos: 0, anulados: 0 };
  (seguimientos || []).forEach(function (s) {
    if (anulado_(s)) { out.anulados++; return; }
    var r = resultadoDe(s);
    if (!r) return;
    if (!r.antiguo) out.nuevos++;
    else if (r.resultado === 'FALLECIÓ') out.fallecidos++;
    else if (r.grupo === 'SIGUE') out.hechos++;
    else out.descartes++;
  });
  return out;
}
