/* ==========================================================================
   REGISTRO, SESIONES Y ALTAS — lógica pura (sin Sheets). Usa Logica.gs.
   Diseño: docs/superpowers/specs/2026-10-05-pestana-registro-design.md
   ========================================================================== */

var COLUMNAS_REGISTROS = ['ID', 'FECHA_HORA', 'FECHA', 'ASESORA', 'DOCTOR', 'NOMBRE', 'DNI', 'CONTACTO', 'TIPO',
  'DETALLE', 'MARCA', 'SESIONES', 'ANULADO', 'MOTIVO_ANULACION', 'FECHA_INICIO', 'EXAMENES', 'FECHA_RETORNO', 'EDITADO'];
var COLUMNAS_SESIONES = ['ID', 'FECHA_HORA', 'ID_REGISTRO', 'NUMERO', 'FECHA', 'ASESORA', 'NOTA', 'ANULADO', 'MOTIVO_ANULACION'];
var COLUMNAS_ALTAS = ['ID', 'FECHA_HORA', 'FECHA', 'DNI', 'ESPECIALIDAD', 'DOCTOR', 'REGISTRADO_POR', 'NOTA', 'ANULADO', 'MOTIVO_ANULACION',
  'DECISION', 'FECHA_RETORNO'];

var MAX_SESIONES = 20;
var DIAS_DUPLICADO = 7;

/** El siguiente ID correlativo: siguienteId(['REG-000007'], 'REG') -> 'REG-000008'. */
function siguienteId(ids, prefijo) {
  var mayor = 0, re = new RegExp('^' + prefijo + '-(\\d+)$');
  (ids || []).forEach(function (id) {
    var m = String(id || '').trim().match(re);
    if (m && Number(m[1]) > mayor) mayor = Number(m[1]);
  });
  return prefijo + '-' + ('00000' + (mayor + 1)).slice(-6);
}

function anulado_(x) { return normTexto(x && x.ANULADO) === 'SI'; }

/** El valor tal como está en el catálogo, o '' si no está (sin importar mayúsculas ni tildes). */
function enLista_(lista, valor) {
  var n = normTexto(valor);
  if (!n) return '';
  for (var i = 0; i < (lista || []).length; i++) if (normTexto(lista[i]) === n) return lista[i];
  return '';
}

function copia_(a, b) {
  var o = {};
  [a, b].forEach(function (x) { Object.keys(x).forEach(function (k) { o[k] = x[k]; }); });
  return o;
}

function fechaDma_(iso) {
  var p = String(iso || '').split('-');
  return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : String(iso || '');
}

/** Un teléfono se guarda sin espacios ni signos ('987 654-321' -> '987654321'); un usuario (@…) tal cual. Como contactoEnvio de Index.html. */
function contactoNormal_(v) {
  var t = textoLimpio_(v);
  return /^\+?[\d\s().\-]+$/.test(t) ? t.replace(/[\s().\-]/g, '') : t;
}

/** DNI de 8 dígitos o carné de extranjería de 9 a 12 caracteres alfanuméricos. */
function documentoValido(dni) {
  var d = normTexto(dni).replace(/[\s.\-]/g, '');
  return /^\d{8}$/.test(d) || /^[A-Z0-9]{9,12}$/.test(d);
}

/** 'Hierro carboximaltosa · Ferinject × 3 sesiones' o 'Sangría'. */
function textoRegistro(r) {
  if (normTexto(r.TIPO) === 'CONTROL') return 'Control + laboratorio' + (textoLimpio_(r.EXAMENES) ? ' · ' + textoLimpio_(r.EXAMENES) : '');
  if (r.TIPO !== 'HIERRO') return frase_(r.DETALLE);
  var n = Number(r.SESIONES) || 1;
  return frase_(r.DETALLE) + (r.MARCA ? ' · ' + frase_(r.MARCA) : '') + ' × ' + n + (n === 1 ? ' sesión' : ' sesiones');
}

/** El médico para filtros y cifras: su nombre en SOFDOC o, si no tiene, el DOCTOR tal cual. */
function medicoDeRegistro(r, catalogos) {
  var d = (catalogos.doctores || []).filter(function (x) { return normTexto(x.doctor) === normTexto(r.DOCTOR); })[0];
  return d && d.sofdoc ? d.sofdoc : textoLimpio_(r.DOCTOR);
}

/** El primer DOCTOR del catálogo cuyo nombre SOFDOC es ese médico (así se propone «Dra. Karen Matos» y no el particular). */
function doctorPropuesto(catalogos, medicoSofdoc) {
  var d = (catalogos.doctores || []).filter(function (x) { return x.sofdoc && normTexto(x.sofdoc) === normTexto(medicoSofdoc); })[0];
  return d ? d.doctor : '';
}

function validarRegistro(p, catalogos, hoy) {
  function no(m) { return { error: m, filas: [] }; }
  if (!p) return no('Faltan los datos del registro.');
  var asesora = enLista_(catalogos.usuarios, p.usuario);
  if (!asesora) return no('Elija quién es usted en el selector de arriba.');
  if (!documentoValido(p.dni)) return no('El DNI debe tener 8 dígitos (o el carné de extranjería, de 9 a 12 caracteres).');
  var nombre = textoLimpio_(p.nombre).toUpperCase();
  if (!nombre) return no('Falta el nombre del paciente.');
  var contacto = contactoNormal_(p.contacto);
  if (!contacto) return no('Falta el teléfono o usuario.');
  var fecha = fechaIso(p.fecha);
  if (!fecha) return no('Falta la fecha.');
  if (fecha > hoy) return no('La fecha no puede ser futura.');
  var doctor = (catalogos.doctores || []).filter(function (d) { return normTexto(d.doctor) === normTexto(p.doctor); })[0];
  if (!doctor) return no('Elija el doctor de la lista.');
  var base0 = { FECHA: fecha, ASESORA: asesora, DOCTOR: doctor.doctor, NOMBRE: nombre, DNI: normDni(p.dni), CONTACTO: contacto,
    MARCA: '', ANULADO: '', MOTIVO_ANULACION: '', FECHA_INICIO: '', EXAMENES: '', FECHA_RETORNO: '', EDITADO: '' };
  if (normTexto(p.tipo) === 'CONTROL') {
    var ret = fechaIso(p.fechaRetorno);
    if (!ret) return no('Falta la fecha de retorno a control.');
    if (ret <= hoy) return no('La fecha de retorno debe ser después de hoy.');
    if (ret > sumarDias(hoy, 365)) return no('La fecha de retorno va hasta un año desde hoy.');
    return { error: '', filas: [copia_(base0, { TIPO: 'CONTROL', DETALLE: 'CONTROL', SESIONES: 0, EXAMENES: textoLimpio_(p.examenes), FECHA_RETORNO: ret })] };
  }
  var inicio = fechaIso(p.fechaInicio);
  if (textoLimpio_(p.fechaInicio) && !inicio) return no('La fecha de la primera sesión no es válida.');
  if (inicio && inicio < hoy) return no('La fecha de la primera sesión no puede ser pasada.');
  if (inicio && inicio > sumarDias(hoy, 180)) return no('La fecha de la primera sesión va hasta 180 días desde hoy.');
  base0.FECHA_INICIO = inicio || '';
  var proc = textoLimpio_(p.procedimiento), trat = textoLimpio_(p.tratamiento);
  var procs = (Array.isArray(p.procedimientos) ? p.procedimientos : []).concat(proc ? [proc] : [])
    .map(textoLimpio_).filter(Boolean);
  if (!procs.length && !trat) return no('Elija un procedimiento, un tratamiento o ambos.');
  var base = base0;
  var filas = [];
  var vistos = {};
  for (var i = 0; i < procs.length; i++) {
    var p1 = enLista_(catalogos.procedimientos, procs[i]);
    if (!p1) return no('El procedimiento «' + procs[i] + '» no está en CATALOGOS.');
    if (vistos[normTexto(p1)]) continue;
    vistos[normTexto(p1)] = 1;
    filas.push(copia_(base, { TIPO: 'PROCEDIMIENTO', DETALLE: p1, SESIONES: 1 }));
  }
  if (trat) {
    var t1 = enLista_(catalogos.tratamientos, trat);
    if (!t1) return no('El tratamiento «' + trat + '» no está en CATALOGOS.');
    var n = Number(p.sesiones);
    if (!(n >= 1 && n <= MAX_SESIONES && Math.floor(n) === n)) return no('Indique cuántas sesiones (de 1 a ' + MAX_SESIONES + ').');
    var marcas = (catalogos.marcas || {})[normTexto(t1)] || [], marca = '';
    if (marcas.length) {
      marca = enLista_(marcas, p.marca);
      if (!marca) return no('Elija la marca de ' + t1 + ': ' + marcas.join(' o ') + '.');
    } else if (textoLimpio_(p.marca)) {
      return no(t1 + ' no lleva marca.');
    }
    filas.push(copia_(base, { TIPO: 'HIERRO', DETALLE: t1, MARCA: marca, SESIONES: n }));
  }
  return { error: '', filas: filas };
}

/** El registro previo, sin anular, de la misma indicación del mismo DNI a 7 días o menos de la fecha nueva. */
function duplicadoReciente(registros, fila) {
  var previos = (registros || []).filter(function (r) {
    var f = fechaIso(r.FECHA);
    return !anulado_(r) && f && normDni(r.DNI) === fila.DNI && normTexto(r.TIPO) === fila.TIPO &&
      normTexto(r.DETALLE) === normTexto(fila.DETALLE) && Math.abs(diasEntre(f, fila.FECHA)) <= DIAS_DUPLICADO;
  });
  return previos.length ? previos[previos.length - 1] : null;
}

/* ---------- Editar un registro ---------- */

var EDITABLES = { fecha: 'FECHA', doctor: 'DOCTOR', nombre: 'NOMBRE', contacto: 'CONTACTO', detalle: 'DETALLE', marca: 'MARCA',
  sesiones: 'SESIONES', fechaInicio: 'FECHA_INICIO', examenes: 'EXAMENES', fechaRetorno: 'FECHA_RETORNO' };

/** Valida los cambios pedidos a un registro. Devuelve solo lo que de verdad cambia y su valor anterior. */
function validarEdicionRegistro(r, cambios, sesiones, catalogos, hoy) {
  function no(m) { return { error: m, cambios: {}, antes: {} }; }
  if (!r) return no('No encontré ese registro. Recargue la página.');
  if (anulado_(r)) return no('Ese registro está anulado.');
  var out = {}, antes = {}, e = estadoRegistro(r, sesiones), control = normTexto(r.TIPO) === 'CONTROL';
  var claves = Object.keys(cambios || {});
  for (var i = 0; i < claves.length; i++) {
    var k = claves[i];
    if (k === 'dni') return no('Para cambiar el paciente, anule el registro y regístrelo de nuevo.');
    var col = EDITABLES[k];
    if (!col) return no('No se puede cambiar ' + k + '.');
    var v = cambios[k], nuevo;
    // Un valor igual al actual no cuenta: se descarta antes de validar nada (el formulario manda todos los campos).
    if (iguales_(col, v, r, catalogos)) continue;
    if (col === 'FECHA') { nuevo = fechaIso(v); if (!nuevo) return no('Falta la fecha.'); if (nuevo > hoy) return no('La fecha no puede ser futura.'); }
    else if (col === 'DOCTOR') {
      var doc = (catalogos.doctores || []).filter(function (d) { return normTexto(d.doctor) === normTexto(v); })[0];
      if (!doc) return no('Elija el doctor de la lista.');
      nuevo = doc.doctor;
    } else if (col === 'NOMBRE') { nuevo = textoLimpio_(v).toUpperCase(); if (!nuevo) return no('Falta el nombre del paciente.'); }
    else if (col === 'CONTACTO') { nuevo = contactoNormal_(v); if (!nuevo) return no('Falta el teléfono o usuario.'); }
    else if (col === 'DETALLE') {
      if (control) return no('Un control no tiene procedimiento ni tratamiento.');
      nuevo = enLista_(normTexto(r.TIPO) === 'HIERRO' ? catalogos.tratamientos : catalogos.procedimientos, v);
      if (!nuevo) return no('«' + textoLimpio_(v) + '» no está en CATALOGOS.');
    } else if (col === 'MARCA') {
      var marcas = (catalogos.marcas || {})[normTexto(cambios.detalle || r.DETALLE)] || [];
      nuevo = marcas.length ? enLista_(marcas, v) : '';
      if (marcas.length && !nuevo) return no('Elija la marca: ' + marcas.join(' o ') + '.');
    } else if (col === 'SESIONES') {
      var n = Number(v);
      if (control) return no('Un control no tiene sesiones.');
      if (!(n >= 1 && n <= MAX_SESIONES && Math.floor(n) === n)) return no('Indique cuántas sesiones (de 1 a ' + MAX_SESIONES + ').');
      if (n < e.hechas) return no('Ya hizo ' + e.hechas + ' sesiones: el total no puede ser menor.');
      nuevo = n;
    } else if (col === 'FECHA_INICIO') {
      nuevo = fechaIso(v) || '';
      if (nuevo && e.hechas) return no('Ya empezó el tratamiento: la fecha de inicio no se cambia.');
      if (nuevo && (nuevo < hoy || nuevo > sumarDias(hoy, 180))) return no('La fecha de la primera sesión va de hoy a 180 días.');
    } else if (col === 'EXAMENES') { if (!control) return no('Solo un control tiene exámenes.'); nuevo = textoLimpio_(v); }
    else if (col === 'FECHA_RETORNO') {
      if (!control) return no('Solo un control tiene fecha de retorno.');
      nuevo = fechaIso(v); if (!nuevo || nuevo <= hoy) return no('La fecha de retorno debe ser después de hoy.');
    }
    if (String(nuevo) === String(r[col] == null ? '' : r[col])) continue;
    out[col] = nuevo;
    antes[col] = r[col] == null ? '' : r[col];
  }
  // Si cambia el tratamiento y no se envía la marca, la marca actual debe seguir valiendo para el tratamiento nuevo.
  if (out.DETALLE !== undefined && !('MARCA' in out)) {
    var marcasN = (catalogos.marcas || {})[normTexto(out.DETALLE)] || [], actual = textoLimpio_(r.MARCA);
    if (marcasN.length && !enLista_(marcasN, actual)) return no('Elija la marca de ' + out.DETALLE + ': ' + marcasN.join(' o ') + '.');
    if (!marcasN.length && actual) { out.MARCA = ''; antes.MARCA = r.MARCA; }
  }
  return { error: '', cambios: out, antes: antes };
}

/** ¿El valor pedido, normalizado, es el que el registro ya tiene? */
function iguales_(col, v, r, catalogos) {
  var actual = r[col] == null ? '' : r[col], nuevo;
  if (col === 'FECHA' || col === 'FECHA_INICIO' || col === 'FECHA_RETORNO') { nuevo = fechaIso(v) || ''; actual = fechaIso(actual) || ''; }
  else if (col === 'DOCTOR') {
    var doc = (catalogos.doctores || []).filter(function (d) { return normTexto(d.doctor) === normTexto(v); })[0];
    nuevo = doc ? doc.doctor : '\u0000';
  }
  else if (col === 'NOMBRE') nuevo = textoLimpio_(v).toUpperCase();
  else if (col === 'CONTACTO') { nuevo = contactoNormal_(v); actual = contactoNormal_(actual); }
  else if (col === 'SESIONES') nuevo = Number(v);
  else nuevo = textoLimpio_(v);
  if (col === 'DETALLE') nuevo = enLista_((normTexto(r.TIPO) === 'HIERRO' ? catalogos.tratamientos : catalogos.procedimientos), v) || '\u0000';
  if (col === 'MARCA') nuevo = enLista_(((catalogos.marcas || {})[normTexto(r.DETALLE)] || []), v) || (textoLimpio_(v) === '' ? '' : '\u0000');
  return String(nuevo) === String(actual);
}

/* ---------- Sesiones y estado de un registro ---------- */

function sesionesDe_(id, sesiones) {
  return (sesiones || []).filter(function (s) { return s.ID_REGISTRO === id && !anulado_(s); })
    .sort(function (a, b) { return Number(a.NUMERO) - Number(b.NUMERO); });
}

/** El estado no se guarda en ninguna celda: se calcula con las sesiones válidas. */
function estadoRegistro(r, sesiones) {
  var propias = sesionesDe_(r.ID, sesiones);
  var control = normTexto(r.TIPO) === 'CONTROL';
  var total = control ? 0 : Math.max(1, Number(r.SESIONES) || 1);
  var ultima = propias.length ? fechaIso(propias[propias.length - 1].FECHA) : '';
  var inicio = fechaIso(control ? r.FECHA_RETORNO : r.FECHA_INICIO) || '';
  var estado = anulado_(r) ? 'ANULADO' : control ? 'PROGRAMADO' : propias.length >= total ? 'COMPLETO' : propias.length ? 'EN CURSO'
    : inicio ? 'PROGRAMADO' : 'COTIZADO';
  return { estado: estado, hechas: propias.length, total: total, ultima: ultima, inicio: inicio };
}

function validarSesion(r, sesiones, fecha, hoy) {
  if (!r) return 'No encontré ese registro. Recargue la página.';
  var e = estadoRegistro(r, sesiones);
  if (e.estado === 'ANULADO') return 'Ese registro está anulado.';
  if (normTexto(r.TIPO) === 'CONTROL') return 'Un control no tiene sesiones.';
  if (e.estado === 'COMPLETO') return 'Ese tratamiento ya tiene todas sus sesiones.';
  var f = fechaIso(fecha);
  if (!f) return 'Falta la fecha de la sesión.';
  if (f > hoy) return 'La fecha no puede ser futura.';
  if (f < fechaIso(r.FECHA)) return 'La sesión no puede ser anterior al registro (' + fechaDma_(fechaIso(r.FECHA)) + ').';
  if (e.ultima && f < e.ultima) return 'La sesión no puede ser anterior a la sesión previa (' + fechaDma_(e.ultima) + ').';
  return '';
}

/**
 * «Próxima sesión» al marcar una: después de la sesión que se marca, no antes de hoy y hasta 180 días; nunca en la última (no hay próxima).
 * `e` es el estado ANTES de marcar. '' si vale, o el mensaje.
 */
function validarProximaSesion(e, fechaSesion, proxima, hoy) {
  if (e.hechas + 1 >= e.total) return 'Es la última sesión del tratamiento: no hay una próxima que agendar.';
  var f = fechaIso(proxima), s = fechaIso(fechaSesion);
  if (!f || !/^\d{4}-\d{2}-\d{2}$/.test(String(proxima).trim().slice(0, 10))) return 'La fecha de la próxima sesión no es válida.';
  if (f <= s) return 'La próxima sesión debe ser después de la sesión que marca (' + fechaDma_(s) + ').';
  if (hoy && f < hoy) return 'La próxima sesión no puede ser anterior a hoy.';
  if (f > sumarDias(s, 180)) return 'La próxima sesión va hasta 180 días después de la sesión.';
  return '';
}

/**
 * La fila de SEGUIMIENTOS que agenda la próxima sesión: la misma que deja «Agendó cita» sobre un registro en curso,
 * con la sesión que la originó en la NOTA. Esa liga es la que hace que anular la sesión anule también la agenda.
 */
function filaProximaSesion(r, sesion, proxima, asesora) {
  return { DNI: normDni(r.DNI), ESPECIALIDAD: normTexto(r.TIPO), RESPONSABLE: asesora, MOTIVO: '',
    NOTA: 'Agendada al marcar la sesión ' + sesion.NUMERO + ' (' + sesion.ID + ')', REFERENCIA: r.ID, RESULTADO: 'AGENDÓ CITA',
    FECHA_PROXIMA: fechaIso(proxima), TELEFONO: '', ANULADO: '', MOTIVO_ANULACION: '' };
}

/** El texto exacto que escribe filaProximaSesion: una nota escrita a mano no liga. */
var LIGA_SESION = /^Agendada al marcar la sesión \d+ \((SES-\d+)\)$/;

/** El ID de la sesión a la que está ligado un «Agendó cita» (agendado al marcarla), o ''. */
function sesionLigada(s) {
  if (!s || normTexto(s.RESULTADO) !== 'AGENDO CITA') return '';
  var m = String(s.NOTA || '').trim().match(LIGA_SESION);
  return m ? m[1] : '';
}

/** Solo la última sesión válida: anular una del medio rompería la numeración de las siguientes. */
function validarAnulacionSesion(id, sesiones) {
  var s = (sesiones || []).filter(function (x) { return x.ID === id; })[0];
  if (!s) return { error: 'No encontré la sesión ' + id + '.', sesion: null };
  if (anulado_(s)) return { error: 'La sesión ' + id + ' ya estaba anulada.', sesion: null };
  var propias = sesionesDe_(s.ID_REGISTRO, sesiones);
  if (propias[propias.length - 1].ID !== id) return { error: 'Solo se puede anular la última sesión del tratamiento.', sesion: null };
  return { error: '', sesion: s };
}

/* ---------- Filas de la bandeja ---------- */

/**
 * Especialidades en que atiende el médico SOFDOC `medico`, según las citas: { 'HEMATOLOGIA': 1 }.
 * Vacío si no aparece en ninguna (entonces cualquier especialidad vale).
 */
function especialidadesDeMedico_(medico, citas) {
  var out = {}, m = normTexto(medico);
  if (!m) return out;
  (citas || []).forEach(function (c) { if (normTexto(c.MEDICO) === m && c.ESPECIALIDAD) out[normTexto(c.ESPECIALIDAD)] = 1; });
  return out;
}

function porFechaHora_(a, b) { return a.FECHA_HORA < b.FECHA_HORA ? -1 : a.FECHA_HORA > b.FECHA_HORA ? 1 : 0; }

/**
 * Una fila por registro cotizado o en curso. Entra en la bandeja (ESTADO PENDIENTE) cuando pasa la
 * espera sin «Lo hizo»: ESPERA_COTIZACION_DIAS desde la FECHA del registro o DIAS_ENTRE_SESIONES
 * desde la última sesión. Los seguimientos se reconocen por REFERENCIA = ID del registro.
 */
function pendientesRegistro(d) {
  var porDni = realizadasPorDni_(d.citas), segs = {}, reglas = d.reglas, hoy = d.hoy;
  var marcas = marcasTelefono(d.seguimientos), muertos = fallecidos(d.seguimientos);
  (d.seguimientos || []).forEach(function (s) {
    if (s.REFERENCIA) (segs[s.REFERENCIA] = segs[s.REFERENCIA] || []).push(s);
  });
  return (d.registros || []).map(function (r) {
    var e = estadoRegistro(r, d.sesiones);
    if (e.estado === 'ANULADO') return null;
    var dni = normDni(r.DNI), control = normTexto(r.TIPO) === 'CONTROL';
    var realizadas = porDni[dni] || [], ultima = realizadas[realizadas.length - 1];
    var enCurso = e.estado === 'EN CURSO', programado = e.estado === 'PROGRAMADO';
    var reevaluar = e.estado === 'COMPLETO' && e.ultima ? sumarDias(e.ultima, reglas.postTratamiento) : '';
    var desde = control ? fechaIso(r.FECHA) : enCurso ? e.ultima : programado ? e.inicio : reevaluar || fechaIso(r.FECHA);
    // Un tratamiento en curso cuenta sus seguimientos desde que se REGISTRÓ la última sesión (su FECHA_HORA), no solo desde su
    // fecha: un «Agendó cita» de esa misma mañana era para la sesión que se acaba de marcar. Y una agenda ligada a una sesión
    // (la que se agendó al marcarla) vale solo mientras esa sesión siga siendo la última válida: si se anuló, la agenda no cuenta.
    var ultimaSes = sesionesDe_(r.ID, d.sesiones).slice(-1)[0] || null, corte = enCurso && ultimaSes ? String(ultimaSes.FECHA_HORA || '') : '';
    var lista = (segs[r.ID] || []).filter(function (s) {
      var ligada = sesionLigada(s);
      if (ligada && (!ultimaSes || ligada !== ultimaSes.ID)) return false;
      return fechaIso(s.FECHA_HORA) >= desde && String(s.FECHA_HORA || '') >= corte;
    }).sort(porFechaHora_);
    var c = leerCiclo(lista, reglas, hoy);
    var tel = normTelefono(r.CONTACTO), usuario = tel.length === 9 ? '' : textoLimpio_(r.CONTACTO);
    // Sin teléfonos conocidos del DNI (p. ej. un control de alguien que solo vino por Registro), vale el CONTACTO del registro,
    // salvo que esté marcado como equivocado después de registrarse.
    var telefonos = (d.telefonos || {})[dni] || [], marcaTel = tel && marcas[dni] && marcas[dni][tel];
    if (!telefonos.length && tel.length === 9 && !(marcaTel && !(fechaIso(r.FECHA) > marcaTel))) telefonos = [tel];
    var mapaTel = {};
    mapaTel[dni] = telefonos;
    var sc = sinContacto_(dni, marcas, mapaTel, usuario), cierre = c.cierre, estado = 'PENDIENTE', motivo = '', volvio = '', falta = '';
    var agenda = c.agenda;
    // En un tratamiento en curso, la cita que se agenda es su próxima sesión: «Sesión k+1 el …».
    if (agenda && enCurso && agenda.tipo === 'CITA') agenda = { tipo: 'SESION', fecha: agenda.fecha, intento: agenda.intento };
    var dias = Math.max(0, diasEntre(desde, hoy)), espera = enCurso ? reglas.diasEntreSesiones : reglas.esperaCotizacion;
    // La consulta realizada que cierra el control (después de la fecha del registro, en la especialidad de su doctor
    // si se sabe) o la reevaluación (después de la última sesión).
    var espDoc = control ? especialidadesDeMedico_(medicoDeRegistro(r, d.catalogos || {}), d.citas) : {};
    var vuelta = control ? realizadas.filter(function (x) {
      return x.FECHA > fechaIso(r.FECHA) && (!Object.keys(espDoc).length || espDoc[normTexto(x.ESPECIALIDAD)]);
    })[0]
      : e.estado === 'COMPLETO' ? realizadas.filter(function (x) { return x.FECHA > e.ultima; })[0] : null;
    if (muertos[dni]) estado = 'FALLECIDO';
    else if (cierre) estado = 'CERRADO';
    else if (sc) { estado = 'CERRADO'; cierre = { motivo: 'NÚMERO EQUIVOCADO', fecha: sc }; }
    else if (vuelta) { estado = 'COMPLETADO'; volvio = vuelta.FECHA; }
    else if (agenda) estado = 'AGENDADO';
    else if (enCurso && c.citaVencida) {
      // La próxima sesión agendada pasó (más la gracia) sin marcarse: como un programado que no vino.
      motivo = 'NO VINO'; falta = c.citaVencida; dias = Math.max(0, diasEntre(falta, hoy));
      if (dias > reglas.corteIndicaciones) estado = 'ANTIGUO';   // al publicar no debe volver una avalancha de «No vino» viejos
    } else if (control) {
      if (hoy <= sumarDias(e.inicio, reglas.graciaAgenda)) { estado = 'AGENDADO'; agenda = { tipo: 'CONTROL', fecha: e.inicio, intento: 0 }; }
      else { motivo = 'CONTROL VENCIDO'; dias = Math.max(0, diasEntre(e.inicio, hoy)); }
    } else if (programado) {
      if (hoy <= sumarDias(e.inicio, reglas.graciaAgenda)) { estado = 'AGENDADO'; agenda = { tipo: 'SESION', fecha: e.inicio, intento: 0 }; }
      else { motivo = 'NO VINO'; falta = e.inicio; if (diasEntre(falta, hoy) > reglas.corteIndicaciones) estado = 'ANTIGUO'; }
    } else if (e.estado === 'COMPLETO') {
      // Un «por reevaluar» muy viejo no se muestra: al publicar no debe caer una avalancha de tarjetas.
      estado = hoy < reevaluar ? 'COMPLETADO' : diasEntre(reevaluar, hoy) > reglas.corteIndicaciones ? 'ANTIGUO' : 'POR REEVALUAR';
    }
    else if (dias < espera) estado = enCurso ? 'EN TRATAMIENTO' : 'EN ESPERA';
    else if (dias > reglas.corteIndicaciones) estado = 'ANTIGUO';
    return {
      ID_REGISTRO: r.ID,
      DNI: dni,
      ESPECIALIDAD: r.TIPO,
      TIPO_SEGUIMIENTO: control ? 'CONTROL' : r.TIPO,
      NOMBRE: ultima ? ultima.NOMBRE : r.NOMBRE,
      TELEFONOS: telefonos.join(' / '),
      USUARIO: usuario,
      MEDICO_ULTIMO: medicoDeRegistro(r, d.catalogos),
      ESPECIALIDAD_CONSULTA: ultima ? ultima.ESPECIALIDAD : '',
      FECHA_COTIZACION: fechaIso(r.FECHA),
      DETALLE: textoRegistro(r),
      TRATAMIENTO: r.TIPO === 'HIERRO' ? frase_(r.DETALLE) : '',
      MARCA: r.TIPO === 'HIERRO' ? frase_(r.MARCA) : '',
      SESIONES: e.total,
      HECHAS: e.hechas,
      ULTIMA_SESION: e.ultima,
      ULTIMA_SESION_ID: (sesionesDe_(r.ID, d.sesiones).slice(-1)[0] || {}).ID || '',
      DIAS: dias,
      ULTIMA_CITA: ultima ? ultima.FECHA : '',
      N_SEGUIMIENTOS: c.intentos,
      ULTIMO_SEGUIMIENTO: lista.length ? fechaIso(lista[lista.length - 1].FECHA_HORA) : '',
      ESTADO: estado,
      ESTADO_REGISTRO: e.estado,
      ATRASO: enCurso && estado === 'PENDIENTE' && !motivo ? dias - reglas.diasEntreSesiones : 0,
      CIERRE: cierre ? cierre.motivo : '',
      FECHA_CIERRE: cierre ? cierre.fecha : '',
      AGENDA: agenda ? agenda.tipo : '',
      FECHA_AGENDA: agenda ? agenda.fecha : '',
      INTENTO: agenda ? agenda.intento : 0,
      MOTIVO_PENDIENTE: motivo,
      FECHA_REEVALUAR: reevaluar,
      VOLVIO: volvio,
      EXAMENES: textoLimpio_(r.EXAMENES),
      FECHA_INICIO: e.inicio,
      FECHA_FALTA: falta
    };
  }).filter(Boolean);
}

/* ---------- Alta médica (por especialidad) ---------- */

var DECISIONES = {
  'ALTA': { nombre: 'ALTA', texto: 'Alta médica', meses: 0 },
  'ALTA 6 MESES': { nombre: 'ALTA 6 MESES', texto: 'Alta con reevaluación a 6 meses', meses: 6, tipo: '6 MESES' },
  'ALTA 1 ANO': { nombre: 'ALTA 1 AÑO', texto: 'Alta con reevaluación a 1 año', meses: 12, tipo: '1 AÑO' },
  'NUEVA REEVALUACION': { nombre: 'NUEVA REEVALUACION', texto: 'Nueva reevaluación', meses: 0, pideFecha: true, tipo: 'REEVALUACION' }
};
function decisionDe_(a) { return DECISIONES[normTexto(a && a.DECISION) || 'ALTA'] || DECISIONES.ALTA; }
/** 'yyyy-mm-dd' + n meses; el día 31 de un mes corto pasa al último día de ese mes. */
function sumarMeses_(iso, n) {
  var y = Number(iso.slice(0, 4)), m = Number(iso.slice(5, 7)) - 1 + n, d = Number(iso.slice(8, 10));
  y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
  var ultimo = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return y + '-' + ('0' + (m + 1)).slice(-2) + '-' + ('0' + Math.min(d, ultimo)).slice(-2);
}

function validarAlta(p, catalogos, citas, vigentes, hoy) {
  function no(m) { return { error: m, alta: null }; }
  if (!p) return no('Faltan los datos del alta.');
  var quien = enLista_(catalogos.usuarios, p.usuario);
  if (!quien) return no('Elija quién es usted en el selector de arriba.');
  var dni = normDni(p.dni);
  if (!dni) return no('Falta el DNI del paciente.');
  var k = claveSerie(dni, p.especialidad);
  var serie = armarSeries((citas || []).filter(function (c) { return c.DNI === dni; }))[k];
  if (!serie || !serie.realizadas.length) return no('Ese paciente no tiene consultas realizadas en ' + textoLimpio_(p.especialidad).toUpperCase() + '.');
  var doctor = (catalogos.doctores || []).filter(function (d) { return normTexto(d.doctor) === normTexto(p.doctor); })[0];
  if (!doctor) return no('Elija el doctor que da el alta.');
  var fecha = fechaIso(p.fecha), ultima = serie.realizadas[serie.realizadas.length - 1].FECHA;
  if (!fecha) return no('Falta la fecha del alta.');
  if (fecha > hoy) return no('La fecha no puede ser futura.');
  // Antes de la última consulta el alta quedaría cerrada al instante (hay una consulta posterior).
  if (fecha < ultima) return no('El alta no puede ser anterior a la última consulta (' + fechaDma_(ultima) + ').');
  var dec = DECISIONES[normTexto(p.decision) || 'ALTA'];
  if (!dec) return no('Elija la decisión del médico.');
  var retorno = '';
  if (dec.meses) retorno = sumarMeses_(fecha, dec.meses);
  if (dec.pideFecha) {
    retorno = fechaIso(p.fechaRetorno);
    if (!retorno) return no('Falta la fecha de retorno.');
    if (retorno <= hoy) return no('La fecha de retorno debe ser después de hoy.');
    if (retorno > sumarDias(hoy, 730)) return no('La fecha de retorno va hasta dos años desde hoy.');
  }
  if ((vigentes || {})[k]) return no('Ese paciente ya tiene un alta vigente en ' + serie.especialidad + '.');
  return { error: '', alta: { FECHA: fecha, DNI: dni, ESPECIALIDAD: serie.especialidad, DOCTOR: doctor.doctor, REGISTRADO_POR: quien,
    NOTA: textoLimpio_(p.nota), ANULADO: '', MOTIVO_ANULACION: '', DECISION: dec.nombre, FECHA_RETORNO: retorno } };
}

/**
 * Altas vigentes por serie (DNI + especialidad): sin anular y sin ninguna consulta realizada después.
 * Los descartes antiguos con motivo «ALTA MÉDICA» cuentan como altas con la fecha del seguimiento.
 */
function altasVigentes(altas, seguimientos, citas, reglas, hoy) {
  var series = armarSeries(citas), out = {}, candidatas = [];
  if (reglas && hoy) {
    // Con las reglas y la fecha de hoy, la decisión del médico decide si el alta sigue vigente.
    var dec = decisionesDeAlta(altas, citas, reglas, hoy).vigentes;
    Object.keys(dec).forEach(function (k) { candidatas.push(dec[k]); });
  } else {
    (altas || []).forEach(function (a) {
      if (anulado_(a)) return;
      candidatas.push({ ID: a.ID, FECHA: fechaIso(a.FECHA), DNI: normDni(a.DNI), ESPECIALIDAD: a.ESPECIALIDAD, DOCTOR: a.DOCTOR || '', REGISTRADO_POR: a.REGISTRADO_POR || '' });
    });
  }
  (seguimientos || []).forEach(function (s) {
    if (normTexto(s.ACCION) !== 'DESCARTADO' || normTexto(s.MOTIVO) !== 'ALTA MEDICA' || TIPOS_INDICACION[normTexto(s.ESPECIALIDAD)]) return;
    candidatas.push({ ID: s.ID, FECHA: fechaIso(s.FECHA_HORA), DNI: normDni(s.DNI), ESPECIALIDAD: s.ESPECIALIDAD, DOCTOR: '', REGISTRADO_POR: s.RESPONSABLE || '' });
  });
  candidatas.forEach(function (a) {
    var k = claveSerie(a.DNI, a.ESPECIALIDAD), serie = series[k];
    if (!serie || !a.FECHA) return;
    if (serie.realizadas.some(function (c) { return c.FECHA > a.FECHA; })) return;
    if (!out[k] || a.FECHA > out[k].FECHA) out[k] = a;
  });
  return out;
}

/** Qué decidió el médico, por serie: lo que sigue de alta y lo que debe volver (con su fecha). */
function decisionesDeAlta(altas, citas, reglas, hoy) {
  var series = armarSeries(citas), ultimas = {}, out = { vigentes: {}, retornos: {} };
  (altas || []).forEach(function (a) {
    if (anulado_(a)) return;
    var k = claveSerie(normDni(a.DNI), a.ESPECIALIDAD), f = fechaIso(a.FECHA), serie = series[k];
    if (!serie || !f || serie.realizadas.some(function (c) { return c.FECHA > f; })) return;
    if (!ultimas[k] || f > ultimas[k].FECHA) ultimas[k] = { ID: a.ID, FECHA: f, DNI: normDni(a.DNI), ESPECIALIDAD: a.ESPECIALIDAD,
      DOCTOR: a.DOCTOR || '', REGISTRADO_POR: a.REGISTRADO_POR || '', DECISION: decisionDe_(a).nombre, FECHA_RETORNO: fechaIso(a.FECHA_RETORNO) };
  });
  Object.keys(ultimas).forEach(function (k) {
    var a = ultimas[k], dec = decisionDe_(a);
    // Una alta a 6 meses o 1 año sin fecha de retorno (hoja editada a mano) se trata como alta simple.
    if (dec.meses && !a.FECHA_RETORNO) dec = DECISIONES.ALTA;
    if (dec.nombre === 'ALTA') { out.vigentes[k] = a; return; }
    if (dec.tipo === 'REEVALUACION') { out.retornos[k] = { fecha: a.FECHA_RETORNO, tipo: 'REEVALUACION' }; return; }
    if (hoy < sumarDias(a.FECHA_RETORNO, -reglas.avisoAltaControl)) out.vigentes[k] = a;
    else out.retornos[k] = { fecha: a.FECHA_RETORNO, tipo: dec.tipo };
  });
  return out;
}

/* ---------- Registros como indicaciones (para las cifras y los teléfonos) ---------- */

function indicacionesDeRegistros(registros, sesiones, catalogos, reglas, hoy) {
  return (registros || []).map(function (r) {
    if (normTexto(r.TIPO) === 'CONTROL') return null;
    var e = estadoRegistro(r, sesiones);
    if (e.estado === 'ANULADO') return null;
    var tel = normTelefono(r.CONTACTO), fecha = fechaIso(r.FECHA);
    return {
      ID: r.ID, FECHA: fecha, TIPO: normTexto(r.TIPO), DETALLE: r.DETALLE, CANTIDAD: e.total,
      MEDICO_SOLICITANTE: medicoDeRegistro(r, catalogos), ASESORA: r.ASESORA, NOMBRE: r.NOMBRE,
      TELEFONO: tel.length === 9 ? tel : '', ESTADO: e.estado === 'COTIZADO' ? 'COTIZÓ' : 'ACEPTÓ',
      OBSERVACIONES: '', DNI: normDni(r.DNI), EMPAREJAMIENTO: 'REGISTRO', ORIGEN: 'REGISTROS',
      COMPLETO: e.estado === 'COMPLETO' ? 'SÍ' : 'NO',
      // Un cotizado dentro de su espera todavía no es «no siguió».
      EN_ESPERA: e.estado === 'COTIZADO' && fecha && diasEntre(fecha, hoy) < reglas.esperaCotizacion ? 'SÍ' : ''
    };
  }).filter(Boolean);
}

/** Líneas para «Verificar»: lo que la pestaña Registro necesita de CATALOGOS. */
function revisarCatalogos(c) {
  var lineas = [];
  if (!c.doctores.length) lineas.push('✗ CATALOGOS no tiene doctores (columnas DOCTOR y DOCTOR_SOFDOC). Use «Preparar hojas».');
  Object.keys(c.marcas).forEach(function (t) {
    if (!enLista_(c.tratamientos, t)) c.marcas[t].forEach(function (m) {
      lineas.push('✗ La marca «' + m + '» apunta a «' + t + '», que no está en TRATAMIENTOS.');
    });
  });
  if (enLista_(c.motivos, 'ALTA MÉDICA')) lineas.push('✗ «ALTA MÉDICA» sigue en MOTIVOS_DESCARTE: ahora el alta se registra con «Dar de alta». Use «Preparar hojas».');
  return lineas.length ? lineas : ['✓ Catálogos de Registro: ' + c.doctores.length + ' doctores, ' + c.procedimientos.length +
    ' procedimientos, ' + c.tratamientos.length + ' tratamientos.'];
}
