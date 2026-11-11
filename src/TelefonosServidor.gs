/* ==========================================================================
   «AGREGAR TELÉFONO» (11/11/2026; las llama la app por google.script.run)

   El export de SOFDOC no trae teléfono: muchas tarjetas decían «Sin teléfono» aunque
   Admisión o Enfermería lo consiguieran por otro lado. Se guarda en la hoja TELEFONOS,
   una fila por número agregado, y telefonosPorDni lo pone primero en la lista del
   paciente. Escriben con el candado tomado; nunca se borra una fila: se anula.
   ========================================================================== */

/**
 * Agregar un teléfono es de admisión y de enfermería (la enfermera también consigue números): solo consulta no puede. Quien no
 * está en el catálogo recibe el mensaje de siempre. Se comprueba antes de leer o escribir nada, como exigirRol_.
 */
function exigirRolTelefono_(p) {
  var c = datos_().catalogos;
  if (rolDe(c, p && p.usuario) === 'CONSULTA') throw new Error(MENSAJES_ROL.CONSULTA);
  return exigirUsuario_(c, p && p.usuario);
}

/** Lo que validarTelefonoAgregado necesita saber del libro. */
function contextoTelefono_(d) {
  return { conocidos: dnisConocidos(d), telefonos: d.telefonos, muertos: fallecidos(d.seguimientos || []) };
}

/** Los teléfonos vigentes de `dni` con las filas de TELEFONOS de `manual` (sin volver a leer las demás hojas). */
function telefonosConManual_(d, manual, dni) {
  return telefonosPorDni(d.indicacionesTodas, d.contactos, d.seguimientos, manual)[dni] || [];
}

/**
 * p = { usuario, dni, telefono, nota, op }. Guarda el número en TELEFONOS (TEL-…) y devuelve los teléfonos vigentes del paciente,
 * el agregado primero. Si ese número ya es un teléfono vigente del paciente, no escribe: { ok, yaEstaba: true }. Un paciente
 * cerrado por «Sin contacto válido» se reabre solo (leerCiclo ve un contacto que no estaba al cerrar).
 */
function agregarTelefono(p) {
  var quien = exigirRolTelefono_(p);
  var d = datos_(), op = opDe_(p), manual = d.telefonosManual || [];
  // El mismo op ya se guardó (se perdió la respuesta): lo de la primera vez, sin otra fila.
  var previa = filasDeOp_(manual, op)[0];
  if (previa) return limpiarParaEnvio({ ok: true, repetida: true, id: previa.ID, fila: previa, telefonos: telefonosConManual_(d, manual, normDni(previa.DNI)) });
  var v = validarTelefonoAgregado(p, contextoTelefono_(d));
  if (v.error) throw new Error(v.error);
  if (v.yaEstaba) return limpiarParaEnvio({ ok: true, yaEstaba: true, telefonos: d.telefonos[v.fila.DNI] || [] });
  var lock = bloquear_(), f;
  try {
    exigirColumnas_('TELEFONOS', COLUMNAS_TELEFONOS);
    // Otra persona pudo agregar ese número entretanto: se decide con la hoja releída dentro del candado.
    manual = leerTelefonos_();
    previa = filasDeOp_(manual, op)[0];
    if (previa) return limpiarParaEnvio({ ok: true, repetida: true, id: previa.ID, fila: previa, telefonos: telefonosConManual_(d, manual, normDni(previa.DNI)) });
    var ctx = contextoTelefono_(d);
    ctx.telefonos = telefonosPorDni(d.indicacionesTodas, d.contactos, d.seguimientos, manual);
    v = validarTelefonoAgregado(p, ctx);
    if (v.error) throw new Error(v.error);
    if (v.yaEstaba) return limpiarParaEnvio({ ok: true, yaEstaba: true, telefonos: ctx.telefonos[v.fila.DNI] || [] });
    f = copia_(v.fila, { ID: siguienteId(manual.map(function (x) { return x.ID; }), 'TEL'), FECHA_HORA: fechaHoraTexto_(new Date()),
      USUARIO: quien, ANULADO: '', MOTIVO_ANULACION: '' });
    if (op) f.OP = op;
    anexarObjeto_('TELEFONOS', conOp_('TELEFONOS', COLUMNAS_TELEFONOS), f);
    // Como las demás líneas: el ID y el DNI; del número, solo el final (está en la hoja).
    bitacora_(quien, 'AGREGAR TELÉFONO', f.ID + ' · DNI ' + f.DNI + ' · …' + f.TELEFONO.slice(-3) + (f.NOTA ? ' · ' + f.NOTA : ''), op);
  } finally {
    soltar_(lock);
  }
  manual = manual.concat([f]);
  d.telefonosManual = manual;
  MEMO.datos = null;   // lo leído ya no vale: la próxima lectura de esta petición ve el teléfono
  return limpiarParaEnvio(avisos_({ ok: true, id: f.ID, fila: f, telefonos: telefonosConManual_(d, manual, f.DNI) }));
}

/** p = { usuario, id: 'TEL-…', motivo, op }. Anula un teléfono agregado («Deshacer»): sale de la lista del paciente. */
function anularTelefono(p) {
  var quien = exigirRolTelefono_(p);
  var d = datos_(), motivo = exigirMotivo_(p), id = textoLimpio_(p && p.id), op = opDe_(p);
  if (id.indexOf('TEL-') !== 0) throw new Error('Aquí solo se anulan teléfonos agregados (TEL-…).');
  var lock = bloquear_(), fila;
  try {
    var manual = leerTelefonos_();
    fila = manual.filter(function (x) { return textoLimpio_(x.ID) === id; })[0];
    if (anulacionRepetida_(function () { marcarAnulado_('TELEFONOS', id, motivo); }, op)) {
      return limpiarParaEnvio({ ok: true, repetida: true, telefonos: fila ? telefonosConManual_(d, manual, fila.DNI) : [] });
    }
    bitacora_(quien, 'ANULAR TELÉFONO', id + ' · ' + motivo, op);
    if (fila) fila.ANULADO = 'SÍ';
    MEMO.datos = null;
    return limpiarParaEnvio(avisos_({ ok: true, telefonos: fila ? telefonosConManual_(d, manual, fila.DNI) : [] }));
  } finally {
    soltar_(lock);
  }
}
