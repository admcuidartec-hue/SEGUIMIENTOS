// Interfaz nueva (rediseño de la Etapa 1) en modo DEMO: src/Index.html abierto como archivo. Datos inventados.
// Las pruebas de la interfaz anterior quedan en la historia de git.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ARCHIVO = path.join(__dirname, '..', 'src', 'Index.html');
const SECCIONES = ['tablero', 'registro', 'pacientes', 'indicadores'];

/**
 * Abre la app en modo DEMO y junta los `pageerror`.
 * opciones: viewport, colorScheme ('light' | 'dark'), guardado ({ clave: valor } en localStorage antes de cargar),
 * fallar ({ fn: 'mensaje' } en window.DEMO_FALLAR antes de cargar), sinEsperar (no espera a S.boot).
 */
async function abrir(opciones = {}) {
  const navegador = await chromium.launch();
  const contexto = await navegador.newContext({
    viewport: opciones.viewport || { width: 1440, height: 900 },
    colorScheme: opciones.colorScheme || 'light'
  });
  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on('pageerror', e => errores.push(e.message));
  try {
    if (opciones.guardado) {
      await pagina.addInitScript(g => { for (const k of Object.keys(g)) localStorage.setItem(k, g[k]); }, opciones.guardado);
    }
    if (opciones.fallar) await pagina.addInitScript(f => { window.DEMO_FALLAR = f; }, opciones.fallar);
    await pagina.goto('file://' + ARCHIVO, { waitUntil: 'domcontentloaded' });
    if (!opciones.sinEsperar) await pagina.waitForFunction(() => typeof S !== 'undefined' && !!S.boot, null, { timeout: 10000 });
  } catch (e) {
    await navegador.close();   // si no, el navegador queda abierto y la corrida no termina
    throw e;
  }
  return { navegador, pagina, errores };
}

const visible = (p, sel) => p.locator(sel).isVisible();

test('carga sin errores: menú con las cuatro secciones, arranca con bootstrap y nunca con getKpi', async () => {
  const { navegador, pagina, errores } = await abrir();
  try {
    assert.deepEqual((await pagina.locator('.menu [data-sec]').allTextContents()).map(t => t.trim()),
      ['Tablero', 'Registro', 'Pacientes', 'Indicadores']);
    assert.equal(await pagina.locator('[data-sec][href^="#"]').count(), 0, 'el menú no navega con href="#…"');
    assert.ok(await visible(pagina, '#v-tablero'));
    await pagina.waitForFunction(() => S.fase === 'listo');
    const llamadas = await pagina.evaluate(() => DEMO._llamadas);
    assert.equal(llamadas.bootstrap, 1);
    assert.equal(llamadas.getTablero, 1, 'el tablero se pide una vez al arrancar');
    assert.equal(llamadas.getKpi, undefined);
    assert.equal(await pagina.locator('base').getAttribute('target'), '_top');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('el menú cambia de pantalla y marca el ítem con aria-current', async () => {
  const { navegador, pagina, errores } = await abrir();
  try {
    for (const sec of ['registro', 'pacientes', 'indicadores', 'tablero']) {
      await pagina.locator(`.menu [data-sec="${sec}"]`).click();
      await pagina.waitForSelector(`#v-${sec}`, { state: 'visible' });
      for (const otra of SECCIONES.filter(s => s !== sec)) assert.equal(await visible(pagina, `#v-${otra}`), false, `${sec}: ${otra} oculta`);
      if (sec !== 'tablero') assert.match(await pagina.locator(`#v-${sec}`).textContent(), /Cargando…/);
      assert.deepEqual(await pagina.locator('.menu [aria-current="page"]').evaluateAll(l => l.map(x => x.dataset.sec)), [sec]);
    }
    assert.equal(await pagina.locator('#v-registro h1').textContent(), 'Registro');
    assert.equal(await pagina.locator('#v-pacientes h1').textContent(), 'Pacientes');
    assert.equal(await pagina.locator('#v-indicadores h1').textContent(), 'Indicadores');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('«¿Quién es usted?» arranca vacío, sin usuario por omisión', async () => {
  const { navegador, pagina, errores } = await abrir();
  try {
    assert.equal(await pagina.locator('.side .js-usuario').inputValue(), '');
    assert.equal(await pagina.locator('.topmovil .js-usuario').inputValue(), '');
    const opciones = await pagina.locator('.side .js-usuario option').evaluateAll(l => l.map(o => [o.value, o.textContent]));
    assert.deepEqual(opciones, [['', '— Elija —'], ['MAGALY', 'Magaly'], ['ANA', 'Ana'], ['RACHEL', 'Rachel'], ['DR. ELI CABANILLAS', 'Dr. Eli Cabanillas']]);
    assert.equal(await pagina.evaluate(() => exigirUsuario()), false);
    assert.equal(await pagina.locator('#aviso span').textContent(), 'Elija quién es usted.');
    // Los dos selectores se sincronizan y el elegido se recuerda en seg.usuario.
    await pagina.locator('.side .js-usuario').selectOption('RACHEL');
    assert.equal(await pagina.locator('.topmovil .js-usuario').inputValue(), 'RACHEL');
    assert.equal(await pagina.evaluate(() => [S.usuario, localStorage.getItem('seg.usuario'), exigirUsuario()].join('|')), 'RACHEL|RACHEL|true');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('«¿Quién es usted?» recuerda seg.usuario si está en el catálogo', async () => {
  let { navegador, pagina, errores } = await abrir({ guardado: { 'seg.usuario': 'MAGALY' } });
  try {
    assert.equal(await pagina.locator('.side .js-usuario').inputValue(), 'MAGALY');
    assert.equal(await pagina.evaluate(() => S.usuario), 'MAGALY');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
  ({ navegador, pagina, errores } = await abrir({ guardado: { 'seg.usuario': 'Magaly' } }));
  try {
    assert.equal(await pagina.locator('.side .js-usuario').inputValue(), '', 'fuera del catálogo (otra grafía): vacío');
    assert.equal(await pagina.evaluate(() => S.usuario), '');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('modo oscuro: el botón cambia data-modo y lo guarda en seg.modo', async () => {
  const { navegador, pagina, errores } = await abrir();
  try {
    assert.equal(await pagina.evaluate(() => document.documentElement.dataset.modo), 'claro');
    assert.match(await pagina.locator('.side .js-tema').textContent(), /Modo oscuro/);
    await pagina.locator('.side .js-tema').click();
    assert.equal(await pagina.evaluate(() => document.documentElement.dataset.modo), 'oscuro');
    assert.equal(await pagina.evaluate(() => localStorage.getItem('seg.modo')), 'oscuro');
    assert.match(await pagina.locator('.side .js-tema').textContent(), /Modo claro/);
    // El fondo sale del token oscuro (--bg), no de un color escrito a mano.
    await pagina.waitForFunction(() => getComputedStyle(document.body).backgroundColor === 'rgb(14, 16, 21)');
    await pagina.locator('.side .js-tema').click();
    assert.equal(await pagina.evaluate(() => localStorage.getItem('seg.modo')), 'claro');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('modo oscuro: la primera vez sigue al sistema; luego manda lo guardado', async () => {
  let { navegador, pagina, errores } = await abrir({ colorScheme: 'dark' });
  try {
    assert.equal(await pagina.evaluate(() => document.documentElement.dataset.modo), 'oscuro');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
  ({ navegador, pagina, errores } = await abrir({ colorScheme: 'dark', guardado: { 'seg.modo': 'claro' } }));
  try {
    assert.equal(await pagina.evaluate(() => document.documentElement.dataset.modo), 'claro');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('celular de 390×844: barra superior y barra inferior, sin scroll horizontal', async () => {
  const { navegador, pagina, errores } = await abrir({ viewport: { width: 390, height: 844 } });
  try {
    assert.ok(await visible(pagina, '.topmovil'));
    assert.ok(await visible(pagina, '.navmovil'));
    assert.equal(await visible(pagina, '.side'), false);
    assert.ok(await visible(pagina, '.topmovil .js-usuario'));
    assert.ok(await visible(pagina, '.topmovil .js-tema'));
    for (const sec of SECCIONES) {
      await pagina.locator(`.navmovil [data-sec="${sec}"]`).click();
      await pagina.waitForSelector(`#v-${sec}`, { state: 'visible' });
      assert.equal(await pagina.locator(`.navmovil [data-sec="${sec}"]`).getAttribute('aria-current'), 'page');
      assert.ok(await pagina.evaluate(() => document.documentElement.scrollWidth <= 390), sec);
    }
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('adaptadores: adaptarBoot, nombreBonito, telBonito y medicoCorto', async () => {
  const { navegador, pagina, errores } = await abrir();
  try {
    const r = await pagina.evaluate(() => ({
      boot: S.boot,
      nombres: ['ROSA ELENA QUISPE HUAMÁN', 'TERESA DEL PILAR ROJAS VARGAS', 'DR. ELI CABANILLAS', ''].map(nombreBonito),
      tels: ['987654321', '', '@ana.flores'].map(telBonito),
      medicos: ['Dr. ELÍ FABRIZIO CABANILLAS HUALPA', 'Dra. ALEJANDRA LA TORRE MATUK', 'Dr. JUVENAL HANAMPA ROQUE'].map(medicoCorto)
    }));
    assert.deepEqual(Object.keys(r.boot).sort(),
      ['doctores', 'especialidades', 'hoy', 'marcas', 'medicos', 'procedimientos', 'reglas', 'tratamientos', 'usuarios']);
    assert.deepEqual(r.boot.usuarios[0], { v: 'MAGALY', l: 'Magaly', rol: 'Asesora', med: '' });
    assert.deepEqual(r.boot.usuarios[3], { v: 'DR. ELI CABANILLAS', l: 'Dr. Eli Cabanillas', rol: 'Médico', med: 'Dr. ELÍ FABRIZIO CABANILLAS HUALPA' });
    assert.deepEqual(r.boot.medicos.find(m => m.k === 'Dra. ALEJANDRA LA TORRE MATUK'),
      { k: 'Dra. ALEJANDRA LA TORRE MATUK', full: 'Dra. ALEJANDRA LA TORRE MATUK', short: 'Dra. La Torre' });
    assert.equal(r.boot.hoy, '2026-10-01');
    assert.equal(r.boot.reglas.metaDiaria, 15);
    assert.deepEqual(r.nombres, ['Rosa Elena Quispe Huamán', 'Teresa del Pilar Rojas Vargas', 'Dr. Eli Cabanillas', '']);
    assert.deepEqual(r.tels, ['987 654 321', '', '@ana.flores']);
    assert.deepEqual(r.medicos, ['Dr. Cabanillas', 'Dra. La Torre', 'Dr. Hanampa']);
    assert.equal(await pagina.evaluate(() => S.reglas.maxSeguimientos), 3);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('DEMO: formas reales de getTablero, copias y contadores de llamadas', async () => {
  const { navegador, pagina, errores } = await abrir();
  try {
    const antes = await pagina.evaluate(() => DEMO._llamadas.getTablero || 0);
    const t = await pagina.evaluate(() => llamar('getTablero'));
    assert.deepEqual(Object.keys(t), ['columnas', 'cerrados', 'cifras']);
    assert.deepEqual(Object.keys(t.columnas), ['POR_CONTACTAR', 'AGENDADO', 'EN_TRATAMIENTO', 'COMPLETADO']);
    for (const c of Object.keys(t.columnas)) {
      assert.ok(t.columnas[c].length > 0, c);
      for (const x of t.columnas[c]) {
        assert.equal(x.COLUMNA, c);
        assert.equal(typeof x.CLAVE, 'string');
        assert.ok(x.ETIQUETA, x.CLAVE);
        assert.ok(Array.isArray(x.TELEFONOS_DESCARTADOS));
        assert.equal(typeof x.SIN_CONTACTO, 'boolean');
      }
    }
    assert.deepEqual(t.columnas.AGENDADO.map(x => x.AGENDA).sort(), ['CITA', 'LLAMAR', 'REINTENTAR', 'SIN RESPUESTA']);
    assert.ok(t.columnas.POR_CONTACTAR.some(x => x.ATRASO > 0), 'sesión atrasada en Por contactar');
    assert.ok(t.columnas.POR_CONTACTAR.some(x => x.USUARIO), 'paciente con usuario @');
    assert.ok(t.columnas.POR_CONTACTAR.some(x => x.SIN_CONTACTO), 'paciente sin teléfono');
    assert.equal(t.cifras.porContactar, t.columnas.POR_CONTACTAR.length);
    assert.equal(t.cifras.cerradosMes, t.cerrados.length);
    assert.equal(typeof t.cifras.hechosHoyPor, 'object');
    // llamar devuelve copias: tocar la respuesta no cambia el DEMO.
    const intacto = await pagina.evaluate(async () => {
      const a = await llamar('getTablero'); a.columnas.POR_CONTACTAR.length = 0;
      return (await llamar('getTablero')).columnas.POR_CONTACTAR.length;
    });
    assert.equal(intacto, t.columnas.POR_CONTACTAR.length);
    assert.equal(await pagina.evaluate(() => DEMO._llamadas.getTablero), antes + 3);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('DEMO: un error del servidor llega a llamar como Error con su mensaje', async () => {
  const { navegador, pagina, errores } = await abrir();
  try {
    const m = await pagina.evaluate(async () => {
      DEMO._fallar.getTablero = 'Se cayó la conexión.';
      try { await llamar('getTablero'); return 'sin error'; } catch (e) { return (e instanceof Error) + ' ' + e.message; }
    });
    assert.equal(m, 'true Se cayó la conexión.');
    const sinUsuario = await pagina.evaluate(async () => {
      try { await llamar('registrarResultado', { dni: '40444555', especialidad: 'HEMATOLOGÍA', resultado: 'NO CONTESTÓ' }); return 'sin error'; } catch (e) { return e.message; }
    });
    assert.equal(sinUsuario, 'Elija quién es usted en el selector de arriba.');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('si bootstrap falla, cada pantalla dice «No se pudo iniciar: …»', async () => {
  const { navegador, pagina, errores } = await abrir({ fallar: { bootstrap: 'Sin conexión con el servidor.' }, sinEsperar: true });
  try {
    await pagina.waitForFunction(() => /No se pudo iniciar/.test(document.querySelector('#v-tablero').textContent));
    assert.match(await pagina.locator('#v-tablero .cargando').textContent(), /^No se pudo iniciar: Sin conexión con el servidor\.$/);
    assert.equal(await pagina.evaluate(() => S.boot), null);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('el DEMO llega como del servidor: nulos y NaN pasan a \'\' (limpiarParaEnvio)', async () => {
  const { navegador, pagina, errores } = await abrir();
  try {
    const p = await pagina.evaluate(() => llamar('getPaciente', '40444555'));
    assert.equal(p.fallecido, '');
    const r = await pagina.evaluate(async () => {
      DEMO.pruebaNaN = () => ({ n: NaN, i: Infinity, nada: null, falta: undefined, lista: [null, 1] });
      const a = await llamar('pruebaNaN');
      DEMO.pruebaNada = () => undefined;
      return [a, await llamar('pruebaNada')];
    });
    assert.deepEqual(r, [{ n: '', i: '', nada: '', falta: '', lista: ['', 1] }, '']);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('DEMO: series para quien solo vino por hierro o procedimiento, y usuario sin distinguir mayúsculas', async () => {
  const { navegador, pagina, errores } = await abrir();
  try {
    const r = await pagina.evaluate(async () => {
      const p = await llamar('getPaciente', '40111222');
      const a = await llamar('registrarResultado', { usuario: 'magaly', dni: '40444555', especialidad: 'HEMATOLOGÍA', resultado: 'NO CONTESTÓ' });
      return { series: p.series.map(s => s.ESPECIALIDAD + ' ' + s.ESTADO + ' ' + s.N_REALIZADAS), quien: a.seguimiento.RESPONSABLE };
    });
    assert.deepEqual(r.series, ['HEMATOLOGÍA AL DÍA 1']);
    assert.equal(r.quien, 'MAGALY');
    const vencidas = await pagina.evaluate(async () => {
      const t = await llamar('getTablero');
      const enTablero = new Set(t.columnas.POR_CONTACTAR.map(x => x.DNI));
      const out = [];
      for (const dni of ['40111222', '40555666', '40666777', '40888999', '41000111', '41111222', '41333444', '41444555', '41555666', '41777888']) {
        (await llamar('getPaciente', dni)).series.forEach(s => { if (s.ESTADO === 'VENCIDO' && !enTablero.has(dni)) out.push(dni); });
      }
      return out;
    });
    assert.deepEqual(vencidas, [], 'ninguna serie vencida fuera del tablero');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('no hay colores escritos a mano fuera de la paleta', () => {
  const html = fs.readFileSync(ARCHIVO, 'utf8');
  const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
  assert.ok(/:root\{/.test(css) && /html\[data-modo="oscuro"\]\{/.test(css), 'los dos bloques de tokens existen');
  const resto = css.replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/:root\{[^}]*\}/, '').replace(/html\[data-modo="oscuro"\]\{[^}]*\}/, '');
  assert.equal(resto.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|color-mix\(/g), null);
  // Colores con nombre, solo como valor CSS (tras ':', espacio, coma o paréntesis y antes de ; } ! , o ')').
  const NOMBRES = 'white|black|red|green|blue|gray|grey|orange|yellow|purple|pink|brown';
  assert.equal(resto.match(new RegExp(`[:\\s,(](${NOMBRES})\\s*(?=[;}!,)])`, 'gi')), null);
  const fuera = html.replace(/<style>[\s\S]*?<\/style>/, '').replace(/<script>[\s\S]*<\/script>/, '');
  assert.equal(fuera.match(/style="[^"]*(#[0-9a-fA-F]{3,8}\b|rgba?\()/g), null, 'ni en atributos style');
});

/* ============ Tablero (Tarea 5) ============ */

const COL_N = { POR_CONTACTAR: '1', AGENDADO: '2', EN_TRATAMIENTO: '3', COMPLETADO: '4' };
const HOY = '2026-10-01';
const entre = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000);
/** Días de una tarjeta de Por contactar: reevaluación desde PROXIMA_ESPERADA; hierro y procedimiento, DIAS. */
const diasDe = t => t.TIPO_SEGUIMIENTO === 'REEVALUACION' ? entre(t.PROXIMA_ESPERADA, HOY) : Number(t.DIAS) || 0;
const grupoDe = d => d <= 30 ? 'rec' : d <= 60 ? 'mes' : 'ant';

/** Abre con seg.usuario = 'MAGALY' y espera a que el tablero tenga tarjetas. */
async function abrirTablero(opciones = {}) {
  const r = await abrir(Object.assign({}, opciones, { guardado: Object.assign({ 'seg.usuario': 'MAGALY' }, opciones.guardado || {}) }));
  try {
    if (!opciones.sinTarjetas) await r.pagina.waitForSelector('#tablero .tarjeta', { timeout: 10000 });
  } catch (e) { await r.navegador.close(); throw e; }
  return r;
}
/** Lo que el DEMO tiene ahora, sin pasar por la interfaz (copia vía llamar). */
const datosDemo = pagina => pagina.evaluate(() => llamar('getTablero'));
/** Tarjetas pintadas en una columna: [{ id, texto, grupo }] en orden de pantalla. */
const pintadas = (pagina, n) => pagina.evaluate(n => {
  let grupo = '';
  const out = [];
  document.querySelectorAll(`#tablero [data-col="${n}"] > *`).forEach(el => {
    if (el.tagName === 'H3') grupo = el.dataset.grupo;
    if (el.dataset.card) out.push({ id: el.dataset.card, texto: el.textContent.replace(/\s+/g, ' ').trim(), grupo });
  });
  return out;
}, n);

test('tablero: las cuatro columnas tienen las tarjetas del DEMO, cada una con su ETIQUETA literal', async () => {
  const { navegador, pagina, errores } = await abrirTablero();
  try {
    const d = await datosDemo(pagina);
    for (const c of Object.keys(COL_N)) {
      const claves = d.columnas[c].map(t => t.CLAVE);
      const vistas = await pintadas(pagina, COL_N[c]);
      assert.ok(vistas.length > 0, c);
      for (const v of vistas) {
        assert.ok(claves.includes(v.id), `${v.id} pintada en ${c} y el servidor la pone en otra`);
        const t = d.columnas[c].find(x => x.CLAVE === v.id);
        assert.ok(v.texto.includes(t.ETIQUETA), `${v.id}: «${t.ETIQUETA}» en «${v.texto}»`);
      }
      if (c !== 'POR_CONTACTAR') assert.deepEqual(vistas.map(v => v.id).sort(), claves.slice().sort(), `${c}: todas`);
    }
    const lucia = (await pintadas(pagina, '2')).find(v => v.id === '40999000|HEMATOLOGÍA');
    assert.ok(lucia.texto.includes('Reintentar el 02/10 · intento 2 de 3'), lucia.texto);
    // Rojo solo con ATRASO > 0 o SIN RESPUESTA.
    const mal = await pagina.evaluate(() => [...document.querySelectorAll('#tablero [data-card] .etq.mal')].map(e => e.closest('[data-card]').dataset.card).sort());
    const enRojo = Object.values(d.columnas).flat().filter(t => Number(t.ATRASO) > 0 || t.AGENDA === 'SIN RESPUESTA').map(t => t.CLAVE).sort();
    assert.deepEqual(enRojo, ['REG-000001', 'REG-000004'], 'el DEMO tiene una atrasada y una sin respuesta');
    assert.deepEqual(mal, enRojo);
    // Agendado: «Esta semana» (FECHA_CLAVE ≤ hoy + 6) y «Más adelante», con el chip según AGENDA.
    const ag = await pintadas(pagina, '2');
    const grupo = Object.fromEntries(ag.map(v => [v.id, v.grupo]));
    assert.equal(grupo['40999000|HEMATOLOGÍA'], 'semana');
    assert.equal(grupo['40777888|HEMATOLOGÍA'], 'semana');
    assert.equal(grupo['40888999|HIERRO'], 'despues');
    assert.equal(grupo['REG-000004'], 'despues');
    const chip = id => pagina.evaluate(id => [...document.querySelectorAll('[data-card]')].find(e => e.dataset.card === id).querySelector('.chip-fecha').textContent.trim(), id);
    assert.equal(await chip('40777888|HEMATOLOGÍA'), 'Cita lun 05/10');
    assert.equal(await chip('40888999|HIERRO'), 'Llamar jue 08/10');
    assert.equal(await chip('40999000|HEMATOLOGÍA'), 'Reintentar 02/10');
    assert.deepEqual(await pagina.locator('#tablero [data-col="2"] h3').evaluateAll(l => l.map(h => h.dataset.grupo)), ['semana', 'despues']);
    // La clave es texto y el adaptador conserva la forma de la referencia.
    const p = await pagina.evaluate(() => S.pacientes.find(x => x.id === '40444555|HEMATOLOGÍA'));
    assert.equal(p.col, 1);
    assert.equal(p.t, 'reev');
    assert.equal(p.dias, 20);
    assert.equal(p.perfil, 'Paciente nuevo');
    assert.deepEqual(p.tel, ['923456789']);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('tablero: Por contactar en tres grupos, en el orden del servidor, con «Ver 10 más de N»', async () => {
  const { navegador, pagina, errores } = await abrirTablero();
  try {
    const d = await datosDemo(pagina);
    const pc = d.columnas.POR_CONTACTAR;
    const por = { rec: [], mes: [], ant: [] };
    pc.forEach(t => por[grupoDe(diasDe(t))].push(t.CLAVE));   // ya vienen en el orden del servidor
    assert.ok(por.rec.length > 16, 'el DEMO tiene suficientes recientes para «Ver 10 más»');
    assert.deepEqual(await pagina.locator('#tablero [data-col="1"] h3').evaluateAll(l => l.map(h => h.dataset.grupo)), ['rec', 'mes', 'ant']);
    assert.match(await pagina.locator('#tablero [data-col="1"] h3[data-grupo="rec"]').textContent(), /Recientes/);
    assert.match(await pagina.locator('#tablero [data-col="1"] h3[data-grupo="mes"]').textContent(), /Hace 1 a 2 meses/);
    assert.match(await pagina.locator('#tablero [data-col="1"] h3[data-grupo="ant"]').textContent(), /Más antiguos/);
    let vistas = await pintadas(pagina, '1');
    const de = g => vistas.filter(v => v.grupo === g).map(v => v.id);
    assert.deepEqual(de('rec'), por.rec.slice(0, 6), 'recientes: 6, en el orden del servidor');
    assert.deepEqual(de('mes'), por.mes.slice(0, 4));
    assert.deepEqual(de('ant'), por.ant.slice(0, 3));
    const resto = por.rec.length - 6;
    assert.equal((await pagina.locator('[data-mas="rec"]').textContent()).trim(), `Ver 10 más de ${resto}`);
    assert.equal(await pagina.locator('[data-mas="mes"]').count(), por.mes.length > 4 ? 1 : 0);
    await pagina.locator('[data-mas="rec"]').click();
    vistas = await pintadas(pagina, '1');
    assert.deepEqual(de('rec'), por.rec.slice(0, 16));
    assert.equal((await pagina.locator('[data-mas="rec"]').textContent()).trim(), `Ver ${por.rec.length - 16} más de ${por.rec.length - 16}`);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('tablero: las cifras coinciden con el DEMO y «N cerrados este mes» abre la lista', async () => {
  const { navegador, pagina, errores } = await abrirTablero();
  try {
    const d = await datosDemo(pagina);
    const celdas = await pagina.locator('#kpis > div').evaluateAll(l => l.map(c => ({
      dt: c.querySelector('dt').textContent.trim(), dd: c.querySelector('dd').textContent.trim(),
      span: c.querySelector('span').textContent.replace(/\s+/g, ' ').trim(), mal: c.querySelector('span').classList.contains('mal') })));
    const pc = d.columnas.POR_CONTACTAR;
    const sinIntento = pc.filter(t => Number(t.N_SEGUIMIENTOS) === 0).length;
    const atrasadas = pc.filter(t => Number(t.ATRASO) > 0).length;
    assert.deepEqual(celdas.map(c => c.dt), ['Por contactar', 'Agendados', 'En tratamiento', 'Completados en el mes']);
    assert.deepEqual(celdas.map(c => c.dd), [d.cifras.porContactar, d.cifras.agendados, d.cifras.enTratamiento, d.cifras.completadosMes].map(String));
    assert.equal(celdas[0].span, `${sinIntento} sin ningún intento`);
    assert.equal(celdas[1].span, '1 cita esta semana');
    assert.equal(atrasadas, 1);
    assert.equal(celdas[2].span, '1 sesión atrasada');
    assert.equal(celdas[2].mal, true);
    assert.match(celdas[3].span, new RegExp(`${d.cerrados.length} cerrados este mes`));
    assert.equal(await visible(pagina, '#cerrados'), false);
    await pagina.locator('#ver-cerrados').click();
    assert.ok(await visible(pagina, '#cerrados'));
    const filas = await pagina.locator('#cerrados li').evaluateAll(l => l.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
    assert.equal(filas.length, 2);
    assert.match(filas[0], /Héctor Manuel Silva Prado/); assert.match(filas[0], /Reevaluación/);
    assert.match(filas[0], /Se atiende en otro lugar/); assert.match(filas[0], /20\/09\/2026/);
    assert.match(filas[1], /Rosa Amelia Cárdenas Ríos/); assert.match(filas[1], /Falleció/); assert.match(filas[1], /24\/09\/2026/);
    assert.match(await pagina.locator('#subtit').textContent(), /^Jueves 01\/10\/2026 · \d+ por contactar$/);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('tablero: el filtro por tipo cambia los números y se recuerda; «Solo sin teléfono» usa SIN_CONTACTO', async () => {
  const { navegador, pagina, errores } = await abrirTablero();
  try {
    const d = await datosDemo(pagina);
    const pc = d.columnas.POR_CONTACTAR;
    const n = tipo => pc.filter(t => !tipo || t.TIPO_SEGUIMIENTO === tipo).length;
    const seg = () => pagina.locator('#seg button').evaluateAll(l => l.map(b => b.textContent.replace(/\s+/g, ' ').trim()));
    assert.deepEqual(await seg(), [`Todos ${n('')}`, `Reevaluaciones ${n('REEVALUACION')}`, `Hierro ${n('HIERRO')}`, `Procedimientos ${n('PROCEDIMIENTO')}`]);
    const cifra = () => pagina.locator('#kpis > div:first-child dd').textContent();
    assert.equal(await cifra(), String(n('')));
    await pagina.locator('#seg button', { hasText: 'Hierro' }).click();
    assert.equal(await cifra(), String(n('HIERRO')));
    assert.deepEqual(await seg(), [`Todos ${n('')}`, `Reevaluaciones ${n('REEVALUACION')}`, `Hierro ${n('HIERRO')}`, `Procedimientos ${n('PROCEDIMIENTO')}`], 'los números del segmentado no dependen del tipo');
    assert.equal(await pagina.evaluate(() => localStorage.getItem('seg.tipo')), 'HIERRO');
    const ids = (await pintadas(pagina, '1')).map(v => v.id);
    assert.deepEqual(ids.slice().sort(), pc.filter(t => t.TIPO_SEGUIMIENTO === 'HIERRO').map(t => t.CLAVE).sort());
    // Se recuerda al recargar.
    await pagina.reload();
    await pagina.waitForSelector('#tablero .tarjeta');
    assert.equal(await pagina.locator('#seg button[aria-pressed="true"]').textContent().then(t => t.replace(/\s+/g, ' ').trim()), `Hierro ${n('HIERRO')}`);
    assert.equal(await cifra(), String(n('HIERRO')));
    await pagina.locator('#seg button', { hasText: 'Todos' }).click();
    assert.equal(await pagina.evaluate(() => localStorage.getItem('seg.tipo')), '');
    // Solo sin teléfono: solo las tarjetas con SIN_CONTACTO, en todas las columnas.
    await pagina.locator('#fsin').click();
    assert.equal(await pagina.locator('#fsin').getAttribute('aria-pressed'), 'true');
    const todas = await pagina.locator('#tablero [data-card]').evaluateAll(l => l.map(e => e.dataset.card));
    assert.deepEqual(todas, Object.values(d.columnas).flat().filter(t => t.SIN_CONTACTO === true).map(t => t.CLAVE));
    assert.deepEqual(todas, ['40222333|HEMATOLOGÍA']);
    // Columnas vacías por los filtros: «Nadie con estos filtros.» y «Quitar filtros».
    assert.match(await pagina.locator('#tablero [data-col="2"] .vacio').textContent(), /Nadie con estos filtros\./);
    await pagina.locator('#tablero [data-col="2"] .js-quitar').click();
    assert.equal(await pagina.locator('#fsin').getAttribute('aria-pressed'), 'false');
    assert.equal(await pagina.locator('#tablero [data-col="2"] [data-card]').count(), d.columnas.AGENDADO.length);
    // Buscador por nombre (sin tildes) o DNI.
    await pagina.locator('#q').fill('lucia gomez');
    assert.deepEqual(await pagina.locator('#tablero [data-card]').evaluateAll(l => l.map(e => e.dataset.card)), ['40999000|HEMATOLOGÍA']);
    await pagina.locator('#q').fill('4111');
    assert.deepEqual(await pagina.locator('#tablero [data-card]').evaluateAll(l => l.map(e => e.dataset.card)), ['REG-000002']);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('tablero: la meta del día sale de hechosHoyPor y cambia con el usuario sin volver a llamar a getTablero', async () => {
  const { navegador, pagina, errores } = await abrirTablero();
  try {
    const d = await datosDemo(pagina);
    const meta = () => pagina.locator('#metadia').textContent().then(t => t.replace(/\s+/g, ' ').trim());
    assert.equal(await meta(), `Hoy: ${d.cifras.hechosHoyPor.MAGALY} de 15 seguimientos`);
    const antes = await pagina.evaluate(() => DEMO._llamadas.getTablero);
    await pagina.locator('.side .js-usuario').selectOption('RACHEL');
    assert.equal(await meta(), `Hoy: ${d.cifras.hechosHoyPor.RACHEL} de 15 seguimientos`);
    await pagina.locator('.side .js-usuario').selectOption('ANA');
    assert.equal(await meta(), 'Hoy: 0 de 15 seguimientos');
    await pagina.locator('.side .js-usuario').selectOption('');
    assert.equal(await meta(), 'Elija quién es usted');
    // Médico: se le propone su filtro, y puede cambiarlo a «Todos».
    await pagina.locator('.side .js-usuario').selectOption('DR. ELI CABANILLAS');
    assert.equal(await pagina.locator('#fmed').inputValue(), 'Dr. ELÍ FABRIZIO CABANILLAS HUALPA');
    assert.equal(await pagina.locator('#fmed').isDisabled(), false);
    const meds = await pagina.evaluate(() => [...new Set(S.pacientes.filter(p => !p.oculto).map(p => p.med))]);
    assert.ok(meds.length > 1);
    const soloEli = await pagina.locator('#tablero [data-card]').evaluateAll(l => l.map(e => e.dataset.card));
    assert.ok(soloEli.length > 0);
    assert.ok(await pagina.evaluate(ids => ids.every(id => S.pacientes.find(p => p.id === id).med === 'Dr. ELÍ FABRIZIO CABANILLAS HUALPA'), soloEli));
    assert.match(await pagina.locator('#subtit').textContent(), /· solo sus pacientes$/);
    await pagina.locator('#fmed').selectOption('');
    assert.ok(await pagina.locator('#tablero [data-card]').count() > soloEli.length);
    assert.equal(await pagina.evaluate(() => DEMO._llamadas.getTablero), antes, 'cambiar de usuario no recarga el tablero');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('tablero: teclado (↓ j k →, Enter abre el panel, Esc lo cierra, C copia, / busca)', async () => {
  const { navegador, pagina, errores } = await abrirTablero();
  try {
    const sel = () => pagina.evaluate(() => [seleccion.id, [...document.querySelectorAll('.tarjeta.sel')].map(e => e.dataset.card)]);
    const c1 = (await pintadas(pagina, '1')).map(v => v.id), c2 = (await pintadas(pagina, '2')).map(v => v.id);
    await pagina.keyboard.press('ArrowDown');
    assert.deepEqual(await sel(), [c1[0], [c1[0]]]);
    await pagina.keyboard.press('ArrowDown');
    assert.deepEqual(await sel(), [c1[1], [c1[1]]]);
    await pagina.keyboard.press('j');
    assert.deepEqual(await sel(), [c1[2], [c1[2]]]);
    await pagina.keyboard.press('k');
    assert.deepEqual(await sel(), [c1[1], [c1[1]]]);
    await pagina.keyboard.press('ArrowRight');
    assert.deepEqual(await sel(), [c2[1], [c2[1]]], '→ pasa a la tarjeta más cercana de la columna siguiente');
    assert.equal(await pagina.evaluate(() => document.activeElement.dataset.card), c2[1]);
    // C copia el primer teléfono de la tarjeta (sin espacios).
    await pagina.keyboard.press('c');
    const d = await datosDemo(pagina);
    const tel = d.columnas.AGENDADO.find(t => t.CLAVE === c2[1]).TELEFONOS.split(' / ')[0];
    await pagina.waitForFunction(tel => document.querySelector('#aviso span').textContent.includes(tel), tel);
    assert.match(await pagina.locator('#aviso span').textContent(), /^(Copiado: |No se pudo copiar\. El número es )\d{9}$/);
    // Enter abre el panel, sin animación, con el nombre; Esc lo cierra y vuelve a la tarjeta.
    await pagina.keyboard.press('Enter');
    assert.ok(await visible(pagina, '#panel'));
    assert.equal(await pagina.evaluate(() => seleccion.panel), c2[1]);
    const nombre = await pagina.evaluate(id => S.pacientes.find(p => p.id === id).n, c2[1]);
    assert.equal((await pagina.locator('#panel h2').textContent()).trim(), nombre);
    assert.ok(await pagina.evaluate(() => document.getElementById('panel').classList.contains('instantaneo')));
    await pagina.keyboard.press('ArrowDown');
    assert.equal(await pagina.evaluate(() => seleccion.id), c2[1], 'con el panel abierto las flechas no mueven');
    await pagina.keyboard.press('Escape');
    assert.equal(await pagina.evaluate(() => seleccion.panel), '');
    await pagina.waitForSelector('#panel', { state: 'hidden' });
    assert.equal(await pagina.evaluate(() => document.activeElement.dataset.card), c2[1]);
    // / va al buscador y Esc sale del campo.
    await pagina.keyboard.press('/');
    assert.equal(await pagina.evaluate(() => document.activeElement.id), 'q');
    assert.equal(await pagina.locator('#q').inputValue(), '', 'la barra no se escribe en el buscador');
    await pagina.keyboard.press('Escape');
    assert.notEqual(await pagina.evaluate(() => document.activeElement.id), 'q');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('tablero: error con «Reintentar», carga con esqueletos y columnas vacías', async () => {
  const { navegador, pagina, errores } = await abrirTablero({ fallar: { getTablero: 'Sin conexión.' }, sinTarjetas: true });
  try {
    await pagina.waitForSelector('.error', { state: 'visible' });
    assert.match(await pagina.locator('.error').textContent(), /No se pudo cargar el tablero\./);
    assert.match(await pagina.locator('.error').textContent(), /Lo que ya registró está guardado\./);
    assert.equal(await visible(pagina, '#tablero'), false);
    const antes = await pagina.evaluate(() => DEMO._llamadas.getTablero);
    await pagina.evaluate(() => { delete DEMO._fallar.getTablero; DEMO._demora.getTablero = 400; });
    await pagina.locator('.error button', { hasText: 'Reintentar' }).click();
    // Cargando: esqueletos y cifras con «—».
    await pagina.waitForSelector('#tablero .skel', { state: 'visible' });
    assert.equal(await pagina.locator('.error').count(), 0);
    assert.deepEqual(await pagina.locator('#kpis dd').allTextContents(), ['—', '—', '—', '—']);
    await pagina.waitForSelector('#tablero .tarjeta');
    assert.equal(await pagina.evaluate(() => DEMO._llamadas.getTablero), antes + 1);
    // Columnas vacías: el texto de cada columna, sin «Quitar filtros».
    await pagina.evaluate(() => {
      DEMO.getTablero = () => ({ columnas: { POR_CONTACTAR: [], AGENDADO: [], EN_TRATAMIENTO: [], COMPLETADO: [] }, cerrados: [],
        cifras: { porContactar: 0, agendados: 0, enTratamiento: 0, completadosMes: 0, cerradosMes: 0, hechosHoy: 0, hechosHoyPor: {} } });
      return cargarTablero();
    });
    assert.deepEqual(await pagina.locator('#tablero .vacio').allTextContents().then(l => l.map(t => t.trim())),
      ['No hay pacientes por contactar.', 'Sin citas ni llamadas agendadas.', 'Nadie en tratamiento.', 'Todavía no hay cierres este mes.']);
    assert.equal(await pagina.locator('#tablero .js-quitar').count(), 0);
    assert.equal(await pagina.locator('#metadia').textContent().then(t => t.replace(/\s+/g, ' ').trim()), 'Hoy: 0 de 15 seguimientos');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('tablero en celular: una columna a la vez, con pestañas, sin scroll horizontal', async () => {
  const { navegador, pagina, errores } = await abrirTablero({ viewport: { width: 390, height: 844 } });
  try {
    assert.ok(await visible(pagina, '#coltabs'));
    const visibles = () => pagina.locator('#tablero .col').evaluateAll(l => l.filter(c => c.offsetParent).map(c => c.dataset.col));
    assert.deepEqual(await visibles(), ['1']);
    await pagina.locator('#coltabs [data-ct="2"]').click();
    assert.deepEqual(await visibles(), ['2']);
    assert.equal(await pagina.locator('#coltabs [data-ct="2"]').getAttribute('aria-selected'), 'true');
    assert.ok(await pagina.evaluate(() => document.documentElement.scrollWidth <= 390));
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});
