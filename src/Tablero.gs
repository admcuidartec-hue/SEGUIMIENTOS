/* ==========================================================================
   TABLERO DE CUATRO COLUMNAS

   Por contactar · Agendado · En tratamiento · Completado. Reparte las filas que
   ya calculan armarPacientes, pendientesIndicacion y pendientesRegistro.
   Funciones puras: se prueban en Node.
   ========================================================================== */

var DIAS_SEMANA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

function dm_(iso) { return iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : ''; }
function diaCorto_(iso) { return DIAS_SEMANA[new Date(diaUtc_(iso)).getUTCDay()] + ' ' + dm_(iso); }
function plural_(n, uno, varios) { return n + ' ' + (n === 1 ? uno : varios); }

function claveTarjeta(t) { return t.ID_REGISTRO || (t.DNI + '|' + t.ESPECIALIDAD); }

/**
 * Reevaluaciones que volvieron ESTE mes después de un seguimiento: la consulta
 * realizada del mes tiene un intento («Sigue») entre la consulta anterior y ella.
 */
function retornosDelMes(seguimientos, citas, hoy) {
  var mes = mesDe(hoy), series = armarSeries(citas), porSerie = {}, out = [];
  (seguimientos || []).forEach(function (s) {
    if (s.REFERENCIA || TIPOS_INDICACION[normTexto(s.ESPECIALIDAD)]) return;
    var r = resultadoDe(s);
    if (!r || r.grupo !== 'SIGUE') return;
    var k = claveSerie(normDni(s.DNI), s.ESPECIALIDAD);
    (porSerie[k] = porSerie[k] || []).push(r.fecha);
  });
  Object.keys(porSerie).forEach(function (k) {
    var serie = series[k];
    if (!serie) return;
    var r = serie.realizadas;
    for (var i = r.length - 1; i >= 0 && mesDe(r[i].FECHA) === mes; i--) {
      var previa = i > 0 ? r[i - 1].FECHA : '';
      var hubo = porSerie[k].some(function (f) { return f > previa && f <= r[i].FECHA; });
      if (hubo) {
        out.push({ DNI: serie.dni, ESPECIALIDAD: serie.especialidad, NOMBRE: serie.nombre, MEDICO_ULTIMO: r[i].MEDICO, FECHA: r[i].FECHA });
        return;
      }
    }
  });
  return out;
}

/** Columna de una fila con TIPO_SEGUIMIENTO; '' si no va al tablero. */
function columnaDe(t) {
  var e = t.ESTADO;
  if (t.TIPO_SEGUIMIENTO === 'REEVALUACION') {
    if (e === 'VENCIDO') return 'POR_CONTACTAR';
    // Una cita de SOFDOC sin seguimiento es rutina, no trabajo de la asesora.
    return e === 'AGENDADO' && Number(t.N_SEGUIMIENTOS) > 0 ? 'AGENDADO' : '';
  }
  if (e === 'PENDIENTE') return 'POR_CONTACTAR';
  if (e === 'AGENDADO') return 'AGENDADO';
  if (e === 'EN TRATAMIENTO') return 'EN_TRATAMIENTO';
  return '';
}

function etiquetaDe(t, reglas, hoy) {
  var sesion = 'Sesión ' + (Number(t.HECHAS) + 1) + ' de ' + t.SESIONES;
  if (t.COLUMNA === 'POR_CONTACTAR') {
    if (t.TIPO_SEGUIMIENTO === 'REEVALUACION') return 'Debía volver el ' + dm_(t.PROXIMA_ESPERADA) + ' · hace ' + plural_(diasEntre(t.PROXIMA_ESPERADA, hoy), 'día', 'días');
    if (t.ESTADO_REGISTRO === 'EN CURSO') return sesion + (t.ATRASO > 0 ? ' · atrasada ' + plural_(t.ATRASO, 'día', 'días') : ' · tocaba hoy');
    return 'Cotizó hace ' + plural_(t.DIAS, 'día', 'días');
  }
  if (t.COLUMNA === 'AGENDADO') {
    if (t.AGENDA === 'CITA') return 'Cita el ' + diaCorto_(t.FECHA_AGENDA);
    if (t.AGENDA === 'LLAMAR') return 'Llamar el ' + diaCorto_(t.FECHA_AGENDA);
    if (t.AGENDA === 'REINTENTAR') return 'Reintentar el ' + dm_(t.FECHA_AGENDA) + ' · intento ' + t.INTENTO + ' de ' + reglas.maxSeguimientos;
    return 'Sin respuesta · se cierra el ' + dm_(t.FECHA_AGENDA);
  }
  if (t.COLUMNA === 'EN_TRATAMIENTO') return sesion + ' · próxima ~' + dm_(sumarDias(t.ULTIMA_SESION, reglas.diasEntreSesiones));
  return t.ETIQUETA || '';
}

function conTipo_(t, tipo) {
  var o = {};
  Object.keys(t).forEach(function (k) { o[k] = t[k]; });
  if (tipo) o.TIPO_SEGUIMIENTO = tipo;
  return o;
}

function tarjeta_(t, columna, reglas, hoy, fechaClave, etiqueta) {
  var o = conTipo_(t);
  o.CLAVE = claveTarjeta(o);
  o.COLUMNA = columna;
  o.ETIQUETA = etiqueta || etiquetaDe(o, reglas, hoy);
  o.FECHA_CLAVE = fechaClave || '';
  return o;
}

function armarTablero(d) {
  var reglas = d.reglas, hoy = d.hoy, mes = mesDe(hoy);
  var col = { POR_CONTACTAR: [], AGENDADO: [], EN_TRATAMIENTO: [], COMPLETADO: [] }, cerrados = [];
  var reeval = (d.pacientes || []).map(function (p) { return conTipo_(p, 'REEVALUACION'); });
  var todas = reeval.concat(d.pendientes || []);

  // Por contactar: el orden de la bandeja de siempre (diseño §7.1).
  ordenarBandeja(d.pacientes, d.pendientes).forEach(function (t) {
    col.POR_CONTACTAR.push(tarjeta_(t, 'POR_CONTACTAR', reglas, hoy, ''));
  });
  todas.forEach(function (t) {
    var c = columnaDe(t);
    if (c === 'AGENDADO') col.AGENDADO.push(tarjeta_(t, c, reglas, hoy, t.FECHA_AGENDA));
    if (c === 'EN_TRATAMIENTO') col.EN_TRATAMIENTO.push(tarjeta_(t, c, reglas, hoy, sumarDias(t.ULTIMA_SESION, reglas.diasEntreSesiones)));
    if (t.ESTADO === 'COMPLETADO') {
      var f = t.ULTIMA_SESION && t.ESTADO_REGISTRO === 'COMPLETO' ? t.ULTIMA_SESION : t.FECHA_LOHIZO;
      if (mesDe(f) === mes) col.COMPLETADO.push(tarjeta_(t, 'COMPLETADO', reglas, hoy, f,
        t.ESTADO_REGISTRO === 'COMPLETO' ? 'Completó el tratamiento' : 'Lo hizo el ' + dm_(f)));
    }
    if (t.ESTADO === 'CERRADO' && mesDe(t.FECHA_CIERRE) === mes) {
      if (t.CIERRE === 'ALTA MÉDICA') col.COMPLETADO.push(tarjeta_(t, 'COMPLETADO', reglas, hoy, t.FECHA_CIERRE, 'Alta médica'));
      else cerrados.push({ CLAVE: claveTarjeta(t), DNI: t.DNI, NOMBRE: t.NOMBRE, TIPO_SEGUIMIENTO: t.TIPO_SEGUIMIENTO, CIERRE: t.CIERRE, FECHA_CIERRE: t.FECHA_CIERRE });
    }
  });
  Object.keys(d.vigentes || {}).forEach(function (k) {
    var a = d.vigentes[k];
    if (mesDe(a.FECHA) !== mes) return;
    var p = reeval.filter(function (x) { return claveSerie(x.DNI, x.ESPECIALIDAD) === k; })[0] || { DNI: a.DNI, ESPECIALIDAD: a.ESPECIALIDAD, NOMBRE: '' };
    col.COMPLETADO.push(tarjeta_(conTipo_(p, 'REEVALUACION'), 'COMPLETADO', reglas, hoy, a.FECHA, 'Alta médica' + (a.DOCTOR ? ' · ' + a.DOCTOR : '')));
  });
  retornosDelMes(d.seguimientos, d.citas, hoy).forEach(function (r) {
    col.COMPLETADO.push(tarjeta_(conTipo_(r, 'REEVALUACION'), 'COMPLETADO', reglas, hoy, r.FECHA, 'Volvió el ' + dm_(r.FECHA)));
  });
  var muertos = fallecidos(d.seguimientos);
  Object.keys(muertos).forEach(function (dni) {
    if (mesDe(muertos[dni].fecha) === mes) cerrados.push({ CLAVE: dni, DNI: dni, NOMBRE: '', TIPO_SEGUIMIENTO: '', CIERRE: 'FALLECIÓ', FECHA_CIERRE: muertos[dni].fecha });
  });

  var asc = function (a, b) { return a.FECHA_CLAVE < b.FECHA_CLAVE ? -1 : a.FECHA_CLAVE > b.FECHA_CLAVE ? 1 : 0; };
  col.AGENDADO.sort(asc);
  col.EN_TRATAMIENTO.sort(asc);
  col.COMPLETADO.sort(function (a, b) { return -asc(a, b); });
  var hechosHoy = (d.seguimientos || []).filter(function (s) {
    var r = resultadoDe(s);
    return r && r.grupo === 'SIGUE' && r.fecha === hoy;
  }).length;
  return {
    columnas: col,
    cerrados: cerrados,
    cifras: { porContactar: col.POR_CONTACTAR.length, agendados: col.AGENDADO.length, enTratamiento: col.EN_TRATAMIENTO.length,
      completadosMes: col.COMPLETADO.length, cerradosMes: cerrados.length, hechosHoy: hechosHoy }
  };
}
