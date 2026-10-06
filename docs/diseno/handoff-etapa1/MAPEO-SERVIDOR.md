# Mapeo de la referencia de diseño al servidor real

- Fecha: 06/10/2026
- Fuente de diseño: `docs/diseno/handoff-etapa1/referencia/Index.html` (en adelante **ref**), maquetas en `maquetas/`, `brief-original.md`.
- Fuente de verdad del servidor: `src/*.gs` y el consumo actual en `src/Index.html` (en adelante **app**).
- Especificación aprobada: `docs/superpowers/specs/2026-10-06-que-paso-y-tablero-design.md` (en adelante **spec**).
- Decisiones ya tomadas por la usuaria:
  1. tras «No contestó» la tarjeta **se queda en Agendado** como «Reintentar el dd/mm · intento k de N»;
  2. el rediseño sale **entero de una vez** (las 4 pantallas conectadas al servidor real);
  3. Indicadores lleva **las 7 pestañas** y el **resumen imprimible de 2 páginas**, con datos reales.

> **Advertencias sobre esta foto.**
> - El árbol de trabajo tiene cambios sin commit en `src/Codigo.gs`, `src/ResultadoServidor.gs`, `src/Resultados.gs`,
>   `src/Tablero.gs` y `src/Index.html` (otra sesión trabajando a la vez). Los números de línea citados son los de ese
>   árbol el 06/10/2026; pueden moverse unas líneas. Las citas van siempre con el nombre de la función.
> - **El `README.md` del paquete no se pudo leer en esta sesión** (permiso denegado), salvo su primer párrafo. Este
>   mapeo se hizo sobre **lo que el código de la referencia lee de verdad**, que es lo que manda. Antes de cerrar el
>   plan conviene cotejar las §4 y §5 del README contra las tablas de abajo: si el README describe un campo que la
>   referencia no lee, falta aquí.

Veredictos usados en todo el documento:

| Veredicto | Significa |
|---|---|
| **ya existe tal cual** | La función real ya devuelve lo que hace falta; solo cambia el nombre de la llamada |
| **adaptador en el cliente** | El dato existe en el servidor con otra forma; se traduce en `Index.html` |
| **falta en el servidor** | No existe; se propone el agregado mínimo (con prueba en Node antes del código) |

---

## 0. Reglas generales del adaptador

Valen para todas las pantallas. La referencia las incumple en varios sitios a la vez; conviene resolverlas en una sola
capa (`adaptar*()`) y no pantalla por pantalla.

| Tema | Referencia | Servidor real | Qué hacer |
|---|---|---|---|
| Puente | `api(fn, ...args)` (ref 375-383) | `llamar(fn, ...args)` (app 446-454) envuelve el error en `Error` y el DEMO pasa por `JSON.parse(JSON.stringify())` | Quedarse con `llamar` de la app: el DEMO devuelve copias y el error trae `message` |
| Identificador de tarjeta | `id` **numérico**; se lee con `Number(c.dataset.card)` (ref 743, 745, 783) | `CLAVE` = `ID_REGISTRO` o `DNI|ESPECIALIDAD` (`claveTarjeta`, Tablero.gs:15) | `id = CLAVE` como **texto**; quitar los tres `Number()`. Con `Number()` toda clave da `NaN` y no se abre ningún panel |
| Usuario | valores `'Magaly'`, `'Ana'`, `'Rachel'`, `'cab'`; objeto `{v, l, rol, med}` (ref 1101) | `bootstrap().usuarios` = textos de `CATALOGOS.USUARIOS`, en mayúsculas (`'MAGALY'`, `'DR. ELI CABANILLAS'`; app DEMO 1707) | `{ v: texto, l: texto en formato nombre, rol: /^DRA?\b/ → 'Médico', med: medicoDeUsuario(u, boot.medicos) }` (app 489). `usuario` que se envía = `v` tal cual |
| Médico | `{k, full, short}` con claves cortas inventadas (ref 1096-1100) | `bootstrap().medicos` = nombres de SOFDOC (`'Dr. ELÍ FABRIZIO CABANILLAS HUALPA'`) | `k = full = nombre SOFDOC`, `short = medicoCorto(nombre)` (app 497). La tarjeta trae `MEDICO_ULTIMO` con ese mismo texto |
| Doctor que firma (Registro, alta) | se elige de `S.medicos` | `bootstrap().doctores = [{doctor, sofdoc}]` (Codigo.gs:284); el servidor valida contra `doctor` | Todo `<select>` de doctor usa `doctores[].doctor`, con el propuesto por `opcionesDoctor(MEDICO_ULTIMO)` (app 988) |
| Fechas | ISO `yyyy-mm-dd` | ISO `yyyy-mm-dd`; fecha y hora `yyyy-mm-dd HH:mm` | Sin cambio. `hoy` sale de `bootstrap().hoy` (zona del libro), no de `new Date()` del navegador |
| Nombres | `'Rosa Quispe Huamán'` | `NOMBRE` en mayúsculas (`'ROSA ELENA QUISPE HUAMÁN'`) | Pasar a formato nombre en el adaptador, solo para mostrar |
| Teléfonos | `tel: ['987 654 321']`, `malos: []` | `TELEFONOS: '987654321 / 912345678'` (9 dígitos normalizados) y `TELEFONOS_DESCARTADOS: []` | `tel = TELEFONOS.split(' / ').filter(Boolean)`, `malos = TELEFONOS_DESCARTADOS`. Mostrar con espacios, **enviar sin espacios** |
| Modo oscuro | `[data-tema="oscura"]`, clave `chp-tema` | `html[data-modo="oscuro"]`, clave `seg.modo`; la prueba `test/ui.test.js:311-315` solo acepta colores dentro de `:root{}` y `html[data-modo="oscuro"]{}` | Renombrar el selector y la clave, o la prueba de colores falla |
| Preferencias | `chp-usuario`, `chp-tema` | `seg.usuario`, `seg.modo`, `seg.tipo` (app 526-527) | Mantener las claves `seg.*`: las asesoras no pierden su usuario recordado |

---

## 1. Cada sitio «ADAPTAR» y cada forma de datos que lee la referencia

Hay 9 marcas `ADAPTAR` en la referencia (líneas 717, 914, 940, 957, 991, 1023, 1078, 1082) más llamadas sin marca que
también suponen formas (854, 924, 974, 993). Van en el orden en que corre la app.

### 1.1 Arranque — ref 1082 `api('getKpi', { usuario })` → «se espera `{ medicos, usuarios, hechosHoy }`»

**Llamar a `bootstrap()`, no a `getKpi`.** `getKpi` (Codigo.gs:397-402) calcula cohortes, indicaciones, recuperación,
campañas y motivos (`calcularKpi`, Logica.gs:936): es la llamada más cara de la app y no devuelve ninguno de los tres
campos que la referencia lee.

`bootstrap()` (Codigo.gs:267-289), sin argumentos, devuelve:

```
{ hoy, usuarios: [texto], motivos: [texto] (obsoleto), resultados: ORDEN_RESULTADOS,
  especialidades: [texto], medicos: [nombre SOFDOC], doctores: [{doctor, sofdoc}],
  procedimientos: [texto], tratamientos: [texto], marcas: { 'HIERRO CARBOXIMALTOSA': ['FERINJECT', …] } }
```

| Ref lee | Real | Veredicto |
|---|---|---|
| `cfg.medicos` `[{k, full, short}]` | `boot.medicos` (textos) → regla §0 | adaptador en el cliente |
| `cfg.usuarios` `[{v, l, rol, med}]` | `boot.usuarios` (textos) → regla §0 | adaptador en el cliente |
| `cfg.hechosHoy` (por usuario) | `getTablero().cifras.hechosHoy` (Tablero.gs:146-149): cuenta resultados del grupo «Sigue» de **todo el equipo**, no de quien está usando la app | **falta en el servidor** (ver S2) |
| `S.META = 15` fijo (ref 390) | no existe en `REGLAS` | **falta en el servidor** (ver S1) |
| `S.hoy = hoyISO()` del navegador (ref 387) | `boot.hoy` | adaptador en el cliente |
| especialidades fijas en el HTML (ref 508: Hematología, Reumatología, Medicina interna) | `boot.especialidades` | adaptador en el cliente |
| procedimientos `PROCS` fijos (ref 814) | `boot.procedimientos` | adaptador en el cliente |
| tratamientos y `MARCAS` fijos (ref 815, 835) | `boot.tratamientos`, `boot.marcas[normTexto(tratamiento)]` | adaptador en el cliente |
| parámetros: 2 intentos y 15 días fijos en el texto (ref 704) | `reglas.maxSeguimientos`, `reglas.espera` existen (Logica.gs:195-210) pero `bootstrap` no los envía | **falta en el servidor** (S1) |

**S1 (mínimo):** `bootstrap` agrega
`reglas: { espera, maxSeguimientos, graciaAgenda, diasEntreSesiones, esperaCotizacion, metaRetorno, metaDiaria }`.
`metaDiaria` es un parámetro nuevo `META_DIARIA_SEGUIMIENTOS` en `REGLAS`, leído en `reglasDesdeFilas`
(Logica.gs:193) con 15 por omisión. Así la meta del día es una celda, como pide `CLAUDE.md`.

**S2 (mínimo):** `armarTablero` agrega `cifras.hechosHoyPor = { RESPONSABLE: n }` con la misma regla de la línea 146
(grupo «Sigue», fecha de hoy). La app muestra `hechosHoyPor[usuario]`. Ojo: «Lo hizo» en un registro y el alta de una
reevaluación no escriben en `SEGUIMIENTOS` (se delegan, ResultadoServidor.gs:29 y 32) y por eso **no suman** al
contador. Decidir si deben sumar; si sí, contarlos desde `SESIONES.ASESORA` y `ALTAS.REGISTRADO_POR` del día.

### 1.2 Tablero — ref 527 `api('getBandeja', { usuario })` + ref 1078 `adaptarBandeja(r)`

**Llamar a `getTablero()`** (ResultadoServidor.gs:86-88 → `armarTablero`, Tablero.gs:95-163). Sin argumentos; no
depende del usuario, así que **cambiar de usuario no necesita recargar** (la ref recarga, 1086).

Devuelve:

```
{ columnas: { POR_CONTACTAR: [tarjeta], AGENDADO: [...], EN_TRATAMIENTO: [...], COMPLETADO: [...] },
  cerrados: [{ CLAVE, DNI, NOMBRE, TIPO_SEGUIMIENTO, CIERRE, FECHA_CIERRE }],
  cifras: { porContactar, agendados, enTratamiento, completadosMes, cerradosMes, hechosHoy } }
```

Cada tarjeta es una fila de `armarPacientes` (Logica.gs:595-617, reevaluación), `pendientesIndicacion`
(Logica.gs:669-690, hierro y procedimiento antiguos) o `pendientesRegistro` (Registro.gs:195-222, registros), más
`CLAVE`, `COLUMNA`, `ETIQUETA`, `FECHA_CLAVE` (`tarjeta_`, Tablero.gs:86-93) y `TELEFONOS_DESCARTADOS`, `SIN_CONTACTO`
(Tablero.gs:150-157).

`adaptarBandeja` pasa a ser `adaptarTablero(r)`: aplana las cuatro columnas en `S.pacientes` con este mapeo.

| Campo de la ref | De dónde sale | Veredicto |
|---|---|---|
| `id` | `CLAVE` (texto) | adaptador |
| `col` (1-4) | `COLUMNA`: `POR_CONTACTAR`→1, `AGENDADO`→2, `EN_TRATAMIENTO`→3, `COMPLETADO`→4 | adaptador |
| `n` | `NOMBRE`, en formato nombre. **Vacío** en tarjetas de Completado armadas desde un alta sin serie (Tablero.gs:122) | adaptador (+ S3) |
| `dni` | `DNI` | ya existe |
| `t` | `TIPO_SEGUIMIENTO`: `REEVALUACION`→`reev`, `HIERRO`→`hier`, `PROCEDIMIENTO`→`proc` | adaptador |
| `esp` | reevaluación: `ESPECIALIDAD`; hierro y procedimiento: `ESPECIALIDAD_CONSULTA` (como `especialidadDe`, app 606). **No usar `ESPECIALIDAD`** en hierro: vale `HIERRO` | adaptador |
| `med` | `MEDICO_ULTIMO` | ya existe |
| `tel`, `malos` | `TELEFONOS`, `TELEFONOS_DESCARTADOS` (regla §0) | adaptador |
| `usuario` (`@…`) | `USUARIO`, que **solo** traen las filas de `pendientesRegistro` (Registro.gs:202) | ya existe |
| filtro «Solo sin teléfono» (ref 489) | `SIN_CONTACTO` (Tablero.gs:155): sin teléfonos y sin usuario | ya existe |
| `intentos` | `N_SEGUIMIENTOS` (resultados «Sigue» del ciclo). La ref escribe siempre «1 intento sin respuesta» (ref 587): usar el número real y plural | adaptador |
| `perfil` | reevaluación: `N_REALIZADAS <= 1` → «Paciente nuevo», si no «En control» (`esNuevo`, app 607). Hierro y procedimiento no traen `N_REALIZADAS` | adaptador; para hierro/proc dejar vacío o S6 |
| `dias` | reevaluación: días desde `PROXIMA_ESPERADA` (`diasSinVolver`, app 605; **no** `DIAS_ATRASO`, que cuenta desde `VENCE`); hierro y procedimiento: `DIAS` | adaptador |
| `ultima`, `debia` | `ULTIMA_CITA`, `PROXIMA_ESPERADA` | ya existe |
| `cotizo` | `FECHA_COTIZACION` | ya existe |
| `proc` | `DETALLE` (en antiguas puede juntar varios con « · », Logica.gs:678) | ya existe |
| `trat.nombre`, `trat.marca` | registro: `DETALLE` ya viene armado («Hierro carboximaltosa · Ferinject × 3 sesiones», `textoRegistro`, Registro.gs:52); antigua: «Hierro (Ferinject) ×2». **No vienen separados** | **falta en el servidor** (S6) o se parte el texto en el cliente |
| `trat.n`, `trat.k` | `SESIONES`, `HECHAS` (solo registros). Las antiguas no los traen | adaptador; si faltan, la tarjeta no dibuja la barra de sesiones |
| `trat.ultima` | `ULTIMA_SESION` | ya existe |
| `trat.prox` | `FECHA_CLAVE` en En tratamiento (= última sesión + `DIAS_ENTRE_SESIONES`, Tablero.gs:107) | ya existe |
| `trat.atr` | `ATRASO` (Registro.gs:216). **Una sesión atrasada está en Por contactar, no en En tratamiento** (ver §3, conflicto D) | adaptador |
| `cita.tipo`, `cita.f` | `AGENDA` (`CITA`/`LLAMAR`/`REINTENTAR`/`SIN RESPUESTA`) y `FECHA_AGENDA` (= `FECHA_CLAVE`). La ref solo conoce `cita` y `llamar` | adaptador + tipo nuevo `reintentar` |
| `fin` (Completado) | `ETIQUETA`: «Volvió el dd/mm», «Completó el tratamiento», «Lo hizo el dd/mm», «Alta médica · Dr. …», «Alta médica» | ya existe |
| `hist` (historia del panel) | **no viene en la tarjeta** | adaptador: pedir `getPaciente(dni)` al abrir el panel (ver 1.9) |
| `oculto` | estado solo del cliente | — |
| texto de la línea de la tarjeta | La ref lo arma con sus propias reglas (ref 586-597). El servidor ya arma `ETIQUETA` para las cuatro columnas (`etiquetaDe`, Tablero.gs:60-77) **para que la app y las pruebas digan lo mismo** (spec §5.2) | usar `ETIQUETA` |

| Cifra de la ref (ref 540-547) | Real | Veredicto |
|---|---|---|
| Por contactar | `cifras.porContactar` (o contar tras filtros, como la ref) | ya existe |
| «N sin ningún intento» | contar `N_SEGUIMIENTOS == 0` en columna 1 | adaptador |
| Agendados · «N citas esta semana» | contar `AGENDA == 'CITA'` con `FECHA_AGENDA <= hoy+6` | adaptador |
| En tratamiento · «N sesiones atrasadas» | las atrasadas están en Por contactar: contar `ATRASO > 0` en la **columna 1** | adaptador |
| Completados en el mes | `cifras.completadosMes` | ya existe |
| «N cerrados este mes» (spec §4.5, enlace bajo Completado) | `cifras.cerradosMes` y `cerrados[]`. **La ref no lo tiene** | falta en el cliente |

**S3 (mínimo):** en `armarTablero`, completar `NOMBRE` en los `cerrados` de fallecidos (Tablero.gs:130, hoy `''`) y en
las tarjetas de alta sin serie (Tablero.gs:122), con el último `NOMBRE` de `d.citas` para ese DNI.

### 1.3 «¿Qué pasó?» — ref 717 `api('marcarSeguimiento', { id, dni, esp, resultado: k, fecha, nota, usuario })`

**Error grave si se deja así:** `marcarSeguimiento` existe (Codigo.gs:363), pero es el envoltorio de la app vieja y
**fuerza `resultado: 'NO CONTESTÓ'`**: cualquier respuesta se guardaría como «No contestó».

Llamar a `registrarResultado(p)` (ResultadoServidor.gs:14 → `registrarResultado_`, 23-68), con el payload que ya usa la
app (`guardarResultado`, app 853-855):

```
{ usuario, dni: t.DNI, especialidad: t.ESPECIALIDAD, referencia: t.ID_REGISTRO || '',
  resultado: 'NO CONTESTÓ' | … (nombre de RESULTADOS), nota, fecha: 'yyyy-mm-dd' | '',
  telefono: '987654321' | '', motivo: '' | texto, doctor: '' | doctores[].doctor }
```

`especialidad` es la `ESPECIALIDAD` de la tarjeta (`HIERRO`/`PROCEDIMIENTO` en indicaciones), **no** `esp` de la ref.
`validarResultado` (Resultados.gs:136-187) busca la tarjeta por DNI + especialidad + referencia entre las abiertas.

Respuesta, según el resultado:

| Caso | Respuesta real | Cita |
|---|---|---|
| Resultado que escribe `SEGUIMIENTOS` | `{ ok, seguimiento: {ID: 'SEG-…', …}, tarjeta: tarjeta recalculada o '' si salió del tablero }` | ResultadoServidor.gs:67 |
| «Alta médica» en reevaluación | lo que devuelve `darDeAlta`: `{ ok, alta: {ID: 'ALT-…', …} }` — **sin `tarjeta`** | ResultadoServidor.gs:29, RegistroServidor.gs:111 |
| «Lo hizo» en un registro | lo que devuelve `marcarSesion`: `{ ok, sesion: {ID: 'SES-…', NUMERO, …}, completo }` — **sin `tarjeta`** | ResultadoServidor.gs:32, RegistroServidor.gs:64 |
| Error | excepción con mensaje en español («Ese paciente no está en la lista. Recargue la página.», etc.) | Resultados.gs:136-187 |

La ref además: no devuelve la tarjeta a su sitio si falla (ref 717 solo avisa) y su «Deshacer» no llama al servidor
(ref 718). Ver §2.3.

**S4 (mínimo):** en `registrarResultado_`, envolver los dos `return` delegados (ResultadoServidor.gs:29 y 32) para que
también lleven `tarjeta`: tras `darDeAlta`/`marcarSesion`, `MEMO.datos = null`, `armarTablero(datos_())` y buscar la
`CLAVE`. Sin esto la app no sabe si una sesión dejó la tarjeta en En tratamiento, en Completado o (si la fecha de la
sesión es vieja) otra vez en Por contactar como atrasada.

### 1.4 Registro, guardar — ref 913-921 `api('guardarRegistro', { dni, nombre, tel, fecha, med, items, usuario })`, «se espera `{ ids }`»

Real: `guardarRegistro(p)` (RegistroServidor.gs:21-47), validado por `validarRegistro` (Registro.gs:70-110).

| Ref envía | Real espera | Veredicto |
|---|---|---|
| `dni` (solo dígitos, ref 852) | `dni`: DNI de 8 dígitos **o carné de extranjería de 9 a 12 alfanuméricos** (`documentoValido`, Registro.gs:46) | adaptador; la ref borra las letras y **rompe el carné** |
| `nombre` | `nombre` | ya existe |
| `tel` | `contacto` (**obligatorio**: «Falta el teléfono o usuario.», Registro.gs:79). La ref no lo pide en `faltan()` (ref 893-902) | adaptador + validar en el cliente |
| `fecha` | `fecha`, no futura | ya existe |
| `med` (clave de médico) | `doctor` = `doctores[].doctor` | adaptador |
| `items: [{det, key, trat, ses, marca}]`, **varios procedimientos** (chips, ref 834) | **un** `procedimiento` + **un** `tratamiento` con `sesiones` y `marca` (Registro.gs:85-108) | **falta en el servidor** (S7) |
| — | `confirmado: true` para registrar pese a un duplicado | adaptador |
| espera `{ ids: [...] }` | `{ ok: true, registros: [{ID, TEXTO, NOMBRE, DNI, …}] }`, o `{ ok: false, duplicado: {ID, FECHA, TEXTO} }` (RegistroServidor.gs:28 y 43) | adaptador |
| duplicado detectado en el cliente solo contra lo de hoy (ref 911) | el servidor busca el mismo DNI + tipo + detalle **a 7 días o menos** (`duplicadoReciente`, Registro.gs:113) | usar la respuesta del servidor y reenviar con `confirmado` (como app 1074-1080) |

**S7 (mínimo):** `validarRegistro` acepta además `procedimientos: [texto]`; cada uno, validado con `enLista_`, da una
fila `PROCEDIMIENTO`. `procedimiento` (singular) sigue funcionando. Todas las filas se escriben en el mismo candado
(ya es así: RegistroServidor.gs:31-42). Alternativa sin tocar el servidor: una llamada por procedimiento, pero entonces
no es atómico y cada llamada revisa duplicados por separado.

### 1.5 Registro, anular — ref 940 `api('guardarRegistro', { anular: id, motivo, usuario })`

Real: `anularRegistro({ usuario, id, motivo })` (RegistroServidor.gs:70) para `REG-…` y `anularAlta({ usuario, id, motivo })`
(RegistroServidor.gs:117) para `ALT-…`, como hace la app (`clicRegistradosHoy`, app 1154; `FUNCION_ANULAR`, app 1135).
Ambas devuelven `{ ok: true }`. **adaptador en el cliente.** La ref marca anulado en local aunque falle (`.catch(() => {})`):
debe esperar la respuesta.

### 1.6 Registro, «Registrados hoy» — la ref nunca lo carga (`R.hoy = []`, ref 816)

Real: `getRegistrosHoy()` (RegistroServidor.gs:146-158) →
`[{ ID, HORA, ASESORA, NOMBRE, DNI, TEXTO, ANULADO }]`, registros y altas del día, de todo el equipo.

Mapeo a la fila de la ref (ref 932-934): `id←ID`, `hora←HORA`, `dni←DNI`, `n←NOMBRE`, `det←TEXTO`, `quien←ASESORA`,
`anulado←ANULADO`. El motivo de anulación **no** viene (la ref lo muestra, ref 933): o se omite o se agrega
`MOTIVO_ANULACION` en `getRegistrosHoy`. **adaptador en el cliente** (+ agregado opcional de una línea).

### 1.7 Registro, paciente conocido — ref 854 `api('getPaciente', dni)` esperando `{ n, ultima, med, tel, esps }`

Real: `buscarPacienteRegistro(dni)` (RegistroServidor.gs:161-177):

```
{ encontrado: false, fallecido: {fecha, quien, id} | null }
{ encontrado: true, nombre, telefonos: [..], ultimaFecha, ultimoMedico, doctor, especialidades: [{especialidad, alta}], fallecido }
```

| Ref | Real | Veredicto |
|---|---|---|
| `p` nulo si no existe | `encontrado: false` (el registro **sí** se permite; el alta no) | adaptador |
| `n` | `nombre` | adaptador |
| `ultima` (ya en dd/mm/aaaa) | `ultimaFecha` (ISO) | adaptador |
| `med` (clave de médico) | `ultimoMedico` (SOFDOC) para el texto; `doctor` (el del catálogo) para el `<select>` | adaptador |
| `tel` | `telefonos[0]` | adaptador |
| `esps: [texto]` | `especialidades: [{especialidad, alta}]`; las que ya tienen alta van deshabilitadas (app 1060-1065) | adaptador |
| — | `fallecido`: aviso «Este paciente figura como fallecido el dd/mm (Magaly)» (spec §5.4; app 1048). **La ref no lo tiene** | falta en el cliente |

### 1.8 Registro, alta médica — ref 923-927 `api('darDeAlta', { dni, esp, med, fecha, nota, usuario })`

Real: `darDeAlta({ usuario, dni, especialidad, doctor, fecha, nota })` (RegistroServidor.gs:96-115) → `{ ok, alta: {ID, …} }`.
Valida: la serie tiene consultas, doctor del catálogo, fecha no futura y **no anterior a la última consulta**, sin alta
vigente (`validarAlta`, Registro.gs:228-248). La ref inventa el ID (`'ALT-' + Date.now()`, ref 925): usar `r.alta.ID`.
**adaptador en el cliente.**

### 1.9 Pacientes, buscar — ref 957 `api('buscarPaciente', v)` esperando `[{ dni, n }]`

Real: `buscar(texto)` (Codigo.gs:346-360) → `[{ DNI, NOMBRE }]`, hasta 20, mínimo 3 letras, DNI por prefijo.
`dni←DNI`, `n←NOMBRE`. **adaptador en el cliente.** Si no hay resultados devuelve `[]`.

### 1.10 Pacientes, ficha — ref 974 `api('getPaciente', dni)`

Real: `getPaciente(dni)` (Codigo.gs:307-344):

```
{ dni, nombre, series: [filas de armarPacientes], citas: [...], indicaciones: [...],
  porConfirmar: [{ID, FECHA, TIPO, DETALLE, NOMBRE, TELEFONO, candidatos: [{dni, nombre}]}],
  seguimientos: [todas, también las anuladas], registros: [{ID, FECHA, TIPO, TEXTO, DOCTOR, ASESORA, SESIONES,
  ESTADO, MOTIVO_ANULACION, sesiones: [{ID, NUMERO, FECHA, ASESORA}]}],
  altas: [{ID, FECHA, ESPECIALIDAD, DOCTOR, REGISTRADO_POR, ANULADO, MOTIVO_ANULACION, VIGENTE}],
  fallecido: {fecha, quien, id} | null, telefonosDescartados: [..] }
```

| Ref lee (ref 976-1003) | Real | Veredicto |
|---|---|---|
| `p.n`, `p.dni` | `nombre`, `dni` | adaptador |
| `especialidades[].esp` | `series[].ESPECIALIDAD` | adaptador |
| `especialidades[].estado` (‘No volvió’, ‘Al día’…) | `series[].ESTADO` traducido con `NOMBRE_ESTADO` (app 1197) y `esBueno` (app 1196) | adaptador |
| `especialidades[].perfil` | `textoTipo(serie)` (app 616) | adaptador |
| `especialidades[].pend` | `series[].PENDIENTE` | adaptador |
| `especialidades[].consultas: [[tipo, fecha, médico]]` | `citas` filtradas por especialidad; tipo con `lineaDeTiempo` (app 1202: «Primera cita», «Reevaluación n») | adaptador |
| — | «Debía volver el … (plazo máximo …)» con `PROXIMA_ESPERADA`/`VENCE`; **la ref lo pierde** | falta en el cliente |
| `trats[]`: `{id, titulo, f, med, quien, n, sesiones: [{f, quien}], anulado}` | `registros[]`: `id←ID`, `titulo←TEXTO`, `f←FECHA`, `med←DOCTOR`, `quien←ASESORA`, `n←SESIONES`, `sesiones←sesiones` (`f←FECHA`, `quien←ASESORA`, **y conservar `ID`** para anular), `anulado←ESTADO=='ANULADO'` | adaptador |
| `previos[]`: `{f, det, estado, obs}` | `indicaciones[]`: `f←FECHA`, `det←DETALLE (+ ×CANTIDAD)`, `estado←'Cotizó, no lo hizo'/'Lo hizo'`, `obs←OBSERVACIONES`; la app muestra además `TELEFONO` | adaptador |
| `tels[]` | **no viene a nivel paciente**: solo en `series[].TELEFONOS`. Un paciente sin consultas (solo registros) queda sin teléfonos | **falta en el servidor** (S8) |
| `altas[]`: `{esp, f, det}` | `altas[]`: `esp←ESPECIALIDAD`, `f←FECHA`, `det←DOCTOR · registró REGISTRADO_POR`; más `VIGENTE`/`ANULADO` | adaptador |
| `hist[]`: `{f, txt}` | `seguimientos[]` con `textoRes` (app 1254-1259); las anuladas tachadas con motivo | adaptador |

**S8 (mínimo):** `getPaciente` agrega `telefonos: d.telefonos[k] || []` (una línea en Codigo.gs:320-343).

La **historia del panel del tablero** (ref 666, `p.hist`) sale del mismo `getPaciente(dni)`, filtrando
`seguimientos` por `ESPECIALIDAD` + `REFERENCIA` de la tarjeta, más `registros[].sesiones` y `altas` (spec §5.3.6).
Se pide al abrir el panel; mientras llega, esqueleto. `getPaciente` relee todo el libro (`datos_`, Codigo.gs:223): uno o
dos segundos.

### 1.11 Pacientes, sesión — ref 991 `api('marcarSesion', { id, fecha, usuario })` y ref 993 `api('marcarSesion', { id, anular: true, usuario })`

- Marcar: `marcarSesion({ usuario, id: 'REG-…', fecha, nota })` (RegistroServidor.gs:49-68) → `{ ok, sesion, completo }`.
  **ya existe tal cual** (falta `nota: ''`, opcional). Valida fecha no futura, no anterior al registro ni a la sesión previa.
- Anular: **no** es `marcarSesion`. Es `anularSesion({ usuario, id: 'SES-…', motivo })` (RegistroServidor.gs:82-94),
  **motivo obligatorio**, y solo la última sesión (`validarAnulacionSesion`, Registro.gs:152). La ref no pide motivo y pasa
  el ID del registro. **adaptador en el cliente** + pedir motivo en la fila (como `pedirMotivo`, app 1127).

### 1.12 Indicadores — ref 1023 `api('getResumen', { mes, medico, esp })` esperando `{ meses, llegan, canales, campanas, procs, procGrupo, procMed }`

Real: **dos** funciones, sin argumentos; filtran en el cliente.

- `getResumen()` (Codigo.gs:405-411) → `{ hoy, filas: [{MES, MEDICO, NUEVOS, NUEVOS_NO, NUEVOS_CURSO, NUEVOS_ALTA, CONTROL,
  CONTROL_NO, CONTROL_CURSO, CONTROL_ALTA, HIERRO, HIERRO_NO, HIERRO_COMPLETO, PROC, PROC_NO, SEGUIMIENTOS, RECUPERADOS}],
  medicos, meta }` (`resumenPorMes`, Logica.gs:960-1028).
- `getKpi()` (Codigo.gs:397-402) → `{ cohortes, indicaciones, recuperacion, motivos, campanas, sinCandidato, meta }`
  (`calcularKpi`, Logica.gs:936-946).

La app ya hace toda la cuenta en el cliente (`sumarMes` app 1572, `pintarResumen` app 1589, `historia` app 1411,
`pintarTablero` app 1454). El mapeo campo por campo está en §4.

---

## 2. «¿Qué pasó?»: claves, columnas y Deshacer

### 2.1 Claves de la referencia → `RESULTADOS` (Resultados.gs:9-21)

| Clave ref | `resultado` que se envía | Grupo | Pide (campo del payload) | Rango que valida el servidor | Tipos | Columna de llegada |
|---|---|---|---|---|---|---|
| `nocontesto` | `NO CONTESTÓ` | Sigue | — | — | todos | **Agendado** «Reintentar el dd/mm · intento k de N» (k < N) o «Sin respuesta · se cierra el dd/mm» (k ≥ N); pasada la espera, se cierra solo (`leerCiclo`, Resultados.gs:113-124; `etiquetaDe`, Tablero.gs:70-71) |
| `pensara` | `LO PENSARÁ` | Sigue | `fecha` | de mañana a 90 días (Resultados.gs:155-159) | todos | Agendado «Llamar el ddd dd/mm» |
| `agendo` | `AGENDÓ CITA` | Sigue | `fecha` | de hoy a 180 días (Resultados.gs:160-164) | todos | Agendado «Cita el ddd dd/mm»; si pasa `fecha + GRACIA_AGENDA_DIAS` sin consulta, vuelve a Por contactar |
| `lohizo` | `LO HIZO` | Sigue | `fecha` | no futura (Resultados.gs:165-169); en registro, además ≥ fecha del registro y ≥ sesión previa (`validarSesion`, Registro.gs:138) | **solo hierro y procedimiento** (`soloIndicacion`, Resultados.gs:151) | registro con sesiones pendientes: En tratamiento (o Por contactar atrasada si la fecha es vieja); última sesión o procedimiento: Completado; cotización antigua: Completado «Lo hizo el dd/mm» |
| `alta` | `ALTA MÉDICA` | Cierra | `doctor` (= `doctores[].doctor`); en reevaluación también `fecha` | reevaluación: lo de `validarAlta`; hierro/proc: solo doctor, se guarda en `NOTA` «Alta: …» (Resultados.gs:170-174) | todos | Completado «Alta médica · Dr. …» (reev, Tablero.gs:119-124) o «Alta médica» (hierro/proc, Tablero.gs:115) |
| `numero` | `NÚMERO EQUIVOCADO` | Teléfono | `telefono` (9 dígitos, debe estar en `TELEFONOS`) | Resultados.gs:175-180 | todos | si queda otro teléfono **o un usuario @**: se queda en su columna, con el número tachado (`ACCION = TELEFONO`); si no: cierra, sale al enlace «cerrados» |
| `otrolugar` | `SE ATIENDE EN OTRO LUGAR` | Cierra | — | — | todos | sale; cuenta en «cerrados este mes». Solo esa especialidad o ese tratamiento |
| `fallecio` | `FALLECIÓ` | Cierra | — | — | todos | salen **todas** las tarjetas de ese DNI; un cerrado por paciente (Tablero.gs:128-131) |
| `otro` | `NO DESEA CONTINUAR` | Cierra | `motivo` (obligatorio; se guarda `MOTIVO = NO DESEA CONTINUAR` y el texto en `NOTA` «Motivo: …», spec §9.1) | Resultados.gs:181-185 | todos | sale; «cerrados este mes» |

La etiqueta de la ref «No desea continuar / otro» debe quedarse en «No desea continuar»: no existe un «otro» aparte.
`nota` (opcional) va con todos.

### 2.2 Columnas: ref 1-4 ↔ `getTablero`

| Ref `col` | `COLUMNA` real | Qué filas entran (`columnaDe`, Tablero.gs:47-58; `armarTablero`, 95-163) | Orden real | Grupos |
|---|---|---|---|---|
| 1 Por contactar | `POR_CONTACTAR` | reevaluación `VENCIDO`; hierro/proc `PENDIENTE`, **incluido un registro en curso atrasado** (`ATRASO > 0`) | `ordenarBandeja` (Logica.gs:698-715): menos intentos, con pendiente, menos días | Recientes / Hace 1 a 2 meses / Más antiguos (por días) |
| 2 Agendado | `AGENDADO` | `ESTADO = AGENDADO`; en reevaluación solo con `N_SEGUIMIENTOS > 0` (spec §9.3) | `FECHA_CLAVE` ascendente | «Esta semana», «Más adelante» (spec §4.5) — **la ref no los tiene** |
| 3 En tratamiento | `EN_TRATAMIENTO` | registro `EN CURSO` sin atraso (en la práctica, solo hierro de varias sesiones) | próxima sesión ascendente | — |
| 4 Completado / Alta | `COMPLETADO` | solo del mes: volvió tras seguimiento, registro completo, «Lo hizo» antiguo, alta vigente o cierre «ALTA MÉDICA» | más reciente primero | — |
| (enlace) | `cerrados[]` | cierres del mes que no son éxitos | — | — |

Campos de la tarjeta que la app nueva debe usar: `CLAVE`, `COLUMNA`, `ETIQUETA`, `FECHA_CLAVE`, `AGENDA`, `FECHA_AGENDA`,
`INTENTO`, `ATRASO`, `SIN_CONTACTO`, `TELEFONOS_DESCARTADOS`, `ID_REGISTRO`, `ESTADO_REGISTRO`, `SESIONES`, `HECHAS`,
`ULTIMA_SESION`, `N_SEGUIMIENTOS`, `PROXIMA_AGENDADA` (para proponer la fecha de «Agendó cita», spec §5.3.2), más los
de §1.2.

### 2.3 Movimiento optimista, confirmación y error

Spec §5.3.5: la tarjeta se mueve en el acto con la regla del servidor aplicada en el navegador, se compara con
`tarjeta` al llegar la respuesta, se corrige si el servidor la puso en otra columna, y **se devuelve si hubo error**.

| Paso | Ref hoy | Cómo debe quedar |
|---|---|---|
| Columna optimista | reglas propias, distintas de las del servidor (ref 704-713) | tabla §2.1, con `reglas` de `bootstrap` (S1) |
| Etiqueta optimista | texto propio | la misma redacción de `etiquetaDe`; luego se reemplaza por `tarjeta.ETIQUETA` |
| Respuesta | ignorada (ref 717) | `r.tarjeta` manda: si `COLUMNA` difiere, `conFlip` a la columna del servidor; si `r.tarjeta` es `''`, la tarjeta sale |
| Error | solo un aviso; la tarjeta queda movida | restaurar la copia `previo` (la ref ya la toma, ref 701) y avisar «No se guardó: …» con el mensaje del servidor |
| Contador del día | `S.hechos += 1` con cualquier resultado (ref 716) | sumar solo resultados «Sigue» que escriben `SEGUIMIENTOS` (la misma regla que S2), o refrescar desde `cifras` |
| Fallecido | oculta **una** tarjeta | ocultar todas las del DNI (app 826) |
| Aviso | 6 s (ref 442) | **8 s** (spec §5.3.5; app 516) |

### 2.4 Deshacer

La ref restaura la copia local y **no llama al servidor** (ref 718): lo deshecho seguiría guardado. La app ya resuelve el
caso (app 872-880):

| Respuesta de `registrarResultado` | Deshacer llama a | Notas |
|---|---|---|
| `{ seguimiento: {ID: 'SEG-…'} }` | `anularResultado({ usuario, id, motivo: 'Deshecho al momento' })` (ResultadoServidor.gs:70-84) | Solo el **último** resultado de ese seguimiento (`validarAnulacionResultado`, Resultados.gs:201-213), salvo «Falleció», que siempre se puede |
| `{ alta: {ID: 'ALT-…'} }` | `anularAlta({ usuario, id, motivo })` (RegistroServidor.gs:117) | Solo IDs `ALT-` |
| `{ sesion: {ID: 'SES-…'} }` | `anularSesion({ usuario, id, motivo })` (RegistroServidor.gs:82) | Solo la última sesión |

Después de deshacer, **recargar `getTablero()`** (la app recarga la bandeja, app 879): no restaurar la copia local,
porque entretanto otra asesora pudo cambiar algo.

Desde la historia (panel y ficha), «Anular» solo en la última entrada de cada seguimiento, con motivo obligatorio
(app 1265-1272 ya lo hace). Ninguna fila se borra.

### 2.5 Teclado

| Tecla | Ref | Spec §5.3.7 / app | Recomendación |
|---|---|---|---|
| ↑ ↓ ← → | sí (ref 761-768) | ↑ ↓ (app también j/k) | mantener las cuatro; agregar j/k |
| Enter, C, /, Esc | sí | sí | sí |
| 1-4 | **solo con el panel abierto** (ref 752) | sobre la tarjeta seleccionada (app 950-955) | en ambos casos; con 1 = «No contestó» se guarda sin abrir el panel |
| X | **no existe** | abre el grupo de cierre (app 956) | agregar. Ninguna tecla guarda un cierre |

---

## 3. Conflictos entre la referencia y la spec o las reglas vigentes

| # | Tema | Qué hace la referencia | Qué dice la spec o la regla | Recomendación |
|---|---|---|---|---|
| A | «No contestó» | oculta la tarjeta (`salir = true`, ref 704) y dice «vuelve a la lista el {hoy+15}» | spec §2 y §4.4.7: espera en Agendado «Reintentar el dd/mm» | **Decidido**: va a Agendado con `ETIQUETA` del servidor |
| B | 2.º «No contestó» | «El seguimiento se cerró» en el acto (ref 704) | se cierra solo **pasada la espera**; mientras, Agendado «Sin respuesta · se cierra el dd/mm» (Resultados.gs:115-120; Tablero.gs:71) | Seguir al servidor; el aviso dice «Se cerrará el dd/mm si no responde» |
| C | N y espera | «de 2» y 15 días escritos en el texto | `MAX_SEGUIMIENTOS` y `ESPERA_TRAS_SEGUIMIENTO_DIAS` en `REGLAS`. **El valor por omisión del código es 3** (Logica.gs:195, 204), la spec dice 2 | Leerlos de `bootstrap.reglas` (S1). Comprobar en «Verificar» que `REGLAS` tiene `MAX_SEGUIMIENTOS = 2` |
| D | Sesión atrasada | sigue en En tratamiento en rojo (DEMO ref 1128; cifra ref 545) | spec §2: pasa a **Por contactar**, «Sesión 2 de 3 · atrasada N días» | Seguir la spec (el servidor ya lo hace). La cifra «sesiones atrasadas» se cuenta en la columna 1 |
| E | Arrastrar y soltar | a 2 → `agendo`; a 3 → `lohizo` si hierro; a 4 → `lohizo` si proc o última sesión, si no `alta` (ref 774-780). Abre el paso, no guarda solo | spec no define el arrastre; «Ninguna tecla guarda sola un cierre» | Mantener que **siempre abre el paso con confirmación**. Corregir destinos: a 3 solo si `ID_REGISTRO` y `HECHAS + 1 < SESIONES` (una cotización antigua de hierro con «Lo hizo» va a Completado, spec §3.2); a 4 en reevaluación es «Alta médica» (pide doctor y fecha). Soltar en 1 sigue prohibido. No arrastrar tarjetas de Completado (ya, ref 783) |
| F | «Lo hizo» en procedimiento | «Se hizo {proc}» → Completado «Se hizo el dd/mm» (ref 680, 710) | registro: `marcarSesion` → `COMPLETO` → **etiqueta «Completó el tratamiento»** (Tablero.gs:112), mal dicho para un procedimiento; cotización antigua: «Lo hizo el dd/mm» | **S5**: en Tablero.gs:112, si `TIPO_SEGUIMIENTO = PROCEDIMIENTO`, «Se hizo el dd/mm». Spec §5.3.1: «Lo hizo» no aparece en reevaluación (la ref ya lo filtra, ref 475) |
| G | Alta en hierro/procedimiento | pide doctor (de `S.medicos`) **y fecha** (ref 682) | spec §9.2: solo el doctor; la fecha es la del registro. En reevaluación sí lleva fecha | Ocultar la fecha si `t != 'reev'`; doctor de `doctores` |
| H | Número equivocado con un solo teléfono | «es el único número: el seguimiento se cerrará» (ref 683) aunque tenga usuario @ | sigue si queda un usuario (spec §4.2; app 788) | Mismo texto que la app: «Le queda el usuario @…: el seguimiento sigue» |
| I | Usuarios | DEMO con Magaly, **Ana**, Rachel y el médico (ref 1101), valores en minúscula | `CATALOGOS.USUARIOS`; `CLAUDE.md`: «La usan Magaly, Ana, Rachel y el Dr. Eli Cabanillas» | Sin conflicto de fondo: la lista sale del catálogo. Cuidar la forma (§0) |
| J | Usuario por omisión | `'Magaly'` si no hay nada guardado, o el **primero de la lista** si lo guardado no coincide (ref 387, 1084). Como los valores reales son `'MAGALY'`, la primera vez **siempre** caería en el primero | la app arranca en «— Elija —» y `exigirUsuario` bloquea cada guardado (app 535-540); la identidad es lo único que atribuye un resultado | **No elegir usuario por omisión.** Recordar `seg.usuario` y, si no coincide, dejar vacío y pedirlo |
| K | Médico como usuario | `rol: 'Médico'` **bloquea** el filtro de médico (`disabled`, ref 517) y saluda «doctor X» | la app propone el filtro con `medicoDeUsuario` pero **deja cambiarlo a «Todos»** (app 1658-1664) y lo abre en Resumen (app 1698) | Proponer, no bloquear. Para el médico, abrir en Indicadores. El rol se deduce del texto («DR.»/«DRA.»), no hay columna de rol |
| L | `getKpi` al arrancar | lo usa para médicos, usuarios y hechos (ref 1082) | `getKpi` es lo más caro; `bootstrap` es la llamada de arranque | `bootstrap` + `getTablero` en paralelo. `getKpi` solo al entrar en Indicadores, con caché `E.kpi` y se invalida tras escribir (como app 849) |
| M | Meta del día 15 y `hechosHoy` | fija en 15; por usuario | no existe meta diaria; `hechosHoy` es de todo el equipo y solo «Sigue» | S1 + S2. Si no se quiere la meta, quitar la barra antes que dejar un 15 en el código |
| N | «N cerrados este mes» | no existe | spec §4.5: enlace bajo Completado que abre la lista | Agregar el enlace con `cerrados[]` (S3 para los nombres) |
| O | Orden de Por contactar | reordena en el cliente: sin intentos primero y luego días (ref 534) | `ordenarBandeja`, que «no cambia» (spec §4.5) | Respetar el orden del servidor; solo agrupar |
| P | Esperando 7 días | — | cotización en sus 7 días no va al tablero (spec §2) | El servidor ya lo excluye (`EN ESPERA`) |
| Q | Error y Deshacer | ver §2.3 y §2.4 | spec §5.3.5 | Lo de §2.3/§2.4 |
| R | Registro | varios procedimientos; borra letras del DNI; no exige contacto; catálogos fijos; no carga «Registrados hoy»; sin aviso de fallecido | §1.4-1.8 | S7 y adaptadores de §1.4-1.8 |
| S | Ficha | anula sesión sin motivo; sin emparejamiento, sin «Dar de alta…», sin anular registro/alta/seguimiento | `CLAUDE.md`: nunca se borra, se anula con motivo; README: no se elimina ninguna función | §5 |
| T | Indicadores, meta | «meta 40 %» escrita en el código (ref 1032, 1037) | `REGLAS.META_RETORNO_PCT` (60) llega como `meta` | Usar `100 - meta` |
| U | Indicadores, especialidad | la ref manda `esp` | `resumenPorMes` no tiene especialidad (Logica.gs:960-1028); `kpiIndicaciones` tampoco. La app solo filtra por especialidad en Detalle (cohortes, recuperación) | Decidir: o el filtro de especialidad solo en las pestañas que lo admiten (como hoy), o S10 |
| V | Indicadores en Etapa 1 | — | spec §8: cómo cuentan fallecidos y cierres nuevos en Indicadores es de la Etapa 2; «hasta entonces, las cifras se calculan como hoy» | Las 7 pestañas usan los cálculos de hoy sin tocarlos |
| W | Palabras | «Completado / Alta», «intento sin respuesta» | brief §7: no «cohorte», «días de atraso», «lead», «KPI» en pantalla | La ref cumple en pantalla (las clases CSS `kpis` no se ven). La app tiene «Sin lead en el CRM» como valor de datos (Logica.gs:912): cambiarlo a «Sin registro en el CRM» al mostrar (la maqueta ya lo dice así) |
| X | Saludo | «Buenos días» a cualquier hora | — | Por hora del día, o quitarlo |
| Y | Tema y prueba de colores | `[data-tema="oscura"]` | prueba de colores (test/ui.test.js:311-315) | Renombrar (§0) |
| Z | Panel en Completado | se abre y dice «Seguimiento cerrado» | el servidor rechaza resultados sobre tarjetas cerradas (`tarjetasAbiertas_`, ResultadoServidor.gs:9-12) | Bien así: en Completado, panel solo de lectura con historia y «Anular» del último |

---

## 4. Indicadores: de dónde sale cada pestaña

Todas se calculan en el cliente con `getResumen()` y `getKpi()`, como hoy. Ninguna necesita servidor nuevo salvo lo
marcado. Filtros: mes y médico en todas; especialidad donde los datos la traen.

| Pestaña | Datos | Cálculo que ya existe | Lo que lee la ref y su mapeo | Falta |
|---|---|---|---|---|
| 1. Resumen del mes | `getResumen().filas`, `meta`, `medicos` | `sumarMes` (app 1572-1582), `pintarResumen` (app 1589-1655) | `meses[i] = { nombre: nombreMes(MES), pct: REEVAL_NO/REEVAL, tot: REEVAL, no: REEVAL_NO, plazo: CURSO, curso: CURSO > 0, sec: [hierro no siguió (HIERRO_NO/HIERRO), completó (HIERRO_COMPLETO/(HIERRO-HIERRO_NO), bueno), procedimientos no (PROC_NO/PROC), volvieron tras seguimiento (RECUPERADOS/SEGUIMIENTOS, bueno)] }` con `n: 'a de b'`. Navegación por `MES` (yyyy-mm), no por índice | la ref pierde el desglose nuevos/en control y la nota de altas (app 1633-1635): recuperarlos. Meta: §3 T |
| 2. ¿Hasta dónde llegan? | `getKpi().cohortes`, `meta` | agrupar por mes + `partes` + `historia` (app 1411-1493) | `llegan.cien` = `grupos` de `historia`; `llegan.relato` = sus frases; `llegan.filas = [[nombreMes, partes(o).n]]` (6 números: no volvió, 1, 2, 3+, aún en plazo, alta). La suma de `n` coincide con el `total` de la app (`e1 + alta1`) | nada |
| 3. Campañas | `getKpi().campanas` (`kpiCampanas`, Logica.gs:918) | `filasCam` (app 1512-1516) | `canales`/`campanas` = `[nombre, NUEVOS, VOLVIERON, NUEVOS - EN_CURSO, EN_CURSO]`, agrupando por `CANAL` y por `CAMPANA`, orden por nuevos | nada. No filtra por especialidad (los datos no la traen; la ref y la app ya lo dicen) |
| 4. Procedimientos | `getKpi().indicaciones` (`kpiIndicaciones`, Logica.gs:821) | `indTipo`, `indMed` (app 1497-1503) | «Como se escribió» = por `DETALLE` (`nombreInd`); «Por médico» = por `MEDICO`; filas `[nombre, INDICADAS, ACEPTADAS, COMPLETADAS]` | **«Por tipo» (juntar «CITOMETREÍADE FLUJO», «BIOSIA»…) no existe** (`procGrupo` de la ref es inventado). S9 |
| 5. Recuperación | `getKpi().recuperacion` (`kpiRecuperacion`, Logica.gs:843) | `recResp`, `recMes` con mediana de días (app 1505-1510) | — (la ref no tiene la pestaña) | diseño de la pestaña con el estilo de la ref |
| 6. Motivos de cierre | `getKpi().motivos` (`kpiMotivos`, Logica.gs:869) | tabla motivo/pacientes (app 1545-1546) | — | `kpiMotivos` no trae mes ni médico: la pestaña no responde a los filtros. Los cierres automáticos «SIN RESPUESTA» no son filas y no cuentan; los «NÚMERO EQUIVOCADO» que no cierran (`ACCION = TELEFONO`) tampoco. Por la spec §8 se deja así en esta etapa; avisarlo en una nota. Si se quiere filtrar: agregar `MES` y `RESPONSABLE` a cada fila (S11, Etapa 2) |
| 7. Procedimientos sin paciente | `getKpi().sinCandidato` | tabla (app 1547-1550) | — | nada |

**S9 (mínimo, función pura en `Logica.gs`):** `grupoProcedimiento(detalle)` → nombre canónico. Partir por `+`,
normalizar cada parte con `normTexto` y una tabla de equivalencias por prefijo/similitud (`AMO`, `BIOPSIA`/`BIOSIA`/`BIPOSIA`,
`CARIOTIPO`, `CITOMETRIA`/`CITOMATERIA`/`CITOMETREIADE` [+ `DE FLUJO`], `CITOGENETICA`), ordenar las partes en un orden
fijo y unir con « + ». `kpiIndicaciones` agrega `GRUPO`. Pruebas en Node con los ejemplos de la maqueta. Sin esto, la
pestaña muestra solo «Como se escribió» y «Por médico».

**S10 (opcional):** `resumenPorMes` con `ESPECIALIDAD` en la clave (las filas de hierro y procedimiento llevarían
`ESPECIALIDAD_CONSULTA`). Solo si se decide que el Resumen del mes filtra por especialidad.

### Resumen imprimible de 2 páginas (maqueta `maquetas/Resumen del mes.dc.html`)

La ref solo llama a `window.print()` (ref 1013) y **no tiene ningún `@media print`**: todo el imprimible está por hacer.

| Página | Bloque de la maqueta | Fuente |
|---|---|---|
| 1 | Cabecera «todos los médicos · todas las especialidades» y mes | filtros activos |
| 1 | Cifra grande, «Son a de b», «a otros N aún no les toca volver», meta | `getResumen` + `sumarMes` |
| 1 | 4 frases secundarias | `sumarMes` (las mismas 4 métricas) |
| 1 | Mes a mes, 6 barras, cerrado/en curso, línea de meta | `getResumen` (como app 1606-1617) |
| 1 | «Qué conviene mirar» (2 frases) | **lógica nueva del cliente**: tendencia desde el primer mes visible y la métrica secundaria peor. Reglas fijas y probadas en DEMO |
| 1 | «Generado el dd/mm/aaaa · datos de SOFDOC y de la plataforma» | `boot.hoy` |
| 2 | 100 cuadritos + relato | `getKpi().cohortes` + `historia` |
| 2 | «¿Qué canales traen pacientes que vuelven?» (5 primeros) | `getKpi().campanas` por canal |
| 2 | Procedimientos: 2 frases «de lo cotizado, cuánto se empezó» | `getKpi().indicaciones`, agrupado por S9 (sin S9, por `DETALLE`) |

Implementación: una sección `#imprimible` oculta en pantalla, `@media print` que solo muestra esa sección, `@page { size: A4 }`
y `break-after: page` entre las dos. Al pulsar «Imprimir resumen» se piden `getResumen` y `getKpi` si no están en caché.
**Probar en el `@HEAD`:** la app vive en un iframe de HtmlService; `window.print()` imprime el iframe, que es lo que se quiere,
pero hay que confirmarlo en Chrome.

---

## 5. Lo que la app actual hace y la referencia no

El README pide que no se elimine ninguna función. Inventario de `src/Index.html`:

| Capacidad actual | Dónde (app) | ¿La ref la cubre? |
|---|---|---|
| Selector «¿Quién es usted?» obligatorio, sin valor por omisión, recordado en `seg.usuario` | 345-347, 533-540, 1693-1695 | **parcial**: elige uno por omisión (§3 J) |
| Modo oscuro que sigue al sistema la primera vez | 542-546, 1670 | parcial: arranca siempre en claro |
| Preferencia de tipo recordada (`seg.tipo`) | 1674-1681 | no |
| Botones de tipo con su contador (Todos, Reevaluaciones, Hierro, Procedimientos) | 366-371, 633-639 | sí |
| Filtros especialidad, médico, solo sin teléfono | 372-375, 622-631 | sí (especialidades fijas: §1.1) |
| «No contestó» de un toque en la fila, sin abrir el panel | 671, 916 | **no** (hay que abrir el panel o usar la tecla 1 con el panel abierto) |
| Contadores: por atender, hechos hoy, recuperados del mes | 360-364, `getBandeja` | cambia por 4 cifras; «recuperados del mes» desaparece (Completados del mes lo incluye) — confirmar |
| Panel: pendiente de procedimiento de una reevaluación (`PENDIENTE`) | 741 | **no**: la ref no muestra `PENDIENTE` |
| Panel: «Ya se le escribió N veces · la última el dd/mm» | 748 | no (solo «1 intento» en la tarjeta) |
| Panel: usuario @ | 747 | sí |
| Panel: nota | 749 | sí |
| «¿Qué pasó?» con los 9 resultados, pasos con fecha y rangos, confirmación de cierre en el panel, número equivocado con usuario | 764-796, 894-917 | sí en forma; mal en datos (§2, §3 G, H) |
| Guardado optimista con vuelta atrás y conciliación con `tarjeta` | 817-891 | **no** (§2.3) |
| Deshacer que anula en el servidor (resultado, alta o sesión) | 872-880 | **no** (§2.4) |
| Atajos ↑↓ j k Enter C 1-4 X Esc | 940-973 | parcial: sin X ni j/k; 1-4 solo con panel |
| Registro: modos Indicación y Alta | 386-389, 1025-1034 | sí |
| Registro: autocompletar nombre, contacto y doctor desde `buscarPacienteRegistro` | 1038-1058 | parcial (llama a otra función, §1.7) |
| Registro: aviso de paciente fallecido | 1048 | **no** |
| Registro: especialidades con alta vigente deshabilitadas | 1060-1065 | **no** |
| Registro: catálogos de procedimientos, tratamientos, marcas y doctores desde `CATALOGOS` | 995-1023 | **no** (fijos en el código) |
| Registro: sesiones «Otro» (6-20) | 408-409 | sí |
| Registro: duplicado a 7 días con «Registrar de todos modos» | 1083-1089 | parcial (solo contra lo de hoy, en el cliente) |
| Registro: carné de extranjería | `documentoOk`, 1036 | **no** (borra letras) |
| «Registrados hoy» desde el servidor, con anular registro o alta con motivo | 1116-1160 | parcial: lista solo local, anula sin servidor |
| Buscador (≥ 3 letras, DNI por prefijo) | 1168-1181 | sí (§1.9) |
| Ficha: **confirmar emparejamiento** («¿Es esta la misma persona?», `porConfirmar` → `confirmarEmparejamiento`) | 1229-1234, 1299-1312 | **no** |
| Ficha: aviso de fallecido y números equivocados tachados | 1289-1291 | **no** |
| Ficha: estado por especialidad y «Dar de alta…» con doctor y fecha | 1235-1247, 1340-1362 | **no** el «Dar de alta» |
| Ficha: línea de tiempo de citas con «Debía volver el … (plazo máximo …)» | 1202-1213, 1244-1246 | parcial (sin la línea esperada) |
| Ficha: registros con sesiones, «Lo hizo» con fecha, **anular registro**, anular última sesión con motivo | 1215-1226, 1275-1284, 1316-1338 | parcial: sin anular registro; anular sesión sin motivo |
| Ficha: altas (vigente / cerrada / anulada) con **anular alta** | 1285-1288 | parcial: sin estado ni anular |
| Ficha: procedimientos históricos con teléfono | 1249-1252 | sí, sin teléfono |
| Ficha: seguimientos con **anular el último** (motivo) | 1254-1273 | **no** |
| Detalle: 7 secciones con filtros mes / especialidad / médico | 1454-1552 | 4 de 7, solo filtro médico y mes |
| Resumen: meta de `REGLAS`, desglose nuevos/en control, nota de altas, médico propuesto | 1589-1655 | parcial (§4) |
| Médico: abre en Resumen con su filtro | 1698 | no (§3 K) |
| CRM: canal y campaña del lead (`getKpi().campanas`) | 1512-1534 | sí (pestaña Campañas) |
| Copiar con plan B (`execCommand`) dentro del iframe | 561-585 | sí |
| `DEMO` con las formas reales del servidor | 1705-1966 | **no**: el DEMO de la ref tiene las formas inventadas. Hay que reescribirlo con las formas reales (y agregar `getTablero`, que hoy no está en ningún DEMO) |
| Pruebas de interfaz `npm run test:ui` (742 líneas, ~53 pruebas sobre los `id` actuales) | test/ui.test.js | **se rompen todas**: hay que reescribirlas |

Del lado del servidor no se quita nada: `getBandeja`, `marcarSeguimiento` y `descartar` siguen vivas (los nombres están
protegidos en `CLAUDE.md`), aunque la app nueva deje de llamarlas.

---

## 6. Orden de trabajo recomendado

0. **Cerrar decisiones abiertas** (una línea cada una): meta diaria sí/no y si cuenta «Lo hizo» y altas (§1.1, M);
   rol del médico (proponer o bloquear el filtro, K); filtro de especialidad en Resumen (U, S10); «recuperados del mes»
   (§5); varios procedimientos por registro en el servidor (S7) o varias llamadas; «Motivos de cierre» sin filtros en
   esta etapa (§4).
1. **Servidor, con pruebas en Node primero** (cada uno es pequeño y se publica solo, sin cambio visible):
   S1 `bootstrap.reglas` + `META_DIARIA_SEGUIMIENTOS`; S2 `hechosHoyPor`; S3 nombres en `cerrados` y en altas sin serie;
   S4 `tarjeta` también tras `darDeAlta`/`marcarSesion`; S5 etiqueta «Se hizo el dd/mm»; S6 `TRATAMIENTO`/`MARCA`
   separados en `pendientesRegistro`; S7 `procedimientos: []`; S8 `getPaciente.telefonos`; S9 `grupoProcedimiento`.
   Opcional: `MOTIVO_ANULACION` en `getRegistrosHoy`, S10, S11.
2. **Esqueleto** de `src/Index.html` desde la ref: tokens a `html[data-modo="oscuro"]`, preferencias `seg.*`, puente
   `llamar`, selector de usuario sin valor por omisión. La prueba de colores debe pasar ya en este paso.
3. **DEMO con formas reales**: partir del DEMO actual (app 1705-1966) y agregar `getTablero` armado con las mismas
   reglas (o con tarjetas fijas por columna), `cerrados` y `cifras`. Toda la interfaz se prueba contra esto.
4. **Capa de adaptadores** (§0, §1): `adaptarBoot`, `adaptarTarjeta`, `adaptarFicha`, `adaptarPacienteRegistro`,
   `adaptarRegistrosHoy`. Pruebas de UI sobre el DEMO.
5. **Tablero**: `getTablero`, 4 columnas con `ETIQUETA`, grupos de Por contactar y de Agendado, cifras, enlace
   «N cerrados este mes», filtros, teclado (incluida X y j/k), «No contestó» de un toque.
6. **Panel «¿Qué pasó?»**: payload de §1.3, columna optimista de §2.1, conciliación con `tarjeta`, vuelta atrás ante
   error, Deshacer de §2.4 a 8 s, historia con `getPaciente` y «Anular» del último.
7. **Arrastrar y soltar** con los destinos corregidos (§3 E); siempre abre el paso.
8. **Registro**: catálogos reales, carné de extranjería, contacto obligatorio, duplicado del servidor, aviso de
   fallecido, alta con especialidades deshabilitadas, «Registrados hoy» y anulaciones.
9. **Pacientes y ficha** con todo lo de §5: emparejamiento, Dar de alta, anular registro, sesión, alta y seguimiento
   con motivo, fallecido, tachados, línea esperada.
10. **Indicadores**: las 7 pestañas sobre `getResumen` y `getKpi` (§4), caché e invalidación tras escribir, médico propuesto.
11. **Resumen imprimible** de 2 páginas (§4), con «Qué conviene mirar».
12. **Reescribir `test/ui.test.js`** con las pruebas de interfaz de la spec §6 (cada resultado mueve la tarjeta, Deshacer
    la devuelve, un error la devuelve, confirmación de cierre, atajos 1-4 y X) más las de Registro, ficha e Indicadores.
13. **Banco de pruebas**: `npm test && npm run test:ui`, `npm run subir`, «Preparar hojas» y «Verificar» (comprobar
    `MAX_SEGUIMIENTOS`, `GRACIA_AGENDA_DIAS` y el parámetro nuevo de la meta), en el `@HEAD`: un resultado de cada tipo,
    un Deshacer, un registro, un alta, una impresión. Solo entonces `npm run actualizar`, avisar a las asesoras que
    recarguen, y anotar el número de versión anterior para volver atrás si hace falta.
