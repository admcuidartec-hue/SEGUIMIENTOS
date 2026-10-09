/* ==========================================================================
   MENÚ «Seguimientos» DEL SHEETS

   Orden la primera vez:
     1. Preparar hojas
     2. Actualizar            (carga CITAS desde la "Hoja 1")

   Desde octubre de 2026 los procedimientos y tratamientos se registran en la
   pestaña Registro de la app; INDICACIONES queda como historial.
   ========================================================================== */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Seguimientos')
    .addItem('Actualizar', 'actualizar')
    .addItem('Verificar', 'verificar')
    .addItem('Activar actualización diaria (7:00)', 'activarDiaria')
    .addItem('Importar lo que falta de la base de hierro', 'importarLoQueFalta')
    .addSeparator()
    .addItem('Preparar hojas', 'prepararHojas')
    .addToUi();
}

/** Función y no variable global: el orden en que Apps Script carga los archivos no está garantizado. */
function hojasBase_() {
  return {
    CITAS: COLUMNAS_CITAS,
    PACIENTES: COLUMNAS_PACIENTES,
    INDICACIONES: COLUMNAS_INDICACIONES,
    SEGUIMIENTOS: COLUMNAS_SEGUIMIENTOS,
    BITACORA: COLUMNAS_BITACORA,
    CONTACTOS_CRM: COLUMNAS_CONTACTOS,
    KPI: ['RETORNO POR COHORTE'],
    REGISTROS: COLUMNAS_REGISTROS,
    SESIONES: COLUMNAS_SESIONES,
    ALTAS: COLUMNAS_ALTAS
  };
}

/** Listas iniciales de la pestaña Registro (diseño §3.4). DOCTOR y DOCTOR_SOFDOC van fila a fila. */
var CATALOGO_REGISTRO_INICIAL = {
  DOCTOR: ['Dr. Elí Cabanillas', 'Dra. Alejandra La Torre', 'Dr. Víctor Seminario', 'Dr. Álvaro Villanueva', 'Dra. Karen Matos',
    'Dra. Karen Matos – Particular', 'Dr. Iván Pacheco'],
  DOCTOR_SOFDOC: ['Dr. ELÍ FABRIZIO CABANILLAS HUALPA', 'Dra. ALEJANDRA LA TORRE MATUK', 'Dr. VICTOR ERNESTO SEMINARIO MARCELO',
    'Dr. ALVARO MARTIN VILLANUEVA GARCIA', 'Dra. KAREN DIANA MATOS PEÑA', '', 'Dr. IVAN PAOLO PACHECO MODESTO'],
  PROCEDIMIENTOS: ['SANGRÍA', 'AMO', 'BIOPSIA', 'CITOMETRÍA DE FLUJO', 'CARIOTIPO', 'TRANSFUSIÓN DE SANGRE'],
  TRATAMIENTOS: ['HIERRO SACARATO', 'HIERRO DERISOMALTOSA', 'HIERRO CARBOXIMALTOSA'],
  MARCAS: ['HIERRO CARBOXIMALTOSA | FERINJECT', 'HIERRO CARBOXIMALTOSA | LIKFER', 'HIERRO DERISOMALTOSA | MONOFER']
};

var PARAMETROS_REGISTRO = [['ESPERA_COTIZACION_DIAS', 7], ['DIAS_ENTRE_SESIONES', 7], ['GRACIA_AGENDA_DIAS', 2], ['META_DIARIA_SEGUIMIENTOS', 15],
  ['DIAS_POST_TRATAMIENTO', 30], ['DIAS_CONTROL_LAB', 15], ['AVISO_ALTA_CONTROL_DIAS', 30]];

/** Lo que la pestaña Registro necesita en hojas que ya existen. No borra ni mueve nada. Devuelve qué cambió. */
function ampliarHojas_() {
  var ss = ss_(), cambios = [];

  var sg = ss.getSheetByName('SEGUIMIENTOS');
  if (sg) {
    var cabS = encabezado_(sg), plan = encabezadoAmpliable(cabS, COLUMNAS_SEGUIMIENTOS);
    if (plan.error) cambios.push('✗ SEGUIMIENTOS: ' + plan.error);
    else if (plan.agregar.length) {
      sg.getRange(1, cabS.length + 1, 1, plan.agregar.length).setValues([plan.agregar]).setFontWeight('bold');
      cambios.push('SEGUIMIENTOS: columna ' + plan.agregar.join(', ') + '.');
    }
  }

  [['REGISTROS', COLUMNAS_REGISTROS], ['ALTAS', COLUMNAS_ALTAS]].forEach(function (par) {
    var sh = ss.getSheetByName(par[0]);
    if (!sh) return;
    var cab = encabezado_(sh), plan = encabezadoAmpliable(cab, par[1]);
    if (plan.error) cambios.push('✗ ' + par[0] + ': ' + plan.error);
    else if (plan.agregar.length) {
      sh.getRange(1, cab.length + 1, 1, plan.agregar.length).setValues([plan.agregar]).setFontWeight('bold');
      cambios.push(par[0] + ': columna ' + plan.agregar.join(', ') + '.');
    }
  });

  var ct = ss.getSheetByName('CATALOGOS');
  if (ct) {
    var cabC = encabezado_(ct), faltan = Object.keys(CATALOGO_REGISTRO_INICIAL).filter(function (c) { return cabC.indexOf(c) < 0; });
    var parDoctor = faltan.indexOf('DOCTOR') >= 0, parSofdoc = faltan.indexOf('DOCTOR_SOFDOC') >= 0;
    if (parDoctor !== parSofdoc) {
      cambios.push('✗ CATALOGOS: DOCTOR y DOCTOR_SOFDOC van juntas; agregue a mano la que falta.');
      faltan = faltan.filter(function (c) { return c !== 'DOCTOR' && c !== 'DOCTOR_SOFDOC'; });
    }
    faltan.forEach(function (c) {
      var col = encabezado_(ct).length + 1, valores = CATALOGO_REGISTRO_INICIAL[c];
      ct.getRange(1, col, 1, 1).setValues([[c]]).setFontWeight('bold');
      ct.getRange(2, col, valores.length, 1).setValues(valores.map(function (x) { return [x]; }));
    });
    if (faltan.length) cambios.push('CATALOGOS: columnas ' + faltan.join(', ') + '.');
    var cM = encabezado_(ct).indexOf('MOTIVOS_DESCARTE');
    if (cM >= 0) {
      var motivos = ct.getRange(1, cM + 1, Math.max(1, ct.getLastRow()), 1).getValues();
      motivos.forEach(function (f, i) {
        if (i > 0 && normTexto(f[0]) === 'ALTA MEDICA') {
          ct.getRange(i + 1, cM + 1).setValue('');
          cambios.push('CATALOGOS: se quitó «ALTA MÉDICA» de los motivos de descarte.');
        }
      });
    }
  }

  var rg = ss.getSheetByName('REGLAS');
  if (rg) {
    var cabR = encabezado_(rg), cP = cabR.indexOf('PARAMETRO'), cV = cabR.indexOf('VALOR');
    if (cP >= 0 && cV >= 0) {
      var col = rg.getRange(1, cP + 1, Math.max(1, rg.getLastRow()), 1).getValues().map(function (f) { return normTexto(f[0]); });
      PARAMETROS_REGISTRO.forEach(function (par) {
        if (col.indexOf(par[0]) >= 0) return;
        var fila = col.length + 1;
        for (var i = 1; i < col.length; i++) if (!col[i]) { fila = i + 1; break; }
        rg.getRange(fila, cP + 1).setValue(par[0]);
        rg.getRange(fila, cV + 1).setValue(par[1]);
        col[fila - 1] = par[0];
        cambios.push('REGLAS: ' + par[0] + ' = ' + par[1] + '.');
      });
    }
  }
  return cambios;
}

function prepararHojas() {
  var ss = ss_(), base = hojasBase_(), creadas = [];
  Object.keys(base).forEach(function (n) {
    if (ss.getSheetByName(n)) return;
    var sh = ss.insertSheet(n);
    sh.getRange(1, 1, 1, base[n].length).setValues([base[n]]).setFontWeight('bold');
    sh.setFrozenRows(1);
    creadas.push(n);
  });
  if (!ss.getSheetByName('REGLAS')) {
    var r = ss.insertSheet('REGLAS');
    r.getRange(1, 1, 6, 6).setValues([
      ['ESPECIALIDAD', 'ESPERADO_DIAS', 'VENCE_DIAS', '', 'PARAMETRO', 'VALOR'],
      ['*', 30, 45, '', 'ESPERA_TRAS_SEGUIMIENTO_DIAS', 15],
      ['HEMATOLOGÍA', 30, 45, '', 'MAX_SEGUIMIENTOS', 2],
      ['', '', '', '', 'CORTE_BANDEJA_DIAS', 180],
      ['', '', '', '', 'CORTE_INDICACIONES_DIAS', 180],
      ['', '', '', '', 'META_RETORNO_PCT', 60]
    ]);
    r.getRange(1, 1, 1, 6).setFontWeight('bold');
    r.setFrozenRows(1);
    creadas.push('REGLAS');
  }
  if (!ss.getSheetByName('CATALOGOS')) {
    var c = ss.insertSheet('CATALOGOS');
    c.getRange(1, 1, 6, 4).setValues([
      ['USUARIOS', 'MOTIVOS_DESCARTE', 'MEDICO_ALIAS', 'MEDICO_NOMBRE'],
      ['MAGALY', 'SE ATIENDE EN OTRO LUGAR', 'Dr. ELI FABRIZIO CABANILLAS HUALPA', 'Dr. ELÍ FABRIZIO CABANILLAS HUALPA'],
      ['ANA', 'NÚMERO EQUIVOCADO', '', ''],
      ['RACHEL', 'YA NO LO NECESITA', '', ''],
      ['DR. ELI CABANILLAS', 'FALLECIÓ', '', ''],
      ['', 'OTRO', '', '']
    ]);
    c.getRange(1, 1, 1, 4).setFontWeight('bold');
    c.setFrozenRows(1);
    creadas.push('CATALOGOS');
  }
  var ampliadas = ampliarHojas_();
  SpreadsheetApp.getUi().alert((creadas.length ? 'Hojas creadas: ' + creadas.join(', ') + '.' : 'No faltaba ninguna hoja.') +
    (ampliadas.length ? '\n' + ampliadas.join('\n') : '\nNo hubo que ampliar ninguna hoja.'));
}

/** El aviso se muestra con el candado ya suelto: mientras está abierto, nadie más podría guardar. */
function actualizar() {
  var ui = SpreadsheetApp.getUi(), lock, mensaje;
  try { lock = bloquear_(); } catch (e) { ui.alert('Otra actualización está en curso. Intente en un minuto.'); return; }
  try {
    mensaje = actualizar_().mensaje;
  } finally {
    lock.releaseLock();
  }
  ui.alert(mensaje);
}

/** Hoja 1 -> CITAS -> emparejamientos -> PACIENTES -> KPI. Si algo no cuadra, no escribe nada. */
function actualizar_(quien) {
  quien = quien || 'MENÚ';
  var datos = hoja_(CONFIG.HOJA_SOFDOC).getDataRange().getValues();
  if (datos.length < 2) return { ok: false, mensaje: 'La "Hoja 1" está vacía. Pegue primero el export de SOFDOC.' };
  var filas = datos.slice(1).map(function (f) {
    return f.map(function (v) { return v instanceof Date ? fechaHoraTexto_(v) : v; });
  });
  var limpio = limpiarCitas(datos[0], filas, catalogos_().alias);
  if (limpio.faltantes.length) {
    return { ok: false, mensaje: 'No se actualizó nada. Faltan estas columnas en la "Hoja 1": ' + limpio.faltantes.join(', ') + '.' };
  }
  if (!limpio.citas.length) {
    return { ok: false, mensaje: 'No se actualizó nada: ninguna fila de la "Hoja 1" tiene IDCITA, DNI y fecha válidos.' };
  }

  var fusion = fusionarCitas(leerCitas_(), limpio.citas);
  escribirObjetos_('CITAS', COLUMNAS_CITAS, fusion.citas);
  var emparejadas = emparejarIndicacionesEnHoja_(fusion.citas);
  var crm = traerCrm_(fusion.citas);

  MEMO.datos = null;
  var d = datos_();
  escribirObjetos_('PACIENTES', COLUMNAS_PACIENTES, d.pacientes);
  escribirKpi_(filasHojaKpi(calcularKpi(d.citas, d.indicacionesTodas, d.seguimientos, d.reglas, d.hoy, d.contactos, d.vigentes)));

  var detalle = unirFrases([filas.length + ' filas leídas, ' + fusion.nuevas + ' citas nuevas, ' + fusion.cambiadas + ' cambiadas, ' +
    limpio.invalidas + ' inválidas, ' + emparejadas + ' emparejamientos nuevos', crm.mensaje]);
  bitacora_(quien, 'ACTUALIZAR', detalle);
  var t = ordenarBandeja(d.pacientes, d.pendientes), n = { REEVALUACION: 0, HIERRO: 0, PROCEDIMIENTO: 0 };
  t.forEach(function (x) { n[x.TIPO_SEGUIMIENTO]++; });
  return { ok: true, mensaje: unirFrases(['Listo', detalle, 'En la bandeja: ' + n.REEVALUACION + ' reevaluaciones, ' +
    n.HIERRO + ' de hierro y ' + n.PROCEDIMIENTO + ' de procedimientos']) };
}

/**
 * Lee la hoja LEADS del CRM (solo lectura) y reescribe CONTACTOS_CRM.
 * Si el CRM no se puede leer, la CONTACTOS_CRM anterior se conserva.
 */
function traerCrm_(citas) {
  var valores;
  try {
    var hoja = SpreadsheetApp.openById(CONFIG.CRM_ID).getSheetByName(CONFIG.HOJA_CRM);
    if (!hoja) throw new Error('no existe la hoja ' + CONFIG.HOJA_CRM);
    valores = hoja.getDataRange().getValues().map(function (f) {
      return f.map(function (x) { return x instanceof Date ? fechaHoraTexto_(x) : x; });
    });
  } catch (e) {
    return { ok: false, mensaje: 'CRM no leído: ' + e.message + '. Se conservan los datos anteriores.' };
  }
  var r = contactosDesdeCrm(valores[0] || [], valores.slice(1));
  if (r.faltantes.length) {
    return { ok: false, mensaje: 'CRM no leído: faltan las columnas ' + r.faltantes.join(', ') + ' en ' + CONFIG.HOJA_CRM + '. Se conservan los datos anteriores.' };
  }
  if (valores.length > 1 && !r.contactos.length) {
    return { ok: false, mensaje: 'CRM no leído: ' + CONFIG.HOJA_CRM + ' no tiene ningún lead con nombre o DNI. Se conservan los datos anteriores.' };
  }
  var unidos = emparejarContactos(r.contactos, citas);
  if (!ss_().getSheetByName('CONTACTOS_CRM')) ss_().insertSheet('CONTACTOS_CRM');
  escribirObjetos_('CONTACTOS_CRM', COLUMNAS_CONTACTOS, r.contactos);
  return { ok: true, mensaje: 'CRM: ' + r.contactos.length + ' leads con nombre o DNI, ' + unidos + ' unidos a un paciente.' };
}

/** La llama el activador diario. Sin ventanas: todo queda en BITACORA. */
function actualizacionDiaria() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(CONFIG.ESPERA_LOCK_MS)) {
    bitacora_('AUTOMÁTICO', 'ACTUALIZAR', 'No se hizo: otra persona estaba guardando. Se intentará mañana.');
    return;
  }
  try {
    var r = actualizar_('AUTOMÁTICO');
    if (!r.ok) bitacora_('AUTOMÁTICO', 'ACTUALIZAR', r.mensaje);
  } catch (e) {
    try { bitacora_('AUTOMÁTICO', 'ACTUALIZAR', 'Error: ' + e.message); } catch (e2) { /* la bitácora tampoco: queda el correo de Google */ }
    throw e;
  } finally {
    lock.releaseLock();
  }
}

/** Deja un único activador diario a las 7:00 (Lima). Devuelve cuántos anteriores reemplazó. */
function programarDiaria_() {
  var reemplazados = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'actualizacionDiaria') { ScriptApp.deleteTrigger(t); reemplazados++; }
  });
  ScriptApp.newTrigger('actualizacionDiaria').timeBased().everyDays(1).atHour(7).inTimezone('America/Lima').create();
  return reemplazados;
}

function activarDiaria() {
  var n = programarDiaria_();
  SpreadsheetApp.getUi().alert('Listo: la plataforma se actualizará sola cada día a las 7:00, leyendo SOFDOC y el CRM.' +
    (n ? ' Se reemplazó el activador anterior.' : ''));
}

/**
 * Escribe solo las columnas DNI y EMPAREJAMIENTO de INDICACIONES, para no
 * pisar lo que una asesora esté anotando en las demás columnas.
 */
function emparejarIndicacionesEnHoja_(citas) {
  var sh = hoja_('INDICACIONES'), datos = sh.getDataRange().getValues();
  if (datos.length < 2) return 0;
  var cab = datos[0].map(function (c) { return String(c).trim(); });
  var cN = cab.indexOf('NOMBRE'), cD = cab.indexOf('DNI'), cE = cab.indexOf('EMPAREJAMIENTO');
  if (cN < 0 || cD < 0 || cE < 0) throw new Error('INDICACIONES necesita las columnas NOMBRE, DNI y EMPAREJAMIENTO.');
  var filas = datos.slice(1).map(function (f) {
    return { NOMBRE: f[cN], DNI: normDni(f[cD]), EMPAREJAMIENTO: String(f[cE] || '') };
  });
  var cId = cab.indexOf('ID');
  if (cId < 0) throw new Error('INDICACIONES necesita la columna ID.');
  filas.forEach(function (f, i) { f.ID = String(datos[i + 1][cId] || ''); });
  var nuevosIds = completarIds(filas);
  if (nuevosIds) sh.getRange(2, cId + 1, filas.length, 1).setNumberFormat('@').setValues(filas.map(function (f) { return [f.ID]; }));
  var conNombre = filas.filter(function (f) { return String(f.NOMBRE).trim(); });
  var cambios = aplicarEmparejamientos(conNombre, construirIndiceNombres(citas));
  if (!cambios) return 0;
  sh.getRange(2, cD + 1, filas.length, 1).setNumberFormat('@').setValues(filas.map(function (f) { return [f.DNI]; }));
  sh.getRange(2, cE + 1, filas.length, 1).setValues(filas.map(function (f) { return [f.EMPAREJAMIENTO]; }));
  return cambios;
}

function escribirKpi_(filas) {
  var sh = hoja_('KPI');
  sh.clearContents();
  sh.getRange(1, 1, filas.length, 4).setNumberFormat('@');
  sh.getRange(1, 7, filas.length, 1).setNumberFormat('0%');
  sh.getRange(1, 1, filas.length, 7).setValues(filas);
}

/** El aviso se muestra con el candado ya suelto (ver actualizar). */
function importarIndicaciones() {
  var ui = SpreadsheetApp.getUi(), lock, mensaje;
  try { lock = bloquear_(); } catch (e) { ui.alert('Otra operación está en curso. Intente en un minuto.'); return; }
  try {
    mensaje = importar_();
  } finally {
    lock.releaseLock();
  }
  ui.alert(mensaje);
}

/** Devuelve el mensaje para el usuario. Se niega si INDICACIONES ya tiene filas o si no hay citas. */
function importar_() {
  if (leerObjetos_('INDICACIONES').length) {
    return 'INDICACIONES ya tiene filas. La importación se hace una sola vez y no se repite, para no duplicar.';
  }
  var citas = leerCitas_();
  if (!citas.length) return 'Primero use «Actualizar» para cargar las citas: sin ellas no se puede emparejar.';
  var origen = SpreadsheetApp.openById(CONFIG.HIERRO_ID), todas = [];
  ['HIERRO', 'PROCEDIMIENTOS'].forEach(function (n) {
    var sh = origen.getSheetByName(n);
    if (!sh) throw new Error('La base de hierro no tiene la pestaña ' + n + '.');
    var v = sh.getDataRange().getValues().map(function (f) {
      return f.map(function (x) { return x instanceof Date ? fechaHoraTexto_(x) : x; });
    });
    todas = todas.concat(indicacionesDesdeHierro(n, v[0], v.slice(1), todas.length + 1));
  });
  aplicarEmparejamientos(todas, construirIndiceNombres(citas));
  escribirObjetos_('INDICACIONES', COLUMNAS_INDICACIONES, todas);
  var cuenta = {};
  todas.forEach(function (i) { cuenta[i.EMPAREJAMIENTO] = (cuenta[i.EMPAREJAMIENTO] || 0) + 1; });
  var detalle = todas.length + ' indicaciones: ' + Object.keys(cuenta).map(function (k) { return cuenta[k] + ' ' + k; }).join(', ');
  bitacora_('MENÚ', 'IMPORTAR', detalle);
  return 'Importadas ' + detalle + '. Ahora use «Actualizar».';
}

/** El aviso se muestra con el candado ya suelto (ver actualizar). */
function importarLoQueFalta() {
  var ui = SpreadsheetApp.getUi(), lock, mensaje;
  try { lock = bloquear_(); } catch (e) { ui.alert('Otra operación está en curso. Intente en un minuto.'); return; }
  try {
    mensaje = importarLoQueFalta_();
  } finally {
    lock.releaseLock();
  }
  ui.alert(mensaje);
}

/**
 * Trae de la base de hierro lo que todavía no está en INDICACIONES y lo agrega
 * al final, sin tocar las filas que ya hay. Lee la pestaña de hierro (hoy
 * «HIERRO EV DIARIO»; antes «HIERRO»), PROCEDIMIENTOS y HIERRO NUEVO, que ya
 * trae DNI. Se puede repetir: lo ya importado no se duplica.
 */
function importarLoQueFalta_() {
  var citas = leerCitas_();
  if (!citas.length) return 'Primero use «Actualizar» para cargar las citas: sin ellas no se puede emparejar.';
  var porNombre = {};
  SpreadsheetApp.openById(CONFIG.HIERRO_ID).getSheets().forEach(function (s) { porNombre[normTexto(s.getName())] = s; });
  var pestanas = [porNombre['HIERRO EV DIARIO'] || porNombre.HIERRO, porNombre.PROCEDIMIENTOS, porNombre['HIERRO NUEVO']]
    .filter(Boolean);
  if (!pestanas.length) return 'La base de hierro no tiene las pestañas HIERRO EV DIARIO, PROCEDIMIENTOS ni HIERRO NUEVO.';
  var candidatas = [];
  pestanas.forEach(function (sh) {
    var v = sh.getDataRange().getValues().map(function (f) {
      return f.map(function (x) { return x instanceof Date ? fechaHoraTexto_(x) : x; });
    });
    candidatas = candidatas.concat(indicacionesDesdeHierro(sh.getName(), v[0], v.slice(1)));
  });
  var existentes = leerObjetos_('INDICACIONES');
  var nuevas = indicacionesQueFaltan(existentes, candidatas);
  if (!nuevas.length) return 'No falta nada: todo lo de la base de hierro ya está en INDICACIONES.';
  nuevas.forEach(function (i) { i.ID = ''; });
  aplicarEmparejamientos(nuevas, construirIndiceNombres(citas));
  completarIds(existentes.concat(nuevas));

  var sh = hoja_('INDICACIONES'), cab = encabezado_(sh), desde = sh.getLastRow() + 1;
  cab.forEach(function (c, j) {
    var r = sh.getRange(desde, j + 1, nuevas.length, 1);
    if (COLUMNAS_FECHA[c]) r.setNumberFormat('yyyy-mm-dd');
    else if (!COLUMNAS_NUMERICAS[c]) r.setNumberFormat('@');
  });
  sh.getRange(desde, 1, nuevas.length, cab.length).setValues(nuevas.map(function (o) {
    return cab.map(function (c) { return celdaParaHoja_(o[c], c); });
  }));
  SpreadsheetApp.flush();

  var n = { unidas: 0, porConfirmar: 0, sin: 0 };
  nuevas.forEach(function (i) {
    var e = normTexto(i.EMPAREJAMIENTO);
    if (e === 'POR CONFIRMAR') n.porConfirmar++;
    else if (e === 'SIN CANDIDATO') n.sin++;
    else n.unidas++;
  });
  var detalle = nuevas.length + ' indicaciones: ' + n.unidas + ' unidas a un paciente, ' + n.porConfirmar + ' por confirmar y ' +
    n.sin + ' sin paciente';
  bitacora_('MENÚ', 'IMPORTAR', detalle);
  return 'Se agregaron ' + detalle + '. Las que quedaron sin paciente están en la app, en Indicadores → «Procedimientos sin ' +
    'paciente»: ahí se les escribe el DNI. Ahora use «Actualizar».';
}

/** Revisión de salud. No escribe nada. */
function verificar() {
  var ss = ss_(), lineas = [];
  var h = ss.getSheetByName(CONFIG.HOJA_SOFDOC);
  if (!h) {
    lineas.push('✗ No existe la hoja "' + CONFIG.HOJA_SOFDOC + '".');
  } else {
    var cab = h.getRange(1, 1, 1, Math.max(1, h.getLastColumn())).getValues()[0];
    var r = limpiarCitas(cab, [], {});
    lineas.push(r.faltantes.length
      ? '✗ A la "Hoja 1" le faltan: ' + r.faltantes.join(', ') + '.'
      : '✓ "Hoja 1": encabezado correcto, ' + Math.max(0, h.getLastRow() - 1) + ' filas.');
  }
  Object.keys(hojasBase_()).concat(['REGLAS', 'CATALOGOS']).forEach(function (n) {
    var s = ss.getSheetByName(n);
    lineas.push(s ? '✓ ' + n + ': ' + Math.max(0, s.getLastRow() - 1) + ' filas.' : '✗ Falta la hoja ' + n + '. Use «Preparar hojas».');
  });
  var sgV = ss.getSheetByName('SEGUIMIENTOS');
  if (sgV) {
    var planV = encabezadoAmpliable(encabezado_(sgV), COLUMNAS_SEGUIMIENTOS);
    lineas.push(planV.error ? '✗ SEGUIMIENTOS: ' + planV.error
      : planV.agregar.length ? '✗ A SEGUIMIENTOS le falta la columna ' + planV.agregar.join(', ') + '. Use «Preparar hojas».'
      : '✓ SEGUIMIENTOS tiene todas sus columnas.');
    var ra = resumenAntiguos(leerSeguimientos_());
    lineas.push('ℹ SEGUIMIENTOS: ' + ra.nuevos + ' con resultado, ' + ra.hechos + ' «hecho» y ' + ra.descartes +
      ' descartes antiguos, ' + ra.fallecidos + ' fallecidos, ' + ra.anulados + ' anulados.');
  }
  if (ss.getSheetByName('CATALOGOS')) revisarCatalogos(catalogos_()).forEach(function (l) { lineas.push(l); });
  try {
    SpreadsheetApp.openById(CONFIG.HIERRO_ID);
    lineas.push('✓ La base de hierro se puede abrir.');
  } catch (e) {
    lineas.push('✗ No se puede abrir la base de hierro: ' + e.message);
  }
  verificarCrm_().forEach(function (l) { lineas.push(l); });
  SpreadsheetApp.getUi().alert(lineas.join('\n'));
}

/** Dos líneas para «Verificar»: si el CRM se puede leer y si la actualización diaria está activada. No escribe nada. */
function verificarCrm_() {
  var lineas = [];
  try {
    var hoja = SpreadsheetApp.openById(CONFIG.CRM_ID).getSheetByName(CONFIG.HOJA_CRM);
    if (!hoja) {
      lineas.push('✗ El CRM no tiene la hoja ' + CONFIG.HOJA_CRM + '.');
    } else {
      var v = hoja.getDataRange().getValues();
      var faltan = contactosDesdeCrm(v[0] || [], []).faltantes;
      lineas.push(faltan.length
        ? '✗ A la hoja ' + CONFIG.HOJA_CRM + ' del CRM le faltan: ' + faltan.join(', ') + '.'
        : '✓ CRM: la hoja ' + CONFIG.HOJA_CRM + ' se puede leer, con las columnas necesarias y ' + Math.max(0, v.length - 1) + ' leads.');
    }
  } catch (e) {
    lineas.push('✗ No se puede abrir el CRM: ' + e.message);
  }
  var activa = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'actualizacionDiaria'; });
  lineas.push(activa ? '✓ Actualización diaria activada (7:00).'
    : '✗ La actualización diaria no está activada. Use «Activar actualización diaria (7:00)».');
  return lineas;
}
