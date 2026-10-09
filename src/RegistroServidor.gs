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

function marcarSesion(p) {
  var d = datos_();
  var asesora = exigirUsuario_(d.catalogos, p && p.usuario);
  var lock = bloquear_();
  try {
    var sesiones = leerSesiones_(), id = textoLimpio_(p.id);
    var r = leerRegistros_().filter(function (x) { return x.ID === id; })[0];
    var error = validarSesion(r, sesiones, p.fecha, d.hoy);
    if (error) throw new Error(error);
    var e = estadoRegistro(r, sesiones);
    var s = { ID: siguienteId(sesiones.map(function (x) { return x.ID; }), 'SES'), FECHA_HORA: fechaHoraTexto_(new Date()),
      ID_REGISTRO: r.ID, NUMERO: e.hechas + 1, FECHA: fechaIso(p.fecha), ASESORA: asesora, NOTA: textoLimpio_(p.nota),
      ANULADO: '', MOTIVO_ANULACION: '' };
    anexarObjeto_('SESIONES', COLUMNAS_SESIONES, s);
    bitacora_(asesora, 'SESIÓN', r.ID + ' · sesión ' + s.NUMERO + ' de ' + e.total);
    return limpiarParaEnvio({ ok: true, sesion: s, completo: s.NUMERO >= e.total });
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
    if (altasVigentes(altas, d.seguimientos, d.citas)[claveSerie(a.DNI, a.ESPECIALIDAD)]) {
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

function getRegistrosHoy() {
  var d = datos_(), nombres = {};
  d.citas.forEach(function (c) { nombres[c.DNI] = c.NOMBRE; });
  var hoy = function (x) { return String(x.FECHA_HORA || '').slice(0, 10) === d.hoy; };
  var hora = function (x) { return String(x.FECHA_HORA || '').slice(11, 16); };
  var lista = d.registros.filter(hoy).map(function (r) {
    return { ID: r.ID, HORA: hora(r), ASESORA: r.ASESORA, NOMBRE: r.NOMBRE, DNI: r.DNI, TEXTO: textoRegistro(r), ANULADO: anulado_(r), MOTIVO_ANULACION: r.MOTIVO_ANULACION || '' };
  }).concat(d.altas.filter(hoy).map(function (a) {
    return { ID: a.ID, HORA: hora(a), ASESORA: a.REGISTRADO_POR, NOMBRE: nombres[a.DNI] || '', DNI: a.DNI,
      TEXTO: decisionDe_(a).texto + ' · ' + a.ESPECIALIDAD + ' · ' + a.DOCTOR + (fechaIso(a.FECHA_RETORNO) ? ' · retorno ' + fechaDma_(fechaIso(a.FECHA_RETORNO)) : ''), ANULADO: anulado_(a), MOTIVO_ANULACION: a.MOTIVO_ANULACION || '' };
  }));
  lista.sort(function (a, b) { return a.HORA < b.HORA ? 1 : a.HORA > b.HORA ? -1 : (a.ID < b.ID ? 1 : -1); });
  return limpiarParaEnvio(lista);
}

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
