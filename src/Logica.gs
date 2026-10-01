/* ==========================================================================
   LÓGICA PURA

   Nada en este archivo llama a SpreadsheetApp, Utilities, Session ni
   LockService: todo recibe datos y devuelve datos. Así se prueba con Node
   (`npm test`) sin desplegar.

   Las fechas viajan como texto 'yyyy-MM-dd'. Convertirlas a Date —a
   mediodía— es trabajo de Codigo.gs, al escribir en la hoja.
   ========================================================================== */

var PALABRAS_VACIAS = { DE: 1, DEL: 1, LA: 1, LAS: 1, LOS: 1, Y: 1 };

function normTexto(v) {
  return String(v == null ? '' : v)
    .replace(/\n/g, ' ')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/**
 * DNI, carné de extranjería o pasaporte -> clave del paciente.
 * Un DNI numérico pierde los ceros a la izquierda porque SOFDOC ya los perdió
 * ('06174169' en una base y 6174169 en la otra son la misma persona).
 */
function normDni(v) {
  var s = normTexto(v).replace(/[\s.\-]/g, '');
  if (/^\d+$/.test(s)) s = s.replace(/^0+/, '');
  return s;
}

function normTelefono(v) {
  var d = String(v == null ? '' : v).replace(/\.0+$/, '').replace(/\D/g, '');
  if (d.length === 11 && d.indexOf('51') === 0) d = d.slice(2);
  return d.length >= 7 ? d : '';
}

/** 'yyyy-MM-dd' tomado del inicio del texto; '' si no empieza por una fecha ISO. */
function fechaIso(v) {
  var m = String(v == null ? '' : v).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[1] + '-' + m[2] + '-' + m[3] : '';
}

function diaUtc_(iso) {
  var p = String(iso).split('-');
  return Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
}

function diasEntre(desde, hasta) {
  return Math.round((diaUtc_(hasta) - diaUtc_(desde)) / 86400000);
}

function sumarDias(iso, n) {
  var d = new Date(diaUtc_(iso) + n * 86400000);
  return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2);
}

function mesDe(iso) {
  return String(iso || '').slice(0, 7);
}
/* ==========================================================================
   CITAS DE SOFDOC
   ========================================================================== */

/** Columnas que SOFDOC debe traer. Si falta una, no se escribe nada. */
var SOFDOC_OBLIGATORIAS = {
  IDCITA: 'IDCITA', ESTADO: 'ESTADO DE CITA', FECHA: 'FECHA DE ATENCION | HORA',
  NOMBRE: 'PACIENTE', DNI: 'DNI DEL PACIENTE', ESPECIALIDAD: 'ESPECIALIDAD MEDICA',
  MEDICO: 'MEDICO', FECHA_REGISTRO: 'FECHA DE REGISTRO'
};
/** 'MODALDIAD' va con la errata del export original. */
var SOFDOC_OPCIONALES = {
  MODALIDAD: 'MODALDIAD', TIPO_PACIENTE: 'TIPO PACIENTE', MARCA: 'MARCA',
  ESTADO_PAGO: 'ESTADO DE PAGO', PAGO: 'PAGO REALIZADO', REGISTRADO_POR: 'REGISTRADO POR'
};

var COLUMNAS_CITAS = ['IDCITA', 'DNI', 'NOMBRE', 'FECHA', 'ESTADO', 'ESPECIALIDAD', 'MEDICO', 'MODALIDAD',
  'TIPO_PACIENTE', 'MARCA', 'PAGO', 'ESTADO_PAGO', 'REGISTRADO_POR', 'FECHA_REGISTRO'];

function indiceDeEncabezado(encabezado) {
  var idx = {};
  (encabezado || []).forEach(function (c, i) {
    var k = normTexto(c);
    if (k && idx[k] === undefined) idx[k] = i;
  });
  return idx;
}

function textoLimpio_(v) {
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
}

/** Solo las marcas 'yyyy-…' se pueden comparar como texto; lo demás no desempata. */
function claveRegistro(v) {
  var s = String(v == null ? '' : v);
  return /^\d{4}-/.test(s) ? s : '';
}

function limpiarCitas(encabezado, filas, alias) {
  alias = alias || {};
  var idx = indiceDeEncabezado(encabezado);
  var faltantes = [];
  Object.keys(SOFDOC_OBLIGATORIAS).forEach(function (k) {
    if (idx[normTexto(SOFDOC_OBLIGATORIAS[k])] === undefined) faltantes.push(SOFDOC_OBLIGATORIAS[k]);
  });
  if (faltantes.length) return { citas: [], faltantes: faltantes, invalidas: 0 };

  function celda(f, nombre) {
    var i = idx[normTexto(nombre)];
    return i === undefined ? '' : f[i];
  }

  var porId = {}, orden = [], invalidas = 0;
  (filas || []).forEach(function (f) {
    var medico = textoLimpio_(celda(f, SOFDOC_OBLIGATORIAS.MEDICO));
    var c = {
      IDCITA: normTexto(celda(f, SOFDOC_OBLIGATORIAS.IDCITA)),
      DNI: normDni(celda(f, SOFDOC_OBLIGATORIAS.DNI)),
      NOMBRE: textoLimpio_(celda(f, SOFDOC_OBLIGATORIAS.NOMBRE)),
      FECHA: fechaIso(celda(f, SOFDOC_OBLIGATORIAS.FECHA)),
      ESTADO: normTexto(celda(f, SOFDOC_OBLIGATORIAS.ESTADO)),
      ESPECIALIDAD: textoLimpio_(celda(f, SOFDOC_OBLIGATORIAS.ESPECIALIDAD)),
      MEDICO: alias[normTexto(medico)] || medico,
      MODALIDAD: textoLimpio_(celda(f, SOFDOC_OPCIONALES.MODALIDAD)),
      TIPO_PACIENTE: textoLimpio_(celda(f, SOFDOC_OPCIONALES.TIPO_PACIENTE)),
      MARCA: textoLimpio_(celda(f, SOFDOC_OPCIONALES.MARCA)),
      PAGO: celda(f, SOFDOC_OPCIONALES.PAGO),
      ESTADO_PAGO: textoLimpio_(celda(f, SOFDOC_OPCIONALES.ESTADO_PAGO)),
      REGISTRADO_POR: textoLimpio_(celda(f, SOFDOC_OPCIONALES.REGISTRADO_POR)),
      FECHA_REGISTRO: textoLimpio_(celda(f, SOFDOC_OBLIGATORIAS.FECHA_REGISTRO))
    };
    if (!c.IDCITA || !c.DNI || !c.FECHA) { invalidas++; return; }
    var previa = porId[c.IDCITA];
    if (!previa) orden.push(c.IDCITA);
    else if (claveRegistro(c.FECHA_REGISTRO) < claveRegistro(previa.FECHA_REGISTRO)) return;
    porId[c.IDCITA] = c;
  });
  var citas = orden.map(function (id) { return porId[id]; }).sort(ordenCitas_);
  return { citas: citas, faltantes: [], invalidas: invalidas };
}

function ordenCitas_(a, b) {
  if (a.FECHA !== b.FECHA) return a.FECHA < b.FECHA ? -1 : 1;
  return a.IDCITA < b.IDCITA ? -1 : a.IDCITA > b.IDCITA ? 1 : 0;
}

function mismaCita_(a, b) {
  return COLUMNAS_CITAS.every(function (k) { return String(a[k] == null ? '' : a[k]) === String(b[k] == null ? '' : b[k]); });
}

/**
 * Incorpora lo pegado a lo que ya había. Lo que no viene en el pegado se
 * conserva: pegar solo el mes nuevo no debe borrar la historia.
 */
function fusionarCitas(previas, nuevas) {
  var porId = {}, orden = [], nNuevas = 0, cambiadas = 0;
  (previas || []).forEach(function (c) {
    if (!porId[c.IDCITA]) orden.push(c.IDCITA);
    porId[c.IDCITA] = c;
  });
  (nuevas || []).forEach(function (c) {
    var p = porId[c.IDCITA];
    if (!p) { porId[c.IDCITA] = c; orden.push(c.IDCITA); nNuevas++; return; }
    if (claveRegistro(c.FECHA_REGISTRO) < claveRegistro(p.FECHA_REGISTRO)) return;
    if (!mismaCita_(p, c)) cambiadas++;
    porId[c.IDCITA] = c;
  });
  var citas = orden.map(function (id) { return porId[id]; }).sort(ordenCitas_);
  return { citas: citas, nuevas: nNuevas, cambiadas: cambiadas };
}
