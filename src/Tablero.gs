/* ==========================================================================
   TABLERO: EL EMBUDO DE SEIS FASES (Etapa 3)

   Por contactar · Contactado · Pago realizado · Agendado · En tratamiento · Completado. Reparte las filas que
   ya calculan armarPacientes, pendientesIndicacion y pendientesRegistro.
   Funciones puras: se prueban en Node.
   ========================================================================== */

var DIAS_SEMANA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

function dm_(iso) { return iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : ''; }
function diaCorto_(iso) { return !fechaIso(iso) ? '' : DIAS_SEMANA[new Date(diaUtc_(iso)).getUTCDay()] + ' ' + dm_(iso); }
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

/** Las seis fases del embudo, en orden. */
var COLUMNAS_TABLERO = ['POR_CONTACTAR', 'CONTACTADO', 'PAGO_REALIZADO', 'AGENDADO', 'EN_TRATAMIENTO', 'COMPLETADO'];

/**
 * Columna de una fila con TIPO_SEGUIMIENTO; '' si no va al tablero. AGENDADO con una agenda que solo dice que se le
 * escribió (llamar, reintentar, sin respuesta) es Contactado; Agendado queda para las fechas reales.
 */
function columnaDe(t) {
  var e = t.ESTADO;
  if (e === 'PAGO REALIZADO') return 'PAGO_REALIZADO';
  var agendado = e === 'AGENDADO' ? (AGENDAS_CONTACTO[t.AGENDA] ? 'CONTACTADO' : 'AGENDADO') : '';
  if (t.TIPO_SEGUIMIENTO === 'REEVALUACION') {
    if (e === 'VENCIDO') return 'POR_CONTACTAR';
    // Una cita de SOFDOC sin seguimiento es rutina, no trabajo de la asesora.
    return agendado && Number(t.N_SEGUIMIENTOS) > 0 ? agendado : '';
  }
  if (e === 'POR REEVALUAR') return 'POR_CONTACTAR';
  if (e === 'PENDIENTE') return 'POR_CONTACTAR';
  if (agendado) return agendado;
  if (e === 'EN TRATAMIENTO') return 'EN_TRATAMIENTO';
  return '';
}

function etiquetaDe(t, reglas, hoy) {
  var sesion = 'Sesión ' + (Number(t.HECHAS) + 1) + ' de ' + t.SESIONES;
  if (t.COLUMNA === 'POR_CONTACTAR') {
    // Reabierta sola tras «Sin contacto válido» (o el número equivocado del último): qué contacto apareció.
    if (t.NUEVO_CONTACTO) return 'Nuevo contacto: ' + t.NUEVO_CONTACTO;
    if (t.TIPO_SEGUIMIENTO === 'REEVALUACION') {
      if (t.RETORNO_TIPO === '6 MESES' || t.RETORNO_TIPO === '1 AÑO') return 'Control de alta a ' + (t.RETORNO_TIPO === '6 MESES' ? '6 meses' : '1 año') + ' · el ' + dm_(t.FECHA_RETORNO);
      if (t.RETORNO_TIPO === 'REEVALUACION') return 'Debía volver el ' + dm_(t.FECHA_RETORNO) + ' (lo indicó el médico)';
      return 'Debía volver el ' + dm_(t.PROXIMA_ESPERADA) + ' · hace ' + plural_(diasEntre(t.PROXIMA_ESPERADA, hoy), 'día', 'días');
    }
    if (t.ESTADO === 'POR REEVALUAR') return 'Por reevaluar · terminó el ' + dm_(t.ULTIMA_SESION);
    if (t.MOTIVO_PENDIENTE === 'NO VINO') return 'No vino a su sesión ' + (Number(t.HECHAS) + 1) + ' (' + dm_(t.FECHA_FALTA || t.FECHA_INICIO) + ')';
    if (t.MOTIVO_PENDIENTE === 'CONTROL VENCIDO') return 'Debía volver con resultados el ' + dm_(t.FECHA_INICIO);
    if (t.ESTADO_REGISTRO === 'EN CURSO') return sesion + (t.ATRASO > 0 ? ' · atrasada ' + plural_(t.ATRASO, 'día', 'días') : ' · tocaba hoy');
    return 'Cotizó hace ' + plural_(t.DIAS, 'día', 'días');
  }
  if (t.COLUMNA === 'PAGO_REALIZADO') return 'Pagó el ' + dm_(t.FECHA_PAGO) + ' · falta agendar';
  if (t.COLUMNA === 'AGENDADO' || t.COLUMNA === 'CONTACTADO') {
    if (t.AGENDA === 'SESION') return 'Sesión ' + (Number(t.HECHAS) + 1) + ' el ' + diaCorto_(t.FECHA_AGENDA);
    if (t.AGENDA === 'CONTROL') return 'Control con resultados el ' + diaCorto_(t.FECHA_AGENDA);
    if (t.AGENDA === 'CITA') return 'Cita el ' + diaCorto_(t.FECHA_AGENDA);
    if (t.AGENDA === 'LLAMAR') return 'Llamar el ' + diaCorto_(t.FECHA_AGENDA);
    if (t.AGENDA === 'REINTENTAR') return 'Reintentar el ' + dm_(t.FECHA_AGENDA) + ' · intento ' + t.INTENTO + ' de ' + reglas.maxSeguimientos;
    if (t.AGENDA === 'SIN RESPUESTA') return 'Sin respuesta · se cierra el ' + dm_(t.FECHA_AGENDA);
    if (t.PROXIMA_AGENDADA) return 'Cita el ' + diaCorto_(t.PROXIMA_AGENDADA);
    return '';
  }
  if (t.COLUMNA === 'EN_TRATAMIENTO') {
    var proxima = sumarDias(t.ULTIMA_SESION, reglas.diasEntreSesiones);
    return 'Sesión ' + t.HECHAS + ' de ' + t.SESIONES + ' · faltan ' + (Number(t.SESIONES) - Number(t.HECHAS)) + (proxima ? ' · próxima ~' + dm_(proxima) : '');
  }
  return t.ETIQUETA || '';
}

function conTipo_(t, tipo) {
  var o = {};
  Object.keys(t).forEach(function (k) { o[k] = t[k]; });
  if (tipo) o.TIPO_SEGUIMIENTO = tipo;
  return o;
}

/** La etiqueta sin los trozos (« · ») que traigan NaN, undefined o Invalid Date. */
function sinBasura_(etiqueta) {
  var e = String(etiqueta || '');
  if (!/NaN|undefined|Invalid Date/.test(e)) return e;
  return e.split(' · ').filter(function (p) { return !/NaN|undefined|Invalid Date/.test(p); }).join(' · ');
}

function tarjeta_(t, columna, reglas, hoy, fechaClave, etiqueta) {
  var o = conTipo_(t);
  o.CLAVE = claveTarjeta(o);
  o.COLUMNA = columna;
  o.ETIQUETA = sinBasura_(etiqueta || etiquetaDe(o, reglas, hoy));
  // Salvaguarda general: ninguna FECHA_CLAVE que no sea una fecha (ordena la franja) ni ETIQUETA con NaN sale del servidor.
  o.FECHA_CLAVE = /^\d{4}-\d{2}-\d{2}/.test(String(fechaClave || '')) ? fechaClave : '';
  return o;
}

function hechosHoyPor_(d) {
  var out = {}, hoy = d.hoy;
  function sumar(quien) { quien = textoLimpio_(quien); if (quien) out[quien] = (out[quien] || 0) + 1; }
  // La agenda que se escribe al marcar una sesión con «Próxima sesión» (sesionLigada) es parte de esa sesión: no suma aparte.
  (d.seguimientos || []).forEach(function (s) { var r = resultadoDe(s); if (r && r.fecha === hoy && !sesionLigada(s)) sumar(s.RESPONSABLE); });
  // La sesión que quedó viva de un registro anulado al deshacer un fallo (anuladoPorFallo) no se hizo: no suma.
  var deshechos = {};
  (d.registros || []).forEach(function (r) { if (anuladoPorFallo(r)) deshechos[r.ID] = 1; });
  (d.sesiones || []).forEach(function (s) { if (!anulado_(s) && !deshechos[s.ID_REGISTRO] && fechaIso(s.FECHA_HORA) === hoy) sumar(s.ASESORA); });
  (d.altas || []).forEach(function (a) { if (!anulado_(a) && fechaIso(a.FECHA_HORA) === hoy) sumar(a.REGISTRADO_POR); });
  return out;
}

function armarTablero(d) {
  var reglas = d.reglas, hoy = d.hoy, mes = mesDe(hoy);
  var nombrePorDni = {};
  (d.citas || []).slice().sort(porFecha).forEach(function (c) { if (c.NOMBRE) nombrePorDni[c.DNI] = c.NOMBRE; });
  var col = {}, cerrados = [];
  COLUMNAS_TABLERO.forEach(function (c) { col[c] = []; });
  var reeval = (d.pacientes || []).map(function (p) { return conTipo_(p, 'REEVALUACION'); });
  var todas = reeval.concat(d.pendientes || []);

  // Por contactar: el orden de la bandeja de siempre (diseño §7.1).
  ordenarBandeja(d.pacientes, d.pendientes).forEach(function (t) {
    col.POR_CONTACTAR.push(tarjeta_(t, 'POR_CONTACTAR', reglas, hoy, ''));
  });
  todas.forEach(function (t) {
    var c = columnaDe(t);
    if (c === 'AGENDADO' || c === 'CONTACTADO') col[c].push(tarjeta_(t, c, reglas, hoy, t.FECHA_AGENDA || t.PROXIMA_AGENDADA));
    if (c === 'PAGO_REALIZADO') col[c].push(tarjeta_(t, c, reglas, hoy, t.FECHA_PAGO));
    if (c === 'EN_TRATAMIENTO') col.EN_TRATAMIENTO.push(tarjeta_(t, c, reglas, hoy, sumarDias(t.ULTIMA_SESION, reglas.diasEntreSesiones)));
    if (t.ESTADO === 'COMPLETADO') {
      var f = t.VOLVIO || (t.ULTIMA_SESION && t.ESTADO_REGISTRO === 'COMPLETO' ? t.ULTIMA_SESION : t.FECHA_LOHIZO);
      var etq = t.VOLVIO ? 'Volvió el ' + dm_(t.VOLVIO)
        : t.ESTADO_REGISTRO === 'COMPLETO' && t.SIN_REEVALUACION ? 'Completó el ' + dm_(t.ULTIMA_SESION) + ' · alta definitiva del ' + dm_(t.SIN_REEVALUACION)
        : t.ESTADO_REGISTRO === 'COMPLETO' ? (t.FECHA_REEVALUAR ? 'Completó el ' + dm_(t.ULTIMA_SESION) + ' · reevaluar el ' + dm_(t.FECHA_REEVALUAR)
          : (t.TIPO_SEGUIMIENTO === 'PROCEDIMIENTO' ? 'Se hizo el ' + dm_(f) : 'Completó el tratamiento'))
        : 'Lo hizo el ' + dm_(f);
      if (mesDe(f) === mes) col.COMPLETADO.push(tarjeta_(t, 'COMPLETADO', reglas, hoy, f, etq));
    }
    if (t.ESTADO === 'CERRADO' && mesDe(t.FECHA_CIERRE) === mes) {
      if (t.CIERRE === 'ALTA MÉDICA') col.COMPLETADO.push(tarjeta_(t, 'COMPLETADO', reglas, hoy, t.FECHA_CIERRE, 'Alta médica'));
      // «Sin contacto válido» y el número equivocado del último contacto son la misma situación: sin contacto (SIN_CONTACTO).
      else cerrados.push({ CLAVE: claveTarjeta(t), DNI: t.DNI, NOMBRE: t.NOMBRE, TIPO_SEGUIMIENTO: t.TIPO_SEGUIMIENTO, CIERRE: t.CIERRE, FECHA_CIERRE: t.FECHA_CIERRE,
        SIN_CONTACTO: t.CIERRE === 'SIN CONTACTO' || t.CIERRE === 'NÚMERO EQUIVOCADO' });
    }
  });
  Object.keys(d.vigentes || {}).forEach(function (k) {
    var a = d.vigentes[k];
    if (mesDe(a.FECHA) !== mes) return;
    var p = reeval.filter(function (x) { return claveSerie(x.DNI, x.ESPECIALIDAD) === k; })[0] || { DNI: a.DNI, ESPECIALIDAD: a.ESPECIALIDAD, NOMBRE: nombrePorDni[a.DNI] || '' };
    col.COMPLETADO.push(tarjeta_(conTipo_(p, 'REEVALUACION'), 'COMPLETADO', reglas, hoy, a.FECHA, 'Alta médica' + (a.DOCTOR ? ' · ' + a.DOCTOR : '')));
  });
  retornosDelMes(d.seguimientos, d.citas, hoy).forEach(function (r) {
    col.COMPLETADO.push(tarjeta_(conTipo_(r, 'REEVALUACION'), 'COMPLETADO', reglas, hoy, r.FECHA, 'Volvió el ' + dm_(r.FECHA)));
  });
  // Recién registrados · en espera (29/10/2026): los cotizados cuya ESPERA_COTIZACION_DIAS aún no vence. Van aparte (enEspera), con
  // COLUMNA = POR_CONTACTAR para que acepten los mismos resultados, pero NO cuentan en la cifra de la franja ni en ninguna otra.
  var enEspera = (d.pendientes || []).filter(function (t) { return t.ESTADO === 'EN ESPERA' && fechaIso(t.FIN_ESPERA); }).map(function (t) {
    var o = tarjeta_(t, 'POR_CONTACTAR', reglas, hoy, t.FIN_ESPERA,
      'Cotizó ' + (Number(t.DIAS) > 0 ? 'hace ' + plural_(Number(t.DIAS), 'día', 'días') : 'hoy') + ' · se le escribe desde el ' + dm_(t.FIN_ESPERA));
    o.EN_ESPERA = true;
    return o;
  }).sort(function (a, b) { return a.FECHA_CLAVE < b.FECHA_CLAVE ? -1 : a.FECHA_CLAVE > b.FECHA_CLAVE ? 1 : a.DNI < b.DNI ? -1 : a.DNI > b.DNI ? 1 : 0; });
  var muertos = fallecidos(d.seguimientos);
  Object.keys(muertos).forEach(function (dni) {
    if (mesDe(muertos[dni].fecha) === mes) cerrados.push({ CLAVE: dni, DNI: dni, NOMBRE: nombrePorDni[dni] || '', TIPO_SEGUIMIENTO: '', CIERRE: 'FALLECIÓ', FECHA_CIERRE: muertos[dni].fecha });
  });

  // Una sola tarjeta por necesidad: un registro completo que ya toca reevaluar (en Por contactar o, si ya se contactó,
  // pagó o agendó, en esas columnas) reemplaza a la reevaluación del mismo paciente y especialidad, esté donde esté.
  var reemplaza = {}, ABIERTAS_REEV = ['POR_CONTACTAR', 'CONTACTADO', 'PAGO_REALIZADO', 'AGENDADO'];
  ABIERTAS_REEV.reduce(function (a, c) { return a.concat(col[c]); }, []).forEach(function (t) {
    if (t.ESTADO === 'POR REEVALUAR' || (t.ID_REGISTRO && t.ESTADO_REGISTRO === 'COMPLETO' && t.FECHA_REEVALUAR && t.FECHA_REEVALUAR <= hoy)) {
      reemplaza[claveSerie(normDni(t.DNI), t.ESPECIALIDAD_CONSULTA || 'HEMATOLOGÍA')] = 1;
    }
  });
  ABIERTAS_REEV.forEach(function (c) {
    col[c] = col[c].filter(function (t) {
      return !(t.TIPO_SEGUIMIENTO === 'REEVALUACION' && reemplaza[claveSerie(normDni(t.DNI), t.ESPECIALIDAD)]);
    });
  });

  // Deduplicate COMPLETADO by CLAVE, keeping the card with latest FECHA_CLAVE
  var porClave = {}, deduped = [];
  col.COMPLETADO.forEach(function (t) {
    var k = t.CLAVE;
    if (!porClave[k] || t.FECHA_CLAVE > porClave[k].FECHA_CLAVE) porClave[k] = t;
  });
  Object.keys(porClave).forEach(function (k) { deduped.push(porClave[k]); });
  col.COMPLETADO = deduped;

  // Una tarjeta, una franja: si por datos contradictorios (una consulta que SOFDOC trajo tarde, un seguimiento hecho sin
  // saberlo) la misma CLAVE cae en dos franjas, queda en la más avanzada, la del hecho real (Completado gana a Contactado).
  var fase = {};
  COLUMNAS_TABLERO.forEach(function (c, i) {
    col[c].forEach(function (t) { if (fase[t.CLAVE] === undefined || i > fase[t.CLAVE]) fase[t.CLAVE] = i; });
  });
  COLUMNAS_TABLERO.forEach(function (c, i) {
    var vistas = {};
    col[c] = col[c].filter(function (t) {
      if (fase[t.CLAVE] !== i || vistas[t.CLAVE]) return false;
      vistas[t.CLAVE] = 1;
      return true;
    });
  });

  var asc = function (a, b) { return a.FECHA_CLAVE < b.FECHA_CLAVE ? -1 : a.FECHA_CLAVE > b.FECHA_CLAVE ? 1 : 0; };
  col.CONTACTADO.sort(asc);
  col.PAGO_REALIZADO.sort(asc);   // el pago más antiguo primero: lleva más tiempo esperando su fecha
  col.AGENDADO.sort(asc);
  col.EN_TRATAMIENTO.sort(asc);
  col.COMPLETADO.sort(function (a, b) { return -asc(a, b); });
  var hechosHoy = (d.seguimientos || []).filter(function (s) {
    var r = resultadoDe(s);
    return r && (r.grupo === 'SIGUE' || r.grupo === 'PAGO') && r.fecha === hoy && !sesionLigada(s);
  }).length;
  var marcadas = telefonosDescartados(marcasTelefono(d.seguimientos), d.telefonos);
  Object.keys(col).map(function (c) { return col[c]; }).concat([enEspera]).forEach(function (lista) {
    lista.forEach(function (t) {
      var dni = normDni(t.DNI);
      t.TELEFONOS_DESCARTADOS = marcadas[dni] || [];
      t.MES = mesDe(t.TIPO_SEGUIMIENTO === 'REEVALUACION' ? t.ULTIMA_CITA : t.FECHA_COTIZACION) || '';
      t.SIN_CONTACTO = !((d.telefonos || {})[dni] || []).length && !String(t.TELEFONOS || '').trim() && !textoLimpio_(t.USUARIO);
    });
  });
  return {
    columnas: col,
    enEspera: enEspera,
    cerrados: cerrados,
    cifras: { porContactar: col.POR_CONTACTAR.length, enEspera: enEspera.length, contactados: col.CONTACTADO.length, pagados: col.PAGO_REALIZADO.length,
      agendados: col.AGENDADO.length, enTratamiento: col.EN_TRATAMIENTO.length,
      completadosMes: col.COMPLETADO.length, cerradosMes: cerrados.length,
      cerradosSinContacto: cerrados.filter(function (c) { return c.SIN_CONTACTO; }).length, hechosHoy: hechosHoy, hechosHoyPor: hechosHoyPor_(d) }
  };
}

/** Todas las tarjetas de un armarTablero: las seis franjas y las «en espera» (validar un resultado, devolver la tarjeta movida). */
function todasLasTarjetas(tab) {
  var out = [];
  COLUMNAS_TABLERO.forEach(function (c) { out = out.concat((tab.columnas || {})[c] || []); });
  return out.concat(tab.enEspera || []);
}

/* ==========================================================================
   BUSCADOR DEL TABLERO: POR QUÉ NO ESTÁ (29/10/2026)

   Cuando lo buscado no coincide con ninguna tarjeta, la app pregunta al servidor (motivoFueraDeTablero) por los pacientes que
   coinciden —con las reglas de buscarEnPacientes: DNI con normDni, nombre con normBusqueda— y, de cada uno, si tiene tarjeta
   (y en qué franja) o por qué no: espera, alta vigente, seguimiento cerrado, tratamiento completo, reevaluación al día, cita
   agendada, falleció… Solo lectura.
   ========================================================================== */

var TOPE_FUERA_DE_TABLERO = 5;
var NOMBRE_FRANJA = { POR_CONTACTAR: 'Por contactar', CONTACTADO: 'Contactado', PAGO_REALIZADO: 'Pago realizado', AGENDADO: 'Agendado',
  EN_TRATAMIENTO: 'En tratamiento', COMPLETADO: 'Completado' };

function dniParcial(dni) { var s = String(dni || ''); return s.length > 4 ? '…' + s.slice(-4) : s; }
function dmy_(iso) { return iso ? dm_(iso) + '/' + iso.slice(0, 4) : ''; }
/** El nombre de un cierre para leer: SIN CONTACTO es «Sin contacto válido» (como textoCierre de Index.html). */
function textoCierre_(m) {
  var n = normTexto(m);
  if (n === 'SIN CONTACTO') return 'Sin contacto válido';
  if (n === 'NUMERO EQUIVOCADO') return 'Sin contacto válido (número equivocado)';
  return frase_(m);
}
/** «hierro», «procedimiento», «control» o «reevaluación de Hematología». */
function sujetoDe_(t) {
  var tipo = t.TIPO_SEGUIMIENTO || 'REEVALUACION';
  if (tipo === 'REEVALUACION') return 'reevaluación de ' + frase_(t.ESPECIALIDAD);
  return tipo === 'HIERRO' ? 'hierro' : tipo === 'CONTROL' ? 'control' : 'procedimiento';
}

/** Por qué la fila `t` (de armarPacientes o de los pendientes) no está en el tablero, o '' si no hay nada que decir. */
function motivoDeFila_(t, d) {
  var tipo = t.TIPO_SEGUIMIENTO || 'REEVALUACION', reev = tipo === 'REEVALUACION', suj = sujetoDe_(t), e = t.ESTADO, corte = d.reglas.corteIndicaciones;
  if (e === 'EN ESPERA') return 'su ' + suj + ' está en espera hasta el ' + dm_(t.FIN_ESPERA);
  if (e === 'CERRADO') return 'seguimiento cerrado de su ' + suj + ': ' + textoCierre_(t.CIERRE) + (t.FECHA_CIERRE ? ' (' + dm_(fechaIso(t.FECHA_CIERRE)) + ')' : '');
  if (reev) {
    if (e === 'ALTA') {
      var a = (d.vigentes || {})[claveSerie(t.DNI, t.ESPECIALIDAD)];
      return 'tiene alta médica vigente (' + frase_(t.ESPECIALIDAD) + (a && fechaIso(a.FECHA) ? ', ' + dm_(fechaIso(a.FECHA)) : '') + ')'
        + (t.FECHA_RETORNO ? ' · vuelve el ' + dm_(t.FECHA_RETORNO) : '');
    }
    if (e === 'AL DÍA' || e === 'POR VENCER' || e === 'RECUPERADO') return 'su ' + suj + ' todavía no vence (debe volver el ' + dm_(t.PROXIMA_ESPERADA) + ')';
    if (e === 'AGENDADO') return 'tiene cita agendada el ' + dm_(t.FECHA_AGENDA || t.PROXIMA_AGENDADA) + ' (' + frase_(t.ESPECIALIDAD) + ')';
    if (e === 'ANTIGUO') return 'su ' + suj + ' venció hace más de ' + corte + ' días (debía volver el ' + dmy_(t.PROXIMA_ESPERADA) + '): ya no se muestra';
    return '';
  }
  if (e === 'COMPLETADO') {
    if (t.VOLVIO) return 'su ' + suj + ' terminó: volvió a consulta el ' + dm_(t.VOLVIO);
    if (t.ESTADO_REGISTRO === 'COMPLETO') {
      if (tipo === 'PROCEDIMIENTO') return 'se hizo su procedimiento (' + dm_(t.ULTIMA_SESION) + ')';
      return 'completó su tratamiento de ' + suj + ' (' + dm_(t.ULTIMA_SESION) + ')'
        + (t.SIN_REEVALUACION ? ' · alta definitiva del ' + dm_(t.SIN_REEVALUACION) : t.FECHA_REEVALUAR ? ' · reevaluar el ' + dm_(t.FECHA_REEVALUAR) : '');
    }
    return 'ya se hizo su ' + suj + (t.FECHA_LOHIZO ? ' (' + dm_(t.FECHA_LOHIZO) + ')' : '');
  }
  if (e === 'ANTIGUO') {
    var desde = t.FECHA_FALTA || t.FECHA_REEVALUAR || t.FECHA_COTIZACION;
    return 'su ' + suj + ' lleva más de ' + corte + ' días sin seguimiento' + (desde ? ' (desde el ' + dmy_(desde) + ')' : '') + ': ya no se muestra';
  }
  return '';
}

/**
 * `d` = datos_() (derivados), `tab` = armarTablero(d). { q, total, pacientes: [{ DNI, DNI_PARCIAL, NOMBRE, EN_TABLERO, FRANJAS, MOTIVOS }] }:
 * hasta TOPE_FUERA_DE_TABLERO pacientes; total = cuántos coincidieron (buscarEnPacientes, que corta en 20).
 */
function fueraDeTablero(d, tab, q) {
  var texto = textoLimpio_(q && typeof q === 'object' ? q.q : q);
  var hallados = buscarEnPacientes(texto, { citas: d.citas, registros: d.registros, indicaciones: d.indicaciones });
  var tarjetas = {}, muertos = fallecidos(d.seguimientos);
  COLUMNAS_TABLERO.forEach(function (c) {
    ((tab.columnas || {})[c] || []).forEach(function (t) {
      var k = normDni(t.DNI);
      (tarjetas[k] = tarjetas[k] || []).push(NOMBRE_FRANJA[c]);
    });
  });
  (tab.enEspera || []).forEach(function (t) {
    var k = normDni(t.DNI);
    (tarjetas[k] = tarjetas[k] || []).push('Por contactar · Recién registrados · en espera');
  });
  var filas = ((d.pacientes || []).map(function (p) { return conTipo_(p, 'REEVALUACION'); })).concat(d.pendientes || []);
  return {
    q: texto,
    total: hallados.length,
    pacientes: hallados.slice(0, TOPE_FUERA_DE_TABLERO).map(function (h) {
      var dni = normDni(h.DNI), franjas = tarjetas[dni] || [], motivos = [];
      if (!franjas.length) {
        if (muertos[dni]) motivos = ['falleció (' + dmy_(muertos[dni].fecha) + ')'];
        else filas.forEach(function (t) {
          if (normDni(t.DNI) !== dni) return;
          var m = motivoDeFila_(t, d);
          if (m && motivos.indexOf(m) < 0) motivos.push(m);
        });
        if (!motivos.length) motivos = ['no tiene ningún seguimiento pendiente'];
      }
      return { DNI: dni, DNI_PARCIAL: dniParcial(dni), NOMBRE: h.NOMBRE, EN_TABLERO: franjas.length > 0,
        FRANJAS: franjas.filter(function (f, i) { return franjas.indexOf(f) === i; }), MOTIVOS: motivos };
    })
  };
}
