/* ==========================================================================
   ENFERMERÍA — lógica pura (sin Sheets). Usa Logica.gs, Registro.gs y Resultados.gs.
   Diseño: docs/superpowers/specs/2026-10-20-enfermeria-design.md

   Tras cada sesión de hierro, Enfermería llama al paciente a los días de
   REGLAS.ENFERMERIA_DIAS (1, 3 y 5). Esos contactos se CALCULAN de las sesiones;
   en la hoja ENFERMERIA solo queda lo que se registra.
   ========================================================================== */

var COLUMNAS_ENFERMERIA = ['ID', 'FECHA_HORA', 'ID_REGISTRO', 'ID_SESION', 'NUMERO_SESION', 'DNI', 'DIA', 'RESULTADO', 'REACCION_TIPO',
  'REACCION', 'NOTA', 'ENFERMERA', 'ANULADO', 'MOTIVO_ANULACION'];
var RESULTADOS_ENFERMERIA = { 'CONTACTADO': 'CONTACTADO', 'NO CONTESTO': 'NO CONTESTO' };
var TIPOS_REACCION = { 'NINGUNA': 'NINGUNA', 'INMEDIATA': 'INMEDIATA', 'MEDIATA': 'MEDIATA' };
var DIAS_PROXIMOS_ENFERMERIA = 7;

/**
 * Las filas de ENFERMERIA de una sesión, sin las anuladas. Con `indice` (filasPorSesion_ de esas mismas filas) no recorre la
 * hoja entera por cada sesión: con 1000 sesiones y 2000 contactos, eso era casi todo el tiempo de getEnfermeria y getResumen.
 */
function filasDeSesion_(enfermeria, idSesion, indice) {
  if (indice) return (indice[idSesion] || []).slice();
  return (enfermeria || []).filter(function (f) { return !anulado_(f) && textoLimpio_(f.ID_SESION) === idSesion; });
}

/** { ID_SESION: [filas sin anular, en el orden de la hoja] } en una sola pasada. */
function filasPorSesion_(enfermeria) {
  var idx = {};
  (enfermeria || []).forEach(function (f) {
    if (anulado_(f)) return;
    var k = textoLimpio_(f.ID_SESION);
    (idx[k] = idx[k] || []).push(f);
  });
  return idx;
}

/** Las sesiones vivas de los registros de hierro vivos: [{ r, s }]. */
function sesionesDeHierro_(registros, sesiones) {
  var vivos = {};
  (registros || []).forEach(function (r) { if (!anulado_(r) && normTexto(r.TIPO) === 'HIERRO') vivos[r.ID] = r; });
  return (sesiones || []).filter(function (s) { return !anulado_(s) && vivos[s.ID_REGISTRO] && fechaIso(s.FECHA); })
    .map(function (s) { return { r: vivos[s.ID_REGISTRO], s: s }; });
}

/**
 * Los contactos pendientes, en orden de llamada: vencidos (el más antiguo primero), los de hoy y los de los próximos
 * DIAS_PROXIMOS_ENFERMERIA días. Uno con «CONTACTADO» ya está cumplido; los «NO CONTESTO» solo se cuentan. No entran los
 * de un fallecido ni los que tocaban hace más de REGLAS.ENFERMERIA_CORTE_DIAS (al publicar no debe caer una avalancha).
 */
function contactosEnfermeria(d) {
  var hoy = d.hoy, reglas = d.reglas || {}, dias = reglas.diasEnfermeria || [1, 3, 5];
  var corte = reglas.corteEnfermeria === undefined ? 10 : reglas.corteEnfermeria;
  var desde = sumarDias(hoy, -corte), hasta = sumarDias(hoy, DIAS_PROXIMOS_ENFERMERIA), muertos = fallecidos(d.seguimientos);
  var out = [], porSesion = filasPorSesion_(d.enfermeria);
  sesionesDeHierro_(d.registros, d.sesiones).forEach(function (x) {
    var r = x.r, s = x.s, dni = normDni(r.DNI);
    if (muertos[dni]) return;
    var filas = filasDeSesion_(d.enfermeria, s.ID, porSesion), fechaSes = fechaIso(s.FECHA);
    var reacciones = filas.filter(function (f) { return normTexto(f.RESULTADO) === 'CONTACTADO' && normTexto(f.REACCION_TIPO) && normTexto(f.REACCION_TIPO) !== 'NINGUNA'; })
      .sort(function (a, b) { return Number(a.DIA) - Number(b.DIA); })
      .map(function (f) { return { DIA: Number(f.DIA) || 0, TIPO: normTexto(f.REACCION_TIPO), REACCION: textoLimpio_(f.REACCION) }; });
    var tel = (d.telefonos || {})[dni] || [], contacto = normTelefono(r.CONTACTO);
    if (!tel.length && contacto.length === 9) tel = [contacto];
    dias.forEach(function (dia) {
      var fecha = sumarDias(fechaSes, dia);
      if (fecha < desde || fecha > hasta) return;
      var delDia = filas.filter(function (f) { return Number(f.DIA) === dia; });
      if (delDia.some(function (f) { return normTexto(f.RESULTADO) === 'CONTACTADO'; })) return;
      out.push({
        CLAVE: s.ID + '|' + dia, ID_REGISTRO: r.ID, ID_SESION: s.ID, NUMERO_SESION: Number(s.NUMERO) || 0, DNI: dni,
        NOMBRE: textoLimpio_(r.NOMBRE), TELEFONOS: tel.join(' / '), USUARIO: contacto.length === 9 ? '' : textoLimpio_(r.CONTACTO),
        TRATAMIENTO: frase_(r.DETALLE), MARCA: frase_(r.MARCA), SESIONES: Number(r.SESIONES) || 1, FECHA_SESION: fechaSes,
        DIA: dia, FECHA: fecha, GRUPO: fecha < hoy ? 'VENCIDO' : fecha === hoy ? 'HOY' : 'PROXIMO',
        NO_CONTESTO: delDia.filter(function (f) { return normTexto(f.RESULTADO) === 'NO CONTESTO'; }).length,
        REACCIONES: reacciones
      });
    });
  });
  return out.sort(function (a, b) {
    return a.FECHA < b.FECHA ? -1 : a.FECHA > b.FECHA ? 1 : a.NOMBRE < b.NOMBRE ? -1 : a.NOMBRE > b.NOMBRE ? 1 : a.CLAVE < b.CLAVE ? -1 : a.CLAVE > b.CLAVE ? 1 : 0;
  });
}

/** Las reacciones elegidas, tal como están en el catálogo: { error, lista }. */
function reaccionesDeCatalogo_(elegidas, catalogos) {
  var lista = [], cat = (catalogos && catalogos.reacciones) || REACCIONES_INICIALES;
  var pedidas = (Array.isArray(elegidas) ? elegidas : String(elegidas || '').split(' · ')).map(textoLimpio_).filter(Boolean);
  if (!pedidas.length) return { error: 'Elija al menos una reacción.', lista: [] };
  for (var i = 0; i < pedidas.length; i++) {
    var r = enLista_(cat, pedidas[i]);
    if (!r) return { error: 'La reacción «' + pedidas[i] + '» no está en el catálogo.', lista: [] };
    if (lista.indexOf(r) < 0) lista.push(r);
  }
  return { error: '', lista: lista };
}
var esOtra_ = function (r) { return normTexto(r) === 'OTRA'; };

/**
 * Lo que registró la enfermera en un contacto, revisado. p: { usuario, clave ('SES-…|dia'), resultado, reaccionTipo, reacciones, nota }.
 * d: { catalogos, contactos (contactosEnfermeria) }. Devuelve { error, fila, contacto }.
 */
function validarContactoEnfermeria(p, d) {
  function no(m) { return { error: m, fila: null, contacto: null }; }
  if (!p) return no('Faltan los datos.');
  var quien = enLista_(d.catalogos.usuarios, p.usuario);
  if (!quien) return no('Elija quién es usted en el selector de arriba.');
  var clave = textoLimpio_(p.clave);
  var c = (d.contactos || []).filter(function (x) { return x.CLAVE === clave; })[0];
  if (!c) return no('Ese contacto ya no está en la lista. Recargue la página.');
  var resultado = RESULTADOS_ENFERMERIA[normTexto(p.resultado)];
  if (!resultado) return no('Elija si contestó o no.');
  var nota = textoLimpio_(p.nota);
  if (largoMal_(p.nota, LARGO_TEXTO, 'La nota')) return no(largoMal_(p.nota, LARGO_TEXTO, 'La nota'));
  var fila = { ID_REGISTRO: c.ID_REGISTRO, ID_SESION: c.ID_SESION, NUMERO_SESION: c.NUMERO_SESION, DNI: c.DNI, DIA: c.DIA, RESULTADO: resultado,
    REACCION_TIPO: '', REACCION: '', NOTA: nota, ENFERMERA: quien, ANULADO: '', MOTIVO_ANULACION: '' };
  if (resultado === 'CONTACTADO') {
    var tipo = TIPOS_REACCION[normTexto(p.reaccionTipo)];
    if (!tipo) return no('Elija si tuvo reacción: no, inmediata o mediata.');
    fila.REACCION_TIPO = tipo;
    if (tipo !== 'NINGUNA') {
      var r = reaccionesDeCatalogo_(p.reacciones, d.catalogos);
      if (r.error) return no(r.error);
      if (r.lista.some(esOtra_) && !nota) return no('Escriba cuál fue la reacción en la nota («Otra»).');
      fila.REACCION = r.lista.join(' · ');
    }
  }
  return { error: '', fila: fila, contacto: c };
}

/**
 * «¿Reacción durante la aplicación?» al marcar una sesión: { hubo, reacciones, nota }. Sin reacción, fila null.
 * La fila (DIA 0, INMEDIATA) se completa en el servidor con la sesión que se acaba de marcar.
 */
function reaccionAplicacion(reaccion, catalogos) {
  if (!reaccion || !reaccion.hubo) return { error: '', fila: null };
  var r = reaccionesDeCatalogo_(reaccion.reacciones, catalogos), nota = textoLimpio_(reaccion.nota);
  if (largoMal_(reaccion.nota, LARGO_TEXTO, 'La nota de la reacción')) return { error: largoMal_(reaccion.nota, LARGO_TEXTO, 'La nota de la reacción'), fila: null };
  if (r.error) return { error: r.error, fila: null };
  if (r.lista.some(esOtra_) && !nota) return { error: 'Escriba cuál fue la reacción en la nota («Otra»).', fila: null };
  return { error: '', fila: { DIA: 0, RESULTADO: 'CONTACTADO', REACCION_TIPO: 'INMEDIATA', REACCION: r.lista.join(' · '), NOTA: nota } };
}

function validarAnulacionEnfermeria(id, filas) {
  var f = (filas || []).filter(function (x) { return x.ID === id; })[0];
  if (!f) return 'No encontré ' + id + '.';
  if (anulado_(f)) return id + ' ya estaba anulado.';
  return '';
}

/**
 * Cifras de Enfermería para el Resumen del mes, por «mes de la sesión|médico del registro»: pacientes con reacción (en total,
 * con alguna inmediata, con alguna mediata) y contactos que ya tocaban (hasta hoy) y cuántos se cumplieron a tiempo
 * (CONTACTADO registrado a más tardar el día en que tocaba).
 */
function cifrasEnfermeria(d) {
  var out = {}, pac = {}, dias = (d.reglas && d.reglas.diasEnfermeria) || [1, 3, 5], hoy = d.hoy;
  function de(k) { return out[k] = out[k] || { REAC_PAC: 0, REAC_INM: 0, REAC_MED: 0, ENF_DEBIDOS: 0, ENF_A_TIEMPO: 0 }; }
  var porSesion = filasPorSesion_(d.enfermeria);
  sesionesDeHierro_(d.registros, d.sesiones).forEach(function (x) {
    var r = x.r, s = x.s, fechaSes = fechaIso(s.FECHA), k = mesDe(fechaSes) + '|' + (medicoDeRegistro(r, d.catalogos || {}) || 'SIN MÉDICO');
    var o = de(k), filas = filasDeSesion_(d.enfermeria, s.ID, porSesion), dni = normDni(r.DNI);
    dias.forEach(function (dia) {
      var fecha = sumarDias(fechaSes, dia);
      if (fecha > hoy) return;
      o.ENF_DEBIDOS++;
      if (filas.some(function (f) { return Number(f.DIA) === dia && normTexto(f.RESULTADO) === 'CONTACTADO' && fechaIso(f.FECHA_HORA) <= fecha; })) o.ENF_A_TIEMPO++;
    });
    var p = pac[k] = pac[k] || {};
    filas.forEach(function (f) {
      var t = normTexto(f.REACCION_TIPO);
      if (normTexto(f.RESULTADO) !== 'CONTACTADO' || !t || t === 'NINGUNA') return;
      p[dni] = p[dni] || {};
      p[dni][t] = 1;
    });
  });
  Object.keys(pac).forEach(function (k) {
    Object.keys(pac[k]).forEach(function (dni) {
      out[k].REAC_PAC++;
      if (pac[k][dni].INMEDIATA) out[k].REAC_INM++;
      if (pac[k][dni].MEDIATA) out[k].REAC_MED++;
    });
  });
  return out;
}

/** Suma las cifras de Enfermería a las filas de resumenPorMes (y agrega las de un mes o médico que no tenían fila). */
function resumenConEnfermeria(filas, cifras) {
  var porClave = {};
  (filas || []).forEach(function (f) { porClave[f.MES + '|' + f.MEDICO] = f; });
  Object.keys(cifras || {}).forEach(function (k) {
    var f = porClave[k];
    if (!f) {
      var par = k.split('|');
      f = porClave[k] = { MES: par[0], MEDICO: par.slice(1).join('|') };
      CAMPOS_RESUMEN.forEach(function (c) { f[c] = 0; });
      filas.push(f);
    }
    Object.keys(cifras[k]).forEach(function (c) { f[c] = (Number(f[c]) || 0) + cifras[k][c]; });
  });
  return filas;
}
