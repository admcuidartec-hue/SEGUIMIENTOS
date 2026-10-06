# Etapa 1: «¿Qué pasó?» y datos del tablero · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la asesora registre qué pasó en cada contacto, con nueve resultados en lugar de
«Hecho» y «Descartar». Que el servidor calcule en qué columna del tablero está cada paciente.

**Architecture:** Toda la lógica nueva es pura y se prueba en Node con `vm`.

- **`src/Resultados.gs`** lee los resultados: qué significa cada fila de `SEGUIMIENTOS`, el
  ciclo de intentos, los teléfonos equivocados y los fallecidos.
- **`src/Tablero.gs`** reparte a los pacientes en cuatro columnas, con su etiqueta.
- **Las funciones de estado que ya existen** pasan a usar ese ciclo: `estadoDeSerie`,
  `pendientesIndicacion` y `pendientesRegistro`.
- **`src/ResultadoServidor.gs`** escribe en la hoja, con el candado tomado.
- **`Index.html`** cambia el panel de la bandeja actual por «¿Qué pasó?».

El tablero visual **no** está en este plan: llega con el diseño de Claude Design y tendrá su
propio plan.

**Tech Stack:**
- Google Apps Script V8 y HtmlService.
- Pruebas: `node --test` con `vm`, y Playwright sobre el modo DEMO de `Index.html`.
- clasp 2.4.

**Spec:** `docs/superpowers/specs/2026-10-06-que-paso-y-tablero-design.md`, con las
precisiones de su §9.

## Global Constraints

- **Idioma.** Todo texto visible va en español, sin rayas largas (—). Los mensajes de error
  siguen el estilo de los de hoy: «Elija…», «Falta…», «Escriba…».
- **Fechas.** Van como `yyyy-MM-dd`. Las columnas de fecha se guardan a mediodía (`COLUMNAS_FECHA`).
- **Filas.** Nunca se borra una fila: se anula con `ANULADO = SÍ` y `MOTIVO_ANULACION`.
- **Escrituras.**
  - Toda escritura toma `bloquear_()` y termina con `soltar_(lock)`.
  - Se vuelve a validar **dentro** del candado lo que otra asesora pudo cambiar entretanto.
- **Respuestas al navegador.** Todo pasa por `limpiarParaEnvio`: un `NaN` vuelve `null` toda
  la respuesta.
- **Textos del usuario.** Lo que escribe la usuaria y va a la hoja pasa por `textoLimpio_`.
  `anexarObjeto_` ya aplica `textoSeguro`.
- **Nombres públicos.** No se renombra ningún nombre público existente. Se agregan
  `registrarResultado`, `anularResultado` y `getTablero`. `marcarSeguimiento` y `descartar`
  quedan como envoltorios.
- **Datos de prueba.** Son siempre inventados, nunca de pacientes reales.
- **Colores.** El CSS solo usa tokens `--chp-*` (lo vigila una prueba).
- **Commits.** Todo commit termina con:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01GegG7K4J2pd47s8MMaA85W
  ```
- **Push.** `git push -q origin HEAD:claude/compassionate-lovelace-3q6rh3 HEAD:main`, desde
  `/home/user/seguimientos`.
- **Nunca** `npm audit fix --force`, nunca `clasp deploy` sin `--deploymentId`. Publicar es
  cosa del usuario, con `npm run actualizar`.

## Review Focus

Cinco cosas que ninguna prueba de las tareas cubre por sí sola, y cómo se fijan:

1. **Filas anuladas.**
   - **Riesgo:** una función antigua lee `ACCION` directamente, como `kpiRecuperacion`, y
     cuenta una fila anulada.
   - **Se fija:** `datos_` filtra las anuladas una sola vez, y `resultadoDe` además devuelve
     `null` para una fila anulada. Prueba en la Tarea 6.
2. **Mayúsculas y tildes.** «Lo pensará», «LO PENSARA» y «lo pensara» son el mismo resultado,
   tanto en la hoja como en lo que manda la app. Prueba en la Tarea 2.
3. **Las cifras de antes no cambian.**
   - **Riesgo:** con solo filas antiguas (`HECHO` y `DESCARTADO`), algo cambia en `calcularKpi`
     o en `resumenPorMes`.
   - **Se fija:** todas las pruebas de `logica-kpi`, `logica-resumen` y `logica-revision`
     siguen pasando sin tocarlas. Si alguna falla, el error está en el código nuevo, no en la
     prueba.
4. **Dos asesoras marcan a la vez** los dos números del mismo paciente como equivocados. El
   segundo guardado debe cerrar el seguimiento: se decide con la hoja releída dentro del
   candado. Prueba en la Tarea 6.
5. **Deshacer cuando el servidor falló.**
   - **Riesgo:** «Deshacer» se pulsa después de un error.
   - **Se fija:** el aviso con «Deshacer» solo aparece cuando el guardado salió bien; si falló,
     la tarjeta vuelve sola. Prueba en la Tarea 7.

---

## Mapa de archivos

| Archivo | Qué cambia |
|---|---|
| `src/Resultados.gs` (nuevo, puro) | `RESULTADOS`, `resultadoDe`, `leerCiclo`, `marcasTelefono`, `fallecidos`, `sinContacto_`, `accionPara`, `validarResultado`, `validarAnulacionResultado`, `resumenAntiguos` |
| `src/Tablero.gs` (nuevo, puro) | `retornosDelMes`, `columnaDe`, `etiquetaDe`, `armarTablero` |
| `src/ResultadoServidor.gs` (nuevo) | `registrarResultado`, `anularResultado`, `getTablero` |
| `src/Logica.gs` | `reglasDesdeFilas` (`graciaAgenda`), `telefonosPorDni` (3.er argumento), `estadoDeSerie` (6.º argumento), `armarPacientes`, `pendientesIndicacion`, `COLUMNAS_PACIENTES` |
| `src/Registro.gs` | `pendientesRegistro` |
| `src/Codigo.gs` | Columnas, `datos_` y `derivar_`, `registrar_` (envoltorio), `getPaciente` |
| `src/RegistroServidor.gs` | `buscarPacienteRegistro` (fallecido) |
| `src/Menu.gs` | `PARAMETROS_REGISTRO`, mensajes de `verificar` |
| `src/Index.html` | Panel «¿Qué pasó?», atajos, aviso con «Deshacer», historia en la ficha, aviso de fallecido en Registro, DEMO |
| `test/cargar.js` | Carga por omisión todos los `.gs` puros |
| `test/logica-resultados.test.js` (nuevo) | Pruebas de `Resultados.gs` |
| `test/logica-tablero.test.js` (nuevo) | Pruebas de `Tablero.gs` |
| `test/resultado-servidor.test.js` (nuevo) | Servidor con dobles de las hojas |
| Pruebas existentes | Las que esperaban `CONTACTADO` o `DESCARTADO` como estado (lista en la Tarea 4) |
| `package.json` | Agrega `test/resultado-servidor.test.js` a `npm test` |
| `CLAUDE.md` | Reglas nuevas y nombres públicos |

---

### Task 1: Columnas nuevas, parámetro de gracia y carga de pruebas

**Files:**
- Modify: `src/Codigo.gs:18-25`
- Modify: `src/Logica.gs:195-209` (`reglasDesdeFilas`) y `src/Logica.gs:529-531` (`COLUMNAS_PACIENTES`)
- Modify: `src/Menu.gs:49` (`PARAMETROS_REGISTRO`) y `src/Menu.gs:370-372` (mensaje de `verificar`)
- Modify: `test/cargar.js`
- Test: `test/logica-estado.test.js`, `test/menu.test.js`

**Interfaces:**
- Produces:
  - `COLUMNAS_SEGUIMIENTOS`, con 14 columnas.
  - `reglas.graciaAgenda`, un entero que vale 2 por omisión.
  - `COLUMNAS_PACIENTES`, con `CIERRE`, `FECHA_CIERRE`, `AGENDA`, `FECHA_AGENDA` e `INTENTO`
    al final.
  - `cargar()` sin argumentos, que carga `Logica.gs`, `Registro.gs`, `Resultados.gs` y
    `Tablero.gs`.

- [ ] **Step 1: Crear los dos archivos puros vacíos**, para que `cargar()` los encuentre:

`src/Resultados.gs`:
```js
/* ==========================================================================
   RESULTADOS DE «¿QUÉ PASÓ?»

   Lo que registra la asesora al contactar. Cada resultado hace algo distinto
   (pide una fecha, marca un teléfono, cierra el seguimiento), por eso la lista
   vive aquí y no en CATALOGOS. Funciones puras: se prueban en Node.
   ========================================================================== */
```

`src/Tablero.gs`:
```js
/* ==========================================================================
   TABLERO DE CUATRO COLUMNAS

   Por contactar · Agendado · En tratamiento · Completado. Reparte las filas que
   ya calculan armarPacientes, pendientesIndicacion y pendientesRegistro.
   Funciones puras: se prueban en Node.
   ========================================================================== */
```

- [ ] **Step 2: Escribir las pruebas que fallan**

En `test/logica-estado.test.js`, reemplazar el `deepEqual` de la prueba «reglas: sin filas se
usan los valores por defecto» por:
```js
  assert.deepEqual(plano(r), { plazos: { '*': { esperado: 30, vence: 45 } }, espera: 15, maxSeguimientos: 3, corte: 180, corteIndicaciones: 180, metaRetorno: 60, esperaCotizacion: 7, diasEntreSesiones: 7, graciaAgenda: 2 });
```

Y agregar al final del mismo archivo:
```js
test('reglas: GRACIA_AGENDA_DIAS se lee de REGLAS', () => {
  const r = L.reglasDesdeFilas(['PARAMETRO', 'VALOR'], [['GRACIA_AGENDA_DIAS', 3]]);
  assert.equal(r.graciaAgenda, 3);
});

test('COLUMNAS_SEGUIMIENTOS y COLUMNAS_PACIENTES crecen solo al final', () => {
  const C = cargar(['Logica.gs', 'Registro.gs', 'Codigo.gs']);
  assert.deepEqual(plano(C.COLUMNAS_SEGUIMIENTOS), ['ID', 'FECHA_HORA', 'DNI', 'ESPECIALIDAD', 'RESPONSABLE', 'ACCION', 'MOTIVO', 'NOTA',
    'REFERENCIA', 'RESULTADO', 'FECHA_PROXIMA', 'TELEFONO', 'ANULADO', 'MOTIVO_ANULACION']);
  assert.deepEqual(plano(L.COLUMNAS_PACIENTES).slice(16), ['CIERRE', 'FECHA_CIERRE', 'AGENDA', 'FECHA_AGENDA', 'INTENTO']);
  assert.equal(C.COLUMNAS_FECHA.FECHA_PROXIMA, 1);
  assert.equal(C.COLUMNAS_FECHA.FECHA_AGENDA, 1);
  assert.equal(C.COLUMNAS_FECHA.FECHA_CIERRE, 1);
  assert.equal(C.COLUMNAS_NUMERICAS.INTENTO, 1);
});
```

En `test/menu.test.js`, prueba «ampliarHojas_: REFERENCIA en SEGUIMIENTOS…», cambiar tres
líneas:
```js
  assert.deepEqual(seg.v[0].slice(8), ['REFERENCIA', 'RESULTADO', 'FECHA_PROXIMA', 'TELEFONO', 'ANULADO', 'MOTIVO_ANULACION']);
```
```js
  assert.deepEqual(reg.v.slice(2).map(f => [f[4], f[5]]), [['ESPERA_COTIZACION_DIAS', 7], ['DIAS_ENTRE_SESIONES', 7], ['GRACIA_AGENDA_DIAS', 2]]);
  assert.equal(cambios.length, 6, 'SEGUIMIENTOS, CATALOGOS, ALTA MÉDICA y los tres parámetros');
```

- [ ] **Step 3: Correr y ver que fallan**

Run: `cd /home/user/seguimientos && npm test 2>&1 | grep -E "^not ok|# (pass|fail)"`

Expected: FAIL. Fallan «valores por defecto», «GRACIA_AGENDA_DIAS», «COLUMNAS_SEGUIMIENTOS…» y
«ampliarHojas_: REFERENCIA…».

- [ ] **Step 4: Implementar**

`test/cargar.js`, la firma de `cargar`:
```js
function cargar(archivos = ['Logica.gs', 'Registro.gs', 'Resultados.gs', 'Tablero.gs']) {
```

`src/Codigo.gs`, líneas 18, 22 y 25:
```js
var COLUMNAS_SEGUIMIENTOS = ['ID', 'FECHA_HORA', 'DNI', 'ESPECIALIDAD', 'RESPONSABLE', 'ACCION', 'MOTIVO', 'NOTA', 'REFERENCIA',
  'RESULTADO', 'FECHA_PROXIMA', 'TELEFONO', 'ANULADO', 'MOTIVO_ANULACION'];
```
```js
var COLUMNAS_FECHA = { FECHA: 1, PRIMERA_CITA: 1, ULTIMA_CITA: 1, PROXIMA_ESPERADA: 1, VENCE: 1, PROXIMA_AGENDADA: 1, ULTIMO_SEGUIMIENTO: 1,
  FECHA_PROXIMA: 1, FECHA_AGENDA: 1, FECHA_CIERRE: 1 };
```
```js
var COLUMNAS_NUMERICAS = { N_REALIZADAS: 1, DIAS_ATRASO: 1, N_SEGUIMIENTOS: 1, CANTIDAD: 1, PAGO: 1, SESIONES: 1, NUMERO: 1, INTENTO: 1 };
```

`src/Logica.gs`, en `reglasDesdeFilas`:
- en el objeto inicial, agregar `graciaAgenda: 2` después de `diasEntreSesiones: 7`;
- después de la línea de `DIAS_ENTRE_SESIONES`, agregar:
```js
    if (par === 'GRACIA_AGENDA_DIAS') r.graciaAgenda = entero_(val, 2);
```

`src/Logica.gs`, `COLUMNAS_PACIENTES`:
```js
var COLUMNAS_PACIENTES = ['DNI', 'ESPECIALIDAD', 'NOMBRE', 'TELEFONOS', 'MEDICO_ULTIMO', 'PRIMERA_CITA', 'ULTIMA_CITA',
  'N_REALIZADAS', 'PROXIMA_ESPERADA', 'VENCE', 'DIAS_ATRASO', 'PROXIMA_AGENDADA', 'ESTADO', 'N_SEGUIMIENTOS',
  'ULTIMO_SEGUIMIENTO', 'PENDIENTE', 'CIERRE', 'FECHA_CIERRE', 'AGENDA', 'FECHA_AGENDA', 'INTENTO'];
```

`armarPacientes` todavía no produce esas claves, y la prueba
`Object.keys(rosa) == COLUMNAS_PACIENTES` de `logica-pacientes` va a fallar. Para que no
falle, en `armarPacientes` (`src/Logica.gs`), agregar al final del `out.push({...})`:
```js
      CIERRE: '', FECHA_CIERRE: '', AGENDA: '', FECHA_AGENDA: '', INTENTO: 0
```
La Tarea 4 les da su valor.

`src/Menu.gs:49`:
```js
var PARAMETROS_REGISTRO = [['ESPERA_COTIZACION_DIAS', 7], ['DIAS_ENTRE_SESIONES', 7], ['GRACIA_AGENDA_DIAS', 2]];
```

`src/Menu.gs`, en `verificar`, el texto `'✓ SEGUIMIENTOS tiene la columna REFERENCIA.'`
pasa a ser:
```js
      : '✓ SEGUIMIENTOS tiene todas sus columnas.');
```

- [ ] **Step 5: Correr y ver que pasan**

Run: `cd /home/user/seguimientos && npm test 2>&1 | grep -E "^not ok|# (pass|fail)"`

Expected: `# fail 0`.

- [ ] **Step 6: Commit**

```bash
cd /home/user/seguimientos && git add -A src test && git commit -q -m "Columnas de resultado en SEGUIMIENTOS y GRACIA_AGENDA_DIAS

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GegG7K4J2pd47s8MMaA85W"
```

---

### Task 2: Resultados y ciclo de intentos (`Resultados.gs`)

**Files:**
- Modify: `src/Resultados.gs`
- Test: `test/logica-resultados.test.js` (nuevo)

**Interfaces:**
- Consumes:
  - de `Logica.gs`: `normTexto`, `normDni`, `normTelefono`, `fechaIso`, `textoLimpio_`, `sumarDias`;
  - de `Registro.gs`: `anulado_`.
- Produces:
  - **`RESULTADOS`**: un objeto con clave `normTexto(nombre)` y valor
    `{ nombre, grupo: 'SIGUE'|'CIERRE'|'TELEFONO', pide: ''|'FECHA'|'DOCTOR'|'TELEFONO'|'MOTIVO', soloIndicacion }`.
  - **`ORDEN_RESULTADOS`**: un array con los nueve nombres, en el orden en que se muestran.
  - **`resultadoDe(s)`**: devuelve `null` o
    `{ resultado, grupo, fecha, fechaHora, fechaProxima, telefono, motivo, quien, id, antiguo }`.
  - **`leerCiclo(lista, reglas, hoy)`**: devuelve
    `{ intentos, ultimo, cierre: null|{motivo, fecha, quien}, agenda: null|{tipo:'CITA'|'LLAMAR'|'REINTENTAR'|'SIN RESPUESTA', fecha, intento}, loHizo }`.

- [ ] **Step 1: Escribir las pruebas que fallan**

`test/logica-resultados.test.js`:
```js
// Resultados de «¿Qué pasó?» y ciclo de intentos. Datos inventados.
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar, plano } = require('./cargar');
const { seg, reglas } = require('./fixtures');
const L = cargar();
const R = Object.assign(reglas(L), { maxSeguimientos: 2 });

const res = (fecha, resultado, o) => Object.assign(seg({ fecha }), { RESULTADO: resultado, ACCION: 'HECHO' }, o);

test('resultadoDe: fila nueva, con tildes o sin ellas', () => {
  const r = plano(L.resultadoDe(res('2026-10-01', 'lo pensara', { FECHA_PROXIMA: '2026-10-09' })));
  assert.deepEqual([r.resultado, r.grupo, r.fecha, r.fechaProxima, r.antiguo], ['LO PENSARÁ', 'SIGUE', '2026-10-01', '2026-10-09', false]);
  assert.equal(L.resultadoDe(res('2026-10-01', 'Agendó cita')).resultado, 'AGENDÓ CITA');
});

test('resultadoDe: filas antiguas sin RESULTADO', () => {
  assert.deepEqual(plano(L.resultadoDe(seg({ fecha: '2026-09-01' }))).resultado, 'NO CONTESTÓ');
  assert.equal(L.resultadoDe(seg({ fecha: '2026-09-01' })).antiguo, true);
  const f = plano(L.resultadoDe(seg({ fecha: '2026-09-01', accion: 'DESCARTADO', motivo: 'Falleció' })));
  assert.deepEqual([f.resultado, f.grupo, f.motivo], ['FALLECIÓ', 'CIERRE', 'FALLECIÓ']);
  const o = plano(L.resultadoDe(seg({ fecha: '2026-09-01', accion: 'DESCARTADO', motivo: 'SE ATIENDE EN OTRO LUGAR' })));
  assert.deepEqual([o.resultado, o.grupo, o.motivo], ['DESCARTADO', 'CIERRE', 'SE ATIENDE EN OTRO LUGAR']);
});

test('resultadoDe: anulada o desconocida no cuenta; número equivocado sin teléfono es un cierre', () => {
  assert.equal(L.resultadoDe(res('2026-10-01', 'NO CONTESTÓ', { ANULADO: 'SÍ' })), null);
  assert.equal(L.resultadoDe(Object.assign(seg({ fecha: '2026-10-01' }), { ACCION: 'TELEFONO' })), null);
  assert.equal(L.resultadoDe(res('2026-10-01', 'NÚMERO EQUIVOCADO', { TELEFONO: '987654321' })).grupo, 'TELEFONO');
  assert.equal(L.resultadoDe(res('2026-10-01', 'NÚMERO EQUIVOCADO', { TELEFONO: '' })).grupo, 'CIERRE');
});

test('leerCiclo: sin filas', () => {
  assert.deepEqual(plano(L.leerCiclo([], R, '2026-10-05')), { intentos: 0, ultimo: '', cierre: null, agenda: null, loHizo: '' });
});

test('leerCiclo: un «no contestó» espera la reintentada; pasada la espera ya no hay agenda', () => {
  const c = plano(L.leerCiclo([res('2026-10-01', 'NO CONTESTÓ')], R, '2026-10-05'));
  assert.deepEqual(c.agenda, { tipo: 'REINTENTAR', fecha: '2026-10-16', intento: 1 });
  assert.equal(c.intentos, 1);
  assert.equal(L.leerCiclo([res('2026-10-01', 'NO CONTESTÓ')], R, '2026-10-16').agenda, null);
});

test('leerCiclo: dos «no contestó» seguidos se cierran solos al cumplir la espera', () => {
  const dos = [res('2026-09-01', 'NO CONTESTÓ'), res('2026-09-20', 'NO CONTESTÓ')];
  assert.deepEqual(plano(L.leerCiclo(dos, R, '2026-10-01')).agenda, { tipo: 'SIN RESPUESTA', fecha: '2026-10-05', intento: 2 });
  assert.deepEqual(plano(L.leerCiclo(dos, R, '2026-10-05')).cierre, { motivo: 'SIN RESPUESTA', fecha: '2026-10-05', quien: '' });
});

test('leerCiclo: «lo pensará» en medio reinicia la cuenta', () => {
  const s = [res('2026-09-01', 'NO CONTESTÓ'), res('2026-09-05', 'LO PENSARÁ', { FECHA_PROXIMA: '2026-09-10' }), res('2026-09-20', 'NO CONTESTÓ')];
  const c = plano(L.leerCiclo(s, R, '2026-10-01'));
  assert.equal(c.cierre, null);
  assert.deepEqual(c.agenda, { tipo: 'REINTENTAR', fecha: '2026-10-05', intento: 1 });
  assert.equal(c.intentos, 3);
});

test('leerCiclo: lo pensará y agendó, con su fecha y la gracia', () => {
  const p = [res('2026-10-01', 'LO PENSARÁ', { FECHA_PROXIMA: '2026-10-08' })];
  assert.deepEqual(plano(L.leerCiclo(p, R, '2026-10-07')).agenda, { tipo: 'LLAMAR', fecha: '2026-10-08', intento: 0 });
  assert.equal(L.leerCiclo(p, R, '2026-10-08').agenda, null, 'el día de llamar vuelve a Por contactar');
  const a = [res('2026-10-01', 'AGENDÓ CITA', { FECHA_PROXIMA: '2026-10-08' })];
  assert.equal(L.leerCiclo(a, R, '2026-10-10').agenda.tipo, 'CITA', 'gracia de 2 días');
  assert.equal(L.leerCiclo(a, R, '2026-10-11').agenda, null);
});

test('leerCiclo: cierre, lo hizo, y el número equivocado no decide', () => {
  const c = [res('2026-09-01', 'SE ATIENDE EN OTRO LUGAR', { ACCION: 'DESCARTADO', RESPONSABLE: 'RACHEL' }),
    res('2026-09-02', 'NÚMERO EQUIVOCADO', { ACCION: 'TELEFONO', TELEFONO: '987654321' })];
  assert.deepEqual(plano(L.leerCiclo(c, R, '2026-10-01')).cierre, { motivo: 'SE ATIENDE EN OTRO LUGAR', fecha: '2026-09-01', quien: 'RACHEL' });
  assert.equal(L.leerCiclo(c, R, '2026-10-01').ultimo, '2026-09-02');
  assert.equal(L.leerCiclo([res('2026-10-01', 'LO HIZO', { FECHA_PROXIMA: '2026-09-30' })], R, '2026-10-05').loHizo, '2026-09-30');
  const nd = res('2026-10-01', 'NO DESEA CONTINUAR', { ACCION: 'DESCARTADO', MOTIVO: 'NO DESEA CONTINUAR' });
  assert.equal(L.leerCiclo([nd], R, '2026-10-05').cierre.motivo, 'NO DESEA CONTINUAR');
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `cd /home/user/seguimientos && node --test test/logica-resultados.test.js 2>&1 | grep -E "^not ok|# (pass|fail)"`

Expected: FAIL. `L.resultadoDe is not a function`.

- [ ] **Step 3: Implementar** (agregar a `src/Resultados.gs`)

```js
var RESULTADOS = {
  'NO CONTESTO':              { nombre: 'NO CONTESTÓ',              grupo: 'SIGUE',    pide: '',         soloIndicacion: false },
  'LO PENSARA':               { nombre: 'LO PENSARÁ',               grupo: 'SIGUE',    pide: 'FECHA',    soloIndicacion: false },
  'AGENDO CITA':              { nombre: 'AGENDÓ CITA',              grupo: 'SIGUE',    pide: 'FECHA',    soloIndicacion: false },
  'LO HIZO':                  { nombre: 'LO HIZO',                  grupo: 'SIGUE',    pide: 'FECHA',    soloIndicacion: true },
  'ALTA MEDICA':              { nombre: 'ALTA MÉDICA',              grupo: 'CIERRE',   pide: 'DOCTOR',   soloIndicacion: false },
  'NUMERO EQUIVOCADO':        { nombre: 'NÚMERO EQUIVOCADO',        grupo: 'TELEFONO', pide: 'TELEFONO', soloIndicacion: false },
  'SE ATIENDE EN OTRO LUGAR': { nombre: 'SE ATIENDE EN OTRO LUGAR', grupo: 'CIERRE',   pide: '',         soloIndicacion: false },
  'FALLECIO':                 { nombre: 'FALLECIÓ',                 grupo: 'CIERRE',   pide: '',         soloIndicacion: false },
  'NO DESEA CONTINUAR':       { nombre: 'NO DESEA CONTINUAR',       grupo: 'CIERRE',   pide: 'MOTIVO',   soloIndicacion: false }
};
var ORDEN_RESULTADOS = ['NO CONTESTÓ', 'LO PENSARÁ', 'AGENDÓ CITA', 'LO HIZO', 'ALTA MÉDICA', 'NÚMERO EQUIVOCADO',
  'SE ATIENDE EN OTRO LUGAR', 'FALLECIÓ', 'NO DESEA CONTINUAR'];

/**
 * Qué significa una fila de SEGUIMIENTOS. Las antiguas (sin RESULTADO) se leen
 * como antes: HECHO es un intento sin respuesta; DESCARTADO, un cierre con su motivo.
 * Una fila anulada, o con una ACCION que no decide nada, devuelve null.
 */
function resultadoDe(s) {
  if (!s || anulado_(s)) return null;
  var base = { fecha: fechaIso(s.FECHA_HORA), fechaHora: String(s.FECHA_HORA || ''), fechaProxima: fechaIso(s.FECHA_PROXIMA),
    telefono: normTelefono(s.TELEFONO), quien: textoLimpio_(s.RESPONSABLE), id: textoLimpio_(s.ID) };
  function con(o) { Object.keys(o).forEach(function (k) { base[k] = o[k]; }); return base; }
  var r = RESULTADOS[normTexto(s.RESULTADO)];
  if (r) {
    // Sin teléfono que marcar, un «número equivocado» es un cierre, como antes.
    var grupo = r.grupo === 'TELEFONO' && !base.telefono ? 'CIERRE' : r.grupo;
    return con({ resultado: r.nombre, grupo: grupo, motivo: grupo === 'SIGUE' ? '' : r.nombre, antiguo: false });
  }
  var accion = normTexto(s.ACCION);
  if (accion === 'HECHO') return con({ resultado: 'NO CONTESTÓ', grupo: 'SIGUE', motivo: '', antiguo: true });
  if (accion === 'DESCARTADO') {
    var fallecio = normTexto(s.MOTIVO) === 'FALLECIO';
    return con({ resultado: fallecio ? 'FALLECIÓ' : 'DESCARTADO', grupo: 'CIERRE',
      motivo: fallecio ? 'FALLECIÓ' : (textoLimpio_(s.MOTIVO) || 'SIN MOTIVO'), antiguo: true });
  }
  return null;
}

/**
 * Lee los seguimientos de UN ciclo: los posteriores a la última consulta, a la
 * cotización o a la última sesión, según el tipo. Gana el último resultado que
 * decide; un «número equivocado» con teléfono no decide (lo resuelve sinContacto_).
 */
function leerCiclo(lista, reglas, hoy) {
  var filas = (lista || []).map(resultadoDe).filter(Boolean).sort(function (a, b) {
    return a.fechaHora < b.fechaHora ? -1 : a.fechaHora > b.fechaHora ? 1 : 0;
  });
  var out = { intentos: 0, ultimo: '', cierre: null, agenda: null, loHizo: '' };
  if (!filas.length) return out;
  out.ultimo = filas[filas.length - 1].fecha;
  var decisivas = filas.filter(function (r) { return r.grupo !== 'TELEFONO'; });
  out.intentos = decisivas.filter(function (r) { return r.grupo === 'SIGUE'; }).length;
  var u = decisivas[decisivas.length - 1];
  if (!u) return out;
  if (u.grupo === 'CIERRE') { out.cierre = { motivo: u.motivo, fecha: u.fecha, quien: u.quien }; return out; }
  if (u.resultado === 'LO HIZO') { out.loHizo = u.fechaProxima || u.fecha; return out; }
  var seguidos = 0;
  for (var i = decisivas.length - 1; i >= 0 && decisivas[i].resultado === 'NO CONTESTÓ'; i--) seguidos++;
  if (seguidos >= reglas.maxSeguimientos) {
    var cierra = sumarDias(u.fecha, reglas.espera);
    if (hoy >= cierra) out.cierre = { motivo: 'SIN RESPUESTA', fecha: cierra, quien: '' };
    else out.agenda = { tipo: 'SIN RESPUESTA', fecha: cierra, intento: seguidos };
    return out;
  }
  if (u.resultado === 'NO CONTESTÓ') {
    var vuelve = sumarDias(u.fecha, reglas.espera);
    if (hoy < vuelve) out.agenda = { tipo: 'REINTENTAR', fecha: vuelve, intento: seguidos };
    return out;
  }
  if (u.resultado === 'LO PENSARÁ' && u.fechaProxima && hoy < u.fechaProxima) {
    out.agenda = { tipo: 'LLAMAR', fecha: u.fechaProxima, intento: 0 };
  }
  if (u.resultado === 'AGENDÓ CITA' && u.fechaProxima && hoy <= sumarDias(u.fechaProxima, reglas.graciaAgenda)) {
    out.agenda = { tipo: 'CITA', fecha: u.fechaProxima, intento: 0 };
  }
  return out;
}
```

- [ ] **Step 4: Correr y ver que pasan**

Run: `cd /home/user/seguimientos && node --test test/logica-resultados.test.js 2>&1 | grep -E "^not ok|# (pass|fail)" && npm test 2>&1 | grep -E "# fail"`

Expected: `# fail 0` las dos veces.

- [ ] **Step 5: Commit**

```bash
cd /home/user/seguimientos && git add src/Resultados.gs test/logica-resultados.test.js && git commit -q -m "Resultados de «¿Qué pasó?» y ciclo de intentos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GegG7K4J2pd47s8MMaA85W"
```

---

### Task 3: Teléfonos equivocados y fallecidos

**Files:**
- Modify: `src/Resultados.gs`, `src/Logica.gs:533-545` (`telefonosPorDni`)
- Test: `test/logica-resultados.test.js`

**Interfaces:**
- Consumes: `resultadoDe` (Tarea 2).
- Produces:
  - **`marcasTelefono(seguimientos)`** devuelve `{ dni: { telefono: fechaIso } }`.
  - **`telefonosPorDni(indicaciones, contactos, seguimientos)`**: la misma forma de siempre,
    `{ dni: [tel] }`, pero sin los números marcados. Una marca no se aplica a un número que
    llega de nuevo por un registro (`ORIGEN === 'REGISTROS'`) con `FECHA` posterior a la marca.
  - **`telefonosDescartados(marcas, telefonos)`** devuelve `{ dni: [tel] }`.
  - **`sinContacto_(dni, marcas, telefonos, usuario)`** devuelve la fecha de la última marca,
    o `''`.
  - **`fallecidos(seguimientos)`** devuelve `{ dni: { fecha, quien, id } }`.

- [ ] **Step 1: Escribir las pruebas que fallan** (agregar a `test/logica-resultados.test.js`)

```js
const equivocado = (fecha, tel, dni) => res(fecha, 'NÚMERO EQUIVOCADO', { TELEFONO: tel, ACCION: 'TELEFONO', DNI: dni || '40111222' });

test('telefonosPorDni: quita el número marcado; vuelve si llega por un registro posterior', () => {
  const inds = [{ DNI: '40111222', TELEFONO: '987654321', FECHA: '2026-09-01' }, { DNI: '40111222', TELEFONO: '912345678', FECHA: '2026-09-01' }];
  const contactos = [{ DNI_PACIENTE: '40111222', TELEFONO: '51987654321' }];
  const segs = [equivocado('2026-10-01', '987654321')];
  assert.deepEqual(plano(L.telefonosPorDni(inds, contactos, segs)), { 40111222: ['912345678'] });
  assert.deepEqual(plano(L.telefonosPorDni(inds, contactos)), { 40111222: ['987654321', '912345678'] }, 'sin seguimientos, como antes');
  const nuevo = inds.concat([{ DNI: '40111222', TELEFONO: '987654321', FECHA: '2026-10-03', ORIGEN: 'REGISTROS' }]);
  assert.deepEqual(plano(L.telefonosPorDni(nuevo, [], segs))['40111222'], ['912345678', '987654321']);
  const anulado = [Object.assign(equivocado('2026-10-01', '987654321'), { ANULADO: 'SÍ' })];
  assert.deepEqual(plano(L.telefonosPorDni(inds, [], anulado))['40111222'], ['987654321', '912345678']);
});

test('sinContacto_ y telefonosDescartados', () => {
  const marcas = L.marcasTelefono([equivocado('2026-09-20', '987654321'), equivocado('2026-10-01', '912345678')]);
  assert.deepEqual(plano(marcas), { 40111222: { 987654321: '2026-09-20', 912345678: '2026-10-01' } });
  assert.equal(L.sinContacto_('40111222', marcas, {}, ''), '2026-10-01');
  assert.equal(L.sinContacto_('40111222', marcas, { 40111222: ['955555555'] }, ''), '', 'le queda otro');
  assert.equal(L.sinContacto_('40111222', marcas, {}, '@rosa.q'), '', 'le queda el usuario');
  assert.equal(L.sinContacto_('40999888', marcas, {}, ''), '', 'nunca tuvo teléfono: no es «sin contacto»');
  assert.deepEqual(plano(L.telefonosDescartados(marcas, { 40111222: ['912345678'] })), { 40111222: ['987654321'] });
});

test('fallecidos: filas nuevas y antiguas; la anulada no cuenta', () => {
  const nueva = res('2026-10-01', 'FALLECIÓ', { ACCION: 'DESCARTADO', MOTIVO: 'FALLECIÓ', ID: 'SEG-9', RESPONSABLE: 'RACHEL' });
  const antigua = seg({ dni: '40333444', fecha: '2026-08-01', accion: 'DESCARTADO', motivo: 'FALLECIÓ' });
  const anulada = Object.assign(res('2026-10-02', 'FALLECIÓ', { DNI: '40555666' }), { ANULADO: 'SÍ' });
  assert.deepEqual(plano(L.fallecidos([nueva, antigua, anulada])), {
    40111222: { fecha: '2026-10-01', quien: 'RACHEL', id: 'SEG-9' },
    40333444: { fecha: '2026-08-01', quien: 'MAGALY', id: antigua.ID }
  });
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `cd /home/user/seguimientos && node --test test/logica-resultados.test.js 2>&1 | grep -E "^not ok|# (pass|fail)"`

Expected: FAIL. Las tres pruebas nuevas.

- [ ] **Step 3: Implementar**

`src/Resultados.gs`:
```js
/** Números marcados como equivocados, por paciente: { dni: { telefono: fecha de la última marca } }. */
function marcasTelefono(seguimientos) {
  var out = {};
  (seguimientos || []).forEach(function (s) {
    var r = resultadoDe(s);
    if (!r || r.resultado !== 'NÚMERO EQUIVOCADO' || !r.telefono) return;
    var dni = normDni(s.DNI);
    out[dni] = out[dni] || {};
    if (!out[dni][r.telefono] || r.fecha > out[dni][r.telefono]) out[dni][r.telefono] = r.fecha;
  });
  return out;
}

/** Los marcados que ya no están entre los teléfonos vigentes: la ficha los muestra tachados. */
function telefonosDescartados(marcas, telefonos) {
  var out = {};
  Object.keys(marcas || {}).forEach(function (dni) {
    var quedan = (telefonos || {})[dni] || [];
    var fuera = Object.keys(marcas[dni]).filter(function (t) { return quedan.indexOf(t) < 0; });
    if (fuera.length) out[dni] = fuera;
  });
  return out;
}

/**
 * Fecha de la última marca si el paciente se quedó sin ningún contacto por marcas de
 * «número equivocado»; '' si le queda un teléfono o un usuario, o si nunca se marcó nada.
 */
function sinContacto_(dni, marcas, telefonos, usuario) {
  var m = (marcas || {})[dni];
  if (!m || ((telefonos || {})[dni] || []).length || textoLimpio_(usuario)) return '';
  return Object.keys(m).reduce(function (a, t) { return m[t] > a ? m[t] : a; }, '');
}

/** Pacientes con un «falleció» vigente (nuevo o antiguo): { dni: { fecha, quien, id } }. */
function fallecidos(seguimientos) {
  var out = {};
  (seguimientos || []).forEach(function (s) {
    var r = resultadoDe(s);
    if (!r || r.resultado !== 'FALLECIÓ') return;
    var dni = normDni(s.DNI);
    if (!out[dni] || r.fecha > out[dni].fecha) out[dni] = { fecha: r.fecha, quien: r.quien, id: r.id };
  });
  return out;
}
```

`src/Logica.gs`, reemplazar `telefonosPorDni`:
```js
/**
 * Teléfonos de cada paciente: primero los de hierro y procedimientos, luego los del CRM, sin repetir.
 * Sin los marcados como «número equivocado»; uno marcado vuelve solo si llega de nuevo
 * por un registro posterior a la marca (alguien lo confirmó con el paciente).
 */
function telefonosPorDni(indicaciones, contactos, seguimientos) {
  var out = {}, marcas = marcasTelefono(seguimientos);
  function sumar(dni, telefono, fecha) {
    var t = normTelefono(telefono);
    if (!dni || !t) return;
    var m = marcas[dni] && marcas[dni][t];
    if (m && !(fecha && fecha > m)) return;
    out[dni] = out[dni] || [];
    if (out[dni].indexOf(t) < 0) out[dni].push(t);
  }
  (indicaciones || []).forEach(function (i) { sumar(i.DNI, i.TELEFONO, i.ORIGEN === 'REGISTROS' ? i.FECHA : ''); });
  (contactos || []).forEach(function (c) { sumar(c.DNI_PACIENTE, c.TELEFONO, ''); });
  return out;
}
```

- [ ] **Step 4: Correr y ver que pasan**

Run: `cd /home/user/seguimientos && npm test 2>&1 | grep -E "^not ok|# (pass|fail)"`

Expected: `# fail 0`.

- [ ] **Step 5: Commit**

```bash
cd /home/user/seguimientos && git add src test && git commit -q -m "Teléfonos equivocados y fallecidos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GegG7K4J2pd47s8MMaA85W"
```

---

### Task 4: Estados con los resultados nuevos

**Files:**
- Modify: `src/Logica.gs` (`estadoDeSerie` 280-326, `armarPacientes` 577-605, `pendientesIndicacion` 614-669)
- Modify: `src/Registro.gs:165-216` (`pendientesRegistro`)
- Test: `test/logica-estado.test.js`, `test/logica-tipos.test.js`, `test/logica-registro.test.js`, y casos nuevos en `test/logica-resultados.test.js`

**Interfaces:**
- Consumes: `leerCiclo`, `marcasTelefono`, `sinContacto_`, `fallecidos`, `telefonosPorDni` (Tareas 2 y 3).
- Produces:
  - **`estadoDeSerie(serie, seguimientos, reglas, hoy, alta, extra)`**:
    - `extra = { fallecido: bool, sinContacto: fechaIso|'' }`, que puede faltar;
    - la salida agrega `cierre`, `fechaCierre` y `agenda: null|{tipo, fecha, intento}`;
    - **estados posibles:** `SIN ATENCIÓN`, `FALLECIDO`, `ALTA`, `CERRADO`, `AGENDADO`,
      `RECUPERADO`, `AL DÍA`, `POR VENCER`, `VENCIDO`, `ANTIGUO`;
    - **ya no existen** `CONTACTADO` ni `DESCARTADO`.
  - **`armarPacientes`**: cada fila llena `CIERRE`, `FECHA_CIERRE`, `AGENDA`, `FECHA_AGENDA` e
    `INTENTO`.
  - **`pendientesIndicacion`**:
    - **estados posibles:** `FALLECIDO`, `CERRADO`, `COMPLETADO`, `AGENDADO`, `ANTIGUO`,
      `PENDIENTE`;
    - **campos nuevos:** `CIERRE`, `FECHA_CIERRE`, `AGENDA`, `FECHA_AGENDA`, `INTENTO`,
      `FECHA_LOHIZO`.
  - **`pendientesRegistro`**:
    - **estados posibles:** `FALLECIDO`, `COMPLETADO`, `CERRADO`, `AGENDADO`,
      `EN TRATAMIENTO`, `EN ESPERA`, `ANTIGUO`, `PENDIENTE`;
    - **campos nuevos:** los mismos, más `ATRASO`;
    - **cambio:** un registro `COMPLETO` ya no se descarta, vuelve como `COMPLETADO`.

- [ ] **Step 1: Ajustar las pruebas antiguas y agregar las nuevas**

`test/logica-estado.test.js`: reemplazar las tres pruebas de `CONTACTADO` y `DESCARTADO`
(líneas 63-81) por:
```js
test('«no contestó» → AGENDADO (reintentar) durante la espera; después vuelve a VENCIDO', () => {
  const c = [cita({ fecha: '2026-07-01' })];
  const e = plano(L.estadoDeSerie(serieDe(c), [seg({ fecha: '2026-09-20' })], reglas(L), '2026-10-01'));
  assert.equal(e.estado, 'AGENDADO');
  assert.deepEqual(e.agenda, { tipo: 'REINTENTAR', fecha: '2026-10-05', intento: 1 });
  assert.equal(est(c, [seg({ fecha: '2026-09-10' })], '2026-10-01'), 'VENCIDO');
  assert.equal(L.estadoDeSerie(serieDe(c), [seg({ fecha: '2026-09-10' })], reglas(L), '2026-10-01').intentos, 1);
});

test('tercer intento sin respuesta: AGENDADO (se cierra el…) durante su espera, luego CERRADO', () => {
  const c = [cita({ fecha: '2026-05-01' })];
  const s = [seg({ fecha: '2026-07-01' }), seg({ fecha: '2026-08-01' }), seg({ fecha: '2026-09-25' })];
  assert.equal(est(c, s, '2026-10-01'), 'AGENDADO');
  const e = plano(L.estadoDeSerie(serieDe(c), s, reglas(L), '2026-10-10'));
  assert.deepEqual([e.estado, e.cierre, e.fechaCierre], ['CERRADO', 'SIN RESPUESTA', '2026-10-10']);
});

test('descarte explícito → CERRADO con su motivo; si vuelve después, deja de estarlo', () => {
  const d = seg({ fecha: '2026-09-01', accion: 'DESCARTADO', motivo: 'SE ATIENDE EN OTRO LUGAR' });
  const e = plano(L.estadoDeSerie(serieDe([cita({ fecha: '2026-07-01' })]), [d], reglas(L), '2026-10-01'));
  assert.deepEqual([e.estado, e.cierre, e.fechaCierre], ['CERRADO', 'SE ATIENDE EN OTRO LUGAR', '2026-09-01']);
  assert.equal(est([cita({ fecha: '2026-07-01' }), cita({ fecha: '2026-09-20' })], [d], '2026-10-01'), 'AL DÍA');
});

test('fallecido va antes que el alta; sin contacto cierra; la cita de SOFDOC gana sobre «lo pensará»', () => {
  const c = [cita({ fecha: '2026-07-01' })];
  const s = serieDe(c);
  assert.equal(L.estadoDeSerie(s, [], reglas(L), '2026-10-01', { ID: 'ALT-1' }, { fallecido: true }).estado, 'FALLECIDO');
  const sc = plano(L.estadoDeSerie(s, [], reglas(L), '2026-10-01', null, { sinContacto: '2026-09-28' }));
  assert.deepEqual([sc.estado, sc.cierre, sc.fechaCierre], ['CERRADO', 'NÚMERO EQUIVOCADO', '2026-09-28']);
  const pensara = Object.assign(seg({ fecha: '2026-09-28' }), { RESULTADO: 'LO PENSARÁ', FECHA_PROXIMA: '2026-10-20' });
  const conCita = serieDe(c.concat([cita({ fecha: '2026-10-08', estado: 'AGENDADO' })]));
  assert.deepEqual(plano(L.estadoDeSerie(conCita, [pensara], reglas(L), '2026-10-01')).agenda, { tipo: 'CITA', fecha: '2026-10-08', intento: 0 });
  assert.deepEqual(plano(L.estadoDeSerie(s, [pensara], reglas(L), '2026-10-01')).agenda, { tipo: 'LLAMAR', fecha: '2026-10-20', intento: 0 });
});

test('agendó y vino: la consulta nueva abre otro ciclo (RECUPERADO)', () => {
  const ag = Object.assign(seg({ fecha: '2026-09-20' }), { RESULTADO: 'AGENDÓ CITA', FECHA_PROXIMA: '2026-09-25' });
  assert.equal(est([cita({ fecha: '2026-07-01' }), cita({ fecha: '2026-09-25' })], [ag], '2026-10-01'), 'RECUPERADO');
});
```

`test/logica-tipos.test.js`: reemplazar la prueba «pendientesIndicacion: los seguimientos de
su tipo dan CONTACTADO y DESCARTADO…» por:
```js
test('pendientesIndicacion: los seguimientos de su tipo dan AGENDADO y CERRADO; los de reevaluación no cuentan', () => {
  const citas = [cita({ fecha: '2026-08-01' })];
  const inds = [ind({ FECHA: '2026-08-01' })];
  const s = (fecha, accion) => seg({ fecha, esp: 'HIERRO', accion });
  assert.equal(pend(citas, inds, [seg({ fecha: '2026-09-28' })])[0].ESTADO, 'PENDIENTE', 'seguimiento de HEMATOLOGÍA');
  let p = pend(citas, inds, [s('2026-09-28')])[0];
  assert.deepEqual([p.ESTADO, p.AGENDA, p.FECHA_AGENDA, p.INTENTO], ['AGENDADO', 'REINTENTAR', '2026-10-13', 1]);
  assert.equal(p.N_SEGUIMIENTOS, 1);
  assert.equal(p.ULTIMO_SEGUIMIENTO, '2026-09-28');
  assert.equal(pend(citas, inds, [s('2026-09-01')])[0].ESTADO, 'PENDIENTE', 'pasada la espera vuelve');
  p = pend(citas, inds, [s('2026-09-01', 'DESCARTADO')])[0];
  assert.deepEqual([p.ESTADO, p.CIERRE], ['CERRADO', 'SIN MOTIVO']);
  assert.equal(pend(citas, inds, [s('2026-08-20'), s('2026-09-05'), s('2026-09-12')])[0].ESTADO, 'CERRADO', '3 intentos');
  assert.equal(pend(citas, inds, [s('2026-07-20', 'DESCARTADO')])[0].ESTADO, 'PENDIENTE', 'un descarte anterior a la cotización no cuenta');
});

test('pendientesIndicacion: «lo hizo» en una cotización antigua la completa; un fallecido no vuelve', () => {
  const citas = [cita({ fecha: '2026-08-01' })];
  const inds = [ind({ FECHA: '2026-08-01' })];
  const lohizo = Object.assign(seg({ fecha: '2026-09-28', esp: 'HIERRO' }), { RESULTADO: 'LO HIZO', FECHA_PROXIMA: '2026-09-27' });
  const p = pend(citas, inds, [lohizo])[0];
  assert.deepEqual([p.ESTADO, p.FECHA_LOHIZO], ['COMPLETADO', '2026-09-27']);
  const murio = seg({ fecha: '2026-09-28', accion: 'DESCARTADO', motivo: 'FALLECIÓ' });
  assert.equal(pend(citas, inds, [murio])[0].ESTADO, 'FALLECIDO', 'un fallecido en HEMATOLOGÍA sale también del hierro');
});
```

`test/logica-registro.test.js`, prueba «pendientesRegistro: en curso entra a los 7 días…»:
```js
test('pendientesRegistro: en curso es EN TRATAMIENTO hasta los 7 días de la última sesión; completo vuelve como COMPLETADO', () => {
  const s = [ses(1, '2026-09-29')];
  assert.equal(pend([reg()], s)[0].ESTADO, 'EN TRATAMIENTO');
  const p = pend([reg()], [ses(1, '2026-09-26')])[0];
  assert.deepEqual([p.ESTADO, p.ESTADO_REGISTRO, p.HECHAS, p.SESIONES, p.ULTIMA_SESION, p.DIAS, p.ATRASO], ['PENDIENTE', 'EN CURSO', 1, 3, '2026-09-26', 9, 2]);
  const c = pend([reg({ SESIONES: '1' })], [ses(1, '2026-09-28')]);
  assert.deepEqual([c.length, c[0].ESTADO, c[0].ULTIMA_SESION], [1, 'COMPLETADO', '2026-09-28']);
  assert.deepEqual(pend([reg({ ANULADO: 'SÍ' })]), []);
});
```

Y en la prueba «pendientesRegistro: seguimientos por REFERENCIA…»:
- la línea `'CONTACTADO'` pasa a esperar `'AGENDADO'`;
- las dos líneas `'DESCARTADO'` pasan a esperar `'CERRADO'`.

**Antes de editar:** abrir la prueba y revisar `HOY` y el helper `ses` del archivo. Si `HOY` no
es `'2026-10-05'`, ajustar las fechas de las sesiones para que:
- la primera esté a 6 días de `HOY`;
- la segunda, a 9 días.

Agregar al final de `test/logica-resultados.test.js`:
```js
const { cita } = require('./fixtures');

test('armarPacientes: un número equivocado sin más contacto cierra; con otro teléfono sigue', () => {
  const citas = [cita({ fecha: '2026-07-01' })];
  const inds = [{ DNI: '40111222', TELEFONO: '987654321', FECHA: '2026-06-01', TIPO: 'HIERRO', ESTADO: 'ACEPTÓ' }];
  const marca = equivocado('2026-09-28', '987654321');
  const p = plano(L.armarPacientes(citas, inds, [marca], reglas(L), '2026-10-01'))[0];
  assert.deepEqual([p.ESTADO, p.CIERRE, p.FECHA_CIERRE, p.TELEFONOS], ['CERRADO', 'NÚMERO EQUIVOCADO', '2026-09-28', '']);
  const otro = inds.concat([{ DNI: '40111222', TELEFONO: '912345678', FECHA: '2026-06-01', TIPO: 'HIERRO', ESTADO: 'ACEPTÓ' }]);
  const q = plano(L.armarPacientes(citas, otro, [marca], reglas(L), '2026-10-01'))[0];
  assert.deepEqual([q.ESTADO, q.TELEFONOS], ['VENCIDO', '912345678']);
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `cd /home/user/seguimientos && npm test 2>&1 | grep -E "^not ok|# (pass|fail)"`

Expected: FAIL. Fallan las pruebas nuevas y las ajustadas.

- [ ] **Step 3: Implementar**

`src/Logica.gs`, `estadoDeSerie`. Reemplazar desde la línea del comentario «El alta va
primero» hasta el `if (ultimoHecho && diasDesdeHecho < reglas.espera)` inclusive:
```js
  extra = extra || {};
  out.cierre = ''; out.fechaCierre = ''; out.agenda = null;
  if (extra.fallecido) { out.estado = 'FALLECIDO'; return out; }
  // El alta va primero: el doctor cerró el seguimiento (diseño de Registro, §5bis).
  if (alta) { out.estado = 'ALTA'; return out; }

  var lista = (seguimientos || []).slice().sort(function (a, b) {
    return a.FECHA_HORA < b.FECHA_HORA ? -1 : a.FECHA_HORA > b.FECHA_HORA ? 1 : 0;
  });
  if (lista.length) out.ultimoSeguimiento = fechaIso(lista[lista.length - 1].FECHA_HORA);
  var posteriores = lista.filter(function (s) { return fechaIso(s.FECHA_HORA) > ultima; });
  var c = leerCiclo(posteriores, reglas, hoy);
  out.intentos = c.intentos;

  if (c.cierre) { out.estado = 'CERRADO'; out.cierre = c.cierre.motivo; out.fechaCierre = c.cierre.fecha; return out; }
  if (extra.sinContacto) { out.estado = 'CERRADO'; out.cierre = 'NÚMERO EQUIVOCADO'; out.fechaCierre = extra.sinContacto; return out; }
  // La cita de SOFDOC gana sobre lo que haya dicho la asesora.
  if (futura) { out.estado = 'AGENDADO'; out.agenda = { tipo: 'CITA', fecha: futura.FECHA, intento: 0 }; return out; }
  if (c.agenda) { out.estado = 'AGENDADO'; out.agenda = c.agenda; return out; }
```

Además:
- cambiar la firma a `function estadoDeSerie(serie, seguimientos, reglas, hoy, alta, extra)`;
- en el JSDoc, poner la lista nueva de estados:
  `ALTA, FALLECIDO, CERRADO, AGENDADO, RECUPERADO, AL DÍA, POR VENCER, VENCIDO, ANTIGUO`;
- **se conserva** el bloque `hechoAntesDeVolver` y todo lo que va después;
- **se borran** las variables que ya no se usan: `hechos`, `ultimoPost`, `ultimoHecho` y
  `diasDesdeHecho`.

`src/Logica.gs`, en `armarPacientes`:
```js
  var tel = telefonosPorDni(indicaciones, contactos, seguimientos), pend = pendientesPorDni(indicaciones), segs = segsPorSerie(seguimientos);
  var marcas = marcasTelefono(seguimientos), muertos = fallecidos(seguimientos);
```

Dentro del `forEach`:
```js
    var e = estadoDeSerie(s, segs[k], reglas, hoy, (altas || {})[k],
      { fallecido: !!muertos[s.dni], sinContacto: sinContacto_(s.dni, marcas, tel, '') });
```

Al final del `out.push`, en lugar de los vacíos de la Tarea 1:
```js
      CIERRE: e.cierre || '',
      FECHA_CIERRE: e.fechaCierre || '',
      AGENDA: e.agenda ? e.agenda.tipo : '',
      FECHA_AGENDA: e.agenda ? e.agenda.fecha : '',
      INTENTO: e.agenda ? e.agenda.intento : 0
```

`src/Logica.gs`, en `pendientesIndicacion`:
- la línea de `tel` pasa a ser:
  ```js
  var porDni = realizadasPorDni_(citas), tel = telefonosPorDni(indicaciones, contactos, seguimientos), segs = {};
  var marcas = marcasTelefono(seguimientos), muertos = fallecidos(seguimientos);
  ```
- dentro del `map`, reemplazar desde `var hechos = …` hasta la línea del `ANTIGUO` inclusive:
  ```js
    var c = leerCiclo(lista, reglas, hoy);
    var dias = Math.max(0, diasEntre(g.fecha, hoy)), estado = 'PENDIENTE', cierre = c.cierre;
    var sc = sinContacto_(g.dni, marcas, tel, '');
    if (muertos[g.dni]) estado = 'FALLECIDO';
    else if (cierre) estado = 'CERRADO';
    else if (sc) { estado = 'CERRADO'; cierre = { motivo: 'NÚMERO EQUIVOCADO', fecha: sc }; }
    else if (c.loHizo) estado = 'COMPLETADO';
    else if (c.agenda) estado = 'AGENDADO';
    else if (dias > reglas.corteIndicaciones) estado = 'ANTIGUO';
  ```
- en el objeto devuelto, `N_SEGUIMIENTOS: c.intentos`, y agregar al final:
  ```js
      CIERRE: cierre ? cierre.motivo : '',
      FECHA_CIERRE: cierre ? cierre.fecha : '',
      AGENDA: c.agenda ? c.agenda.tipo : '',
      FECHA_AGENDA: c.agenda ? c.agenda.fecha : '',
      INTENTO: c.agenda ? c.agenda.intento : 0,
      FECHA_LOHIZO: c.loHizo
  ```

`src/Registro.gs`, en `pendientesRegistro`.

Primera línea:
```js
  var porDni = realizadasPorDni_(d.citas), segs = {}, reglas = d.reglas, hoy = d.hoy;
  var marcas = marcasTelefono(d.seguimientos), muertos = fallecidos(d.seguimientos);
```

Dentro del `map`:
- cambiar `if (e.estado === 'ANULADO' || e.estado === 'COMPLETO') return null;` por
  `if (e.estado === 'ANULADO') return null;`;
- reemplazar desde `var hechos = …` hasta la línea del `ANTIGUO` inclusive:

```js
    var c = leerCiclo(lista, reglas, hoy);
    var dni = normDni(r.DNI), tel = normTelefono(r.CONTACTO), usuario = tel.length === 9 ? '' : textoLimpio_(r.CONTACTO);
    var sc = sinContacto_(dni, marcas, d.telefonos, usuario), cierre = c.cierre, estado = 'PENDIENTE';
    var espera = enCurso ? reglas.diasEntreSesiones : reglas.esperaCotizacion;
    if (muertos[dni]) estado = 'FALLECIDO';
    else if (e.estado === 'COMPLETO') estado = 'COMPLETADO';
    else if (cierre) estado = 'CERRADO';
    else if (sc) { estado = 'CERRADO'; cierre = { motivo: 'NÚMERO EQUIVOCADO', fecha: sc }; }
    else if (c.agenda) estado = 'AGENDADO';
    else if (dias < espera) estado = enCurso ? 'EN TRATAMIENTO' : 'EN ESPERA';
    else if (dias > reglas.corteIndicaciones) estado = 'ANTIGUO';
    var realizadas = porDni[dni] || [], ultima = realizadas[realizadas.length - 1];
```

Luego:
- borrar las líneas antiguas que declaraban `dni`, `realizadas`, `ultima` y `tel`, porque
  ahora se declaran arriba;
- `USUARIO: usuario`;
- `N_SEGUIMIENTOS: c.intentos`;
- agregar al final del objeto devuelto:

```js
      ATRASO: enCurso && estado === 'PENDIENTE' ? dias - reglas.diasEntreSesiones : 0,
      CIERRE: cierre ? cierre.motivo : '',
      FECHA_CIERRE: cierre ? cierre.fecha : '',
      AGENDA: c.agenda ? c.agenda.tipo : '',
      FECHA_AGENDA: c.agenda ? c.agenda.fecha : '',
      INTENTO: c.agenda ? c.agenda.intento : 0
```

Para `COMPLETADO`, `desde` es la última sesión y `DIAS` cuenta desde ahí. Eso está bien: la
columna Completado usa `ULTIMA_SESION`.

- [ ] **Step 4: Correr y ver que pasan**

Run: `cd /home/user/seguimientos && npm test 2>&1 | grep -E "^not ok|# (pass|fail)"`

Expected: `# fail 0`. Si falla una prueba de `logica-kpi`, `logica-resumen` o
`logica-revision`, **no se toca la prueba**: el código nuevo cambió una cifra antigua. Ver el
punto 3 de Review Focus.

- [ ] **Step 5: Commit**

```bash
cd /home/user/seguimientos && git add src test && git commit -q -m "Estados con los resultados nuevos: AGENDADO, CERRADO, FALLECIDO, EN TRATAMIENTO

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GegG7K4J2pd47s8MMaA85W"
```

---

### Task 5: Tablero (`Tablero.gs`)

**Files:**
- Modify: `src/Tablero.gs`
- Test: `test/logica-tablero.test.js` (nuevo)

**Interfaces:**
- Consumes:
  - las filas de `armarPacientes` y de `pendientes*` (Tarea 4);
  - `ordenarBandeja`, `armarSeries`, `resultadoDe`, `fallecidos`.
- Produces:
  - **`retornosDelMes(seguimientos, citas, hoy)`** devuelve
    `[{ DNI, ESPECIALIDAD, NOMBRE, MEDICO_ULTIMO, FECHA }]`.
  - **`columnaDe(t)`** devuelve `'POR_CONTACTAR'|'AGENDADO'|'EN_TRATAMIENTO'|''`. La tarjeta
    debe traer `TIPO_SEGUIMIENTO`.
  - **`etiquetaDe(t, reglas, hoy)`** devuelve un texto.
  - **`armarTablero(d)`**:
    - `d` trae `pacientes`, `pendientes`, `seguimientos`, `citas`, `vigentes`, `reglas` y `hoy`;
    - devuelve `{ columnas: { POR_CONTACTAR, AGENDADO, EN_TRATAMIENTO, COMPLETADO }, cifras: { porContactar, agendados, enTratamiento, completadosMes, cerradosMes, hechosHoy }, cerrados: [...] }`;
    - cada tarjeta lleva además `CLAVE`, `COLUMNA`, `ETIQUETA` y `FECHA_CLAVE`.
  - **`claveTarjeta(t)`** devuelve `t.ID_REGISTRO || t.DNI + '|' + t.ESPECIALIDAD`.

- [ ] **Step 1: Escribir las pruebas que fallan**

`test/logica-tablero.test.js`:
```js
// Tablero de cuatro columnas. Datos inventados.
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar, plano } = require('./cargar');
const { cita, seg, reglas } = require('./fixtures');
const L = cargar();
const HOY = '2026-10-06';
const R = Object.assign(reglas(L), { maxSeguimientos: 2 });

const pac = o => Object.assign({ DNI: '1', ESPECIALIDAD: 'HEMATOLOGÍA', NOMBRE: 'ROSA QUISPE', MEDICO_ULTIMO: 'Dr. X', ULTIMA_CITA: '2026-08-01',
  PROXIMA_ESPERADA: '2026-08-31', DIAS_ATRASO: 21, ESTADO: 'VENCIDO', N_SEGUIMIENTOS: 0, PENDIENTE: '', AGENDA: '', FECHA_AGENDA: '', INTENTO: 0,
  CIERRE: '', FECHA_CIERRE: '' }, o);
const reg = o => Object.assign({ ID_REGISTRO: 'REG-000001', DNI: '2', ESPECIALIDAD: 'HIERRO', TIPO_SEGUIMIENTO: 'HIERRO', NOMBRE: 'ANA FLORES',
  ESTADO: 'EN TRATAMIENTO', ESTADO_REGISTRO: 'EN CURSO', SESIONES: 3, HECHAS: 1, ULTIMA_SESION: '2026-10-02', DIAS: 4, N_SEGUIMIENTOS: 0, ATRASO: 0,
  AGENDA: '', FECHA_AGENDA: '', INTENTO: 0, CIERRE: '', FECHA_CIERRE: '' }, o);
const tablero = o => plano(L.armarTablero(Object.assign({ pacientes: [], pendientes: [], seguimientos: [], citas: [], vigentes: {}, reglas: R, hoy: HOY }, o)));

test('columnaDe: cada estado a su columna', () => {
  assert.equal(L.columnaDe(Object.assign(pac(), { TIPO_SEGUIMIENTO: 'REEVALUACION' })), 'POR_CONTACTAR');
  assert.equal(L.columnaDe(Object.assign(pac({ ESTADO: 'AGENDADO', N_SEGUIMIENTOS: 1 }), { TIPO_SEGUIMIENTO: 'REEVALUACION' })), 'AGENDADO');
  assert.equal(L.columnaDe(Object.assign(pac({ ESTADO: 'AGENDADO', N_SEGUIMIENTOS: 0 }), { TIPO_SEGUIMIENTO: 'REEVALUACION' })), '', 'cita de SOFDOC sin seguimiento: no es del tablero');
  assert.equal(L.columnaDe(reg()), 'EN_TRATAMIENTO');
  assert.equal(L.columnaDe(reg({ ESTADO: 'PENDIENTE', ATRASO: 2 })), 'POR_CONTACTAR');
  for (const e of ['EN ESPERA', 'CERRADO', 'FALLECIDO', 'ANTIGUO', 'COMPLETADO']) assert.equal(L.columnaDe(reg({ ESTADO: e })), '', e);
});

test('etiquetaDe: textos de cada columna', () => {
  const et = (t, col) => L.etiquetaDe(Object.assign(t, { COLUMNA: col }), R, HOY);
  assert.equal(et(Object.assign(pac(), { TIPO_SEGUIMIENTO: 'REEVALUACION' }), 'POR_CONTACTAR'), 'Debía volver el 31/08 · hace 36 días');
  assert.equal(et(reg({ ESTADO_REGISTRO: 'COTIZADO', DIAS: 16 }), 'POR_CONTACTAR'), 'Cotizó hace 16 días');
  assert.equal(et(reg({ ATRASO: 3 }), 'POR_CONTACTAR'), 'Sesión 2 de 3 · atrasada 3 días');
  assert.equal(et(reg({ ATRASO: 1 }), 'POR_CONTACTAR'), 'Sesión 2 de 3 · atrasada 1 día');
  assert.equal(et(reg({ ATRASO: 0 }), 'POR_CONTACTAR'), 'Sesión 2 de 3 · tocaba hoy');
  assert.equal(et(pac({ AGENDA: 'CITA', FECHA_AGENDA: '2026-10-08' }), 'AGENDADO'), 'Cita el jue 08/10');
  assert.equal(et(pac({ AGENDA: 'LLAMAR', FECHA_AGENDA: '2026-10-12' }), 'AGENDADO'), 'Llamar el lun 12/10');
  assert.equal(et(pac({ AGENDA: 'REINTENTAR', FECHA_AGENDA: '2026-10-21', INTENTO: 1 }), 'AGENDADO'), 'Reintentar el 21/10 · intento 1 de 2');
  assert.equal(et(pac({ AGENDA: 'SIN RESPUESTA', FECHA_AGENDA: '2026-10-21', INTENTO: 2 }), 'AGENDADO'), 'Sin respuesta · se cierra el 21/10');
  assert.equal(et(reg(), 'EN_TRATAMIENTO'), 'Sesión 2 de 3 · próxima ~09/10');
});

test('armarTablero: reparte, ordena y cuenta', () => {
  const t = tablero({
    pacientes: [pac({ DNI: '1' }), pac({ DNI: '3', ESTADO: 'AGENDADO', N_SEGUIMIENTOS: 1, AGENDA: 'LLAMAR', FECHA_AGENDA: '2026-10-20' }),
      pac({ DNI: '4', ESTADO: 'AGENDADO', N_SEGUIMIENTOS: 1, AGENDA: 'CITA', FECHA_AGENDA: '2026-10-08' }),
      pac({ DNI: '5', ESTADO: 'CERRADO', CIERRE: 'SE ATIENDE EN OTRO LUGAR', FECHA_CIERRE: '2026-10-02' }),
      pac({ DNI: '6', ESTADO: 'CERRADO', CIERRE: 'SIN RESPUESTA', FECHA_CIERRE: '2026-09-30' })],
    pendientes: [reg(), reg({ ID_REGISTRO: 'REG-000002', DNI: '7', ESTADO: 'COMPLETADO', ESTADO_REGISTRO: 'COMPLETO', HECHAS: 3, ULTIMA_SESION: '2026-10-03' }),
      reg({ ID_REGISTRO: 'REG-000003', DNI: '8', ESTADO: 'COMPLETADO', ESTADO_REGISTRO: 'COMPLETO', HECHAS: 3, ULTIMA_SESION: '2026-09-20' })]
  });
  assert.deepEqual(t.columnas.POR_CONTACTAR.map(x => x.CLAVE), ['1|HEMATOLOGÍA']);
  assert.deepEqual(t.columnas.AGENDADO.map(x => x.DNI), ['4', '3'], 'la fecha más cercana primero');
  assert.deepEqual(t.columnas.EN_TRATAMIENTO.map(x => x.CLAVE), ['REG-000001']);
  assert.deepEqual(t.columnas.COMPLETADO.map(x => [x.CLAVE, x.ETIQUETA]), [['REG-000002', 'Completó el tratamiento']], 'solo lo de este mes');
  assert.deepEqual(t.cifras, { porContactar: 1, agendados: 2, enTratamiento: 1, completadosMes: 1, cerradosMes: 1, hechosHoy: 0 });
  assert.deepEqual(t.cerrados.map(x => [x.DNI, x.CIERRE]), [['5', 'SE ATIENDE EN OTRO LUGAR']]);
});

test('armarTablero: completados del mes por retorno tras seguimiento, alta y «lo hizo»; fallecidos en cerrados', () => {
  const citas = [cita({ dni: '9', fecha: '2026-08-01' }), cita({ dni: '9', fecha: '2026-10-02' }), cita({ dni: '10', fecha: '2026-10-03' })];
  const segs = [seg({ dni: '9', fecha: '2026-09-20' }), seg({ dni: '11', fecha: '2026-10-05', accion: 'DESCARTADO', motivo: 'FALLECIÓ' }),
    Object.assign(seg({ dni: '9', fecha: HOY }), { RESULTADO: 'LO PENSARÁ', ESPECIALIDAD: 'NUTRICIÓN' })];
  const vigentes = { '12|HEMATOLOGIA': { ID: 'ALT-000001', FECHA: '2026-10-04', DNI: '12', ESPECIALIDAD: 'HEMATOLOGÍA', DOCTOR: 'Dra. Karen Matos' } };
  const hist = reg({ ID_REGISTRO: '', DNI: '13', ESPECIALIDAD: 'PROCEDIMIENTO', TIPO_SEGUIMIENTO: 'PROCEDIMIENTO', ESTADO: 'COMPLETADO', FECHA_LOHIZO: '2026-10-01' });
  const t = tablero({ citas, seguimientos: segs, vigentes, pendientes: [hist] });
  assert.deepEqual(t.columnas.COMPLETADO.map(x => [x.DNI, x.ETIQUETA]), [
    ['12', 'Alta médica · Dra. Karen Matos'], ['9', 'Volvió el 02/10'], ['13', 'Lo hizo el 01/10']]);
  assert.equal(t.cifras.cerradosMes, 1, 'el fallecido');
  assert.equal(t.cifras.hechosHoy, 1);
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `cd /home/user/seguimientos && node --test test/logica-tablero.test.js 2>&1 | grep -E "^not ok|# (pass|fail)"`

Expected: FAIL. `L.armarTablero is not a function`.

- [ ] **Step 3: Implementar** (agregar a `src/Tablero.gs`)

```js
var DIAS_SEMANA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

function dm_(iso) { return iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : ''; }
function diaCorto_(iso) { return DIAS_SEMANA[new Date(diaUtc_(iso)).getUTCDay()] + ' ' + dm_(iso); }
function plural_(n, uno, varios) { return n + ' ' + (n === 1 ? uno : varios); }

function claveTarjeta(t) { return t.ID_REGISTRO || (t.DNI + '|' + t.ESPECIALIDAD); }

/**
 * Reevaluaciones que volvieron ESTE mes después de un seguimiento: la consulta
 * realizada del mes tiene un intento («Sigue») entre la consulta anterior y ella.
 */
function retornosDelMes(seguimientos, citas, hoy) {
  var mes = mesDe(hoy), series = armarSeries(citas), porSerie = {}, out = [];
  (seguimientos || []).forEach(function (s) {
    if (s.REFERENCIA || TIPOS_INDICACION[normTexto(s.ESPECIALIDAD)]) return;
    var r = resultadoDe(s);
    if (!r || r.grupo !== 'SIGUE') return;
    var k = claveSerie(normDni(s.DNI), s.ESPECIALIDAD);
    (porSerie[k] = porSerie[k] || []).push(r.fecha);
  });
  Object.keys(porSerie).forEach(function (k) {
    var serie = series[k];
    if (!serie) return;
    var r = serie.realizadas;
    for (var i = r.length - 1; i >= 0 && mesDe(r[i].FECHA) === mes; i--) {
      var previa = i > 0 ? r[i - 1].FECHA : '';
      var hubo = porSerie[k].some(function (f) { return f > previa && f <= r[i].FECHA; });
      if (hubo) {
        out.push({ DNI: serie.dni, ESPECIALIDAD: serie.especialidad, NOMBRE: serie.nombre, MEDICO_ULTIMO: r[i].MEDICO, FECHA: r[i].FECHA });
        return;
      }
    }
  });
  return out;
}

/** Columna de una fila con TIPO_SEGUIMIENTO; '' si no va al tablero. */
function columnaDe(t) {
  var e = t.ESTADO;
  if (t.TIPO_SEGUIMIENTO === 'REEVALUACION') {
    if (e === 'VENCIDO') return 'POR_CONTACTAR';
    // Una cita de SOFDOC sin seguimiento es rutina, no trabajo de la asesora.
    return e === 'AGENDADO' && Number(t.N_SEGUIMIENTOS) > 0 ? 'AGENDADO' : '';
  }
  if (e === 'PENDIENTE') return 'POR_CONTACTAR';
  if (e === 'AGENDADO') return 'AGENDADO';
  if (e === 'EN TRATAMIENTO') return 'EN_TRATAMIENTO';
  return '';
}

function etiquetaDe(t, reglas, hoy) {
  var sesion = 'Sesión ' + (Number(t.HECHAS) + 1) + ' de ' + t.SESIONES;
  if (t.COLUMNA === 'POR_CONTACTAR') {
    if (t.TIPO_SEGUIMIENTO === 'REEVALUACION') return 'Debía volver el ' + dm_(t.PROXIMA_ESPERADA) + ' · hace ' + plural_(diasEntre(t.PROXIMA_ESPERADA, hoy), 'día', 'días');
    if (t.ESTADO_REGISTRO === 'EN CURSO') return sesion + (t.ATRASO > 0 ? ' · atrasada ' + plural_(t.ATRASO, 'día', 'días') : ' · tocaba hoy');
    return 'Cotizó hace ' + plural_(t.DIAS, 'día', 'días');
  }
  if (t.COLUMNA === 'AGENDADO') {
    if (t.AGENDA === 'CITA') return 'Cita el ' + diaCorto_(t.FECHA_AGENDA);
    if (t.AGENDA === 'LLAMAR') return 'Llamar el ' + diaCorto_(t.FECHA_AGENDA);
    if (t.AGENDA === 'REINTENTAR') return 'Reintentar el ' + dm_(t.FECHA_AGENDA) + ' · intento ' + t.INTENTO + ' de ' + reglas.maxSeguimientos;
    return 'Sin respuesta · se cierra el ' + dm_(t.FECHA_AGENDA);
  }
  if (t.COLUMNA === 'EN_TRATAMIENTO') return sesion + ' · próxima ~' + dm_(sumarDias(t.ULTIMA_SESION, reglas.diasEntreSesiones));
  return t.ETIQUETA || '';
}

function conTipo_(t, tipo) {
  var o = {};
  Object.keys(t).forEach(function (k) { o[k] = t[k]; });
  if (tipo) o.TIPO_SEGUIMIENTO = tipo;
  return o;
}

function tarjeta_(t, columna, reglas, hoy, fechaClave, etiqueta) {
  var o = conTipo_(t);
  o.CLAVE = claveTarjeta(o);
  o.COLUMNA = columna;
  o.ETIQUETA = etiqueta || etiquetaDe(o, reglas, hoy);
  o.FECHA_CLAVE = fechaClave || '';
  return o;
}

function armarTablero(d) {
  var reglas = d.reglas, hoy = d.hoy, mes = mesDe(hoy);
  var col = { POR_CONTACTAR: [], AGENDADO: [], EN_TRATAMIENTO: [], COMPLETADO: [] }, cerrados = [];
  var reeval = (d.pacientes || []).map(function (p) { return conTipo_(p, 'REEVALUACION'); });
  var todas = reeval.concat(d.pendientes || []);

  // Por contactar: el orden de la bandeja de siempre (diseño §7.1).
  ordenarBandeja(d.pacientes, d.pendientes).forEach(function (t) {
    col.POR_CONTACTAR.push(tarjeta_(t, 'POR_CONTACTAR', reglas, hoy, ''));
  });
  todas.forEach(function (t) {
    var c = columnaDe(t);
    if (c === 'AGENDADO') col.AGENDADO.push(tarjeta_(t, c, reglas, hoy, t.FECHA_AGENDA));
    if (c === 'EN_TRATAMIENTO') col.EN_TRATAMIENTO.push(tarjeta_(t, c, reglas, hoy, sumarDias(t.ULTIMA_SESION, reglas.diasEntreSesiones)));
    if (t.ESTADO === 'COMPLETADO') {
      var f = t.ULTIMA_SESION && t.ESTADO_REGISTRO === 'COMPLETO' ? t.ULTIMA_SESION : t.FECHA_LOHIZO;
      if (mesDe(f) === mes) col.COMPLETADO.push(tarjeta_(t, 'COMPLETADO', reglas, hoy, f,
        t.ESTADO_REGISTRO === 'COMPLETO' ? 'Completó el tratamiento' : 'Lo hizo el ' + dm_(f)));
    }
    if (t.ESTADO === 'CERRADO' && mesDe(t.FECHA_CIERRE) === mes) {
      if (t.CIERRE === 'ALTA MÉDICA') col.COMPLETADO.push(tarjeta_(t, 'COMPLETADO', reglas, hoy, t.FECHA_CIERRE, 'Alta médica'));
      else cerrados.push({ CLAVE: claveTarjeta(t), DNI: t.DNI, NOMBRE: t.NOMBRE, TIPO_SEGUIMIENTO: t.TIPO_SEGUIMIENTO, CIERRE: t.CIERRE, FECHA_CIERRE: t.FECHA_CIERRE });
    }
  });
  Object.keys(d.vigentes || {}).forEach(function (k) {
    var a = d.vigentes[k];
    if (mesDe(a.FECHA) !== mes) return;
    var p = reeval.filter(function (x) { return claveSerie(x.DNI, x.ESPECIALIDAD) === k; })[0] || { DNI: a.DNI, ESPECIALIDAD: a.ESPECIALIDAD, NOMBRE: '' };
    col.COMPLETADO.push(tarjeta_(conTipo_(p, 'REEVALUACION'), 'COMPLETADO', reglas, hoy, a.FECHA, 'Alta médica' + (a.DOCTOR ? ' · ' + a.DOCTOR : '')));
  });
  retornosDelMes(d.seguimientos, d.citas, hoy).forEach(function (r) {
    col.COMPLETADO.push(tarjeta_(conTipo_(r, 'REEVALUACION'), 'COMPLETADO', reglas, hoy, r.FECHA, 'Volvió el ' + dm_(r.FECHA)));
  });
  var muertos = fallecidos(d.seguimientos);
  Object.keys(muertos).forEach(function (dni) {
    if (mesDe(muertos[dni].fecha) === mes) cerrados.push({ CLAVE: dni, DNI: dni, NOMBRE: '', TIPO_SEGUIMIENTO: '', CIERRE: 'FALLECIÓ', FECHA_CIERRE: muertos[dni].fecha });
  });

  var asc = function (a, b) { return a.FECHA_CLAVE < b.FECHA_CLAVE ? -1 : a.FECHA_CLAVE > b.FECHA_CLAVE ? 1 : 0; };
  col.AGENDADO.sort(asc);
  col.EN_TRATAMIENTO.sort(asc);
  col.COMPLETADO.sort(function (a, b) { return -asc(a, b); });
  var hechosHoy = (d.seguimientos || []).filter(function (s) {
    var r = resultadoDe(s);
    return r && r.grupo === 'SIGUE' && r.fecha === hoy;
  }).length;
  return {
    columnas: col,
    cerrados: cerrados,
    cifras: { porContactar: col.POR_CONTACTAR.length, agendados: col.AGENDADO.length, enTratamiento: col.EN_TRATAMIENTO.length,
      completadosMes: col.COMPLETADO.length, cerradosMes: cerrados.length, hechosHoy: hechosHoy }
  };
}
```

En la prueba de completados, la tarjeta del alta (DNI 12) no tiene paciente en `pacientes`,
así que `NOMBRE` queda vacío. Para la app basta. Cuando el alta sí tiene paciente, se usa su
fila.

- [ ] **Step 4: Correr y ver que pasan**

Run: `cd /home/user/seguimientos && npm test 2>&1 | grep -E "^not ok|# (pass|fail)"`

Expected: `# fail 0`.

**Si algo falla:**
- **Un día de la semana sale mal** en «Cita el jue 08/10»: el 08/10/2026 es jueves. El error
  está en `diaUtc_`, que se usa en UTC; no se corrige cambiando la prueba.
- **No se cargan las pruebas:** agregar `test/logica-tablero.test.js` a mano en
  `package.json` no hace falta, porque el patrón `test/logica-*.test.js` ya lo incluye.

- [ ] **Step 5: Commit**

```bash
cd /home/user/seguimientos && git add src/Tablero.gs test/logica-tablero.test.js && git commit -q -m "Tablero: columnas, etiquetas, orden y cifras

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GegG7K4J2pd47s8MMaA85W"
```

---

### Task 6: Validación y servidor

**Files:**
- Modify: `src/Resultados.gs`:
  - `validarResultado`;
  - `accionPara`;
  - `validarAnulacionResultado`;
  - `resumenAntiguos`.
- Create: `src/ResultadoServidor.gs`
- Modify: `src/Codigo.gs`:
  - `datos_` y el nuevo `derivar_`, en las líneas 220-244;
  - `registrar_`, en las líneas 349-377;
  - `getPaciente`.
- Modify: `src/RegistroServidor.gs:161-178` (`buscarPacienteRegistro`)
- Modify: `src/Menu.gs` (`verificar`)
- Modify: `package.json`, `test/sintaxis.test.js`
- Test: `test/logica-resultados.test.js`, `test/resultado-servidor.test.js` (nuevo)

**Interfaces:**
- Consumes: todo lo anterior, más `darDeAlta`, `marcarSesion`, `marcarAnulado_`,
  `exigirUsuario_` y `exigirMotivo_`.
- Produces:
  - **`validarResultado(p, d)`**:
    - `p` es `{ usuario, dni, especialidad, referencia, resultado, fecha, telefono, motivo, doctor, nota }`;
    - `d` es `{ catalogos, hoy, tarjetas }`;
    - devuelve `{ error, fila, tarjeta }`. `fila` trae todas las columnas de `SEGUIMIENTOS`
      salvo `ID`, `FECHA_HORA` y `ACCION`.
  - **`accionPara(resultado, quedanContactos)`** devuelve `'HECHO'|'TELEFONO'|'DESCARTADO'`.
  - **`validarAnulacionResultado(id, seguimientos)`** devuelve `''` o el error.
  - **`resumenAntiguos(seguimientos)`** devuelve
    `{ hechos, descartes, fallecidos, nuevos, anulados }`.
  - **`registrarResultado(p)`** devuelve una de tres respuestas:
    - `{ ok, seguimiento, tarjeta }`;
    - la respuesta de `darDeAlta`, `{ ok, alta }`;
    - la respuesta de `marcarSesion`, `{ ok, sesion, completo }`.
  - **`anularResultado({ usuario, id, motivo })`** devuelve `{ ok: true }`.
  - **`getTablero()`** devuelve `armarTablero(datos_())`, ya pasado por `limpiarParaEnvio`.
  - **`datos_()`** agrega `seguimientosTodos`, con las anuladas, y `telefonos`.
    `d.seguimientos` queda sin las anuladas.
  - **`getPaciente(dni)`** agrega tres campos:
    - `seguimientos`, que ahora son todos, con `ANULADO`;
    - `fallecido: null|{fecha, quien, id}`;
    - `telefonosDescartados: [tel]`.
  - **`buscarPacienteRegistro(dni)`** agrega `fallecido: null|{fecha, quien}`, también
    cuando el paciente no tiene consultas.

- [ ] **Step 1: Pruebas de lógica que fallan** (agregar a `test/logica-resultados.test.js`)

```js
const CAT = { usuarios: ['MAGALY'], motivos: [], doctores: [{ doctor: 'Dra. Karen Matos', sofdoc: '' }] };
const TARJ = [{ DNI: '40111222', ESPECIALIDAD: 'HEMATOLOGÍA', TELEFONOS: '987654321 / 912345678' },
  { DNI: '40111222', ESPECIALIDAD: 'HIERRO', ID_REGISTRO: 'REG-000001', TELEFONOS: '' }];
const val = o => plano(L.validarResultado(Object.assign({ usuario: 'magaly', dni: '40111222', especialidad: 'Hematología', referencia: '',
  resultado: 'no contestó', nota: '' }, o), { catalogos: CAT, hoy: '2026-10-06', tarjetas: TARJ }));

test('validarResultado: mensajes de cada error', () => {
  assert.match(val({ usuario: 'X' }).error, /Elija quién es usted/);
  assert.match(val({ dni: '' }).error, /Falta el DNI/);
  assert.match(val({ especialidad: 'NUTRICIÓN' }).error, /no está en la lista/);
  assert.match(val({ resultado: 'quizás' }).error, /Elija qué pasó/);
  assert.match(val({ resultado: 'LO HIZO', fecha: '2026-10-06' }).error, /solo para hierro y procedimientos/);
  assert.match(val({ resultado: 'LO PENSARÁ' }).error, /Falta la fecha para volver a llamar/);
  assert.match(val({ resultado: 'LO PENSARÁ', fecha: '2026-10-06' }).error, /de mañana a 90 días/);
  assert.match(val({ resultado: 'AGENDÓ CITA', fecha: '2026-10-05' }).error, /de hoy a 180 días/);
  assert.match(val({ resultado: 'ALTA MÉDICA', doctor: 'Dr. Nadie' }).error, /Elija el doctor/);
  assert.match(val({ resultado: 'NÚMERO EQUIVOCADO' }).error, /Elija cuál teléfono/);
  assert.match(val({ resultado: 'NÚMERO EQUIVOCADO', telefono: '955555555' }).error, /no es de este paciente/);
  assert.match(val({ resultado: 'NO DESEA CONTINUAR', motivo: '  ' }).error, /Escriba el motivo/);
  assert.match(val({ especialidad: 'HIERRO', referencia: 'REG-000001', resultado: 'LO HIZO', fecha: '2026-10-07' }).error, /no puede ser futura/);
});

test('validarResultado: la fila que se guarda', () => {
  const v = val({ resultado: 'lo pensara', fecha: '2026-10-09', nota: ' llamar tarde ' });
  assert.equal(v.error, '');
  assert.deepEqual(v.fila, { DNI: '40111222', ESPECIALIDAD: 'HEMATOLOGÍA', RESPONSABLE: 'MAGALY', MOTIVO: '', NOTA: 'llamar tarde', REFERENCIA: '',
    RESULTADO: 'LO PENSARÁ', FECHA_PROXIMA: '2026-10-09', TELEFONO: '', ANULADO: '', MOTIVO_ANULACION: '' });
  const nd = val({ resultado: 'NO DESEA CONTINUAR', motivo: 'Lo ve otro médico', nota: 'amable' }).fila;
  assert.deepEqual([nd.MOTIVO, nd.NOTA], ['NO DESEA CONTINUAR', 'Motivo: Lo ve otro médico · amable']);
  const ne = val({ resultado: 'NÚMERO EQUIVOCADO', telefono: '51987654321' }).fila;
  assert.deepEqual([ne.MOTIVO, ne.TELEFONO], ['NÚMERO EQUIVOCADO', '987654321']);
  const al = val({ especialidad: 'HIERRO', referencia: 'REG-000001', resultado: 'ALTA MÉDICA', doctor: 'dra. karen matos' }).fila;
  assert.deepEqual([al.MOTIVO, al.NOTA, al.REFERENCIA], ['ALTA MÉDICA', 'Alta: Dra. Karen Matos', 'REG-000001']);
});

test('accionPara y validarAnulacionResultado', () => {
  assert.equal(L.accionPara('LO PENSARÁ', true), 'HECHO');
  assert.equal(L.accionPara('NÚMERO EQUIVOCADO', true), 'TELEFONO');
  assert.equal(L.accionPara('NÚMERO EQUIVOCADO', false), 'DESCARTADO');
  assert.equal(L.accionPara('FALLECIÓ', true), 'DESCARTADO');
  const a = Object.assign(res('2026-10-01', 'NO CONTESTÓ'), { ID: 'SEG-1' });
  const b = Object.assign(res('2026-10-03', 'LO PENSARÁ'), { ID: 'SEG-2' });
  const m = Object.assign(res('2026-10-02', 'FALLECIÓ', { ESPECIALIDAD: 'NUTRICIÓN' }), { ID: 'SEG-3' });
  assert.equal(L.validarAnulacionResultado('SEG-2', [a, b, m]), '');
  assert.match(L.validarAnulacionResultado('SEG-1', [a, b, m]), /Solo se puede anular el último/);
  assert.equal(L.validarAnulacionResultado('SEG-3', [a, b, m, Object.assign(res('2026-10-04', 'NO CONTESTÓ', { ESPECIALIDAD: 'NUTRICIÓN' }), { ID: 'SEG-4' })]), '', 'un falleció siempre se puede anular');
  assert.match(L.validarAnulacionResultado('SEG-9', [a]), /No encontré SEG-9/);
  assert.match(L.validarAnulacionResultado('SEG-1', [Object.assign({}, a, { ANULADO: 'SÍ' })]), /ya estaba anulado/);
});

test('resumenAntiguos cuenta las filas por clase', () => {
  const r = plano(L.resumenAntiguos([seg({ fecha: '2026-09-01' }), seg({ fecha: '2026-09-02', accion: 'DESCARTADO', motivo: 'OTRO' }),
    seg({ fecha: '2026-09-03', accion: 'DESCARTADO', motivo: 'FALLECIÓ' }), res('2026-10-01', 'LO PENSARÁ'),
    Object.assign(res('2026-10-02', 'NO CONTESTÓ'), { ANULADO: 'SÍ' })]));
  assert.deepEqual(r, { hechos: 1, descartes: 1, fallecidos: 1, nuevos: 1, anulados: 1 });
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `cd /home/user/seguimientos && node --test test/logica-resultados.test.js 2>&1 | grep -E "^not ok|# (pass|fail)"`

Expected: FAIL. `validarResultado is not a function`.

- [ ] **Step 3: Implementar la lógica** (agregar a `src/Resultados.gs`)

```js
/** Lo que la asesora eligió en «¿Qué pasó?», revisado. La tarjeta se busca como en la bandeja. */
function validarResultado(p, d) {
  function no(m) { return { error: m, fila: null, tarjeta: null }; }
  if (!p) return no('Faltan los datos.');
  var quien = enLista_(d.catalogos.usuarios, p.usuario);
  if (!quien) return no('Elija quién es usted en el selector de arriba.');
  var dni = normDni(p.dni);
  if (!dni) return no('Falta el DNI del paciente.');
  if (!normTexto(p.especialidad)) return no('Falta la especialidad.');
  var ref = textoLimpio_(p.referencia);
  var t = (d.tarjetas || []).filter(function (x) {
    return x.DNI === dni && normTexto(x.ESPECIALIDAD) === normTexto(p.especialidad) && (ref ? x.ID_REGISTRO === ref : !x.ID_REGISTRO);
  })[0];
  if (!t) return no('Ese paciente no está en la lista. Recargue la página.');
  var r = RESULTADOS[normTexto(p.resultado)];
  if (!r) return no('Elija qué pasó.');
  if (r.soloIndicacion && !TIPOS_INDICACION[normTexto(t.ESPECIALIDAD)]) return no('«Lo hizo» es solo para hierro y procedimientos.');
  var hoy = d.hoy, f = fechaIso(p.fecha), nota = textoLimpio_(p.nota);
  var fila = { DNI: dni, ESPECIALIDAD: t.ESPECIALIDAD, RESPONSABLE: quien, MOTIVO: r.grupo === 'SIGUE' ? '' : r.nombre, NOTA: nota,
    REFERENCIA: ref, RESULTADO: r.nombre, FECHA_PROXIMA: '', TELEFONO: '', ANULADO: '', MOTIVO_ANULACION: '' };
  if (r.nombre === 'LO PENSARÁ') {
    if (!f) return no('Falta la fecha para volver a llamar.');
    if (f <= hoy || f > sumarDias(hoy, 90)) return no('La fecha para volver a llamar va de mañana a 90 días.');
    fila.FECHA_PROXIMA = f;
  }
  if (r.nombre === 'AGENDÓ CITA') {
    if (!f) return no('Falta la fecha de la cita.');
    if (f < hoy || f > sumarDias(hoy, 180)) return no('La fecha de la cita va de hoy a 180 días.');
    fila.FECHA_PROXIMA = f;
  }
  if (r.nombre === 'LO HIZO') {
    if (!f) return no('Falta la fecha de la sesión.');
    if (f > hoy) return no('La fecha de la sesión no puede ser futura.');
    fila.FECHA_PROXIMA = f;
  }
  if (r.nombre === 'ALTA MÉDICA') {
    var doc = (d.catalogos.doctores || []).filter(function (x) { return normTexto(x.doctor) === normTexto(p.doctor); })[0];
    if (!doc) return no('Elija el doctor que da el alta.');
    fila.NOTA = unirNota_('Alta: ' + doc.doctor, nota);
  }
  if (r.nombre === 'NÚMERO EQUIVOCADO') {
    var tel = normTelefono(p.telefono);
    if (!tel) return no('Elija cuál teléfono está equivocado.');
    if (String(t.TELEFONOS || '').split(' / ').indexOf(tel) < 0) return no('Ese teléfono no es de este paciente.');
    fila.TELEFONO = tel;
  }
  if (r.nombre === 'NO DESEA CONTINUAR') {
    var motivo = textoLimpio_(p.motivo);
    if (!motivo) return no('Escriba el motivo.');
    fila.NOTA = unirNota_('Motivo: ' + motivo, nota);
  }
  return { error: '', fila: fila, tarjeta: t };
}

function unirNota_(a, b) { return b ? a + ' · ' + b : a; }

/** ACCION que se escribe junto al resultado, para que las cifras antiguas sigan igual. */
function accionPara(resultado, quedanContactos) {
  var r = RESULTADOS[normTexto(resultado)];
  if (!r) return '';
  if (r.grupo === 'SIGUE') return 'HECHO';
  if (r.grupo === 'TELEFONO') return quedanContactos ? 'TELEFONO' : 'DESCARTADO';
  return 'DESCARTADO';
}

/** Se anula el último resultado de su seguimiento; un «falleció», siempre (vale para todo el paciente). */
function validarAnulacionResultado(id, seguimientos) {
  var lista = seguimientos || [];
  var s = lista.filter(function (x) { return x.ID === id; })[0];
  if (!s) return 'No encontré ' + id + '.';
  if (anulado_(s)) return id + ' ya estaba anulado.';
  if (resultadoDe(s).resultado === 'FALLECIÓ') return '';
  var mismo = lista.filter(function (x) {
    return !anulado_(x) && normDni(x.DNI) === normDni(s.DNI) && normTexto(x.ESPECIALIDAD) === normTexto(s.ESPECIALIDAD) &&
      textoLimpio_(x.REFERENCIA) === textoLimpio_(s.REFERENCIA);
  }).sort(porFechaHora_);
  return mismo[mismo.length - 1].ID === id ? '' : 'Solo se puede anular el último resultado de este seguimiento.';
}

/** Para «Verificar»: cuántas filas hay de cada clase. No reescribe ninguna. */
function resumenAntiguos(seguimientos) {
  var out = { hechos: 0, descartes: 0, fallecidos: 0, nuevos: 0, anulados: 0 };
  (seguimientos || []).forEach(function (s) {
    if (anulado_(s)) { out.anulados++; return; }
    var r = resultadoDe(s);
    if (!r) return;
    if (!r.antiguo) out.nuevos++;
    else if (r.resultado === 'FALLECIÓ') out.fallecidos++;
    else if (r.grupo === 'SIGUE') out.hechos++;
    else out.descartes++;
  });
  return out;
}
```

Correr: `node --test test/logica-resultados.test.js`. Expected: PASS.

- [ ] **Step 4: Pruebas del servidor que fallan**

`test/resultado-servidor.test.js`:
```js
// Servidor de «¿Qué pasó?» con dobles de las hojas. Datos inventados.
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar, plano } = require('./cargar');
const { cita, reglas } = require('./fixtures');

const CAT = { usuarios: ['MAGALY', 'RACHEL'], motivos: [], alias: {}, doctores: [{ doctor: 'Dra. Karen Matos', sofdoc: '' }],
  procedimientos: [], tratamientos: [], marcas: {} };

function servidor(hoja) {
  const ctx = cargar(['Logica.gs', 'Registro.gs', 'Resultados.gs', 'Tablero.gs', 'Codigo.gs', 'RegistroServidor.gs', 'ResultadoServidor.gs']);
  const escrito = { SEGUIMIENTOS: [], BITACORA: [], anulados: [], llamadas: [] };
  const lock = { tomado: 0, flush: 0 };
  const L = cargar();
  const enHoja = hoja || [];
  ctx.datos_ = () => ctx.derivar_({ hoy: '2026-10-06', catalogos: CAT, reglas: Object.assign(reglas(L), { maxSeguimientos: 2 }),
    citas: [cita({ fecha: '2026-07-01' })], indicaciones: [{ DNI: '40111222', TELEFONO: '987654321', FECHA: '2026-06-01', TIPO: 'HIERRO', ESTADO: 'ACEPTÓ' },
      { DNI: '40111222', TELEFONO: '912345678', FECHA: '2026-06-01', TIPO: 'HIERRO', ESTADO: 'ACEPTÓ' }],
    contactos: [], registros: [], sesiones: [], altas: [], seguimientosTodos: enHoja.slice(), seguimientos: enHoja.filter(s => !L.anulado_(s)) });
  ctx.bloquear_ = () => { lock.tomado++; return { releaseLock: () => { lock.tomado--; } }; };
  ctx.SpreadsheetApp = { flush: () => { lock.flush++; } };
  ctx.leerSeguimientos_ = () => enHoja.concat(escrito.SEGUIMIENTOS);
  ctx.anexarObjeto_ = (n, cols, o) => { assert.equal(lock.tomado, 1, 'se escribe con el candado tomado'); escrito[n].push(plano(o)); };
  ctx.bitacora_ = (u, a, d) => escrito.BITACORA.push([u, a, d]);
  ctx.fechaHoraTexto_ = () => '2026-10-06 10:30';
  ctx.marcarAnulado_ = (n, id, motivo) => { assert.equal(lock.tomado, 1); escrito.anulados.push([n, id, motivo]); };
  ctx.darDeAlta = p => { escrito.llamadas.push(['darDeAlta', plano(p)]); return { ok: true, alta: { ID: 'ALT-000001' } }; };
  ctx.marcarSesion = p => { escrito.llamadas.push(['marcarSesion', plano(p)]); return { ok: true, sesion: { ID: 'SES-000001' }, completo: false }; };
  return { ctx, escrito, lock };
}
const p = o => Object.assign({ usuario: 'MAGALY', dni: '40111222', especialidad: 'HEMATOLOGÍA', referencia: '', resultado: 'NO CONTESTÓ' }, o);

test('registrarResultado: lo inválido no toma el candado', () => {
  const { ctx, escrito, lock } = servidor();
  assert.throws(() => ctx.registrarResultado(p({ resultado: 'quizás' })), /Elija qué pasó/);
  assert.deepEqual([escrito.SEGUIMIENTOS.length, lock.tomado, lock.flush], [0, 0, 0]);
});

test('registrarResultado: escribe la fila, la bitácora, suelta con flush y devuelve la tarjeta movida', () => {
  const { ctx, escrito, lock } = servidor();
  const r = plano(ctx.registrarResultado(p({ resultado: 'lo pensará', fecha: '2026-10-09' })));
  assert.equal(r.ok, true);
  const s = escrito.SEGUIMIENTOS[0];
  assert.match(s.ID, /^SEG-\d+-\d+$/);
  assert.deepEqual([s.FECHA_HORA, s.ACCION, s.RESULTADO, s.FECHA_PROXIMA], ['2026-10-06 10:30', 'HECHO', 'LO PENSARÁ', '2026-10-09']);
  assert.deepEqual(escrito.BITACORA, [['MAGALY', 'RESULTADO', '40111222 · HEMATOLOGÍA · LO PENSARÁ']]);
  assert.deepEqual([lock.tomado, lock.flush], [0, 1]);
  assert.deepEqual([r.tarjeta.COLUMNA, r.tarjeta.ETIQUETA], ['AGENDADO', 'Llamar el vie 09/10']);
});

test('número equivocado: con otro teléfono sigue (TELEFONO); el último cierra (DESCARTADO), releyendo dentro del candado', () => {
  const { ctx, escrito } = servidor();
  ctx.registrarResultado(p({ resultado: 'NÚMERO EQUIVOCADO', telefono: '987654321' }));
  assert.equal(escrito.SEGUIMIENTOS[0].ACCION, 'TELEFONO');
  // Otra asesora, con datos de antes de la primera marca, marca el otro número.
  const r = plano(ctx.registrarResultado(p({ resultado: 'NÚMERO EQUIVOCADO', telefono: '912345678' })));
  assert.equal(escrito.SEGUIMIENTOS[1].ACCION, 'DESCARTADO');
  assert.equal(r.tarjeta, '', 'cerrada: ya no está en el tablero');
});

test('alta médica de una reevaluación y «lo hizo» de un registro van a sus funciones', () => {
  const { ctx, escrito } = servidor();
  const a = plano(ctx.registrarResultado(p({ resultado: 'ALTA MÉDICA', doctor: 'Dra. Karen Matos', fecha: '2026-10-06' })));
  assert.equal(a.alta.ID, 'ALT-000001');
  assert.deepEqual(escrito.llamadas[0][1], { usuario: 'MAGALY', dni: '40111222', especialidad: 'HEMATOLOGÍA', doctor: 'Dra. Karen Matos', fecha: '2026-10-06', nota: '' });
  assert.equal(escrito.SEGUIMIENTOS.length, 0);
});

test('anularResultado: solo SEG-, motivo obligatorio, el último de su seguimiento', () => {
  const hoja = [{ ID: 'SEG-1', FECHA_HORA: '2026-10-01 09:00', DNI: '40111222', ESPECIALIDAD: 'HEMATOLOGÍA', RESULTADO: 'NO CONTESTÓ', ACCION: 'HECHO', REFERENCIA: '' },
    { ID: 'SEG-2', FECHA_HORA: '2026-10-02 09:00', DNI: '40111222', ESPECIALIDAD: 'HEMATOLOGÍA', RESULTADO: 'NO CONTESTÓ', ACCION: 'HECHO', REFERENCIA: '' }];
  const { ctx, escrito, lock } = servidor(hoja);
  assert.throws(() => ctx.anularResultado({ usuario: 'MAGALY', id: 'ALT-1', motivo: 'x' }), /resultados de seguimiento/);
  assert.throws(() => ctx.anularResultado({ usuario: 'MAGALY', id: 'SEG-2', motivo: '' }), /Escriba el motivo/);
  assert.throws(() => ctx.anularResultado({ usuario: 'MAGALY', id: 'SEG-1', motivo: 'error' }), /Solo se puede anular el último/);
  assert.equal(lock.tomado, 0, 'el candado se suelta también con error');
  assert.deepEqual(plano(ctx.anularResultado({ usuario: 'MAGALY', id: 'SEG-2', motivo: 'Deshecho al momento' })), { ok: true });
  assert.deepEqual(escrito.anulados, [['SEGUIMIENTOS', 'SEG-2', 'Deshecho al momento']]);
});

test('datos_ deja fuera las anuladas; marcarSeguimiento y descartar siguen funcionando', () => {
  const hoja = [{ ID: 'SEG-1', FECHA_HORA: '2026-10-05 09:00', DNI: '40111222', ESPECIALIDAD: 'HEMATOLOGÍA', ACCION: 'HECHO', ANULADO: 'SÍ' }];
  const { ctx, escrito } = servidor(hoja);
  assert.equal(ctx.datos_().pacientes[0].ESTADO, 'VENCIDO', 'el intento anulado no cuenta');
  ctx.marcarSeguimiento(p({}));
  assert.deepEqual([escrito.SEGUIMIENTOS[0].RESULTADO, escrito.SEGUIMIENTOS[0].ACCION], ['NO CONTESTÓ', 'HECHO']);
  ctx.descartar(p({ motivo: 'SE ATIENDE EN OTRO LUGAR' }));
  assert.deepEqual([escrito.SEGUIMIENTOS[1].RESULTADO, escrito.SEGUIMIENTOS[1].ACCION], ['SE ATIENDE EN OTRO LUGAR', 'DESCARTADO']);
});

test('getTablero devuelve las columnas listas para enviar', () => {
  const { ctx } = servidor();
  const t = plano(ctx.getTablero());
  assert.deepEqual(t.columnas.POR_CONTACTAR.map(x => x.CLAVE), ['40111222|HEMATOLOGÍA']);
});
```

En `test/sintaxis.test.js`, en la primera prueba:
- cambiar la lista de archivos a
  `['Logica.gs', 'Registro.gs', 'Resultados.gs', 'Tablero.gs', 'Codigo.gs', 'RegistroServidor.gs', 'ResultadoServidor.gs']`;
- agregar `'registrarResultado', 'anularResultado', 'getTablero'` a la lista de funciones.

En la segunda prueba (`Menu.gs carga con los otros…`), la misma lista, con `'Menu.gs'` al
final.

`package.json`, script `test`:
```json
    "test": "node --test test/logica-*.test.js test/sintaxis.test.js test/menu.test.js test/registro-servidor.test.js test/resultado-servidor.test.js",
```

`test/registro-servidor.test.js` y `test/menu.test.js` cargan `['Logica.gs', 'Registro.gs', 'Codigo.gs', …]`.
Agregarles `'Resultados.gs', 'Tablero.gs'` después de `'Registro.gs'`, porque `datos_` ya
usa esas funciones.

- [ ] **Step 5: Correr y ver que fallan**

Run: `cd /home/user/seguimientos && npm test 2>&1 | grep -E "^not ok|# (pass|fail)"`

Expected: FAIL. `ResultadoServidor.gs` no existe.

- [ ] **Step 6: Implementar el servidor**

`src/Codigo.gs`, reemplazar `datos_`:
```js
/** Todo lo que necesita la app, leído una vez por petición. */
function datos_() {
  if (MEMO.datos) return MEMO.datos;
  var todos = leerSeguimientos_();
  MEMO.datos = derivar_({
    hoy: hoy_(),
    reglas: reglas_(),
    catalogos: catalogos_(),
    citas: leerCitas_(),
    indicaciones: leerIndicaciones_(),
    // Las anuladas solo se muestran en la historia; ninguna cifra las cuenta.
    seguimientosTodos: todos,
    seguimientos: todos.filter(function (s) { return !anulado_(s); }),
    contactos: leerContactos_(),
    registros: leerRegistros_(),
    sesiones: leerSesiones_(),
    altas: leerAltas_()
  });
  return MEMO.datos;
}

/** Lo que se calcula a partir de lo leído. Se repite tras guardar, sin volver a leer las hojas. */
function derivar_(d) {
  // Historial (INDICACIONES) + Registro: lo que cuenta en cifras, teléfonos y pendientes.
  d.indicacionesTodas = d.indicaciones.concat(indicacionesDeRegistros(d.registros, d.sesiones, d.catalogos, d.reglas, d.hoy));
  d.vigentes = altasVigentes(d.altas, d.seguimientos, d.citas);
  d.telefonos = telefonosPorDni(d.indicacionesTodas, d.contactos, d.seguimientos);
  d.pacientes = armarPacientes(d.citas, d.indicacionesTodas, d.seguimientos, d.reglas, d.hoy, d.contactos, d.vigentes);
  d.pendientes = pendientesIndicacion(d.citas, d.indicacionesTodas, d.seguimientos, d.reglas, d.hoy, d.contactos)
    .concat(pendientesRegistro({ registros: d.registros, sesiones: d.sesiones, seguimientos: d.seguimientos, citas: d.citas,
      reglas: d.reglas, hoy: d.hoy, telefonos: d.telefonos, catalogos: d.catalogos }));
  return d;
}
```

`src/Codigo.gs`, reemplazar `registrar_`, `marcarSeguimiento` y `descartar` por los
envoltorios:
```js
/** Envoltorios de la app anterior: «Hecho» es un «no contestó»; «Descartar» cierra con el motivo elegido. */
function marcarSeguimiento(p) { return registrarResultado(copia_(p || {}, { resultado: 'NO CONTESTÓ' })); }

function descartar(p) {
  var r = RESULTADOS[normTexto(p && p.motivo)];
  var q = r && r.grupo === 'CIERRE' && r.pide !== 'DOCTOR'
    ? { resultado: r.nombre, motivo: r.nombre }
    : { resultado: 'NO DESEA CONTINUAR', motivo: textoLimpio_(p && p.motivo) || 'OTRO' };
  return registrarResultado(copia_(p || {}, q));
}
```

`src/Codigo.gs`, `getPaciente`:
- `seguimientos: d.seguimientosTodos.filter(function (s) { return s.DNI === k; }),`
- agregar al objeto:
  ```js
    fallecido: fallecidos(d.seguimientos)[k] || null,
    telefonosDescartados: telefonosDescartados(marcasTelefono(d.seguimientos), d.telefonos)[k] || []
  ```

`src/RegistroServidor.gs`, `buscarPacienteRegistro`:
- la primera línea calcula `var muerto = fallecidos(d.seguimientos)[k] || null;`;
- `if (!k || !realizadas.length) return limpiarParaEnvio({ encontrado: false, fallecido: muerto });`;
- en el objeto final:
  - `telefonos: d.telefonos[k] || [],`
  - agregar `fallecido: muerto`.

`src/ResultadoServidor.gs`:
```js
/* ==========================================================================
   «¿QUÉ PASÓ?» (las llama la app por google.script.run)

   Escribe en SEGUIMIENTOS con el candado tomado. El alta de una reevaluación y
   la sesión de un registro ya tienen su hoja: se delegan en darDeAlta y marcarSesion.
   ========================================================================== */

function registrarResultado(p) {
  var d = datos_();
  var v = validarResultado(p, { catalogos: d.catalogos, hoy: d.hoy, tarjetas: d.pacientes.concat(d.pendientes) });
  if (v.error) throw new Error(v.error);
  var t = v.tarjeta, indicacion = !!TIPOS_INDICACION[normTexto(t.ESPECIALIDAD)];
  if (v.fila.RESULTADO === 'ALTA MÉDICA' && !indicacion) {
    return darDeAlta({ usuario: p.usuario, dni: v.fila.DNI, especialidad: t.ESPECIALIDAD, doctor: p.doctor, fecha: p.fecha, nota: textoLimpio_(p.nota) });
  }
  if (v.fila.RESULTADO === 'LO HIZO' && t.ID_REGISTRO) {
    return marcarSesion({ usuario: p.usuario, id: t.ID_REGISTRO, fecha: p.fecha, nota: textoLimpio_(p.nota) });
  }
  var lock = bloquear_(), s;
  try {
    var ahora = new Date();
    // Otra asesora pudo marcar otro número entretanto: se decide con la hoja releída dentro del candado.
    var frescos = leerSeguimientos_().filter(function (x) { return !anulado_(x); });
    var quedan = true;
    if (v.fila.TELEFONO) {
      var marca = { DNI: v.fila.DNI, RESULTADO: 'NÚMERO EQUIVOCADO', TELEFONO: v.fila.TELEFONO, FECHA_HORA: fechaHoraTexto_(ahora) };
      quedan = (telefonosPorDni(d.indicacionesTodas, d.contactos, frescos.concat([marca]))[v.fila.DNI] || []).length > 0 || !!t.USUARIO;
    }
    s = copia_(v.fila, { ID: 'SEG-' + ahora.getTime() + '-' + Math.floor(Math.random() * 1000), FECHA_HORA: fechaHoraTexto_(ahora),
      ACCION: accionPara(v.fila.RESULTADO, quedan) });
    anexarObjeto_('SEGUIMIENTOS', COLUMNAS_SEGUIMIENTOS, s);
    bitacora_(s.RESPONSABLE, 'RESULTADO', s.DNI + ' · ' + s.ESPECIALIDAD + ' · ' + s.RESULTADO + (s.REFERENCIA ? ' · ' + s.REFERENCIA : ''));
    d.seguimientos = frescos.concat([s]);
  } finally {
    soltar_(lock);
  }
  // Fuera del candado: la tarjeta recalculada en memoria, para que la app confirme el movimiento.
  d.seguimientosTodos = d.seguimientosTodos.concat([s]);
  derivar_(d);
  var clave = claveTarjeta(t), tab = armarTablero(d), nueva = null;
  Object.keys(tab.columnas).forEach(function (c) {
    tab.columnas[c].forEach(function (x) { if (x.CLAVE === clave && !nueva) nueva = x; });
  });
  return limpiarParaEnvio({ ok: true, seguimiento: s, tarjeta: nueva });
}

function anularResultado(p) {
  var d = datos_(), quien = exigirUsuario_(d.catalogos, p && p.usuario), motivo = exigirMotivo_(p), id = textoLimpio_(p.id);
  if (id.indexOf('SEG-') !== 0) throw new Error('Aquí solo se anulan resultados de seguimiento (SEG-…).');
  var lock = bloquear_();
  try {
    var error = validarAnulacionResultado(id, leerSeguimientos_());
    if (error) throw new Error(error);
    marcarAnulado_('SEGUIMIENTOS', id, motivo);
    bitacora_(quien, 'ANULAR RESULTADO', id + ' · ' + motivo);
    return { ok: true };
  } finally {
    soltar_(lock);
  }
}

function getTablero() {
  return limpiarParaEnvio(armarTablero(datos_()));
}
```

`limpiarParaEnvio(null)` devuelve `''`, y por eso la prueba espera `r.tarjeta === ''`.

**Para el menú.** En `src/Menu.gs`, `verificar`, después de la línea de `SEGUIMIENTOS`,
agregar:
```js
  if (sgV) {
    var ra = resumenAntiguos(leerSeguimientos_());
    lineas.push('ℹ SEGUIMIENTOS: ' + ra.nuevos + ' con resultado, ' + ra.hechos + ' «hecho» y ' + ra.descartes +
      ' descartes antiguos, ' + ra.fallecidos + ' fallecidos, ' + ra.anulados + ' anulados.');
  }
```

- [ ] **Step 7: Correr todo y ver que pasa**

Run: `cd /home/user/seguimientos && npm test 2>&1 | grep -E "^not ok|# (pass|fail)"`

Expected: `# fail 0`.

- [ ] **Step 8: Commit**

```bash
cd /home/user/seguimientos && git add -A src test package.json && git commit -q -m "registrarResultado, anularResultado y getTablero; datos_ sin anuladas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GegG7K4J2pd47s8MMaA85W"
```

---

### Task 7: Panel «¿Qué pasó?» en la bandeja actual

**Files:**
- Modify: `src/Index.html`:
  - `pintarPanel`, en las líneas 700-749;
  - `resolver`, en las líneas 763-817;
  - los clics de `#panel` y de `#lista`, en las líneas 819-835;
  - los atajos, en las líneas 837-857;
  - `avisar`, en las líneas 503-509;
  - el HTML de `#aviso`, en la línea 432;
  - el CSS;
  - el `DEMO`, desde la línea 1590.
- Test: `test/ui.test.js`

**Interfaces:**
- Consumes:
  - del servidor: `registrarResultado`, `anularResultado`, `anularAlta` y `anularSesion`,
    con las formas de la Tarea 6;
  - `bootstrap().resultados`, una línea que se agrega a `bootstrap` en `src/Codigo.gs`:
    `resultados: ORDEN_RESULTADOS,`.
- Produces: el panel nuevo.
  - **Estado de la app:** `E.paso` guarda el nombre del resultado elegido, o `''`.
    Reemplaza a `E.descartando` y `E.dandoAlta`.
  - **Nombres que se borran:** `#p-hecho`, `#p-descartar`, `#p-lohizo`, `#p-alta` y
    `[data-motivo]`.
  - **El botón rápido de la fila** sigue con la clase `.hecho`, pero su texto pasa a ser
    «No contestó».

- [ ] **Step 1: Ajustar las pruebas antiguas y escribir las nuevas** en `test/ui.test.js`

**Pruebas que se ajustan:**

| Prueba | Cambio |
|---|---|
| «sin elegir usuario no se puede marcar Hecho» | Sin cambios: el botón `.hecho` sigue |
| «Hecho quita la fila, suma en "hechos hoy"…» | Solo el título: «No contestó quita la fila…» |
| «atajos: Enter abre, ↓ cambia de paciente, H marca hecho…» | `H` pasa a ser `1`, y el título dice «1 marca no contestó» |
| «descartar desde el panel pide motivo…» | Se reemplaza por la prueba nueva de cierre de abajo |
| «bandeja: "Lo hizo" en un tratamiento en curso…» | `#p-lohizo` pasa a ser `[data-res="LO HIZO"]`, y después `#qp-guardar` |
| «bandeja: "Dar de alta" desde el panel…» | `#p-alta` pasa a ser `[data-res="ALTA MÉDICA"]`; `#p-alta-doctor` pasa a ser `#qp-doctor`; `#p-alta-ok` pasa a ser `#qp-guardar` |

**Antes de editar:** leer cada prueba y cambiar solo esos selectores.

**Pruebas nuevas:**
```js
test('¿Qué pasó?: los dos grupos; «Lo hizo» solo en hierro y procedimientos', async () => {
  const { navegador, pagina, errores } = await abrir();
  try {
    await tipo(pagina, 'REEVALUACION');
    await pagina.locator('#lista .fila').first().click();
    const sigue = await pagina.locator('.qp-sigue button').allTextContents();
    assert.deepEqual(sigue.map(s => s.replace(/\d$/, '')), ['No contestó', 'Lo pensará', 'Agendó cita']);
    assert.deepEqual(await pagina.locator('.qp-cierre button').allTextContents(),
      ['Alta médica', 'Número equivocado', 'Se atiende en otro lugar', 'Falleció', 'No desea continuar']);
    await tipo(pagina, 'HIERRO');
    await pagina.locator('#lista .fila').first().click();
    assert.equal(await pagina.locator('[data-res="LO HIZO"]').count(), 1);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('¿Qué pasó?: «Lo pensará» pide fecha, saca la fila y ofrece Deshacer, que la devuelve', async () => {
  const { navegador, pagina, errores } = await abrir();
  try {
    await pagina.selectOption('#usuario', 'MAGALY');
    await tipo(pagina, 'REEVALUACION');
    const antes = await filas(pagina);
    await pagina.locator('#lista .fila').first().click();
    await pagina.locator('[data-res="LO PENSARÁ"]').click();
    assert.equal(await pagina.locator('#qp-fecha').inputValue(), '2026-10-02', 'propone mañana');
    await pagina.locator('#qp-guardar').click();
    await pagina.waitForFunction(n => document.querySelectorAll('#lista .fila').length === n - 1, antes.length);
    assert.match(await pagina.locator('#aviso').textContent(), /Guardado/);
    await pagina.locator('#aviso [data-deshacer]').click();
    await pagina.waitForFunction(n => document.querySelectorAll('#lista .fila').length === n, antes.length);
    assert.deepEqual(await filas(pagina), antes);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('¿Qué pasó?: un cierre pide confirmación en el panel; «Falleció» avisa que cierra todo', async () => {
  const { navegador, pagina, errores } = await abrir();
  try {
    await pagina.selectOption('#usuario', 'MAGALY');
    await pagina.locator('#lista .fila').first().click();
    const nombre = (await pagina.locator('#panel h2').textContent()).trim();
    await pagina.locator('[data-res="FALLECIÓ"]').click();
    const conf = await pagina.locator('.qp-paso').textContent();
    assert.match(conf, /¿Cerrar el seguimiento de/);
    assert.match(conf, /Se cerrarán todos sus seguimientos/);
    assert.equal(await pagina.locator('#qp-guardar').textContent(), 'Cerrar el seguimiento');
    await pagina.locator('#qp-cancelar').click();
    assert.equal(await pagina.locator('.qp-paso').count(), 0);
    await pagina.locator('[data-res="SE ATIENDE EN OTRO LUGAR"]').click();
    await pagina.locator('#qp-guardar').click();
    await pagina.waitForFunction(n => ![...document.querySelectorAll('#lista .fila .nombre')].some(x => x.textContent === n), nombre);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('¿Qué pasó?: número equivocado con otro teléfono deja la fila y quita ese número', async () => {
  const { navegador, pagina, errores } = await abrir();
  try {
    await pagina.selectOption('#usuario', 'MAGALY');
    await tipo(pagina, 'REEVALUACION');
    await pagina.locator('.fila', { hasText: 'ROSA ELENA' }).first().click();
    await pagina.locator('[data-res="NÚMERO EQUIVOCADO"]').click();
    const tels = await pagina.locator('.qp-paso input[name="qp-tel"]').count();
    assert.ok(tels >= 2, 'el DEMO le da a Rosa dos teléfonos');
    await pagina.locator('.qp-paso input[name="qp-tel"]').first().check();
    assert.match(await pagina.locator('.qp-paso').textContent(), /Le queda el/);
    await pagina.locator('#qp-guardar').click();
    await pagina.waitForSelector('#aviso:not([hidden])');
    assert.equal(await pagina.locator('.fila', { hasText: 'ROSA ELENA' }).count() >= 1, true, 'sigue en la lista');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('¿Qué pasó?: si el servidor falla, la fila vuelve y no hay Deshacer', async () => {
  const { navegador, pagina } = await abrir();
  try {
    await pagina.selectOption('#usuario', 'MAGALY');
    await pagina.evaluate(() => { DEMO.registrarResultado = () => { throw new Error('sin conexión'); }; });
    const antes = await filas(pagina);
    await pagina.locator('.fila button.hecho').first().click();
    await pagina.waitForFunction(() => /No se guardó/.test(document.querySelector('#aviso').textContent));
    assert.deepEqual(await filas(pagina), antes);
    assert.equal(await pagina.locator('#aviso [data-deshacer]').count(), 0);
  } finally { await navegador.close(); }
});

test('atajos: 1 no contestó, 2 abre «lo pensará», X abre el grupo de cierre sin guardar', async () => {
  const { navegador, pagina } = await abrir();
  try {
    await pagina.selectOption('#usuario', 'MAGALY');
    await pagina.keyboard.press('ArrowDown');
    await pagina.keyboard.press('2');
    assert.equal(await pagina.locator('#qp-fecha').count(), 1);
    await pagina.keyboard.press('Escape');
    await pagina.keyboard.press('x');
    assert.equal(await pagina.locator('.qp-cierre.abierto').count(), 1);
    assert.equal(await pagina.locator('.qp-paso').count(), 0, 'X no guarda ningún cierre');
  } finally { await navegador.close(); }
});
```

**El objeto `DEMO`.** Es `const DEMO = (() => { … })()`, en la línea 1563. Un `const` de
nivel superior se ve desde `page.evaluate`, y `llamar` busca `DEMO[fn]` en cada llamada. Por
eso reemplazar `DEMO.registrarResultado` en una prueba funciona sin exponer nada.

**El segundo teléfono de Rosa.** La prueba de número equivocado necesita que Rosa tenga dos
teléfonos en el DEMO. Dárselos en la Tarea 7, `TELEFONOS: '987654321 / 912345678'` en su fila
de reevaluación.

**Si una prueba anterior cuenta los teléfonos de Rosa, ajustarla** a ese valor.

- [ ] **Step 2: Correr y ver que fallan**

Run: `cd /home/user/seguimientos && npm run test:ui 2>&1 | grep -E "^not ok|# (pass|fail)"`

Expected: FAIL. Fallan las pruebas nuevas y las de los selectores cambiados.

- [ ] **Step 3: Implementar**

`src/Codigo.gs`, `bootstrap`: agregar `resultados: ORDEN_RESULTADOS,` al objeto.

`src/Index.html`, el aviso con acción. La línea 432 pasa a ser:
```html
<div class="aviso" id="aviso" role="status" hidden><span id="aviso-texto"></span></div>
```

Y `avisar`:
```js
/** Aviso abajo. Con `accion` ({ texto, fn }) muestra un botón y dura 8 segundos. */
function avisar(texto, accion) {
  const a = $('#aviso');
  a.innerHTML = `<span id="aviso-texto">${esc(texto)}</span>${accion ? ` <button type="button" class="btn-texto aviso-accion" data-deshacer>${esc(accion.texto)}</button>` : ''}`;
  a.hidden = false;
  avisar.accion = accion || null;
  clearTimeout(avisar.t);
  avisar.t = setTimeout(() => { a.hidden = true; avisar.accion = null; }, accion ? 8000 : 3500);
}
$('#aviso').addEventListener('click', ev => {
  if (!ev.target.closest('[data-deshacer]') || !avisar.accion) return;
  const fn = avisar.accion.fn;
  avisar.accion = null;
  $('#aviso').hidden = true;
  fn();
});
```

CSS, junto a `.aviso`:
```css
.aviso-accion{color:var(--chp-on-toast);text-decoration:underline;margin-left:10px}
.qp{display:grid;gap:10px}
.qp-grupo{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.qp-grupo>span{width:100%;font-size:12px;color:var(--chp-muted)}
.qp-cierre.abierto>span{color:var(--chp-ink);font-weight:600}
.qp-paso{display:grid;gap:8px;padding:12px;border:1px solid var(--chp-line);border-radius:2px}
.qp-paso.cierre{border-color:var(--chp-accent)}
```

`--chp-muted`, `--chp-line` y `--chp-accent` ya existen; `--chp-bad` **no existe**. **Nunca un
color a mano.**

`pintarPanel`. Reemplazar desde `${t.ID_REGISTRO ? \`<div class="p-sesion">` hasta el cierre
del bloque `${!esIndicacion(t) ? \`<button type="button" class="btn-texto" id="p-alta">…`
inclusive, es decir, todo lo que había entre el bloque de `p-prev` y `p-ficha`, por:
```js
    <textarea id="nota" placeholder="Nota (opcional)"></textarea>
    ${quePaso(t)}
```

Funciones nuevas, junto a `pintarPanel`:
```js
const ETIQUETA_RES = { 'NO CONTESTÓ': 'No contestó', 'LO PENSARÁ': 'Lo pensará', 'AGENDÓ CITA': 'Agendó cita', 'LO HIZO': 'Lo hizo',
  'ALTA MÉDICA': 'Alta médica', 'NÚMERO EQUIVOCADO': 'Número equivocado', 'SE ATIENDE EN OTRO LUGAR': 'Se atiende en otro lugar',
  'FALLECIÓ': 'Falleció', 'NO DESEA CONTINUAR': 'No desea continuar' };
const SIGUE = ['NO CONTESTÓ', 'LO PENSARÁ', 'AGENDÓ CITA', 'LO HIZO'];
const CIERRE = ['ALTA MÉDICA', 'NÚMERO EQUIVOCADO', 'SE ATIENDE EN OTRO LUGAR', 'FALLECIÓ', 'NO DESEA CONTINUAR'];
const masDias = (n) => { const d = new Date(hoy() + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

function telsDe(t) { return String(t.TELEFONOS || '').split(' / ').filter(Boolean); }

function quePaso(t) {
  const sigue = SIGUE.filter(r => r !== 'LO HIZO' || esIndicacion(t));
  return `<div class="qp"><small>¿Qué pasó?</small>
    <div class="qp-grupo qp-sigue"><span>Sigue en seguimiento</span>${sigue.map((r, i) =>
      `<button type="button" class="btn-linea" data-res="${r}">${ETIQUETA_RES[r]}<kbd>${i + 1}</kbd></button>`).join('')}</div>
    <div class="qp-grupo qp-cierre${E.cierreAbierto || CIERRE.includes(E.paso) ? ' abierto' : ''}"><span>Cierra el seguimiento <kbd>X</kbd></span>${CIERRE.map(r =>
      `<button type="button" class="btn-linea" data-res="${r}">${ETIQUETA_RES[r]}</button>`).join('')}</div>
    ${E.paso ? pasoHtml(t, E.paso) : ''}</div>`;
}

function pasoHtml(t, r) {
  const nombre = esc(t.NOMBRE);
  const para = esIndicacion(t) ? esc(queCotizo(t)) : esc(especialidadDe(t) || t.ESPECIALIDAD);
  const tels = telsDe(t);
  let campos = '', aviso = '', cierre = CIERRE.includes(r);
  if (r === 'LO PENSARÁ') campos = `<label>Volver a llamar el <input type="date" class="entrada" id="qp-fecha" value="${masDias(1)}" min="${masDias(1)}" max="${masDias(90)}"></label>`;
  if (r === 'AGENDÓ CITA') campos = `<label>Fecha de la cita <input type="date" class="entrada" id="qp-fecha" value="${t.PROXIMA_AGENDADA || hoy()}" min="${hoy()}" max="${masDias(180)}"></label>`;
  if (r === 'LO HIZO') campos = `<label>${t.ID_REGISTRO && t.SESIONES > 1 ? `Sesión ${t.HECHAS + 1} de ${t.SESIONES}, el` : 'Lo hizo el'} <input type="date" class="entrada" id="qp-fecha" value="${hoy()}" max="${hoy()}"></label>`;
  if (r === 'ALTA MÉDICA') campos = `<select id="qp-doctor" class="sel" aria-label="Doctor que da el alta">${opcionesDoctor(t.MEDICO_ULTIMO)}</select>
    ${esIndicacion(t) ? '' : `<input type="date" class="entrada" id="qp-fecha" value="${hoy()}" max="${hoy()}" aria-label="Fecha del alta">`}`;
  if (r === 'NÚMERO EQUIVOCADO') {
    campos = tels.map((n, i) => `<label><input type="radio" name="qp-tel" value="${esc(n)}"${tels.length === 1 && i === 0 ? ' checked' : ''}> ${esc(n)}</label>`).join('') || '<p class="muted">No tiene teléfonos para marcar.</p>';
    const elegido = E.telElegido || (tels.length === 1 ? tels[0] : '');
    const quedan = tels.filter(n => n !== elegido);
    aviso = !elegido ? 'Elija el número equivocado.' : quedan.length ? `Le queda el ${esc(quedan[0])}: el seguimiento sigue.` : t.USUARIO ? `Le queda el usuario ${esc(t.USUARIO)}: el seguimiento sigue.` : 'No le queda otro contacto: se cerrará el seguimiento.';
    cierre = !!elegido && !quedan.length && !t.USUARIO;
  }
  if (r === 'NO DESEA CONTINUAR') campos = '<input class="entrada" id="qp-motivo" placeholder="Motivo (obligatorio)">';
  const pregunta = cierre ? `<p><b>¿Cerrar el seguimiento de ${nombre} en ${para}?</b> Motivo: ${esc(ETIQUETA_RES[r].toLowerCase())}.${r === 'FALLECIÓ' ? ' Se cerrarán todos sus seguimientos.' : ''}</p>` : '';
  return `<div class="qp-paso${cierre ? ' cierre' : ''}">${pregunta}${campos}${aviso ? `<p class="muted" id="qp-aviso">${aviso}</p>` : ''}
    <div><button type="button" class="btn-marca" id="qp-guardar">${cierre ? 'Cerrar el seguimiento' : 'Guardar'}</button>
    <button type="button" class="btn-texto" id="qp-cancelar">Cancelar</button></div></div>`;
}
```

**Nombres que ya existen en `Index.html`, en las líneas 588-593:** `queCotizo`,
`especialidadDe`, `esIndicacion` y `opcionesDoctor`. `frase` solo existe dentro del `DEMO`, por
eso el nombre se muestra tal cual.

Reemplazar `resolver` por `guardarResultado`, que hace lo mismo que el anterior, con el
resultado y su deshacer:
```js
/**
 * Guarda lo que pasó. La fila sale de la lista al instante (salvo un número equivocado que
 * deja otro contacto) y la selección pasa al siguiente. Si el servidor falla, vuelve a su sitio.
 * Si el servidor la deja en Por contactar, también vuelve.
 */
async function guardarResultado(k, resultado, extra = {}) {
  if (!exigirUsuario()) return;
  const t = pacienteDe(k);
  if (!t) return;
  const nota = E.abierto === k && $('#nota') ? $('#nota').value : '';
  const tels = telsDe(t);
  const sigueEnLista = resultado === 'NÚMERO EQUIVOCADO' && (tels.some(n => n !== extra.telefono) || !!t.USUARIO);
  const claves = visibles().map(clave);
  const i = claves.indexOf(k);
  const siguiente = claves[i + 1] || claves[i - 1] || '';
  const pos = E.bandeja.tarjetas.indexOf(t);
  const c = E.bandeja.contador;
  const telsAntes = t.TELEFONOS;
  const sumaHecho = SIGUE.includes(resultado);

  if (sigueEnLista) t.TELEFONOS = tels.filter(n => n !== extra.telefono).join(' / ');
  else {
    E.bandeja.tarjetas.splice(pos, 1);
    c.porAtender--;
    if (E.sel === k) E.sel = siguiente;
    if (E.abierto === k) E.abierto = siguiente;
  }
  if (sumaHecho) c.hechosHoy++;
  E.paso = ''; E.cierreAbierto = false; E.telElegido = '';
  E.kpi = null; E.resumen = null;
  pintarBandeja();

  try {
    const r = await llamar('registrarResultado', { usuario: usuario(), dni: t.DNI, especialidad: t.ESPECIALIDAD,
      referencia: t.ID_REGISTRO || '', resultado, nota, fecha: extra.fecha || '', telefono: extra.telefono || '',
      motivo: extra.motivo || '', doctor: extra.doctor || '' });
    if (!sigueEnLista && r.tarjeta && r.tarjeta.COLUMNA === 'POR_CONTACTAR') {
      E.bandeja.tarjetas.splice(pos, 0, t);
      c.porAtender++;
      pintarBandeja();
    }
    const deshacer = r.seguimiento ? ['anularResultado', r.seguimiento.ID] : r.alta ? ['anularAlta', r.alta.ID] : r.sesion ? ['anularSesion', r.sesion.ID] : null;
    avisar(`Guardado: ${t.NOMBRE} · ${ETIQUETA_RES[resultado].toLowerCase()}`, deshacer && { texto: 'Deshacer', fn: async () => {
      try {
        await llamar(deshacer[0], { usuario: usuario(), id: deshacer[1], motivo: 'Deshecho al momento' });
        avisar('Deshecho: ' + t.NOMBRE);
      } catch (e) { avisar('No se deshizo: ' + e.message); }
      E.kpi = null; E.resumen = null;
      cargarBandeja();
    } });
  } catch (e) {
    if (sigueEnLista) t.TELEFONOS = telsAntes;
    else { E.bandeja.tarjetas.splice(pos, 0, t); c.porAtender++; }
    if (sumaHecho) c.hechosHoy--;
    avisar('No se guardó: ' + e.message);
    pintarBandeja();
  }
}

/** Lee el paso abierto y guarda; lo que falte lo avisa sin llamar al servidor. */
function confirmarPaso() {
  const r = E.paso, extra = {};
  if ($('#qp-fecha')) extra.fecha = $('#qp-fecha').value;
  if ($('#qp-doctor')) { extra.doctor = $('#qp-doctor').value; if (!extra.doctor) { avisar('Elija el doctor que da el alta.'); return; } }
  if (r === 'NÚMERO EQUIVOCADO') {
    const sel = document.querySelector('input[name="qp-tel"]:checked');
    if (!sel) { avisar('Elija cuál teléfono está equivocado.'); return; }
    extra.telefono = sel.value;
  }
  if ($('#qp-motivo')) { extra.motivo = $('#qp-motivo').value.trim(); if (!extra.motivo) { avisar('Escriba el motivo.'); return; } }
  guardarResultado(E.abierto, r, extra);
}

/** Elegir un resultado: «No contestó» guarda directo; los demás abren su paso. */
function elegirResultado(k, r) {
  if (r === 'NO CONTESTÓ') { guardarResultado(k, r); return; }
  if (E.abierto !== k) { E.sel = k; E.abierto = k; }
  E.paso = r; E.telElegido = '';
  pintarBandeja();
  const f = $('#qp-fecha') || $('#qp-motivo');
  if (f) f.focus();
}
```

Clics:
- **`#lista`:** cambiar la línea de `.hecho` por
  `if (ev.target.closest('.hecho')) { ev.stopPropagation(); E.sel = fila.dataset.k; guardarResultado(fila.dataset.k, 'NO CONTESTÓ'); return; }`.
- **El texto del botón `.hecho` en `filaHtml`:** pasa a ser «No contestó».
- **`#panel`:** reemplazar las líneas de `p-hecho`, `p-descartar`, `data-motivo`, `p-lohizo`,
  `p-alta` y `p-alta-ok` por:

```js
  if (b.dataset.res) { elegirResultado(E.abierto, b.dataset.res); return; }
  if (b.id === 'qp-guardar') { confirmarPaso(); return; }
  if (b.id === 'qp-cancelar') { E.paso = ''; pintarPanel(); return; }
```

**Los dos grupos están siempre a la vista.** Ocultar los cierres tras un clic más los hace
difíciles de encontrar. `X` solo resalta el grupo de cierre, con la clase `abierto`, y no
guarda nada.

Se agrega una escucha para el teléfono elegido:
```js
$('#panel').addEventListener('change', ev => {
  if (ev.target.name === 'qp-tel') { E.telElegido = ev.target.value; pintarPanel(); }
});
```

**Pintar después de elegir un teléfono.** Al repintar, el `checked` se pierde. Por eso, en
`pasoHtml`, el radio queda marcado si coincide con el elegido:
- se usa `${n === E.telElegido || (tels.length === 1 && i === 0) ? ' checked' : ''}`;
- se reemplaza la expresión anterior de `checked`.

**Abrir, cerrar y moverse.** En `abrir`, `cerrar` y `mover`, reemplazar
`E.descartando = false; E.dandoAlta = false;` por
`E.paso = ''; E.cierreAbierto = false; E.telElegido = '';`.

**Atajos.** Reemplazar las líneas de `h` y `d` por:
```js
  if (['1', '2', '3', '4'].includes(tecla)) {
    const t = pacienteDe(E.sel);
    const r = SIGUE.filter(x => x !== 'LO HIZO' || (t && esIndicacion(t)))[Number(tecla) - 1];
    if (r) elegirResultado(E.sel, r);
    return;
  }
  if (tecla === 'x') { E.abierto = E.sel; E.cierreAbierto = true; E.paso = ''; pintarBandeja(); return; }
```

En el bloque de `Escape`, si hay un paso abierto, cerrar primero el paso:
`if (tecla === 'Escape') { if (E.paso) { E.paso = ''; pintarPanel(); } else if (E.abierto) cerrar(); return; }`.

**El `DEMO`.** Se reemplazan `registrar`, `marcarSeguimiento` y `descartar` por:
```js
  function registrarResultado(x) {
    exigir(x, false);
    const pac = pacientes.concat(pendientes).find(y => y.DNI === x.dni && y.ESPECIALIDAD === x.especialidad &&
      (x.referencia ? y.ID_REGISTRO === x.referencia : !y.ID_REGISTRO));
    if (!pac) throw new Error('Ese paciente no está en la lista. Recargue la página.');
    if (x.resultado === 'LO HIZO' && pac.ID_REGISTRO) return api.marcarSesion({ usuario: x.usuario, id: pac.ID_REGISTRO, fecha: x.fecha });
    const s = { ID: 'SEG-' + (seguimientos.length + 1), FECHA_HORA: hoy + ' 10:00', DNI: x.dni, ESPECIALIDAD: x.especialidad, RESPONSABLE: x.usuario,
      ACCION: ['NO CONTESTÓ', 'LO PENSARÁ', 'AGENDÓ CITA', 'LO HIZO'].includes(x.resultado) ? 'HECHO' : x.resultado === 'NÚMERO EQUIVOCADO' ? 'TELEFONO' : 'DESCARTADO',
      MOTIVO: '', NOTA: x.nota || '', RESULTADO: x.resultado, FECHA_PROXIMA: x.fecha || '', TELEFONO: x.telefono || '', ANULADO: '', antes: pac.ESTADO, pac };
    seguimientos.push(s);
    if (x.resultado === 'NÚMERO EQUIVOCADO') pac.TELEFONOS = String(pac.TELEFONOS).split(' / ').filter(n => n !== x.telefono).join(' / ');
    else pac.ESTADO = SIGUE.includes(x.resultado) ? 'AGENDADO' : 'CERRADO';
    return { ok: true, seguimiento: { ID: s.ID }, tarjeta: x.resultado === 'NÚMERO EQUIVOCADO' && pac.TELEFONOS ? { COLUMNA: 'POR_CONTACTAR' } : null };
  }
```

En el objeto devuelto por el `DEMO`, agregar:
```js
    registrarResultado,
    anularResultado: x => {
      exigir(x, false);
      const s = seguimientos.find(y => y.ID === x.id);
      if (!s) throw new Error('No encontré ' + x.id + '.');
      s.ANULADO = 'SÍ';
      s.MOTIVO_ANULACION = x.motivo;
      if (s.pac) s.pac.ESTADO = s.antes;
      return { ok: true };
    },
    marcarSeguimiento: x => registrarResultado(Object.assign({}, x, { resultado: 'NO CONTESTÓ' })),
    descartar: x => registrarResultado(Object.assign({}, x, { resultado: 'NO DESEA CONTINUAR' })),
```

**La forma del `DEMO`.** El `DEMO` es una IIFE que devuelve un objeto literal sin nombre.
`registrarResultado` lo necesita para llamar a `marcarSesion`, así que el `return { … };` final
pasa a ser `const api = { … }; return api;`. Como `registrarResultado` solo se ejecuta después,
`api` ya existe cuando se usa.

**Lo que no puede ir en el `DEMO`.** `pac` y `antes` son campos internos del `DEMO`: nunca
salen en `getPaciente`, porque `seguimientos.filter(...)` los incluiría. Por eso, en
`getPaciente` del `DEMO`, mapear quitando esos dos campos con
`.map(({ pac, antes, ...s }) => s)`.

**`bootstrap` del `DEMO`.** Agregar
`resultados: ['NO CONTESTÓ', 'LO PENSARÁ', 'AGENDÓ CITA', 'LO HIZO', 'ALTA MÉDICA', 'NÚMERO EQUIVOCADO', 'SE ATIENDE EN OTRO LUGAR', 'FALLECIÓ', 'NO DESEA CONTINUAR']`.

**El segundo teléfono de Rosa.** En la línea 1585, la fila de reevaluación de Rosa, el cuarto
argumento de `p(…)` pasa de `'987654321'` a `'987654321 / 912345678'`.

- [ ] **Step 4: Correr las pruebas de interfaz y las de lógica**

Run: `cd /home/user/seguimientos && npm run test:ui 2>&1 | grep -E "^not ok|# (pass|fail)"; npm test 2>&1 | grep -E "# fail"`

Expected: `# fail 0` en las dos. Debe pasar también «no hay colores escritos a mano fuera de
la paleta».

- [ ] **Step 5: Mirar el panel**

Hacer una captura de cada paso con Playwright y revisarla a ojo:
- el panel con los dos grupos;
- el paso de «Lo pensará»;
- la confirmación de «Falleció»;
- el número equivocado;
- el aviso con «Deshacer»;
- celular, a 390 px.

Pantallas: 1440×900 y 390×844.

**Qué revisar:**
- **en computadora:** nada se corta y la nota sigue arriba de «¿Qué pasó?»;
- **en celular:** no hay scroll horizontal.

Guardar las capturas en el scratchpad. **No van al repositorio.**

- [ ] **Step 6: Commit**

```bash
cd /home/user/seguimientos && git add src test && git commit -q -m "Panel «¿Qué pasó?» en la bandeja, con Deshacer y atajos 1 a 4 y X

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GegG7K4J2pd47s8MMaA85W"
```

---

### Task 8: Historia en la ficha y aviso de fallecido en Registro

**Files:**
- Modify: `src/Index.html`:
  - el bloque `seguimientos` de `pintarFicha`, cerca de la línea 1133;
  - los clics de `#ficha`;
  - `FUNCION_ANULAR`;
  - `NOMBRE_ESTADO`;
  - la búsqueda de paciente en Registro;
  - el `DEMO`, en su `getPaciente` y en `buscarPacienteRegistro`.
- Test: `test/ui.test.js`

**Interfaces:**
- Consumes: de `getPaciente`, `seguimientos` (con `ANULADO`, `RESULTADO`, `FECHA_PROXIMA`,
  `TELEFONO`), `fallecido` y `telefonosDescartados`. De `buscarPacienteRegistro`,
  `fallecido`.
- Produces: nada que usen otras tareas.

- [ ] **Step 1: Escribir las pruebas que fallan**

```js
test('ficha: la historia dice qué pasó, tacha lo anulado y deja anular el último', async () => {
  const { navegador, pagina, errores } = await abrir();
  try {
    await pagina.selectOption('#usuario', 'MAGALY');
    await tipo(pagina, 'REEVALUACION');
    await pagina.locator('.fila', { hasText: 'ROSA ELENA' }).first().click();
    await pagina.locator('[data-res="LO PENSARÁ"]').click();
    await pagina.locator('#qp-guardar').click();
    await pagina.waitForSelector('#aviso:not([hidden])');
    await pagina.evaluate(() => abrirFicha('40111222'));
    await pagina.waitForSelector('.historia li');
    const linea = await pagina.locator('.historia li').last().textContent();
    assert.match(linea, /MAGALY: lo pensará · llamar el 02\/10/);
    await pagina.locator('.historia [data-anular-seg]').last().click();
    await pagina.fill('#g-motivo', 'me equivoqué');
    await pagina.locator('[data-confirmar-anular]').click();
    await pagina.waitForSelector('.historia li.anulado');
    assert.match(await pagina.locator('.historia li.anulado').textContent(), /anulado: me equivoqué/);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('registro: un paciente fallecido muestra el aviso pero deja registrar', async () => {
  const { navegador, pagina } = await abrir();
  try {
    await pagina.evaluate(() => { DEMO.marcarFallecido('40111222'); });
    await pagina.locator('[data-vista="registro"]').click();
    await pagina.fill('#g-dni', '40111222');
    await pagina.waitForSelector('.g-fallecido');
    assert.match(await pagina.locator('.g-fallecido').textContent(), /figura como fallecido el \d\d\/\d\d/);
    assert.equal(await pagina.locator('#g-guardar').isDisabled(), false);
  } finally { await navegador.close(); }
});
```

Los selectores ya existen en `Index.html`:
- `[data-vista="registro"]`, en la línea 335;
- `#g-dni`, en la línea 386;
- `#g-guardar`, en la línea 412.

- [ ] **Step 2: Correr y ver que fallan**

Run: `cd /home/user/seguimientos && npm run test:ui 2>&1 | grep -E "^not ok|# (pass|fail)"`

Expected: FAIL. Fallan las dos pruebas nuevas.

- [ ] **Step 3: Implementar**

En `pintarFicha`, reemplazar la tabla de `seguimientos` por una línea de tiempo:
```js
  const textoRes = s => {
    const r = s.RESULTADO || (s.ACCION === 'HECHO' ? 'SEGUIMIENTO HECHO' : s.ACCION === 'DESCARTADO' ? 'DESCARTADO' : s.ACCION);
    const f = fechaCorta(s.FECHA_PROXIMA).slice(0, 5);
    return ({ 'LO PENSARÁ': `lo pensará · llamar el ${f}`, 'AGENDÓ CITA': `agendó para el ${f}`, 'LO HIZO': `lo hizo el ${f}`,
      'NÚMERO EQUIVOCADO': `número equivocado: ${esc(s.TELEFONO)}`, 'DESCARTADO': `descartado${s.MOTIVO ? ': ' + esc(s.MOTIVO.toLowerCase()) : ''}`,
      'SEGUIMIENTO HECHO': 'seguimiento hecho' })[r] || esc(String(r).toLowerCase());
  };
  const ultimoDe = {};
  p.seguimientos.filter(s => s.ANULADO !== 'SÍ').forEach(s => { ultimoDe[s.DNI + '|' + s.ESPECIALIDAD + '|' + (s.REFERENCIA || '')] = s.ID; });
  const seguimientos = p.seguimientos.length
    ? `<ol class="historia">${p.seguimientos.slice().sort((a, b) => a.FECHA_HORA < b.FECHA_HORA ? -1 : 1).map(s => {
        const anulado = s.ANULADO === 'SÍ';
        const puede = !anulado && String(s.ID).startsWith('SEG-') && (s.RESULTADO === 'FALLECIÓ' || ultimoDe[s.DNI + '|' + s.ESPECIALIDAD + '|' + (s.REFERENCIA || '')] === s.ID);
        return `<li class="${anulado ? 'anulado' : ''}"><b>${fechaCorta(s.FECHA_HORA).slice(0, 5)} ${esc(s.RESPONSABLE)}:</b> ${textoRes(s)}
          <span class="muted">· ${esc(PARA[norm(s.ESPECIALIDAD)] || 'Reevaluación · ' + s.ESPECIALIDAD)}${s.NOTA ? ' · ' + esc(s.NOTA) : ''}${anulado ? ' · anulado: ' + esc(s.MOTIVO_ANULACION) : ''}</span>
          ${puede ? `<button type="button" class="btn-texto" data-anular-seg="${esc(s.ID)}">Anular</button>` : ''}</li>`;
      }).join('')}</ol>`
    : '<p class="muted">Todavía no hay seguimientos.</p>';
```

En la cabecera de la ficha, después del DNI:
```js
${p.fallecido ? `<p class="hace">Figura como fallecido el ${fechaCorta(p.fallecido.fecha)} (${esc(p.fallecido.quien)}).</p>` : ''}
${(p.telefonosDescartados || []).length ? `<p class="muted">Números equivocados: ${p.telefonosDescartados.map(n => `<s>${esc(n)}</s>`).join(', ')}</p>` : ''}
```

**Anular un seguimiento.** En `FUNCION_ANULAR`, agregar `seguimiento: 'anularResultado'`. En
los clics de `#ficha`, junto a `data-anular-alta`, agregar:
```js
  const ag = t.closest('[data-anular-seg]');
  if (ag) { pedirMotivo(ag.closest('li'), 'seguimiento', ag.dataset.anularSeg); return; }
```

**CSS:**
```css
.historia{list-style:none;padding:0;display:grid;gap:6px}
.historia li.anulado{text-decoration:line-through;color:var(--chp-muted)}
```
Si `--chp-muted` no existe, usar el mismo token que se eligió en la Tarea 7.

**`NOMBRE_ESTADO`.** Agregar:
```js
'CERRADO': 'Seguimiento cerrado', 'FALLECIDO': 'Fallecido', 'AGENDADO': 'Agendado o por volver a llamar'
```
Dejar `'CONTACTADO'` y `'DESCARTADO'` tal como están: ya no aparecen, pero no estorban.

**El aviso de fallecido en Registro.** En la función que pinta el resultado de
`buscarPacienteRegistro`, agregar al principio, tanto si el paciente tiene consultas como si
no:
```js
  const aviso = r.fallecido ? `<p class="g-fallecido hace">Este paciente figura como fallecido el ${fechaCorta(r.fallecido.fecha)} (${esc(r.fallecido.quien)}). Si es un error, anúlelo desde su ficha.</p>` : '';
```
Ese texto se inserta arriba de lo que ya muestra. **Antes de escribir:** localizar esa función
con `grep -n "buscarPacienteRegistro" src/Index.html`.

**El `DEMO`:**
- **`getPaciente`** devuelve
  `fallecido: muertos[dni] || null` y
  `telefonosDescartados: seguimientos.filter(s => s.DNI === dni && s.RESULTADO === 'NÚMERO EQUIVOCADO' && s.ANULADO !== 'SÍ').map(s => s.TELEFONO)`.
- **`buscarPacienteRegistro`** devuelve `fallecido: muertos[dni] || null`.
- **`muertos`** es un objeto nuevo, `const muertos = {};`, dentro de la IIFE. Se expone con
  `marcarFallecido: dni => { muertos[dni] = { fecha: hoy, quien: 'RACHEL' }; }`.

- [ ] **Step 4: Correr y ver que pasan**

Run: `cd /home/user/seguimientos && npm run test:ui 2>&1 | grep -E "^not ok|# (pass|fail)"; npm test 2>&1 | grep -E "# fail"`

Expected: `# fail 0` las dos veces.

- [ ] **Step 5: Commit**

```bash
cd /home/user/seguimientos && git add src test && git commit -q -m "Ficha: historia de resultados con anular; aviso de fallecido en Registro

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GegG7K4J2pd47s8MMaA85W"
```

---

### Task 9: Documentación, revisión final y push

**Files:**
- Modify: `CLAUDE.md` (del repositorio `seguimientos`)
- Modify: `docs/superpowers/specs/2026-10-06-que-paso-y-tablero-design.md`. Solo si algo se
  implementó distinto; en ese caso, anotarlo en §9.

- [ ] **Step 1: `CLAUDE.md`**

Agregar a la lista de nombres públicos `registrarResultado`, `anularResultado` y
`getTablero`. Agregar una sección con estas reglas:

> **«¿Qué pasó?» (Etapa 1).**
> - La lista de resultados vive en `RESULTADOS` (`src/Resultados.gs`), no en `CATALOGOS`.
> - Cada fila de `SEGUIMIENTOS` lleva `RESULTADO`, y además `ACCION` (`HECHO`, `TELEFONO` o
>   `DESCARTADO`), para que las cifras antiguas no cambien.
> - Las filas antiguas, sin `RESULTADO`, se leen con `resultadoDe`; **no se reescriben**.
> - Solo «No contestó» cuenta para el cierre automático (`MAX_SEGUIMIENTOS` seguidos, más la
>   espera).
> - «Número equivocado» marca el número y no cierra mientras quede otro contacto.
> - «Falleció» vale para todo el paciente.
> - Las filas anuladas (`ANULADO = SÍ`) no cuentan en ninguna cifra; `datos_` las filtra.
> - Tras publicar, usar «Preparar hojas», que agrega 5 columnas a `SEGUIMIENTOS` y
>   `GRACIA_AGENDA_DIAS` a `REGLAS`, y después «Verificar».

- [ ] **Step 2: Revisión del diff completo**

Run: `cd /home/user/seguimientos && git diff --stat HEAD~8 && npm test 2>&1 | grep -E "# (pass|fail)" && npm run test:ui 2>&1 | grep -E "# (pass|fail)"`

Releer el diff buscando tres cosas:
- un `CONTACTADO` o `DESCARTADO` que quedó como estado en el código. Como texto de `ACCION`
  o de `NOMBRE_ESTADO` está bien;
- algún `releaseLock()` sin `soltar_`;
- algún color escrito a mano.

- [ ] **Step 3: Commit y push**

```bash
cd /home/user/seguimientos && git add -A && git commit -q -m "CLAUDE.md: reglas de «¿Qué pasó?»

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GegG7K4J2pd47s8MMaA85W" && git push -q origin HEAD:claude/compassionate-lovelace-3q6rh3 HEAD:main
```

- [ ] **Step 4: Instrucciones para el usuario** (en el mensaje final, no en el repositorio)

1. `git pull`.
2. `npm run actualizar`.
3. En el Sheets, «Preparar hojas» y luego «Verificar». Debe decir:
   - «SEGUIMIENTOS tiene todas sus columnas»;
   - y la línea ℹ con los conteos.
4. Probar en la plataforma con un paciente: «Lo pensará», «Deshacer».
