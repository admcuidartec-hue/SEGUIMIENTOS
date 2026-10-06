/* ==========================================================================
   «¿QUÉ PASÓ?» (las llama la app por google.script.run)

   Escribe en SEGUIMIENTOS con el candado tomado. El alta de una reevaluación y
   la sesión de un registro ya tienen su hoja: se delegan en darDeAlta y marcarSesion.
   ========================================================================== */

function registrarResultado(p) {
  var d = datos_();
  var v = validarResultado(p, { catalogos: d.catalogos, hoy: d.hoy, tarjetas: d.pacientes.concat(d.pendientes) });
  if (v.error) throw new Error(v.error);
  var t = v.tarjeta, indicacion = !!TIPOS_INDICACION[normTexto(t.ESPECIALIDAD)];
  if (v.fila.RESULTADO === 'ALTA MÉDICA' && !indicacion) {
    return darDeAlta({ usuario: p.usuario, dni: v.fila.DNI, especialidad: t.ESPECIALIDAD, doctor: p.doctor, fecha: p.fecha, nota: textoLimpio_(p.nota) });
  }
  if (v.fila.RESULTADO === 'LO HIZO' && t.ID_REGISTRO) {
    return marcarSesion({ usuario: p.usuario, id: t.ID_REGISTRO, fecha: p.fecha, nota: textoLimpio_(p.nota) });
  }
  var lock = bloquear_(), s;
  try {
    var ahora = new Date();
    // Otra asesora pudo marcar otro número entretanto: se decide con la hoja releída dentro del candado.
    var frescos = leerSeguimientos_().filter(function (x) { return !anulado_(x); });
    var quedan = true;
    if (v.fila.TELEFONO) {
      var marca = { DNI: v.fila.DNI, RESULTADO: 'NÚMERO EQUIVOCADO', TELEFONO: v.fila.TELEFONO, FECHA_HORA: fechaHoraTexto_(ahora) };
      quedan = (telefonosPorDni(d.indicacionesTodas, d.contactos, frescos.concat([marca]))[v.fila.DNI] || []).length > 0 || !!t.USUARIO;
    }
    s = copia_(v.fila, { ID: 'SEG-' + ahora.getTime() + '-' + Math.floor(Math.random() * 1000), FECHA_HORA: fechaHoraTexto_(ahora),
      ACCION: accionPara(v.fila.RESULTADO, quedan) });
    anexarObjeto_('SEGUIMIENTOS', COLUMNAS_SEGUIMIENTOS, s);
    bitacora_(s.RESPONSABLE, 'RESULTADO', s.DNI + ' · ' + s.ESPECIALIDAD + ' · ' + s.RESULTADO + (s.REFERENCIA ? ' · ' + s.REFERENCIA : ''));
    d.seguimientos = frescos.concat([s]);
  } finally {
    soltar_(lock);
  }
  // Fuera del candado: la tarjeta recalculada en memoria, para que la app confirme el movimiento.
  d.seguimientosTodos = d.seguimientosTodos.concat([s]);
  derivar_(d);
  var clave = claveTarjeta(t), tab = armarTablero(d), nueva = null;
  Object.keys(tab.columnas).forEach(function (c) {
    tab.columnas[c].forEach(function (x) { if (x.CLAVE === clave && !nueva) nueva = x; });
  });
  return limpiarParaEnvio({ ok: true, seguimiento: s, tarjeta: nueva });
}

function anularResultado(p) {
  var d = datos_(), quien = exigirUsuario_(d.catalogos, p && p.usuario), motivo = exigirMotivo_(p), id = textoLimpio_(p.id);
  if (id.indexOf('SEG-') !== 0) throw new Error('Aquí solo se anulan resultados de seguimiento (SEG-…).');
  var lock = bloquear_();
  try {
    var error = validarAnulacionResultado(id, leerSeguimientos_());
    if (error) throw new Error(error);
    marcarAnulado_('SEGUIMIENTOS', id, motivo);
    bitacora_(quien, 'ANULAR RESULTADO', id + ' · ' + motivo);
    return { ok: true };
  } finally {
    soltar_(lock);
  }
}

function getTablero() {
  return limpiarParaEnvio(armarTablero(datos_()));
}
