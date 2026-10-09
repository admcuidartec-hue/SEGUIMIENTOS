# Etapa 2: tratamientos, decisiones del médico y registros editables · Diseño

- Fecha: 09/10/2026
- Estado: **aprobado en conversación (09/10/2026), para revisar por escrito**
- Viene de: `2026-10-06-que-paso-y-tablero-design.md` (Etapa 1) y `2026-10-06-rediseno-frontend-design.md` (rediseño)
- Pedido original: la lista de la dirección médica del 07/10/2026 (filtros, tarjetas, sesiones, registro, altas).
  Las dos fallas urgentes de esa lista (buscador e importación de la base de hierro) ya se corrigieron en `b13cfde`.

## 1. Qué se hace y por qué

Hoy la plataforma sigue bien las **reevaluaciones**, pero el **hierro y los procedimientos** se quedan cortos:

- «Agendó cita» se usa para dos cosas distintas: una reevaluación y el inicio de un tratamiento.
- No hay forma de decir «no desea realizarse» con su motivo.
- Las sesiones se marcan una a una con «Lo hizo», sin fecha programada ni aviso si el paciente no viene.
- Al terminar el tratamiento nadie vuelve a llamar al paciente para su reevaluación.
- El alta médica es una sola: no distingue «alta y control en 6 meses» ni «vuelva en tal fecha».
- Un registro mal escrito solo se puede anular, no corregir.

**Éxito** = cada paciente de hierro o procedimiento recorre el tablero de la cotización a la reevaluación sin que nadie
tenga que acordarse de él, y lo que decide el médico en la consulta queda registrado y se cumple.

### 1.1 Decisiones de la usuaria (09/10/2026)

| # | Tema | Decisión |
|---|---|---|
| U1 | Filtro por mes | En el **Tablero y en Registro** |
| U2 | Qué mes del Tablero | El de la **última consulta o cotización** del paciente (la regla de Indicadores) |
| U3 | Opciones de hierro y procedimiento | No contestó · Lo pensará · **Aceptó tratamiento / Aceptó procedimiento** (con fecha de inicio) · **No desea realizarse** (con motivo) · los cierres de siempre. «Agendó cita» queda solo para reevaluaciones |
| U4 | Fin del tratamiento | La tarjeta pasa a **«Por reevaluar»** a los **30 días** de la última sesión (celda de REGLAS) |
| U5 | Fecha de inicio | Es la fecha **programada** de la primera sesión: la tarjeta va a Agendado hasta que se marque |
| U6 | Decisión del médico | Alta · Alta con reevaluación a **6 meses** · a **1 año** · **Nueva reevaluación** con fecha de retorno. En Registro y en la ficha. Las de 6 meses y 1 año reaparecen **un mes antes** |
| U7 | Control + laboratorio | Nuevo tipo de registro; propone **15 días** para el retorno (celda de REGLAS), la asistente puede cambiarla |
| U8 | Editar registros | Todo menos el DNI; las sesiones no bajan de las ya hechas; cada cambio en BITACORA; un anulado no se edita |
| U9 | Confirmación | Mensaje al guardar, editar o anular, y la fila en verde unos segundos |
| U10 | Almacenamiento | **Enfoque A**: columnas nuevas al final de las hojas que ya existen; nada de hojas nuevas |

## 2. Datos

Todas las columnas nuevas van **al final**, y «Preparar hojas» las agrega con `encabezadoAmpliable`, como en la
Etapa 1. Ninguna fila existente se reescribe.

### 2.1 REGISTROS

Columnas nuevas: `FECHA_INICIO`, `EXAMENES`, `FECHA_RETORNO`, `EDITADO`.

| `TIPO` | Qué es | Campos que usa |
|---|---|---|
| `HIERRO` | Tratamiento (hoy) | `DETALLE` (tratamiento), `MARCA`, `SESIONES`, **`FECHA_INICIO`** |
| `PROCEDIMIENTO` | Procedimiento (hoy) | `DETALLE`, `SESIONES` (1 por omisión), **`FECHA_INICIO`** |
| **`CONTROL`** | Control + laboratorio (nuevo) | `DOCTOR`, **`EXAMENES`** (texto libre, opcional), **`FECHA_RETORNO`** |

- `FECHA_INICIO` queda vacía mientras el paciente solo cotizó. La llena «Aceptó tratamiento» (§4.2) o la asistente al
  registrar, si ya sabe la fecha.
- `EDITADO` guarda la fecha y hora de la última edición; el detalle de cada cambio va a BITACORA (§5.3).
- El estado de un registro se sigue calculando con `estadoRegistro`, ahora con un estado más:
  **COTIZADO** (sin fecha de inicio) → **PROGRAMADO** (con fecha de inicio, sin sesiones) → **EN CURSO** →
  **COMPLETO**; o **ANULADO**. Un `CONTROL` no tiene sesiones: está **PROGRAMADO** hasta que vuelve.

### 2.2 ALTAS → «Decisión del médico»

Columnas nuevas: `DECISION`, `FECHA_RETORNO`.

| `DECISION` | Pide | Efecto |
|---|---|---|
| `ALTA` (también la fila vieja, vacía) | Doctor, fecha | Cierra la serie de esa especialidad, como hoy |
| `ALTA 6 MESES` | Doctor, fecha | `FECHA_RETORNO` = fecha + 6 meses. La serie queda cerrada hasta 30 días antes de esa fecha |
| `ALTA 1 AÑO` | Doctor, fecha | Igual, con fecha + 12 meses |
| `NUEVA REEVALUACION` | Doctor, fecha, **fecha de retorno** (obligatoria, futura) | No cierra: la serie espera al paciente en `FECHA_RETORNO` en lugar del plazo de REGLAS |

`altasVigentes` deja de tratar como «alta» a `NUEVA REEVALUACION`, y a las de 6 meses y 1 año pasada su ventana.
Una consulta realizada después de la decisión la deja sin efecto, como hoy.

### 2.3 SEGUIMIENTOS

Sin columnas nuevas. Dos resultados más en `RESULTADOS` (`Resultados.gs`):

| Resultado | Grupo | Pide | Solo para |
|---|---|---|---|
| `ACEPTÓ` | SIGUE | Fecha de inicio (hoy o futura) | Hierro y procedimiento |
| `NO DESEA REALIZARSE` | CIERRE | Motivo | Hierro y procedimiento |

- `AGENDÓ CITA` pasa a ser **solo para reevaluaciones** (`soloReevaluacion`).
- `LO HIZO` **deja de ofrecerse**. Las filas antiguas se siguen leyendo igual, para que las cifras no cambien.
- `ACEPTÓ` sobre una tarjeta con registro escribe `FECHA_INICIO` en ese registro.
- `ACEPTÓ` sobre una cotización del **historial** (`INDICACIONES`, sin registro) **crea el registro**. Lo crea con el
  tipo y el detalle de la cotización, `SESIONES` = `CANTIDAD` (1 si falta) y la fecha de inicio. Así las sesiones
  tienen dónde marcarse. La cotización del historial queda como aceptada.
- `NO DESEA REALIZARSE` cierra la tarjeta con su motivo y aparece en Indicadores → Motivos de cierre.

### 2.4 REGLAS (parámetros nuevos, «Preparar hojas» los agrega)

| Parámetro | Valor inicial | Uso |
|---|---|---|
| `DIAS_POST_TRATAMIENTO` | 30 | Días tras la última sesión para «Por reevaluar» |
| `DIAS_CONTROL_LAB` | 15 | Retorno propuesto para Control + laboratorio |
| `AVISO_ALTA_CONTROL_DIAS` | 30 | Anticipación con que reaparecen las altas a 6 meses y 1 año |

`GRACIA_AGENDA_DIAS` (2) se reutiliza para la sesión no realizada y para el control vencido.

## 3. Recorrido en el Tablero

### 3.1 Hierro y procedimiento

| Situación | Columna | Etiqueta |
|---|---|---|
| Cotizó, pasó la espera (hoy) | Por contactar | «Cotizó hace N días» |
| «Aceptó» con fecha de inicio futura | **Agendado** | «Sesión 1 el dd/mm» |
| Pasó la fecha de la sesión + gracia sin marcarla | Por contactar | «No vino a su sesión k (dd/mm)» |
| Sesión k de n hecha, k < n | En tratamiento | «Sesión k de n · faltan n−k · próxima ~dd/mm» |
| Última sesión hecha | Completado | «Completó el dd/mm · reevaluar el dd/mm» |
| Pasaron `DIAS_POST_TRATAMIENTO` sin consulta | **Por contactar** | **«Por reevaluar · terminó el dd/mm»** |
| «No desea realizarse» | (sale del tablero; en «cerrados del mes») | — |

- La **próxima sesión** se estima con `DIAS_ENTRE_SESIONES` desde la última hecha.
- **«Por reevaluar» es una tarjeta de reevaluación**: ofrece «Agendó cita» y sigue el camino de la Etapa 1. Se une a la
  serie del paciente en la especialidad del médico que indicó el tratamiento (o HEMATOLOGÍA si no se sabe).
- **Avance manual**: en el panel de En tratamiento hay **«Marcar sesión k hecha»** (con fecha, hoy por omisión) y
  **«Anular la última»**. No hay saltos: para ir de la 1 a la 3 se marcan la 2 y la 3.
- **Arrastrar** una tarjeta de hierro a Agendado abre «Aceptó» (en lugar de «Agendó cita»).

### 3.2 Control + laboratorio

- Al registrarse: Agendado, «Control con resultados el dd/mm».
- Si hay una consulta realizada en SOFDOC en esa especialidad a partir de la fecha del registro: Completado, «Volvió el dd/mm».
- Si pasa `FECHA_RETORNO` + gracia sin consulta: Por contactar, «Debía volver con resultados el dd/mm». Desde ahí,
  las opciones de una reevaluación.

### 3.3 Decisión del médico

- `ALTA`: como hoy.
- `ALTA 6 MESES` y `ALTA 1 AÑO`: fuera del tablero hasta `FECHA_RETORNO` − `AVISO_ALTA_CONTROL_DIAS`. Desde ese día,
  en **Por contactar**: «Control de alta a 6 meses · el dd/mm» (o «a 1 año»).
- `NUEVA REEVALUACION`: la serie toma `FECHA_RETORNO` como fecha esperada y vence a esa fecha + la diferencia
  vence − esperado de REGLAS. Antes de esa fecha no aparece.

### 3.4 Filtro por mes (U1, U2)

Un selector junto a los demás filtros: **«Todos los meses»** (por omisión) y los meses con pacientes, del más
reciente al más antiguo. Un paciente pertenece al mes de su **última consulta realizada** (reevaluaciones) o de
su **cotización o registro** (hierro, procedimiento, control). Se recuerda en `seg.mes`. Las cifras de la
cabecera siguen el filtro, como los demás filtros.

## 4. Pantallas

### 4.1 Registro

- El selector de arriba tiene tres opciones: **Indicación** · **Control + laboratorio** · **Decisión del médico**
  (antes «Alta médica»).
- **Indicación**: como hoy, con un campo opcional **«Fecha de la primera sesión»**.
- **Control + laboratorio**: DNI, nombre y contacto (como Indicación), doctor, exámenes (texto libre), fecha de retorno
  (propuesta: hoy + `DIAS_CONTROL_LAB`).
- **Decisión del médico**: DNI, especialidad (las del paciente, como hoy), doctor, fecha de la consulta y la decisión.
  `NUEVA REEVALUACION` muestra el campo **Fecha de retorno**, obligatorio.
- La lista de la derecha pasa de «Registrados hoy» a **«Registrados»**, con el selector **Hoy · {mes actual} · {mes
  anterior} · …** (U1). Cada fila tiene **Editar** y **Anular**.
- **Confirmación (U9)**: al guardar, editar o anular, aviso con el texto del registro («Registro guardado: Hierro
  carboximaltosa × 2 sesiones») y la fila afectada con fondo de éxito durante 3 s (sin animación si el sistema
  pide movimiento reducido).

### 4.2 Panel «¿Qué pasó?»

- Reevaluación: como hoy (No contestó, Lo pensará, Agendó cita y cierres).
- Hierro y procedimiento: No contestó, Lo pensará, **Aceptó tratamiento** / **Aceptó procedimiento**, cierres y
  **No desea realizarse**. Atajos: 1 No contestó, 2 Lo pensará, **3 Aceptó**; X abre los cierres.
- «Aceptó» pide la fecha de inicio (hoy por omisión, no pasada), muestra «Sesiones: n» (editable si viene del historial)
  y confirma.
- En tratamiento: «Marcar sesión k hecha» y «Anular la última».

### 4.3 Ficha del paciente

- Cada registro con **Editar**.
- **«Decisión del médico…»** reemplaza a «Dar de alta…», con las cuatro opciones.
- Los registros muestran su estado nuevo (Cotizado, Programado el dd/mm, Sesión k de n, Completo) y, si es control,
  los exámenes y la fecha de retorno.

## 5. Servidor

### 5.1 Funciones nuevas (nombres públicos)

| Función | Qué hace |
|---|---|
| `editarRegistro(p)` | `{ usuario, id, cambios }`. Valida con `validarEdicionRegistro` (puro). Escribe solo las celdas cambiadas de esa fila (por ID), pone `EDITADO`, deja una línea de BITACORA por campo («SESIONES: 2 → 3»). Devuelve el registro como lo devuelve `getRegistrosHoy` |
| `getRegistros(p)` | `{ periodo: 'HOY' \| 'yyyy-mm' }`. Reemplaza a `getRegistrosHoy`, que se mantiene como envoltorio |

### 5.2 Funciones que cambian (mismo nombre)

- `guardarRegistro`: acepta `tipo: 'CONTROL'` con `examenes` y `fechaRetorno`; y `fechaInicio` en hierro y procedimiento.
- `darDeAlta`: acepta `decision` y `fechaRetorno`. Sin `decision` = `ALTA`, como hoy.
- `registrarResultado`: acepta `ACEPTÓ` (con `fecha` = inicio y, si viene del historial, `sesiones`) y
  `NO DESEA REALIZARSE` (con `motivo`). `ACEPTÓ` escribe en REGISTROS dentro del mismo candado que la fila de
  SEGUIMIENTOS.
- `marcarSesion`: sin cambios de interfaz; la tarjeta que devuelve sigue las reglas de §3.1.
- `armarTablero`, `pendientesRegistro`, `pendientesIndicacion`, `armarPacientes`, `altasVigentes`, `estadoRegistro`:
  las reglas de §3. Cada regla nueva es una función pura en `Logica.gs`, `Registro.gs` o `Tablero.gs`, con su prueba.

### 5.3 Reglas de edición (U8), en `validarEdicionRegistro`

- Campos editables: `FECHA`, `DOCTOR`, `NOMBRE`, `CONTACTO`, `DETALLE`, `MARCA`, `SESIONES`, `FECHA_INICIO`,
  `EXAMENES`, `FECHA_RETORNO`. Cualquier otro campo → error.
- `DNI` no se edita: «Para cambiar el paciente, anule el registro y regístrelo de nuevo.»
- `SESIONES` ≥ sesiones hechas y ≤ `MAX_SESIONES`.
- Un registro anulado no se edita.
- Las mismas validaciones que al guardar (doctor del catálogo, tratamiento y marca, fechas válidas).
- Sin cambios reales → no escribe nada y lo dice.

### 5.4 Lo que no cambia

- Ningún nombre público de la lista de CLAUDE.md cambia ni desaparece.
- Toda escritura pasa por `bloquear_`/`soltar_`, y lo que se devuelve por `limpiarParaEnvio`.
- Las fechas se guardan a mediodía.
- Las filas antiguas (`LO HIZO`, `AGENDÓ CITA` en hierro, altas sin `DECISION`) se leen como hasta hoy.

## 6. Indicadores

- **Motivos de cierre** suma `NO DESEA REALIZARSE`.
- Las altas a 6 meses y 1 año, mientras están en su ventana de espera, cuentan como alta (no como «no volvió»), igual
  que hoy un alta. `NUEVA REEVALUACION` no es alta.
- «No siguieron el tratamiento de hierro» cuenta como «siguió» a quien tiene `ACEPTÓ`.
- El resto de cálculos no cambia en esta etapa.

## 7. Pruebas

- Primero la prueba, después el código (como en la Etapa 1).
- **Lógica**: una prueba por fila de las tablas de §3.1, §3.2 y §3.3, más las de `validarEdicionRegistro` y el
  filtro por mes.
- **Servidor**: `editarRegistro` (candado, BITACORA, sesiones hechas), `registrarResultado` con `ACEPTÓ` sobre registro
  y sobre historial, `darDeAlta` con cada decisión, «Preparar hojas» agrega las columnas y los tres parámetros.
- **Interfaz** (DEMO con las formas reales): las opciones del panel según el tipo, el paso «Aceptó», marcar sesión,
  «Por reevaluar», el selector de mes del Tablero y de Registro, Editar con sus límites, la confirmación en verde.
- La prueba de colores escritos a mano sigue pasando.

## 8. Publicación

1. `git pull`, `npm test`, `npm run test:ui`.
2. `npm run subir`.
3. En el Sheets: «Preparar hojas» (columnas nuevas de REGISTROS y ALTAS, y los tres parámetros) y «Verificar».
4. En el `@HEAD`, con un paciente de prueba: aceptar un hierro, marcar sesiones, un control + laboratorio, una decisión
   de cada tipo, editar y anular un registro, el filtro de mes.
5. `npm run actualizar` en la misma sesión.
6. Avisar al equipo: «Agendó cita» ya no aparece en hierro y procedimiento (ahora es «Aceptó»), el atajo 3 cambia de
   significado en esas tarjetas, y «Dar de alta…» pasa a ser «Decisión del médico…».

## 9. Fuera de alcance

- Cambiar cómo se calculan las cifras de Indicadores más allá de §6.
- Mensajes por WhatsApp.
- Editar sesiones (se anula la última y se vuelve a marcar).
- Editar seguimientos (se anulan, como hoy).
