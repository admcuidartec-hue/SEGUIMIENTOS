// Encabezados escritos o movidos a mano (batería de 80 pruebas, casos 49 y 50). Datos inventados.
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar, plano } = require('./cargar');

const ARCHIVOS = ['Logica.gs', 'Registro.gs', 'Resultados.gs', 'Tablero.gs', 'Enfermeria.gs', 'Codigo.gs', 'RegistroServidor.gs',
  'ResultadoServidor.gs', 'EnfermeriaServidor.gs', 'Menu.gs'];

/** Hoja falsa: la fila 1 es el encabezado; appendRow pone cada valor bajo la columna de su POSICIÓN, como Sheets. */
function hojaFalsa(valores) {
  const v = valores.map(f => f.slice());
  const ancho = () => Math.max(0, ...v.map(f => f.length));
  return {
    v,
    getLastRow: () => v.length,
    getLastColumn: ancho,
    getDataRange: () => ({ getValues: () => v.map(f => Array.from({ length: ancho() }, (_, j) => f[j] ?? '')) }),
    appendRow: fila => { v.push(fila.slice()); },
    getRange(r, c, h = 1, w = 1) {
      const rango = {
        getValues: () => Array.from({ length: h }, (_, i) => Array.from({ length: w }, (_, j) => (v[r - 1 + i] || [])[c - 1 + j] ?? '')),
        setValues: vals => { vals.forEach((f, i) => f.forEach((x, j) => { while (v.length < r + i) v.push([]); v[r - 1 + i][c - 1 + j] = x; })); return rango; },
        setValue: x => rango.setValues([[x]]),
        setFontWeight: () => rango,
        setNumberFormat: () => rango
      };
      return rango;
    }
  };
}

function contexto(hojas) {
  const ctx = cargar(ARCHIVOS);
  ctx.MEMO = { mismaZona: true };
  ctx.ss_ = () => ({ getSheetByName: n => hojas[n] || null });
  return ctx;
}

const swap = (l, a, b) => { const x = l.slice(), i = x.indexOf(a), j = x.indexOf(b); [x[i], x[j]] = [x[j], x[i]]; return x; };

test('revisarEncabezado: grafía, columnas movidas, que faltan, repetidas y que no reconoce', () => {
  const ctx = cargar();
  const r = plano(ctx.revisarEncabezado(['ID', ' fecha ', 'NUMERO', 'Nota', 'NOTA LIBRE'], ['ID', 'NUMERO', 'FECHA', 'NOTA', 'ANULADO']));
  assert.deepEqual(r.grafia, [{ escrita: ' fecha ', esperada: 'FECHA' }, { escrita: 'Nota', esperada: 'NOTA' }]);
  assert.deepEqual(r.movidas, ['FECHA', 'NUMERO']);
  assert.deepEqual(r.faltan, ['ANULADO']);
  assert.deepEqual(r.extra, ['NOTA LIBRE']);
  assert.deepEqual(r.repetidas, []);
  assert.deepEqual(r.posicion, { ID: 0, FECHA: 1, NUMERO: 2, NOTA: 3 });
  assert.deepEqual(plano(ctx.revisarEncabezado(['ID', 'Id'], ['ID'])).repetidas, ['ID']);
  const bien = plano(ctx.revisarEncabezado(['ID', 'NUMERO'], ['ID', 'NUMERO']));
  assert.deepEqual([bien.grafia, bien.movidas, bien.faltan, bien.extra, bien.repetidas], [[], [], [], [], []]);
});

test('errorEncabezado: escribir solo si están todas las columnas (en cualquier orden) y ninguna repetida', () => {
  const ctx = cargar();
  const err = (cab, cols) => ctx.errorEncabezado('SESIONES', ctx.revisarEncabezado(cab, cols));
  assert.equal(err(['NUMERO', 'ID'], ['ID', 'NUMERO']), '', 'movidas: se escribe por nombre');
  assert.equal(err(['ID', 'numero '], ['ID', 'NUMERO']), '', 'otra grafía: se escribe igual');
  assert.equal(err(['ID'], ['ID', 'NUMERO', 'OP']).length > 0, true);
  assert.match(err(['ID'], ['ID', 'NUMERO', 'OP']), /^Falta preparar las hojas: a SESIONES le falta la columna NUMERO\./);
  assert.equal(err(['ID', 'NUMERO'], ['ID', 'NUMERO', 'OP']), '', 'sin OP se escribe sin idempotencia');
  assert.match(err(['ID', 'NUM'], ['ID', 'NUMERO']), /La hoja SESIONES tiene columnas renombradas.*NUMERO.*«NUM».*Verificar/);
  assert.match(err(['ID', 'NUMERO', 'Numero'], ['ID', 'NUMERO']), /La hoja SESIONES tiene la columna NUMERO repetida.*Verificar/);
});

test('leerObjetos_: «fecha», « FECHA » y «Fécha» se leen como FECHA', () => {
  const ses = hojaFalsa([['ID', ' fecha ', 'Número'], ['SES-000001', '2026-10-01', 2]]);
  const ctx = contexto({ SESIONES: ses });
  assert.deepEqual(plano(ctx.leerObjetos_('SESIONES')), [{ ID: 'SES-000001', FECHA: '2026-10-01', NUMERO: '2' }]);
});

test('anexarObjeto_: con columnas movidas o con otra grafía escribe cada valor bajo SU columna', () => {
  const cols = ['ID', 'FECHA_HORA', 'ID_REGISTRO', 'NUMERO', 'FECHA', 'ASESORA', 'NOTA', 'ANULADO', 'MOTIVO_ANULACION', 'OP'];
  const cab = swap(cols, 'NUMERO', 'FECHA').map(c => c === 'ASESORA' ? 'asesora' : c);
  const ses = hojaFalsa([cab]), bit = hojaFalsa([swap(['FECHA_HORA', 'USUARIO', 'ACCION', 'DETALLE', 'OP'], 'USUARIO', 'ACCION')]);
  const ctx = contexto({ SESIONES: ses, BITACORA: bit });
  ctx.anexarObjeto_('SESIONES', ctx.conOp_('SESIONES', ctx.COLUMNAS_SESIONES), { ID: 'SES-000002', FECHA_HORA: '2026-10-05 10:00', ID_REGISTRO: 'REG-000001',
    NUMERO: 2, FECHA: '2026-10-05', ASESORA: 'RACHEL', NOTA: '', ANULADO: '', MOTIVO_ANULACION: '', OP: 'OP-123456' });
  const f = Object.fromEntries(cab.map((c, j) => [c, ses.v[1][j]]));
  assert.equal(f.NUMERO, 2);
  assert.equal(f.FECHA.getDate(), 5);
  assert.equal(f.asesora, 'RACHEL');
  assert.equal(f.OP, 'OP-123456');
  ctx.bitacora_('RACHEL', 'SESIÓN', 'REG-000001 · sesión 2 de 3', 'OP-123456');
  const b = Object.fromEntries(bit.v[0].map((c, j) => [c, bit.v[1][j]]));
  assert.deepEqual([b.USUARIO, b.ACCION, b.OP], ['RACHEL', 'SESIÓN', 'OP-123456']);
});

test('anexarObjeto_ se niega con un mensaje claro si falta una columna o está repetida, sin escribir', () => {
  const ses = hojaFalsa([['ID', 'FECHA_HORA', 'ID_REGISTRO', 'NUMERO', 'FECHA ATENCION', 'ASESORA', 'NOTA', 'ANULADO', 'MOTIVO_ANULACION']]);
  const ctx = contexto({ SESIONES: ses });
  assert.throws(() => ctx.anexarObjeto_('SESIONES', ctx.COLUMNAS_SESIONES, { ID: 'SES-000001' }), /La hoja SESIONES tiene columnas renombradas.*FECHA/);
  assert.equal(ses.v.length, 1);
  assert.throws(() => ctx.exigirColumnas_('SESIONES', ctx.COLUMNAS_SESIONES), /La hoja SESIONES tiene columnas renombradas/);
});

test('conOp_ reconoce la columna OP aunque esté en otro lugar o en minúscula', () => {
  const ses = hojaFalsa([['op'].concat(['ID', 'FECHA_HORA', 'ID_REGISTRO', 'NUMERO', 'FECHA', 'ASESORA', 'NOTA', 'ANULADO', 'MOTIVO_ANULACION'])]);
  const ctx = contexto({ SESIONES: ses });
  assert.deepEqual(plano(ctx.conOp_('SESIONES', ctx.COLUMNAS_SESIONES)).slice(-1), ['OP']);
});

test('marcarAnulado_ y actualizarCeldas_ encuentran las columnas aunque tengan otra grafía', () => {
  const reg = hojaFalsa([['id', 'Anulado ', 'motivo_anulacion', 'Detalle'], ['REG-000001', '', '', 'AMO']]);
  const ctx = contexto({ REGISTROS: reg });
  ctx.actualizarCeldas_('REGISTROS', 'REG-000001', { DETALLE: 'BIOPSIA' });
  ctx.marcarAnulado_('REGISTROS', 'REG-000001', 'Prueba');
  assert.deepEqual(reg.v[1], ['REG-000001', 'SÍ', 'Prueba', 'BIOPSIA']);
});

test('«Verificar» revisa el encabezado de las hojas que se escriben: grafía, columnas movidas y renombradas', () => {
  const C = cargar(ARCHIVOS);
  const hojas = {
    SEGUIMIENTOS: hojaFalsa([C.COLUMNAS_SEGUIMIENTOS.concat(['OP'])]),
    SESIONES: hojaFalsa([C.COLUMNAS_SESIONES.concat(['OP']).map(c => c === 'FECHA' ? 'fecha' : c)]),
    BITACORA: hojaFalsa([swap(C.COLUMNAS_BITACORA.concat(['OP']), 'USUARIO', 'ACCION')]),
    REGISTROS: hojaFalsa([C.COLUMNAS_REGISTROS.concat(['OP']).map(c => c === 'TIPO' ? 'CLASE' : c)]),
    ALTAS: hojaFalsa([C.COLUMNAS_ALTAS.slice()]),
    ENFERMERIA: hojaFalsa([C.COLUMNAS_ENFERMERIA.concat(['OP'])])
  };
  const ctx = contexto(hojas);
  const avisos = [];
  ctx.SpreadsheetApp = { getUi: () => ({ alert: t => avisos.push(t) }), openById: () => { throw new Error('sin acceso'); } };
  ctx.ScriptApp = { getProjectTriggers: () => [] };
  ctx.leerSeguimientos_ = () => [];
  ctx.catalogos_ = () => ({ usuarios: ['MAGALY'], motivos: [], alias: {}, doctores: [], procedimientos: [], tratamientos: [], marcas: {}, reacciones: [] });
  ctx.verificar();
  const l = avisos[0].split('\n');
  assert.ok(l.includes('✓ SEGUIMIENTOS tiene todas sus columnas.'));
  assert.ok(l.includes('✓ ENFERMERIA tiene todas sus columnas.'));
  assert.ok(l.some(x => /^⚠ SESIONES: .*no coincide.*«fecha».*«FECHA»/.test(x)), l.join('\n'));
  assert.ok(l.some(x => /^⚠ BITACORA: columnas cambiadas de lugar \(ACCION, USUARIO\)/.test(x)), l.join('\n'));
  assert.ok(l.some(x => /^✗ REGISTROS: .*TIPO.*«CLASE»/.test(x)), l.join('\n'));
  assert.ok(l.includes('✗ A ALTAS le falta la columna OP. Use «Preparar hojas».'), l.join('\n'));
});

test('«Preparar hojas» agrega lo que falta aunque haya columnas movidas, y no toca una hoja con columnas renombradas', () => {
  const C = cargar(ARCHIVOS);
  const ses = hojaFalsa([swap(C.COLUMNAS_SESIONES, 'NUMERO', 'FECHA')]);
  const reg = hojaFalsa([C.COLUMNAS_REGISTROS.map(c => c === 'TIPO' ? 'CLASE' : c)]);
  const ctx = contexto({ SESIONES: ses, REGISTROS: reg });
  const cambios = [...ctx.ampliarHojas_()];
  assert.equal(ses.v[0][ses.v[0].length - 1], 'OP');
  assert.ok(cambios.includes('SESIONES: columna OP.'), cambios.join('\n'));
  assert.ok(cambios.some(c => /^⚠ SESIONES: columnas cambiadas de lugar/.test(c)));
  assert.ok(cambios.some(c => /^✗ REGISTROS: el encabezado no coincide/.test(c)), cambios.join('\n'));
  assert.equal(reg.v[0].length, C.COLUMNAS_REGISTROS.length, 'no agrega nada a REGISTROS');
});
