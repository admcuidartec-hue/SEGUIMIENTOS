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
  if (largoMal_(p && p.motivo, LARGO_TEXTO, 'El motivo')) throw new Error(largoMal_(p.motivo, LARGO_TEXTO, 'El motivo'));
  var m = textoLimpio_(p && p.motivo);
  if (!m) throw new Error('Escriba el motivo de la anulación.');
  if (largoMal_(m, LARGO_TEXTO, 'El motivo')) throw new Error(largoMal_(m, LARGO_TEXTO, 'El motivo'));
  return m;
}

/**
 * Antes de escribir nada: la hoja tiene todas sus columnas (en cualquier orden y grafía: anexarObjeto_ escribe por nombre) y
 * ninguna repetida. Si no, el mensaje dice qué falta (errorEncabezado). La OP puede faltar: sin ella se escribe sin idempotencia.
 */
function exigirColumnas_(nombre, columnas) {
  var error = errorEncabezado(nombre, revisarEncabezado(columnasDeHoja_(nombre), columnas));
  if (error) throw new Error(error);
}

/** ¿Se puede escribir con este encabezado? (todas las columnas, en cualquier orden; la OP puede faltar). */
function columnasListas_(cab, columnas) {
  return !errorEncabezado('', revisarEncabezado(cab, columnas));
}

function guardarRegistro(p) {
  var d = datos_(), op = opDe_(p);
  var v = validarRegistro(p, d.catalogos, d.hoy);
  // El mismo op ya se guardó (se perdió la respuesta): lo de la primera vez, sin el aviso de duplicado ni otra fila.
  // Si quedó a medias (falló una fila y también deshacerlo), no cuenta como hecho: se rehace dentro del candado (caso 6).
  var previo = registroRepetido_(d.registros, d.sesiones, op, v.error ? null : v);
  if (previo && !previo.incompleto) return limpiarParaEnvio(previo);
  if (v.error) throw new Error(v.error);
  var muerto = mensajeFallecido(fallecidos(d.seguimientos)[normDni(v.filas[0] && v.filas[0].DNI)]);
  if (muerto) throw new Error(muerto);
  var dup = !(p && p.confirmado) && duplicadoDe_(sinOp_(d.registros, op), v.filas);
  if (dup) return limpiarParaEnvio(dup);
  var lock = bloquear_();
  try {
    exigirColumnas_('REGISTROS', COLUMNAS_REGISTROS);
    if (v.sesionHecha) exigirColumnas_('SESIONES', COLUMNAS_SESIONES);
    var registros = leerOpcional_('REGISTROS'), ids = registros.map(function (r) { return r.ID; });
    // Primera sesión ya aplicada (fecha pasada): se marca la sesión 1 de cada registro en este mismo candado.
    var sesiones = v.sesionHecha ? leerSesiones_() : [];
    previo = registroRepetido_(registros, sesiones, op, v);
    if (previo && !previo.incompleto) return limpiarParaEnvio(previo);
    if (previo) anularIncompleto_(previo);
    // Otra asesora pudo registrar lo mismo entre la lectura de arriba y el candado: el duplicado se revisa otra vez aquí.
    dup = !(p && p.confirmado) && duplicadoDe_(sinOp_(registros, op), v.filas);
    if (dup) return limpiarParaEnvio(dup);
    var ahora = fechaHoraTexto_(new Date()), hechas = [], filasSes = [];
    // Todo se valida antes de escribir la primera fila: un registro de varias filas es todo o nada.
    v.filas.forEach(function (f, i) {
      f.ID = siguienteId(ids, 'REG');
      ids.push(f.ID);
      f.FECHA_HORA = ahora;
      if (op) f.OP = op + '#' + (i + 1);
      f.TEXTO = textoRegistro(f);
      if (v.sesionHecha) {
        var error = validarSesion(f, [], v.sesionHecha, d.hoy);
        if (error) throw new Error(error);
        var s = { ID: siguienteId(sesiones.map(function (x) { return x.ID; }).concat(filasSes.map(function (x) { return x.ID; })), 'SES'),
          FECHA_HORA: ahora, ID_REGISTRO: f.ID, NUMERO: 1, FECHA: v.sesionHecha, ASESORA: f.ASESORA, NOTA: 'Registrada con el tratamiento',
          ANULADO: '', MOTIVO_ANULACION: '' };
        if (op) s.OP = op + '#s' + (i + 1);
        filasSes.push(s);
      }
    });
    // Si una fila falla a mitad (la hoja no responde), se anula lo que ya se escribió en esta llamada: no queda un AMO sin su
    // biopsia, ni un registro sin la sesión 1 que se dijo aplicada.
    var deshacer = [], motivo = 'No se guardó: falló a mitad del registro (se deshizo solo)';
    try {
      v.filas.forEach(function (f) {
        var copia = copia_(f, {}); delete copia.TEXTO;
        anexarObjeto_('REGISTROS', conOp_('REGISTROS', COLUMNAS_REGISTROS), copia);
        deshacer.push(function () { marcarAnulado_('REGISTROS', f.ID, motivo); });
        var s = filasSes.filter(function (x) { return x.ID_REGISTRO === f.ID; })[0];
        if (s) {
          anexarObjeto_('SESIONES', conOp_('SESIONES', COLUMNAS_SESIONES), s);
          deshacer.push(function () { marcarAnulado_('SESIONES', s.ID, motivo); });
          hechas.push(s);
        }
      });
    } catch (err) {
      deshacerEscritura_(deshacer, err);
    }
    // La BITACORA, después de todo lo guardado: si falla, lo guardado queda y la respuesta lo avisa (bitacora_).
    v.filas.forEach(function (f) {
      bitacora_(f.ASESORA, 'REGISTRO', f.ID + ' · ' + f.DNI + ' · ' + f.TEXTO, op);
      if (hechas.some(function (s) { return s.ID_REGISTRO === f.ID; })) {
        bitacora_(f.ASESORA, 'SESIÓN', f.ID + ' · sesión 1 de ' + (Number(f.SESIONES) || 1) + ' (registrada con el tratamiento)', op);
      }
    });
    return limpiarParaEnvio(avisos_({ ok: true, registros: v.filas, sesiones: hechas }));
  } finally {
    soltar_(lock);
  }
}

/** El aviso de posible duplicado de la primera fila que tenga uno (duplicadoReciente), o null. */
function duplicadoDe_(registros, filas) {
  for (var i = 0; i < filas.length; i++) {
    var dup = duplicadoReciente(registros, filas[i]);
    if (dup) return { ok: false, duplicado: { ID: dup.ID, FECHA: fechaIso(dup.FECHA), TEXTO: textoRegistro(dup) } };
  }
  return null;
}

/**
 * La respuesta de un guardarRegistro que ya se guardó con ese op (filas OP = op#n), o null. Con `v` (lo que pide este
 * reintento, validarRegistro): si quedan vivas menos filas (o sesiones 1) de las que pide, la primera vez quedó a medias
 * (falló una fila y también deshacerla) y la respuesta lleva `incompleto`: nunca se dice «guardado» con datos a medias.
 */
function registroRepetido_(registros, sesiones, op, v) {
  var filas = filasDeOp_(registros, op);
  if (!filas.length) return null;
  var ids = {};
  filas.forEach(function (f) { ids[f.ID] = 1; });
  var ses = filasDeOp_(sesiones, op).filter(function (s) { return ids[s.ID_REGISTRO]; });
  if (v && v.filas && (filas.length < v.filas.length || (v.sesionHecha && ses.length < v.filas.length))) {
    return { incompleto: true, registros: filas, sesiones: ses };
  }
  return { ok: true, repetida: true, registros: filas.map(function (f) { return copia_(f, { TEXTO: textoRegistro(f) }); }),
    sesiones: ses };
}

/** Las filas que no son de ese op (para el aviso de duplicado: lo que quedó a medias de este mismo op no es otro registro). */
function sinOp_(filas, op) {
  if (!op) return filas || [];
  var mias = {};
  filasDeOp_(filas, op).forEach(function (f) { mias[f.ID] = 1; });
  return (filas || []).filter(function (f) { return !mias[f.ID]; });
}

/** Anula, con el candado tomado, lo que quedó vivo de un intento anterior a medias; si no puede, rechaza sin escribir nada. */
function anularIncompleto_(previo) {
  var motivo = 'Se rehízo: el intento anterior quedó a medias';
  try {
    previo.sesiones.forEach(function (s) { marcarAnulado_('SESIONES', s.ID, motivo); });
    previo.registros.forEach(function (f) { marcarAnulado_('REGISTROS', f.ID, motivo); });
  } catch (e) {
    throw new Error('No se guardó: un intento anterior de este registro quedó a medias (' + previo.registros.map(function (f) { return f.ID; }).join(', ') +
      ') y no se pudo anular: revise Registrados y anule lo que haya quedado antes de registrar otra vez.');
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
  var asesora = exigirUsuario_(d.catalogos, p && p.usuario), proxima = textoLimpio_(p && p.proxima), op = opDe_(p);
  var lock = bloquear_();
  try {
    var sesiones = leerSesiones_(), id = textoLimpio_(p.id);
    // El mismo op ya se guardó (se perdió la respuesta y la app reintenta): lo de la primera vez, sin marcar otra sesión.
    var previa = filasDeOp_(sesiones, op).filter(function (x) { return String(x.OP).trim() === op; })[0];
    if (previa) return limpiarParaEnvio(sesionRepetida_(previa, sesiones, op));
    var r = leerRegistros_().filter(function (x) { return x.ID === id; })[0];
    var muerto = r ? mensajeFallecido(fallecidos(d.seguimientos)[normDni(r.DNI)]) : '';
    if (muerto) throw new Error(muerto);
    // La sesión que vio la persona (p.sesion): si otra pestaña ya la marcó, no se guarda como la siguiente.
    var error = r && !anulado_(r) ? sesionYaNoEsLaSiguiente(estadoRegistro(r, sesiones), p.sesion) : '';
    if (error) throw new Error(error);
    error = validarSesion(r, sesiones, p.fecha, d.hoy) || largoMal_(p.nota, LARGO_TEXTO, 'La nota');
    if (error) throw new Error(error);
    var e = estadoRegistro(r, sesiones);
    // «¿Reacción durante la aplicación?»: se valida antes de escribir nada, para no dejar la sesión a medias.
    var reac = normTexto(r.TIPO) === 'HIERRO' ? reaccionAplicacion(p.reaccion, d.catalogos) : { error: '', fila: null };
    if (reac.error) throw new Error(reac.error);
    if (reac.fila) exigirColumnas_('ENFERMERIA', COLUMNAS_ENFERMERIA);
    if (proxima) {
      error = validarProximaSesion(e, p.fecha, proxima, d.hoy);
      if (error) throw new Error(error);
      exigirHojaPreparada_();   // antes de escribir nada: SEGUIMIENTOS se escribe por posición
    }
    exigirColumnas_('SESIONES', COLUMNAS_SESIONES);   // antes de escribir nada (caso 50)
    var ahora = new Date(), cuando = fechaHoraTexto_(ahora);
    var s = { ID: siguienteId(sesiones.map(function (x) { return x.ID; }), 'SES'), FECHA_HORA: cuando,
      ID_REGISTRO: r.ID, NUMERO: e.hechas + 1, FECHA: fechaIso(p.fecha), ASESORA: asesora, NOTA: textoLimpio_(p.nota),
      ANULADO: '', MOTIVO_ANULACION: '' };
    if (op) s.OP = op;
    anexarObjeto_('SESIONES', conOp_('SESIONES', COLUMNAS_SESIONES), s);
    bitacora_(asesora, 'SESIÓN', r.ID + ' · sesión ' + s.NUMERO + ' de ' + e.total, op);
    var out = { ok: true, sesion: s, completo: s.NUMERO >= e.total };
    // La sesión ya está escrita: si la reacción o la agenda fallan, no se lanza (la app creería que nada se guardó y la
    // marcaría otra vez). Se avisa y se registra aparte.
    if (reac.fila) {
      try {
        var fe = copia_(reac.fila, { ID: siguienteId(leerEnfermeria_().map(function (x) { return x.ID; }), 'ENF'), FECHA_HORA: cuando,
          ID_REGISTRO: r.ID, ID_SESION: s.ID, NUMERO_SESION: s.NUMERO, DNI: normDni(r.DNI), ENFERMERA: asesora, ANULADO: '', MOTIVO_ANULACION: '' });
        if (op) fe.OP = op + '#reaccion';
        anexarObjeto_('ENFERMERIA', conOp_('ENFERMERIA', COLUMNAS_ENFERMERIA), fe);
        bitacora_(asesora, 'ENFERMERÍA', fe.ID + ' · ' + fe.DNI + ' · sesión ' + s.NUMERO + ' · reacción en la aplicación: ' + fe.REACCION, op);
        out.reaccion = fe;
      } catch (err) {
        out.reaccionError = 'La sesión quedó marcada, pero no se pudo guardar la reacción (' + (err && err.message || err) + '): regístrela en Enfermería.';
      }
    }
    if (proxima) {
      // Misma FECHA_HORA que la sesión: pendientesRegistro cuenta los seguimientos desde que se registró la última sesión.
      var g = copia_(filaProximaSesion(r, s, proxima, asesora), { ID: 'SEG-' + ahora.getTime() + '-' + Math.floor(Math.random() * 1000),
        FECHA_HORA: cuando, ACCION: accionPara('AGENDÓ CITA', true) });
      if (op) g.OP = op + '#agenda';
      try {
        anexarObjeto_('SEGUIMIENTOS', conOp_('SEGUIMIENTOS', COLUMNAS_SEGUIMIENTOS), g);
        bitacora_(asesora, 'RESULTADO', g.DNI + ' · ' + g.ESPECIALIDAD + ' · ' + g.RESULTADO + ' · ' + g.REFERENCIA, op);
        out.agenda = g;
      } catch (err) {
        out.agendaError = 'No se pudo agendar la próxima sesión: ' + (err && err.message || err);
      }
    }
    return limpiarParaEnvio(avisos_(out));
  } finally {
    soltar_(lock);
  }
}

/** La respuesta de un marcarSesion que ya se guardó con ese op: la sesión, y su agenda y su reacción si se escribieron. */
function sesionRepetida_(previa, sesiones, op) {
  var r = leerRegistros_().filter(function (x) { return x.ID === previa.ID_REGISTRO; })[0];
  var out = { ok: true, repetida: true, sesion: previa, completo: !!r && Number(previa.NUMERO) >= estadoRegistro(r, sesiones).total };
  var g = leerSeguimientos_().filter(function (x) { return !anulado_(x) && String(x.OP || '').trim() === op + '#agenda'; })[0];
  if (g) out.agenda = g;
  var fe = leerEnfermeria_().filter(function (x) { return !anulado_(x) && String(x.OP || '').trim() === op + '#reaccion'; })[0];
  if (fe) out.reaccion = fe;
  return out;
}

function anularRegistro(p) {
  var d = datos_(), quien = exigirUsuario_(d.catalogos, p && p.usuario), motivo = exigirMotivo_(p), op = opDe_(p);
  var lock = bloquear_();
  try {
    var id = textoLimpio_(p.id);
    if (anulacionRepetida_(function () { marcarAnulado_('REGISTROS', id, motivo); }, op)) return { ok: true, repetida: true };
    bitacora_(quien, 'ANULAR REGISTRO', id + ' · ' + motivo, op);
    // En el mismo candado, su agenda viva (la próxima sesión agendada, un «Agendó cita» por venir): no queda una cita de un
    // registro que ya no existe, ni cuenta en la meta del día. Sus sesiones hechas no se tocan.
    agendaVivaDeRegistro(id, leerSeguimientos_(), d.hoy).forEach(function (g) {
      marcarAnulado_('SEGUIMIENTOS', g.ID, motivo + ' (se anuló el registro ' + id + ')');
      bitacora_(quien, 'ANULAR RESULTADO', g.ID + ' · con el registro ' + id, op);
    });
    return avisos_({ ok: true });
  } finally {
    soltar_(lock);
  }
}

function anularSesion(p) {
  var d = datos_(), quien = exigirUsuario_(d.catalogos, p && p.usuario), motivo = exigirMotivo_(p), op = opDe_(p);
  var lock = bloquear_();
  try {
    var v = validarAnulacionSesion(textoLimpio_(p.id), leerSesiones_(), leerRegistros_());
    if (v.error && /ya estaba anulada/.test(v.error) && anulacionHecha_(op)) return { ok: true, repetida: true };
    if (v.error) throw new Error(v.error);
    marcarAnulado_('SESIONES', v.sesion.ID, motivo);
    bitacora_(quien, 'ANULAR SESIÓN', v.sesion.ID + ' (' + v.sesion.ID_REGISTRO + ') · ' + motivo, op);
    // La próxima sesión que se agendó al marcar esta pertenece a esta: se anula con ella (Deshacer no deja una agenda que miente).
    // También un «Agendó cita» sin liga escrito después de registrarla: agendaba la sesión que le seguía.
    var desde = String(v.sesion.FECHA_HORA || '');
    leerSeguimientos_().filter(function (g) {
      if (anulado_(g) || textoLimpio_(g.REFERENCIA) !== v.sesion.ID_REGISTRO || normTexto(g.RESULTADO) !== 'AGENDO CITA') return false;
      var ligada = sesionLigada(g);
      return ligada ? ligada === v.sesion.ID : !!desde && String(g.FECHA_HORA || '') >= desde;
    }).forEach(function (g) {
      marcarAnulado_('SEGUIMIENTOS', g.ID, motivo + ' (se anuló la sesión ' + v.sesion.ID + ')');
      bitacora_(quien, 'ANULAR RESULTADO', g.ID + ' · con la sesión ' + v.sesion.ID, op);
    });
    return avisos_({ ok: true });
  } finally {
    soltar_(lock);
  }
}

function darDeAlta(p) {
  var d = datos_(), op = opDe_(p);
  var previa = filasDeOp_(d.altas, op)[0];
  if (previa) return limpiarParaEnvio({ ok: true, repetida: true, alta: previa });
  var v = validarAlta(p, d.catalogos, d.citas, d.vigentes, d.hoy);
  if (v.error) throw new Error(v.error);
  var lock = bloquear_();
  try {
    exigirColumnas_('ALTAS', COLUMNAS_ALTAS);
    var a = v.alta, altas = leerAltas_();
    previa = filasDeOp_(altas, op)[0];
    if (previa) return limpiarParaEnvio({ ok: true, repetida: true, alta: previa });
    // Otra asesora pudo dar la misma alta mientras tanto: se revisa otra vez con la hoja releída dentro del candado.
    if (altasVigentes(altas, d.seguimientos, d.citas, d.reglas, d.hoy)[claveSerie(a.DNI, a.ESPECIALIDAD)]) {
      throw new Error('Ese paciente ya tiene un alta vigente en ' + a.ESPECIALIDAD + '.');
    }
    a.ID = siguienteId(altas.map(function (x) { return x.ID; }), 'ALT');
    a.FECHA_HORA = fechaHoraTexto_(new Date());
    if (op) a.OP = op;
    anexarObjeto_('ALTAS', conOp_('ALTAS', COLUMNAS_ALTAS), a);
    bitacora_(a.REGISTRADO_POR, 'ALTA', a.ID + ' · ' + a.DNI + ' · ' + a.ESPECIALIDAD + ' · ' + a.DOCTOR, op);
    return limpiarParaEnvio(avisos_({ ok: true, alta: a }));
  } finally {
    soltar_(lock);
  }
}

function anularAlta(p) {
  var d = datos_(), quien = exigirUsuario_(d.catalogos, p && p.usuario), motivo = exigirMotivo_(p), id = textoLimpio_(p.id), op = opDe_(p);
  if (id.indexOf('ALT-') !== 0) throw new Error('Esa alta viene de un descarte antiguo; no se puede anular desde aquí.');
  var lock = bloquear_();
  try {
    if (anulacionRepetida_(function () { marcarAnulado_('ALTAS', id, motivo); }, op)) return { ok: true, repetida: true };
    bitacora_(quien, 'ANULAR ALTA', id + ' · ' + motivo, op);
    return avisos_({ ok: true });
  } finally {
    soltar_(lock);
  }
}

/**
 * Anula con `anular` (marcarAnulado_). Si la fila ya estaba anulada y la BITACORA tiene una anulación con este mismo op, es el
 * reintento de una anulación que ya se hizo (se perdió la respuesta): devuelve true y no se escribe nada. Si no, el error sigue.
 */
function anulacionRepetida_(anular, op) {
  try {
    anular();
    return false;
  } catch (e) {
    if (/ya estaba anulad/.test(e && e.message || '') && anulacionHecha_(op)) return true;
    throw e;
  }
}

/** Marca ANULADO = SÍ y el motivo en la fila de ese ID. Solo esas dos celdas: no pisa nada más. */
function marcarAnulado_(nombre, id, motivo) {
  var sh = hoja_(nombre), v = sh.getDataRange().getValues();
  var cab = v[0].map(normColumna);
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
  var cab = v[0].map(normColumna), cId = cab.indexOf('ID'), cA = cab.indexOf('ANULADO');
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
