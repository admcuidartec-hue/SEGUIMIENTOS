/* ==========================================================================
   ENFERMERÍA (las llama la app por google.script.run)

   Escriben ENFERMERIA con el candado tomado y releen la hoja DENTRO del candado:
   la enfermera y las asesoras trabajan a la vez. Nunca se borra una fila: se anula.
   Diseño: docs/superpowers/specs/2026-10-20-enfermeria-design.md
   ========================================================================== */

function leerEnfermeria_() {
  var f = leerOpcional_('ENFERMERIA');
  f.forEach(function (x) { x.DNI = normDni(x.DNI); });
  return f;
}

function contactosDe_(d) {
  return contactosEnfermeria({ registros: d.registros, sesiones: d.sesiones, enfermeria: d.enfermeria, seguimientos: d.seguimientos,
    hoy: d.hoy, reglas: d.reglas, telefonos: d.telefonos, catalogos: d.catalogos });
}

function getEnfermeria() {
  var d = datos_();
  return limpiarParaEnvio({ hoy: d.hoy, contactos: contactosDe_(d), reacciones: d.catalogos.reacciones, dias: d.reglas.diasEnfermeria });
}

/** La fila de ENFERMERIA lista para escribir, con su ID (leído dentro del candado) y la hora. */
function filaEnfermeria_(fila, filas) {
  return copia_(fila, { ID: siguienteId((filas || []).map(function (x) { return x.ID; }), 'ENF'), FECHA_HORA: fechaHoraTexto_(new Date()) });
}

function registrarContactoEnfermeria(p) {
  var d = datos_(), op = opDe_(p);
  // El mismo op ya se guardó (se perdió la respuesta): lo de la primera vez, sin otro contacto.
  var previa = filasDeOp_(d.enfermeria, op)[0];
  if (previa) return limpiarParaEnvio({ ok: true, repetida: true, fila: previa, contactos: contactosDe_(d) });
  var v = validarContactoEnfermeria(p, { catalogos: d.catalogos, contactos: contactosDe_(d) });
  if (v.error) throw new Error(v.error);
  var lock = bloquear_(), f;
  try {
    exigirColumnas_('ENFERMERIA', COLUMNAS_ENFERMERIA);
    // Otra enfermera pudo registrar ese mismo contacto entretanto: se vuelve a validar con la hoja releída.
    d.enfermeria = leerEnfermeria_();
    previa = filasDeOp_(d.enfermeria, op)[0];
    if (previa) return limpiarParaEnvio({ ok: true, repetida: true, fila: previa, contactos: contactosDe_(d) });
    v = validarContactoEnfermeria(p, { catalogos: d.catalogos, contactos: contactosDe_(d) });
    if (v.error) throw new Error(v.error);
    f = filaEnfermeria_(v.fila, d.enfermeria);
    if (op) f.OP = op;
    anexarObjeto_('ENFERMERIA', conOp_('ENFERMERIA', COLUMNAS_ENFERMERIA), f);
    bitacora_(f.ENFERMERA, 'ENFERMERÍA', f.ID + ' · ' + f.DNI + ' · sesión ' + f.NUMERO_SESION + ' · día ' + f.DIA + ' · ' + f.RESULTADO +
      (f.REACCION ? ' · ' + f.REACCION_TIPO + ': ' + f.REACCION : ''), op);
  } finally {
    soltar_(lock);
  }
  d.enfermeria = d.enfermeria.concat([f]);
  return limpiarParaEnvio(avisos_({ ok: true, fila: f, contactos: contactosDe_(d) }));
}

function anularContactoEnfermeria(p) {
  var d = datos_(), quien = exigirUsuario_(d.catalogos, p && p.usuario), motivo = exigirMotivo_(p), id = textoLimpio_(p.id), op = opDe_(p);
  if (id.indexOf('ENF-') !== 0) throw new Error('Aquí solo se anulan contactos de Enfermería (ENF-…).');
  var lock = bloquear_();
  try {
    var error = validarAnulacionEnfermeria(id, leerEnfermeria_());
    if (error && /ya estaba anulad/.test(error) && anulacionHecha_(op)) return { ok: true, repetida: true };
    if (error) throw new Error(error);
    marcarAnulado_('ENFERMERIA', id, motivo);
    bitacora_(quien, 'ANULAR ENFERMERÍA', id + ' · ' + motivo, op);
    return avisos_({ ok: true });
  } finally {
    soltar_(lock);
  }
}
