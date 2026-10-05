# Pestaña Registro, sesiones y alta médica — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Las asesoras registran procedimientos, tratamientos de hierro (con sus sesiones) y altas médicas en la plataforma. Esos datos alimentan el libro madre (hojas `REGISTROS`, `SESIONES` y `ALTAS`), la bandeja y las cifras.

**Architecture:**
- **Lógica pura nueva** en `src/Registro.gs`: validar, calcular estados, armar las filas de la bandeja y convertir registros en indicaciones. Se prueba en Node con `vm`, como `Logica.gs`.
- **Funciones públicas** que leen y escriben el Sheets, en `src/RegistroServidor.gs`.
- **`Logica.gs`** recibe las altas y las indicaciones nuevas por parámetro y no llama a `Registro.gs` (salvo `frase_` y `textoRegistro`). Así sus pruebas actuales siguen cargando solo `Logica.gs`.
- **`Codigo.gs` (`datos_`)** junta las tres fuentes.
- **La interfaz** está en `src/Index.html`, con el modo DEMO ampliado.

**Tech Stack:**
- Google Apps Script V8, desplegado con clasp 2.4.
- Pruebas de lógica con `node --test` y `vm` (`test/cargar.js`).
- Pruebas de interfaz con Playwright 1.56 en modo DEMO.

**Spec:** `docs/superpowers/specs/2026-10-05-pestana-registro-design.md`

## Global Constraints

- **Idioma:** toda la interfaz y todos los mensajes en español.
- **Datos de prueba:** nunca datos reales de pacientes en el repositorio. Pruebas y DEMO usan datos inventados.
- **Escrituras:** toda escritura pasa por `bloquear_()` (`LockService`). Todo lo que vuelve a la app pasa por `limpiarParaEnvio()`.
- **Fechas:** viajan como `'yyyy-MM-dd'` y se guardan a mediodía (`aFecha_`, vía `COLUMNAS_FECHA`).
- **Textos:** pasan por `textoSeguro` al escribirse (lo hace `celdaParaHoja_`).
- **Colores:** no se escribe un color a mano fuera de `:root` y `html[data-modo="oscuro"]`. Lo comprueba `test/ui.test.js`.
- **Nombres públicos:** no se cambian `doGet`, `bootstrap`, `getBandeja`, `getPaciente`, `buscar`, `marcarSeguimiento`, `descartar`, `confirmarEmparejamiento`, `getKpi` ni `getResumen`.
- **Funciones públicas nuevas:** `guardarRegistro`, `marcarSesion`, `anularRegistro`, `anularSesion`, `darDeAlta`, `anularAlta`, `getRegistrosHoy`, `buscarPacienteRegistro`.
- **IDs:** `REG-000001`, `SES-000001` y `ALT-000001`, correlativos, asignados dentro del candado.
- **Parámetros:**
  - `ESPERA_COTIZACION_DIAS` = 7 y `DIAS_ENTRE_SESIONES` = 7, en `REGLAS`.
  - Duplicado: misma indicación del mismo DNI, sin anular, a ≤ 7 días.
  - Sesiones: de 1 a 20.
- **Commits:**
  - Sin identificadores de modelo.
  - Terminan con estas dos líneas:
    `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
    `Claude-Session: https://claude.ai/code/session_01GegG7K4J2pd47s8MMaA85W`
  - Se publican en las dos ramas: `git push -q origin HEAD:claude/compassionate-lovelace-3q6rh3 HEAD:main`.
- **Prohibido:**
  - `npm audit fix --force`;
  - `clasp deploy` sin `--deploymentId`.

## Review Focus

1. **Dos asesoras registran a la vez.** Los IDs no se repiten, porque se releen dentro del candado. Lo prueba la Task 5.
2. **Un paciente con un hierro histórico cotizado empieza un registro nuevo y hace la 1.ª sesión.** El pendiente histórico desaparece de la bandeja, porque el `ACEPTÓ` del registro cuenta para `pendientesIndicacion`. Lo prueba la Task 4.
3. **Se anula la sesión equivocada cuando ya hay una posterior.** Solo se puede anular la última sesión; si no, la numeración se rompería. Lo prueban las Tasks 2 y 5.
4. **Un alta con fecha anterior a la última consulta.** Se rechaza: quedaría «no vigente» al instante y la asesora creería haberla dado. Lo prueba la Task 3.
5. **Un `CONTACTO` que no es teléfono** (por ejemplo `@rosa.q`). No entra como teléfono para copiar y se muestra como «Usuario: …». Lo prueban las Tasks 2 y 8.

---

## Mapa de archivos

| Archivo | Cambio |
|---|---|
| `src/Registro.gs` *(nuevo)* | Lógica pura: columnas, IDs, validaciones, estado de registro, filas de bandeja, indicaciones desde registros, altas vigentes |
| `src/RegistroServidor.gs` *(nuevo)* | Funciones públicas de Registro, sesiones y altas, que leen y escriben el Sheets |
| `src/Logica.gs` | `reglasDesdeFilas` y `catalogosDesdeFilas` ampliadas; `estadoDeSerie` y `armarPacientes` con alta; `pendientesIndicacion` y `validarAccion` con referencia; `kpiCohortes`, `kpiIndicaciones`, `resumenPorMes` y `calcularKpi` con altas y completados |
| `src/Codigo.gs` | `COLUMNAS_SEGUIMIENTOS` + `REFERENCIA`; lectores nuevos; `datos_` une las fuentes; `bootstrap`, `getPaciente`, `getKpi`, `getResumen` y `registrar_` |
| `src/Menu.gs` | Menú sin «Importar»; `prepararHojas` amplía hojas existentes; `verificar` revisa lo nuevo; `actualizar_` usa las indicaciones unidas |
| `src/Index.html` | Pestaña Registro; «Lo hizo» y «Dar de alta» en el panel y la ficha; Resumen y Detalle con altas y completados; DEMO ampliado |
| `test/cargar.js` | Sin cambios: se llama `cargar(['Logica.gs', 'Registro.gs'])` |
| `test/logica-registro.test.js` *(nuevo)* | Tasks 1–4 |
| `test/registro-servidor.test.js` *(nuevo)* | Task 5 |
| `test/menu.test.js` | Task 6 |
| `test/ui.test.js` | Tasks 7–9 |
| `package.json` | `test` incluye `test/registro-servidor.test.js` |
| `CLAUDE.md` | Task 10 |

---

### Task 1: Catálogos, reglas, IDs y validación del registro

**Files:**
- Create: `src/Registro.gs`
- Modify: `src/Logica.gs` (`reglasDesdeFilas` ~línea 187; `catalogosDesdeFilas` ~línea 211)
- Test: `test/logica-registro.test.js` (nuevo), `test/logica-estado.test.js:18-38`

**Interfaces:**
- Produces:
  - **Columnas:** `COLUMNAS_REGISTROS`, `COLUMNAS_SESIONES` y `COLUMNAS_ALTAS` (arrays de texto).
  - **IDs:** `siguienteId(ids: string[], prefijo: 'REG'|'SES'|'ALT') → 'REG-000008'`.
  - **Ayudas:**
    - `documentoValido(dni) → bool`
    - `anulado_(fila) → bool`
    - `enLista_(lista, valor) → valor del catálogo o ''`
    - `copia_(a, b) → objeto`
    - `frase_('HIERRO CARBOXIMALTOSA') → 'Hierro carboximaltosa'` (en `Logica.gs`)
    - `fechaDma_('2026-10-05') → '05/10/2026'`
    - `textoRegistro(fila) → 'Hierro carboximaltosa · Ferinject × 3 sesiones'`
  - **Médicos:**
    - `medicoDeRegistro(registro, catalogos) → nombre SOFDOC o DOCTOR`
    - `doctorPropuesto(catalogos, medicoSofdoc) → DOCTOR o ''`
  - **Validación:** `validarRegistro(p, catalogos, hoy) → { error: string, filas: object[] }`, con `p = { usuario, fecha, dni, nombre, contacto, doctor, procedimiento, tratamiento, sesiones, marca }`. Las filas salen sin `ID` ni `FECHA_HORA`.
  - **Duplicados:** `duplicadoReciente(registros, fila) → registro | null`.
  - **`reglas`** suma `esperaCotizacion` (7) y `diasEntreSesiones` (7).
  - **`catalogos`** suma:
    - `doctores: [{ doctor, sofdoc }]`
    - `procedimientos: string[]`
    - `tratamientos: string[]`
    - `marcas: { [normTexto(tratamiento)]: string[] }`

- [ ] **Step 1: Write the failing test** — crear `test/logica-registro.test.js`:

```js
// Pestaña Registro: lógica pura. Datos inventados.
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar, plano } = require('./cargar');
const { cita, seg, reglas } = require('./fixtures');
const L = cargar(['Logica.gs', 'Registro.gs']);

const HOY = '2026-10-05';
const CAT = L.catalogosDesdeFilas(
  ['USUARIOS', 'MOTIVOS_DESCARTE', 'DOCTOR', 'DOCTOR_SOFDOC', 'PROCEDIMIENTOS', 'TRATAMIENTOS', 'MARCAS'],
  [['MAGALY', 'OTRO', 'Dr. Elí Cabanillas', 'Dr. ELÍ FABRIZIO CABANILLAS HUALPA', 'SANGRÍA', 'HIERRO SACARATO', 'HIERRO CARBOXIMALTOSA | FERINJECT'],
   ['ANA', '', 'Dra. Karen Matos – Particular', '', 'AMO', 'HIERRO CARBOXIMALTOSA', 'HIERRO CARBOXIMALTOSA | LIKFER'],
   ['', '', 'Dra. Karen Matos', 'Dra. KAREN DIANA MATOS PEÑA', '', 'HIERRO DERISOMALTOSA', 'HIERRO DERISOMALTOSA | MONOFER']]);
const base = o => Object.assign({ usuario: 'magaly', fecha: '2026-10-04', dni: '40111222', nombre: ' rosa  quispe ',
  contacto: '987 654 321', doctor: 'Dr. Elí Cabanillas', procedimiento: '', tratamiento: '', sesiones: '', marca: '' }, o);

test('catalogosDesdeFilas lee doctores, procedimientos, tratamientos y marcas por tratamiento', () => {
  const c = plano(CAT);
  assert.deepEqual(c.doctores, [
    { doctor: 'Dr. Elí Cabanillas', sofdoc: 'Dr. ELÍ FABRIZIO CABANILLAS HUALPA' },
    { doctor: 'Dra. Karen Matos – Particular', sofdoc: '' },
    { doctor: 'Dra. Karen Matos', sofdoc: 'Dra. KAREN DIANA MATOS PEÑA' }]);
  assert.deepEqual(c.procedimientos, ['SANGRÍA', 'AMO']);
  assert.deepEqual(c.tratamientos, ['HIERRO SACARATO', 'HIERRO CARBOXIMALTOSA', 'HIERRO DERISOMALTOSA']);
  assert.deepEqual(c.marcas, { 'HIERRO CARBOXIMALTOSA': ['FERINJECT', 'LIKFER'], 'HIERRO DERISOMALTOSA': ['MONOFER'] });
});

test('reglas: espera de cotización y días entre sesiones, 7 por omisión', () => {
  const r = L.reglasDesdeFilas(['PARAMETRO', 'VALOR'], [['ESPERA_COTIZACION_DIAS', 10], ['DIAS_ENTRE_SESIONES', 5]]);
  assert.deepEqual([r.esperaCotizacion, r.diasEntreSesiones], [10, 5]);
  const d = L.reglasDesdeFilas([], []);
  assert.deepEqual([d.esperaCotizacion, d.diasEntreSesiones], [7, 7]);
});

test('siguienteId sigue al mayor y respeta el prefijo', () => {
  assert.equal(L.siguienteId([], 'REG'), 'REG-000001');
  assert.equal(L.siguienteId(['REG-000007', 'REG-000002', 'SES-000099', ''], 'REG'), 'REG-000008');
});

test('validarRegistro: procedimiento y tratamiento en un formulario son dos filas limpias', () => {
  const r = plano(L.validarRegistro(base({ procedimiento: 'sangria', tratamiento: 'Hierro Carboximaltosa', sesiones: '3', marca: 'ferinject' }), CAT, HOY));
  assert.equal(r.error, '');
  assert.deepEqual(r.filas, [
    { FECHA: '2026-10-04', ASESORA: 'MAGALY', DOCTOR: 'Dr. Elí Cabanillas', NOMBRE: 'ROSA QUISPE', DNI: '40111222', CONTACTO: '987 654 321',
      MARCA: '', ANULADO: '', MOTIVO_ANULACION: '', TIPO: 'PROCEDIMIENTO', DETALLE: 'SANGRÍA', SESIONES: 1 },
    { FECHA: '2026-10-04', ASESORA: 'MAGALY', DOCTOR: 'Dr. Elí Cabanillas', NOMBRE: 'ROSA QUISPE', DNI: '40111222', CONTACTO: '987 654 321',
      MARCA: 'FERINJECT', ANULADO: '', MOTIVO_ANULACION: '', TIPO: 'HIERRO', DETALLE: 'HIERRO CARBOXIMALTOSA', SESIONES: 3 }]);
});

test('validarRegistro rechaza lo que no se puede guardar', () => {
  const err = o => L.validarRegistro(base(o), CAT, HOY).error;
  assert.match(err({ usuario: 'PEDRO', procedimiento: 'AMO' }), /Elija quién es usted/);
  assert.match(err({ dni: '1234', procedimiento: 'AMO' }), /8 dígitos/);
  assert.match(err({ nombre: ' ', procedimiento: 'AMO' }), /nombre/);
  assert.match(err({ contacto: '', procedimiento: 'AMO' }), /teléfono o usuario/);
  assert.match(err({ fecha: '2026-10-06', procedimiento: 'AMO' }), /futura/);
  assert.match(err({ doctor: 'Dr. Nadie', procedimiento: 'AMO' }), /doctor/);
  assert.match(err({}), /procedimiento, un tratamiento o ambos/);
  assert.match(err({ procedimiento: 'CARIOTIPO' }), /no está en CATALOGOS/);
  assert.match(err({ tratamiento: 'HIERRO SACARATO', sesiones: '0' }), /sesiones/);
  assert.match(err({ tratamiento: 'HIERRO SACARATO', sesiones: '21' }), /sesiones/);
  assert.match(err({ tratamiento: 'HIERRO CARBOXIMALTOSA', sesiones: '2', marca: 'MONOFER' }), /FERINJECT o LIKFER/);
  assert.match(err({ tratamiento: 'HIERRO SACARATO', sesiones: '2', marca: 'FERINJECT' }), /no lleva marca/);
  assert.equal(err({ tratamiento: 'HIERRO SACARATO', sesiones: '12' }), '');
  assert.equal(err({ dni: 'CE00123456', procedimiento: 'AMO' }), '', 'carné de extranjería');
  assert.match(L.validarRegistro(null, CAT, HOY).error, /Faltan los datos/);
});

test('duplicadoReciente: misma indicación del mismo DNI, sin anular, a 7 días o menos', () => {
  const fila = { DNI: '40111222', TIPO: 'HIERRO', DETALLE: 'HIERRO CARBOXIMALTOSA', FECHA: '2026-10-05' };
  const previo = o => Object.assign({ ID: 'REG-000001', DNI: '40111222', TIPO: 'HIERRO', DETALLE: 'HIERRO CARBOXIMALTOSA', FECHA: '2026-09-29', ANULADO: '' }, o);
  assert.equal(L.duplicadoReciente([previo()], fila).ID, 'REG-000001');
  assert.equal(L.duplicadoReciente([previo({ FECHA: '2026-09-27' })], fila), null, '8 días');
  assert.equal(L.duplicadoReciente([previo({ ANULADO: 'SÍ' })], fila), null);
  assert.equal(L.duplicadoReciente([previo({ DETALLE: 'HIERRO SACARATO' })], fila), null);
  assert.equal(L.duplicadoReciente([previo({ DNI: '40222333' })], fila), null);
});

test('textoRegistro y médico del registro', () => {
  assert.equal(L.textoRegistro({ TIPO: 'HIERRO', DETALLE: 'HIERRO CARBOXIMALTOSA', MARCA: 'FERINJECT', SESIONES: 3 }), 'Hierro carboximaltosa · Ferinject × 3 sesiones');
  assert.equal(L.textoRegistro({ TIPO: 'HIERRO', DETALLE: 'HIERRO SACARATO', MARCA: '', SESIONES: '1' }), 'Hierro sacarato × 1 sesión');
  assert.equal(L.textoRegistro({ TIPO: 'PROCEDIMIENTO', DETALLE: 'SANGRÍA', SESIONES: 1 }), 'Sangría');
  assert.equal(L.medicoDeRegistro({ DOCTOR: 'Dr. Elí Cabanillas' }, CAT), 'Dr. ELÍ FABRIZIO CABANILLAS HUALPA');
  assert.equal(L.medicoDeRegistro({ DOCTOR: 'Dra. Karen Matos – Particular' }, CAT), 'Dra. Karen Matos – Particular');
  assert.equal(L.doctorPropuesto(CAT, 'Dra. KAREN DIANA MATOS PEÑA'), 'Dra. Karen Matos', 'no el particular');
  assert.equal(L.doctorPropuesto(CAT, 'Dr. OTRO'), '');
});
```

También en `test/logica-estado.test.js`:
- **Línea 20:** cambiar el objeto esperado a
  `{ plazos: { '*': { esperado: 30, vence: 45 } }, espera: 15, maxSeguimientos: 3, corte: 180, corteIndicaciones: 180, metaRetorno: 60, esperaCotizacion: 7, diasEntreSesiones: 7 }`.
- **El `deepEqual` de la prueba `catalogosDesdeFilas lee usuarios, motivos y alias`:** agregar
  `doctores: [], procedimientos: [], tratamientos: [], marcas: {}`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/logica-registro.test.js test/logica-estado.test.js`
Expected: FAIL. Falta `src/Registro.gs` (ENOENT) y no coinciden los objetos de reglas y catálogos.

- [ ] **Step 3: Write minimal implementation**

En `src/Logica.gs`, `reglasDesdeFilas`:

```js
  var r = { plazos: { '*': { esperado: 30, vence: 45 } }, espera: 15, maxSeguimientos: 3, corte: 180, corteIndicaciones: 180, metaRetorno: 60,
    esperaCotizacion: 7, diasEntreSesiones: 7 };
```
y, junto a los demás parámetros:
```js
    if (par === 'ESPERA_COTIZACION_DIAS') r.esperaCotizacion = entero_(val, 7);
    if (par === 'DIAS_ENTRE_SESIONES') r.diasEntreSesiones = entero_(val, 7);
```

En `src/Logica.gs`, junto a `textoLimpio_` (~línea 91). Va en `Logica.gs` porque también la usa `pendientesPorDni`:

```js
/** 'HIERRO CARBOXIMALTOSA' -> 'Hierro carboximaltosa'. */
function frase_(s) {
  var t = textoLimpio_(s).toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}
```

En `src/Logica.gs`, `catalogosDesdeFilas` (completo):

```js
/**
 * CATALOGOS: una columna por lista. USUARIOS | MOTIVOS_DESCARTE | MEDICO_ALIAS | MEDICO_NOMBRE |
 * DOCTOR | DOCTOR_SOFDOC | PROCEDIMIENTOS | TRATAMIENTOS | MARCAS («TRATAMIENTO | MARCA»).
 */
function catalogosDesdeFilas(encabezado, filas) {
  var idx = indiceDeEncabezado(encabezado);
  var out = { usuarios: [], motivos: [], alias: {}, doctores: [], procedimientos: [], tratamientos: [], marcas: {} };
  function celda(f, k) { return idx[k] === undefined ? '' : textoLimpio_(f[idx[k]]); }
  (filas || []).forEach(function (f) {
    var u = celda(f, 'USUARIOS'), m = celda(f, 'MOTIVOS_DESCARTE');
    var a = celda(f, 'MEDICO_ALIAS'), n = celda(f, 'MEDICO_NOMBRE');
    if (u) out.usuarios.push(u);
    if (m) out.motivos.push(m);
    if (a && n) out.alias[normTexto(a)] = n;
    if (celda(f, 'DOCTOR')) out.doctores.push({ doctor: celda(f, 'DOCTOR'), sofdoc: celda(f, 'DOCTOR_SOFDOC') });
    if (celda(f, 'PROCEDIMIENTOS')) out.procedimientos.push(celda(f, 'PROCEDIMIENTOS'));
    if (celda(f, 'TRATAMIENTOS')) out.tratamientos.push(celda(f, 'TRATAMIENTOS'));
    var par = celda(f, 'MARCAS').split('|');
    if (par.length === 2 && textoLimpio_(par[0]) && textoLimpio_(par[1])) {
      var t = normTexto(par[0]);
      (out.marcas[t] = out.marcas[t] || []).push(textoLimpio_(par[1]));
    }
  });
  return out;
}
```

Crear `src/Registro.gs`:

```js
/* ==========================================================================
   REGISTRO, SESIONES Y ALTAS — lógica pura (sin Sheets). Usa Logica.gs.
   Diseño: docs/superpowers/specs/2026-10-05-pestana-registro-design.md
   ========================================================================== */

var COLUMNAS_REGISTROS = ['ID', 'FECHA_HORA', 'FECHA', 'ASESORA', 'DOCTOR', 'NOMBRE', 'DNI', 'CONTACTO', 'TIPO',
  'DETALLE', 'MARCA', 'SESIONES', 'ANULADO', 'MOTIVO_ANULACION'];
var COLUMNAS_SESIONES = ['ID', 'FECHA_HORA', 'ID_REGISTRO', 'NUMERO', 'FECHA', 'ASESORA', 'NOTA', 'ANULADO', 'MOTIVO_ANULACION'];
var COLUMNAS_ALTAS = ['ID', 'FECHA_HORA', 'FECHA', 'DNI', 'ESPECIALIDAD', 'DOCTOR', 'REGISTRADO_POR', 'NOTA', 'ANULADO', 'MOTIVO_ANULACION'];

var MAX_SESIONES = 20;
var DIAS_DUPLICADO = 7;

/** El siguiente ID correlativo: siguienteId(['REG-000007'], 'REG') -> 'REG-000008'. */
function siguienteId(ids, prefijo) {
  var mayor = 0, re = new RegExp('^' + prefijo + '-(\\d+)$');
  (ids || []).forEach(function (id) {
    var m = String(id || '').trim().match(re);
    if (m && Number(m[1]) > mayor) mayor = Number(m[1]);
  });
  return prefijo + '-' + ('00000' + (mayor + 1)).slice(-6);
}

function anulado_(x) { return normTexto(x && x.ANULADO) === 'SI'; }

/** El valor tal como está en el catálogo, o '' si no está (sin importar mayúsculas ni tildes). */
function enLista_(lista, valor) {
  var n = normTexto(valor);
  if (!n) return '';
  for (var i = 0; i < (lista || []).length; i++) if (normTexto(lista[i]) === n) return lista[i];
  return '';
}

function copia_(a, b) {
  var o = {};
  [a, b].forEach(function (x) { Object.keys(x).forEach(function (k) { o[k] = x[k]; }); });
  return o;
}

function fechaDma_(iso) {
  var p = String(iso || '').split('-');
  return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : String(iso || '');
}

/** DNI de 8 dígitos o carné de extranjería de 9 a 12 caracteres alfanuméricos. */
function documentoValido(dni) {
  var d = normTexto(dni).replace(/[\s.\-]/g, '');
  return /^\d{8}$/.test(d) || /^[A-Z0-9]{9,12}$/.test(d);
}

/** 'Hierro carboximaltosa · Ferinject × 3 sesiones' o 'Sangría'. */
function textoRegistro(r) {
  if (r.TIPO !== 'HIERRO') return frase_(r.DETALLE);
  var n = Number(r.SESIONES) || 1;
  return frase_(r.DETALLE) + (r.MARCA ? ' · ' + frase_(r.MARCA) : '') + ' × ' + n + (n === 1 ? ' sesión' : ' sesiones');
}

/** El médico para filtros y cifras: su nombre en SOFDOC o, si no tiene, el DOCTOR tal cual. */
function medicoDeRegistro(r, catalogos) {
  var d = (catalogos.doctores || []).filter(function (x) { return normTexto(x.doctor) === normTexto(r.DOCTOR); })[0];
  return d && d.sofdoc ? d.sofdoc : textoLimpio_(r.DOCTOR);
}

/** El primer DOCTOR del catálogo cuyo nombre SOFDOC es ese médico (así se propone «Dra. Karen Matos» y no el particular). */
function doctorPropuesto(catalogos, medicoSofdoc) {
  var d = (catalogos.doctores || []).filter(function (x) { return x.sofdoc && normTexto(x.sofdoc) === normTexto(medicoSofdoc); })[0];
  return d ? d.doctor : '';
}

function validarRegistro(p, catalogos, hoy) {
  function no(m) { return { error: m, filas: [] }; }
  if (!p) return no('Faltan los datos del registro.');
  var asesora = enLista_(catalogos.usuarios, p.usuario);
  if (!asesora) return no('Elija quién es usted en el selector de arriba.');
  if (!documentoValido(p.dni)) return no('El DNI debe tener 8 dígitos (o el carné de extranjería, de 9 a 12 caracteres).');
  var nombre = textoLimpio_(p.nombre).toUpperCase();
  if (!nombre) return no('Falta el nombre del paciente.');
  var contacto = textoLimpio_(p.contacto);
  if (!contacto) return no('Falta el teléfono o usuario.');
  var fecha = fechaIso(p.fecha);
  if (!fecha) return no('Falta la fecha.');
  if (fecha > hoy) return no('La fecha no puede ser futura.');
  var doctor = (catalogos.doctores || []).filter(function (d) { return normTexto(d.doctor) === normTexto(p.doctor); })[0];
  if (!doctor) return no('Elija el doctor de la lista.');
  var proc = textoLimpio_(p.procedimiento), trat = textoLimpio_(p.tratamiento);
  if (!proc && !trat) return no('Elija un procedimiento, un tratamiento o ambos.');
  var base = { FECHA: fecha, ASESORA: asesora, DOCTOR: doctor.doctor, NOMBRE: nombre, DNI: normDni(p.dni), CONTACTO: contacto,
    MARCA: '', ANULADO: '', MOTIVO_ANULACION: '' };
  var filas = [];
  if (proc) {
    var p1 = enLista_(catalogos.procedimientos, proc);
    if (!p1) return no('El procedimiento «' + proc + '» no está en CATALOGOS.');
    filas.push(copia_(base, { TIPO: 'PROCEDIMIENTO', DETALLE: p1, SESIONES: 1 }));
  }
  if (trat) {
    var t1 = enLista_(catalogos.tratamientos, trat);
    if (!t1) return no('El tratamiento «' + trat + '» no está en CATALOGOS.');
    var n = Number(p.sesiones);
    if (!(n >= 1 && n <= MAX_SESIONES && Math.floor(n) === n)) return no('Indique cuántas sesiones (de 1 a ' + MAX_SESIONES + ').');
    var marcas = (catalogos.marcas || {})[normTexto(t1)] || [], marca = '';
    if (marcas.length) {
      marca = enLista_(marcas, p.marca);
      if (!marca) return no('Elija la marca de ' + t1 + ': ' + marcas.join(' o ') + '.');
    } else if (textoLimpio_(p.marca)) {
      return no(t1 + ' no lleva marca.');
    }
    filas.push(copia_(base, { TIPO: 'HIERRO', DETALLE: t1, MARCA: marca, SESIONES: n }));
  }
  return { error: '', filas: filas };
}

/** El registro previo, sin anular, de la misma indicación del mismo DNI a 7 días o menos de la fecha nueva. */
function duplicadoReciente(registros, fila) {
  var previos = (registros || []).filter(function (r) {
    var f = fechaIso(r.FECHA);
    return !anulado_(r) && f && normDni(r.DNI) === fila.DNI && normTexto(r.TIPO) === fila.TIPO &&
      normTexto(r.DETALLE) === normTexto(fila.DETALLE) && Math.abs(diasEntre(f, fila.FECHA)) <= DIAS_DUPLICADO;
  });
  return previos.length ? previos[previos.length - 1] : null;
}
```

En `package.json`, el script `test` pasa a ser:
`node --test test/logica-*.test.js test/sintaxis.test.js test/menu.test.js test/registro-servidor.test.js`.
El archivo `test/registro-servidor.test.js` se crea en la Task 5. Hasta entonces, corra los archivos sueltos.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/logica-*.test.js test/sintaxis.test.js test/menu.test.js`
Expected: PASS, todas.

- [ ] **Step 5: Commit**

```bash
git add src/Registro.gs src/Logica.gs test/logica-registro.test.js test/logica-estado.test.js package.json
git commit -m "Registro: catálogos, reglas, IDs y validación del formulario"
```

---

### Task 2: Estado de un registro, sesiones y filas de la bandeja

**Files:**
- Modify: `src/Registro.gs` (agregar al final), `src/Logica.gs` (`pendientesIndicacion` ~línea 590, `validarAccion` ~línea 679)
- Test: `test/logica-registro.test.js`

**Interfaces:**
- Consumes: de la Task 1, `anulado_`, `textoRegistro`, `medicoDeRegistro`, `fechaDma_` y `reglas.esperaCotizacion` / `diasEntreSesiones`.
- Produces:
  - `sesionesDe_(idRegistro, sesiones) → sesiones válidas ordenadas por NUMERO`
  - `estadoRegistro(r, sesiones) → { estado: 'COTIZADO'|'EN CURSO'|'COMPLETO'|'ANULADO', hechas, total, ultima }`
  - `validarSesion(r, sesiones, fecha, hoy) → error string`
  - `validarAnulacionSesion(idSesion, sesiones) → { error, sesion }` (solo la última de su registro)
  - `pendientesRegistro({ registros, sesiones, seguimientos, citas, reglas, hoy, telefonos, catalogos }) → filas`
    - **Campos de cada fila:** `ID_REGISTRO, DNI, ESPECIALIDAD (=TIPO), TIPO_SEGUIMIENTO, NOMBRE, TELEFONOS, USUARIO, MEDICO_ULTIMO, ESPECIALIDAD_CONSULTA, FECHA_COTIZACION, DETALLE, SESIONES, HECHAS, ULTIMA_SESION, DIAS, ULTIMA_CITA, N_SEGUIMIENTOS, ULTIMO_SEGUIMIENTO, ESTADO, ESTADO_REGISTRO`.
    - **`ESTADO`:** `PENDIENTE` (entra en la bandeja), `EN ESPERA`, `CONTACTADO`, `DESCARTADO` o `ANTIGUO`.
  - **`validarAccion(p, …)`** acepta `p.referencia`. Con referencia, la fila tiene que tener ese `ID_REGISTRO`; sin ella, no tiene que tener `ID_REGISTRO`.
  - **`pendientesIndicacion`:**
    - ignora los seguimientos que tienen `REFERENCIA`;
    - ignora las indicaciones con `ORIGEN === 'REGISTROS'` como cotizaciones propias;
    - sí cuenta su `ACEPTÓ`.

- [ ] **Step 1: Write the failing test** — agregar a `test/logica-registro.test.js`:

```js
const reg = o => Object.assign({ ID: 'REG-000001', FECHA: '2026-09-20', ASESORA: 'MAGALY', DOCTOR: 'Dr. Elí Cabanillas', NOMBRE: 'ROSA QUISPE',
  DNI: '40111222', CONTACTO: '987654321', TIPO: 'HIERRO', DETALLE: 'HIERRO CARBOXIMALTOSA', MARCA: 'FERINJECT', SESIONES: '3', ANULADO: '' }, o);
const ses = (numero, fecha, o) => Object.assign({ ID: 'SES-00000' + numero, ID_REGISTRO: 'REG-000001', NUMERO: String(numero), FECHA: fecha, ANULADO: '' }, o);

test('estadoRegistro: cotizado, en curso, completo y anulado; una sesión anulada no cuenta', () => {
  const e = (r, s) => plano(L.estadoRegistro(r, s));
  assert.deepEqual(e(reg(), []), { estado: 'COTIZADO', hechas: 0, total: 3, ultima: '' });
  assert.deepEqual(e(reg(), [ses(1, '2026-09-25')]), { estado: 'EN CURSO', hechas: 1, total: 3, ultima: '2026-09-25' });
  assert.equal(e(reg(), [ses(1, '2026-09-25'), ses(2, '2026-10-01'), ses(3, '2026-10-04')]).estado, 'COMPLETO');
  assert.equal(e(reg(), [ses(1, '2026-09-25', { ANULADO: 'SÍ' })]).estado, 'COTIZADO');
  assert.equal(e(reg({ ANULADO: 'SÍ' }), []).estado, 'ANULADO');
  assert.equal(e(reg(), [ses(1, '2026-09-25', { ID_REGISTRO: 'REG-000009' })]).hechas, 0, 'sesión de otro registro');
});

test('validarSesion: ni completo, ni anulado, ni antes del registro o de la sesión previa, ni futura', () => {
  const v = (r, s, f) => L.validarSesion(r, s, f, HOY);
  assert.equal(v(reg(), [], '2026-09-20'), '');
  assert.match(v(null, [], HOY), /No encontré/);
  assert.match(v(reg({ ANULADO: 'SÍ' }), [], HOY), /anulado/);
  assert.match(v(reg({ SESIONES: '1' }), [ses(1, '2026-09-25')], HOY), /todas sus sesiones/);
  assert.match(v(reg(), [], '2026-09-19'), /anterior al registro \(20\/09\/2026\)/);
  assert.match(v(reg(), [ses(1, '2026-09-25')], '2026-09-24'), /anterior a la sesión previa \(25\/09\/2026\)/);
  assert.match(v(reg(), [], '2026-10-06'), /futura/);
  assert.match(v(reg(), [], ''), /Falta la fecha/);
});

test('validarAnulacionSesion: solo la última sesión válida de su registro', () => {
  const s = [ses(1, '2026-09-25'), ses(2, '2026-10-01')];
  assert.equal(L.validarAnulacionSesion('SES-000002', s).error, '');
  assert.match(L.validarAnulacionSesion('SES-000001', s).error, /Solo se puede anular la última sesión/);
  assert.match(L.validarAnulacionSesion('SES-000009', s).error, /No encontré/);
  assert.match(L.validarAnulacionSesion('SES-000002', [ses(1, '2026-09-25'), ses(2, '2026-10-01', { ANULADO: 'SÍ' })]).error, /ya estaba anulada/);
});

const CAT2 = L.catalogosDesdeFilas(['USUARIOS', 'DOCTOR', 'DOCTOR_SOFDOC'], [['MAGALY', 'Dr. Elí Cabanillas', 'Dr. ELÍ FABRIZIO CABANILLAS HUALPA']]);
const pend = (registros, sesiones, seguimientos, hoy) => plano(L.pendientesRegistro({
  registros, sesiones: sesiones || [], seguimientos: seguimientos || [], citas: [cita({ fecha: '2026-09-01' })], reglas: reglas(L),
  hoy: hoy || HOY, telefonos: { '40111222': ['987654321'] }, catalogos: CAT2 }));

test('pendientesRegistro: un cotizado entra a los 7 días, con lo que necesita la bandeja', () => {
  assert.equal(pend([reg({ FECHA: '2026-09-29' })])[0].ESTADO, 'EN ESPERA', '6 días');
  const p = pend([reg({ FECHA: '2026-09-28' })])[0];
  assert.equal(p.ESTADO, 'PENDIENTE');
  assert.equal(p.ID_REGISTRO, 'REG-000001');
  assert.equal(p.ESPECIALIDAD, 'HIERRO');
  assert.equal(p.TIPO_SEGUIMIENTO, 'HIERRO');
  assert.equal(p.DETALLE, 'Hierro carboximaltosa · Ferinject × 3 sesiones');
  assert.equal(p.MEDICO_ULTIMO, 'Dr. ELÍ FABRIZIO CABANILLAS HUALPA');
  assert.equal(p.ESPECIALIDAD_CONSULTA, 'HEMATOLOGÍA');
  assert.equal(p.TELEFONOS, '987654321');
  assert.equal(p.USUARIO, '');
  assert.equal(p.DIAS, 7);
  assert.equal(p.ESTADO_REGISTRO, 'COTIZADO');
  assert.equal(p.NOMBRE, 'ROSA ELENA QUISPE HUAMAN', 'el nombre de SOFDOC si lo hay');
});

test('pendientesRegistro: en curso entra a los 7 días de la última sesión; completo y anulado no entran', () => {
  const s = [ses(1, '2026-09-29')];
  assert.equal(pend([reg()], s)[0].ESTADO, 'EN ESPERA');
  const p = pend([reg()], [ses(1, '2026-09-28')])[0];
  assert.deepEqual([p.ESTADO, p.ESTADO_REGISTRO, p.HECHAS, p.SESIONES, p.ULTIMA_SESION, p.DIAS], ['PENDIENTE', 'EN CURSO', 1, 3, '2026-09-28', 7]);
  assert.deepEqual(pend([reg({ SESIONES: '1' })], [ses(1, '2026-09-28')]), []);
  assert.deepEqual(pend([reg({ ANULADO: 'SÍ' })]), []);
});

test('pendientesRegistro: seguimientos por REFERENCIA, contados desde la fecha que corresponde', () => {
  const r = [reg({ FECHA: '2026-09-01' })];
  const sg = (fecha, o) => Object.assign(seg({ fecha, esp: 'HIERRO' }), { REFERENCIA: 'REG-000001' }, o);
  assert.equal(pend(r, [], [sg('2026-10-01')])[0].ESTADO, 'CONTACTADO');
  assert.equal(pend(r, [], [sg('2026-10-01', { REFERENCIA: 'REG-000777' })])[0].ESTADO, 'PENDIENTE', 'de otro registro');
  assert.equal(pend(r, [], [sg('2026-09-10', { ACCION: 'DESCARTADO', MOTIVO: 'OTRO' })])[0].ESTADO, 'DESCARTADO');
  assert.equal(pend(r, [], [sg('2026-09-05'), sg('2026-09-15'), sg('2026-09-20')])[0].ESTADO, 'DESCARTADO', '3 intentos, espera cumplida');
  const p = pend(r, [ses(1, '2026-09-20')], [sg('2026-09-10')])[0];
  assert.deepEqual([p.ESTADO, p.N_SEGUIMIENTOS], ['PENDIENTE', 0], 'tras una sesión los intentos empiezan de cero');
});

test('pendientesRegistro: un usuario que no es teléfono va aparte y pasado el corte queda ANTIGUO', () => {
  const p = pend([reg({ DNI: '40999888', CONTACTO: '@rosa.q', FECHA: '2026-09-01' })])[0];
  assert.deepEqual([p.TELEFONOS, p.USUARIO, p.NOMBRE], ['', '@rosa.q', 'ROSA QUISPE']);
  assert.equal(pend([reg({ FECHA: '2026-03-01' })])[0].ESTADO, 'ANTIGUO');
});

test('validarAccion distingue las filas de registro por su referencia', () => {
  const cat = { usuarios: ['MAGALY'], motivos: ['OTRO'], alias: {} };
  const lista = [{ DNI: '40111222', ESPECIALIDAD: 'HIERRO', ID_REGISTRO: 'REG-000001' }, { DNI: '40111222', ESPECIALIDAD: 'HIERRO' }];
  const v = p => L.validarAccion(Object.assign({ usuario: 'MAGALY', dni: '40111222', especialidad: 'HIERRO' }, p), cat, 'HECHO', lista);
  assert.equal(v({ referencia: 'REG-000001' }), '');
  assert.equal(v({}), '', 'el histórico, sin referencia');
  assert.match(v({ referencia: 'REG-000002' }), /no está en la lista/);
  assert.match(L.validarAccion({ usuario: 'MAGALY', dni: '40111222', especialidad: 'HIERRO' }, cat, 'HECHO', [lista[0]]), /no está en la lista/);
});

test('pendientesIndicacion: el ACEPTÓ de un registro cierra el histórico y sus seguimientos no se mezclan', () => {
  const hist = { ID: 'IND-1', FECHA: '2026-08-01', TIPO: 'HIERRO', DETALLE: 'HIERRO', CANTIDAD: '', MEDICO_SOLICITANTE: '', NOMBRE: 'X',
    TELEFONO: '', ESTADO: 'COTIZÓ', DNI: '40111222', EMPAREJAMIENTO: 'AUTOMÁTICO' };
  const desdeReg = Object.assign({}, hist, { ID: 'REG-000001', FECHA: '2026-09-01', ESTADO: 'ACEPTÓ', ORIGEN: 'REGISTROS' });
  const cotReg = Object.assign({}, hist, { ID: 'REG-000002', FECHA: '2026-09-01', ESTADO: 'COTIZÓ', ORIGEN: 'REGISTROS', DNI: '40222333' });
  const citas = [cita({ fecha: '2026-07-01' })];
  assert.equal(L.pendientesIndicacion(citas, [hist], [], reglas(L), HOY).length, 1);
  assert.equal(L.pendientesIndicacion(citas, [hist, desdeReg], [], reglas(L), HOY).length, 0);
  assert.equal(L.pendientesIndicacion(citas, [cotReg], [], reglas(L), HOY).length, 0, 'lo cotizado en Registro lo lleva pendientesRegistro');
  const conRef = Object.assign(seg({ fecha: '2026-10-01', esp: 'HIERRO' }), { REFERENCIA: 'REG-000001' });
  assert.equal(plano(L.pendientesIndicacion(citas, [hist], [conRef], reglas(L), HOY))[0].N_SEGUIMIENTOS, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/logica-registro.test.js`
Expected: FAIL. `estadoRegistro is not a function` y las demás que faltan.

- [ ] **Step 3: Write minimal implementation**

Agregar a `src/Registro.gs`:

```js
/* ---------- Sesiones y estado de un registro ---------- */

function sesionesDe_(id, sesiones) {
  return (sesiones || []).filter(function (s) { return s.ID_REGISTRO === id && !anulado_(s); })
    .sort(function (a, b) { return Number(a.NUMERO) - Number(b.NUMERO); });
}

/** El estado no se guarda en ninguna celda: se calcula con las sesiones válidas. */
function estadoRegistro(r, sesiones) {
  var propias = sesionesDe_(r.ID, sesiones);
  var total = Math.max(1, Number(r.SESIONES) || 1);
  var ultima = propias.length ? fechaIso(propias[propias.length - 1].FECHA) : '';
  var estado = anulado_(r) ? 'ANULADO' : propias.length >= total ? 'COMPLETO' : propias.length ? 'EN CURSO' : 'COTIZADO';
  return { estado: estado, hechas: propias.length, total: total, ultima: ultima };
}

function validarSesion(r, sesiones, fecha, hoy) {
  if (!r) return 'No encontré ese registro. Recargue la página.';
  var e = estadoRegistro(r, sesiones);
  if (e.estado === 'ANULADO') return 'Ese registro está anulado.';
  if (e.estado === 'COMPLETO') return 'Ese tratamiento ya tiene todas sus sesiones.';
  var f = fechaIso(fecha);
  if (!f) return 'Falta la fecha de la sesión.';
  if (f > hoy) return 'La fecha no puede ser futura.';
  if (f < fechaIso(r.FECHA)) return 'La sesión no puede ser anterior al registro (' + fechaDma_(fechaIso(r.FECHA)) + ').';
  if (e.ultima && f < e.ultima) return 'La sesión no puede ser anterior a la sesión previa (' + fechaDma_(e.ultima) + ').';
  return '';
}

/** Solo la última sesión válida: anular una del medio rompería la numeración de las siguientes. */
function validarAnulacionSesion(id, sesiones) {
  var s = (sesiones || []).filter(function (x) { return x.ID === id; })[0];
  if (!s) return { error: 'No encontré la sesión ' + id + '.', sesion: null };
  if (anulado_(s)) return { error: 'La sesión ' + id + ' ya estaba anulada.', sesion: null };
  var propias = sesionesDe_(s.ID_REGISTRO, sesiones);
  if (propias[propias.length - 1].ID !== id) return { error: 'Solo se puede anular la última sesión del tratamiento.', sesion: null };
  return { error: '', sesion: s };
}

/* ---------- Filas de la bandeja ---------- */

function porFechaHora_(a, b) { return a.FECHA_HORA < b.FECHA_HORA ? -1 : a.FECHA_HORA > b.FECHA_HORA ? 1 : 0; }

/**
 * Una fila por registro cotizado o en curso. Entra en la bandeja (ESTADO PENDIENTE) cuando pasa la
 * espera sin «Lo hizo»: ESPERA_COTIZACION_DIAS desde la FECHA del registro o DIAS_ENTRE_SESIONES
 * desde la última sesión. Los seguimientos se reconocen por REFERENCIA = ID del registro.
 */
function pendientesRegistro(d) {
  var porDni = realizadasPorDni_(d.citas), segs = {}, reglas = d.reglas, hoy = d.hoy;
  (d.seguimientos || []).forEach(function (s) {
    if (s.REFERENCIA) (segs[s.REFERENCIA] = segs[s.REFERENCIA] || []).push(s);
  });
  return (d.registros || []).map(function (r) {
    var e = estadoRegistro(r, d.sesiones);
    if (e.estado === 'ANULADO' || e.estado === 'COMPLETO') return null;
    var enCurso = e.estado === 'EN CURSO';
    var desde = enCurso ? e.ultima : fechaIso(r.FECHA);
    var dias = Math.max(0, diasEntre(desde, hoy));
    var lista = (segs[r.ID] || []).filter(function (s) { return fechaIso(s.FECHA_HORA) >= desde; }).sort(porFechaHora_);
    var hechos = lista.filter(function (s) { return normTexto(s.ACCION) === 'HECHO'; });
    var ultimoHecho = hechos[hechos.length - 1];
    var diasDesdeHecho = ultimoHecho ? diasEntre(fechaIso(ultimoHecho.FECHA_HORA), hoy) : null;
    var estado = 'PENDIENTE';
    if (lista.length && normTexto(lista[lista.length - 1].ACCION) === 'DESCARTADO') estado = 'DESCARTADO';
    else if (hechos.length >= reglas.maxSeguimientos && diasDesdeHecho >= reglas.espera) estado = 'DESCARTADO';
    else if (ultimoHecho && diasDesdeHecho < reglas.espera) estado = 'CONTACTADO';
    else if (dias < (enCurso ? reglas.diasEntreSesiones : reglas.esperaCotizacion)) estado = 'EN ESPERA';
    else if (dias > reglas.corteIndicaciones) estado = 'ANTIGUO';
    var dni = normDni(r.DNI), realizadas = porDni[dni] || [], ultima = realizadas[realizadas.length - 1];
    var tel = normTelefono(r.CONTACTO);
    return {
      ID_REGISTRO: r.ID,
      DNI: dni,
      ESPECIALIDAD: r.TIPO,
      TIPO_SEGUIMIENTO: r.TIPO,
      NOMBRE: ultima ? ultima.NOMBRE : r.NOMBRE,
      TELEFONOS: ((d.telefonos || {})[dni] || []).join(' / '),
      USUARIO: tel.length === 9 ? '' : textoLimpio_(r.CONTACTO),
      MEDICO_ULTIMO: medicoDeRegistro(r, d.catalogos),
      ESPECIALIDAD_CONSULTA: ultima ? ultima.ESPECIALIDAD : '',
      FECHA_COTIZACION: fechaIso(r.FECHA),
      DETALLE: textoRegistro(r),
      SESIONES: e.total,
      HECHAS: e.hechas,
      ULTIMA_SESION: e.ultima,
      DIAS: dias,
      ULTIMA_CITA: ultima ? ultima.FECHA : '',
      N_SEGUIMIENTOS: hechos.length,
      ULTIMO_SEGUIMIENTO: lista.length ? fechaIso(lista[lista.length - 1].FECHA_HORA) : '',
      ESTADO: estado,
      ESTADO_REGISTRO: e.estado
    };
  }).filter(Boolean);
}
```

En `src/Logica.gs`, `pendientesIndicacion`:
- **En el segundo `forEach` de indicaciones**, que arma los grupos, agregar al inicio:
  `if (i.ORIGEN === 'REGISTROS') return;`
- **En el `forEach` de seguimientos:**
```js
  (seguimientos || []).forEach(function (s) {
    var t = normTexto(s.ESPECIALIDAD);
    if (s.REFERENCIA || !TIPOS_INDICACION[t]) return;
    (segs[s.DNI + '|' + t] = segs[s.DNI + '|' + t] || []).push(s);
  });
```

En `src/Logica.gs`, `validarAccion`, reemplazar el `pacientes.some(...)`:
```js
  if (pacientes && !pacientes.some(function (x) {
    return x.DNI === normDni(p.dni) && normTexto(x.ESPECIALIDAD) === normTexto(p.especialidad) &&
      (p.referencia ? x.ID_REGISTRO === p.referencia : !x.ID_REGISTRO);
  })) {
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/logica-*.test.js`
Expected: PASS, todas, también las de `logica-tipos.test.js`.

- [ ] **Step 5: Commit**

```bash
git add src/Registro.gs src/Logica.gs test/logica-registro.test.js
git commit -m "Registro: estado por sesiones, filas de la bandeja y seguimientos por referencia"
```

---

### Task 3: Alta médica (lógica)

**Files:**
- Modify: `src/Registro.gs`, `src/Logica.gs` (`estadoDeSerie` ~línea 262, `armarPacientes` ~línea 551)
- Test: `test/logica-registro.test.js`

**Interfaces:**
- Consumes: `anulado_`, `enLista_`, `fechaDma_` y `textoLimpio_`.
- Produces:
  - **`validarAlta(p, catalogos, citas, vigentes, hoy) → { error, alta }`**
    - `p = { usuario, dni, especialidad, doctor, fecha, nota }`.
    - `alta = { FECHA, DNI, ESPECIALIDAD, DOCTOR, REGISTRADO_POR, NOTA, ANULADO: '', MOTIVO_ANULACION: '' }`.
  - **`altasVigentes(altas, seguimientos, citas) → { 'DNI|ESPECIALIDAD normalizada': { ID, FECHA, DNI, ESPECIALIDAD, DOCTOR, REGISTRADO_POR } }`**, la clave de `claveSerie`.
  - **`estadoDeSerie(serie, segs, reglas, hoy, alta)`** devuelve `estado: 'ALTA'` si `alta` existe.
  - **`armarPacientes(citas, indicaciones, seguimientos, reglas, hoy, contactos, altas)`**, con el mapa de `altasVigentes` como último parámetro opcional.

- [ ] **Step 1: Write the failing test** — agregar a `test/logica-registro.test.js`:

```js
test('validarAlta: consultas en esa especialidad, doctor del catálogo, fecha válida y sin alta vigente', () => {
  const citas = [cita({ fecha: '2026-08-01' }), cita({ fecha: '2026-09-10' })];
  const p = o => Object.assign({ usuario: 'magaly', dni: '40111222', especialidad: 'hematologia', doctor: 'Dr. Elí Cabanillas', fecha: '2026-09-10', nota: ' ok ' }, o);
  const v = (o, vig) => plano(L.validarAlta(p(o), CAT, citas, vig || {}, HOY));
  assert.deepEqual(v({}).alta, { FECHA: '2026-09-10', DNI: '40111222', ESPECIALIDAD: 'HEMATOLOGÍA', DOCTOR: 'Dr. Elí Cabanillas',
    REGISTRADO_POR: 'MAGALY', NOTA: 'ok', ANULADO: '', MOTIVO_ANULACION: '' });
  assert.match(v({ usuario: '' }).error, /Elija quién es usted/);
  assert.match(v({ especialidad: 'REUMATOLOGÍA' }).error, /no tiene consultas realizadas en REUMATOLOGÍA/);
  assert.match(v({ doctor: '' }).error, /doctor que da el alta/);
  assert.match(v({ fecha: '2026-10-06' }).error, /futura/);
  assert.match(v({ fecha: '2026-09-09' }).error, /anterior a la última consulta \(10\/09\/2026\)/);
  assert.match(v({}, { '40111222|HEMATOLOGIA': { FECHA: '2026-09-10' } }).error, /ya tiene un alta vigente/);
});

test('altasVigentes: sin anular y sin consultas posteriores; los descartes «ALTA MÉDICA» también cuentan', () => {
  const citas = [cita({ fecha: '2026-08-01' }), cita({ dni: '40222333', fecha: '2026-08-01' }), cita({ dni: '40222333', fecha: '2026-09-20' })];
  const alta = o => Object.assign({ ID: 'ALT-000001', FECHA: '2026-08-01', DNI: '40111222', ESPECIALIDAD: 'HEMATOLOGÍA', DOCTOR: 'Dr. Elí Cabanillas',
    REGISTRADO_POR: 'MAGALY', ANULADO: '' }, o);
  assert.deepEqual(Object.keys(plano(L.altasVigentes([alta()], [], citas))), ['40111222|HEMATOLOGIA']);
  assert.deepEqual(plano(L.altasVigentes([alta({ ANULADO: 'SÍ' })], [], citas)), {});
  assert.deepEqual(plano(L.altasVigentes([alta({ DNI: '40222333' })], [], citas)), {}, 'volvió después del alta');
  const desc = Object.assign(seg({ fecha: '2026-08-05', accion: 'DESCARTADO', motivo: 'Alta médica' }), {});
  const v = plano(L.altasVigentes([], [desc], citas))['40111222|HEMATOLOGIA'];
  assert.deepEqual([v.FECHA, v.DOCTOR, v.REGISTRADO_POR], ['2026-08-05', '', 'MAGALY']);
  const descHierro = Object.assign(seg({ fecha: '2026-08-05', esp: 'HIERRO', accion: 'DESCARTADO', motivo: 'ALTA MÉDICA' }), {});
  assert.deepEqual(plano(L.altasVigentes([], [descHierro], citas)), {});
});

test('estado ALTA: va antes que DESCARTADO y saca la serie de la bandeja', () => {
  const citas = [cita({ fecha: '2026-06-01' })];
  const vig = L.altasVigentes([{ ID: 'ALT-000001', FECHA: '2026-06-01', DNI: '40111222', ESPECIALIDAD: 'HEMATOLOGÍA', ANULADO: '' }], [], citas);
  const segs = [seg({ fecha: '2026-08-01', accion: 'DESCARTADO', motivo: 'OTRO' })];
  const p = plano(L.armarPacientes(citas, [], segs, reglas(L), HOY, [], vig));
  assert.equal(p[0].ESTADO, 'ALTA');
  assert.deepEqual(plano(L.ordenarBandeja(p)), []);
  assert.equal(plano(L.armarPacientes(citas, [], [], reglas(L), HOY))[0].ESTADO, 'VENCIDO', 'sin altas, como antes');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/logica-registro.test.js`
Expected: FAIL. `validarAlta is not a function`.

- [ ] **Step 3: Write minimal implementation**

Agregar a `src/Registro.gs`:

```js
/* ---------- Alta médica (por especialidad) ---------- */

function validarAlta(p, catalogos, citas, vigentes, hoy) {
  function no(m) { return { error: m, alta: null }; }
  if (!p) return no('Faltan los datos del alta.');
  var quien = enLista_(catalogos.usuarios, p.usuario);
  if (!quien) return no('Elija quién es usted en el selector de arriba.');
  var dni = normDni(p.dni);
  if (!dni) return no('Falta el DNI del paciente.');
  var k = claveSerie(dni, p.especialidad);
  var serie = armarSeries((citas || []).filter(function (c) { return c.DNI === dni; }))[k];
  if (!serie || !serie.realizadas.length) return no('Ese paciente no tiene consultas realizadas en ' + textoLimpio_(p.especialidad).toUpperCase() + '.');
  var doctor = (catalogos.doctores || []).filter(function (d) { return normTexto(d.doctor) === normTexto(p.doctor); })[0];
  if (!doctor) return no('Elija el doctor que da el alta.');
  var fecha = fechaIso(p.fecha), ultima = serie.realizadas[serie.realizadas.length - 1].FECHA;
  if (!fecha) return no('Falta la fecha del alta.');
  if (fecha > hoy) return no('La fecha no puede ser futura.');
  // Antes de la última consulta el alta quedaría cerrada al instante (hay una consulta posterior).
  if (fecha < ultima) return no('El alta no puede ser anterior a la última consulta (' + fechaDma_(ultima) + ').');
  if ((vigentes || {})[k]) return no('Ese paciente ya tiene un alta vigente en ' + serie.especialidad + '.');
  return { error: '', alta: { FECHA: fecha, DNI: dni, ESPECIALIDAD: serie.especialidad, DOCTOR: doctor.doctor, REGISTRADO_POR: quien,
    NOTA: textoLimpio_(p.nota), ANULADO: '', MOTIVO_ANULACION: '' } };
}

/**
 * Altas vigentes por serie (DNI + especialidad): sin anular y sin ninguna consulta realizada después.
 * Los descartes antiguos con motivo «ALTA MÉDICA» cuentan como altas con la fecha del seguimiento.
 */
function altasVigentes(altas, seguimientos, citas) {
  var series = armarSeries(citas), out = {}, candidatas = [];
  (altas || []).forEach(function (a) {
    if (anulado_(a)) return;
    candidatas.push({ ID: a.ID, FECHA: fechaIso(a.FECHA), DNI: normDni(a.DNI), ESPECIALIDAD: a.ESPECIALIDAD, DOCTOR: a.DOCTOR || '', REGISTRADO_POR: a.REGISTRADO_POR || '' });
  });
  (seguimientos || []).forEach(function (s) {
    if (normTexto(s.ACCION) !== 'DESCARTADO' || normTexto(s.MOTIVO) !== 'ALTA MEDICA' || TIPOS_INDICACION[normTexto(s.ESPECIALIDAD)]) return;
    candidatas.push({ ID: s.ID, FECHA: fechaIso(s.FECHA_HORA), DNI: normDni(s.DNI), ESPECIALIDAD: s.ESPECIALIDAD, DOCTOR: '', REGISTRADO_POR: s.RESPONSABLE || '' });
  });
  candidatas.forEach(function (a) {
    var k = claveSerie(a.DNI, a.ESPECIALIDAD), serie = series[k];
    if (!serie || !a.FECHA) return;
    if (serie.realizadas.some(function (c) { return c.FECHA > a.FECHA; })) return;
    if (!out[k] || a.FECHA > out[k].FECHA) out[k] = a;
  });
  return out;
}
```

En `src/Logica.gs`, `estadoDeSerie(serie, seguimientos, reglas, hoy, alta)`:
- Agregar el parámetro `alta` a la firma.
- Justo después de calcular `out.atraso`, y antes de leer los seguimientos, agregar:
```js
  // El alta va primero: el doctor cerró el seguimiento (diseño de Registro, §5bis).
  if (alta) { out.estado = 'ALTA'; return out; }
```
- Actualizar el comentario de la función: «ALTA, DESCARTADO, AGENDADO, …».

En `armarPacientes`:
- Firma: `function armarPacientes(citas, indicaciones, seguimientos, reglas, hoy, contactos, altas)`.
- La llamada pasa a `var e = estadoDeSerie(s, segs[k], reglas, hoy, (altas || {})[k]);`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/logica-*.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/Registro.gs src/Logica.gs test/logica-registro.test.js
git commit -m "Alta médica: validación, altas vigentes y estado ALTA de la serie"
```

---

### Task 4: Cifras con registros, completados y altas

**Files:**
- Modify: `src/Registro.gs`, `src/Logica.gs` (`pendientesPorDni` ~línea 524, `kpiCohortes` ~línea 731, `kpiIndicaciones` ~línea 768, `calcularKpi` ~línea 881, `CAMPOS_RESUMEN` y `resumenPorMes` ~línea 902)
- Test: `test/logica-registro.test.js`, `test/logica-kpi.test.js:14-33`

**Interfaces:**
- Consumes: `estadoRegistro`, `medicoDeRegistro`, `altasVigentes` y `frase_`.
- Produces:
  - **`indicacionesDeRegistros(registros, sesiones, catalogos, reglas, hoy) → indicaciones`**, con la forma de `COLUMNAS_INDICACIONES` más `COMPLETO: 'SÍ'|'NO'` y `EN_ESPERA: 'SÍ'|''`, y `ORIGEN: 'REGISTROS'`.
  - **`kpiCohortes(citas, reglas, hoy, altas)`**: cada fila suma `ALTAS`.
  - **`kpiIndicaciones`**: cada fila suma `COMPLETADAS` y salta `EN_ESPERA === 'SÍ'`.
  - **`resumenPorMes(citas, indicaciones, seguimientos, reglas, hoy, altas)`**: suma `NUEVOS_ALTA`, `CONTROL_ALTA` y `HIERRO_COMPLETO`.
  - **`calcularKpi(citas, indicaciones, seguimientos, reglas, hoy, contactos, altas)`**.

- [ ] **Step 1: Write the failing test** — agregar a `test/logica-registro.test.js`:

```js
test('indicacionesDeRegistros: cotizado = COTIZÓ, en curso o completo = ACEPTÓ; anulado no cuenta', () => {
  const r = [reg({ ID: 'REG-000001', FECHA: '2026-09-01' }), reg({ ID: 'REG-000002', FECHA: '2026-10-01' }),
    reg({ ID: 'REG-000003', SESIONES: '1', CONTACTO: '@rosa.q', DOCTOR: 'Dra. Karen Matos – Particular' }), reg({ ID: 'REG-000004', ANULADO: 'SÍ' })];
  const s = [ses(1, '2026-09-25', { ID_REGISTRO: 'REG-000003' })];
  const i = plano(L.indicacionesDeRegistros(r, s, CAT, reglas(L), HOY));
  assert.deepEqual(i.map(x => [x.ID, x.ESTADO, x.COMPLETO, x.EN_ESPERA]),
    [['REG-000001', 'COTIZÓ', 'NO', ''], ['REG-000002', 'COTIZÓ', 'NO', 'SÍ'], ['REG-000003', 'ACEPTÓ', 'SÍ', '']]);
  assert.deepEqual([i[0].TIPO, i[0].DETALLE, i[0].CANTIDAD, i[0].MEDICO_SOLICITANTE, i[0].TELEFONO, i[0].ORIGEN, i[0].DNI, i[0].FECHA],
    ['HIERRO', 'HIERRO CARBOXIMALTOSA', 3, 'Dr. ELÍ FABRIZIO CABANILLAS HUALPA', '987654321', 'REGISTROS', '40111222', '2026-09-01']);
  assert.deepEqual([i[2].TELEFONO, i[2].MEDICO_SOLICITANTE], ['', 'Dra. Karen Matos – Particular']);
});

test('kpiIndicaciones: completadas; lo que está en espera no se mide todavía', () => {
  const i = [
    { FECHA: '2026-09-01', TIPO: 'HIERRO', DETALLE: 'HIERRO CARBOXIMALTOSA', MEDICO_SOLICITANTE: 'Dr. A', ESTADO: 'ACEPTÓ', COMPLETO: 'NO' },
    { FECHA: '2026-09-02', TIPO: 'HIERRO', DETALLE: 'HIERRO CARBOXIMALTOSA', MEDICO_SOLICITANTE: 'Dr. A', ESTADO: 'ACEPTÓ', COMPLETO: 'SÍ' },
    { FECHA: '2026-09-03', TIPO: 'HIERRO', DETALLE: 'HIERRO CARBOXIMALTOSA', MEDICO_SOLICITANTE: 'Dr. A', ESTADO: 'COTIZÓ', COMPLETO: 'NO', EN_ESPERA: 'SÍ' }];
  assert.deepEqual(plano(L.kpiIndicaciones(i, [])), [{ MES: '2026-09', TIPO: 'HIERRO', DETALLE: 'HIERRO CARBOXIMALTOSA', MEDICO: 'Dr. A',
    INDICADAS: 2, ACEPTADAS: 2, COMPLETADAS: 1 }]);
});

test('cohortes: un alta vigente no cuenta como «no volvió», en la etapa en que se dio', () => {
  const citas = [cita({ dni: '1', fecha: '2026-06-01' }),
    cita({ dni: '2', fecha: '2026-06-01' }), cita({ dni: '2', fecha: '2026-06-20' }), cita({ dni: '3', fecha: '2026-06-02' })];
  const vig = L.altasVigentes([{ FECHA: '2026-06-01', DNI: '1', ESPECIALIDAD: 'HEMATOLOGÍA', ANULADO: '' },
    { FECHA: '2026-06-20', DNI: '2', ESPECIALIDAD: 'HEMATOLOGÍA', ANULADO: '' }], [], citas);
  const k = plano(L.kpiCohortes(citas, reglas(L), HOY, vig));
  assert.deepEqual(k.map(r => [r.ETAPA, r.ELEGIBLES, r.VOLVIERON, r.ALTAS]), [[1, 2, 1, 1], [2, 0, 0, 1]]);
});

test('resumenPorMes: altas aparte y hierro completado', () => {
  const citas = [cita({ dni: '1', fecha: '2026-07-01' }), cita({ dni: '2', fecha: '2026-07-02' })];
  const vig = L.altasVigentes([{ FECHA: '2026-07-01', DNI: '1', ESPECIALIDAD: 'HEMATOLOGÍA', ANULADO: '' }], [], citas);
  const ind = o => Object.assign({ TIPO: 'HIERRO', DETALLE: 'HIERRO CARBOXIMALTOSA', MEDICO_SOLICITANTE: 'Dra. KAREN DIANA MATOS PEÑA' }, o);
  const inds = [ind({ ID: 'R1', FECHA: '2026-07-03', DNI: '1', ESTADO: 'ACEPTÓ', COMPLETO: 'SÍ' }),
    ind({ ID: 'R2', FECHA: '2026-07-04', DNI: '2', ESTADO: 'ACEPTÓ', COMPLETO: 'NO' }),
    ind({ ID: 'R3', FECHA: '2026-07-05', DNI: '3', ESTADO: 'COTIZÓ', COMPLETO: 'NO', EN_ESPERA: 'SÍ' })];
  const jul = plano(L.resumenPorMes(citas, inds, [], reglas(L), HOY, vig)).find(x => x.MES === '2026-07' && x.MEDICO === 'Dra. KAREN DIANA MATOS PEÑA');
  assert.deepEqual([jul.NUEVOS, jul.NUEVOS_NO, jul.NUEVOS_ALTA, jul.HIERRO, jul.HIERRO_NO, jul.HIERRO_COMPLETO], [2, 1, 1, 2, 0, 1]);
});

test('el texto de pendiente de una reevaluación nombra el hierro registrado, no «Ferinject» a ciegas', () => {
  const p = L.pendientesPorDni([{ DNI: '1', TIPO: 'HIERRO', DETALLE: 'HIERRO SACARATO', ESTADO: 'COTIZÓ', FECHA: '2026-09-01', CANTIDAD: 2 }]);
  assert.equal(p['1'][0], 'Hierro sacarato ×2: cotizó y no lo hizo');
});
```

En `test/logica-kpi.test.js`:
- **Prueba de cohortes (líneas 15-19):** agregar `ALTAS: 0` a cada objeto esperado.
- **Prueba de `kpiIndicaciones` (líneas 30-33):** agregar `COMPLETADAS: 1` a la fila con `ACEPTADAS: 1` y `COMPLETADAS: 0` a la de `ACEPTADAS: 0`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/logica-registro.test.js test/logica-kpi.test.js`
Expected: FAIL. Falta `indicacionesDeRegistros` y los campos nuevos.

- [ ] **Step 3: Write minimal implementation**

Agregar a `src/Registro.gs`:

```js
/* ---------- Registros como indicaciones (para las cifras y los teléfonos) ---------- */

function indicacionesDeRegistros(registros, sesiones, catalogos, reglas, hoy) {
  return (registros || []).map(function (r) {
    var e = estadoRegistro(r, sesiones);
    if (e.estado === 'ANULADO') return null;
    var tel = normTelefono(r.CONTACTO), fecha = fechaIso(r.FECHA);
    return {
      ID: r.ID, FECHA: fecha, TIPO: normTexto(r.TIPO), DETALLE: r.DETALLE, CANTIDAD: e.total,
      MEDICO_SOLICITANTE: medicoDeRegistro(r, catalogos), ASESORA: r.ASESORA, NOMBRE: r.NOMBRE,
      TELEFONO: tel.length === 9 ? tel : '', ESTADO: e.estado === 'COTIZADO' ? 'COTIZÓ' : 'ACEPTÓ',
      OBSERVACIONES: '', DNI: normDni(r.DNI), EMPAREJAMIENTO: 'REGISTRO', ORIGEN: 'REGISTROS',
      COMPLETO: e.estado === 'COMPLETO' ? 'SÍ' : 'NO',
      // Un cotizado dentro de su espera todavía no es «no siguió».
      EN_ESPERA: e.estado === 'COTIZADO' && fecha && diasEntre(fecha, hoy) < reglas.esperaCotizacion ? 'SÍ' : ''
    };
  }).filter(Boolean);
}
```

En `src/Logica.gs`:

1. **`pendientesPorDni`.** La línea `var texto = …` pasa a ser:
```js
    var nombre = i.TIPO === 'HIERRO' ? (normTexto(i.DETALLE) === 'HIERRO' ? 'Hierro (Ferinject)' : frase_(i.DETALLE)) : (i.DETALLE || 'Procedimiento');
    var texto = nombre + (cantidad > 1 ? ' ×' + cantidad : '') + ': cotizó y no lo hizo';
```
   `frase_` está en `Logica.gs` desde la Task 1, así que las pruebas actuales cargan igual.

2. **`kpiCohortes(citas, reglas, hoy, altas)`.** Reemplazar el cuerpo del `for`:
```js
    for (var etapa = 1; etapa <= 3 && r.length >= etapa; etapa++) {
      var volvio = r.length >= etapa + 1;
      var alta = !volvio && !!(altas && altas[k]);
      var enCurso = !volvio && !alta && sumarDias(r[etapa - 1].FECHA, plazo.vence) > hoy;
      // En curso solo interesa en la 1.ª: «solo vino a su primera consulta, pero aún está en plazo».
      if (enCurso && etapa > 1) continue;
      var clave = [mesDe(r[0].FECHA), s.especialidad, r[0].MEDICO, etapa].join('|');
      if (!acc[clave]) acc[clave] = { COHORTE: mesDe(r[0].FECHA), ESPECIALIDAD: s.especialidad, MEDICO: r[0].MEDICO, ETAPA: etapa, ELEGIBLES: 0, VOLVIERON: 0, EN_CURSO: 0, ALTAS: 0 };
      // Con alta vigente no volvió porque el doctor lo dio de alta: no es una pérdida.
      if (alta) { acc[clave].ALTAS++; continue; }
      if (enCurso) { acc[clave].EN_CURSO++; continue; }
      acc[clave].ELEGIBLES++;
      if (volvio) acc[clave].VOLVIERON++;
    }
```

3. **`kpiIndicaciones`.**
   - Al inicio del `forEach`: `if (i.EN_ESPERA === 'SÍ') return;`.
   - El objeto inicial suma `COMPLETADAS: 0`.
   - Después de `if (i.ESTADO === 'ACEPTÓ') acc[clave].ACEPTADAS++;`:
```js
    if (i.ESTADO === 'ACEPTÓ' && i.COMPLETO !== 'NO') acc[clave].COMPLETADAS++;
```

4. **`calcularKpi(citas, indicaciones, seguimientos, reglas, hoy, contactos, altas)`.** `cohortes: kpiCohortes(citas, reglas, hoy, altas)`.

5. **`CAMPOS_RESUMEN`:**
```js
var CAMPOS_RESUMEN = ['NUEVOS', 'NUEVOS_NO', 'NUEVOS_CURSO', 'NUEVOS_ALTA', 'CONTROL', 'CONTROL_NO', 'CONTROL_CURSO', 'CONTROL_ALTA',
  'HIERRO', 'HIERRO_NO', 'HIERRO_COMPLETO', 'PROC', 'PROC_NO', 'SEGUIMIENTOS', 'RECUPERADOS'];
```

6. **`resumenPorMes(citas, indicaciones, seguimientos, reglas, hoy, altas)`.**
   - **En el bloque de reevaluaciones**, después de `if (siguiente) return;`:
```js
      if (altas && altas[k]) { f[tipo + '_ALTA']++; return; }
```
   - **En el bloque de hierro y procedimientos:**
     - `aceptado` guarda también si estaba completo.
     - Las filas `EN_ESPERA` se saltan.
     - Cada grupo sabe si está completo.

     Reemplazar desde `var porDni = realizadasPorDni_(citas), grupos = {}, aceptado = {};` hasta el final de su `Object.keys(grupos).forEach` por:
```js
  var porDni = realizadasPorDni_(citas), grupos = {}, aceptado = {}, completoDe = {};
  (indicaciones || []).forEach(function (i) {
    if (i.DNI && i.ESTADO === 'ACEPTÓ') {
      var a = i.DNI + '|' + i.TIPO;
      if (!aceptado[a] || i.FECHA > aceptado[a]) { aceptado[a] = i.FECHA; completoDe[a] = i.COMPLETO !== 'NO'; }
    }
  });
  (indicaciones || []).forEach(function (i) {
    if (!i.FECHA || i.EN_ESPERA === 'SÍ') return;
    var g = [i.DNI || i.ID, i.TIPO, mesDe(i.FECHA)].join('|');
    if (!grupos[g]) {
      var previa = i.DNI ? ultimaAntesDe_(porDni[i.DNI], i.FECHA) : null;
      grupos[g] = { mes: mesDe(i.FECHA), tipo: i.TIPO, dni: i.DNI, primera: i.FECHA,
        medico: i.MEDICO_SOLICITANTE || (previa ? previa.MEDICO : '') || 'SIN MÉDICO', acepto: false, completo: false };
    }
    if (i.FECHA < grupos[g].primera) grupos[g].primera = i.FECHA;
    if (i.ESTADO === 'ACEPTÓ') { grupos[g].acepto = true; if (i.COMPLETO !== 'NO') grupos[g].completo = true; }
  });
  Object.keys(grupos).forEach(function (k) {
    var g = grupos[k], clave = g.dni + '|' + g.tipo;
    var siguio = g.acepto || (g.dni && aceptado[clave] >= g.primera);
    var completo = g.acepto ? g.completo : !!(siguio && completoDe[clave]);
    var campo = g.tipo === 'HIERRO' ? 'HIERRO' : 'PROC';
    var f = fila(g.mes, g.medico);
    f[campo]++;
    if (!siguio) f[campo + '_NO']++;
    if (campo === 'HIERRO' && siguio && completo) f.HIERRO_COMPLETO++;
  });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/logica-*.test.js`
Expected: PASS, todas, incluidas las de `logica-resumen.test.js`, `logica-kpi.test.js` y `logica-tipos.test.js`.

- [ ] **Step 5: Commit**

```bash
git add src/Registro.gs src/Logica.gs test/
git commit -m "Cifras: registros como indicaciones, tratamientos completados y altas fuera de «no volvió»"
```

---
### Task 5: Funciones del servidor (Registro, sesiones, altas) y `datos_`

**Files:**
- Create: `src/RegistroServidor.gs`
- Modify: `src/Codigo.gs` (`COLUMNAS_SEGUIMIENTOS` línea 18; `COLUMNAS_NUMERICAS` línea 25; lectores ~línea 164; `datos_` ~línea 195; `bootstrap`, `getPaciente`, `registrar_`, `getKpi` y `getResumen`)
- Test: `test/registro-servidor.test.js` (nuevo), `test/sintaxis.test.js`

**Interfaces:**
- Consumes: todas las funciones de `Registro.gs` de las Tasks 1–4.
- Produces (públicas, para `google.script.run`):
  - **Registro:**
    - `guardarRegistro(p) → { ok: true, registros: [{…fila, ID, FECHA_HORA, TEXTO}] }` o `{ ok: false, duplicado: { ID, FECHA, TEXTO } }`. Con `p.confirmado = true` no se revisa el duplicado.
    - `anularRegistro({ usuario, id, motivo }) → { ok: true }`
  - **Sesiones:**
    - `marcarSesion({ usuario, id, fecha, nota }) → { ok: true, sesion, completo: bool }`
    - `anularSesion({ usuario, id, motivo })`
  - **Altas:**
    - `darDeAlta({ usuario, dni, especialidad, doctor, fecha, nota }) → { ok: true, alta }`
    - `anularAlta({ usuario, id, motivo })`
  - **Consultas:**
    - `getRegistrosHoy() → [{ ID, HORA, ASESORA, NOMBRE, DNI, TEXTO, ANULADO: bool }]`, de la más reciente a la más antigua.
    - `buscarPacienteRegistro(dni) → { encontrado: false }` o `{ encontrado: true, nombre, telefonos: [], ultimaFecha, ultimoMedico, doctor, especialidades: [{ especialidad, alta: bool }] }`
- Produces (internas):
  - **Lectores:** `leerOpcional_(nombre)`, `leerRegistros_()`, `leerSesiones_()` y `leerAltas_()`.
  - **Anulación:** `marcarAnulado_(hoja, id, motivo)`.
  - **Usuario:** `exigirUsuario_(catalogos, usuario) → nombre del catálogo`, que lanza un error si no está.
  - **`datos_()`** suma `registros`, `sesiones`, `altas`, `indicacionesTodas`, `vigentes` y `pendientes` (histórico + registros).
  - **`bootstrap()`** suma `doctores: [{ doctor, sofdoc }]`, `procedimientos`, `tratamientos` y `marcas`.
  - **`getPaciente(dni)`** suma `registros` (con `sesiones`) y `altas` (con `VIGENTE`).

- [ ] **Step 1: Write the failing test** — crear `test/registro-servidor.test.js`:

```js
// Funciones del servidor de la pestaña Registro, con dobles de las hojas. Datos inventados.
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar, plano } = require('./cargar');
const { cita, reglas } = require('./fixtures');

const CAT = { usuarios: ['MAGALY'], motivos: ['OTRO'], alias: {},
  doctores: [{ doctor: 'Dra. Karen Matos', sofdoc: 'Dra. KAREN DIANA MATOS PEÑA' }],
  procedimientos: ['SANGRÍA'], tratamientos: ['HIERRO SACARATO'], marcas: {} };
const REG4 = { ID: 'REG-000004', FECHA_HORA: '2026-10-01 09:00', FECHA: '2026-10-01', ASESORA: 'MAGALY', DOCTOR: 'Dra. Karen Matos',
  NOMBRE: 'ROSA QUISPE', DNI: '40111222', CONTACTO: '987654321', TIPO: 'PROCEDIMIENTO', DETALLE: 'SANGRÍA', MARCA: '', SESIONES: '1', ANULADO: '' };

function servidor(extra, hojas) {
  const ctx = cargar(['Logica.gs', 'Registro.gs', 'Codigo.gs', 'RegistroServidor.gs']);
  const escrito = { REGISTROS: [], SESIONES: [], ALTAS: [], BITACORA: [], anulados: [] };
  const lock = { tomado: 0 };
  const L = cargar(['Logica.gs', 'Registro.gs']);
  ctx.datos_ = () => Object.assign({ hoy: '2026-10-05', catalogos: CAT, reglas: reglas(L), citas: [cita({ fecha: '2026-09-01' })],
    registros: [REG4], sesiones: [], altas: [], vigentes: {}, indicacionesTodas: [], contactos: [] }, extra);
  ctx.bloquear_ = () => { lock.tomado++; return { releaseLock: () => { lock.tomado--; } }; };
  ctx.leerOpcional_ = n => ((hojas || {})[n] || []).concat(escrito[n] || []);
  ctx.anexarObjeto_ = (n, cols, o) => { assert.equal(lock.tomado, 1, 'se escribe con el candado tomado'); escrito[n].push(plano(o)); };
  ctx.bitacora_ = (u, a, d) => escrito.BITACORA.push([u, a, d]);
  ctx.fechaHoraTexto_ = () => '2026-10-05 10:30';
  ctx.marcarAnulado_ = (n, id, motivo) => { assert.equal(lock.tomado, 1); escrito.anulados.push([n, id, motivo]); };
  return { ctx, escrito, lock };
}
const datosReg = o => Object.assign({ usuario: 'MAGALY', dni: '40111222', nombre: 'Rosa Quispe', contacto: '987654321', fecha: '2026-10-05',
  doctor: 'Dra. Karen Matos', procedimiento: 'SANGRÍA', tratamiento: '', sesiones: '', marca: '' }, o);

test('guardarRegistro: lo inválido no toma el candado ni escribe', () => {
  const { ctx, escrito, lock } = servidor();
  assert.throws(() => ctx.guardarRegistro(datosReg({ usuario: '' })), /Elija quién es usted/);
  assert.deepEqual([escrito.REGISTROS.length, lock.tomado], [0, 0]);
});

test('guardarRegistro: avisa del duplicado sin escribir; confirmado escribe con IDs leídos dentro del candado', () => {
  const { ctx, escrito } = servidor({}, { REGISTROS: [REG4, Object.assign({}, REG4, { ID: 'REG-000009', DNI: '40999888' })] });
  assert.deepEqual(plano(ctx.guardarRegistro(datosReg())), { ok: false, duplicado: { ID: 'REG-000004', FECHA: '2026-10-01', TEXTO: 'Sangría' } });
  assert.equal(escrito.REGISTROS.length, 0);
  const r = plano(ctx.guardarRegistro(datosReg({ confirmado: true, tratamiento: 'HIERRO SACARATO', sesiones: '2' })));
  assert.equal(r.ok, true);
  assert.deepEqual(escrito.REGISTROS.map(x => [x.ID, x.FECHA_HORA, x.TIPO]),
    [['REG-000010', '2026-10-05 10:30', 'PROCEDIMIENTO'], ['REG-000011', '2026-10-05 10:30', 'HIERRO']], 'otra asesora guardó REG-000009 entretanto');
  assert.deepEqual(r.registros.map(x => x.TEXTO), ['Sangría', 'Hierro sacarato × 2 sesiones']);
  assert.deepEqual(escrito.BITACORA.map(b => b[1]), ['REGISTRO', 'REGISTRO']);
});

test('marcarSesion: numera la siguiente sesión y no deja pasar de las indicadas', () => {
  const { ctx, escrito } = servidor({}, { REGISTROS: [REG4] });
  const r = plano(ctx.marcarSesion({ usuario: 'MAGALY', id: 'REG-000004', fecha: '2026-10-04', nota: 'ok' }));
  assert.deepEqual([r.ok, r.completo], [true, true]);
  assert.deepEqual(escrito.SESIONES.map(s => [s.ID, s.ID_REGISTRO, s.NUMERO, s.FECHA, s.ASESORA]), [['SES-000001', 'REG-000004', 1, '2026-10-04', 'MAGALY']]);
  assert.throws(() => ctx.marcarSesion({ usuario: 'MAGALY', id: 'REG-000004', fecha: '2026-10-05' }), /todas sus sesiones/);
  assert.throws(() => ctx.marcarSesion({ usuario: 'MAGALY', id: 'REG-000999', fecha: '2026-10-05' }), /No encontré/);
});

test('anular: motivo obligatorio; solo la última sesión; las altas antiguas por descarte no se anulan aquí', () => {
  const s = (id, n) => ({ ID: id, ID_REGISTRO: 'REG-000004', NUMERO: String(n), FECHA: '2026-10-0' + n, ANULADO: '' });
  const { ctx, escrito } = servidor({}, { REGISTROS: [REG4], SESIONES: [s('SES-000001', 1), s('SES-000002', 2)] });
  assert.throws(() => ctx.anularRegistro({ usuario: 'MAGALY', id: 'REG-000004', motivo: ' ' }), /motivo/);
  ctx.anularRegistro({ usuario: 'MAGALY', id: 'REG-000004', motivo: 'Error de DNI' });
  assert.throws(() => ctx.anularSesion({ usuario: 'MAGALY', id: 'SES-000001', motivo: 'x' }), /última sesión/);
  ctx.anularSesion({ usuario: 'MAGALY', id: 'SES-000002', motivo: 'Fecha equivocada' });
  assert.throws(() => ctx.anularAlta({ usuario: 'MAGALY', id: 'SEG-1', motivo: 'x' }), /descarte antiguo/);
  assert.deepEqual(escrito.anulados, [['REGISTROS', 'REG-000004', 'Error de DNI'], ['SESIONES', 'SES-000002', 'Fecha equivocada']]);
});

test('darDeAlta: valida y escribe ALT-…', () => {
  const { ctx, escrito } = servidor();
  assert.throws(() => ctx.darDeAlta({ usuario: 'MAGALY', dni: '40111222', especialidad: 'HEMATOLOGÍA', doctor: '', fecha: '2026-10-05' }), /doctor/);
  const r = plano(ctx.darDeAlta({ usuario: 'MAGALY', dni: '40111222', especialidad: 'HEMATOLOGÍA', doctor: 'Dra. Karen Matos', fecha: '2026-10-05', nota: '' }));
  assert.equal(r.alta.ID, 'ALT-000001');
  assert.deepEqual(escrito.ALTAS.map(a => [a.ID, a.DNI, a.ESPECIALIDAD, a.DOCTOR, a.REGISTRADO_POR]), [['ALT-000001', '40111222', 'HEMATOLOGÍA', 'Dra. Karen Matos', 'MAGALY']]);
});

test('getRegistrosHoy: registros y altas de hoy, lo más reciente primero', () => {
  const ayer = Object.assign({}, REG4, { ID: 'REG-000003', FECHA_HORA: '2026-10-04 18:00' });
  const hoy1 = Object.assign({}, REG4, { ID: 'REG-000005', FECHA_HORA: '2026-10-05 09:15', ANULADO: 'SÍ' });
  const alta = { ID: 'ALT-000001', FECHA_HORA: '2026-10-05 11:00', FECHA: '2026-10-05', DNI: '40111222', ESPECIALIDAD: 'HEMATOLOGÍA',
    DOCTOR: 'Dra. Karen Matos', REGISTRADO_POR: 'MAGALY', ANULADO: '' };
  const { ctx } = servidor({ registros: [ayer, hoy1], altas: [alta] });
  assert.deepEqual(plano(ctx.getRegistrosHoy()), [
    { ID: 'ALT-000001', HORA: '11:00', ASESORA: 'MAGALY', NOMBRE: 'ROSA ELENA QUISPE HUAMAN', DNI: '40111222', TEXTO: 'Alta médica · HEMATOLOGÍA · Dra. Karen Matos', ANULADO: false },
    { ID: 'REG-000005', HORA: '09:15', ASESORA: 'MAGALY', NOMBRE: 'ROSA QUISPE', DNI: '40111222', TEXTO: 'Sangría', ANULADO: true }]);
});

test('buscarPacienteRegistro: datos del paciente conocido y propuesta de doctor', () => {
  const c = [cita({ fecha: '2026-09-01', medico: 'Dra. KAREN DIANA MATOS PEÑA' })];
  const { ctx } = servidor({ citas: c, indicacionesTodas: [{ DNI: '40111222', TELEFONO: '912345678' }] });
  assert.deepEqual(plano(ctx.buscarPacienteRegistro('40111222')), { encontrado: true, nombre: 'ROSA ELENA QUISPE HUAMAN', telefonos: ['912345678'],
    ultimaFecha: '2026-09-01', ultimoMedico: 'Dra. KAREN DIANA MATOS PEÑA', doctor: 'Dra. Karen Matos',
    especialidades: [{ especialidad: 'HEMATOLOGÍA', alta: false }] });
  assert.deepEqual(plano(ctx.buscarPacienteRegistro('40000000')), { encontrado: false });
});

test('marcarAnulado_ escribe SÍ y el motivo en la fila de ese ID, y no anula dos veces', () => {
  const ctx = cargar(['Logica.gs', 'Registro.gs', 'Codigo.gs', 'RegistroServidor.gs']);
  const v = [['ID', 'ANULADO', 'MOTIVO_ANULACION'], ['REG-000001', '', ''], ['REG-000002', '', '']];
  ctx.hoja_ = () => ({ getDataRange: () => ({ getValues: () => v.map(f => f.slice()) }),
    getRange: (r, c) => ({ setValue: x => { v[r - 1][c - 1] = x; } }) });
  ctx.marcarAnulado_('REGISTROS', 'REG-000002', 'Error');
  assert.deepEqual(v[2], ['REG-000002', 'SÍ', 'Error']);
  assert.throws(() => ctx.marcarAnulado_('REGISTROS', 'REG-000002', 'x'), /ya estaba anulado/);
  assert.throws(() => ctx.marcarAnulado_('REGISTROS', 'REG-000009', 'x'), /No encontré/);
});
```

En `test/sintaxis.test.js`, la primera prueba pasa a cargar `['Logica.gs', 'Registro.gs', 'Codigo.gs', 'RegistroServidor.gs']`. Su lista de funciones suma:
`'guardarRegistro', 'marcarSesion', 'anularRegistro', 'anularSesion', 'darDeAlta', 'anularAlta', 'getRegistrosHoy', 'buscarPacienteRegistro'`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/registro-servidor.test.js test/sintaxis.test.js`
Expected: FAIL. Falta `src/RegistroServidor.gs`.

- [ ] **Step 3: Write minimal implementation**

En `src/Codigo.gs`:

```js
var COLUMNAS_SEGUIMIENTOS = ['ID', 'FECHA_HORA', 'DNI', 'ESPECIALIDAD', 'RESPONSABLE', 'ACCION', 'MOTIVO', 'NOTA', 'REFERENCIA'];
```
```js
var COLUMNAS_NUMERICAS = { N_REALIZADAS: 1, DIAS_ATRASO: 1, N_SEGUIMIENTOS: 1, CANTIDAD: 1, PAGO: 1, SESIONES: 1, NUMERO: 1 };
```

Después de `leerContactos_`:

```js
/** Una hoja que puede no existir todavía (antes de «Preparar hojas»): vacía en vez de error. */
function leerOpcional_(nombre) {
  return ss_().getSheetByName(nombre) ? leerObjetos_(nombre) : [];
}

function leerRegistros_() {
  var r = leerOpcional_('REGISTROS');
  r.forEach(function (x) { x.DNI = normDni(x.DNI); x.TIPO = normTexto(x.TIPO); });
  return r;
}

function leerSesiones_() {
  return leerOpcional_('SESIONES');
}

function leerAltas_() {
  var a = leerOpcional_('ALTAS');
  a.forEach(function (x) { x.DNI = normDni(x.DNI); });
  return a;
}
```

`datos_()` completo:

```js
function datos_() {
  if (MEMO.datos) return MEMO.datos;
  var d = {
    hoy: hoy_(),
    reglas: reglas_(),
    catalogos: catalogos_(),
    citas: leerCitas_(),
    indicaciones: leerIndicaciones_(),
    seguimientos: leerSeguimientos_(),
    contactos: leerContactos_(),
    registros: leerRegistros_(),
    sesiones: leerSesiones_(),
    altas: leerAltas_()
  };
  // Historial (INDICACIONES) + Registro: lo que cuenta en cifras, teléfonos y pendientes.
  d.indicacionesTodas = d.indicaciones.concat(indicacionesDeRegistros(d.registros, d.sesiones, d.catalogos, d.reglas, d.hoy));
  d.vigentes = altasVigentes(d.altas, d.seguimientos, d.citas);
  d.pacientes = armarPacientes(d.citas, d.indicacionesTodas, d.seguimientos, d.reglas, d.hoy, d.contactos, d.vigentes);
  d.pendientes = pendientesIndicacion(d.citas, d.indicacionesTodas, d.seguimientos, d.reglas, d.hoy, d.contactos)
    .concat(pendientesRegistro({ registros: d.registros, sesiones: d.sesiones, seguimientos: d.seguimientos, citas: d.citas,
      reglas: d.reglas, hoy: d.hoy, telefonos: telefonosPorDni(d.indicacionesTodas, d.contactos), catalogos: d.catalogos }));
  MEMO.datos = d;
  return d;
}
```

`bootstrap()`. En el objeto devuelto, después de `medicos`:
```js
    medicos: Object.keys(med).sort(),
    doctores: d.catalogos.doctores,
    procedimientos: d.catalogos.procedimientos,
    tratamientos: d.catalogos.tratamientos,
    marcas: d.catalogos.marcas
```
y, antes del `return`, suma los médicos de las filas de hierro y procedimientos:
```js
  d.pendientes.forEach(function (p) { if (p.MEDICO_ULTIMO) med[p.MEDICO_ULTIMO] = 1; });
```

`getPaciente(dni)`. En el objeto devuelto, después de `seguimientos`:
```js
    seguimientos: d.seguimientos.filter(function (s) { return s.DNI === k; }),
    registros: d.registros.filter(function (r) { return r.DNI === k; }).map(function (r) {
      var e = estadoRegistro(r, d.sesiones);
      return { ID: r.ID, FECHA: fechaIso(r.FECHA), TIPO: r.TIPO, TEXTO: textoRegistro(r), DOCTOR: r.DOCTOR, ASESORA: r.ASESORA,
        SESIONES: e.total, ESTADO: e.estado, MOTIVO_ANULACION: r.MOTIVO_ANULACION || '',
        sesiones: sesionesDe_(r.ID, d.sesiones).map(function (s) {
          return { ID: s.ID, NUMERO: Number(s.NUMERO), FECHA: fechaIso(s.FECHA), ASESORA: s.ASESORA };
        }) };
    }),
    altas: d.altas.filter(function (a) { return a.DNI === k; }).map(function (a) {
      var v = d.vigentes[claveSerie(k, a.ESPECIALIDAD)];
      return { ID: a.ID, FECHA: fechaIso(a.FECHA), ESPECIALIDAD: a.ESPECIALIDAD, DOCTOR: a.DOCTOR, REGISTRADO_POR: a.REGISTRADO_POR,
        ANULADO: anulado_(a), MOTIVO_ANULACION: a.MOTIVO_ANULACION || '', VIGENTE: !!(v && v.ID === a.ID) };
    })
```

`registrar_(p, accion)`:
- El objeto `s` suma `REFERENCIA: textoLimpio_(p.referencia)`.
- La línea de bitácora pasa a `s.DNI + ' · ' + s.ESPECIALIDAD + (s.REFERENCIA ? ' · ' + s.REFERENCIA : '')`.

`getKpi()`:
```js
  var kpi = calcularKpi(d.citas, d.indicacionesTodas, d.seguimientos, d.reglas, d.hoy, d.contactos, d.vigentes);
```

`getResumen()`:
```js
  var filas = resumenPorMes(d.citas, d.indicacionesTodas, d.seguimientos, d.reglas, d.hoy, d.vigentes);
```

Crear `src/RegistroServidor.gs`:

```js
/* ==========================================================================
   FUNCIONES DE LA PESTAÑA REGISTRO (las llama la app por google.script.run)

   Escriben REGISTROS, SESIONES y ALTAS siempre con el candado tomado, y
   releen los IDs DENTRO del candado: dos asesoras registran a la vez.
   Nunca se borra una fila: se anula (ANULADO = SÍ + motivo).
   ========================================================================== */

function exigirUsuario_(catalogos, usuario) {
  var u = enLista_(catalogos.usuarios, usuario);
  if (!u) throw new Error('Elija quién es usted en el selector de arriba.');
  return u;
}

function exigirMotivo_(p) {
  var m = textoLimpio_(p && p.motivo);
  if (!m) throw new Error('Escriba el motivo de la anulación.');
  return m;
}

function guardarRegistro(p) {
  var d = datos_();
  var v = validarRegistro(p, d.catalogos, d.hoy);
  if (v.error) throw new Error(v.error);
  if (!(p && p.confirmado)) {
    for (var i = 0; i < v.filas.length; i++) {
      var dup = duplicadoReciente(d.registros, v.filas[i]);
      if (dup) return limpiarParaEnvio({ ok: false, duplicado: { ID: dup.ID, FECHA: fechaIso(dup.FECHA), TEXTO: textoRegistro(dup) } });
    }
  }
  var lock = bloquear_();
  try {
    var ids = leerOpcional_('REGISTROS').map(function (r) { return r.ID; });
    var ahora = fechaHoraTexto_(new Date());
    v.filas.forEach(function (f) {
      f.ID = siguienteId(ids, 'REG');
      ids.push(f.ID);
      f.FECHA_HORA = ahora;
      anexarObjeto_('REGISTROS', COLUMNAS_REGISTROS, f);
      bitacora_(f.ASESORA, 'REGISTRO', f.ID + ' · ' + f.DNI + ' · ' + textoRegistro(f));
      f.TEXTO = textoRegistro(f);
    });
    return limpiarParaEnvio({ ok: true, registros: v.filas });
  } finally {
    lock.releaseLock();
  }
}

function marcarSesion(p) {
  var d = datos_();
  var asesora = exigirUsuario_(d.catalogos, p && p.usuario);
  var lock = bloquear_();
  try {
    var sesiones = leerSesiones_(), id = textoLimpio_(p.id);
    var r = leerRegistros_().filter(function (x) { return x.ID === id; })[0];
    var error = validarSesion(r, sesiones, p.fecha, d.hoy);
    if (error) throw new Error(error);
    var e = estadoRegistro(r, sesiones);
    var s = { ID: siguienteId(sesiones.map(function (x) { return x.ID; }), 'SES'), FECHA_HORA: fechaHoraTexto_(new Date()),
      ID_REGISTRO: r.ID, NUMERO: e.hechas + 1, FECHA: fechaIso(p.fecha), ASESORA: asesora, NOTA: textoLimpio_(p.nota),
      ANULADO: '', MOTIVO_ANULACION: '' };
    anexarObjeto_('SESIONES', COLUMNAS_SESIONES, s);
    bitacora_(asesora, 'SESIÓN', r.ID + ' · sesión ' + s.NUMERO + ' de ' + e.total);
    return limpiarParaEnvio({ ok: true, sesion: s, completo: s.NUMERO >= e.total });
  } finally {
    lock.releaseLock();
  }
}

function anularRegistro(p) {
  var d = datos_(), quien = exigirUsuario_(d.catalogos, p && p.usuario), motivo = exigirMotivo_(p);
  var lock = bloquear_();
  try {
    marcarAnulado_('REGISTROS', textoLimpio_(p.id), motivo);
    bitacora_(quien, 'ANULAR REGISTRO', textoLimpio_(p.id) + ' · ' + motivo);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function anularSesion(p) {
  var d = datos_(), quien = exigirUsuario_(d.catalogos, p && p.usuario), motivo = exigirMotivo_(p);
  var lock = bloquear_();
  try {
    var v = validarAnulacionSesion(textoLimpio_(p.id), leerSesiones_());
    if (v.error) throw new Error(v.error);
    marcarAnulado_('SESIONES', v.sesion.ID, motivo);
    bitacora_(quien, 'ANULAR SESIÓN', v.sesion.ID + ' (' + v.sesion.ID_REGISTRO + ') · ' + motivo);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function darDeAlta(p) {
  var d = datos_();
  var v = validarAlta(p, d.catalogos, d.citas, d.vigentes, d.hoy);
  if (v.error) throw new Error(v.error);
  var lock = bloquear_();
  try {
    var a = v.alta;
    a.ID = siguienteId(leerAltas_().map(function (x) { return x.ID; }), 'ALT');
    a.FECHA_HORA = fechaHoraTexto_(new Date());
    anexarObjeto_('ALTAS', COLUMNAS_ALTAS, a);
    bitacora_(a.REGISTRADO_POR, 'ALTA', a.ID + ' · ' + a.DNI + ' · ' + a.ESPECIALIDAD + ' · ' + a.DOCTOR);
    return limpiarParaEnvio({ ok: true, alta: a });
  } finally {
    lock.releaseLock();
  }
}

function anularAlta(p) {
  var d = datos_(), quien = exigirUsuario_(d.catalogos, p && p.usuario), motivo = exigirMotivo_(p), id = textoLimpio_(p.id);
  if (id.indexOf('ALT-') !== 0) throw new Error('Esa alta viene de un descarte antiguo; no se puede anular desde aquí.');
  var lock = bloquear_();
  try {
    marcarAnulado_('ALTAS', id, motivo);
    bitacora_(quien, 'ANULAR ALTA', id + ' · ' + motivo);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

/** Marca ANULADO = SÍ y el motivo en la fila de ese ID. Solo esas dos celdas: no pisa nada más. */
function marcarAnulado_(nombre, id, motivo) {
  var sh = hoja_(nombre), v = sh.getDataRange().getValues();
  var cab = v[0].map(function (c) { return String(c).trim(); });
  var cId = cab.indexOf('ID'), cA = cab.indexOf('ANULADO'), cM = cab.indexOf('MOTIVO_ANULACION');
  if (cId < 0 || cA < 0 || cM < 0) throw new Error('A la hoja ' + nombre + ' le faltan las columnas ID, ANULADO o MOTIVO_ANULACION.');
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][cId]).trim() !== id) continue;
    if (normTexto(v[i][cA]) === 'SI') throw new Error(id + ' ya estaba anulado.');
    sh.getRange(i + 1, cA + 1).setValue('SÍ');
    sh.getRange(i + 1, cM + 1).setValue(textoSeguro(motivo));
    return;
  }
  throw new Error('No encontré ' + id + '.');
}

function getRegistrosHoy() {
  var d = datos_(), nombres = {};
  d.citas.forEach(function (c) { nombres[c.DNI] = c.NOMBRE; });
  var hoy = function (x) { return String(x.FECHA_HORA || '').slice(0, 10) === d.hoy; };
  var hora = function (x) { return String(x.FECHA_HORA || '').slice(11, 16); };
  var lista = d.registros.filter(hoy).map(function (r) {
    return { ID: r.ID, HORA: hora(r), ASESORA: r.ASESORA, NOMBRE: r.NOMBRE, DNI: r.DNI, TEXTO: textoRegistro(r), ANULADO: anulado_(r) };
  }).concat(d.altas.filter(hoy).map(function (a) {
    return { ID: a.ID, HORA: hora(a), ASESORA: a.REGISTRADO_POR, NOMBRE: nombres[a.DNI] || '', DNI: a.DNI,
      TEXTO: 'Alta médica · ' + a.ESPECIALIDAD + ' · ' + a.DOCTOR, ANULADO: anulado_(a) };
  }));
  lista.sort(function (a, b) { return a.HORA < b.HORA ? 1 : a.HORA > b.HORA ? -1 : (a.ID < b.ID ? 1 : -1); });
  return limpiarParaEnvio(lista);
}

function buscarPacienteRegistro(dni) {
  var d = datos_(), k = normDni(dni);
  var realizadas = d.citas.filter(function (c) { return c.DNI === k && normTexto(c.ESTADO) === 'REALIZADO'; }).sort(porFecha);
  if (!k || !realizadas.length) return { encontrado: false };
  var ultima = realizadas[realizadas.length - 1], esp = {};
  realizadas.forEach(function (c) { esp[c.ESPECIALIDAD] = 1; });
  return limpiarParaEnvio({
    encontrado: true,
    nombre: ultima.NOMBRE,
    telefonos: telefonosPorDni(d.indicacionesTodas, d.contactos)[k] || [],
    ultimaFecha: ultima.FECHA,
    ultimoMedico: ultima.MEDICO,
    doctor: doctorPropuesto(d.catalogos, ultima.MEDICO),
    especialidades: Object.keys(esp).sort().map(function (e) { return { especialidad: e, alta: !!d.vigentes[claveSerie(k, e)] }; })
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS, todas, incluidas las de `test/registro-servidor.test.js` y `sintaxis.test.js`. `menu.test.js` puede fallar hasta la Task 6 solo si su `contexto()` no carga `Registro.gs`. Si es así, en esta misma tarea cambie su `cargar(['Logica.gs', 'Codigo.gs', 'Menu.gs'])` por `cargar(['Logica.gs', 'Registro.gs', 'Codigo.gs', 'RegistroServidor.gs', 'Menu.gs'])`.

- [ ] **Step 5: Commit**

```bash
git add src/RegistroServidor.gs src/Codigo.gs test/registro-servidor.test.js test/sintaxis.test.js test/menu.test.js
git commit -m "Servidor de Registro: guardar, sesiones, altas, anulaciones y datos unidos"
```

---

### Task 6: Menú — preparar y verificar las hojas nuevas

**Files:**
- Modify: `src/Menu.gs` (`onOpen` líneas 11-20, `hojasBase_` 23-33, `prepararHojas` 35-75, `actualizar_` ~110-123, `verificar` ~265-290), `src/Registro.gs`
- Test: `test/menu.test.js`, `test/sintaxis.test.js`, `test/logica-registro.test.js`

**Interfaces:**
- Consumes: `COLUMNAS_REGISTROS`, `COLUMNAS_SESIONES`, `COLUMNAS_ALTAS` y `COLUMNAS_SEGUIMIENTOS`.
- Produces:
  - **`encabezadoAmpliable(cab, columnas) → { error, agregar }`**, pura, en `Menu.gs`.
  - **`CATALOGO_REGISTRO_INICIAL`**, en `Menu.gs`.
  - **`ampliarHojas_() → string[]`** con lo que cambió.
  - **`revisarCatalogos(catalogos) → string[]`**, en `Registro.gs`: líneas `✓`/`✗` para «Verificar».
  - **`hojasBase_()`** suma `REGISTROS`, `SESIONES` y `ALTAS`.

- [ ] **Step 1: Write the failing test**

Agregar a `test/logica-registro.test.js`:

```js
test('revisarCatalogos: marcas sin su tratamiento, sin doctores y el motivo ALTA MÉDICA', () => {
  assert.deepEqual(plano(L.revisarCatalogos(CAT)), ['✓ Catálogos de Registro: 3 doctores, 2 procedimientos, 3 tratamientos.']);
  const malo = L.catalogosDesdeFilas(['USUARIOS', 'MOTIVOS_DESCARTE', 'TRATAMIENTOS', 'MARCAS'],
    [['MAGALY', 'ALTA MÉDICA', 'HIERRO SACARATO', 'HIERRO OTRO | MARCA X']]);
  assert.deepEqual(plano(L.revisarCatalogos(malo)), [
    '✗ CATALOGOS no tiene doctores (columnas DOCTOR y DOCTOR_SOFDOC). Use «Preparar hojas».',
    '✗ La marca «MARCA X» apunta a «HIERRO OTRO», que no está en TRATAMIENTOS.',
    '✗ «ALTA MÉDICA» sigue en MOTIVOS_DESCARTE: ahora el alta se registra con «Dar de alta». Use «Preparar hojas».']);
});
```

Agregar a `test/menu.test.js`. Cambie también el `cargar([...])` de `contexto()` por `cargar(['Logica.gs', 'Registro.gs', 'Codigo.gs', 'RegistroServidor.gs', 'Menu.gs'])`.

```js
/** Hoja falsa en memoria: solo lo que usan prepararHojas y ampliarHojas_. */
function hojaFalsa(valores) {
  const v = valores.map(f => f.slice());
  const ancho = () => Math.max(0, ...v.map(f => f.length));
  const celda = (r, c) => ((v[r - 1] || [])[c - 1] ?? '');
  const poner = (r, c, x) => { while (v.length < r) v.push([]); v[r - 1][c - 1] = x; };
  return {
    v,
    getLastRow: () => v.length,
    getLastColumn: ancho,
    getDataRange: () => ({ getValues: () => v.map(f => Array.from({ length: ancho() }, (_, j) => f[j] ?? '')) }),
    getRange(r, c, h = 1, w = 1) {
      const rango = {
        getValues: () => Array.from({ length: h }, (_, i) => Array.from({ length: w }, (_, j) => celda(r + i, c + j))),
        setValues: vals => { vals.forEach((f, i) => f.forEach((x, j) => poner(r + i, c + j, x))); return rango; },
        setValue: x => { poner(r, c, x); return rango; },
        setFontWeight: () => rango
      };
      return rango;
    }
  };
}

test('encabezadoAmpliable: solo agrega al final si lo anterior coincide', () => {
  const { ctx } = contexto();
  assert.deepEqual(plano(ctx.encabezadoAmpliable(['A', 'B'], ['A', 'B', 'C'])), { error: '', agregar: ['C'] });
  assert.deepEqual(plano(ctx.encabezadoAmpliable(['A', 'B', 'C'], ['A', 'B', 'C'])), { error: '', agregar: [] });
  assert.match(ctx.encabezadoAmpliable(['A', 'X'], ['A', 'B', 'C']).error, /columna 2 \(«X», se esperaba «B»\)/);
});

test('ampliarHojas_: REFERENCIA en SEGUIMIENTOS, catálogos de Registro, quita ALTA MÉDICA y suma parámetros, sin borrar nada', () => {
  const { ctx } = contexto();
  const seg = hojaFalsa([['ID', 'FECHA_HORA', 'DNI', 'ESPECIALIDAD', 'RESPONSABLE', 'ACCION', 'MOTIVO', 'NOTA'], ['S-1', '', '1', 'H', 'M', 'HECHO', '', 'n']]);
  const cat = hojaFalsa([['USUARIOS', 'MOTIVOS_DESCARTE'], ['MAGALY', 'OTRO'], ['ANA', 'ALTA MÉDICA']]);
  const reg = hojaFalsa([['ESPECIALIDAD', 'ESPERADO_DIAS', 'VENCE_DIAS', '', 'PARAMETRO', 'VALOR'], ['*', 30, 45, '', 'MAX_SEGUIMIENTOS', 2]]);
  ctx.ss_ = () => ({ getSheetByName: n => ({ SEGUIMIENTOS: seg, CATALOGOS: cat, REGLAS: reg })[n] || null });
  const cambios = [...ctx.ampliarHojas_()];
  assert.deepEqual(seg.v[0].slice(8), ['REFERENCIA']);
  assert.deepEqual(seg.v[1].slice(0, 8), ['S-1', '', '1', 'H', 'M', 'HECHO', '', 'n'], 'no toca las filas');
  assert.deepEqual(cat.v[0], ['USUARIOS', 'MOTIVOS_DESCARTE', 'DOCTOR', 'DOCTOR_SOFDOC', 'PROCEDIMIENTOS', 'TRATAMIENTOS', 'MARCAS']);
  assert.equal(cat.v[1][2], 'Dr. Elí Cabanillas');
  assert.equal(cat.v[6][3], '', 'el particular sin nombre SOFDOC');
  assert.equal(cat.v[2][1], '', 'ALTA MÉDICA quitado');
  assert.deepEqual(reg.v.slice(2).map(f => [f[4], f[5]]), [['ESPERA_COTIZACION_DIAS', 7], ['DIAS_ENTRE_SESIONES', 7]]);
  assert.equal(cambios.length, 5, 'SEGUIMIENTOS, CATALOGOS, ALTA MÉDICA y los dos parámetros');
  assert.deepEqual([...ctx.ampliarHojas_()], [], 'la segunda vez no cambia nada');
});

test('ampliarHojas_ no agrega REFERENCIA si el encabezado de SEGUIMIENTOS no es el esperado', () => {
  const { ctx } = contexto();
  const seg = hojaFalsa([['ID', 'FECHA', 'DNI']]);
  ctx.ss_ = () => ({ getSheetByName: n => (n === 'SEGUIMIENTOS' ? seg : null) });
  assert.match(ctx.ampliarHojas_()[0], /^✗ SEGUIMIENTOS: el encabezado no coincide/);
  assert.deepEqual(seg.v[0], ['ID', 'FECHA', 'DNI']);
});
```

`contexto()` devuelve `{ ctx, estado }` y `plano` no está importado en `menu.test.js`. Cambie la primera línea de `require` por `const { cargar, plano } = require('./cargar');`.

En `test/sintaxis.test.js`, la segunda prueba:
- carga `['Logica.gs', 'Registro.gs', 'Codigo.gs', 'RegistroServidor.gs', 'Menu.gs']`;
- espera las claves `['CITAS', 'PACIENTES', 'INDICACIONES', 'SEGUIMIENTOS', 'BITACORA', 'CONTACTOS_CRM', 'KPI', 'REGISTROS', 'SESIONES', 'ALTAS']`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL. `revisarCatalogos`, `encabezadoAmpliable` y `ampliarHojas_` no existen, y faltan claves en `hojasBase_`.

- [ ] **Step 3: Write minimal implementation**

Agregar a `src/Registro.gs`:

```js
/** Líneas para «Verificar»: lo que la pestaña Registro necesita de CATALOGOS. */
function revisarCatalogos(c) {
  var lineas = [];
  if (!c.doctores.length) lineas.push('✗ CATALOGOS no tiene doctores (columnas DOCTOR y DOCTOR_SOFDOC). Use «Preparar hojas».');
  Object.keys(c.marcas).forEach(function (t) {
    if (!enLista_(c.tratamientos, t)) c.marcas[t].forEach(function (m) {
      lineas.push('✗ La marca «' + m + '» apunta a «' + t + '», que no está en TRATAMIENTOS.');
    });
  });
  if (enLista_(c.motivos, 'ALTA MÉDICA')) lineas.push('✗ «ALTA MÉDICA» sigue en MOTIVOS_DESCARTE: ahora el alta se registra con «Dar de alta». Use «Preparar hojas».');
  return lineas.length ? lineas : ['✓ Catálogos de Registro: ' + c.doctores.length + ' doctores, ' + c.procedimientos.length +
    ' procedimientos, ' + c.tratamientos.length + ' tratamientos.'];
}
```

En `src/Menu.gs`:

1. **`onOpen`.** Quitar la línea `.addItem('Importar hierro y procedimientos (una vez)', 'importarIndicaciones')`. En el comentario de arriba, el orden pasa a ser:
   1. Preparar hojas
   2. Actualizar

   Agregar la nota: «Desde octubre de 2026 los procedimientos y tratamientos se registran en la pestaña Registro de la app; INDICACIONES queda como historial».

2. **`hojasBase_()`.** Sumar:
```js
    REGISTROS: COLUMNAS_REGISTROS,
    SESIONES: COLUMNAS_SESIONES,
    ALTAS: COLUMNAS_ALTAS,
```
   después de `KPI`.

3. **Agregar antes de `prepararHojas`:**

```js
/** Listas iniciales de la pestaña Registro (diseño §3.4). DOCTOR y DOCTOR_SOFDOC van fila a fila. */
var CATALOGO_REGISTRO_INICIAL = {
  DOCTOR: ['Dr. Elí Cabanillas', 'Dra. Alejandra La Torre', 'Dr. Víctor Seminario', 'Dr. Álvaro Villanueva', 'Dra. Karen Matos',
    'Dra. Karen Matos – Particular', 'Dr. Iván Pacheco'],
  DOCTOR_SOFDOC: ['Dr. ELÍ FABRIZIO CABANILLAS HUALPA', 'Dra. ALEJANDRA LA TORRE MATUK', 'Dr. VICTOR ERNESTO SEMINARIO MARCELO',
    'Dr. ALVARO MARTIN VILLANUEVA GARCIA', 'Dra. KAREN DIANA MATOS PEÑA', '', 'Dr. IVAN PAOLO PACHECO MODESTO'],
  PROCEDIMIENTOS: ['SANGRÍA', 'AMO', 'BIOPSIA', 'CITOMETRÍA DE FLUJO', 'CARIOTIPO', 'TRANSFUSIÓN DE SANGRE'],
  TRATAMIENTOS: ['HIERRO SACARATO', 'HIERRO DERISOMALTOSA', 'HIERRO CARBOXIMALTOSA'],
  MARCAS: ['HIERRO CARBOXIMALTOSA | FERINJECT', 'HIERRO CARBOXIMALTOSA | LIKFER', 'HIERRO DERISOMALTOSA | MONOFER']
};

var PARAMETROS_REGISTRO = [['ESPERA_COTIZACION_DIAS', 7], ['DIAS_ENTRE_SESIONES', 7]];

/** Encabezado de la fila 1 sin las celdas vacías del final. */
function encabezado_(sh) {
  var cab = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(function (c) { return String(c).trim(); });
  while (cab.length && !cab[cab.length - 1]) cab.pop();
  return cab;
}

/** Una hoja que se escribe por posición solo se amplía al final, y solo si lo que ya tiene coincide. */
function encabezadoAmpliable(cab, columnas) {
  for (var i = 0; i < cab.length; i++) {
    if (cab[i] !== columnas[i]) {
      return { error: 'el encabezado no coincide en la columna ' + (i + 1) + ' («' + cab[i] + '», se esperaba «' + (columnas[i] || '') + '»).', agregar: [] };
    }
  }
  return { error: '', agregar: columnas.slice(cab.length) };
}

/** Lo que la pestaña Registro necesita en hojas que ya existen. No borra ni mueve nada. Devuelve qué cambió. */
function ampliarHojas_() {
  var ss = ss_(), cambios = [];

  var sg = ss.getSheetByName('SEGUIMIENTOS');
  if (sg) {
    var cabS = encabezado_(sg), plan = encabezadoAmpliable(cabS, COLUMNAS_SEGUIMIENTOS);
    if (plan.error) cambios.push('✗ SEGUIMIENTOS: ' + plan.error);
    else if (plan.agregar.length) {
      sg.getRange(1, cabS.length + 1, 1, plan.agregar.length).setValues([plan.agregar]).setFontWeight('bold');
      cambios.push('SEGUIMIENTOS: columna ' + plan.agregar.join(', ') + '.');
    }
  }

  var ct = ss.getSheetByName('CATALOGOS');
  if (ct) {
    var cabC = encabezado_(ct), faltan = Object.keys(CATALOGO_REGISTRO_INICIAL).filter(function (c) { return cabC.indexOf(c) < 0; });
    var parDoctor = faltan.indexOf('DOCTOR') >= 0, parSofdoc = faltan.indexOf('DOCTOR_SOFDOC') >= 0;
    if (parDoctor !== parSofdoc) {
      cambios.push('✗ CATALOGOS: DOCTOR y DOCTOR_SOFDOC van juntas; agregue a mano la que falta.');
      faltan = faltan.filter(function (c) { return c !== 'DOCTOR' && c !== 'DOCTOR_SOFDOC'; });
    }
    faltan.forEach(function (c) {
      var col = encabezado_(ct).length + 1, valores = CATALOGO_REGISTRO_INICIAL[c];
      ct.getRange(1, col, 1, 1).setValues([[c]]).setFontWeight('bold');
      ct.getRange(2, col, valores.length, 1).setValues(valores.map(function (x) { return [x]; }));
    });
    if (faltan.length) cambios.push('CATALOGOS: columnas ' + faltan.join(', ') + '.');
    var cM = encabezado_(ct).indexOf('MOTIVOS_DESCARTE');
    if (cM >= 0) {
      var motivos = ct.getRange(1, cM + 1, Math.max(1, ct.getLastRow()), 1).getValues();
      motivos.forEach(function (f, i) {
        if (i > 0 && normTexto(f[0]) === 'ALTA MEDICA') {
          ct.getRange(i + 1, cM + 1).setValue('');
          cambios.push('CATALOGOS: se quitó «ALTA MÉDICA» de los motivos de descarte.');
        }
      });
    }
  }

  var rg = ss.getSheetByName('REGLAS');
  if (rg) {
    var cabR = encabezado_(rg), cP = cabR.indexOf('PARAMETRO'), cV = cabR.indexOf('VALOR');
    if (cP >= 0 && cV >= 0) {
      var col = rg.getRange(1, cP + 1, Math.max(1, rg.getLastRow()), 1).getValues().map(function (f) { return normTexto(f[0]); });
      PARAMETROS_REGISTRO.forEach(function (par) {
        if (col.indexOf(par[0]) >= 0) return;
        var fila = col.length + 1;
        for (var i = 1; i < col.length; i++) if (!col[i]) { fila = i + 1; break; }
        rg.getRange(fila, cP + 1).setValue(par[0]);
        rg.getRange(fila, cV + 1).setValue(par[1]);
        col[fila - 1] = par[0];
        cambios.push('REGLAS: ' + par[0] + ' = ' + par[1] + '.');
      });
    }
  }
  return cambios;
}
```

4. **`prepararHojas`.** Justo antes del `SpreadsheetApp.getUi().alert(...)` final, reemplazar el aviso por:
```js
  var ampliadas = ampliarHojas_();
  SpreadsheetApp.getUi().alert((creadas.length ? 'Hojas creadas: ' + creadas.join(', ') + '.' : 'No faltaba ninguna hoja.') +
    (ampliadas.length ? '\n' + ampliadas.join('\n') : '\nNo hubo que ampliar ninguna hoja.'));
```
   En la `CATALOGOS` que crea desde cero, quitar la fila `['', 'ALTA MÉDICA', '', '']`: cambiar `getRange(1, 1, 7, 4)` por `getRange(1, 1, 6, 4)` y borrar esa fila del array.

5. **`actualizar_`.** La línea de `escribirKpi_` pasa a:
```js
  escribirKpi_(filasHojaKpi(calcularKpi(d.citas, d.indicacionesTodas, d.seguimientos, d.reglas, d.hoy, d.contactos, d.vigentes)));
```

6. **`verificar`.** Después del `forEach` de hojas, agregar:
```js
  var sgV = ss.getSheetByName('SEGUIMIENTOS');
  if (sgV) {
    var planV = encabezadoAmpliable(encabezado_(sgV), COLUMNAS_SEGUIMIENTOS);
    lineas.push(planV.error ? '✗ SEGUIMIENTOS: ' + planV.error
      : planV.agregar.length ? '✗ A SEGUIMIENTOS le falta la columna ' + planV.agregar.join(', ') + '. Use «Preparar hojas».'
      : '✓ SEGUIMIENTOS tiene la columna REFERENCIA.');
  }
  if (ss.getSheetByName('CATALOGOS')) revisarCatalogos(catalogos_()).forEach(function (l) { lineas.push(l); });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS, todas.

- [ ] **Step 5: Commit**

```bash
git add src/Menu.gs src/Registro.gs test/menu.test.js test/sintaxis.test.js test/logica-registro.test.js
git commit -m "Menú: preparar y verificar REGISTROS, SESIONES, ALTAS, catálogos y parámetros; sin «Importar»"
```

---
### Task 7: Pestaña Registro en la interfaz (formulario, duplicado, registrados hoy, alta)

**Files:**
- Modify: `src/Index.html`: CSS, barra (línea ~310), sección nueva antes de `id="v-ficha"` (línea ~351), estado `E` (~386), `irA` (~467), JS nuevo antes de `/* ===… BUSCADOR Y FICHA`, `iniciar` (~1162) y DEMO (~1195-1330)
- Test: `test/ui.test.js`

**Interfaces:**
- Consumes (servidor): `bootstrap().doctores/procedimientos/tratamientos/marcas`, `buscarPacienteRegistro`, `guardarRegistro`, `getRegistrosHoy`, `darDeAlta`, `anularRegistro` y `anularAlta`.
- Produces (para la Task 8):
  - `pedirMotivo(contenedor, que: 'registro'|'sesion'|'alta', id)`
  - `confirmarAnulacion(boton, alTerminar)`
  - `opcionesDoctor(medicoSofdoc) → HTML de <option>`
  - `FUNCION_ANULAR`
  - DEMO con `registros`, `sesiones`, `altas`, `doctores` y `textoRegDemo(r)`.

- [ ] **Step 1: Write the failing test** — agregar a `test/ui.test.js`:

```js
const irRegistro = async p => { await p.locator('.nav button[data-vista="registro"]').click(); await p.waitForSelector('#f-reg'); };

test('registro: la marca depende del tratamiento y «Otro» pide el número', async () => {
  const { navegador, pagina, errores } = await abrir();
  try {
    await irRegistro(pagina);
    assert.equal(await pagina.locator('#g-trat-extra').isVisible(), false);
    await pagina.selectOption('#g-trat', 'HIERRO CARBOXIMALTOSA');
    assert.deepEqual(await pagina.locator('#g-marca option').allTextContents(), ['— Elija —', 'FERINJECT', 'LIKFER']);
    await pagina.selectOption('#g-trat', 'HIERRO DERISOMALTOSA');
    assert.deepEqual(await pagina.locator('#g-marca option').allTextContents(), ['— Elija —', 'MONOFER']);
    await pagina.selectOption('#g-trat', 'HIERRO SACARATO');
    assert.equal(await pagina.locator('#g-marca-c').isVisible(), false, 'el sacarato no pide marca');
    assert.equal(await pagina.locator('#g-otro').isVisible(), false);
    await pagina.selectOption('#g-sesiones', 'otro');
    assert.equal(await pagina.locator('#g-otro').isVisible(), true);
    await pagina.selectOption('#g-trat', '');
    assert.equal(await pagina.locator('#g-trat-extra').isVisible(), false);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('registro: DNI conocido, registrar, aviso de duplicado, registrados hoy y anular', async () => {
  const { navegador, pagina, errores } = await abrir();
  try {
    await pagina.selectOption('#usuario', 'MAGALY');
    await irRegistro(pagina);
    const llenar = async () => {
      await pagina.fill('#g-dni', '40222333');
      await pagina.waitForFunction(() => /Paciente conocido/.test(document.querySelector('#g-conocido').textContent));
      await pagina.fill('#g-contacto', '@jorge.m');
      await pagina.selectOption('#g-proc', 'SANGRÍA');
    };
    await llenar();
    assert.equal(await pagina.locator('#g-conocido').textContent(), 'Paciente conocido · última consulta 18/07/2026 con Dra. Matos');
    assert.equal(await pagina.inputValue('#g-nombre'), 'JORGE LUIS MENDOZA PAREDES');
    assert.equal(await pagina.inputValue('#g-doctor'), 'Dra. Karen Matos');
    await pagina.locator('#g-guardar').click();
    await pagina.waitForFunction(() => /Registrado:/.test(document.querySelector('#aviso').textContent));
    assert.equal(await pagina.locator('#aviso').textContent(), 'Registrado: Sangría — JORGE LUIS MENDOZA PAREDES · REG-000002');
    assert.equal(await pagina.inputValue('#g-dni'), '', 'el formulario se limpia');
    await pagina.waitForFunction(() => document.querySelectorAll('#g-hoy .g-item').length === 1);

    await llenar();
    await pagina.locator('#g-guardar').click();
    await pagina.waitForSelector('#g-dup:not([hidden])');
    assert.match(await pagina.locator('#g-dup').textContent(), /Ya se registró el 01\/10\/2026 \(REG-000002\): Sangría\. ¿Registrar de todos modos\?/);
    await pagina.locator('#g-dup-si').click();
    await pagina.waitForFunction(() => document.querySelectorAll('#g-hoy .g-item').length === 2);

    await pagina.locator('[data-anular="REG-000003"]').click();
    await pagina.fill('#g-motivo', 'Duplicado');
    await pagina.locator('[data-confirmar-anular="REG-000003"]').click();
    await pagina.waitForSelector('#g-hoy .g-item.anulado');
    assert.match(await pagina.locator('#g-hoy .g-item.anulado').textContent(), /REG-000003[\s\S]*Anulado/);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('registro: alta médica desde la pestaña; el paciente sale de la bandeja', async () => {
  const { navegador, pagina, errores } = await abrir();
  try {
    await pagina.selectOption('#usuario', 'RACHEL');
    await irRegistro(pagina);
    await pagina.locator('[data-modo-reg="alta"]').click();
    assert.equal(await pagina.locator('#g-nombre').isVisible(), false);
    await pagina.fill('#g-dni', '40222333');
    await pagina.waitForFunction(() => /HEMATOLOGÍA/.test(document.querySelector('#g-esp').textContent));
    assert.equal(await pagina.locator('#g-guardar').textContent(), 'Registrar alta');
    await pagina.locator('#g-guardar').click();
    await pagina.waitForFunction(() => /Alta registrada/.test(document.querySelector('#aviso').textContent));
    assert.equal(await pagina.locator('#aviso').textContent(), 'Alta registrada: JORGE LUIS MENDOZA PAREDES · HEMATOLOGÍA');
    await pagina.waitForFunction(() => /Alta médica · HEMATOLOGÍA · Dra\. Karen Matos/.test(document.querySelector('#g-hoy').textContent));
    await pagina.locator('.nav button[data-vista="bandeja"]').click();
    await pagina.waitForFunction(() => document.querySelectorAll('#lista .fila').length === 6);
    assert.ok(!(await filas(pagina)).includes('JORGE LUIS MENDOZA PAREDES'));
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `timeout 300 node --test --test-name-pattern="registro:" test/ui.test.js`
Expected: FAIL. No existe `.nav button[data-vista="registro"]`.

- [ ] **Step 3: Write minimal implementation** — en `src/Index.html`:

**CSS.** Antes de `/* ---------- Ficha y Detalle ---------- */`:

```css
/* ---------- Registro ---------- */
[hidden]{display:none!important}
.form-reg{max-width:640px;margin-top:20px;display:flex;flex-direction:column;gap:22px}
.form-reg fieldset{border:0;border-top:1px solid var(--chp-ink);margin:0;padding:14px 0 0;display:flex;flex-direction:column;gap:12px;min-width:0}
.form-reg legend{font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--chp-brand);padding:0 8px 0 0}
.form-reg legend small{text-transform:none;letter-spacing:0;font-weight:400;color:var(--chp-muted)}
.campo{display:flex;flex-direction:column;gap:4px;font-size:13px;color:var(--chp-muted)}
.entrada{background:transparent;border:0;border-bottom:1px solid var(--chp-ink);font-size:17px;padding:6px 0;color:var(--chp-ink);font-family:inherit;min-width:0;max-width:100%}
.form-reg .sel{font-size:16px;max-width:100%}
.form-reg .btn-marca{align-self:flex-start;font-size:16px;padding:12px 22px}
.g-dup{border-left:3px solid var(--chp-pending);padding:10px 14px;background:var(--chp-row-hover)}
.g-dup p{margin:0 0 10px}
.g-item{display:grid;grid-template-columns:56px 1fr auto;gap:12px;padding:10px 0;border-bottom:1px solid var(--chp-rule);align-items:baseline}
.g-item.anulado b,.g-item.anulado .linea-g{text-decoration:line-through;color:var(--chp-muted)}
.linea-g{font-size:14px;color:var(--chp-soft)}
.g-motivo{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:6px}
```

**Barra.** Después de `<button type="button" data-vista="bandeja" aria-current="page">Bandeja</button>`:
```html
      <button type="button" data-vista="registro">Registro</button>
```

**Sección.** Antes de `<section class="vista" id="v-ficha" hidden>`:

```html
    <section class="vista" id="v-registro" hidden>
      <div class="cabeza"><div><h1 class="titulo">Registro</h1><div class="fecha">Procedimientos, tratamientos y altas médicas</div></div></div>
      <div class="tipos" role="group" aria-label="Qué registra">
        <button type="button" data-modo-reg="indicacion" aria-pressed="true">Indicación</button>
        <button type="button" data-modo-reg="alta" aria-pressed="false">Alta médica</button>
      </div>
      <form id="f-reg" class="form-reg" autocomplete="off" novalidate>
        <fieldset><legend>1 · Paciente</legend>
          <label class="campo">DNI o carné de extranjería <input id="g-dni" class="entrada" maxlength="12"></label>
          <p id="g-conocido" class="muted" aria-live="polite"></p>
          <label class="campo solo-ind">Nombres y apellidos <input id="g-nombre" class="entrada"></label>
          <label class="campo solo-ind">Teléfono o usuario <input id="g-contacto" class="entrada"></label>
          <label class="campo">Fecha <input id="g-fecha" class="entrada" type="date"></label>
        </fieldset>
        <fieldset><legend>2 · Doctor</legend>
          <select id="g-doctor" class="sel" aria-label="Doctor"></select>
        </fieldset>
        <fieldset class="solo-ind"><legend>3 · Procedimiento <small>(si aplica)</small></legend>
          <select id="g-proc" class="sel" aria-label="Procedimiento"></select>
        </fieldset>
        <fieldset class="solo-ind"><legend>4 · Tratamiento <small>(si aplica)</small></legend>
          <select id="g-trat" class="sel" aria-label="Tratamiento"></select>
          <div id="g-trat-extra" hidden>
            <label class="campo">¿Cuántas sesiones?
              <select id="g-sesiones" class="sel"><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option><option value="otro">Otro</option></select></label>
            <label class="campo" id="g-otro-c" hidden>Número de sesiones <input id="g-otro" class="entrada" type="number" min="6" max="20"></label>
            <label class="campo" id="g-marca-c" hidden>Marca <select id="g-marca" class="sel"></select></label>
          </div>
        </fieldset>
        <fieldset class="solo-alta" hidden><legend>3 · Especialidad del alta</legend>
          <select id="g-esp" class="sel" aria-label="Especialidad"></select>
          <label class="campo">Nota (opcional) <input id="g-nota-alta" class="entrada"></label>
        </fieldset>
        <div id="g-dup" class="g-dup" hidden></div>
        <button type="submit" class="btn-marca" id="g-guardar">Registrar</button>
      </form>
      <div class="seccion"><h2>Registrados hoy</h2><div id="g-hoy"></div></div>
    </section>
```

**Estado.** No hace falta tocar `E`: el estado de Registro vive en `G` (abajo).

**`irA`.** Después de `if (vista === 'resumen') cargarResumen();`:
```js
  if (vista === 'registro') { iniciarRegistro(); cargarRegistrosHoy(); }
```

**JS.** Antes del bloque `BUSCADOR Y FICHA`:

```js
/* ==========================================================================
   REGISTRO — procedimientos, tratamientos (con sesiones) y altas médicas.
   La asesora es la del selector «¿Quién es usted?». El servidor vuelve a
   revisar todo (validarRegistro / validarAlta): aquí solo se ayuda a llenar.
   ========================================================================== */
const G = { listo: false, modo: 'indicacion', paciente: null, confirmar: false };
let esperaDni;

function opcionesSelect(sel, valores, vacio) {
  sel.innerHTML = `<option value="">${esc(vacio)}</option>` + valores.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
}

/** Opciones de doctor, con el que corresponde al médico de SOFDOC ya elegido (el primero: «Dra. Karen Matos», no el particular). */
function opcionesDoctor(medicoSofdoc) {
  const docs = (E.boot && E.boot.doctores) || [];
  const propuesto = docs.find(d => d.sofdoc && norm(d.sofdoc) === norm(medicoSofdoc));
  return '<option value="">— Doctor que da el alta —</option>' + docs.map(d =>
    `<option value="${esc(d.doctor)}"${propuesto === d ? ' selected' : ''}>${esc(d.doctor)}</option>`).join('');
}

function iniciarRegistro() {
  if (G.listo || !E.boot) return;
  G.listo = true;
  const b = E.boot;
  opcionesSelect($('#g-doctor'), (b.doctores || []).map(x => x.doctor), '— Elija —');
  opcionesSelect($('#g-proc'), b.procedimientos || [], 'Ninguno');
  opcionesSelect($('#g-trat'), b.tratamientos || [], 'Ninguno');
  $('#g-fecha').value = hoy();
  $('#g-fecha').max = hoy();
  pintarEspecialidades();
  $('#g-dni').addEventListener('input', () => { clearTimeout(esperaDni); esperaDni = setTimeout(buscarDni, 350); });
  $('#g-trat').addEventListener('change', pintarTratamiento);
  $('#g-sesiones').addEventListener('change', () => { $('#g-otro-c').hidden = $('#g-sesiones').value !== 'otro'; });
  document.querySelectorAll('[data-modo-reg]').forEach(x => x.addEventListener('click', () => ponerModoRegistro(x.dataset.modoReg)));
  $('#f-reg').addEventListener('submit', ev => { ev.preventDefault(); enviarRegistro(); });
  $('#g-dup').addEventListener('click', ev => {
    if (ev.target.id === 'g-dup-si') { G.confirmar = true; enviarRegistro(); }
    if (ev.target.id === 'g-dup-no') { G.confirmar = false; $('#g-dup').hidden = true; }
  });
  $('#g-hoy').addEventListener('click', clicRegistradosHoy);
}

function pintarTratamiento() {
  const t = $('#g-trat').value;
  $('#g-trat-extra').hidden = !t;
  const marcas = ((E.boot && E.boot.marcas) || {})[norm(t)] || [];
  $('#g-marca-c').hidden = !marcas.length;
  opcionesSelect($('#g-marca'), marcas, '— Elija —');
}

function ponerModoRegistro(modo) {
  G.modo = modo;
  document.querySelectorAll('[data-modo-reg]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.modoReg === modo)));
  document.querySelectorAll('#f-reg .solo-ind').forEach(x => { x.hidden = modo !== 'indicacion'; });
  document.querySelectorAll('#f-reg .solo-alta').forEach(x => { x.hidden = modo !== 'alta'; });
  $('#g-guardar').textContent = modo === 'alta' ? 'Registrar alta' : 'Registrar';
  $('#g-dup').hidden = true;
  G.confirmar = false;
  pintarEspecialidades();
}

const documentoOk = v => { const d = norm(v).replace(/[\s.\-]/g, ''); return /^\d{8}$/.test(d) || /^[A-Z0-9]{9,12}$/.test(d); };

async function buscarDni() {
  const dni = $('#g-dni').value;
  G.paciente = null;
  $('#g-conocido').textContent = '';
  pintarEspecialidades();
  if (!documentoOk(dni)) return;
  let r;
  try { r = await llamar('buscarPacienteRegistro', dni); } catch (e) { avisar(e.message); return; }
  if ($('#g-dni').value !== dni) return;  // mientras tanto escribieron otro DNI
  G.paciente = r;
  if (!r.encontrado) {
    $('#g-conocido').textContent = 'Todavía no está en SOFDOC. Puede registrarlo igual.';
  } else {
    $('#g-conocido').textContent = `Paciente conocido · última consulta ${fechaCorta(r.ultimaFecha)} con ${medicoCorto(r.ultimoMedico)}`;
    if (!$('#g-nombre').value.trim()) $('#g-nombre').value = r.nombre;
    if (!$('#g-contacto').value.trim() && r.telefonos.length) $('#g-contacto').value = r.telefonos[0];
    if (!$('#g-doctor').value && r.doctor) $('#g-doctor').value = r.doctor;
  }
  pintarEspecialidades();
}

function pintarEspecialidades() {
  const p = G.paciente, esps = p && p.encontrado ? p.especialidades : [];
  $('#g-esp').innerHTML = esps.length
    ? esps.map(e => `<option value="${esc(e.especialidad)}"${e.alta ? ' disabled' : ''}>${esc(e.especialidad)}${e.alta ? ' · ya tiene alta' : ''}</option>`).join('')
    : '<option value="">— Escriba un DNI con consultas —</option>';
}

async function enviarRegistro() {
  if (!exigirUsuario()) return;
  const boton = $('#g-guardar');
  boton.disabled = true;
  try {
    if (G.modo === 'alta') {
      await llamar('darDeAlta', { usuario: usuario(), dni: $('#g-dni').value, especialidad: $('#g-esp').value,
        doctor: $('#g-doctor').value, fecha: $('#g-fecha').value, nota: $('#g-nota-alta').value });
      avisar(`Alta registrada: ${G.paciente && G.paciente.nombre ? G.paciente.nombre : $('#g-dni').value} · ${$('#g-esp').value}`);
      cargarBandeja();
    } else {
      const trat = $('#g-trat').value;
      const r = await llamar('guardarRegistro', { usuario: usuario(), dni: $('#g-dni').value, nombre: $('#g-nombre').value,
        contacto: $('#g-contacto').value, fecha: $('#g-fecha').value, doctor: $('#g-doctor').value, procedimiento: $('#g-proc').value,
        tratamiento: trat, sesiones: trat ? ($('#g-sesiones').value === 'otro' ? $('#g-otro').value : $('#g-sesiones').value) : '',
        marca: trat ? $('#g-marca').value : '', confirmado: G.confirmar });
      if (r.duplicado) {
        $('#g-dup').innerHTML = `<p>Ya se registró el ${fechaCorta(r.duplicado.FECHA)} (${esc(r.duplicado.ID)}): ${esc(r.duplicado.TEXTO)}. ¿Registrar de todos modos?</p>
          <button type="button" class="btn-marca" id="g-dup-si">Registrar de todos modos</button>
          <button type="button" class="btn-linea" id="g-dup-no">Cancelar</button>`;
        $('#g-dup').hidden = false;
        return;
      }
      avisar(`Registrado: ${r.registros.map(x => x.TEXTO).join(' + ')} — ${r.registros[0].NOMBRE} · ${r.registros.map(x => x.ID).join(', ')}`);
    }
    limpiarRegistro();
    E.kpi = null;
    E.resumen = null;
    cargarRegistrosHoy();
  } catch (e) {
    avisar('No se guardó: ' + e.message);
  } finally {
    boton.disabled = false;
  }
}

/** Limpia todo menos la fecha: la asesora suele registrar varios pacientes del mismo día seguidos. */
function limpiarRegistro() {
  ['#g-dni', '#g-nombre', '#g-contacto', '#g-otro', '#g-nota-alta', '#g-doctor', '#g-proc', '#g-trat'].forEach(s => { $(s).value = ''; });
  $('#g-sesiones').value = '1';
  $('#g-otro-c').hidden = true;
  $('#g-conocido').textContent = '';
  $('#g-dup').hidden = true;
  G.paciente = null;
  G.confirmar = false;
  pintarTratamiento();
  pintarEspecialidades();
}

async function cargarRegistrosHoy() {
  let lista;
  try { lista = await llamar('getRegistrosHoy'); } catch (e) { $('#g-hoy').innerHTML = `<p class="hace">${esc(e.message)}</p>`; return; }
  $('#g-hoy').innerHTML = lista.length ? lista.map(x => `<div class="g-item${x.ANULADO ? ' anulado' : ''}" data-id="${esc(x.ID)}">
      <span class="num">${esc(x.HORA)}</span>
      <span><b>${esc(x.NOMBRE)}</b> · DNI ${esc(x.DNI)}<br><span class="linea-g">${esc(x.TEXTO)} · ${esc(x.ASESORA)} · ${esc(x.ID)}</span></span>
      ${x.ANULADO ? '<span class="muted">Anulado</span>' : `<button type="button" class="btn-texto" data-anular="${esc(x.ID)}">Anular</button>`}
    </div>`).join('') : '<p class="muted">Todavía no hay registros hoy.</p>';
}

/** El motivo se pide en la misma fila: prompt() puede estar bloqueado dentro del iframe de Apps Script. */
function pedirMotivo(contenedor, que, id) {
  document.querySelectorAll('.g-motivo').forEach(x => x.remove());
  contenedor.insertAdjacentHTML('beforeend', `<div class="g-motivo"><input class="entrada" id="g-motivo" placeholder="Motivo (obligatorio)">
    <button type="button" class="btn-marca" data-confirmar-anular="${esc(id)}" data-que="${que}">Anular</button>
    <button type="button" class="btn-texto" data-cancelar-anular>Cancelar</button></div>`);
  $('#g-motivo').focus();
}

const FUNCION_ANULAR = { registro: 'anularRegistro', sesion: 'anularSesion', alta: 'anularAlta' };

async function confirmarAnulacion(boton, alTerminar) {
  if (!exigirUsuario()) return;
  const motivo = $('#g-motivo').value.trim();
  if (!motivo) { avisar('Escriba el motivo de la anulación.'); return; }
  boton.disabled = true;
  try {
    await llamar(FUNCION_ANULAR[boton.dataset.que], { usuario: usuario(), id: boton.dataset.confirmarAnular, motivo });
    avisar('Anulado: ' + boton.dataset.confirmarAnular);
    E.kpi = null;
    E.resumen = null;
    alTerminar();
  } catch (e) {
    boton.disabled = false;
    avisar('No se anuló: ' + e.message);
  }
}

function clicRegistradosHoy(ev) {
  const a = ev.target.closest('[data-anular]');
  if (a) { pedirMotivo(a.closest('.g-item'), a.dataset.anular.startsWith('ALT-') ? 'alta' : 'registro', a.dataset.anular); return; }
  const c = ev.target.closest('[data-confirmar-anular]');
  if (c) { confirmarAnulacion(c, () => { cargarRegistrosHoy(); cargarBandeja(); }); return; }
  if (ev.target.closest('[data-cancelar-anular]')) ev.target.closest('.g-motivo').remove();
}
```

**DEMO.** En el bloque `const DEMO = (() => {`:

1. **`motivos`** pasa a `['SE ATIENDE EN OTRO LUGAR', 'NÚMERO EQUIVOCADO', 'YA NO LO NECESITA', 'FALLECIÓ', 'OTRO']`, porque «ALTA MÉDICA» ya no es motivo de descarte. Además, después de `const ELI = …, KAREN = …;`:
```js
  const doctores = [{ doctor: 'Dr. Elí Cabanillas', sofdoc: ELI }, { doctor: 'Dra. Karen Matos', sofdoc: KAREN },
    { doctor: 'Dra. Karen Matos – Particular', sofdoc: '' }];
  const registros = [{ ID: 'REG-000001', FECHA_HORA: '2026-08-05 10:00', FECHA: '2026-08-05', ASESORA: 'MAGALY', DOCTOR: 'Dr. Elí Cabanillas',
    NOMBRE: 'ROSA ELENA QUISPE HUAMÁN', DNI: '40111222', CONTACTO: '987654321', TIPO: 'HIERRO', DETALLE: 'HIERRO CARBOXIMALTOSA',
    MARCA: 'FERINJECT', SESIONES: 2, ANULADO: '', MOTIVO_ANULACION: '' }];
  const sesiones = [{ ID: 'SES-000001', FECHA_HORA: '2026-08-05 12:00', ID_REGISTRO: 'REG-000001', NUMERO: 1, FECHA: '2026-08-05', ASESORA: 'MAGALY', ANULADO: '' }];
  const altas = [];
  const frase = s => { const t = String(s).toLowerCase(); return t.charAt(0).toUpperCase() + t.slice(1); };
  const textoRegDemo = r => r.TIPO !== 'HIERRO' ? frase(r.DETALLE)
    : frase(r.DETALLE) + (r.MARCA ? ' · ' + frase(r.MARCA) : '') + ' × ' + r.SESIONES + (Number(r.SESIONES) === 1 ? ' sesión' : ' sesiones');
  const siguiente = (lista, prefijo) => prefijo + '-' + String(lista.length + 1).padStart(6, '0');
```

2. **`bootstrap`** suma: `doctores, procedimientos: ['SANGRÍA', 'AMO', 'BIOPSIA'], tratamientos: ['HIERRO SACARATO', 'HIERRO DERISOMALTOSA', 'HIERRO CARBOXIMALTOSA'], marcas: { 'HIERRO CARBOXIMALTOSA': ['FERINJECT', 'LIKFER'], 'HIERRO DERISOMALTOSA': ['MONOFER'] }`.

3. **Funciones del DEMO.** Agregar al objeto que devuelve, antes de `marcarSeguimiento`:
```js
    buscarPacienteRegistro: dni => {
      const s = pacientes.filter(x => x.DNI === String(dni).trim());
      if (!s.length) return { encontrado: false };
      const u = s.slice().sort((a, b) => a.ULTIMA_CITA < b.ULTIMA_CITA ? 1 : -1)[0];
      const d = doctores.find(x => x.sofdoc === u.MEDICO_ULTIMO);
      return { encontrado: true, nombre: u.NOMBRE, telefonos: String(u.TELEFONOS || '').split(' / ').filter(Boolean), ultimaFecha: u.ULTIMA_CITA,
        ultimoMedico: u.MEDICO_ULTIMO, doctor: d ? d.doctor : '', especialidades: s.map(x => ({ especialidad: x.ESPECIALIDAD, alta: x.ESTADO === 'ALTA' })) };
    },
    guardarRegistro: x => {
      exigir(x, false);
      const base = { FECHA: x.fecha, ASESORA: x.usuario, DOCTOR: x.doctor, NOMBRE: String(x.nombre).trim().toUpperCase(), DNI: x.dni,
        CONTACTO: x.contacto, MARCA: '', ANULADO: '', MOTIVO_ANULACION: '' };
      const filas = [];
      if (x.procedimiento) filas.push(Object.assign({}, base, { TIPO: 'PROCEDIMIENTO', DETALLE: x.procedimiento, SESIONES: 1 }));
      if (x.tratamiento) filas.push(Object.assign({}, base, { TIPO: 'HIERRO', DETALLE: x.tratamiento, MARCA: x.marca, SESIONES: Number(x.sesiones) }));
      if (!filas.length) throw new Error('Elija un procedimiento, un tratamiento o ambos.');
      if (!x.confirmado) {
        const dup = registros.find(r => !r.ANULADO && filas.some(f => f.DNI === r.DNI && f.DETALLE === r.DETALLE));
        if (dup) return { ok: false, duplicado: { ID: dup.ID, FECHA: dup.FECHA, TEXTO: textoRegDemo(dup) } };
      }
      filas.forEach(f => { f.ID = siguiente(registros, 'REG'); f.FECHA_HORA = hoy + ' 11:00'; f.TEXTO = textoRegDemo(f); registros.push(f); });
      return { ok: true, registros: filas };
    },
    getRegistrosHoy: () => registros.filter(r => r.FECHA_HORA.startsWith(hoy)).map(r => ({ ID: r.ID, HORA: r.FECHA_HORA.slice(11, 16),
      ASESORA: r.ASESORA, NOMBRE: r.NOMBRE, DNI: r.DNI, TEXTO: textoRegDemo(r), ANULADO: !!r.ANULADO }))
      .concat(altas.filter(a => a.FECHA_HORA.startsWith(hoy)).map(a => ({ ID: a.ID, HORA: a.FECHA_HORA.slice(11, 16), ASESORA: a.REGISTRADO_POR,
        NOMBRE: (pacientes.find(p => p.DNI === a.DNI) || {}).NOMBRE || '', DNI: a.DNI, TEXTO: 'Alta médica · ' + a.ESPECIALIDAD + ' · ' + a.DOCTOR, ANULADO: !!a.ANULADO })))
      .sort((a, b) => a.HORA < b.HORA ? 1 : a.HORA > b.HORA ? -1 : (a.ID < b.ID ? 1 : -1)),
    anularRegistro: x => {
      exigir(x, false);
      const r = registros.find(y => y.ID === x.id);
      r.ANULADO = 'SÍ'; r.MOTIVO_ANULACION = x.motivo;
      pendientes.filter(p => p.ID_REGISTRO === x.id).forEach(p => { p.ESTADO = 'ANULADO'; });
      return { ok: true };
    },
    darDeAlta: x => {
      exigir(x, false);
      if (!x.doctor) throw new Error('Elija el doctor que da el alta.');
      const a = { ID: siguiente(altas, 'ALT'), FECHA_HORA: hoy + ' 11:30', FECHA: x.fecha, DNI: x.dni, ESPECIALIDAD: x.especialidad,
        DOCTOR: x.doctor, REGISTRADO_POR: x.usuario, ANULADO: '', MOTIVO_ANULACION: '' };
      altas.push(a);
      const pac = pacientes.find(p => p.DNI === x.dni && p.ESPECIALIDAD === x.especialidad);
      if (pac) pac.ESTADO = 'ALTA';
      return { ok: true, alta: a };
    },
    anularAlta: x => {
      exigir(x, false);
      const a = altas.find(y => y.ID === x.id);
      a.ANULADO = 'SÍ'; a.MOTIVO_ANULACION = x.motivo;
      const pac = pacientes.find(p => p.DNI === a.DNI && p.ESPECIALIDAD === a.ESPECIALIDAD);
      if (pac) pac.ESTADO = 'VENCIDO';
      return { ok: true };
    },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `timeout 300 npm run test:ui`
Expected: PASS, las 23: 20 anteriores + 3 nuevas.

- [ ] **Step 5: Commit**

```bash
git add src/Index.html test/ui.test.js
git commit -m "Interfaz: pestaña Registro con duplicado, registrados hoy, anulación y alta médica"
```

---

### Task 8: «Lo hizo» y «Dar de alta» en la bandeja y en la ficha

**Files:**
- Modify: `src/Index.html`: `clave` (~línea 520), `filaHtml` (~565), `pintarPanel` (~625-668), `abrir`, `cerrar` y `mover` (~671-680), `resolver` (~689-725), clic del panel (~733-745), constantes de la ficha (~799-800), `pintarFicha` (~815-849) y su listener (~851); DEMO `pendientes`, `registrar` y `getPaciente`.
- Test: `test/ui.test.js`

**Interfaces:**
- Consumes:
  - de la Task 7: `pedirMotivo`, `confirmarAnulacion` y `opcionesDoctor`;
  - del servidor: `marcarSesion`, `darDeAlta`, `anularSesion` y `getPaciente().registros/altas`.
- Produces: `resolver(k, accion: 'HECHO'|'DESCARTADO'|'SESION'|'ALTA', motivo, extra)`.

- [ ] **Step 1: Write the failing test** — agregar a `test/ui.test.js`:

```js
test('bandeja: «Lo hizo» en un tratamiento en curso lo quita de la lista y suma la sesión', async () => {
  const { navegador, pagina, errores } = await abrir();
  try {
    await pagina.selectOption('#usuario', 'MAGALY');
    await tipo(pagina, 'HIERRO');
    assert.match(await pagina.locator('.fila', { hasText: 'ROSA ELENA' }).textContent(),
      /Hierro carboximaltosa · Ferinject × 2 sesiones · sesión 2 de 2 pendiente · última el 05\/08\/2026 · hace 57 días/);
    await pagina.locator('.fila', { hasText: 'ANA MARÍA' }).click();
    assert.match(await pagina.locator('#panel').innerText(), /Usuario: @ana\.flores/);
    await pagina.locator('.fila', { hasText: 'ROSA ELENA' }).click();
    assert.equal(await pagina.locator('#p-lohizo').textContent(), 'Lo hizo · sesión 2 de 2');
    await pagina.locator('#p-lohizo').click();
    await pagina.waitForFunction(() => /Sesión 2 de 2 registrada/.test(document.querySelector('#aviso').textContent));
    assert.equal(await pagina.locator('#aviso').textContent(), 'Sesión 2 de 2 registrada: ROSA ELENA QUISPE HUAMÁN');
    assert.deepEqual(await filas(pagina), ['ANA MARÍA FLORES RÍOS']);
    assert.equal(await pagina.locator('#c-hechos').textContent(), '0', '«Lo hizo» no es un seguimiento');
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('bandeja: «Dar de alta» desde el panel propone el doctor y saca al paciente', async () => {
  const { navegador, pagina, errores } = await abrir();
  try {
    await pagina.selectOption('#usuario', 'ANA');
    await tipo(pagina, 'REEVALUACION');
    await pagina.locator('.fila', { hasText: 'JORGE LUIS' }).click();
    assert.equal(await pagina.locator('#p-lohizo').count(), 0, 'las reevaluaciones no tienen «Lo hizo»');
    await pagina.locator('#p-alta').click();
    assert.equal(await pagina.inputValue('#p-alta-doctor'), 'Dra. Karen Matos');
    await pagina.locator('#p-alta-ok').click();
    await pagina.waitForFunction(() => /Alta registrada/.test(document.querySelector('#aviso').textContent));
    assert.equal(await pagina.locator('#aviso').textContent(), 'Alta registrada: JORGE LUIS MENDOZA PAREDES');
    assert.ok(!(await filas(pagina)).includes('JORGE LUIS MENDOZA PAREDES'));
    assert.match(await pagina.locator('.tipos button[data-tipo="REEVALUACION"]').textContent(), /3/);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('ficha: el tratamiento con sus sesiones, «Lo hizo», anular la última y «Dar de alta»', async () => {
  const { navegador, pagina, errores } = await abrir();
  try {
    await pagina.selectOption('#usuario', 'MAGALY');
    await pagina.locator('.nav button[data-vista="ficha"]').click();
    await pagina.fill('#q', 'quispe');
    await pagina.locator('#resultados [data-abrir="40111222"]').click();
    await pagina.waitForSelector('.reg-ficha');
    let t = await pagina.locator('.reg-ficha').innerText();
    assert.match(t, /Hierro carboximaltosa · Ferinject × 2 sesiones/);
    assert.match(t, /Sesión 1 ✓ 05\/08\/2026/);
    assert.match(t, /Sesión 2 pendiente/);
    await pagina.locator('[data-lohizo="REG-000001"]').click();
    await pagina.waitForFunction(() => /Sesión 2 ✓/.test(document.querySelector('.reg-ficha').textContent));
    assert.match(await pagina.locator('.reg-ficha').innerText(), /Completo/);
    await pagina.locator('[data-anular-ses="SES-000002"]').click();
    await pagina.fill('#g-motivo', 'Fecha equivocada');
    await pagina.locator('[data-confirmar-anular="SES-000002"]').click();
    await pagina.waitForFunction(() => /Sesión 2 pendiente/.test(document.querySelector('.reg-ficha').textContent));
    await pagina.locator('[data-alta-esp="HEMATOLOGÍA"]').click();
    await pagina.locator('[data-alta-ok="HEMATOLOGÍA"]').click();
    await pagina.waitForFunction(() => /Alta médica/.test(document.querySelector('#ficha').textContent));
    assert.match(await pagina.locator('#ficha').innerText(), /HEMATOLOGÍA · 01\/10\/2026 · Dr\. Elí Cabanillas · registró MAGALY · vigente/);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `timeout 300 node --test --test-name-pattern="Lo hizo|Dar de alta|ficha: el tratamiento" test/ui.test.js`
Expected: FAIL. La fila de ROSA sigue con el texto antiguo y no existen `#p-lohizo` ni `.reg-ficha`.

- [ ] **Step 3: Write minimal implementation** — en `src/Index.html`:

**CSS.** Junto al bloque de Registro:
```css
.p-sesion,.p-alta-form,.reg-acciones{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.p-usuario{margin:6px 0 0}
.reg-ficha{padding:12px 0;border-bottom:1px solid var(--chp-rule)}
.reg-ficha .sesiones{margin:8px 0;padding-left:20px}
.lista-altas{list-style:none;padding:0;margin:0}
.lista-altas li{padding:8px 0;border-bottom:1px solid var(--chp-rule)}
```

**Bandeja:**
```js
/** Las filas de Registro se identifican por su ID: un paciente puede tener dos tratamientos abiertos. */
const clave = t => t.ID_REGISTRO || (t.DNI + '|' + t.ESPECIALIDAD);
const enCursoReg = t => !!t.ID_REGISTRO && t.ESTADO_REGISTRO === 'EN CURSO';
```
En `filaHtml`, la constante `linea` pasa a:
```js
  const linea = enCursoReg(t)
    ? `${esc(t.DETALLE)} · sesión ${t.HECHAS + 1} de ${t.SESIONES} pendiente · última el ${fechaCorta(t.ULTIMA_SESION)}`
    : esIndicacion(t)
    ? `${esc(queCotizo(t))} · ${esc(medicoCorto(t.MEDICO_ULTIMO))} · Cotizó el ${fechaCorta(t.FECHA_COTIZACION)}`
    : `${esNuevo(t) ? 'Nuevo' : 'En control'} · ${esc(medicoCorto(t.MEDICO_ULTIMO))} · Debía volver el ${fechaCorta(t.PROXIMA_ESPERADA)}`;
```

**`pintarPanel`:**
- **Rama `esIndicacion(t)`.** Reemplazar el bloque `p-tipo` + `p-fechas` por:
```js
    ${esIndicacion(t) ? `<div class="p-tipo"><span class="marcas">${marcas(t)}</span>${esc(queCotizo(t))} · ${enCursoReg(t) ? `sesión ${t.HECHAS + 1} de ${t.SESIONES} pendiente` : 'cotizó y no lo hizo'}</div>
    <div class="p-fechas">
      <div><small>Cotizó el</small><span class="v"><b>${fechaCorta(t.FECHA_COTIZACION)}</b></span></div>
      <div><small>${enCursoReg(t) ? 'Última sesión' : 'Última consulta'}</small><span class="v">${fechaCorta(enCursoReg(t) ? t.ULTIMA_SESION : t.ULTIMA_CITA)}</span></div>
      <div class="p-hace">hace ${diasSinVolver(t)} días ${enCursoReg(t) ? 'de la última sesión' : 'que cotizó'}</div>
    </div>` : `…lo que ya estaba para reevaluaciones…`}
```
  La rama de reevaluación no cambia.
- **Después del bloque `p-tels`:**
```js
    ${t.USUARIO ? `<p class="p-usuario">Usuario: <b>${esc(t.USUARIO)}</b></p>` : ''}
```
- **Inmediatamente antes de `<textarea id="nota"`:**
```js
    ${t.ID_REGISTRO ? `<div class="p-sesion">
      <input type="date" class="entrada" id="p-fecha-ses" value="${hoy()}" max="${hoy()}" aria-label="Fecha de la sesión">
      <button type="button" class="btn-marca" id="p-lohizo">Lo hizo${t.SESIONES > 1 ? ` · sesión ${t.HECHAS + 1} de ${t.SESIONES}` : ''}</button>
    </div>` : ''}
```
- **Inmediatamente antes del botón `p-ficha`:**
```js
    ${!esIndicacion(t) ? `<button type="button" class="btn-texto" id="p-alta">Dar de alta…</button>
      ${E.dandoAlta ? `<div class="p-alta-form"><select id="p-alta-doctor" class="sel" aria-label="Doctor que da el alta">${opcionesDoctor(t.MEDICO_ULTIMO)}</select>
        <input type="date" class="entrada" id="p-alta-fecha" value="${hoy()}" max="${hoy()}" aria-label="Fecha del alta">
        <button type="button" class="btn-marca" id="p-alta-ok">Confirmar alta</button></div>` : ''}` : ''}
```

**`abrir`, `cerrar` y `mover`.** Donde se hace `E.descartando = false`, hacer también `E.dandoAlta = false`. Son tres sitios: `abrir`, `cerrar` y la línea `if (E.abierto) { E.abierto = E.sel; E.descartando = false; }` de `mover`. También en `pintarBandeja`: `if (E.abierto && !claves.includes(E.abierto)) { E.abierto = ''; E.descartando = false; E.dandoAlta = false; }`.

**`resolver`.** Firma y llamada:
```js
async function resolver(k, accion, motivo, extra = {}) {
```
y dentro: `E.descartando = false;` pasa a `E.descartando = false; E.dandoAlta = false;`. El bloque `try` queda:
```js
  try {
    const datos = { usuario: usuario(), dni: t.DNI, especialidad: t.ESPECIALIDAD, referencia: t.ID_REGISTRO || '', nota };
    if (accion === 'HECHO') await llamar('marcarSeguimiento', datos);
    else if (accion === 'DESCARTADO') await llamar('descartar', Object.assign(datos, { motivo }));
    else if (accion === 'SESION') await llamar('marcarSesion', { usuario: usuario(), id: t.ID_REGISTRO, fecha: extra.fecha, nota });
    else await llamar('darDeAlta', { usuario: usuario(), dni: t.DNI, especialidad: t.ESPECIALIDAD, doctor: extra.doctor, fecha: extra.fecha, nota });
    avisar({ HECHO: 'Seguimiento registrado: ', DESCARTADO: 'Descartado: ', ALTA: 'Alta registrada: ',
      SESION: `Sesión ${t.HECHAS + 1} de ${t.SESIONES} registrada: ` }[accion] + t.NOMBRE);
  } catch (e) {
```
El resto de `resolver` (quitar la fila, sumar `hechosHoy` solo con HECHO, devolverla si falla) no cambia.

**Clic del panel.** Antes de `if (b.id === 'p-ficha')`:
```js
  if (b.id === 'p-lohizo') { resolver(E.abierto, 'SESION', '', { fecha: $('#p-fecha-ses').value }); return; }
  if (b.id === 'p-alta') { E.dandoAlta = !E.dandoAlta; pintarPanel(); return; }
  if (b.id === 'p-alta-ok') {
    if (!$('#p-alta-doctor').value) { avisar('Elija el doctor que da el alta.'); return; }
    resolver(E.abierto, 'ALTA', '', { doctor: $('#p-alta-doctor').value, fecha: $('#p-alta-fecha').value });
    return;
  }
```

**Ficha.** Constantes:
```js
const ESTADO_BUENO = { 'AL DÍA': 1, 'RECUPERADO': 1, 'AGENDADO': 1, 'ALTA': 1 };
```
En `NOMBRE_ESTADO`, agregar `'ALTA': 'Alta médica'`. Agregar:
```js
const NOMBRE_REG = { COTIZADO: 'Cotizado', 'EN CURSO': 'En curso', COMPLETO: 'Completo', ANULADO: 'Anulado' };

function sesionesHtml(r) {
  if (r.ESTADO === 'ANULADO') return '';
  const hechas = r.sesiones || [];
  let html = '';
  for (let i = 1; i <= Number(r.SESIONES); i++) {
    const s = hechas[i - 1];
    html += s
      ? `<li>Sesión ${i} ✓ ${fechaCorta(s.FECHA)} · ${esc(s.ASESORA)}${i === hechas.length ? ` <button type="button" class="btn-texto" data-anular-ses="${esc(s.ID)}">Anular</button>` : ''}</li>`
      : `<li class="muted">Sesión ${i} pendiente</li>`;
  }
  return html;
}
```

En `pintarFicha(p)`:
- **En el `h2` de cada serie**, después del `<span class="estado">`, agregar el botón de alta para las series sin alta:
```js
      <h2>${esc(s.ESPECIALIDAD)}<span class="estado ${ESTADO_BUENO[s.ESTADO] ? 'bien' : 'mal'}">${esc(NOMBRE_ESTADO[s.ESTADO] || s.ESTADO)}</span>
        ${s.ESTADO !== 'ALTA' ? `<button type="button" class="btn-texto" data-alta-esp="${esc(s.ESPECIALIDAD)}" data-medico="${esc(s.MEDICO_ULTIMO)}">Dar de alta…</button>` : ''}</h2>
```
- **Antes de `$('#ficha').innerHTML = …`:**
```js
  const registros = (p.registros || []).length ? p.registros.map(r => `<div class="reg-ficha" data-reg="${esc(r.ID)}">
      <div><b>${esc(r.TEXTO)}</b> <span class="estado ${r.ESTADO === 'COMPLETO' ? 'bien' : 'mal'}">${esc(NOMBRE_REG[r.ESTADO] || r.ESTADO)}</span></div>
      <div class="muted">${esc(r.ID)} · ${fechaCorta(r.FECHA)} · ${esc(r.DOCTOR)} · registró ${esc(r.ASESORA)}${r.MOTIVO_ANULACION ? ' · anulado: ' + esc(r.MOTIVO_ANULACION) : ''}</div>
      <ol class="sesiones">${sesionesHtml(r)}</ol>
      ${r.ESTADO === 'COTIZADO' || r.ESTADO === 'EN CURSO' ? `<div class="reg-acciones">
        <input type="date" class="entrada" data-fecha-ses value="${hoy()}" max="${hoy()}" aria-label="Fecha de la sesión">
        <button type="button" class="btn-marca" data-lohizo="${esc(r.ID)}">Lo hizo</button>
        <button type="button" class="btn-texto" data-anular-reg="${esc(r.ID)}">Anular registro</button></div>` : ''}
    </div>`).join('') : '<p class="muted">Sin registros en la plataforma.</p>';
  const altas = (p.altas || []).length ? `<div class="seccion"><h2>Altas médicas</h2><ul class="lista-altas">${p.altas.map(a => `<li>
      ${esc(a.ESPECIALIDAD)} · ${fechaCorta(a.FECHA)} · ${esc(a.DOCTOR || 'sin doctor')} · registró ${esc(a.REGISTRADO_POR)}
      ${a.ANULADO ? ` · <span class="muted">anulada: ${esc(a.MOTIVO_ANULACION)}</span>` : a.VIGENTE ? ' · <b>vigente</b>' : ' · <span class="muted">cerrada: volvió después</span>'}
      ${!a.ANULADO && String(a.ID).startsWith('ALT-') ? ` <button type="button" class="btn-texto" data-anular-alta="${esc(a.ID)}">Anular</button>` : ''}</li>`).join('')}</ul></div>` : '';
```
- **El `innerHTML`** queda:
```js
  $('#ficha').innerHTML = `<div class="ficha-cab"><h1>${esc(p.nombre)}</h1><div class="muted">DNI ${esc(p.dni)}</div></div>
    ${confirmar}${series}
    <div class="seccion"><h2>Registros (procedimientos y tratamientos)</h2>${registros}</div>
    ${altas}
    <div class="seccion"><h2>Procedimientos indicados antes de la plataforma</h2>${indicaciones}</div>
    <div class="seccion"><h2>Seguimientos</h2>${seguimientos}</div>`;
```

Después del listener actual de `#ficha`, agregar otro:
```js
function refrescarTrasFicha() { E.kpi = null; E.resumen = null; abrirFicha(E.fichaDni); cargarBandeja(); }

$('#ficha').addEventListener('click', async ev => {
  const t = ev.target;
  const lo = t.closest('[data-lohizo]');
  if (lo) {
    if (!exigirUsuario()) return;
    lo.disabled = true;
    try {
      await llamar('marcarSesion', { usuario: usuario(), id: lo.dataset.lohizo, fecha: lo.closest('.reg-ficha').querySelector('[data-fecha-ses]').value, nota: '' });
      avisar('Sesión registrada: ' + lo.dataset.lohizo);
      refrescarTrasFicha();
    } catch (e) { lo.disabled = false; avisar('No se guardó: ' + e.message); }
    return;
  }
  const ar = t.closest('[data-anular-reg]');
  if (ar) { pedirMotivo(ar.closest('.reg-ficha'), 'registro', ar.dataset.anularReg); return; }
  const as = t.closest('[data-anular-ses]');
  if (as) { pedirMotivo(as.closest('li'), 'sesion', as.dataset.anularSes); return; }
  const aa = t.closest('[data-anular-alta]');
  if (aa) { pedirMotivo(aa.closest('li'), 'alta', aa.dataset.anularAlta); return; }
  const ca = t.closest('[data-confirmar-anular]');
  if (ca) { confirmarAnulacion(ca, refrescarTrasFicha); return; }
  if (t.closest('[data-cancelar-anular]')) { t.closest('.g-motivo').remove(); return; }
  const al = t.closest('[data-alta-esp]');
  if (al) {
    document.querySelectorAll('[data-alta-form]').forEach(x => x.remove());
    al.insertAdjacentHTML('afterend', `<div class="p-alta-form" data-alta-form>
      <select class="sel" data-alta-doctor aria-label="Doctor que da el alta">${opcionesDoctor(al.dataset.medico)}</select>
      <input type="date" class="entrada" data-alta-fecha value="${hoy()}" max="${hoy()}" aria-label="Fecha del alta">
      <button type="button" class="btn-marca" data-alta-ok="${esc(al.dataset.altaEsp)}">Confirmar alta</button></div>`);
    return;
  }
  const ok = t.closest('[data-alta-ok]');
  if (ok) {
    if (!exigirUsuario()) return;
    const f = ok.closest('[data-alta-form]');
    if (!f.querySelector('[data-alta-doctor]').value) { avisar('Elija el doctor que da el alta.'); return; }
    ok.disabled = true;
    try {
      await llamar('darDeAlta', { usuario: usuario(), dni: E.fichaDni, especialidad: ok.dataset.altaOk,
        doctor: f.querySelector('[data-alta-doctor]').value, fecha: f.querySelector('[data-alta-fecha]').value, nota: '' });
      avisar('Alta registrada: ' + ok.dataset.altaOk);
      refrescarTrasFicha();
    } catch (e) { ok.disabled = false; avisar('No se guardó: ' + e.message); }
  }
});
```

**DEMO:**

1. **La fila de hierro de ROSA pasa a venir de Registro, en curso.** Después de `const pendientes = [ … ];`:
```js
  Object.assign(pendientes[0], { ID_REGISTRO: 'REG-000001', DETALLE: 'Hierro carboximaltosa · Ferinject × 2 sesiones', SESIONES: 2, HECHAS: 1,
    ULTIMA_SESION: '2026-08-05', ESTADO_REGISTRO: 'EN CURSO', USUARIO: '' });
  pendientes[1].USUARIO = '@ana.flores';
```
   Los días siguen en 57, porque la sesión 1 fue el mismo día de la cotización. Así el orden de la bandeja no cambia.

2. **`registrar(x, accion)`.** La búsqueda del paciente pasa a:
```js
    const pac = pacientes.concat(pendientes).find(y => y.DNI === x.dni && y.ESPECIALIDAD === x.especialidad &&
      (x.referencia ? y.ID_REGISTRO === x.referencia : !y.ID_REGISTRO));
```

3. **Agregar al objeto DEMO:**
```js
    marcarSesion: x => {
      exigir(x, false);
      const r = registros.find(y => y.ID === x.id);
      const validas = sesiones.filter(s => s.ID_REGISTRO === r.ID && !s.ANULADO);
      if (validas.length >= r.SESIONES) throw new Error('Ese tratamiento ya tiene todas sus sesiones.');
      sesiones.push({ ID: siguiente(sesiones, 'SES'), FECHA_HORA: hoy + ' 12:00', ID_REGISTRO: r.ID, NUMERO: validas.length + 1,
        FECHA: x.fecha, ASESORA: x.usuario, ANULADO: '' });
      const item = pendientes.find(p => p.ID_REGISTRO === r.ID);
      const hechas = validas.length + 1;
      if (item) Object.assign(item, { HECHAS: hechas, ULTIMA_SESION: x.fecha, ESTADO: hechas >= r.SESIONES ? 'COMPLETO' : 'EN ESPERA' });
      return { ok: true, completo: hechas >= r.SESIONES };
    },
    anularSesion: x => {
      exigir(x, false);
      const s = sesiones.find(y => y.ID === x.id);
      s.ANULADO = 'SÍ';
      const item = pendientes.find(p => p.ID_REGISTRO === s.ID_REGISTRO);
      if (item) Object.assign(item, { HECHAS: item.HECHAS - 1, ESTADO: 'PENDIENTE' });
      return { ok: true };
    },
```

4. **`getPaciente(dni)`.** Agregar al objeto devuelto:
```js
        registros: registros.filter(r => r.DNI === dni).map(r => {
          const ss = sesiones.filter(s => s.ID_REGISTRO === r.ID && !s.ANULADO).sort((a, b) => a.NUMERO - b.NUMERO);
          const estado = r.ANULADO ? 'ANULADO' : ss.length >= r.SESIONES ? 'COMPLETO' : ss.length ? 'EN CURSO' : 'COTIZADO';
          return { ID: r.ID, FECHA: r.FECHA, TIPO: r.TIPO, TEXTO: textoRegDemo(r), DOCTOR: r.DOCTOR, ASESORA: r.ASESORA, SESIONES: r.SESIONES,
            ESTADO: estado, MOTIVO_ANULACION: r.MOTIVO_ANULACION || '', sesiones: ss.map(s => ({ ID: s.ID, NUMERO: s.NUMERO, FECHA: s.FECHA, ASESORA: s.ASESORA })) };
        }),
        altas: altas.filter(a => a.DNI === dni).map(a => Object.assign({}, a, { ANULADO: !!a.ANULADO, VIGENTE: !a.ANULADO })),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `timeout 300 npm run test:ui`
Expected: PASS, las 26. Si `bandeja: botones por tipo…` o `Hecho en una fila de hierro…` fallaran, revise que `clave` use `ID_REGISTRO` y que `registrar` del DEMO compare `referencia`.

- [ ] **Step 5: Commit**

```bash
git add src/Index.html test/ui.test.js
git commit -m "Interfaz: «Lo hizo» por sesión y «Dar de alta» en la bandeja y en la ficha"
```

---

### Task 9: Resumen y Detalle con altas y tratamientos completados

**Files:**
- Modify: `src/Index.html`:
  - CSS: `.r-metricas` (~162) y `.paso-plazo` (~219).
  - Detalle: `PASOS`, `partes`, `coh`, `totalCoh` y `filasCoh` (~966-990); `historia` (~920-945); `sumaInd`, `indTipo`, `indMed` y las tablas de Procedimientos (~996-1035).
  - Resumen: `CAMPOS_RESUMEN` y `sumarMes` (~1054-1075), `pintarResumen` (~1125-1140).
  - DEMO: `getKpi` y `getResumen`.
- Test: `test/ui.test.js`

**Interfaces:**
- Consumes: `getKpi().cohortes[].ALTAS`, `getKpi().indicaciones[].COMPLETADAS` y `getResumen().filas[]` con `NUEVOS_ALTA`, `CONTROL_ALTA` y `HIERRO_COMPLETO`.
- Produces: pantallas finales; nada que consuma otra tarea.

- [ ] **Step 1: Write the failing test** — en `test/ui.test.js`:

1. **En la prueba `resumen: el Dr. Eli ve sus pacientes…`**, cambiar `assert.equal(await pagina.locator('.r-metrica').count(), 3);` por `4`.

2. **En la prueba `detalle: hasta dónde llegó cada paciente nuevo…`:**
   - **La cabecera esperada** pasa a:
```js
    assert.deepEqual(cab, ['Mes de la primera consulta', 'Pacientes nuevos', 'Reparto', 'No volvió nunca', 'Volvió a 1 reevaluación',
      'Volvió a 2 reevaluaciones', 'Volvió a 3 o más', 'Aún en plazo', 'Alta médica']);
```
   - **Las filas:**
```js
    assert.equal(await fila('junio 2026'), 'junio 2026 40 25 · 63% 7 · 18% 3 · 8% 5 · 13% 0 0');
    assert.equal(await fila('julio 2026'), 'julio 2026 58 39 · 67% 8 · 14% 0 0 9 · 16% 2 · 3%');
    assert.equal(await fila('Total'), 'Total 146 100 · 68% 15 · 10% 3 · 2% 5 · 3% 21 · 14% 2 · 1%');
```
   - **Con el filtro de reumatología:**
```js
    assert.equal(await fila('Total'), 'Total 6 4 · 67% 0 0 0 2 · 33% 0');
```

3. **En la prueba `detalle: el relato…`**, agregar:
```js
    assert.match(t, /Además, 2 recibieron el alta médica: no cuentan como perdidos/);
```

4. **Pruebas nuevas:**
```js
test('resumen: tratamientos de hierro completados y altas fuera de «no volvió»', async () => {
  const { navegador, pagina, errores } = await abrir();
  try {
    await pagina.selectOption('#usuario', 'DR. ELI CABANILLAS');
    await pagina.locator('.nav button[data-vista="resumen"]').click();
    await pagina.waitForSelector('#r-mes-actual');
    await pagina.locator('#r-ant').click();
    const completo = pagina.locator('.r-metrica', { hasText: 'completaron el tratamiento de hierro' });
    assert.match(await completo.innerText(), /67%[\s\S]*6 de 9/);
    await pagina.selectOption('#r-med', '');
    await pagina.locator('.mm-col[data-mes="2026-07"]').click();
    const t = (await pagina.locator('#resumen').innerText()).replace(/\s+/g, ' ');
    assert.match(t, /^julio 2026/);
    assert.match(t, /57%/);
    assert.match(t, /33 de 58 pacientes/);
    assert.match(t, /Nuevos 25 de 36/);
    assert.match(t, /2 pacientes recibieron el alta médica: no cuentan como «no volvió»/);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});

test('detalle: procedimientos con cotizados, empezaron y completaron', async () => {
  const { navegador, pagina, errores } = await abrir();
  try {
    await pagina.locator('.nav button[data-vista="tablero"]').click();
    await pagina.waitForSelector('#tablero table');
    const s = pagina.locator('.seccion', { hasText: 'Procedimientos (hierro y otros)' });
    assert.deepEqual((await s.locator('table').first().locator('th').allInnerTexts()).map(x => x.trim()),
      ['Procedimiento', 'Cotizados', 'Empezaron', 'Completaron', 'Empezaron (%)']);
    assert.match((await s.locator('tr', { hasText: 'Hierro (Ferinject)' }).first().innerText()).replace(/\s+/g, ' '), /Hierro \(Ferinject\) 55 27 23 49%/);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `timeout 300 npm run test:ui`
Expected: FAIL. Las tres pruebas modificadas y las dos nuevas.

- [ ] **Step 3: Write minimal implementation** — en `src/Index.html`:

**CSS:**
- `.r-metricas{display:grid;grid-template-columns:repeat(4,1fr)}`
- Junto a `.paso-plazo`, agregar `.paso-alta{background:var(--chp-good)}`.

**Resumen:**
```js
const CAMPOS_RESUMEN = ['NUEVOS', 'NUEVOS_NO', 'NUEVOS_CURSO', 'NUEVOS_ALTA', 'CONTROL', 'CONTROL_NO', 'CONTROL_CURSO', 'CONTROL_ALTA',
  'HIERRO', 'HIERRO_NO', 'HIERRO_COMPLETO', 'PROC', 'PROC_NO', 'SEGUIMIENTOS', 'RECUPERADOS'];
```
En `sumarMes`:
```js
  o.REEVAL = o.NUEVOS - o.NUEVOS_CURSO - o.NUEVOS_ALTA + o.CONTROL - o.CONTROL_CURSO - o.CONTROL_ALTA;
  o.REEVAL_NO = o.NUEVOS_NO + o.CONTROL_NO;
  o.CURSO = o.NUEVOS_CURSO + o.CONTROL_CURSO;
  o.ALTA = o.NUEVOS_ALTA + o.CONTROL_ALTA;
```
En `pintarResumen`:
- **El desglose:**
```js
        <p class="r-desglose"><span><i class="m nuevo"></i>Nuevos ${m.NUEVOS_NO} de ${m.NUEVOS - m.NUEVOS_CURSO - m.NUEVOS_ALTA}</span><span><i class="m control"></i>En control ${m.CONTROL_NO} de ${m.CONTROL - m.CONTROL_CURSO - m.CONTROL_ALTA}</span></p>
```
- **Después de la nota de «aún no les toca volver»:**
```js
        ${m.ALTA ? `<p class="r-nota">${m.ALTA} pacientes recibieron el alta médica: no cuentan como «no volvió».</p>` : ''}
```
- **Las métricas:**
```js
        ${metrica(m.HIERRO_NO, m.HIERRO, 'pend', 'no siguieron el hierro (Ferinject)')}
        ${metrica(m.HIERRO_COMPLETO, m.HIERRO - m.HIERRO_NO, 'buena', 'completaron el tratamiento de hierro', 'aún sin tratamientos empezados')}
        ${metrica(m.PROC_NO, m.PROC, 'pend', 'no siguieron otros procedimientos')}
        ${metrica(m.RECUPERADOS, m.SEGUIMIENTOS, 'buena', 'volvieron tras el seguimiento', 'aún sin seguimientos este mes')}
```

**Detalle · reparto.**
- **`PASOS`** suma `{ t: 'Alta médica', c: 'paso-alta' }` al final.
- **`coh`:**
```js
  const coh = agrupar(k.cohortes.filter(r => okMes(r.COHORTE) && okEsp(r.ESPECIALIDAD) && okMed(r.MEDICO)),
    r => r.COHORTE, () => ({ 1: [0, 0], 2: [0, 0], 3: [0, 0], curso: 0, alta: { 1: 0, 2: 0, 3: 0 } }),
    (o, r) => { o[r.ETAPA][0] += Number(r.VOLVIERON); o[r.ETAPA][1] += Number(r.ELEGIBLES); o.curso += Number(r.EN_CURSO) || 0; o.alta[r.ETAPA] += Number(r.ALTAS) || 0; });
```
- **`partes`:**
```js
  // Un alta en la etapa k no es pérdida: sale de «aún en plazo» de esa etapa (o, en la 1.ª, suma al total del mes).
  const partes = o => {
    const [v1, e1] = o[1], [v2, e2] = o[2], [v3, e3] = o[3], al = o.alta;
    return { total: e1 + al[1], n: [e1 - v1, e2 - v2, e3 - v3, v3, (v1 - e2 - al[2]) + (v2 - e3 - al[3]), al[1] + al[2] + al[3]] };
  };
```
- **`filasCoh` y `totalCoh`:**
```js
  const filasCoh = coh.filter(([, o]) => partes(o).total).map(([c, o]) => filaCoh(esc(nombreMes(c)), o));
  const totalCoh = { 1: [0, 0], 2: [0, 0], 3: [0, 0], curso: 0, alta: { 1: 0, 2: 0, 3: 0 } };
  coh.forEach(([, o]) => { totalCoh.curso += o.curso; [1, 2, 3].forEach(e => { totalCoh[e][0] += o[e][0]; totalCoh[e][1] += o[e][1]; totalCoh.alta[e] += o.alta[e]; }); });
```
- **En `historia(t, …)`**, antes de `if (meta) frases.push(…)`:
```js
  const altas = t.alta ? t.alta[1] + t.alta[2] + t.alta[3] : 0;
  if (altas) frases.push(`<p>Además, ${altas} recibieron el alta médica: no cuentan como perdidos.</p>`);
```

**Detalle · Procedimientos:**
```js
  const sumaInd = (o, r) => { o.n += Number(r.INDICADAS); o.a += Number(r.ACEPTADAS); o.c += Number(r.COMPLETADAS ?? r.ACEPTADAS) || 0; };
  const filaInd = ([c, o]) => [esc(c), o.n, o.a, o.c, pct(o.a, o.n) + barra(o.a, o.n)];
  const nombreInd = r => r.TIPO !== 'HIERRO' ? r.DETALLE : norm(r.DETALLE) === 'HIERRO' ? 'Hierro (Ferinject)'
    : String(r.DETALLE).charAt(0) + String(r.DETALLE).slice(1).toLowerCase();
  const indTipo = agrupar(ind, nombreInd, () => ({ n: 0, a: 0, c: 0 }), sumaInd).map(filaInd);
  const indMed = agrupar(ind, r => r.MEDICO, () => ({ n: 0, a: 0, c: 0 }), sumaInd).map(filaInd);
```
En la sección:
```js
    <div class="seccion"><h2>Procedimientos (hierro y otros)</h2>
      <p class="muted">De lo cotizado, cuánto se empezó y cuánto se completó: todas las sesiones de un tratamiento, o el procedimiento hecho. Lo registrado hace menos de 7 días todavía no cuenta. Los procedimientos no tienen especialidad: ese filtro no los cambia.</p>
      ${tabla([T('Procedimiento'), N('Cotizados'), N('Empezaron'), N('Completaron'), N('Empezaron (%)')], indTipo)}
      <h3>Por médico</h3>
      ${tabla([T('Médico'), N('Cotizados'), N('Empezaron'), N('Completaron'), N('Empezaron (%)')], indMed)}</div>
```

**DEMO:**
- **`getKpi`:**
  - la fila `{ COHORTE: '2026-07', …, MEDICO: KAREN, ETAPA: 2, ELEGIBLES: 17, VOLVIERON: 9 }` suma `ALTAS: 2`;
  - las filas de `indicaciones` suman `COMPLETADAS`: 10 en la de 30/14 (ELI), 1 en la de 9/1 (KAREN) y 13 en la de 25/13 (KAREN);
  - el objeto suma `meta: 60`, si no lo tiene ya.
- **`getResumen`.** El ayudante `r` suma tres posiciones opcionales:
```js
      const r = (MES, MEDICO, v) => ({ MES, MEDICO, NUEVOS: v[0], NUEVOS_NO: v[1], NUEVOS_CURSO: v[2], CONTROL: v[3], CONTROL_NO: v[4],
        CONTROL_CURSO: v[5], HIERRO: v[6], HIERRO_NO: v[7], PROC: v[8], PROC_NO: v[9], SEGUIMIENTOS: v[10], RECUPERADOS: v[11],
        NUEVOS_ALTA: v[12] || 0, CONTROL_ALTA: v[13] || 0, HIERRO_COMPLETO: v[14] || 0 });
```
  y las filas:
```js
        r('2026-08', ELI, [40, 24, 0, 30, 9, 0, 15, 6, 4, 3, 0, 0, 0, 0, 6]),
        r('2026-07', KAREN, [38, 25, 0, 22, 8, 0, 9, 4, 5, 4, 0, 0, 2, 0, 0])
```

- [ ] **Step 4: Run test to verify it passes**

Run: `timeout 300 npm run test:ui && npm test`
Expected: PASS, las 28 de interfaz y todas las de lógica.

- [ ] **Step 5: Commit**

```bash
git add src/Index.html test/ui.test.js
git commit -m "Resumen y Detalle: hierro completado, altas aparte y columnas Empezaron/Completaron"
```

---

### Task 10: Documentación, revisión visual y cierre

**Files:**
- Modify: `CLAUDE.md`, `docs/superpowers/specs/2026-10-05-pestana-registro-design.md` (estado → aprobado e implementado)

- [ ] **Step 1: Documentar.** En `CLAUDE.md`, sección «Reglas al modificar»:
  - **Agregar estas reglas:**
    - Los procedimientos y tratamientos se registran en la pestaña **Registro** (`REGISTROS`, `SESIONES`) y las altas en `ALTAS`, por especialidad. `INDICACIONES` es historial congelado.
    - Una fila de Registro nunca se borra: se anula (`ANULADO` = SÍ + motivo). Solo se anula la última sesión de un tratamiento.
    - El estado de un registro (cotizado, en curso, completo, anulado) se calcula con `estadoRegistro`; no se guarda en ninguna celda.
    - `SEGUIMIENTOS` se escribe por posición: una columna nueva solo se agrega al final, con `encabezadoAmpliable`.
  - **Nombres públicos nuevos** en la lista de la regla de nombres: `guardarRegistro`, `marcarSesion`, `anularRegistro`, `anularSesion`, `darDeAlta`, `anularAlta`, `getRegistrosHoy` y `buscarPacienteRegistro`.
  - **Tabla de archivos:** `src/Registro.gs` (lógica pura de Registro) y `src/RegistroServidor.gs` (funciones de la pestaña Registro).
  - **Sección «Publicar»:** «tras publicar: menú **Preparar hojas** y luego **Verificar**».
  - **En el spec**, cambiar `Estado: **borrador para revisión**` por `Estado: **aprobado (05/10/2026)**`.

- [ ] **Step 2: Revisión visual.** Con Playwright, tomar capturas del DEMO en la pestaña Registro (claro, oscuro y 390 px), del panel con «Lo hizo», de la ficha de ROSA y del Resumen con cuatro métricas a 1440 px. Revise que:
  - no haya scroll horizontal a 390 px;
  - los campos y los botones no se monten;
  - el modo oscuro no tenga fondos claros.

  Corrija lo que encuentre, con una prueba si es un comportamiento.

- [ ] **Step 3: Todo verde**

Run: `npm test && timeout 300 npm run test:ui`
Expected: PASS, todas.

- [ ] **Step 4: Commit y push**

```bash
git add CLAUDE.md docs/superpowers/specs/2026-10-05-pestana-registro-design.md
git commit -m "Documentación de la pestaña Registro"
git push -q origin HEAD:claude/compassionate-lovelace-3q6rh3 HEAD:main
```

- [ ] **Step 5: Revisión final.** Un revisor nuevo, en el modelo más capaz, revisa la rama entera contra el spec, con foco en la sección **Review Focus**. Los hallazgos Important se corrigen con prueba RED→GREEN antes de entregar.
