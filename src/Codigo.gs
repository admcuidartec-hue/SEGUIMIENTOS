/* ==========================================================================
   CAPA DE DATOS Y FUNCIONES QUE LLAMA LA APP

   Este es el único archivo que lee y escribe el Sheets para la app. La lógica
   de negocio está en Logica.gs; aquí solo se traducen celdas a objetos y
   objetos a celdas.
   ========================================================================== */

var CONFIG = {
  SS_ID: '1L8fY-NXWE1agakIPEdqoLnLry0-lvYr0Z-9JfsfGxRM',
  HIERRO_ID: '1FrJ9oXyeHLLABqLcSA2VyXry-x_ZeFow6LsSACeJw8o',
  HOJA_SOFDOC: 'Hoja 1',
  CRM_ID: '1dofPqkj644Y0kfYYpX2WG9g8JlHYFai8nk--CzFtbsM',
  HOJA_CRM: 'LEADS',
  ESPERA_LOCK_MS: 30000
};

var COLUMNAS_SEGUIMIENTOS = ['ID', 'FECHA_HORA', 'DNI', 'ESPECIALIDAD', 'RESPONSABLE', 'ACCION', 'MOTIVO', 'NOTA', 'REFERENCIA'];
var COLUMNAS_BITACORA = ['FECHA_HORA', 'USUARIO', 'ACCION', 'DETALLE'];

/** Columnas que se guardan como fecha (a mediodía) o fecha y hora. */
var COLUMNAS_FECHA = { FECHA: 1, PRIMERA_CITA: 1, ULTIMA_CITA: 1, PROXIMA_ESPERADA: 1, VENCE: 1, PROXIMA_AGENDADA: 1, ULTIMO_SEGUIMIENTO: 1 };
var COLUMNAS_FECHA_HORA = { FECHA_HORA: 1 };
/** El resto se guarda como texto plano, para que Sheets no convierta '2026-07' ni DNI en otra cosa. */
var COLUMNAS_NUMERICAS = { N_REALIZADAS: 1, DIAS_ATRASO: 1, N_SEGUIMIENTOS: 1, CANTIDAD: 1, PAGO: 1, SESIONES: 1, NUMERO: 1 };

/* Vive lo que dura una petición: Apps Script arranca un proceso por llamada. */
var MEMO = {};

function ss_() {
  if (!MEMO.ss) MEMO.ss = SpreadsheetApp.openById(CONFIG.SS_ID);
  return MEMO.ss;
}

function tz_() {
  if (!MEMO.tz) MEMO.tz = ss_().getSpreadsheetTimeZone() || 'America/Lima';
  return MEMO.tz;
}

function mismaZona_() {
  if (MEMO.mismaZona === undefined) MEMO.mismaZona = (tz_() === Session.getScriptTimeZone());
  return MEMO.mismaZona;
}

function dos_(n) { return n < 10 ? '0' + n : String(n); }

/** Date -> 'yyyy-MM-dd'. Aritmética si las zonas coinciden (formatDate cuesta ~1 ms por llamada). */
function fechaTexto_(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return '';
  if (mismaZona_()) return d.getFullYear() + '-' + dos_(d.getMonth() + 1) + '-' + dos_(d.getDate());
  return Utilities.formatDate(d, tz_(), 'yyyy-MM-dd');
}

function fechaHoraTexto_(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return '';
  if (mismaZona_()) return fechaTexto_(d) + ' ' + dos_(d.getHours()) + ':' + dos_(d.getMinutes());
  return Utilities.formatDate(d, tz_(), 'yyyy-MM-dd HH:mm');
}

function hoy_() {
  return fechaTexto_(new Date());
}

/**
 * 'yyyy-MM-dd' -> Date a MEDIODÍA; 'yyyy-MM-dd HH:mm' -> esa hora.
 * A mediodía porque entre la zona del archivo y la del motor puede haber
 * horas de diferencia, y una fecha a las 00:00 se guardaría como el día anterior.
 */
function aFecha_(texto) {
  var m = String(texto || '').match(/^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?/);
  if (!m) return '';
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), m[4] ? Number(m[4]) : 12, m[5] ? Number(m[5]) : 0, 0);
}

function hoja_(nombre) {
  var sh = ss_().getSheetByName(nombre);
  if (!sh) throw new Error('Falta la hoja "' + nombre + '". Use el menú Seguimientos → Preparar hojas.');
  return sh;
}

function celdaATexto_(v, columna) {
  if (v instanceof Date) {
    return (COLUMNAS_FECHA_HORA[columna] || columna === 'FECHA_REGISTRO') ? fechaHoraTexto_(v) : fechaTexto_(v);
  }
  return v === null || v === undefined ? '' : String(v);
}

function celdaParaHoja_(v, columna) {
  if (v === undefined || v === null) return '';
  if (COLUMNAS_FECHA[columna] || COLUMNAS_FECHA_HORA[columna]) return aFecha_(v);
  if (typeof v === 'number') return isFinite(v) ? v : '';
  return textoSeguro(v);
}

/** Una hoja con encabezado en la fila 1 -> objetos { COLUMNA: texto }. Las filas vacías se saltan. */
function leerObjetos_(nombre) {
  var sh = hoja_(nombre), alto = sh.getLastRow(), ancho = sh.getLastColumn();
  if (alto < 2 || ancho < 1) return [];
  var datos = sh.getRange(1, 1, alto, ancho).getValues();
  var cab = datos[0].map(function (c) { return String(c).trim(); });
  return datos.slice(1)
    .filter(function (f) { return f.some(function (c) { return c !== '' && c !== null; }); })
    .map(function (f) {
      var o = {};
      cab.forEach(function (c, i) { if (c) o[c] = celdaATexto_(f[i], c); });
      return o;
    });
}

function aplicarFormatos_(sh, columnas, alto) {
  columnas.forEach(function (c, i) {
    var r = sh.getRange(1, i + 1, Math.max(alto, 2), 1);
    if (COLUMNAS_FECHA[c]) r.setNumberFormat('yyyy-mm-dd');
    else if (COLUMNAS_FECHA_HORA[c]) r.setNumberFormat('yyyy-mm-dd hh:mm');
    else if (!COLUMNAS_NUMERICAS[c]) r.setNumberFormat('@');
  });
}

/** Reescribe la hoja entera. Solo para hojas que genera el script (CITAS, PACIENTES, INDICACIONES en la importación). */
function escribirObjetos_(nombre, columnas, objetos) {
  var sh = hoja_(nombre);
  var filas = [columnas].concat(objetos.map(function (o) {
    return columnas.map(function (c) { return celdaParaHoja_(o[c], c); });
  }));
  sh.clearContents();
  aplicarFormatos_(sh, columnas, filas.length);
  sh.getRange(1, 1, filas.length, columnas.length).setValues(filas);
  SpreadsheetApp.flush();
}

function anexarObjeto_(nombre, columnas, objeto) {
  hoja_(nombre).appendRow(columnas.map(function (c) { return celdaParaHoja_(objeto[c], c); }));
}

function bitacora_(usuario, accion, detalle) {
  anexarObjeto_('BITACORA', COLUMNAS_BITACORA, {
    FECHA_HORA: fechaHoraTexto_(new Date()), USUARIO: usuario, ACCION: accion, DETALLE: detalle
  });
}

function bloquear_() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(CONFIG.ESPERA_LOCK_MS)) throw new Error('Otra persona está guardando. Intente de nuevo en unos segundos.');
  return lock;
}

function tablaCruda_(nombre) {
  var sh = ss_().getSheetByName(nombre);
  if (!sh || sh.getLastRow() < 1) return { encabezado: [], filas: [] };
  var v = sh.getDataRange().getValues();
  return { encabezado: v[0], filas: v.slice(1) };
}

function reglas_() {
  var t = tablaCruda_('REGLAS');
  return reglasDesdeFilas(t.encabezado, t.filas);
}

function catalogos_() {
  var t = tablaCruda_('CATALOGOS');
  return catalogosDesdeFilas(t.encabezado, t.filas);
}

function leerCitas_() {
  var citas = leerObjetos_('CITAS');
  citas.forEach(function (c) { c.DNI = normDni(c.DNI); });
  return citas;
}

function leerIndicaciones_() {
  var inds = leerObjetos_('INDICACIONES');
  inds.forEach(function (i) {
    i.DNI = normDni(i.DNI);
    i.TIPO = normTexto(i.TIPO);
    i.ESTADO = normalizarEstadoIndicacion(i.ESTADO);
  });
  return inds;
}

function leerSeguimientos_() {
  var segs = leerObjetos_('SEGUIMIENTOS');
  segs.forEach(function (s) { s.DNI = normDni(s.DNI); });
  return segs;
}

/** CONTACTOS_CRM puede no existir todavía (antes de la primera actualización con CRM). */
function leerContactos_() {
  if (!ss_().getSheetByName('CONTACTOS_CRM')) return [];
  var cs = leerObjetos_('CONTACTOS_CRM');
  cs.forEach(function (c) { c.DNI = normDni(c.DNI); c.DNI_PACIENTE = normDni(c.DNI_PACIENTE); });
  return cs;
}

/** Una hoja que puede no existir todavía (antes de «Preparar hojas»): vacía en vez de error. */
function leerOpcional_(nombre) {
  return ss_().getSheetByName(nombre) ? leerObjetos_(nombre) : [];
}

function leerRegistros_() {
  var r = leerOpcional_('REGISTROS');
  r.forEach(function (x) { x.DNI = normDni(x.DNI); x.TIPO = normTexto(x.TIPO); });
  return r;
}

function leerSesiones_() {
  return leerOpcional_('SESIONES');
}

function leerAltas_() {
  var a = leerOpcional_('ALTAS');
  a.forEach(function (x) { x.DNI = normDni(x.DNI); });
  return a;
}

/** Todo lo que necesita la app, leído una vez por petición. */
function datos_() {
  if (MEMO.datos) return MEMO.datos;
  var d = {
    hoy: hoy_(),
    reglas: reglas_(),
    catalogos: catalogos_(),
    citas: leerCitas_(),
    indicaciones: leerIndicaciones_(),
    seguimientos: leerSeguimientos_(),
    contactos: leerContactos_(),
    registros: leerRegistros_(),
    sesiones: leerSesiones_(),
    altas: leerAltas_()
  };
  // Historial (INDICACIONES) + Registro: lo que cuenta en cifras, teléfonos y pendientes.
  d.indicacionesTodas = d.indicaciones.concat(indicacionesDeRegistros(d.registros, d.sesiones, d.catalogos, d.reglas, d.hoy));
  d.vigentes = altasVigentes(d.altas, d.seguimientos, d.citas);
  d.pacientes = armarPacientes(d.citas, d.indicacionesTodas, d.seguimientos, d.reglas, d.hoy, d.contactos, d.vigentes);
  d.pendientes = pendientesIndicacion(d.citas, d.indicacionesTodas, d.seguimientos, d.reglas, d.hoy, d.contactos)
    .concat(pendientesRegistro({ registros: d.registros, sesiones: d.sesiones, seguimientos: d.seguimientos, citas: d.citas,
      reglas: d.reglas, hoy: d.hoy, telefonos: telefonosPorDni(d.indicacionesTodas, d.contactos), catalogos: d.catalogos }));
  MEMO.datos = d;
  return d;
}

/* ==========================================================================
   PUNTO DE ENTRADA WEB Y FUNCIONES QUE LLAMA LA APP
   ========================================================================== */

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Seguimientos — Centro Hematológico del Perú')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function bootstrap() {
  var d = datos_(), esp = {}, med = {};
  d.pacientes.forEach(function (p) {
    if (p.ESPECIALIDAD) esp[p.ESPECIALIDAD] = 1;
    if (p.MEDICO_ULTIMO) med[p.MEDICO_ULTIMO] = 1;
  });
  d.pendientes.forEach(function (p) {
    if (p.ESPECIALIDAD_CONSULTA) esp[p.ESPECIALIDAD_CONSULTA] = 1;
    if (p.MEDICO_ULTIMO) med[p.MEDICO_ULTIMO] = 1;
  });
  return limpiarParaEnvio({
    hoy: d.hoy,
    usuarios: d.catalogos.usuarios,
    motivos: d.catalogos.motivos,
    especialidades: Object.keys(esp).sort(),
    medicos: Object.keys(med).sort(),
    doctores: d.catalogos.doctores,
    procedimientos: d.catalogos.procedimientos,
    tratamientos: d.catalogos.tratamientos,
    marcas: d.catalogos.marcas
  });
}

function getBandeja() {
  var d = datos_();
  var tarjetas = ordenarBandeja(d.pacientes, d.pendientes);
  var mes = mesDe(d.hoy);
  var hechosHoy = d.seguimientos.filter(function (s) {
    return fechaIso(s.FECHA_HORA) === d.hoy && normTexto(s.ACCION) === 'HECHO';
  }).length;
  var recuperadosMes = kpiRecuperacion(d.seguimientos, d.citas, d.hoy).filter(function (r) {
    return r.VOLVIO && mesDe(r.FECHA_RETORNO) === mes;
  }).length;
  return limpiarParaEnvio({
    tarjetas: tarjetas,
    contador: { porAtender: tarjetas.length, hechosHoy: hechosHoy, recuperadosMes: recuperadosMes }
  });
}

function getPaciente(dni) {
  var d = datos_(), k = normDni(dni);
  var series = d.pacientes.filter(function (p) { return p.DNI === k; });
  var citas = d.citas.filter(function (c) { return c.DNI === k; }).sort(porFecha);
  var indice = construirIndiceNombres(d.citas);
  var porConfirmar = d.indicaciones
    .filter(function (i) { return normTexto(i.EMPAREJAMIENTO) === 'POR CONFIRMAR'; })
    .map(function (i) {
      return { ID: i.ID, FECHA: i.FECHA, TIPO: i.TIPO, DETALLE: i.DETALLE, NOMBRE: i.NOMBRE, TELEFONO: i.TELEFONO,
        candidatos: emparejar(i.NOMBRE, indice).candidatos };
    })
    .filter(function (i) { return i.candidatos.some(function (c) { return c.dni === k; }); });
  var ultima = citas[citas.length - 1];
  return limpiarParaEnvio({
    dni: k,
    nombre: series.length ? series[0].NOMBRE : (ultima ? ultima.NOMBRE : ''),
    series: series,
    citas: citas,
    indicaciones: d.indicaciones.filter(function (i) { return i.DNI === k; }),
    porConfirmar: porConfirmar,
    seguimientos: d.seguimientos.filter(function (s) { return s.DNI === k; }),
    registros: d.registros.filter(function (r) { return r.DNI === k; }).map(function (r) {
      var e = estadoRegistro(r, d.sesiones);
      return { ID: r.ID, FECHA: fechaIso(r.FECHA), TIPO: r.TIPO, TEXTO: textoRegistro(r), DOCTOR: r.DOCTOR, ASESORA: r.ASESORA,
        SESIONES: e.total, ESTADO: e.estado, MOTIVO_ANULACION: r.MOTIVO_ANULACION || '',
        sesiones: sesionesDe_(r.ID, d.sesiones).map(function (s) {
          return { ID: s.ID, NUMERO: Number(s.NUMERO), FECHA: fechaIso(s.FECHA), ASESORA: s.ASESORA };
        }) };
    }),
    altas: d.altas.filter(function (a) { return a.DNI === k; }).map(function (a) {
      var v = d.vigentes[claveSerie(k, a.ESPECIALIDAD)];
      return { ID: a.ID, FECHA: fechaIso(a.FECHA), ESPECIALIDAD: a.ESPECIALIDAD, DOCTOR: a.DOCTOR, REGISTRADO_POR: a.REGISTRADO_POR,
        ANULADO: anulado_(a), MOTIVO_ANULACION: a.MOTIVO_ANULACION || '', VIGENTE: !!(v && v.ID === a.ID) };
    })
  });
}

function buscar(texto) {
  var q = normTexto(texto);
  if (q.length < 3) return [];
  var qDni = normDni(texto), porDni = /\d/.test(qDni);
  var d = datos_(), vistos = {}, out = [];
  for (var i = d.citas.length - 1; i >= 0 && out.length < 20; i--) {
    var c = d.citas[i];
    if (vistos[c.DNI]) continue;
    if ((porDni && c.DNI.indexOf(qDni) === 0) || normTexto(c.NOMBRE).indexOf(q) >= 0) {
      vistos[c.DNI] = 1;
      out.push({ DNI: c.DNI, NOMBRE: c.NOMBRE });
    }
  }
  return limpiarParaEnvio(out);
}

function registrar_(p, accion) {
  var d = datos_();
  var error = validarAccion(p, d.catalogos, accion, d.pacientes.concat(d.pendientes));
  if (error) throw new Error(error);
  var lock = bloquear_();
  try {
    var ahora = new Date();
    var s = {
      ID: 'SEG-' + ahora.getTime() + '-' + Math.floor(Math.random() * 1000),
      FECHA_HORA: fechaHoraTexto_(ahora),
      DNI: normDni(p.dni),
      ESPECIALIDAD: String(p.especialidad).trim(),
      RESPONSABLE: String(p.usuario).trim(),
      ACCION: accion,
      MOTIVO: accion === 'DESCARTADO' ? String(p.motivo).trim() : '',
      NOTA: String(p.nota || '').trim(),
      REFERENCIA: textoLimpio_(p.referencia)
    };
    anexarObjeto_('SEGUIMIENTOS', COLUMNAS_SEGUIMIENTOS, s);
    bitacora_(s.RESPONSABLE, accion === 'HECHO' ? 'SEGUIMIENTO' : 'DESCARTE', s.DNI + ' · ' + s.ESPECIALIDAD + (s.REFERENCIA ? ' · ' + s.REFERENCIA : ''));
    return limpiarParaEnvio({ ok: true, seguimiento: s });
  } finally {
    lock.releaseLock();
  }
}

function marcarSeguimiento(p) { return registrar_(p, 'HECHO'); }

function descartar(p) { return registrar_(p, 'DESCARTADO'); }

function confirmarEmparejamiento(p) {
  var d = datos_();
  if (!p || d.catalogos.usuarios.map(normTexto).indexOf(normTexto(p.usuario)) < 0) {
    throw new Error('Elija quién es usted en el selector de arriba.');
  }
  var dni = normDni(p.dni);
  if (!dni) throw new Error('Falta el DNI.');
  var lock = bloquear_();
  try {
    var sh = hoja_('INDICACIONES'), datos = sh.getDataRange().getValues();
    var cab = datos[0].map(function (c) { return String(c).trim(); });
    var cDni = cab.indexOf('DNI'), cEm = cab.indexOf('EMPAREJAMIENTO');
    var r = buscarFilaParaConfirmar(datos[0], datos.slice(1), p.id, dni, construirIndiceNombres(d.citas));
    if (r.error) throw new Error(r.error);
    sh.getRange(r.fila + 2, cDni + 1).setNumberFormat('@').setValue(dni);
    sh.getRange(r.fila + 2, cEm + 1).setValue('CONFIRMADO');
    bitacora_(String(p.usuario).trim(), 'EMPAREJAMIENTO', p.id + ' → ' + dni);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function getKpi() {
  var d = datos_();
  var kpi = calcularKpi(d.citas, d.indicacionesTodas, d.seguimientos, d.reglas, d.hoy, d.contactos, d.vigentes);
  kpi.meta = d.reglas.metaRetorno;
  return limpiarParaEnvio(kpi);
}

/** Pantalla «Resumen»: filas por mes y médico; la app suma según el filtro elegido. */
function getResumen() {
  var d = datos_();
  var filas = resumenPorMes(d.citas, d.indicacionesTodas, d.seguimientos, d.reglas, d.hoy, d.vigentes);
  var medicos = {};
  filas.forEach(function (f) { if (f.MEDICO !== 'SIN MÉDICO') medicos[f.MEDICO] = 1; });
  return limpiarParaEnvio({ hoy: d.hoy, filas: filas, medicos: Object.keys(medicos).sort(), meta: d.reglas.metaRetorno });
}
