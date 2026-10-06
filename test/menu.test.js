// Los avisos del menú se muestran después de soltar el candado: mientras un
// aviso está abierto, nadie más podría guardar.
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar, plano } = require('./cargar');

function contexto() {
  const ctx = cargar(['Logica.gs', 'Registro.gs', 'Resultados.gs', 'Tablero.gs', 'Codigo.gs', 'RegistroServidor.gs', 'Menu.gs']);
  const estado = { tomado: false, avisos: [] };
  ctx.LockService = { getScriptLock: () => ({
    tryLock: () => { estado.tomado = true; return true; },
    releaseLock: () => { estado.tomado = false; }
  }) };
  ctx.SpreadsheetApp = { getUi: () => ({ alert: m => estado.avisos.push({ m, conCandado: estado.tomado }) }) };
  return { ctx, estado };
}

test('actualizar muestra su aviso con el candado ya suelto', () => {
  const { ctx, estado } = contexto();
  ctx.actualizar_ = () => ({ ok: true, mensaje: 'Listo.' });
  ctx.actualizar();
  assert.deepEqual(estado.avisos.map(a => [a.m, a.conCandado]), [['Listo.', false]]);
});

test('importarIndicaciones muestra su aviso con el candado ya suelto', () => {
  const { ctx, estado } = contexto();
  ctx.importar_ = () => 'Importadas 3 indicaciones.';
  ctx.importarIndicaciones();
  assert.deepEqual(estado.avisos.map(a => [a.m, a.conCandado]), [['Importadas 3 indicaciones.', false]]);
});

function libroCrm(filas) {
  return { openById: () => ({ getSheetByName: () => ({ getDataRange: () => ({ getValues: () => filas }) }) }) };
}

test('traerCrm_ escribe CONTACTOS_CRM con los leads útiles ya emparejados', () => {
  const { ctx } = contexto();
  const escritos = [];
  ctx.SpreadsheetApp = libroCrm([
    ['ID', 'FECHA', 'NOMBRES', 'APELLIDOS', 'DNI', 'TELEFONO', 'CANAL_ESPECIFICO', 'CAMPANA'],
    ['L-1', '2026-07-10 10:00', 'Rosa', 'Quispe', '40111222', '987654321', 'GOOGLE', ''],
    ['L-2', '2026-07-11 10:00', '', '', '', '912345678', 'GOOGLE', '']
  ]);
  ctx.ss_ = () => ({ getSheetByName: () => ({}) });
  ctx.escribirObjetos_ = (hoja, columnas, objetos) => escritos.push({ hoja, n: objetos.length, dni: objetos[0] && objetos[0].DNI_PACIENTE });
  const r = ctx.traerCrm_([{ DNI: '40111222', NOMBRE: 'ROSA QUISPE', ESTADO: 'REALIZADO', FECHA: '2026-07-20' }]);
  assert.equal(r.ok, true);
  assert.deepEqual(escritos, [{ hoja: 'CONTACTOS_CRM', n: 1, dni: '40111222' }]);
  assert.match(r.mensaje, /1 leads con nombre o DNI, 1 unidos a un paciente/);
});

test('traerCrm_ no reescribe CONTACTOS_CRM si al CRM le falta una columna', () => {
  const { ctx } = contexto();
  const escritos = [];
  ctx.SpreadsheetApp = libroCrm([['ID', 'FECHA', 'DNI'], ['L-1', '2026-07-10', '1']]);
  ctx.escribirObjetos_ = h => escritos.push(h);
  const r = ctx.traerCrm_([]);
  assert.equal(r.ok, false);
  assert.match(r.mensaje, /CRM no leído: faltan las columnas .*TELEFONO/);
  assert.deepEqual(escritos, []);
});

test('traerCrm_ no reescribe CONTACTOS_CRM si el CRM no se puede abrir', () => {
  const { ctx } = contexto();
  const escritos = [];
  ctx.SpreadsheetApp = { openById: () => { throw new Error('sin acceso'); } };
  ctx.escribirObjetos_ = h => escritos.push(h);
  const r = ctx.traerCrm_([]);
  assert.equal(r.ok, false);
  assert.match(r.mensaje, /CRM no leído: sin acceso/);
  assert.deepEqual(escritos, []);
});

test('programarDiaria_ deja un solo activador a las 7:00 de Lima', () => {
  const { ctx } = contexto();
  let activadores = [{ getHandlerFunction: () => 'otraCosa' }];
  const creados = [];
  ctx.ScriptApp = {
    getProjectTriggers: () => activadores.slice(),
    deleteTrigger: t => { activadores = activadores.filter(x => x !== t); },
    newTrigger: f => {
      const conf = { f };
      const b = { timeBased: () => b, everyDays: n => { conf.dias = n; return b; }, atHour: h => { conf.hora = h; return b; },
        inTimezone: z => { conf.zona = z; return b; }, create: () => { activadores.push({ getHandlerFunction: () => f }); creados.push(conf); } };
      return b;
    }
  };
  assert.equal(ctx.programarDiaria_(), 0);
  assert.equal(ctx.programarDiaria_(), 1);
  assert.equal(activadores.filter(t => t.getHandlerFunction() === 'actualizacionDiaria').length, 1);
  assert.equal(activadores.length, 2, 'no toca otros activadores');
  assert.deepEqual(creados[0], { f: 'actualizacionDiaria', dias: 1, hora: 7, zona: 'America/Lima' });
});

test('actualizacionDiaria no espera si otra persona está guardando y lo anota', () => {
  const { ctx } = contexto();
  const notas = [];
  let llamado = false;
  ctx.LockService = { getScriptLock: () => ({ tryLock: () => false, releaseLock: () => {} }) };
  ctx.bitacora_ = (u, a, d) => notas.push([u, a, d]);
  ctx.actualizar_ = () => { llamado = true; return { ok: true, mensaje: '' }; };
  ctx.actualizacionDiaria();
  assert.equal(llamado, false);
  assert.deepEqual(notas, [['AUTOMÁTICO', 'ACTUALIZAR', 'No se hizo: otra persona estaba guardando. Se intentará mañana.']]);
});

test('actualizacionDiaria usa el usuario AUTOMÁTICO y suelta el candado', () => {
  const { ctx, estado } = contexto();
  let quien = '';
  ctx.actualizar_ = q => { quien = q; return { ok: true, mensaje: 'Listo.' }; };
  ctx.actualizacionDiaria();
  assert.equal(quien, 'AUTOMÁTICO');
  assert.equal(estado.tomado, false);
});

test('traerCrm_ no borra CONTACTOS_CRM si LEADS tiene filas pero ningún lead útil', () => {
  const { ctx } = contexto();
  const escritos = [];
  ctx.SpreadsheetApp = libroCrm([
    ['ID', 'FECHA', 'NOMBRES', 'APELLIDOS', 'DNI', 'TELEFONO', 'CANAL_ESPECIFICO', 'CAMPANA'],
    ['L-1', '2026-07-10 10:00', '', '', '', '912345678', 'GOOGLE', '']
  ]);
  ctx.escribirObjetos_ = h => escritos.push(h);
  const r = ctx.traerCrm_([]);
  assert.equal(r.ok, false);
  assert.match(r.mensaje, /ningún lead con nombre o DNI/);
  assert.deepEqual(escritos, []);
});

test('si la actualización diaria falla, queda en BITACORA, suelta el candado y avisa a Google', () => {
  const { ctx, estado } = contexto();
  const notas = [];
  ctx.bitacora_ = (u, a, d) => notas.push([u, a, d]);
  ctx.actualizar_ = () => { throw new Error('falta la hoja KPI'); };
  assert.throws(() => ctx.actualizacionDiaria(), /falta la hoja KPI/);
  assert.deepEqual(notas, [['AUTOMÁTICO', 'ACTUALIZAR', 'Error: falta la hoja KPI']]);
  assert.equal(estado.tomado, false);
});

function conActivadores(ctx, nombres) {
  ctx.ScriptApp = { getProjectTriggers: () => nombres.map(n => ({ getHandlerFunction: () => n })) };
}

test('verificarCrm_: CRM abierto con sus columnas y actualización diaria activada', () => {
  const { ctx } = contexto();
  ctx.SpreadsheetApp = libroCrm([
    ['ID', 'FECHA', 'NOMBRES', 'APELLIDOS', 'DNI', 'TELEFONO', 'CANAL_ESPECIFICO', 'CAMPANA'],
    ['L-1', '2026-07-10', 'A', 'B', '1', '9', 'X', 'Y'], ['L-2', '2026-07-11', 'A', 'B', '2', '9', 'X', 'Y']
  ]);
  conActivadores(ctx, ['actualizacionDiaria']);
  assert.deepEqual([...ctx.verificarCrm_()], ['✓ CRM: la hoja LEADS se puede leer, con las columnas necesarias y 2 leads.',
    '✓ Actualización diaria activada (7:00).']);
});

test('verificarCrm_: avisa si faltan columnas, si no se abre y si no hay actualización diaria', () => {
  const { ctx } = contexto();
  ctx.SpreadsheetApp = libroCrm([['ID', 'FECHA', 'DNI']]);
  conActivadores(ctx, ['otraCosa']);
  const a = [...ctx.verificarCrm_()];
  assert.match(a[0], /^✗ A la hoja LEADS del CRM le faltan: NOMBRES, APELLIDOS, TELEFONO, CANAL_ESPECIFICO, CAMPANA\.$/);
  assert.equal(a[1], '✗ La actualización diaria no está activada. Use «Activar actualización diaria (7:00)».');
  ctx.SpreadsheetApp = { openById: () => { throw new Error('sin acceso'); } };
  assert.equal(ctx.verificarCrm_()[0], '✗ No se puede abrir el CRM: sin acceso');
});

/** Hoja falsa en memoria: solo lo que usan prepararHojas y ampliarHojas_. */
function hojaFalsa(valores) {
  const v = valores.map(f => f.slice());
  const ancho = () => Math.max(0, ...v.map(f => f.length));
  const celda = (r, c) => ((v[r - 1] || [])[c - 1] ?? '');
  const poner = (r, c, x) => { while (v.length < r) v.push([]); v[r - 1][c - 1] = x; };
  return {
    v,
    getLastRow: () => v.length,
    getLastColumn: ancho,
    getDataRange: () => ({ getValues: () => v.map(f => Array.from({ length: ancho() }, (_, j) => f[j] ?? '')) }),
    getRange(r, c, h = 1, w = 1) {
      const rango = {
        getValues: () => Array.from({ length: h }, (_, i) => Array.from({ length: w }, (_, j) => celda(r + i, c + j))),
        setValues: vals => { vals.forEach((f, i) => f.forEach((x, j) => poner(r + i, c + j, x))); return rango; },
        setValue: x => { poner(r, c, x); return rango; },
        setFontWeight: () => rango
      };
      return rango;
    }
  };
}

test('encabezadoAmpliable: solo agrega al final si lo anterior coincide', () => {
  const { ctx } = contexto();
  assert.deepEqual(plano(ctx.encabezadoAmpliable(['A', 'B'], ['A', 'B', 'C'])), { error: '', agregar: ['C'] });
  assert.deepEqual(plano(ctx.encabezadoAmpliable(['A', 'B', 'C'], ['A', 'B', 'C'])), { error: '', agregar: [] });
  assert.match(ctx.encabezadoAmpliable(['A', 'X'], ['A', 'B', 'C']).error, /columna 2 \(«X», se esperaba «B»\)/);
});

test('ampliarHojas_: REFERENCIA en SEGUIMIENTOS, catálogos de Registro, quita ALTA MÉDICA y suma parámetros, sin borrar nada', () => {
  const { ctx } = contexto();
  const seg = hojaFalsa([['ID', 'FECHA_HORA', 'DNI', 'ESPECIALIDAD', 'RESPONSABLE', 'ACCION', 'MOTIVO', 'NOTA'], ['S-1', '', '1', 'H', 'M', 'HECHO', '', 'n']]);
  const cat = hojaFalsa([['USUARIOS', 'MOTIVOS_DESCARTE'], ['MAGALY', 'OTRO'], ['ANA', 'ALTA MÉDICA']]);
  const reg = hojaFalsa([['ESPECIALIDAD', 'ESPERADO_DIAS', 'VENCE_DIAS', '', 'PARAMETRO', 'VALOR'], ['*', 30, 45, '', 'MAX_SEGUIMIENTOS', 2]]);
  ctx.ss_ = () => ({ getSheetByName: n => ({ SEGUIMIENTOS: seg, CATALOGOS: cat, REGLAS: reg })[n] || null });
  const cambios = [...ctx.ampliarHojas_()];
  assert.deepEqual(seg.v[0].slice(8), ['REFERENCIA', 'RESULTADO', 'FECHA_PROXIMA', 'TELEFONO', 'ANULADO', 'MOTIVO_ANULACION']);
  assert.deepEqual(seg.v[1].slice(0, 8), ['S-1', '', '1', 'H', 'M', 'HECHO', '', 'n'], 'no toca las filas');
  assert.deepEqual(cat.v[0], ['USUARIOS', 'MOTIVOS_DESCARTE', 'DOCTOR', 'DOCTOR_SOFDOC', 'PROCEDIMIENTOS', 'TRATAMIENTOS', 'MARCAS']);
  assert.equal(cat.v[1][2], 'Dr. Elí Cabanillas');
  assert.equal(cat.v[6][3], '', 'el particular sin nombre SOFDOC');
  assert.equal(cat.v[2][1], '', 'ALTA MÉDICA quitado');
  assert.deepEqual(reg.v.slice(2).map(f => [f[4], f[5]]), [['ESPERA_COTIZACION_DIAS', 7], ['DIAS_ENTRE_SESIONES', 7], ['GRACIA_AGENDA_DIAS', 2]]);
  assert.equal(cambios.length, 6, 'SEGUIMIENTOS, CATALOGOS, ALTA MÉDICA y los tres parámetros');
  assert.deepEqual([...ctx.ampliarHojas_()], [], 'la segunda vez no cambia nada');
});

test('ampliarHojas_ no agrega REFERENCIA si el encabezado de SEGUIMIENTOS no es el esperado', () => {
  const { ctx } = contexto();
  const seg = hojaFalsa([['ID', 'FECHA', 'DNI']]);
  ctx.ss_ = () => ({ getSheetByName: n => (n === 'SEGUIMIENTOS' ? seg : null) });
  assert.match(ctx.ampliarHojas_()[0], /^✗ SEGUIMIENTOS: el encabezado no coincide/);
  assert.deepEqual(seg.v[0], ['ID', 'FECHA', 'DNI']);
});
