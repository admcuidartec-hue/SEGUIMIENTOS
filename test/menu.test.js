// Los avisos del menú se muestran después de soltar el candado: mientras un
// aviso está abierto, nadie más podría guardar.
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar } = require('./cargar');

function contexto() {
  const ctx = cargar(['Logica.gs', 'Codigo.gs', 'Menu.gs']);
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
  assert.match(r.mensaje, /CRM no leído: faltan las columnas TELEFONO/);
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
