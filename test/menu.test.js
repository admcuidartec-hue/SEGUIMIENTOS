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
