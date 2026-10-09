# Etapa 2 · Tratamientos, decisión del médico y registros editables — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cada paciente de hierro o procedimiento recorra el tablero desde la cotización hasta la reevaluación, que lo que decide el médico se registre y se cumpla, y que los registros se puedan corregir.

**Architecture:** Apps Script V8 + una sola `src/Index.html`. La lógica es pura (`Logica.gs`, `Registro.gs`, `Resultados.gs`, `Tablero.gs`) y se prueba en Node con `test/cargar.js`; los archivos `*Servidor.gs` y `Codigo.gs` leen y escriben las hojas con el candado. Todo dato nuevo va en **columnas al final** de REGISTROS y ALTAS y en **resultados nuevos** de SEGUIMIENTOS (enfoque A). La interfaz se prueba con Playwright contra el `DEMO` de `Index.html`.

**Tech Stack:** Google Apps Script (V8), HtmlService, Node 20 `node:test`, Playwright (Chromium ya instalado; **nunca** `playwright install`).

**Spec:** `docs/superpowers/specs/2026-10-09-etapa2-tratamientos-y-decisiones-design.md` (léala entera antes de empezar; las tablas de §3 son la autoridad de columnas y etiquetas).

## Global Constraints

- Idioma de toda la interfaz, los mensajes, los comentarios y los nombres de prueba: **español**.
- **Ningún dato real de pacientes** en el repositorio: DNI, nombres y teléfonos de las pruebas y del DEMO son inventados.
- No cambian ni desaparecen los nombres públicos: `doGet`, `bootstrap`, `getBandeja`, `getPaciente`, `buscar`, `marcarSeguimiento`, `descartar`, `confirmarEmparejamiento`, `asignarDniIndicacion`, `getKpi`, `getResumen`, `guardarRegistro`, `marcarSesion`, `anularRegistro`, `anularSesion`, `darDeAlta`, `anularAlta`, `getRegistrosHoy`, `buscarPacienteRegistro`, `registrarResultado`, `anularResultado`, `getTablero`. Se agregan `editarRegistro` y `getRegistros`.
- Toda escritura pasa por `bloquear_()` y termina con `soltar_(lock)`; todo lo que vuelve a la app pasa por `limpiarParaEnvio`.
- Las fechas se guardan **a mediodía** (`aFecha_`); en la lógica se manejan como texto `yyyy-mm-dd`.
- Columnas nuevas **solo al final** y solo con `encabezadoAmpliable`; ninguna fila existente se reescribe.
- **No escriba colores a mano** fuera de `:root` y `html[data-modo="oscuro"]` (la prueba «no hay colores escritos a mano» debe seguir pasando).
- No borre ni rompa el bloque `DEMO` de `Index.html`: es la forma de probar la interfaz.
- Mensajes de commit en español, sin identificadores de modelo, terminados con:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` y `Claude-Session: https://claude.ai/code/session_01GegG7K4J2pd47s8MMaA85W`.
- Agregue archivos por ruta (`git add src/X.gs test/Y.test.js`), nunca `git add -A`.
- Antes de cada commit: `npm test` y, si la tarea toca `Index.html`, `npm run test:ui`. Ambos en verde.
- Valores iniciales de REGLAS: `DIAS_POST_TRATAMIENTO` = 30, `DIAS_CONTROL_LAB` = 15, `AVISO_ALTA_CONTROL_DIAS` = 30.

## Review Focus

1. **Un registro antiguo sin `FECHA_INICIO` con sesiones ya marcadas** (los que hay hoy): debe seguir como EN CURSO o COMPLETO, nunca pasar a PROGRAMADO ni a «No vino». → prueba en la Tarea 2.
2. **«Aceptó» dos veces o desde dos pestañas** sobre la misma cotización del historial: no debe crear dos registros. → prueba en la Tarea 5 (revalidar dentro del candado).
3. **Editar SESIONES por debajo de las hechas, o editar un registro que otra asesora anuló entretanto**: se rechaza con la hoja releída dentro del candado. → prueba en la Tarea 7.
4. **Hojas sin preparar** (REGISTROS o ALTAS sin las columnas nuevas) tras `npm run subir`: guardar un control, una decisión o una edición debe negarse con «Falta preparar las hojas», sin escribir filas desalineadas. → prueba en la Tarea 1.
5. **Una consulta realizada en SOFDOC después de una decisión `ALTA 6 MESES`**: la deja sin efecto (vuelve el cálculo normal), como un alta hoy. → prueba en la Tarea 6.

---

## Mapa de archivos

| Archivo | Qué cambia |
|---|---|
| `src/Logica.gs` | `reglasDesdeFilas` (3 parámetros); `estadoDeSerie` y `armarPacientes` (retorno indicado y control de alta); `kpiMotivos` (NO DESEA REALIZARSE) |
| `src/Registro.gs` | Columnas de REGISTROS y ALTAS; `validarRegistro` (CONTROL, fecha de inicio); `estadoRegistro` (PROGRAMADO); `pendientesRegistro` (§3.1, §3.2); `validarAlta` y `altasVigentes` (decisión); `decisionesDeAlta` (nueva); `validarEdicionRegistro` (nueva); `textoRegistro` (CONTROL) |
| `src/Resultados.gs` | `RESULTADOS` (ACEPTÓ, NO DESEA REALIZARSE, `soloReevaluacion`); `validarResultado` |
| `src/Tablero.gs` | `columnaDe`, `etiquetaDe`, `armarTablero` (nuevas etiquetas, «Por reevaluar», MES por tarjeta) |
| `src/ResultadoServidor.gs` | `registrarResultado_` (ACEPTÓ escribe en REGISTROS) |
| `src/RegistroServidor.gs` | `guardarRegistro`, `darDeAlta`, `editarRegistro` (nueva), `getRegistros` (nueva), `actualizarCeldas_` (nueva), `exigirColumnas_` (nueva) |
| `src/Codigo.gs` | `bootstrap.reglas`; `derivar_` (decisiones) |
| `src/Menu.gs` | `ampliarHojas_` (REGISTROS, ALTAS, 3 parámetros); `PARAMETROS_REGISTRO` |
| `src/Index.html` | Panel por tipo, paso «Aceptó», sesiones, filtro de mes, Registro con tres opciones, Editar, confirmación, ficha, DEMO |
| `test/*.test.js` | Pruebas nuevas por tarea (nombres abajo) |
| `CLAUDE.md` | Reglas de la Etapa 2 y aviso al equipo |

---

### Tarea 1: Parámetros de REGLAS, columnas nuevas y «Preparar hojas»

**Files:**
- Modify: `src/Logica.gs` (`reglasDesdeFilas`, ~línea 193)
- Modify: `src/Registro.gs:6-9` (`COLUMNAS_REGISTROS`, `COLUMNAS_ALTAS`)
- Modify: `src/Menu.gs:50` (`PARAMETROS_REGISTRO`) y `ampliarHojas_` (~línea 70)
- Modify: `src/RegistroServidor.gs` (nueva `exigirColumnas_`)
- Modify: `src/Codigo.gs:288` (`bootstrap.reglas`)
- Test: `test/logica-estado.test.js`, `test/menu.test.js`, `test/registro-servidor.test.js`

**Interfaces:**
- Produces: `reglas.postTratamiento` (30), `reglas.controlLab` (15), `reglas.avisoAltaControl` (30); `COLUMNAS_REGISTROS` termina en `'FECHA_INICIO', 'EXAMENES', 'FECHA_RETORNO', 'EDITADO'`; `COLUMNAS_ALTAS` termina en `'DECISION', 'FECHA_RETORNO'`; `exigirColumnas_(nombre, columnas)` lanza `Error('Falta preparar las hojas: en el Sheets, menú Seguimientos → Preparar hojas.')`.

- [ ] **Paso 1: Pruebas que fallan**

En `test/logica-estado.test.js`, al final:

```js
test('reglas: plazos de la Etapa 2 y sus valores por omisión', () => {
  const vacias = L.reglasDesdeFilas(['PARAMETRO', 'VALOR'], []);
  assert.deepEqual([vacias.postTratamiento, vacias.controlLab, vacias.avisoAltaControl], [30, 15, 30]);
  const r = L.reglasDesdeFilas(['PARAMETRO', 'VALOR'], [['DIAS_POST_TRATAMIENTO', 45], ['DIAS_CONTROL_LAB', 10], ['AVISO_ALTA_CONTROL_DIAS', 20]]);
  assert.deepEqual([r.postTratamiento, r.controlLab, r.avisoAltaControl], [45, 10, 20]);
});
```

En `test/menu.test.js`, reemplace dentro de la prueba `'ampliarHojas_: REFERENCIA en SEGUIMIENTOS, …'` las dos aserciones de REGLAS y la del total por:

```js
  assert.deepEqual(reg.v.slice(2).map(f => [f[4], f[5]]), [['ESPERA_COTIZACION_DIAS', 7], ['DIAS_ENTRE_SESIONES', 7], ['GRACIA_AGENDA_DIAS', 2],
    ['META_DIARIA_SEGUIMIENTOS', 15], ['DIAS_POST_TRATAMIENTO', 30], ['DIAS_CONTROL_LAB', 15], ['AVISO_ALTA_CONTROL_DIAS', 30]]);
  assert.equal(cambios.length, 10, 'SEGUIMIENTOS, CATALOGOS, ALTA MÉDICA y los siete parámetros');
```

Y agregue al final de `test/menu.test.js`:

```js
test('ampliarHojas_: REGISTROS y ALTAS reciben sus columnas nuevas al final, una sola vez', () => {
  const { ctx } = contexto();
  const COLS_REG = ['ID', 'FECHA_HORA', 'FECHA', 'ASESORA', 'DOCTOR', 'NOMBRE', 'DNI', 'CONTACTO', 'TIPO', 'DETALLE', 'MARCA', 'SESIONES', 'ANULADO', 'MOTIVO_ANULACION'];
  const COLS_ALT = ['ID', 'FECHA_HORA', 'FECHA', 'DNI', 'ESPECIALIDAD', 'DOCTOR', 'REGISTRADO_POR', 'NOTA', 'ANULADO', 'MOTIVO_ANULACION'];
  const reg = hojaFalsa([COLS_REG, ['REG-000001', '2026-10-01 09:00', '2026-10-01', 'MAGALY', 'Dra. X', 'ROSA PRUEBA', '40111222', '987654321', 'HIERRO', 'HIERRO SACARATO', '', 2, '', '']]);
  const alt = hojaFalsa([COLS_ALT]);
  ctx.ss_ = () => ({ getSheetByName: n => ({ REGISTROS: reg, ALTAS: alt })[n] || null });
  const cambios = [...ctx.ampliarHojas_()];
  assert.deepEqual(reg.v[0].slice(14), ['FECHA_INICIO', 'EXAMENES', 'FECHA_RETORNO', 'EDITADO']);
  assert.deepEqual(reg.v[1].slice(0, 3), ['REG-000001', '2026-10-01 09:00', '2026-10-01'], 'no toca las filas');
  assert.deepEqual(alt.v[0].slice(10), ['DECISION', 'FECHA_RETORNO']);
  assert.ok(cambios.some(c => /^REGISTROS: columna FECHA_INICIO, EXAMENES, FECHA_RETORNO, EDITADO\.$/.test(c)));
  assert.deepEqual([...ctx.ampliarHojas_()].filter(c => /REGISTROS|ALTAS/.test(c)), [], 'la segunda vez no cambia nada');
});
```

En `test/registro-servidor.test.js`, al final:

```js
test('exigirColumnas_: sin las columnas nuevas de REGISTROS no se escribe', () => {
  const ctx = cargar(['Logica.gs', 'Registro.gs', 'Resultados.gs', 'Tablero.gs', 'Codigo.gs', 'RegistroServidor.gs']);
  ctx.hoja_ = () => ({ getRange: () => ({ getValues: () => [['ID', 'FECHA_HORA', 'FECHA']] }), getLastColumn: () => 3 });
  assert.throws(() => ctx.exigirColumnas_('REGISTROS', ctx.COLUMNAS_REGISTROS), /Falta preparar las hojas/);
});
```

- [ ] **Paso 2: Ver que fallan**

Run: `node --test test/logica-estado.test.js test/menu.test.js test/registro-servidor.test.js 2>&1 | grep -E "^not ok"`
Expected: 4 `not ok` (reglas, ampliarHojas_ ×2, exigirColumnas_).

- [ ] **Paso 3: Implementación**

En `reglasDesdeFilas` (`src/Logica.gs`), agregue al objeto inicial `postTratamiento: 30, controlLab: 15, avisoAltaControl: 30` y dentro del `forEach`:

```js
    if (par === 'DIAS_POST_TRATAMIENTO') r.postTratamiento = entero_(val, 30);
    if (par === 'DIAS_CONTROL_LAB') r.controlLab = entero_(val, 15, 1);
    if (par === 'AVISO_ALTA_CONTROL_DIAS') r.avisoAltaControl = entero_(val, 30);
```

En `src/Registro.gs`:

```js
var COLUMNAS_REGISTROS = ['ID', 'FECHA_HORA', 'FECHA', 'ASESORA', 'DOCTOR', 'NOMBRE', 'DNI', 'CONTACTO', 'TIPO',
  'DETALLE', 'MARCA', 'SESIONES', 'ANULADO', 'MOTIVO_ANULACION', 'FECHA_INICIO', 'EXAMENES', 'FECHA_RETORNO', 'EDITADO'];
var COLUMNAS_ALTAS = ['ID', 'FECHA_HORA', 'FECHA', 'DNI', 'ESPECIALIDAD', 'DOCTOR', 'REGISTRADO_POR', 'NOTA', 'ANULADO', 'MOTIVO_ANULACION',
  'DECISION', 'FECHA_RETORNO'];
```

En `src/Codigo.gs`, agregue `FECHA_INICIO: 1, FECHA_RETORNO: 1` a `COLUMNAS_FECHA` (línea 23) para que se guarden como fecha.

En `src/Menu.gs`:

```js
var PARAMETROS_REGISTRO = [['ESPERA_COTIZACION_DIAS', 7], ['DIAS_ENTRE_SESIONES', 7], ['GRACIA_AGENDA_DIAS', 2], ['META_DIARIA_SEGUIMIENTOS', 15],
  ['DIAS_POST_TRATAMIENTO', 30], ['DIAS_CONTROL_LAB', 15], ['AVISO_ALTA_CONTROL_DIAS', 30]];
```

Y en `ampliarHojas_`, justo después del bloque de SEGUIMIENTOS:

```js
  [['REGISTROS', COLUMNAS_REGISTROS], ['ALTAS', COLUMNAS_ALTAS]].forEach(function (par) {
    var sh = ss.getSheetByName(par[0]);
    if (!sh) return;
    var cab = encabezado_(sh), plan = encabezadoAmpliable(cab, par[1]);
    if (plan.error) cambios.push('✗ ' + par[0] + ': ' + plan.error);
    else if (plan.agregar.length) {
      sh.getRange(1, cab.length + 1, 1, plan.agregar.length).setValues([plan.agregar]).setFontWeight('bold');
      cambios.push(par[0] + ': columna ' + plan.agregar.join(', ') + '.');
    }
  });
```

En `src/RegistroServidor.gs`, debajo de `exigirMotivo_`:

```js
/** REGISTROS y ALTAS se escriben por posición: sin sus columnas nuevas, una fila quedaría desalineada. */
function exigirColumnas_(nombre, columnas) {
  var plan = encabezadoAmpliable(encabezado_(hoja_(nombre)), columnas);
  if (plan.error || plan.agregar.length) throw new Error('Falta preparar las hojas: en el Sheets, menú Seguimientos → Preparar hojas.');
}
```

`encabezado_` vive en `Menu.gs`; `RegistroServidor.gs` no lo carga en las pruebas. Mueva `encabezado_` de `src/Menu.gs` a `src/Codigo.gs` (justo después de `hoja_`), sin cambiarla.

Llame a `exigirColumnas_('REGISTROS', COLUMNAS_REGISTROS)` como primera línea dentro del `try` de `guardarRegistro`, y a `exigirColumnas_('ALTAS', COLUMNAS_ALTAS)` dentro del `try` de `darDeAlta`. En el arnés `servidor()` de `test/registro-servidor.test.js` agregue `ctx.exigirColumnas_ = () => {};` para que las pruebas existentes no dependan de una hoja real (la prueba nueva no usa `servidor()`: arma su propio `ctx` con `cargar`, así prueba la función real).

En `bootstrap` (`src/Codigo.gs:288`) agregue a `reglas`: `postTratamiento: d.reglas.postTratamiento, controlLab: d.reglas.controlLab, avisoAltaControl: d.reglas.avisoAltaControl`. Actualice la prueba `'bootstrap: reglas con las siete claves…'` de `test/resultado-servidor.test.js` para que espere las diez claves.

- [ ] **Paso 4: Ver que pasan**

Run: `npm test 2>&1 | grep -E "^# (pass|fail)"`
Expected: `# fail 0`.

- [ ] **Paso 5: Commit**

```bash
git add src/Logica.gs src/Registro.gs src/Menu.gs src/Codigo.gs src/RegistroServidor.gs test/logica-estado.test.js test/menu.test.js test/registro-servidor.test.js test/resultado-servidor.test.js
git commit -m "Etapa 2: plazos nuevos en REGLAS y columnas nuevas de REGISTROS y ALTAS"
```

---

### Tarea 2: Registro de control y fecha de inicio; estado PROGRAMADO

**Files:**
- Modify: `src/Registro.gs` (`validarRegistro`, `estadoRegistro`, `textoRegistro`)
- Test: `test/logica-registro.test.js`

**Interfaces:**
- Consumes: `COLUMNAS_REGISTROS` (Tarea 1), `reglas.controlLab`.
- Produces: `validarRegistro(p, catalogos, hoy)` acepta `p.tipo === 'CONTROL'` (`doctor`, `examenes`, `fechaRetorno`) y `p.fechaInicio` en indicaciones; filas con `FECHA_INICIO`, `EXAMENES`, `FECHA_RETORNO`. `estadoRegistro(r, sesiones)` devuelve `estado` ∈ `COTIZADO | PROGRAMADO | EN CURSO | COMPLETO | ANULADO` y además `inicio` (fecha de inicio o ''). `textoRegistro` de un CONTROL: `'Control + laboratorio'` + `' · ' + EXAMENES` si hay.

- [ ] **Paso 1: Pruebas que fallan** (al final de `test/logica-registro.test.js`; reutilice el `CAT` y `datos` que ya define el archivo, o defina estos):

```js
const CAT2 = { usuarios: ['MAGALY'], doctores: [{ doctor: 'Dra. Karen Matos', sofdoc: 'Dra. KAREN DIANA MATOS PEÑA' }],
  procedimientos: ['SANGRÍA'], tratamientos: ['HIERRO SACARATO'], marcas: {} };
const base2 = o => Object.assign({ usuario: 'MAGALY', dni: '40111222', nombre: 'Rosa Prueba', contacto: '987654321', fecha: '2026-10-09', doctor: 'Dra. Karen Matos' }, o);

test('validarRegistro: control + laboratorio con exámenes y fecha de retorno', () => {
  const v = L.validarRegistro(base2({ tipo: 'CONTROL', examenes: ' hemograma,  ferritina ', fechaRetorno: '2026-10-24' }), CAT2, '2026-10-09');
  assert.equal(v.error, '');
  assert.deepEqual(plano(v.filas).map(f => [f.TIPO, f.DETALLE, f.EXAMENES, f.FECHA_RETORNO, f.SESIONES]),
    [['CONTROL', 'CONTROL', 'hemograma, ferritina', '2026-10-24', 0]]);
  assert.match(L.validarRegistro(base2({ tipo: 'CONTROL', fechaRetorno: '' }), CAT2, '2026-10-09').error, /fecha de retorno/);
  assert.match(L.validarRegistro(base2({ tipo: 'CONTROL', fechaRetorno: '2026-10-09' }), CAT2, '2026-10-09').error, /después de hoy/);
});

test('validarRegistro: la fecha de la primera sesión es opcional, de hoy en adelante', () => {
  const v = L.validarRegistro(base2({ tratamiento: 'HIERRO SACARATO', sesiones: 3, fechaInicio: '2026-10-12' }), CAT2, '2026-10-09');
  assert.equal(plano(v.filas)[0].FECHA_INICIO, '2026-10-12');
  assert.equal(plano(L.validarRegistro(base2({ procedimiento: 'SANGRÍA' }), CAT2, '2026-10-09').filas)[0].FECHA_INICIO, '');
  assert.match(L.validarRegistro(base2({ procedimiento: 'SANGRÍA', fechaInicio: '2026-10-01' }), CAT2, '2026-10-09').error, /no puede ser pasada/);
});

test('estadoRegistro: COTIZADO, PROGRAMADO, EN CURSO y COMPLETO; los antiguos sin fecha de inicio no cambian', () => {
  const r = o => Object.assign({ ID: 'REG-1', FECHA: '2026-10-01', SESIONES: '3', ANULADO: '', FECHA_INICIO: '' }, o);
  const s = n => ({ ID: 'SES-' + n, ID_REGISTRO: 'REG-1', NUMERO: String(n), FECHA: '2026-10-0' + (n + 1), ANULADO: '' });
  assert.equal(L.estadoRegistro(r(), []).estado, 'COTIZADO');
  assert.deepEqual(plano(L.estadoRegistro(r({ FECHA_INICIO: '2026-10-12' }), [])), { estado: 'PROGRAMADO', hechas: 0, total: 3, ultima: '', inicio: '2026-10-12' });
  assert.equal(L.estadoRegistro(r(), [s(1)]).estado, 'EN CURSO', 'un registro antiguo con sesiones sigue EN CURSO');
  assert.equal(L.estadoRegistro(r({ FECHA_INICIO: '2026-10-12' }), [s(1), s(2), s(3)]).estado, 'COMPLETO');
  assert.equal(L.estadoRegistro(r({ TIPO: 'CONTROL', SESIONES: '0', FECHA_RETORNO: '2026-10-24' }), []).estado, 'PROGRAMADO');
});

test('textoRegistro de un control', () => {
  assert.equal(L.textoRegistro({ TIPO: 'CONTROL', DETALLE: 'CONTROL', EXAMENES: 'hemograma' }), 'Control + laboratorio · hemograma');
  assert.equal(L.textoRegistro({ TIPO: 'CONTROL', DETALLE: 'CONTROL', EXAMENES: '' }), 'Control + laboratorio');
});
```

- [ ] **Paso 2: Ver que fallan** — Run: `node --test test/logica-registro.test.js 2>&1 | grep -E "^not ok"` → 4 `not ok`.

- [ ] **Paso 3: Implementación** en `src/Registro.gs`.

`textoRegistro` (línea 52), primera línea del cuerpo:

```js
  if (normTexto(r.TIPO) === 'CONTROL') return 'Control + laboratorio' + (textoLimpio_(r.EXAMENES) ? ' · ' + textoLimpio_(r.EXAMENES) : '');
```

`validarRegistro`: después de validar `doctor` y antes de leer `proc`/`trat`, agregue:

```js
  var base0 = { FECHA: fecha, ASESORA: asesora, DOCTOR: doctor.doctor, NOMBRE: nombre, DNI: normDni(p.dni), CONTACTO: contacto,
    MARCA: '', ANULADO: '', MOTIVO_ANULACION: '', FECHA_INICIO: '', EXAMENES: '', FECHA_RETORNO: '', EDITADO: '' };
  if (normTexto(p.tipo) === 'CONTROL') {
    var ret = fechaIso(p.fechaRetorno);
    if (!ret) return no('Falta la fecha de retorno a control.');
    if (ret <= hoy) return no('La fecha de retorno debe ser después de hoy.');
    if (ret > sumarDias(hoy, 365)) return no('La fecha de retorno va hasta un año desde hoy.');
    return { error: '', filas: [copia_(base0, { TIPO: 'CONTROL', DETALLE: 'CONTROL', SESIONES: 0, EXAMENES: textoLimpio_(p.examenes), FECHA_RETORNO: ret })] };
  }
  var inicio = fechaIso(p.fechaInicio);
  if (textoLimpio_(p.fechaInicio) && !inicio) return no('La fecha de la primera sesión no es válida.');
  if (inicio && inicio < hoy) return no('La fecha de la primera sesión no puede ser pasada.');
  if (inicio && inicio > sumarDias(hoy, 180)) return no('La fecha de la primera sesión va hasta 180 días desde hoy.');
  base0.FECHA_INICIO = inicio || '';
```

y reemplace la línea `var base = { FECHA: fecha, … };` por `var base = base0;`.

`estadoRegistro`:

```js
function estadoRegistro(r, sesiones) {
  var propias = sesionesDe_(r.ID, sesiones);
  var control = normTexto(r.TIPO) === 'CONTROL';
  var total = control ? 0 : Math.max(1, Number(r.SESIONES) || 1);
  var ultima = propias.length ? fechaIso(propias[propias.length - 1].FECHA) : '';
  var inicio = fechaIso(control ? r.FECHA_RETORNO : r.FECHA_INICIO) || '';
  var estado = anulado_(r) ? 'ANULADO' : control ? 'PROGRAMADO' : propias.length >= total ? 'COMPLETO' : propias.length ? 'EN CURSO'
    : inicio ? 'PROGRAMADO' : 'COTIZADO';
  return { estado: estado, hechas: propias.length, total: total, ultima: ultima, inicio: inicio };
}
```

Revise las pruebas existentes de `estadoRegistro` que hacen `deepEqual` del objeto completo: agregue `inicio: ''` donde corresponda.

`indicacionesDeRegistros`: un CONTROL no es una indicación de hierro ni de procedimiento. Agregue al principio del `map`: `if (normTexto(r.TIPO) === 'CONTROL') return null;`.

- [ ] **Paso 4: Ver que pasan** — Run: `npm test 2>&1 | grep -E "^# (pass|fail)"` → `# fail 0`.

- [ ] **Paso 5: Commit**

```bash
git add src/Registro.gs test/logica-registro.test.js
git commit -m "Etapa 2: registro de control + laboratorio, fecha de inicio y estado PROGRAMADO"
```

---

### Tarea 3: El recorrido del hierro y el control en la bandeja (pendientesRegistro)

**Files:**
- Modify: `src/Registro.gs` (`pendientesRegistro`, ~línea 175)
- Test: `test/logica-registro.test.js`

**Interfaces:**
- Consumes: `estadoRegistro` con `inicio` (Tarea 2); `reglas.postTratamiento`, `reglas.graciaAgenda`, `reglas.diasEntreSesiones`.
- Produces: cada fila de `pendientesRegistro` lleva, además de lo de hoy:
  - `ESTADO` ∈ `PENDIENTE | AGENDADO | EN TRATAMIENTO | COMPLETADO | POR REEVALUAR | CERRADO | FALLECIDO | EN ESPERA | ANTIGUO`
  - `MOTIVO_PENDIENTE` ∈ `'' | 'NO VINO' | 'CONTROL VENCIDO'`
  - `AGENDA` puede ser `'SESION'` (con `FECHA_AGENDA` = fecha programada) o `'CONTROL'` (con `FECHA_AGENDA` = `FECHA_RETORNO`)
  - `FECHA_REEVALUAR` = última sesión + `postTratamiento` (solo COMPLETO)
  - `VOLVIO` = fecha de la consulta realizada que cierra el control o la reevaluación post-tratamiento ('' si no)
  - `TIPO_SEGUIMIENTO`: `HIERRO | PROCEDIMIENTO | CONTROL`

Reglas (spec §3.1 y §3.2), en este orden, después de `FALLECIDO` y del cierre por resultado:

| Caso | `ESTADO` | Otros campos |
|---|---|---|
| CONTROL, hay consulta realizada con `FECHA` ≥ `FECHA` del registro | `COMPLETADO` | `VOLVIO` = esa fecha |
| CONTROL, hoy ≤ `FECHA_RETORNO` + gracia | `AGENDADO` | `AGENDA: 'CONTROL'` |
| CONTROL, después | `PENDIENTE` | `MOTIVO_PENDIENTE: 'CONTROL VENCIDO'`; la espera es desde `FECHA_RETORNO` |
| PROGRAMADO, hoy ≤ inicio + gracia | `AGENDADO` | `AGENDA: 'SESION'`, `FECHA_AGENDA: inicio` |
| PROGRAMADO, después | `PENDIENTE` | `MOTIVO_PENDIENTE: 'NO VINO'` |
| EN CURSO | como hoy (EN TRATAMIENTO dentro de `diasEntreSesiones`; luego PENDIENTE con `ATRASO`) | — |
| COMPLETO, hay consulta realizada después de la última sesión | `COMPLETADO` | `VOLVIO` = esa fecha |
| COMPLETO, hoy < última + `postTratamiento` | `COMPLETADO` | `FECHA_REEVALUAR` |
| COMPLETO, después | `POR REEVALUAR` | `FECHA_REEVALUAR` |

Los resultados SIGUE (No contestó, Lo pensará, Agendó cita) siguen mandando sobre PENDIENTE y POR REEVALUAR (`c.agenda` → `AGENDADO`), igual que hoy. Para POR REEVALUAR, los seguimientos que cuentan son los posteriores a `FECHA_REEVALUAR`.

- [ ] **Paso 1: Pruebas que fallan** (al final de `test/logica-registro.test.js`):

```js
function dReg(registros, sesiones, citas, hoy, segs) {
  return { registros, sesiones: sesiones || [], citas: citas || [], seguimientos: segs || [], reglas: reglas(L), hoy,
    telefonos: { 40111222: ['987654321'] }, catalogos: CAT2 };
}
const REGH = o => Object.assign({ ID: 'REG-000010', FECHA: '2026-10-01', ASESORA: 'MAGALY', DOCTOR: 'Dra. Karen Matos', NOMBRE: 'ROSA PRUEBA',
  DNI: '40111222', CONTACTO: '987654321', TIPO: 'HIERRO', DETALLE: 'HIERRO SACARATO', MARCA: '', SESIONES: '2', ANULADO: '', FECHA_INICIO: '' }, o);
const SES = (n, f) => ({ ID: 'SES-00000' + n, ID_REGISTRO: 'REG-000010', NUMERO: String(n), FECHA: f, ANULADO: '' });
const fila = d => plano(L.pendientesRegistro(d))[0];

test('pendientesRegistro: programado → Agendado «Sesión»; pasada la gracia sin sesión → Por contactar «No vino»', () => {
  const r = REGH({ FECHA_INICIO: '2026-10-12' });
  assert.deepEqual([fila(dReg([r], [], [], '2026-10-10')).ESTADO, fila(dReg([r], [], [], '2026-10-10')).AGENDA, fila(dReg([r], [], [], '2026-10-10')).FECHA_AGENDA],
    ['AGENDADO', 'SESION', '2026-10-12']);
  assert.equal(fila(dReg([r], [], [], '2026-10-14')).ESTADO, 'AGENDADO', 'dentro de la gracia de 2 días');
  const f = fila(dReg([r], [], [], '2026-10-15'));
  assert.deepEqual([f.ESTADO, f.MOTIVO_PENDIENTE], ['PENDIENTE', 'NO VINO']);
});

test('pendientesRegistro: completo → Completado con fecha para reevaluar; a los 30 días → POR REEVALUAR; si volvió → Completado', () => {
  const r = REGH({ FECHA_INICIO: '2026-10-02' }), ses = [SES(1, '2026-10-02'), SES(2, '2026-10-09')];
  const antes = fila(dReg([r], ses, [], '2026-10-20'));
  assert.deepEqual([antes.ESTADO, antes.FECHA_REEVALUAR], ['COMPLETADO', '2026-11-08']);
  assert.equal(fila(dReg([r], ses, [], '2026-11-08')).ESTADO, 'POR REEVALUAR');
  const volvio = fila(dReg([r], ses, [cita({ fecha: '2026-11-05' })], '2026-11-20'));
  assert.deepEqual([volvio.ESTADO, volvio.VOLVIO], ['COMPLETADO', '2026-11-05']);
});

test('pendientesRegistro: «Agendó cita» sobre POR REEVALUAR lo deja en Agendado', () => {
  const r = REGH({ FECHA_INICIO: '2026-10-02' }), ses = [SES(1, '2026-10-02'), SES(2, '2026-10-09')];
  const seg = { ID: 'SEG-1', FECHA_HORA: '2026-11-09 10:00', DNI: '40111222', ESPECIALIDAD: 'HIERRO', RESPONSABLE: 'MAGALY', ACCION: 'HECHO',
    REFERENCIA: 'REG-000010', RESULTADO: 'AGENDÓ CITA', FECHA_PROXIMA: '2026-11-15', ANULADO: '' };
  const f = fila(dReg([r], ses, [], '2026-11-10', [seg]));
  assert.deepEqual([f.ESTADO, f.AGENDA, f.FECHA_AGENDA], ['AGENDADO', 'CITA', '2026-11-15']);
});

test('pendientesRegistro: control + laboratorio → Agendado; vencido → Por contactar; con consulta → Completado', () => {
  const c = REGH({ TIPO: 'CONTROL', DETALLE: 'CONTROL', SESIONES: '0', EXAMENES: 'hemograma', FECHA_RETORNO: '2026-10-16' });
  const a = fila(dReg([c], [], [], '2026-10-10'));
  assert.deepEqual([a.ESTADO, a.AGENDA, a.FECHA_AGENDA, a.TIPO_SEGUIMIENTO], ['AGENDADO', 'CONTROL', '2026-10-16', 'CONTROL']);
  const v = fila(dReg([c], [], [], '2026-10-19'));
  assert.deepEqual([v.ESTADO, v.MOTIVO_PENDIENTE], ['PENDIENTE', 'CONTROL VENCIDO']);
  const ok = fila(dReg([c], [], [cita({ fecha: '2026-10-15' })], '2026-10-19'));
  assert.deepEqual([ok.ESTADO, ok.VOLVIO], ['COMPLETADO', '2026-10-15']);
});

test('pendientesRegistro: un registro antiguo sin fecha de inicio sigue como hasta hoy', () => {
  const r = REGH();
  assert.equal(fila(dReg([r], [], [], '2026-10-05')).ESTADO, 'EN ESPERA');
  assert.equal(fila(dReg([r], [], [], '2026-10-09')).ESTADO, 'PENDIENTE');
  assert.equal(fila(dReg([r], [SES(1, '2026-10-03')], [], '2026-10-05')).ESTADO, 'EN TRATAMIENTO');
});
```

(`cita` y `reglas` vienen de `./fixtures`; impórtelos en la cabecera del archivo si todavía no están.)

- [ ] **Paso 2: Ver que fallan** — 4 `not ok` (la última ya pasa: es la guarda de lo antiguo).

- [ ] **Paso 3: Implementación.** En `pendientesRegistro`, reemplace el cálculo de `desde`, `lista` y `estado` por este bloque (lo demás del objeto que devuelve queda igual, más los campos nuevos al final):

```js
    var e = estadoRegistro(r, d.sesiones);
    if (e.estado === 'ANULADO') return null;
    var dni = normDni(r.DNI), control = normTexto(r.TIPO) === 'CONTROL';
    var realizadas = porDni[dni] || [], ultima = realizadas[realizadas.length - 1];
    var despues = function (f) { return realizadas.filter(function (c) { return c.FECHA >= f; })[0]; };
    var enCurso = e.estado === 'EN CURSO', programado = e.estado === 'PROGRAMADO';
    var reevaluar = e.estado === 'COMPLETO' && e.ultima ? sumarDias(e.ultima, reglas.postTratamiento) : '';
    var desde = control ? fechaIso(r.FECHA) : enCurso ? e.ultima : programado ? e.inicio : reevaluar || fechaIso(r.FECHA);
    var lista = (segs[r.ID] || []).filter(function (s) { return fechaIso(s.FECHA_HORA) >= desde; }).sort(porFechaHora_);
    var c = leerCiclo(lista, reglas, hoy);
    var tel = normTelefono(r.CONTACTO), usuario = tel.length === 9 ? '' : textoLimpio_(r.CONTACTO);
    var sc = sinContacto_(dni, marcas, d.telefonos, usuario), cierre = c.cierre, estado = 'PENDIENTE', motivo = '', volvio = '';
    var agenda = c.agenda;
    var dias = Math.max(0, diasEntre(desde, hoy)), espera = enCurso ? reglas.diasEntreSesiones : reglas.esperaCotizacion;
    var vuelta = control ? despues(fechaIso(r.FECHA)) : e.estado === 'COMPLETO' ? (realizadas.filter(function (x) { return x.FECHA > e.ultima; })[0]) : null;
    if (muertos[dni]) estado = 'FALLECIDO';
    else if (cierre) estado = 'CERRADO';
    else if (sc) { estado = 'CERRADO'; cierre = { motivo: 'NÚMERO EQUIVOCADO', fecha: sc }; }
    else if (vuelta) { estado = 'COMPLETADO'; volvio = vuelta.FECHA; }
    else if (agenda) estado = 'AGENDADO';
    else if (control) {
      if (hoy <= sumarDias(e.inicio, reglas.graciaAgenda)) { estado = 'AGENDADO'; agenda = { tipo: 'CONTROL', fecha: e.inicio, intento: 0 }; }
      else { motivo = 'CONTROL VENCIDO'; dias = Math.max(0, diasEntre(e.inicio, hoy)); }
    } else if (programado) {
      if (hoy <= sumarDias(e.inicio, reglas.graciaAgenda)) { estado = 'AGENDADO'; agenda = { tipo: 'SESION', fecha: e.inicio, intento: 0 }; }
      else motivo = 'NO VINO';
    } else if (e.estado === 'COMPLETO') estado = hoy < reevaluar ? 'COMPLETADO' : 'POR REEVALUAR';
    else if (dias < espera) estado = enCurso ? 'EN TRATAMIENTO' : 'EN ESPERA';
    else if (dias > reglas.corteIndicaciones) estado = 'ANTIGUO';
```

Y en el objeto devuelto: `TIPO_SEGUIMIENTO: control ? 'CONTROL' : r.TIPO`, `ESPECIALIDAD: r.TIPO`, `AGENDA: agenda ? agenda.tipo : ''`, `FECHA_AGENDA: agenda ? agenda.fecha : ''`, `INTENTO: agenda ? agenda.intento : 0`, y los nuevos `MOTIVO_PENDIENTE: motivo`, `FECHA_REEVALUAR: reevaluar`, `VOLVIO: volvio`, `EXAMENES: textoLimpio_(r.EXAMENES)`, `FECHA_INICIO: e.inicio`. Quite las líneas viejas que este bloque reemplaza (las declaraciones duplicadas de `realizadas` y `ultima` más abajo).

Agregue `CONTROL: 1` a `TIPOS_INDICACION`? **No**: `TIPOS_INDICACION` decide qué cuenta como hierro o procedimiento en las cifras. En su lugar, en `validarResultado` (Tarea 4) y en `armarTablero` (Tarea 4) se reconoce `TIPO_SEGUIMIENTO === 'CONTROL'`.

- [ ] **Paso 4: Ver que pasan** — `npm test` → `# fail 0` (las pruebas existentes de `pendientesRegistro` deben seguir verdes; si alguna espera `ESPECIALIDAD` o `TIPO_SEGUIMIENTO` de un control, no hay ninguna hoy).

- [ ] **Paso 5: Commit** — `git add src/Registro.gs test/logica-registro.test.js` · mensaje: `Etapa 2: sesión programada, no vino, por reevaluar y control + laboratorio en la bandeja`.

---

### Tarea 4: Resultados nuevos y el tablero (columnas, etiquetas, MES)

**Files:**
- Modify: `src/Resultados.gs` (`RESULTADOS`, `ORDEN_RESULTADOS`, `validarResultado`)
- Modify: `src/Tablero.gs` (`columnaDe`, `etiquetaDe`, `armarTablero`)
- Modify: `src/Logica.gs` (`kpiMotivos`)
- Test: `test/logica-resultados.test.js`, `test/logica-tablero.test.js`, `test/logica-kpi.test.js`

**Interfaces:**
- Consumes: filas de `pendientesRegistro` (Tarea 3).
- Produces:
  - `RESULTADOS['ACEPTO'] = { nombre: 'ACEPTÓ', grupo: 'SIGUE', pide: 'FECHA', soloIndicacion: true }`
  - `RESULTADOS['NO DESEA REALIZARSE'] = { nombre: 'NO DESEA REALIZARSE', grupo: 'CIERRE', pide: 'MOTIVO', soloIndicacion: true }`
  - `RESULTADOS['AGENDO CITA'].soloReevaluacion = true`
  - `validarResultado` devuelve para ACEPTÓ `fila.FECHA_PROXIMA` = fecha de inicio y `fila.NOTA` = `'Sesiones: n'` si viene `p.sesiones`.
  - Cada tarjeta de `armarTablero` lleva `MES` (`yyyy-mm`).

Reglas de `validarResultado`:
- `soloIndicacion` (ACEPTÓ, NO DESEA REALIZARSE, LO HIZO) → error `'«Aceptó» es solo para hierro y procedimientos.'` si la tarjeta no es HIERRO ni PROCEDIMIENTO, o si es POR REEVALUAR o CONTROL.
- `soloReevaluacion` (AGENDÓ CITA) → error `'«Agendó cita» es solo para reevaluaciones. Use «Aceptó».'` si la tarjeta es HIERRO o PROCEDIMIENTO y **no** está POR REEVALUAR. En CONTROL y POR REEVALUAR sí se permite.
- ACEPTÓ: fecha obligatoria, de hoy a 180 días (`'La fecha de inicio va de hoy a 180 días.'`); `p.sesiones` opcional, entero de 1 a `MAX_SESIONES`.
- NO DESEA REALIZARSE: motivo obligatorio (`'Escriba el motivo.'`), `fila.NOTA = 'Motivo: ' + motivo`, `fila.MOTIVO = 'NO DESEA REALIZARSE'`.
- LO HIZO: ya no se ofrece en la app, pero se sigue aceptando (lo usa `descartar`/pestañas viejas y el DEMO antiguo).

Reglas de `columnaDe` y `etiquetaDe` (spec §3):

| Fila | Columna | Etiqueta |
|---|---|---|
| `ESTADO` PENDIENTE, `MOTIVO_PENDIENTE` NO VINO | POR_CONTACTAR | `'No vino a su sesión ' + (HECHAS+1) + ' (' + dm(FECHA_INICIO) + ')'` |
| PENDIENTE, CONTROL VENCIDO | POR_CONTACTAR | `'Debía volver con resultados el ' + dm(FECHA_AGENDA o el FECHA_RETORNO)` — use el campo `FECHA_INICIO` (= retorno en un control) |
| `POR REEVALUAR` | POR_CONTACTAR | `'Por reevaluar · terminó el ' + dm(ULTIMA_SESION)` |
| AGENDADO, `AGENDA` SESION | AGENDADO | `'Sesión ' + (HECHAS+1) + ' el ' + diaCorto(FECHA_AGENDA)` |
| AGENDADO, `AGENDA` CONTROL | AGENDADO | `'Control con resultados el ' + diaCorto(FECHA_AGENDA)` |
| EN TRATAMIENTO | EN_TRATAMIENTO | `'Sesión ' + HECHAS + ' de ' + SESIONES + ' · faltan ' + (SESIONES−HECHAS) + ' · próxima ~' + dm(ULTIMA_SESION + diasEntreSesiones)` |
| COMPLETADO con `VOLVIO` | COMPLETADO (si `VOLVIO` es de este mes) | `'Volvió el ' + dm(VOLVIO)` |
| COMPLETADO con `FECHA_REEVALUAR` (registro COMPLETO, sin `VOLVIO`) | COMPLETADO (si la última sesión es de este mes) | `'Completó el ' + dm(ULTIMA_SESION) + ' · reevaluar el ' + dm(FECHA_REEVALUAR)` |

`POR REEVALUAR` entra en `ordenarBandeja` como `PENDIENTE` (agregue `|| p.ESTADO === 'POR REEVALUAR'` al filtro de `otros`). **Una sola tarjeta por necesidad:** en `armarTablero`, si hay una tarjeta POR REEVALUAR para un DNI, quite de POR_CONTACTAR la tarjeta de reevaluación (TIPO_SEGUIMIENTO REEVALUACION) del mismo DNI y de la especialidad `ESPECIALIDAD_CONSULTA` de esa fila.

`MES` de cada tarjeta: REEVALUACION → `mesDe(ULTIMA_CITA)`; demás → `mesDe(FECHA_COTIZACION)`.

`kpiMotivos`: además de lo de hoy, cuente las filas con `RESULTADO` = NO DESEA REALIZARSE aunque su `ESPECIALIDAD` sea HIERRO o PROCEDIMIENTO.

- [ ] **Paso 1: Pruebas que fallan.**

En `test/logica-resultados.test.js`:

```js
test('validarResultado: «Aceptó» y «No desea realizarse» solo en hierro y procedimiento; «Agendó cita» solo en reevaluación', () => {
  const t = (o) => Object.assign({ DNI: '40111222', ESPECIALIDAD: 'HIERRO', TIPO_SEGUIMIENTO: 'HIERRO', ID_REGISTRO: 'REG-000010', ESTADO: 'PENDIENTE' }, o);
  const d = tarjetas => ({ catalogos: { usuarios: ['MAGALY'], doctores: [] }, hoy: '2026-10-09', tarjetas });
  const p = o => Object.assign({ usuario: 'MAGALY', dni: '40111222', especialidad: 'HIERRO', referencia: 'REG-000010' }, o);
  const ok = L.validarResultado(p({ resultado: 'ACEPTÓ', fecha: '2026-10-12', sesiones: 3 }), d([t()]));
  assert.deepEqual([ok.error, ok.fila.RESULTADO, ok.fila.FECHA_PROXIMA, ok.fila.NOTA], ['', 'ACEPTÓ', '2026-10-12', 'Sesiones: 3']);
  assert.match(L.validarResultado(p({ resultado: 'ACEPTÓ', fecha: '2026-10-01' }), d([t()])).error, /de hoy a 180 días/);
  assert.match(L.validarResultado(p({ resultado: 'AGENDÓ CITA', fecha: '2026-10-12' }), d([t()])).error, /solo para reevaluaciones/);
  assert.equal(L.validarResultado(p({ resultado: 'AGENDÓ CITA', fecha: '2026-10-12' }), d([t({ ESTADO: 'POR REEVALUAR' })])).error, '');
  const no = L.validarResultado(p({ resultado: 'NO DESEA REALIZARSE', motivo: 'precio' }), d([t()]));
  assert.deepEqual([no.error, no.fila.MOTIVO, no.fila.NOTA], ['', 'NO DESEA REALIZARSE', 'Motivo: precio']);
  const reev = { DNI: '40111222', ESPECIALIDAD: 'HEMATOLOGÍA', TIPO_SEGUIMIENTO: 'REEVALUACION' };
  assert.match(L.validarResultado(p({ especialidad: 'HEMATOLOGÍA', referencia: '', resultado: 'ACEPTÓ', fecha: '2026-10-12' }), d([reev])).error,
    /solo para hierro y procedimientos/);
});

test('resultadoDe y leerCiclo: «No desea realizarse» cierra; «Aceptó» sigue', () => {
  const s = (res, o) => Object.assign({ ID: 'SEG-' + res, FECHA_HORA: '2026-10-09 10:00', RESULTADO: res, ANULADO: '' }, o);
  assert.equal(L.resultadoDe(s('NO DESEA REALIZARSE')).grupo, 'CIERRE');
  assert.equal(L.resultadoDe(s('ACEPTÓ', { FECHA_PROXIMA: '2026-10-12' })).grupo, 'SIGUE');
  assert.equal(L.leerCiclo([s('NO DESEA REALIZARSE')], reglas(L), '2026-10-09').cierre.motivo, 'NO DESEA REALIZARSE');
});
```

En `test/logica-tablero.test.js` (use los ayudantes que ya tenga el archivo; si no, `L.etiquetaDe(fila, reglas(L), hoy)`):

```js
test('etiquetaDe y columnaDe: sesión programada, no vino, por reevaluar, control y en tratamiento', () => {
  const R = reglas(L), hoy = '2026-10-15';
  const f = o => Object.assign({ TIPO_SEGUIMIENTO: 'HIERRO', HECHAS: 0, SESIONES: 3 }, o);
  const et = o => { const t = f(o); t.COLUMNA = L.columnaDe(t); return [t.COLUMNA, L.etiquetaDe(t, R, hoy)]; };
  assert.deepEqual(et({ ESTADO: 'AGENDADO', AGENDA: 'SESION', FECHA_AGENDA: '2026-10-16' }), ['AGENDADO', 'Sesión 1 el vie 16/10']);
  assert.deepEqual(et({ ESTADO: 'PENDIENTE', MOTIVO_PENDIENTE: 'NO VINO', FECHA_INICIO: '2026-10-12' }), ['POR_CONTACTAR', 'No vino a su sesión 1 (12/10)']);
  assert.deepEqual(et({ ESTADO: 'POR REEVALUAR', ULTIMA_SESION: '2026-09-10', HECHAS: 3 }), ['POR_CONTACTAR', 'Por reevaluar · terminó el 10/09']);
  assert.deepEqual(et({ TIPO_SEGUIMIENTO: 'CONTROL', ESTADO: 'AGENDADO', AGENDA: 'CONTROL', FECHA_AGENDA: '2026-10-16' }), ['AGENDADO', 'Control con resultados el vie 16/10']);
  assert.deepEqual(et({ TIPO_SEGUIMIENTO: 'CONTROL', ESTADO: 'PENDIENTE', MOTIVO_PENDIENTE: 'CONTROL VENCIDO', FECHA_INICIO: '2026-10-10' }),
    ['POR_CONTACTAR', 'Debía volver con resultados el 10/10']);
  assert.deepEqual(et({ ESTADO: 'EN TRATAMIENTO', HECHAS: 1, ULTIMA_SESION: '2026-10-12' }), ['EN_TRATAMIENTO', 'Sesión 1 de 3 · faltan 2 · próxima ~19/10']);
});

test('armarTablero: POR REEVALUAR reemplaza la reevaluación del mismo paciente; cada tarjeta trae su MES', () => {
  const R = reglas(L);
  const reev = { DNI: '40111222', ESPECIALIDAD: 'HEMATOLOGÍA', NOMBRE: 'ROSA PRUEBA', ESTADO: 'VENCIDO', N_SEGUIMIENTOS: 0, DIAS_ATRASO: 5,
    PROXIMA_ESPERADA: '2026-10-01', ULTIMA_CITA: '2026-08-20' };
  const porReev = { ID_REGISTRO: 'REG-000010', DNI: '40111222', ESPECIALIDAD: 'HIERRO', TIPO_SEGUIMIENTO: 'HIERRO', ESTADO: 'POR REEVALUAR',
    ESPECIALIDAD_CONSULTA: 'HEMATOLOGÍA', ULTIMA_SESION: '2026-09-01', HECHAS: 2, SESIONES: 2, N_SEGUIMIENTOS: 0, DIAS: 3, FECHA_COTIZACION: '2026-08-25' };
  const tab = plano(L.armarTablero({ reglas: R, hoy: '2026-10-09', pacientes: [reev], pendientes: [porReev], citas: [], seguimientos: [], telefonos: {} }));
  assert.deepEqual(tab.columnas.POR_CONTACTAR.map(t => [t.CLAVE, t.MES]), [['REG-000010', '2026-08']]);
});
```

En `test/logica-kpi.test.js`:

```js
test('kpiMotivos: «No desea realizarse» de hierro y procedimiento también cuenta', () => {
  const s = { ID: 'S1', FECHA_HORA: '2026-10-09 10:00', DNI: '1', ESPECIALIDAD: 'HIERRO', ACCION: 'DESCARTADO', MOTIVO: 'NO DESEA REALIZARSE',
    RESULTADO: 'NO DESEA REALIZARSE', ANULADO: '' };
  assert.deepEqual(plano(L.kpiMotivos([s])), [{ MOTIVO: 'NO DESEA REALIZARSE', N: 1 }]);
});
```

- [ ] **Paso 2: Ver que fallan** — 5 `not ok`.

- [ ] **Paso 3: Implementación.**

`src/Resultados.gs`: agregue en `RESULTADOS`

```js
  'ACEPTO':                   { nombre: 'ACEPTÓ',                   grupo: 'SIGUE',    pide: 'FECHA',    soloIndicacion: true },
  'NO DESEA REALIZARSE':      { nombre: 'NO DESEA REALIZARSE',      grupo: 'CIERRE',   pide: 'MOTIVO',   soloIndicacion: true },
```

ponga `soloReevaluacion: true` en `'AGENDO CITA'` y agregue `'ACEPTÓ'` y `'NO DESEA REALIZARSE'` a `ORDEN_RESULTADOS` (después de `'LO HIZO'` y al final, respectivamente). En `validarResultado`, reemplace la línea del `soloIndicacion` por:

```js
  var tipoT = t.TIPO_SEGUIMIENTO || normTexto(t.ESPECIALIDAD);
  var esIndicacion = !!TIPOS_INDICACION[normTexto(t.ESPECIALIDAD)] && tipoT !== 'CONTROL';
  var porReevaluar = t.ESTADO === 'POR REEVALUAR' || tipoT === 'CONTROL';
  if (r.soloIndicacion && (!esIndicacion || porReevaluar)) return no('«' + frase_(r.nombre) + '» es solo para hierro y procedimientos.');
  if (r.soloReevaluacion && esIndicacion && !porReevaluar) return no('«Agendó cita» es solo para reevaluaciones. Use «Aceptó».');
```

(`frase_('ACEPTÓ')` = `'Aceptó'`; `frase_('LO HIZO')` = `'Lo hizo'`: el mensaje viejo de «Lo hizo» se mantiene igual en significado. Si una prueba existente compara el texto exacto `«Lo hizo» es solo para hierro y procedimientos.`, sigue coincidiendo.)

y agregue antes del `return` final:

```js
  if (r.nombre === 'ACEPTÓ') {
    if (!f) return no('Falta la fecha de inicio.');
    if (f < hoy || f > sumarDias(hoy, 180)) return no('La fecha de inicio va de hoy a 180 días.');
    fila.FECHA_PROXIMA = f;
    if (p.sesiones !== undefined && p.sesiones !== '') {
      var n = Number(p.sesiones);
      if (!(n >= 1 && n <= MAX_SESIONES && Math.floor(n) === n)) return no('Indique cuántas sesiones (de 1 a ' + MAX_SESIONES + ').');
      fila.NOTA = unirNota_('Sesiones: ' + n, nota);
    }
  }
  if (r.nombre === 'NO DESEA REALIZARSE') {
    var motivoR = textoLimpio_(p.motivo);
    if (!motivoR) return no('Escriba el motivo.');
    fila.NOTA = unirNota_('Motivo: ' + motivoR, nota);
  }
```

`leerCiclo` ya trata un CIERRE por su `motivo`; `resultadoDe` da `motivo: r.nombre` a los cierres: no cambia.

`src/Tablero.gs`, `columnaDe`: antes de `if (e === 'PENDIENTE')` agregue `if (e === 'POR REEVALUAR') return 'POR_CONTACTAR';`. `etiquetaDe`: al inicio de la rama POR_CONTACTAR (después de la de REEVALUACION):

```js
    if (t.ESTADO === 'POR REEVALUAR') return 'Por reevaluar · terminó el ' + dm_(t.ULTIMA_SESION);
    if (t.MOTIVO_PENDIENTE === 'NO VINO') return 'No vino a su sesión ' + (Number(t.HECHAS) + 1) + ' (' + dm_(t.FECHA_INICIO) + ')';
    if (t.MOTIVO_PENDIENTE === 'CONTROL VENCIDO') return 'Debía volver con resultados el ' + dm_(t.FECHA_INICIO);
```

en la rama AGENDADO, antes de `if (t.AGENDA === 'CITA')`:

```js
    if (t.AGENDA === 'SESION') return 'Sesión ' + (Number(t.HECHAS) + 1) + ' el ' + diaCorto_(t.FECHA_AGENDA);
    if (t.AGENDA === 'CONTROL') return 'Control con resultados el ' + diaCorto_(t.FECHA_AGENDA);
```

y la rama EN_TRATAMIENTO:

```js
  if (t.COLUMNA === 'EN_TRATAMIENTO') return 'Sesión ' + t.HECHAS + ' de ' + t.SESIONES + ' · faltan ' + (Number(t.SESIONES) - Number(t.HECHAS)) +
    ' · próxima ~' + dm_(sumarDias(t.ULTIMA_SESION, reglas.diasEntreSesiones));
```

(La etiqueta de POR_CONTACTAR para EN CURSO atrasado, `sesion + ' · atrasada…'`, no cambia.)

`armarTablero`, dentro del `todas.forEach`, reemplace el bloque `if (t.ESTADO === 'COMPLETADO') {…}` por:

```js
    if (t.ESTADO === 'COMPLETADO') {
      var f = t.VOLVIO || (t.ULTIMA_SESION && t.ESTADO_REGISTRO === 'COMPLETO' ? t.ULTIMA_SESION : t.FECHA_LOHIZO);
      var etq = t.VOLVIO ? 'Volvió el ' + dm_(t.VOLVIO)
        : t.ESTADO_REGISTRO === 'COMPLETO' ? (t.FECHA_REEVALUAR ? 'Completó el ' + dm_(t.ULTIMA_SESION) + ' · reevaluar el ' + dm_(t.FECHA_REEVALUAR)
          : (t.TIPO_SEGUIMIENTO === 'PROCEDIMIENTO' ? 'Se hizo el ' + dm_(f) : 'Completó el tratamiento'))
        : 'Lo hizo el ' + dm_(f);
      if (mesDe(f) === mes) col.COMPLETADO.push(tarjeta_(t, 'COMPLETADO', reglas, hoy, f, etq));
    }
```

Antes de `// Deduplicate COMPLETADO…`, agregue la regla de una sola tarjeta:

```js
  var reemplaza = {};
  col.POR_CONTACTAR.forEach(function (t) { if (t.ESTADO === 'POR REEVALUAR') reemplaza[claveSerie(normDni(t.DNI), t.ESPECIALIDAD_CONSULTA || 'HEMATOLOGÍA')] = 1; });
  col.POR_CONTACTAR = col.POR_CONTACTAR.filter(function (t) {
    return !(t.TIPO_SEGUIMIENTO === 'REEVALUACION' && reemplaza[claveSerie(normDni(t.DNI), t.ESPECIALIDAD)]);
  });
```

y en el `Object.keys(col).forEach` final, junto a `TELEFONOS_DESCARTADOS`: `t.MES = mesDe(t.TIPO_SEGUIMIENTO === 'REEVALUACION' ? t.ULTIMA_CITA : t.FECHA_COTIZACION) || '';`. Recalcule `cifras.porContactar` después del filtro (ya usa `col.POR_CONTACTAR.length`, que se lee al final: verifique que el filtro va antes del `return`).

`src/Logica.gs`, `ordenarBandeja`: `var otros = (pendientes || []).filter(function (p) { return p.ESTADO === 'PENDIENTE' || p.ESTADO === 'POR REEVALUAR'; });`.

`kpiMotivos`: cambie la guarda por

```js
    var indicacion = TIPOS_INDICACION[normTexto(s.ESPECIALIDAD)];
    if (normTexto(s.ACCION) !== 'DESCARTADO' || (indicacion && normTexto(s.RESULTADO) !== 'NO DESEA REALIZARSE')) return;
```

- [ ] **Paso 4: Ver que pasan** — `npm test` → `# fail 0`. Revise las pruebas existentes de `etiquetaDe` para EN_TRATAMIENTO: hoy esperan `'Sesión 2 de 3 · próxima ~…'` (siguiente sesión). La spec pide «Sesión k de n · faltan…» con k = hechas. **Actualice** esas aserciones al texto nuevo, y anote el cambio en el commit.

- [ ] **Paso 5: Commit** — `git add src/Resultados.gs src/Tablero.gs src/Logica.gs test/logica-resultados.test.js test/logica-tablero.test.js test/logica-kpi.test.js` · mensaje: `Etapa 2: «Aceptó» y «No desea realizarse», etiquetas nuevas, Por reevaluar y mes por tarjeta`.

---

### Tarea 5: «Aceptó» escribe la fecha de inicio (o crea el registro desde el historial)

**Files:**
- Modify: `src/ResultadoServidor.gs` (`registrarResultado_`)
- Modify: `src/RegistroServidor.gs` (nueva `actualizarCeldas_`)
- Test: `test/resultado-servidor.test.js`

**Interfaces:**
- Consumes: `RESULTADOS.ACEPTO` (Tarea 4), `COLUMNAS_REGISTROS` (Tarea 1), `siguienteId`, `exigirColumnas_`.
- Produces: `actualizarCeldas_(nombre, id, cambios)` — `cambios` = `{ COLUMNA: valor }`; escribe solo esas celdas de la fila con ese `ID` (con `celdaParaHoja_`); lanza `'No encontré ' + id + '.'` o `id + ' está anulado.'`. `registrarResultado` con ACEPTÓ devuelve `{ ok, seguimiento, registro, tarjeta }`.

Comportamiento (dentro del **mismo** candado que la fila de SEGUIMIENTOS, y después de revalidar con lo releído, como hoy):
- Tarjeta con `ID_REGISTRO`: `actualizarCeldas_('REGISTROS', id, { FECHA_INICIO: fecha })`.
- Tarjeta del historial (sin `ID_REGISTRO`): crea `REG-…` con `FECHA` = hoy, `ASESORA` = quien, `DOCTOR` = '' , `NOMBRE`, `DNI`, `CONTACTO` = primer teléfono de la tarjeta, `TIPO` = HIERRO o PROCEDIMIENTO, `DETALLE` = `'HIERRO CARBOXIMALTOSA'` si es hierro (lo que muestra hoy «Hierro (Ferinject)»… use `'HIERRO CARBOXIMALTOSA'` con `MARCA` `'FERINJECT'`) o el `DETALLE` de la tarjeta si es procedimiento, `SESIONES` = `p.sesiones` o 1, `FECHA_INICIO` = fecha. La fila de SEGUIMIENTOS lleva `REFERENCIA` = '' (es de la tarjeta del historial) y su `NOTA` dice `'Registro ' + id`.
- Revalidación dentro del candado: si entretanto otra asesora ya aceptó (la tarjeta del historial ya no está abierta, porque el registro nuevo la cierra), `validarResultado` falla con «Ese paciente no está en la lista» y no se escribe nada.

- [ ] **Paso 1: Pruebas que fallan.** En `test/resultado-servidor.test.js`, use el arnés que ya tiene el archivo (dobles de `datos_`, `bloquear_`, `anexarObjeto_`, `leerSeguimientos_`). Agregue un doble de `actualizarCeldas_` que registre las llamadas y verifique el candado, y estas pruebas:

```js
test('«Aceptó» sobre un registro escribe su fecha de inicio con el candado tomado', () => {
  const { ctx, escrito, lock } = servidorResultado({ conRegistroCotizado: true });
  const celdas = [];
  ctx.actualizarCeldas_ = (h, id, c) => { assert.equal(lock.tomado, 1); celdas.push([h, id, plano(c)]); };
  const r = plano(ctx.registrarResultado({ usuario: 'MAGALY', dni: '40111222', especialidad: 'HIERRO', referencia: 'REG-000010',
    resultado: 'ACEPTÓ', fecha: '2026-10-12' }));
  assert.deepEqual(celdas, [['REGISTROS', 'REG-000010', { FECHA_INICIO: '2026-10-12' }]]);
  assert.equal(escrito.SEGUIMIENTOS[0].RESULTADO, 'ACEPTÓ');
  assert.equal(r.tarjeta.COLUMNA, 'AGENDADO');
});

test('«Aceptó» sobre una cotización del historial crea el registro con sus sesiones, una sola vez', () => {
  const { ctx, escrito } = servidorResultado({ conCotizacionHistorial: true });
  const r = plano(ctx.registrarResultado({ usuario: 'MAGALY', dni: '40222333', especialidad: 'HIERRO', referencia: '',
    resultado: 'ACEPTÓ', fecha: '2026-10-12', sesiones: 2 }));
  assert.deepEqual(escrito.REGISTROS.map(x => [x.TIPO, x.DNI, x.SESIONES, x.FECHA_INICIO]), [['HIERRO', '40222333', 2, '2026-10-12']]);
  assert.match(escrito.SEGUIMIENTOS[0].NOTA, /Registro REG-\d{6}/);
  assert.equal(r.registro.ID, escrito.REGISTROS[0].ID);
  assert.throws(() => ctx.registrarResultado({ usuario: 'MAGALY', dni: '40222333', especialidad: 'HIERRO', referencia: '',
    resultado: 'ACEPTÓ', fecha: '2026-10-12', sesiones: 2 }), /no está en la lista/, 'la segunda vez la cotización ya no está abierta');
});
```

Escriba `servidorResultado(opciones)` en el mismo archivo, a partir del arnés que ya usan las pruebas de `registrarResultado` (mismo patrón que `servidor()` de `test/registro-servidor.test.js`): `datos_` devuelve, según la opción, un registro `REG-000010` COTIZADO del DNI 40111222 con 8 días de antigüedad (para que esté en Por contactar) o una indicación del historial `{ ID: 'IND-0001', FECHA: '2026-09-20', TIPO: 'HIERRO', DETALLE: 'HIERRO', CANTIDAD: 2, ESTADO: 'COTIZÓ', DNI: '40222333', NOMBRE: 'JORGE PRUEBA', TELEFONO: '945000111', EMPAREJAMIENTO: 'CONFIRMADO', ORIGEN: 'HIERRO!2' }`; `leerOpcional_('REGISTROS')` y `leerRegistros_()` devuelven lo escrito (para que la segunda llamada vea el registro creado); `exigirColumnas_` y `exigirHojaPreparada_` no hacen nada; `hoy` = `'2026-10-09'`.

- [ ] **Paso 2: Ver que fallan** — 2 `not ok`.

- [ ] **Paso 3: Implementación.**

En `src/RegistroServidor.gs`, después de `marcarAnulado_`:

```js
/** Escribe solo las celdas pedidas de la fila con ese ID. Nada más de la fila cambia. */
function actualizarCeldas_(nombre, id, cambios) {
  var sh = hoja_(nombre), v = sh.getDataRange().getValues();
  var cab = v[0].map(function (c) { return String(c).trim(); }), cId = cab.indexOf('ID'), cA = cab.indexOf('ANULADO');
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][cId]).trim() !== id) continue;
    if (cA >= 0 && normTexto(v[i][cA]) === 'SI') throw new Error(id + ' está anulado.');
    Object.keys(cambios).forEach(function (c) {
      var j = cab.indexOf(c);
      if (j < 0) throw new Error('Falta preparar las hojas: a ' + nombre + ' le falta la columna ' + c + '.');
      var r = sh.getRange(i + 1, j + 1);
      if (!COLUMNAS_FECHA[c] && !COLUMNAS_FECHA_HORA[c] && !COLUMNAS_NUMERICAS[c]) r.setNumberFormat('@');
      r.setValue(celdaParaHoja_(cambios[c], c));
    });
    return;
  }
  throw new Error('No encontré ' + id + '.');
}
```

En `src/ResultadoServidor.gs`, dentro del `try` de `registrarResultado_`, justo antes de `s = copia_(v.fila, …)`:

```js
    var registro = null;
    if (v.fila.RESULTADO === 'ACEPTÓ') {
      exigirColumnas_('REGISTROS', COLUMNAS_REGISTROS);
      if (t.ID_REGISTRO) {
        actualizarCeldas_('REGISTROS', t.ID_REGISTRO, { FECHA_INICIO: v.fila.FECHA_PROXIMA });
      } else {
        var ids = leerOpcional_('REGISTROS').map(function (x) { return x.ID; });
        var hierro = normTexto(t.ESPECIALIDAD) === 'HIERRO';
        registro = { ID: siguienteId(ids, 'REG'), FECHA_HORA: fechaHoraTexto_(ahora), FECHA: d.hoy, ASESORA: v.fila.RESPONSABLE, DOCTOR: '',
          NOMBRE: textoLimpio_(t.NOMBRE).toUpperCase(), DNI: v.fila.DNI, CONTACTO: String(t.TELEFONOS || '').split(' / ')[0] || '',
          TIPO: hierro ? 'HIERRO' : 'PROCEDIMIENTO', DETALLE: hierro ? 'HIERRO CARBOXIMALTOSA' : textoLimpio_(t.DETALLE).replace(/ ×\d+$/, ''),
          MARCA: hierro ? 'FERINJECT' : '', SESIONES: Number(p.sesiones) || 1, ANULADO: '', MOTIVO_ANULACION: '',
          FECHA_INICIO: v.fila.FECHA_PROXIMA, EXAMENES: '', FECHA_RETORNO: '', EDITADO: '' };
        anexarObjeto_('REGISTROS', COLUMNAS_REGISTROS, registro);
        bitacora_(registro.ASESORA, 'REGISTRO', registro.ID + ' · ' + registro.DNI + ' · aceptó la cotización del historial');
        v.fila.NOTA = unirNota_('Registro ' + registro.ID, v.fila.NOTA);
      }
    }
```

Para que la tarjeta recalculada (fuera del candado) refleje el cambio, después de `d.seguimientos = frescos.concat([s]);` agregue:

```js
    if (registro) d.registros = (d.registros || []).concat([registro]);
    else if (v.fila.RESULTADO === 'ACEPTÓ') d.registros = (d.registros || []).map(function (x) {
      return x.ID === t.ID_REGISTRO ? copia_(x, { FECHA_INICIO: v.fila.FECHA_PROXIMA }) : x;
    });
```

y devuelva `registro: registro` en el objeto final. Para la tarjeta del historial, la clave de la tarjeta nueva es el ID del registro: después de `derivar_(d);` use `var clave = registro ? registro.ID : claveTarjeta(t);`.

- [ ] **Paso 4: Ver que pasan** — `npm test` → `# fail 0`.

- [ ] **Paso 5: Commit** — `git add src/ResultadoServidor.gs src/RegistroServidor.gs test/resultado-servidor.test.js` · mensaje: `Etapa 2: «Aceptó» programa la primera sesión o crea el registro desde el historial`.

---

### Tarea 6: Decisión del médico (alta, 6 meses, 1 año, nueva reevaluación)

**Files:**
- Modify: `src/Registro.gs` (`validarAlta`, `altasVigentes`, nueva `decisionesDeAlta`)
- Modify: `src/Logica.gs` (`estadoDeSerie`, `armarPacientes`)
- Modify: `src/Codigo.gs` (`derivar_`)
- Modify: `src/Tablero.gs` (`etiquetaDe`)
- Modify: `src/RegistroServidor.gs` (`darDeAlta`, `getRegistrosHoy` texto)
- Test: `test/logica-registro.test.js`, `test/logica-estado.test.js`, `test/registro-servidor.test.js`

**Interfaces:**
- Produces:
  - `DECISIONES = { 'ALTA': {...}, 'ALTA 6 MESES': { meses: 6 }, 'ALTA 1 ANO': { meses: 12 }, 'NUEVA REEVALUACION': { pideFecha: true } }` (claves con `normTexto`; nombres para mostrar: `'Alta médica'`, `'Alta con reevaluación a 6 meses'`, `'Alta con reevaluación a 1 año'`, `'Nueva reevaluación'`).
  - `validarAlta(p, catalogos, citas, vigentes, hoy)` acepta `p.decision` (por omisión `'ALTA'`) y `p.fechaRetorno`; devuelve `alta.DECISION` (`'ALTA' | 'ALTA 6 MESES' | 'ALTA 1 AÑO' | 'NUEVA REEVALUACION'`) y `alta.FECHA_RETORNO`.
  - `decisionesDeAlta(altas, citas, reglas, hoy)` → `{ vigentes: {clave: alta}, retornos: {clave: { fecha, tipo }} }`:
    - `ALTA`: en `vigentes` (como hoy).
    - `ALTA 6 MESES` / `ALTA 1 AÑO`: en `vigentes` mientras `hoy < FECHA_RETORNO − avisoAltaControl`; después, en `retornos` con `tipo` `'6 MESES'` / `'1 AÑO'`.
    - `NUEVA REEVALUACION`: en `retornos` con `tipo` `'REEVALUACION'`.
    - Cualquiera con una consulta realizada posterior a su `FECHA`: no cuenta (igual que hoy).
  - `altasVigentes(altas, seguimientos, citas, reglas, hoy)` = las `vigentes` de arriba más los descartes antiguos «ALTA MÉDICA» (como hoy). Los dos parámetros nuevos son opcionales: sin ellos, una alta con `DECISION` 6 meses o 1 año cuenta como vigente (compatibilidad).
  - `armarPacientes(..., altas, retornos)`: séptimo/octavo parámetro `retornos`; `estadoDeSerie(..., extra)` recibe `extra.retorno = { fecha, tipo }` y entonces `esperada = retorno.fecha − (tipo !== 'REEVALUACION' ? avisoAltaControl : 0)`, `vence = esperada + (plazo.vence − plazo.esperado)`; la fila de pacientes lleva `RETORNO_TIPO` y `FECHA_RETORNO`.
  - `etiquetaDe` POR_CONTACTAR de REEVALUACION con `RETORNO_TIPO` `6 MESES`/`1 AÑO`: `'Control de alta a 6 meses · el ' + dm(FECHA_RETORNO)` (o `a 1 año`); con `REEVALUACION`: `'Debía volver el ' + dm(FECHA_RETORNO) + ' (lo indicó el médico)'`.

- [ ] **Paso 1: Pruebas que fallan.**

En `test/logica-registro.test.js`:

```js
test('validarAlta: cuatro decisiones; la nueva reevaluación pide fecha de retorno futura', () => {
  const citas = [cita({ fecha: '2026-10-01' })];
  const p = o => Object.assign({ usuario: 'MAGALY', dni: '40111222', especialidad: 'HEMATOLOGÍA', doctor: 'Dra. Karen Matos', fecha: '2026-10-05' }, o);
  const ok = d => plano(L.validarAlta(p(d), CAT2, citas, {}, '2026-10-09'));
  assert.deepEqual([ok({}).alta.DECISION, ok({}).alta.FECHA_RETORNO], ['ALTA', '']);
  assert.deepEqual([ok({ decision: 'ALTA 6 MESES' }).alta.DECISION, ok({ decision: 'ALTA 6 MESES' }).alta.FECHA_RETORNO], ['ALTA 6 MESES', '2027-04-05']);
  assert.equal(ok({ decision: 'alta 1 año' }).alta.FECHA_RETORNO, '2027-10-05');
  assert.equal(ok({ decision: 'NUEVA REEVALUACION', fechaRetorno: '2026-11-20' }).alta.FECHA_RETORNO, '2026-11-20');
  assert.match(L.validarAlta(p({ decision: 'NUEVA REEVALUACION' }), CAT2, citas, {}, '2026-10-09').error, /fecha de retorno/);
  assert.match(L.validarAlta(p({ decision: 'NUEVA REEVALUACION', fechaRetorno: '2026-10-09' }), CAT2, citas, {}, '2026-10-09').error, /después de hoy/);
  assert.match(L.validarAlta(p({ decision: 'OTRA' }), CAT2, citas, {}, '2026-10-09').error, /Elija la decisión/);
});

test('decisionesDeAlta: ventanas de 6 meses y 1 año, nueva reevaluación, y una consulta posterior las anula', () => {
  const R = reglas(L), citas = [cita({ fecha: '2026-10-01' })];
  const a = (dec, ret) => ({ ID: 'ALT-1', FECHA: '2026-10-05', DNI: '40111222', ESPECIALIDAD: 'HEMATOLOGÍA', DOCTOR: 'Dra. X', DECISION: dec, FECHA_RETORNO: ret, ANULADO: '' });
  const k = '40111222|HEMATOLOGIA';
  let r = plano(L.decisionesDeAlta([a('ALTA 6 MESES', '2027-04-05')], citas, R, '2027-02-01'));
  assert.ok(r.vigentes[k] && !r.retornos[k], 'antes de la ventana: alta vigente');
  r = plano(L.decisionesDeAlta([a('ALTA 6 MESES', '2027-04-05')], citas, R, '2027-03-10'));
  assert.deepEqual([!!r.vigentes[k], r.retornos[k]], [false, { fecha: '2027-04-05', tipo: '6 MESES' }]);
  r = plano(L.decisionesDeAlta([a('NUEVA REEVALUACION', '2026-11-20')], citas, R, '2026-10-09'));
  assert.deepEqual([!!r.vigentes[k], r.retornos[k]], [false, { fecha: '2026-11-20', tipo: 'REEVALUACION' }]);
  r = plano(L.decisionesDeAlta([a('ALTA 6 MESES', '2027-04-05')], citas.concat([cita({ fecha: '2026-12-01' })]), R, '2027-03-10'));
  assert.deepEqual([!!r.vigentes[k], !!r.retornos[k]], [false, false], 'volvió a consulta: la decisión ya se cumplió');
});
```

En `test/logica-estado.test.js`:

```js
test('estadoDeSerie: el retorno indicado por el médico manda sobre el plazo de REGLAS', () => {
  const R = reglas(L), s = L.armarSeries([cita({ fecha: '2026-10-01' })])['40111222|HEMATOLOGIA'];
  const e = L.estadoDeSerie(s, [], R, '2026-11-10', null, { retorno: { fecha: '2026-11-20', tipo: 'REEVALUACION' } });
  assert.deepEqual([e.estado, e.esperada, e.vence], ['AL DÍA', '2026-11-20', '2026-12-05']);
  const c = L.estadoDeSerie(s, [], R, '2027-03-10', null, { retorno: { fecha: '2027-04-05', tipo: '6 MESES' } });
  assert.deepEqual([c.esperada, c.estado], ['2027-03-06', 'POR VENCER'], 'el control de alta se espera 30 días antes');
});
```

En `test/registro-servidor.test.js`:

```js
test('darDeAlta: guarda la decisión y su fecha de retorno', () => {
  const { ctx, escrito } = servidor();
  ctx.darDeAlta({ usuario: 'MAGALY', dni: '40111222', especialidad: 'HEMATOLOGÍA', doctor: 'Dra. Karen Matos', fecha: '2026-10-05',
    decision: 'NUEVA REEVALUACION', fechaRetorno: '2026-11-20' });
  assert.deepEqual(escrito.ALTAS.map(a => [a.DECISION, a.FECHA_RETORNO]), [['NUEVA REEVALUACION', '2026-11-20']]);
});
```

- [ ] **Paso 2: Ver que fallan** — 4 `not ok`.

- [ ] **Paso 3: Implementación.**

En `src/Registro.gs`, antes de `validarAlta`:

```js
var DECISIONES = {
  'ALTA': { nombre: 'ALTA', texto: 'Alta médica', meses: 0 },
  'ALTA 6 MESES': { nombre: 'ALTA 6 MESES', texto: 'Alta con reevaluación a 6 meses', meses: 6, tipo: '6 MESES' },
  'ALTA 1 ANO': { nombre: 'ALTA 1 AÑO', texto: 'Alta con reevaluación a 1 año', meses: 12, tipo: '1 AÑO' },
  'NUEVA REEVALUACION': { nombre: 'NUEVA REEVALUACION', texto: 'Nueva reevaluación', meses: 0, pideFecha: true, tipo: 'REEVALUACION' }
};
function decisionDe_(a) { return DECISIONES[normTexto(a && a.DECISION) || 'ALTA'] || DECISIONES.ALTA; }
/** 'yyyy-mm-dd' + n meses; el día 31 de un mes corto pasa al último día de ese mes. */
function sumarMeses_(iso, n) {
  var y = Number(iso.slice(0, 4)), m = Number(iso.slice(5, 7)) - 1 + n, d = Number(iso.slice(8, 10));
  y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
  var ultimo = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return y + '-' + ('0' + (m + 1)).slice(-2) + '-' + ('0' + Math.min(d, ultimo)).slice(-2);
}
```

En `validarAlta`, después de validar la fecha y antes del `return` final:

```js
  var dec = DECISIONES[normTexto(p.decision) || 'ALTA'];
  if (!dec) return no('Elija la decisión del médico.');
  var retorno = '';
  if (dec.meses) retorno = sumarMeses_(fecha, dec.meses);
  if (dec.pideFecha) {
    retorno = fechaIso(p.fechaRetorno);
    if (!retorno) return no('Falta la fecha de retorno.');
    if (retorno <= hoy) return no('La fecha de retorno debe ser después de hoy.');
    if (retorno > sumarDias(hoy, 730)) return no('La fecha de retorno va hasta dos años desde hoy.');
  }
```

y agregue `DECISION: dec.nombre, FECHA_RETORNO: retorno` al objeto `alta`. (La regla «ya tiene un alta vigente» se mantiene.)

Nueva función, después de `altasVigentes`:

```js
/** Qué decidió el médico, por serie: lo que sigue de alta y lo que debe volver (con su fecha). */
function decisionesDeAlta(altas, citas, reglas, hoy) {
  var series = armarSeries(citas), ultimas = {}, out = { vigentes: {}, retornos: {} };
  (altas || []).forEach(function (a) {
    if (anulado_(a)) return;
    var k = claveSerie(normDni(a.DNI), a.ESPECIALIDAD), f = fechaIso(a.FECHA), serie = series[k];
    if (!serie || !f || serie.realizadas.some(function (c) { return c.FECHA > f; })) return;
    if (!ultimas[k] || f > ultimas[k].FECHA) ultimas[k] = { ID: a.ID, FECHA: f, DNI: normDni(a.DNI), ESPECIALIDAD: a.ESPECIALIDAD,
      DOCTOR: a.DOCTOR || '', REGISTRADO_POR: a.REGISTRADO_POR || '', DECISION: decisionDe_(a).nombre, FECHA_RETORNO: fechaIso(a.FECHA_RETORNO) };
  });
  Object.keys(ultimas).forEach(function (k) {
    var a = ultimas[k], dec = decisionDe_(a);
    if (dec.nombre === 'ALTA') { out.vigentes[k] = a; return; }
    if (dec.tipo === 'REEVALUACION') { out.retornos[k] = { fecha: a.FECHA_RETORNO, tipo: 'REEVALUACION' }; return; }
    if (hoy < sumarDias(a.FECHA_RETORNO, -reglas.avisoAltaControl)) out.vigentes[k] = a;
    else out.retornos[k] = { fecha: a.FECHA_RETORNO, tipo: dec.tipo };
  });
  return out;
}
```

`altasVigentes(altas, seguimientos, citas, reglas, hoy)`: si llegan `reglas` y `hoy`, use `decisionesDeAlta(...).vigentes` en lugar del recorrido de `altas` (los descartes antiguos «ALTA MÉDICA» se agregan igual que hoy); si no llegan, comportamiento actual.

En `src/Codigo.gs`, `derivar_`:

```js
  var dec = decisionesDeAlta(d.altas, d.citas, d.reglas, d.hoy);
  d.vigentes = altasVigentes(d.altas, d.seguimientos, d.citas, d.reglas, d.hoy);
  d.retornos = dec.retornos;
  ...
  d.pacientes = armarPacientes(d.citas, d.indicacionesTodas, d.seguimientos, d.reglas, d.hoy, d.contactos, d.vigentes, d.retornos);
```

En `src/Logica.gs`, `armarPacientes(…, altas, retornos)`: pase `retorno: (retornos || {})[k]` dentro del `extra` de `estadoDeSerie`, y agregue a la fila `RETORNO_TIPO: ((retornos || {})[k] || {}).tipo || ''`, `FECHA_RETORNO: ((retornos || {})[k] || {}).fecha || ''`. En `estadoDeSerie`, reemplace el cálculo de `esperada` y `vence`:

```js
  var ret = (extra || {}).retorno;
  if (ret && ret.fecha) {
    out.esperada = ret.tipo === 'REEVALUACION' ? ret.fecha : sumarDias(ret.fecha, -reglas.avisoAltaControl);
    out.vence = sumarDias(out.esperada, plazo.vence - plazo.esperado);
  } else {
    out.esperada = sumarDias(ultima, plazo.esperado);
    out.vence = sumarDias(ultima, plazo.vence);
  }
```

(mueva `extra = extra || {};` antes de este bloque).

En `src/Tablero.gs`, `etiquetaDe`, rama POR_CONTACTAR de REEVALUACION:

```js
    if (t.TIPO_SEGUIMIENTO === 'REEVALUACION') {
      if (t.RETORNO_TIPO === '6 MESES' || t.RETORNO_TIPO === '1 AÑO') return 'Control de alta a ' + (t.RETORNO_TIPO === '6 MESES' ? '6 meses' : '1 año') + ' · el ' + dm_(t.FECHA_RETORNO);
      if (t.RETORNO_TIPO === 'REEVALUACION') return 'Debía volver el ' + dm_(t.FECHA_RETORNO) + ' (lo indicó el médico)';
      return 'Debía volver el ' + dm_(t.PROXIMA_ESPERADA) + ' · hace ' + plural_(diasEntre(t.PROXIMA_ESPERADA, hoy), 'día', 'días');
    }
```

En `src/RegistroServidor.gs`, `darDeAlta` no cambia más que la `exigirColumnas_` de la Tarea 1 (la decisión llega en `v.alta`). En `getRegistrosHoy`, el texto de las altas: `TEXTO: decisionDe_(a).texto + ' · ' + a.ESPECIALIDAD + ' · ' + a.DOCTOR + (fechaIso(a.FECHA_RETORNO) ? ' · retorno ' + fechaDma_(fechaIso(a.FECHA_RETORNO)) : '')`. Actualice la prueba `getRegistrosHoy` existente: el texto de un alta sin decisión sigue empezando por `'Alta médica · '`.

- [ ] **Paso 4: Ver que pasan** — `npm test` → `# fail 0`.

- [ ] **Paso 5: Commit** — `git add src/Registro.gs src/Logica.gs src/Codigo.gs src/Tablero.gs src/RegistroServidor.gs test/logica-registro.test.js test/logica-estado.test.js test/registro-servidor.test.js` · mensaje: `Etapa 2: decisión del médico (alta, a 6 meses, a 1 año, nueva reevaluación)`.

---

### Tarea 7: Editar un registro y la lista «Registrados» por periodo

**Files:**
- Modify: `src/Registro.gs` (nueva `validarEdicionRegistro`)
- Modify: `src/RegistroServidor.gs` (nuevas `editarRegistro`, `getRegistros`; `getRegistrosHoy` pasa a envoltorio)
- Test: `test/logica-registro.test.js`, `test/registro-servidor.test.js`, `test/sintaxis.test.js`

**Interfaces:**
- Consumes: `actualizarCeldas_` (Tarea 5), `estadoRegistro` (Tarea 2), `exigirColumnas_` (Tarea 1).
- Produces:
  - `validarEdicionRegistro(r, cambios, sesiones, catalogos, hoy)` → `{ error, cambios: {COLUMNA: valorNuevo}, antes: {COLUMNA: valorViejo} }`. Claves de entrada en minúscula: `fecha, doctor, nombre, contacto, detalle, marca, sesiones, fechaInicio, examenes, fechaRetorno`.
  - `editarRegistro({ usuario, id, cambios })` → `{ ok, registro: { ID, HORA, ASESORA, NOMBRE, DNI, TEXTO, ANULADO, MOTIVO_ANULACION, EDITADO, FECHA, TIPO } }`, o `{ ok: false, sinCambios: true }`.
  - `getRegistros({ periodo })` (`'HOY'` o `'yyyy-mm'`) → misma forma que `getRegistrosHoy`, más `FECHA`, `TIPO`, `EDITADO`, `SESIONES`, `HECHAS`, `DOCTOR`, `CONTACTO`, `DETALLE`, `MARCA`, `FECHA_INICIO`, `EXAMENES`, `FECHA_RETORNO`, `DECISION` (lo que la app necesita para el formulario de edición). `getRegistrosHoy()` = `getRegistros({ periodo: 'HOY' })`.

Reglas de `validarEdicionRegistro` (spec §5.3): campo fuera de la lista → `'No se puede cambiar ' + campo + '.'`; `dni` → `'Para cambiar el paciente, anule el registro y regístrelo de nuevo.'`; anulado → `'Ese registro está anulado.'`; `sesiones` < hechas → `'Ya hizo ' + hechas + ' sesiones: el total no puede ser menor.'`; el resto, las mismas validaciones de `validarRegistro` (doctor del catálogo, tratamiento y marca, fecha no futura, inicio de hoy a 180 días, retorno después de hoy). Un cambio igual al valor actual no cuenta.

- [ ] **Paso 1: Pruebas que fallan.**

En `test/logica-registro.test.js`:

```js
test('validarEdicionRegistro: lo editable, el DNI fijo, sesiones no menos que las hechas, anulado no', () => {
  const r = REGH({ SESIONES: '3' }), ses = [SES(1, '2026-10-02'), SES(2, '2026-10-05')];
  const v = (c, x) => plano(L.validarEdicionRegistro(x || r, c, ses, CAT2, '2026-10-09'));
  assert.deepEqual(v({ sesiones: 4, contacto: '912 000 111' }), { error: '', cambios: { SESIONES: 4, CONTACTO: '912 000 111' }, antes: { SESIONES: '3', CONTACTO: '987654321' } });
  assert.match(v({ dni: '40999888' }).error, /anule el registro/);
  assert.match(v({ sesiones: 1 }).error, /Ya hizo 2 sesiones/);
  assert.match(v({ doctor: 'Dr. Nadie' }).error, /doctor de la lista/);
  assert.match(v({ asesora: 'X' }).error, /No se puede cambiar/);
  assert.match(v({ nombre: 'otra' }, REGH({ ANULADO: 'SÍ' })).error, /anulado/);
  assert.deepEqual(v({ sesiones: '3' }).cambios, {}, 'igual al actual no es un cambio');
});
```

En `test/registro-servidor.test.js` (con el arnés `servidor()`; agregue `ctx.actualizarCeldas_` como doble que registra y verifica el candado, y `ctx.leerRegistros_ = () => (hojas.REGISTROS || [])`, `ctx.leerSesiones_ = () => []` si el arnés no los tiene):

```js
test('editarRegistro: relee dentro del candado, escribe solo lo cambiado, marca EDITADO y deja una línea por campo', () => {
  const { ctx, escrito, lock } = servidor({}, { REGISTROS: [REG4] });
  const celdas = [];
  ctx.leerRegistros_ = () => [REG4];
  ctx.leerSesiones_ = () => [];
  ctx.actualizarCeldas_ = (h, id, c) => { assert.equal(lock.tomado, 1); celdas.push([h, id, plano(c)]); };
  const r = plano(ctx.editarRegistro({ usuario: 'MAGALY', id: 'REG-000004', cambios: { contacto: '912000111', sesiones: 2 } }));
  assert.equal(r.ok, true);
  assert.deepEqual(celdas, [['REGISTROS', 'REG-000004', { CONTACTO: '912000111', SESIONES: 2, EDITADO: '2026-10-05 10:30' }]]);
  assert.deepEqual(escrito.BITACORA.map(b => b[2]), ['REG-000004 · CONTACTO: 987654321 → 912000111', 'REG-000004 · SESIONES: 1 → 2']);
  assert.deepEqual(plano(ctx.editarRegistro({ usuario: 'MAGALY', id: 'REG-000004', cambios: { contacto: '987654321' } })), { ok: false, sinCambios: true });
  ctx.leerRegistros_ = () => [Object.assign({}, REG4, { ANULADO: 'SÍ' })];
  assert.throws(() => ctx.editarRegistro({ usuario: 'MAGALY', id: 'REG-000004', cambios: { contacto: '912000111' } }), /anulado/);
  assert.equal(lock.tomado, 0);
});

test('getRegistros: hoy o un mes, con los datos para editar', () => {
  const sep = Object.assign({}, REG4, { ID: 'REG-000002', FECHA_HORA: '2026-09-20 11:00', FECHA: '2026-09-20' });
  const hoy = Object.assign({}, REG4, { FECHA_HORA: '2026-10-05 09:00' });   // el arnés usa hoy = 2026-10-05
  const { ctx } = servidor({ registros: [hoy, sep], altas: [] });
  assert.deepEqual(plano(ctx.getRegistros({ periodo: '2026-09' })).map(x => x.ID), ['REG-000002']);
  const deHoy = plano(ctx.getRegistros({ periodo: 'HOY' }));
  assert.deepEqual(deHoy.map(x => [x.ID, x.CONTACTO, x.SESIONES]), [['REG-000004', '987654321', 1]]);
  assert.deepEqual(plano(ctx.getRegistrosHoy()).map(x => x.ID), ['REG-000004']);
});
```

En `test/sintaxis.test.js`, agregue `'editarRegistro', 'getRegistros'` a la lista de funciones públicas.

- [ ] **Paso 2: Ver que fallan** — 3 `not ok` + la de sintaxis.

- [ ] **Paso 3: Implementación.**

En `src/Registro.gs`:

```js
var EDITABLES = { fecha: 'FECHA', doctor: 'DOCTOR', nombre: 'NOMBRE', contacto: 'CONTACTO', detalle: 'DETALLE', marca: 'MARCA',
  sesiones: 'SESIONES', fechaInicio: 'FECHA_INICIO', examenes: 'EXAMENES', fechaRetorno: 'FECHA_RETORNO' };

function validarEdicionRegistro(r, cambios, sesiones, catalogos, hoy) {
  function no(m) { return { error: m, cambios: {}, antes: {} }; }
  if (!r) return no('No encontré ese registro. Recargue la página.');
  if (anulado_(r)) return no('Ese registro está anulado.');
  var out = {}, antes = {}, e = estadoRegistro(r, sesiones), control = normTexto(r.TIPO) === 'CONTROL';
  var claves = Object.keys(cambios || {});
  for (var i = 0; i < claves.length; i++) {
    var k = claves[i];
    if (k === 'dni') return no('Para cambiar el paciente, anule el registro y regístrelo de nuevo.');
    var col = EDITABLES[k];
    if (!col) return no('No se puede cambiar ' + k + '.');
    var v = cambios[k], nuevo;
    if (col === 'FECHA') { nuevo = fechaIso(v); if (!nuevo) return no('Falta la fecha.'); if (nuevo > hoy) return no('La fecha no puede ser futura.'); }
    else if (col === 'DOCTOR') {
      var doc = (catalogos.doctores || []).filter(function (d) { return normTexto(d.doctor) === normTexto(v); })[0];
      if (!doc) return no('Elija el doctor de la lista.');
      nuevo = doc.doctor;
    } else if (col === 'NOMBRE') { nuevo = textoLimpio_(v).toUpperCase(); if (!nuevo) return no('Falta el nombre del paciente.'); }
    else if (col === 'CONTACTO') { nuevo = textoLimpio_(v); if (!nuevo) return no('Falta el teléfono o usuario.'); }
    else if (col === 'DETALLE') {
      if (control) return no('Un control no tiene procedimiento ni tratamiento.');
      nuevo = enLista_(normTexto(r.TIPO) === 'HIERRO' ? catalogos.tratamientos : catalogos.procedimientos, v);
      if (!nuevo) return no('«' + textoLimpio_(v) + '» no está en CATALOGOS.');
    } else if (col === 'MARCA') {
      var marcas = (catalogos.marcas || {})[normTexto(cambios.detalle || r.DETALLE)] || [];
      nuevo = marcas.length ? enLista_(marcas, v) : '';
      if (marcas.length && !nuevo) return no('Elija la marca: ' + marcas.join(' o ') + '.');
    } else if (col === 'SESIONES') {
      var n = Number(v);
      if (control) return no('Un control no tiene sesiones.');
      if (!(n >= 1 && n <= MAX_SESIONES && Math.floor(n) === n)) return no('Indique cuántas sesiones (de 1 a ' + MAX_SESIONES + ').');
      if (n < e.hechas) return no('Ya hizo ' + e.hechas + ' sesiones: el total no puede ser menor.');
      nuevo = n;
    } else if (col === 'FECHA_INICIO') {
      nuevo = fechaIso(v) || '';
      if (nuevo && e.hechas) return no('Ya empezó el tratamiento: la fecha de inicio no se cambia.');
      if (nuevo && (nuevo < hoy || nuevo > sumarDias(hoy, 180))) return no('La fecha de la primera sesión va de hoy a 180 días.');
    } else if (col === 'EXAMENES') { if (!control) return no('Solo un control tiene exámenes.'); nuevo = textoLimpio_(v); }
    else if (col === 'FECHA_RETORNO') {
      if (!control) return no('Solo un control tiene fecha de retorno.');
      nuevo = fechaIso(v); if (!nuevo || nuevo <= hoy) return no('La fecha de retorno debe ser después de hoy.');
    }
    if (String(nuevo) === String(r[col] == null ? '' : r[col])) continue;
    out[col] = nuevo;
    antes[col] = r[col] == null ? '' : r[col];
  }
  return { error: '', cambios: out, antes: antes };
}
```

En `src/RegistroServidor.gs`:

```js
function editarRegistro(p) {
  var d = datos_(), quien = exigirUsuario_(d.catalogos, p && p.usuario), id = textoLimpio_(p && p.id);
  var lock = bloquear_();
  try {
    exigirColumnas_('REGISTROS', COLUMNAS_REGISTROS);
    // Se valida con la hoja releída: otra asesora pudo anularlo o marcar una sesión entretanto.
    var r = leerRegistros_().filter(function (x) { return x.ID === id; })[0];
    var v = validarEdicionRegistro(r, p.cambios, leerSesiones_(), d.catalogos, d.hoy);
    if (v.error) throw new Error(v.error);
    var cols = Object.keys(v.cambios);
    if (!cols.length) return { ok: false, sinCambios: true };
    var ahora = fechaHoraTexto_(new Date()), escribir = copia_(v.cambios, { EDITADO: ahora });
    actualizarCeldas_('REGISTROS', id, escribir);
    cols.forEach(function (c) { bitacora_(quien, 'EDITAR REGISTRO', id + ' · ' + c + ': ' + v.antes[c] + ' → ' + v.cambios[c]); });
    var nuevo = copia_(copia_(r, v.cambios), { EDITADO: ahora });
    return limpiarParaEnvio({ ok: true, registro: filaRegistrada_(nuevo, d) });
  } finally {
    soltar_(lock);
  }
}

/** Una fila de «Registrados»: lo que muestra la lista y lo que necesita el formulario de edición. */
function filaRegistrada_(r, d) {
  var e = estadoRegistro(r, d.sesiones);
  return { ID: r.ID, HORA: String(r.FECHA_HORA || '').slice(11, 16), ASESORA: r.ASESORA, NOMBRE: r.NOMBRE, DNI: r.DNI, TEXTO: textoRegistro(r),
    ANULADO: anulado_(r), MOTIVO_ANULACION: r.MOTIVO_ANULACION || '', EDITADO: r.EDITADO || '', FECHA: fechaIso(r.FECHA), TIPO: normTexto(r.TIPO),
    DOCTOR: r.DOCTOR || '', CONTACTO: r.CONTACTO || '', DETALLE: r.DETALLE || '', MARCA: r.MARCA || '', SESIONES: e.total, HECHAS: e.hechas,
    FECHA_INICIO: fechaIso(r.FECHA_INICIO) || '', EXAMENES: r.EXAMENES || '', FECHA_RETORNO: fechaIso(r.FECHA_RETORNO) || '', DECISION: '' };
}

function getRegistros(p) {
  var d = datos_(), nombres = {}, periodo = textoLimpio_(p && p.periodo) || 'HOY';
  d.citas.forEach(function (c) { nombres[c.DNI] = c.NOMBRE; });
  var dentro = function (x) { var f = String(x.FECHA_HORA || ''); return periodo === 'HOY' ? f.slice(0, 10) === d.hoy : f.slice(0, 7) === periodo; };
  var lista = d.registros.filter(dentro).map(function (r) { return filaRegistrada_(r, d); }).concat(d.altas.filter(dentro).map(function (a) {
    var ret = fechaIso(a.FECHA_RETORNO);
    return { ID: a.ID, HORA: String(a.FECHA_HORA || '').slice(11, 16), ASESORA: a.REGISTRADO_POR, NOMBRE: nombres[a.DNI] || '', DNI: a.DNI,
      TEXTO: decisionDe_(a).texto + ' · ' + a.ESPECIALIDAD + ' · ' + a.DOCTOR + (ret ? ' · retorno ' + fechaDma_(ret) : ''),
      ANULADO: anulado_(a), MOTIVO_ANULACION: a.MOTIVO_ANULACION || '', EDITADO: '', FECHA: fechaIso(a.FECHA), TIPO: 'DECISION',
      DECISION: decisionDe_(a).nombre, FECHA_RETORNO: ret || '' };
  }));
  lista.sort(function (a, b) { var x = a.FECHA + a.HORA, y = b.FECHA + b.HORA; return x < y ? 1 : x > y ? -1 : (a.ID < b.ID ? 1 : -1); });
  return limpiarParaEnvio(lista);
}

function getRegistrosHoy() { return getRegistros({ periodo: 'HOY' }); }
```

(Borre el cuerpo viejo de `getRegistrosHoy` y la versión de la Tarea 6 del texto de altas: ahora vive en `getRegistros`.)

- [ ] **Paso 4: Ver que pasan** — `npm test` → `# fail 0`.

- [ ] **Paso 5: Commit** — `git add src/Registro.gs src/RegistroServidor.gs test/logica-registro.test.js test/registro-servidor.test.js test/sintaxis.test.js` · mensaje: `Etapa 2: editar un registro y «Registrados» por día o por mes`.

---

### Tarea 8: Panel «¿Qué pasó?» por tipo, paso «Aceptó», «No desea realizarse» y sesiones (interfaz)

**Files:**
- Modify: `src/Index.html` (constantes `ACC`/`CIERRES` ~línea 1545, `accDe`, `rangoPaso`, `validarFecha`, `htmlPaso`, `confirmarPaso`, `previsto`, `planDe`, `accionDrop`, atajos de teclado; DEMO: `registrarResultado` ~línea 4120 y sus formas)
- Test: `test/ui.test.js`

**Interfaces:**
- Consumes: resultados `ACEPTÓ` y `NO DESEA REALIZARSE` (Tarea 4) y la respuesta de la Tarea 5 (`tarjeta`, `registro`).
- Produces (en la app): claves de acción `'acepto'` (`r: 'ACEPTÓ'`, `l: p.t === 'hier' ? 'Aceptó tratamiento' : 'Aceptó procedimiento'`, icono `ph ph-handshake i-ok`, `solo: ['hier', 'proc']`, y no en tarjetas `porReevaluar`/control) y `'nodesea'` (cierre, `r: 'NO DESEA REALIZARSE'`, `l: 'No desea realizarse'`, icono `ph ph-hand-palm`, `solo: ['hier', 'proc']`). `agendo` lleva `solo: ['reev']` más las tarjetas con `p.porReevaluar` o `p.t === 'ctrl'`. `lohizo` sale de `ACC`.

Reglas de la interfaz:
- Orden de botones (y teclas 1–3): reevaluación → No contestó, Lo pensará, Agendó cita. Hierro/procedimiento → No contestó, Lo pensará, Aceptó. Control y Por reevaluar → No contestó, Lo pensará, Agendó cita.
- Cierres de hierro/procedimiento: Número equivocado, Se atiende en otro lugar, Falleció, **No desea realizarse** (no «No desea continuar»; no «Alta médica»). Reevaluación: como hoy.
- Paso «Aceptó»: campo fecha (min hoy, max hoy+180, por omisión hoy) con la etiqueta «Fecha de la primera sesión»; si la tarjeta no tiene `idRegistro`, campo número «Sesiones» (1–20, por omisión `CANTIDAD` del historial o 1). Botón «Pasar a Agendado». Aviso: «Si pasa la fecha sin marcar la sesión, vuelve a «Por contactar».».
- Paso «No desea realizarse»: motivo obligatorio (como «No desea continuar»), botón «Cerrar el seguimiento».
- Previsión optimista (`previsto`): ACEPTÓ → `AGENDADO` con `AGENDA: 'SESION'`, `FECHA_AGENDA: f`, etiqueta `'Sesión ' + (HECHAS+1) + ' el ' + diaSem(f) + ' ' + dm(f)`; NO DESEA REALIZARSE → sale del tablero y va a «cerrados» (agréguelo a `CIERRAN`).
- Panel de una tarjeta **En tratamiento**: el bloque de acciones muestra **«Marcar sesión k hecha»** (k = HECHAS+1, fecha hoy por omisión, llama a `marcarSesion`) y **«Anular la última»** (pide motivo, llama a `anularSesion` con el ID de la última sesión, que la tarjeta trae como `ULTIMA_SESION_ID` — agréguelo en `pendientesRegistro` como `ULTIMA_SESION_ID: (sesionesDe_(r.ID, d.sesiones).slice(-1)[0] || {}).ID || ''` en la Tarea 3 si no se hizo; si falta, agréguelo aquí con su prueba de lógica).
- Arrastrar a Agendado una tarjeta de hierro o procedimiento (no Por reevaluar) abre `'acepto'`; a Completado ya no abre «Lo hizo»: avisa «Completado llega con la última sesión.».
- El DEMO acepta `ACEPTÓ` (escribe `FECHA_INICIO` en su registro o crea `REG-…` desde el historial) y `NO DESEA REALIZARSE`, con los mismos mensajes que el servidor, y rechaza `AGENDÓ CITA` en hierro/procedimiento no Por reevaluar.

- [ ] **Paso 1: Pruebas que fallan** (en `test/ui.test.js`, cerca de las de «panel:»; use `abrirTablero`, `abrirPanelDe`, `ultimo`, `aviso` que ya existen. Los IDs de tarjeta del DEMO: elija una tarjeta de hierro con registro en Por contactar y una del historial; si no existe una con registro cotizado y vencido, agréguela al DEMO en el Paso 3 con DNI inventado `41333444`, `REG-000021`):

```js
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
```

(`HOY_DEMO` y `masDiasIso` existen ya en `test/ui.test.js` o se definen al inicio del archivo: `const HOY_DEMO = '2026-10-01';` — confirme el «hoy» del DEMO con `grep -n "hoy:" src/Index.html | head` y use ese; `const masDiasIso = (f, n) => new Date(Date.parse(f + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);`.)

Actualice las pruebas existentes que usen `'lohizo'` en el panel de hierro (la de «Lo hizo», las de arrastrar a Completado y la de atajos «4»): ahora el paso de hierro es `acepto` o «Marcar sesión»; cambie sus aserciones al comportamiento nuevo descrito arriba, sin quitar lo que verifican (que se llama al servidor y se mueve la tarjeta).

- [ ] **Paso 2: Ver que fallan** — `node --test --test-name-pattern="Aceptó|No desea realizarse" test/ui.test.js` → 3 `not ok`.

- [ ] **Paso 3: Implementación** en `src/Index.html`:

```js
const ACC = [
  { k: 'nocontesto', r: 'NO CONTESTÓ', l: 'No contestó', i: 'ph ph-phone-x i-gris' },
  { k: 'pensara', r: 'LO PENSARÁ', l: 'Lo pensará', i: 'ph ph-clock-countdown i-info' },
  { k: 'agendo', r: 'AGENDÓ CITA', l: 'Agendó cita', i: 'ph ph-calendar-plus i-info', para: p => p.t === 'reev' || p.t === 'ctrl' || p.porReevaluar },
  { k: 'acepto', r: 'ACEPTÓ', l: 'Aceptó', i: 'ph ph-handshake i-ok', para: p => (p.t === 'hier' || p.t === 'proc') && !p.porReevaluar }
];
const CIERRES = [
  { k: 'alta', r: 'ALTA MÉDICA', l: 'Alta médica', i: 'ph ph-seal-check', para: p => p.t === 'reev' },
  { k: 'numero', r: 'NÚMERO EQUIVOCADO', l: 'Número equivocado', i: 'ph ph-phone-disconnect', conTel: true },
  { k: 'otrolugar', r: 'SE ATIENDE EN OTRO LUGAR', l: 'Se atiende en otro lugar', i: 'ph ph-buildings' },
  { k: 'fallecio', r: 'FALLECIÓ', l: 'Falleció', i: 'ph ph-flower-lotus' },
  { k: 'otro', r: 'NO DESEA CONTINUAR', l: 'No desea continuar', i: 'ph ph-dots-three-outline', para: p => !(p.t === 'hier' || p.t === 'proc') || p.porReevaluar },
  { k: 'nodesea', r: 'NO DESEA REALIZARSE', l: 'No desea realizarse', i: 'ph ph-hand-palm', para: p => (p.t === 'hier' || p.t === 'proc') && !p.porReevaluar }
];
const RES = {};
ACC.concat(CIERRES, [{ k: 'lohizo', r: 'LO HIZO', l: 'Lo hizo', i: 'ph ph-check-square i-ok' }]).forEach(a => { RES[a.k] = a; RES[a.r] = a; });
const CIERRAN = ['NÚMERO EQUIVOCADO', 'SE ATIENDE EN OTRO LUGAR', 'FALLECIÓ', 'NO DESEA CONTINUAR', 'NO DESEA REALIZARSE'];
const accDe = p => ACC.filter(a => !a.para || a.para(p)).map(a => a.k === 'acepto' ? Object.assign({}, a, { l: p.t === 'hier' ? 'Aceptó tratamiento' : 'Aceptó procedimiento' }) : a);
const cierresDe = p => CIERRES.filter(c => (!c.conTel || activos(p).length) && (!c.para || c.para(p)));
```

En `adaptarTarjeta`, agregue `porReevaluar: raw.ESTADO === 'POR REEVALUAR'` y el tipo `ctrl` para `TIPO_SEGUIMIENTO === 'CONTROL'` (busque dónde se asigna `t: 'hier' | 'proc' | 'reev'` y añada `CONTROL: 'ctrl'`; dé a `ctrl` la etiqueta de chip «Control + lab.» con la misma clase que `proc`).

`rangoPaso`: `if (k === 'acepto') return { min: hoy, max: masDias(hoy, 180), f: hoy };`. `validarFecha`: falta → `'Falta la fecha de la primera sesión.'`, fuera de rango → `'La fecha de inicio va de hoy a 180 días.'`. `prepararPaso`: guarde `sesiones: p.idRegistro ? '' : String(Number(p.raw.CANTIDAD) || 1)`. `htmlPaso`:

```js
  if (k === 'acepto') {
    t = p.t === 'hier' ? 'Aceptó tratamiento' : 'Aceptó procedimiento'; icon = 'ph ph-handshake i-ok'; boton = 'Pasar a Agendado';
    campos = fecha('Fecha de la primera sesión') + (p.idRegistro ? ''
      : `<label class="campo">Sesiones<input type="number" id="ps" min="1" max="20" value="${esc(ps.sesiones)}"></label>`);
    aviso = 'Si pasa la fecha sin marcar la sesión, vuelve a «Por contactar».';
  }
  if (k === 'nodesea') {
    t = 'No desea realizarse'; icon = 'ph ph-hand-palm'; cierre = true;
    campos = `<label class="campo">Motivo<input id="pm" autocomplete="off" placeholder="Por ejemplo: por el precio" value="${esc(ps.motivo)}"></label>`;
    aviso = 'Escriba el motivo. Se cierra el seguimiento.'; deshab = !ps.motivo.trim();
  }
```

(añada `'nodesea'` a la lista inicial de `cierre` y conecte `#ps` en el mismo manejador `input` del panel que actualiza `ps.f` y `ps.motivo`). `confirmarPaso`: `if (k === 'acepto' && !p.idRegistro) extra.sesiones = Number(ps.sesiones) || 1;` y `if (k === 'nodesea') { extra.motivo = ps.motivo.trim(); if (!extra.motivo) { avisar('Escriba el motivo.'); return; } }`. `previsto`:

```js
  if (res === 'ACEPTÓ') return agendar('SESION', f, 0, `Sesión ${Number(t.HECHAS || 0) + 1} el ${diaSem(f)} ${dm(f)}`);
```

El panel de En tratamiento (`col === 3`): en lugar de `accDe(p)`, pinte

```js
`<div class="acc"><button type="button" data-marcar-sesion><i class="ph ph-check-square i-ok"></i><span>Marcar sesión ${p.trat.k + 1} hecha</span></button>`
+ `<button type="button" data-anular-ultima${p.raw.ULTIMA_SESION_ID ? '' : ' disabled'}><i class="ph ph-arrow-counter-clockwise"></i><span>Anular la última</span></button></div>`
```

«Marcar sesión» abre el paso existente `lohizo` (fecha de la sesión, hoy por omisión) y al confirmar llama a `guardarResultado(p.id, 'LO HIZO', extra)` — que el servidor ya delega en `marcarSesion` — o, si prefiere, directamente a `llamar('marcarSesion', { usuario, id: p.idRegistro, fecha, nota })` seguido de `cargarTablero(null, true)`; la prueba solo exige que se llame a `marcarSesion` con `id` = el registro. «Anular la última» abre un motivo en línea (como «Anular» de la historia) y llama a `anularSesion({ usuario, id: ULTIMA_SESION_ID, motivo })`.

`accionDrop`: `if (col === 2) return { paso: (p.t === 'hier' || p.t === 'proc') && !p.porReevaluar ? 'acepto' : 'agendo' };` y la rama de Completado de hierro/procedimiento → `{ aviso: 'Completado llega con la última sesión.' }`.

DEMO (`registrarResultado` del objeto `DEMO`): agregue las validaciones de la Tarea 4 (mismos textos) y:
- `ACEPTÓ` con `ID_REGISTRO`: pone `FECHA_INICIO` en el registro del DEMO y mueve la tarjeta a `AGENDADO` con `AGENDA: 'SESION'`;
- `ACEPTÓ` sin `ID_REGISTRO`: crea `REG-0000xx` en `registros` y una tarjeta nueva en Agendado; quita la del historial;
- `NO DESEA REALIZARSE`: saca la tarjeta y la agrega a `cerrados`.
Agregue al DEMO la tarjeta de hierro con registro `REG-000021` (DNI `41333444`, «SILVIA PRUEBA ROJAS», Hierro carboximaltosa × 3, cotizado hace 10 días, en Por contactar).

- [ ] **Paso 4: Ver que pasan** — `npm run test:ui 2>&1 | grep -E "^# (pass|fail)"` → `# fail 0`; `npm test` → `# fail 0`.

- [ ] **Paso 5: Commit** — `git add src/Index.html test/ui.test.js` (y `src/Registro.gs test/logica-registro.test.js` si agregó `ULTIMA_SESION_ID`) · mensaje: `Etapa 2: «Aceptó» y «No desea realizarse» en el panel, y sesiones desde En tratamiento`.

---

### Tarea 9: Filtro por mes en el Tablero (interfaz)

**Files:**
- Modify: `src/Index.html` (barra de filtros ~línea 695, `filtrados`, `hayFiltros`, preferencias `seg.*`)
- Test: `test/ui.test.js`

**Interfaces:**
- Consumes: `MES` de cada tarjeta (Tarea 4). En el DEMO, cada tarjeta de `getTablero` debe traer `MES`: agréguelo en la función del DEMO que arma las tarjetas con la misma regla (REEVALUACION → mes de `ULTIMA_CITA`; resto → mes de `FECHA_COTIZACION`).
- Produces: `S.mes` (`''` = todos), guardado en `localStorage['seg.mes']` (con `try/catch`, como `seg.tipo`).

- [ ] **Paso 1: Prueba que falla:**

```js
test('tablero: el filtro de mes muestra solo los pacientes de ese mes y se recuerda', async () => {
  const { navegador, pagina, errores } = await abrirTablero();
  try {
    const opciones = await pagina.locator('#fmes option').evaluateAll(o => o.map(x => x.value));
    assert.equal(opciones[0], '', '«Todos los meses» primero');
    assert.ok(opciones.length >= 3);
    const mes = opciones[1];
    await pagina.locator('#fmes').selectOption(mes);
    const meses = await pagina.evaluate(() => filtrados(true).map(p => p.raw.MES));
    assert.ok(meses.length && meses.every(m => m === mes));
    assert.equal(await pagina.evaluate(() => localStorage.getItem('seg.mes')), mes);
    assert.equal(Number(await pagina.locator('.kpis .k1 b, .kpis [data-k="porContactar"] b').first().textContent()),
      await pagina.evaluate(() => filtrados(true).filter(p => p.col === 1).length), 'la cifra de Por contactar sigue al filtro');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});
```

(Ajuste el selector de la cifra a la que ya usa la prueba «las cifras coinciden con el DEMO»: copie ese selector.)

- [ ] **Paso 2: Ver que falla.**

- [ ] **Paso 3: Implementación.** Un `<select id="fmes" class="filtro">` junto a «Todos los médicos», con `<option value="">Todos los meses</option>` y una opción por mes presente en `S.pacientes` (de más reciente a más antiguo; texto `nombreMes(m)` + año, igual que Indicadores). En `filtrados`: `&& (!S.mes || p.raw.MES === S.mes)`; en `hayFiltros`: `|| S.mes`. Al cambiar: `S.mes = e.target.value; guardarPref('seg.mes', S.mes); pintarTablero();`. Al arrancar, lea `seg.mes` y, si ese mes ya no existe en las opciones, déjelo en `''`. Si las cifras de la cabecera hoy no siguen a los filtros, haga que `porContactar`, `agendados` y `enTratamiento` se cuenten de `filtrados(true)` cuando `S.mes` tiene valor.

- [ ] **Paso 4: Ver que pasa** — `npm run test:ui` → `# fail 0`.

- [ ] **Paso 5: Commit** — `git add src/Index.html test/ui.test.js` · `Etapa 2: filtro por mes en el Tablero`.

---

### Tarea 10: Registro con tres opciones, «Registrados» por periodo, Editar y confirmación (interfaz)

**Files:**
- Modify: `src/Index.html` (pantalla Registro ~línea 2300–2700; DEMO: `guardarRegistro`, `darDeAlta`, nuevas `getRegistros` y `editarRegistro`)
- Test: `test/ui.test.js`

**Interfaces:**
- Consumes: `guardarRegistro` con `tipo: 'CONTROL'`, `examenes`, `fechaRetorno`, `fechaInicio` (Tarea 2); `darDeAlta` con `decision`, `fechaRetorno` (Tarea 6); `getRegistros({ periodo })` y `editarRegistro({ usuario, id, cambios })` (Tarea 7); `S.reglas.controlLab`.
- Produces: pestañas de Registro `data-rtab="indicacion" | "control" | "decision"`; lista `#rlista` con `#rperiodo` (`HOY` y los últimos 6 meses); botón `[data-editar="REG-…"]` que despliega en la fila un formulario con los campos editables según el tipo y `[data-guardar-edicion]`; fila afectada con la clase `ok-reciente` durante 3 s (estilo con `var(--ok-bg)` o el token de éxito que ya exista en `:root`; si no existe, créelo en `:root` y en `html[data-modo="oscuro"]`).

Comportamiento:
- **Control + laboratorio**: DNI (con «Paciente conocido» como en Indicación), nombre, contacto, doctor, `Exámenes indicados` (textarea opcional) y `Fecha de retorno` (date, por omisión hoy + `S.reglas.controlLab`). Botón «Registrar control».
- **Decisión del médico** (antes «Alta médica»): las especialidades del paciente (deshabilitada la que tenga alta vigente, como hoy), doctor, fecha de la consulta, y un grupo de radios `name="rdec"` con `ALTA` (por omisión), `ALTA 6 MESES`, `ALTA 1 AÑO`, `NUEVA REEVALUACION`; esta última muestra `Fecha de retorno` obligatoria. Debajo de las de 6 meses y 1 año, una línea: «Volverá a «Por contactar» el dd/mm/aaaa para agendar su control.» (fecha + 6/12 meses − `S.reglas.avisoAltaControl`).
- **Indicación**: un campo opcional «Fecha de la primera sesión» (date, min hoy).
- **Confirmación**: tras guardar, editar o anular, `avisar('Registro guardado: ' + TEXTO)` (o `'Registro editado: '`, `'Registro anulado: '`) y la fila con `ok-reciente` 3 s (sin transición si `prefers-reduced-motion`).
- **Editar**: solo en filas no anuladas y de tipo distinto de `DECISION`; el formulario manda solo los campos cambiados; si el servidor responde `sinCambios`, avisa «No hay cambios.»; un error se muestra en `avisar('No se guardó: ' + mensaje)` y el formulario queda abierto con lo escrito.
- **Ficha del paciente**: «Editar» en cada registro (mismo formulario en línea) y «Decisión del médico…» en lugar de «Dar de alta…», con los mismos radios.

- [ ] **Paso 1: Pruebas que fallan** (cerca de las de «registro:»; use `abrirRegistro` y los ayudantes del archivo):

```js
test('registro: control + laboratorio propone el retorno a 15 días y lo registra', async () => {
  const { navegador, pagina, errores } = await abrirRegistro();
  try {
    await pagina.locator('[data-rtab="control"]').click();
    await pagina.locator('#rdni').fill('40111222');
    await pagina.waitForSelector('text=Paciente conocido');
    await pagina.locator('#rdoctor').selectOption({ index: 1 });
    assert.equal(await pagina.locator('#rretorno').inputValue(), masDiasIso(HOY_DEMO, 15));
    await pagina.locator('#rexamenes').fill('Hemograma');
    await pagina.locator('#rregistrar').click();
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
    await pagina.locator('#adoctor').selectOption({ index: 1 });
    await pagina.locator('input[name="rdec"][value="NUEVA REEVALUACION"]').check();
    await pagina.locator('#aregistrar').click();
    assert.match(await aviso(pagina), /fecha de retorno/);
    await pagina.locator('#aretorno').fill(masDiasIso(HOY_DEMO, 40));
    await pagina.locator('#aregistrar').click();
    await pagina.waitForFunction(() => DEMO._llamadas.darDeAlta > 0);
    const u = await ultimo(pagina, 'darDeAlta');
    assert.deepEqual([u.decision, u.fechaRetorno], ['NUEVA REEVALUACION', masDiasIso(HOY_DEMO, 40)]);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('registro: «Registrados» por mes, Editar manda solo lo cambiado y confirma', async () => {
  const { navegador, pagina, errores } = await abrirRegistro();
  try {
    const periodos = await pagina.locator('#rperiodo option').evaluateAll(o => o.map(x => x.value));
    assert.equal(periodos[0], 'HOY');
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
```

(Los IDs `#rdni`, `#rdoctor`, `#adni`, `#adoctor`, `#rregistrar`, `#aregistrar`: use los que ya tiene la pantalla Registro — confírmelos con `grep -n 'id="r\|id="a' src/Index.html | head -40` — y agregue `#rretorno`, `#rexamenes`, `#aretorno`, `#rperiodo`, `#rlista` nuevos. `DEMO._registroConSesiones()` es un ayudante de prueba del DEMO que crea hoy un registro de hierro con 3 sesiones, 2 hechas, y devuelve su ID.)

- [ ] **Paso 2: Ver que fallan.**

- [ ] **Paso 3: Implementación.** Siga el comportamiento de arriba reutilizando las piezas de la pantalla Registro (validación local con la barra «Falta: …», `exigirUsuario`, el aviso de duplicado). DEMO: `guardarRegistro` acepta `tipo: 'CONTROL'` (mismas validaciones que `validarRegistro` de la Tarea 2), `darDeAlta` acepta `decision`/`fechaRetorno` (mismas validaciones de la Tarea 6), `getRegistros({ periodo })` filtra por `FECHA_HORA` (hoy o mes) y `editarRegistro` aplica las reglas de `validarEdicionRegistro` (Tarea 7) con los mismos mensajes. `getRegistrosHoy` del DEMO pasa a llamar a `getRegistros({ periodo: 'HOY' })`. La app llama a `getRegistros` (ya no a `getRegistrosHoy`).

- [ ] **Paso 4: Ver que pasan** — `npm run test:ui` y `npm test` → `# fail 0`. Las pruebas existentes de «Registrados hoy» deben adaptarse al nombre nuevo «Registrados» y a `getRegistros` sin perder lo que comprueban (anular con motivo, fila tachada, en vuelo).

- [ ] **Paso 5: Commit** — `git add src/Index.html test/ui.test.js` · `Etapa 2: Registro con control + laboratorio y decisión del médico, Registrados por mes, Editar y confirmación`.

---

### Tarea 11: Ficha del paciente (Editar y «Decisión del médico…») y estados de registro

**Files:**
- Modify: `src/Index.html` (ficha ~línea 2880–3060: «Dar de alta…», lista de tratamientos)
- Modify: `src/Codigo.gs` (`getPaciente`: cada registro con `ESTADO_REGISTRO`, `FECHA_INICIO`, `EXAMENES`, `FECHA_RETORNO`, `HECHAS`, `SESIONES`)
- Test: `test/ui.test.js`, `test/resultado-servidor.test.js`

**Interfaces:**
- Consumes: `estadoRegistro` (Tarea 2), `editarRegistro` (Tarea 7), `darDeAlta` con `decision` (Tarea 6).
- Produces: en la ficha, por registro, una línea de estado: `Cotizado` · `Programado el dd/mm` · `Sesión k de n` · `Completo` · `Control el dd/mm · exámenes…`; botón `[data-editar-ficha="REG-…"]`; botón «Decisión del médico…» (`[data-decision="ESPECIALIDAD"]`) que abre doctor, fecha y los cuatro radios `name="fdec"`.

- [ ] **Paso 1: Pruebas que fallan.** En `test/resultado-servidor.test.js`:

```js
test('getPaciente: cada registro trae su estado, la fecha de inicio y, si es control, los exámenes y el retorno', () => {
  const { ctx } = servidorResultado({ conRegistroProgramadoYControl: true });
  const p = plano(ctx.getPaciente('40111222'));
  assert.deepEqual(p.registros.map(r => [r.ID, r.ESTADO_REGISTRO, r.FECHA_INICIO, r.EXAMENES, r.FECHA_RETORNO]),
    [['REG-000010', 'PROGRAMADO', '2026-10-12', '', ''], ['REG-000011', 'PROGRAMADO', '', 'hemograma', '2026-10-24']]);
});
```

(Agregue la opción `conRegistroProgramadoYControl` a `servidorResultado` de la Tarea 5: dos registros del DNI 40111222, uno de hierro con `FECHA_INICIO` `2026-10-12` y un CONTROL con `EXAMENES` `hemograma` y `FECHA_RETORNO` `2026-10-24`. Si `getPaciente` arma los registros en otra forma, adapte los nombres de campo a esa forma, manteniendo los cinco datos.)

En `test/ui.test.js`:

```js
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
```

Actualice las pruebas existentes de «Dar de alta…» en la ficha: ahora el botón es `[data-decision]` y el servidor recibe `decision: 'ALTA'` por omisión.

- [ ] **Paso 2: Ver que fallan.**

- [ ] **Paso 3: Implementación.** En `getPaciente` (`src/Codigo.gs`), al armar cada registro del paciente, agregue `var e = estadoRegistro(r, d.sesiones);` y los campos `ESTADO_REGISTRO: e.estado, FECHA_INICIO: fechaIso(r.FECHA_INICIO) || '', EXAMENES: r.EXAMENES || '', FECHA_RETORNO: fechaIso(r.FECHA_RETORNO) || '', HECHAS: e.hechas, SESIONES: e.total`. En la ficha: la línea de estado, el botón Editar (reutilice el formulario en línea de la Tarea 10, con la misma función que lo pinta) y «Decisión del médico…» (reutilice el formulario del alta con los radios). El DEMO `getPaciente` devuelve esos campos.

- [ ] **Paso 4: Ver que pasan** — `npm test` y `npm run test:ui` → `# fail 0`.

- [ ] **Paso 5: Commit** — `git add src/Codigo.gs src/Index.html test/resultado-servidor.test.js test/ui.test.js` · `Etapa 2: ficha con estado de cada registro, Editar y «Decisión del médico…»`.

---

### Tarea 12: Documentación, verificación final y capturas

**Files:**
- Modify: `CLAUDE.md`
- Create (fuera del repo): capturas en el scratchpad

- [ ] **Paso 1: CLAUDE.md.** Agregue una sección «Etapa 2 (09/10/2026)» con, en una línea cada uno:
  - las columnas nuevas de REGISTROS (`FECHA_INICIO`, `EXAMENES`, `FECHA_RETORNO`, `EDITADO`) y de ALTAS (`DECISION`, `FECHA_RETORNO`);
  - los tres parámetros de REGLAS y sus valores;
  - «Agendó cita» es solo de reevaluación (y de Control y Por reevaluar); en hierro y procedimiento es «Aceptó», y el atajo 3 cambia de significado;
  - «Lo hizo» ya no se ofrece; las filas antiguas se leen igual;
  - el recorrido Programado → En tratamiento → Completado → Por reevaluar (30 días);
  - las cuatro decisiones del médico y sus ventanas;
  - editar: qué se puede y qué no, y que cada cambio va a BITACORA;
  - publicar: «Preparar hojas» antes de usar las pantallas nuevas (si no, se niegan a escribir).
  Actualice la tabla de atajos (tecla 3) y la línea de «Dar de alta…».

- [ ] **Paso 2: Verificación completa.**

Run: `npm test 2>&1 | grep -E "^# (pass|fail)"` y `npm run test:ui 2>&1 | grep -E "^# (pass|fail)"`
Expected: `# fail 0` en ambos. Anote los totales en el mensaje del commit.

- [ ] **Paso 3: Capturas** (para la usuaria; no se suben al repo). Adapte `capturas-final.js` del scratchpad (`/tmp/claude-0/-home-user-crm-leads-chp/beac2516-a2c1-5ca6-b1d3-d3fa4bf750fc/scratchpad/`) para fotografiar a 1440 px en claro: el panel de hierro con «Aceptó», el paso «Aceptó», una tarjeta «Sesión 1 el…», el panel de En tratamiento con «Marcar sesión», «Por reevaluar», Registro → Control + laboratorio, Registro → Decisión del médico, «Registrados» con Editar abierto, y el filtro de mes.

- [ ] **Paso 4: Commit y push**

```bash
git add CLAUDE.md
git commit -m "Etapa 2: instrucciones del proyecto"
git push -u origin claude/compassionate-lovelace-3q6rh3
git push origin HEAD:main
```
