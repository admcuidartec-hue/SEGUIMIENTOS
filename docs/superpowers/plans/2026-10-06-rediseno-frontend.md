# Rediseño de la interfaz (Claude Design) · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar `src/Index.html` por el diseño de Claude Design, con cuatro pantallas: Tablero, Registro,
Pacientes e Indicadores. Todo queda conectado al servidor real, sin perder ninguna función de la app actual.

**Architecture:** Primero se hacen los agregados pequeños al servidor (S1 a S10), cada uno con su prueba en Node.
Después se reconstruye la interfaz:

- se parte de `docs/diseno/handoff-etapa1/referencia/Index.html`, que manda en lo visual;
- una capa de adaptadores traduce las formas reales del servidor, según `MAPEO-SERVIDOR.md`, que manda en los datos;
- el `DEMO` se reescribe con las formas reales;
- las pruebas de interfaz se reescriben pantalla por pantalla.

**Tech Stack:**

| Pieza | Qué es |
|---|---|
| Servidor | Google Apps Script V8, HtmlService |
| Interfaz | un solo archivo HTML, CSS y JS, sin compilar |
| Recursos externos | Geist y Geist Mono desde Google Fonts; Phosphor 2.1.1 desde unpkg |
| Pruebas | `node --test` con `vm`; Playwright sobre el modo `DEMO` |

**Spec:** `docs/superpowers/specs/2026-10-06-rediseno-frontend-design.md`. Depende de:

- `docs/diseno/handoff-etapa1/MAPEO-SERVIDOR.md`, que es la autoridad campo por campo;
- `docs/diseno/handoff-etapa1/README.md`, para medidas, movimiento, tokens y redacción;
- la especificación de la Etapa 1, `2026-10-06-que-paso-y-tablero-design.md`.

## Global Constraints

**Idioma y redacción**

- Todo el texto visible va en español.
- No se usan rayas largas (—) en el texto nuevo.
- Palabras prohibidas en pantalla: «cohorte», «días de atraso», «lead» y «KPI».
- «Sin lead en el CRM» se muestra como «Sin registro en el CRM».

**Restricciones del archivo**

- Es un solo `src/Index.html`, sin compilar.
- Solo se cargan recursos de Google Fonts (Geist, Geist Mono) y de unpkg (`@phosphor-icons/web@2.1.1`).
- Va con `<base target="_top">`, y el menú cambia de pantalla por código, nunca con `href="#…"`.

**Colores**

- Los colores solo existen en `:root{}` y en `html[data-modo="oscuro"]{}`.
- La prueba «no hay colores escritos a mano fuera de la paleta» debe pasar.
- Los tokens son los del README §9, con el selector oscuro renombrado.

**Preferencias**

- Se guardan en `localStorage`, en `seg.usuario`, `seg.modo` y `seg.tipo`.
- El modo oscuro sigue al sistema la primera vez.

**Identidad**

- No hay usuario por omisión.
- Ningún guardado sale sin «¿Quién es usted?» elegido.
- El usuario que se envía es el texto exacto del catálogo, por ejemplo `'MAGALY'`.

**Puente con el servidor**

- Se usa `llamar(fn, ...args)` de la app actual:
  - en Apps Script, con `google.script.run`;
  - fuera, con `DEMO[fn]`, que devuelve copias JSON.
- Los nulos llegan como `''`, así que se comprueban como valor falso.

**Formas de los datos**

- Las de `MAPEO-SERVIDOR.md`.
- La clave de una tarjeta es `CLAVE` (texto).
- Los teléfonos se envían sin espacios.
- Las fechas van en ISO `yyyy-mm-dd`; `hoy` sale de `bootstrap().hoy`.

**Reglas de negocio**

- Son las de la especificación de la Etapa 1.
- Las respeta el servidor; el cliente no las reinventa.
- Las etiquetas de las tarjetas salen de `ETIQUETA`.

**Movimiento**

- Lo del README §7.
- Solo se animan `transform` y `opacity`.
- Lo que se dispara con el teclado no se anima.
- `prefers-reduced-motion` reduce las duraciones a casi nada.

**Diseño adaptable**

- En celular de 390 px no hay scroll horizontal.
- Se prueba a 1366, 1440, 1920 y 390 px.

**Servidor**

- No se renombra ningún nombre público.
- Toda escritura se hace con `bloquear_()` y termina en `soltar_(lock)`.
- Las respuestas pasan por `limpiarParaEnvio`.

**Datos del `DEMO`:** siempre inventados.

**Commits**

- Cada commit termina con:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01GegG7K4J2pd47s8MMaA85W
  ```
- Se agregan los archivos por ruta, nunca con `git add -A`.
- No se hace push: lo hace el controlador.

**Prohibido:** `npm audit fix --force`, `clasp deploy` sin `--deploymentId` y `playwright install`.

## Review Focus

1. **Guardar con una tarjeta vieja.**
   - Riesgo: la asesora guarda «¿Qué pasó?» sobre una tarjeta que otra asesora acaba de cerrar.
   - Lo esperado: un aviso claro («Ese paciente no está en la lista. Recargue la página.»), la tarjeta vuelve a su
     sitio y el tablero se recarga.
   - Prueba: Tarea 6.
2. **Cambiar de usuario a mitad del día.**
   - Lo esperado: la barra «Hoy: N de 15» muestra lo de la nueva persona, sin recargar el tablero.
   - Prueba: Tarea 5.
3. **Arrancar sin «¿Quién es usted?» elegido** (primera vez, o con `seg.usuario` de un nombre que ya no está en el
   catálogo).
   - Lo esperado: el selector queda vacío y todo guardado pide elegir.
   - Prueba: Tarea 4.
4. **Celular de 390 px con nombres largos y con el panel abierto.**
   - Lo esperado: sin scroll horizontal y con «‹ Volver» visible.
   - Prueba: Tarea 12.
5. **Tablero vacío o con error de carga.**
   - Lo esperado: se ven el estado vacío y el estado de error con «Reintentar».
   - Prueba: Tarea 5.

---

## Mapa de archivos

| Archivo | Qué cambia |
|---|---|
| `src/Logica.gs` | S1 (`metaDiaria`), S9 (`grupoProcedimiento`; `kpiIndicaciones` agrega `GRUPO`), S6 (tratamiento y marca en las cotizaciones antiguas) |
| `src/Registro.gs` | S6 (`pendientesRegistro`), S7 (`validarRegistro` con varios procedimientos) |
| `src/Tablero.gs` | S2 (`hechosHoyPor`), S3 (nombres), S5 («Se hizo el …») |
| `src/ResultadoServidor.gs` | S4 (`tarjeta` también tras delegar) |
| `src/Codigo.gs` | S1 (`bootstrap.reglas`), S8 (`getPaciente.telefonos`) |
| `src/RegistroServidor.gs` | S10 (`MOTIVO_ANULACION` en `getRegistrosHoy`) |
| `src/Menu.gs` | `PARAMETROS_REGISTRO` agrega `META_DIARIA_SEGUIMIENTOS` |
| `src/Index.html` | Se reemplaza entero, a partir de la referencia, tarea por tarea |
| `docs/diseno/handoff-etapa1/Index-anterior.html` | Copia del `src/Index.html` actual, como consulta. **No va en `src/`**, porque clasp sube todo lo de `src/` |
| `test/ui.test.js` | Se reescribe tarea por tarea |
| `test/logica-*.test.js`, `test/resultado-servidor.test.js`, `test/registro-servidor.test.js`, `test/menu.test.js` | Pruebas de S1 a S10 |
| `CLAUDE.md` | Interfaz nueva, atajos, publicación |

**Cómo leer la referencia** (`docs/diseno/handoff-etapa1/referencia/Index.html`):

| Líneas | Qué hay |
|---|---|
| 18-319 | CSS |
| 356-461 | Utilidades y shell |
| 463-812 | Tablero y panel |
| 813-945 | Registro |
| 946-1005 | Pacientes |
| 1006-1076 | Indicadores |
| 1077-1092 | Arranque |
| 1093-1165 | `DEMO` |

---

### Task 1: Servidor, parte 1: reglas, meta del día, nombres y etiquetas (S1, S2, S3, S5, S8, S10)

**Files:**
- Modify: `src/Logica.gs` (`reglasDesdeFilas`), `src/Menu.gs` (`PARAMETROS_REGISTRO`), `src/Codigo.gs` (`bootstrap`, `getPaciente`), `src/Tablero.gs` (`armarTablero`), `src/RegistroServidor.gs` (`getRegistrosHoy`)
- Test: `test/logica-estado.test.js`, `test/menu.test.js`, `test/logica-tablero.test.js`, `test/resultado-servidor.test.js`, `test/registro-servidor.test.js`, `test/sintaxis.test.js`

**Interfaces:**
- Produces:
  - `reglas.metaDiaria`, un entero que vale 15 por omisión.
  - `bootstrap().reglas = { espera, maxSeguimientos, graciaAgenda, diasEntreSesiones, esperaCotizacion, metaRetorno, metaDiaria }`.
  - `armarTablero(d).cifras.hechosHoyPor = { 'MAGALY': n, … }`.
  - Los cerrados de fallecidos y las tarjetas de alta llevan `NOMBRE`.
  - Un registro de procedimiento completo, en Completado, dice «Se hizo el dd/mm».
  - `getPaciente(dni).telefonos = [tel]`.
  - Cada fila de `getRegistrosHoy()` agrega `MOTIVO_ANULACION`.

- [ ] **Step 1: Pruebas que fallan**

`test/logica-estado.test.js`: la prueba de valores por omisión agrega `metaDiaria: 15` al `deepEqual`. Además:
```js
test('reglas: META_DIARIA_SEGUIMIENTOS se lee de REGLAS', () => {
  assert.equal(L.reglasDesdeFilas(['PARAMETRO', 'VALOR'], [['META_DIARIA_SEGUIMIENTOS', 20]]).metaDiaria, 20);
});
```

`test/menu.test.js`, prueba de `ampliarHojas_`:
- la lista de parámetros esperada agrega `['META_DIARIA_SEGUIMIENTOS', 15]` al final;
- el número de cambios sube en 1;
- se actualiza el texto del mensaje de esa aserción.

`test/logica-tablero.test.js`:
```js
test('armarTablero: hechosHoyPor cuenta por persona resultados, sesiones y altas de hoy, sin anulados', () => {
  const segs = [Object.assign(seg({ dni: '1', fecha: HOY, quien: 'MAGALY' }), { RESULTADO: 'NO CONTESTÓ' }),
    Object.assign(seg({ dni: '2', fecha: HOY, quien: 'MAGALY' }), { RESULTADO: 'FALLECIÓ', ACCION: 'DESCARTADO' }),
    Object.assign(seg({ dni: '3', fecha: HOY, quien: 'RACHEL' }), { RESULTADO: 'LO PENSARÁ', ANULADO: 'SÍ' }),
    seg({ dni: '4', fecha: '2026-10-05', quien: 'RACHEL' })];
  const sesiones = [{ ID: 'SES-1', FECHA_HORA: HOY + ' 09:00', ASESORA: 'RACHEL', ANULADO: '' }];
  const altas = [{ ID: 'ALT-1', FECHA_HORA: HOY + ' 10:00', REGISTRADO_POR: 'MAGALY', ANULADO: '' }];
  assert.deepEqual(tablero({ seguimientos: segs, sesiones, altas }).cifras.hechosHoyPor, { MAGALY: 3, RACHEL: 1 });
});

test('armarTablero: nombre en cerrados de fallecidos y en altas sin serie; procedimiento completo «Se hizo el …»', () => {
  const citas = [cita({ dni: '11', fecha: '2026-09-01', nombre: 'ANA PRUEBA UNO' }), cita({ dni: '12', fecha: '2026-09-02', nombre: 'LUIS PRUEBA DOS' })];
  const segs = [seg({ dni: '11', fecha: '2026-10-05', accion: 'DESCARTADO', motivo: 'FALLECIÓ' })];
  const vigentes = { '12|NUTRICION': { ID: 'ALT-2', FECHA: '2026-10-04', DNI: '12', ESPECIALIDAD: 'NUTRICIÓN', DOCTOR: '' } };
  const proc = reg({ ID_REGISTRO: 'REG-000009', DNI: '13', ESPECIALIDAD: 'PROCEDIMIENTO', TIPO_SEGUIMIENTO: 'PROCEDIMIENTO',
    ESTADO: 'COMPLETADO', ESTADO_REGISTRO: 'COMPLETO', SESIONES: 1, HECHAS: 1, ULTIMA_SESION: '2026-10-03' });
  const t = tablero({ citas, seguimientos: segs, vigentes, pendientes: [proc] });
  assert.equal(t.cerrados.find(x => x.DNI === '11').NOMBRE, 'ANA PRUEBA UNO');
  assert.equal(t.columnas.COMPLETADO.find(x => x.DNI === '12').NOMBRE, 'LUIS PRUEBA DOS');
  assert.equal(t.columnas.COMPLETADO.find(x => x.DNI === '13').ETIQUETA, 'Se hizo el 03/10');
});
```

**Antes de escribir:** comprobar que `tablero()` del archivo acepta `sesiones` y `altas`. Si no, agregarlas con `[]`
por omisión en el `Object.assign`.

`test/resultado-servidor.test.js`, o la prueba que ya cubre `bootstrap`, si existe:
- `bootstrap().reglas` trae las siete claves;
- `metaDiaria` es 15 con las reglas de prueba.

`test/registro-servidor.test.js`:
- `getPaciente` trae `telefonos`;
- `getRegistrosHoy` trae `MOTIVO_ANULACION`.

Usar los dobles de cada archivo. Si `getPaciente` no tiene arnés, probarlo en `resultado-servidor.test.js`, que ya
deriva datos con `derivar_`.

- [ ] **Step 2: Correr y ver que fallan**

Run: `cd /home/user/seguimientos && npm test 2>&1 | grep -E "^not ok|# (pass|fail)"`

Expected: FAIL. Fallan las pruebas nuevas.

- [ ] **Step 3: Implementar**

`Logica.gs`, `reglasDesdeFilas`:
- en el objeto inicial, agregar `metaDiaria: 15`;
- leer el parámetro con `if (par === 'META_DIARIA_SEGUIMIENTOS') r.metaDiaria = entero_(val, 15, 1);`.

`Menu.gs`:
```js
var PARAMETROS_REGISTRO = [['ESPERA_COTIZACION_DIAS', 7], ['DIAS_ENTRE_SESIONES', 7], ['GRACIA_AGENDA_DIAS', 2], ['META_DIARIA_SEGUIMIENTOS', 15]];
```

`Codigo.gs`, `bootstrap`, agregar:
```js
    reglas: { espera: d.reglas.espera, maxSeguimientos: d.reglas.maxSeguimientos, graciaAgenda: d.reglas.graciaAgenda,
      diasEntreSesiones: d.reglas.diasEntreSesiones, esperaCotizacion: d.reglas.esperaCotizacion,
      metaRetorno: d.reglas.metaRetorno, metaDiaria: d.reglas.metaDiaria },
```

`Codigo.gs`, `getPaciente`, agregar `telefonos: d.telefonos[k] || [],`.

`Tablero.gs`, `armarTablero`.

**Nombres (S3).** Al principio:
```js
  var nombrePorDni = {};
  (d.citas || []).slice().sort(porFecha).forEach(function (c) { if (c.NOMBRE) nombrePorDni[c.DNI] = c.NOMBRE; });
```
Usarlo en dos sitios:
- en la tarjeta de alta sin serie, con `NOMBRE: nombrePorDni[a.DNI] || ''`;
- en el cerrado del fallecido, con `NOMBRE: nombrePorDni[dni] || ''`.

**Etiqueta de Completado (S5).** Un registro completo dice:
```js
t.ESTADO_REGISTRO === 'COMPLETO' ? (t.TIPO_SEGUIMIENTO === 'PROCEDIMIENTO' ? 'Se hizo el ' + dm_(f) : 'Completó el tratamiento') : 'Lo hizo el ' + dm_(f)
```

**Meta del día (S2).** Agregar a `cifras`:
```js
function hechosHoyPor_(d) {
  var out = {}, hoy = d.hoy;
  function sumar(quien) { quien = textoLimpio_(quien); if (quien) out[quien] = (out[quien] || 0) + 1; }
  (d.seguimientos || []).forEach(function (s) { var r = resultadoDe(s); if (r && r.fecha === hoy) sumar(s.RESPONSABLE); });
  (d.sesiones || []).forEach(function (s) { if (!anulado_(s) && fechaIso(s.FECHA_HORA) === hoy) sumar(s.ASESORA); });
  (d.altas || []).forEach(function (a) { if (!anulado_(a) && fechaIso(a.FECHA_HORA) === hoy) sumar(a.REGISTRADO_POR); });
  return out;
}
```
y en `cifras`: `hechosHoyPor: hechosHoyPor_(d)`.

`resultadoDe` ya devuelve `null` para una fila anulada.

`RegistroServidor.gs`, `getRegistrosHoy`: agregar `MOTIVO_ANULACION: r.MOTIVO_ANULACION || ''` a las dos ramas,
registros y altas.

- [ ] **Step 4: Correr todo**

Run: `npm test 2>&1 | grep -E "^not ok|# (pass|fail)"`

Expected: `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add src/Logica.gs src/Menu.gs src/Codigo.gs src/Tablero.gs src/RegistroServidor.gs test/*.test.js && git commit -q -m "Servidor para el rediseño: reglas en bootstrap, meta del día por persona, nombres, «Se hizo el», teléfonos y motivo de anulación

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GegG7K4J2pd47s8MMaA85W"
```

---

### Task 2: Servidor, parte 2: tarjeta tras delegar, tratamiento y marca, varios procedimientos (S4, S6, S7)

**Files:**
- Modify: `src/ResultadoServidor.gs`, `src/Registro.gs` (`validarRegistro`, `pendientesRegistro`), `src/Logica.gs` (`pendientesIndicacion`)
- Test: `test/resultado-servidor.test.js`, `test/logica-registro.test.js`, `test/logica-tipos.test.js`, `test/registro-servidor.test.js`

**Interfaces:**
- Produces:
  - **S4.** `registrarResultado` devuelve `{ ok, alta, tarjeta }` o `{ ok, sesion, completo, tarjeta }` cuando delega.
    `tarjeta` vale `''` si la tarjeta salió del tablero.
  - **S6.** Las filas de `pendientesRegistro` de tipo `HIERRO` traen `TRATAMIENTO` (frase, «Hierro carboximaltosa») y
    `MARCA` (frase, «Ferinject», o `''`). Las de `pendientesIndicacion` de tipo `HIERRO` traen
    `TRATAMIENTO: 'Hierro (Ferinject)'` y `MARCA: ''`. Las de procedimiento traen las dos vacías.
  - **S7.** `validarRegistro` acepta `procedimientos: [texto]`, una fila por procedimiento, además de `procedimiento`.

- [ ] **Step 1: Pruebas que fallan**

`test/resultado-servidor.test.js`, en las dos pruebas de delegación (`darDeAlta` y `marcarSesion`): la respuesta trae
`tarjeta`.
- El doble de `darDeAlta` y el de `marcarSesion` agregan la fila a sus listas (`altas` y `sesiones`).
- Así, después de recargar los datos, la tarjeta cambia:
  - alta de una reevaluación: la tarjeta sale de las abiertas y queda en Completado con «Alta médica…»;
  - sesión que no es la última: la tarjeta queda en En tratamiento.
- Aserción mínima: `'tarjeta' in r`.
- Cuando el doble lo permita, aserción sobre `r.tarjeta.COLUMNA`.

`test/logica-registro.test.js`:
```js
test('validarRegistro: varios procedimientos dan una fila cada uno; el singular sigue funcionando', () => {
  const cat = Object.assign({}, CAT_REGISTRO, { procedimientos: ['SANGRÍA', 'AMO', 'BIOPSIA'] });
  const v = L.validarRegistro(Object.assign(base(), { procedimiento: '', procedimientos: ['amo', 'Biopsia'] }), cat, HOY);
  assert.equal(v.error, '');
  assert.deepEqual(v.filas.map(f => [f.TIPO, f.DETALLE]), [['PROCEDIMIENTO', 'AMO'], ['PROCEDIMIENTO', 'BIOPSIA']]);
  assert.match(L.validarRegistro(Object.assign(base(), { procedimientos: ['XYZ'] }), cat, HOY).error, /«XYZ» no está en CATALOGOS/);
  assert.equal(L.validarRegistro(Object.assign(base(), { procedimientos: ['AMO', 'amo'] }), cat, HOY).filas.length, 1, 'sin repetidos');
});
```
Usar los nombres reales del archivo: `CAT_REGISTRO`, `base()` y `HOY`, o sus equivalentes. **Antes de escribir:**
leer el principio del archivo.

**Tratamiento y marca.** Agregar una prueba en `logica-registro` y otra en `logica-tipos`:
- un registro de hierro con `DETALLE: 'HIERRO CARBOXIMALTOSA'` y `MARCA: 'FERINJECT'` da
  `TRATAMIENTO: 'Hierro carboximaltosa'` y `MARCA: 'Ferinject'`;
- una cotización antigua de hierro da `TRATAMIENTO: 'Hierro (Ferinject)'` y `MARCA: ''`.

- [ ] **Step 2: Correr y ver que fallan**

Run: `npm test 2>&1 | grep -E "^not ok|# (pass|fail)"`

Expected: FAIL.

- [ ] **Step 3: Implementar**

**S4.** En `registrarResultado_`, cada `return` delegado pasa a ser:
```js
    var rAlta = darDeAlta({ … igual que hoy … });
    return conTarjeta_(rAlta, claveTarjeta(t));
```
Y se agrega:
```js
/** Tras una escritura delegada, la tarjeta recalculada (o '' si salió del tablero), para que la app confirme el movimiento. */
function conTarjeta_(r, clave) {
  MEMO.datos = null;
  var tab = armarTablero(datos_()), nueva = '';
  Object.keys(tab.columnas).forEach(function (c) { tab.columnas[c].forEach(function (x) { if (x.CLAVE === clave && !nueva) nueva = x; }); });
  var out = {};
  Object.keys(r || {}).forEach(function (k) { out[k] = r[k]; });
  out.tarjeta = nueva;
  return limpiarParaEnvio(out);
}
```

**S6.** En `pendientesRegistro`, agregar al objeto devuelto:
```js
      TRATAMIENTO: r.TIPO === 'HIERRO' ? frase_(r.DETALLE) : '',
      MARCA: r.TIPO === 'HIERRO' ? frase_(r.MARCA) : '',
```
En `pendientesIndicacion`:
```js
      TRATAMIENTO: g.tipo === 'HIERRO' ? 'Hierro (Ferinject)' : '',
      MARCA: '',
```
`frase_('')` devuelve `''`. Comprobarlo.

**S7.** En `validarRegistro`, reemplazar el bloque `if (proc) {…}` por:
```js
  var procs = (Array.isArray(p.procedimientos) ? p.procedimientos : []).concat(proc ? [proc] : [])
    .map(textoLimpio_).filter(Boolean);
  var vistos = {};
  for (var i = 0; i < procs.length; i++) {
    var p1 = enLista_(catalogos.procedimientos, procs[i]);
    if (!p1) return no('El procedimiento «' + procs[i] + '» no está en CATALOGOS.');
    if (vistos[normTexto(p1)]) continue;
    vistos[normTexto(p1)] = 1;
    filas.push(copia_(base, { TIPO: 'PROCEDIMIENTO', DETALLE: p1, SESIONES: 1 }));
  }
```
Además:
- la condición «Elija un procedimiento, un tratamiento o ambos.» pasa a ser `if (!procs.length && !trat)`;
- hay que declararla **después** de calcular `procs`;
- `guardarRegistro` no cambia: ya escribe todas las filas en un solo candado y revisa los duplicados de cada fila.

- [ ] **Step 4: Correr todo**

Run: `npm test 2>&1 | grep -E "^not ok|# (pass|fail)"`

Expected: `# fail 0`.

- [ ] **Step 5: Commit**

Commit, con el trailer, de los archivos tocados: «Servidor para el rediseño: tarjeta tras alta y sesión, tratamiento y
marca, varios procedimientos».

---

### Task 3: Servidor, parte 3: procedimientos agrupados por tipo (S9)

**Files:**
- Modify: `src/Logica.gs` (función nueva `grupoProcedimiento`; `kpiIndicaciones` agrega `GRUPO`)
- Test: `test/logica-kpi.test.js`

**Interfaces:**
- Produces:
  - `grupoProcedimiento(detalle)` devuelve el nombre canónico en mayúsculas, con las partes unidas por « + ».
  - Cada fila de `kpiIndicaciones` agrega `GRUPO`. **La clave de agrupación no cambia:** sigue siendo MES, TIPO, DETALLE
    y MÉDICO, para que las cifras de hoy no se muevan.

- [ ] **Step 1: Prueba que falla**

```js
test('grupoProcedimiento junta las variantes escritas a mano', () => {
  const g = L.grupoProcedimiento;
  assert.equal(g('AMO + BIOSIA'), 'AMO + BIOPSIA');
  assert.equal(g('biposia+amo'), 'AMO + BIOPSIA');
  assert.equal(g('CITOMETREÍADE FLUJO'), 'CITOMETRÍA DE FLUJO');
  assert.equal(g('Citomateria de flujo + cariotipo'), 'CITOMETRÍA DE FLUJO + CARIOTIPO');
  assert.equal(g('citogenetica'), 'CITOGENÉTICA');
  assert.equal(g('Sangria'), 'SANGRÍA');
  assert.equal(g('TRANSFUSION'), 'TRANSFUSION', 'lo desconocido queda normalizado tal cual');
  assert.equal(g(''), '');
});

test('kpiIndicaciones agrega GRUPO sin cambiar las filas', () => {
  const inds = [{ FECHA: '2026-09-01', TIPO: 'PROCEDIMIENTO', DETALLE: 'AMO + BIOSIA', ESTADO: 'COTIZÓ', DNI: '' }];
  const k = plano(L.kpiIndicaciones(inds, []));
  assert.equal(k.length, 1);
  assert.equal(k[0].DETALLE, 'AMO + BIOSIA');
  assert.equal(k[0].GRUPO, 'AMO + BIOPSIA');
});
```

- [ ] **Step 2: Correr y ver que falla**

Expected: FAIL.

- [ ] **Step 3: Implementar**

```js
/** Variantes escritas a mano → nombre canónico. Se reconocen por el comienzo, sin tildes. */
var GRUPOS_PROC = [
  ['AMO', 'AMO'], ['BIO', 'BIOPSIA'], ['BIP', 'BIOPSIA'],
  ['CITOM', 'CITOMETRÍA DE FLUJO'], ['CITOG', 'CITOGENÉTICA'], ['CARIO', 'CARIOTIPO'], ['SANGR', 'SANGRÍA']
];
var ORDEN_GRUPOS = ['AMO', 'BIOPSIA', 'CITOMETRÍA DE FLUJO', 'CARIOTIPO', 'CITOGENÉTICA', 'SANGRÍA'];

function grupoProcedimiento(detalle) {
  var partes = normTexto(detalle).split('+').map(function (x) { return x.trim(); }).filter(Boolean).map(function (x) {
    for (var i = 0; i < GRUPOS_PROC.length; i++) if (x.indexOf(GRUPOS_PROC[i][0]) === 0) return GRUPOS_PROC[i][1];
    return x;
  });
  var unicas = partes.filter(function (x, i) { return partes.indexOf(x) === i; });
  return unicas.sort(function (a, b) {
    var ia = ORDEN_GRUPOS.indexOf(a), ib = ORDEN_GRUPOS.indexOf(b);
    if (ia < 0) ia = 99;
    if (ib < 0) ib = 99;
    return ia - ib || (a < b ? -1 : a > b ? 1 : 0);
  }).join(' + ');
}
```

En `kpiIndicaciones`, al crear `acc[clave]`, agregar `GRUPO: grupoProcedimiento(i.DETALLE)`.

**Si una prueba existente de `kpiIndicaciones` compara la fila entera:** agregarle `GRUPO`. Es el único cambio
permitido en pruebas antiguas.

- [ ] **Step 4: Correr todo**

Expected: `# fail 0`.

- [ ] **Step 5: Commit**

«Procedimientos agrupados por tipo para Indicadores», con el trailer.

---

### Task 4: Esqueleto de la interfaz nueva, `DEMO` con formas reales y pruebas base

**Files:**
- Create: `docs/diseno/handoff-etapa1/Index-anterior.html` (copia exacta del `src/Index.html` actual)
- Modify: `src/Index.html` (se reemplaza)
- Modify: `test/ui.test.js` (se reemplaza; el archivo anterior queda en la historia de git)

**Interfaces:**
- Produces, para las Tareas 5 a 12:
  - **Shell de la referencia:**
    - menú lateral de escritorio; en celular, barra superior más barra inferior;
    - `ir(seccion)`, View Transitions y la pastilla de los segmentados;
    - modo claro y oscuro;
    - `avisar(texto, accion?)`;
    - `copiar` con plan B.
  - **`llamar(fn, ...args)`**, de la app actual.
  - **`S`**, el estado global: `boot`, `usuario`, `reglas`, `tablero`…
  - **Adaptadores:**
    - `adaptarBoot(b)` devuelve `{ usuarios: [{v, l, rol, med}], medicos: [{k, full, short}], doctores, especialidades, procedimientos, tratamientos, marcas, reglas, hoy }`;
    - `nombreBonito(txt)`, `telBonito(tel)` y `medicoCorto(nombre)`.
  - **`exigirUsuario()`**: si no hay usuario elegido, avisa «Elija quién es usted.» y devuelve `false`.
  - **El `DEMO`**, con las funciones reales: `bootstrap`, `getTablero`, `registrarResultado`, `anularResultado`,
    `getPaciente`, `buscar`, `buscarPacienteRegistro`, `guardarRegistro`, `getRegistrosHoy`, `anularRegistro`,
    `marcarSesion`, `anularSesion`, `darDeAlta`, `anularAlta`, `confirmarEmparejamiento`, `getResumen` y `getKpi`.
    Todas devuelven las **formas reales** de `MAPEO-SERVIDOR.md` §1.
  - **Las pantallas Tablero, Registro, Pacientes e Indicadores son contenedores vacíos**, cada uno con un texto
    «Cargando…».

- [ ] **Step 1: Copiar el archivo actual**

Run: `cp src/Index.html docs/diseno/handoff-etapa1/Index-anterior.html`

- [ ] **Step 2: Pruebas nuevas que fallan**

`test/ui.test.js` se reescribe.

**Qué se conserva.** El helper `abrir(opciones)` actual, que abre `file://…/src/Index.html` y junta los
`pageerror`, y la prueba de colores escritos a mano. Esa prueba se adapta para que acepte solo `:root{}` y
`html[data-modo="oscuro"]{}`.

**Pruebas nuevas:**
1. **Carga sin errores.** Se ve el menú con Tablero, Registro, Pacientes e Indicadores, y `pageerror` está vacío.
2. **El menú cambia de pantalla.** Cada ítem muestra su sección y oculta las otras, y queda marcado con
   `aria-current="page"`.
3. **«¿Quién es usted?» arranca vacío** sin `seg.usuario`.
   - Con `seg.usuario = 'MAGALY'` en `localStorage` antes de cargar, arranca en MAGALY.
   - Con un usuario que no está en el catálogo, arranca vacío.
   - Para escribir en `localStorage` antes de cargar, usar `page.addInitScript`.
4. **Modo oscuro.** El botón cambia `data-modo` de `html` y guarda `seg.modo`. Con `colorScheme: 'dark'` y sin
   preferencia guardada, arranca oscuro.
5. **Celular de 390×844.** Se ven la barra inferior y la superior, y `document.documentElement.scrollWidth <= 390`.
6. **La prueba de colores escritos a mano**, adaptada.

- [ ] **Step 3: Implementar**

**Copiar la referencia** (`docs/diseno/handoff-etapa1/referencia/Index.html`) a `src/Index.html`. Después:

- **Tokens:** el selector `[data-tema="oscura"]` pasa a `html[data-modo="oscuro"]`. Las claves `chp-tema` y
  `chp-usuario` pasan a `seg.modo` y `seg.usuario`. La primera vez, `seg.modo` sigue a
  `matchMedia('(prefers-color-scheme: dark)')`.
- **El puente:** reemplazar `api(...)` por `llamar(...)`, copiando `llamar` de `Index-anterior.html` (líneas 446-454
  aprox.).
- **El arranque:**
  - `iniciar()` llama a `bootstrap` (nunca a `getKpi`) y aplica `adaptarBoot`;
  - el selector de usuario se llena con «— Elija —» más los usuarios del catálogo;
  - **no se elige ninguno por omisión** (`MAPEO` §3 J).
- **El `DEMO`:**
  - se reemplaza por uno nuevo, armado a partir del `DEMO` de `Index-anterior.html`, que ya trae las formas reales;
  - se agrega `getTablero`, que devuelve `{ columnas, cerrados, cifras }` con tarjetas inventadas en las cuatro
    columnas;
  - las tarjetas cubren estos casos:
    - reevaluación nueva y en control;
    - hierro de un registro en curso, una con sesión atrasada en Por contactar y otra a tiempo en En tratamiento;
    - procedimiento antiguo;
    - un paciente con usuario `@`;
    - uno sin teléfono;
    - en Agendado, una de cada `AGENDA`: CITA, LLAMAR, REINTENTAR y SIN RESPUESTA;
    - en Completado, una de cada etiqueta;
  - `cifras` incluye `hechosHoyPor`; `bootstrap` incluye `reglas`;
  - los nombres, DNI y teléfonos son inventados. Se pueden reutilizar los del `DEMO` actual y los de la maqueta.
- **Las cuatro pantallas** quedan como contenedores, con el título de la referencia y «Cargando…». Su contenido llega
  en las Tareas 5 a 11.
- **No dejar código muerto de la referencia:** lo que aún no se usa se agrega en su tarea, no ahora.

- [ ] **Step 4: Correr**

Run: `npm run test:ui 2>&1 | grep -E "^not ok|# (pass|fail)"; npm test 2>&1 | grep -E "# fail"`

Expected: `# fail 0` las dos veces.

- [ ] **Step 5: Commit**

«Interfaz nueva: esqueleto, preferencias, puente y DEMO con las formas reales», con el trailer.

---

### Task 5: Tablero (columnas, cifras, filtros, teclado)

**Files:**
- Modify: `src/Index.html` (tablero, a partir de la referencia, líneas 463-612 y 735-772)
- Test: `test/ui.test.js`

**Interfaces:**
- Consumes:
  - `getTablero()`;
  - `S.boot.reglas`;
  - `cifras.hechosHoyPor`;
  - las tarjetas con `CLAVE`, `COLUMNA`, `ETIQUETA`, `FECHA_CLAVE`, `AGENDA`, `FECHA_AGENDA`, `INTENTO`, `ATRASO`,
    `SIN_CONTACTO`, `TELEFONOS`, `TELEFONOS_DESCARTADOS`, `USUARIO`, `N_SEGUIMIENTOS`, `N_REALIZADAS`, `SESIONES`,
    `HECHAS`, `TRATAMIENTO`, `MARCA`, `TIPO_SEGUIMIENTO`, `ESPECIALIDAD`, `ESPECIALIDAD_CONSULTA` y `MEDICO_ULTIMO`.
- Produces:
  - `adaptarTarjeta(t)`, con la forma de la referencia y el `id` como texto;
  - `S.pacientes`;
  - `pintarTablero()`;
  - `seleccion`, el estado de teclado.

**Requisitos.** Son los del README §6.1, con estos ajustes de `MAPEO` §1.2 y §3:

**Columnas**
- Cada columna sale de `COLUMNA`. **No se recalcula en el cliente.**
- La línea de cada tarjeta es `ETIQUETA`. El rojo `--accent` se usa cuando `ATRASO > 0`, o cuando
  `AGENDA === 'SIN RESPUESTA'`.
- **Por contactar** respeta el orden del servidor y agrupa así:

  | Grupo | Días |
  |---|---|
  | Recientes | 30 o menos |
  | Hace 1 a 2 meses | 31 a 60 |
  | Más antiguos | más de 60 |

  Cada grupo muestra 6, 4 y 3 tarjetas, más el botón «Ver 10 más de N».
- **Los días** se cuentan así:
  - reevaluación: desde `PROXIMA_ESPERADA`;
  - hierro y procedimiento: `DIAS`.
- **Agendado** agrupa en «Esta semana» (`FECHA_CLAVE` ≤ hoy + 6) y «Más adelante».
- **El chip de Agendado** dice «Cita jue 08/10», «Llamar vie 09/10» o «Reintentar 21/10», según `AGENDA`.

**Cifras**

| Cifra | Cómo se cuenta |
|---|---|
| Por contactar | Más «N sin ningún intento» (`N_SEGUIMIENTOS == 0`) |
| Agendados | Más «N citas esta semana» |
| En tratamiento | Más «N sesión(es) atrasada(s)», que se cuentan en **Por contactar** con `ATRASO > 0` |
| Completados en el mes | Más el enlace **«N cerrados este mes»**, que abre una lista con nombre, tipo, motivo y fecha desde `cerrados[]` |

**Meta del día**
- Usa `hechosHoyPor[usuario]` y `reglas.metaDiaria`.
- Si no hay usuario, dice «Elija quién es usted».
- Al cambiar de usuario se recalcula **sin recargar** el tablero.

**Filtros**
- Tipo (con su número, contado solo en Por contactar), médico y especialidad.
- «Solo sin teléfono», que usa `SIN_CONTACTO`.
- Buscador por nombre o DNI.
- El tipo se recuerda en `seg.tipo`.
- Para un usuario médico se **propone** su filtro, que se puede cambiar (D2).

**Estados de la pantalla**
- Cargando: esqueletos.
- Vacío, con el texto de cada columna.
- «Nadie con estos filtros», con el botón «Quitar filtros».
- Error, con «Reintentar».

**Celular:** una columna a la vez, con pestañas.

**Teclado**
- ↑ ↓ ← →, y también j y k.
- Enter abre el panel; en esta tarea, solo un panel vacío con el nombre.
- C copia el teléfono.
- / va al buscador.
- Esc sale del campo.

**Pruebas** (cada una abre la app con `seg.usuario = 'MAGALY'`):
1. **Las cuatro columnas** tienen las tarjetas del `DEMO` en su columna, con su `ETIQUETA` literal. Por ejemplo, la
   de REINTENTAR dice «Reintentar el …· intento 1 de 2».
2. **Los tres grupos de Por contactar** existen. «Ver 10 más» aparece cuando un grupo tiene más tarjetas de las que
   muestra; el `DEMO` debe tener las suficientes.
3. **Las cifras** coinciden con el `DEMO`, y «N cerrados este mes» abre la lista.
4. **El filtro por tipo** cambia los números y se recuerda al recargar. «Solo sin teléfono» deja solo las tarjetas con
   `SIN_CONTACTO`.
5. **Meta del día.**
   - Con MAGALY dice «Hoy: X de 15», con X sacado de `hechosHoyPor`.
   - Al cambiar a RACHEL, la cifra cambia y **`getTablero` no se vuelve a llamar** (contar las llamadas con un
     contador en el `DEMO`).
6. **Teclado:** ↓ selecciona la siguiente tarjeta, → pasa de columna, Enter abre el panel y Esc lo cierra.
7. **Estado de error.**
   - `DEMO.getTablero` lanza un error: se ve la banda de error y «Reintentar» vuelve a cargar.
   - `DEMO.getTablero` devuelve columnas vacías: se ve el estado vacío.

**Commit:** «Tablero: cuatro columnas del servidor, cifras, meta del día, filtros y teclado», con el trailer.

---

### Task 6: Panel del paciente y «¿Qué pasó?»

**Files:**
- Modify: `src/Index.html` (panel, a partir de la referencia, líneas 616-734)
- Test: `test/ui.test.js`

**Interfaces:**
- Consumes:
  - `registrarResultado(p)`, con el payload de `MAPEO` §1.3;
  - `anularResultado`, `anularAlta` y `anularSesion`;
  - `getPaciente(dni)`, para la historia;
  - `S.boot.doctores` y `S.boot.reglas`.
- Produces: `abrirPanel(clave, teclado)`, `guardarResultado(clave, resultado, extra)` y `deshacer`.

**Requisitos.** Son los del README §6.2, con `MAPEO` §2 y §3.

**Claves y pasos**
- Las claves de la referencia se traducen a `RESULTADOS` con la tabla de `MAPEO` §2.1.
- «No desea continuar / otro» se llama «No desea continuar».
- Los pasos con fecha usan los rangos del servidor. La fecha propuesta es:
  - mañana, para «Lo pensará»;
  - `PROXIMA_AGENDADA` o hoy, para «Agendó cita»;
  - hoy, para «Lo hizo».
- «Alta médica» pide el doctor de `doctores[].doctor`, propuesto por el médico de la tarjeta. Pide fecha **solo en una
  reevaluación** (D de `MAPEO` §3 G).
- «Número equivocado»:
  - con un solo teléfono, ese queda elegido;
  - con varios, se elige cuál;
  - el texto dice «Le queda el …» o «Le queda el usuario @…» (sigue), o «No le queda otro contacto: se cerrará el
    seguimiento».
- «No desea continuar» no se puede confirmar sin motivo.
- Los cierres llevan el borde `--accent` y confirman en el mismo panel. «Falleció» agrega «Se cerrarán todos sus
  seguimientos».

**Guardado optimista**
1. La tarjeta se mueve con FLIP a la columna que indica `MAPEO` §2.1.
2. Al llegar la respuesta, `r.tarjeta` manda:
   - si su `COLUMNA` difiere, la tarjeta se mueve a la del servidor;
   - si es `''`, la tarjeta sale.
3. Si hay error, se restaura todo lo anterior y se muestra «No se guardó: {mensaje}».
4. «Falleció» saca **todas** las tarjetas de ese DNI.
5. La meta del día suma 1 si el guardado sale bien.

**«Deshacer»**
- Se muestra 8 segundos, **solo** si el guardado salió bien.
- Llama, según la respuesta:

  | Respuesta trae | Función |
  |---|---|
  | `seguimiento` | `anularResultado` |
  | `alta` | `anularAlta` |
  | `sesion` | `anularSesion` |

- Envía `motivo: 'Deshecho al momento'` y después recarga el tablero.

**Nota.** Se guarda en el estado mientras el panel esté abierto en ese paciente. No se pierde al elegir un resultado.

**Historia**
- Sale de `getPaciente(dni)` cuando se abre el panel; mientras llega, se ve un esqueleto.
- Muestra las filas de esa especialidad y referencia, más las sesiones y las altas.
- El texto de cada fila sigue `textoRes` de `Index-anterior.html`.
- Las filas anuladas aparecen tachadas.
- «Anular» va solo en la última fila sin anular de cada seguimiento, o en una de «Falleció». Pide motivo.

**Contacto**
- Cada teléfono tiene «Copiar».
- Los números equivocados aparecen tachados.
- El usuario `@` se muestra como «Usuario».
- Sin contacto: «Sin teléfono. No hay número en SOFDOC ni en la otra base.».

**Tarjetas de Completado:** el panel es solo de lectura, con la historia y «Anular».

**Teclado**
- 1 a 4 sobre la tarjeta seleccionada, aunque el panel esté cerrado.
- 1 («No contestó») guarda sin abrir el panel.
- X abre el panel con el grupo de cierre resaltado.
- Ninguna tecla guarda un cierre.
- Esc cierra primero el paso y después el panel.

**Pruebas:**
1. **Cada resultado mueve la tarjeta.**
   - «Lo pensará» con fecha → Agendado, con «Llamar …».
   - «Agendó cita» → Agendado, con «Cita …».
   - 1 sin abrir el panel → la tarjeta pasa a Agendado con «Reintentar …».
   - «Lo hizo» en hierro a tiempo → sigue en En tratamiento con la sesión siguiente, o pasa a Completado si era la
     última.
   - El `DEMO` debe devolver `tarjeta` coherente con cada caso.
2. **Deshacer** devuelve la tarjeta y llama a la función de anular que corresponde; contar las llamadas en el `DEMO`.
3. **Si el servidor falla**, la tarjeta vuelve, se ve «No se guardó: …» y no hay «Deshacer». Las cifras y la meta se
   restauran.
4. **Una tarjeta vieja.** `DEMO.registrarResultado` lanza «Ese paciente no está en la lista. Recargue la página.»: se
   ve ese aviso y la tarjeta vuelve (Review Focus 1).
5. **Cierres.** La confirmación aparece en el panel; «Falleció» lo advierte y, al confirmarlo, salen todas las
   tarjetas del DNI.
6. **Número equivocado** con dos teléfonos: la tarjeta sigue y el número aparece tachado al volver a abrir.
7. **«No desea continuar»** sin motivo no se puede guardar; con motivo, se guarda.
8. **La nota** escrita antes de elegir el resultado llega en el payload.
9. **La historia** se ve con la entrada nueva, y «Anular» de la última pide motivo y la tacha.
10. **Atajos:** 1 guarda sin panel, X abre el cierre sin guardar y Esc cierra el paso.
11. **Una tarjeta de Completado** abre el panel sin «¿Qué pasó?».

**Commit:** «Panel del paciente: «¿Qué pasó?» conectado al servidor, Deshacer real e historia», con el trailer.

---

### Task 7: Arrastrar y soltar

**Files:**
- Modify: `src/Index.html` (a partir de la referencia, líneas 773-812)
- Test: `test/ui.test.js`

**Requisitos.** Son los del README §8, con los destinos corregidos según `MAPEO` §3 E.

**Cuándo hay arrastre**
- Solo con puntero y a 760 px o más.
- Las tarjetas de Completado no se arrastran.
- Empieza tras moverse 6 px.

**Qué pasa al soltar en cada columna**

| Columna | Qué abre |
|---|---|
| Agendado | El paso «Agendó cita» |
| En tratamiento | El paso «Lo hizo», **solo** si `ID_REGISTRO` y `HECHAS + 1 < SESIONES`. Si no es válida: «En tratamiento es solo para hierro con sesiones pendientes.» |
| Completado | El paso «Lo hizo» si es procedimiento, o hierro en su última sesión, o una cotización antigua de hierro. En reevaluación, el paso «Alta médica» |
| Por contactar | Nunca es válida |

**Al soltar**
- Siempre se abre el paso. **Nada se guarda sin confirmar.**
- En una columna no válida, la copia vuelve en 220 ms y aparece el aviso.

**Pruebas** (a 1440 px, con `page.mouse`):
1. Arrastrar una reevaluación a Agendado abre el paso «Agendó cita». **No se guarda nada**: el contador de llamadas a
   `registrarResultado` del `DEMO` sigue en 0.
2. Arrastrar a En tratamiento una tarjeta que no es válida muestra el aviso, y la tarjeta queda en su columna.
3. A 390 px no hay arrastre.

**Commit:** «Tablero: arrastrar y soltar abre el paso, nunca guarda solo», con el trailer.

---

### Task 8: Registro

**Files:**
- Modify: `src/Index.html` (a partir de la referencia, líneas 813-945)
- Test: `test/ui.test.js`

**Requisitos.** Son los del README §6.3, con `MAPEO` §1.4 a §1.8.

**Formulario de indicación**
- **Catálogos** de `bootstrap`:
  - procedimientos, como chips múltiples, que se envían en `procedimientos: []` (S7);
  - tratamientos;
  - marcas por tratamiento, con la clave `normTexto`;
  - doctores, con `doctores[].doctor`.
- **El DNI** acepta carné de extranjería: de 9 a 12 caracteres alfanuméricos. No se borran las letras.
- **El paciente conocido** sale de `buscarPacienteRegistro`. Al encontrarlo:
  - se completan el nombre, el contacto y el doctor;
  - aparece el aviso azul «Paciente conocido · última consulta dd/mm/aaaa con Dr. X»;
  - si figura como fallecido, aparece el aviso del fallecido, que no bloquea el registro.
- **El contacto es obligatorio.** Si falta, la barra inferior dice «Falta: … teléfono o usuario».

**Registrar**
- Se llama a `guardarRegistro` con `{ usuario, dni, nombre, contacto, fecha, doctor, procedimientos, tratamiento, sesiones, marca }`.
- Si la respuesta es `{ ok: false, duplicado }`, aparece la caja «Posible duplicado» con «Registrar de todos modos»,
  que reenvía con `confirmado: true`.
- Si sale bien, el aviso dice «Registrado: … · REG-…», con los `ID` que devolvió el servidor, y se recarga «Registrados
  hoy».

**Alta médica**
- Llama a `buscarPacienteRegistro`.
- Las especialidades con `alta: true` aparecen deshabilitadas, con el rótulo «ya tiene alta».
- `darDeAlta({ usuario, dni, especialidad, doctor, fecha, nota })`.
- Se usa el `alta.ID` que devuelve el servidor.

**«Registrados hoy»**
- Sale de `getRegistrosHoy()`.
- «Anular» pide el motivo en la fila y llama a `anularRegistro` o a `anularAlta`, según el prefijo del ID.
- Espera la respuesta antes de tachar la fila.
- Las filas anuladas muestran su motivo.

**Pruebas:**
1. **Un DNI conocido** completa el formulario y muestra el aviso.
2. **Un DNI de fallecido** muestra el aviso y deja registrar.
3. **El carné** `AB123456X` se acepta.
4. **Dos procedimientos y un tratamiento** con dos sesiones y marca dan el aviso con tres REG, y «Registrados hoy» los
   lista.
5. **Duplicado:** aparece la caja, y «Registrar de todos modos» registra.
6. **Sin contacto**, «Registrar» está deshabilitado y la barra dice qué falta.
7. **Alta:** una especialidad con alta vigente está deshabilitada; registrar el alta la agrega a «Registrados hoy».
8. **Anular** sin motivo no se puede; con motivo, la fila queda tachada y muestra el motivo.

**Commit:** «Registro con catálogos reales, carné, duplicados del servidor y anulaciones», con el trailer.

---

### Task 9: Pacientes y ficha

**Files:**
- Modify: `src/Index.html` (a partir de la referencia, líneas 946-1005)
- Test: `test/ui.test.js`

**Requisitos.** Son los del README §6.4, con `MAPEO` §1.9 a §1.11 y §5.

**Buscador**
- `buscar(texto)`, desde 3 letras.
- Muestra los primeros 6 resultados.
- Se navega con ↑ ↓; Enter abre y Esc cierra.

**`adaptarFicha(getPaciente)`**, con todas las secciones:

**Cabecera**
- Muestra el aviso de fallecido.
- Muestra los números equivocados, tachados.

**Especialidades**
- Cada una muestra:
  - su estado, con `NOMBRE_ESTADO` y `esBueno` copiados de `Index-anterior.html`;
  - el perfil;
  - el pendiente;
  - la línea de tiempo de consultas, más «Debía volver el … (plazo máximo …)».
- **«Dar de alta…»** abre el doctor y la fecha en la misma especialidad.

**Confirmar emparejamiento**
- Se muestra cuando la ficha trae `porConfirmar`.
- Llama a `confirmarEmparejamiento`.

**Registros**
- Cada registro muestra sus sesiones.
- «Lo hizo» lleva fecha y llama a `marcarSesion`.
- «Anular registro» y «Anular sesión» (solo la última) piden motivo.

**Altas**
- Cada alta muestra si está vigente, cerrada o anulada.
- «Anular» va solo en las altas `ALT-` y pide motivo.

**Procedimientos anteriores a la plataforma:** se listan con su teléfono.

**Lateral**
- Contacto (`getPaciente.telefonos`, S8), con «Copiar».
- Las altas.
- La historia de seguimientos.

**Historia**
- Con «Anular» del último, como en el panel.
- `ANULADO` se lee normalizado: `SI` y `SÍ`, en mayúsculas o minúsculas.

**Enlace desde el panel:** «Ver ficha completa →» lleva a esta ficha.

**Pruebas:**
1. **El buscador** encuentra por nombre y por DNI, y se usa con el teclado.
2. **La ficha** muestra el estado por especialidad, la línea «Debía volver el …», los registros con sus sesiones, las
   altas y el contacto.
3. **«Dar de alta…»** registra el alta.
4. **«Lo hizo»** registra la sesión, y «Anular sesión» con motivo la tacha.
5. **Confirmar el emparejamiento** quita el aviso.
6. **El aviso de fallecido** y los números tachados se ven cuando el `DEMO` los trae.
7. **«Ver ficha completa»** desde el panel abre esta ficha.

**Commit:** «Pacientes: buscador y ficha completa, con emparejamiento, altas y anulaciones», con el trailer.

---

### Task 10: Indicadores (siete pestañas)

**Files:**
- Modify: `src/Index.html` (a partir de la referencia, líneas 1006-1076, más las tres pestañas nuevas según
  `maquetas/Indicadores.dc.html`)
- Test: `test/ui.test.js`

**Requisitos.** Son los del README §6.5 y de `MAPEO` §4.

**Carga de datos**
- `getResumen()` y `getKpi()` se piden al entrar en la pantalla.
- Se guardan en memoria. Ese caché se invalida después de cualquier escritura: resultado, registro, sesión, alta o
  anulación.

**Filtros**
- Navegación ‹ mes › por `MES` (`yyyy-mm`).
- Médico: para un usuario médico se propone el suyo.
- Especialidad: **solo** en las pestañas cuyos datos la traen (D3).

**Las siete pestañas**

1. **Resumen del mes:**
   - la cifra grande y la frase;
   - la meta, con `100 - meta`;
   - el desglose de pacientes nuevos y en control;
   - la nota de altas;
   - las 4 cifras secundarias;
   - las 6 barras, con el mes en curso rayado y un clic que cambia de mes.
2. **¿Hasta dónde llegan?:**
   - los 100 cuadritos y el relato, a partir de `historia` y `partes` de `Index-anterior.html`;
   - la tabla mes por mes, con su total.
3. **Campañas:**
   - tablas por canal y por campaña;
   - muestra 8 y luego «Ver las N campañas»;
   - la barra en `--good`;
   - una base 0 se muestra «— (0/0)»;
   - «Sin lead en el CRM» se muestra como «Sin registro en el CRM».
4. **Procedimientos:**
   - tres vistas: «Por tipo» (`GRUPO`, S9), «Como se escribió» y «Por médico»;
   - el aviso de los nombres juntados.
5. **Recuperación:** sale de `recuperacion`, con «volvieron tras el seguimiento» y la mediana de días, por mes y por
   asesora.
6. **Motivos de cierre:**
   - sale de `motivos`;
   - lleva la nota: «Este cuadro todavía no se filtra por mes ni por médico, y no incluye los cierres automáticos «sin
     respuesta».» (D5).
7. **Procedimientos sin paciente:** sale de `sinCandidato`.

**Movimiento:** las barras entran con `scaleX` y los cuadritos en cascada. Ver README §7.

**Pruebas:**
1. **Cada pestaña se pinta sin errores**, con los números del `DEMO`.
2. **El cambio de mes** cambia la cifra grande.
3. **El filtro de médico** cambia las cifras.
4. **Las palabras prohibidas** («cohorte», «lead», «KPI», «días de atraso») no aparecen en ninguna pestaña. Se adapta
   la prueba del archivo anterior.
5. **«Por tipo»** junta «AMO + BIOSIA» con «AMO + BIOPSIA», con los datos del `DEMO`.
6. **El caché:** después de un guardado en el tablero, al volver a Indicadores se piden los datos de nuevo (contador en
   el `DEMO`).

**Commit:** «Indicadores: siete pestañas con datos reales», con el trailer.

---

### Task 11: Resumen imprimible de dos páginas

**Files:**
- Modify: `src/Index.html`
- Test: `test/ui.test.js`

**Requisitos.** Son los de `MAPEO` §4, «Resumen imprimible», según `maquetas/Resumen del mes.dc.html`.

**Cómo se arma**
- Una sección `#imprimible`, oculta en pantalla.
- `@media print` muestra solo esa sección.
- `@page { size: A4; margin: 15mm }`.
- `break-after: page` entre las dos páginas.

**El botón «Resumen para imprimir»**
- Si `getResumen` y `getKpi` no están en el caché, los pide.
- Arma la sección con los filtros activos y llama a `window.print()`.

**Página 1**
- La cabecera, con los filtros y el mes.
- La cifra grande.
- Las 4 frases.
- Las barras mes a mes.
- «Qué conviene mirar»: dos frases generadas por la función pura `queConvieneMirar(meses, secundarias, meta)`, con
  estas reglas fijas:
  - **Primera frase, sobre la tendencia.** Compara el porcentaje de «no volvió» del mes con el del primer mes
    visible:
    - si bajó 5 puntos o más: «Mejoró: de A % a B % en N meses.»;
    - si subió 5 puntos o más: «Empeoró: …»;
    - si no: «Se mantiene alrededor de B %.».
  - **Segunda frase, sobre la cifra secundaria con peor porcentaje:** «Lo que más se pierde: {frase de esa
    cifra}.».
- El pie: «Generado el dd/mm/aaaa · datos de SOFDOC y de la plataforma».

**Página 2**
- Los 100 cuadritos con el relato.
- Los 5 primeros canales.
- Procedimientos: dos frases de «de lo cotizado, cuánto se empezó», por `GRUPO`.

**Sin colores escritos a mano:** se usa `var(--accent-ink)`, nunca `#FFFFFF`.

**Pruebas:**
1. **La sección `#imprimible` se arma con los datos del `DEMO`.**
   - Para no abrir el diálogo, reemplazar `window.print` antes de pulsar.
   - Aserción: se llamó a `window.print`.
   - Aserción: las dos páginas existen y la cifra coincide.
2. **`queConvieneMirar`** devuelve la frase esperada en los tres casos de la tendencia. Se prueba con `page.evaluate`,
   pasándole los datos.
3. **`page.emulateMedia({ media: 'print' })`:** solo se ve `#imprimible`.

**Commit:** «Resumen imprimible de dos páginas para el director», con el trailer.

---

### Task 12: Repaso visual, celular, movimiento, accesibilidad y documentación

**Files:**
- Modify: `src/Index.html` (solo correcciones que salgan del repaso)
- Modify: `test/ui.test.js`, `CLAUDE.md`

**Pasos:**

1. **Capturas.** A 1366, 1440, 1920 y 390 px, en modo claro y oscuro:
   - de cada pantalla;
   - del panel;
   - de un paso;
   - de una confirmación de cierre.

   Van a `/tmp/claude-0/-home-user-crm-leads-chp/beac2516-a2c1-5ca6-b1d3-d3fa4bf750fc/scratchpad/rediseno/`.
   Compararlas con `docs/diseno/handoff-etapa1/capturas/` y con las maquetas, y corregir las diferencias visuales.
   **Las maquetas mandan en lo visual.**
2. **Celular.** Agregar pruebas:
   - a 390 px, en cada pantalla y con el panel abierto con un nombre largo, `scrollWidth <= 390` (Review Focus 4);
   - «‹ Volver» visible.
3. **Movimiento reducido.** Con `page.emulateMedia({ reducedMotion: 'reduce' })`, abrir el panel y mover una tarjeta
   no deja animaciones pendientes. Comprobar `document.getAnimations().length === 0` tras 50 ms.
4. **Teclado completo.** Una prueba recorre: Tab hasta el tablero, flechas, Enter, 2, la fecha, Enter y Esc.
5. **`CLAUDE.md`:**
   - describe la interfaz nueva (pantallas, menú y atajos);
   - dice que **H y D se reemplazan por 1 a 4 y X**;
   - incluye los pasos de publicación de la especificación §6, con el nuevo `META_DIARIA_SEGUIMIENTOS` y la
     comprobación de `MAX_SEGUIMIENTOS = 2`.
6. **Las dos suites:** `npm test` y `npm run test:ui` terminan en `# fail 0`.

**Commit:** «Rediseño: repaso visual, celular, movimiento reducido y documentación», con el trailer.
