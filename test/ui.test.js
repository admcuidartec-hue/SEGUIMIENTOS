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
    assert.match(await pagina.locator('#v-tablero').textContent(), /Cargando…/);
    const llamadas = await pagina.evaluate(() => DEMO._llamadas);
    assert.equal(llamadas.bootstrap, 1);
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
      assert.match(await pagina.locator(`#v-${sec}`).textContent(), /Cargando…/);
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
