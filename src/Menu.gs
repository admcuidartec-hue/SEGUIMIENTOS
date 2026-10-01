/* ==========================================================================
   MENÚ «Seguimientos» DEL SHEETS

   Orden la primera vez:
     1. Preparar hojas
     2. Actualizar            (carga CITAS desde la "Hoja 1")
     3. Importar hierro y procedimientos (una vez)
     4. Actualizar            (empareja y recalcula con las indicaciones)
   ========================================================================== */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Seguimientos')
    .addItem('Actualizar', 'actualizar')
    .addItem('Verificar', 'verificar')
    .addSeparator()
    .addItem('Preparar hojas', 'prepararHojas')
    .addItem('Importar hierro y procedimientos (una vez)', 'importarIndicaciones')
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
    KPI: ['RETORNO POR COHORTE']
  };
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
    r.getRange(1, 1, 4, 6).setValues([
      ['ESPECIALIDAD', 'ESPERADO_DIAS', 'VENCE_DIAS', '', 'PARAMETRO', 'VALOR'],
      ['*', 30, 45, '', 'ESPERA_TRAS_SEGUIMIENTO_DIAS', 15],
      ['HEMATOLOGÍA', 30, 45, '', 'MAX_SEGUIMIENTOS', 3],
      ['', '', '', '', 'CORTE_BANDEJA_DIAS', 180]
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
  SpreadsheetApp.getUi().alert(creadas.length
    ? 'Hojas creadas: ' + creadas.join(', ') + '.'
    : 'Todas las hojas ya existían. No se cambió nada.');
}

function actualizar() {
  var ui = SpreadsheetApp.getUi(), lock;
  try { lock = bloquear_(); } catch (e) { ui.alert('Otra actualización está en curso. Intente en un minuto.'); return; }
  try {
    ui.alert(actualizar_().mensaje);
  } finally {
    lock.releaseLock();
  }
}

/** Hoja 1 -> CITAS -> emparejamientos -> PACIENTES -> KPI. Si algo no cuadra, no escribe nada. */
function actualizar_() {
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

  MEMO.datos = null;
  var d = datos_();
  escribirObjetos_('PACIENTES', COLUMNAS_PACIENTES, d.pacientes);
  escribirKpi_(filasHojaKpi(calcularKpi(d.citas, d.indicaciones, d.seguimientos, d.reglas, d.hoy)));

  var detalle = filas.length + ' filas leídas, ' + fusion.nuevas + ' citas nuevas, ' + fusion.cambiadas + ' cambiadas, ' +
    limpio.invalidas + ' inválidas, ' + emparejadas + ' emparejamientos nuevos';
  bitacora_('MENÚ', 'ACTUALIZAR', detalle);
  var vencidos = d.pacientes.filter(function (p) { return p.ESTADO === 'VENCIDO'; }).length;
  return { ok: true, mensaje: 'Listo. ' + detalle + '. En la bandeja: ' + vencidos + ' pacientes.' };
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

function importarIndicaciones() {
  var ui = SpreadsheetApp.getUi(), lock;
  try { lock = bloquear_(); } catch (e) { ui.alert('Otra operación está en curso. Intente en un minuto.'); return; }
  try {
    if (leerObjetos_('INDICACIONES').length) {
      ui.alert('INDICACIONES ya tiene filas. La importación se hace una sola vez y no se repite, para no duplicar.');
      return;
    }
    var citas = leerCitas_();
    if (!citas.length) {
      ui.alert('Primero use «Actualizar» para cargar las citas: sin ellas no se puede emparejar.');
      return;
    }
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
    ui.alert('Importadas ' + detalle + '. Ahora use «Actualizar».');
  } finally {
    lock.releaseLock();
  }
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
  try {
    SpreadsheetApp.openById(CONFIG.HIERRO_ID);
    lineas.push('✓ La base de hierro se puede abrir.');
  } catch (e) {
    lineas.push('✗ No se puede abrir la base de hierro: ' + e.message);
  }
  SpreadsheetApp.getUi().alert(lineas.join('\n'));
}
