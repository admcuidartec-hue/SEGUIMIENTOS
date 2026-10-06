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
      if (sec === 'indicadores') assert.match(await pagina.locator(`#v-${sec}`).textContent(), /Cargando…/);
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
    const mal = await pagina.evaluate(() => [...document.querySelectorAll('#tablero [data-card] .etq.mal, #tablero [data-card] .chip-fecha.mal')].map(e => e.closest('[data-card]').dataset.card).sort());
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
    for (const t of d.columnas.AGENDADO) assert.equal(await chip(t.CLAVE), t.ETIQUETA, `chip de ${t.CLAVE} = ETIQUETA`);
    assert.equal(await chip('40777888|HEMATOLOGÍA'), 'Cita el lun 05/10');
    assert.equal(await chip('40999000|HEMATOLOGÍA'), 'Reintentar el 02/10 · intento 2 de 3');
    assert.equal(await pagina.locator('#tablero [data-col="2"] [data-card] .etq').count(), 0, 'en Agendado la fecha no se repite');
    assert.equal(await pagina.evaluate(() => [...document.querySelectorAll('[data-card]')].find(e => e.dataset.card === 'REG-000004').querySelector('.chip-fecha').classList.contains('mal')), true);
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
    // Chromium sobre file://: a veces el PRIMER documento de un contexto nuevo tiene un localStorage que nunca se
    // guarda (otra página del mismo contexto lee null, y tras reload() también). Se vio en ~1 de 7 corridas y nunca
    // en un segundo documento (0 de 60). Por eso se recarga una vez antes de probar que la preferencia se recuerda.
    await pagina.reload();
    await pagina.waitForSelector('#tablero .tarjeta');
    await pagina.locator('#seg button', { hasText: 'Hierro' }).click();
    assert.equal(await cifra(), String(n('HIERRO')));
    assert.deepEqual(await seg(), [`Todos ${n('')}`, `Reevaluaciones ${n('REEVALUACION')}`, `Hierro ${n('HIERRO')}`, `Procedimientos ${n('PROCEDIMIENTO')}`], 'los números del segmentado no dependen del tipo');
    assert.equal(await pagina.evaluate(() => localStorage.getItem('seg.tipo')), 'HIERRO');
    // Otra página del mismo contexto ve el valor: quedó guardado de verdad antes de recargar.
    const otra = await pagina.context().newPage();
    await otra.goto('file://' + ARCHIVO, { waitUntil: 'domcontentloaded' });
    await otra.waitForFunction(() => localStorage.getItem('seg.tipo') === 'HIERRO', null, { timeout: 5000 });
    await otra.close();
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
    // Espacio también abre (role="button") y no desplaza la página.
    await pagina.evaluate(() => addEventListener('keydown', e => { if (e.key === ' ') window.espacioPrevenido = e.defaultPrevented; }));
    await pagina.keyboard.press(' ');
    assert.equal(await pagina.evaluate(() => seleccion.panel), c2[1]);
    assert.equal(await pagina.evaluate(() => window.espacioPrevenido), true, 'Espacio no desplaza la página');
    await pagina.keyboard.press('Escape');
    await pagina.waitForSelector('#panel', { state: 'hidden' });
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

/* ============ Panel del paciente y «¿Qué pasó?» (Tarea 6) ============ */

const LUIS = '40444555|HEMATOLOGÍA', CARMEN = '40333444|REUMATOLOGÍA', CARMEN_H = '40333444|HIERRO', PEDRO = '40666777|PROCEDIMIENTO';
const ROSA = 'REG-000001', SOFIA = 'REG-000002', TERESA = '41666777|HEMATOLOGÍA';
/** Columna (1-4) en la que está pintada la tarjeta, o '' si no está en el tablero. */
const colPintada = (pagina, id) => pagina.evaluate(id => {
  const el = [...document.querySelectorAll('#tablero [data-card]')].find(e => e.dataset.card === id);
  return el ? el.closest('.col').dataset.col : '';
}, id);
const esperarCol = (pagina, id, col) => pagina.waitForFunction(([id, col]) => {
  const el = [...document.querySelectorAll('#tablero [data-card]')].find(e => e.dataset.card === id);
  return (el ? el.closest('.col').dataset.col : '') === col;
}, [id, col]);
const textoTarjeta = (pagina, id) => pagina.evaluate(id => [...document.querySelectorAll('#tablero [data-card]')].find(e => e.dataset.card === id).textContent.replace(/\s+/g, ' ').trim(), id);
const llamadas = (pagina, fn) => pagina.evaluate(fn => DEMO._llamadas[fn] || 0, fn);
const ultimo = (pagina, fn) => pagina.evaluate(fn => DEMO._ultimo[fn][0], fn);
const aviso = pagina => pagina.locator('#aviso span').textContent();
async function abrirPanelDe(pagina, id) {
  await pagina.evaluate(() => { S.lim = { rec: 99, mes: 99, ant: 99 }; pintarTablero(); });
  await pagina.locator(`#tablero [data-card="${id}"]`).click();
  await pagina.waitForFunction(id => seleccion.panel === id && document.getElementById('panel').classList.contains('abierto'), id);
}
/** Pone la fecha del paso y confirma. */
async function confirmarPaso(pagina, fecha) {
  if (fecha) await pagina.locator('#panel #pf').fill(fecha);
  await pagina.locator('#panel [data-confirmar]').click();
}
async function esperarEstable(pagina) {
  await pagina.waitForFunction(() => !S.enVuelo.size);
}

test('panel: cada resultado mueve la tarjeta a la columna que dice el servidor', async () => {
  const { navegador, pagina, errores } = await abrirTablero();
  try {
    // «Lo pensará» con fecha: Agendado, «Llamar …». El payload es el de MAPEO §1.3.
    await abrirPanelDe(pagina, LUIS);
    await pagina.locator('#panel [data-acc="pensara"]').click();
    assert.equal(await pagina.locator('#panel #pf').inputValue(), '2026-10-02', 'propone mañana');
    assert.equal(await pagina.locator('#panel #pf').getAttribute('min'), '2026-10-02');
    assert.equal(await pagina.locator('#panel #pf').getAttribute('max'), '2026-12-30');
    await confirmarPaso(pagina, '2026-10-08');
    await esperarCol(pagina, LUIS, '2');
    await esperarEstable(pagina);
    assert.match(await textoTarjeta(pagina, LUIS), /Llamar el jue 08\/10/);
    assert.deepEqual(await ultimo(pagina, 'registrarResultado'), { usuario: 'MAGALY', dni: '40444555', especialidad: 'HEMATOLOGÍA', referencia: '',
      resultado: 'LO PENSARÁ', nota: '', fecha: '2026-10-08', telefono: '', motivo: '', doctor: '' });
    assert.equal(await pagina.evaluate(() => seleccion.panel), '', 'el panel se cierra al guardar');
    // «Agendó cita»: Agendado, «Cita …».
    await abrirPanelDe(pagina, CARMEN);
    await pagina.locator('#panel [data-acc="agendo"]').click();
    assert.equal(await pagina.locator('#panel #pf').inputValue(), '2026-10-01', 'sin PROXIMA_AGENDADA propone hoy');
    await confirmarPaso(pagina, '2026-10-06');
    await esperarCol(pagina, CARMEN, '2');
    await esperarEstable(pagina);
    assert.match(await textoTarjeta(pagina, CARMEN), /Cita el mar 06\/10/);
    // 1 sin abrir el panel: Agendado, «Reintentar …».
    const antes = await llamadas(pagina, 'registrarResultado');
    await pagina.locator(`#tablero [data-card="${PEDRO}"]`).focus();
    await pagina.keyboard.press('1');
    await esperarCol(pagina, PEDRO, '2');
    await esperarEstable(pagina);
    assert.equal(await pagina.evaluate(() => seleccion.panel), '', '1 no abre el panel');
    assert.equal(await llamadas(pagina, 'registrarResultado'), antes + 1);
    assert.match(await textoTarjeta(pagina, PEDRO), /Reintentar el 16\/10 · intento 1 de 3/);
    // «Lo hizo» en hierro a tiempo: sigue en En tratamiento con la sesión siguiente; la última pasa a Completado.
    await abrirPanelDe(pagina, SOFIA);
    await pagina.locator('#panel [data-acc="lohizo"]').click();
    assert.match(await pagina.locator('#panel .paso h4').textContent(), /Lo hizo · sesión 2 de 3/);
    await confirmarPaso(pagina, '2026-10-01');
    await esperarEstable(pagina);
    await esperarCol(pagina, SOFIA, '3');
    assert.match(await textoTarjeta(pagina, SOFIA), /Sesión 3 de 3/);
    await abrirPanelDe(pagina, SOFIA);
    await pagina.locator('#panel [data-acc="lohizo"]').click();
    assert.match(await pagina.locator('#panel .paso h4').textContent(), /Lo hizo · sesión 3 de 3/);
    assert.match(await pagina.locator('#panel [data-confirmar]').textContent(), /Marcar como completado/);
    await confirmarPaso(pagina, '2026-10-01');
    await esperarEstable(pagina);
    await esperarCol(pagina, SOFIA, '4');
    assert.match(await textoTarjeta(pagina, SOFIA), /Completó el tratamiento/);
    // Lo pintado coincide con lo que el DEMO (el servidor) tiene ahora.
    const d = await datosDemo(pagina);
    for (const [id, c] of [[LUIS, 'AGENDADO'], [CARMEN, 'AGENDADO'], [PEDRO, 'AGENDADO'], [SOFIA, 'COMPLETADO']]) {
      const t = d.columnas[c].find(x => x.CLAVE === id);
      assert.ok(t, `${id} en ${c} en el DEMO`);
      assert.ok((await textoTarjeta(pagina, id)).includes(t.ETIQUETA), `${id}: ${t.ETIQUETA}`);
    }
    assert.match(await pagina.locator('#metadia').textContent(), /Hoy: 11 de 15/, 'la meta suma 1 por guardado');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('panel: «Deshacer» devuelve la tarjeta y llama a la anulación que corresponde', async () => {
  const { navegador, pagina, errores } = await abrirTablero();
  try {
    const deshacer = async () => {
      await pagina.waitForSelector('#aviso button:not([hidden])');
      assert.equal(await pagina.locator('#aviso button').textContent(), 'Deshacer');
      await pagina.locator('#aviso button').click();
    };
    // Seguimiento: anularResultado.
    let tab = await llamadas(pagina, 'getTablero');
    await pagina.locator(`#tablero [data-card="${LUIS}"]`).focus();
    await pagina.keyboard.press('1');
    await esperarCol(pagina, LUIS, '2');
    await esperarEstable(pagina);
    assert.match(await pagina.locator('#metadia').textContent(), /Hoy: 7 de 15/);
    await deshacer();
    await pagina.waitForFunction(() => DEMO._llamadas.anularResultado === 1);
    await esperarCol(pagina, LUIS, '1');
    const a = await ultimo(pagina, 'anularResultado');
    assert.equal(a.usuario, 'MAGALY'); assert.equal(a.motivo, 'Deshecho al momento'); assert.match(a.id, /^SEG-/);
    assert.equal(await llamadas(pagina, 'getTablero'), tab + 1, 'después de deshacer se recarga el tablero');
    await pagina.waitForFunction(() => /Hoy: 6 de 15/.test(document.getElementById('metadia').textContent));
    // Sesión: anularSesion.
    await abrirPanelDe(pagina, SOFIA);
    await pagina.locator('#panel [data-acc="lohizo"]').click();
    await confirmarPaso(pagina);
    await esperarEstable(pagina);
    assert.match(await textoTarjeta(pagina, SOFIA), /Sesión 3 de 3/);
    await deshacer();
    await pagina.waitForFunction(() => DEMO._llamadas.anularSesion === 1);
    await pagina.waitForFunction(() => /Sesión 2 de 3/.test([...document.querySelectorAll('#tablero [data-card]')].find(e => e.dataset.card === 'REG-000002').textContent));
    assert.match((await ultimo(pagina, 'anularSesion')).id, /^SES-/);
    // Alta de una reevaluación: anularAlta.
    await abrirPanelDe(pagina, LUIS);
    await pagina.locator('#panel [data-acc="alta"]').click();
    assert.ok(await pagina.locator('#panel .paso.cierre').isVisible(), 'el alta cierra el seguimiento: borde de acento');
    assert.match(await pagina.locator('#panel .paso').textContent(), /¿Cerrar el seguimiento de Luis Alberto Ramos Vega/);
    assert.equal((await pagina.locator('#panel [data-confirmar]').textContent()).trim(), 'Confirmar alta');
    assert.equal(await pagina.locator('#panel #pd').inputValue(), 'Dra. Alejandra La Torre', 'propone el doctor de la tarjeta');
    assert.equal(await pagina.locator('#panel #pf').inputValue(), '2026-10-01', 'en reevaluación pide la fecha');
    await confirmarPaso(pagina);
    await esperarCol(pagina, LUIS, '4');
    await esperarEstable(pagina);
    assert.match(await textoTarjeta(pagina, LUIS), /Alta médica · Dra\. Alejandra La Torre/);
    await deshacer();
    await pagina.waitForFunction(() => DEMO._llamadas.anularAlta === 1);
    await esperarCol(pagina, LUIS, '1');
    assert.match((await ultimo(pagina, 'anularAlta')).id, /^ALT-/);
    assert.equal(await llamadas(pagina, 'anularResultado'), 1, 'cada respuesta, su anulación');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('panel: si el servidor falla, todo vuelve, «No se guardó: …» y sin «Deshacer»', async () => {
  const { navegador, pagina, errores } = await abrirTablero();
  try {
    const cifras = () => pagina.locator('#kpis dd').allTextContents();
    const antes = await cifras();
    await pagina.evaluate(() => { DEMO._fallar.registrarResultado = 'Sin conexión con el servidor.'; DEMO._demora.registrarResultado = 400; });
    await abrirPanelDe(pagina, LUIS);
    await pagina.locator('#panel [data-acc="pensara"]').click();
    await confirmarPaso(pagina, '2026-10-08');
    // Mientras tanto, se ve movida y la meta sumada.
    await esperarCol(pagina, LUIS, '2');
    assert.notDeepEqual(await cifras(), antes);
    assert.match(await pagina.locator('#metadia').textContent(), /Hoy: 7 de 15/);
    await pagina.waitForFunction(() => /No se guardó/.test(document.querySelector('#aviso span').textContent));
    assert.equal(await aviso(pagina), 'No se guardó: Sin conexión con el servidor.');
    await esperarCol(pagina, LUIS, '1');
    assert.equal(await pagina.locator('#aviso button').isVisible(), false, 'sin «Deshacer»');
    assert.deepEqual(await cifras(), antes);
    assert.match(await pagina.locator('#metadia').textContent(), /Hoy: 6 de 15/);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('panel: una tarjeta vieja («Ese paciente no está en la lista») vuelve con el aviso', async () => {
  const { navegador, pagina, errores } = await abrirTablero();
  try {
    await pagina.evaluate(() => { DEMO._fallar.registrarResultado = 'Ese paciente no está en la lista. Recargue la página.'; });
    await pagina.locator(`#tablero [data-card="${PEDRO}"]`).focus();
    await pagina.keyboard.press('1');
    await pagina.waitForFunction(() => /No se guardó/.test(document.querySelector('#aviso span').textContent));
    assert.equal(await aviso(pagina), 'No se guardó: Ese paciente no está en la lista. Recargue la página.');
    await esperarEstable(pagina);
    assert.equal(await colPintada(pagina, PEDRO), '1');
    assert.equal(await pagina.evaluate(id => S.pacientes.find(p => p.id === id).col, PEDRO), 1);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('panel: los cierres confirman en el panel; «Falleció» saca todas las tarjetas del DNI', async () => {
  const { navegador, pagina, errores } = await abrirTablero();
  try {
    const n = await llamadas(pagina, 'registrarResultado');
    await abrirPanelDe(pagina, CARMEN);
    await pagina.locator('#panel [data-acc="otrolugar"]').click();
    assert.ok(await pagina.locator('#panel .paso.cierre').isVisible(), 'el paso de cierre lleva el borde de acento');
    assert.match(await pagina.locator('#panel .paso').textContent(), /¿Cerrar el seguimiento de Carmen Sofía Torres Díaz/);
    assert.equal(await llamadas(pagina, 'registrarResultado'), n, 'elegir un cierre no guarda');
    await pagina.locator('#panel .paso [data-volverpaso]').first().click();
    assert.equal(await pagina.locator('#panel .paso').count(), 0);
    await pagina.locator('#panel [data-acc="fallecio"]').click();
    assert.match(await pagina.locator('#panel .paso').textContent(), /Se cerrarán todos sus seguimientos\./);
    assert.equal(await colPintada(pagina, CARMEN_H), '1', 'Carmen tiene otra tarjeta abierta (hierro)');
    await pagina.locator('#panel [data-confirmar]').click();
    await esperarEstable(pagina);
    await esperarCol(pagina, CARMEN, '');   // salen tras desvanecerse (180 ms)
    await esperarCol(pagina, CARMEN_H, '');
    assert.equal((await ultimo(pagina, 'registrarResultado')).resultado, 'FALLECIÓ');
    assert.match(await pagina.locator('#kpis').textContent(), /3 cerrados este mes/);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('panel: «Número equivocado» con dos teléfonos deja la tarjeta y tacha el número', async () => {
  const { navegador, pagina, errores } = await abrirTablero();
  try {
    await abrirPanelDe(pagina, ROSA);
    assert.equal(await pagina.locator('#panel .contacto:not(.malo)').count(), 2);
    await pagina.locator('#panel [data-acc="numero"]').click();
    assert.equal(await pagina.locator('#panel [data-confirmar]').isDisabled(), true, 'con varios, se elige cuál');
    assert.match(await pagina.locator('#panel .paso').textContent(), /Elija el número equivocado\./);
    await pagina.locator('#panel input[name="pn"][value="014332210"]').check();
    assert.match(await pagina.locator('#panel .paso').textContent(), /Le queda el 987 654 321: el seguimiento sigue\./);
    assert.equal(await pagina.locator('#panel .paso.cierre').count(), 0, 'si sigue, no es un cierre');
    await pagina.locator('#panel [data-confirmar]').click();
    await esperarEstable(pagina);
    assert.equal((await ultimo(pagina, 'registrarResultado')).telefono, '014332210');
    assert.equal(await colPintada(pagina, ROSA), '1', 'la tarjeta sigue');
    assert.equal(await pagina.evaluate(() => seleccion.panel), ROSA, 'el panel sigue abierto');
    await pagina.waitForFunction(() => /número equivocado: 014332210/.test((document.querySelector('#panel .historia') || {}).textContent || ''));
    // Deshacer con el panel abierto: la historia se vuelve a pedir y ya no trae ese número.
    const hist = await llamadas(pagina, 'getPaciente');
    await pagina.locator('#aviso button').click();
    await pagina.waitForFunction(() => DEMO._llamadas.anularResultado === 1);
    await pagina.waitForFunction(n => DEMO._llamadas.getPaciente > n, hist);
    await pagina.waitForFunction(() => document.querySelector('#panel .historia li.anulado'));
    assert.match(await pagina.locator('#panel .historia li.anulado').first().textContent(), /número equivocado: 014332210.*anulado: Deshecho al momento/);
    assert.equal(await pagina.locator('#panel .contacto.malo').count(), 0, 'el número vuelve a estar vigente');
    // Se marca otra vez, para seguir.
    await pagina.locator('#panel [data-acc="numero"]').click();
    await pagina.locator('#panel input[name="pn"][value="014332210"]').check();
    await pagina.locator('#panel [data-confirmar]').click();
    await esperarEstable(pagina);
    await pagina.keyboard.press('Escape');
    await pagina.waitForFunction(() => !seleccion.panel);
    await abrirPanelDe(pagina, ROSA);
    assert.deepEqual(await pagina.locator('#panel .contacto.malo .num').allTextContents(), ['014 332 210']);
    assert.equal(await pagina.locator('#panel .contacto:not(.malo)').count(), 1);
    // Con un solo teléfono, ese queda elegido y se avisa que se cierra.
    await pagina.keyboard.press('Escape');
    await abrirPanelDe(pagina, LUIS);
    await pagina.locator('#panel [data-acc="numero"]').click();
    assert.match(await pagina.locator('#panel .paso').textContent(), /No le queda otro contacto: se cerrará el seguimiento\./);
    assert.ok(await pagina.locator('#panel .paso.cierre').isVisible());
    assert.equal(await pagina.locator('#panel [data-confirmar]').isDisabled(), false);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('panel: «No desea continuar» no se guarda sin motivo; con motivo, sí', async () => {
  const { navegador, pagina, errores } = await abrirTablero();
  try {
    const n = await llamadas(pagina, 'registrarResultado');
    await abrirPanelDe(pagina, LUIS);
    assert.match(await pagina.locator('#panel [data-acc="otro"]').textContent(), /^\s*No desea continuar\s*$/);
    await pagina.locator('#panel [data-acc="otro"]').click();
    assert.equal(await pagina.locator('#panel [data-confirmar]').isDisabled(), true);
    await pagina.locator('#panel #pm').fill('   ');
    assert.equal(await pagina.locator('#panel [data-confirmar]').isDisabled(), true);
    await pagina.evaluate(() => confirmarPaso());
    assert.equal(await llamadas(pagina, 'registrarResultado'), n, 'sin motivo no sale nada');
    await pagina.locator('#panel #pm').fill('Se mudó a Arequipa');
    await pagina.locator('#panel [data-confirmar]').click();
    await esperarEstable(pagina);
    const p = await ultimo(pagina, 'registrarResultado');
    assert.equal(p.resultado, 'NO DESEA CONTINUAR');
    assert.equal(p.motivo, 'Se mudó a Arequipa');
    await esperarCol(pagina, LUIS, '');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('panel: la nota escrita antes de elegir el resultado llega en el payload', async () => {
  const { navegador, pagina, errores } = await abrirTablero();
  try {
    await abrirPanelDe(pagina, LUIS);
    await pagina.locator('#panel #nota').fill('Llamar después de las 5');
    await pagina.locator('#panel [data-acc="pensara"]').click();
    assert.equal(await pagina.locator('#panel #nota').inputValue(), 'Llamar después de las 5', 'elegir no borra la nota');
    await pagina.locator('#panel [data-volverpaso]').first().click();
    assert.equal(await pagina.locator('#panel #nota').inputValue(), 'Llamar después de las 5');
    await pagina.locator('#panel [data-acc="pensara"]').click();
    await confirmarPaso(pagina, '2026-10-05');
    await esperarEstable(pagina);
    assert.equal((await ultimo(pagina, 'registrarResultado')).nota, 'Llamar después de las 5');
    // Al abrir otro paciente, la nota empieza vacía.
    await abrirPanelDe(pagina, CARMEN);
    assert.equal(await pagina.locator('#panel #nota').inputValue(), '');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('panel: la historia trae la entrada nueva y «Anular» de la última pide motivo y la tacha', async () => {
  const { navegador, pagina, errores } = await abrirTablero();
  try {
    await pagina.evaluate(() => { DEMO._demora.getPaciente = 300; });
    await abrirPanelDe(pagina, CARMEN);
    assert.ok(await pagina.locator('#panel .hist-skel').isVisible(), 'esqueleto mientras llega');
    await pagina.waitForSelector('#panel .historia li');
    const filas = () => pagina.locator('#panel .historia li').evaluateAll(l => l.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
    let h = await filas();
    assert.equal(h.length, 2);
    assert.match(h[0], /^10\/09 · Rachel: no contestó/);
    assert.match(h[0], /Dijo que llamará/);
    assert.match(h[1], /número equivocado: 998877665/);
    assert.equal(await pagina.locator('#panel .historia [data-anular]').count(), 1, '«Anular» solo en la última');
    await pagina.locator('#panel [data-acc="nocontesto"]').click();
    await esperarEstable(pagina);
    await abrirPanelDe(pagina, CARMEN);
    await pagina.waitForSelector('#panel .historia li');
    h = await filas();
    assert.equal(h.length, 3);
    assert.match(h[0], /^01\/10 · Magaly: no contestó/);
    const anular = pagina.locator('#panel .historia li').first().locator('[data-anular]');
    assert.equal(await anular.count(), 1);
    assert.equal(await pagina.locator('#panel .historia [data-anular]').count(), 1);
    await anular.click();
    const n = await llamadas(pagina, 'anularResultado');
    await pagina.locator('#panel [data-confirmar-anular]').click();
    assert.equal(await aviso(pagina), 'Escriba el motivo de la anulación.');
    assert.equal(await llamadas(pagina, 'anularResultado'), n);
    await pagina.locator('#panel #motivo-anular').fill('Me equivoqué de paciente');
    await pagina.locator('#panel [data-confirmar-anular]').click();
    await pagina.waitForFunction(() => document.querySelector('#panel .historia li.anulado'));
    assert.equal(await llamadas(pagina, 'anularResultado'), n + 1);
    const a = await ultimo(pagina, 'anularResultado');
    assert.equal(a.motivo, 'Me equivoqué de paciente');
    h = await filas();
    assert.match(h[0], /anulado: Me equivoqué de paciente/);
    assert.equal(await pagina.locator('#panel .historia li').first().evaluate(e => getComputedStyle(e.querySelector('.txt')).textDecorationLine), 'line-through');
    await esperarCol(pagina, CARMEN, '1');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('panel: atajos (1 guarda sin panel, X abre el cierre sin guardar, Esc cierra el paso y luego el panel)', async () => {
  const { navegador, pagina, errores } = await abrirTablero();
  try {
    const c1 = (await pintadas(pagina, '1')).map(v => v.id);
    await pagina.locator(`#tablero [data-card="${c1[0]}"]`).focus();
    let n = await llamadas(pagina, 'registrarResultado');
    await pagina.keyboard.press('1');
    await esperarEstable(pagina);
    assert.equal(await llamadas(pagina, 'registrarResultado'), n + 1);
    assert.equal(await pagina.evaluate(() => seleccion.panel), '');
    assert.equal(await colPintada(pagina, c1[0]), '2');
    assert.equal(await pagina.evaluate(() => seleccion.id), c1[1], 'la selección pasa a la siguiente');
    assert.equal(await pagina.evaluate(() => document.activeElement.dataset.card), c1[1]);
    // X abre el panel con el grupo de cierre resaltado, sin guardar.
    n = await llamadas(pagina, 'registrarResultado');
    await pagina.keyboard.press('x');
    assert.equal(await pagina.evaluate(() => seleccion.panel), c1[1]);
    assert.ok(await pagina.locator('#panel .acc.cierra.resaltado').isVisible());
    assert.ok(await pagina.evaluate(() => !!document.activeElement.closest('#panel .acc.cierra')), 'el foco va al grupo de cierre');
    // Ninguna tecla guarda un cierre: Enter abre el paso; Enter otra vez no confirma.
    await pagina.keyboard.press('Enter');
    assert.equal(await pagina.locator('#panel .paso').count(), 1);
    await pagina.keyboard.press('Enter');
    assert.equal(await llamadas(pagina, 'registrarResultado'), n);
    // Esc cierra el paso, y luego el panel.
    await pagina.keyboard.press('Escape');
    assert.equal(await pagina.locator('#panel .paso').count(), 0);
    assert.equal(await pagina.evaluate(() => seleccion.panel), c1[1]);
    // 2 a 4 con el panel abierto abren su paso.
    await pagina.keyboard.press('3');
    assert.match(await pagina.locator('#panel .paso h4').textContent(), /Agendó cita/);
    await pagina.keyboard.press('Escape');
    await pagina.keyboard.press('Escape');
    assert.equal(await pagina.evaluate(() => seleccion.panel), '');
    assert.equal(await pagina.evaluate(() => document.activeElement.dataset.card), c1[1]);
    // 2 sobre la tarjeta con el panel cerrado: lo abre en el paso, al instante.
    await pagina.keyboard.press('2');
    assert.equal(await pagina.evaluate(() => seleccion.panel), c1[1]);
    assert.ok(await pagina.evaluate(() => document.getElementById('panel').classList.contains('instantaneo')));
    assert.match(await pagina.locator('#panel .paso h4').textContent(), /Lo pensará/);
    assert.equal(await llamadas(pagina, 'registrarResultado'), n);
    // El foco no sale del panel con Tab.
    for (let i = 0; i < 25; i++) {
      await pagina.keyboard.press(i % 5 ? 'Tab' : 'Shift+Tab');
      assert.ok(await pagina.evaluate(() => !!document.activeElement.closest('#panel')), `Tab ${i}: el foco sigue en el panel`);
    }
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('panel: una tarjeta de Completado abre el panel de solo lectura, sin «¿Qué pasó?»', async () => {
  const { navegador, pagina, errores } = await abrirTablero();
  try {
    await abrirPanelDe(pagina, TERESA);
    const texto = await pagina.locator('#panel').textContent();
    assert.doesNotMatch(texto, /¿Qué pasó\?/);
    assert.equal(await pagina.locator('#panel [data-acc]').count(), 0);
    assert.equal(await pagina.locator('#panel #nota').count(), 0);
    assert.match(texto, /Seguimiento cerrado/);
    await pagina.waitForSelector('#panel .historia li');
    assert.match(await pagina.locator('#panel .historia').textContent(), /alta médica/i);
    assert.equal(await pagina.locator('#panel .historia [data-anular]').count(), 1, 'el alta se puede anular');
    const n = await llamadas(pagina, 'registrarResultado');
    await pagina.keyboard.press('1');
    await pagina.keyboard.press('x');
    assert.equal(await llamadas(pagina, 'registrarResultado'), n);
    assert.equal(await pagina.locator('#panel .paso').count(), 0);
    // Sin contacto: el texto de siempre. «Usuario» para el @.
    await pagina.keyboard.press('Escape');
    await abrirPanelDe(pagina, '40222333|HEMATOLOGÍA');
    assert.match(await pagina.locator('#panel').textContent(), /Sin teléfono\. No hay número en SOFDOC ni en la otra base\./);
    await pagina.keyboard.press('Escape');
    await abrirPanelDe(pagina, 'REG-000003');
    assert.match(await pagina.locator('#panel .contacto').first().textContent(), /Usuario.*@ana\.flores/);
    assert.equal(await pagina.locator('#panel [data-acc="numero"]').count(), 0, 'sin teléfono no hay «Número equivocado»');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('panel: si «Falleció» falla, vuelven todas las tarjetas del DNI y la cuenta de cerrados', async () => {
  const { navegador, pagina, errores } = await abrirTablero();
  try {
    await pagina.evaluate(() => { DEMO._fallar.registrarResultado = 'Sin conexión con el servidor.'; DEMO._demora.registrarResultado = 300; });
    await abrirPanelDe(pagina, CARMEN);
    await pagina.locator('#panel [data-acc="fallecio"]').click();
    await pagina.locator('#panel [data-confirmar]').click();
    await esperarCol(pagina, CARMEN, '');
    await esperarCol(pagina, CARMEN_H, '');
    assert.match(await pagina.locator('#kpis').textContent(), /3 cerrados este mes/);
    await pagina.waitForFunction(() => /No se guardó/.test(document.querySelector('#aviso span').textContent));
    await esperarCol(pagina, CARMEN, '1');
    await esperarCol(pagina, CARMEN_H, '1');
    assert.match(await pagina.locator('#kpis').textContent(), /2 cerrados este mes/);
    assert.equal(await pagina.evaluate(() => S.cerrados.length), 2);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('panel: si el servidor falla y la asesora ya está en otra cosa, el panel no se le vuelve a abrir', async () => {
  const { navegador, pagina, errores } = await abrirTablero();
  try {
    await pagina.evaluate(() => { DEMO._fallar.registrarResultado = 'Sin conexión con el servidor.'; DEMO._demora.registrarResultado = 400; });
    await abrirPanelDe(pagina, LUIS);
    await pagina.locator('#panel [data-acc="pensara"]').click();
    await confirmarPaso(pagina, '2026-10-08');
    await pagina.waitForFunction(() => !seleccion.panel);
    await pagina.locator('#q').focus();   // se fue al buscador
    await pagina.waitForFunction(() => /No se guardó/.test(document.querySelector('#aviso span').textContent));
    await esperarCol(pagina, LUIS, '1');
    assert.equal(await pagina.evaluate(() => seleccion.panel), '', 'no se reabre');
    assert.equal(await pagina.evaluate(() => document.activeElement.id), 'q', 'no le quita el foco');
    // Si sigue en el tablero, sí se reabre con la nota.
    await abrirPanelDe(pagina, LUIS);
    await pagina.locator('#panel #nota').fill('Volver a intentar');
    await pagina.locator('#panel [data-acc="pensara"]').click();
    await confirmarPaso(pagina, '2026-10-08');
    await pagina.waitForFunction(() => /No se guardó/.test(document.querySelector('#aviso span').textContent) && seleccion.panel);
    assert.equal(await pagina.evaluate(() => seleccion.panel), LUIS);
    assert.equal(await pagina.locator('#panel #nota').inputValue(), 'Volver a intentar');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('panel: el alta de hierro o procedimiento no pide fecha; «Agendó cita» propone PROXIMA_AGENDADA', async () => {
  const { navegador, pagina, errores } = await abrirTablero();
  try {
    for (const id of [PEDRO, ROSA]) {
      await abrirPanelDe(pagina, id);
      await pagina.locator('#panel [data-acc="alta"]').click();
      assert.equal(await pagina.locator('#panel #pd').count(), 1, `${id}: pide el doctor`);
      assert.equal(await pagina.locator('#panel #pf').count(), 0, `${id}: sin fecha`);
      assert.ok(await pagina.locator('#panel .paso.cierre').isVisible());
      await pagina.keyboard.press('Escape');
      await pagina.keyboard.press('Escape');
      await pagina.waitForFunction(() => !seleccion.panel);
    }
    // María (Agendado) tiene PROXIMA_AGENDADA 2026-10-05: es la fecha propuesta.
    await abrirPanelDe(pagina, '40777888|HEMATOLOGÍA');
    await pagina.locator('#panel [data-acc="agendo"]').click();
    assert.equal(await pagina.locator('#panel #pf').inputValue(), '2026-10-05');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

/** Arrastra con el ratón una tarjeta hasta el centro de una columna. soltar:false deja el botón pulsado. */
async function arrastrar(pagina, id, col, opciones = {}) {
  const o = await pagina.evaluate(([id, col]) => {
    const el = [...document.querySelectorAll('#tablero [data-card]')].find(e => e.dataset.card === id);
    el.scrollIntoView({ block: 'center' });   // el ratón de Playwright no desplaza la página
    const t = el.getBoundingClientRect(), c = document.querySelector(`#tablero [data-col="${col}"]`).getBoundingClientRect();
    return { x: t.left + t.width / 2, y: t.top + 20, cx: c.left + c.width / 2, cy: Math.min(Math.max(c.top + 40, 60), innerHeight - 60) };
  }, [id, col]);
  await pagina.mouse.move(o.x, o.y);
  await pagina.mouse.down();
  await pagina.mouse.move(o.x + 3, o.y + 2);   // menos de 6 px: aún no arranca
  if (opciones.alMedio) await opciones.alMedio();
  await pagina.mouse.move(o.cx, o.cy, { steps: 8 });
  if (opciones.sinSoltar) return;
  await pagina.mouse.up();
}
const panelAbierto = pagina => pagina.evaluate(() => document.getElementById('panel').classList.contains('abierto'));

test('arrastrar: soltar una reevaluación en Agendado abre «Agendó cita» y no guarda nada', async () => {
  const { navegador, pagina, errores } = await abrirTablero();
  try {
    const antes = await llamadas(pagina, 'registrarResultado');
    await arrastrar(pagina, LUIS, 2, { alMedio: async () => {
      assert.equal(await pagina.locator('.tarjeta.fantasma').count(), 0, 'a menos de 6 px no hay copia');
    } });
    await pagina.waitForFunction(() => document.getElementById('panel').classList.contains('abierto'));
    assert.equal(await pagina.evaluate(() => P.paso && P.paso.k), 'agendo');
    assert.match(await pagina.locator('#panel .paso').textContent(), /Agendó cita/);
    await pagina.waitForFunction(() => !document.querySelector('.tarjeta.fantasma'));
    assert.equal(await colPintada(pagina, LUIS), '1', 'la tarjeta sigue en su columna hasta confirmar');
    assert.equal(await llamadas(pagina, 'registrarResultado'), antes, 'soltar no guarda');
    assert.equal(await pagina.locator('.col.puede, .col.no, .col.sobre').count(), 0);
    // Reevaluación a Completado: «Alta médica». Procedimiento: «Lo hizo». Hierro con sesiones pendientes a Completado: no vale.
    await pagina.keyboard.press('Escape'); await pagina.keyboard.press('Escape');
    await arrastrar(pagina, LUIS, 4);
    await pagina.waitForFunction(() => P.paso && P.paso.k === 'alta');
    await pagina.keyboard.press('Escape'); await pagina.keyboard.press('Escape');
    await arrastrar(pagina, PEDRO, 4);
    await pagina.waitForFunction(() => P.paso && P.paso.k === 'lohizo');
    await pagina.keyboard.press('Escape'); await pagina.keyboard.press('Escape');
    // Hierro con sesiones pendientes a En tratamiento: abre «Lo hizo».
    await arrastrar(pagina, ROSA, 3);
    await pagina.waitForFunction(() => P.paso && P.paso.k === 'lohizo');
    assert.equal(await llamadas(pagina, 'registrarResultado'), antes);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('arrastrar: una columna no válida devuelve la copia y avisa; Completado no se arrastra', async () => {
  const { navegador, pagina, errores } = await abrirTablero();
  try {
    await arrastrar(pagina, LUIS, 3, { sinSoltar: true });
    assert.equal(await pagina.locator('.tarjeta.fantasma').count(), 1);
    assert.equal(await pagina.locator('.col[data-col="3"].no').count(), 1, 'En tratamiento sale atenuada');
    assert.equal(await pagina.locator('.col[data-col="2"].puede').count(), 1);
    await pagina.mouse.up();
    assert.equal(await aviso(pagina), 'En tratamiento es solo para hierro con sesiones pendientes.');
    await pagina.waitForFunction(() => !document.querySelector('.tarjeta.fantasma'), null, { timeout: 2000 });
    assert.equal(await colPintada(pagina, LUIS), '1');
    assert.equal(await panelAbierto(pagina), false);
    // Hierro en su sesión 2 de 3 (Sofía, En tratamiento) hacia Completado: no vale (faltan sesiones).
    await arrastrar(pagina, SOFIA, 4);
    assert.equal(await panelAbierto(pagina), false);
    // Por contactar nunca es válida.
    await arrastrar(pagina, SOFIA, 1);
    assert.match(await aviso(pagina), /Vuelve sola a «Por contactar»/);
    // Completado: sin copia.
    await pagina.waitForFunction(() => !document.querySelector('.tarjeta.fantasma'));
    await arrastrar(pagina, TERESA, 2, { sinSoltar: true });
    assert.equal(await pagina.locator('.tarjeta.fantasma').count(), 0);
    await pagina.mouse.up();
    assert.equal(await llamadas(pagina, 'registrarResultado'), 0);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('arrastrar: a 390 px no hay arrastre', async () => {
  const { navegador, pagina, errores } = await abrirTablero({ viewport: { width: 390, height: 844 } });
  try {
    const o = await pagina.evaluate(() => { const r = document.querySelector('#tablero .col.movil [data-card]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 20 }; });
    await pagina.mouse.move(o.x, o.y); await pagina.mouse.down();
    await pagina.mouse.move(o.x + 60, o.y + 80, { steps: 6 });
    assert.equal(await pagina.locator('.tarjeta.fantasma').count(), 0);
    await pagina.mouse.up();
    assert.equal(await llamadas(pagina, 'registrarResultado'), 0);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('arrastrar: Completado con hierro (última sesión o cotización antigua) abre «Lo hizo»; con sesiones pendientes avisa', async () => {
  const { navegador, pagina, errores } = await abrirTablero();
  try {
    await arrastrar(pagina, ROSA, 4);   // sesión 2 de 3 en el DEMO: faltan sesiones
    assert.equal(await aviso(pagina), 'Completado llega con la última sesión del tratamiento.');
    assert.equal(await panelAbierto(pagina), false);
    await pagina.waitForFunction(() => !document.querySelector('.tarjeta.fantasma'));
    await pagina.evaluate(id => { const p = S.pacientes.find(x => x.id === id); p.trat.k = p.trat.n - 1; }, ROSA);
    await arrastrar(pagina, ROSA, 4);
    await pagina.waitForFunction(() => P.paso && P.paso.k === 'lohizo');
    await pagina.keyboard.press('Escape'); await pagina.keyboard.press('Escape');
    await arrastrar(pagina, CARMEN_H, 4);   // cotización antigua de hierro, sin registro
    await pagina.waitForFunction(() => P.paso && P.paso.k === 'lohizo');
    assert.equal(await llamadas(pagina, 'registrarResultado'), 0);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('arrastrar: Esc y pointercancel cancelan sin abrir paso ni guardar, y no dejan copia ni clases', async () => {
  const { navegador, pagina, errores } = await abrirTablero();
  try {
    const limpio = () => pagina.waitForFunction(() => !document.querySelector('.tarjeta.fantasma') && !document.querySelector('.col.puede, .col.no, .col.sobre') && !document.body.classList.contains('arrastrando'));
    await arrastrar(pagina, LUIS, 2, { sinSoltar: true });
    assert.equal(await pagina.locator('.tarjeta.fantasma').count(), 1);
    await pagina.keyboard.press('Escape');
    await limpio();
    await pagina.mouse.up();
    assert.equal(await panelAbierto(pagina), false);
    assert.equal(await colPintada(pagina, LUIS), '1');
    await arrastrar(pagina, LUIS, 2, { sinSoltar: true });
    await pagina.evaluate(() => document.dispatchEvent(new PointerEvent('pointercancel')));
    await limpio();
    await pagina.mouse.up();
    assert.equal(await panelAbierto(pagina), false);
    // Un arrastre nuevo no hereda la limpieza diferida del anterior.
    await arrastrar(pagina, LUIS, 2, { sinSoltar: true });
    await pagina.keyboard.press('Escape');
    await arrastrar(pagina, LUIS, 2, { sinSoltar: true });
    await pagina.waitForTimeout(300);
    assert.equal(await pagina.locator('.tarjeta.fantasma').count(), 1);
    assert.equal(await pagina.locator('.col[data-col="2"].puede').count(), 1);
    await pagina.mouse.up();
    await pagina.waitForFunction(() => P.paso && P.paso.k === 'agendo');
    assert.equal(await llamadas(pagina, 'registrarResultado'), 0);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

/* ============ Registro (Tarea 8) ============ */

/** Abre Registro (con seg.usuario = 'MAGALY', salvo que `usuario` sea '') y espera «Registrados hoy». */
async function abrirRegistro(opciones = {}) {
  const usuario = 'usuario' in opciones ? opciones.usuario : 'MAGALY';
  const r = await abrir(Object.assign({}, opciones, usuario ? { guardado: { 'seg.usuario': usuario } } : {}));
  try {
    await r.pagina.locator('.menu [data-sec="registro"]').click();
    await r.pagina.waitForSelector('#rform #rdni', { state: 'visible' });
    await r.pagina.waitForSelector('#lhoy li[data-reg]');
  } catch (e) { await r.navegador.close(); throw e; }
  return r;
}
const falta = pagina => pagina.locator('#rfalta').textContent();
const filaHoy = (pagina, id) => pagina.locator(`#lhoy li[data-reg="${id}"]`);
/** Llena lo mínimo de una indicación (sin DNI ni contacto, que cada prueba pone). */
async function llenarIndicacion(pagina, o = {}) {
  if (o.nombre) await pagina.locator('#rnom').fill(o.nombre);
  if (o.contacto) await pagina.locator('#rtel').fill(o.contacto);
  if (o.doctor) await pagina.locator('#rmed').selectOption(o.doctor);
  for (const p of o.procs || []) await pagina.locator(`#rprocs [data-proc="${p}"]`).click();
}

test('registro: un DNI conocido completa nombre, contacto y doctor y muestra «Paciente conocido»', async () => {
  const { navegador, pagina, errores } = await abrirRegistro();
  try {
    assert.equal(await pagina.locator('#v-registro .cargando').isVisible(), false);
    // Los catálogos salen de bootstrap: procedimientos, tratamientos y doctores.
    assert.deepEqual(await pagina.locator('#rprocs [data-proc]').evaluateAll(l => l.map(b => b.dataset.proc)),
      ['AMO', 'BIOPSIA', 'CITOMETRÍA DE FLUJO', 'CARIOTIPO', 'SANGRÍA']);
    assert.deepEqual(await pagina.locator('[data-trat]').evaluateAll(l => l.map(b => b.dataset.trat)),
      ['', 'HIERRO SACARATO', 'HIERRO DERISOMALTOSA', 'HIERRO CARBOXIMALTOSA']);
    assert.deepEqual(await pagina.locator('#rmed option').evaluateAll(l => l.map(o => o.value)),
      ['', 'Dr. Elí Cabanillas', 'Dra. Karen Matos', 'Dra. Alejandra La Torre', 'Dr. Juvenal Hanampa', 'Dra. Karen Matos – Particular']);
    assert.equal(await pagina.locator('#rfec').inputValue(), '2026-10-01');
    await pagina.locator('#rdni').fill('40444555');
    await pagina.waitForSelector('#rcon .conocido');
    assert.equal((await pagina.locator('#rcon .conocido').textContent()).trim(), 'Paciente conocido · última consulta 12/08/2026 con Dra. La Torre');
    assert.equal(await ultimo(pagina, 'buscarPacienteRegistro'), '40444555');
    assert.equal(await pagina.locator('#rnom').inputValue(), 'LUIS ALBERTO RAMOS VEGA');
    assert.equal(await pagina.locator('#rtel').inputValue(), '923 456 789');
    assert.equal(await pagina.locator('#rmed').inputValue(), 'Dra. Alejandra La Torre');
    assert.equal(await pagina.locator('#rcon .fallecido').count(), 0);
    // Otro DNI conocido reemplaza lo que se completó solo.
    await pagina.locator('#rdni').fill('40333444');
    await pagina.waitForFunction(() => document.querySelector('#rnom').value === 'CARMEN SOFÍA TORRES DÍAZ');
    assert.equal(await pagina.locator('#rmed').inputValue(), 'Dr. Juvenal Hanampa');
    // Un DNI incompleto quita el aviso.
    await pagina.locator('#rdni').fill('4033');
    await pagina.waitForFunction(() => !document.querySelector('#rcon .conocido'));
    assert.match(await falta(pagina), /^Falta: DNI/);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('registro: un DNI de fallecido muestra el aviso y deja registrar', async () => {
  const { navegador, pagina, errores } = await abrirRegistro();
  try {
    await pagina.locator('#rdni').fill('41999000');
    await pagina.waitForSelector('#rcon .fallecido');
    assert.match(await pagina.locator('#rcon .fallecido').textContent(), /Este paciente figura como fallecido el 24\/09\/2026 \(Ana\)/);
    assert.match(await pagina.locator('#rcon .conocido').textContent(), /Paciente conocido · última consulta 02\/07\/2026 con Dr\. Cabanillas/);
    await llenarIndicacion(pagina, { procs: ['SANGRÍA'] });
    assert.equal(await pagina.locator('#rgo').isDisabled(), false, 'el aviso no bloquea');
    assert.equal(await falta(pagina), 'Se creará 1 registro.');
    await pagina.locator('#rgo').click();
    await pagina.waitForSelector('#lhoy li[data-reg="REG-000008"]');
    assert.equal(await aviso(pagina), 'Registrado: Sangría · Rosa Amelia Cárdenas Ríos · REG-000008');
    const p = await ultimo(pagina, 'guardarRegistro');
    assert.equal(p.dni, '41999000');
    assert.equal(p.contacto, '933999000', 'el teléfono va sin espacios');
    assert.equal(p.doctor, 'Dr. Elí Cabanillas');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('registro: el carné de extranjería AB123456X se acepta y no pierde las letras', async () => {
  const { navegador, pagina, errores } = await abrirRegistro();
  try {
    await pagina.locator('#rdni').fill('AB12');
    assert.equal(await pagina.locator('#rdni').inputValue(), 'AB12');
    assert.match(await falta(pagina), /^Falta: DNI/);
    await pagina.locator('#rdni').fill('ab123456x');
    assert.equal(await pagina.locator('#rdni').inputValue(), 'AB123456X');
    await pagina.waitForSelector('#rcon .nuevo');
    assert.equal(await ultimo(pagina, 'buscarPacienteRegistro'), 'AB123456X');
    await llenarIndicacion(pagina, { nombre: 'Juan Carlos Pérez Rojas', contacto: '@juan.perez', doctor: 'Dra. Karen Matos', procs: ['AMO'] });
    assert.doesNotMatch(await falta(pagina), /DNI/);
    await pagina.locator('#rgo').click();
    await pagina.waitForSelector('#lhoy li[data-reg="REG-000008"]');
    const p = await ultimo(pagina, 'guardarRegistro');
    assert.equal(p.dni, 'AB123456X');
    assert.equal(p.contacto, '@juan.perez');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('registro: dos procedimientos y un tratamiento con sesiones y marca crean tres REG y «Registrados hoy» los lista', async () => {
  const { navegador, pagina, errores } = await abrirRegistro();
  try {
    assert.equal(await pagina.locator('#nhoy').textContent(), '1');
    await pagina.locator('#rdni').fill('45678901');
    await pagina.waitForSelector('#rcon .nuevo');
    await llenarIndicacion(pagina, { nombre: 'Juana Pérez Soto', contacto: '987 111 333', doctor: 'Dra. Karen Matos', procs: ['AMO', 'BIOPSIA'] });
    assert.equal(await pagina.locator('#rprocs [data-proc="AMO"]').getAttribute('aria-pressed'), 'true');
    await pagina.locator('[data-trat="HIERRO CARBOXIMALTOSA"]').click();
    assert.deepEqual(await pagina.locator('#rses [data-marca]').evaluateAll(l => l.map(b => b.dataset.marca)), ['FERINJECT', 'LIKFER']);
    assert.equal(await falta(pagina), 'Falta: sesiones, marca.');
    await pagina.locator('#rses [data-ses="2"]').click();
    await pagina.locator('#rses [data-marca="FERINJECT"]').click();
    assert.equal(await falta(pagina), 'Se crearán 3 registros.');
    // La derisomaltosa trae su única marca elegida; el sacarato no lleva marca.
    await pagina.locator('[data-trat="HIERRO DERISOMALTOSA"]').click();
    assert.equal(await pagina.locator('#rses [data-marca="MONOFER"]').getAttribute('aria-pressed'), 'true');
    await pagina.locator('[data-trat="HIERRO SACARATO"]').click();
    assert.match(await pagina.locator('#rses').textContent(), /Hierro sacarato: no lleva marca\./);
    await pagina.locator('[data-trat="HIERRO CARBOXIMALTOSA"]').click();
    await pagina.locator('#rses [data-ses="2"]').click();
    await pagina.locator('#rses [data-marca="FERINJECT"]').click();
    await pagina.evaluate(() => { S.kpi = { viejo: 1 }; S.resumen = { viejo: 1 }; });
    await pagina.locator('#rgo').click();
    await pagina.waitForSelector('#lhoy li[data-reg="REG-000010"]');
    assert.deepEqual(await ultimo(pagina, 'guardarRegistro'), { usuario: 'MAGALY', dni: '45678901', nombre: 'Juana Pérez Soto', contacto: '987111333',
      fecha: '2026-10-01', doctor: 'Dra. Karen Matos', procedimientos: ['AMO', 'BIOPSIA'], tratamiento: 'HIERRO CARBOXIMALTOSA', sesiones: 2, marca: 'FERINJECT' });
    assert.equal(await aviso(pagina),
      'Registrado: Amo + Biopsia + Hierro carboximaltosa · Ferinject × 2 sesiones · Juana Pérez Soto · REG-000008, REG-000009, REG-000010');
    for (const id of ['REG-000008', 'REG-000009', 'REG-000010']) assert.match(await filaHoy(pagina, id).textContent(), /JUANA PÉREZ SOTO/);
    assert.match(await filaHoy(pagina, 'REG-000010').textContent(), /Hierro carboximaltosa · Ferinject × 2 sesiones/);
    assert.match(await filaHoy(pagina, 'REG-000010').textContent(), /REG-000010 · registró Magaly/);
    assert.equal(await pagina.locator('#nhoy').textContent(), '4');
    // El formulario se limpia, salvo la fecha; los indicadores se vuelven a pedir.
    assert.equal(await pagina.locator('#rdni').inputValue(), '');
    assert.equal(await pagina.locator('#rnom').inputValue(), '');
    assert.equal(await pagina.locator('#rprocs [aria-pressed="true"]').count(), 0);
    assert.equal(await pagina.locator('#rfec').inputValue(), '2026-10-01');
    assert.deepEqual(await pagina.evaluate(() => [S.kpi, S.resumen]), [null, null]);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('registro: «Posible duplicado» del servidor; «Revisar» la cierra y «Registrar de todos modos» registra', async () => {
  const { navegador, pagina, errores } = await abrirRegistro();
  try {
    const llenar = async () => {
      await pagina.locator('#rdni').fill('45678902');
      await pagina.waitForSelector('#rcon .nuevo');
      await llenarIndicacion(pagina, { nombre: 'Pedro Gómez Ruiz', contacto: '987222444', doctor: 'Dr. Elí Cabanillas', procs: ['SANGRÍA'] });
    };
    await llenar();
    await pagina.locator('#rgo').click();
    await pagina.waitForSelector('#lhoy li[data-reg="REG-000008"]');
    await llenar();
    const antes = await llamadas(pagina, 'guardarRegistro');
    await pagina.locator('#rgo').click();
    await pagina.waitForSelector('#rdup .dup');
    assert.match(await pagina.locator('#rdup').textContent(), /Posible duplicado/);
    assert.match(await pagina.locator('#rdup').textContent(), /Ya se registró el 01\/10\/2026 \(REG-000008\): Sangría\./);
    assert.equal(await filaHoy(pagina, 'REG-000009').count(), 0);
    assert.equal((await ultimo(pagina, 'guardarRegistro')).confirmado, undefined);
    await pagina.locator('#rrevisar').click();
    assert.equal(await pagina.locator('#rdup .dup').count(), 0);
    assert.equal(await pagina.locator('#rnom').inputValue(), 'Pedro Gómez Ruiz', '«Revisar» no borra el formulario');
    await pagina.locator('#rgo').click();
    await pagina.waitForSelector('#rdup .dup');
    await pagina.locator('#rforzar').click();
    await pagina.waitForSelector('#lhoy li[data-reg="REG-000009"]');
    assert.equal(await llamadas(pagina, 'guardarRegistro'), antes + 3);
    assert.equal((await ultimo(pagina, 'guardarRegistro')).confirmado, true);
    assert.match(await aviso(pagina), /REG-000009$/);
    assert.equal(await pagina.locator('#rdup .dup').count(), 0);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('registro: sin contacto «Registrar» está deshabilitado y la barra dice qué falta; sin usuario no se guarda', async () => {
  const { navegador, pagina, errores } = await abrirRegistro({ usuario: '' });
  try {
    assert.equal(await pagina.locator('#rgo').isDisabled(), true);
    assert.equal(await falta(pagina), 'Falta: DNI, nombres, teléfono o usuario, doctor, un procedimiento o tratamiento.');
    await pagina.locator('#rdni').fill('45678903');
    await pagina.waitForSelector('#rcon .nuevo');
    await llenarIndicacion(pagina, { nombre: 'Rita Salas Paz', doctor: 'Dr. Elí Cabanillas', procs: ['CARIOTIPO'] });
    assert.equal(await pagina.locator('#rgo').isDisabled(), true);
    assert.equal(await falta(pagina), 'Falta: teléfono o usuario.');
    await pagina.locator('#rtel').fill('   ');
    assert.equal(await pagina.locator('#rgo').isDisabled(), true);
    await pagina.locator('#rtel').fill('987333555');
    assert.equal(await pagina.locator('#rgo').isDisabled(), false);
    assert.equal(await falta(pagina), 'Se creará 1 registro.');
    // Sin «¿Quién es usted?» no sale nada.
    await pagina.locator('#rgo').click();
    assert.equal(await aviso(pagina), 'Elija quién es usted.');
    assert.equal(await llamadas(pagina, 'guardarRegistro'), 0);
    // Un error del servidor se avisa y el formulario queda como estaba.
    await pagina.locator('.side .js-usuario').selectOption('RACHEL');
    await pagina.evaluate(() => { DEMO._fallar.guardarRegistro = 'Elija el doctor de la lista.'; });
    await pagina.locator('#rgo').click();
    await pagina.waitForFunction(() => /No se guardó/.test(document.querySelector('#aviso span').textContent));
    assert.equal(await aviso(pagina), 'No se guardó: Elija el doctor de la lista.');
    assert.equal(await pagina.locator('#rnom').inputValue(), 'Rita Salas Paz');
    assert.equal(await pagina.locator('#rgo').isDisabled(), false);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('registro: alta médica con las especialidades del paciente; la que ya tiene alta está deshabilitada', async () => {
  const { navegador, pagina, errores } = await abrirRegistro();
  try {
    await pagina.locator('#rseg [data-rmodo="alta"]').click();
    await pagina.waitForSelector('#adni');
    assert.match(await pagina.locator('#rgo').textContent(), /Registrar alta/);
    // Un DNI sin consultas no tiene alta.
    await pagina.locator('#adni').fill('45678904');
    await pagina.waitForFunction(() => /No encontramos ese DNI/.test(document.querySelector('#acon').textContent));
    assert.equal((await pagina.locator('#acon').textContent()).trim(), 'No encontramos ese DNI. El alta solo se registra para pacientes que ya tienen consultas.');
    assert.equal(await pagina.locator('#rgo').isDisabled(), true);
    await pagina.locator('#adni').fill('41666777');
    await pagina.waitForSelector('#aesps [data-esp]');
    assert.equal(await pagina.locator('#aesps [data-esp="HEMATOLOGÍA"]').isDisabled(), true);
    assert.match(await pagina.locator('#aesps [data-esp="HEMATOLOGÍA"]').textContent(), /ya tiene alta/);
    assert.equal(await pagina.locator('#aesps [data-esp="REUMATOLOGÍA"]').isDisabled(), false);
    assert.equal(await pagina.locator('#amed').inputValue(), 'Dr. Juvenal Hanampa', 'propone el doctor de la última consulta');
    assert.equal(await falta(pagina), 'Falta: especialidad.');
    await pagina.locator('#aesps [data-esp="REUMATOLOGÍA"]').click();
    await pagina.locator('#anota').fill('Controles en otra sede');
    await pagina.locator('#rgo').click();
    await pagina.waitForSelector('#lhoy li[data-reg="ALT-000003"]');
    assert.deepEqual(await ultimo(pagina, 'darDeAlta'), { usuario: 'MAGALY', dni: '41666777', especialidad: 'REUMATOLOGÍA',
      doctor: 'Dr. Juvenal Hanampa', fecha: '2026-10-01', nota: 'Controles en otra sede' });
    assert.equal(await aviso(pagina), 'Alta médica registrada: Teresa del Pilar Rojas Vargas · Reumatología · ALT-000003');
    assert.match(await filaHoy(pagina, 'ALT-000003').textContent(), /Alta médica · REUMATOLOGÍA · Dr\. Juvenal Hanampa/);
    assert.equal(await pagina.locator('#adni').inputValue(), '', 'el formulario se limpia');
    // Su anulación va por anularAlta.
    await filaHoy(pagina, 'ALT-000003').locator('[data-anular]').click();
    await filaHoy(pagina, 'ALT-000003').locator('.anula input').fill('Especialidad equivocada');
    await filaHoy(pagina, 'ALT-000003').locator('[data-confirmar-anular]').click();
    await pagina.waitForSelector('#lhoy li.anulado[data-reg="ALT-000003"]');
    assert.deepEqual(await ultimo(pagina, 'anularAlta'), { usuario: 'MAGALY', id: 'ALT-000003', motivo: 'Especialidad equivocada' });
    assert.equal(await llamadas(pagina, 'anularRegistro'), 0);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('registro: «Anular» pide motivo en la fila, espera al servidor y deja la fila tachada con su motivo', async () => {
  const { navegador, pagina, errores } = await abrirRegistro();
  try {
    // La anulada del DEMO ya muestra su motivo.
    assert.match(await filaHoy(pagina, 'REG-000007').textContent(), /anulado: Registrado dos veces/);
    assert.equal(await filaHoy(pagina, 'REG-000007').locator('[data-anular]').count(), 0);
    const fila = filaHoy(pagina, 'REG-000003');
    await fila.locator('[data-anular]').click();
    const motivo = fila.locator('.anula input'), ok = fila.locator('[data-confirmar-anular]');
    assert.ok(await motivo.evaluate(el => el === document.activeElement), 'el foco va al motivo');
    assert.equal(await ok.isDisabled(), true, 'sin motivo no se puede');
    await motivo.fill('   ');
    assert.equal(await ok.isDisabled(), true);
    await motivo.press('Enter');
    assert.equal(await llamadas(pagina, 'anularRegistro'), 0);
    // «Cancelar» cierra el motivo; Esc también.
    await fila.locator('[data-cancelar-anular]').click();
    assert.equal(await fila.locator('.anula input').count(), 0);
    await fila.locator('[data-anular]').click();
    await motivo.press('Escape');
    assert.equal(await fila.locator('.anula input').count(), 0);
    // Si el servidor falla, la fila no se tacha.
    await pagina.evaluate(() => { DEMO._fallar.anularRegistro = 'Sin conexión con el servidor.'; });
    await fila.locator('[data-anular]').click();
    await motivo.fill('Paciente equivocado');
    await ok.click();
    await pagina.waitForFunction(() => /No se anuló/.test(document.querySelector('#aviso span').textContent));
    assert.equal(await aviso(pagina), 'No se anuló: Sin conexión con el servidor.');
    assert.equal(await fila.getAttribute('class'), '');
    assert.equal(await ok.isDisabled(), false);
    // Con el servidor bien, se espera su respuesta antes de tachar.
    await pagina.evaluate(() => { delete DEMO._fallar.anularRegistro; DEMO._demora.anularRegistro = 400; });
    await ok.click();
    await pagina.waitForTimeout(150);
    assert.equal(await pagina.locator('#lhoy li.anulado[data-reg="REG-000003"]').count(), 0, 'no se tacha antes de la respuesta');
    await pagina.waitForSelector('#lhoy li.anulado[data-reg="REG-000003"]');
    assert.deepEqual(await ultimo(pagina, 'anularRegistro'), { usuario: 'MAGALY', id: 'REG-000003', motivo: 'Paciente equivocado' });
    assert.equal(await llamadas(pagina, 'anularAlta'), 0);
    assert.equal(await pagina.locator('#lhoy li[data-reg="REG-000003"] .tx').first().evaluate(el => getComputedStyle(el).textDecorationLine), 'line-through');
    assert.match(await filaHoy(pagina, 'REG-000003').textContent(), /anulado: Paciente equivocado/);
    assert.match(await filaHoy(pagina, 'REG-000003').textContent(), /Anulado/);
    assert.equal(await pagina.locator('#nhoy').textContent(), '0');
    assert.equal(await aviso(pagina), 'Anulado: REG-000003.');
    // El tablero se actualiza: la tarjeta de ese registro sale.
    await pagina.waitForFunction(() => !S.pacientes.some(p => p.id === 'REG-000003'));
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('registro: Enter envía una sola vez, no reenvía con la caja de duplicado ni con un envío en vuelo', async () => {
  const { navegador, pagina, errores } = await abrirRegistro();
  try {
    await pagina.locator('#rdni').fill('45678905');
    await pagina.waitForSelector('#rcon .nuevo');
    await llenarIndicacion(pagina, { nombre: 'Lía Vargas Soto', contacto: '+51 987 654 321', doctor: 'Dr. Elí Cabanillas', procs: ['SANGRÍA'] });
    // Mientras se envía, el cambio de modo y otro Enter no hacen nada.
    await pagina.evaluate(() => { DEMO._demora.guardarRegistro = 400; });
    await pagina.locator('#rnom').press('Enter');
    await pagina.waitForFunction(() => RG.enviando);
    assert.equal(await pagina.locator('#rseg [data-rmodo="alta"]').isDisabled(), true);
    await pagina.locator('#rnom').press('Enter');
    await pagina.waitForSelector('#lhoy li[data-reg="REG-000008"]');
    assert.equal(await llamadas(pagina, 'guardarRegistro'), 1, 'Enter envía una sola vez');
    assert.equal((await ultimo(pagina, 'guardarRegistro')).contacto, '+51987654321', 'el + se conserva y los espacios no');
    assert.equal(await pagina.locator('#rseg [data-rmodo="alta"]').isDisabled(), false);
    await pagina.evaluate(() => { delete DEMO._demora.guardarRegistro; });
    // Con la caja de duplicado abierta, Enter no reenvía: decide la asesora.
    await pagina.locator('#rdni').fill('45678905');
    await pagina.waitForSelector('#rcon .nuevo');
    await llenarIndicacion(pagina, { nombre: 'Lía Vargas Soto', contacto: '987654321', doctor: 'Dr. Elí Cabanillas', procs: ['SANGRÍA'] });
    await pagina.locator('#rnom').press('Enter');
    await pagina.waitForSelector('#rdup .dup');
    await pagina.locator('#rtel').press('Enter');
    assert.equal(await llamadas(pagina, 'guardarRegistro'), 2);
    assert.ok(await pagina.locator('#rforzar').evaluate(el => el === document.activeElement), 'el foco va a «Registrar de todos modos»');
    assert.equal(await pagina.locator('#rdup .dup').count(), 1);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('registro: una anulación en vuelo no se manda dos veces y la fila abierta oculta su «Anular»', async () => {
  const { navegador, pagina, errores } = await abrirRegistro();
  try {
    const fila = filaHoy(pagina, 'REG-000003');
    await fila.locator('[data-anular]').click();
    assert.equal(await fila.locator('[data-anular]').count(), 0, 'con el motivo abierto no hay otro «Anular» en la fila');
    await fila.locator('.anula input').fill('Paciente equivocado');
    await pagina.evaluate(() => { DEMO._demora.anularRegistro = 500; });
    await fila.locator('[data-confirmar-anular]').click();
    await fila.locator('.anula input').fill('Paciente equivocado otra vez');
    assert.equal(await fila.locator('[data-confirmar-anular]').isDisabled(), true, 'escribir no lo rehabilita');
    await fila.locator('.anula input').press('Enter');
    await fila.locator('[data-confirmar-anular]').click({ force: true });
    await pagina.waitForSelector('#lhoy li.anulado[data-reg="REG-000003"]');
    assert.equal(await llamadas(pagina, 'anularRegistro'), 1);
    assert.equal(await pagina.evaluate(() => RG.anulandoEnVuelo), '');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('registro: el DNI conserva el cursor al quitar caracteres no válidos', async () => {
  const { navegador, pagina, errores } = await abrirRegistro();
  try {
    const dni = pagina.locator('#rdni');
    await dni.fill('40448555');
    await dni.evaluate(el => el.setSelectionRange(3, 3));
    await pagina.keyboard.type('-');
    assert.equal(await dni.inputValue(), '40448555');
    assert.equal(await dni.evaluate(el => el.selectionStart), 3);
    await pagina.keyboard.type('x');
    assert.equal(await dni.inputValue(), '404X48555');
    assert.equal(await dni.evaluate(el => el.selectionStart), 4);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

/* ============ Pacientes: buscador y ficha (Tarea 9) ============ */
async function abrirPacientes(opciones = {}) {
  const usuario = 'usuario' in opciones ? opciones.usuario : 'MAGALY';
  const r = await abrir(Object.assign({}, opciones, usuario ? { guardado: { 'seg.usuario': usuario } } : {}));
  try {
    await r.pagina.waitForFunction(() => S.fase === 'listo');
    await r.pagina.locator('.menu [data-sec="pacientes"]').click();
    await r.pagina.waitForSelector('#pq', { state: 'visible' });
  } catch (e) { await r.navegador.close(); throw e; }
  return r;
}
/** Escribe en el buscador y espera la lista (o que siga oculta, con menos de 3 letras). */
async function buscarEn(pagina, texto) {
  await pagina.locator('#pq').fill(texto);
  await pagina.waitForFunction(t => PA.q === t && !PA.buscando && !document.getElementById('pres').hidden, texto);
}
const opciones = pagina => pagina.locator('#pres [role="option"]').evaluateAll(l => l.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
/** Abre la ficha de `dni` desde el buscador y espera a que esté pintada. */
async function abrirFicha(pagina, dni) {
  await buscarEn(pagina, dni);
  await pagina.locator(`#pres [data-dni="${dni}"]`).click();
  await esperarFicha(pagina, dni);
}
const esperarFicha = (pagina, dni) => pagina.waitForFunction(dni => PA.estado === 'listo' && PA.dni === dni && !PA.enVuelo
  && !!document.querySelector('#ficha .ficha'), dni);
const textoDe = (pagina, sel) => pagina.locator(sel).evaluateAll(l => l.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
const espDe = (pagina, esp) => pagina.locator(`#ficha .esp[data-esp="${esp}"]`);
const tratDe = (pagina, id) => pagina.locator(`#ficha .trat[data-reg="${id}"]`);

test('pacientes: el buscador encuentra por nombre y por DNI y se usa con el teclado', async () => {
  const { navegador, pagina, errores } = await abrirPacientes();
  try {
    assert.equal(await pagina.locator('#pq').getAttribute('placeholder'), 'DNI o nombre (mínimo 3 letras)');
    assert.equal(await pagina.locator('#v-pacientes .cargando').isVisible(), false);
    // Con menos de 3 letras no se busca.
    await pagina.locator('#pq').fill('ro');
    await pagina.waitForTimeout(450);
    assert.equal(await llamadas(pagina, 'buscar'), 0);
    assert.equal(await pagina.locator('#pres').isVisible(), false);
    // Por nombre.
    await buscarEn(pagina, 'rosa');
    assert.equal(await ultimo(pagina, 'buscar'), 'rosa');
    const nombres = await opciones(pagina);
    assert.ok(nombres.some(t => /^Rosa Elena Quispe Huamán DNI 40111222$/.test(t)), nombres.join(' | '));
    assert.ok(nombres.some(t => /Rosa Amelia Cárdenas Ríos DNI 41999000/.test(t)));
    // Por DNI (prefijo), y solo los 6 primeros de los que devuelve el servidor.
    await buscarEn(pagina, '4011');
    assert.deepEqual(await opciones(pagina), ['Rosa Elena Quispe Huamán DNI 40111222']);
    await buscarEn(pagina, '420');
    const todos = await pagina.evaluate(() => llamar('buscar', '420'));
    assert.ok(todos.length > 6, 'el DEMO devuelve más de 6');
    assert.equal(await pagina.locator('#pres [role="option"]').count(), 6);
    // ↑ ↓ mueven la selección; Enter abre esa ficha.
    const sel = () => pagina.locator('#pres [role="option"]').evaluateAll(l => l.findIndex(x => x.getAttribute('aria-selected') === 'true'));
    assert.equal(await sel(), 0);
    await pagina.keyboard.press('ArrowDown');
    await pagina.keyboard.press('ArrowDown');
    assert.equal(await sel(), 2);
    await pagina.keyboard.press('ArrowUp');
    assert.equal(await sel(), 1);
    assert.equal(await pagina.locator('#pq').getAttribute('aria-activedescendant'), await pagina.locator('#pres [role="option"]').nth(1).getAttribute('id'));
    const elegido = await pagina.locator('#pres [role="option"]').nth(1).locator('[data-dni]').getAttribute('data-dni');
    assert.equal(elegido, todos[1].DNI);
    await pagina.keyboard.press('Enter');
    await esperarFicha(pagina, elegido);
    assert.equal(await ultimo(pagina, 'getPaciente'), elegido);
    assert.equal(await pagina.locator('#ficha .ficha header .mono').textContent(), 'DNI ' + elegido);
    assert.equal(await pagina.locator('#pres').isVisible(), false);
    assert.equal(await pagina.locator('#pq').inputValue(), '');
    // Esc cierra la lista y el foco sigue en el buscador.
    await buscarEn(pagina, 'carmen');
    await pagina.keyboard.press('Escape');
    assert.equal(await pagina.locator('#pres').isVisible(), false);
    assert.equal(await pagina.evaluate(() => document.activeElement.id), 'pq');
    // Sin resultados.
    await buscarEn(pagina, 'zzzz');
    assert.equal((await pagina.locator('#pres').textContent()).trim(), 'Ningún paciente coincide con «zzzz».');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('pacientes: la ficha muestra estado por especialidad, «Debía volver el …», registros con sesiones, altas y contacto', async () => {
  const { navegador, pagina, errores } = await abrirPacientes();
  try {
    // Carmen: reevaluación vencida, con previos, número equivocado e historia.
    await abrirFicha(pagina, '40333444');
    assert.equal(await pagina.locator('#ficha .ficha header h2').textContent(), 'Carmen Sofía Torres Díaz');
    const reu = espDe(pagina, 'REUMATOLOGÍA');
    assert.equal((await reu.locator('h4').textContent()).trim(), 'Reumatología');
    assert.equal((await reu.locator('.tag').textContent()).trim(), 'No volvió');
    assert.match(await reu.locator('.tag').getAttribute('class'), /e-mal/);
    assert.equal((await reu.locator('.perfil').textContent()).trim(), 'En control · faltó a su 3.ª reevaluación');
    const linea = await textoDe(pagina, '#ficha .esp[data-esp="REUMATOLOGÍA"] .tiempo li');
    assert.match(linea[0], /^Primera cita · 02\/04\/2026 · Dr\. Hanampa/);
    assert.match(linea[1], /^Reevaluación 1 · /);
    assert.match(linea[2], /^Reevaluación 2 · 23\/06\/2026/);
    assert.equal(linea[3], 'Debía volver el 23/07/2026 (plazo máximo 07/08/2026)');
    assert.equal(await reu.locator('.tiempo li.esperada').count(), 1);
    assert.equal(await reu.locator('[data-dar-alta]').count(), 1);
    // Procedimientos anteriores a la plataforma, con su teléfono.
    const previos = await textoDe(pagina, '#ficha .previos tbody tr');
    assert.equal(previos.length, 1);
    assert.match(previos[0], /25\/08\/2026.*Hierro.*Cotizó, no lo hizo.*912 345 678/);
    // Contacto (getPaciente.telefonos) con «Copiar»; el equivocado no se ofrece para copiar.
    assert.deepEqual(await textoDe(pagina, '#f-contacto .contacto .num'), ['912 345 678']);
    await pagina.locator('#f-contacto [data-copiar]').click();
    await pagina.waitForFunction(() => /Copiado|No se pudo copiar/.test(document.querySelector('#aviso span').textContent));
    assert.equal(await aviso(pagina), 'Copiado: 912345678');
    assert.match(await pagina.locator('#f-contacto [data-copiar]').textContent(), /Copiado/);
    // Historia con todos los seguimientos y «Anular» solo en el último.
    const hist = await textoDe(pagina, '#f-hist .historia li');
    assert.equal(hist.length, 2);
    assert.match(hist[0], /^10\/09 · Rachel: no contestó · Reevaluación · Reumatología · Dijo que llamará/);
    assert.match(hist[1], /número equivocado: 998877665/);
    assert.equal(await pagina.locator('#f-hist [data-anular]').count(), 1);
    assert.equal(await pagina.locator('#f-hist .historia li').first().locator('[data-anular]').count(), 1);
    assert.equal((await pagina.locator('#f-altas').textContent()).replace(/\s+/g, ' ').trim(), 'Altas médicas Ninguna.');
    assert.match(await pagina.locator('#ficha').textContent(), /No tiene registros en la plataforma\./);

    // Rosa: registros con sus sesiones, y el anulado sin sesiones.
    await abrirFicha(pagina, '40111222');
    const r1 = tratDe(pagina, 'REG-000001');
    assert.match(await r1.locator('.trat-cab').textContent(), /Hierro carboximaltosa · Ferinject × 3 sesiones\s*En curso/);
    assert.equal((await r1.locator('.trat-meta').textContent()).trim(), 'REG-000001 · 03/09/2026 · Dr. Elí Cabanillas · registró Magaly');
    const ses = await textoDe(pagina, '#ficha .trat[data-reg="REG-000001"] .ses');
    assert.equal(ses.length, 3);
    assert.match(ses[0], /^Sesión 1 · 10\/09\/2026 · Magaly\s*Anular sesión$/);
    assert.match(ses[1], /^Sesión 2 · pendiente/);
    assert.equal(ses[2], 'Sesión 3 · pendiente');
    assert.equal(await r1.locator('[data-lohizo]').count(), 1, '«Lo hizo» solo en la siguiente');
    assert.equal(await r1.locator('[data-fecha-ses]').inputValue(), '2026-10-01');
    assert.equal(await r1.locator('[data-fecha-ses]').getAttribute('max'), '2026-10-01');
    assert.equal(await r1.locator('[data-fecha-ses]').getAttribute('min'), '2026-09-10');
    assert.equal(await r1.locator('[data-anular-ses]').count(), 1);
    assert.equal(await r1.locator('[data-anular-reg]').count(), 1);
    assert.equal(await r1.locator('.prog i').count(), 3);
    const r7 = tratDe(pagina, 'REG-000007');
    assert.match(await r7.locator('.trat-cab').textContent(), /Anulado/);
    assert.match(await r7.locator('.trat-meta').textContent(), /anulado: Registrado dos veces/);
    assert.equal(await r7.locator('.ses').count(), 0);
    assert.equal(await r7.locator('button').count(), 0);
    assert.deepEqual(await textoDe(pagina, '#f-contacto .contacto .num'), ['987 654 321', '014 332 210']);
    assert.equal((await espDe(pagina, 'HEMATOLOGÍA').locator('.tag').textContent()).trim(), 'Al día');
    assert.match(await espDe(pagina, 'HEMATOLOGÍA').locator('.tag').getAttribute('class'), /e-ok/);

    // Teresa: alta vigente (y su especialidad en «Alta médica», sin «Dar de alta…»); Elena: alta cerrada.
    await abrirFicha(pagina, '41666777');
    const hem = espDe(pagina, 'HEMATOLOGÍA');
    assert.equal((await hem.locator('.tag').textContent()).trim(), 'Alta médica');
    assert.match(await hem.locator('.tag').getAttribute('class'), /e-alta/);
    assert.equal(await hem.locator('[data-dar-alta]').count(), 0);
    assert.equal(await hem.locator('.tiempo li.esperada').count(), 0, 'con alta no se espera que vuelva');
    assert.equal(await espDe(pagina, 'REUMATOLOGÍA').locator('[data-dar-alta]').count(), 1);
    const alta = await textoDe(pagina, '#f-altas li');
    assert.equal(alta.length, 1);
    assert.match(alta[0], /^Hematología · 18\/09\/2026\s*Vigente\s*Dr\. Elí Cabanillas · registró Magaly\s*Anular$/);
    await abrirFicha(pagina, '41222333');
    assert.match((await textoDe(pagina, '#f-altas li'))[0], /^Hematología · 10\/08\/2026\s*Cerrada: volvió después/);

    // En el celular la ficha no se sale de la pantalla.
    await abrirFicha(pagina, '40111222');
    await pagina.setViewportSize({ width: 390, height: 844 });
    assert.ok(await pagina.evaluate(() => document.documentElement.scrollWidth <= 390), 'sin scroll horizontal a 390 px');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('pacientes: «Dar de alta…» abre doctor y fecha en la especialidad y registra el alta', async () => {
  const { navegador, pagina, errores } = await abrirPacientes();
  try {
    await abrirFicha(pagina, '41666777');
    const reu = espDe(pagina, 'REUMATOLOGÍA');
    await reu.locator('[data-dar-alta]').click();
    assert.equal(await reu.locator('.alta-form').count(), 1, 'el formulario se abre dentro de la especialidad');
    assert.equal(await pagina.locator('#ficha .alta-form').count(), 1);
    assert.equal(await pagina.locator('#falta-doc').inputValue(), 'Dr. Juvenal Hanampa', 'propone el doctor de la última consulta');
    assert.equal(await pagina.locator('#falta-fec').inputValue(), '2026-10-01');
    assert.equal(await pagina.locator('#falta-fec').getAttribute('max'), '2026-10-01');
    // Sin doctor no sale nada.
    const n = await llamadas(pagina, 'darDeAlta');
    await pagina.locator('#falta-doc').selectOption('');
    await pagina.locator('#ficha [data-alta-ok]').click();
    assert.equal(await aviso(pagina), 'Elija el doctor que da el alta.');
    assert.equal(await llamadas(pagina, 'darDeAlta'), n);
    // Error del servidor: el formulario sigue abierto.
    await pagina.locator('#falta-doc').selectOption('Dr. Juvenal Hanampa');
    await pagina.evaluate(() => { DEMO._fallar.darDeAlta = 'Sin conexión con el servidor.'; });
    await pagina.locator('#ficha [data-alta-ok]').click();
    await pagina.waitForFunction(() => /No se guardó/.test(document.querySelector('#aviso span').textContent));
    assert.equal(await aviso(pagina), 'No se guardó: Sin conexión con el servidor.');
    assert.equal(await pagina.locator('#falta-doc').inputValue(), 'Dr. Juvenal Hanampa');
    await pagina.evaluate(() => { delete DEMO._fallar.darDeAlta; });
    // Bien.
    await pagina.locator('#falta-nota').fill('Controles en otra sede');
    const tab = await llamadas(pagina, 'getTablero');
    await pagina.evaluate(() => { S.kpi = { x: 1 }; S.resumen = { x: 1 }; });
    await pagina.locator('#ficha [data-alta-ok]').click();
    await pagina.waitForFunction(() => /Alta médica registrada/.test(document.querySelector('#aviso span').textContent));
    assert.deepEqual(await ultimo(pagina, 'darDeAlta'), { usuario: 'MAGALY', dni: '41666777', especialidad: 'REUMATOLOGÍA',
      doctor: 'Dr. Juvenal Hanampa', fecha: '2026-10-01', nota: 'Controles en otra sede' });
    assert.equal(await aviso(pagina), 'Alta médica registrada: Reumatología · ALT-000003');
    await esperarFicha(pagina, '41666777');
    await pagina.waitForFunction(() => document.querySelectorAll('#f-altas li').length === 2);
    assert.equal((await espDe(pagina, 'REUMATOLOGÍA').locator('.tag').textContent()).trim(), 'Alta médica');
    assert.equal(await espDe(pagina, 'REUMATOLOGÍA').locator('[data-dar-alta]').count(), 0);
    assert.equal(await pagina.locator('#ficha .alta-form').count(), 0);
    assert.deepEqual(await pagina.evaluate(() => [S.kpi, S.resumen]), [null, null]);
    await pagina.waitForFunction(t => DEMO._llamadas.getTablero > t, tab);
    // El alta nueva se anula desde el lateral, con motivo.
    const fila = pagina.locator('#f-altas li[data-alta="ALT-000003"]');
    await fila.locator('[data-anular-alta]').click();
    await pagina.locator('#fmotivo').fill('Especialidad equivocada');
    await pagina.keyboard.press('Enter');
    await pagina.waitForFunction(() => /Anulada/.test((document.querySelector('#f-altas li[data-alta="ALT-000003"]') || {}).textContent || ''));
    assert.deepEqual(await ultimo(pagina, 'anularAlta'), { usuario: 'MAGALY', id: 'ALT-000003', motivo: 'Especialidad equivocada' });
    assert.match(await pagina.locator('#f-altas li[data-alta="ALT-000003"]').textContent(), /Anulada: Especialidad equivocada/);
    assert.equal(await pagina.locator('#f-altas li[data-alta="ALT-000003"] [data-anular-alta]').count(), 0);
    assert.equal((await espDe(pagina, 'REUMATOLOGÍA').locator('.tag').textContent()).trim(), 'Al día');
    // Sin usuario no se registra nada.
    await pagina.evaluate(() => elegirUsuario(''));
    await espDe(pagina, 'REUMATOLOGÍA').locator('[data-dar-alta]').click();
    const m = await llamadas(pagina, 'darDeAlta');
    await pagina.locator('#ficha [data-alta-ok]').click();
    assert.equal(await aviso(pagina), 'Elija quién es usted.');
    assert.equal(await llamadas(pagina, 'darDeAlta'), m);
    // Esc cierra el formulario.
    await pagina.locator('#falta-fec').focus();
    await pagina.keyboard.press('Escape');
    assert.equal(await pagina.locator('#ficha .alta-form').count(), 0);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('pacientes: «Lo hizo» registra la sesión; «Anular sesión» y «Anular registro» piden motivo', async () => {
  const { navegador, pagina, errores } = await abrirPacientes();
  try {
    await abrirFicha(pagina, '40111222');
    const r1 = tratDe(pagina, 'REG-000001');
    await r1.locator('[data-fecha-ses]').fill('2026-09-30');
    const tab = await llamadas(pagina, 'getTablero');
    await r1.locator('[data-lohizo]').click();
    await pagina.waitForFunction(() => /Sesión 2 de 3 registrada/.test(document.querySelector('#aviso span').textContent));
    assert.deepEqual(await ultimo(pagina, 'marcarSesion'), { usuario: 'MAGALY', id: 'REG-000001', fecha: '2026-09-30', nota: '' });
    assert.equal(await aviso(pagina), 'Sesión 2 de 3 registrada: REG-000001.');
    await pagina.waitForFunction(() => /Sesión 2 · 30\/09\/2026 · Magaly/.test(document.querySelector('#ficha .trat[data-reg="REG-000001"]').textContent));
    let ses = await textoDe(pagina, '#ficha .trat[data-reg="REG-000001"] .ses');
    assert.match(ses[0], /^Sesión 1 · 10\/09\/2026 · Magaly$/, 'ya no es la última: sin «Anular sesión»');
    assert.match(ses[1], /^Sesión 2 · 30\/09\/2026 · Magaly\s*Anular sesión$/);
    assert.equal(await r1.locator('[data-anular-ses]').count(), 1);
    assert.equal(await r1.locator('.prog i.si').count(), 2);
    await pagina.waitForFunction(t => DEMO._llamadas.getTablero > t, tab);
    // Anular sesión: sin motivo no sale; con motivo, la sesión queda tachada y vuelve a estar pendiente.
    await r1.locator('[data-anular-ses]').click();
    assert.equal(await pagina.evaluate(() => document.activeElement.id), 'fmotivo');
    const n = await llamadas(pagina, 'anularSesion');
    await pagina.locator('#ficha [data-confirmar-anular]').click();
    assert.equal(await aviso(pagina), 'Escriba el motivo de la anulación.');
    assert.equal(await llamadas(pagina, 'anularSesion'), n);
    await pagina.locator('#fmotivo').fill('Fecha equivocada');
    await pagina.locator('#ficha [data-confirmar-anular]').click();
    await pagina.waitForSelector('#ficha .trat[data-reg="REG-000001"] .ses.anulada');
    assert.deepEqual(await ultimo(pagina, 'anularSesion'), { usuario: 'MAGALY', id: 'SES-000006', motivo: 'Fecha equivocada' });
    assert.equal(await aviso(pagina), 'Anulado: SES-000006.');
    const anulada = r1.locator('.ses.anulada');
    assert.match(await anulada.textContent(), /Sesión 2 · 30\/09\/2026 · Magaly · anulada: Fecha equivocada/);
    assert.equal(await anulada.evaluate(e => getComputedStyle(e.querySelector('.tx')).textDecorationLine), 'line-through');
    ses = await textoDe(pagina, '#ficha .trat[data-reg="REG-000001"] .ses:not(.anulada)');
    assert.match(ses[0], /Anular sesión$/, 'la sesión 1 vuelve a ser la última');
    assert.match(ses[1], /^Sesión 2 · pendiente/);
    assert.equal(await r1.locator('[data-lohizo]').count(), 1);
    // Cancelar y Esc cierran el motivo sin llamar.
    await r1.locator('[data-anular-reg]').click();
    await pagina.locator('#ficha [data-cancelar-anular]').click();
    assert.equal(await pagina.locator('#fmotivo').count(), 0);
    await r1.locator('[data-anular-reg]').click();
    await pagina.keyboard.press('Escape');
    assert.equal(await pagina.locator('#fmotivo').count(), 0);
    assert.equal(await llamadas(pagina, 'anularRegistro'), 0);
    // Anular registro con motivo: queda «Anulado», sin sesiones ni botones.
    await r1.locator('[data-anular-reg]').click();
    await pagina.locator('#fmotivo').fill('Paciente equivocado');
    await pagina.locator('#ficha [data-confirmar-anular]').click();
    await pagina.waitForFunction(() => /Anulado/.test(document.querySelector('#ficha .trat[data-reg="REG-000001"] .trat-cab').textContent));
    assert.deepEqual(await ultimo(pagina, 'anularRegistro'), { usuario: 'MAGALY', id: 'REG-000001', motivo: 'Paciente equivocado' });
    assert.match(await r1.locator('.trat-meta').textContent(), /anulado: Paciente equivocado/);
    assert.equal(await r1.locator('[data-lohizo], [data-anular-reg], [data-anular-ses]').count(), 0);
    assert.deepEqual(await pagina.evaluate(() => [S.kpi, S.resumen]), [null, null]);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('pacientes: confirmar el emparejamiento llama al servidor y quita el aviso', async () => {
  const { navegador, pagina, errores } = await abrirPacientes();
  try {
    await abrirFicha(pagina, '40222333');
    const caja = pagina.locator('#ficha .emparejar');
    assert.equal(await caja.count(), 1);
    assert.match(await caja.textContent(), /¿Es esta la misma persona\?/);
    assert.match((await caja.textContent()).replace(/\s+/g, ' '), /Hierro del 20\/07\/2026 a nombre de Jorge Mendoza · teléfono 945 112 233/);
    const botones = caja.locator('[data-emparejar]');
    assert.equal(await botones.count(), 2);
    assert.match(await caja.locator('[data-dni="40222333"]').getAttribute('class'), /btn-p/, 'el de esta ficha va destacado');
    assert.match(await caja.locator('[data-dni="40999888"]').textContent(), /Jorge Mendoza Salas · 40999888/);
    assert.match(await pagina.locator('#f-contacto').textContent(), /Sin teléfono\./);
    assert.equal(await pagina.locator('#ficha .previos tbody tr').count(), 0);
    await caja.locator('[data-dni="40222333"]').click();
    await pagina.waitForFunction(() => /Emparejamiento confirmado/.test(document.querySelector('#aviso span').textContent));
    assert.deepEqual(await ultimo(pagina, 'confirmarEmparejamiento'), { usuario: 'MAGALY', id: 'IND-0003', dni: '40222333' });
    assert.equal(await aviso(pagina), 'Emparejamiento confirmado.');
    await pagina.waitForFunction(() => !document.querySelector('#ficha .emparejar') && PA.estado === 'listo');
    assert.equal(await pagina.locator('#ficha .previos tbody tr').count(), 1);
    assert.deepEqual(await textoDe(pagina, '#f-contacto .contacto .num'), ['945 112 233']);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('pacientes: el aviso de fallecido, los números tachados y la historia con «Anular» como en el panel', async () => {
  const { navegador, pagina, errores } = await abrirPacientes();
  try {
    await abrirFicha(pagina, '41999000');
    assert.equal((await pagina.locator('#ficha .ficha header .fallecido').textContent()).trim(),
      'Figura como fallecido el 24/09/2026 (Ana). Si es un error, anule «Falleció» en la historia de seguimientos.');
    assert.match((await textoDe(pagina, '#f-hist .historia li'))[0], /falleció/);
    assert.equal(await pagina.locator('#f-hist .historia li').first().locator('[data-anular]').count(), 1);
    await abrirFicha(pagina, '40333444');
    assert.equal(await pagina.locator('#ficha .fallecido').count(), 0);
    const s = pagina.locator('#ficha header .descartados s');
    assert.deepEqual(await s.allTextContents(), ['998 877 665']);
    assert.equal(await s.first().evaluate(e => getComputedStyle(e).textDecorationLine), 'line-through');
    // «Anular» del último seguimiento: el anulado se tacha con su motivo y «Anular» pasa al anterior.
    await pagina.locator('#f-hist .historia li').first().locator('[data-anular]').click();
    await pagina.locator('#fmotivo').fill('Era otro paciente');
    await pagina.locator('#ficha [data-confirmar-anular]').click();
    await pagina.waitForSelector('#f-hist .historia li.anulado');
    assert.deepEqual(await ultimo(pagina, 'anularResultado'), { usuario: 'MAGALY', id: 'SEG-0004', motivo: 'Era otro paciente' });
    const h = await textoDe(pagina, '#f-hist .historia li');
    assert.match(h[0], /anulado: Era otro paciente/);
    assert.equal(await pagina.locator('#f-hist .historia li').first().evaluate(e => getComputedStyle(e.querySelector('.txt')).textDecorationLine), 'line-through');
    assert.equal(await pagina.locator('#f-hist .historia li').first().locator('[data-anular]').count(), 0);
    assert.equal(await pagina.locator('#f-hist .historia li').nth(1).locator('[data-anular]').count(), 1);
    // ANULADO se lee normalizado.
    assert.deepEqual(await pagina.evaluate(() => ['SI', 'SÍ', 'si', 'sí', 'Sí', true, '', 'NO', false].map(esAnulado)),
      [true, true, true, true, true, true, false, false, false]);
    const filas = await pagina.evaluate(() => filasSeguimientos([
      { ID: 'SEG-1', FECHA_HORA: '2026-09-01 10:00', ESPECIALIDAD: 'HEMATOLOGÍA', REFERENCIA: '', RESPONSABLE: 'ANA', RESULTADO: 'NO CONTESTÓ', ANULADO: '' },
      { ID: 'SEG-2', FECHA_HORA: '2026-09-02 10:00', ESPECIALIDAD: 'HEMATOLOGÍA', REFERENCIA: '', RESPONSABLE: 'ANA', RESULTADO: 'NO CONTESTÓ', ANULADO: 'sí', MOTIVO_ANULACION: 'x' }
    ]).map(f => [f.anulado, !!f.anular]));
    assert.deepEqual(filas, [[false, true], [true, false]]);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('pacientes: «Ver ficha completa →» del panel abre la ficha de ese paciente', async () => {
  const { navegador, pagina, errores } = await abrirTablero();
  try {
    await abrirPanelDe(pagina, CARMEN);
    await pagina.locator('#panel [data-ficha]').click();
    await pagina.waitForSelector('#v-pacientes', { state: 'visible' });
    await esperarFicha(pagina, '40333444');
    assert.equal(await pagina.locator('#ficha .ficha header h2').textContent(), 'Carmen Sofía Torres Díaz');
    assert.equal(await ultimo(pagina, 'getPaciente'), '40333444');
    assert.equal(await panelAbierto(pagina), false);
    assert.equal(await pagina.evaluate(() => S.fichaDni), '');
    assert.equal(await pagina.locator('.menu [aria-current="page"]').getAttribute('data-sec'), 'pacientes');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});
