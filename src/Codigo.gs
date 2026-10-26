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

var COLUMNAS_SEGUIMIENTOS = ['ID', 'FECHA_HORA', 'DNI', 'ESPECIALIDAD', 'RESPONSABLE', 'ACCION', 'MOTIVO', 'NOTA', 'REFERENCIA',
  'RESULTADO', 'FECHA_PROXIMA', 'TELEFONO', 'ANULADO', 'MOTIVO_ANULACION'];
var COLUMNAS_BITACORA = ['FECHA_HORA', 'USUARIO', 'ACCION', 'DETALLE'];

/** Columnas que se guardan como fecha (a mediodía) o fecha y hora. */
var COLUMNAS_FECHA = { FECHA: 1, PRIMERA_CITA: 1, ULTIMA_CITA: 1, PROXIMA_ESPERADA: 1, VENCE: 1, PROXIMA_AGENDADA: 1, ULTIMO_SEGUIMIENTO: 1,
  FECHA_PROXIMA: 1, FECHA_AGENDA: 1, FECHA_CIERRE: 1,
  FECHA_INICIO: 1, FECHA_RETORNO: 1 };
var COLUMNAS_FECHA_HORA = { FECHA_HORA: 1 };
/** El resto se guarda como texto plano, para que Sheets no convierta '2026-07' ni DNI en otra cosa. */
var COLUMNAS_NUMERICAS = { N_REALIZADAS: 1, DIAS_ATRASO: 1, N_SEGUIMIENTOS: 1, CANTIDAD: 1, PAGO: 1, SESIONES: 1, NUMERO: 1, INTENTO: 1 };

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

/** Encabezado de la fila 1 sin las celdas vacías del final. */
function encabezado_(sh) {
  var cab = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(function (c) { return String(c).trim(); });
  while (cab.length && !cab[cab.length - 1]) cab.pop();
  return cab;
}

/** La fila 1 tal como está escrita (sin recortar: «Verificar» avisa de « FECHA »), sin las celdas vacías del final. */
function encabezadoCrudo_(sh) {
  var cab = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(function (c) { return c === null || c === undefined ? '' : String(c); });
  while (cab.length && !cab[cab.length - 1].trim()) cab.pop();
  return cab;
}

/** El encabezado crudo de `nombre`, leído una vez por petición (anexarObjeto_ escribe por nombre y lo necesita en cada fila). */
function columnasDeHoja_(nombre) {
  MEMO.cab = MEMO.cab || {};
  if (!MEMO.cab[nombre]) MEMO.cab[nombre] = encabezadoCrudo_(hoja_(nombre));
  return MEMO.cab[nombre];
}

/** Una hoja que se escribe por posición solo se amplía al final, y solo si lo que ya tiene coincide. */
function encabezadoAmpliable(cab, columnas) {
  for (var i = 0; i < cab.length; i++) {
    if (cab[i] !== columnas[i]) {
      return { error: 'el encabezado no coincide en la columna ' + (i + 1) + ' («' + cab[i] + '», se esperaba «' + (columnas[i] || '') + '»).', agregar: [] };
    }
  }
  return { error: '', agregar: columnas.slice(cab.length) };
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
  // Por nombre normalizado: «fecha», « FECHA » y «Fécha» son FECHA (caso 49); si una columna está dos veces, vale la primera.
  var cab = datos[0].map(normColumna);
  return datos.slice(1)
    .filter(function (f) { return f.some(function (c) { return c !== '' && c !== null; }); })
    .map(function (f) {
      var o = {};
      cab.forEach(function (c, i) { if (c && !(c in o)) o[c] = celdaATexto_(f[i], c); });
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

/**
 * Agrega una fila POR NOMBRE de columna (caso 50): cada valor va bajo la columna que se llama así en la fila 1, esté donde esté y
 * escrita como esté («fecha» = FECHA). Si falta una columna o está repetida, se niega sin escribir (errorEncabezado); una columna
 * que la app no conoce queda vacía. Nunca deja un valor bajo otro encabezado.
 */
function anexarObjeto_(nombre, columnas, objeto) {
  var cab = columnasDeHoja_(nombre), rev = revisarEncabezado(cab, columnas), error = errorEncabezado(nombre, rev);
  if (error) throw new Error(error);
  var nuestras = {};
  columnas.forEach(function (c) { nuestras[normColumna(c)] = c; });
  hoja_(nombre).appendRow(cab.map(function (c, j) {
    var k = nuestras[normColumna(c)];
    return k && rev.posicion[normColumna(c)] === j ? celdaParaHoja_(objeto[k], k) : '';
  }));
}

/**
 * Una línea de BITACORA. Se escribe DESPUÉS de lo que registra: si falla, lo registrado ya está guardado y no se deshace
 * (decidido el 23/10/2026: decir «No se guardó» habiendo guardado hacía que la asesora lo repitiera). Por eso no lanza:
 * deja el error en MEMO.avisos y la respuesta lo trae en `aviso` (avisos_). `op`, el identificador de la operación (opDe_).
 */
function bitacora_(usuario, accion, detalle, op) {
  try {
    anexarObjeto_('BITACORA', conOp_('BITACORA', COLUMNAS_BITACORA), {
      FECHA_HORA: fechaHoraTexto_(new Date()), USUARIO: usuario, ACCION: accion, DETALLE: detalle, OP: op || ''
    });
  } catch (e) {
    (MEMO.avisos = MEMO.avisos || []).push('Se guardó, pero no se pudo escribir la BITACORA: ' + (e && e.message || e));
  }
}

/** La respuesta con `aviso` si algo secundario falló después de guardar (p. ej. la BITACORA). */
function avisos_(out) {
  if (MEMO.avisos && MEMO.avisos.length && out && typeof out === 'object') out.aviso = MEMO.avisos.join(' ');
  return out;
}

/**
 * Una escritura de varias filas falló a mitad: se deshace lo escrito en ESTA llamada (las funciones de `deshacer`, de la última a
 * la primera: anulan la fila o devuelven la celda a su valor) y se lanza el error, para que la app diga «No se guardó» sin que
 * quede nada a medias. Si deshacer también falla, el mensaje lo dice: quedaría algo que anular a mano.
 */
function deshacerEscritura_(deshacer, err) {
  var fallos = [];
  (deshacer || []).slice().reverse().forEach(function (f) { try { f(); } catch (e) { fallos.push(e && e.message || String(e)); } });
  var m = (err && err.message) || String(err);
  throw new Error(m + (fallos.length ? ' Además no se pudo deshacer todo (' + fallos.join('; ') + '): revise Registrados y anule lo que haya quedado.'
    : ' No quedó nada guardado: se deshizo lo escrito.'));
}

/* ---------- Idempotencia: el identificador de operación (op) ---------- */

/*
 * Cada acción que escribe lleva un `op` generado en la app; al reintentar lo mismo (p. ej. tras perderse la respuesta) la app
 * manda el mismo op y el servidor devuelve lo de la primera vez sin escribir otra vez. Se guarda en la columna OP, al final de
 * SEGUIMIENTOS, SESIONES, REGISTROS, ALTAS, ENFERMERIA y BITACORA (la agrega «Preparar hojas»). Sin esa columna, se escribe
 * como antes, sin idempotencia: nunca se niega a escribir por eso.
 */
var COLUMNA_OP = 'OP';

/** El op de la petición: letras, números, punto, guion o guion bajo (6 a 80); si no, '' (sin idempotencia). */
function opDe_(p) {
  var o = String((p && p.op) || '').trim();
  return /^[A-Za-z0-9._\-]{6,80}$/.test(o) ? o : '';
}

/** Las columnas con que se escribe `nombre`: con OP al final si la hoja ya la tiene; si no (o no se puede saber), sin ella. */
function conOp_(nombre, columnas) {
  MEMO.conOp = MEMO.conOp || {};
  if (!(nombre in MEMO.conOp)) {
    var tiene = false;
    // Por nombre: la OP puede estar en otro lugar o escrita en minúscula (anexarObjeto_ escribe por nombre).
    try { tiene = columnasDeHoja_(nombre).map(normColumna).indexOf(COLUMNA_OP) >= 0; } catch (e) { tiene = false; }
    MEMO.conOp[nombre] = tiene;
  }
  return MEMO.conOp[nombre] ? columnas.concat([COLUMNA_OP]) : columnas;
}

/** Las filas sin anular de `filas` escritas con ese op (o con op + '#n', las de una operación de varias filas). */
function filasDeOp_(filas, op) {
  if (!op) return [];
  return (filas || []).filter(function (f) {
    var o = String(f.OP || '').trim();
    return !anulado_(f) && (o === op || o.indexOf(op + '#') === 0);
  });
}

/** ¿Ya se registró una anulación con este op? (BITACORA): el reintento de una anulación que ya se hizo vale como hecha. */
function anulacionHecha_(op) {
  if (!op) return false;
  return leerOpcional_('BITACORA').some(function (b) { return String(b.OP || '').trim() === op; });
}

/** Confirma lo escrito y suelta el candado. Sin flush, la siguiente asesora podría leer los IDs antes de que se guarden. */
function soltar_(lock) {
  try { SpreadsheetApp.flush(); } finally { lock.releaseLock(); }
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
  // Una cita sin fecha válida (escrita a mano: «mañana») no se puede ubicar: se ignora (caso 60).
  var citas = fechas_(leerObjetos_('CITAS')).filter(function (c) { return c.FECHA; });
  citas.forEach(function (c) { c.DNI = normDni(c.DNI); });
  return citas;
}

function leerIndicaciones_() {
  var inds = fechas_(leerObjetos_('INDICACIONES'));
  inds.forEach(function (i) {
    i.DNI = normDni(i.DNI);
    i.TIPO = normTexto(i.TIPO);
    i.ESTADO = normalizarEstadoIndicacion(i.ESTADO);
  });
  return inds;
}

function leerSeguimientos_() {
  var segs = fechas_(leerObjetos_('SEGUIMIENTOS'));
  segs.forEach(function (s) { s.DNI = normDni(s.DNI); });
  return segs;
}

/** CONTACTOS_CRM puede no existir todavía (antes de la primera actualización con CRM). */
function leerContactos_() {
  if (!ss_().getSheetByName('CONTACTOS_CRM')) return [];
  var cs = fechas_(leerObjetos_('CONTACTOS_CRM'));
  cs.forEach(function (c) { c.DNI = normDni(c.DNI); c.DNI_PACIENTE = normDni(c.DNI_PACIENTE); });
  return cs;
}

/** Toda fecha leída de una hoja pasa por fechaIso: lo escrito a mano que no es una fecha queda vacío (normalizarFechas). */
function fechas_(filas) {
  return normalizarFechas(filas, COLUMNAS_FECHA, COLUMNAS_FECHA_HORA);
}

/** Una hoja que puede no existir todavía (antes de «Preparar hojas»): vacía en vez de error. */
function leerOpcional_(nombre) {
  return ss_().getSheetByName(nombre) ? leerObjetos_(nombre) : [];
}

function leerRegistros_() {
  var r = fechas_(leerOpcional_('REGISTROS'));
  r.forEach(function (x) { x.DNI = normDni(x.DNI); x.TIPO = normTexto(x.TIPO); });
  return r;
}

function leerSesiones_() {
  return fechas_(leerOpcional_('SESIONES'));
}

function leerAltas_() {
  var a = fechas_(leerOpcional_('ALTAS'));
  a.forEach(function (x) { x.DNI = normDni(x.DNI); });
  return a;
}

/** Todo lo que necesita la app, leído una vez por petición. */
function datos_() {
  if (MEMO.datos) return MEMO.datos;
  var todos = leerSeguimientos_();
  MEMO.datos = derivar_({
    hoy: hoy_(),
    reglas: reglas_(),
    catalogos: catalogos_(),
    citas: leerCitas_(),
    indicaciones: leerIndicaciones_(),
    // Las anuladas solo se muestran en la historia; ninguna cifra las cuenta.
    seguimientosTodos: todos,
    seguimientos: todos.filter(function (s) { return !anulado_(s); }),
    contactos: leerContactos_(),
    registros: leerRegistros_(),
    sesiones: leerSesiones_(),
    altas: leerAltas_(),
    enfermeria: leerEnfermeria_()
  });
  return MEMO.datos;
}

/** Lo que se calcula a partir de lo leído. Se repite tras guardar, sin volver a leer las hojas. */
function derivar_(d) {
  // Historial (INDICACIONES) + Registro: lo que cuenta en cifras, teléfonos y pendientes.
  d.indicacionesTodas = d.indicaciones.concat(indicacionesDeRegistros(d.registros, d.sesiones, d.catalogos, d.reglas, d.hoy));
  d.vigentes = altasVigentes(d.altas, d.seguimientos, d.citas, d.reglas, d.hoy);
  d.retornos = decisionesDeAlta(d.altas, d.citas, d.reglas, d.hoy).retornos;
  d.telefonos = telefonosPorDni(d.indicacionesTodas, d.contactos, d.seguimientos);
  // El «@usuario» de Registro también es un contacto: «Número equivocado» no cierra mientras quede (sinContacto_).
  d.usuarios = usuariosPorDni(d.registros);
  // Las citas no cambian dentro de una petición: el índice médico → especialidades se arma una vez (pendientesRegistro).
  if (!d.espPorMedico) d.espPorMedico = indiceEspecialidadesMedico(d.citas);
  d.pacientes = armarPacientes(d.citas, d.indicacionesTodas, d.seguimientos, d.reglas, d.hoy, d.contactos, d.vigentes, d.retornos, d.usuarios);
  d.pendientes = pendientesIndicacion(d.citas, d.indicacionesTodas, d.seguimientos, d.reglas, d.hoy, d.contactos, d.usuarios)
    .concat(pendientesRegistro({ registros: d.registros, sesiones: d.sesiones, seguimientos: d.seguimientos, citas: d.citas,
      reglas: d.reglas, hoy: d.hoy, telefonos: d.telefonos, catalogos: d.catalogos, usuarios: d.usuarios, espPorMedico: d.espPorMedico,
      vigentes: d.vigentes }));
  // Lo aceptado que no se realizó (cerrado o «No vino» sin ninguna sesión) cuenta como no realizado en Indicadores.
  marcarNoRealizados(d.indicacionesTodas, d.pendientes, d.reglas, d.hoy);
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
    if (p.ESPECIALIDAD) esp[p.ESPECIALIDAD] = (esp[p.ESPECIALIDAD] || 0) + 1;
    if (p.MEDICO_ULTIMO) med[p.MEDICO_ULTIMO] = 1;
  });
  d.pendientes.forEach(function (p) {
    if (p.ESPECIALIDAD_CONSULTA) esp[p.ESPECIALIDAD_CONSULTA] = (esp[p.ESPECIALIDAD_CONSULTA] || 0) + 1;
    if (p.MEDICO_ULTIMO) med[p.MEDICO_ULTIMO] = 1;
  });
  return limpiarParaEnvio({
    hoy: d.hoy,
    usuarios: d.catalogos.usuarios,
    motivos: d.catalogos.motivos,
    resultados: ORDEN_RESULTADOS,
    // La misma especialidad con y sin tilde sale una vez, con la forma más usada (el filtro compara con normTexto).
    especialidades: formasMasFrecuentes(esp),
    medicos: Object.keys(med).sort(),
    doctores: d.catalogos.doctores,
    procedimientos: d.catalogos.procedimientos,
    tratamientos: d.catalogos.tratamientos,
    marcas: d.catalogos.marcas,
    reacciones: d.catalogos.reacciones,
    reglas: { espera: d.reglas.espera, maxSeguimientos: d.reglas.maxSeguimientos, graciaAgenda: d.reglas.graciaAgenda,
      diasEntreSesiones: d.reglas.diasEntreSesiones, esperaCotizacion: d.reglas.esperaCotizacion,
      metaRetorno: d.reglas.metaRetorno, metaTratamiento: d.reglas.metaTratamiento, metaDiaria: d.reglas.metaDiaria,
      diasEnfermeria: d.reglas.diasEnfermeria, corteEnfermeria: d.reglas.corteEnfermeria,
      postTratamiento: d.reglas.postTratamiento, controlLab: d.reglas.controlLab, avisoAltaControl: d.reglas.avisoAltaControl }
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
    nombre: series.length ? series[0].NOMBRE : (ultima ? ultima.NOMBRE : nombreSinConsultas_(d, k)),
    series: series,
    citas: citas,
    indicaciones: d.indicaciones.filter(function (i) { return i.DNI === k; }),
    porConfirmar: porConfirmar,
    seguimientos: d.seguimientosTodos.filter(function (s) { return s.DNI === k; }),
    registros: d.registros.filter(function (r) { return r.DNI === k; }).map(function (r) {
      var e = estadoRegistro(r, d.sesiones), f = cierreDeRegistroFicha_(d, r, e);
      // ESTADO_REGISTRO y las fechas pintan la línea de estado; NOMBRE…FECHA_RETORNO, el formulario de Editar (como filaRegistrada_).
      return { ID: r.ID, FECHA: fechaIso(r.FECHA), TIPO: normTexto(r.TIPO), TEXTO: textoRegistro(r), DOCTOR: r.DOCTOR, ASESORA: r.ASESORA,
        SESIONES: e.total, HECHAS: e.hechas, ESTADO: f.estado, ESTADO_REGISTRO: f.estado, MOTIVO_ANULACION: r.MOTIVO_ANULACION || '',
        CIERRE: f.cierre, FECHA_CIERRE: f.fechaCierre, NO_VINO: f.noVino, SIN_REEVALUACION: f.sinReevaluacion,
        NOMBRE: r.NOMBRE || '', CONTACTO: r.CONTACTO || '', DETALLE: r.DETALLE || '', MARCA: r.MARCA || '',
        FECHA_INICIO: fechaIso(r.FECHA_INICIO) || '', EXAMENES: r.EXAMENES || '', FECHA_RETORNO: fechaIso(r.FECHA_RETORNO) || '',
        sesiones: sesionesDe_(r.ID, d.sesiones).map(function (s) {
          return { ID: s.ID, NUMERO: Number(s.NUMERO), FECHA: fechaIso(s.FECHA), ASESORA: s.ASESORA };
        }) };
    }),
    // La decisión, su retorno, cuándo vuelve a «Por contactar» y el estado (vigente, pendiente, volvió…): altasParaFicha.
    altas: (function () {
      var suyas = d.altas.filter(function (a) { return a.DNI === k; });
      var ficha = altasParaFicha(suyas, citas, d.vigentes, d.reglas, d.hoy);
      return suyas.map(function (a, i) {
        var v = d.vigentes[claveSerie(k, a.ESPECIALIDAD)], f = ficha[i];
        return { ID: a.ID, FECHA: fechaIso(a.FECHA), ESPECIALIDAD: a.ESPECIALIDAD, DOCTOR: a.DOCTOR, REGISTRADO_POR: a.REGISTRADO_POR,
          ANULADO: anulado_(a), MOTIVO_ANULACION: a.MOTIVO_ANULACION || '', VIGENTE: !!(v && v.ID === a.ID),
          DECISION: f.DECISION, FECHA_RETORNO: f.FECHA_RETORNO, FECHA_AVISO: f.FECHA_AVISO, ESTADO_ALTA: f.ESTADO_ALTA, FECHA_VOLVIO: f.FECHA_VOLVIO };
      });
    })(),
    // Enfermería: contactos y reacciones de sus tratamientos (también las anuladas, que la ficha muestra tachadas).
    enfermeria: (d.enfermeria || []).filter(function (f) { return f.DNI === k; }).map(function (f) {
      return { ID: f.ID, FECHA_HORA: String(f.FECHA_HORA || ''), ID_REGISTRO: f.ID_REGISTRO, ID_SESION: f.ID_SESION, NUMERO_SESION: Number(f.NUMERO_SESION) || 0,
        DIA: Number(f.DIA) || 0, RESULTADO: normTexto(f.RESULTADO), REACCION_TIPO: normTexto(f.REACCION_TIPO), REACCION: textoLimpio_(f.REACCION),
        NOTA: textoLimpio_(f.NOTA), ENFERMERA: textoLimpio_(f.ENFERMERA), ANULADO: anulado_(f), MOTIVO_ANULACION: textoLimpio_(f.MOTIVO_ANULACION) };
    }),
    fallecido: fallecidos(d.seguimientos)[k] || null,
    telefonos: d.telefonos[k] || [],
    // Lo que no es un teléfono (p. ej. «@usuario» del registro): la ficha lo muestra como contacto.
    contactos: otrosContactos(d.registros, k),
    telefonosDescartados: telefonosDescartados(marcasTelefono(d.seguimientos), d.telefonos)[k] || []
  });
}

/**
 * Lo que la ficha dice de un registro sin terminar cuyo seguimiento se cerró («No desea realizarse», «Falleció»…): CERRADO, con el
 * motivo y la fecha, en vez de «Programado» o «Pendiente» y sin ofrecer «Lo hizo» (para corregir un cierre, primero se anula).
 * Un programado que no vino pasada la gracia sigue PROGRAMADO, con NO_VINO = su fecha. Lo calcula la tarjeta (pendientesRegistro).
 */
function cierreDeRegistroFicha_(d, r, e) {
  var out = { estado: e.estado, cierre: '', fechaCierre: '', noVino: '', sinReevaluacion: '' };
  var t = (d.pendientes || []).filter(function (x) { return x.ID_REGISTRO === r.ID; })[0];
  // Completo con alta definitiva posterior: la ficha dice «Sin reevaluación: alta definitiva del …» (caso 39).
  if (e.estado === 'COMPLETO' && t) out.sinReevaluacion = t.SIN_REEVALUACION || '';
  if (e.estado === 'ANULADO' || e.estado === 'COMPLETO' || normTexto(r.TIPO) === 'CONTROL') return out;
  if (!t) return out;
  if (t.ESTADO === 'CERRADO' || t.ESTADO === 'FALLECIDO') {
    out.estado = 'CERRADO';
    out.cierre = t.ESTADO === 'FALLECIDO' ? 'FALLECIÓ' : t.CIERRE;
    out.fechaCierre = t.ESTADO === 'FALLECIDO' ? (fallecidos(d.seguimientos)[normDni(r.DNI)] || {}).fecha || '' : t.FECHA_CIERRE;
  } else if (noRealizadoDeRegistro(t, d.reglas, d.hoy) === 'NO VINO') out.noVino = e.inicio;
  return out;
}

/**
 * Nombre de quien todavía no tiene consultas: el del registro sin anular más reciente y, si no hay, el de la indicación más reciente.
 * Sin esto, un paciente que solo vino por Registro abría una ficha sin nombre.
 */
function nombreSinConsultas_(d, k) {
  // Un registro anulado (p. ej. «paciente equivocado») no da el nombre.
  var masReciente = function (filas, cuando) {
    return filas.filter(function (x) { return x.DNI === k && !anulado_(x) && String(x.NOMBRE || '').trim(); })
      .sort(function (a, b) { var x = cuando(a), y = cuando(b); return x < y ? -1 : x > y ? 1 : 0; }).pop();
  };
  var r = masReciente(d.registros || [], function (x) { return fechaIso(x.FECHA) + ' ' + String(x.FECHA_HORA || ''); });
  if (r) return String(r.NOMBRE).trim();
  var i = masReciente(d.indicaciones || [], function (x) { return fechaIso(x.FECHA); });
  return i ? String(i.NOMBRE).trim() : '';
}

/** Todas las palabras en cualquier orden, o parte del DNI; también quien solo está en Registro o en el historial. */
function buscar(texto) {
  if (normTexto(texto).replace(/\s/g, '').length < 3) return [];
  var d = datos_();
  return limpiarParaEnvio(buscarEnPacientes(texto, { citas: d.citas, registros: d.registros, indicaciones: d.indicaciones }));
}

/**
 * Pone a mano el DNI de una indicación SIN CANDIDATO (Indicadores → «Procedimientos
 * sin paciente»). Así su teléfono y su cotización pasan al paciente. Solo se acepta
 * un DNI que ya esté en SOFDOC o en Registro.
 */
function asignarDniIndicacion(p) {
  var d = datos_();
  if (!p || d.catalogos.usuarios.map(normTexto).indexOf(normTexto(p.usuario)) < 0) {
    throw new Error('Elija quién es usted en el selector de arriba.');
  }
  var dni = normDni(p.dni);
  if (!dni) throw new Error('Escriba el DNI del paciente.');
  var conocidos = {};
  (d.citas || []).forEach(function (c) { if (c.DNI) conocidos[c.DNI] = 1; });
  (d.registros || []).forEach(function (r) { if (r.DNI && !anulado_(r)) conocidos[normDni(r.DNI)] = 1; });
  var lock = bloquear_();
  try {
    var sh = hoja_('INDICACIONES'), datos = sh.getDataRange().getValues();
    var cab = datos[0].map(normColumna);
    var r = buscarFilaParaAsignar(datos[0], datos.slice(1), p.id, dni, conocidos);
    if (r.error) throw new Error(r.error);
    sh.getRange(r.fila + 2, cab.indexOf('DNI') + 1).setNumberFormat('@').setValue(dni);
    sh.getRange(r.fila + 2, cab.indexOf('EMPAREJAMIENTO') + 1).setValue('CONFIRMADO');
    bitacora_(String(p.usuario).trim(), 'EMPAREJAMIENTO', textoLimpio_(p.id) + ' → ' + dni + ' (a mano)');
    return { ok: true, dni: dni };
  } finally {
    soltar_(lock);
  }
}

/** Envoltorios de la app anterior: «Hecho» es un «no contestó»; «Descartar» cierra con el motivo elegido. */
function marcarSeguimiento(p) { return registrarResultado(copia_(p || {}, { resultado: 'NO CONTESTÓ' })); }

function descartar(p) {
  var r = RESULTADOS[normTexto(p && p.motivo)];
  var cierre = r && r.grupo === 'CIERRE' && r.pide !== 'DOCTOR';
  var q = cierre ? { resultado: r.nombre, motivo: r.nombre }
    : { resultado: 'NO DESEA CONTINUAR', motivo: textoLimpio_(p && p.motivo) || 'OTRO' };
  // El motivo original de la pestaña vieja se conserva en MOTIVO (no el genérico) para no sesgar «Motivos de descarte».
  return registrarResultado_(copia_(p || {}, q), cierre ? null : { motivo: q.motivo });
}

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
    var cab = datos[0].map(normColumna);
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
  var filas = resumenConEnfermeria(resumenPorMes(d.citas, d.indicacionesTodas, d.seguimientos, d.reglas, d.hoy, d.vigentes),
    cifrasEnfermeria({ registros: d.registros, sesiones: d.sesiones, enfermeria: d.enfermeria || [], hoy: d.hoy, reglas: d.reglas, catalogos: d.catalogos }));
  var medicos = {};
  filas.forEach(function (f) { if (f.MEDICO !== 'SIN MÉDICO') medicos[f.MEDICO] = 1; });
  return limpiarParaEnvio({ hoy: d.hoy, filas: filas, medicos: Object.keys(medicos).sort(), meta: d.reglas.metaRetorno,
    metaTratamiento: d.reglas.metaTratamiento });
}
