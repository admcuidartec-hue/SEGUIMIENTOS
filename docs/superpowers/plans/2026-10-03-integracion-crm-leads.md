# Integración con el CRM de leads — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Leer la hoja `LEADS` del CRM (solo lectura) para sumar teléfonos a los pacientes y medir qué canales y campañas traen pacientes que vuelven a su 1.ª reevaluación. Se actualiza con el botón y además cada día a las 7:00.

**Architecture:**
- **Lógica pura (`Logica.gs`):** se añaden la lectura del CRM, el emparejamiento, la atribución y el indicador por campaña.
- **Lectura y escritura (`Menu.gs`):** `actualizar_()` copia los leads útiles a la pestaña `CONTACTOS_CRM` del libro madre.
- **Activador diario:** `ScriptApp` programa la misma actualización a las 7:00.
- **La app (`Index.html`):** el Detalle muestra la sección nueva.

**Tech Stack:** Google Apps Script V8, clasp 2.4.x, Node 22 (`node:test`), Playwright 1.56.1.

**Spec:** `docs/superpowers/specs/2026-10-03-integracion-crm-leads-design.md` (amplía `2026-10-01-plataforma-seguimientos-design.md`)

## Global Constraints

- Libro del CRM: `1dofPqkj644Y0kfYYpX2WG9g8JlHYFai8nk--CzFtbsM`, hoja `LEADS`. **Solo lectura: ningún código escribe en él.**
- Columnas del CRM **por nombre de encabezado**. Obligatorias: `ID`, `FECHA`, `TELEFONO`. Opcionales: `NOMBRES`, `APELLIDOS`, `DNI`, `CANAL`, `CANAL_ESPECIFICO`, `CAMPANA`.
- Pestaña nueva: `CONTACTOS_CRM` con `ID_LEAD, FECHA, NOMBRE, DNI, TELEFONO, CANAL, CAMPANA, DNI_PACIENTE, EMPAREJAMIENTO`.
- Campaña vacía, «NINGUNA CAMPAÑA» o «NO SE VISUALIZA CAMPAÑA» → `Sin campaña`. Canal vacío → `Sin canal`. Paciente sin lead → canal y campaña `Sin lead en el CRM`.
- Atribución: el lead más reciente con `FECHA ≤ primera consulta`; si hay empate, gana el `ID_LEAD` mayor. Los pacientes con primera consulta anterior al lead más antiguo quedan fuera.
- Activador diario a las 7:00 en `America/Lima`. Función `actualizacionDiaria`. Nunca hay dos activadores.
- Toda la interfaz y los mensajes en español. Ningún dato real de pacientes en pruebas ni en el DEMO.
- Las reglas del proyecto en `CLAUDE.md` siguen vigentes: `LockService` en escrituras, `limpiarParaEnvio`, colores solo en los tokens, nombres públicos fijos.

## Review Focus

1. **Al CRM le cambian el nombre de una columna obligatoria** → la `CONTACTOS_CRM` anterior se conserva y el resto se actualiza. Prueba: `traerCrm_ no reescribe CONTACTOS_CRM si al CRM le falta una columna` (Tarea 3).
2. **Un lead posterior a la primera consulta** (el paciente volvió a escribir después) no se lleva la atribución. Prueba: `atribución: el lead posterior a la primera consulta no cuenta` (Tarea 2).
3. **El mismo teléfono en la base de hierro y en el CRM** aparece una sola vez. Prueba: `teléfonos: hierro primero, luego CRM, sin repetidos` (Tarea 2).
4. **Pulsar dos veces «Activar actualización diaria»** deja un solo activador. Prueba: `programarDiaria_ deja un solo activador` (Tarea 3).
5. **Un paciente cuya primera consulta es anterior al CRM** no aparece como «Sin lead». Prueba: `atribución: paciente anterior al CRM queda fuera` (Tarea 2).

---

## Mapa de archivos

| Archivo | Cambio |
|---|---|
| `src/Logica.gs` | Lectura y emparejamiento de leads, teléfonos combinados, atribución, `kpiCampanas` |
| `src/Codigo.gs` | `CONFIG.CRM_ID`, `leerContactos_`, `datos_` y `getKpi` con contactos |
| `src/Menu.gs` | `traerCrm_`, `actualizar_(quien)`, `actualizacionDiaria`, `programarDiaria_`, `activarDiaria`, menú, `hojasBase_` |
| `src/appsscript.json` | Permiso `script.scriptapp` |
| `src/Index.html` | Sección «¿Qué campañas traen pacientes que vuelven?» en Detalle y DEMO |
| `test/logica-crm.test.js` | Pruebas de lógica nuevas |
| `test/menu.test.js`, `test/sintaxis.test.js`, `test/ui.test.js` | Pruebas añadidas o ajustadas |

---

### Task 1: Leer y emparejar los leads del CRM

**Files:**
- Modify: `src/Logica.gs` (al final del bloque de emparejamiento, justo antes del comentario `PACIENTES Y BANDEJA`)
- Test: `test/logica-crm.test.js` (nuevo)

**Interfaces:**
- Consumes: `indiceDeEncabezado`, `textoLimpio_`, `normTexto`, `normDni`, `normTelefono`, `fechaIso`, `construirIndiceNombres`, `emparejar`.
- Produces:
  - `COLUMNAS_CONTACTOS`
  - `contactosDesdeCrm(encabezado, filas) → { contactos: Contacto[], faltantes: string[] }`
  - `emparejarContactos(contactos, citas) → number` (cuántos quedaron unidos; modifica `DNI_PACIENTE` y `EMPAREJAMIENTO`)
  - `Contacto = { ID_LEAD, FECHA: 'yyyy-MM-dd', NOMBRE, DNI, TELEFONO, CANAL, CAMPANA, DNI_PACIENTE, EMPAREJAMIENTO }`
  - `EMPAREJAMIENTO`: `'POR DNI' | 'AUTOMÁTICO' | 'POR CONFIRMAR' | 'SIN CANDIDATO'`

- [ ] **Step 1: Escribir las pruebas**

```js
// test/logica-crm.test.js — Integración con el CRM de leads. Datos inventados.
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar, plano } = require('./cargar');
const { cita, reglas, MEDICO } = require('./fixtures');
const L = cargar();

const ENC = ['ID', 'FECHA', 'ASESORA', 'APELLIDOS', 'NOMBRES', 'DNI', 'TELEFONO', 'CANAL', 'CANAL_ESPECIFICO', 'CAMPANA', 'ESTATUS'];
const lead = o => [o.id, o.fecha || '2026-07-10 10:00', 'MAGALY', o.apellidos || '', o.nombres || '', o.dni || '', o.tel || '', o.canal || 'MENSAJE',
  o.esp === undefined ? 'FACEBOOK ADS' : o.esp, o.campana === undefined ? 'LAB-001' : o.campana, 'ACEPTÓ'];

test('contactosDesdeCrm lee por encabezado, normaliza y descarta leads sin DNI ni nombre', () => {
  const r = plano(L.contactosDesdeCrm(ENC, [
    lead({ id: 'L-1', nombres: 'Rosa  Elena', apellidos: 'Quispe Huaman', dni: '040111222', tel: '987 654 321' }),
    lead({ id: 'L-2', tel: '999111222' }),
    lead({ id: 'L-3', dni: '40222333', tel: '912345678', campana: 'NINGUNA CAMPAÑA', esp: '' }),
    lead({ id: 'L-4', nombres: 'Jorge', apellidos: 'Mendoza', campana: 'NO SE VISUALIZA CAMPAÑA', esp: '', canal: '' })
  ]));
  assert.deepEqual(r.faltantes, []);
  assert.deepEqual(r.contactos.map(c => c.ID_LEAD), ['L-1', 'L-3', 'L-4']);
  assert.deepEqual(r.contactos[0], { ID_LEAD: 'L-1', FECHA: '2026-07-10', NOMBRE: 'Rosa Elena Quispe Huaman', DNI: '40111222',
    TELEFONO: '987654321', CANAL: 'FACEBOOK ADS', CAMPANA: 'LAB-001', DNI_PACIENTE: '', EMPAREJAMIENTO: '' });
  assert.equal(r.contactos[1].CAMPANA, 'Sin campaña');
  assert.equal(r.contactos[1].CANAL, 'MENSAJE');
  assert.equal(r.contactos[2].CAMPANA, 'Sin campaña');
  assert.equal(r.contactos[2].CANAL, 'Sin canal');
});

test('contactosDesdeCrm nombra la columna obligatoria que falta y no devuelve contactos', () => {
  const r = plano(L.contactosDesdeCrm(ENC.filter(c => c !== 'TELEFONO'), [lead({ id: 'L-1', dni: '1' })]));
  assert.deepEqual(r.faltantes, ['TELEFONO']);
  assert.deepEqual(r.contactos, []);
});

test('emparejarContactos: por DNI si el paciente existe; si no, por nombre con un solo candidato', () => {
  const citas = [
    cita({ dni: '40111222', nombre: 'ROSA ELENA QUISPE HUAMAN', fecha: '2026-07-20' }),
    cita({ dni: '40222333', nombre: 'JORGE LUIS MENDOZA PAREDES', fecha: '2026-07-21' }),
    cita({ dni: '40999888', nombre: 'JORGE MENDOZA SALAS', fecha: '2026-07-22' })
  ];
  const contactos = [
    { ID_LEAD: 'L-1', NOMBRE: '', DNI: '40111222' },
    { ID_LEAD: 'L-2', NOMBRE: 'Rosa Quispe', DNI: '77777777' },
    { ID_LEAD: 'L-3', NOMBRE: 'Jorge Mendoza', DNI: '' },
    { ID_LEAD: 'L-4', NOMBRE: 'Pedro Castillo', DNI: '' }
  ];
  assert.equal(L.emparejarContactos(contactos, citas), 2);
  assert.deepEqual(plano(contactos.map(c => [c.DNI_PACIENTE, c.EMPAREJAMIENTO])),
    [['40111222', 'POR DNI'], ['40111222', 'AUTOMÁTICO'], ['', 'POR CONFIRMAR'], ['', 'SIN CANDIDATO']]);
});
```

- [ ] **Step 2: Correr las pruebas y ver que fallan**

Run: `node --test test/logica-crm.test.js`
Expected: FAIL con `L.contactosDesdeCrm is not a function`.

- [ ] **Step 3: Añadir a `src/Logica.gs`, justo antes del bloque `PACIENTES Y BANDEJA`**

```js
/* ==========================================================================
   CRM DE LEADS (solo lectura)

   Se traen solo los leads con DNI o nombre (sin ellos no se pueden unir con
   ningún paciente) y solo las columnas que hacen falta.
   ========================================================================== */

var COLUMNAS_CONTACTOS = ['ID_LEAD', 'FECHA', 'NOMBRE', 'DNI', 'TELEFONO', 'CANAL', 'CAMPANA', 'DNI_PACIENTE', 'EMPAREJAMIENTO'];
var CRM_OBLIGATORIAS = ['ID', 'FECHA', 'TELEFONO'];

function campanaLimpia_(v) {
  var t = textoLimpio_(v), n = normTexto(t);
  if (!n || n === 'NINGUNA CAMPANA' || n === 'NO SE VISUALIZA CAMPANA') return 'Sin campaña';
  return t;
}

function contactosDesdeCrm(encabezado, filas) {
  var idx = indiceDeEncabezado(encabezado);
  var faltantes = CRM_OBLIGATORIAS.filter(function (c) { return idx[c] === undefined; });
  if (faltantes.length) return { contactos: [], faltantes: faltantes };
  function celda(f, k) { return idx[k] === undefined ? '' : f[idx[k]]; }
  var out = [];
  (filas || []).forEach(function (f) {
    var id = textoLimpio_(celda(f, 'ID'));
    var nombre = textoLimpio_(textoLimpio_(celda(f, 'NOMBRES')) + ' ' + textoLimpio_(celda(f, 'APELLIDOS')));
    var dni = normDni(celda(f, 'DNI'));
    var fecha = fechaIso(celda(f, 'FECHA'));
    if (!id || !fecha || (!dni && !nombre)) return;
    out.push({
      ID_LEAD: id,
      FECHA: fecha,
      NOMBRE: nombre,
      DNI: dni,
      TELEFONO: normTelefono(celda(f, 'TELEFONO')),
      CANAL: textoLimpio_(celda(f, 'CANAL_ESPECIFICO')) || textoLimpio_(celda(f, 'CANAL')) || 'Sin canal',
      CAMPANA: campanaLimpia_(celda(f, 'CAMPANA')),
      DNI_PACIENTE: '',
      EMPAREJAMIENTO: ''
    });
  });
  return { contactos: out, faltantes: [] };
}

/** Une cada lead con su paciente: por DNI si existe en CITAS; si no, por nombre (un solo candidato). */
function emparejarContactos(contactos, citas) {
  var conCitas = {}, n = 0;
  (citas || []).forEach(function (c) { conCitas[c.DNI] = 1; });
  var indice = construirIndiceNombres(citas);
  (contactos || []).forEach(function (c) {
    if (c.DNI && conCitas[c.DNI]) { c.DNI_PACIENTE = c.DNI; c.EMPAREJAMIENTO = 'POR DNI'; n++; return; }
    var r = c.NOMBRE ? emparejar(c.NOMBRE, indice) : { estado: 'SIN CANDIDATO', dni: '' };
    c.DNI_PACIENTE = r.estado === 'AUTOMÁTICO' ? r.dni : '';
    c.EMPAREJAMIENTO = r.estado;
    if (c.DNI_PACIENTE) n++;
  });
  return n;
}
```

- [ ] **Step 4: Correr las pruebas y ver que pasan**

Run: `node --test test/logica-*.test.js`
Expected: PASS, todas: 3 nuevas y las 58 anteriores de lógica.

- [ ] **Step 5: Commit**

```bash
git add src/Logica.gs test/logica-crm.test.js
git commit -m "Lógica: leer y emparejar los leads del CRM"
```

---

### Task 2: Teléfonos combinados, atribución e indicador por campaña

**Files:**
- Modify: `src/Logica.gs` (`telefonosPorDni`, `armarPacientes`, `calcularKpi`; funciones nuevas al final del bloque de indicadores)
- Test: `test/logica-crm.test.js` (se añaden pruebas)

**Interfaces:**
- Consumes: `Contacto` (Tarea 1), `armarSeries`, `claveSerie`, `plazoDe`, `sumarDias`, `mesDe`, `normTexto`, `normTelefono`, `compararCampos_`.
- Produces:
  - `telefonosPorDni(indicaciones, contactos)`
  - `armarPacientes(citas, indicaciones, seguimientos, reglas, hoy, contactos)`, con `contactos` opcional
  - `atribuirCampanas(citas, contactos) → { [dni]: { CANAL, CAMPANA, ID_LEAD } }`
  - `kpiCampanas(citas, contactos, reglas, hoy) → [{ MES, MEDICO, CANAL, CAMPANA, NUEVOS, EN_CURSO, VOLVIERON }]`
  - `calcularKpi(citas, indicaciones, seguimientos, reglas, hoy, contactos)`, que añade la clave `campanas`

- [ ] **Step 1: Añadir las pruebas al final de `test/logica-crm.test.js`**

```js
const C = o => Object.assign({ ID_LEAD: 'L', FECHA: '2026-07-01', NOMBRE: '', DNI: '', TELEFONO: '', CANAL: 'FACEBOOK ADS',
  CAMPANA: 'LAB-001', DNI_PACIENTE: '', EMPAREJAMIENTO: 'POR DNI' }, o);

test('teléfonos: hierro primero, luego CRM, sin repetidos', () => {
  const citas = [cita({ fecha: '2026-07-01' })];
  const inds = [{ DNI: '40111222', TELEFONO: '987654321', ESTADO: 'ACEPTÓ', TIPO: 'HIERRO', FECHA: '2026-07-01' }];
  const contactos = [C({ DNI_PACIENTE: '40111222', TELEFONO: '987654321' }), C({ ID_LEAD: 'L2', DNI_PACIENTE: '40111222', TELEFONO: '912345678' }),
    C({ ID_LEAD: 'L3', DNI_PACIENTE: '', TELEFONO: '955555555' })];
  const p = L.armarPacientes(citas, inds, [], reglas(L), '2026-10-01', contactos);
  assert.equal(p[0].TELEFONOS, '987654321 / 912345678');
  assert.equal(L.armarPacientes(citas, inds, [], reglas(L), '2026-10-01')[0].TELEFONOS, '987654321', 'sin contactos funciona igual');
});

test('atribución: el lead más reciente anterior o igual a la primera consulta', () => {
  const citas = [cita({ dni: '1', fecha: '2026-08-10' }), cita({ dni: '1', fecha: '2026-09-01' })];
  const contactos = [
    C({ ID_LEAD: 'L-1', FECHA: '2026-07-01', DNI_PACIENTE: '1', CANAL: 'GOOGLE' }),
    C({ ID_LEAD: 'L-2', FECHA: '2026-08-05', DNI_PACIENTE: '1', CANAL: 'FACEBOOK ADS', CAMPANA: 'ANM-001' }),
    C({ ID_LEAD: 'L-3', FECHA: '2026-08-10', DNI_PACIENTE: '1', CANAL: 'INSTAGRAM' }),
    C({ ID_LEAD: 'L-0', FECHA: '2026-08-10', DNI_PACIENTE: '1', CANAL: 'REFERIDO' })
  ];
  assert.deepEqual(plano(L.atribuirCampanas(citas, contactos)), { 1: { CANAL: 'INSTAGRAM', CAMPANA: 'LAB-001', ID_LEAD: 'L-3' } });
});

test('atribución: el lead posterior a la primera consulta no cuenta', () => {
  const citas = [cita({ dni: '1', fecha: '2026-08-10' })];
  const contactos = [C({ ID_LEAD: 'L-0', FECHA: '2026-07-01' }), C({ ID_LEAD: 'L-9', FECHA: '2026-08-20', DNI_PACIENTE: '1', CANAL: 'GOOGLE' })];
  assert.deepEqual(plano(L.atribuirCampanas(citas, contactos))['1'], { CANAL: 'Sin lead en el CRM', CAMPANA: 'Sin lead en el CRM', ID_LEAD: '' });
});

test('atribución: paciente anterior al CRM queda fuera', () => {
  const citas = [cita({ dni: '1', fecha: '2026-06-15' }), cita({ dni: '2', fecha: '2026-07-15' })];
  const contactos = [C({ ID_LEAD: 'L-1', FECHA: '2026-07-01', DNI_PACIENTE: '2' })];
  assert.deepEqual(Object.keys(plano(L.atribuirCampanas(citas, contactos))), ['2']);
  assert.deepEqual(plano(L.atribuirCampanas(citas, [])), {});
});

test('kpiCampanas: nuevos, en curso y volvieron, por mes de primera consulta, médico, canal y campaña', () => {
  const citas = [
    cita({ dni: '1', fecha: '2026-07-10' }), cita({ dni: '1', fecha: '2026-08-05' }),
    cita({ dni: '2', fecha: '2026-07-12' }),
    cita({ dni: '3', fecha: '2026-09-25' })
  ];
  const contactos = [
    C({ ID_LEAD: 'L-1', FECHA: '2026-07-01', DNI_PACIENTE: '1' }),
    C({ ID_LEAD: 'L-2', FECHA: '2026-07-02', DNI_PACIENTE: '2' }),
    C({ ID_LEAD: 'L-3', FECHA: '2026-09-20', DNI_PACIENTE: '3', CANAL: 'GOOGLE', CAMPANA: 'Sin campaña' })
  ];
  assert.deepEqual(plano(L.kpiCampanas(citas, contactos, reglas(L), '2026-10-02')), [
    { MES: '2026-07', MEDICO, CANAL: 'FACEBOOK ADS', CAMPANA: 'LAB-001', NUEVOS: 2, EN_CURSO: 0, VOLVIERON: 1 },
    { MES: '2026-09', MEDICO, CANAL: 'GOOGLE', CAMPANA: 'Sin campaña', NUEVOS: 1, EN_CURSO: 1, VOLVIERON: 0 }
  ]);
});

test('calcularKpi incluye campanas', () => {
  const k = plano(L.calcularKpi([cita({ dni: '1', fecha: '2026-07-10' })], [], [], reglas(L), '2026-10-02',
    [C({ DNI_PACIENTE: '1' })]));
  assert.equal(k.campanas.length, 1);
  assert.deepEqual(plano(L.calcularKpi([], [], [], reglas(L), '2026-10-02')).campanas, []);
});
```

- [ ] **Step 2: Correr las pruebas y ver que fallan**

Run: `node --test test/logica-crm.test.js`
Expected: FAIL. El teléfono `912345678` no aparece, y salen `L.atribuirCampanas is not a function` y `L.kpiCampanas is not a function`.

- [ ] **Step 3: Reemplazar `telefonosPorDni` en `src/Logica.gs`**

```js
/** Teléfonos de cada paciente: primero los de hierro y procedimientos, luego los del CRM, sin repetir. */
function telefonosPorDni(indicaciones, contactos) {
  var out = {};
  function sumar(dni, telefono) {
    var t = normTelefono(telefono);
    if (!dni || !t) return;
    out[dni] = out[dni] || [];
    if (out[dni].indexOf(t) < 0) out[dni].push(t);
  }
  (indicaciones || []).forEach(function (i) { sumar(i.DNI, i.TELEFONO); });
  (contactos || []).forEach(function (c) { sumar(c.DNI_PACIENTE, c.TELEFONO); });
  return out;
}
```

- [ ] **Step 4: En `armarPacientes`, cambiar las dos primeras líneas**

Reemplazar:

```js
function armarPacientes(citas, indicaciones, seguimientos, reglas, hoy) {
  var series = armarSeries(citas);
  var tel = telefonosPorDni(indicaciones), pend = pendientesPorDni(indicaciones), segs = segsPorSerie(seguimientos);
```

por:

```js
function armarPacientes(citas, indicaciones, seguimientos, reglas, hoy, contactos) {
  var series = armarSeries(citas);
  var tel = telefonosPorDni(indicaciones, contactos), pend = pendientesPorDni(indicaciones), segs = segsPorSerie(seguimientos);
```

- [ ] **Step 5: Reemplazar `calcularKpi` y añadir antes de él la atribución y `kpiCampanas`**

```js
/** Primera cita realizada de cada DNI, en cualquier especialidad. */
function primerasConsultas_(citas) {
  var p = {};
  (citas || []).forEach(function (c) {
    if (normTexto(c.ESTADO) !== 'REALIZADO') return;
    if (!p[c.DNI] || c.FECHA < p[c.DNI].FECHA) p[c.DNI] = c;
  });
  return p;
}

/**
 * Cada paciente va al lead más reciente con fecha <= su primera consulta (en
 * empate, el ID mayor). Los pacientes anteriores al lead más antiguo del CRM
 * quedan fuera: el CRM aún no existía.
 */
function atribuirCampanas(citas, contactos) {
  var todos = (contactos || []).filter(function (c) { return c.FECHA; });
  if (!todos.length) return {};
  var inicio = todos.reduce(function (m, c) { return c.FECHA < m ? c.FECHA : m; }, todos[0].FECHA);
  var porDni = {};
  todos.forEach(function (c) { if (c.DNI_PACIENTE) (porDni[c.DNI_PACIENTE] = porDni[c.DNI_PACIENTE] || []).push(c); });
  var primeras = primerasConsultas_(citas), out = {};
  Object.keys(primeras).forEach(function (dni) {
    var f = primeras[dni].FECHA;
    if (f < inicio) return;
    var elegido = null;
    (porDni[dni] || []).forEach(function (c) {
      if (c.FECHA > f) return;
      if (!elegido || c.FECHA > elegido.FECHA || (c.FECHA === elegido.FECHA && c.ID_LEAD > elegido.ID_LEAD)) elegido = c;
    });
    out[dni] = elegido
      ? { CANAL: elegido.CANAL, CAMPANA: elegido.CAMPANA, ID_LEAD: elegido.ID_LEAD }
      : { CANAL: 'Sin lead en el CRM', CAMPANA: 'Sin lead en el CRM', ID_LEAD: '' };
  });
  return out;
}

/** ¿Volvió a su 1.ª reevaluación? Por canal y campaña, contando solo a quienes ya debían volver. */
function kpiCampanas(citas, contactos, reglas, hoy) {
  var atrib = atribuirCampanas(citas, contactos), primeras = primerasConsultas_(citas), series = armarSeries(citas), acc = {};
  Object.keys(atrib).forEach(function (dni) {
    var p = primeras[dni], a = atrib[dni];
    var s = series[claveSerie(dni, p.ESPECIALIDAD)];
    var r = s.realizadas, volvio = r.length >= 2;
    var maduro = volvio || sumarDias(r[0].FECHA, plazoDe(reglas, s.especialidad).vence) <= hoy;
    var medico = p.MEDICO || 'SIN MÉDICO';
    var k = [mesDe(p.FECHA), medico, a.CANAL, a.CAMPANA].join('|');
    if (!acc[k]) acc[k] = { MES: mesDe(p.FECHA), MEDICO: medico, CANAL: a.CANAL, CAMPANA: a.CAMPANA, NUEVOS: 0, EN_CURSO: 0, VOLVIERON: 0 };
    acc[k].NUEVOS++;
    if (!maduro) acc[k].EN_CURSO++;
    else if (volvio) acc[k].VOLVIERON++;
  });
  return Object.keys(acc).map(function (k) { return acc[k]; })
    .sort(compararCampos_(['MES', 'CANAL', 'CAMPANA', 'MEDICO']));
}

function calcularKpi(citas, indicaciones, seguimientos, reglas, hoy, contactos) {
  return {
    cohortes: kpiCohortes(citas, reglas, hoy),
    indicaciones: kpiIndicaciones(indicaciones, citas),
    recuperacion: kpiRecuperacion(seguimientos, citas, hoy),
    motivos: kpiMotivos(seguimientos),
    campanas: kpiCampanas(citas, contactos, reglas, hoy),
    sinCandidato: (indicaciones || []).filter(function (i) { return normTexto(i.EMPAREJAMIENTO) === 'SIN CANDIDATO'; })
      .map(function (i) { return { ID: i.ID, FECHA: i.FECHA, TIPO: i.TIPO, NOMBRE: i.NOMBRE, TELEFONO: i.TELEFONO }; })
  };
}
```

- [ ] **Step 6: Correr todas las pruebas**

Run: `npm test`
Expected: PASS, todas.

- [ ] **Step 7: Commit**

```bash
git add src/Logica.gs test/logica-crm.test.js
git commit -m "Lógica: teléfonos del CRM, atribución de campaña e indicador por canal y campaña"
```

---

### Task 3: Leer el CRM al actualizar y programar la actualización diaria

**Files:**
- Modify: `src/Codigo.gs` (`CONFIG`, `datos_`, `getKpi`; función nueva `leerContactos_`)
- Modify: `src/Menu.gs` (`onOpen`, `hojasBase_`, `actualizar_`; funciones nuevas)
- Modify: `src/appsscript.json`
- Test: `test/menu.test.js`, `test/sintaxis.test.js`

**Interfaces:**
- Consumes: `contactosDesdeCrm`, `emparejarContactos`, `COLUMNAS_CONTACTOS`, `calcularKpi(…, contactos)`, `armarPacientes(…, contactos)` (Tareas 1 y 2); `escribirObjetos_`, `bitacora_`, `fechaHoraTexto_`, `ss_`, `leerObjetos_` (ya existen).
- Produces:
  - `CONFIG.CRM_ID`, `CONFIG.HOJA_CRM`
  - `leerContactos_() → Contacto[]`
  - `traerCrm_(citas) → { ok, mensaje }`
  - `actualizar_(quien) → { ok, mensaje }`
  - `actualizacionDiaria()`
  - `programarDiaria_() → number` (activadores reemplazados)
  - `activarDiaria()`

- [ ] **Step 1: Ajustar la prueba de `hojasBase_` en `test/sintaxis.test.js`**

Reemplazar la línea:

```js
  assert.deepEqual(Object.keys(base), ['CITAS', 'PACIENTES', 'INDICACIONES', 'SEGUIMIENTOS', 'BITACORA', 'KPI']);
```

por:

```js
  assert.deepEqual(Object.keys(base), ['CITAS', 'PACIENTES', 'INDICACIONES', 'SEGUIMIENTOS', 'BITACORA', 'CONTACTOS_CRM', 'KPI']);
  for (const f of ['actualizacionDiaria', 'activarDiaria']) assert.equal(typeof ctx[f], 'function', f);
```

- [ ] **Step 2: Añadir al final de `test/menu.test.js`**

```js
function libroCrm(filas) {
  return { openById: () => ({ getSheetByName: () => ({ getDataRange: () => ({ getValues: () => filas }) }) }) };
}

test('traerCrm_ escribe CONTACTOS_CRM con los leads útiles ya emparejados', () => {
  const { ctx } = contexto();
  const escritos = [];
  ctx.SpreadsheetApp = libroCrm([
    ['ID', 'FECHA', 'NOMBRES', 'APELLIDOS', 'DNI', 'TELEFONO', 'CANAL_ESPECIFICO', 'CAMPANA'],
    ['L-1', '2026-07-10 10:00', 'Rosa', 'Quispe', '40111222', '987654321', 'GOOGLE', ''],
    ['L-2', '2026-07-11 10:00', '', '', '', '912345678', 'GOOGLE', '']
  ]);
  ctx.ss_ = () => ({ getSheetByName: () => ({}) });
  ctx.escribirObjetos_ = (hoja, columnas, objetos) => escritos.push({ hoja, n: objetos.length, dni: objetos[0] && objetos[0].DNI_PACIENTE });
  const r = ctx.traerCrm_([{ DNI: '40111222', NOMBRE: 'ROSA QUISPE', ESTADO: 'REALIZADO', FECHA: '2026-07-20' }]);
  assert.equal(r.ok, true);
  assert.deepEqual(escritos, [{ hoja: 'CONTACTOS_CRM', n: 1, dni: '40111222' }]);
  assert.match(r.mensaje, /1 leads con nombre o DNI, 1 unidos a un paciente/);
});

test('traerCrm_ no reescribe CONTACTOS_CRM si al CRM le falta una columna', () => {
  const { ctx } = contexto();
  const escritos = [];
  ctx.SpreadsheetApp = libroCrm([['ID', 'FECHA', 'DNI'], ['L-1', '2026-07-10', '1']]);
  ctx.escribirObjetos_ = h => escritos.push(h);
  const r = ctx.traerCrm_([]);
  assert.equal(r.ok, false);
  assert.match(r.mensaje, /CRM no leído: faltan las columnas TELEFONO/);
  assert.deepEqual(escritos, []);
});

test('traerCrm_ no reescribe CONTACTOS_CRM si el CRM no se puede abrir', () => {
  const { ctx } = contexto();
  const escritos = [];
  ctx.SpreadsheetApp = { openById: () => { throw new Error('sin acceso'); } };
  ctx.escribirObjetos_ = h => escritos.push(h);
  const r = ctx.traerCrm_([]);
  assert.equal(r.ok, false);
  assert.match(r.mensaje, /CRM no leído: sin acceso/);
  assert.deepEqual(escritos, []);
});

test('programarDiaria_ deja un solo activador a las 7:00 de Lima', () => {
  const { ctx } = contexto();
  let activadores = [{ getHandlerFunction: () => 'otraCosa' }];
  const creados = [];
  ctx.ScriptApp = {
    getProjectTriggers: () => activadores.slice(),
    deleteTrigger: t => { activadores = activadores.filter(x => x !== t); },
    newTrigger: f => {
      const conf = { f };
      const b = { timeBased: () => b, everyDays: n => { conf.dias = n; return b; }, atHour: h => { conf.hora = h; return b; },
        inTimezone: z => { conf.zona = z; return b; }, create: () => { activadores.push({ getHandlerFunction: () => f }); creados.push(conf); } };
      return b;
    }
  };
  assert.equal(ctx.programarDiaria_(), 0);
  assert.equal(ctx.programarDiaria_(), 1);
  assert.equal(activadores.filter(t => t.getHandlerFunction() === 'actualizacionDiaria').length, 1);
  assert.equal(activadores.length, 2, 'no toca otros activadores');
  assert.deepEqual(creados[0], { f: 'actualizacionDiaria', dias: 1, hora: 7, zona: 'America/Lima' });
});

test('actualizacionDiaria no espera si otra persona está guardando y lo anota', () => {
  const { ctx } = contexto();
  const notas = [];
  let llamado = false;
  ctx.LockService = { getScriptLock: () => ({ tryLock: () => false, releaseLock: () => {} }) };
  ctx.bitacora_ = (u, a, d) => notas.push([u, a, d]);
  ctx.actualizar_ = () => { llamado = true; return { ok: true, mensaje: '' }; };
  ctx.actualizacionDiaria();
  assert.equal(llamado, false);
  assert.deepEqual(notas, [['AUTOMÁTICO', 'ACTUALIZAR', 'No se hizo: otra persona estaba guardando. Se intentará mañana.']]);
});

test('actualizacionDiaria usa el usuario AUTOMÁTICO y suelta el candado', () => {
  const { ctx, estado } = contexto();
  let quien = '';
  ctx.actualizar_ = q => { quien = q; return { ok: true, mensaje: 'Listo.' }; };
  ctx.actualizacionDiaria();
  assert.equal(quien, 'AUTOMÁTICO');
  assert.equal(estado.tomado, false);
});
```

- [ ] **Step 3: Correr las pruebas y ver que fallan**

Run: `node --test test/menu.test.js test/sintaxis.test.js`
Expected: FAIL. Salen `ctx.traerCrm_ is not a function` y `ctx.programarDiaria_ is not a function`, y las claves de `hojasBase_` no coinciden.

- [ ] **Step 4: `src/Codigo.gs`. Añadir a `CONFIG`**

Reemplazar:

```js
  HOJA_SOFDOC: 'Hoja 1',
```

por:

```js
  HOJA_SOFDOC: 'Hoja 1',
  CRM_ID: '1dofPqkj644Y0kfYYpX2WG9g8JlHYFai8nk--CzFtbsM',
  HOJA_CRM: 'LEADS',
```

- [ ] **Step 5: `src/Codigo.gs`. Leer los contactos y pasarlos a pacientes y KPI**

Añadir después de `leerSeguimientos_`:

```js
/** CONTACTOS_CRM puede no existir todavía (antes de la primera actualización con CRM). */
function leerContactos_() {
  if (!ss_().getSheetByName('CONTACTOS_CRM')) return [];
  var cs = leerObjetos_('CONTACTOS_CRM');
  cs.forEach(function (c) { c.DNI = normDni(c.DNI); c.DNI_PACIENTE = normDni(c.DNI_PACIENTE); });
  return cs;
}
```

En `datos_()`, reemplazar:

```js
    seguimientos: leerSeguimientos_()
  };
  d.pacientes = armarPacientes(d.citas, d.indicaciones, d.seguimientos, d.reglas, d.hoy);
```

por:

```js
    seguimientos: leerSeguimientos_(),
    contactos: leerContactos_()
  };
  d.pacientes = armarPacientes(d.citas, d.indicaciones, d.seguimientos, d.reglas, d.hoy, d.contactos);
```

En `getKpi()`, reemplazar:

```js
  return limpiarParaEnvio(calcularKpi(d.citas, d.indicaciones, d.seguimientos, d.reglas, d.hoy));
```

por:

```js
  return limpiarParaEnvio(calcularKpi(d.citas, d.indicaciones, d.seguimientos, d.reglas, d.hoy, d.contactos));
```

- [ ] **Step 6: `src/Menu.gs`. Menú, hojas base y CRM**

En `onOpen`, reemplazar:

```js
    .addItem('Verificar', 'verificar')
```

por:

```js
    .addItem('Verificar', 'verificar')
    .addItem('Activar actualización diaria (7:00)', 'activarDiaria')
```

En `hojasBase_`, reemplazar:

```js
    BITACORA: COLUMNAS_BITACORA,
```

por:

```js
    BITACORA: COLUMNAS_BITACORA,
    CONTACTOS_CRM: COLUMNAS_CONTACTOS,
```

Reemplazar la cabecera y el cuerpo de `actualizar_`:

```js
function actualizar_() {
```

por:

```js
function actualizar_(quien) {
  quien = quien || 'MENÚ';
```

y, dentro de `actualizar_`, reemplazar:

```js
  var emparejadas = emparejarIndicacionesEnHoja_(fusion.citas);

  MEMO.datos = null;
  var d = datos_();
  escribirObjetos_('PACIENTES', COLUMNAS_PACIENTES, d.pacientes);
  escribirKpi_(filasHojaKpi(calcularKpi(d.citas, d.indicaciones, d.seguimientos, d.reglas, d.hoy)));

  var detalle = filas.length + ' filas leídas, ' + fusion.nuevas + ' citas nuevas, ' + fusion.cambiadas + ' cambiadas, ' +
    limpio.invalidas + ' inválidas, ' + emparejadas + ' emparejamientos nuevos';
  bitacora_('MENÚ', 'ACTUALIZAR', detalle);
```

por:

```js
  var emparejadas = emparejarIndicacionesEnHoja_(fusion.citas);
  var crm = traerCrm_(fusion.citas);

  MEMO.datos = null;
  var d = datos_();
  escribirObjetos_('PACIENTES', COLUMNAS_PACIENTES, d.pacientes);
  escribirKpi_(filasHojaKpi(calcularKpi(d.citas, d.indicaciones, d.seguimientos, d.reglas, d.hoy, d.contactos)));

  var detalle = filas.length + ' filas leídas, ' + fusion.nuevas + ' citas nuevas, ' + fusion.cambiadas + ' cambiadas, ' +
    limpio.invalidas + ' inválidas, ' + emparejadas + ' emparejamientos nuevos. ' + crm.mensaje;
  bitacora_(quien, 'ACTUALIZAR', detalle);
```

Añadir después de `actualizar_`:

```js
/**
 * Lee la hoja LEADS del CRM (solo lectura) y reescribe CONTACTOS_CRM.
 * Si el CRM no se puede leer, la CONTACTOS_CRM anterior se conserva.
 */
function traerCrm_(citas) {
  var valores;
  try {
    var hoja = SpreadsheetApp.openById(CONFIG.CRM_ID).getSheetByName(CONFIG.HOJA_CRM);
    if (!hoja) throw new Error('no existe la hoja ' + CONFIG.HOJA_CRM);
    valores = hoja.getDataRange().getValues().map(function (f) {
      return f.map(function (x) { return x instanceof Date ? fechaHoraTexto_(x) : x; });
    });
  } catch (e) {
    return { ok: false, mensaje: 'CRM no leído: ' + e.message + '. Se conservan los datos anteriores.' };
  }
  var r = contactosDesdeCrm(valores[0] || [], valores.slice(1));
  if (r.faltantes.length) {
    return { ok: false, mensaje: 'CRM no leído: faltan las columnas ' + r.faltantes.join(', ') + ' en ' + CONFIG.HOJA_CRM + '. Se conservan los datos anteriores.' };
  }
  var unidos = emparejarContactos(r.contactos, citas);
  if (!ss_().getSheetByName('CONTACTOS_CRM')) ss_().insertSheet('CONTACTOS_CRM');
  escribirObjetos_('CONTACTOS_CRM', COLUMNAS_CONTACTOS, r.contactos);
  return { ok: true, mensaje: 'CRM: ' + r.contactos.length + ' leads con nombre o DNI, ' + unidos + ' unidos a un paciente.' };
}

/** La llama el activador diario. Sin ventanas: todo queda en BITACORA. */
function actualizacionDiaria() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(CONFIG.ESPERA_LOCK_MS)) {
    bitacora_('AUTOMÁTICO', 'ACTUALIZAR', 'No se hizo: otra persona estaba guardando. Se intentará mañana.');
    return;
  }
  try {
    var r = actualizar_('AUTOMÁTICO');
    if (!r.ok) bitacora_('AUTOMÁTICO', 'ACTUALIZAR', r.mensaje);
  } finally {
    lock.releaseLock();
  }
}

/** Deja un único activador diario a las 7:00 (Lima). Devuelve cuántos anteriores reemplazó. */
function programarDiaria_() {
  var reemplazados = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'actualizacionDiaria') { ScriptApp.deleteTrigger(t); reemplazados++; }
  });
  ScriptApp.newTrigger('actualizacionDiaria').timeBased().everyDays(1).atHour(7).inTimezone('America/Lima').create();
  return reemplazados;
}

function activarDiaria() {
  var n = programarDiaria_();
  SpreadsheetApp.getUi().alert('Listo: la plataforma se actualizará sola cada día a las 7:00, leyendo SOFDOC y el CRM.' +
    (n ? ' Se reemplazó el activador anterior.' : ''));
}
```

- [ ] **Step 7: `src/appsscript.json`. Permiso para crear activadores**

Reemplazar:

```json
    "https://www.googleapis.com/auth/script.container.ui"
```

por:

```json
    "https://www.googleapis.com/auth/script.container.ui",
    "https://www.googleapis.com/auth/script.scriptapp"
```

- [ ] **Step 8: Correr todas las pruebas**

Run: `npm test`
Expected: PASS, todas.

- [ ] **Step 9: Commit**

```bash
git add src/Codigo.gs src/Menu.gs src/appsscript.json test/menu.test.js test/sintaxis.test.js
git commit -m "Leer el CRM al actualizar y programar la actualización diaria de las 7:00"
```

---

### Task 4: Sección «¿Qué campañas traen pacientes que vuelven?» en Detalle

**Files:**
- Modify: `src/Index.html` (`pintarTablero` y `DEMO.getKpi`)
- Test: `test/ui.test.js`

**Interfaces:**
- Consumes: `getKpi().campanas = [{ MES, MEDICO, CANAL, CAMPANA, NUEVOS, EN_CURSO, VOLVIERON }]` (Tarea 2); `agrupar`, `tabla`, `pct`, `barra`, `esc` (ya están en `Index.html`).
- Produces: la sección en el Detalle.

- [ ] **Step 1: Añadir la prueba al final de `test/ui.test.js`**

```js
test('detalle: campañas y canales que traen pacientes que vuelven, con filtro de médico', async () => {
  const { navegador, pagina, errores } = await abrir();
  try {
    await pagina.locator('.nav button[data-vista="tablero"]').click();
    await pagina.waitForSelector('#tablero table');
    const seccion = pagina.locator('.seccion', { hasText: '¿Qué campañas traen pacientes que vuelven?' });
    let t = await seccion.textContent();
    assert.match(t, /FACEBOOK ADS\s*35\s*37%/);
    assert.match(t, /Sin lead en el CRM/);
    assert.match(t, /Por campaña/);
    await pagina.selectOption('#t-med', 'Dr. ELÍ FABRIZIO CABANILLAS HUALPA');
    t = await pagina.locator('.seccion', { hasText: '¿Qué campañas traen pacientes que vuelven?' }).textContent();
    assert.match(t, /FACEBOOK ADS\s*20\s*45%/);
    assert.deepEqual(errores, []);
  } finally { await navegador.close(); }
});
```

- [ ] **Step 2: Correr la prueba y ver que falla**

Run: `npm run test:ui`
Expected: FAIL en la prueba nueva, porque la sección no existe.

- [ ] **Step 3: Añadir `campanas` al `getKpi` del DEMO en `src/Index.html`**

En el objeto que devuelve `getKpi: () => ({`, justo antes de la línea `motivos: [{ MOTIVO: 'SE ATIENDE EN OTRO LUGAR', N: 4 }, { MOTIVO: 'NÚMERO EQUIVOCADO', N: 2 }],`, añadir:

```js
      campanas: [
        { MES: '2026-08', MEDICO: ELI, CANAL: 'FACEBOOK ADS', CAMPANA: 'LAB-001', NUEVOS: 20, EN_CURSO: 0, VOLVIERON: 9 },
        { MES: '2026-08', MEDICO: KAREN, CANAL: 'FACEBOOK ADS', CAMPANA: 'Sin campaña', NUEVOS: 15, EN_CURSO: 0, VOLVIERON: 4 },
        { MES: '2026-08', MEDICO: ELI, CANAL: 'WSSP DIRECTO', CAMPANA: 'Sin campaña', NUEVOS: 10, EN_CURSO: 0, VOLVIERON: 6 },
        { MES: '2026-09', MEDICO: ELI, CANAL: 'GOOGLE', CAMPANA: 'Sin campaña', NUEVOS: 8, EN_CURSO: 5, VOLVIERON: 1 },
        { MES: '2026-08', MEDICO: KAREN, CANAL: 'Sin lead en el CRM', CAMPANA: 'Sin lead en el CRM', NUEVOS: 6, EN_CURSO: 0, VOLVIERON: 2 }
      ],
```

- [ ] **Step 4: En `pintarTablero`, incluir los meses y médicos de campañas**

Reemplazar:

```js
  const meses = unicos(k.cohortes.map(r => r.COHORTE).concat(k.indicaciones.map(r => r.MES), k.recuperacion.map(r => r.MES)));
```

por:

```js
  const cam = k.campanas || [];
  const meses = unicos(k.cohortes.map(r => r.COHORTE).concat(k.indicaciones.map(r => r.MES), k.recuperacion.map(r => r.MES), cam.map(r => r.MES)));
```

y reemplazar:

```js
  const meds = unicos(k.cohortes.map(r => r.MEDICO).concat(k.indicaciones.map(r => r.MEDICO), k.recuperacion.map(r => r.MEDICO)));
```

por:

```js
  const meds = unicos(k.cohortes.map(r => r.MEDICO).concat(k.indicaciones.map(r => r.MEDICO), k.recuperacion.map(r => r.MEDICO), cam.map(r => r.MEDICO)));
```

- [ ] **Step 5: En `pintarTablero`, calcular las filas de campañas**

Justo antes de la línea `$('#tablero').innerHTML = \``, añadir:

```js
  const camF = cam.filter(r => okMes(r.MES) && okMed(r.MEDICO));
  const sumaCam = (o, r) => { o.n += Number(r.NUEVOS); o.c += Number(r.EN_CURSO); o.v += Number(r.VOLVIERON); };
  const filasCam = claveDe => agrupar(camF, claveDe, () => ({ n: 0, c: 0, v: 0 }), sumaCam)
    .sort((a, b) => b[1].n - a[1].n)
    .map(([c, o]) => [esc(c), o.n, `${pct(o.v, o.n - o.c)} <span class="muted">(${o.v}/${o.n - o.c})</span>${barra(o.v, o.n - o.c)}`, o.c]);
```

- [ ] **Step 6: En la plantilla de `pintarTablero`, insertar la sección después de «¿Vuelven los pacientes nuevos?»**

Reemplazar:

```js
      ${tabla([T('Pacientes nuevos de'), N('Volvieron a su 1.ª reevaluación'), N('A su 2.ª reevaluación'), N('A su 3.ª reevaluación')], filasCoh)}</div>
```

por:

```js
      ${tabla([T('Pacientes nuevos de'), N('Volvieron a su 1.ª reevaluación'), N('A su 2.ª reevaluación'), N('A su 3.ª reevaluación')], filasCoh)}</div>
    <div class="seccion"><h2>¿Qué campañas traen pacientes que vuelven?</h2>
      <p class="muted">Pacientes nuevos desde que existe el CRM, según el último anuncio o canal por el que escribieron antes de su primera consulta. El filtro de especialidad no cambia esta sección.</p>
      ${tabla([T('Canal'), N('Pacientes nuevos'), N('Volvieron a su 1.ª reevaluación'), N('En curso')], filasCam(r => r.CANAL))}
      <h3>Por campaña</h3>
      ${tabla([T('Campaña'), N('Pacientes nuevos'), N('Volvieron a su 1.ª reevaluación'), N('En curso')], filasCam(r => r.CAMPANA))}</div>
```

- [ ] **Step 7: Correr todas las pruebas**

Run: `npm test && npm run test:ui`
Expected: PASS, todas (15 de interfaz).

- [ ] **Step 8: Commit**

```bash
git add src/Index.html test/ui.test.js
git commit -m "Detalle: qué canales y campañas traen pacientes que vuelven"
```

---

### Task 5: Publicar y activar (con el usuario, desde su computadora)

Un agente en la nube no puede hacer esta tarea: necesita la sesión de clasp de la cuenta dueña.

- [ ] **Step 1 (usuario):** En PowerShell, dentro de `C:\Users\HP\SEGUIMIENTOS`:

```
git pull
npm run actualizar
```

Expected: `Pushed 5 files` y `Deployed AKfycbzSvnytt… @N`.

- [ ] **Step 2 (usuario, en el Sheets):** recargar la pestaña y usar **Seguimientos → Actualizar**. Google pedirá autorizar el permiso nuevo; aceptar.
  - Expected: el mensaje termina con «CRM: … leads con nombre o DNI, … unidos a un paciente.» y aparece la pestaña `CONTACTOS_CRM`.

- [ ] **Step 3 (usuario):** **Seguimientos → Activar actualización diaria (7:00)**.
  - Expected: «Listo: la plataforma se actualizará sola cada día a las 7:00…».

- [ ] **Step 4 (usuario):** abrir la app, ir a **Detalle** y ver la sección de campañas. Al día siguiente, comprobar en `BITACORA` una línea `AUTOMÁTICO · ACTUALIZAR` cerca de las 7:00.
