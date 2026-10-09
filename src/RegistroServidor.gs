/* ==========================================================================
   FUNCIONES DE LA PESTAÑA REGISTRO (las llama la app por google.script.run)

   Escriben REGISTROS, SESIONES y ALTAS siempre con el candado tomado, y
   releen los IDs DENTRO del candado: dos asesoras registran a la vez.
   Nunca se borra una fila: se anula (ANULADO = SÍ + motivo).
   ========================================================================== */

function exigirUsuario_(catalogos, usuario) {
  var u = enLista_(catalogos.usuarios, usuario);
  if (!u) throw new Error('Elija quién es usted en el selector de arriba.');
  return u;
}

function exigirMotivo_(p) {
  var m = textoLimpio_(p && p.motivo);
  if (!m) throw new Error('Escriba el motivo de la anulación.');
  return m;
}

/** REGISTROS y ALTAS se escriben por posición: sin sus columnas nuevas, una fila quedaría desalineada. */
function exigirColumnas_(nombre, columnas) {
  var plan = encabezadoAmpliable(encabezado_(hoja_(nombre)), columnas);
  if (plan.error || plan.agregar.length) throw new Error('Falta preparar las hojas: en el Sheets, menú Seguimientos → Preparar hojas.');
}

function guardarRegistro(p) {
  var d = datos_();
  var v = validarRegistro(p, d.catalogos, d.hoy);
  if (v.error) throw new Error(v.error);
  if (!(p && p.confirmado)) {
    for (var i = 0; i < v.filas.length; i++) {
      var dup = duplicadoReciente(d.registros, v.filas[i]);
      if (dup) return limpiarParaEnvio({ ok: false, duplicado: { ID: dup.ID, FECHA: fechaIso(dup.FECHA), TEXTO: textoRegistro(dup) } });
    }
  }
  var lock = bloquear_();
  try {
    exigirColumnas_('REGISTROS', COLUMNAS_REGISTROS);
    var ids = leerOpcional_('REGISTROS').map(function (r) { return r.ID; });
    var ahora = fechaHoraTexto_(new Date());
    v.filas.forEach(function (f) {
      f.ID = siguienteId(ids, 'REG');
      ids.push(f.ID);
      f.FECHA_HORA = ahora;
      anexarObjeto_('REGISTROS', COLUMNAS_REGISTROS, f);
      bitacora_(f.ASESORA, 'REGISTRO', f.ID + ' · ' + f.DNI + ' · ' + textoRegistro(f));
      f.TEXTO = textoRegistro(f);
    });
    return limpiarParaEnvio({ ok: true, registros: v.filas });
  } finally {
    soltar_(lock);
  }
}

/**
 * Marca la sesión siguiente. Con `proxima` ('yyyy-mm-dd'), en la misma llamada y bajo el mismo candado agenda la sesión
 * que sigue: la misma fila de SEGUIMIENTOS que «Agendó cita» sobre un registro en curso, ligada a esta sesión
 * (filaProximaSesion). La respuesta la trae en `agenda`, no en `seguimiento`: «Deshacer» anula la sesión, y anularSesion
 * anula con ella su agenda.
 */
function marcarSesion(p) {
  var d = datos_();
  var asesora = exigirUsuario_(d.catalogos, p && p.usuario), proxima = textoLimpio_(p && p.proxima);
  var lock = bloquear_();
  try {
    var sesiones = leerSesiones_(), id = textoLimpio_(p.id);
    var r = leerRegistros_().filter(function (x) { return x.ID === id; })[0];
    var error = validarSesion(r, sesiones, p.fecha, d.hoy);
    if (error) throw new Error(error);
    var e = estadoRegistro(r, sesiones);
    if (proxima) {
      error = validarProximaSesion(e, p.fecha, proxima, d.hoy);
      if (error) throw new Error(error);
      exigirHojaPreparada_();   // antes de escribir nada: SEGUIMIENTOS se escribe por posición
    }
    var ahora = new Date(), cuando = fechaHoraTexto_(ahora);
    var s = { ID: siguienteId(sesiones.map(function (x) { return x.ID; }), 'SES'), FECHA_HORA: cuando,
      ID_REGISTRO: r.ID, NUMERO: e.hechas + 1, FECHA: fechaIso(p.fecha), ASESORA: asesora, NOTA: textoLimpio_(p.nota),
      ANULADO: '', MOTIVO_ANULACION: '' };
    anexarObjeto_('SESIONES', COLUMNAS_SESIONES, s);
    bitacora_(asesora, 'SESIÓN', r.ID + ' · sesión ' + s.NUMERO + ' de ' + e.total);
    var out = { ok: true, sesion: s, completo: s.NUMERO >= e.total };
    if (proxima) {
      // Misma FECHA_HORA que la sesión: pendientesRegistro cuenta los seguimientos desde que se registró la última sesión.
      var g = copia_(filaProximaSesion(r, s, proxima, asesora), { ID: 'SEG-' + ahora.getTime() + '-' + Math.floor(Math.random() * 1000),
        FECHA_HORA: cuando, ACCION: accionPara('AGENDÓ CITA', true) });
      // La sesión ya está escrita: si la agenda falla, no se lanza (la app creería que nada se guardó). Se avisa y se agenda aparte.
      try {
        anexarObjeto_('SEGUIMIENTOS', COLUMNAS_SEGUIMIENTOS, g);
        bitacora_(asesora, 'RESULTADO', g.DNI + ' · ' + g.ESPECIALIDAD + ' · ' + g.RESULTADO + ' · ' + g.REFERENCIA);
        out.agenda = g;
      } catch (err) {
        out.agendaError = 'No se pudo agendar la próxima sesión: ' + (err && err.message || err);
      }
    }
    return limpiarParaEnvio(out);
  } finally {
    soltar_(lock);
  }
}

function anularRegistro(p) {
  var d = datos_(), quien = exigirUsuario_(d.catalogos, p && p.usuario), motivo = exigirMotivo_(p);
  var lock = bloquear_();
  try {
    marcarAnulado_('REGISTROS', textoLimpio_(p.id), motivo);
    bitacora_(quien, 'ANULAR REGISTRO', textoLimpio_(p.id) + ' · ' + motivo);
    return { ok: true };
  } finally {
    soltar_(lock);
  }
}

function anularSesion(p) {
  var d = datos_(), quien = exigirUsuario_(d.catalogos, p && p.usuario), motivo = exigirMotivo_(p);
  var lock = bloquear_();
  try {
    var v = validarAnulacionSesion(textoLimpio_(p.id), leerSesiones_());
    if (v.error) throw new Error(v.error);
    marcarAnulado_('SESIONES', v.sesion.ID, motivo);
    bitacora_(quien, 'ANULAR SESIÓN', v.sesion.ID + ' (' + v.sesion.ID_REGISTRO + ') · ' + motivo);
    // La próxima sesión que se agendó al marcar esta pertenece a esta: se anula con ella (Deshacer no deja una agenda que miente).
    // También un «Agendó cita» sin liga escrito después de registrarla: agendaba la sesión que le seguía.
    var desde = String(v.sesion.FECHA_HORA || '');
    leerSeguimientos_().filter(function (g) {
      if (anulado_(g) || textoLimpio_(g.REFERENCIA) !== v.sesion.ID_REGISTRO || normTexto(g.RESULTADO) !== 'AGENDO CITA') return false;
      var ligada = sesionLigada(g);
      return ligada ? ligada === v.sesion.ID : !!desde && String(g.FECHA_HORA || '') >= desde;
    }).forEach(function (g) {
      marcarAnulado_('SEGUIMIENTOS', g.ID, motivo + ' (se anuló la sesión ' + v.sesion.ID + ')');
      bitacora_(quien, 'ANULAR RESULTADO', g.ID + ' · con la sesión ' + v.sesion.ID);
    });
    return { ok: true };
  } finally {
    soltar_(lock);
  }
}

function darDeAlta(p) {
  var d = datos_();
  var v = validarAlta(p, d.catalogos, d.citas, d.vigentes, d.hoy);
  if (v.error) throw new Error(v.error);
  var lock = bloquear_();
  try {
    exigirColumnas_('ALTAS', COLUMNAS_ALTAS);
    var a = v.alta, altas = leerAltas_();
    // Otra asesora pudo dar la misma alta mientras tanto: se revisa otra vez con la hoja releída dentro del candado.
    if (altasVigentes(altas, d.seguimientos, d.citas, d.reglas, d.hoy)[claveSerie(a.DNI, a.ESPECIALIDAD)]) {
      throw new Error('Ese paciente ya tiene un alta vigente en ' + a.ESPECIALIDAD + '.');
    }
    a.ID = siguienteId(altas.map(function (x) { return x.ID; }), 'ALT');
    a.FECHA_HORA = fechaHoraTexto_(new Date());
    anexarObjeto_('ALTAS', COLUMNAS_ALTAS, a);
    bitacora_(a.REGISTRADO_POR, 'ALTA', a.ID + ' · ' + a.DNI + ' · ' + a.ESPECIALIDAD + ' · ' + a.DOCTOR);
    return limpiarParaEnvio({ ok: true, alta: a });
  } finally {
    soltar_(lock);
  }
}

function anularAlta(p) {
  var d = datos_(), quien = exigirUsuario_(d.catalogos, p && p.usuario), motivo = exigirMotivo_(p), id = textoLimpio_(p.id);
  if (id.indexOf('ALT-') !== 0) throw new Error('Esa alta viene de un descarte antiguo; no se puede anular desde aquí.');
  var lock = bloquear_();
  try {
    marcarAnulado_('ALTAS', id, motivo);
    bitacora_(quien, 'ANULAR ALTA', id + ' · ' + motivo);
    return { ok: true };
  } finally {
    soltar_(lock);
  }
}

/** Marca ANULADO = SÍ y el motivo en la fila de ese ID. Solo esas dos celdas: no pisa nada más. */
function marcarAnulado_(nombre, id, motivo) {
  var sh = hoja_(nombre), v = sh.getDataRange().getValues();
  var cab = v[0].map(function (c) { return String(c).trim(); });
  var cId = cab.indexOf('ID'), cA = cab.indexOf('ANULADO'), cM = cab.indexOf('MOTIVO_ANULACION');
  if (cId < 0 || cA < 0 || cM < 0) throw new Error('A la hoja ' + nombre + ' le faltan las columnas ID, ANULADO o MOTIVO_ANULACION.');
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][cId]).trim() !== id) continue;
    if (normTexto(v[i][cA]) === 'SI') throw new Error(id + ' ya estaba anulado.');
    sh.getRange(i + 1, cA + 1).setValue('SÍ');
    sh.getRange(i + 1, cM + 1).setValue(textoSeguro(motivo));
    return;
  }
  throw new Error('No encontré ' + id + '.');
}

/** Escribe solo las celdas pedidas de la fila con ese ID. Nada más de la fila cambia. */
function actualizarCeldas_(nombre, id, cambios) {
  var sh = hoja_(nombre), v = sh.getDataRange().getValues();
  var cab = v[0].map(function (c) { return String(c).trim(); }), cId = cab.indexOf('ID'), cA = cab.indexOf('ANULADO');
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][cId]).trim() !== id) continue;
    if (cA >= 0 && normTexto(v[i][cA]) === 'SI') throw new Error(id + ' está anulado.');
    Object.keys(cambios).forEach(function (c) {
      var j = cab.indexOf(c);
      if (j < 0) throw new Error('Falta preparar las hojas: a ' + nombre + ' le falta la columna ' + c + '.');
      var r = sh.getRange(i + 1, j + 1);
      if (!COLUMNAS_FECHA[c] && !COLUMNAS_FECHA_HORA[c] && !COLUMNAS_NUMERICAS[c]) r.setNumberFormat('@');
      r.setValue(celdaParaHoja_(cambios[c], c));
    });
    return;
  }
  throw new Error('No encontré ' + id + '.');
}

function editarRegistro(p) {
  var d = datos_(), quien = exigirUsuario_(d.catalogos, p && p.usuario), id = textoLimpio_(p && p.id);
  var lock = bloquear_();
  try {
    exigirColumnas_('REGISTROS', COLUMNAS_REGISTROS);
    // Se valida con la hoja releída: otra asesora pudo anularlo o marcar una sesión entretanto.
    var sesiones = leerSesiones_();
    var r = leerRegistros_().filter(function (x) { return x.ID === id; })[0];
    var v = validarEdicionRegistro(r, p.cambios, sesiones, d.catalogos, d.hoy);
    if (v.error) throw new Error(v.error);
    var cols = Object.keys(v.cambios);
    if (!cols.length) return { ok: false, sinCambios: true };
    var ahora = fechaHoraTexto_(new Date()), escribir = copia_(v.cambios, { EDITADO: ahora });
    actualizarCeldas_('REGISTROS', id, escribir);
    cols.forEach(function (c) { bitacora_(quien, 'EDITAR REGISTRO', id + ' · ' + c + ': ' + v.antes[c] + ' → ' + v.cambios[c]); });
    var nuevo = copia_(copia_(r, v.cambios), { EDITADO: ahora });
    return limpiarParaEnvio({ ok: true, registro: filaRegistrada_(nuevo, { sesiones: sesiones }) });
  } finally {
    soltar_(lock);
  }
}

/** Una fila de «Registrados»: lo que muestra la lista y lo que necesita el formulario de edición. */
function filaRegistrada_(r, d) {
  var e = estadoRegistro(r, d.sesiones);
  return { ID: r.ID, HORA: String(r.FECHA_HORA || '').slice(11, 16), ASESORA: r.ASESORA, NOMBRE: r.NOMBRE, DNI: r.DNI, TEXTO: textoRegistro(r),
    ANULADO: anulado_(r), MOTIVO_ANULACION: r.MOTIVO_ANULACION || '', EDITADO: r.EDITADO || '', FECHA: fechaIso(r.FECHA) || '', TIPO: normTexto(r.TIPO),
    DOCTOR: r.DOCTOR || '', CONTACTO: r.CONTACTO || '', DETALLE: r.DETALLE || '', MARCA: r.MARCA || '', SESIONES: e.total, HECHAS: e.hechas,
    FECHA_INICIO: fechaIso(r.FECHA_INICIO) || '', EXAMENES: r.EXAMENES || '', FECHA_RETORNO: fechaIso(r.FECHA_RETORNO) || '', DECISION: '' };
}

function getRegistros(p) {
  var d = datos_(), nombres = {}, periodo = textoLimpio_(p && p.periodo) || 'HOY';
  d.citas.forEach(function (c) { nombres[c.DNI] = c.NOMBRE; });
  var dentro = function (x) { var f = String(x.FECHA_HORA || ''); return periodo === 'HOY' ? f.slice(0, 10) === d.hoy : f.slice(0, 7) === periodo; };
  var lista = d.registros.filter(dentro).map(function (r) { return filaRegistrada_(r, d); }).concat(d.altas.filter(dentro).map(function (a) {
    var ret = fechaIso(a.FECHA_RETORNO);
    return { ID: a.ID, HORA: String(a.FECHA_HORA || '').slice(11, 16), ASESORA: a.REGISTRADO_POR, NOMBRE: nombres[a.DNI] || '', DNI: a.DNI,
      TEXTO: decisionDe_(a).texto + ' · ' + a.ESPECIALIDAD + ' · ' + a.DOCTOR + (ret ? ' · retorno ' + fechaDma_(ret) : ''),
      ANULADO: anulado_(a), MOTIVO_ANULACION: a.MOTIVO_ANULACION || '', EDITADO: '', FECHA: fechaIso(a.FECHA) || '', TIPO: 'DECISION',
      DECISION: decisionDe_(a).nombre, FECHA_RETORNO: ret || '' };
  }));
  lista.sort(function (a, b) { var x = a.FECHA + a.HORA, y = b.FECHA + b.HORA; return x < y ? 1 : x > y ? -1 : (a.ID < b.ID ? 1 : -1); });
  return limpiarParaEnvio(lista);
}

function getRegistrosHoy() { return getRegistros({ periodo: 'HOY' }); }

function buscarPacienteRegistro(dni) {
  var d = datos_(), k = normDni(dni), muerto = fallecidos(d.seguimientos)[k] || null;
  var realizadas = d.citas.filter(function (c) { return c.DNI === k && normTexto(c.ESTADO) === 'REALIZADO'; }).sort(porFecha);
  if (!k || !realizadas.length) return limpiarParaEnvio({ encontrado: false, fallecido: muerto });
  var ultima = realizadas[realizadas.length - 1], esp = {};
  realizadas.forEach(function (c) { esp[c.ESPECIALIDAD] = 1; });
  return limpiarParaEnvio({
    encontrado: true,
    nombre: ultima.NOMBRE,
    telefonos: d.telefonos[k] || [],
    ultimaFecha: ultima.FECHA,
    ultimoMedico: ultima.MEDICO,
    doctor: doctorPropuesto(d.catalogos, ultima.MEDICO),
    especialidades: Object.keys(esp).sort().map(function (e) { return { especialidad: e, alta: !!d.vigentes[claveSerie(k, e)] }; }),
    fallecido: muerto
  });
}
