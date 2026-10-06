/* ==========================================================================
   RESULTADOS DE «¿QUÉ PASÓ?»

   Lo que registra la asesora al contactar. Cada resultado hace algo distinto
   (pide una fecha, marca un teléfono, cierra el seguimiento), por eso la lista
   vive aquí y no en CATALOGOS. Funciones puras: se prueban en Node.
   ========================================================================== */

var RESULTADOS = {
  'NO CONTESTO':              { nombre: 'NO CONTESTÓ',              grupo: 'SIGUE',    pide: '',         soloIndicacion: false },
  'LO PENSARA':               { nombre: 'LO PENSARÁ',               grupo: 'SIGUE',    pide: 'FECHA',    soloIndicacion: false },
  'AGENDO CITA':              { nombre: 'AGENDÓ CITA',              grupo: 'SIGUE',    pide: 'FECHA',    soloIndicacion: false },
  'LO HIZO':                  { nombre: 'LO HIZO',                  grupo: 'SIGUE',    pide: 'FECHA',    soloIndicacion: true },
  'ALTA MEDICA':              { nombre: 'ALTA MÉDICA',              grupo: 'CIERRE',   pide: 'DOCTOR',   soloIndicacion: false },
  'NUMERO EQUIVOCADO':        { nombre: 'NÚMERO EQUIVOCADO',        grupo: 'TELEFONO', pide: 'TELEFONO', soloIndicacion: false },
  'SE ATIENDE EN OTRO LUGAR': { nombre: 'SE ATIENDE EN OTRO LUGAR', grupo: 'CIERRE',   pide: '',         soloIndicacion: false },
  'FALLECIO':                 { nombre: 'FALLECIÓ',                 grupo: 'CIERRE',   pide: '',         soloIndicacion: false },
  'NO DESEA CONTINUAR':       { nombre: 'NO DESEA CONTINUAR',       grupo: 'CIERRE',   pide: 'MOTIVO',   soloIndicacion: false }
};
var ORDEN_RESULTADOS = ['NO CONTESTÓ', 'LO PENSARÁ', 'AGENDÓ CITA', 'LO HIZO', 'ALTA MÉDICA', 'NÚMERO EQUIVOCADO',
  'SE ATIENDE EN OTRO LUGAR', 'FALLECIÓ', 'NO DESEA CONTINUAR'];

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
  if (u.resultado === 'AGENDÓ CITA' && u.fechaProxima && hoy <= sumarDias(u.fechaProxima, reglas.graciaAgenda)) {
    out.agenda = { tipo: 'CITA', fecha: u.fechaProxima, intento: 0 };
  }
  return out;
}
