/* ==========================================================================
   REGISTRO, SESIONES Y ALTAS — lógica pura (sin Sheets). Usa Logica.gs.
   Diseño: docs/superpowers/specs/2026-10-05-pestana-registro-design.md
   ========================================================================== */

var COLUMNAS_REGISTROS = ['ID', 'FECHA_HORA', 'FECHA', 'ASESORA', 'DOCTOR', 'NOMBRE', 'DNI', 'CONTACTO', 'TIPO',
  'DETALLE', 'MARCA', 'SESIONES', 'ANULADO', 'MOTIVO_ANULACION'];
var COLUMNAS_SESIONES = ['ID', 'FECHA_HORA', 'ID_REGISTRO', 'NUMERO', 'FECHA', 'ASESORA', 'NOTA', 'ANULADO', 'MOTIVO_ANULACION'];
var COLUMNAS_ALTAS = ['ID', 'FECHA_HORA', 'FECHA', 'DNI', 'ESPECIALIDAD', 'DOCTOR', 'REGISTRADO_POR', 'NOTA', 'ANULADO', 'MOTIVO_ANULACION'];

var MAX_SESIONES = 20;
var DIAS_DUPLICADO = 7;

/** El siguiente ID correlativo: siguienteId(['REG-000007'], 'REG') -> 'REG-000008'. */
function siguienteId(ids, prefijo) {
  var mayor = 0, re = new RegExp('^' + prefijo + '-(\\d+)$');
  (ids || []).forEach(function (id) {
    var m = String(id || '').trim().match(re);
    if (m && Number(m[1]) > mayor) mayor = Number(m[1]);
  });
  return prefijo + '-' + ('00000' + (mayor + 1)).slice(-6);
}

function anulado_(x) { return normTexto(x && x.ANULADO) === 'SI'; }

/** El valor tal como está en el catálogo, o '' si no está (sin importar mayúsculas ni tildes). */
function enLista_(lista, valor) {
  var n = normTexto(valor);
  if (!n) return '';
  for (var i = 0; i < (lista || []).length; i++) if (normTexto(lista[i]) === n) return lista[i];
  return '';
}

function copia_(a, b) {
  var o = {};
  [a, b].forEach(function (x) { Object.keys(x).forEach(function (k) { o[k] = x[k]; }); });
  return o;
}

function fechaDma_(iso) {
  var p = String(iso || '').split('-');
  return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : String(iso || '');
}

/** DNI de 8 dígitos o carné de extranjería de 9 a 12 caracteres alfanuméricos. */
function documentoValido(dni) {
  var d = normTexto(dni).replace(/[\s.\-]/g, '');
  return /^\d{8}$/.test(d) || /^[A-Z0-9]{9,12}$/.test(d);
}

/** 'Hierro carboximaltosa · Ferinject × 3 sesiones' o 'Sangría'. */
function textoRegistro(r) {
  if (r.TIPO !== 'HIERRO') return frase_(r.DETALLE);
  var n = Number(r.SESIONES) || 1;
  return frase_(r.DETALLE) + (r.MARCA ? ' · ' + frase_(r.MARCA) : '') + ' × ' + n + (n === 1 ? ' sesión' : ' sesiones');
}

/** El médico para filtros y cifras: su nombre en SOFDOC o, si no tiene, el DOCTOR tal cual. */
function medicoDeRegistro(r, catalogos) {
  var d = (catalogos.doctores || []).filter(function (x) { return normTexto(x.doctor) === normTexto(r.DOCTOR); })[0];
  return d && d.sofdoc ? d.sofdoc : textoLimpio_(r.DOCTOR);
}

/** El primer DOCTOR del catálogo cuyo nombre SOFDOC es ese médico (así se propone «Dra. Karen Matos» y no el particular). */
function doctorPropuesto(catalogos, medicoSofdoc) {
  var d = (catalogos.doctores || []).filter(function (x) { return x.sofdoc && normTexto(x.sofdoc) === normTexto(medicoSofdoc); })[0];
  return d ? d.doctor : '';
}

function validarRegistro(p, catalogos, hoy) {
  function no(m) { return { error: m, filas: [] }; }
  if (!p) return no('Faltan los datos del registro.');
  var asesora = enLista_(catalogos.usuarios, p.usuario);
  if (!asesora) return no('Elija quién es usted en el selector de arriba.');
  if (!documentoValido(p.dni)) return no('El DNI debe tener 8 dígitos (o el carné de extranjería, de 9 a 12 caracteres).');
  var nombre = textoLimpio_(p.nombre).toUpperCase();
  if (!nombre) return no('Falta el nombre del paciente.');
  var contacto = textoLimpio_(p.contacto);
  if (!contacto) return no('Falta el teléfono o usuario.');
  var fecha = fechaIso(p.fecha);
  if (!fecha) return no('Falta la fecha.');
  if (fecha > hoy) return no('La fecha no puede ser futura.');
  var doctor = (catalogos.doctores || []).filter(function (d) { return normTexto(d.doctor) === normTexto(p.doctor); })[0];
  if (!doctor) return no('Elija el doctor de la lista.');
  var proc = textoLimpio_(p.procedimiento), trat = textoLimpio_(p.tratamiento);
  if (!proc && !trat) return no('Elija un procedimiento, un tratamiento o ambos.');
  var base = { FECHA: fecha, ASESORA: asesora, DOCTOR: doctor.doctor, NOMBRE: nombre, DNI: normDni(p.dni), CONTACTO: contacto,
    MARCA: '', ANULADO: '', MOTIVO_ANULACION: '' };
  var filas = [];
  if (proc) {
    var p1 = enLista_(catalogos.procedimientos, proc);
    if (!p1) return no('El procedimiento «' + proc + '» no está en CATALOGOS.');
    filas.push(copia_(base, { TIPO: 'PROCEDIMIENTO', DETALLE: p1, SESIONES: 1 }));
  }
  if (trat) {
    var t1 = enLista_(catalogos.tratamientos, trat);
    if (!t1) return no('El tratamiento «' + trat + '» no está en CATALOGOS.');
    var n = Number(p.sesiones);
    if (!(n >= 1 && n <= MAX_SESIONES && Math.floor(n) === n)) return no('Indique cuántas sesiones (de 1 a ' + MAX_SESIONES + ').');
    var marcas = (catalogos.marcas || {})[normTexto(t1)] || [], marca = '';
    if (marcas.length) {
      marca = enLista_(marcas, p.marca);
      if (!marca) return no('Elija la marca de ' + t1 + ': ' + marcas.join(' o ') + '.');
    } else if (textoLimpio_(p.marca)) {
      return no(t1 + ' no lleva marca.');
    }
    filas.push(copia_(base, { TIPO: 'HIERRO', DETALLE: t1, MARCA: marca, SESIONES: n }));
  }
  return { error: '', filas: filas };
}

/** El registro previo, sin anular, de la misma indicación del mismo DNI a 7 días o menos de la fecha nueva. */
function duplicadoReciente(registros, fila) {
  var previos = (registros || []).filter(function (r) {
    var f = fechaIso(r.FECHA);
    return !anulado_(r) && f && normDni(r.DNI) === fila.DNI && normTexto(r.TIPO) === fila.TIPO &&
      normTexto(r.DETALLE) === normTexto(fila.DETALLE) && Math.abs(diasEntre(f, fila.FECHA)) <= DIAS_DUPLICADO;
  });
  return previos.length ? previos[previos.length - 1] : null;
}
