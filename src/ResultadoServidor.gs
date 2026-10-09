/* ==========================================================================
   «¿QUÉ PASÓ?» (las llama la app por google.script.run)

   Escribe en SEGUIMIENTOS con el candado tomado. El alta de una reevaluación y
   la sesión de un registro ya tienen su hoja: se delegan en darDeAlta y marcarSesion.
   ========================================================================== */

/** Solo las tarjetas abiertas aceptan un resultado: uno tardío sobre una serie cerrada la reabriría. */
function tarjetasAbiertas_(d) {
  var c = armarTablero(d).columnas;
  return (c.POR_CONTACTAR || []).concat(c.AGENDADO || [], c.EN_TRATAMIENTO || []);
}

function registrarResultado(p) { return registrarResultado_(p, null); }

/** Guarda contra la ventana de publicación: SEGUIMIENTOS se escribe por posición y necesita sus columnas nuevas. */
function exigirHojaPreparada_() {
  var plan = encabezadoAmpliable(encabezado_(hoja_('SEGUIMIENTOS')), COLUMNAS_SEGUIMIENTOS);
  if (plan.error || plan.agregar.length) throw new Error('Falta preparar las hojas: en el Sheets, menú Seguimientos → Preparar hojas.');
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

/** `opciones` es interno (no viene de la app): { motivo } conserva el motivo original de una pestaña vieja. */
function registrarResultado_(p, opciones) {
  var d = datos_();
  var v = validarResultado(p, { catalogos: d.catalogos, hoy: d.hoy, tarjetas: tarjetasAbiertas_(d) });
  if (v.error) throw new Error(v.error);
  var t = v.tarjeta, indicacion = !!TIPOS_INDICACION[normTexto(t.ESPECIALIDAD)];
  if (v.fila.RESULTADO === 'ALTA MÉDICA' && !indicacion) {
    var rAlta = darDeAlta({ usuario: p.usuario, dni: v.fila.DNI, especialidad: t.ESPECIALIDAD, doctor: p.doctor, fecha: p.fecha, nota: textoLimpio_(p.nota) });
    return conTarjeta_(rAlta, claveTarjeta(t));
  }
  if (v.fila.RESULTADO === 'LO HIZO' && t.ID_REGISTRO) {
    var rSesion = marcarSesion({ usuario: p.usuario, id: t.ID_REGISTRO, fecha: p.fecha, nota: textoLimpio_(p.nota) });
    return conTarjeta_(rSesion, claveTarjeta(t));
  }
  var lock = bloquear_(), s;
  try {
    exigirHojaPreparada_();
    var ahora = new Date();
    // Otra asesora pudo marcar otro número entretanto: se decide con la hoja releída dentro del candado.
    var frescos = leerSeguimientos_().filter(function (x) { return !anulado_(x); });
    // Se vuelve a validar con lo releído: otra asesora pudo cerrar o dar de baja al paciente.
    d.seguimientos = frescos;
    // «Aceptó» crea o programa un registro: otra asesora pudo hacerlo entretanto, y su registro cierra la cotización.
    if (v.fila.RESULTADO === 'ACEPTÓ') d.registros = leerRegistros_();
    derivar_(d);
    v = validarResultado(p, { catalogos: d.catalogos, hoy: d.hoy, tarjetas: tarjetasAbiertas_(d) });
    if (v.error) throw new Error(v.error);
    t = v.tarjeta;
    if (opciones && opciones.motivo) v.fila.MOTIVO = opciones.motivo;
    var quedan = true;
    if (v.fila.TELEFONO) {
      var marca = { DNI: v.fila.DNI, RESULTADO: 'NÚMERO EQUIVOCADO', TELEFONO: v.fila.TELEFONO, FECHA_HORA: fechaHoraTexto_(ahora) };
      quedan = (telefonosPorDni(d.indicacionesTodas, d.contactos, frescos.concat([marca]))[v.fila.DNI] || []).length > 0 || !!t.USUARIO;
    }
    var registro = null;
    if (v.fila.RESULTADO === 'ACEPTÓ') {
      exigirColumnas_('REGISTROS', COLUMNAS_REGISTROS);
      if (t.ID_REGISTRO) {
        actualizarCeldas_('REGISTROS', t.ID_REGISTRO, { FECHA_INICIO: v.fila.FECHA_PROXIMA });
      } else {
        var ids = d.registros.map(function (x) { return x.ID; });
        var hierro = normTexto(t.ESPECIALIDAD) === 'HIERRO';
        registro = { ID: siguienteId(ids, 'REG'), FECHA_HORA: fechaHoraTexto_(ahora), FECHA: d.hoy, ASESORA: v.fila.RESPONSABLE, DOCTOR: '',
          NOMBRE: textoLimpio_(t.NOMBRE).toUpperCase(), DNI: v.fila.DNI, CONTACTO: String(t.TELEFONOS || '').split(' / ')[0] || '',
          TIPO: hierro ? 'HIERRO' : 'PROCEDIMIENTO', DETALLE: hierro ? 'HIERRO CARBOXIMALTOSA' : textoLimpio_(t.DETALLE).replace(/ ×\d+$/, ''),
          MARCA: hierro ? 'FERINJECT' : '', SESIONES: Number(p.sesiones) || 1, ANULADO: '', MOTIVO_ANULACION: '',
          FECHA_INICIO: v.fila.FECHA_PROXIMA, EXAMENES: '', FECHA_RETORNO: '', EDITADO: '' };
        anexarObjeto_('REGISTROS', COLUMNAS_REGISTROS, registro);
        bitacora_(registro.ASESORA, 'REGISTRO', registro.ID + ' · ' + registro.DNI + ' · aceptó la cotización del historial');
        v.fila.NOTA = unirNota_('Registro ' + registro.ID, v.fila.NOTA);
      }
    }
    s = copia_(v.fila, { ID: 'SEG-' + ahora.getTime() + '-' + Math.floor(Math.random() * 1000), FECHA_HORA: fechaHoraTexto_(ahora),
      ACCION: accionPara(v.fila.RESULTADO, quedan) });
    anexarObjeto_('SEGUIMIENTOS', COLUMNAS_SEGUIMIENTOS, s);
    bitacora_(s.RESPONSABLE, 'RESULTADO', s.DNI + ' · ' + s.ESPECIALIDAD + ' · ' + s.RESULTADO + (s.REFERENCIA ? ' · ' + s.REFERENCIA : ''));
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
  derivar_(d);
  var clave = registro ? registro.ID : claveTarjeta(t), tab = armarTablero(d), nueva = null;
  Object.keys(tab.columnas).forEach(function (c) {
    tab.columnas[c].forEach(function (x) { if (x.CLAVE === clave && !nueva) nueva = x; });
  });
  return limpiarParaEnvio({ ok: true, seguimiento: s, registro: registro, tarjeta: nueva });
}

function anularResultado(p) {
  var d = datos_(), quien = exigirUsuario_(d.catalogos, p && p.usuario), motivo = exigirMotivo_(p), id = textoLimpio_(p.id);
  if (id.indexOf('SEG-') !== 0) throw new Error('Aquí solo se anulan resultados de seguimiento (SEG-…).');
  var lock = bloquear_();
  try {
    exigirHojaPreparada_();
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
