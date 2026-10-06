const fs = require('fs');
const path = require('path');
const vm = require('vm');

/**
 * Carga los .gs indicados en un contexto vm, como hace Apps Script: todas las
 * declaraciones de nivel superior quedan como propiedades del contexto.
 */
function cargar(archivos = ['Logica.gs', 'Registro.gs', 'Resultados.gs', 'Tablero.gs']) {
  const ctx = {};
  vm.createContext(ctx);
  for (const a of archivos) {
    const codigo = fs.readFileSync(path.join(__dirname, '..', 'src', a), 'utf8');
    vm.runInContext(codigo, ctx, { filename: a });
  }
  return ctx;
}

/** Los objetos del vm son de otro realm: deepEqual los compara mal sin esto. */
const plano = x => JSON.parse(JSON.stringify(x));

module.exports = { cargar, plano };
