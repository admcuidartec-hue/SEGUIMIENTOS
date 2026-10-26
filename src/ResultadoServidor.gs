/* ==========================================================================
   «¿QUÉ PASÓ?» (las llama la app por google.script.run)

   Escribe en SEGUIMIENTOS con el candado tomado. El alta de una reevaluación y
   la sesión de un registro ya tienen su hoja: se delegan en darDeAlta y marcarSesion.
   ========================================================================== */

/** Solo las tarjetas abiertas (todas menos Completado) aceptan un resultado: uno tardío sobre una serie cerrada la reabriría. */
function tarjetasAbiertas_(d) {
  var c = armarTablero(d).columnas;
  return (c.POR_CONTACTAR || []).concat(c.CONTACTADO || [], c.PAGO_REALIZADO || [], c.AGENDADO || [], c.EN_TRATAMIENTO || []);
}

function registrarResultado(p) { return registrarResultado_(p, null); }

/**
 * Lo leído (antes de derivar_), reducido a las filas de UN paciente: sus citas, indicaciones, seguimientos, contactos, registros
 * (y sus sesiones), altas y Enfermería. La tarjeta de un paciente solo depende de sus filas —y del índice médico →
 * especialidades, que se conserva entero—, así que derivar_ y armarTablero sobre esto dan sus mismas tarjetas (lo comprueba
 * logica-rendimiento.test.js) en milisegundos: es lo que se recalcula DENTRO del candado, en vez del libro entero.
 */
function soloDelPaciente_(d, dni) {
  var k = normDni(dni), suyo = function (x) { return normDni(x.DNI) === k; };
  var registros = (d.registros || []).filter(suyo), ids = {};
  registros.forEach(function (r) { ids[r.ID] = 1; });
  return { hoy: d.hoy, reglas: d.reglas, catalogos: d.catalogos,
    espPorMedico: d.espPorMedico || indiceEspecialidadesMedico(d.citas),
    citas: (d.citas || []).filter(suyo), indicaciones: (d.indicaciones || []).filter(suyo),
    seguimientosTodos: (d.seguimientosTodos || []).filter(suyo), seguimientos: (d.seguimientos || []).filter(suyo),
    contactos: (d.contactos || []).filter(function (c) { return normDni(c.DNI_PACIENTE) === k; }),
    registros: registros, sesiones: (d.sesiones || []).filter(function (x) { return ids[x.ID_REGISTRO]; }),
    altas: (d.altas || []).filter(suyo), enfermeria: (d.enfermeria || []).filter(suyo) };
}

/** Guarda contra la ventana de publicación: SEGUIMIENTOS necesita sus columnas nuevas (exigirColumnas_). */
function exigirHojaPreparada_() {
  exigirColumnas_('SEGUIMIENTOS', COLUMNAS_SEGUIMIENTOS);
}

/** Tras una escritura delegada, la tarjeta recalculada (o '' si salió del tablero), para que la app confirme el movimiento. */
function conTarjeta_(r, clave) {
  MEMO.datos = null;
  var tab = armarTablero(datos_()), nueva = '';
  Object.keys(tab.columnas).forEach(function (c) { tab.columnas[c].forEach(function (x) { if (x.CLAVE === clave && !nueva) nueva = x; }); });
  var out = {};
  Object.keys(r || {}).forEach(function (k) { out[k] = r[k]; });
  out.tarjeta = nueva;
  return limpiarParaEnvio(out);
}

/** `q` con su op, solo si la petición trajo uno (así lo delegado se llama igual que antes sin op). */
function conOpSiHay_(q, op) { if (op) q.op = op; return q; }

/** La tarjeta `clave` del paciente `dni`, calculada solo con sus filas, o null si salió del tablero. */
function tarjetaDelPaciente_(d, dni, clave) {
  var tab = armarTablero(derivar_(soloDelPaciente_(d, dni))), nueva = null;
  Object.keys(tab.columnas).forEach(function (c) {
    tab.columnas[c].forEach(function (x) { if (x.CLAVE === clave && !nueva) nueva = x; });
  });
  return nueva;
}

/**
 * El reintento de una operación que ya se guardó (mismo op): lo que se respondió la primera vez, sin escribir nada.
 * Busca en lo leído (`segs`, `registros`, `sesiones`, `altas`); null si ese op no está.
 */
function resultadoRepetido_(d, dni, op, segs, registros) {
  var s = filasDeOp_(segs, op).filter(function (x) { return String(x.OP).trim() === op; })[0];
  if (s) {
    var registro = filasDeOp_(registros || d.registros, op)[0] || null;
    var clave = registro ? registro.ID : (s.REFERENCIA || (normDni(s.DNI) + '|' + s.ESPECIALIDAD));
    return { ok: true, repetida: true, seguimiento: s, registro: registro, tarjeta: tarjetaDelPaciente_(d, dni, clave) };
  }
  var ses = filasDeOp_(d.sesiones, op)[0];
  if (ses) {
    var r = (d.registros || []).filter(function (x) { return x.ID === ses.ID_REGISTRO; })[0];
    return { ok: true, repetida: true, sesion: ses, completo: !!r && Number(ses.NUMERO) >= estadoRegistro(r, d.sesiones).total,
      tarjeta: tarjetaDelPaciente_(d, dni, ses.ID_REGISTRO) };
  }
  var alta = filasDeOp_(d.altas, op)[0];
  if (alta) return { ok: true, repetida: true, alta: alta, tarjeta: tarjetaDelPaciente_(d, dni, normDni(alta.DNI) + '|' + alta.ESPECIALIDAD) };
  return null;
}

/** `opciones` es interno (no viene de la app): { motivo } conserva el motivo original de una pestaña vieja. */
function registrarResultado_(p, opciones) {
  exigirRol_(p, 'ADMISION');
  var d = datos_(), dni = normDni(p && p.dni), op = opDe_(p);
  // El mismo op ya se guardó (la respuesta se perdió y la app reintenta): lo de la primera vez, antes de validar nada.
  var repetido = resultadoRepetido_(d, dni, op, d.seguimientosTodos);
  if (repetido) return limpiarParaEnvio(repetido);
  // La tarjeta se busca entre las del paciente, calculadas solo con sus filas (soloDelPaciente_): lo mismo que el tablero
  // entero, sin recalcular todo el libro dentro del candado.
  var dp = derivar_(soloDelPaciente_(d, dni));
  var v = validarResultado(p, { catalogos: d.catalogos, hoy: d.hoy, tarjetas: tarjetasAbiertas_(dp) });
  if (v.error) throw new Error(v.error);
  var t = v.tarjeta, indicacion = !!TIPOS_INDICACION[normTexto(t.ESPECIALIDAD)];
  if (v.fila.RESULTADO === 'ALTA MÉDICA' && !indicacion) {
    var rAlta = darDeAlta(conOpSiHay_({ usuario: p.usuario, dni: v.fila.DNI, especialidad: t.ESPECIALIDAD, doctor: p.doctor, fecha: p.fecha, nota: textoLimpio_(p.nota) }, op));
    return conTarjeta_(rAlta, claveTarjeta(t));
  }
  if (v.fila.RESULTADO === 'LO HIZO' && t.ID_REGISTRO) {
    var q = { usuario: p.usuario, id: t.ID_REGISTRO, fecha: p.fecha, nota: textoLimpio_(p.nota) };
    if (p.sesion !== undefined) q.sesion = p.sesion;
    var rSesion = marcarSesion(conOpSiHay_(q, op));
    return conTarjeta_(rSesion, claveTarjeta(t));
  }
  var lock = bloquear_(), s, registro = null;
  try {
    exigirHojaPreparada_();
    var ahora = new Date();
    // Otra asesora pudo marcar otro número entretanto: se decide con la hoja releída dentro del candado.
    var todos = leerSeguimientos_(), frescos = todos.filter(function (x) { return !anulado_(x); });
    // «Aceptó» crea o programa un registro: otra asesora pudo hacerlo entretanto, y su registro cierra la cotización.
    if (v.fila.RESULTADO === 'ACEPTÓ') d.registros = leerRegistros_();
    // El mismo op pudo guardarse entre la lectura de arriba y el candado (un reintento que se cruzó con la primera).
    repetido = op ? resultadoRepetido_(copia_(d, { seguimientos: frescos, seguimientosTodos: todos }), dni, op, todos, d.registros) : null;
    if (repetido) return limpiarParaEnvio(repetido);
    // Se vuelve a validar con lo releído: otra asesora pudo cerrar o dar de baja al paciente.
    d.seguimientos = frescos;
    dp = derivar_(soloDelPaciente_(d, dni));
    v = validarResultado(p, { catalogos: d.catalogos, hoy: d.hoy, tarjetas: tarjetasAbiertas_(dp) });
    if (v.error) throw new Error(v.error);
    t = v.tarjeta;
    if (opciones && opciones.motivo) v.fila.MOTIVO = opciones.motivo;
    var quedan = true;
    if (v.fila.TELEFONO) {
      var marca = { DNI: v.fila.DNI, RESULTADO: 'NÚMERO EQUIVOCADO', TELEFONO: v.fila.TELEFONO, FECHA_HORA: fechaHoraTexto_(ahora) };
      quedan = (telefonosPorDni(dp.indicacionesTodas, dp.contactos, dp.seguimientos.concat([marca]))[v.fila.DNI] || []).length > 0 || !!t.USUARIO;
    }
    // Lo escrito en esta llamada, para deshacerlo si falla la fila siguiente: todo o nada.
    var deshacer = [];
    if (v.fila.RESULTADO === 'ACEPTÓ') {
      exigirColumnas_('REGISTROS', COLUMNAS_REGISTROS);
      if (t.ID_REGISTRO) {
        var inicioAntes = (d.registros.filter(function (x) { return x.ID === t.ID_REGISTRO; })[0] || {}).FECHA_INICIO || '';
        actualizarCeldas_('REGISTROS', t.ID_REGISTRO, { FECHA_INICIO: v.fila.FECHA_PROXIMA });
        deshacer.push(function () { actualizarCeldas_('REGISTROS', t.ID_REGISTRO, { FECHA_INICIO: fechaIso(inicioAntes) }); });
      } else {
        var ids = d.registros.map(function (x) { return x.ID; });
        var hierro = normTexto(t.ESPECIALIDAD) === 'HIERRO';
        registro = { ID: siguienteId(ids, 'REG'), FECHA_HORA: fechaHoraTexto_(ahora), FECHA: d.hoy, ASESORA: v.fila.RESPONSABLE, DOCTOR: '',
          NOMBRE: textoLimpio_(t.NOMBRE).toUpperCase(), DNI: v.fila.DNI, CONTACTO: String(t.TELEFONOS || '').split(' / ')[0] || '',
          TIPO: hierro ? 'HIERRO' : 'PROCEDIMIENTO', DETALLE: hierro ? 'HIERRO CARBOXIMALTOSA' : textoLimpio_(t.DETALLE).replace(/ ×\d+$/, ''),
          MARCA: hierro ? 'FERINJECT' : '', SESIONES: Number(p.sesiones) || 1, ANULADO: '', MOTIVO_ANULACION: '',
          FECHA_INICIO: v.fila.FECHA_PROXIMA, EXAMENES: '', FECHA_RETORNO: '', EDITADO: '' };
        if (op) registro.OP = op + '#registro';
        anexarObjeto_('REGISTROS', conOp_('REGISTROS', COLUMNAS_REGISTROS), registro);
        deshacer.push(function () { marcarAnulado_('REGISTROS', registro.ID, 'No se guardó: falló al escribir el «Aceptó» (se deshizo solo)'); });
        v.fila.NOTA = unirNota_('Registro ' + registro.ID, v.fila.NOTA);
      }
    }
    s = copia_(v.fila, { ID: 'SEG-' + ahora.getTime() + '-' + Math.floor(Math.random() * 1000), FECHA_HORA: fechaHoraTexto_(ahora),
      ACCION: accionPara(v.fila.RESULTADO, quedan) });
    if (op) s.OP = op;
    try {
      anexarObjeto_('SEGUIMIENTOS', conOp_('SEGUIMIENTOS', COLUMNAS_SEGUIMIENTOS), s);
    } catch (err) {
      deshacerEscritura_(deshacer, err);
    }
    if (registro) bitacora_(registro.ASESORA, 'REGISTRO', registro.ID + ' · ' + registro.DNI + ' · aceptó la cotización del historial', op);
    bitacora_(s.RESPONSABLE, 'RESULTADO', s.DNI + ' · ' + s.ESPECIALIDAD + ' · ' + s.RESULTADO + (s.REFERENCIA ? ' · ' + s.REFERENCIA : ''), op);
    d.seguimientos = frescos.concat([s]);
    if (registro) d.registros = (d.registros || []).concat([registro]);
    else if (v.fila.RESULTADO === 'ACEPTÓ') d.registros = (d.registros || []).map(function (x) {
      return x.ID === t.ID_REGISTRO ? copia_(x, { FECHA_INICIO: v.fila.FECHA_PROXIMA }) : x;
    });
  } finally {
    soltar_(lock);
  }
  // Fuera del candado: la tarjeta recalculada en memoria, para que la app confirme el movimiento.
  d.seguimientosTodos = d.seguimientosTodos.concat([s]);
  MEMO.datos = null;   // lo derivado de d ya no vale: si algo más lo pide en esta ejecución, se vuelve a leer
  var nueva = tarjetaDelPaciente_(d, dni, registro ? registro.ID : claveTarjeta(t));
  return limpiarParaEnvio(avisos_({ ok: true, seguimiento: s, registro: registro, tarjeta: nueva }));
}

function anularResultado(p) {
  exigirRol_(p, 'ADMISION');
  var d = datos_(), quien = exigirUsuario_(d.catalogos, p && p.usuario), motivo = exigirMotivo_(p), id = textoLimpio_(p.id), op = opDe_(p);
  if (id.indexOf('SEG-') !== 0) throw new Error('Aquí solo se anulan resultados de seguimiento (SEG-…).');
  var lock = bloquear_();
  try {
    exigirHojaPreparada_();
    var error = validarAnulacionResultado(id, leerSeguimientos_());
    if (error && /ya estaba anulad/.test(error) && anulacionHecha_(op)) return { ok: true, repetida: true };
    if (error) throw new Error(error);
    marcarAnulado_('SEGUIMIENTOS', id, motivo);
    bitacora_(quien, 'ANULAR RESULTADO', id + ' · ' + motivo, op);
    return avisos_({ ok: true });
  } finally {
    soltar_(lock);
  }
}

function getTablero() {
  return limpiarParaEnvio(armarTablero(datos_()));
}
