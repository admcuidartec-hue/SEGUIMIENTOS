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
