# Plataforma de Seguimientos CHP — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir una app web en Apps Script, sobre el libro madre `BD SOFDOC SEGUIMIENTOS`. Detecta a los pacientes que no volvieron a su reevaluación, muestra sus datos para que alguien les escriba, registra cada seguimiento y mide la conversión.

**Architecture:** La lógica de negocio vive en `src/Logica.gs` como funciones puras, sin llamadas a Google, probadas con `node --test`. `src/Codigo.gs` es la única capa que lee y escribe el Sheets y expone las funciones que llama la app. `src/Menu.gs` monta el menú del Sheets: preparar hojas, actualizar desde SOFDOC, importar hierro y verificar. `src/Index.html` es la app entera, con un bloque `DEMO` para probarla sin desplegar. La interfaz se prueba con Playwright.

**Tech Stack:** Google Apps Script V8, clasp 2.4.x, Node 22 (`node:test`), Playwright 1.56.1 (Chromium ya instalado en `/opt/pw-browsers`).

**Spec:** `docs/superpowers/specs/2026-10-01-plataforma-seguimientos-design.md`

## Global Constraints

- Toda la interfaz, los mensajes y los errores van en **español**.
- Libro madre: `1L8fY-NXWE1agakIPEdqoLnLry0-lvYr0Z-9JfsfGxRM`.
- Base de hierro (origen de la importación única): `1FrJ9oXyeHLLABqLcSA2VyXry-x_ZeFow6LsSACeJw8o`.
- Zona horaria: `America/Lima`. Runtime: `V8`.
- Web app: `executeAs: USER_DEPLOYING`, `access: ANYONE`.
- Paleta: granate `#6F1713`, hueso `#FAF6F1`, en tokens `--chp-*` declarados solo en `:root` y en `html[data-modo="oscuro"]`. **Ningún color escrito a mano fuera de esos dos bloques.**
- clasp `^2.4.2`. **Nunca** `npm audit fix --force`, que sube clasp a la v3 y rompe los scripts.
- `Logica.gs` no llama a `SpreadsheetApp`, `Utilities`, `Session`, `LockService` ni `HtmlService`.
- Las fechas viajan dentro de la lógica como texto `yyyy-MM-dd`. Al escribirse en la hoja se convierten en `Date` **a mediodía**.
- Todo lo que se devuelve a la app pasa por `limpiarParaEnvio()`, porque un `NaN` hace que `google.script.run` devuelva `null`.
- Toda escritura en el Sheets pasa por `LockService.getScriptLock()`.
- Identificadores: paciente = `DNI`, cita = `IDCITA`, indicación = `ID`, seguimiento = `ID`. **Nunca el número de fila.**
- **Ningún dato real de pacientes en el repositorio.** Las pruebas y el `DEMO` usan nombres, DNI y teléfonos inventados.
- **Sin conexión a WhatsApp ni SMS.**
- Nombres de funciones públicas fijos: `doGet`, `bootstrap`, `getBandeja`, `getPaciente`, `buscar`, `marcarSeguimiento`, `descartar`, `confirmarEmparejamiento`, `getKpi`.
- Las pruebas de lógica cargan `Logica.gs` en un `vm` aparte. Por eso los objetos y arrays que devuelve vienen de otro *realm* y antes de `assert.deepEqual` se pasan por `plano()` (ida y vuelta a JSON).
- Repositorio: `admcuidartec-hue/SEGUIMIENTOS`, rama `claude/compassionate-lovelace-3q6rh3`.

## Review Focus

1. **Pegar en `Hoja 1` solo el export del mes nuevo** debe conservar en `CITAS` las citas anteriores, no borrarlas. Lo cubre la prueba `fusionarCitas conserva las citas que ya no vienen en el pegado` (Tarea 3).
2. **Una cita `Agendado` con fecha pasada que nunca se actualizó en SOFDOC** no debe sacar al paciente de la bandeja para siempre. Lo cubre la prueba `agendada en el pasado no cuenta` (Tarea 4).
3. **Un paciente descartado que después vuelve** deja de estar `DESCARTADO`. Lo cubre la prueba `si vuelve después, deja de estarlo` (Tarea 4).
4. **Una indicación con una sola palabra en el nombre** («ROSA») nunca debe emparejarse sola. **Un DNI con ceros a la izquierda** (`06174169`) es el mismo paciente que `6174169`. Lo cubren `una sola palabra nunca es AUTOMÁTICO` y `aplicarEmparejamientos respeta… el DNI escrito a mano` (Tarea 5), y `normDni` (Tarea 2).
5. **Una especialidad escrita con o sin tilde** (`HEMATOLOGIA` en `REGLAS`, `HEMATOLOGÍA` en SOFDOC) usa la misma regla y la misma serie. Lo cubren `reglas: especialidad con o sin tilde es la misma` y `especialidades separadas` (Tarea 4).

---

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `package.json`, `.gitignore`, `CLAUDE.md` | Proyecto, scripts npm, reglas para quien venga después |
| `src/appsscript.json` | Manifiesto: zona, permisos, web app |
| `src/Logica.gs` | Lógica pura: normalizar, limpiar citas, estado, emparejamiento, pacientes, KPI |
| `src/Codigo.gs` | Lectura y escritura del Sheets; funciones públicas para la app |
| `src/Menu.gs` | Menú `Seguimientos`: actualizar, verificar, preparar hojas, importar |
| `src/Index.html` | La app: bandeja, ficha, tablero, más el bloque `DEMO` |
| `test/cargar.js` | Carga los `.gs` en un `vm` para probarlos |
| `test/fixtures.js` | Fábricas de citas, seguimientos y reglas para las pruebas |
| `test/logica-*.test.js` | Pruebas de `Logica.gs` |
| `test/sintaxis.test.js` | Los `.gs` cargan juntos y exponen las funciones públicas |
| `test/ui.test.js` | La app en modo `DEMO`, con Playwright |

---

### Task 1: Esqueleto del proyecto

**Files:**
- Create: `package.json`, `.gitignore`, `CLAUDE.md`, `src/appsscript.json`, `test/cargar.js`

**Interfaces:**
- Produces: `test/cargar.js` exporta `cargar(archivos = ['Logica.gs'])`, que devuelve el contexto `vm` con las funciones globales, y `plano(x)`, que devuelve `JSON.parse(JSON.stringify(x))`.

- [ ] **Step 1: Crear `package.json`**

```json
{
  "name": "seguimientos-chp",
  "version": "1.0.0",
  "description": "Plataforma de seguimiento de pacientes del Centro Hematológico del Perú sobre Google Apps Script",
  "private": true,
  "scripts": {
    "test": "node --test test/logica-*.test.js test/sintaxis.test.js",
    "test:ui": "node --test test/ui.test.js",
    "login": "clasp login",
    "subir": "clasp push --force",
    "url": "clasp deployments",
    "registros": "clasp logs --watch"
  },
  "devDependencies": {
    "@google/clasp": "^2.4.2",
    "playwright": "1.56.1"
  }
}
```

- [ ] **Step 2: Crear `.gitignore`**

```
node_modules/
.clasprc.json
```

- [ ] **Step 3: Crear `src/appsscript.json`**

```json
{
  "timeZone": "America/Lima",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/script.container.ui"
  ],
  "webapp": {
    "executeAs": "USER_DEPLOYING",
    "access": "ANYONE"
  }
}
```

- [ ] **Step 4: Crear `test/cargar.js`**

```js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

/**
 * Carga los .gs indicados en un contexto vm, como hace Apps Script: todas las
 * declaraciones de nivel superior quedan como propiedades del contexto.
 */
function cargar(archivos = ['Logica.gs']) {
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
```

- [ ] **Step 5: Crear `CLAUDE.md`**

````markdown
# Seguimientos CHP — instrucciones para Claude Code

Plataforma para no perder pacientes que no volvieron a su reevaluación, del **Centro
Hematológico del Perú**. Es Apps Script incrustado en el libro madre **BD SOFDOC SEGUIMIENTOS**.
La usan Magaly, Ana, Rachel y el Dr. Eli Cabanillas.

- Libro madre: `1L8fY-NXWE1agakIPEdqoLnLry0-lvYr0Z-9JfsfGxRM`
- Base de hierro (solo para la importación única): `1FrJ9oXyeHLLABqLcSA2VyXry-x_ZeFow6LsSACeJw8o`
- Zona horaria: `America/Lima` · Idioma: **español** · Paleta: granate `#6F1713`, hueso `#FAF6F1`
- Diseño: `docs/superpowers/specs/2026-10-01-plataforma-seguimientos-design.md`
- Plan: `docs/superpowers/plans/2026-10-01-plataforma-seguimientos.md`

## Archivos

| Archivo | Rol |
|---|---|
| `src/Logica.gs` | Lógica pura. **Sin llamadas a Google**: se prueba con `npm test` |
| `src/Codigo.gs` | Lee y escribe el Sheets; funciones que llama la app |
| `src/Menu.gs` | Menú `Seguimientos` del Sheets |
| `src/Index.html` | La app. El bloque `DEMO` del final permite abrirla en el navegador sin desplegar: **no lo elimine** |

## Reglas al modificar

- `npm test` (lógica) y `npm run test:ui` (interfaz) deben pasar antes de subir.
- No cambie los nombres `doGet`, `bootstrap`, `getBandeja`, `getPaciente`, `buscar`,
  `marcarSeguimiento`, `descartar`, `confirmarEmparejamiento`, `getKpi`.
- Paciente = `DNI`, cita = `IDCITA`, indicación = `ID`. **Nunca el número de fila.**
- Las reglas de negocio (plazos, usuarios, motivos, alias de médicos) viven en las hojas
  `REGLAS` y `CATALOGOS`. Cambiar un plazo es editar una celda, no publicar.
- Toda escritura pasa por `LockService`. Todo lo que se devuelve a la app pasa por `limpiarParaEnvio()`.
- Las fechas se guardan **a mediodía**.
- **No escriba colores a mano** fuera de `:root` y `html[data-modo="oscuro"]`.
- **Ningún dato real de pacientes en el repositorio.**
- **Nunca `npm audit fix --force`**: sube clasp a la v3 y rompe los scripts.
- Sin conexión a WhatsApp: la app muestra los datos y se marca «Seguimiento hecho».

## Publicar

Se completa en la Tarea 12 del plan, con los ID de despliegue.
````

- [ ] **Step 6: Instalar dependencias y comprobar que el cargador funciona**

Run: `npm install && node -e "require('./test/cargar.js'); console.log('ok')"`
Expected: la instalación termina sin errores (no descarga navegadores porque `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`) y se imprime `ok`.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json .gitignore CLAUDE.md src/appsscript.json test/cargar.js
git commit -m "Esqueleto del proyecto: package, manifiesto y cargador de pruebas"
```

---

### Task 2: Utilidades de normalización y fechas

**Files:**
- Create: `src/Logica.gs`
- Test: `test/logica-base.test.js`

**Interfaces:**
- Consumes: `cargar`, `plano` de `test/cargar.js`.
- Produces (globales en `Logica.gs`):
  - `normTexto(v) → string`: sin tildes, mayúsculas, espacios colapsados.
  - `normDni(v) → string`: sin espacios, puntos ni guiones; un DNI numérico pierde los ceros a la izquierda.
  - `normTelefono(v) → string`: solo dígitos, sin prefijo 51; `''` si tiene menos de 7.
  - `fechaIso(v) → 'yyyy-MM-dd' | ''`.
  - `diasEntre(desde, hasta) → number`, `sumarDias(iso, n) → iso`, `mesDe(iso) → 'yyyy-MM'`.
  - `PALABRAS_VACIAS`: objeto con `DE, DEL, LA, LAS, LOS, Y`.

- [ ] **Step 1: Escribir las pruebas**

```js
// test/logica-base.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar } = require('./cargar');
const L = cargar();

test('normTexto quita tildes, espacios sobrantes y pasa a mayúsculas', () => {
  assert.equal(L.normTexto('  Hematología  médica\n'), 'HEMATOLOGIA MEDICA');
  assert.equal(L.normTexto(null), '');
  assert.equal(L.normTexto(undefined), '');
});

test('normDni: un DNI numérico pierde los ceros a la izquierda; el extranjero se conserva', () => {
  assert.equal(L.normDni('06174169'), '6174169');
  assert.equal(L.normDni(6174169), '6174169');
  assert.equal(L.normDni(' pe3111043 '), 'PE3111043');
  assert.equal(L.normDni('40.111.222'), '40111222');
  assert.equal(L.normDni(''), '');
});

test('normTelefono deja solo los dígitos y quita el 51', () => {
  assert.equal(L.normTelefono('978 826 985'), '978826985');
  assert.equal(L.normTelefono(945365292), '945365292');
  assert.equal(L.normTelefono('+51 978 826 985'), '978826985');
  assert.equal(L.normTelefono(''), '');
  assert.equal(L.normTelefono('123'), '');
});

test('fechaIso entiende el formato de SOFDOC y el de la capa de datos', () => {
  assert.equal(L.fechaIso('2026-09-28 | 02:00 PM'), '2026-09-28');
  assert.equal(L.fechaIso('2026-09-28 14:05'), '2026-09-28');
  assert.equal(L.fechaIso('2026-09-28'), '2026-09-28');
  assert.equal(L.fechaIso('25/2/2026'), '');
  assert.equal(L.fechaIso(null), '');
});

test('diasEntre y sumarDias cruzan meses y años', () => {
  assert.equal(L.diasEntre('2026-01-31', '2026-03-01'), 29);
  assert.equal(L.diasEntre('2026-03-01', '2026-01-31'), -29);
  assert.equal(L.sumarDias('2026-12-20', 45), '2027-02-03');
  assert.equal(L.mesDe('2026-09-28'), '2026-09');
});
```

- [ ] **Step 2: Correr las pruebas y ver que fallan**

Run: `node --test test/logica-base.test.js`
Expected: FAIL. `ENOENT` porque `src/Logica.gs` aún no existe.

- [ ] **Step 3: Crear `src/Logica.gs` con las utilidades**

```js
/* ==========================================================================
   LÓGICA PURA

   Nada en este archivo llama a SpreadsheetApp, Utilities, Session ni
   LockService: todo recibe datos y devuelve datos. Así se prueba con Node
   (`npm test`) sin desplegar.

   Las fechas viajan como texto 'yyyy-MM-dd'. Convertirlas a Date —a
   mediodía— es trabajo de Codigo.gs, al escribir en la hoja.
   ========================================================================== */

var PALABRAS_VACIAS = { DE: 1, DEL: 1, LA: 1, LAS: 1, LOS: 1, Y: 1 };

function normTexto(v) {
  return String(v == null ? '' : v)
    .replace(/\n/g, ' ')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/**
 * DNI, carné de extranjería o pasaporte -> clave del paciente.
 * Un DNI numérico pierde los ceros a la izquierda porque SOFDOC ya los perdió
 * ('06174169' en una base y 6174169 en la otra son la misma persona).
 */
function normDni(v) {
  var s = normTexto(v).replace(/[\s.\-]/g, '');
  if (/^\d+$/.test(s)) s = s.replace(/^0+/, '');
  return s;
}

function normTelefono(v) {
  var d = String(v == null ? '' : v).replace(/\.0+$/, '').replace(/\D/g, '');
  if (d.length === 11 && d.indexOf('51') === 0) d = d.slice(2);
  return d.length >= 7 ? d : '';
}

/** 'yyyy-MM-dd' tomado del inicio del texto; '' si no empieza por una fecha ISO. */
function fechaIso(v) {
  var m = String(v == null ? '' : v).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[1] + '-' + m[2] + '-' + m[3] : '';
}

function diaUtc_(iso) {
  var p = String(iso).split('-');
  return Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
}

function diasEntre(desde, hasta) {
  return Math.round((diaUtc_(hasta) - diaUtc_(desde)) / 86400000);
}

function sumarDias(iso, n) {
  var d = new Date(diaUtc_(iso) + n * 86400000);
  return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2);
}

function mesDe(iso) {
  return String(iso || '').slice(0, 7);
}
```

- [ ] **Step 4: Correr las pruebas y ver que pasan**

Run: `node --test test/logica-base.test.js`
Expected: PASS, 5 pruebas.

- [ ] **Step 5: Commit**

```bash
git add src/Logica.gs test/logica-base.test.js
git commit -m "Lógica: normalización de texto, DNI, teléfono y fechas"
```

---

### Task 3: Limpiar y fusionar las citas de SOFDOC

**Files:**
- Modify: `src/Logica.gs` (se añade al final)
- Test: `test/logica-citas.test.js`

**Interfaces:**
- Consumes: `normTexto`, `normDni`, `fechaIso` (Tarea 2).
- Produces:
  - `COLUMNAS_CITAS`: `['IDCITA','DNI','NOMBRE','FECHA','ESTADO','ESPECIALIDAD','MEDICO','MODALIDAD','TIPO_PACIENTE','MARCA','PAGO','ESTADO_PAGO','REGISTRADO_POR','FECHA_REGISTRO']`.
  - `indiceDeEncabezado(encabezado) → { [normTexto(nombre)]: indice }`.
  - `claveRegistro(texto) → string` (el texto si empieza por `yyyy-`; si no, `''`).
  - `limpiarCitas(encabezado, filas, alias) → { citas: Cita[], faltantes: string[], invalidas: number }`. `Cita` tiene las claves de `COLUMNAS_CITAS`; `ESTADO` va normalizado (`'REALIZADO'`, `'AGENDADO'`…); `alias` es `{ [normTexto(alias)]: nombreCanónico }`.
  - `fusionarCitas(previas, nuevas) → { citas: Cita[], nuevas: number, cambiadas: number }`, ordenadas por `FECHA` y luego `IDCITA`.

- [ ] **Step 1: Escribir las pruebas**

```js
// test/logica-citas.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar, plano } = require('./cargar');
const L = cargar();

const ENC = ['FECHA DE REGISTRO', 'IDCITA', 'ESTADO DE CITA', 'FECHA DE ATENCION | HORA', 'CANAL DE ATENCIÓN',
  'CAMPAÑA', 'CONVENIO', 'MODALDIAD', 'PACIENTE', 'PRECIO DE CITA', 'MOVILIDAD', 'DESCUENTO DE CITA',
  'PAGO REALIZADO', 'PAGO RESTANTE', 'ESTADO DE PAGO', 'DNI DEL PACIENTE', 'TIPO PACIENTE',
  'ESPECIALIDAD MEDICA', 'MEDICO', 'MARCA', 'REGISTRADO POR'];

function fila(o) {
  return [o.reg || '2026-09-01 10:00', o.id, o.estado || 'Realizado', o.fecha, 'Canal Digital', '00_NINGUNO',
    '00_Ninguno', 'CLÍNICA', o.nombre || 'ROSA ELENA QUISPE HUAMAN', 200, 0, 0, 200, 0, 'PAGO COMPLETO',
    o.dni === undefined ? '40111222' : o.dni, 'NUEVO PACIENTE', o.esp || 'HEMATOLOGÍA',
    o.medico || 'Dra. KAREN DIANA MATOS PEÑA', 'Centro Hematológico del Perú', 'MAGALY'];
}

test('limpiarCitas normaliza IDCITA, DNI, fecha, estado y nombre', () => {
  const r = L.limpiarCitas(ENC, [fila({ id: 'cim1', fecha: '2026-09-28 | 02:00 PM', dni: ' 040111222 ', nombre: 'ROSA  ELENA ' })], {});
  assert.deepEqual(plano(r.faltantes), []);
  assert.equal(r.citas.length, 1);
  const c = r.citas[0];
  assert.equal(c.IDCITA, 'CIM1');
  assert.equal(c.DNI, '40111222');
  assert.equal(c.FECHA, '2026-09-28');
  assert.equal(c.ESTADO, 'REALIZADO');
  assert.equal(c.NOMBRE, 'ROSA ELENA');
  assert.equal(c.ESPECIALIDAD, 'HEMATOLOGÍA');
  assert.equal(c.MODALIDAD, 'CLÍNICA');
  assert.deepEqual(plano(Object.keys(c)), plano(L.COLUMNAS_CITAS));
});

test('encabezado incompleto: no devuelve citas y nombra la columna que falta', () => {
  const enc = ENC.filter(c => c !== 'DNI DEL PACIENTE');
  const r = L.limpiarCitas(enc, [fila({ id: 'C1', fecha: '2026-09-28 | 09:00 AM' })], {});
  assert.deepEqual(plano(r.faltantes), ['DNI DEL PACIENTE']);
  assert.equal(r.citas.length, 0);
});

test('filas sin IDCITA, DNI o fecha válida se cuentan como inválidas', () => {
  const r = L.limpiarCitas(ENC, [
    fila({ id: '', fecha: '2026-09-28 | 09:00 AM' }),
    fila({ id: 'C2', fecha: '2026-09-28 | 09:00 AM', dni: '' }),
    fila({ id: 'C3', fecha: 'mañana' }),
    fila({ id: 'C4', fecha: '2026-09-28 | 09:00 AM' })
  ], {});
  assert.equal(r.invalidas, 3);
  assert.deepEqual(plano(r.citas.map(c => c.IDCITA)), ['C4']);
});

test('IDCITA repetido: gana el registro más reciente, en cualquier orden', () => {
  const vieja = fila({ id: 'C5', fecha: '2026-09-28 | 09:00 AM', estado: 'Agendado', reg: '2026-09-01 10:00' });
  const nueva = fila({ id: 'C5', fecha: '2026-09-28 | 09:00 AM', estado: 'Realizado', reg: '2026-09-05 08:00' });
  assert.equal(L.limpiarCitas(ENC, [vieja, nueva], {}).citas[0].ESTADO, 'REALIZADO');
  assert.equal(L.limpiarCitas(ENC, [nueva, vieja], {}).citas[0].ESTADO, 'REALIZADO');
});

test('el alias de médico unifica ELI y ELÍ', () => {
  const alias = {};
  alias[L.normTexto('Dr. ELI FABRIZIO CABANILLAS HUALPA')] = 'Dr. ELÍ FABRIZIO CABANILLAS HUALPA';
  const r = L.limpiarCitas(ENC, [
    fila({ id: 'C6', fecha: '2026-09-01 | 09:00 AM', medico: 'Dr. ELI FABRIZIO CABANILLAS HUALPA' }),
    fila({ id: 'C7', fecha: '2026-09-02 | 09:00 AM', medico: 'Dr. ELÍ FABRIZIO CABANILLAS HUALPA' })
  ], alias);
  assert.deepEqual(plano(r.citas.map(c => c.MEDICO)), ['Dr. ELÍ FABRIZIO CABANILLAS HUALPA', 'Dr. ELÍ FABRIZIO CABANILLAS HUALPA']);
});

function c(id, fecha, estado, reg) {
  return { IDCITA: id, DNI: '40111222', NOMBRE: 'ROSA', FECHA: fecha, ESTADO: estado, ESPECIALIDAD: 'HEMATOLOGÍA',
    MEDICO: 'X', MODALIDAD: '', TIPO_PACIENTE: '', MARCA: '', PAGO: '', ESTADO_PAGO: '', REGISTRADO_POR: '', FECHA_REGISTRO: reg };
}

test('fusionarCitas conserva las citas que ya no vienen en el pegado', () => {
  const previas = [c('A', '2026-07-01', 'REALIZADO', '2026-06-20 10:00'), c('B', '2026-09-01', 'AGENDADO', '2026-08-20 10:00')];
  const nuevas = [c('B', '2026-09-01', 'REALIZADO', '2026-09-01 12:00'), c('C', '2026-09-15', 'AGENDADO', '2026-09-10 09:00')];
  const r = L.fusionarCitas(previas, nuevas);
  assert.deepEqual(plano(r.citas.map(x => x.IDCITA)), ['A', 'B', 'C']);
  assert.equal(r.citas[1].ESTADO, 'REALIZADO');
  assert.equal(r.nuevas, 1);
  assert.equal(r.cambiadas, 1);
});

test('fusionarCitas ignora una versión más vieja de la misma cita', () => {
  const r = L.fusionarCitas([c('B', '2026-09-01', 'REALIZADO', '2026-09-01 12:00')], [c('B', '2026-09-01', 'AGENDADO', '2026-08-20 10:00')]);
  assert.equal(r.citas[0].ESTADO, 'REALIZADO');
  assert.equal(r.cambiadas, 0);
  assert.equal(r.nuevas, 0);
});
```

- [ ] **Step 2: Correr las pruebas y ver que fallan**

Run: `node --test test/logica-citas.test.js`
Expected: FAIL con `L.limpiarCitas is not a function`.

- [ ] **Step 3: Añadir al final de `src/Logica.gs`**

```js
/* ==========================================================================
   CITAS DE SOFDOC
   ========================================================================== */

/** Columnas que SOFDOC debe traer. Si falta una, no se escribe nada. */
var SOFDOC_OBLIGATORIAS = {
  IDCITA: 'IDCITA', ESTADO: 'ESTADO DE CITA', FECHA: 'FECHA DE ATENCION | HORA',
  NOMBRE: 'PACIENTE', DNI: 'DNI DEL PACIENTE', ESPECIALIDAD: 'ESPECIALIDAD MEDICA',
  MEDICO: 'MEDICO', FECHA_REGISTRO: 'FECHA DE REGISTRO'
};
/** 'MODALDIAD' va con la errata del export original. */
var SOFDOC_OPCIONALES = {
  MODALIDAD: 'MODALDIAD', TIPO_PACIENTE: 'TIPO PACIENTE', MARCA: 'MARCA',
  ESTADO_PAGO: 'ESTADO DE PAGO', PAGO: 'PAGO REALIZADO', REGISTRADO_POR: 'REGISTRADO POR'
};

var COLUMNAS_CITAS = ['IDCITA', 'DNI', 'NOMBRE', 'FECHA', 'ESTADO', 'ESPECIALIDAD', 'MEDICO', 'MODALIDAD',
  'TIPO_PACIENTE', 'MARCA', 'PAGO', 'ESTADO_PAGO', 'REGISTRADO_POR', 'FECHA_REGISTRO'];

function indiceDeEncabezado(encabezado) {
  var idx = {};
  (encabezado || []).forEach(function (c, i) {
    var k = normTexto(c);
    if (k && idx[k] === undefined) idx[k] = i;
  });
  return idx;
}

function textoLimpio_(v) {
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
}

/** Solo las marcas 'yyyy-…' se pueden comparar como texto; lo demás no desempata. */
function claveRegistro(v) {
  var s = String(v == null ? '' : v);
  return /^\d{4}-/.test(s) ? s : '';
}

function limpiarCitas(encabezado, filas, alias) {
  alias = alias || {};
  var idx = indiceDeEncabezado(encabezado);
  var faltantes = [];
  Object.keys(SOFDOC_OBLIGATORIAS).forEach(function (k) {
    if (idx[normTexto(SOFDOC_OBLIGATORIAS[k])] === undefined) faltantes.push(SOFDOC_OBLIGATORIAS[k]);
  });
  if (faltantes.length) return { citas: [], faltantes: faltantes, invalidas: 0 };

  function celda(f, nombre) {
    var i = idx[normTexto(nombre)];
    return i === undefined ? '' : f[i];
  }

  var porId = {}, orden = [], invalidas = 0;
  (filas || []).forEach(function (f) {
    var medico = textoLimpio_(celda(f, SOFDOC_OBLIGATORIAS.MEDICO));
    var c = {
      IDCITA: normTexto(celda(f, SOFDOC_OBLIGATORIAS.IDCITA)),
      DNI: normDni(celda(f, SOFDOC_OBLIGATORIAS.DNI)),
      NOMBRE: textoLimpio_(celda(f, SOFDOC_OBLIGATORIAS.NOMBRE)),
      FECHA: fechaIso(celda(f, SOFDOC_OBLIGATORIAS.FECHA)),
      ESTADO: normTexto(celda(f, SOFDOC_OBLIGATORIAS.ESTADO)),
      ESPECIALIDAD: textoLimpio_(celda(f, SOFDOC_OBLIGATORIAS.ESPECIALIDAD)),
      MEDICO: alias[normTexto(medico)] || medico,
      MODALIDAD: textoLimpio_(celda(f, SOFDOC_OPCIONALES.MODALIDAD)),
      TIPO_PACIENTE: textoLimpio_(celda(f, SOFDOC_OPCIONALES.TIPO_PACIENTE)),
      MARCA: textoLimpio_(celda(f, SOFDOC_OPCIONALES.MARCA)),
      PAGO: celda(f, SOFDOC_OPCIONALES.PAGO),
      ESTADO_PAGO: textoLimpio_(celda(f, SOFDOC_OPCIONALES.ESTADO_PAGO)),
      REGISTRADO_POR: textoLimpio_(celda(f, SOFDOC_OPCIONALES.REGISTRADO_POR)),
      FECHA_REGISTRO: textoLimpio_(celda(f, SOFDOC_OBLIGATORIAS.FECHA_REGISTRO))
    };
    if (!c.IDCITA || !c.DNI || !c.FECHA) { invalidas++; return; }
    var previa = porId[c.IDCITA];
    if (!previa) orden.push(c.IDCITA);
    else if (claveRegistro(c.FECHA_REGISTRO) < claveRegistro(previa.FECHA_REGISTRO)) return;
    porId[c.IDCITA] = c;
  });
  var citas = orden.map(function (id) { return porId[id]; }).sort(ordenCitas_);
  return { citas: citas, faltantes: [], invalidas: invalidas };
}

function ordenCitas_(a, b) {
  if (a.FECHA !== b.FECHA) return a.FECHA < b.FECHA ? -1 : 1;
  return a.IDCITA < b.IDCITA ? -1 : a.IDCITA > b.IDCITA ? 1 : 0;
}

function mismaCita_(a, b) {
  return COLUMNAS_CITAS.every(function (k) { return String(a[k] == null ? '' : a[k]) === String(b[k] == null ? '' : b[k]); });
}

/**
 * Incorpora lo pegado a lo que ya había. Lo que no viene en el pegado se
 * conserva: pegar solo el mes nuevo no debe borrar la historia.
 */
function fusionarCitas(previas, nuevas) {
  var porId = {}, orden = [], nNuevas = 0, cambiadas = 0;
  (previas || []).forEach(function (c) {
    if (!porId[c.IDCITA]) orden.push(c.IDCITA);
    porId[c.IDCITA] = c;
  });
  (nuevas || []).forEach(function (c) {
    var p = porId[c.IDCITA];
    if (!p) { porId[c.IDCITA] = c; orden.push(c.IDCITA); nNuevas++; return; }
    if (claveRegistro(c.FECHA_REGISTRO) < claveRegistro(p.FECHA_REGISTRO)) return;
    if (!mismaCita_(p, c)) cambiadas++;
    porId[c.IDCITA] = c;
  });
  var citas = orden.map(function (id) { return porId[id]; }).sort(ordenCitas_);
  return { citas: citas, nuevas: nNuevas, cambiadas: cambiadas };
}
```

- [ ] **Step 4: Correr las pruebas y ver que pasan**

Run: `node --test test/logica-base.test.js test/logica-citas.test.js`
Expected: PASS, 12 pruebas.

- [ ] **Step 5: Commit**

```bash
git add src/Logica.gs test/logica-citas.test.js
git commit -m "Lógica: limpiar el export de SOFDOC y fusionar con CITAS por IDCITA"
```

---

### Task 4: Reglas, catálogos, series y estado de cada serie

**Files:**
- Modify: `src/Logica.gs` (se añade al final)
- Create: `test/fixtures.js`
- Test: `test/logica-estado.test.js`

**Interfaces:**
- Consumes: `normTexto`, `fechaIso`, `diasEntre`, `sumarDias`, `indiceDeEncabezado`, `textoLimpio_`.
- Produces:
  - `reglasDesdeFilas(encabezado, filas) → Reglas`, donde `Reglas = { plazos: { [normTexto(esp) | '*']: { esperado, vence } }, espera, maxSeguimientos, corte }`.
  - `plazoDe(reglas, especialidad) → { esperado, vence }`.
  - `catalogosDesdeFilas(encabezado, filas) → { usuarios: string[], motivos: string[], alias: { [normTexto]: string } }`.
  - `claveSerie(dni, especialidad) → 'DNI|ESPECIALIDAD_NORMALIZADA'`.
  - `porFecha(a, b)`: comparador por `.FECHA`.
  - `armarSeries(citas) → { [clave]: { clave, dni, especialidad, nombre, realizadas: Cita[], agendadas: Cita[] } }`.
  - `estadoDeSerie(serie, seguimientos, reglas, hoy) → { estado, ultima, esperada, vence, atraso, intentos, ultimoSeguimiento, proximaAgendada }`.
  - Valores de `estado`: `'SIN ATENCIÓN'`, `'DESCARTADO'`, `'AGENDADO'`, `'CONTACTADO'`, `'RECUPERADO'`, `'AL DÍA'`, `'POR VENCER'`, `'VENCIDO'`, `'ANTIGUO'`.
  - `Seguimiento = { ID, FECHA_HORA: 'yyyy-MM-dd HH:mm', DNI, ESPECIALIDAD, RESPONSABLE, ACCION: 'HECHO'|'DESCARTADO', MOTIVO, NOTA }`.
  - `test/fixtures.js` exporta `cita(o)`, `seg(o)`, `reglas(L)` y `MEDICO`.

- [ ] **Step 1: Crear `test/fixtures.js`**

```js
// Datos inventados. Nunca use nombres ni DNI reales de pacientes.
const MEDICO = 'Dra. KAREN DIANA MATOS PEÑA';

function cita(o) {
  const dni = o.dni || '40111222';
  const esp = o.esp || 'HEMATOLOGÍA';
  return {
    IDCITA: o.id || ('C-' + dni + '-' + o.fecha + '-' + esp),
    DNI: dni,
    NOMBRE: o.nombre || 'ROSA ELENA QUISPE HUAMAN',
    FECHA: o.fecha,
    ESTADO: o.estado || 'REALIZADO',
    ESPECIALIDAD: esp,
    MEDICO: o.medico || MEDICO,
    MODALIDAD: 'CLÍNICA'
  };
}

function seg(o) {
  return {
    ID: 'S-' + (o.dni || '40111222') + '-' + o.fecha + '-' + (o.accion || 'HECHO'),
    FECHA_HORA: o.fecha + ' 10:00',
    DNI: o.dni || '40111222',
    ESPECIALIDAD: o.esp || 'HEMATOLOGÍA',
    RESPONSABLE: o.quien || 'MAGALY',
    ACCION: o.accion || 'HECHO',
    MOTIVO: o.motivo || '',
    NOTA: ''
  };
}

function reglas(L) {
  return L.reglasDesdeFilas(
    ['ESPECIALIDAD', 'ESPERADO_DIAS', 'VENCE_DIAS', '', 'PARAMETRO', 'VALOR'],
    [['*', 30, 45, '', 'ESPERA_TRAS_SEGUIMIENTO_DIAS', 15],
     ['HEMATOLOGÍA', 30, 45, '', 'MAX_SEGUIMIENTOS', 3],
     ['REUMATOLOGIA', 60, 90, '', 'CORTE_BANDEJA_DIAS', 180]]);
}

module.exports = { cita, seg, reglas, MEDICO };
```

- [ ] **Step 2: Escribir las pruebas**

```js
// test/logica-estado.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar, plano } = require('./cargar');
const { cita, seg, reglas } = require('./fixtures');
const L = cargar();

const serieDe = citas => Object.values(L.armarSeries(citas))[0];
const est = (citas, segs, hoy) => L.estadoDeSerie(serieDe(citas), segs, reglas(L), hoy).estado;

test('reglas: especialidad con o sin tilde es la misma', () => {
  const r = reglas(L);
  assert.equal(L.plazoDe(r, 'Reumatología').vence, 90);
  assert.equal(L.plazoDe(r, 'HEMATOLOGIA').esperado, 30);
  assert.equal(L.plazoDe(r, 'NUTRICIÓN').vence, 45);
});

test('reglas: sin filas se usan los valores por defecto', () => {
  const r = L.reglasDesdeFilas(['ESPECIALIDAD'], []);
  assert.deepEqual(plano(r), { plazos: { '*': { esperado: 30, vence: 45 } }, espera: 15, maxSeguimientos: 3, corte: 180 });
});

test('reglas: VENCE nunca queda antes que ESPERADO', () => {
  const r = L.reglasDesdeFilas(['ESPECIALIDAD', 'ESPERADO_DIAS', 'VENCE_DIAS'], [['NUTRICION', 40, 20]]);
  assert.equal(L.plazoDe(r, 'NUTRICIÓN').vence, 40);
});

test('catalogosDesdeFilas lee usuarios, motivos y alias', () => {
  const c = plano(L.catalogosDesdeFilas(['USUARIOS', 'MOTIVOS_DESCARTE', 'MEDICO_ALIAS', 'MEDICO_NOMBRE'], [
    ['MAGALY', 'OTRO', 'Dr. ELI FABRIZIO CABANILLAS HUALPA', 'Dr. ELÍ FABRIZIO CABANILLAS HUALPA'],
    ['ANA', '', '', '']
  ]));
  assert.deepEqual(c, {
    usuarios: ['MAGALY', 'ANA'],
    motivos: ['OTRO'],
    alias: { 'DR. ELI FABRIZIO CABANILLAS HUALPA': 'Dr. ELÍ FABRIZIO CABANILLAS HUALPA' }
  });
});

test('AL DÍA, POR VENCER, VENCIDO y ANTIGUO según los días', () => {
  const c = [cita({ fecha: '2026-08-01' })];
  assert.equal(est(c, [], '2026-08-20'), 'AL DÍA');
  assert.equal(est(c, [], '2026-09-05'), 'POR VENCER');
  assert.equal(est(c, [], '2026-09-15'), 'VENCIDO');
  assert.equal(est(c, [], '2027-03-14'), 'VENCIDO');
  assert.equal(est(c, [], '2027-03-15'), 'ANTIGUO');
});

test('fechas calculadas de la serie', () => {
  const e = plano(L.estadoDeSerie(serieDe([cita({ fecha: '2026-08-01' })]), [], reglas(L), '2026-10-01'));
  assert.equal(e.ultima, '2026-08-01');
  assert.equal(e.esperada, '2026-08-31');
  assert.equal(e.vence, '2026-09-15');
  assert.equal(e.atraso, 16);
});

test('cita futura agendada → AGENDADO; agendada en el pasado no cuenta', () => {
  assert.equal(est([cita({ fecha: '2026-07-01' }), cita({ fecha: '2026-10-10', estado: 'AGENDADO' })], [], '2026-10-01'), 'AGENDADO');
  assert.equal(est([cita({ fecha: '2026-07-01' }), cita({ fecha: '2026-08-10', estado: 'AGENDADO' })], [], '2026-10-01'), 'VENCIDO');
});

test('seguimiento hecho → CONTACTADO durante la espera; después vuelve a VENCIDO', () => {
  const c = [cita({ fecha: '2026-07-01' })];
  assert.equal(est(c, [seg({ fecha: '2026-09-20' })], '2026-10-01'), 'CONTACTADO');
  assert.equal(est(c, [seg({ fecha: '2026-09-10' })], '2026-10-01'), 'VENCIDO');
  assert.equal(L.estadoDeSerie(serieDe(c), [seg({ fecha: '2026-09-10' })], reglas(L), '2026-10-01').intentos, 1);
});

test('tercer seguimiento sin retorno: CONTACTADO durante su espera, luego DESCARTADO', () => {
  const c = [cita({ fecha: '2026-05-01' })];
  const s = [seg({ fecha: '2026-07-01' }), seg({ fecha: '2026-08-01' }), seg({ fecha: '2026-09-25' })];
  assert.equal(est(c, s, '2026-10-01'), 'CONTACTADO');
  assert.equal(est(c, s, '2026-10-10'), 'DESCARTADO');
});

test('descarte explícito → DESCARTADO; si vuelve después, deja de estarlo', () => {
  const d = seg({ fecha: '2026-09-01', accion: 'DESCARTADO', motivo: 'SE ATIENDE EN OTRO LUGAR' });
  assert.equal(est([cita({ fecha: '2026-07-01' })], [d], '2026-10-01'), 'DESCARTADO');
  assert.equal(est([cita({ fecha: '2026-07-01' }), cita({ fecha: '2026-09-20' })], [d], '2026-10-01'), 'AL DÍA');
});

test('volvió tras un seguimiento → RECUPERADO hasta que vuelve a vencer', () => {
  const c = [cita({ fecha: '2026-07-01' }), cita({ fecha: '2026-09-10' })];
  const s = [seg({ fecha: '2026-08-20' })];
  assert.equal(est(c, s, '2026-10-01'), 'RECUPERADO');
  assert.equal(est(c, s, '2026-10-25'), 'VENCIDO');
});

test('especialidades separadas: nutrición no cuenta como reevaluación de hematología', () => {
  const s = L.armarSeries([cita({ fecha: '2026-07-01' }), cita({ fecha: '2026-09-25', esp: 'NUTRICIÓN' })]);
  assert.equal(Object.keys(s).length, 2);
  assert.equal(L.estadoDeSerie(s['40111222|HEMATOLOGIA'], [], reglas(L), '2026-10-01').estado, 'VENCIDO');
});

test('una serie solo con citas anuladas queda SIN ATENCIÓN', () => {
  assert.equal(est([cita({ fecha: '2026-07-01', estado: 'ANULADO' })], [], '2026-10-01'), 'SIN ATENCIÓN');
});
```

- [ ] **Step 3: Correr las pruebas y ver que fallan**

Run: `node --test test/logica-estado.test.js`
Expected: FAIL con `L.reglasDesdeFilas is not a function`.

- [ ] **Step 4: Añadir al final de `src/Logica.gs`**

```js
/* ==========================================================================
   REGLAS Y CATÁLOGOS (vienen de las hojas REGLAS y CATALOGOS)
   ========================================================================== */

function entero_(v, porDefecto, minimo) {
  var n = parseInt(v, 10);
  if (isNaN(n) || n < (minimo || 0)) return porDefecto;
  return n;
}

/**
 * REGLAS tiene dos tablas lado a lado con un solo encabezado:
 * ESPECIALIDAD | ESPERADO_DIAS | VENCE_DIAS | (vacía) | PARAMETRO | VALOR
 */
function reglasDesdeFilas(encabezado, filas) {
  var idx = indiceDeEncabezado(encabezado);
  var r = { plazos: { '*': { esperado: 30, vence: 45 } }, espera: 15, maxSeguimientos: 3, corte: 180 };
  function celda(f, k) { return idx[k] === undefined ? '' : f[idx[k]]; }
  (filas || []).forEach(function (f) {
    var esp = normTexto(celda(f, 'ESPECIALIDAD'));
    if (esp) r.plazos[esp] = { esperado: entero_(celda(f, 'ESPERADO_DIAS'), 30), vence: entero_(celda(f, 'VENCE_DIAS'), 45) };
    var par = normTexto(celda(f, 'PARAMETRO')).replace(/ /g, '_');
    var val = celda(f, 'VALOR');
    if (par === 'ESPERA_TRAS_SEGUIMIENTO_DIAS') r.espera = entero_(val, 15);
    if (par === 'MAX_SEGUIMIENTOS') r.maxSeguimientos = entero_(val, 3, 1);
    if (par === 'CORTE_BANDEJA_DIAS') r.corte = entero_(val, 180);
  });
  Object.keys(r.plazos).forEach(function (k) {
    if (r.plazos[k].vence < r.plazos[k].esperado) r.plazos[k].vence = r.plazos[k].esperado;
  });
  return r;
}

function plazoDe(reglas, especialidad) {
  return reglas.plazos[normTexto(especialidad)] || reglas.plazos['*'];
}

/** CATALOGOS: una columna por lista. USUARIOS | MOTIVOS_DESCARTE | MEDICO_ALIAS | MEDICO_NOMBRE */
function catalogosDesdeFilas(encabezado, filas) {
  var idx = indiceDeEncabezado(encabezado);
  var out = { usuarios: [], motivos: [], alias: {} };
  function celda(f, k) { return idx[k] === undefined ? '' : textoLimpio_(f[idx[k]]); }
  (filas || []).forEach(function (f) {
    var u = celda(f, 'USUARIOS'), m = celda(f, 'MOTIVOS_DESCARTE');
    var a = celda(f, 'MEDICO_ALIAS'), n = celda(f, 'MEDICO_NOMBRE');
    if (u) out.usuarios.push(u);
    if (m) out.motivos.push(m);
    if (a && n) out.alias[normTexto(a)] = n;
  });
  return out;
}

/* ==========================================================================
   SERIES Y ESTADO

   Una serie es un DNI dentro de una especialidad: ir a nutrición no cuenta
   como reevaluación de hematología.
   ========================================================================== */

function claveSerie(dni, especialidad) {
  return dni + '|' + normTexto(especialidad);
}

function porFecha(a, b) {
  return a.FECHA < b.FECHA ? -1 : a.FECHA > b.FECHA ? 1 : 0;
}

function armarSeries(citas) {
  var s = {};
  (citas || []).forEach(function (c) {
    var k = claveSerie(c.DNI, c.ESPECIALIDAD);
    if (!s[k]) s[k] = { clave: k, dni: c.DNI, especialidad: c.ESPECIALIDAD, nombre: c.NOMBRE, realizadas: [], agendadas: [] };
    var e = normTexto(c.ESTADO);
    if (e === 'REALIZADO') s[k].realizadas.push(c);
    else if (e === 'AGENDADO') s[k].agendadas.push(c);
  });
  Object.keys(s).forEach(function (k) {
    s[k].realizadas.sort(porFecha);
    s[k].agendadas.sort(porFecha);
    var r = s[k].realizadas;
    if (r.length && r[r.length - 1].NOMBRE) s[k].nombre = r[r.length - 1].NOMBRE;
  });
  return s;
}

/**
 * Estado de una serie. Gana la primera regla que se cumple (diseño §5):
 * DESCARTADO, AGENDADO, CONTACTADO, RECUPERADO, AL DÍA, POR VENCER, VENCIDO, ANTIGUO.
 */
function estadoDeSerie(serie, seguimientos, reglas, hoy) {
  var plazo = plazoDe(reglas, serie.especialidad);
  var r = serie.realizadas;
  var ultima = r.length ? r[r.length - 1].FECHA : '';
  var penultima = r.length > 1 ? r[r.length - 2].FECHA : '';
  var out = { estado: '', ultima: ultima, esperada: '', vence: '', atraso: 0, intentos: 0, ultimoSeguimiento: '', proximaAgendada: '' };

  var futura = serie.agendadas.filter(function (c) { return c.FECHA >= hoy; })[0];
  if (futura) out.proximaAgendada = futura.FECHA;
  if (!ultima) { out.estado = 'SIN ATENCIÓN'; return out; }

  out.esperada = sumarDias(ultima, plazo.esperado);
  out.vence = sumarDias(ultima, plazo.vence);
  out.atraso = Math.max(0, diasEntre(out.vence, hoy));

  var lista = (seguimientos || []).slice().sort(function (a, b) {
    return a.FECHA_HORA < b.FECHA_HORA ? -1 : a.FECHA_HORA > b.FECHA_HORA ? 1 : 0;
  });
  if (lista.length) out.ultimoSeguimiento = fechaIso(lista[lista.length - 1].FECHA_HORA);
  var posteriores = lista.filter(function (s) { return fechaIso(s.FECHA_HORA) > ultima; });
  var hechos = posteriores.filter(function (s) { return normTexto(s.ACCION) === 'HECHO'; });
  out.intentos = hechos.length;
  var ultimoPost = posteriores[posteriores.length - 1];
  var ultimoHecho = hechos[hechos.length - 1];
  var diasDesdeHecho = ultimoHecho ? diasEntre(fechaIso(ultimoHecho.FECHA_HORA), hoy) : null;

  if (ultimoPost && normTexto(ultimoPost.ACCION) === 'DESCARTADO') { out.estado = 'DESCARTADO'; return out; }
  if (hechos.length >= reglas.maxSeguimientos && diasDesdeHecho >= reglas.espera) { out.estado = 'DESCARTADO'; return out; }
  if (futura) { out.estado = 'AGENDADO'; return out; }
  if (ultimoHecho && diasDesdeHecho < reglas.espera) { out.estado = 'CONTACTADO'; return out; }

  var hechoAntesDeVolver = lista.some(function (s) {
    var f = fechaIso(s.FECHA_HORA);
    return normTexto(s.ACCION) === 'HECHO' && f <= ultima && (!penultima || f > penultima);
  });
  if (hechoAntesDeVolver && hoy < out.vence) { out.estado = 'RECUPERADO'; return out; }
  if (hoy < out.esperada) { out.estado = 'AL DÍA'; return out; }
  if (hoy < out.vence) { out.estado = 'POR VENCER'; return out; }
  out.estado = out.atraso <= reglas.corte ? 'VENCIDO' : 'ANTIGUO';
  return out;
}
```

- [ ] **Step 5: Correr las pruebas y ver que pasan**

Run: `node --test test/logica-*.test.js`
Expected: PASS. Son 13 pruebas nuevas, más las anteriores.

- [ ] **Step 6: Commit**

```bash
git add src/Logica.gs test/fixtures.js test/logica-estado.test.js
git commit -m "Lógica: reglas por especialidad, catálogos y estado de cada serie"
```

---

### Task 5: Emparejamiento por nombre e importación de hierro y procedimientos

**Files:**
- Modify: `src/Logica.gs` (se añade al final)
- Test: `test/logica-emparejar.test.js`

**Interfaces:**
- Consumes: `normTexto`, `normDni`, `normTelefono`, `fechaIso`, `indiceDeEncabezado`, `textoLimpio_`, `PALABRAS_VACIAS`.
- Produces:
  - `tokensNombre(nombre) → string[]`.
  - `construirIndiceNombres(citas) → [{ dni, nombre, tokens: { [token]: 1 } }]`.
  - `emparejar(nombre, indice) → { estado: 'AUTOMÁTICO'|'POR CONFIRMAR'|'SIN CANDIDATO', dni, candidatos: [{ dni, nombre }] }`, con 5 candidatos como máximo.
  - `normalizarEstadoIndicacion(v) → 'COTIZÓ'|'ACEPTÓ'|texto normalizado`.
  - `COLUMNAS_INDICACIONES`: `['ID','FECHA','TIPO','DETALLE','CANTIDAD','MEDICO_SOLICITANTE','ASESORA','NOMBRE','TELEFONO','ESTADO','OBSERVACIONES','DNI','EMPAREJAMIENTO','ORIGEN']`.
  - `indicacionesDesdeHierro(pestana, encabezado, filas, desde) → Indicacion[]`, con ID `IND-0001`… a partir de `desde` y ORIGEN `PESTAÑA!fila`.
  - `aplicarEmparejamientos(indicaciones, indice) → número de cambios`. Modifica `DNI` y `EMPAREJAMIENTO` de cada indicación.

- [ ] **Step 1: Escribir las pruebas**

```js
// test/logica-emparejar.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar, plano } = require('./cargar');
const L = cargar();

const CITAS = [
  { DNI: '40111222', NOMBRE: 'ROSA ELENA QUISPE HUAMAN' },
  { DNI: '40222333', NOMBRE: 'JORGE LUIS MENDOZA PAREDES' },
  { DNI: '40999888', NOMBRE: 'JORGE MENDOZA SALAS' },
  { DNI: '6174169', NOMBRE: 'MARIA DEL PILAR RIOS DE LA CRUZ' }
];
const I = () => L.construirIndiceNombres(CITAS);

test('un único candidato → AUTOMÁTICO aunque falten palabras', () => {
  const r = L.emparejar('Rosa Quispe', I());
  assert.equal(r.estado, 'AUTOMÁTICO');
  assert.equal(r.dni, '40111222');
});

test('las tildes y las partículas no estorban', () => {
  assert.equal(L.emparejar('MARÍA PILAR RÍOS CRUZ', I()).dni, '6174169');
});

test('dos candidatos → POR CONFIRMAR, sin DNI', () => {
  const r = plano(L.emparejar('JORGE MENDOZA', I()));
  assert.equal(r.estado, 'POR CONFIRMAR');
  assert.equal(r.dni, '');
  assert.deepEqual(r.candidatos.map(c => c.dni).sort(), ['40222333', '40999888']);
});

test('una sola palabra nunca es AUTOMÁTICO', () => {
  const r = L.emparejar('ROSA', I());
  assert.equal(r.estado, 'POR CONFIRMAR');
  assert.equal(r.dni, '');
});

test('sin coincidencia → SIN CANDIDATO', () => {
  const r = L.emparejar('PEDRO CASTILLO', I());
  assert.equal(r.estado, 'SIN CANDIDATO');
  assert.equal(r.candidatos.length, 0);
});

test('indicacionesDesdeHierro lee por encabezado y salta filas vacías', () => {
  const enc = ['FECHA', '', 'ASESOR ', 'NOMBRE ', 'TELÉFONO ', 'CANTIDAD', '¿ACEPTARON? ¿COTIZACIÓN?', 'OBSERVACIONES '];
  const filas = [
    ['2026-04-18 00:00', 'abril', 'LORENA', 'ROSA ELENA QUISPE HUAMAN', '987 654 321', 2, 'COTIZARON', 'VA A COORDINAR'],
    ['', '', '', '', '', '', '', ''],
    ['2026-04-20 00:00', 'abril', 'MAGALY', 'JORGE MENDOZA', 912345678, 1, 'ACEPTARON', '']
  ];
  const r = plano(L.indicacionesDesdeHierro('HIERRO', enc, filas, 1));
  assert.equal(r.length, 2);
  assert.deepEqual(r[0], {
    ID: 'IND-0001', FECHA: '2026-04-18', TIPO: 'HIERRO', DETALLE: 'HIERRO', CANTIDAD: 2, MEDICO_SOLICITANTE: '',
    ASESORA: 'LORENA', NOMBRE: 'ROSA ELENA QUISPE HUAMAN', TELEFONO: '987654321', ESTADO: 'COTIZÓ',
    OBSERVACIONES: 'VA A COORDINAR', DNI: '', EMPAREJAMIENTO: '', ORIGEN: 'HIERRO!2'
  });
  assert.equal(r[1].ID, 'IND-0002');
  assert.equal(r[1].ORIGEN, 'HIERRO!4');
  assert.equal(r[1].ESTADO, 'ACEPTÓ');
});

test('PROCEDIMIENTOS usa TIPO DE EXÁMENES como detalle y sigue la numeración', () => {
  const enc = ['FECHA', '', 'ASESOR ', 'NOMBRE ', 'TELÉFONO ', 'TIPO DE EXÁMENES', '¿ACEPTARON? ¿COTIZACIÓN?', 'OBSERVACIONES '];
  const r = plano(L.indicacionesDesdeHierro('PROCEDIMIENTOS', enc,
    [['2026-05-02 00:00', 'mayo', 'LORENA', 'ROSA QUISPE', '947 176 392', 'AMO + BIOPSIA ', 'COTIZARON', '']], 8));
  assert.equal(r[0].ID, 'IND-0008');
  assert.equal(r[0].TIPO, 'PROCEDIMIENTO');
  assert.equal(r[0].DETALLE, 'AMO + BIOPSIA');
  assert.equal(r[0].CANTIDAD, '');
});

test('aplicarEmparejamientos respeta lo confirmado y el DNI escrito a mano', () => {
  const inds = [
    { NOMBRE: 'ROSA QUISPE', DNI: '', EMPAREJAMIENTO: '' },
    { NOMBRE: 'JORGE MENDOZA', DNI: '40999888', EMPAREJAMIENTO: 'CONFIRMADO' },
    { NOMBRE: 'CUALQUIERA', DNI: '06174169', EMPAREJAMIENTO: '' },
    { NOMBRE: 'JORGE MENDOZA', DNI: '', EMPAREJAMIENTO: '' }
  ];
  const n = L.aplicarEmparejamientos(inds, I());
  assert.equal(n, 3);
  assert.equal(inds[0].DNI, '40111222');
  assert.equal(inds[0].EMPAREJAMIENTO, 'AUTOMÁTICO');
  assert.equal(inds[1].DNI, '40999888');
  assert.equal(inds[2].DNI, '6174169');
  assert.equal(inds[2].EMPAREJAMIENTO, 'CONFIRMADO');
  assert.equal(inds[3].EMPAREJAMIENTO, 'POR CONFIRMAR');
  assert.equal(L.aplicarEmparejamientos(inds, I()), 0);
});
```

- [ ] **Step 2: Correr las pruebas y ver que fallan**

Run: `node --test test/logica-emparejar.test.js`
Expected: FAIL con `L.construirIndiceNombres is not a function`.

- [ ] **Step 3: Añadir al final de `src/Logica.gs`**

```js
/* ==========================================================================
   EMPAREJAMIENTO POR NOMBRE

   SOFDOC no trae teléfono y la base de hierro no trae DNI. Se unen por el
   nombre: una indicación es candidata de un paciente si TODAS sus palabras
   están en el nombre del paciente. Solo un candidato único, con al menos dos
   palabras, se empareja solo; lo demás lo confirma una persona.
   ========================================================================== */

function tokensNombre(nombre) {
  return normTexto(nombre).split(/[^A-Z]+/).filter(function (t) { return t && !PALABRAS_VACIAS[t]; });
}

function construirIndiceNombres(citas) {
  var porDni = {}, orden = [];
  (citas || []).forEach(function (c) {
    if (!c.DNI) return;
    if (!porDni[c.DNI]) { porDni[c.DNI] = { dni: c.DNI, nombre: c.NOMBRE, tokens: {} }; orden.push(c.DNI); }
    if (c.NOMBRE) porDni[c.DNI].nombre = c.NOMBRE;
    tokensNombre(c.NOMBRE).forEach(function (t) { porDni[c.DNI].tokens[t] = 1; });
  });
  return orden.map(function (d) { return porDni[d]; });
}

function emparejar(nombre, indice) {
  var t = tokensNombre(nombre);
  var cand = t.length ? indice.filter(function (p) { return t.every(function (x) { return p.tokens[x]; }); }) : [];
  var lista = cand.slice(0, 5).map(function (p) { return { dni: p.dni, nombre: p.nombre }; });
  if (cand.length === 1 && t.length >= 2) return { estado: 'AUTOMÁTICO', dni: cand[0].dni, candidatos: lista };
  return { estado: cand.length ? 'POR CONFIRMAR' : 'SIN CANDIDATO', dni: '', candidatos: lista };
}

function normalizarEstadoIndicacion(v) {
  var n = normTexto(v);
  if (n.indexOf('ACEPT') === 0) return 'ACEPTÓ';
  if (n.indexOf('COTIZ') === 0) return 'COTIZÓ';
  return n;
}

var COLUMNAS_INDICACIONES = ['ID', 'FECHA', 'TIPO', 'DETALLE', 'CANTIDAD', 'MEDICO_SOLICITANTE', 'ASESORA', 'NOMBRE',
  'TELEFONO', 'ESTADO', 'OBSERVACIONES', 'DNI', 'EMPAREJAMIENTO', 'ORIGEN'];

/**
 * Filas de la pestaña HIERRO o PROCEDIMIENTOS -> indicaciones.
 * `filas` son las filas debajo del encabezado, vacías incluidas, para que
 * ORIGEN apunte a la fila real de la hoja (encabezado en la fila 1).
 */
function indicacionesDesdeHierro(pestana, encabezado, filas, desde) {
  var idx = indiceDeEncabezado(encabezado);
  var tipo = normTexto(pestana) === 'HIERRO' ? 'HIERRO' : 'PROCEDIMIENTO';
  function celda(f, k) { return idx[k] === undefined ? '' : f[idx[k]]; }
  var out = [], n = desde || 1;
  (filas || []).forEach(function (f, i) {
    var nombre = textoLimpio_(celda(f, 'NOMBRE'));
    if (!nombre) return;
    out.push({
      ID: 'IND-' + ('000' + n++).slice(-4),
      FECHA: fechaIso(celda(f, 'FECHA')),
      TIPO: tipo,
      DETALLE: tipo === 'HIERRO' ? 'HIERRO' : textoLimpio_(celda(f, 'TIPO DE EXAMENES')),
      CANTIDAD: tipo === 'HIERRO' ? celda(f, 'CANTIDAD') : '',
      MEDICO_SOLICITANTE: '',
      ASESORA: normTexto(celda(f, 'ASESOR')),
      NOMBRE: nombre,
      TELEFONO: normTelefono(celda(f, 'TELEFONO')),
      ESTADO: normalizarEstadoIndicacion(celda(f, '¿ACEPTARON? ¿COTIZACION?')),
      OBSERVACIONES: textoLimpio_(celda(f, 'OBSERVACIONES')),
      DNI: '',
      EMPAREJAMIENTO: '',
      ORIGEN: pestana + '!' + (i + 2)
    });
  });
  return out;
}

/**
 * Empareja lo que falta. Lo CONFIRMADO o AUTOMÁTICO con DNI no se toca; un
 * DNI escrito a mano sin estado se respeta y queda CONFIRMADO.
 */
function aplicarEmparejamientos(indicaciones, indice) {
  var cambios = 0;
  (indicaciones || []).forEach(function (ind) {
    var e = normTexto(ind.EMPAREJAMIENTO);
    var dni = normDni(ind.DNI);
    if ((e === 'CONFIRMADO' || e === 'AUTOMATICO') && dni) return;
    if (!e && dni) { ind.DNI = dni; ind.EMPAREJAMIENTO = 'CONFIRMADO'; cambios++; return; }
    var r = emparejar(ind.NOMBRE, indice);
    if (dni !== r.dni || ind.EMPAREJAMIENTO !== r.estado) cambios++;
    ind.DNI = r.dni;
    ind.EMPAREJAMIENTO = r.estado;
  });
  return cambios;
}
```

- [ ] **Step 4: Correr las pruebas y ver que pasan**

Run: `node --test test/logica-*.test.js`
Expected: PASS, todas.

- [ ] **Step 5: Commit**

```bash
git add src/Logica.gs test/logica-emparejar.test.js
git commit -m "Lógica: emparejamiento por nombre e importación de hierro y procedimientos"
```

---

### Task 6: Pacientes, bandeja, validación y envío seguro

**Files:**
- Modify: `src/Logica.gs` (se añade al final)
- Test: `test/logica-pacientes.test.js`

**Interfaces:**
- Consumes: `armarSeries`, `estadoDeSerie`, `claveSerie`, `normTelefono`, `normTexto`, `normDni`, `fechaIso`.
- Produces:
  - `COLUMNAS_PACIENTES`: `['DNI','ESPECIALIDAD','NOMBRE','TELEFONOS','MEDICO_ULTIMO','PRIMERA_CITA','ULTIMA_CITA','N_REALIZADAS','PROXIMA_ESPERADA','VENCE','DIAS_ATRASO','PROXIMA_AGENDADA','ESTADO','N_SEGUIMIENTOS','ULTIMO_SEGUIMIENTO','PENDIENTE']`.
  - `armarPacientes(citas, indicaciones, seguimientos, reglas, hoy) → Paciente[]`, con las claves de `COLUMNAS_PACIENTES`, ordenados por NOMBRE.
  - `ordenarBandeja(pacientes) → Paciente[]`: solo `VENCIDO`, ordenados.
  - `validarAccion(p, catalogos, accion) → '' | mensaje`.
  - `limpiarParaEnvio(v) → v` sin `NaN`, `Infinity`, `null` ni `undefined`.

- [ ] **Step 1: Escribir las pruebas**

```js
// test/logica-pacientes.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar, plano } = require('./cargar');
const { cita, seg, reglas } = require('./fixtures');
const L = cargar();

const ind = o => Object.assign({ ID: 'IND', FECHA: '2026-07-01', TIPO: 'HIERRO', DETALLE: 'HIERRO', CANTIDAD: '', MEDICO_SOLICITANTE: '',
  ASESORA: 'LORENA', NOMBRE: 'X', TELEFONO: '', ESTADO: 'COTIZÓ', OBSERVACIONES: '', DNI: '40111222', EMPAREJAMIENTO: 'AUTOMÁTICO' }, o);

test('armarPacientes: teléfonos y pendientes vienen de las indicaciones emparejadas', () => {
  const citas = [cita({ fecha: '2026-07-01' }), cita({ dni: '40222333', nombre: 'JORGE LUIS MENDOZA PAREDES', fecha: '2026-09-20' })];
  const inds = [
    ind({ ID: 'IND-1', CANTIDAD: 2, TELEFONO: '987654321' }),
    ind({ ID: 'IND-2', TIPO: 'PROCEDIMIENTO', DETALLE: 'AMO + BIOPSIA', TELEFONO: '912345678' }),
    ind({ ID: 'IND-3', TELEFONO: '987654321' }),
    ind({ ID: 'IND-4', DNI: '', TELEFONO: '999999999' })
  ];
  const p = plano(L.armarPacientes(citas, inds, [], reglas(L), '2026-10-01'));
  const rosa = p.find(x => x.DNI === '40111222');
  assert.deepEqual(Object.keys(rosa), plano(L.COLUMNAS_PACIENTES));
  assert.equal(rosa.TELEFONOS, '987654321 / 912345678');
  assert.equal(rosa.PENDIENTE, 'Hierro ×2 cotizado; AMO + BIOPSIA cotizado; Hierro cotizado');
  assert.equal(rosa.ESTADO, 'VENCIDO');
  assert.equal(rosa.DIAS_ATRASO, 47);
  assert.equal(rosa.N_REALIZADAS, 1);
  assert.equal(p.find(x => x.DNI === '40222333').ESTADO, 'AL DÍA');
});

test('hierro aceptado después de cotizado ya no es pendiente', () => {
  const inds = [ind({ FECHA: '2026-07-01' }), ind({ FECHA: '2026-07-05', ESTADO: 'ACEPTÓ' })];
  const p = L.armarPacientes([cita({ fecha: '2026-07-01' })], inds, [], reglas(L), '2026-10-01');
  assert.equal(p[0].PENDIENTE, '');
});

test('armarPacientes cuenta los seguimientos posteriores a la última cita', () => {
  const p = L.armarPacientes([cita({ fecha: '2026-07-01' })], [], [seg({ fecha: '2026-09-10' })], reglas(L), '2026-10-01');
  assert.equal(p[0].N_SEGUIMIENTOS, 1);
  assert.equal(p[0].ULTIMO_SEGUIMIENTO, '2026-09-10');
});

test('ordenarBandeja: primer intento antes; con pendiente antes; menos atraso antes', () => {
  const ps = [
    { DNI: '1', ESTADO: 'VENCIDO', N_SEGUIMIENTOS: 1, PENDIENTE: 'x', DIAS_ATRASO: 1 },
    { DNI: '2', ESTADO: 'VENCIDO', N_SEGUIMIENTOS: 0, PENDIENTE: '', DIAS_ATRASO: 3 },
    { DNI: '3', ESTADO: 'VENCIDO', N_SEGUIMIENTOS: 0, PENDIENTE: 'x', DIAS_ATRASO: 90 },
    { DNI: '4', ESTADO: 'VENCIDO', N_SEGUIMIENTOS: 0, PENDIENTE: '', DIAS_ATRASO: 2 },
    { DNI: '5', ESTADO: 'AL DÍA', N_SEGUIMIENTOS: 0, PENDIENTE: '', DIAS_ATRASO: 0 }
  ];
  assert.deepEqual(plano(L.ordenarBandeja(ps).map(p => p.DNI)), ['3', '4', '2', '1']);
});

test('validarAccion exige usuario del catálogo y, al descartar, un motivo del catálogo', () => {
  const cat = { usuarios: ['MAGALY', 'DR. ELI CABANILLAS'], motivos: ['SE ATIENDE EN OTRO LUGAR'], alias: {} };
  assert.match(L.validarAccion({ usuario: '', dni: '1', especialidad: 'X' }, cat, 'HECHO'), /Elija quién/);
  assert.match(L.validarAccion({ usuario: 'PEDRO', dni: '1', especialidad: 'X' }, cat, 'HECHO'), /no está en CATALOGOS/);
  assert.match(L.validarAccion({ usuario: 'MAGALY', dni: '', especialidad: 'X' }, cat, 'HECHO'), /DNI/);
  assert.equal(L.validarAccion({ usuario: 'magaly', dni: '1', especialidad: 'X' }, cat, 'HECHO'), '');
  assert.match(L.validarAccion({ usuario: 'MAGALY', dni: '1', especialidad: 'X', motivo: '' }, cat, 'DESCARTADO'), /motivo/);
  assert.equal(L.validarAccion({ usuario: 'MAGALY', dni: '1', especialidad: 'X', motivo: 'Se atiende en otro lugar' }, cat, 'DESCARTADO'), '');
  assert.match(L.validarAccion(null, cat, 'HECHO'), /Elija quién/);
});

test('limpiarParaEnvio convierte NaN, Infinity, null y undefined en vacío', () => {
  assert.deepEqual(plano(L.limpiarParaEnvio({ a: NaN, b: [1, Infinity, null], c: { d: undefined, e: 'x', f: 0 } })),
    { a: '', b: [1, '', ''], c: { d: '', e: 'x', f: 0 } });
});
```

- [ ] **Step 2: Correr las pruebas y ver que fallan**

Run: `node --test test/logica-pacientes.test.js`
Expected: FAIL con `L.armarPacientes is not a function`.

- [ ] **Step 3: Añadir al final de `src/Logica.gs`**

```js
/* ==========================================================================
   PACIENTES Y BANDEJA
   ========================================================================== */

var COLUMNAS_PACIENTES = ['DNI', 'ESPECIALIDAD', 'NOMBRE', 'TELEFONOS', 'MEDICO_ULTIMO', 'PRIMERA_CITA', 'ULTIMA_CITA',
  'N_REALIZADAS', 'PROXIMA_ESPERADA', 'VENCE', 'DIAS_ATRASO', 'PROXIMA_AGENDADA', 'ESTADO', 'N_SEGUIMIENTOS',
  'ULTIMO_SEGUIMIENTO', 'PENDIENTE'];

function telefonosPorDni(indicaciones) {
  var out = {};
  (indicaciones || []).forEach(function (i) {
    var t = normTelefono(i.TELEFONO);
    if (!i.DNI || !t) return;
    out[i.DNI] = out[i.DNI] || [];
    if (out[i.DNI].indexOf(t) < 0) out[i.DNI].push(t);
  });
  return out;
}

/** Cotizado y no aceptado después (mismo DNI y mismo tipo) = pendiente. */
function pendientesPorDni(indicaciones) {
  var aceptado = {}, out = {};
  (indicaciones || []).forEach(function (i) {
    if (!i.DNI || i.ESTADO !== 'ACEPTÓ') return;
    var k = i.DNI + '|' + i.TIPO;
    if (!aceptado[k] || i.FECHA > aceptado[k]) aceptado[k] = i.FECHA;
  });
  (indicaciones || []).forEach(function (i) {
    if (!i.DNI || i.ESTADO !== 'COTIZÓ') return;
    var a = aceptado[i.DNI + '|' + i.TIPO];
    if (a && a >= i.FECHA) return;
    var cantidad = Number(i.CANTIDAD);
    var texto = (i.TIPO === 'HIERRO' ? 'Hierro' : (i.DETALLE || 'Procedimiento')) + (cantidad > 1 ? ' ×' + cantidad : '') + ' cotizado';
    (out[i.DNI] = out[i.DNI] || []).push(texto);
  });
  return out;
}

function segsPorSerie(seguimientos) {
  var out = {};
  (seguimientos || []).forEach(function (s) {
    var k = claveSerie(s.DNI, s.ESPECIALIDAD);
    (out[k] = out[k] || []).push(s);
  });
  return out;
}

function armarPacientes(citas, indicaciones, seguimientos, reglas, hoy) {
  var series = armarSeries(citas);
  var tel = telefonosPorDni(indicaciones), pend = pendientesPorDni(indicaciones), segs = segsPorSerie(seguimientos);
  var out = [];
  Object.keys(series).forEach(function (k) {
    var s = series[k];
    if (!s.realizadas.length) return;
    var e = estadoDeSerie(s, segs[k], reglas, hoy);
    out.push({
      DNI: s.dni,
      ESPECIALIDAD: s.especialidad,
      NOMBRE: s.nombre,
      TELEFONOS: (tel[s.dni] || []).join(' / '),
      MEDICO_ULTIMO: s.realizadas[s.realizadas.length - 1].MEDICO,
      PRIMERA_CITA: s.realizadas[0].FECHA,
      ULTIMA_CITA: e.ultima,
      N_REALIZADAS: s.realizadas.length,
      PROXIMA_ESPERADA: e.esperada,
      VENCE: e.vence,
      DIAS_ATRASO: e.atraso,
      PROXIMA_AGENDADA: e.proximaAgendada,
      ESTADO: e.estado,
      N_SEGUIMIENTOS: e.intentos,
      ULTIMO_SEGUIMIENTO: e.ultimoSeguimiento,
      PENDIENTE: (pend[s.dni] || []).join('; ')
    });
  });
  return out.sort(function (a, b) { return a.NOMBRE < b.NOMBRE ? -1 : a.NOMBRE > b.NOMBRE ? 1 : 0; });
}

/** Diseño §7.1: primer intento antes; con indicación pendiente antes; menos atraso antes. */
function ordenarBandeja(pacientes) {
  return (pacientes || []).filter(function (p) { return p.ESTADO === 'VENCIDO'; }).sort(function (a, b) {
    return (a.N_SEGUIMIENTOS - b.N_SEGUIMIENTOS) ||
      ((a.PENDIENTE ? 0 : 1) - (b.PENDIENTE ? 0 : 1)) ||
      (a.DIAS_ATRASO - b.DIAS_ATRASO) ||
      (a.DNI < b.DNI ? -1 : a.DNI > b.DNI ? 1 : 0);
  });
}

function validarAccion(p, catalogos, accion) {
  if (!p || !normTexto(p.usuario)) return 'Elija quién es usted en el selector de arriba.';
  if (catalogos.usuarios.map(normTexto).indexOf(normTexto(p.usuario)) < 0) {
    return 'El usuario «' + p.usuario + '» no está en CATALOGOS.';
  }
  if (!normDni(p.dni)) return 'Falta el DNI del paciente.';
  if (!normTexto(p.especialidad)) return 'Falta la especialidad.';
  if (accion === 'DESCARTADO' && catalogos.motivos.map(normTexto).indexOf(normTexto(p.motivo)) < 0) {
    return 'Elija un motivo de descarte.';
  }
  return '';
}

/** Un NaN en la respuesta hace que google.script.run devuelva null entero. */
function limpiarParaEnvio(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return isFinite(v) ? v : '';
  if (Array.isArray(v)) return v.map(limpiarParaEnvio);
  if (Object.prototype.toString.call(v) === '[object Date]') return isNaN(v.getTime()) ? '' : v.toISOString();
  if (typeof v === 'object') {
    var o = {};
    Object.keys(v).forEach(function (k) { o[k] = limpiarParaEnvio(v[k]); });
    return o;
  }
  return v;
}
```

- [ ] **Step 4: Correr las pruebas y ver que pasan**

Run: `node --test test/logica-*.test.js`
Expected: PASS, todas.

- [ ] **Step 5: Commit**

```bash
git add src/Logica.gs test/logica-pacientes.test.js
git commit -m "Lógica: pacientes, orden de la bandeja, validación y envío sin NaN"
```

---

### Task 7: Indicadores de conversión

**Files:**
- Modify: `src/Logica.gs` (se añade al final)
- Test: `test/logica-kpi.test.js`

**Interfaces:**
- Consumes: `armarSeries`, `plazoDe`, `sumarDias`, `mesDe`, `diasEntre`, `fechaIso`, `normTexto`, `claveSerie`, `porFecha`.
- Produces:
  - `kpiCohortes(citas, reglas, hoy) → [{ COHORTE: 'yyyy-MM', ESPECIALIDAD, MEDICO, ETAPA: 1|2|3, ELEGIBLES, VOLVIERON }]`.
  - `kpiIndicaciones(indicaciones, citas) → [{ MES, TIPO, DETALLE, MEDICO, INDICADAS, ACEPTADAS }]`.
  - `kpiRecuperacion(seguimientos, citas) → [{ MES, RESPONSABLE, ESPECIALIDAD, MEDICO, VOLVIO: 0|1, DIAS: number|'' }]`, una fila por seguimiento `HECHO`.
  - `kpiMotivos(seguimientos) → [{ MOTIVO, N }]`.
  - `calcularKpi(citas, indicaciones, seguimientos, reglas, hoy) → { cohortes, indicaciones, recuperacion, motivos, sinCandidato: [{ ID, FECHA, TIPO, NOMBRE, TELEFONO }] }`.
  - `filasHojaKpi(kpi) → any[][]`: filas de 7 columnas para la hoja `KPI`.

- [ ] **Step 1: Escribir las pruebas**

```js
// test/logica-kpi.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar, plano } = require('./cargar');
const { cita, seg, reglas, MEDICO } = require('./fixtures');
const L = cargar();

test('cohortes: solo cuentan los pacientes a quienes ya les tocaba volver', () => {
  const citas = [
    cita({ dni: '1', fecha: '2026-07-01' }), cita({ dni: '1', fecha: '2026-07-25' }),
    cita({ dni: '2', fecha: '2026-07-10' }),
    cita({ dni: '4', fecha: '2026-09-25' })
  ];
  const k = plano(L.kpiCohortes(citas, reglas(L), '2026-10-01'));
  assert.deepEqual(k, [
    { COHORTE: '2026-07', ESPECIALIDAD: 'HEMATOLOGÍA', MEDICO, ETAPA: 1, ELEGIBLES: 2, VOLVIERON: 1 },
    { COHORTE: '2026-07', ESPECIALIDAD: 'HEMATOLOGÍA', MEDICO, ETAPA: 2, ELEGIBLES: 1, VOLVIERON: 0 }
  ]);
});

test('indicaciones: sin médico solicitante se usa el de la última cita anterior', () => {
  const citas = [cita({ dni: '1', fecha: '2026-06-01', medico: 'Dr. A' }), cita({ dni: '1', fecha: '2026-08-01', medico: 'Dr. B' })];
  const base = { TIPO: 'HIERRO', DETALLE: 'HIERRO', MEDICO_SOLICITANTE: '' };
  const inds = [
    Object.assign({ FECHA: '2026-07-01', ESTADO: 'COTIZÓ', DNI: '1' }, base),
    Object.assign({ FECHA: '2026-07-15', ESTADO: 'ACEPTÓ', DNI: '1' }, base),
    Object.assign({ FECHA: '2026-07-20', ESTADO: 'COTIZÓ', DNI: '' }, base)
  ];
  assert.deepEqual(plano(L.kpiIndicaciones(inds, citas)), [
    { MES: '2026-07', TIPO: 'HIERRO', DETALLE: 'HIERRO', MEDICO: 'Dr. A', INDICADAS: 2, ACEPTADAS: 1 },
    { MES: '2026-07', TIPO: 'HIERRO', DETALLE: 'HIERRO', MEDICO: 'SIN MÉDICO', INDICADAS: 1, ACEPTADAS: 0 }
  ]);
});

test('recuperación: volvió si hay cita realizada o agendada después del seguimiento', () => {
  const citas = [cita({ dni: '1', fecha: '2026-07-01' }), cita({ dni: '1', fecha: '2026-09-12' }), cita({ dni: '2', fecha: '2026-07-01' })];
  const segs = [seg({ dni: '1', fecha: '2026-09-01' }), seg({ dni: '2', fecha: '2026-09-01' }),
    seg({ dni: '2', fecha: '2026-09-20', accion: 'DESCARTADO', motivo: 'OTRO' })];
  assert.deepEqual(plano(L.kpiRecuperacion(segs, citas)), [
    { MES: '2026-09', RESPONSABLE: 'MAGALY', ESPECIALIDAD: 'HEMATOLOGÍA', MEDICO, VOLVIO: 1, DIAS: 11 },
    { MES: '2026-09', RESPONSABLE: 'MAGALY', ESPECIALIDAD: 'HEMATOLOGÍA', MEDICO, VOLVIO: 0, DIAS: '' }
  ]);
});

test('motivos de descarte, de mayor a menor', () => {
  const segs = [seg({ fecha: '2026-09-01', accion: 'DESCARTADO', motivo: 'A' }), seg({ fecha: '2026-09-02', accion: 'DESCARTADO', motivo: 'B' }),
    seg({ dni: '9', fecha: '2026-09-03', accion: 'DESCARTADO', motivo: 'A' }), seg({ fecha: '2026-09-04' })];
  assert.deepEqual(plano(L.kpiMotivos(segs)), [{ MOTIVO: 'A', N: 2 }, { MOTIVO: 'B', N: 1 }]);
});

test('calcularKpi lista las indicaciones sin candidato', () => {
  const inds = [{ ID: 'IND-1', FECHA: '2026-05-04', TIPO: 'HIERRO', DETALLE: 'HIERRO', NOMBRE: 'PAOLA RIVERA', TELEFONO: '956789012',
    EMPAREJAMIENTO: 'SIN CANDIDATO', DNI: '', ESTADO: 'COTIZÓ', MEDICO_SOLICITANTE: '' }];
  const k = plano(L.calcularKpi([], inds, [], reglas(L), '2026-10-01'));
  assert.deepEqual(k.sinCandidato, [{ ID: 'IND-1', FECHA: '2026-05-04', TIPO: 'HIERRO', NOMBRE: 'PAOLA RIVERA', TELEFONO: '956789012' }]);
});

test('filasHojaKpi: todas las filas tienen 7 columnas y la tasa es una fracción', () => {
  const kpi = { cohortes: [{ COHORTE: '2026-07', ESPECIALIDAD: 'H', MEDICO: 'M', ETAPA: 1, ELEGIBLES: 4, VOLVIERON: 2 }],
    indicaciones: [{ MES: '2026-07', TIPO: 'HIERRO', DETALLE: 'HIERRO', MEDICO: 'M', INDICADAS: 0, ACEPTADAS: 0 }],
    recuperacion: [], motivos: [], sinCandidato: [] };
  const f = plano(L.filasHojaKpi(kpi));
  assert.ok(f.every(r => r.length === 7));
  assert.equal(f[2][6], 0.5);
  assert.equal(f[f.length - 1][6], '');
});
```

- [ ] **Step 2: Correr las pruebas y ver que fallan**

Run: `node --test test/logica-kpi.test.js`
Expected: FAIL con `L.kpiCohortes is not a function`.

- [ ] **Step 3: Añadir al final de `src/Logica.gs`**

```js
/* ==========================================================================
   INDICADORES (diseño §7.3)
   ========================================================================== */

function compararCampos_(campos) {
  return function (a, b) {
    for (var i = 0; i < campos.length; i++) {
      var x = a[campos[i]], y = b[campos[i]];
      if (x < y) return -1;
      if (x > y) return 1;
    }
    return 0;
  };
}

/**
 * Retorno por cohorte. La cohorte es el mes de la primera cita realizada de
 * la serie. Un paciente cuenta en la etapa k solo si ya volvió o si su
 * plazo de esa etapa ya venció ("maduro"): así un mes reciente no aparece
 * con un retorno artificialmente bajo.
 */
function kpiCohortes(citas, reglas, hoy) {
  var series = armarSeries(citas), acc = {};
  Object.keys(series).forEach(function (k) {
    var s = series[k], r = s.realizadas;
    if (!r.length) return;
    var plazo = plazoDe(reglas, s.especialidad);
    for (var etapa = 1; etapa <= 3 && r.length >= etapa; etapa++) {
      var volvio = r.length >= etapa + 1;
      if (!volvio && sumarDias(r[etapa - 1].FECHA, plazo.vence) > hoy) continue;
      var clave = [mesDe(r[0].FECHA), s.especialidad, r[0].MEDICO, etapa].join('|');
      if (!acc[clave]) acc[clave] = { COHORTE: mesDe(r[0].FECHA), ESPECIALIDAD: s.especialidad, MEDICO: r[0].MEDICO, ETAPA: etapa, ELEGIBLES: 0, VOLVIERON: 0 };
      acc[clave].ELEGIBLES++;
      if (volvio) acc[clave].VOLVIERON++;
    }
  });
  return Object.keys(acc).map(function (k) { return acc[k]; })
    .sort(compararCampos_(['COHORTE', 'ESPECIALIDAD', 'MEDICO', 'ETAPA']));
}

function realizadasPorDni_(citas) {
  var out = {};
  (citas || []).forEach(function (c) {
    if (normTexto(c.ESTADO) === 'REALIZADO') (out[c.DNI] = out[c.DNI] || []).push(c);
  });
  Object.keys(out).forEach(function (d) { out[d].sort(porFecha); });
  return out;
}

function ultimaAntesDe_(lista, fecha) {
  var u = null;
  (lista || []).forEach(function (c) { if (c.FECHA <= fecha) u = c; });
  return u;
}

function kpiIndicaciones(indicaciones, citas) {
  var porDni = realizadasPorDni_(citas), acc = {};
  (indicaciones || []).forEach(function (i) {
    var previa = i.DNI ? ultimaAntesDe_(porDni[i.DNI], i.FECHA) : null;
    var medico = i.MEDICO_SOLICITANTE || (previa ? previa.MEDICO : '') || 'SIN MÉDICO';
    var clave = [mesDe(i.FECHA), i.TIPO, i.DETALLE, medico].join('|');
    if (!acc[clave]) acc[clave] = { MES: mesDe(i.FECHA), TIPO: i.TIPO, DETALLE: i.DETALLE, MEDICO: medico, INDICADAS: 0, ACEPTADAS: 0 };
    acc[clave].INDICADAS++;
    if (i.ESTADO === 'ACEPTÓ') acc[clave].ACEPTADAS++;
  });
  return Object.keys(acc).map(function (k) { return acc[k]; })
    .sort(compararCampos_(['MES', 'TIPO', 'DETALLE', 'MEDICO']));
}

function kpiRecuperacion(seguimientos, citas) {
  var series = armarSeries(citas);
  return (seguimientos || []).filter(function (s) { return normTexto(s.ACCION) === 'HECHO'; }).map(function (s) {
    var f = fechaIso(s.FECHA_HORA);
    var serie = series[claveSerie(s.DNI, s.ESPECIALIDAD)];
    var despues = serie ? serie.realizadas.concat(serie.agendadas).filter(function (c) { return c.FECHA > f; }).sort(porFecha) : [];
    var previa = serie ? ultimaAntesDe_(serie.realizadas, f) : null;
    return {
      MES: mesDe(f),
      RESPONSABLE: s.RESPONSABLE,
      ESPECIALIDAD: s.ESPECIALIDAD,
      MEDICO: previa ? previa.MEDICO : '',
      VOLVIO: despues.length ? 1 : 0,
      DIAS: despues.length ? diasEntre(f, despues[0].FECHA) : ''
    };
  });
}

function kpiMotivos(seguimientos) {
  var acc = {};
  (seguimientos || []).forEach(function (s) {
    if (normTexto(s.ACCION) !== 'DESCARTADO') return;
    var m = s.MOTIVO || 'SIN MOTIVO';
    acc[m] = (acc[m] || 0) + 1;
  });
  return Object.keys(acc).map(function (m) { return { MOTIVO: m, N: acc[m] }; })
    .sort(function (a, b) { return (b.N - a.N) || (a.MOTIVO < b.MOTIVO ? -1 : 1); });
}

function calcularKpi(citas, indicaciones, seguimientos, reglas, hoy) {
  return {
    cohortes: kpiCohortes(citas, reglas, hoy),
    indicaciones: kpiIndicaciones(indicaciones, citas),
    recuperacion: kpiRecuperacion(seguimientos, citas),
    motivos: kpiMotivos(seguimientos),
    sinCandidato: (indicaciones || []).filter(function (i) { return normTexto(i.EMPAREJAMIENTO) === 'SIN CANDIDATO'; })
      .map(function (i) { return { ID: i.ID, FECHA: i.FECHA, TIPO: i.TIPO, NOMBRE: i.NOMBRE, TELEFONO: i.TELEFONO }; })
  };
}

/** Las dos tablas de la hoja KPI, una debajo de otra, todas las filas de 7 columnas. */
function filasHojaKpi(kpi) {
  var vacia = ['', '', '', '', '', '', ''];
  var f = [['RETORNO POR COHORTE', '', '', '', '', '', ''], ['COHORTE', 'ESPECIALIDAD', 'MEDICO', 'ETAPA', 'ELEGIBLES', 'VOLVIERON', 'TASA']];
  kpi.cohortes.forEach(function (r) {
    f.push([r.COHORTE, r.ESPECIALIDAD, r.MEDICO, r.ETAPA, r.ELEGIBLES, r.VOLVIERON, r.ELEGIBLES ? r.VOLVIERON / r.ELEGIBLES : '']);
  });
  f.push(vacia.slice());
  f.push(['INDICACIONES', '', '', '', '', '', '']);
  f.push(['MES', 'TIPO', 'DETALLE', 'MEDICO', 'INDICADAS', 'ACEPTADAS', 'TASA']);
  kpi.indicaciones.forEach(function (r) {
    f.push([r.MES, r.TIPO, r.DETALLE, r.MEDICO, r.INDICADAS, r.ACEPTADAS, r.INDICADAS ? r.ACEPTADAS / r.INDICADAS : '']);
  });
  return f;
}
```

- [ ] **Step 4: Correr las pruebas y ver que pasan**

Run: `node --test test/logica-*.test.js`
Expected: PASS, todas.

- [ ] **Step 5: Commit**

```bash
git add src/Logica.gs test/logica-kpi.test.js
git commit -m "Lógica: indicadores de retorno, indicaciones, recuperación y motivos"
```

---

### Task 8: Capa de datos y funciones públicas (`Codigo.gs`)

**Files:**
- Create: `src/Codigo.gs`
- Test: `test/sintaxis.test.js`

**Interfaces:**
- Consumes: todo `Logica.gs`.
- Produces (los usa `Menu.gs`):
  - `CONFIG = { SS_ID, HIERRO_ID, HOJA_SOFDOC: 'Hoja 1', ESPERA_LOCK_MS: 30000 }`, `MEMO`.
  - `COLUMNAS_SEGUIMIENTOS`, `COLUMNAS_BITACORA`.
  - Auxiliares: `ss_()`, `hoja_(nombre)`, `fechaTexto_(d)`, `fechaHoraTexto_(d)`, `hoy_()`, `leerObjetos_(nombre) → object[]`, `escribirObjetos_(nombre, columnas, objetos)`, `anexarObjeto_(nombre, columnas, objeto)`, `bitacora_(usuario, accion, detalle)`, `reglas_()`, `catalogos_()`, `datos_() → { hoy, reglas, catalogos, citas, indicaciones, seguimientos, pacientes }`, `bloquear_() → lock`.
  - Para la app: `doGet`, `bootstrap`, `getBandeja`, `getPaciente(dni)`, `buscar(texto)`, `marcarSeguimiento(p)`, `descartar(p)`, `confirmarEmparejamiento(p)`, `getKpi`.
  - Formas que recibe y devuelve:
    - `bootstrap() → { hoy, usuarios, motivos, especialidades, medicos }`.
    - `getBandeja() → { tarjetas: Paciente[], contador: { porAtender, hechosHoy, recuperadosMes } }`.
    - `getPaciente(dni) → { dni, nombre, series: Paciente[], citas: Cita[], indicaciones: Indicacion[], porConfirmar: [{ ID, FECHA, TIPO, DETALLE, NOMBRE, TELEFONO, candidatos: [{dni, nombre}] }], seguimientos: Seguimiento[] }`.
    - `buscar(texto) → [{ DNI, NOMBRE }]` (20 como máximo).
    - `marcarSeguimiento({ usuario, dni, especialidad, nota })` y `descartar({ usuario, dni, especialidad, motivo, nota })` devuelven `{ ok: true, seguimiento }`.
    - `confirmarEmparejamiento({ usuario, id, dni }) → { ok: true }`.

- [ ] **Step 1: Escribir la prueba**

```js
// test/sintaxis.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar } = require('./cargar');

test('Logica.gs y Codigo.gs cargan juntos y exponen las funciones públicas', () => {
  const ctx = cargar(['Logica.gs', 'Codigo.gs']);
  for (const f of ['doGet', 'bootstrap', 'getBandeja', 'getPaciente', 'buscar', 'marcarSeguimiento',
    'descartar', 'confirmarEmparejamiento', 'getKpi']) {
    assert.equal(typeof ctx[f], 'function', f);
  }
  assert.equal(ctx.CONFIG.SS_ID, '1L8fY-NXWE1agakIPEdqoLnLry0-lvYr0Z-9JfsfGxRM');
  assert.equal(ctx.CONFIG.HIERRO_ID, '1FrJ9oXyeHLLABqLcSA2VyXry-x_ZeFow6LsSACeJw8o');
});
```

- [ ] **Step 2: Correr la prueba y ver que falla**

Run: `node --test test/sintaxis.test.js`
Expected: FAIL con `ENOENT … Codigo.gs`.

- [ ] **Step 3: Crear `src/Codigo.gs`**

```js
/* ==========================================================================
   CAPA DE DATOS Y FUNCIONES QUE LLAMA LA APP

   Este es el único archivo que lee y escribe el Sheets para la app. La lógica
   de negocio está en Logica.gs; aquí solo se traducen celdas a objetos y
   objetos a celdas.
   ========================================================================== */

var CONFIG = {
  SS_ID: '1L8fY-NXWE1agakIPEdqoLnLry0-lvYr0Z-9JfsfGxRM',
  HIERRO_ID: '1FrJ9oXyeHLLABqLcSA2VyXry-x_ZeFow6LsSACeJw8o',
  HOJA_SOFDOC: 'Hoja 1',
  ESPERA_LOCK_MS: 30000
};

var COLUMNAS_SEGUIMIENTOS = ['ID', 'FECHA_HORA', 'DNI', 'ESPECIALIDAD', 'RESPONSABLE', 'ACCION', 'MOTIVO', 'NOTA'];
var COLUMNAS_BITACORA = ['FECHA_HORA', 'USUARIO', 'ACCION', 'DETALLE'];

/** Columnas que se guardan como fecha (a mediodía) o fecha y hora. */
var COLUMNAS_FECHA = { FECHA: 1, PRIMERA_CITA: 1, ULTIMA_CITA: 1, PROXIMA_ESPERADA: 1, VENCE: 1, PROXIMA_AGENDADA: 1, ULTIMO_SEGUIMIENTO: 1 };
var COLUMNAS_FECHA_HORA = { FECHA_HORA: 1 };
/** El resto se guarda como texto plano, para que Sheets no convierta '2026-07' ni DNI en otra cosa. */
var COLUMNAS_NUMERICAS = { N_REALIZADAS: 1, DIAS_ATRASO: 1, N_SEGUIMIENTOS: 1, CANTIDAD: 1, PAGO: 1 };

/* Vive lo que dura una petición: Apps Script arranca un proceso por llamada. */
var MEMO = {};

function ss_() {
  if (!MEMO.ss) MEMO.ss = SpreadsheetApp.openById(CONFIG.SS_ID);
  return MEMO.ss;
}

function tz_() {
  if (!MEMO.tz) MEMO.tz = ss_().getSpreadsheetTimeZone() || 'America/Lima';
  return MEMO.tz;
}

function mismaZona_() {
  if (MEMO.mismaZona === undefined) MEMO.mismaZona = (tz_() === Session.getScriptTimeZone());
  return MEMO.mismaZona;
}

function dos_(n) { return n < 10 ? '0' + n : String(n); }

/** Date -> 'yyyy-MM-dd'. Aritmética si las zonas coinciden (formatDate cuesta ~1 ms por llamada). */
function fechaTexto_(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return '';
  if (mismaZona_()) return d.getFullYear() + '-' + dos_(d.getMonth() + 1) + '-' + dos_(d.getDate());
  return Utilities.formatDate(d, tz_(), 'yyyy-MM-dd');
}

function fechaHoraTexto_(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return '';
  if (mismaZona_()) return fechaTexto_(d) + ' ' + dos_(d.getHours()) + ':' + dos_(d.getMinutes());
  return Utilities.formatDate(d, tz_(), 'yyyy-MM-dd HH:mm');
}

function hoy_() {
  return fechaTexto_(new Date());
}

/**
 * 'yyyy-MM-dd' -> Date a MEDIODÍA; 'yyyy-MM-dd HH:mm' -> esa hora.
 * A mediodía porque entre la zona del archivo y la del motor puede haber
 * horas de diferencia, y una fecha a las 00:00 se guardaría como el día anterior.
 */
function aFecha_(texto) {
  var m = String(texto || '').match(/^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?/);
  if (!m) return '';
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), m[4] ? Number(m[4]) : 12, m[5] ? Number(m[5]) : 0, 0);
}

function hoja_(nombre) {
  var sh = ss_().getSheetByName(nombre);
  if (!sh) throw new Error('Falta la hoja "' + nombre + '". Use el menú Seguimientos → Preparar hojas.');
  return sh;
}

function celdaATexto_(v, columna) {
  if (v instanceof Date) {
    return (COLUMNAS_FECHA_HORA[columna] || columna === 'FECHA_REGISTRO') ? fechaHoraTexto_(v) : fechaTexto_(v);
  }
  return v === null || v === undefined ? '' : String(v);
}

function celdaParaHoja_(v, columna) {
  if (v === undefined || v === null) return '';
  if (COLUMNAS_FECHA[columna] || COLUMNAS_FECHA_HORA[columna]) return aFecha_(v);
  if (typeof v === 'number') return isFinite(v) ? v : '';
  return v;
}

/** Una hoja con encabezado en la fila 1 -> objetos { COLUMNA: texto }. Las filas vacías se saltan. */
function leerObjetos_(nombre) {
  var sh = hoja_(nombre), alto = sh.getLastRow(), ancho = sh.getLastColumn();
  if (alto < 2 || ancho < 1) return [];
  var datos = sh.getRange(1, 1, alto, ancho).getValues();
  var cab = datos[0].map(function (c) { return String(c).trim(); });
  return datos.slice(1)
    .filter(function (f) { return f.some(function (c) { return c !== '' && c !== null; }); })
    .map(function (f) {
      var o = {};
      cab.forEach(function (c, i) { if (c) o[c] = celdaATexto_(f[i], c); });
      return o;
    });
}

function aplicarFormatos_(sh, columnas, alto) {
  columnas.forEach(function (c, i) {
    var r = sh.getRange(1, i + 1, Math.max(alto, 2), 1);
    if (COLUMNAS_FECHA[c]) r.setNumberFormat('yyyy-mm-dd');
    else if (COLUMNAS_FECHA_HORA[c]) r.setNumberFormat('yyyy-mm-dd hh:mm');
    else if (!COLUMNAS_NUMERICAS[c]) r.setNumberFormat('@');
  });
}

/** Reescribe la hoja entera. Solo para hojas que genera el script (CITAS, PACIENTES, INDICACIONES en la importación). */
function escribirObjetos_(nombre, columnas, objetos) {
  var sh = hoja_(nombre);
  var filas = [columnas].concat(objetos.map(function (o) {
    return columnas.map(function (c) { return celdaParaHoja_(o[c], c); });
  }));
  sh.clearContents();
  aplicarFormatos_(sh, columnas, filas.length);
  sh.getRange(1, 1, filas.length, columnas.length).setValues(filas);
  SpreadsheetApp.flush();
}

function anexarObjeto_(nombre, columnas, objeto) {
  hoja_(nombre).appendRow(columnas.map(function (c) { return celdaParaHoja_(objeto[c], c); }));
}

function bitacora_(usuario, accion, detalle) {
  anexarObjeto_('BITACORA', COLUMNAS_BITACORA, {
    FECHA_HORA: fechaHoraTexto_(new Date()), USUARIO: usuario, ACCION: accion, DETALLE: detalle
  });
}

function bloquear_() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(CONFIG.ESPERA_LOCK_MS)) throw new Error('Otra persona está guardando. Intente de nuevo en unos segundos.');
  return lock;
}

function tablaCruda_(nombre) {
  var sh = ss_().getSheetByName(nombre);
  if (!sh || sh.getLastRow() < 1) return { encabezado: [], filas: [] };
  var v = sh.getDataRange().getValues();
  return { encabezado: v[0], filas: v.slice(1) };
}

function reglas_() {
  var t = tablaCruda_('REGLAS');
  return reglasDesdeFilas(t.encabezado, t.filas);
}

function catalogos_() {
  var t = tablaCruda_('CATALOGOS');
  return catalogosDesdeFilas(t.encabezado, t.filas);
}

function leerCitas_() {
  var citas = leerObjetos_('CITAS');
  citas.forEach(function (c) { c.DNI = normDni(c.DNI); });
  return citas;
}

function leerIndicaciones_() {
  var inds = leerObjetos_('INDICACIONES');
  inds.forEach(function (i) {
    i.DNI = normDni(i.DNI);
    i.TIPO = normTexto(i.TIPO);
    i.ESTADO = normalizarEstadoIndicacion(i.ESTADO);
  });
  return inds;
}

function leerSeguimientos_() {
  var segs = leerObjetos_('SEGUIMIENTOS');
  segs.forEach(function (s) { s.DNI = normDni(s.DNI); });
  return segs;
}

/** Todo lo que necesita la app, leído una vez por petición. */
function datos_() {
  if (MEMO.datos) return MEMO.datos;
  var d = {
    hoy: hoy_(),
    reglas: reglas_(),
    catalogos: catalogos_(),
    citas: leerCitas_(),
    indicaciones: leerIndicaciones_(),
    seguimientos: leerSeguimientos_()
  };
  d.pacientes = armarPacientes(d.citas, d.indicaciones, d.seguimientos, d.reglas, d.hoy);
  MEMO.datos = d;
  return d;
}

/* ==========================================================================
   PUNTO DE ENTRADA WEB Y FUNCIONES QUE LLAMA LA APP
   ========================================================================== */

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Seguimientos — Centro Hematológico del Perú')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function bootstrap() {
  var d = datos_(), esp = {}, med = {};
  d.pacientes.forEach(function (p) {
    if (p.ESPECIALIDAD) esp[p.ESPECIALIDAD] = 1;
    if (p.MEDICO_ULTIMO) med[p.MEDICO_ULTIMO] = 1;
  });
  return limpiarParaEnvio({
    hoy: d.hoy,
    usuarios: d.catalogos.usuarios,
    motivos: d.catalogos.motivos,
    especialidades: Object.keys(esp).sort(),
    medicos: Object.keys(med).sort()
  });
}

function getBandeja() {
  var d = datos_();
  var tarjetas = ordenarBandeja(d.pacientes);
  var mes = mesDe(d.hoy);
  var hechosHoy = d.seguimientos.filter(function (s) {
    return fechaIso(s.FECHA_HORA) === d.hoy && normTexto(s.ACCION) === 'HECHO';
  }).length;
  var recuperadosMes = kpiRecuperacion(d.seguimientos, d.citas).filter(function (r) {
    return r.MES === mes && r.VOLVIO;
  }).length;
  return limpiarParaEnvio({
    tarjetas: tarjetas,
    contador: { porAtender: tarjetas.length, hechosHoy: hechosHoy, recuperadosMes: recuperadosMes }
  });
}

function getPaciente(dni) {
  var d = datos_(), k = normDni(dni);
  var series = d.pacientes.filter(function (p) { return p.DNI === k; });
  var citas = d.citas.filter(function (c) { return c.DNI === k; }).sort(porFecha);
  var indice = construirIndiceNombres(d.citas);
  var porConfirmar = d.indicaciones
    .filter(function (i) { return normTexto(i.EMPAREJAMIENTO) === 'POR CONFIRMAR'; })
    .map(function (i) {
      return { ID: i.ID, FECHA: i.FECHA, TIPO: i.TIPO, DETALLE: i.DETALLE, NOMBRE: i.NOMBRE, TELEFONO: i.TELEFONO,
        candidatos: emparejar(i.NOMBRE, indice).candidatos };
    })
    .filter(function (i) { return i.candidatos.some(function (c) { return c.dni === k; }); });
  var ultima = citas[citas.length - 1];
  return limpiarParaEnvio({
    dni: k,
    nombre: series.length ? series[0].NOMBRE : (ultima ? ultima.NOMBRE : ''),
    series: series,
    citas: citas,
    indicaciones: d.indicaciones.filter(function (i) { return i.DNI === k; }),
    porConfirmar: porConfirmar,
    seguimientos: d.seguimientos.filter(function (s) { return s.DNI === k; })
  });
}

function buscar(texto) {
  var q = normTexto(texto);
  if (q.length < 3) return [];
  var qDni = normDni(texto), porDni = /\d/.test(qDni);
  var d = datos_(), vistos = {}, out = [];
  for (var i = d.citas.length - 1; i >= 0 && out.length < 20; i--) {
    var c = d.citas[i];
    if (vistos[c.DNI]) continue;
    if ((porDni && c.DNI.indexOf(qDni) === 0) || normTexto(c.NOMBRE).indexOf(q) >= 0) {
      vistos[c.DNI] = 1;
      out.push({ DNI: c.DNI, NOMBRE: c.NOMBRE });
    }
  }
  return limpiarParaEnvio(out);
}

function registrar_(p, accion) {
  var d = datos_();
  var error = validarAccion(p, d.catalogos, accion);
  if (error) throw new Error(error);
  var lock = bloquear_();
  try {
    var ahora = new Date();
    var s = {
      ID: 'SEG-' + ahora.getTime() + '-' + Math.floor(Math.random() * 1000),
      FECHA_HORA: fechaHoraTexto_(ahora),
      DNI: normDni(p.dni),
      ESPECIALIDAD: String(p.especialidad).trim(),
      RESPONSABLE: String(p.usuario).trim(),
      ACCION: accion,
      MOTIVO: accion === 'DESCARTADO' ? String(p.motivo).trim() : '',
      NOTA: String(p.nota || '').trim()
    };
    anexarObjeto_('SEGUIMIENTOS', COLUMNAS_SEGUIMIENTOS, s);
    bitacora_(s.RESPONSABLE, accion === 'HECHO' ? 'SEGUIMIENTO' : 'DESCARTE', s.DNI + ' · ' + s.ESPECIALIDAD);
    return limpiarParaEnvio({ ok: true, seguimiento: s });
  } finally {
    lock.releaseLock();
  }
}

function marcarSeguimiento(p) { return registrar_(p, 'HECHO'); }

function descartar(p) { return registrar_(p, 'DESCARTADO'); }

function confirmarEmparejamiento(p) {
  var d = datos_();
  if (!p || d.catalogos.usuarios.map(normTexto).indexOf(normTexto(p.usuario)) < 0) {
    throw new Error('Elija quién es usted en el selector de arriba.');
  }
  var dni = normDni(p.dni);
  if (!dni) throw new Error('Falta el DNI.');
  var lock = bloquear_();
  try {
    var sh = hoja_('INDICACIONES'), datos = sh.getDataRange().getValues();
    var cab = datos[0].map(function (c) { return String(c).trim(); });
    var cId = cab.indexOf('ID'), cDni = cab.indexOf('DNI'), cEm = cab.indexOf('EMPAREJAMIENTO');
    for (var i = 1; i < datos.length; i++) {
      if (String(datos[i][cId]) !== String(p.id)) continue;
      sh.getRange(i + 1, cDni + 1).setNumberFormat('@').setValue(dni);
      sh.getRange(i + 1, cEm + 1).setValue('CONFIRMADO');
      bitacora_(String(p.usuario).trim(), 'EMPAREJAMIENTO', p.id + ' → ' + dni);
      return { ok: true };
    }
    throw new Error('No encontré la indicación ' + p.id + '.');
  } finally {
    lock.releaseLock();
  }
}

function getKpi() {
  var d = datos_();
  return limpiarParaEnvio(calcularKpi(d.citas, d.indicaciones, d.seguimientos, d.reglas, d.hoy));
}
```

- [ ] **Step 4: Correr todas las pruebas**

Run: `npm test`
Expected: PASS, todas, incluida `sintaxis.test.js`.

- [ ] **Step 5: Commit**

```bash
git add src/Codigo.gs test/sintaxis.test.js
git commit -m "Capa de datos y funciones públicas para la app"
```

---

### Task 9: Menú del Sheets (`Menu.gs`)

**Files:**
- Create: `src/Menu.gs`
- Modify: `test/sintaxis.test.js` (se añade una prueba)

**Interfaces:**
- Consumes: `CONFIG`, `MEMO`, `ss_`, `hoja_`, `leerObjetos_`, `leerCitas_`, `escribirObjetos_`, `bitacora_`, `bloquear_`, `catalogos_`, `datos_`, `fechaHoraTexto_`, `COLUMNAS_SEGUIMIENTOS`, `COLUMNAS_BITACORA` (Tarea 8), y de `Logica.gs`: `limpiarCitas`, `fusionarCitas`, `construirIndiceNombres`, `aplicarEmparejamientos`, `indicacionesDesdeHierro`, `calcularKpi`, `filasHojaKpi`, `normDni` y las `COLUMNAS_*`.
- Produces: `onOpen`, `actualizar`, `verificar`, `prepararHojas`, `importarIndicaciones` (desde el menú) y `actualizar_() → { ok, mensaje }`.

- [ ] **Step 1: Añadir la prueba a `test/sintaxis.test.js`**

```js
test('Menu.gs carga con los otros y expone las funciones del menú', () => {
  const ctx = cargar(['Logica.gs', 'Codigo.gs', 'Menu.gs']);
  for (const f of ['onOpen', 'actualizar', 'verificar', 'prepararHojas', 'importarIndicaciones']) {
    assert.equal(typeof ctx[f], 'function', f);
  }
  const base = ctx.hojasBase_();
  assert.deepEqual(Object.keys(base), ['CITAS', 'PACIENTES', 'INDICACIONES', 'SEGUIMIENTOS', 'BITACORA', 'KPI']);
});
```

- [ ] **Step 2: Correr la prueba y ver que falla**

Run: `node --test test/sintaxis.test.js`
Expected: FAIL con `ENOENT … Menu.gs`.

- [ ] **Step 3: Crear `src/Menu.gs`**

```js
/* ==========================================================================
   MENÚ «Seguimientos» DEL SHEETS

   Orden la primera vez:
     1. Preparar hojas
     2. Actualizar            (carga CITAS desde la "Hoja 1")
     3. Importar hierro y procedimientos (una vez)
     4. Actualizar            (empareja y recalcula con las indicaciones)
   ========================================================================== */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Seguimientos')
    .addItem('Actualizar', 'actualizar')
    .addItem('Verificar', 'verificar')
    .addSeparator()
    .addItem('Preparar hojas', 'prepararHojas')
    .addItem('Importar hierro y procedimientos (una vez)', 'importarIndicaciones')
    .addToUi();
}

/** Función y no variable global: el orden en que Apps Script carga los archivos no está garantizado. */
function hojasBase_() {
  return {
    CITAS: COLUMNAS_CITAS,
    PACIENTES: COLUMNAS_PACIENTES,
    INDICACIONES: COLUMNAS_INDICACIONES,
    SEGUIMIENTOS: COLUMNAS_SEGUIMIENTOS,
    BITACORA: COLUMNAS_BITACORA,
    KPI: ['RETORNO POR COHORTE']
  };
}

function prepararHojas() {
  var ss = ss_(), base = hojasBase_(), creadas = [];
  Object.keys(base).forEach(function (n) {
    if (ss.getSheetByName(n)) return;
    var sh = ss.insertSheet(n);
    sh.getRange(1, 1, 1, base[n].length).setValues([base[n]]).setFontWeight('bold');
    sh.setFrozenRows(1);
    creadas.push(n);
  });
  if (!ss.getSheetByName('REGLAS')) {
    var r = ss.insertSheet('REGLAS');
    r.getRange(1, 1, 4, 6).setValues([
      ['ESPECIALIDAD', 'ESPERADO_DIAS', 'VENCE_DIAS', '', 'PARAMETRO', 'VALOR'],
      ['*', 30, 45, '', 'ESPERA_TRAS_SEGUIMIENTO_DIAS', 15],
      ['HEMATOLOGÍA', 30, 45, '', 'MAX_SEGUIMIENTOS', 3],
      ['', '', '', '', 'CORTE_BANDEJA_DIAS', 180]
    ]);
    r.getRange(1, 1, 1, 6).setFontWeight('bold');
    r.setFrozenRows(1);
    creadas.push('REGLAS');
  }
  if (!ss.getSheetByName('CATALOGOS')) {
    var c = ss.insertSheet('CATALOGOS');
    c.getRange(1, 1, 6, 4).setValues([
      ['USUARIOS', 'MOTIVOS_DESCARTE', 'MEDICO_ALIAS', 'MEDICO_NOMBRE'],
      ['MAGALY', 'SE ATIENDE EN OTRO LUGAR', 'Dr. ELI FABRIZIO CABANILLAS HUALPA', 'Dr. ELÍ FABRIZIO CABANILLAS HUALPA'],
      ['ANA', 'NÚMERO EQUIVOCADO', '', ''],
      ['RACHEL', 'YA NO LO NECESITA', '', ''],
      ['DR. ELI CABANILLAS', 'FALLECIÓ', '', ''],
      ['', 'OTRO', '', '']
    ]);
    c.getRange(1, 1, 1, 4).setFontWeight('bold');
    c.setFrozenRows(1);
    creadas.push('CATALOGOS');
  }
  SpreadsheetApp.getUi().alert(creadas.length
    ? 'Hojas creadas: ' + creadas.join(', ') + '.'
    : 'Todas las hojas ya existían. No se cambió nada.');
}

function actualizar() {
  var ui = SpreadsheetApp.getUi(), lock;
  try { lock = bloquear_(); } catch (e) { ui.alert('Otra actualización está en curso. Intente en un minuto.'); return; }
  try {
    ui.alert(actualizar_().mensaje);
  } finally {
    lock.releaseLock();
  }
}

/** Hoja 1 -> CITAS -> emparejamientos -> PACIENTES -> KPI. Si algo no cuadra, no escribe nada. */
function actualizar_() {
  var datos = hoja_(CONFIG.HOJA_SOFDOC).getDataRange().getValues();
  if (datos.length < 2) return { ok: false, mensaje: 'La "Hoja 1" está vacía. Pegue primero el export de SOFDOC.' };
  var filas = datos.slice(1).map(function (f) {
    return f.map(function (v) { return v instanceof Date ? fechaHoraTexto_(v) : v; });
  });
  var limpio = limpiarCitas(datos[0], filas, catalogos_().alias);
  if (limpio.faltantes.length) {
    return { ok: false, mensaje: 'No se actualizó nada. Faltan estas columnas en la "Hoja 1": ' + limpio.faltantes.join(', ') + '.' };
  }
  if (!limpio.citas.length) {
    return { ok: false, mensaje: 'No se actualizó nada: ninguna fila de la "Hoja 1" tiene IDCITA, DNI y fecha válidos.' };
  }

  var fusion = fusionarCitas(leerCitas_(), limpio.citas);
  escribirObjetos_('CITAS', COLUMNAS_CITAS, fusion.citas);
  var emparejadas = emparejarIndicacionesEnHoja_(fusion.citas);

  MEMO.datos = null;
  var d = datos_();
  escribirObjetos_('PACIENTES', COLUMNAS_PACIENTES, d.pacientes);
  escribirKpi_(filasHojaKpi(calcularKpi(d.citas, d.indicaciones, d.seguimientos, d.reglas, d.hoy)));

  var detalle = filas.length + ' filas leídas, ' + fusion.nuevas + ' citas nuevas, ' + fusion.cambiadas + ' cambiadas, ' +
    limpio.invalidas + ' inválidas, ' + emparejadas + ' emparejamientos nuevos';
  bitacora_('MENÚ', 'ACTUALIZAR', detalle);
  var vencidos = d.pacientes.filter(function (p) { return p.ESTADO === 'VENCIDO'; }).length;
  return { ok: true, mensaje: 'Listo. ' + detalle + '. En la bandeja: ' + vencidos + ' pacientes.' };
}

/**
 * Escribe solo las columnas DNI y EMPAREJAMIENTO de INDICACIONES, para no
 * pisar lo que una asesora esté anotando en las demás columnas.
 */
function emparejarIndicacionesEnHoja_(citas) {
  var sh = hoja_('INDICACIONES'), datos = sh.getDataRange().getValues();
  if (datos.length < 2) return 0;
  var cab = datos[0].map(function (c) { return String(c).trim(); });
  var cN = cab.indexOf('NOMBRE'), cD = cab.indexOf('DNI'), cE = cab.indexOf('EMPAREJAMIENTO');
  if (cN < 0 || cD < 0 || cE < 0) throw new Error('INDICACIONES necesita las columnas NOMBRE, DNI y EMPAREJAMIENTO.');
  var filas = datos.slice(1).map(function (f) {
    return { NOMBRE: f[cN], DNI: normDni(f[cD]), EMPAREJAMIENTO: String(f[cE] || '') };
  });
  var conNombre = filas.filter(function (f) { return String(f.NOMBRE).trim(); });
  var cambios = aplicarEmparejamientos(conNombre, construirIndiceNombres(citas));
  if (!cambios) return 0;
  sh.getRange(2, cD + 1, filas.length, 1).setNumberFormat('@').setValues(filas.map(function (f) { return [f.DNI]; }));
  sh.getRange(2, cE + 1, filas.length, 1).setValues(filas.map(function (f) { return [f.EMPAREJAMIENTO]; }));
  return cambios;
}

function escribirKpi_(filas) {
  var sh = hoja_('KPI');
  sh.clearContents();
  sh.getRange(1, 1, filas.length, 4).setNumberFormat('@');
  sh.getRange(1, 7, filas.length, 1).setNumberFormat('0%');
  sh.getRange(1, 1, filas.length, 7).setValues(filas);
}

function importarIndicaciones() {
  var ui = SpreadsheetApp.getUi(), lock;
  try { lock = bloquear_(); } catch (e) { ui.alert('Otra operación está en curso. Intente en un minuto.'); return; }
  try {
    if (leerObjetos_('INDICACIONES').length) {
      ui.alert('INDICACIONES ya tiene filas. La importación se hace una sola vez y no se repite, para no duplicar.');
      return;
    }
    var citas = leerCitas_();
    if (!citas.length) {
      ui.alert('Primero use «Actualizar» para cargar las citas: sin ellas no se puede emparejar.');
      return;
    }
    var origen = SpreadsheetApp.openById(CONFIG.HIERRO_ID), todas = [];
    ['HIERRO', 'PROCEDIMIENTOS'].forEach(function (n) {
      var sh = origen.getSheetByName(n);
      if (!sh) throw new Error('La base de hierro no tiene la pestaña ' + n + '.');
      var v = sh.getDataRange().getValues().map(function (f) {
        return f.map(function (x) { return x instanceof Date ? fechaHoraTexto_(x) : x; });
      });
      todas = todas.concat(indicacionesDesdeHierro(n, v[0], v.slice(1), todas.length + 1));
    });
    aplicarEmparejamientos(todas, construirIndiceNombres(citas));
    escribirObjetos_('INDICACIONES', COLUMNAS_INDICACIONES, todas);
    var cuenta = {};
    todas.forEach(function (i) { cuenta[i.EMPAREJAMIENTO] = (cuenta[i.EMPAREJAMIENTO] || 0) + 1; });
    var detalle = todas.length + ' indicaciones: ' + Object.keys(cuenta).map(function (k) { return cuenta[k] + ' ' + k; }).join(', ');
    bitacora_('MENÚ', 'IMPORTAR', detalle);
    ui.alert('Importadas ' + detalle + '. Ahora use «Actualizar».');
  } finally {
    lock.releaseLock();
  }
}

/** Revisión de salud. No escribe nada. */
function verificar() {
  var ss = ss_(), lineas = [];
  var h = ss.getSheetByName(CONFIG.HOJA_SOFDOC);
  if (!h) {
    lineas.push('✗ No existe la hoja "' + CONFIG.HOJA_SOFDOC + '".');
  } else {
    var cab = h.getRange(1, 1, 1, Math.max(1, h.getLastColumn())).getValues()[0];
    var r = limpiarCitas(cab, [], {});
    lineas.push(r.faltantes.length
      ? '✗ A la "Hoja 1" le faltan: ' + r.faltantes.join(', ') + '.'
      : '✓ "Hoja 1": encabezado correcto, ' + Math.max(0, h.getLastRow() - 1) + ' filas.');
  }
  Object.keys(hojasBase_()).concat(['REGLAS', 'CATALOGOS']).forEach(function (n) {
    var s = ss.getSheetByName(n);
    lineas.push(s ? '✓ ' + n + ': ' + Math.max(0, s.getLastRow() - 1) + ' filas.' : '✗ Falta la hoja ' + n + '. Use «Preparar hojas».');
  });
  try {
    SpreadsheetApp.openById(CONFIG.HIERRO_ID);
    lineas.push('✓ La base de hierro se puede abrir.');
  } catch (e) {
    lineas.push('✗ No se puede abrir la base de hierro: ' + e.message);
  }
  SpreadsheetApp.getUi().alert(lineas.join('\n'));
}
```

- [ ] **Step 4: Correr todas las pruebas**

Run: `npm test`
Expected: PASS, todas.

- [ ] **Step 5: Commit**

```bash
git add src/Menu.gs test/sintaxis.test.js
git commit -m "Menú del Sheets: preparar hojas, actualizar, importar y verificar"
```

---

### Task 10: La app — bandeja, ficha y modo `DEMO`

**Files:**
- Create: `src/Index.html`
- Test: `test/ui.test.js`

**Interfaces:**
- Consumes: las funciones públicas de la Tarea 8, con las formas descritas allí.
- Produces: en el `<script>` de `Index.html`, `llamar(fn, ...args) → Promise`, `E` (estado), `$`, `esc`, `fechaCorta`, `avisar`, `irA(vista)`, `abrirFicha(dni)`, `cargarTablero()` (versión mínima que la Tarea 11 reemplaza) y `const DEMO = {...}` con `bootstrap`, `getBandeja`, `getPaciente`, `buscar`, `marcarSeguimiento`, `descartar` y `confirmarEmparejamiento`. Contenedor `#tablero` en la vista del tablero.

- [ ] **Step 1: Escribir las pruebas de interfaz**

```js
// test/ui.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ARCHIVO = path.join(__dirname, '..', 'src', 'Index.html');

async function abrir() {
  const navegador = await chromium.launch();
  const pagina = await navegador.newPage();
  const errores = [];
  pagina.on('pageerror', e => errores.push(e.message));
  await pagina.goto('file://' + ARCHIVO, { waitUntil: 'domcontentloaded' });
  await pagina.waitForSelector('.tarjeta');
  return { navegador, pagina, errores };
}

test('la bandeja de demostración muestra 4 pacientes en el orden del diseño', async () => {
  const { navegador, pagina, errores } = await abrir();
  try {
    const nombres = await pagina.locator('.tarjeta h3').allTextContents();
    assert.deepEqual(nombres, ['LUIS ALBERTO RAMOS VEGA', 'ROSA ELENA QUISPE HUAMÁN', 'JORGE LUIS MENDOZA PAREDES', 'CARMEN SOFÍA TORRES DÍAZ']);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('sin elegir usuario no se puede marcar el seguimiento', async () => {
  const { navegador, pagina } = await abrir();
  try {
    await pagina.locator('.tarjeta button.hecho').first().click();
    await pagina.waitForSelector('#aviso:not([hidden])');
    assert.match(await pagina.locator('#aviso').textContent(), /Elija quién es usted/);
    assert.equal(await pagina.locator('.tarjeta').count(), 4);
  } finally { await navegador.close(); }
});

test('«Seguimiento hecho» quita la tarjeta y suma en el contador', async () => {
  const { navegador, pagina, errores } = await abrir();
  try {
    await pagina.selectOption('#usuario', 'MAGALY');
    await pagina.locator('.tarjeta button.hecho').first().click();
    await pagina.waitForFunction(() => document.querySelectorAll('.tarjeta').length === 3);
    assert.equal(await pagina.locator('#contador .cifra b').nth(1).textContent(), '1');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('descartar pide motivo y quita la tarjeta', async () => {
  const { navegador, pagina } = await abrir();
  try {
    await pagina.selectOption('#usuario', 'RACHEL');
    await pagina.locator('.tarjeta button.descartar').first().click();
    await pagina.waitForSelector('#dlg-descartar[open]');
    await pagina.selectOption('#dlg-motivo', 'SE ATIENDE EN OTRO LUGAR');
    await pagina.locator('#dlg-descartar button[value="ok"]').click();
    await pagina.waitForFunction(() => document.querySelectorAll('.tarjeta').length === 3);
  } finally { await navegador.close(); }
});

test('la ficha muestra la confirmación de emparejamiento y la resuelve', async () => {
  const { navegador, pagina, errores } = await abrir();
  try {
    await pagina.selectOption('#usuario', 'ANA');
    await pagina.locator('.tarjeta h3', { hasText: 'JORGE LUIS MENDOZA PAREDES' }).click();
    await pagina.waitForSelector('#ficha .confirmar');
    assert.match(await pagina.locator('#ficha').textContent(), /¿Es esta la misma persona\?/);
    await pagina.locator('#ficha [data-confirmar][data-dni="40222333"]').click();
    await pagina.waitForFunction(() => !document.querySelector('#ficha .confirmar') && document.querySelector('#ficha h2'));
    assert.match(await pagina.locator('#ficha').textContent(), /945112233/);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('el buscador encuentra por nombre y por DNI', async () => {
  const { navegador, pagina } = await abrir();
  try {
    await pagina.locator('.nav button[data-vista="ficha"]').click();
    await pagina.fill('#q', 'flores');
    await pagina.waitForSelector('#resultados [data-abrir="40555666"]');
    await pagina.fill('#q', '40333');
    await pagina.waitForSelector('#resultados [data-abrir="40333444"]');
  } finally { await navegador.close(); }
});

test('no hay colores escritos a mano fuera de la paleta', () => {
  const html = fs.readFileSync(ARCHIVO, 'utf8');
  const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
  const resto = css.replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/:root\{[^}]*\}/, '').replace(/html\[data-modo="oscuro"\]\{[^}]*\}/, '');
  assert.equal(resto.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g), null);
});
```

- [ ] **Step 2: Correr las pruebas y ver que fallan**

Run: `npm run test:ui`
Expected: FAIL. `net::ERR_FILE_NOT_FOUND` o `ENOENT` porque `src/Index.html` no existe.

- [ ] **Step 3: Crear `src/Index.html`**

```html
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Seguimientos — Centro Hematológico del Perú</title>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Barlow:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
/* ==========================================================================
   PALETA — los --chp-* son la ÚNICA fuente de color. Fuera de estos dos
   bloques no se escribe un color a mano: un #fff olvidado es un foco de luz
   en mitad del modo oscuro (lo comprueba test/ui.test.js).
   ========================================================================== */
:root{
  --chp-bg:#EFE7DE;--chp-panel:#FAF6F1;--chp-panel-alt:#FFFDFA;--chp-border:#DBCCBF;--chp-border-soft:#E7DBD0;
  --chp-text:#2A1B18;--chp-soft:#4C3A34;--chp-muted:#7C6A62;--chp-accent:#A8352C;--chp-on-accent:#FFFFFF;
  --chp-brand:#6F1713;--chp-on-brand:#FAF6F1;--chp-green:#2F6B45;--chp-green-bg:#DEE9E0;--chp-red-bg:#F6E2DF;
  --chp-amber:#B26B00;--chp-amber-bg:#F7E9CF;--chp-track:#E3D6C9;--chp-field:#FFFFFF;--chp-field-border:#C6B3A4;
  --chp-backdrop:rgba(42,27,24,.45);
  --sombra:0 1px 2px rgba(42,27,24,.05), 0 10px 30px -20px rgba(42,27,24,.45);
}
html[data-modo="oscuro"]{
  --chp-bg:#150A0A;--chp-panel:#24100F;--chp-panel-alt:#1B0C0C;--chp-border:#3A1C1C;--chp-border-soft:#33191A;
  --chp-text:#F3E7E1;--chp-soft:#C9AAA3;--chp-muted:#B99A93;--chp-accent:#E0736B;--chp-on-accent:#FFF3F0;
  --chp-brand:#6F1713;--chp-on-brand:#F3E7E1;--chp-green:#6FBF8B;--chp-green-bg:#1D3A28;--chp-red-bg:#2E1212;
  --chp-amber:#E0A96B;--chp-amber-bg:#3A2614;--chp-track:#33191A;--chp-field:#3A1D1C;--chp-field-border:#6B3533;
  --chp-backdrop:rgba(0,0,0,.6);
  --sombra:0 1px 2px rgba(0,0,0,.3), 0 10px 30px -18px rgba(0,0,0,.75);
}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{background:var(--chp-bg);color:var(--chp-text);font-family:'Barlow',system-ui,sans-serif;font-size:14px;line-height:1.45}
h1,h2,h3{font-family:'Barlow Condensed','Barlow',sans-serif;font-weight:600;margin:0;line-height:1.15}
button,input,select,textarea{font:inherit;color:inherit}
:focus-visible{outline:2px solid var(--chp-accent);outline-offset:2px}
.marco{display:grid;grid-template-columns:220px minmax(0,1fr);min-height:100vh}
.lateral{background:var(--chp-brand);color:var(--chp-on-brand);padding:22px 16px;display:flex;flex-direction:column;gap:22px;position:sticky;top:0;height:100vh}
.marca{font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:600;line-height:1.1}
.marca small{display:block;font-family:'Barlow',sans-serif;font-size:10px;letter-spacing:.1em;opacity:.75}
.nav{display:flex;flex-direction:column;gap:4px}
.nav button{background:transparent;border:0;color:inherit;text-align:left;padding:9px 12px;border-radius:10px;cursor:pointer;opacity:.85}
.nav button[aria-current="page"]{background:var(--chp-on-brand);color:var(--chp-brand);opacity:1;font-weight:600}
.lateral label{font-size:11px;letter-spacing:.08em;text-transform:uppercase;opacity:.85}
.lateral select{display:block;width:100%;margin-top:6px;padding:8px;border-radius:8px;border:1px solid var(--chp-field-border);background:var(--chp-field);color:var(--chp-text)}
.modo{margin-top:auto;background:transparent;border:1px solid var(--chp-on-brand);color:var(--chp-on-brand);border-radius:8px;padding:8px;cursor:pointer}
main{padding:24px clamp(16px,3vw,36px);min-width:0}
.vista[hidden]{display:none}
.cabecera{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;justify-content:space-between;margin-bottom:18px}
.cabecera h1{font-size:28px}
.contador{display:flex;gap:10px;flex-wrap:wrap}
.cifra{background:var(--chp-panel);border:1px solid var(--chp-border);border-radius:12px;padding:8px 14px;min-width:110px}
.cifra b{display:block;font-family:'Barlow Condensed',sans-serif;font-size:24px}
.cifra span{font-size:12px;color:var(--chp-muted)}
.filtros{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:14px}
.campo{padding:8px 10px;border-radius:8px;border:1px solid var(--chp-field-border);background:var(--chp-field);color:var(--chp-text)}
.rejilla{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
.tarjeta{background:var(--chp-panel);border:1px solid var(--chp-border);border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:8px;box-shadow:var(--sombra)}
.tarjeta h3{font-size:19px;cursor:pointer;color:var(--chp-accent)}
.dato{font-size:13px;color:var(--chp-soft)}
.etiqueta{display:inline-block;font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px;background:var(--chp-amber-bg);color:var(--chp-amber)}
.etiqueta.roja{background:var(--chp-red-bg);color:var(--chp-accent)}
.etiqueta.verde{background:var(--chp-green-bg);color:var(--chp-green)}
.tel{display:flex;gap:8px;align-items:center;font-family:ui-monospace,monospace;font-size:15px}
.acciones{display:flex;gap:8px;margin-top:auto;flex-wrap:wrap}
.btn{border:1px solid var(--chp-border);background:var(--chp-panel-alt);border-radius:10px;padding:8px 12px;cursor:pointer}
.btn.primario{background:var(--chp-accent);color:var(--chp-on-accent);border-color:var(--chp-accent);font-weight:600}
.btn.chico{padding:2px 8px;font-size:12px}
.btn:disabled{opacity:.5;cursor:wait}
.nota{width:100%;min-height:54px;resize:vertical}
.vacio{padding:40px;text-align:center;color:var(--chp-muted)}
.aviso{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:var(--chp-text);color:var(--chp-bg);padding:10px 16px;border-radius:10px;z-index:10;max-width:calc(100% - 32px)}
.aviso[hidden]{display:none}
.panel{background:var(--chp-panel);border:1px solid var(--chp-border);border-radius:16px;padding:16px;margin-bottom:16px;overflow-x:auto}
.panel h2{font-size:20px;margin-bottom:10px}
.sub{font-size:16px;margin:14px 0 6px}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--chp-border-soft);vertical-align:top}
th{color:var(--chp-muted);font-weight:600}
.num{text-align:right;font-variant-numeric:tabular-nums}
.linea{list-style:none;padding:0;margin:0;border-left:2px solid var(--chp-border)}
.linea li{padding:2px 0 10px 14px;position:relative}
.linea li::before{content:'';position:absolute;left:-6px;top:6px;width:10px;height:10px;border-radius:50%;background:var(--chp-accent)}
.linea li.esperada::before{background:var(--chp-panel);border:2px dashed var(--chp-accent)}
.barra{height:8px;border-radius:4px;background:var(--chp-track);overflow:hidden;min-width:80px;margin-top:4px}
.barra i{display:block;height:100%;background:var(--chp-accent)}
dialog{border:1px solid var(--chp-border);border-radius:16px;background:var(--chp-panel);color:var(--chp-text);max-width:420px;width:calc(100% - 32px)}
dialog::backdrop{background:var(--chp-backdrop)}
dialog form{display:flex;flex-direction:column;gap:12px}
dialog label{display:flex;flex-direction:column;gap:4px}
@media (max-width:760px){
  .marco{grid-template-columns:1fr}
  .lateral{position:static;height:auto;flex-direction:row;flex-wrap:wrap;align-items:center}
  .nav{flex-direction:row;flex-wrap:wrap}
  .modo{margin-top:0}
}
</style>
</head>
<body>
<div class="marco">
  <aside class="lateral">
    <div class="marca">Seguimientos<small>CENTRO HEMATOLÓGICO DEL PERÚ</small></div>
    <nav class="nav">
      <button type="button" data-vista="bandeja" aria-current="page">Bandeja</button>
      <button type="button" data-vista="ficha">Buscar paciente</button>
      <button type="button" data-vista="tablero">Tablero</button>
    </nav>
    <div>
      <label for="usuario">¿Quién es usted?</label>
      <select id="usuario"><option value="">— Elija —</option></select>
    </div>
    <button class="modo" id="modo" type="button">Modo oscuro</button>
  </aside>
  <main>
    <section class="vista" id="v-bandeja">
      <div class="cabecera"><h1>Bandeja del día</h1><div class="contador" id="contador"></div></div>
      <div class="filtros">
        <select id="f-esp" class="campo"><option value="">Todas las especialidades</option></select>
        <select id="f-med" class="campo"><option value="">Todos los médicos</option></select>
        <label><input type="checkbox" id="f-sintel"> Solo sin teléfono</label>
      </div>
      <div class="rejilla" id="tarjetas"></div>
    </section>
    <section class="vista" id="v-ficha" hidden>
      <div class="cabecera"><h1>Buscar paciente</h1></div>
      <div class="filtros"><input id="q" class="campo" placeholder="DNI o nombre (mínimo 3 letras)" autocomplete="off"></div>
      <div id="resultados"></div>
      <div id="ficha"></div>
    </section>
    <section class="vista" id="v-tablero" hidden>
      <div class="cabecera"><h1>Tablero de conversión</h1></div>
      <div id="tablero"></div>
    </section>
  </main>
</div>

<dialog id="dlg-descartar">
  <form method="dialog">
    <h2>Descartar paciente</h2>
    <p id="dlg-nombre" class="dato"></p>
    <label>Motivo <select id="dlg-motivo" class="campo" required><option value="">— Elija —</option></select></label>
    <label>Nota <textarea id="dlg-nota" class="campo nota"></textarea></label>
    <div class="acciones">
      <button class="btn" value="cancelar" formnovalidate>Cancelar</button>
      <button class="btn primario" value="ok">Descartar</button>
    </div>
  </form>
</dialog>
<div class="aviso" id="aviso" role="status" hidden></div>

<script>
/* ==========================================================================
   PUENTE CON APPS SCRIPT. Abierto como archivo, usa el bloque DEMO del final.
   ========================================================================== */
const EN_APPS_SCRIPT = typeof google !== 'undefined' && google.script && google.script.run;

function llamar(fn, ...args) {
  if (EN_APPS_SCRIPT) {
    return new Promise((res, rej) => google.script.run
      .withSuccessHandler(res)
      .withFailureHandler(e => rej(new Error(e.message || e)))[fn](...args));
  }
  if (!DEMO[fn]) return Promise.reject(new Error('El modo de demostración no tiene ' + fn + '.'));
  return new Promise(res => res(DEMO[fn](...args))).then(x => JSON.parse(JSON.stringify(x)));
}

const E = { boot: null, bandeja: null, fichaDni: '', kpi: null };
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();

function fechaCorta(iso) {
  if (!iso) return '—';
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

function avisar(texto) {
  const a = $('#aviso');
  a.textContent = texto;
  a.hidden = false;
  clearTimeout(avisar.t);
  avisar.t = setTimeout(() => { a.hidden = true; }, 3500);
}

function leerPref(k) { try { return localStorage.getItem('seg.' + k) || ''; } catch (e) { return ''; } }
function guardarPref(k, v) { try { localStorage.setItem('seg.' + k, v); } catch (e) { /* sin almacenamiento: no pasa nada */ } }

function llenarSelect(sel, lista) {
  lista.forEach(v => { const o = document.createElement('option'); o.value = v; o.textContent = v; sel.appendChild(o); });
}

function usuario() { return $('#usuario').value; }

function exigirUsuario() {
  if (usuario()) return true;
  avisar('Elija quién es usted en el selector de la izquierda.');
  $('#usuario').focus();
  return false;
}

function ponerModo(m) {
  document.documentElement.dataset.modo = m;
  $('#modo').textContent = m === 'oscuro' ? 'Modo claro' : 'Modo oscuro';
  guardarPref('modo', m);
}

function irA(vista) {
  document.querySelectorAll('.nav button').forEach(b =>
    b.dataset.vista === vista ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  document.querySelectorAll('.vista').forEach(s => { s.hidden = s.id !== 'v-' + vista; });
  if (vista === 'tablero') cargarTablero();
}

/* ==========================================================================
   BANDEJA
   ========================================================================== */
async function cargarBandeja() {
  $('#tarjetas').innerHTML = '<div class="vacio">Cargando…</div>';
  try {
    E.bandeja = await llamar('getBandeja');
    pintarBandeja();
  } catch (e) {
    $('#tarjetas').innerHTML = `<div class="vacio">No se pudo cargar la bandeja: ${esc(e.message)}</div>`;
  }
}

function pintarBandeja() {
  if (!E.bandeja) return;
  const c = E.bandeja.contador;
  $('#contador').innerHTML = [['Por atender', c.porAtender], ['Seguimientos hoy', c.hechosHoy], ['Recuperados este mes', c.recuperadosMes]]
    .map(([t, n]) => `<div class="cifra"><b>${n}</b><span>${t}</span></div>`).join('');
  const fe = $('#f-esp').value, fm = $('#f-med').value, sinTel = $('#f-sintel').checked;
  const lista = E.bandeja.tarjetas.filter(t =>
    (!fe || t.ESPECIALIDAD === fe) && (!fm || t.MEDICO_ULTIMO === fm) && (!sinTel || !t.TELEFONOS));
  $('#tarjetas').innerHTML = lista.length
    ? lista.map(tarjetaHtml).join('')
    : '<div class="vacio">No hay pacientes por atender con estos filtros.</div>';
}

function tarjetaHtml(t) {
  const tels = String(t.TELEFONOS || '').split(' / ').filter(Boolean);
  return `<article class="tarjeta" data-dni="${esc(t.DNI)}" data-esp="${esc(t.ESPECIALIDAD)}">
    <h3 data-abrir="${esc(t.DNI)}">${esc(t.NOMBRE)}</h3>
    <div class="dato">DNI ${esc(t.DNI)} · ${esc(t.ESPECIALIDAD)} · ${esc(t.MEDICO_ULTIMO)}</div>
    <div>${tels.length
      ? tels.map(n => `<div class="tel">${esc(n)} <button type="button" class="btn chico" data-copiar="${esc(n)}">Copiar</button></div>`).join('')
      : '<span class="etiqueta roja">Sin teléfono</span>'}</div>
    <div class="dato">Última cita ${fechaCorta(t.ULTIMA_CITA)} · <b>${t.DIAS_ATRASO} días de atraso</b></div>
    ${t.PENDIENTE ? `<div><span class="etiqueta">${esc(t.PENDIENTE)}</span></div>` : ''}
    ${t.N_SEGUIMIENTOS ? `<div class="dato">Intento ${t.N_SEGUIMIENTOS + 1} · último seguimiento ${fechaCorta(t.ULTIMO_SEGUIMIENTO)}</div>` : ''}
    <textarea class="campo nota" placeholder="Nota (opcional)"></textarea>
    <div class="acciones">
      <button type="button" class="btn primario hecho">Seguimiento hecho</button>
      <button type="button" class="btn descartar">Descartar</button>
    </div>
  </article>`;
}

function quitarTarjeta(t, hecho) {
  E.bandeja.tarjetas = E.bandeja.tarjetas.filter(x => x !== t);
  E.bandeja.contador.porAtender--;
  if (hecho) E.bandeja.contador.hechosHoy++;
  E.kpi = null;
  pintarBandeja();
}

function copiar(numero) {
  const hecho = () => avisar('Copiado: ' + numero);
  if (navigator.clipboard) navigator.clipboard.writeText(numero).then(hecho, () => avisar(numero));
  else avisar(numero);
}

$('#tarjetas').addEventListener('click', async ev => {
  const b = ev.target.closest('button, [data-abrir]');
  if (!b) return;
  if (b.dataset.copiar) { copiar(b.dataset.copiar); return; }
  if (b.dataset.abrir) { abrirFicha(b.dataset.abrir); return; }
  const card = b.closest('.tarjeta');
  const t = E.bandeja.tarjetas.find(x => x.DNI === card.dataset.dni && x.ESPECIALIDAD === card.dataset.esp);
  if (!t || !exigirUsuario()) return;
  if (b.classList.contains('hecho')) {
    b.disabled = true;
    try {
      await llamar('marcarSeguimiento', { usuario: usuario(), dni: t.DNI, especialidad: t.ESPECIALIDAD, nota: card.querySelector('textarea').value });
      quitarTarjeta(t, true);
      avisar('Seguimiento registrado: ' + t.NOMBRE);
    } catch (e) {
      b.disabled = false;
      avisar(e.message);
    }
  }
  if (b.classList.contains('descartar')) abrirDescarte(t);
});

let aDescartar = null;
function abrirDescarte(t) {
  aDescartar = t;
  $('#dlg-nombre').textContent = t.NOMBRE + ' · ' + t.ESPECIALIDAD;
  $('#dlg-motivo').value = '';
  $('#dlg-nota').value = '';
  $('#dlg-descartar').showModal();
}

$('#dlg-descartar').addEventListener('close', async () => {
  const t = aDescartar;
  aDescartar = null;
  if ($('#dlg-descartar').returnValue !== 'ok' || !t) return;
  try {
    await llamar('descartar', { usuario: usuario(), dni: t.DNI, especialidad: t.ESPECIALIDAD, motivo: $('#dlg-motivo').value, nota: $('#dlg-nota').value });
    quitarTarjeta(t, false);
    avisar('Descartado: ' + t.NOMBRE);
  } catch (e) {
    avisar(e.message);
  }
});

/* ==========================================================================
   BUSCADOR Y FICHA
   ========================================================================== */
let esperaBusqueda;
$('#q').addEventListener('input', () => { clearTimeout(esperaBusqueda); esperaBusqueda = setTimeout(buscarAhora, 300); });

async function buscarAhora() {
  const q = $('#q').value.trim();
  if (q.length < 3) { $('#resultados').innerHTML = ''; return; }
  let r = [];
  try { r = await llamar('buscar', q); } catch (e) { avisar(e.message); }
  $('#resultados').innerHTML = r.length
    ? '<div class="filtros">' + r.map(p => `<button type="button" class="btn" data-abrir="${esc(p.DNI)}">${esc(p.NOMBRE)} · ${esc(p.DNI)}</button>`).join('') + '</div>'
    : '<p class="dato">Sin resultados.</p>';
}

$('#resultados').addEventListener('click', ev => {
  const b = ev.target.closest('[data-abrir]');
  if (b) abrirFicha(b.dataset.abrir);
});

async function abrirFicha(dni) {
  irA('ficha');
  E.fichaDni = dni;
  $('#ficha').innerHTML = '<div class="vacio">Cargando…</div>';
  try {
    pintarFicha(await llamar('getPaciente', dni));
  } catch (e) {
    $('#ficha').innerHTML = `<div class="vacio">${esc(e.message)}</div>`;
  }
}

const COLOR_ESTADO = { 'VENCIDO': 'roja', 'DESCARTADO': 'roja', 'ANTIGUO': 'roja', 'AL DÍA': 'verde', 'RECUPERADO': 'verde', 'AGENDADO': 'verde' };

function lineaDeTiempo(citas) {
  let n = 0;
  return citas.map(c => {
    const realizada = norm(c.ESTADO) === 'REALIZADO';
    const titulo = realizada ? (n++ === 0 ? 'Primera cita' : 'Reevaluación ' + (n - 1)) : esc(c.ESTADO);
    return `<li><b>${titulo}</b> · ${fechaCorta(c.FECHA)} · ${esc(c.MEDICO)}${c.MODALIDAD ? ' · ' + esc(c.MODALIDAD) : ''}</li>`;
  }).join('');
}

function pintarFicha(p) {
  const confirmar = p.porConfirmar.map(i => `<div class="panel confirmar">
      <h2>¿Es esta la misma persona?</h2>
      <p class="dato">${esc(i.TIPO)} del ${fechaCorta(i.FECHA)} a nombre de <b>${esc(i.NOMBRE)}</b> · teléfono ${esc(i.TELEFONO)}</p>
      <div class="acciones">${i.candidatos.map(c => `<button type="button" class="btn${c.dni === p.dni ? ' primario' : ''}" data-confirmar="${esc(i.ID)}" data-dni="${esc(c.dni)}">${esc(c.nombre)} · ${esc(c.dni)}</button>`).join('')}</div>
    </div>`).join('');

  const series = p.series.map(s => {
    const citas = p.citas.filter(c => norm(c.ESPECIALIDAD) === norm(s.ESPECIALIDAD));
    return `<div class="panel">
      <h2>${esc(s.ESPECIALIDAD)} <span class="etiqueta ${COLOR_ESTADO[s.ESTADO] || ''}">${esc(s.ESTADO)}</span></h2>
      <p class="dato">Teléfonos: ${esc(s.TELEFONOS) || '—'}${s.PENDIENTE ? ' · Pendiente: ' + esc(s.PENDIENTE) : ''}</p>
      <ul class="linea">${lineaDeTiempo(citas)}
        <li class="esperada">Reevaluación esperada ${fechaCorta(s.PROXIMA_ESPERADA)} · vence ${fechaCorta(s.VENCE)}</li>
      </ul>
    </div>`;
  }).join('');

  const indicaciones = p.indicaciones.length
    ? `<table><tr><th>Fecha</th><th>Tipo</th><th>Detalle</th><th>Estado</th><th>Teléfono</th><th>Observaciones</th></tr>${p.indicaciones.map(i =>
        `<tr><td>${fechaCorta(i.FECHA)}</td><td>${esc(i.TIPO)}</td><td>${esc(i.DETALLE)}${Number(i.CANTIDAD) > 1 ? ' ×' + esc(i.CANTIDAD) : ''}</td><td>${esc(i.ESTADO)}</td><td>${esc(i.TELEFONO)}</td><td>${esc(i.OBSERVACIONES)}</td></tr>`).join('')}</table>`
    : '<p class="dato">Sin indicaciones registradas.</p>';

  const seguimientos = p.seguimientos.length
    ? `<table><tr><th>Fecha</th><th>Responsable</th><th>Acción</th><th>Especialidad</th><th>Motivo</th><th>Nota</th></tr>${p.seguimientos.map(s =>
        `<tr><td>${esc(s.FECHA_HORA)}</td><td>${esc(s.RESPONSABLE)}</td><td>${esc(s.ACCION)}</td><td>${esc(s.ESPECIALIDAD)}</td><td>${esc(s.MOTIVO)}</td><td>${esc(s.NOTA)}</td></tr>`).join('')}</table>`
    : '<p class="dato">Todavía no hay seguimientos.</p>';

  $('#ficha').innerHTML = `<div class="cabecera"><h1>${esc(p.nombre)}</h1><span class="dato">DNI ${esc(p.dni)}</span></div>
    ${confirmar}${series}
    <div class="panel"><h2>Indicaciones</h2>${indicaciones}</div>
    <div class="panel"><h2>Seguimientos</h2>${seguimientos}</div>`;
}

$('#ficha').addEventListener('click', async ev => {
  const b = ev.target.closest('[data-confirmar]');
  if (!b || !exigirUsuario()) return;
  b.disabled = true;
  try {
    await llamar('confirmarEmparejamiento', { usuario: usuario(), id: b.dataset.confirmar, dni: b.dataset.dni });
    avisar('Emparejamiento confirmado.');
    E.bandeja = null;
    abrirFicha(E.fichaDni);
    cargarBandeja();
  } catch (e) {
    b.disabled = false;
    avisar(e.message);
  }
});

/* ==========================================================================
   TABLERO — la Tarea 11 reemplaza esta función entera.
   ========================================================================== */
function cargarTablero() {
  $('#tablero').innerHTML = '<div class="vacio">Tablero en construcción.</div>';
}

/* ==========================================================================
   ARRANQUE
   ========================================================================== */
async function iniciar() {
  ponerModo(leerPref('modo') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro'));
  $('#modo').addEventListener('click', () => ponerModo(document.documentElement.dataset.modo === 'oscuro' ? 'claro' : 'oscuro'));
  document.querySelectorAll('.nav button').forEach(b => b.addEventListener('click', () => irA(b.dataset.vista)));
  ['#f-esp', '#f-med', '#f-sintel'].forEach(s => $(s).addEventListener('change', pintarBandeja));
  $('#usuario').addEventListener('change', () => guardarPref('usuario', usuario()));
  try {
    E.boot = await llamar('bootstrap');
  } catch (e) {
    $('#tarjetas').innerHTML = `<div class="vacio">No se pudo iniciar: ${esc(e.message)}</div>`;
    return;
  }
  llenarSelect($('#usuario'), E.boot.usuarios);
  llenarSelect($('#f-esp'), E.boot.especialidades);
  llenarSelect($('#f-med'), E.boot.medicos);
  llenarSelect($('#dlg-motivo'), E.boot.motivos);
  const recordado = leerPref('usuario');
  if (E.boot.usuarios.includes(recordado)) $('#usuario').value = recordado;
  cargarBandeja();
}

/* ==========================================================================
   DEMO — datos INVENTADOS para abrir este archivo en el navegador sin
   desplegar. No lo elimine: es como se prueba la interfaz (npm run test:ui).
   ========================================================================== */
const DEMO = (() => {
  const hoy = '2026-10-01';
  const usuarios = ['MAGALY', 'ANA', 'RACHEL', 'DR. ELI CABANILLAS'];
  const motivos = ['SE ATIENDE EN OTRO LUGAR', 'NÚMERO EQUIVOCADO', 'YA NO LO NECESITA', 'FALLECIÓ', 'OTRO'];
  const ELI = 'Dr. ELÍ FABRIZIO CABANILLAS HUALPA', KAREN = 'Dra. KAREN DIANA MATOS PEÑA';
  function mas(iso, n) { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  const p = (DNI, ESPECIALIDAD, NOMBRE, TELEFONOS, MEDICO_ULTIMO, PRIMERA_CITA, ULTIMA_CITA, N_REALIZADAS, ESTADO, DIAS_ATRASO, N_SEGUIMIENTOS, ULTIMO_SEGUIMIENTO, PENDIENTE) =>
    ({ DNI, ESPECIALIDAD, NOMBRE, TELEFONOS, MEDICO_ULTIMO, PRIMERA_CITA, ULTIMA_CITA, N_REALIZADAS,
       PROXIMA_ESPERADA: mas(ULTIMA_CITA, 30), VENCE: mas(ULTIMA_CITA, 45), DIAS_ATRASO, PROXIMA_AGENDADA: '',
       ESTADO, N_SEGUIMIENTOS, ULTIMO_SEGUIMIENTO, PENDIENTE });
  const pacientes = [
    p('40111222', 'HEMATOLOGÍA', 'ROSA ELENA QUISPE HUAMÁN', '987654321', ELI, '2026-06-10', '2026-08-05', 2, 'VENCIDO', 12, 0, '', 'Hierro ×2 cotizado'),
    p('40222333', 'HEMATOLOGÍA', 'JORGE LUIS MENDOZA PAREDES', '', KAREN, '2026-07-18', '2026-07-18', 1, 'VENCIDO', 30, 0, '', ''),
    p('40333444', 'REUMATOLOGÍA', 'CARMEN SOFÍA TORRES DÍAZ', '912345678 / 998877665', 'Dr. JUVENAL HANAMPA ROQUE', '2026-05-02', '2026-06-23', 2, 'VENCIDO', 55, 1, '2026-09-10', ''),
    p('40444555', 'HEMATOLOGÍA', 'LUIS ALBERTO RAMOS VEGA', '923456789', 'Dra. ALEJANDRA LA TORRE MATUK', '2026-08-12', '2026-08-12', 1, 'VENCIDO', 5, 0, '', 'AMO + BIOPSIA cotizado'),
    p('40555666', 'HEMATOLOGÍA', 'ANA MARÍA FLORES RÍOS', '934567890', ELI, '2026-08-20', '2026-09-20', 2, 'AL DÍA', 0, 0, '', '')
  ];
  const indicaciones = [
    { ID: 'IND-0001', FECHA: '2026-08-05', TIPO: 'HIERRO', DETALLE: 'HIERRO', CANTIDAD: 2, ESTADO: 'COTIZÓ', TELEFONO: '987654321', OBSERVACIONES: 'VA A COORDINAR', DNI: '40111222' },
    { ID: 'IND-0002', FECHA: '2026-08-12', TIPO: 'PROCEDIMIENTO', DETALLE: 'AMO + BIOPSIA', CANTIDAD: '', ESTADO: 'COTIZÓ', TELEFONO: '923456789', OBSERVACIONES: '', DNI: '40444555' }
  ];
  let porConfirmar = [{ ID: 'IND-0003', FECHA: '2026-07-20', TIPO: 'HIERRO', DETALLE: 'HIERRO', NOMBRE: 'JORGE MENDOZA', TELEFONO: '945112233',
    candidatos: [{ dni: '40222333', nombre: 'JORGE LUIS MENDOZA PAREDES' }, { dni: '40999888', nombre: 'JORGE MENDOZA SALAS' }] }];
  const seguimientos = [{ ID: 'SEG-1', FECHA_HORA: '2026-09-10 11:20', DNI: '40333444', ESPECIALIDAD: 'REUMATOLOGÍA', RESPONSABLE: 'RACHEL', ACCION: 'HECHO', MOTIVO: '', NOTA: 'Dijo que llamará' }];

  function exigir(x, conMotivo) {
    if (!x || !usuarios.includes(x.usuario)) throw new Error('Elija quién es usted en el selector de arriba.');
    if (conMotivo && !motivos.includes(x.motivo)) throw new Error('Elija un motivo de descarte.');
  }
  function registrar(x, accion) {
    exigir(x, accion === 'DESCARTADO');
    seguimientos.push({ ID: 'SEG-' + (seguimientos.length + 1), FECHA_HORA: hoy + ' 10:00', DNI: x.dni, ESPECIALIDAD: x.especialidad,
      RESPONSABLE: x.usuario, ACCION: accion, MOTIVO: x.motivo || '', NOTA: x.nota || '' });
    const pac = pacientes.find(q => q.DNI === x.dni && q.ESPECIALIDAD === x.especialidad);
    if (pac) pac.ESTADO = accion === 'HECHO' ? 'CONTACTADO' : 'DESCARTADO';
    return { ok: true };
  }
  return {
    bootstrap: () => ({
      hoy, usuarios, motivos,
      especialidades: [...new Set(pacientes.map(x => x.ESPECIALIDAD))].sort(),
      medicos: [...new Set(pacientes.map(x => x.MEDICO_ULTIMO))].sort()
    }),
    getBandeja: () => {
      const tarjetas = pacientes.filter(x => x.ESTADO === 'VENCIDO').sort((a, b) =>
        (a.N_SEGUIMIENTOS - b.N_SEGUIMIENTOS) || ((a.PENDIENTE ? 0 : 1) - (b.PENDIENTE ? 0 : 1)) || (a.DIAS_ATRASO - b.DIAS_ATRASO));
      return { tarjetas, contador: { porAtender: tarjetas.length,
        hechosHoy: seguimientos.filter(s => s.FECHA_HORA.startsWith(hoy) && s.ACCION === 'HECHO').length, recuperadosMes: 3 } };
    },
    getPaciente: dni => {
      const series = pacientes.filter(x => x.DNI === dni);
      const citas = series.flatMap(s => {
        const c = [{ FECHA: s.PRIMERA_CITA, ESTADO: 'REALIZADO', ESPECIALIDAD: s.ESPECIALIDAD, MEDICO: s.MEDICO_ULTIMO, MODALIDAD: 'CLÍNICA' }];
        if (s.N_REALIZADAS > 1) c.push({ FECHA: s.ULTIMA_CITA, ESTADO: 'REALIZADO', ESPECIALIDAD: s.ESPECIALIDAD, MEDICO: s.MEDICO_ULTIMO, MODALIDAD: 'VIRTUAL' });
        return c;
      });
      return { dni, nombre: series.length ? series[0].NOMBRE : '', series, citas,
        indicaciones: indicaciones.filter(i => i.DNI === dni),
        porConfirmar: porConfirmar.filter(i => i.candidatos.some(c => c.dni === dni)),
        seguimientos: seguimientos.filter(s => s.DNI === dni) };
    },
    buscar: q => {
      const n = norm(q), d = q.trim();
      return pacientes.filter((x, i, a) => a.findIndex(y => y.DNI === x.DNI) === i)
        .filter(x => (/\d/.test(d) && x.DNI.startsWith(d)) || norm(x.NOMBRE).includes(n))
        .map(x => ({ DNI: x.DNI, NOMBRE: x.NOMBRE }));
    },
    marcarSeguimiento: x => registrar(x, 'HECHO'),
    descartar: x => registrar(x, 'DESCARTADO'),
    confirmarEmparejamiento: x => {
      exigir(x, false);
      const i = porConfirmar.find(y => y.ID === x.id);
      if (!i) throw new Error('No encontré la indicación ' + x.id + '.');
      porConfirmar = porConfirmar.filter(y => y !== i);
      indicaciones.push({ ID: i.ID, FECHA: i.FECHA, TIPO: i.TIPO, DETALLE: i.DETALLE, CANTIDAD: 1, ESTADO: 'COTIZÓ', TELEFONO: i.TELEFONO, OBSERVACIONES: '', DNI: x.dni });
      const pac = pacientes.find(q => q.DNI === x.dni);
      if (pac && !pac.TELEFONOS) pac.TELEFONOS = i.TELEFONO;
      return { ok: true };
    }
  };
})();

iniciar();
</script>
</body>
</html>
```

- [ ] **Step 4: Correr las pruebas de interfaz**

Run: `npm run test:ui`
Expected: PASS, 7 pruebas. Si Playwright no encuentra el navegador, comprobar que `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` está definido. Si no lo está, ejecutar `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npm run test:ui`.

- [ ] **Step 5: Revisar a ojo los dos modos**

Run:
```bash
node -e "
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 860 } });
  await p.goto('file://' + process.cwd() + '/src/Index.html'); await p.waitForSelector('.tarjeta');
  await p.screenshot({ path: '/tmp/bandeja-claro.png' });
  await p.click('#modo'); await p.screenshot({ path: '/tmp/bandeja-oscuro.png' });
  await p.setViewportSize({ width: 390, height: 800 }); await p.screenshot({ path: '/tmp/bandeja-movil.png', fullPage: true });
  await b.close();
})();"
```
Expected: tres capturas sin texto ilegible, sin manchas claras en el modo oscuro y sin desbordamiento horizontal en móvil.

- [ ] **Step 6: Commit**

```bash
git add src/Index.html test/ui.test.js
git commit -m "App: bandeja del día, ficha del paciente y modo de demostración"
```

---

### Task 11: La app — tablero de conversión

**Files:**
- Modify: `src/Index.html`. Se reemplaza la función `cargarTablero` y se añade `getKpi` al `DEMO`.
- Modify: `test/ui.test.js` (se añade una prueba)

**Interfaces:**
- Consumes: `getKpi() → { cohortes, indicaciones, recuperacion, motivos, sinCandidato }` (Tarea 7 y Tarea 8); `E`, `$`, `esc`, `fechaCorta`, `llamar` (Tarea 10).
- Produces: `cargarTablero()`, `pintarTablero()` y filtros `#t-mes`, `#t-esp` y `#t-med`.

- [ ] **Step 1: Añadir la prueba a `test/ui.test.js`**

```js
test('el tablero pinta sus cinco secciones y filtra sin errores', async () => {
  const { navegador, pagina, errores } = await abrir();
  try {
    await pagina.locator('.nav button[data-vista="tablero"]').click();
    await pagina.waitForSelector('#tablero table');
    const texto = await pagina.locator('#tablero').textContent();
    for (const t of ['Retorno por cohorte', 'Indicaciones', 'Recuperación', 'Motivos de descarte', 'Indicaciones sin paciente']) {
      assert.ok(texto.includes(t), t);
    }
    assert.ok(texto.includes('38%'), 'cohorte 2026-06, reevaluación 1: 15/40');
    await pagina.selectOption('#t-esp', 'REUMATOLOGÍA');
    await pagina.waitForFunction(() => document.querySelector('#t-esp').value === 'REUMATOLOGÍA');
    assert.ok((await pagina.locator('#tablero').textContent()).includes('33%'), 'reumatología: 2/6');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});
```

- [ ] **Step 2: Correr la prueba y ver que falla**

Run: `npm run test:ui`
Expected: FAIL en la prueba nueva, porque el tablero muestra «Tablero en construcción.» y no tiene tablas.

- [ ] **Step 3: Reemplazar el bloque TABLERO de `src/Index.html`**

Reemplace desde el comentario `TABLERO — la Tarea 11 reemplaza esta función entera.` hasta la llave de cierre de `cargarTablero` por:

```js
/* ==========================================================================
   TABLERO
   ========================================================================== */
async function cargarTablero() {
  if (E.kpi) { pintarTablero(); return; }
  $('#tablero').innerHTML = '<div class="vacio">Calculando…</div>';
  try {
    E.kpi = await llamar('getKpi');
    pintarTablero();
  } catch (e) {
    $('#tablero').innerHTML = `<div class="vacio">No se pudo calcular el tablero: ${esc(e.message)}</div>`;
  }
}

const pct = (a, b) => b ? Math.round(100 * a / b) + '%' : '—';
const barra = (a, b) => `<div class="barra"><i style="width:${b ? Math.round(100 * a / b) : 0}%"></i></div>`;

function mediana(lista) {
  if (!lista.length) return '—';
  const s = [...lista].sort((x, y) => x - y), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

/** cab: [{t, num}]; filas: arrays de HTML ya escapado. */
function tabla(cab, filas) {
  if (!filas.length) return '<p class="dato">Sin datos con estos filtros.</p>';
  const td = (v, i) => `<td${cab[i].num ? ' class="num"' : ''}>${v}</td>`;
  return `<table><tr>${cab.map(c => `<th${c.num ? ' class="num"' : ''}>${esc(c.t)}</th>`).join('')}</tr>` +
    filas.map(f => `<tr>${f.map(td).join('')}</tr>`).join('') + '</table>';
}

function agrupar(filas, clave, nuevo, sumar) {
  const m = new Map();
  filas.forEach(f => { const k = clave(f); if (!m.has(k)) m.set(k, nuevo()); sumar(m.get(k), f); });
  return [...m.entries()].sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
}

function opciones(id, etiqueta, valores, actual) {
  return `<select id="${id}" class="campo"><option value="">${esc(etiqueta)}</option>` +
    valores.map(v => `<option value="${esc(v)}"${v === actual ? ' selected' : ''}>${esc(v)}</option>`).join('') + '</select>';
}

function pintarTablero() {
  const k = E.kpi;
  const valor = id => ($(id) ? $(id).value : '');
  const fMes = valor('#t-mes'), fEsp = valor('#t-esp'), fMed = valor('#t-med');
  const unicos = a => [...new Set(a.filter(Boolean))].sort();
  const meses = unicos(k.cohortes.map(r => r.COHORTE).concat(k.indicaciones.map(r => r.MES), k.recuperacion.map(r => r.MES)));
  const esps = unicos(k.cohortes.map(r => r.ESPECIALIDAD).concat(k.recuperacion.map(r => r.ESPECIALIDAD)));
  const meds = unicos(k.cohortes.map(r => r.MEDICO).concat(k.indicaciones.map(r => r.MEDICO), k.recuperacion.map(r => r.MEDICO)));
  const okMes = m => !fMes || m === fMes, okEsp = e => !fEsp || e === fEsp, okMed = m => !fMed || m === fMed;
  const T = t => ({ t }), N = t => ({ t, num: true });

  const coh = agrupar(k.cohortes.filter(r => okMes(r.COHORTE) && okEsp(r.ESPECIALIDAD) && okMed(r.MEDICO)),
    r => r.COHORTE, () => ({ 1: [0, 0], 2: [0, 0], 3: [0, 0] }),
    (o, r) => { o[r.ETAPA][0] += Number(r.VOLVIERON); o[r.ETAPA][1] += Number(r.ELEGIBLES); });
  const filasCoh = coh.map(([c, o]) => [esc(c)].concat([1, 2, 3].map(e =>
    `${pct(o[e][0], o[e][1])} <span class="dato">(${o[e][0]}/${o[e][1]})</span>${barra(o[e][0], o[e][1])}`)));

  const ind = k.indicaciones.filter(r => okMes(r.MES) && okMed(r.MEDICO));
  const sumaInd = (o, r) => { o.n += Number(r.INDICADAS); o.a += Number(r.ACEPTADAS); };
  const filaInd = ([c, o]) => [esc(c), o.n, o.a, pct(o.a, o.n) + barra(o.a, o.n)];
  const indTipo = agrupar(ind, r => r.TIPO === 'HIERRO' ? 'Hierro' : r.DETALLE, () => ({ n: 0, a: 0 }), sumaInd).map(filaInd);
  const indMed = agrupar(ind, r => r.MEDICO, () => ({ n: 0, a: 0 }), sumaInd).map(filaInd);

  const rec = k.recuperacion.filter(r => okMes(r.MES) && okEsp(r.ESPECIALIDAD) && okMed(r.MEDICO));
  const sumaRec = (o, r) => { o.n++; if (Number(r.VOLVIO)) { o.v++; o.d.push(Number(r.DIAS)); } };
  const filaRec = ([c, o]) => [esc(c), o.n, o.v, pct(o.v, o.n) + barra(o.v, o.n), mediana(o.d)];
  const recResp = agrupar(rec, r => r.RESPONSABLE, () => ({ n: 0, v: 0, d: [] }), sumaRec).map(filaRec);
  const recMes = agrupar(rec, r => r.MES, () => ({ n: 0, v: 0, d: [] }), sumaRec).map(filaRec);

  $('#tablero').innerHTML = `
    <div class="filtros">${opciones('t-mes', 'Todos los meses', meses, fMes)}${opciones('t-esp', 'Todas las especialidades', esps, fEsp)}${opciones('t-med', 'Todos los médicos', meds, fMed)}</div>
    <div class="panel"><h2>Retorno por cohorte</h2>
      <p class="dato">Mes de la primera cita. Solo cuentan los pacientes a quienes ya les tocaba volver.</p>
      ${tabla([T('Cohorte'), N('Reevaluación 1'), N('Reevaluación 2'), N('Reevaluación 3')], filasCoh)}</div>
    <div class="panel"><h2>Indicaciones</h2>
      <p class="dato">De lo indicado, cuánto se aceptó. Las indicaciones no tienen especialidad: ese filtro no las cambia.</p>
      ${tabla([T('Tipo'), N('Indicadas'), N('Aceptadas'), N('Tasa')], indTipo)}
      <h3 class="sub">Por médico</h3>
      ${tabla([T('Médico'), N('Indicadas'), N('Aceptadas'), N('Tasa')], indMed)}</div>
    <div class="panel"><h2>Recuperación</h2>
      <p class="dato">De los seguimientos hechos, cuántos pacientes volvieron y en cuántos días (mediana).</p>
      ${tabla([T('Responsable'), N('Seguimientos'), N('Volvieron'), N('Tasa'), N('Días')], recResp)}
      <h3 class="sub">Por mes</h3>
      ${tabla([T('Mes'), N('Seguimientos'), N('Volvieron'), N('Tasa'), N('Días')], recMes)}</div>
    <div class="panel"><h2>Motivos de descarte</h2>
      ${tabla([T('Motivo'), N('Pacientes')], k.motivos.map(m => [esc(m.MOTIVO), m.N]))}</div>
    <div class="panel"><h2>Indicaciones sin paciente</h2>
      <p class="dato">No se encontró a nadie con ese nombre en SOFDOC. Revíselas a mano en la pestaña INDICACIONES.</p>
      ${tabla([T('ID'), T('Fecha'), T('Tipo'), T('Nombre'), T('Teléfono')],
        k.sinCandidato.map(i => [esc(i.ID), fechaCorta(i.FECHA), esc(i.TIPO), esc(i.NOMBRE), esc(i.TELEFONO)]))}</div>`;
  ['#t-mes', '#t-esp', '#t-med'].forEach(s => $(s).addEventListener('change', pintarTablero));
}
```

- [ ] **Step 4: Añadir `getKpi` al `DEMO`**

En el objeto que devuelve `DEMO`, justo antes de la línea `marcarSeguimiento: x => registrar(x, 'HECHO'),`, añada:

```js
    getKpi: () => ({
      cohortes: [
        { COHORTE: '2026-06', ESPECIALIDAD: 'HEMATOLOGÍA', MEDICO: ELI, ETAPA: 1, ELEGIBLES: 40, VOLVIERON: 15 },
        { COHORTE: '2026-06', ESPECIALIDAD: 'HEMATOLOGÍA', MEDICO: ELI, ETAPA: 2, ELEGIBLES: 15, VOLVIERON: 8 },
        { COHORTE: '2026-06', ESPECIALIDAD: 'HEMATOLOGÍA', MEDICO: ELI, ETAPA: 3, ELEGIBLES: 8, VOLVIERON: 5 },
        { COHORTE: '2026-07', ESPECIALIDAD: 'HEMATOLOGÍA', MEDICO: KAREN, ETAPA: 1, ELEGIBLES: 52, VOLVIERON: 17 },
        { COHORTE: '2026-07', ESPECIALIDAD: 'HEMATOLOGÍA', MEDICO: KAREN, ETAPA: 2, ELEGIBLES: 17, VOLVIERON: 9 },
        { COHORTE: '2026-07', ESPECIALIDAD: 'REUMATOLOGÍA', MEDICO: 'Dr. JUVENAL HANAMPA ROQUE', ETAPA: 1, ELEGIBLES: 6, VOLVIERON: 2 },
        { COHORTE: '2026-08', ESPECIALIDAD: 'HEMATOLOGÍA', MEDICO: ELI, ETAPA: 1, ELEGIBLES: 48, VOLVIERON: 12 }
      ],
      indicaciones: [
        { MES: '2026-08', TIPO: 'HIERRO', DETALLE: 'HIERRO', MEDICO: ELI, INDICADAS: 30, ACEPTADAS: 14 },
        { MES: '2026-08', TIPO: 'PROCEDIMIENTO', DETALLE: 'AMO + BIOPSIA', MEDICO: KAREN, INDICADAS: 9, ACEPTADAS: 1 },
        { MES: '2026-09', TIPO: 'HIERRO', DETALLE: 'HIERRO', MEDICO: KAREN, INDICADAS: 25, ACEPTADAS: 13 }
      ],
      recuperacion: [
        { MES: '2026-09', RESPONSABLE: 'MAGALY', ESPECIALIDAD: 'HEMATOLOGÍA', MEDICO: ELI, VOLVIO: 1, DIAS: 6 },
        { MES: '2026-09', RESPONSABLE: 'MAGALY', ESPECIALIDAD: 'HEMATOLOGÍA', MEDICO: KAREN, VOLVIO: 0, DIAS: '' },
        { MES: '2026-09', RESPONSABLE: 'RACHEL', ESPECIALIDAD: 'REUMATOLOGÍA', MEDICO: 'Dr. JUVENAL HANAMPA ROQUE', VOLVIO: 1, DIAS: 12 },
        { MES: '2026-09', RESPONSABLE: 'DR. ELI CABANILLAS', ESPECIALIDAD: 'HEMATOLOGÍA', MEDICO: ELI, VOLVIO: 1, DIAS: 9 }
      ],
      motivos: [{ MOTIVO: 'SE ATIENDE EN OTRO LUGAR', N: 4 }, { MOTIVO: 'NÚMERO EQUIVOCADO', N: 2 }],
      sinCandidato: [{ ID: 'IND-0120', FECHA: '2026-05-04', TIPO: 'HIERRO', NOMBRE: 'PAOLA RIVERA', TELEFONO: '956789012' }]
    }),
```

- [ ] **Step 5: Correr las pruebas de interfaz**

Run: `npm run test:ui`
Expected: PASS, 8 pruebas.

- [ ] **Step 6: Commit**

```bash
git add src/Index.html test/ui.test.js
git commit -m "App: tablero de conversión por cohorte, indicaciones, recuperación y motivos"
```

---

### Task 12: Primer despliegue (con el usuario, desde su computadora)

Esta tarea **no la puede hacer un agente en la nube**: `clasp login` necesita a la persona dueña de la cuenta `admcuidartec@gmail.com` frente al navegador. El agente prepara las instrucciones, acompaña paso a paso y, al final, deja los ID en el repositorio.

**Files:**
- Create: `.clasp.json` (lo genera `clasp create`)
- Modify: `package.json` (script `actualizar`), `CLAUDE.md` (sección «Publicar»)

- [ ] **Step 1: Verificación completa antes de subir**

Run: `npm test && npm run test:ui`
Expected: PASS, todas.

- [ ] **Step 2: Crear el proyecto de Apps Script incrustado en el libro madre (usuario)**

```bash
git pull
npm install
npx clasp login
npx clasp create --title "Seguimientos CHP" --parentId 1L8fY-NXWE1agakIPEdqoLnLry0-lvYr0Z-9JfsfGxRM --rootDir ./src
git checkout -- src/appsscript.json
```
Expected: se crea `.clasp.json` con `scriptId` y `rootDir: "./src"`. El `git checkout` deshace el manifiesto por defecto que escribe `clasp create`.

- [ ] **Step 3: Subir el código (usuario)**

Run: `npm run subir`
Expected: `Pushed 5 files.` (`appsscript.json`, `Logica.gs`, `Codigo.gs`, `Menu.gs`, `Index.html`).

- [ ] **Step 4: Preparar el libro y cargar los datos (usuario, en el Sheets)**

1. Recargar la pestaña del libro madre. Aparece el menú **Seguimientos**. La primera vez Google pide autorizar: aceptar.
2. **Seguimientos → Preparar hojas.** Espera: «Hojas creadas: CITAS, PACIENTES, INDICACIONES, SEGUIMIENTOS, BITACORA, KPI, REGLAS, CATALOGOS.»
3. **Seguimientos → Actualizar.** Espera algo como «Listo. 2128 filas leídas, 1997 citas nuevas…».
4. **Seguimientos → Importar hierro y procedimientos (una vez).** Espera «Importadas 295 indicaciones: … AUTOMÁTICO, … POR CONFIRMAR, … SIN CANDIDATO».
5. **Seguimientos → Actualizar** otra vez.
6. **Seguimientos → Verificar.** Todo con ✓.

- [ ] **Step 5: Probar contra datos reales con `@HEAD` (usuario)**

Run: `npx clasp deployments`
Abrir `https://script.google.com/macros/s/<ID del @HEAD>/dev` y comprobar:
- **La bandeja** carga, con pacientes vencidos y teléfonos.
- **Al marcar un seguimiento** en un paciente de prueba aparece una fila en `SEGUIMIENTOS` y otra en `BITACORA`.
- **La ficha** abre, con la línea de tiempo.
- **El tablero** muestra cifras.

Después, **borrar la fila de prueba** en `SEGUIMIENTOS`.

- [ ] **Step 6: Primer despliegue estable (usuario, una sola vez)**

Run: `npx clasp deploy --description "Seguimientos CHP v1"`
Expected: `Created version 1.` y un `Deployed AKfycb… @1`. **Anotar ese ID**: es la URL que se comparte con Magaly, Ana, Rachel y el Dr. Eli.

- [ ] **Step 7: Dejar los ID en el repositorio**

En `package.json`, dentro de `"scripts"`, añadir (con el ID real del Step 6):

```json
    "actualizar": "clasp push --force && clasp deploy --deploymentId <ID_DEL_STEP_6> --description \"Seguimientos CHP\""
```

En `CLAUDE.md`, reemplazar la sección «Publicar» por:

````markdown
## Publicar

```bash
git pull                 # siempre primero
npm test && npm run test:ui
npm run subir            # solo cambia @HEAD, el banco de pruebas
npm run actualizar       # publica para el equipo conservando la URL
```

- Script: `<scriptId de .clasp.json>`
- Deployment estable: `<ID_DEL_STEP_6>`
- `@HEAD` (`<ID del @HEAD>`) sirve el último código subido y nadie del equipo lo tiene: úselo antes de publicar.
- **Nunca `clasp deploy` sin `--deploymentId`**: crea una URL nueva y la del equipo deja de actualizarse.
````

- [ ] **Step 8: Commit**

```bash
git add .clasp.json package.json CLAUDE.md
git commit -m "Primer despliegue: IDs del script y del deployment estable"
git push -u origin claude/compassionate-lovelace-3q6rh3
```
