/* ==========================================================================
   LÓGICA PURA

   Nada en este archivo llama a SpreadsheetApp, Utilities, Session ni
   LockService: todo recibe datos y devuelve datos. Así se prueba con Node
   (`npm test`) sin desplegar.

   Las fechas viajan como texto 'yyyy-MM-dd'. Convertirlas a Date —a
   mediodía— es trabajo de Codigo.gs, al escribir en la hoja.
   ========================================================================== */

var PALABRAS_VACIAS = { DE: 1, DEL: 1, LA: 1, LAS: 1, LOS: 1, Y: 1 };

function normTexto(v) {
  return String(v == null ? '' : v)
    .replace(/\n/g, ' ')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/**
 * DNI, carné de extranjería o pasaporte -> clave del paciente.
 * Un DNI numérico pierde los ceros a la izquierda porque SOFDOC ya los perdió
 * ('06174169' en una base y 6174169 en la otra son la misma persona).
 */
function normDni(v) {
  var s = normTexto(v).replace(/[\s.\-]/g, '');
  if (/^\d+$/.test(s)) s = s.replace(/^0+/, '');
  return s;
}

function normTelefono(v) {
  var d = String(v == null ? '' : v).replace(/\.0+$/, '').replace(/\D/g, '');
  if (d.length === 11 && d.indexOf('51') === 0) d = d.slice(2);
  return d.length >= 7 ? d : '';
}

/** 'yyyy-MM-dd' tomado del inicio del texto; '' si no empieza por una fecha ISO. */
function fechaIso(v) {
  var m = String(v == null ? '' : v).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[1] + '-' + m[2] + '-' + m[3] : '';
}

function diaUtc_(iso) {
  var p = String(iso).split('-');
  return Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
}

function diasEntre(desde, hasta) {
  return Math.round((diaUtc_(hasta) - diaUtc_(desde)) / 86400000);
}

function sumarDias(iso, n) {
  var d = new Date(diaUtc_(iso) + n * 86400000);
  return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2);
}

function mesDe(iso) {
  return String(iso || '').slice(0, 7);
}
/* ==========================================================================
   CITAS DE SOFDOC
   ========================================================================== */

/** Columnas que SOFDOC debe traer. Si falta una, no se escribe nada. */
var SOFDOC_OBLIGATORIAS = {
  IDCITA: 'IDCITA', ESTADO: 'ESTADO DE CITA', FECHA: 'FECHA DE ATENCION | HORA',
  NOMBRE: 'PACIENTE', DNI: 'DNI DEL PACIENTE', ESPECIALIDAD: 'ESPECIALIDAD MEDICA',
  MEDICO: 'MEDICO', FECHA_REGISTRO: 'FECHA DE REGISTRO'
};
/** 'MODALDIAD' va con la errata del export original. */
var SOFDOC_OPCIONALES = {
  MODALIDAD: 'MODALDIAD', TIPO_PACIENTE: 'TIPO PACIENTE', MARCA: 'MARCA',
  ESTADO_PAGO: 'ESTADO DE PAGO', PAGO: 'PAGO REALIZADO', REGISTRADO_POR: 'REGISTRADO POR'
};

var COLUMNAS_CITAS = ['IDCITA', 'DNI', 'NOMBRE', 'FECHA', 'ESTADO', 'ESPECIALIDAD', 'MEDICO', 'MODALIDAD',
  'TIPO_PACIENTE', 'MARCA', 'PAGO', 'ESTADO_PAGO', 'REGISTRADO_POR', 'FECHA_REGISTRO'];

function indiceDeEncabezado(encabezado) {
  var idx = {};
  (encabezado || []).forEach(function (c, i) {
    var k = normTexto(c);
    if (k && idx[k] === undefined) idx[k] = i;
  });
  return idx;
}

function textoLimpio_(v) {
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
}

/** 'HIERRO CARBOXIMALTOSA' -> 'Hierro carboximaltosa'. */
function frase_(s) {
  var t = textoLimpio_(s).toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Solo las marcas 'yyyy-…' se pueden comparar como texto; lo demás no desempata. */
function claveRegistro(v) {
  var s = String(v == null ? '' : v);
  return /^\d{4}-/.test(s) ? s : '';
}

function limpiarCitas(encabezado, filas, alias) {
  alias = alias || {};
  var idx = indiceDeEncabezado(encabezado);
  var faltantes = [];
  Object.keys(SOFDOC_OBLIGATORIAS).forEach(function (k) {
    if (idx[normTexto(SOFDOC_OBLIGATORIAS[k])] === undefined) faltantes.push(SOFDOC_OBLIGATORIAS[k]);
  });
  if (faltantes.length) return { citas: [], faltantes: faltantes, invalidas: 0 };

  function celda(f, nombre) {
    var i = idx[normTexto(nombre)];
    return i === undefined ? '' : f[i];
  }

  var porId = {}, orden = [], invalidas = 0;
  (filas || []).forEach(function (f) {
    var medico = textoLimpio_(celda(f, SOFDOC_OBLIGATORIAS.MEDICO));
    var c = {
      IDCITA: normTexto(celda(f, SOFDOC_OBLIGATORIAS.IDCITA)),
      DNI: normDni(celda(f, SOFDOC_OBLIGATORIAS.DNI)),
      NOMBRE: textoLimpio_(celda(f, SOFDOC_OBLIGATORIAS.NOMBRE)),
      FECHA: fechaIso(celda(f, SOFDOC_OBLIGATORIAS.FECHA)),
      ESTADO: normTexto(celda(f, SOFDOC_OBLIGATORIAS.ESTADO)),
      ESPECIALIDAD: textoLimpio_(celda(f, SOFDOC_OBLIGATORIAS.ESPECIALIDAD)),
      MEDICO: alias[normTexto(medico)] || medico,
      MODALIDAD: textoLimpio_(celda(f, SOFDOC_OPCIONALES.MODALIDAD)),
      TIPO_PACIENTE: textoLimpio_(celda(f, SOFDOC_OPCIONALES.TIPO_PACIENTE)),
      MARCA: textoLimpio_(celda(f, SOFDOC_OPCIONALES.MARCA)),
      PAGO: celda(f, SOFDOC_OPCIONALES.PAGO),
      ESTADO_PAGO: textoLimpio_(celda(f, SOFDOC_OPCIONALES.ESTADO_PAGO)),
      REGISTRADO_POR: textoLimpio_(celda(f, SOFDOC_OPCIONALES.REGISTRADO_POR)),
      FECHA_REGISTRO: textoLimpio_(celda(f, SOFDOC_OBLIGATORIAS.FECHA_REGISTRO))
    };
    if (!c.IDCITA || !c.DNI || !c.FECHA) { invalidas++; return; }
    var previa = porId[c.IDCITA];
    if (!previa) orden.push(c.IDCITA);
    else if (claveRegistro(c.FECHA_REGISTRO) < claveRegistro(previa.FECHA_REGISTRO)) return;
    porId[c.IDCITA] = c;
  });
  var citas = orden.map(function (id) { return porId[id]; }).sort(ordenCitas_);
  return { citas: citas, faltantes: [], invalidas: invalidas };
}

function ordenCitas_(a, b) {
  if (a.FECHA !== b.FECHA) return a.FECHA < b.FECHA ? -1 : 1;
  return a.IDCITA < b.IDCITA ? -1 : a.IDCITA > b.IDCITA ? 1 : 0;
}

function mismaCita_(a, b) {
  return COLUMNAS_CITAS.every(function (k) { return String(a[k] == null ? '' : a[k]) === String(b[k] == null ? '' : b[k]); });
}

/**
 * Incorpora lo pegado a lo que ya había. Lo que no viene en el pegado se
 * conserva: pegar solo el mes nuevo no debe borrar la historia.
 */
function fusionarCitas(previas, nuevas) {
  var porId = {}, orden = [], nNuevas = 0, cambiadas = 0;
  (previas || []).forEach(function (c) {
    if (!porId[c.IDCITA]) orden.push(c.IDCITA);
    porId[c.IDCITA] = c;
  });
  (nuevas || []).forEach(function (c) {
    var p = porId[c.IDCITA];
    if (!p) { porId[c.IDCITA] = c; orden.push(c.IDCITA); nNuevas++; return; }
    if (claveRegistro(c.FECHA_REGISTRO) < claveRegistro(p.FECHA_REGISTRO)) return;
    if (!mismaCita_(p, c)) cambiadas++;
    porId[c.IDCITA] = c;
  });
  var citas = orden.map(function (id) { return porId[id]; }).sort(ordenCitas_);
  return { citas: citas, nuevas: nNuevas, cambiadas: cambiadas };
}
/* ==========================================================================
   REGLAS Y CATÁLOGOS (vienen de las hojas REGLAS y CATALOGOS)
   ========================================================================== */

function entero_(v, porDefecto, minimo) {
  var n = parseInt(v, 10);
  if (isNaN(n) || n < (minimo || 0)) return porDefecto;
  return n;
}

/**
 * REGLAS tiene dos tablas lado a lado con un solo encabezado:
 * ESPECIALIDAD | ESPERADO_DIAS | VENCE_DIAS | (vacía) | PARAMETRO | VALOR
 */
function reglasDesdeFilas(encabezado, filas) {
  var idx = indiceDeEncabezado(encabezado);
  var r = { plazos: { '*': { esperado: 30, vence: 45 } }, espera: 15, maxSeguimientos: 3, corte: 180, corteIndicaciones: 180, metaRetorno: 60,
    esperaCotizacion: 7, diasEntreSesiones: 7, graciaAgenda: 2, metaDiaria: 15,
    postTratamiento: 30, controlLab: 15, avisoAltaControl: 30 };
  function celda(f, k) { return idx[k] === undefined ? '' : f[idx[k]]; }
  (filas || []).forEach(function (f) {
    var esp = normTexto(celda(f, 'ESPECIALIDAD'));
    if (esp) r.plazos[esp] = { esperado: entero_(celda(f, 'ESPERADO_DIAS'), 30), vence: entero_(celda(f, 'VENCE_DIAS'), 45) };
    var par = normTexto(celda(f, 'PARAMETRO')).replace(/ /g, '_');
    var val = celda(f, 'VALOR');
    if (par === 'ESPERA_TRAS_SEGUIMIENTO_DIAS') r.espera = entero_(val, 15);
    if (par === 'MAX_SEGUIMIENTOS') r.maxSeguimientos = entero_(val, 3, 1);
    if (par === 'CORTE_BANDEJA_DIAS') r.corte = entero_(val, 180);
    if (par === 'CORTE_INDICACIONES_DIAS') r.corteIndicaciones = entero_(val, 180);
    if (par === 'META_RETORNO_PCT') r.metaRetorno = Math.min(100, entero_(val, 60));
    if (par === 'ESPERA_COTIZACION_DIAS') r.esperaCotizacion = entero_(val, 7);
    if (par === 'DIAS_ENTRE_SESIONES') r.diasEntreSesiones = entero_(val, 7);
    if (par === 'GRACIA_AGENDA_DIAS') r.graciaAgenda = entero_(val, 2);
    if (par === 'META_DIARIA_SEGUIMIENTOS') r.metaDiaria = entero_(val, 15, 1);
    if (par === 'DIAS_POST_TRATAMIENTO') r.postTratamiento = entero_(val, 30);
    if (par === 'DIAS_CONTROL_LAB') r.controlLab = entero_(val, 15, 1);
    if (par === 'AVISO_ALTA_CONTROL_DIAS') r.avisoAltaControl = entero_(val, 30);
  });
  Object.keys(r.plazos).forEach(function (k) {
    if (r.plazos[k].vence < r.plazos[k].esperado) r.plazos[k].vence = r.plazos[k].esperado;
  });
  return r;
}

function plazoDe(reglas, especialidad) {
  return reglas.plazos[normTexto(especialidad)] || reglas.plazos['*'];
}

/**
 * CATALOGOS: una columna por lista. USUARIOS | MOTIVOS_DESCARTE | MEDICO_ALIAS | MEDICO_NOMBRE |
 * DOCTOR | DOCTOR_SOFDOC | PROCEDIMIENTOS | TRATAMIENTOS | MARCAS («TRATAMIENTO | MARCA»).
 */
function catalogosDesdeFilas(encabezado, filas) {
  var idx = indiceDeEncabezado(encabezado);
  var out = { usuarios: [], motivos: [], alias: {}, doctores: [], procedimientos: [], tratamientos: [], marcas: {} };
  function celda(f, k) { return idx[k] === undefined ? '' : textoLimpio_(f[idx[k]]); }
  (filas || []).forEach(function (f) {
    var u = celda(f, 'USUARIOS'), m = celda(f, 'MOTIVOS_DESCARTE');
    var a = celda(f, 'MEDICO_ALIAS'), n = celda(f, 'MEDICO_NOMBRE');
    if (u) out.usuarios.push(u);
    if (m) out.motivos.push(m);
    if (a && n) out.alias[normTexto(a)] = n;
    if (celda(f, 'DOCTOR')) out.doctores.push({ doctor: celda(f, 'DOCTOR'), sofdoc: celda(f, 'DOCTOR_SOFDOC') });
    if (celda(f, 'PROCEDIMIENTOS')) out.procedimientos.push(celda(f, 'PROCEDIMIENTOS'));
    if (celda(f, 'TRATAMIENTOS')) out.tratamientos.push(celda(f, 'TRATAMIENTOS'));
    var par = celda(f, 'MARCAS').split('|');
    if (par.length === 2 && textoLimpio_(par[0]) && textoLimpio_(par[1])) {
      var t = normTexto(par[0]);
      (out.marcas[t] = out.marcas[t] || []).push(textoLimpio_(par[1]));
    }
  });
  return out;
}

/* ==========================================================================
   SERIES Y ESTADO

   Una serie es un DNI dentro de una especialidad: ir a nutrición no cuenta
   como reevaluación de hematología.
   ========================================================================== */

function claveSerie(dni, especialidad) {
  return dni + '|' + normTexto(especialidad);
}

function porFecha(a, b) {
  return a.FECHA < b.FECHA ? -1 : a.FECHA > b.FECHA ? 1 : 0;
}

function armarSeries(citas) {
  var s = {};
  (citas || []).forEach(function (c) {
    var k = claveSerie(c.DNI, c.ESPECIALIDAD);
    if (!s[k]) s[k] = { clave: k, dni: c.DNI, especialidad: c.ESPECIALIDAD, nombre: c.NOMBRE, realizadas: [], agendadas: [] };
    var e = normTexto(c.ESTADO);
    if (e === 'REALIZADO') s[k].realizadas.push(c);
    else if (e === 'AGENDADO') s[k].agendadas.push(c);
  });
  Object.keys(s).forEach(function (k) {
    s[k].realizadas.sort(porFecha);
    s[k].agendadas.sort(porFecha);
    var r = s[k].realizadas;
    if (r.length && r[r.length - 1].NOMBRE) s[k].nombre = r[r.length - 1].NOMBRE;
  });
  return s;
}

/**
 * Estado de una serie. Gana la primera regla que se cumple (diseño §5):
 * ALTA, FALLECIDO, CERRADO, AGENDADO, RECUPERADO, AL DÍA, POR VENCER, VENCIDO, ANTIGUO.
 */
function estadoDeSerie(serie, seguimientos, reglas, hoy, alta, extra) {
  var plazo = plazoDe(reglas, serie.especialidad);
  var r = serie.realizadas;
  var ultima = r.length ? r[r.length - 1].FECHA : '';
  var penultima = r.length > 1 ? r[r.length - 2].FECHA : '';
  var out = { estado: '', ultima: ultima, esperada: '', vence: '', atraso: 0, intentos: 0, ultimoSeguimiento: '', proximaAgendada: '' };

  var futura = serie.agendadas.filter(function (c) { return c.FECHA >= hoy; })[0];
  if (futura) out.proximaAgendada = futura.FECHA;
  if (!ultima) { out.estado = 'SIN ATENCIÓN'; return out; }

  extra = extra || {};
  var ret = extra.retorno;
  if (ret && ret.fecha) {
    // El médico indicó cuándo volver: esa fecha manda sobre el plazo de REGLAS.
    out.esperada = ret.tipo === 'REEVALUACION' ? ret.fecha : sumarDias(ret.fecha, -reglas.avisoAltaControl);
    out.vence = sumarDias(out.esperada, plazo.vence - plazo.esperado);
  } else {
    out.esperada = sumarDias(ultima, plazo.esperado);
    out.vence = sumarDias(ultima, plazo.vence);
  }
  out.atraso = Math.max(0, diasEntre(out.vence, hoy));
  out.cierre = ''; out.fechaCierre = ''; out.agenda = null;
  if (extra.fallecido) { out.estado = 'FALLECIDO'; return out; }
  // El alta va primero: el doctor cerró el seguimiento (diseño de Registro, §5bis).
  if (alta) { out.estado = 'ALTA'; return out; }

  var lista = (seguimientos || []).slice().sort(function (a, b) {
    return a.FECHA_HORA < b.FECHA_HORA ? -1 : a.FECHA_HORA > b.FECHA_HORA ? 1 : 0;
  });
  if (lista.length) out.ultimoSeguimiento = fechaIso(lista[lista.length - 1].FECHA_HORA);
  var posteriores = lista.filter(function (s) { return fechaIso(s.FECHA_HORA) > ultima; });
  var c = leerCiclo(posteriores, reglas, hoy);
  out.intentos = c.intentos;

  if (c.cierre) { out.estado = 'CERRADO'; out.cierre = c.cierre.motivo; out.fechaCierre = c.cierre.fecha; return out; }
  if (extra.sinContacto) { out.estado = 'CERRADO'; out.cierre = 'NÚMERO EQUIVOCADO'; out.fechaCierre = extra.sinContacto; return out; }
  // La cita de SOFDOC gana sobre lo que haya dicho la asesora.
  if (futura) { out.estado = 'AGENDADO'; out.agenda = { tipo: 'CITA', fecha: futura.FECHA, intento: 0 }; return out; }
  if (c.agenda) { out.estado = 'AGENDADO'; out.agenda = c.agenda; return out; }

  var hechoAntesDeVolver = lista.some(function (s) {
    var f = fechaIso(s.FECHA_HORA);
    return normTexto(s.ACCION) === 'HECHO' && f <= ultima && (!penultima || f > penultima);
  });
  if (hechoAntesDeVolver && hoy < out.vence) { out.estado = 'RECUPERADO'; return out; }
  if (hoy < out.esperada) { out.estado = 'AL DÍA'; return out; }
  if (hoy < out.vence) { out.estado = 'POR VENCER'; return out; }
  out.estado = out.atraso <= reglas.corte ? 'VENCIDO' : 'ANTIGUO';
  return out;
}
/* ==========================================================================
   EMPAREJAMIENTO POR NOMBRE

   SOFDOC no trae teléfono y la base de hierro no trae DNI. Se unen por el
   nombre: una indicación es candidata de un paciente si TODAS sus palabras
   están en el nombre del paciente. Solo un candidato único, con al menos dos
   palabras, se empareja solo; lo demás lo confirma una persona.
   ========================================================================== */

function tokensNombre(nombre) {
  return normTexto(nombre).split(/[^A-Z]+/).filter(function (t) { return t && !PALABRAS_VACIAS[t]; });
}

function construirIndiceNombres(citas) {
  var porDni = {}, orden = [];
  (citas || []).forEach(function (c) {
    if (!c.DNI) return;
    if (!porDni[c.DNI]) { porDni[c.DNI] = { dni: c.DNI, nombre: c.NOMBRE, tokens: {} }; orden.push(c.DNI); }
    if (c.NOMBRE) porDni[c.DNI].nombre = c.NOMBRE;
    tokensNombre(c.NOMBRE).forEach(function (t) { porDni[c.DNI].tokens[t] = 1; });
  });
  return orden.map(function (d) { return porDni[d]; });
}

function emparejar(nombre, indice) {
  var t = tokensNombre(nombre);
  var cand = t.length ? indice.filter(function (p) { return t.every(function (x) { return p.tokens[x]; }); }) : [];
  var lista = cand.slice(0, 5).map(function (p) { return { dni: p.dni, nombre: p.nombre }; });
  if (cand.length === 1 && t.length >= 2) return { estado: 'AUTOMÁTICO', dni: cand[0].dni, candidatos: lista };
  return { estado: cand.length ? 'POR CONFIRMAR' : 'SIN CANDIDATO', dni: '', candidatos: lista };
}

function normalizarEstadoIndicacion(v) {
  var n = normTexto(v);
  if (n.indexOf('ACEPT') === 0) return 'ACEPTÓ';
  if (n.indexOf('COTIZ') === 0) return 'COTIZÓ';
  return n;
}

var COLUMNAS_INDICACIONES = ['ID', 'FECHA', 'TIPO', 'DETALLE', 'CANTIDAD', 'MEDICO_SOLICITANTE', 'ASESORA', 'NOMBRE',
  'TELEFONO', 'ESTADO', 'OBSERVACIONES', 'DNI', 'EMPAREJAMIENTO', 'ORIGEN'];

/**
 * Filas de una pestaña de la base de hierro -> indicaciones. Las que empiezan
 * por «HIERRO» (HIERRO, HIERRO EV DIARIO, HIERRO NUEVO) son hierro; las demás,
 * procedimientos. HIERRO NUEVO trae además DNI, médico y tipo de hierro.
 * `filas` son las filas debajo del encabezado, vacías incluidas, para que
 * ORIGEN apunte a la fila real de la hoja (encabezado en la fila 1).
 */
function indicacionesDesdeHierro(pestana, encabezado, filas, desde) {
  var idx = indiceDeEncabezado(encabezado);
  var tipo = normTexto(pestana).indexOf('HIERRO') === 0 ? 'HIERRO' : 'PROCEDIMIENTO';
  function celda(f, k) { return idx[k] === undefined ? '' : f[idx[k]]; }
  var out = [], n = desde || 1;
  (filas || []).forEach(function (f, i) {
    var nombre = textoLimpio_(celda(f, 'NOMBRE'));
    if (!nombre) return;
    out.push({
      ID: 'IND-' + ('000' + n++).slice(-4),
      FECHA: fechaIso(celda(f, 'FECHA')),
      TIPO: tipo,
      DETALLE: tipo === 'HIERRO' ? 'HIERRO' : textoLimpio_(celda(f, 'TIPO DE EXAMENES')),
      CANTIDAD: tipo === 'HIERRO' ? celda(f, 'CANTIDAD') : '',
      MEDICO_SOLICITANTE: textoLimpio_(celda(f, 'MEDICO SOLICITANTE')),
      ASESORA: normTexto(celda(f, 'ASESOR')),
      NOMBRE: nombre,
      TELEFONO: normTelefono(celda(f, 'TELEFONO')),
      ESTADO: normalizarEstadoIndicacion(celda(f, '¿ACEPTARON? ¿COTIZACION?')),
      OBSERVACIONES: [celda(f, 'TIPO DE HIERRO'), celda(f, 'OBSERVACIONES') || celda(f, 'OBSERVACION')]
        .map(textoLimpio_).filter(Boolean).join(' · '),
      DNI: normDni(celda(f, 'DNI')),
      EMPAREJAMIENTO: '',
      ORIGEN: textoLimpio_(pestana) + '!' + (i + 2)
    });
  });
  return out;
}

/**
 * Empareja lo que falta. Lo CONFIRMADO o AUTOMÁTICO con DNI no se toca; un
 * DNI escrito a mano sin estado se respeta y queda CONFIRMADO.
 */
function aplicarEmparejamientos(indicaciones, indice) {
  var cambios = 0;
  (indicaciones || []).forEach(function (ind) {
    var e = normTexto(ind.EMPAREJAMIENTO);
    var dni = normDni(ind.DNI);
    if ((e === 'CONFIRMADO' || e === 'AUTOMATICO') && dni) return;
    // El script nunca escribe un DNI junto a POR CONFIRMAR o SIN CANDIDATO: si lo hay, lo puso una persona.
    if (dni) {
      if (ind.DNI !== dni || ind.EMPAREJAMIENTO !== 'CONFIRMADO') cambios++;
      ind.DNI = dni;
      ind.EMPAREJAMIENTO = 'CONFIRMADO';
      return;
    }
    var r = emparejar(ind.NOMBRE, indice);
    if (dni !== r.dni || ind.EMPAREJAMIENTO !== r.estado) cambios++;
    ind.DNI = r.dni;
    ind.EMPAREJAMIENTO = r.estado;
  });
  return cambios;
}

function claveIndicacion_(i) {
  return [fechaIso(i.FECHA), normTexto(i.NOMBRE), normTexto(i.TIPO), normTexto(i.DETALLE)].join('|');
}

/**
 * Las candidatas que todavía no están en INDICACIONES. Se cuentan como un
 * multiconjunto: dos filas iguales en la base son dos cotizaciones, y si ya
 * había una solo falta la otra. Así importar dos veces no duplica nada.
 */
function indicacionesQueFaltan(existentes, candidatas) {
  var hay = {};
  (existentes || []).forEach(function (i) { var k = claveIndicacion_(i); hay[k] = (hay[k] || 0) + 1; });
  return (candidatas || []).filter(function (i) {
    var k = claveIndicacion_(i);
    if (hay[k]) { hay[k]--; return false; }
    return true;
  });
}

/**
 * Fila (base 0) de una indicación SIN CANDIDATO a la que se le puede poner
 * DNI a mano. `conocidos` = { dni: 1 } de los pacientes en SOFDOC o Registro:
 * así un DNI mal escrito no crea un paciente que no existe.
 */
function buscarFilaParaAsignar(encabezado, filas, id, dni, conocidos) {
  var idx = indiceDeEncabezado(encabezado);
  id = textoLimpio_(id);
  for (var i = 0; i < filas.length; i++) {
    if (textoLimpio_(filas[i][idx.ID]) !== id) continue;
    var estado = normTexto(filas[i][idx.EMPAREJAMIENTO]);
    if (normDni(filas[i][idx.DNI]) || (estado && estado !== 'SIN CANDIDATO')) {
      return { fila: -1, error: 'La indicación ' + id + ' ya tiene paciente.' };
    }
    if (!(conocidos || {})[normDni(dni)]) {
      return { fila: -1, error: 'El DNI ' + dni + ' no está en SOFDOC ni en Registro. Revise que esté bien escrito.' };
    }
    return { fila: i, error: '' };
  }
  return { fila: -1, error: 'No encontré la indicación ' + id + '.' };
}

/**
 * Buscador de la pestaña Pacientes. Encuentra al paciente si su nombre tiene
 * todas las palabras escritas, en cualquier orden, o si su DNI contiene lo
 * escrito. Mira las citas (la más reciente primero), luego Registro y luego
 * el historial de indicaciones: quien vino solo por hierro también aparece.
 */
function buscarEnPacientes(texto, f) {
  var q = normTexto(texto);
  if (q.replace(/\s/g, '').length < 3) return [];
  var palabras = q.split(' '), dni = normDni(texto), conDigitos = /\d/.test(dni);
  var vistos = {}, out = [];
  function ver(d, nombre) {
    d = normDni(d);
    if (!d || vistos[d] || out.length >= 20) return;
    var n = normTexto(nombre);
    if ((conDigitos && d.indexOf(dni) >= 0) || palabras.every(function (w) { return n.indexOf(w) >= 0; })) {
      vistos[d] = 1;
      out.push({ DNI: d, NOMBRE: textoLimpio_(nombre) });
    }
  }
  var citas = (f && f.citas) || [], registros = (f && f.registros) || [];
  for (var i = citas.length - 1; i >= 0; i--) ver(citas[i].DNI, citas[i].NOMBRE);
  for (var j = registros.length - 1; j >= 0; j--) {
    if (normTexto(registros[j].ANULADO) !== 'SI') ver(registros[j].DNI, registros[j].NOMBRE);
  }
  ((f && f.indicaciones) || []).forEach(function (x) { ver(x.DNI, x.NOMBRE); });
  return out;
}

/** Da un ID 'IND-nnnn' a las indicaciones anotadas a mano sin ID. Devuelve cuántas cambió. */
function completarIds(filas) {
  var mayor = 0, cambios = 0;
  (filas || []).forEach(function (f) {
    var m = String(f.ID || '').match(/^IND-(\d+)$/);
    if (m && Number(m[1]) > mayor) mayor = Number(m[1]);
  });
  (filas || []).forEach(function (f) {
    if (String(f.ID || '').trim() || !textoLimpio_(f.NOMBRE)) return;
    mayor++;
    f.ID = 'IND-' + ('000' + mayor).slice(-4);
    cambios++;
  });
  return cambios;
}

/**
 * Fila (base 0, debajo del encabezado) que se puede confirmar: la del ID dado,
 * todavía POR CONFIRMAR, y con el DNI entre sus candidatos.
 */
function buscarFilaParaConfirmar(encabezado, filas, id, dni, indice) {
  var idx = indiceDeEncabezado(encabezado);
  id = textoLimpio_(id);
  if (!id) return { fila: -1, error: 'Esta indicación no tiene ID. Ejecute «Actualizar» y vuelva a intentarlo.' };
  for (var i = 0; i < filas.length; i++) {
    if (textoLimpio_(filas[i][idx.ID]) !== id) continue;
    if (normTexto(filas[i][idx.EMPAREJAMIENTO]) !== 'POR CONFIRMAR') {
      return { fila: -1, error: 'La indicación ' + id + ' ya no está por confirmar.' };
    }
    var candidatos = emparejar(filas[i][idx.NOMBRE], indice).candidatos;
    if (!candidatos.some(function (c) { return c.dni === normDni(dni); })) {
      return { fila: -1, error: 'El DNI ' + dni + ' no es candidato de la indicación ' + id + '.' };
    }
    return { fila: i, error: '' };
  }
  return { fila: -1, error: 'No encontré la indicación ' + id + '.' };
}
/* ==========================================================================
   CRM DE LEADS (solo lectura)

   Se traen solo los leads con DNI o nombre (sin ellos no se pueden unir con
   ningún paciente) y solo las columnas que hacen falta.
   ========================================================================== */

var COLUMNAS_CONTACTOS = ['ID_LEAD', 'FECHA', 'NOMBRE', 'DNI', 'TELEFONO', 'CANAL', 'CAMPANA', 'DNI_PACIENTE', 'EMPAREJAMIENTO'];
/* Sin DNI, nombres, canal o campaña la copia saldría degradada sin avisar: mejor no tocarla. */
var CRM_OBLIGATORIAS = ['ID', 'FECHA', 'NOMBRES', 'APELLIDOS', 'DNI', 'TELEFONO', 'CANAL_ESPECIFICO', 'CAMPANA'];

function campanaLimpia_(v) {
  var t = textoLimpio_(v), n = normTexto(t);
  if (!n || n === 'NINGUNA CAMPANA' || n === 'NO SE VISUALIZA CAMPANA') return 'Sin campaña';
  return t;
}

function contactosDesdeCrm(encabezado, filas) {
  var idx = indiceDeEncabezado(encabezado);
  var faltantes = CRM_OBLIGATORIAS.filter(function (c) { return idx[c] === undefined; });
  if (faltantes.length) return { contactos: [], faltantes: faltantes };
  function celda(f, k) { return idx[k] === undefined ? '' : f[idx[k]]; }
  var out = [];
  (filas || []).forEach(function (f) {
    var id = textoLimpio_(celda(f, 'ID'));
    var nombre = textoLimpio_(textoLimpio_(celda(f, 'NOMBRES')) + ' ' + textoLimpio_(celda(f, 'APELLIDOS')));
    var dni = normDni(celda(f, 'DNI'));
    var fecha = fechaIso(celda(f, 'FECHA'));
    if (!id || !fecha || (!dni && !nombre)) return;
    out.push({
      ID_LEAD: id,
      FECHA: fecha,
      NOMBRE: nombre,
      DNI: dni,
      TELEFONO: normTelefono(celda(f, 'TELEFONO')),
      CANAL: textoLimpio_(celda(f, 'CANAL_ESPECIFICO')) || textoLimpio_(celda(f, 'CANAL')) || 'Sin canal',
      CAMPANA: campanaLimpia_(celda(f, 'CAMPANA')),
      DNI_PACIENTE: '',
      EMPAREJAMIENTO: ''
    });
  });
  return { contactos: out, faltantes: [] };
}

/** Une cada lead con su paciente: por DNI si existe en CITAS; si el lead no trae DNI, por nombre (un solo candidato). */
function emparejarContactos(contactos, citas) {
  var conCitas = {}, n = 0;
  (citas || []).forEach(function (c) { conCitas[c.DNI] = 1; });
  var indice = construirIndiceNombres(citas);
  (contactos || []).forEach(function (c) {
    if (c.DNI && conCitas[c.DNI]) { c.DNI_PACIENTE = c.DNI; c.EMPAREJAMIENTO = 'POR DNI'; n++; return; }
    // Un DNI que no es de ningún paciente es otra persona (o alguien que nunca vino): no se une por nombre.
    if (c.DNI) { c.DNI_PACIENTE = ''; c.EMPAREJAMIENTO = 'DNI SIN PACIENTE'; return; }
    var r = c.NOMBRE ? emparejar(c.NOMBRE, indice) : { estado: 'SIN CANDIDATO', dni: '' };
    c.DNI_PACIENTE = r.estado === 'AUTOMÁTICO' ? r.dni : '';
    c.EMPAREJAMIENTO = r.estado;
    if (c.DNI_PACIENTE) n++;
  });
  return n;
}

/* ==========================================================================
   PACIENTES Y BANDEJA
   ========================================================================== */

var COLUMNAS_PACIENTES = ['DNI', 'ESPECIALIDAD', 'NOMBRE', 'TELEFONOS', 'MEDICO_ULTIMO', 'PRIMERA_CITA', 'ULTIMA_CITA',
  'N_REALIZADAS', 'PROXIMA_ESPERADA', 'VENCE', 'DIAS_ATRASO', 'PROXIMA_AGENDADA', 'ESTADO', 'N_SEGUIMIENTOS',
  'ULTIMO_SEGUIMIENTO', 'PENDIENTE', 'CIERRE', 'FECHA_CIERRE', 'AGENDA', 'FECHA_AGENDA', 'INTENTO'];

/**
 * Teléfonos de cada paciente: primero los de hierro y procedimientos, luego los del CRM, sin repetir.
 * Sin los marcados como «número equivocado»; uno marcado vuelve solo si llega de nuevo
 * por un registro posterior a la marca (alguien lo confirmó con el paciente).
 */
function telefonosPorDni(indicaciones, contactos, seguimientos) {
  var out = {}, marcas = marcasTelefono(seguimientos);
  function sumar(dni, telefono, fecha) {
    var t = normTelefono(telefono);
    if (!dni || !t) return;
    var m = marcas[dni] && marcas[dni][t];
    if (m && !(fecha && fecha > m)) return;
    out[dni] = out[dni] || [];
    if (out[dni].indexOf(t) < 0) out[dni].push(t);
  }
  (indicaciones || []).forEach(function (i) { sumar(i.DNI, i.TELEFONO, i.ORIGEN === 'REGISTROS' ? i.FECHA : ''); });
  (contactos || []).forEach(function (c) { sumar(c.DNI_PACIENTE, c.TELEFONO, ''); });
  return out;
}

/** Cotizado y no aceptado después (mismo DNI y mismo tipo) = pendiente. */
function pendientesPorDni(indicaciones) {
  var aceptado = {}, out = {};
  (indicaciones || []).forEach(function (i) {
    if (!i.DNI || i.ESTADO !== 'ACEPTÓ') return;
    var k = i.DNI + '|' + i.TIPO;
    if (!aceptado[k] || i.FECHA > aceptado[k]) aceptado[k] = i.FECHA;
  });
  (indicaciones || []).forEach(function (i) {
    // Un registro dentro de su espera de 7 días todavía no es «cotizó y no lo hizo».
    if (!i.DNI || i.ESTADO !== 'COTIZÓ' || i.EN_ESPERA === 'SÍ') return;
    var a = aceptado[i.DNI + '|' + i.TIPO];
    if (a && a >= i.FECHA) return;
    var cantidad = Number(i.CANTIDAD);
    var nombre = i.TIPO === 'HIERRO' ? (normTexto(i.DETALLE) === 'HIERRO' ? 'Hierro (Ferinject)' : frase_(i.DETALLE)) : (i.DETALLE || 'Procedimiento');
    var texto = nombre + (cantidad > 1 ? ' ×' + cantidad : '') + ': cotizó y no lo hizo';
    (out[i.DNI] = out[i.DNI] || []).push(texto);
  });
  return out;
}

function segsPorSerie(seguimientos) {
  var out = {};
  (seguimientos || []).forEach(function (s) {
    var k = claveSerie(s.DNI, s.ESPECIALIDAD);
    (out[k] = out[k] || []).push(s);
  });
  return out;
}

function armarPacientes(citas, indicaciones, seguimientos, reglas, hoy, contactos, altas, retornos) {
  var series = armarSeries(citas);
  var tel = telefonosPorDni(indicaciones, contactos, seguimientos), pend = pendientesPorDni(indicaciones), segs = segsPorSerie(seguimientos);
  var marcas = marcasTelefono(seguimientos), muertos = fallecidos(seguimientos);
  var out = [];
  Object.keys(series).forEach(function (k) {
    var s = series[k];
    if (!s.realizadas.length) return;
    var e = estadoDeSerie(s, segs[k], reglas, hoy, (altas || {})[k],
      { fallecido: !!muertos[s.dni], sinContacto: sinContacto_(s.dni, marcas, tel, ''), retorno: (retornos || {})[k] });
    out.push({
      DNI: s.dni,
      ESPECIALIDAD: s.especialidad,
      NOMBRE: s.nombre,
      TELEFONOS: (tel[s.dni] || []).join(' / '),
      MEDICO_ULTIMO: s.realizadas[s.realizadas.length - 1].MEDICO,
      PRIMERA_CITA: s.realizadas[0].FECHA,
      ULTIMA_CITA: e.ultima,
      N_REALIZADAS: s.realizadas.length,
      PROXIMA_ESPERADA: e.esperada,
      VENCE: e.vence,
      DIAS_ATRASO: e.atraso,
      PROXIMA_AGENDADA: e.proximaAgendada,
      ESTADO: e.estado,
      N_SEGUIMIENTOS: e.intentos,
      ULTIMO_SEGUIMIENTO: e.ultimoSeguimiento,
      PENDIENTE: (pend[s.dni] || []).join('; '),
      CIERRE: e.cierre || '',
      FECHA_CIERRE: e.fechaCierre || '',
      AGENDA: e.agenda ? e.agenda.tipo : '',
      FECHA_AGENDA: e.agenda ? e.agenda.fecha : '',
      INTENTO: e.agenda ? e.agenda.intento : 0,
      RETORNO_TIPO: ((retornos || {})[k] || {}).tipo || '',
      FECHA_RETORNO: ((retornos || {})[k] || {}).fecha || ''
    });
  });
  return out.sort(function (a, b) { return a.NOMBRE < b.NOMBRE ? -1 : a.NOMBRE > b.NOMBRE ? 1 : 0; });
}

var TIPOS_INDICACION = { HIERRO: 1, PROCEDIMIENTO: 1 };

/**
 * Hierro y procedimientos cotizados y no hechos, como seguimientos propios:
 * una fila por DNI y tipo, estén o no al día con su reevaluación. En
 * SEGUIMIENTOS se registran con ESPECIALIDAD = HIERRO o PROCEDIMIENTO.
 */
function pendientesIndicacion(citas, indicaciones, seguimientos, reglas, hoy, contactos) {
  var aceptado = {}, grupos = {};
  (indicaciones || []).forEach(function (i) {
    if (!i.DNI || i.ESTADO !== 'ACEPTÓ') return;
    var k = i.DNI + '|' + i.TIPO;
    if (!aceptado[k] || i.FECHA > aceptado[k]) aceptado[k] = i.FECHA;
  });
  (indicaciones || []).forEach(function (i) {
    if (i.ORIGEN === 'REGISTROS') return;
    if (!i.DNI || !i.FECHA || i.ESTADO !== 'COTIZÓ' || !TIPOS_INDICACION[i.TIPO]) return;
    var k = i.DNI + '|' + i.TIPO;
    if (aceptado[k] && aceptado[k] >= i.FECHA) return;
    var g = grupos[k] = grupos[k] || { dni: i.DNI, tipo: i.TIPO, fecha: '', detalles: [], nombre: i.NOMBRE, solicitante: '' };
    if (i.FECHA >= g.fecha) { g.fecha = i.FECHA; if (i.MEDICO_SOLICITANTE) g.solicitante = i.MEDICO_SOLICITANTE; }
    var cantidad = Number(i.CANTIDAD);
    var texto = (i.TIPO === 'HIERRO' ? 'Hierro (Ferinject)' : (i.DETALLE || 'Procedimiento')) + (cantidad > 1 ? ' ×' + cantidad : '');
    if (g.detalles.indexOf(texto) < 0) g.detalles.push(texto);
  });
  var porDni = realizadasPorDni_(citas), tel = telefonosPorDni(indicaciones, contactos, seguimientos), segs = {};
  var marcas = marcasTelefono(seguimientos), muertos = fallecidos(seguimientos);
  (seguimientos || []).forEach(function (s) {
    var t = normTexto(s.ESPECIALIDAD);
    if (s.REFERENCIA || !TIPOS_INDICACION[t]) return;
    (segs[s.DNI + '|' + t] = segs[s.DNI + '|' + t] || []).push(s);
  });
  return Object.keys(grupos).sort().map(function (k) {
    var g = grupos[k], realizadas = porDni[g.dni] || [];
    var previa = ultimaAntesDe_(realizadas, g.fecha) || realizadas[realizadas.length - 1];
    var ultima = realizadas[realizadas.length - 1];
    var lista = (segs[k] || []).filter(function (s) { return fechaIso(s.FECHA_HORA) >= g.fecha; })
      .sort(function (a, b) { return a.FECHA_HORA < b.FECHA_HORA ? -1 : a.FECHA_HORA > b.FECHA_HORA ? 1 : 0; });
    var c = leerCiclo(lista, reglas, hoy);
    var dias = Math.max(0, diasEntre(g.fecha, hoy)), estado = 'PENDIENTE', cierre = c.cierre;
    var sc = sinContacto_(g.dni, marcas, tel, '');
    if (muertos[g.dni]) estado = 'FALLECIDO';
    else if (cierre) estado = 'CERRADO';
    else if (sc) { estado = 'CERRADO'; cierre = { motivo: 'NÚMERO EQUIVOCADO', fecha: sc }; }
    else if (c.loHizo) estado = 'COMPLETADO';
    else if (c.agenda) estado = 'AGENDADO';
    else if (dias > reglas.corteIndicaciones) estado = 'ANTIGUO';
    return {
      DNI: g.dni,
      ESPECIALIDAD: g.tipo,
      TIPO_SEGUIMIENTO: g.tipo,
      NOMBRE: ultima ? ultima.NOMBRE : g.nombre,
      TELEFONOS: (tel[g.dni] || []).join(' / '),
      MEDICO_ULTIMO: g.solicitante || (previa ? previa.MEDICO : ''),
      ESPECIALIDAD_CONSULTA: previa ? previa.ESPECIALIDAD : '',
      FECHA_COTIZACION: g.fecha,
      DETALLE: g.detalles.join(' · '),
      TRATAMIENTO: g.tipo === 'HIERRO' ? 'Hierro (Ferinject)' : '',
      MARCA: '',
      DIAS: dias,
      ULTIMA_CITA: ultima ? ultima.FECHA : '',
      N_SEGUIMIENTOS: c.intentos,
      ULTIMO_SEGUIMIENTO: lista.length ? fechaIso(lista[lista.length - 1].FECHA_HORA) : '',
      ESTADO: estado,
      CIERRE: cierre ? cierre.motivo : '',
      FECHA_CIERRE: cierre ? cierre.fecha : '',
      AGENDA: c.agenda ? c.agenda.tipo : '',
      FECHA_AGENDA: c.agenda ? c.agenda.fecha : '',
      INTENTO: c.agenda ? c.agenda.intento : 0,
      FECHA_LOHIZO: c.loHizo
    };
  });
}

/**
 * Diseño §7.1: primer intento antes; con algo pendiente antes; menos días antes.
 * Une las reevaluaciones vencidas con el hierro y los procedimientos pendientes.
 */
function ordenarBandeja(pacientes, pendientes) {
  var reeval = (pacientes || []).filter(function (p) { return p.ESTADO === 'VENCIDO'; }).map(function (p) {
    var t = {};
    Object.keys(p).forEach(function (k) { t[k] = p[k]; });
    t.TIPO_SEGUIMIENTO = 'REEVALUACION';
    return t;
  });
  var otros = (pendientes || []).filter(function (p) { return p.ESTADO === 'PENDIENTE' || p.ESTADO === 'POR REEVALUAR'; });
  var conPendiente = function (t) { return t.TIPO_SEGUIMIENTO !== 'REEVALUACION' || t.PENDIENTE ? 0 : 1; };
  var dias = function (t) { return t.TIPO_SEGUIMIENTO === 'REEVALUACION' ? t.DIAS_ATRASO : t.DIAS; };
  return reeval.concat(otros).sort(function (a, b) {
    return (a.N_SEGUIMIENTOS - b.N_SEGUIMIENTOS) ||
      (conPendiente(a) - conPendiente(b)) ||
      (dias(a) - dias(b)) ||
      (a.DNI < b.DNI ? -1 : a.DNI > b.DNI ? 1 : 0) ||
      (a.TIPO_SEGUIMIENTO < b.TIPO_SEGUIMIENTO ? -1 : a.TIPO_SEGUIMIENTO > b.TIPO_SEGUIMIENTO ? 1 : 0);
  });
}

/** Sheets toma como fórmula un texto que empieza por = + - @: se le antepone un apóstrofo. */
function textoSeguro(v) {
  return (typeof v === 'string' && /^[=+\-@]/.test(v)) ? "'" + v : v;
}

/** Une frases para un mensaje con un solo punto entre ellas, aunque alguna ya traiga el suyo. */
function unirFrases(partes) {
  var limpias = (partes || []).map(function (p) { return String(p || '').trim().replace(/\.+$/, ''); }).filter(Boolean);
  return limpias.length ? limpias.join('. ') + '.' : '';
}

function validarAccion(p, catalogos, accion, pacientes) {
  if (!p || !normTexto(p.usuario)) return 'Elija quién es usted en el selector de arriba.';
  if (catalogos.usuarios.map(normTexto).indexOf(normTexto(p.usuario)) < 0) {
    return 'El usuario «' + p.usuario + '» no está en CATALOGOS.';
  }
  if (!normDni(p.dni)) return 'Falta el DNI del paciente.';
  if (!normTexto(p.especialidad)) return 'Falta la especialidad.';
  if (accion === 'DESCARTADO' && catalogos.motivos.map(normTexto).indexOf(normTexto(p.motivo)) < 0) {
    return 'Elija un motivo de descarte.';
  }
  if (pacientes && !pacientes.some(function (x) {
    return x.DNI === normDni(p.dni) && normTexto(x.ESPECIALIDAD) === normTexto(p.especialidad) &&
      (p.referencia ? x.ID_REGISTRO === p.referencia : !x.ID_REGISTRO);
  })) {
    return 'Ese paciente no está en la lista. Recargue la página.';
  }
  return '';
}

/** Un NaN en la respuesta hace que google.script.run devuelva null entero. */
function limpiarParaEnvio(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return isFinite(v) ? v : '';
  if (Array.isArray(v)) return v.map(limpiarParaEnvio);
  if (Object.prototype.toString.call(v) === '[object Date]') return isNaN(v.getTime()) ? '' : v.toISOString();
  if (typeof v === 'object') {
    var o = {};
    Object.keys(v).forEach(function (k) { o[k] = limpiarParaEnvio(v[k]); });
    return o;
  }
  return v;
}
/* ==========================================================================
   INDICADORES (diseño §7.3)
   ========================================================================== */

/** Variantes escritas a mano → nombre canónico. Se reconocen por el comienzo, sin tildes. */
var GRUPOS_PROC = [
  ['BIOPS', 'BIOPSIA'], ['BIOSI', 'BIOPSIA'], ['BIPOS', 'BIOPSIA'],
  ['CITOM', 'CITOMETRÍA DE FLUJO'], ['CITOG', 'CITOGENÉTICA'], ['CARIO', 'CARIOTIPO'], ['SANGR', 'SANGRÍA']
];
var ORDEN_GRUPOS = ['AMO', 'BIOPSIA', 'CITOMETRÍA DE FLUJO', 'CARIOTIPO', 'CITOGENÉTICA', 'SANGRÍA'];

function grupoProcedimiento(detalle) {
  var partesRaw = normTexto(detalle).split(/[\+,\/]/);
  var partes = [];
  partesRaw.forEach(function(parte) {
    parte = parte.trim();
    if (!parte) return;
    if (parte === 'AMO' || parte.indexOf('AMO ') === 0) {
      partes.push('AMO');
      return;
    }
    for (var i = 0; i < GRUPOS_PROC.length; i++) {
      var prefijo = GRUPOS_PROC[i][0];
      if (prefijo === 'CITOM' && parte.indexOf('CITOMEG') === 0) continue;
      if (parte.indexOf(prefijo) === 0) {
        partes.push(GRUPOS_PROC[i][1]);
        return;
      }
    }
    partes.push(parte);
  });
  var unicas = partes.filter(function (x, i) { return partes.indexOf(x) === i; });
  return unicas.sort(function (a, b) {
    var ia = ORDEN_GRUPOS.indexOf(a), ib = ORDEN_GRUPOS.indexOf(b);
    if (ia < 0) ia = 99;
    if (ib < 0) ib = 99;
    return ia - ib || (a < b ? -1 : a > b ? 1 : 0);
  }).join(' + ');
}

function compararCampos_(campos) {
  return function (a, b) {
    for (var i = 0; i < campos.length; i++) {
      var x = a[campos[i]], y = b[campos[i]];
      if (x < y) return -1;
      if (x > y) return 1;
    }
    return 0;
  };
}

/**
 * Retorno por cohorte. La cohorte es el mes de la primera cita realizada de
 * la serie. Un paciente cuenta en la etapa k solo si ya volvió o si su
 * plazo de esa etapa ya venció ("maduro"): así un mes reciente no aparece
 * con un retorno artificialmente bajo.
 */
function kpiCohortes(citas, reglas, hoy, altas) {
  var series = armarSeries(citas), acc = {};
  Object.keys(series).forEach(function (k) {
    var s = series[k], r = s.realizadas;
    if (!r.length) return;
    var plazo = plazoDe(reglas, s.especialidad);
    for (var etapa = 1; etapa <= 3 && r.length >= etapa; etapa++) {
      var volvio = r.length >= etapa + 1;
      var alta = !volvio && !!(altas && altas[k]);
      var enCurso = !volvio && !alta && sumarDias(r[etapa - 1].FECHA, plazo.vence) > hoy;
      // En curso solo interesa en la 1.ª: «solo vino a su primera consulta, pero aún está en plazo».
      if (enCurso && etapa > 1) continue;
      var clave = [mesDe(r[0].FECHA), s.especialidad, r[0].MEDICO, etapa].join('|');
      if (!acc[clave]) acc[clave] = { COHORTE: mesDe(r[0].FECHA), ESPECIALIDAD: s.especialidad, MEDICO: r[0].MEDICO, ETAPA: etapa, ELEGIBLES: 0, VOLVIERON: 0, EN_CURSO: 0, ALTAS: 0 };
      // Con alta vigente no volvió porque el doctor lo dio de alta: no es una pérdida.
      if (alta) { acc[clave].ALTAS++; continue; }
      if (enCurso) { acc[clave].EN_CURSO++; continue; }
      acc[clave].ELEGIBLES++;
      if (volvio) acc[clave].VOLVIERON++;
    }
  });
  return Object.keys(acc).map(function (k) { return acc[k]; })
    .sort(compararCampos_(['COHORTE', 'ESPECIALIDAD', 'MEDICO', 'ETAPA']));
}

function realizadasPorDni_(citas) {
  var out = {};
  (citas || []).forEach(function (c) {
    if (normTexto(c.ESTADO) === 'REALIZADO') (out[c.DNI] = out[c.DNI] || []).push(c);
  });
  Object.keys(out).forEach(function (d) { out[d].sort(porFecha); });
  return out;
}

function ultimaAntesDe_(lista, fecha) {
  var u = null;
  (lista || []).forEach(function (c) { if (c.FECHA <= fecha) u = c; });
  return u;
}

function kpiIndicaciones(indicaciones, citas) {
  var porDni = realizadasPorDni_(citas), acc = {};
  (indicaciones || []).forEach(function (i) {
    if (i.EN_ESPERA === 'SÍ') return;
    var previa = i.DNI ? ultimaAntesDe_(porDni[i.DNI], i.FECHA) : null;
    var medico = i.MEDICO_SOLICITANTE || (previa ? previa.MEDICO : '') || 'SIN MÉDICO';
    var clave = [mesDe(i.FECHA), i.TIPO, i.DETALLE, medico].join('|');
    if (!acc[clave]) acc[clave] = { MES: mesDe(i.FECHA), TIPO: i.TIPO, DETALLE: i.DETALLE, GRUPO: grupoProcedimiento(i.DETALLE), MEDICO: medico, INDICADAS: 0, ACEPTADAS: 0, COMPLETADAS: 0 };
    acc[clave].INDICADAS++;
    if (i.ESTADO === 'ACEPTÓ') acc[clave].ACEPTADAS++;
    if (i.ESTADO === 'ACEPTÓ' && i.COMPLETO !== 'NO') acc[clave].COMPLETADAS++;
  });
  return Object.keys(acc).map(function (k) { return acc[k]; })
    .sort(compararCampos_(['MES', 'TIPO', 'DETALLE', 'MEDICO']));
}

/**
 * Una fila por serie y por ciclo (la última cita realizada antes del
 * seguimiento): tres seguimientos seguidos y un retorno son UNA recuperación,
 * contada en el mes del primer seguimiento. Una cita agendada que ya pasó no
 * cuenta como retorno: nadie la actualizó en SOFDOC, pero no se sabe si vino.
 */
function kpiRecuperacion(seguimientos, citas, hoy) {
  var series = armarSeries(citas), vistos = {}, out = [];
  (seguimientos || []).filter(function (s) { return normTexto(s.ACCION) === 'HECHO' && !TIPOS_INDICACION[normTexto(s.ESPECIALIDAD)]; })
    .sort(function (a, b) { return a.FECHA_HORA < b.FECHA_HORA ? -1 : a.FECHA_HORA > b.FECHA_HORA ? 1 : 0; })
    .forEach(function (s) {
      var f = fechaIso(s.FECHA_HORA);
      var serie = series[claveSerie(s.DNI, s.ESPECIALIDAD)];
      var previa = serie ? ultimaAntesDe_(serie.realizadas, f) : null;
      var ciclo = claveSerie(s.DNI, s.ESPECIALIDAD) + '|' + (previa ? previa.FECHA : '');
      if (vistos[ciclo]) return;
      vistos[ciclo] = 1;
      var despues = serie ? serie.realizadas.concat(serie.agendadas.filter(function (c) { return !hoy || c.FECHA >= hoy; }))
        .filter(function (c) { return c.FECHA > f; }).sort(porFecha) : [];
      out.push({
        MES: mesDe(f),
        RESPONSABLE: s.RESPONSABLE,
        ESPECIALIDAD: s.ESPECIALIDAD,
        MEDICO: previa ? previa.MEDICO : '',
        VOLVIO: despues.length ? 1 : 0,
        DIAS: despues.length ? diasEntre(f, despues[0].FECHA) : '',
        FECHA_RETORNO: despues.length ? despues[0].FECHA : ''
      });
    });
  return out;
}

function kpiMotivos(seguimientos) {
  var acc = {};
  (seguimientos || []).forEach(function (s) {
    var indicacion = TIPOS_INDICACION[normTexto(s.ESPECIALIDAD)];
    if (normTexto(s.ACCION) !== 'DESCARTADO' || (indicacion && normTexto(s.RESULTADO) !== 'NO DESEA REALIZARSE')) return;
    var m = s.MOTIVO || 'SIN MOTIVO';
    acc[m] = (acc[m] || 0) + 1;
  });
  return Object.keys(acc).map(function (m) { return { MOTIVO: m, N: acc[m] }; })
    .sort(function (a, b) { return (b.N - a.N) || (a.MOTIVO < b.MOTIVO ? -1 : 1); });
}

/** Primera cita realizada de cada DNI, en cualquier especialidad. */
function primerasConsultas_(citas) {
  var p = {};
  (citas || []).forEach(function (c) {
    if (normTexto(c.ESTADO) !== 'REALIZADO') return;
    if (!p[c.DNI] || c.FECHA < p[c.DNI].FECHA) p[c.DNI] = c;
  });
  return p;
}

/**
 * Cada paciente va al lead más reciente con fecha <= su primera consulta (en
 * empate, el ID mayor). Los pacientes anteriores al lead más antiguo del CRM
 * quedan fuera: el CRM aún no existía.
 */
function atribuirCampanas(citas, contactos) {
  var todos = (contactos || []).filter(function (c) { return c.FECHA; });
  if (!todos.length) return {};
  var inicio = todos.reduce(function (m, c) { return c.FECHA < m ? c.FECHA : m; }, todos[0].FECHA);
  var porDni = {};
  todos.forEach(function (c) { if (c.DNI_PACIENTE) (porDni[c.DNI_PACIENTE] = porDni[c.DNI_PACIENTE] || []).push(c); });
  var primeras = primerasConsultas_(citas), out = {};
  Object.keys(primeras).forEach(function (dni) {
    var f = primeras[dni].FECHA;
    if (f < inicio) return;
    var elegido = null;
    (porDni[dni] || []).forEach(function (c) {
      if (c.FECHA > f) return;
      if (!elegido || c.FECHA > elegido.FECHA || (c.FECHA === elegido.FECHA && c.ID_LEAD > elegido.ID_LEAD)) elegido = c;
    });
    out[dni] = elegido
      ? { CANAL: elegido.CANAL, CAMPANA: elegido.CAMPANA, ID_LEAD: elegido.ID_LEAD }
      : { CANAL: 'Sin lead en el CRM', CAMPANA: 'Sin lead en el CRM', ID_LEAD: '' };
  });
  return out;
}

/** ¿Volvió a su 1.ª reevaluación? Por canal y campaña, contando solo a quienes ya debían volver. */
function kpiCampanas(citas, contactos, reglas, hoy) {
  var atrib = atribuirCampanas(citas, contactos), primeras = primerasConsultas_(citas), series = armarSeries(citas), acc = {};
  Object.keys(atrib).forEach(function (dni) {
    var p = primeras[dni], a = atrib[dni];
    var s = series[claveSerie(dni, p.ESPECIALIDAD)];
    var r = s.realizadas, volvio = r.length >= 2;
    var maduro = volvio || sumarDias(r[0].FECHA, plazoDe(reglas, s.especialidad).vence) <= hoy;
    var medico = p.MEDICO || 'SIN MÉDICO';
    var k = [mesDe(p.FECHA), medico, a.CANAL, a.CAMPANA].join('|');
    if (!acc[k]) acc[k] = { MES: mesDe(p.FECHA), MEDICO: medico, CANAL: a.CANAL, CAMPANA: a.CAMPANA, NUEVOS: 0, EN_CURSO: 0, VOLVIERON: 0 };
    acc[k].NUEVOS++;
    if (!maduro) acc[k].EN_CURSO++;
    else if (volvio) acc[k].VOLVIERON++;
  });
  return Object.keys(acc).map(function (k) { return acc[k]; })
    .sort(compararCampos_(['MES', 'CANAL', 'CAMPANA', 'MEDICO']));
}

function calcularKpi(citas, indicaciones, seguimientos, reglas, hoy, contactos, altas) {
  return {
    cohortes: kpiCohortes(citas, reglas, hoy, altas),
    indicaciones: kpiIndicaciones(indicaciones, citas),
    recuperacion: kpiRecuperacion(seguimientos, citas, hoy),
    motivos: kpiMotivos(seguimientos),
    campanas: kpiCampanas(citas, contactos, reglas, hoy),
    sinCandidato: (indicaciones || []).filter(function (i) { return normTexto(i.EMPAREJAMIENTO) === 'SIN CANDIDATO'; })
      .map(function (i) { return { ID: i.ID, FECHA: i.FECHA, TIPO: i.TIPO, NOMBRE: i.NOMBRE, TELEFONO: i.TELEFONO }; })
  };
}

/* ==========================================================================
   RESUMEN MENSUAL (pantalla «Resumen»)

   Una fila por mes y médico. Regla acordada el 02/10/2026: un paciente que no
   volvió cuenta en el MES DE SU ÚLTIMA CONSULTA de ese mes ("de los atendidos
   en julio, cuántos no volvieron"). Mientras no venza su plazo queda "en curso"
   y no entra en el porcentaje.
   ========================================================================== */

var CAMPOS_RESUMEN = ['NUEVOS', 'NUEVOS_NO', 'NUEVOS_CURSO', 'NUEVOS_ALTA', 'CONTROL', 'CONTROL_NO', 'CONTROL_CURSO', 'CONTROL_ALTA',
  'HIERRO', 'HIERRO_NO', 'HIERRO_COMPLETO', 'PROC', 'PROC_NO', 'SEGUIMIENTOS', 'RECUPERADOS'];

function resumenPorMes(citas, indicaciones, seguimientos, reglas, hoy, altas) {
  var acc = {};
  function fila(mes, medico) {
    var k = mes + '|' + medico;
    if (!acc[k]) {
      acc[k] = { MES: mes, MEDICO: medico };
      CAMPOS_RESUMEN.forEach(function (c) { acc[k][c] = 0; });
    }
    return acc[k];
  }

  // Reevaluaciones: la última consulta de cada serie en cada mes.
  var series = armarSeries(citas);
  Object.keys(series).forEach(function (k) {
    var s = series[k], r = s.realizadas, plazo = plazoDe(reglas, s.especialidad);
    r.forEach(function (c, i) {
      var siguiente = r[i + 1];
      if (siguiente && mesDe(siguiente.FECHA) === mesDe(c.FECHA)) return;
      var tipo = i === 0 ? 'NUEVOS' : 'CONTROL';
      var f = fila(mesDe(c.FECHA), c.MEDICO || 'SIN MÉDICO');
      f[tipo]++;
      if (siguiente) return;
      if (altas && altas[k]) { f[tipo + '_ALTA']++; return; }
      if (sumarDias(c.FECHA, plazo.vence) <= hoy) f[tipo + '_NO']++;
      else f[tipo + '_CURSO']++;
    });
  });

  // Hierro y procedimientos: una vez por paciente, tipo y mes.
  var porDni = realizadasPorDni_(citas), grupos = {}, aceptado = {}, completoDe = {};
  (indicaciones || []).forEach(function (i) {
    if (i.DNI && i.ESTADO === 'ACEPTÓ') {
      var a = i.DNI + '|' + i.TIPO;
      if (!aceptado[a] || i.FECHA > aceptado[a]) { aceptado[a] = i.FECHA; completoDe[a] = i.COMPLETO !== 'NO'; }
    }
  });
  (indicaciones || []).forEach(function (i) {
    if (!i.FECHA || i.EN_ESPERA === 'SÍ') return;
    var g = [i.DNI || i.ID, i.TIPO, mesDe(i.FECHA)].join('|');
    if (!grupos[g]) {
      var previa = i.DNI ? ultimaAntesDe_(porDni[i.DNI], i.FECHA) : null;
      grupos[g] = { mes: mesDe(i.FECHA), tipo: i.TIPO, dni: i.DNI, primera: i.FECHA,
        medico: i.MEDICO_SOLICITANTE || (previa ? previa.MEDICO : '') || 'SIN MÉDICO', acepto: false, completo: false };
    }
    if (i.FECHA < grupos[g].primera) grupos[g].primera = i.FECHA;
    if (i.ESTADO === 'ACEPTÓ') { grupos[g].acepto = true; if (i.COMPLETO !== 'NO') grupos[g].completo = true; }
  });
  Object.keys(grupos).forEach(function (k) {
    var g = grupos[k], clave = g.dni + '|' + g.tipo;
    var siguio = g.acepto || (g.dni && aceptado[clave] >= g.primera);
    var completo = g.acepto ? g.completo : !!(siguio && completoDe[clave]);
    var campo = g.tipo === 'HIERRO' ? 'HIERRO' : 'PROC';
    var f = fila(g.mes, g.medico);
    f[campo]++;
    if (!siguio) f[campo + '_NO']++;
    if (campo === 'HIERRO' && siguio && completo) f.HIERRO_COMPLETO++;
  });

  // Seguimientos hechos y cuántos volvieron.
  kpiRecuperacion(seguimientos, citas, hoy).forEach(function (r) {
    var f = fila(r.MES, r.MEDICO || 'SIN MÉDICO');
    f.SEGUIMIENTOS++;
    if (r.VOLVIO) f.RECUPERADOS++;
  });

  return Object.keys(acc).map(function (k) { return acc[k]; }).sort(function (a, b) {
    return a.MES < b.MES ? 1 : a.MES > b.MES ? -1 : (a.MEDICO < b.MEDICO ? -1 : a.MEDICO > b.MEDICO ? 1 : 0);
  });
}

/** Las dos tablas de la hoja KPI, una debajo de otra, todas las filas de 7 columnas. */
function filasHojaKpi(kpi) {
  var vacia = ['', '', '', '', '', '', ''];
  var f = [['RETORNO POR COHORTE', '', '', '', '', '', ''], ['COHORTE', 'ESPECIALIDAD', 'MEDICO', 'ETAPA', 'ELEGIBLES', 'VOLVIERON', 'TASA']];
  kpi.cohortes.forEach(function (r) {
    f.push([r.COHORTE, r.ESPECIALIDAD, r.MEDICO, r.ETAPA, r.ELEGIBLES, r.VOLVIERON, r.ELEGIBLES ? r.VOLVIERON / r.ELEGIBLES : '']);
  });
  f.push(vacia.slice());
  f.push(['INDICACIONES', '', '', '', '', '', '']);
  f.push(['MES', 'TIPO', 'DETALLE', 'MEDICO', 'INDICADAS', 'ACEPTADAS', 'TASA']);
  kpi.indicaciones.forEach(function (r) {
    f.push([r.MES, r.TIPO, r.DETALLE, r.MEDICO, r.INDICADAS, r.ACEPTADAS, r.INDICADAS ? r.ACEPTADAS / r.INDICADAS : '']);
  });
  return f;
}
