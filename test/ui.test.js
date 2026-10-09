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

const HOY_DEMO = HOY;
const masDiasIso = (f, n) => new Date(Date.parse(f + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);

test('panel: hierro y procedimiento ofrecen «Aceptó» y «No desea realizarse»; reevaluación ofrece «Agendó cita»', async () => {
  const { navegador, pagina, errores } = await abrirTablero();
  try {
    await abrirPanelDe(pagina, 'REG-000021');
    const botones = await pagina.locator('#panel .acc:not(.cierra) [data-acc]').evaluateAll(b => b.map(x => x.dataset.acc));
    assert.deepEqual(botones, ['nocontesto', 'pensara', 'acepto']);
    const cierres = await pagina.locator('#panel .acc.cierra [data-acc]').evaluateAll(b => b.map(x => x.dataset.acc));
    assert.ok(cierres.includes('nodesea') && !cierres.includes('otro') && !cierres.includes('alta'));
    await pagina.keyboard.press('Escape');
    await abrirPanelDe(pagina, '40444555|HEMATOLOGÍA');
    assert.deepEqual(await pagina.locator('#panel .acc:not(.cierra) [data-acc]').evaluateAll(b => b.map(x => x.dataset.acc)), ['nocontesto', 'pensara', 'agendo']);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('panel: «Aceptó» con la fecha de la primera sesión pasa la tarjeta a Agendado y llama al servidor', async () => {
  const { navegador, pagina, errores } = await abrirTablero();
  try {
    await abrirPanelDe(pagina, 'REG-000021');
    await pagina.locator('#panel [data-acc="acepto"]').click();
    await confirmarPaso(pagina, masDiasIso(HOY_DEMO, 3));
    await pagina.waitForFunction(() => DEMO._llamadas.registrarResultado > 0);
    const u = await ultimo(pagina, 'registrarResultado');
    assert.deepEqual([u.resultado, u.referencia, u.fecha], ['ACEPTÓ', 'REG-000021', masDiasIso(HOY_DEMO, 3)]);
    assert.match(await pagina.locator('#tablero [data-card="REG-000021"]').textContent(), /Sesión 1 el/);
    assert.equal(await pagina.locator('#tablero [data-card="REG-000021"]').evaluate(e => e.closest('[data-col]').dataset.col), '2');
    // Sin «Deshacer»: anular el seguimiento no quitaría la fecha de inicio del registro.
    await esperarEstable(pagina);
    await pagina.waitForFunction(() => /edite o anule el registro\.$/.test(document.querySelector('#aviso span').textContent));
    assert.match(await aviso(pagina), /^Guardado: .* · aceptó.* Para cambiar la fecha o deshacerlo, edite o anule el registro\.$/);
    assert.equal(await pagina.locator('#aviso button:not([hidden])').count(), 0, 'sin Deshacer');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('panel: «No desea realizarse» pide motivo y cierra; en tratamiento se marca la sesión siguiente', async () => {
  const { navegador, pagina, errores } = await abrirTablero();
  try {
    await abrirPanelDe(pagina, 'REG-000021');
    await pagina.locator('#panel [data-acc="nodesea"]').click();
    assert.equal(await pagina.locator('#panel [data-confirmar]').isDisabled(), true);
    await pagina.locator('#panel #pm').fill('Por el precio');
    await pagina.locator('#panel [data-confirmar]').click();
    await pagina.waitForFunction(() => !document.querySelector('#tablero [data-card="REG-000021"]'));
    assert.deepEqual([(await ultimo(pagina, 'registrarResultado')).resultado, (await ultimo(pagina, 'registrarResultado')).motivo], ['NO DESEA REALIZARSE', 'Por el precio']);
    const enTrat = await pagina.locator('#tablero [data-col="3"] [data-card]').first().getAttribute('data-card');
    await abrirPanelDe(pagina, enTrat);
    await pagina.locator('#panel [data-marcar-sesion]').click();
    await pagina.waitForFunction(() => DEMO._llamadas.marcarSesion > 0);
    assert.equal((await ultimo(pagina, 'marcarSesion')).id, enTrat);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('panel: «Aceptó» en una cotización del historial pide las sesiones y crea el registro; el DEMO rechaza «Agendó cita» en hierro', async () => {
  const { navegador, pagina, errores } = await abrirTablero();
  try {
    await abrirPanelDe(pagina, CARMEN_H);
    await pagina.locator('#panel [data-acc="acepto"]').click();
    assert.match(await pagina.locator('#panel .paso').textContent(), /Fecha de la primera sesión/);
    assert.match(await pagina.locator('#panel .paso').textContent(), /Si pasa la fecha sin marcar la sesión, vuelve a «Por contactar»\./);
    assert.equal(await pagina.locator('#panel #pf').getAttribute('min'), HOY_DEMO);
    assert.equal(await pagina.locator('#panel #pf').getAttribute('max'), masDiasIso(HOY_DEMO, 180));
    await pagina.locator('#panel #ps').fill('2');
    await confirmarPaso(pagina, masDiasIso(HOY_DEMO, 5));
    await esperarEstable(pagina);
    const u = await ultimo(pagina, 'registrarResultado');
    assert.deepEqual([u.resultado, u.referencia, u.sesiones], ['ACEPTÓ', '', 2]);
    const nuevo = await pagina.evaluate(() => S.pacientes.find(x => x.dni === '40333444' && x.t === 'hier').id);
    assert.match(nuevo, /^REG-/, 'la tarjeta ahora es la del registro');
    assert.equal(await colPintada(pagina, nuevo), '2');
    assert.match(await textoTarjeta(pagina, nuevo), /Sesión 1 el/);
    assert.equal(await pagina.locator(`#tablero [data-card="${CARMEN_H}"]`).count(), 0);
    const r = await pagina.evaluate(() => llamar('registrarResultado', { usuario: 'MAGALY', dni: '43555666', especialidad: 'HIERRO', referencia: 'REG-000021',
      resultado: 'AGENDÓ CITA', fecha: '2026-10-05' }).then(() => 'ok', e => e.message));
    assert.equal(r, '«Agendó cita» es solo para reevaluaciones. Use «Aceptó».');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('panel: En tratamiento «Anular la última» pide motivo y anula ULTIMA_SESION_ID', async () => {
  const { navegador, pagina, errores } = await abrirTablero();
  try {
    await abrirPanelDe(pagina, SOFIA);
    await pagina.locator('#panel [data-anular-ultima]').click();
    assert.equal(await pagina.locator('#panel [data-confirmar-ultima]').isDisabled(), true, 'sin motivo no se anula');
    await pagina.locator('#panel #motivo-ultima').fill('Se marcó por error');
    await pagina.locator('#panel [data-confirmar-ultima]').click();
    await pagina.waitForFunction(() => DEMO._llamadas.anularSesion > 0);
    assert.deepEqual(await ultimo(pagina, 'anularSesion'), { usuario: 'MAGALY', id: 'SES-000002', motivo: 'Se marcó por error' });
    // Sin sesiones vuelve a ser una cotización de hace 10 días: el tablero recargado la pone en Por contactar.
    await esperarCol(pagina, SOFIA, '1');
    assert.match(await textoTarjeta(pagina, SOFIA), /Cotizó hace 10 días/);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

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
    // «Marcar sesión» en hierro a tiempo: sigue en En tratamiento con la sesión siguiente; la última pasa a Completado.
    await abrirPanelDe(pagina, SOFIA);
    assert.equal(await pagina.locator('#panel [data-acc]:not(.cierra [data-acc])').count(), 0, 'En tratamiento no ofrece «¿Qué pasó?»');
    assert.match(await pagina.locator('#panel [data-marcar-sesion]').textContent(), /Marcar sesión 2 hecha/);
    assert.equal(await pagina.locator('#panel #pfs').inputValue(), '2026-10-01', 'hoy por omisión');
    await pagina.locator('#panel #pfs').fill('2026-10-01');
    await pagina.locator('#panel [data-marcar-sesion]').click();
    await esperarEstable(pagina);
    await esperarCol(pagina, SOFIA, '3');
    assert.match(await textoTarjeta(pagina, SOFIA), /Sesión 3 de 3/);
    assert.deepEqual(await ultimo(pagina, 'marcarSesion'), { usuario: 'MAGALY', id: SOFIA, fecha: '2026-10-01', nota: '' });
    await abrirPanelDe(pagina, SOFIA);
    assert.match(await pagina.locator('#panel [data-marcar-sesion]').textContent(), /Marcar sesión 3 hecha/);
    await pagina.locator('#panel [data-marcar-sesion]').click();
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
    await pagina.locator('#panel [data-marcar-sesion]').click();
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

test('panel: una recarga silenciosa pedida antes de un guardado no devuelve la tarjeta a su columna vieja (I1)', async () => {
  const { navegador, pagina, errores } = await abrirTablero();
  try {
    await pagina.evaluate(() => { S.lim = { rec: 99, mes: 99, ant: 99 }; pintarTablero(); });
    await pagina.locator(`#tablero [data-card="${LUIS}"]`).focus();
    await pagina.keyboard.press('1');
    await esperarCol(pagina, LUIS, '2');
    await esperarEstable(pagina);
    // getTablero lee la hoja al pedirlo y responde 600 ms después, como un servidor que leyó antes del guardado.
    await pagina.evaluate(() => { DEMO._demora.getTablero = 600; DEMO._alPedir.getTablero = true; });
    const tab = await llamadas(pagina, 'getTablero');
    await pagina.waitForSelector('#aviso button:not([hidden])');
    await pagina.locator('#aviso button').click();   // Deshacer: anula y recarga en silencio
    await pagina.waitForFunction(n => DEMO._llamadas.getTablero === n, tab + 1);
    // Durante la recarga, 1 sobre otra tarjeta: el guardado responde antes que la recarga.
    await pagina.locator(`#tablero [data-card="${CARMEN}"]`).focus();
    await pagina.keyboard.press('1');
    await esperarCol(pagina, CARMEN, '2');
    await esperarEstable(pagina);
    await pagina.waitForTimeout(800);   // llegó la foto vieja
    assert.equal(await colPintada(pagina, CARMEN), '2', 'la foto de antes del guardado no se aplica');
    await pagina.waitForFunction(n => DEMO._llamadas.getTablero === n, tab + 2);
    await esperarCol(pagina, LUIS, '1');   // la recarga repetida sí trae lo deshecho
    await pagina.waitForTimeout(800);
    assert.equal(await colPintada(pagina, CARMEN), '2', 'tras asentarse todo, Agendado');
    assert.equal(await colPintada(pagina, LUIS), '1');
    assert.equal(await llamadas(pagina, 'getTablero'), tab + 2, 'una sola recarga repetida, sin bucle');
    // Un guardado todavía en vuelo cuando llega la recarga: se descarta y se repide al terminar el guardado.
    const otra = (await pintadas(pagina, '1')).map(v => v.id).find(id => id !== LUIS);
    await pagina.evaluate(() => { DEMO._demora.registrarResultado = 1500; cargarTablero(null, true); });
    await pagina.locator(`#tablero [data-card="${otra}"]`).focus();
    await pagina.keyboard.press('1');
    await esperarCol(pagina, otra, '2');
    await pagina.waitForTimeout(900);   // la recarga ya llegó; el guardado sigue en vuelo
    assert.equal(await pagina.evaluate(() => S.enVuelo.size), 1);
    assert.equal(await colPintada(pagina, otra), '2', 'con un guardado en vuelo la recarga no se aplica');
    assert.equal(await llamadas(pagina, 'getTablero'), tab + 3);
    await esperarEstable(pagina);
    await pagina.waitForFunction(n => DEMO._llamadas.getTablero === n, tab + 4);
    await pagina.waitForTimeout(800);
    assert.equal(await colPintada(pagina, otra), '2');
    assert.equal(await llamadas(pagina, 'getTablero'), tab + 4);
    assert.equal(await pagina.evaluate(() => S.recargaPendiente), false);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('panel: un 1 pulsado mientras Deshacer anula no queda deshecho por la recarga que sale después (I1, guardado antes de pedirla)', async () => {
  const { navegador, pagina, errores } = await abrirTablero();
  try {
    await pagina.evaluate(() => { S.lim = { rec: 99, mes: 99, ant: 99 }; pintarTablero(); });
    await pagina.locator(`#tablero [data-card="${LUIS}"]`).focus();
    await pagina.keyboard.press('1');
    await esperarCol(pagina, LUIS, '2');
    await esperarEstable(pagina);
    // La anulación termina antes que el guardado; la recarga se pide con el guardado en vuelo, lee la hoja antes
    // de que el guardado escriba y responde después de él.
    await pagina.evaluate(() => {
      DEMO._demora.anularResultado = 400; DEMO._demora.registrarResultado = 700;
      DEMO._demora.getTablero = 600; DEMO._alPedir.getTablero = true;
    });
    const tab = await llamadas(pagina, 'getTablero');
    await pagina.waitForSelector('#aviso button:not([hidden])');
    await pagina.locator('#aviso button').click();   // Deshacer
    await pagina.locator(`#tablero [data-card="${CARMEN}"]`).focus();
    await pagina.keyboard.press('1');                // durante la anulación
    await esperarCol(pagina, CARMEN, '2');
    await pagina.waitForFunction(n => DEMO._llamadas.getTablero === n, tab + 1);
    assert.equal(await pagina.evaluate(() => S.enVuelo.size), 1, 'la recarga se pidió con el guardado en vuelo');
    await esperarEstable(pagina);                    // el guardado responde antes que la recarga
    await pagina.waitForTimeout(700);                // llegó la foto de antes del guardado
    assert.equal(await colPintada(pagina, CARMEN), '2', 'la foto de antes del guardado no se aplicó');
    await pagina.waitForFunction(n => DEMO._llamadas.getTablero === n, tab + 2);   // se descartó y se repidió
    await esperarCol(pagina, LUIS, '1');
    await pagina.waitForTimeout(800);
    assert.equal(await colPintada(pagina, CARMEN), '2', 'tras asentarse todo, Agendado');
    assert.equal(await colPintada(pagina, LUIS), '1');
    assert.equal(await llamadas(pagina, 'getTablero'), tab + 2);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('panel: en el tope de recargas descartadas queda una pendiente y el siguiente guardado la pide (I1, tope)', async () => {
  const { navegador, pagina, errores } = await abrirTablero();
  try {
    await pagina.evaluate(() => { S.lim = { rec: 99, mes: 99, ant: 99 }; pintarTablero(); });
    await pagina.locator(`#tablero [data-card="${LUIS}"]`).focus();
    await pagina.keyboard.press('1');
    await esperarCol(pagina, LUIS, '2');
    await esperarEstable(pagina);
    // Cada getTablero cuenta como si saliera un guardado mientras viaja: las 4 respuestas (intento 0 a 3) se descartan.
    await pagina.evaluate(() => { window.__tab = DEMO.getTablero; DEMO.getTablero = (...a) => { S.escrituras++; return window.__tab(...a); }; });
    const tab = await llamadas(pagina, 'getTablero');
    await pagina.waitForSelector('#aviso button:not([hidden])');
    await pagina.locator('#aviso button').click();   // Deshacer
    await pagina.waitForFunction(() => DEMO._llamadas.anularResultado === 1);
    await pagina.waitForFunction(n => DEMO._llamadas.getTablero === n, tab + 4);
    await pagina.waitForTimeout(300);
    assert.equal(await llamadas(pagina, 'getTablero'), tab + 4, 'tope: sin bucle');
    assert.equal(await colPintada(pagina, LUIS), '2', 'ninguna respuesta descartada se aplicó');
    assert.equal(await pagina.evaluate(() => S.recargaPendiente), true, 'en el tope queda pendiente');
    // El siguiente guardado, al terminar, pide un tablero nuevo que sí se aplica.
    await pagina.evaluate(() => { DEMO.getTablero = window.__tab; });
    await pagina.locator(`#tablero [data-card="${CARMEN}"]`).focus();
    await pagina.keyboard.press('1');
    await esperarEstable(pagina);
    await pagina.waitForFunction(n => DEMO._llamadas.getTablero === n, tab + 5);
    await esperarCol(pagina, LUIS, '1');
    assert.equal(await colPintada(pagina, CARMEN), '2');
    assert.equal(await pagina.evaluate(() => S.recargaPendiente), false);
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

test('panel: «Ya se le escribió N veces · la última el …»; el motivo abierto oculta su «Anular», Enter confirma y un repintado no deja anular dos veces', async () => {
  const { navegador, pagina, errores } = await abrirTablero();
  try {
    // M5: la línea de la app anterior, con «por esto» en hierro y procedimiento; sin seguimientos, nada.
    await abrirPanelDe(pagina, CARMEN);
    assert.equal(await pagina.locator('#panel .p-prev').textContent(), 'Ya se le escribió 1 vez · la última el 10/09/2026');
    await pagina.keyboard.press('Escape');
    await abrirPanelDe(pagina, '40888999|HIERRO');
    assert.equal(await pagina.locator('#panel .p-prev').textContent(), 'Ya se le escribió por esto 1 vez · la última el 25/09/2026');
    await pagina.keyboard.press('Escape');
    await abrirPanelDe(pagina, 'REG-000004');
    assert.equal(await pagina.locator('#panel .p-prev').textContent(), 'Ya se le escribió por esto 3 veces · la última el 29/09/2026');
    await pagina.keyboard.press('Escape');
    await abrirPanelDe(pagina, LUIS);
    assert.equal(await pagina.locator('#panel .p-prev').count(), 0);
    await pagina.keyboard.press('Escape');
    // M1: con el motivo abierto, la fila no muestra su propio «Anular».
    await abrirPanelDe(pagina, CARMEN);
    await pagina.waitForSelector('#panel .historia li');
    const primera = pagina.locator('#panel .historia li').first();
    await primera.locator('[data-anular]').click();
    assert.equal(await primera.locator('#motivo-anular').count(), 1);
    assert.equal(await primera.locator('[data-anular]').count(), 0, 'sin un segundo «Anular» en la fila');
    assert.equal(await pagina.locator('#panel .historia button.enlace[data-anular]').count(), 0);
    // M2 y M3: Enter confirma; en vuelo, un repintado no rehabilita el botón ni deja mandar otra.
    const n = await llamadas(pagina, 'anularResultado');
    await pagina.evaluate(() => { DEMO._demora.anularResultado = 600; });
    await pagina.locator('#panel #motivo-anular').fill('Era otro paciente');
    await pagina.locator('#panel #motivo-anular').press('Enter');
    await pagina.waitForFunction(n => DEMO._llamadas.anularResultado === n + 1, n);
    await pagina.evaluate(() => pintarHistoria());
    assert.equal(await pagina.locator('#panel #motivo-anular').inputValue(), 'Era otro paciente', 'el motivo sobrevive al repintado');
    assert.equal(await pagina.locator('#panel [data-confirmar-anular]').isDisabled(), true, 'repintado en vuelo: deshabilitado');
    await pagina.locator('#panel #motivo-anular').press('Enter');
    await pagina.locator('#panel [data-confirmar-anular]').click({ force: true });
    await pagina.evaluate(() => confirmarAnulacion(document.querySelector('#panel [data-confirmar-anular]')));
    await pagina.waitForFunction(() => document.querySelector('#panel .historia li.anulado'));
    assert.equal(await llamadas(pagina, 'anularResultado'), n + 1, 'una sola anulación');
    assert.equal(await aviso(pagina), 'Anulado: ' + (await ultimo(pagina, 'anularResultado')).id + '.');
    assert.equal(await pagina.evaluate(() => P.anulandoEnVuelo), '');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('panel: si la anulación falla, «No se anuló: …», la fila no se tacha y el botón vuelve con el motivo escrito', async () => {
  const { navegador, pagina, errores } = await abrirTablero();
  try {
    await abrirPanelDe(pagina, CARMEN);
    await pagina.waitForSelector('#panel .historia li');
    await pagina.locator('#panel .historia li').first().locator('[data-anular]').click();
    await pagina.evaluate(() => { DEMO._fallar.anularResultado = 'Sin conexión con el servidor.'; DEMO._demora.anularResultado = 400; });
    await pagina.locator('#panel #motivo-anular').fill('Era otro paciente');
    await pagina.locator('#panel [data-confirmar-anular]').click();
    await pagina.evaluate(() => pintarHistoria());   // un repintado en vuelo
    await pagina.waitForFunction(() => /No se anuló/.test(document.querySelector('#aviso span').textContent));
    assert.equal(await aviso(pagina), 'No se anuló: Sin conexión con el servidor.');
    assert.equal(await pagina.locator('#panel .historia li.anulado').count(), 0);
    assert.equal(await pagina.locator('#panel [data-confirmar-anular]').isDisabled(), false, 'el botón vuelve');
    assert.equal(await pagina.locator('#panel #motivo-anular').inputValue(), 'Era otro paciente');
    // Reintentar con el servidor bien: anula.
    await pagina.evaluate(() => { delete DEMO._fallar.anularResultado; delete DEMO._demora.anularResultado; });
    await pagina.locator('#panel #motivo-anular').press('Enter');
    await pagina.waitForSelector('#panel .historia li.anulado');
    assert.equal(await llamadas(pagina, 'anularResultado'), 2);
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
    // La segunda de Por contactar en el DEMO es el hierro de Ana María (REG-000003): su 3 es «Aceptó tratamiento».
    assert.equal(c1[1], 'REG-000003');
    assert.equal((await pagina.locator('#panel .paso h4').textContent()).trim(), 'Aceptó tratamiento');
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

test('panel: hierro y procedimiento no ofrecen «Alta médica» ni «Agendó cita»; «Agendó cita» propone PROXIMA_AGENDADA', async () => {
  const { navegador, pagina, errores } = await abrirTablero();
  try {
    for (const id of [PEDRO, 'REG-000003']) {
      await abrirPanelDe(pagina, id);
      assert.equal(await pagina.locator('#panel [data-acc="alta"]').count(), 0, `${id}: sin alta`);
      assert.equal(await pagina.locator('#panel [data-acc="agendo"]').count(), 0, `${id}: sin «Agendó cita»`);
      assert.match(await pagina.locator('#panel [data-acc="acepto"]').textContent(), id === PEDRO ? /Aceptó procedimiento/ : /Aceptó tratamiento/);
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
    // Reevaluación a Completado: «Alta médica». Procedimiento a Completado: avisa (llega con la última sesión).
    await pagina.keyboard.press('Escape'); await pagina.keyboard.press('Escape');
    await arrastrar(pagina, LUIS, 4);
    await pagina.waitForFunction(() => P.paso && P.paso.k === 'alta');
    await pagina.keyboard.press('Escape'); await pagina.keyboard.press('Escape');
    await arrastrar(pagina, PEDRO, 4);
    assert.equal(await aviso(pagina), 'Completado llega con la última sesión.');
    assert.equal(await panelAbierto(pagina), false);
    await pagina.waitForFunction(() => !document.querySelector('.tarjeta.fantasma'));
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

test('arrastrar: hierro a Completado avisa (llega con la última sesión); a Agendado abre «Aceptó»', async () => {
  const { navegador, pagina, errores } = await abrirTablero();
  try {
    await arrastrar(pagina, ROSA, 4);   // sesión 2 de 3 en el DEMO: faltan sesiones
    assert.equal(await aviso(pagina), 'Completado llega con la última sesión.');
    assert.equal(await panelAbierto(pagina), false);
    await pagina.waitForFunction(() => !document.querySelector('.tarjeta.fantasma'));
    await pagina.evaluate(id => { const p = S.pacientes.find(x => x.id === id); p.trat.k = p.trat.n - 1; }, ROSA);
    await arrastrar(pagina, ROSA, 4);   // ni en la última: la sesión se marca desde el panel
    assert.equal(await aviso(pagina), 'Completado llega con la última sesión.');
    assert.equal(await panelAbierto(pagina), false);
    await pagina.waitForFunction(() => !document.querySelector('.tarjeta.fantasma'));
    await arrastrar(pagina, CARMEN_H, 4);   // cotización antigua de hierro, sin registro
    assert.equal(await aviso(pagina), 'Completado llega con la última sesión.');
    assert.equal(await panelAbierto(pagina), false);
    await pagina.waitForFunction(() => !document.querySelector('.tarjeta.fantasma'));
    await arrastrar(pagina, CARMEN_H, 2);   // a Agendado: «Aceptó»
    await pagina.waitForFunction(() => P.paso && P.paso.k === 'acepto');
    assert.match(await pagina.locator('#panel .paso h4').textContent(), /Aceptó tratamiento/);
    assert.equal(await pagina.locator('#panel #ps').inputValue(), '1', 'del historial: pide las sesiones');
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

/** Abre Registro (con seg.usuario = 'MAGALY', salvo que `usuario` sea '') y espera «Registrados». */
async function abrirRegistro(opciones = {}) {
  const usuario = 'usuario' in opciones ? opciones.usuario : 'MAGALY';
  const r = await abrir(Object.assign({}, opciones, usuario ? { guardado: { 'seg.usuario': usuario } } : {}));
  try {
    await r.pagina.locator('.menu [data-sec="registro"]').click();
    await r.pagina.waitForSelector('#rform #rdni', { state: 'visible' });
    await r.pagina.waitForSelector('#rlista li[data-reg]');
  } catch (e) { await r.navegador.close(); throw e; }
  return r;
}
const falta = pagina => pagina.locator('#rfalta').textContent();
const filaHoy = (pagina, id) => pagina.locator(`#rlista li[data-reg="${id}"]`);
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
    await pagina.waitForSelector('#rlista li[data-reg="REG-000010"]');
    assert.equal(await aviso(pagina), 'Registro guardado: Sangría · Rosa Amelia Cárdenas Ríos · REG-000010');
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
    await pagina.waitForSelector('#rlista li[data-reg="REG-000010"]');
    const p = await ultimo(pagina, 'guardarRegistro');
    assert.equal(p.dni, 'AB123456X');
    assert.equal(p.contacto, '@juan.perez');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('registro: dos procedimientos y un tratamiento con sesiones y marca crean tres REG y «Registrados» los lista', async () => {
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
    await pagina.waitForSelector('#rlista li[data-reg="REG-000012"]');
    assert.deepEqual(await ultimo(pagina, 'guardarRegistro'), { usuario: 'MAGALY', dni: '45678901', nombre: 'Juana Pérez Soto', contacto: '987111333',
      fecha: '2026-10-01', doctor: 'Dra. Karen Matos', procedimientos: ['AMO', 'BIOPSIA'], tratamiento: 'HIERRO CARBOXIMALTOSA', sesiones: 2, marca: 'FERINJECT' });
    assert.equal(await aviso(pagina),
      'Registro guardado: Amo + Biopsia + Hierro carboximaltosa · Ferinject × 2 sesiones · Juana Pérez Soto · REG-000010, REG-000011, REG-000012');
    for (const id of ['REG-000010', 'REG-000011', 'REG-000012']) assert.match(await filaHoy(pagina, id).textContent(), /JUANA PÉREZ SOTO/);
    assert.match(await filaHoy(pagina, 'REG-000012').textContent(), /Hierro carboximaltosa · Ferinject × 2 sesiones/);
    assert.match(await filaHoy(pagina, 'REG-000012').textContent(), /REG-000012 · registró Magaly/);
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
    await pagina.waitForSelector('#rlista li[data-reg="REG-000010"]');
    await llenar();
    const antes = await llamadas(pagina, 'guardarRegistro');
    await pagina.locator('#rgo').click();
    await pagina.waitForSelector('#rdup .dup');
    assert.match(await pagina.locator('#rdup').textContent(), /Posible duplicado/);
    assert.match(await pagina.locator('#rdup').textContent(), /Ya se registró el 01\/10\/2026 \(REG-000010\): Sangría\./);
    assert.equal(await filaHoy(pagina, 'REG-000011').count(), 0);
    assert.equal((await ultimo(pagina, 'guardarRegistro')).confirmado, undefined);
    await pagina.locator('#rrevisar').click();
    assert.equal(await pagina.locator('#rdup .dup').count(), 0);
    assert.equal(await pagina.locator('#rnom').inputValue(), 'Pedro Gómez Ruiz', '«Revisar» no borra el formulario');
    await pagina.locator('#rgo').click();
    await pagina.waitForSelector('#rdup .dup');
    await pagina.locator('#rforzar').click();
    await pagina.waitForSelector('#rlista li[data-reg="REG-000011"]');
    assert.equal(await llamadas(pagina, 'guardarRegistro'), antes + 3);
    assert.equal((await ultimo(pagina, 'guardarRegistro')).confirmado, true);
    assert.match(await aviso(pagina), /REG-000011$/);
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
    await pagina.locator('#rseg [data-rtab="decision"]').click();
    await pagina.waitForSelector('#adni');
    assert.match(await pagina.locator('#rgo').textContent(), /Registrar decisión/);
    // Un DNI sin consultas no tiene alta.
    await pagina.locator('#adni').fill('45678904');
    await pagina.waitForFunction(() => /No encontramos ese DNI/.test(document.querySelector('#acon').textContent));
    assert.equal((await pagina.locator('#acon').textContent()).trim(), 'No encontramos ese DNI. La decisión del médico solo se registra para pacientes que ya tienen consultas.');
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
    await pagina.waitForSelector('#rlista li[data-reg="ALT-000003"]');
    assert.deepEqual(await ultimo(pagina, 'darDeAlta'), { usuario: 'MAGALY', dni: '41666777', especialidad: 'REUMATOLOGÍA',
      doctor: 'Dr. Juvenal Hanampa', fecha: '2026-10-01', nota: 'Controles en otra sede', decision: 'ALTA', fechaRetorno: '' });
    assert.equal(await aviso(pagina), 'Registro guardado: Alta médica · Teresa del Pilar Rojas Vargas · Reumatología · ALT-000003');
    assert.match(await filaHoy(pagina, 'ALT-000003').textContent(), /Alta médica · REUMATOLOGÍA · Dr\. Juvenal Hanampa/);
    assert.equal(await pagina.locator('#adni').inputValue(), '', 'el formulario se limpia');
    // Su anulación va por anularAlta.
    await filaHoy(pagina, 'ALT-000003').locator('[data-anular]').click();
    await filaHoy(pagina, 'ALT-000003').locator('.anula input').fill('Especialidad equivocada');
    await filaHoy(pagina, 'ALT-000003').locator('[data-confirmar-anular]').click();
    await pagina.waitForSelector('#rlista li.anulado[data-reg="ALT-000003"]');
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
    assert.equal(await pagina.locator('#rlista li.anulado[data-reg="REG-000003"]').count(), 0, 'no se tacha antes de la respuesta');
    await pagina.waitForSelector('#rlista li.anulado[data-reg="REG-000003"]');
    assert.deepEqual(await ultimo(pagina, 'anularRegistro'), { usuario: 'MAGALY', id: 'REG-000003', motivo: 'Paciente equivocado' });
    assert.equal(await llamadas(pagina, 'anularAlta'), 0);
    assert.equal(await pagina.locator('#rlista li[data-reg="REG-000003"] .tx').first().evaluate(el => getComputedStyle(el).textDecorationLine), 'line-through');
    assert.match(await filaHoy(pagina, 'REG-000003').textContent(), /anulado: Paciente equivocado/);
    assert.match(await filaHoy(pagina, 'REG-000003').textContent(), /Anulado/);
    assert.equal(await pagina.locator('#nhoy').textContent(), '0');
    assert.equal(await aviso(pagina), 'Registro anulado: Hierro carboximaltosa · Likfer × 2 sesiones · REG-000003');
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
    assert.equal(await pagina.locator('#rseg [data-rtab="decision"]').isDisabled(), true);
    await pagina.locator('#rnom').press('Enter');
    await pagina.waitForSelector('#rlista li[data-reg="REG-000010"]');
    assert.equal(await llamadas(pagina, 'guardarRegistro'), 1, 'Enter envía una sola vez');
    assert.equal((await ultimo(pagina, 'guardarRegistro')).contacto, '+51987654321', 'el + se conserva y los espacios no');
    assert.equal(await pagina.locator('#rseg [data-rtab="decision"]').isDisabled(), false);
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
    await pagina.waitForSelector('#rlista li.anulado[data-reg="REG-000003"]');
    assert.equal(await llamadas(pagina, 'anularRegistro'), 1);
    assert.equal(await pagina.evaluate(() => RG.anulandoEnVuelo), '');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('registro: si anular falla en «Registrados», la fila no se tacha, el botón vuelve y se avisa', async () => {
  const { navegador, pagina, errores } = await abrirRegistro();
  try {
    const fila = filaHoy(pagina, 'REG-000003');
    await fila.locator('[data-anular]').click();
    await fila.locator('.anula input').fill('Paciente equivocado');
    await pagina.evaluate(() => { DEMO._fallar.anularRegistro = 'Sin conexión con el servidor.'; DEMO._demora.anularRegistro = 400; });
    const ok = fila.locator('[data-confirmar-anular]');
    await ok.click();
    assert.equal(await ok.isDisabled(), true, 'en vuelo, deshabilitado');
    await pagina.waitForFunction(() => /No se anuló/.test(document.querySelector('#aviso span').textContent));
    assert.equal(await aviso(pagina), 'No se anuló: Sin conexión con el servidor.');
    assert.equal(await pagina.locator('#rlista li.anulado[data-reg="REG-000003"]').count(), 0, 'la fila no se tacha');
    assert.doesNotMatch(await fila.textContent(), /anulado:/);
    assert.equal(await ok.isDisabled(), false, 'el botón vuelve');
    assert.equal(await fila.locator('.anula input').inputValue(), 'Paciente equivocado');
    assert.equal(await pagina.evaluate(() => RG.anulandoEnVuelo), '');
    assert.equal(await llamadas(pagina, 'anularRegistro'), 1);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

/* ---- Etapa 2 (Tarea 10): tres pestañas, «Registrados» por periodo, Editar y confirmación ---- */

test('registro: control + laboratorio propone el retorno a 15 días y lo registra', async () => {
  const { navegador, pagina, errores } = await abrirRegistro();
  try {
    await pagina.locator('[data-rtab="control"]').click();
    await pagina.locator('#rdni').fill('40111222');
    await pagina.waitForSelector('text=Paciente conocido');
    await pagina.locator('#rmed').selectOption({ index: 1 });
    assert.equal(await pagina.locator('#rretorno').inputValue(), masDiasIso(HOY_DEMO, 15));
    await pagina.locator('#rexamenes').fill('Hemograma');
    await pagina.locator('#rgo').click();
    await pagina.waitForFunction(() => DEMO._llamadas.guardarRegistro > 0);
    const u = await ultimo(pagina, 'guardarRegistro');
    assert.deepEqual([u.tipo, u.examenes, u.fechaRetorno], ['CONTROL', 'Hemograma', masDiasIso(HOY_DEMO, 15)]);
    assert.match(await aviso(pagina), /Registro guardado: Control \+ laboratorio · Hemograma/);
    assert.equal(await pagina.locator('#rlista .ok-reciente').count(), 1);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('registro: «Decisión del médico» con nueva reevaluación exige la fecha de retorno', async () => {
  const { navegador, pagina, errores } = await abrirRegistro();
  try {
    await pagina.locator('[data-rtab="decision"]').click();
    await pagina.locator('#adni').fill('40111222');
    await pagina.locator('#amed').selectOption({ index: 1 });
    await pagina.locator('input[name="rdec"][value="NUEVA REEVALUACION"]').check();
    await pagina.locator('#rgo').click();
    assert.match(await aviso(pagina), /fecha de retorno/);
    await pagina.locator('#aretorno').fill(masDiasIso(HOY_DEMO, 40));
    await pagina.locator('#rgo').click();
    await pagina.waitForFunction(() => DEMO._llamadas.darDeAlta > 0);
    const u = await ultimo(pagina, 'darDeAlta');
    assert.deepEqual([u.decision, u.fechaRetorno], ['NUEVA REEVALUACION', masDiasIso(HOY_DEMO, 40)]);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('registro: «Decisión del médico» a 6 meses avisa cuándo vuelve a «Por contactar»; la indicación manda la primera sesión', async () => {
  const { navegador, pagina, errores } = await abrirRegistro();
  try {
    await pagina.locator('[data-rtab="decision"]').click();
    assert.equal(await pagina.locator('input[name="rdec"]:checked').getAttribute('value'), 'ALTA');
    assert.deepEqual(await pagina.locator('input[name="rdec"]').evaluateAll(l => l.map(x => x.value)),
      ['ALTA', 'ALTA 6 MESES', 'ALTA 1 AÑO', 'NUEVA REEVALUACION']);
    assert.equal(await pagina.locator('#aretorno').count(), 0, 'sin reevaluación no pide la fecha');
    await pagina.locator('input[name="rdec"][value="ALTA 6 MESES"]').check();
    // 01/10/2026 + 6 meses = 01/04/2027, menos 30 días = 02/03/2027.
    assert.match(await pagina.locator('#rform').textContent(), /Volverá a «Por contactar» el 02\/03\/2027 para agendar su control\./);
    await pagina.locator('input[name="rdec"][value="ALTA 1 AÑO"]').check();
    assert.match(await pagina.locator('#rform').textContent(), /Volverá a «Por contactar» el 01\/09\/2027 para agendar su control\./);
    // Indicación: la fecha de la primera sesión es opcional y va desde hoy.
    await pagina.locator('[data-rtab="indicacion"]').click();
    assert.equal(await pagina.locator('#rinicio').getAttribute('min'), HOY_DEMO);
    await pagina.locator('#rdni').fill('45678906');
    await pagina.waitForSelector('#rcon .nuevo');
    await llenarIndicacion(pagina, { nombre: 'Elsa Prueba Mora', contacto: '987000222', doctor: 'Dr. Elí Cabanillas', procs: ['SANGRÍA'] });
    await pagina.locator('#rinicio').fill(masDiasIso(HOY_DEMO, 3));
    await pagina.locator('#rgo').click();
    await pagina.waitForSelector('#rlista li[data-reg="REG-000010"]');
    assert.equal((await ultimo(pagina, 'guardarRegistro')).fechaInicio, masDiasIso(HOY_DEMO, 3));
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('registro: «Registrados» por mes, Editar manda solo lo cambiado y confirma', async () => {
  const { navegador, pagina, errores } = await abrirRegistro();
  try {
    const periodos = await pagina.locator('#rperiodo option').evaluateAll(o => o.map(x => x.value));
    assert.equal(periodos[0], 'HOY');
    assert.deepEqual(periodos.slice(1), ['2026-10', '2026-09', '2026-08', '2026-07', '2026-06', '2026-05']);
    await pagina.locator('#rperiodo').selectOption(periodos[1]);
    await pagina.waitForFunction(() => DEMO._llamadas.getRegistros > 1);
    assert.equal((await ultimo(pagina, 'getRegistros')).periodo, periodos[1]);
    await pagina.locator('#rperiodo').selectOption('HOY');
    const id = await pagina.locator('#rlista [data-editar]').first().getAttribute('data-editar');
    await pagina.locator(`#rlista [data-editar="${id}"]`).click();
    await pagina.locator('#rlista [data-campo="contacto"]').fill('912 000 111');
    await pagina.locator('#rlista [data-guardar-edicion]').click();
    await pagina.waitForFunction(() => DEMO._llamadas.editarRegistro > 0);
    assert.deepEqual(await ultimo(pagina, 'editarRegistro'), { usuario: 'MAGALY', id, cambios: { contacto: '912 000 111' } });
    assert.match(await aviso(pagina), /Registro editado/);
    assert.equal(await pagina.locator('#rlista [data-guardar-edicion]').count(), 0, 'el formulario se cierra');
    assert.equal(await pagina.locator(`#rlista li.ok-reciente[data-reg="${id}"]`).count(), 1);
    // Ni las anuladas ni las decisiones se editan.
    assert.equal(await filaHoy(pagina, 'REG-000007').locator('[data-editar]').count(), 0);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('registro: Editar sin cambios avisa «No hay cambios.» y no llama al servidor', async () => {
  const { navegador, pagina, errores } = await abrirRegistro();
  try {
    await filaHoy(pagina, 'REG-000003').locator('[data-editar]').click();
    await pagina.locator('#rlista [data-guardar-edicion]').click();
    assert.equal(await aviso(pagina), 'No hay cambios.');
    assert.equal(await llamadas(pagina, 'editarRegistro'), 0);
    // Si el servidor dice que no hay cambios (lo igual se descarta allí), también.
    await pagina.locator('#rlista [data-campo="nombre"]').fill('ana maría flores ríos');
    await pagina.locator('#rlista [data-guardar-edicion]').click();
    await pagina.waitForFunction(() => DEMO._llamadas.editarRegistro > 0);
    await pagina.waitForFunction(() => document.querySelector('#aviso span').textContent === 'No hay cambios.' && !document.querySelector('#rlista [data-guardar-edicion]'));
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('registro: Editar no deja bajar las sesiones de las hechas (el servidor lo rechaza y el formulario sigue abierto)', async () => {
  const { navegador, pagina, errores } = await abrirRegistro();
  try {
    const id = await pagina.evaluate(() => DEMO._registroConSesiones());
    await pagina.locator(`#rlista [data-editar="${id}"]`).click();
    await pagina.locator('#rlista [data-campo="sesiones"]').fill('1');
    await pagina.locator('#rlista [data-guardar-edicion]').click();
    await pagina.waitForFunction(() => /No se guardó/.test(document.querySelector('#aviso span').textContent));
    assert.match(await aviso(pagina), /Ya hizo 2 sesiones/);
    assert.equal(await pagina.locator('#rlista [data-campo="sesiones"]').inputValue(), '1');
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
    // Una respuesta vieja se descarta: «ros» sigue en vuelo cuando ya se escribió «jor», y llega después.
    await pagina.evaluate(() => { DEMO._demora.buscar = 700; });
    const nb = await llamadas(pagina, 'buscar');
    await pagina.locator('#pq').fill('ros');
    await pagina.waitForFunction(n => DEMO._llamadas.buscar > n, nb);
    await pagina.evaluate(() => { DEMO._demora.buscar = 0; });
    await buscarEn(pagina, 'jor');
    await pagina.waitForTimeout(900);
    assert.equal(await llamadas(pagina, 'buscar'), nb + 2);
    const jor = await opciones(pagina);
    assert.ok(jor.length >= 1 && jor.every(t => /^Jorge /.test(t)), jor.join(' | '));
    assert.equal(await pagina.evaluate(() => PA.q), 'jor');
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
    assert.equal(await reu.locator('[data-decision]').count(), 1);
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
    // Con la fecha esperada todavía por llegar, «Debe volver el …».
    assert.equal((await espDe(pagina, 'HEMATOLOGÍA').locator('.tiempo li.esperada').textContent()).trim(), 'Debe volver el 03/10/2026 (plazo máximo 18/10/2026)');

    // Teresa: alta vigente (y su especialidad en «Alta médica», sin «Decisión del médico…»); Elena: alta cerrada.
    await abrirFicha(pagina, '41666777');
    const hem = espDe(pagina, 'HEMATOLOGÍA');
    assert.equal((await hem.locator('.tag').textContent()).trim(), 'Alta médica');
    assert.match(await hem.locator('.tag').getAttribute('class'), /e-alta/);
    assert.equal(await hem.locator('[data-decision]').count(), 0);
    assert.equal(await hem.locator('.tiempo li.esperada').count(), 0, 'con alta no se espera que vuelva');
    assert.equal(await espDe(pagina, 'REUMATOLOGÍA').locator('[data-decision]').count(), 1);
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

test('pacientes: «Decisión del médico…» abre doctor y fecha en la especialidad y registra el alta (ALTA por omisión)', async () => {
  const { navegador, pagina, errores } = await abrirPacientes();
  try {
    await abrirFicha(pagina, '41666777');
    const reu = espDe(pagina, 'REUMATOLOGÍA');
    await reu.locator('[data-decision]').click();
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
    // Con «Nueva reevaluación» el mensaje no habla de alta.
    await pagina.evaluate(() => { PA.alta.dec = 'NUEVA REEVALUACION'; });
    await pagina.locator('#ficha [data-alta-ok]').click();
    assert.equal(await aviso(pagina), 'Elija el doctor.');
    assert.equal(await llamadas(pagina, 'darDeAlta'), n);
    await pagina.evaluate(() => { PA.alta.dec = 'ALTA'; });
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
      doctor: 'Dr. Juvenal Hanampa', fecha: '2026-10-01', nota: 'Controles en otra sede', decision: 'ALTA', fechaRetorno: '' });
    assert.equal(await aviso(pagina), 'Alta médica registrada: Reumatología · ALT-000003');
    await esperarFicha(pagina, '41666777');
    await pagina.waitForFunction(() => document.querySelectorAll('#f-altas li').length === 2);
    assert.equal((await espDe(pagina, 'REUMATOLOGÍA').locator('.tag').textContent()).trim(), 'Alta médica');
    assert.equal(await espDe(pagina, 'REUMATOLOGÍA').locator('[data-decision]').count(), 0);
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
    await espDe(pagina, 'REUMATOLOGÍA').locator('[data-decision]').click();
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

test('pacientes: la ficha muestra el estado de cada registro, permite editarlo y ofrece «Decisión del médico…»', async () => {
  const { navegador, pagina, errores } = await abrirPacientes();
  try {
    await pagina.evaluate(() => abrirFicha('40111222'));
    await pagina.waitForFunction(() => PA.estado === 'listo');
    assert.match(await pagina.locator('#ficha').textContent(), /Programado el|Sesión \d+ de \d+|Cotizado|Completo/);
    assert.equal(await pagina.locator('#ficha [data-dar-alta]').count(), 0, '«Dar de alta…» ya no está');
    await pagina.locator('#ficha [data-decision]').first().click();
    assert.equal(await pagina.locator('#ficha input[name="fdec"]').count(), 4);
    const id = await pagina.locator('#ficha [data-editar-ficha]').first().getAttribute('data-editar-ficha');
    await pagina.locator(`#ficha [data-editar-ficha="${id}"]`).click();
    assert.ok(await pagina.locator('#ficha [data-campo]').count() > 0);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('pacientes: la línea de estado dice «Sesión k de n», «Programado el …», «Cotizado», «Completo» o «Control el …»', async () => {
  const { navegador, pagina, errores } = await abrirPacientes();
  try {
    await abrirFicha(pagina, '40111222');
    assert.equal((await tratDe(pagina, 'REG-000001').locator('.trat-estado').textContent()).trim(), 'Sesión 1 de 3');
    assert.equal(await tratDe(pagina, 'REG-000007').locator('.trat-estado').count(), 0, 'el anulado no tiene línea de estado');
    // Las mismas reglas con las filas que trae getPaciente.
    const lineas = await pagina.evaluate(() => [
      { TIPO: 'HIERRO', ESTADO_REGISTRO: 'COTIZADO', HECHAS: 0, SESIONES: 2 },
      { TIPO: 'HIERRO', ESTADO_REGISTRO: 'PROGRAMADO', FECHA_INICIO: '2026-10-12', HECHAS: 0, SESIONES: 2 },
      { TIPO: 'PROCEDIMIENTO', ESTADO_REGISTRO: 'COMPLETO', HECHAS: 1, SESIONES: 1 },
      { TIPO: 'CONTROL', ESTADO_REGISTRO: 'PROGRAMADO', EXAMENES: 'hemograma', FECHA_RETORNO: '2026-10-24', HECHAS: 0, SESIONES: 0 },
      { TIPO: 'CONTROL', ESTADO_REGISTRO: 'PROGRAMADO', EXAMENES: '', FECHA_RETORNO: '2026-10-24', HECHAS: 0, SESIONES: 0 },
      { TIPO: 'CONTROL', ESTADO_REGISTRO: 'PROGRAMADO', EXAMENES: '', FECHA_RETORNO: '', HECHAS: 0, SESIONES: 0 }
    ].map(lineaEstadoRegistro));
    assert.deepEqual(lineas, ['Cotizado', 'Programado el 12/10', 'Completo', 'Control el 24/10 · exámenes: hemograma', 'Control el 24/10', 'Control']);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('pacientes: Editar en la ficha manda solo lo cambiado, con su propio borrador (no el de «Registrados»)', async () => {
  const { navegador, pagina, errores } = await abrirPacientes();
  try {
    await abrirFicha(pagina, '40111222');
    assert.equal(await tratDe(pagina, 'REG-000007').locator('[data-editar-ficha]').count(), 0, 'el anulado no se edita');
    await tratDe(pagina, 'REG-000001').locator('[data-editar-ficha="REG-000001"]').click();
    const t = tratDe(pagina, 'REG-000001');
    assert.equal(await t.locator('[data-campo="contacto"]').inputValue(), '987654321');
    assert.equal(await t.locator('[data-campo="sesiones"]').getAttribute('min'), '1', 'no menos que las hechas');
    assert.equal(await t.locator('[data-editar-ficha]').count(), 0, 'abierto, su «Editar» se oculta');
    // El mismo número con espacios: el servidor lo normaliza y no hay cambio.
    await t.locator('[data-campo="contacto"]').fill('987 654 321');
    assert.deepEqual(await pagina.evaluate(() => [RG.editando, Object.keys(RG.borrador).length]), ['', 0], '«Registrados» no se entera');
    await t.locator('[data-guardar-edicion]').click();
    await pagina.waitForFunction(() => DEMO._llamadas.editarRegistro > 0 && document.querySelector('#aviso span').textContent === 'No hay cambios.');
    // Otro número: se manda tal cual se escribió y se guarda sin espacios.
    await tratDe(pagina, 'REG-000001').locator('[data-editar-ficha="REG-000001"]').click();
    await tratDe(pagina, 'REG-000001').locator('[data-campo="contacto"]').fill('912 000 111');
    await pagina.keyboard.press('Enter');
    await pagina.waitForFunction(() => /Registro editado/.test(document.querySelector('#aviso span').textContent));
    assert.deepEqual(await ultimo(pagina, 'editarRegistro'), { usuario: 'MAGALY', id: 'REG-000001', cambios: { contacto: '912 000 111' } });
    await esperarFicha(pagina, '40111222');
    assert.equal(await pagina.locator('#ficha [data-guardar-edicion]').count(), 0, 'el formulario se cierra');
    const fila = await pagina.evaluate(() => DEMO.getRegistros({ periodo: '2026-09' }).find(x => x.ID === 'REG-000001'));
    assert.equal(fila.CONTACTO, '912000111');
    // Esc cierra sin guardar.
    const n = await llamadas(pagina, 'editarRegistro');
    await tratDe(pagina, 'REG-000001').locator('[data-editar-ficha="REG-000001"]').click();
    await tratDe(pagina, 'REG-000001').locator('[data-campo="nombre"]').fill('Otra');
    await pagina.keyboard.press('Escape');
    assert.equal(await pagina.locator('#ficha [data-campo]').count(), 0);
    assert.equal(await llamadas(pagina, 'editarRegistro'), n);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('pacientes: «Decisión del médico…» con 6 meses avisa cuándo vuelve; la nueva reevaluación exige la fecha de retorno', async () => {
  const { navegador, pagina, errores } = await abrirPacientes();
  try {
    await abrirFicha(pagina, '41666777');
    const reu = espDe(pagina, 'REUMATOLOGÍA');
    await reu.locator('[data-decision]').click();
    assert.equal(await pagina.locator('#ficha input[name="fdec"]:checked').getAttribute('value'), 'ALTA');
    assert.deepEqual(await pagina.locator('#ficha input[name="fdec"]').evaluateAll(l => l.map(x => x.value)),
      ['ALTA', 'ALTA 6 MESES', 'ALTA 1 AÑO', 'NUEVA REEVALUACION']);
    await pagina.locator('#ficha input[name="fdec"][value="ALTA 6 MESES"]').check();
    // 01/10/2026 + 6 meses = 01/04/2027, menos 30 días = 02/03/2027.
    assert.match(await reu.textContent(), /Volverá a «Por contactar» el 02\/03\/2027 para agendar su control\./);
    // AVISO_ALTA_CONTROL_DIAS = 0 vale (no vuelve al valor por omisión).
    await pagina.evaluate(() => { S.reglas.avisoAltaControl = 0; });
    await pagina.locator('#ficha input[name="fdec"][value="ALTA 1 AÑO"]').check();
    assert.match(await reu.textContent(), /Volverá a «Por contactar» el 01\/10\/2027 para agendar su control\./);
    await pagina.locator('#ficha input[name="fdec"][value="NUEVA REEVALUACION"]').check();
    const n = await llamadas(pagina, 'darDeAlta');
    await pagina.locator('#ficha [data-alta-ok]').click();
    assert.equal(await aviso(pagina), 'Falta la fecha de retorno.');
    assert.equal(await llamadas(pagina, 'darDeAlta'), n);
    await pagina.locator('#falta-ret').fill(masDiasIso(HOY_DEMO, 40));
    await pagina.locator('#ficha [data-alta-ok]').click();
    await pagina.waitForFunction(() => /registrada/.test(document.querySelector('#aviso span').textContent));
    const u = await ultimo(pagina, 'darDeAlta');
    assert.deepEqual([u.decision, u.fechaRetorno, u.especialidad], ['NUEVA REEVALUACION', masDiasIso(HOY_DEMO, 40), 'REUMATOLOGÍA']);
    assert.match(await aviso(pagina), /^Nueva reevaluación registrada: Reumatología · retorno 10\/11\/2026 · ALT-\d+$/);
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
    assert.deepEqual(await ultimo(pagina, 'anularSesion'), { usuario: 'MAGALY', id: 'SES-000007', motivo: 'Fecha equivocada' });
    assert.equal(await aviso(pagina), 'Anulado: SES-000007.');
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

test('pacientes: «Procedimientos indicados antes de la plataforma» con Tipo y Detalle; el motivo abierto oculta el «Anular» de su fila', async () => {
  const { navegador, pagina, errores } = await abrirPacientes();
  try {
    await abrirFicha(pagina, '40333444');
    assert.deepEqual(await pagina.locator('#ficha table.previos th').allTextContents(), ['Fecha', 'Tipo', 'Detalle', 'Estado', 'Teléfono', 'Observaciones']);
    const celdas = await pagina.locator('#ficha table.previos tbody tr').first().locator('td').allTextContents();
    assert.equal(celdas.length, 6);
    assert.deepEqual(celdas.slice(0, 2), ['25/08/2026', 'Hierro']);
    const fila = pagina.locator('#f-hist .historia li').first();
    await fila.locator('[data-anular]').click();
    assert.equal(await fila.locator('#fmotivo').count(), 1);
    assert.equal(await fila.locator('[data-anular]').count(), 0, 'sin un segundo «Anular» en la fila');
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

test('pacientes: quien vino solo por Registro (sin consultas) tiene ficha con su nombre desde «Ver ficha completa»', async () => {
  const { navegador, pagina, errores } = await abrirTablero();
  try {
    await abrirPanelDe(pagina, 'REG-000003');
    await pagina.locator('#panel [data-ficha]').click();
    await esperarFicha(pagina, '40555666');
    assert.equal(await pagina.locator('#ficha .ficha header h2').textContent(), 'Ana María Flores Ríos');
    assert.match(await pagina.locator('#ficha').textContent(), /Sin consultas realizadas\./);
    assert.equal(await pagina.locator('#ficha .trat[data-reg="REG-000003"]').count(), 1);
    assert.equal((await pagina.evaluate(() => llamar('getPaciente', '40555666'))).citas.length, 0, 'el DEMO no le da consultas');
    // Aunque el nombre no llegue, si alguna sección trae algo se muestra la ficha.
    await pagina.evaluate(() => {
      DEMO.getPaciente = dni => ({ dni, nombre: '', series: [], citas: [], porConfirmar: [], seguimientos: [], registros: [], altas: [],
        indicaciones: [{ FECHA: '2026-08-01', TIPO: 'HIERRO', DETALLE: 'HIERRO', CANTIDAD: 1, ESTADO: 'COTIZÓ', TELEFONO: '987000111', OBSERVACIONES: '' }],
        fallecido: '', telefonos: [], telefonosDescartados: [] });
      S.fichaDni = '45000222';
      ir('pacientes', true);
    });
    await esperarFicha(pagina, '45000222');
    assert.doesNotMatch(await pagina.locator('#ficha').textContent(), /No encontramos/);
    assert.equal(await pagina.locator('#ficha .previos tbody tr').count(), 1);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

/* ============ Indicadores (Tarea 10) ============ */

const PESTANAS = ['resumen', 'llegan', 'campanas', 'procs', 'recup', 'motivos', 'sinpac'];
/** Abre Indicadores (por omisión con seg.usuario = MAGALY) y espera a que se pinte la primera pestaña. */
async function abrirIndicadores(opciones = {}) {
  const r = await abrir(Object.assign({}, opciones, { guardado: Object.assign({ 'seg.usuario': 'MAGALY' }, opciones.guardado || {}) }));
  try {
    if (!opciones.sinIr) await r.pagina.locator('[data-sec="indicadores"]:visible').first().click();
    await r.pagina.waitForSelector('#ipanel[data-tab] .vacio, #ipanel[data-tab] section', { timeout: 10000 });
  } catch (e) { await r.navegador.close(); throw e; }
  return r;
}
async function pestana(pagina, k) {
  await pagina.locator(`#iseg [data-tab="${k}"]`).click();
  await pagina.waitForSelector(`#ipanel[data-tab="${k}"]`);
}
const grande = pagina => pagina.locator('#ipanel .grande').textContent();
const textoPanel = pagina => pagina.locator('#ipanel').innerText().then(t => t.replace(/\s+/g, ' ').trim());
/** Filas de una tabla del panel: [[celda, …], …], con el texto de cada celda sin espacios de más. */
const filasDe = (pagina, sel) => pagina.locator(`#ipanel ${sel} tbody tr`).evaluateAll(l => l.map(tr =>
  [...tr.children].map(td => td.textContent.replace(/\s+/g, ' ').trim())));

test('indicadores: cada una de las siete pestañas se pinta con los números del DEMO', async () => {
  const { navegador, pagina, errores } = await abrirIndicadores();
  try {
    assert.deepEqual(await pagina.locator('#iseg [data-tab]').allTextContents(),
      ['Resumen del mes', '¿Hasta dónde llegan?', 'Campañas', 'Procedimientos', 'Recuperación', 'Motivos de cierre', 'Procedimientos sin paciente']);
    assert.equal(await pagina.locator('#iseg').getAttribute('role'), 'tablist');
    assert.equal(await pagina.locator('#imes').textContent(), 'setiembre 2026');
    assert.equal(await pagina.locator('#msig').isDisabled(), true, 'es el último mes');

    // 1. Resumen del mes (setiembre, todos los médicos: 9 de 35).
    assert.equal(await grande(pagina), '26%');
    let t = await textoPanel(pagina);
    assert.match(t, /de los pacientes de setiembre no volvieron a su reevaluación\./);
    assert.match(t, /9 de 35 pacientes/);
    assert.match(t, /Nuevos 3 de 17/);
    assert.match(t, /En control 6 de 18/);
    assert.match(t, /A 65 pacientes de este mes aún no les toca volver: no cuentan todavía\./);
    assert.match(await pagina.locator('#ipanel .r-meta').textContent(), /Dentro de la meta: que vuelva el 60 %/);
    assert.equal(await pagina.locator('#ipanel .r-meta.ok').count(), 1);
    assert.deepEqual(await pagina.locator('#ipanel .sec > div').evaluateAll(l => l.map(d => d.textContent.replace(/\s+/g, ' ').trim())), [
      '40% no siguieron el tratamiento de hierro 8 de 20',
      '0% completaron el tratamiento de hierro 0 de 12',
      '60% no siguieron otros procedimientos 3 de 5',
      '39% volvieron tras el seguimiento 7 de 18']);
    // Seis barras (abril a setiembre), la de setiembre rayada (en curso) y marcada; la línea de meta en el 40 %.
    assert.deepEqual(await pagina.locator('#ipanel .barras [data-mes]').evaluateAll(l => l.map(b => b.dataset.mes)),
      ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']);
    assert.equal(await pagina.locator('#ipanel .barras [data-mes="2026-09"]').getAttribute('aria-pressed'), 'true');
    assert.deepEqual(await pagina.locator('#ipanel .barras .curso').evaluateAll(l => l.map(b => b.dataset.mes)), ['2026-09']);
    assert.equal(await pagina.locator('#ipanel .barras .linea').count(), 1);
    assert.match(await pagina.locator('#ipanel .mm-ley').textContent(), /Meta: no más de 40 %/);

    // 2. ¿Hasta dónde llegan? 100 cuadritos, el relato y la tabla con su total.
    await pestana(pagina, 'llegan');
    assert.equal(await pagina.locator('#ipanel .waffle i').count(), 100);
    assert.match(await pagina.locator('#ipanel .relato p').first().textContent(), /^De cada 100 pacientes nuevos, \d+ no vuelven nunca después de su primera consulta\.$/);
    assert.match(await textoPanel(pagina), /La meta es que vuelva el 60 %; hoy vuelve el \d+ %\./);
    const llegan = await filasDe(pagina, '.tabla');
    assert.deepEqual(llegan.map(f => f[0]), ['marzo 2026', 'abril 2026', 'mayo 2026', 'junio 2026', 'julio 2026', 'agosto 2026', 'Total']);
    assert.equal(llegan.at(-1)[1], '310');
    for (const f of llegan) {
      const partes = f.slice(3).map(c => Number(c.split(' · ')[0]));
      assert.equal(partes.reduce((a, b) => a + b, 0), Number(f[1]), `${f[0]}: las partes suman el total`);
    }
    assert.equal(await pagina.locator('#ipanel tr.total').count(), 1);

    // 3. Campañas: por canal y por campaña (8 y «Ver las 11 campañas»), base 0 como «— (0/0)».
    await pestana(pagina, 'campanas');
    const canales = await filasDe(pagina, '[data-tabla="canal"]');
    assert.deepEqual(canales[0], ['FACEBOOK ADS', '53', '34 % (17/50)', '3']);
    assert.equal(await pagina.locator('#ipanel [data-tabla="campana"] tbody tr').count(), 8);
    assert.equal((await pagina.locator('#vercamp').textContent()).trim(), 'Ver las 11 campañas');
    await pagina.locator('#vercamp').click();
    const campanas = await filasDe(pagina, '[data-tabla="campana"]');
    assert.equal(campanas.length, 11);
    assert.deepEqual(campanas.find(f => f[0] === 'ANM-002'), ['ANM-002', '2', '— (0/0)', '2']);
    assert.ok(campanas.some(f => f[0] === 'Sin registro en el CRM'));
    assert.equal((await pagina.locator('#vercamp').textContent()).trim(), 'Ver menos');
    assert.doesNotMatch(await textoPanel(pagina), /Sin lead/);

    // 4. Procedimientos (la prueba de «Por tipo» va aparte).
    await pestana(pagina, 'procs');
    assert.deepEqual(await pagina.locator('#ipanel [data-sub]').allTextContents(), ['Por tipo', 'Como se escribió', 'Por médico']);
    assert.match(await pagina.locator('#ipanel .conocido').textContent(), /^Juntamos los nombres escritos de distinta forma/);

    // 5. Recuperación de setiembre: 6 seguimientos, 4 volvieron, mediana de 8 días; por asesora y por mes.
    await pestana(pagina, 'recup');
    t = await textoPanel(pagina);
    assert.match(t, /Seguimientos hechos en setiembre 2026/);
    assert.deepEqual(await pagina.locator('#ipanel .cifras > div').evaluateAll(l => l.map(d => d.textContent.replace(/\s+/g, ' ').trim())),
      ['6 seguimientos hechos', '4 volvieron tras el seguimiento (67 %)', '8 días en volver, en la mitad de los casos']);
    assert.deepEqual(await filasDe(pagina, '[data-tabla="asesora"]'), [
      ['Magaly', '3', '5', '67 % (2/3)'], ['Ana', '1', '—', '0 % (0/1)'], ['Dr. Eli Cabanillas', '1', '9', '100 % (1/1)'], ['Rachel', '1', '12', '100 % (1/1)']]);
    assert.deepEqual((await filasDe(pagina, '[data-tabla="mes"]')).map(f => f[0]), ['julio 2026', 'agosto 2026', 'setiembre 2026']);

    // 6. Motivos de cierre, con la nota (D5).
    await pestana(pagina, 'motivos');
    assert.equal(await pagina.locator('#ipanel .conocido').textContent(),
      'Este cuadro todavía no se filtra por mes ni por médico, y no incluye los cierres automáticos «sin respuesta».');
    assert.deepEqual(await filasDe(pagina, '.tabla'), [['Se atiende en otro lugar', '4 · 40 %'], ['No desea continuar', '3 · 30 %'],
      ['Número equivocado', '2 · 20 %'], ['Falleció', '1 · 10 %']]);

    // 7. Procedimientos sin paciente.
    await pestana(pagina, 'sinpac');
    const sin = await filasDe(pagina, '.tabla');
    assert.equal(sin.length, 3);
    assert.deepEqual(sin[0].slice(0, 5), ['04/05/2026', 'Hierro', 'Paola Rivera', '956 789 012', 'IND-0120']);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('indicadores: «Procedimientos sin paciente» guarda el DNI escrito, quita la fila y avisa; vacío o desconocido, no', async () => {
  const { navegador, pagina, errores } = await abrirIndicadores();
  try {
    await pestana(pagina, 'sinpac');
    const fila = id => pagina.locator(`#ipanel tr:has([data-asignar="${id}"])`);
    // Vacío: avisa y no llama al servidor.
    await fila('IND-0131').locator('button[data-asignar]').click();
    assert.match(await aviso(pagina), /Escriba el DNI/);
    assert.equal(await pagina.evaluate(() => DEMO._llamadas.asignarDniIndicacion || 0), 0);
    // Desconocido: el servidor lo rechaza; la fila sigue, con lo escrito y el botón activo.
    await fila('IND-0131').locator('input').fill('49999999');
    await fila('IND-0131').locator('input').press('Enter');
    await pagina.waitForFunction(() => /No se guardó/.test(document.querySelector('#aviso span').textContent));
    assert.match(await aviso(pagina), /no está en SOFDOC ni en Registro/);
    assert.equal(await fila('IND-0131').locator('input').inputValue(), '49999999');
    assert.equal(await fila('IND-0131').locator('button[data-asignar]').isDisabled(), false);
    // Conocido: se guarda, la fila desaparece y se avisa.
    await fila('IND-0120').locator('input').fill('40 111 222');
    await fila('IND-0120').locator('button[data-asignar]').click();
    await pagina.waitForFunction(() => !document.querySelector('#ipanel [data-asignar="IND-0120"]'));
    assert.deepEqual(await ultimo(pagina, 'asignarDniIndicacion'), { usuario: 'MAGALY', id: 'IND-0120', dni: '40 111 222' });
    assert.match(await aviso(pagina), /DNI 40111222/);
    assert.equal(await pagina.locator('#ipanel button[data-asignar]').count(), 2, 'quedan las otras dos filas');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('indicadores: el mes cambia la cifra grande con ‹ › y con un clic en la barra', async () => {
  const { navegador, pagina, errores } = await abrirIndicadores();
  try {
    assert.equal(await grande(pagina), '26%');
    await pagina.locator('#mant').click();
    assert.equal(await pagina.locator('#imes').textContent(), 'agosto 2026');
    assert.equal(await grande(pagina), '47%');
    assert.match(await textoPanel(pagina), /67 de 142 pacientes/);
    assert.equal(await pagina.locator('#ipanel .r-meta.mal').count(), 1);
    assert.match(await pagina.locator('#ipanel .r-meta').textContent(), /Fuera de la meta por 7 puntos: la meta es que no vuelva como máximo el 40 %\./);
    assert.equal(await pagina.locator('#ipanel .barras [data-mes="2026-08"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await pagina.locator('#msig').isDisabled(), false);
    // Un clic en la barra de abril.
    await pagina.locator('#ipanel .barras [data-mes="2026-04"]').click();
    assert.equal(await pagina.locator('#imes').textContent(), 'abril 2026');
    assert.notEqual(await grande(pagina), '47%');
    // Marzo solo está en getKpi (primera consulta): se alcanza con ‹ y el resumen lo dice en una frase.
    await pagina.locator('#mant').click();
    assert.equal(await pagina.locator('#imes').textContent(), 'marzo 2026');
    assert.equal(await pagina.locator('#mant').isDisabled(), true, 'es el primer mes');
    assert.match(await textoPanel(pagina), /Todavía no hay pacientes de marzo en el resumen\./);
    await pagina.locator('#msig').click();
    assert.equal(await pagina.locator('#imes').textContent(), 'abril 2026');
    await pagina.locator('#ipanel .barras [data-mes="2026-09"]').click();
    assert.equal(await grande(pagina), '26%');
    // El mes manda en Recuperación.
    await pagina.locator('#mant').click();
    await pestana(pagina, 'recup');
    assert.match(await textoPanel(pagina), /Seguimientos hechos en agosto 2026/);
    assert.match(await pagina.locator('#ipanel .cifras').textContent(), /^5 seguimientos hechos/);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('indicadores: el filtro de médico cambia las cifras; especialidad solo donde los datos la traen (D3)', async () => {
  const { navegador, pagina, errores } = await abrirIndicadores();
  try {
    const ELI = 'Dr. ELÍ FABRIZIO CABANILLAS HUALPA';
    assert.equal(await pagina.locator('#imed').inputValue(), '', 'una asesora ve a todos los médicos');
    assert.equal(await pagina.locator('#iesp-c').isVisible(), false, 'el Resumen del mes no tiene especialidad');
    await pagina.locator('#imed').selectOption(ELI);
    assert.equal(await grande(pagina), '25%');
    assert.match(await textoPanel(pagina), /de sus pacientes de setiembre no volvieron/);
    await pestana(pagina, 'campanas');
    assert.deepEqual((await filasDe(pagina, '[data-tabla="canal"]'))[0], ['FACEBOOK ADS', '30', '38 % (11/29)', '1']);
    assert.equal(await pagina.locator('#iesp-c').isVisible(), false, 'campañas no tiene especialidad');
    await pestana(pagina, 'llegan');
    assert.equal(await pagina.locator('#iesp-c').isVisible(), true);
    assert.equal((await filasDe(pagina, '.tabla')).at(-1)[1], '170', 'solo el Dr. Cabanillas: 44 + 38 + 40 + 48');
    assert.match(await pagina.locator('#ipanel .relato p').first().textContent(), /^De cada 100 pacientes nuevos del Dr\. Cabanillas,/);
    await pagina.locator('#imed').selectOption('');
    await pagina.locator('#iesp').selectOption('REUMATOLOGÍA');
    assert.equal((await filasDe(pagina, '.tabla')).at(-1)[1], '16');
    await pestana(pagina, 'recup');
    assert.equal(await pagina.locator('#iesp-c').isVisible(), true);
    assert.match(await pagina.locator('#ipanel .cifras').textContent(), /^1 seguimiento hecho/);
    await pestana(pagina, 'procs');
    assert.equal(await pagina.locator('#iesp-c').isVisible(), false);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('indicadores: un médico entra directo a Indicadores con su filtro propuesto, y puede ver a todos (D2)', async () => {
  const { navegador, pagina, errores } = await abrirIndicadores({ guardado: { 'seg.usuario': 'DR. ELI CABANILLAS' }, sinIr: true });
  try {
    assert.equal(await pagina.locator('.menu [aria-current="page"]').getAttribute('data-sec'), 'indicadores');
    assert.equal(await pagina.locator('#imed').inputValue(), 'Dr. ELÍ FABRIZIO CABANILLAS HUALPA');
    assert.equal(await pagina.locator('#imed').isDisabled(), false);
    assert.equal(await grande(pagina), '25%');
    await pagina.locator('#imed').selectOption('');
    assert.equal(await grande(pagina), '26%');
    // Cambiar de pestaña o de mes no le vuelve a imponer el filtro.
    await pestana(pagina, 'llegan');
    await pestana(pagina, 'resumen');
    assert.equal(await pagina.locator('#imed').inputValue(), '');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('indicadores: «cohorte», «lead», «KPI» y «días de atraso» no aparecen en ninguna pestaña', async () => {
  const { navegador, pagina, errores } = await abrirIndicadores();
  try {
    let texto = '';
    for (const k of PESTANAS) {
      await pestana(pagina, k);
      texto += await pagina.locator('body').innerText();
      if (k === 'campanas') { await pagina.locator('#vercamp').click(); texto += await pagina.locator('#ipanel').innerText(); }
      if (k === 'procs') for (const s of ['escrito', 'medico']) {
        await pagina.locator(`#ipanel [data-sub="${s}"]`).click();
        texto += await pagina.locator('#ipanel').innerText();
      }
      if (['llegan', 'campanas', 'procs'].includes(k)) {
        await pagina.locator('#ipanel [data-solomes]').click();
        texto += await pagina.locator('#ipanel').innerText();
        await pagina.locator('#ipanel [data-solomes]').click();
      }
    }
    assert.doesNotMatch(texto, /cohorte|\blead|kpi|d[ií]as de atraso/i);
    // Ni en las etiquetas para lectores de pantalla.
    const etiquetas = await pagina.locator('#v-indicadores [aria-label], #v-indicadores [title]')
      .evaluateAll(l => l.map(e => (e.getAttribute('aria-label') || '') + ' ' + (e.getAttribute('title') || '')).join(' '));
    assert.doesNotMatch(etiquetas, /cohorte|\blead|kpi|d[ií]as de atraso/i);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('indicadores: «Por tipo» junta «AMO + BIOSIA» con «AMO + BIOPSIA»; «Como se escribió» las separa', async () => {
  const { navegador, pagina, errores } = await abrirIndicadores();
  try {
    await pestana(pagina, 'procs');
    assert.equal(await pagina.locator('#ipanel [data-sub="tipo"]').getAttribute('aria-pressed'), 'true');
    let filas = await filasDe(pagina, '.tabla');
    assert.deepEqual(filas.find(f => f[0] === 'AMO + BIOPSIA'), ['AMO + BIOPSIA', '16', '4', '4', '25 %']);
    assert.equal(filas.some(f => /BIOSIA|MÉDULA/.test(f[0])), false);
    assert.deepEqual(filas.find(f => f[0] === 'AMO + BIOPSIA + CITOMETRÍA DE FLUJO'), ['AMO + BIOPSIA + CITOMETRÍA DE FLUJO', '7', '1', '1', '14 %']);
    assert.deepEqual(filas[0], ['Hierro (Ferinject)', '77', '37', '31', '48 %'], 'ordenado por cotizados');
    assert.equal(await pagina.locator('#ipanel .conocido').count(), 1);
    await pagina.locator('#ipanel [data-sub="escrito"]').click();
    assert.equal(await pagina.locator('#ipanel .conocido').count(), 0, 'el aviso solo va en «Por tipo»');
    filas = await filasDe(pagina, '.tabla');
    assert.deepEqual(filas.find(f => f[0] === 'AMO + BIOSIA'), ['AMO + BIOSIA', '3', '1', '1', '33 %']);
    assert.deepEqual(filas.find(f => f[0] === 'AMO + BIOPSIA'), ['AMO + BIOPSIA', '9', '1', '1', '11 %']);
    assert.ok(filas.some(f => f[0] === 'BIOPSIA DE MÉDULA + AMO'));
    await pagina.locator('#ipanel [data-sub="medico"]').click();
    filas = await filasDe(pagina, '.tabla');
    assert.deepEqual(filas.map(f => f[0]).sort(), ['Dr. Elí Fabrizio Cabanillas Hualpa', 'Dra. Karen Diana Matos Peña', 'Sin médico']);
    // «Solo setiembre 2026» deja solo lo de ese mes.
    await pagina.locator('#ipanel [data-sub="tipo"]').click();
    await pagina.locator('#ipanel [data-solomes]').click();
    assert.match(await pagina.locator('#ipanel [data-solomes]').textContent(), /Solo setiembre 2026/);
    assert.equal(await pagina.locator('#ipanel [data-solomes]').getAttribute('aria-pressed'), 'true');
    filas = await filasDe(pagina, '.tabla');
    assert.equal(filas.some(f => f[0] === 'AMO + BIOPSIA'), false, 'AMO + BIOPSIA es de agosto');
    assert.deepEqual(filas.find(f => f[0] === 'SANGRÍA'), ['SANGRÍA', '7', '6', '5', '86 %']);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('indicadores: getKpi y getResumen se piden al entrar, se guardan y se vuelven a pedir tras un guardado en el tablero', async () => {
  const { navegador, pagina, errores } = await abrirIndicadores();
  try {
    assert.equal(await llamadas(pagina, 'getKpi'), 1);
    assert.equal(await llamadas(pagina, 'getResumen'), 1);
    // Ir y volver sin escribir: sale del caché.
    await pagina.locator('.menu [data-sec="tablero"]').click();
    await pagina.waitForSelector('#tablero .tarjeta');
    await pagina.locator('.menu [data-sec="indicadores"]').click();
    await pagina.waitForSelector('#ipanel[data-tab] section');
    assert.equal(await llamadas(pagina, 'getKpi'), 1);
    assert.equal(await llamadas(pagina, 'getResumen'), 1);
    // Un guardado en el tablero (1 = «No contestó») deja los indicadores viejos.
    await pagina.locator('.menu [data-sec="tablero"]').click();
    await pagina.waitForSelector('#tablero .tarjeta');
    const c1 = (await pintadas(pagina, '1')).map(v => v.id);
    const n = await llamadas(pagina, 'registrarResultado');
    await pagina.locator(`#tablero [data-card="${c1[0]}"]`).focus();
    await pagina.keyboard.press('1');
    await esperarEstable(pagina);
    assert.equal(await llamadas(pagina, 'registrarResultado'), n + 1);
    assert.equal(await pagina.evaluate(() => S.kpi === null && S.resumen === null), true);
    await pagina.locator('.menu [data-sec="indicadores"]').click();
    await pagina.waitForFunction(() => DEMO._llamadas.getKpi === 2 && DEMO._llamadas.getResumen === 2);
    await pagina.waitForSelector('#ipanel[data-tab] section');
    assert.equal(await grande(pagina), '26%');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('indicadores: una respuesta que llega después de un guardado no se queda en el caché', async () => {
  const { navegador, pagina, errores } = await abrir({ guardado: { 'seg.usuario': 'MAGALY' } });
  try {
    await pagina.evaluate(() => { DEMO._demora.getKpi = 400; });
    await pagina.locator('.menu [data-sec="indicadores"]').click();
    await pagina.waitForFunction(() => DEMO._llamadas.getKpi === 1);
    await pagina.evaluate(() => invalidarIndicadores());   // un guardado mientras getKpi está en vuelo
    await pagina.waitForFunction(() => DEMO._llamadas.getKpi === 2, null, { timeout: 5000 });
    await pagina.waitForSelector('#ipanel[data-tab] section');
    assert.equal(await llamadas(pagina, 'getResumen'), 2);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('indicadores: si el servidor falla, «No se pudieron calcular los indicadores: …» con «Reintentar»', async () => {
  const { navegador, pagina, errores } = await abrir({ guardado: { 'seg.usuario': 'MAGALY' }, fallar: { getKpi: 'Se acabó el tiempo.' } });
  try {
    await pagina.locator('.menu [data-sec="indicadores"]').click();
    await pagina.waitForSelector('#ipanel .vacio [data-reintentar]');
    assert.match(await pagina.locator('#ipanel').textContent(), /No se pudieron calcular los indicadores: Se acabó el tiempo\./);
    await pagina.evaluate(() => { delete DEMO._fallar.getKpi; });
    await pagina.locator('#ipanel [data-reintentar]').click();
    await pagina.waitForSelector('#ipanel[data-tab] section');
    assert.equal(await grande(pagina), '26%');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('indicadores en el celular (390 px) y en oscuro: sin scroll horizontal en ninguna pestaña', async () => {
  const { navegador, pagina, errores } = await abrirIndicadores({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
  try {
    for (const k of PESTANAS) {
      await pagina.locator(`#iseg [data-tab="${k}"]`).scrollIntoViewIfNeeded();
      await pestana(pagina, k);
      assert.ok(await pagina.evaluate(() => document.documentElement.scrollWidth <= 390), `${k}: sin scroll horizontal`);
    }
    await pestana(pagina, 'resumen');
    assert.equal(await pagina.evaluate(() => getComputedStyle(document.querySelector('#ipanel .grande')).fontSize), '84px');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

/* ============ Resumen imprimible (Tarea 11) ============ */

/** Sustituye window.print por un contador (el diálogo real no se puede abrir en la prueba). */
const espiarPrint = pagina => pagina.evaluate(() => { window.__print = 0; window.print = () => { window.__print++; }; });
const imprimir = async pagina => {
  await pagina.locator('#iimprimir').click();
  await pagina.waitForFunction(() => window.__print > 0, null, { timeout: 10000 });
};

test('imprimible: se arma con los datos del DEMO, llama a window.print y su cifra grande coincide con la de la pantalla', async () => {
  const { navegador, pagina, errores } = await abrirIndicadores();
  try {
    assert.equal(await pagina.locator('#iimprimir').textContent().then(t => t.trim()), 'Resumen para imprimir');
    assert.equal(await pagina.locator('#imprimible').isVisible(), false, 'oculto en pantalla');
    await espiarPrint(pagina);
    const pantalla = await grande(pagina);
    assert.equal(pantalla, '26%');
    await imprimir(pagina);
    assert.equal(await pagina.evaluate(() => window.__print), 1);
    assert.equal(await pagina.locator('#imprimible .pag').count(), 2);
    assert.equal(await pagina.locator('#imprimible #imp-p1').count(), 1);
    assert.equal(await pagina.locator('#imprimible #imp-p2').count(), 1);
    assert.equal((await pagina.locator('#imprimible .imp-grande').textContent()).trim(), pantalla, 'la cifra impresa es la de la pantalla');
    const p1 = await pagina.locator('#imp-p1').textContent().then(t => t.replace(/\s+/g, ' '));
    assert.match(p1, /todos los médicos/);
    assert.match(p1, /setiembre 2026/);
    assert.match(p1, /de los pacientes de setiembre no volvieron a su reevaluación\./);
    assert.match(p1, /Son 9 de 35 pacientes/);
    assert.deepEqual(await pagina.locator('#imp-p1 .imp-sec p').evaluateAll(l => l.map(p => p.textContent.replace(/\s+/g, ' ').trim())), [
      '40% no siguieron el tratamiento de hierro (8 de 20).',
      '0% completaron el tratamiento de hierro (0 de 12).',
      '60% no siguieron otros procedimientos (3 de 5).',
      '39% volvieron tras el seguimiento (7 de 18).']);
    assert.equal(await pagina.locator('#imp-p1 .imp-barras [data-imp-mes]').count(), 6);
    assert.equal(await pagina.locator('#imp-p1 .imp-barras .curso').count(), 1);
    assert.equal(await pagina.locator('#imp-p1 .imp-conviene li').count(), 2);
    assert.match(await pagina.locator('#imp-p1 .imp-conviene li').first().textContent(), /^Mejoró: de 50 % a 26 % en 6 meses\.$/);
    assert.match(await pagina.locator('#imp-p1 .imp-conviene li').nth(1).textContent(), /^Lo que más se pierde: 60 % no siguieron otros procedimientos \(3 de 5\)\.$/);
    const hoyDemo = await pagina.evaluate(() => DEMO.bootstrap().hoy);
    assert.equal(hoyDemo, '2026-10-01');
    assert.match(p1, /Generado el 01\/10\/2026 · datos de SOFDOC y de la plataforma/);
    // Página 2: 100 cuadritos, 5 canales (los mismos primeros de la pestaña Campañas) y 2 frases de procedimientos.
    assert.equal(await pagina.locator('#imp-p2 .waffle i').count(), 100);
    assert.match(await pagina.locator('#imp-p2 .imp-relato p').first().textContent(), /^De cada 100 pacientes nuevos, \d+ no vuelven nunca/);
    const canales = await pagina.locator('#imp-p2 .imp-canales tbody tr').evaluateAll(l => l.map(tr => tr.children[0].textContent.trim()));
    assert.equal(canales.length, 5);
    assert.equal(await pagina.locator('#imp-p2 .imp-procs p').count(), 2);
    assert.match(await pagina.locator('#imp-p2 .imp-procs p').first().textContent(), /de lo cotizado .* se empezó: \d+ de \d+\./);
    await pestana(pagina, 'campanas');
    const enPantalla = (await filasDe(pagina, '[data-tabla="canal"]')).slice(0, 5).map(f => f[0]);
    assert.deepEqual(canales, enPantalla, 'los canales impresos son los primeros de la pantalla');
    // Con el filtro de médico, la cifra impresa sigue siendo la de la pantalla.
    await pestana(pagina, 'resumen');
    await pagina.locator('#imed').selectOption('Dr. ELÍ FABRIZIO CABANILLAS HUALPA');
    const filtrada = await grande(pagina);
    assert.equal(filtrada, '25%');
    await imprimir(pagina);
    assert.equal(await pagina.evaluate(() => window.__print), 2);
    assert.equal((await pagina.locator('#imprimible .imp-grande').textContent()).trim(), filtrada);
    assert.match(await pagina.locator('#imp-p1').textContent(), /de sus pacientes de setiembre/);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('imprimible: si getResumen y getKpi no están en el caché, el botón los pide antes de imprimir', async () => {
  const { navegador, pagina, errores } = await abrirIndicadores();
  try {
    await espiarPrint(pagina);
    await pagina.evaluate(() => invalidarIndicadores());
    const antes = await pagina.evaluate(() => ({ r: DEMO._llamadas.getResumen, k: DEMO._llamadas.getKpi }));
    await imprimir(pagina);
    const despues = await pagina.evaluate(() => ({ r: DEMO._llamadas.getResumen, k: DEMO._llamadas.getKpi }));
    assert.equal(despues.r, antes.r + 1);
    assert.equal(despues.k, antes.k + 1);
    assert.equal((await pagina.locator('#imprimible .imp-grande').textContent()).trim(), '26%');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('queConvieneMirar: tendencia (mejoró, empeoró, se mantiene) y la cifra secundaria peor', async () => {
  const { navegador, pagina, errores } = await abrir();
  try {
    const frases = await pagina.evaluate(() => {
      const mes = (ps) => ps.map((p, i) => ({ mes: '2026-0' + (4 + i), p }));
      const sec = [[8, 20, false, 'no siguieron el tratamiento de hierro', ''], [0, 12, true, 'completaron el tratamiento de hierro', 'x'],
        [3, 5, false, 'no siguieron otros procedimientos', ''], [7, 18, true, 'volvieron tras el seguimiento', '']];
      return {
        baja: queConvieneMirar(mes([61, 58, 58, 57, 47, 25]), sec, 60),
        sube: queConvieneMirar(mes([30, 31, 36]), sec, 60),
        igual: queConvieneMirar(mes([40, 38, 43]), sec, 60),
        justo5: queConvieneMirar(mes([40, 45]), sec, 60),
        justo4: queConvieneMirar(mes([40, 44]), sec, 60),
        peorHierro: queConvieneMirar(mes([40, 40]), [[5, 12, false, 'no siguieron el tratamiento de hierro', ''], [0, 0, true, 'completaron', 'v'], [1, 5, false, 'no siguieron otros procedimientos', ''], [0, 0, true, 'volvieron', 'v']], 60),
        sinNada: queConvieneMirar(mes([null]), [[0, 0, false, 'a', ''], [0, 0, true, 'b', ''], [0, 0, false, 'c', ''], [0, 0, true, 'd', '']], 60)
      };
    });
    assert.deepEqual(frases.baja, ['Mejoró: de 61 % a 25 % en 6 meses.', 'Lo que más se pierde: 60 % no siguieron otros procedimientos (3 de 5).']);
    assert.equal(frases.sube[0], 'Empeoró: de 30 % a 36 % en 3 meses.');
    assert.equal(frases.igual[0], 'Se mantiene alrededor de 43 %.');
    assert.equal(frases.justo5[0], 'Empeoró: de 40 % a 45 % en 2 meses.');
    assert.equal(frases.justo4[0], 'Se mantiene alrededor de 44 %.');
    assert.equal(frases.peorHierro[1], 'Lo que más se pierde: 42 % no siguieron el tratamiento de hierro (5 de 12).');
    assert.equal(frases.sinNada.length, 2);
    assert.ok(frases.sinNada.every(t => typeof t === 'string' && t));
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('imprimible: en pantalla de impresión solo se ve #imprimible, con la paleta clara aunque la app esté en oscuro', async () => {
  const { navegador, pagina, errores } = await abrirIndicadores({ guardado: { 'seg.modo': 'oscuro' } });
  try {
    assert.equal(await pagina.evaluate(() => document.documentElement.dataset.modo), 'oscuro');
    await espiarPrint(pagina);
    await imprimir(pagina);
    await pagina.emulateMedia({ media: 'print' });
    assert.equal(await pagina.locator('#imprimible').isVisible(), true);
    assert.equal(await pagina.locator('#imp-p1').isVisible(), true);
    assert.equal(await pagina.locator('#imp-p2').isVisible(), true);
    // Cada selector existe y se ve en pantalla; al imprimir, no (si no, la aserción no podría fallar).
    const PANTALLA = ['.app', '.side', '#vista', '#v-indicadores', '#ipanel', '#aviso'];
    await pagina.evaluate(() => avisar('Aviso de prueba'));
    await pagina.emulateMedia({ media: 'screen' });
    for (const sel of PANTALLA) {
      assert.equal(await pagina.locator(sel).count(), 1, sel + ' existe');
      assert.equal(await pagina.locator(sel).isVisible(), true, sel + ' se ve en pantalla');
    }
    await pagina.emulateMedia({ media: 'print' });
    for (const sel of PANTALLA) assert.equal(await pagina.locator(sel).isVisible(), false, sel + ' no se imprime');
    // Lo que hace el navegador al imprimir: beforeprint fuerza la paleta clara; afterprint devuelve el modo.
    await pagina.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    assert.notEqual(await pagina.evaluate(() => document.documentElement.dataset.modo), 'oscuro');
    assert.equal(await pagina.evaluate(() => getComputedStyle(document.querySelector('#imprimible .imp-grande')).color), 'rgb(140, 29, 24)');
    assert.equal(await pagina.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(255, 255, 255)');
    await pagina.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    assert.equal(await pagina.evaluate(() => document.documentElement.dataset.modo), 'oscuro');
    await pagina.emulateMedia({ media: 'screen' });
    assert.equal(await pagina.locator('#imprimible').isVisible(), false);
    assert.equal(await pagina.locator('.app').isVisible(), true);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('imprimible: el PDF tiene exactamente dos páginas A4 y no trae palabras prohibidas', async () => {
  const { navegador, pagina, errores } = await abrirIndicadores();
  try {
    await espiarPrint(pagina);
    await imprimir(pagina);
    const texto = await pagina.locator('#imprimible').evaluate(e => e.textContent);
    assert.doesNotMatch(texto, /cohorte|días de atraso|\blead\b|KPI|Sin lead|—/i);
    await pagina.emulateMedia({ media: 'print' });
    const pdf = await pagina.pdf({ preferCSSPageSize: true });
    const paginas = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    assert.equal(paginas, 2, 'dos páginas');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

/* ============ Repaso final (Tarea 12) ============ */

const LARGO = 'María de los Ángeles Wenceslaa Huamaní Quispecahuanavillavicencio de la Puente Torreblanca';

test('celular 390 px: ninguna pantalla ni el panel con un nombre largo tienen scroll horizontal; «‹ Volver» se ve', async () => {
  const { navegador, pagina, errores } = await abrirTablero({ viewport: { width: 390, height: 844 } });
  try {
    const ancho = () => pagina.evaluate(() => document.documentElement.scrollWidth);
    for (const sec of SECCIONES) {
      await pagina.locator(`.navmovil [data-sec="${sec}"]`).click();
      await pagina.waitForSelector(`#v-${sec}`, { state: 'visible' });
      if (sec === 'indicadores') await pagina.waitForSelector('#ipanel[data-tab] section');
      if (sec === 'pacientes') { await pagina.evaluate(() => abrirFicha('40333444')); await pagina.waitForFunction(() => PA.estado === 'listo'); }
      assert.ok(await ancho() <= 390, `${sec}: ${await ancho()}`);
    }
    await pagina.locator('.navmovil [data-sec="tablero"]').click();
    await pagina.waitForSelector('#v-tablero', { state: 'visible' });
    await pagina.evaluate(n => { S.pacientes.find(p => p.id === '40444555|HEMATOLOGÍA').n = n; pintarTablero(); }, LARGO);
    assert.ok(await ancho() <= 390, 'tarjeta con nombre largo');
    await abrirPanelDe(pagina, LUIS);
    assert.equal((await pagina.locator('#panel h2').textContent()).trim(), LARGO);
    assert.ok(await ancho() <= 390, `panel: ${await ancho()}`);
    assert.ok(await pagina.evaluate(() => { const p = document.getElementById('panel'); return p.scrollWidth <= p.clientWidth; }), 'el panel no se desborda');
    assert.ok(await pagina.locator('#panel .p-volver').isVisible(), '«‹ Volver» visible');
    assert.equal(await pagina.locator('#panel .p-cerrar').isVisible(), false);
    assert.match(await pagina.locator('#panel .p-volver').textContent(), /Volver/);
    await pagina.locator('#panel [data-acc="agendo"]').click();
    assert.ok(await ancho() <= 390, 'con un paso abierto');
    await pagina.locator('#panel .p-volver').click();
    await pagina.waitForFunction(() => !seleccion.panel);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('movimiento reducido: abrir el panel y mover una tarjeta no deja animaciones pendientes', async () => {
  const navegador = await chromium.launch();
  try {
    const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 } });
    const pagina = await contexto.newPage();
    const errores = [];
    pagina.on('pageerror', e => errores.push(e.message));
    await pagina.emulateMedia({ reducedMotion: 'reduce' });
    await pagina.addInitScript(() => localStorage.setItem('seg.usuario', 'MAGALY'));
    await pagina.goto('file://' + ARCHIVO);
    await pagina.waitForFunction(() => S.fase === 'listo' && !!document.querySelector('#tablero .tarjeta'));
    // Tras 50 ms (y dos cuadros, para que una máquina cargada alcance a pintar) no queda ninguna animación.
    const pendientes = async () => {
      await pagina.waitForTimeout(50);
      await pagina.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      const lista = await pagina.evaluate(() => document.getAnimations().map(a => [a.constructor.name, a.animationName || a.transitionProperty || '',
        a.effect && a.effect.target ? a.effect.target.id || String(a.effect.target.className) : ''].join(' ')));
      if (lista.length) console.log('animaciones pendientes:', lista);
      return lista.length;
    };
    assert.equal(await pendientes(), 0, 'carga sin cascada');
    await pagina.locator(`#tablero [data-card="${LUIS}"]`).click();
    await pagina.waitForFunction(() => document.getElementById('panel').classList.contains('abierto'));
    assert.equal(await pendientes(), 0, 'panel abierto');
    await pagina.locator('#panel [data-acc="agendo"]').click();
    assert.equal(await pendientes(), 0, 'paso');
    await confirmarPaso(pagina, '2026-10-06');
    await esperarCol(pagina, LUIS, '2');
    await esperarEstable(pagina);
    assert.equal(await pendientes(), 0, 'la tarjeta cambió de columna sin FLIP ni realce');
    // Y si la preferencia cambia con la app abierta, también se respeta.
    await pagina.emulateMedia({ reducedMotion: 'no-preference' });
    await pagina.waitForFunction(() => reducido === false);
    await pagina.emulateMedia({ reducedMotion: 'reduce' });
    await pagina.waitForFunction(() => reducido === true);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('teclado completo: Tab hasta el tablero, flechas, Enter, 2, la fecha, Enter y Esc', async () => {
  const { navegador, pagina, errores } = await abrirTablero();
  try {
    let n = 0;
    while (!(await pagina.evaluate(() => !!document.activeElement.closest('#tablero')))) {
      await pagina.keyboard.press('Tab');
      assert.ok(++n < 40, 'Tab llega al tablero');
    }
    assert.ok(await pagina.evaluate(() => document.activeElement.matches('.tarjeta')), 'el foco cae en una tarjeta');
    await pagina.keyboard.press('ArrowDown');
    await pagina.keyboard.press('ArrowUp');
    const id = await pagina.evaluate(() => seleccion.id);
    assert.equal(id, await pagina.evaluate(() => document.activeElement.dataset.card));
    await pagina.keyboard.press('Enter');
    await pagina.waitForFunction(id => seleccion.panel === id, id);
    assert.ok(await pagina.evaluate(() => document.getElementById('panel').classList.contains('instantaneo')), 'sin animación');
    await pagina.keyboard.press('2');
    assert.match(await pagina.locator('#panel .paso h4').textContent(), /Lo pensará/);
    assert.equal(await pagina.evaluate(() => document.activeElement.id), 'pf', 'el foco va a la fecha');
    await pagina.keyboard.type('1008');   // mes y día del campo de fecha (el año ya está)
    assert.equal(await pagina.locator('#pf').inputValue(), '2026-10-08');
    const antes = await llamadas(pagina, 'registrarResultado');
    await pagina.keyboard.press('Enter');
    await esperarCol(pagina, id, '2');
    await esperarEstable(pagina);
    assert.equal(await llamadas(pagina, 'registrarResultado'), antes + 1, 'Enter en la fecha guarda una vez');
    assert.equal((await ultimo(pagina, 'registrarResultado')).fecha, '2026-10-08');
    assert.equal(await pagina.evaluate(() => seleccion.panel), '');
    // Otra vez el panel, y Esc lo cierra devolviendo el foco a la tarjeta.
    await pagina.evaluate(id => document.querySelector(`#tablero [data-card="${CSS.escape(id)}"]`).focus(), id);
    await pagina.keyboard.press('Enter');
    await pagina.waitForFunction(id => seleccion.panel === id, id);
    await pagina.keyboard.press('Escape');
    await pagina.waitForSelector('#panel', { state: 'hidden' });
    assert.equal(await pagina.evaluate(() => document.activeElement.dataset.card), id);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('menú: el ítem activo lleva el icono relleno', async () => {
  const { navegador, pagina, errores } = await abrir();
  try {
    const iconos = () => pagina.locator('.side .menu [data-sec] i').evaluateAll(l => l.map(i => i.classList.contains('ph-fill')));
    assert.deepEqual(await iconos(), [true, false, false, false]);
    await pagina.locator('.side [data-sec="registro"]').click();
    await pagina.waitForSelector('#v-registro', { state: 'visible' });
    assert.deepEqual(await iconos(), [false, true, false, false]);
    assert.equal(await pagina.locator('.navmovil [data-sec="registro"] i').evaluate(i => i.classList.contains('ph-fill')), true);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('tablero: el chip de Agendado y el teléfono no se salen de la tarjeta', async () => {
  for (const width of [1366, 1440, 1920]) {
    const { navegador, pagina, errores } = await abrirTablero({ viewport: { width, height: 900 } });
    try {
      const n = await pagina.evaluate(() => [...document.querySelectorAll('#tablero [data-col="2"] .tarjeta')]
        .filter(t => t.querySelector('.t3 .chip-fecha') && t.querySelector('.t3 > *:not(.chip-fecha)')).length);
      assert.ok(n > 0, `${width}: hay tarjetas de Agendado con chip y teléfono que medir`);
      const fuera = await pagina.evaluate(() => [...document.querySelectorAll('#tablero [data-col="2"] .tarjeta')].filter(t => {
        const r = t.getBoundingClientRect();
        return [...t.querySelectorAll('.t3 > *')].some(x => { const q = x.getBoundingClientRect(); return q.right > r.right - 1 || q.left < r.left; });
      }).map(t => t.dataset.card));
      assert.deepEqual(fuera, [], `${width}`);
      assert.deepEqual(errores, []);
    } finally { await navegador.close(); }
  }
});

test('saludo según la hora (D8)', async () => {
  for (const [hora, texto] of [['08:00', 'Buenos días, Magaly'], ['15:30', 'Buenas tardes, Magaly'], ['20:10', 'Buenas noches, Magaly']]) {
    const navegador = await chromium.launch();
    try {
      const pagina = await (await navegador.newContext({ timezoneId: 'America/Lima' })).newPage();
      await pagina.clock.setFixedTime(new Date(`2026-10-01T${hora}:00-05:00`));
      await pagina.addInitScript(() => localStorage.setItem('seg.usuario', 'MAGALY'));
      await pagina.goto('file://' + ARCHIVO);
      await pagina.waitForFunction(() => S.fase === 'listo');
      assert.equal(await pagina.locator('#saludo').textContent(), texto);
    } finally { await navegador.close(); }
  }
});

test('indicadores: entrar con el teclado no anima nada (README §7)', async () => {
  const { navegador, pagina, errores } = await abrir({ guardado: { 'seg.usuario': 'MAGALY' } });
  try {
    await pagina.evaluate(() => { window.__anim = 0; const a = Element.prototype.animate; Element.prototype.animate = function () { if (this.closest && this.closest('#v-indicadores')) window.__anim++; return a.apply(this, arguments); }; });
    await pagina.locator('.side [data-sec="indicadores"]').focus();
    await pagina.keyboard.press('Enter');
    await pagina.waitForSelector('#ipanel[data-tab] section');
    assert.equal(await pagina.evaluate(() => window.__anim), 0, 'primera entrada (con carga)');
    await pagina.locator('.side [data-sec="tablero"]').focus();
    await pagina.keyboard.press('Enter');
    await pagina.locator('.side [data-sec="indicadores"]').focus();
    await pagina.keyboard.press('Enter');
    await pagina.waitForSelector('#ipanel[data-tab] section');
    assert.equal(await pagina.evaluate(() => window.__anim), 0, 'segunda entrada (del caché)');
    // Con el ratón sí se anima (barras).
    await pagina.locator('.side [data-sec="tablero"]').click();
    await pagina.locator('.side [data-sec="indicadores"]').click();
    await pagina.waitForSelector('#ipanel[data-tab] section');
    await pagina.waitForFunction(() => window.__anim > 0);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('indicadores: base 0 en Procedimientos dice «—»; los meses son los de getResumen y getKpi; sin meses, una frase', async () => {
  const { navegador, pagina, errores } = await abrirIndicadores();
  try {
    await pagina.evaluate(() => { S.kpi.indicaciones.push({ MES: '2026-10', TIPO: 'PROCEDIMIENTO', DETALLE: 'CARIOTIPO', GRUPO: 'CARIOTIPO', MEDICO: '', INDICADAS: 0, ACEPTADAS: 0, COMPLETADAS: 0 }); pintarIndicadores(false); });
    // Octubre solo está en getKpi; marzo, solo en las de getKpi (primera consulta). El mes por omisión sigue siendo el último del resumen.
    assert.equal(await pagina.locator('#imes').textContent(), 'setiembre 2026');
    assert.equal(await pagina.locator('#msig').isDisabled(), false, 'octubre se alcanza');
    await pagina.locator('#msig').click();
    assert.equal(await pagina.locator('#imes').textContent(), 'octubre 2026');
    assert.match(await textoPanel(pagina), /Todavía no hay pacientes de octubre en el resumen\./);
    await pestana(pagina, 'procs');
    await pagina.locator('#ipanel [data-solomes]').click();
    assert.match(await pagina.locator('#ipanel [data-solomes]').textContent(), /Solo octubre 2026/);
    assert.deepEqual(await filasDe(pagina, '[data-tabla="procs"]'), [['CARIOTIPO', '0', '0', '0', '—']]);
    await pagina.locator('#ipanel [data-solomes]').click();
    assert.ok((await filasDe(pagina, '[data-tabla="procs"]')).some(f => f[0] === 'CARIOTIPO' && f[4] === '—'));
    assert.ok((await filasDe(pagina, '[data-tabla="procs"]')).every(f => f[4] !== '0 %' || f[1] !== '0'));
    await pestana(pagina, 'resumen');
    // Sin ningún mes: frase en vez de «de los pacientes de  no volvieron…».
    await pagina.evaluate(() => { S.resumen = Object.assign({}, S.resumen, { filas: [] }); S.kpi = { cohortes: [], indicaciones: [], recuperacion: [], campanas: [], motivos: [], sinCandidato: [] }; pintarIndicadores(false); });
    const t = await textoPanel(pagina);
    assert.match(t, /Todavía no hay meses con pacientes para resumir\./);
    assert.doesNotMatch(t, /pacientes de\s+no volvieron/);
    assert.equal(await pagina.locator('#imes').textContent(), 'Sin datos');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('imprimible: Ctrl+P sin el botón imprime la pantalla; tras el botón, el resumen; con otros filtros, la pantalla otra vez', async () => {
  const { navegador, pagina, errores } = await abrirIndicadores();
  try {
    const ve = async () => ({ app: await pagina.locator('.app').isVisible(), imp: await pagina.locator('#imprimible').isVisible() });
    const evento = n => pagina.evaluate(n => window.dispatchEvent(new Event(n)), n);
    // Ctrl+P sin haber armado el resumen: sale la pantalla, no una hoja en blanco.
    await evento('beforeprint');
    await pagina.emulateMedia({ media: 'print' });
    assert.deepEqual(await ve(), { app: true, imp: false });
    await evento('afterprint');
    await pagina.emulateMedia({ media: 'screen' });
    // Con el botón: el resumen.
    await espiarPrint(pagina);
    await imprimir(pagina);
    await evento('beforeprint');
    await pagina.emulateMedia({ media: 'print' });
    assert.deepEqual(await ve(), { app: false, imp: true });
    await evento('afterprint');
    assert.deepEqual(await ve(), { app: true, imp: false }, 'después de imprimir se desarma');
    await pagina.emulateMedia({ media: 'screen' });
    // Armado y sin afterprint, pero con otro médico: el resumen ya no corresponde, sale la pantalla.
    await imprimir(pagina);
    await pagina.locator('#imed').selectOption('Dr. ELÍ FABRIZIO CABANILLAS HUALPA');
    await evento('beforeprint');
    await pagina.emulateMedia({ media: 'print' });
    assert.deepEqual(await ve(), { app: true, imp: false });
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('imprimible: un error al armar avisa «No se pudo preparar el resumen: …»; el botón espera la primera carga', async () => {
  const { navegador, pagina, errores } = await abrir({ guardado: { 'seg.usuario': 'MAGALY' } });
  try {
    await espiarPrint(pagina);
    await pagina.evaluate(() => { DEMO._demora.getKpi = 600; });
    await pagina.locator('.side [data-sec="indicadores"]').click();
    await pagina.waitForSelector('#v-indicadores', { state: 'visible' });
    assert.equal(await pagina.locator('#iimprimir').isDisabled(), true, 'deshabilitado mientras carga');
    await pagina.waitForSelector('#ipanel[data-tab] section');
    assert.equal(await pagina.locator('#iimprimir').isDisabled(), false);
    await pagina.evaluate(() => { DEMO._demora.getKpi = 0; window.__htmlImp2 = htmlImpPagina2; htmlImpPagina2 = () => { throw new Error('falla de prueba'); }; });
    await pagina.locator('#iimprimir').click();
    await pagina.waitForFunction(() => /No se pudo preparar el resumen: falla de prueba/.test(document.querySelector('#aviso span').textContent));
    assert.equal(await pagina.evaluate(() => window.__print), 0);
    assert.equal(await pagina.locator('#iimprimir').isDisabled(), false);
    // Lo mismo cuando primero tiene que pedir los datos.
    await pagina.evaluate(() => { avisar(''); invalidarIndicadores(); });
    await pagina.locator('#iimprimir').click();
    await pagina.waitForFunction(() => /No se pudo preparar el resumen: falla de prueba/.test(document.querySelector('#aviso span').textContent));
    await pagina.waitForFunction(() => !document.getElementById('iimprimir').disabled);
    assert.equal(await pagina.evaluate(() => window.__print), 0);
    // Repuesto, imprime.
    await pagina.evaluate(() => { htmlImpPagina2 = window.__htmlImp2; });
    await imprimir(pagina);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

/* ============ Corrección final (revisión de toda la rama) ============ */

test('indicadores: Recuperación con una fila de base 0 dice «— (0/0)»', async () => {
  const { navegador, pagina, errores } = await abrirIndicadores();
  try {
    await pestana(pagina, 'recup');
    // Cada fila del servidor es un seguimiento, así que la base 0 no llega con datos reales: se inyecta en datosRecup.
    await pagina.evaluate(() => {
      const orig = datosRecup;
      datosRecup = (k, f) => { const d = orig(k, f); d.porAsesora.push(['Nadie', { n: 0, v: 0, d: [] }]); return d; };
      pintarIndicadores(false);
    });
    const filas = await filasDe(pagina, '[data-tabla="asesora"]');
    const cero = filas.find(f => f[0] === 'Nadie');
    assert.ok(cero, 'la fila inyectada se pinta');
    assert.equal(cero[3], '— (0/0)');
    assert.equal(await pagina.locator('#ipanel [data-tabla="asesora"] tbody tr').last().locator('.cero').count(), 1);
    assert.ok(filas.filter(f => f[0] !== 'Nadie').every(f => /^\d+ % \(\d+\/\d+\)$/.test(f[3])), 'las demás con su porcentaje');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('saludo: «doctora» para una médica; la hora es la de Lima aunque el navegador esté en otra zona, y se repasa al repintar', async () => {
  const navegador = await chromium.launch();
  try {
    // Navegador en Madrid (7 h más que Lima): a las 20:10 de Lima allí es de madrugada.
    const pagina = await (await navegador.newContext({ timezoneId: 'Europe/Madrid' })).newPage();
    await pagina.clock.install({ time: new Date('2026-10-01T08:00:00-05:00') });
    await pagina.addInitScript(() => localStorage.setItem('seg.usuario', 'MAGALY'));
    await pagina.goto('file://' + ARCHIVO);
    await pagina.waitForFunction(() => S.fase === 'listo');
    assert.equal(await pagina.locator('#saludo').textContent(), 'Buenos días, Magaly', 'las 8 de Lima, no las 15 de Madrid');
    await pagina.clock.setFixedTime(new Date('2026-10-01T15:30:00-05:00'));
    await pagina.evaluate(() => pintarTablero());
    assert.equal(await pagina.locator('#saludo').textContent(), 'Buenas tardes, Magaly', 'el repintado del tablero lo actualiza');
    await pagina.clock.setFixedTime(new Date('2026-10-01T20:10:00-05:00'));
    await pagina.locator('#fsin').click();   // un filtro repinta el tablero
    assert.equal(await pagina.locator('#saludo').textContent(), 'Buenas noches, Magaly');
    // Una médica: «doctora»; un médico: «doctor».
    await pagina.evaluate(() => {
      S.boot = adaptarBoot(Object.assign({}, DEMO.bootstrap(), { usuarios: ['MAGALY', 'DR. ELI CABANILLAS', 'DRA. KAREN MATOS'] }));
      S.usuario = 'DRA. KAREN MATOS'; pintarSaludo();
    });
    assert.equal(await pagina.locator('#saludo').textContent(), 'Buenas noches, doctora Matos');
    await pagina.evaluate(() => { S.usuario = 'DR. ELI CABANILLAS'; pintarSaludo(); });
    assert.equal(await pagina.locator('#saludo').textContent(), 'Buenas noches, doctor Cabanillas');
  } finally { await navegador.close(); }
});

test('tablero: «N citas esta semana» cuenta también la cita sin AGENDA con fecha (PROXIMA_AGENDADA), como el chip', async () => {
  const { navegador, pagina, errores } = await abrirTablero();
  try {
    const citas = () => pagina.locator('#kpis > div').nth(1).locator('span').textContent();
    const antes = Number((await citas()).match(/^(\d+)/)[1]);
    await pagina.evaluate(() => {
      const base = S.tablero.columnas.AGENDADO.find(t => t.AGENDA === 'CITA');
      const sofdoc = Object.assign({}, base, { CLAVE: '49999999|HEMATOLOGÍA', DNI: '49999999', AGENDA: '', FECHA_AGENDA: '',
        PROXIMA_AGENDADA: '2026-10-03', FECHA_CLAVE: '2026-10-03', ETIQUETA: 'Cita el sáb 03/10' });
      const sinFecha = Object.assign({}, base, { CLAVE: '49999998|HEMATOLOGÍA', DNI: '49999998', AGENDA: '', FECHA_AGENDA: '',
        PROXIMA_AGENDADA: '', FECHA_CLAVE: '', ETIQUETA: 'Agendado' });
      S.tablero.columnas.AGENDADO.push(sofdoc, sinFecha);
      adaptarTablero(S.tablero); pintarTablero();
    });
    assert.match(await citas(), new RegExp(`^${antes + 1} citas? esta semana$`), 'la de SOFDOC suma; la que no tiene fecha, no');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('tablero: el filtro de mes muestra solo los pacientes de ese mes y se recuerda', async () => {
  const { navegador, pagina, errores } = await abrirTablero();
  try {
    const opciones = await pagina.locator('#fmes option').evaluateAll(o => o.map(x => x.value));
    assert.equal(opciones[0], '', '«Todos los meses» primero');
    assert.ok(opciones.length >= 3);
    assert.deepEqual(opciones.slice(1), opciones.slice(1).sort().reverse(), 'de más reciente a más antiguo');
    const mes = opciones[1];
    await pagina.locator('#fmes').selectOption(mes);
    const meses = await pagina.evaluate(() => filtrados(true).map(p => p.raw.MES));
    assert.ok(meses.length && meses.every(m => m === mes));
    assert.equal(await pagina.evaluate(() => localStorage.getItem('seg.mes')), mes);
    assert.equal(Number(await pagina.locator('#kpis > div').first().locator('dd').textContent()),
      await pagina.evaluate(() => filtrados(true).filter(p => p.col === 1).length), 'la cifra de Por contactar sigue al filtro');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('tablero: el mes recordado se aplica al abrir y, si ya no existe, se ignora', async () => {
  const a = await abrirTablero();
  let mes;
  try { mes = await a.pagina.locator('#fmes option').evaluateAll(o => o[1].value); } finally { await a.navegador.close(); }
  const b = await abrirTablero({ guardado: { 'seg.mes': mes } });
  try {
    assert.equal(await b.pagina.locator('#fmes').inputValue(), mes);
    assert.ok(await b.pagina.evaluate(() => hayFiltros()));
  } finally { await b.navegador.close(); }
  const c = await abrirTablero({ guardado: { 'seg.mes': '1999-01' } });
  try {
    assert.equal(await c.pagina.locator('#fmes').inputValue(), '');
    assert.equal(await c.pagina.evaluate(() => S.mes), '');
  } finally { await c.navegador.close(); }
});

/* ============ Ronda final de la Etapa 2 ============ */

test('panel: un tratamiento en curso ofrece «Agendó cita» (próxima sesión) y no «Aceptó»; el servidor rechaza «Aceptó»', async () => {
  const { navegador, pagina, errores } = await abrirTablero();
  try {
    await abrirPanelDe(pagina, ROSA);   // Rosa: hierro en curso, sesión 2 de 3 atrasada, en Por contactar
    assert.deepEqual(await pagina.locator('#panel .acc:not(.cierra) [data-acc]').evaluateAll(b => b.map(x => x.dataset.acc)), ['nocontesto', 'pensara', 'agendo']);
    const cierres = await pagina.locator('#panel .acc.cierra [data-acc]').evaluateAll(b => b.map(x => x.dataset.acc));
    assert.ok(cierres.includes('otro') && !cierres.includes('nodesea'), 'en curso: «No desea continuar»');
    await pagina.locator('#panel [data-acc="agendo"]').click();
    assert.match(await pagina.locator('#panel .paso').textContent(), /Fecha de la próxima sesión/);
    await confirmarPaso(pagina, masDiasIso(HOY_DEMO, 3));
    await esperarEstable(pagina);
    const u = await ultimo(pagina, 'registrarResultado');
    assert.deepEqual([u.resultado, u.referencia], ['AGENDÓ CITA', ROSA]);
    assert.equal(await colPintada(pagina, ROSA), '2');
    const r = await pagina.evaluate(() => llamar('registrarResultado', { usuario: 'MAGALY', dni: '41111222', especialidad: 'HIERRO', referencia: 'REG-000002',
      resultado: 'ACEPTÓ', fecha: '2026-10-05' }).then(() => 'ok', e => e.message));
    assert.equal(r, 'El tratamiento ya empezó: use «Agendó cita» para la próxima sesión.');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('tablero: ningún mes del filtro sale de una fecha vacía («undefin»)', async () => {
  const { navegador, pagina, errores } = await abrirTablero();
  try {
    const meses = await pagina.locator('#fmes option').evaluateAll(o => o.map(x => x.value));
    assert.ok(meses.length > 1);
    assert.ok(meses.every(m => m === '' || /^\d{4}-\d{2}$/.test(m)), meses.join(', '));
    const tab = await datosDemo(pagina);
    const sinMes = Object.values(tab.columnas).flat().filter(t => /undefin/.test(t.MES));
    assert.deepEqual(sinMes.map(t => t.CLAVE), []);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('tablero: «Por reevaluar» de un hierro terminado reemplaza la reevaluación vencida del mismo paciente', async () => {
  const { navegador, pagina, errores } = await abrirTablero();
  try {
    await pagina.evaluate(() => { S.lim = { rec: 99, mes: 99, ant: 99 }; pintarTablero(); });
    assert.equal(await colPintada(pagina, 'REG-000022'), '1');
    assert.match(await textoTarjeta(pagina, 'REG-000022'), /Por reevaluar · terminó el 12\/08/);
    assert.equal(await colPintada(pagina, '43666777|HEMATOLOGÍA'), '', 'la reevaluación vencida no se muestra');
    await abrirPanelDe(pagina, 'REG-000022');
    assert.deepEqual(await pagina.locator('#panel .acc:not(.cierra) [data-acc]').evaluateAll(b => b.map(x => x.dataset.acc)), ['nocontesto', 'pensara', 'agendo']);
    await pagina.locator('#panel [data-acc="agendo"]').click();
    await confirmarPaso(pagina, masDiasIso(HOY_DEMO, 7));
    await esperarEstable(pagina);
    assert.equal(await colPintada(pagina, 'REG-000022'), '2');
    assert.equal(await colPintada(pagina, '43666777|HEMATOLOGÍA'), '', 'agendada, la tarjeta del registro la sigue tapando');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('panel: un control dice «Control + laboratorio», no «(Procedimiento)»', async () => {
  const { navegador, pagina, errores } = await abrirTablero();
  try {
    const id = await pagina.evaluate(async () => {
      await llamar('guardarRegistro', { usuario: 'MAGALY', dni: '43777888', nombre: 'NORA PRUEBA CAMPOS', contacto: '987777888',
        doctor: 'Dra. Karen Matos', fecha: S.hoy, tipo: 'CONTROL', examenes: 'Hemograma', fechaRetorno: '2026-10-16' });
      adaptarTablero(await llamar('getTablero'));
      pintarTablero();
      return S.pacientes.find(x => x.t === 'ctrl').id;
    });
    assert.equal(await colPintada(pagina, id), '2');
    await abrirPanelDe(pagina, id);
    const panel = await pagina.locator('#panel').textContent();
    assert.match(panel, /Control con resultados el\s*16\/10\/2026/);
    assert.doesNotMatch(panel, /Procedimiento/);
    await pagina.locator('#panel [data-acc="otrolugar"]').click();
    const paso = await pagina.locator('#panel .paso').textContent();
    assert.match(paso, /¿Cerrar el seguimiento de Nora Prueba Campos \(Control \+ laboratorio\)\?/);
    assert.equal(await pagina.evaluate(() => TIPO_TEXTO.CONTROL), 'Control + laboratorio');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('tablero: la ayuda de atajos dice «1–3 qué pasó»', async () => {
  const { navegador, pagina, errores } = await abrirTablero();
  try {
    const t = (await pagina.locator('.atajos').first().textContent()).replace(/\s+/g, ' ');
    assert.match(t, /1–3\s*qué pasó/);
    assert.doesNotMatch(t, /1–4/);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});
