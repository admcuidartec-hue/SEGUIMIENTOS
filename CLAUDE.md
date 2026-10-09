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
| `src/Registro.gs` | Lógica pura de la pestaña Registro: registros, sesiones y altas |
| `src/RegistroServidor.gs` | Funciones de la pestaña Registro que escriben `REGISTROS`, `SESIONES` y `ALTAS` |
| `src/Menu.gs` | Menú `Seguimientos` del Sheets |
| `src/Index.html` | La app. El bloque `DEMO` del final permite abrirla en el navegador sin desplegar: **no lo elimine** |

## Reglas al modificar

- `npm test` (lógica) y `npm run test:ui` (interfaz) deben pasar antes de subir.
- No cambie los nombres `doGet`, `bootstrap`, `getBandeja`, `getPaciente`, `buscar`,
  `marcarSeguimiento`, `descartar`, `confirmarEmparejamiento`, `getKpi`, `getResumen`, `guardarRegistro`,
  `marcarSesion`, `anularRegistro`, `anularSesion`, `darDeAlta`, `anularAlta`, `getRegistrosHoy`,
  `buscarPacienteRegistro`, `registrarResultado`, `anularResultado`, `getTablero`.
- Paciente = `DNI`, cita = `IDCITA`, indicación = `ID`. **Nunca el número de fila.**
- Las reglas de negocio (plazos, usuarios, motivos, alias de médicos) viven en las hojas
  `REGLAS` y `CATALOGOS`. Cambiar un plazo es editar una celda, no publicar.
- Toda escritura pasa por `LockService`. Todo lo que se devuelve a la app pasa por `limpiarParaEnvio()`.
- Las fechas se guardan **a mediodía**.
- **No escriba colores a mano** fuera de `:root` y `html[data-modo="oscuro"]`.
- **Ningún dato real de pacientes en el repositorio.**
- **Nunca `npm audit fix --force`**: sube clasp a la v3 y rompe los scripts.
- Los procedimientos y tratamientos se registran en la pestaña **Registro** (`REGISTROS`, `SESIONES`) y las
  altas médicas en `ALTAS`, por especialidad. `INDICACIONES` es historial congelado.
- **El Excel de hierro (base `HIERRO_ID`) se dejó de usar en octubre de 2026.** Lo que faltaba se trae una vez con
  el menú «Importar lo que falta de la base de hierro» (`importarLoQueFalta_`): lee HIERRO EV DIARIO (antes HIERRO),
  PROCEDIMIENTOS y HIERRO NUEVO, y agrega al final de `INDICACIONES` solo lo que no está (`indicacionesQueFaltan`,
  por fecha, nombre, tipo y detalle). Repetirlo no duplica. Las que quedan SIN CANDIDATO reciben su DNI a mano en
  Indicadores → «Procedimientos sin paciente» (`asignarDniIndicacion`, solo DNI que ya estén en SOFDOC o Registro).
- El buscador de Pacientes (`buscar` → `buscarEnPacientes`) pide todas las palabras en cualquier orden, o parte del
  DNI, y mira citas, Registro e `INDICACIONES`.
- Una fila de Registro nunca se borra: se anula (`ANULADO` = SÍ + motivo). Solo se anula la última sesión.
- El estado de un registro (cotizado, en curso, completo, anulado) se calcula con `estadoRegistro`; no se guarda.
- `SEGUIMIENTOS` se escribe por posición: una columna nueva solo se agrega al final (`encabezadoAmpliable`).
- Sin conexión a WhatsApp: la app muestra los datos y se marca «Seguimiento hecho».
- La bandeja tiene tres tipos de seguimiento: reevaluación (series `VENCIDO`), hierro y
  procedimiento (cotizado y no hecho, `pendientesIndicacion`). Los de hierro y procedimiento
  se guardan en `SEGUIMIENTOS` con `ESPECIALIDAD` = `HIERRO` o `PROCEDIMIENTO` y no cuentan
  en «volvieron tras el seguimiento». Parámetros en `REGLAS`: `CORTE_INDICACIONES_DIAS` (180)
  y `META_RETORNO_PCT` (60).

## «¿Qué pasó?» (Etapa 1)

- La lista de resultados vive en `RESULTADOS` (`src/Resultados.gs`), no en `CATALOGOS`.
- Cada fila de `SEGUIMIENTOS` lleva `RESULTADO`, y además `ACCION` (`HECHO`, `TELEFONO` o
  `DESCARTADO`), para que las cifras antiguas no cambien.
- Las filas antiguas, sin `RESULTADO`, se leen con `resultadoDe`; no se reescriben.
- Los resultados solo se aceptan sobre tarjetas abiertas (Por contactar, Agendado o En tratamiento): un resultado tardío no reabre un seguimiento ya cerrado; para corregir un cierre, primero se anula.
- Solo «No contestó» cuenta para el cierre automático (`MAX_SEGUIMIENTOS` seguidos, más la espera).
- «Número equivocado» marca el número y no cierra mientras quede otro contacto.
- «Falleció» vale para todo el paciente.
- Las filas anuladas (`ANULADO = SI`) no cuentan en ninguna cifra; `datos_` las filtra.
- Tras publicar, usar «Preparar hojas», que agrega 5 columnas a `SEGUIMIENTOS` y los parámetros que falten en `REGLAS`
  (`GRACIA_AGENDA_DIAS` y `META_DIARIA_SEGUIMIENTOS`), y después «Verificar».

## La interfaz (rediseño de Claude Design, 06/10/2026)

El diseño está en `docs/diseno/handoff-etapa1` (las maquetas mandan en lo visual) y la especificación en
`docs/superpowers/specs/2026-10-06-rediseno-frontend-design.md`. Todo vive en `src/Index.html`.

- **Menú lateral** (en el celular, barra superior y barra inferior): Tablero, Registro, Pacientes e Indicadores,
  más «¿Quién es usted?» y el modo claro u oscuro. Las preferencias se guardan en `seg.usuario`, `seg.modo` y `seg.tipo`.
- **Tablero:** cuatro columnas (Por contactar, Agendado, En tratamiento, Completado) y el panel «¿Qué pasó?» de cada
  tarjeta. La meta del día sale de `META_DIARIA_SEGUIMIENTOS`. Se puede arrastrar una tarjeta a otra columna: abre el
  paso con confirmación, nunca guarda solo.
- **Registro:** indicaciones (procedimientos y tratamientos) y altas médicas, con «Registrados hoy».
- **Pacientes:** buscador y ficha completa, con anulaciones, Editar y «Decisión del médico…» (antes «Dar de alta…»).
- **Indicadores:** siete pestañas para el director y el botón «Resumen para imprimir» (dos páginas A4). Un Ctrl+P sin
  ese botón imprime la pantalla tal como se ve.
- Lo que se dispara con el teclado no se anima, y con «reducir movimiento» del sistema nada se anima.

**Atajos del tablero.** **H** («hecho») y **D** («descartar») ya no existen: se reemplazan por **1 a 3** y **X** (en la Etapa 1 eran 1 a 4; ver «Etapa 2»).

| Tecla | Qué hace |
|---|---|
| ↑ ↓ (o j k) y ← → | Moverse entre tarjetas y columnas |
| Enter | Abrir el panel de la tarjeta |
| 1 a 3 | «¿Qué pasó?»: 1 = No contestó, 2 = Lo pensará, 3 = Agendó cita (reevaluación, Control y Por reevaluar) o Aceptó (hierro y procedimiento). El 4 ya no hace nada. El 1 guarda sin abrir el panel. En una tarjeta En tratamiento, el 1 es «Marcar sesión k hecha» |
| X | Cerrar el seguimiento (abre las opciones de cierre; nada se cierra sin confirmar) |
| C | Copiar el teléfono |
| / | Ir al buscador |
| Esc | Cerrar el paso y luego el panel; salir de un campo |

En un paso con fecha o motivo, Enter confirma.

## Etapa 2 (09/10/2026): tratamientos y decisiones del médico

- **Columnas nuevas, siempre al final** (`encabezadoAmpliable`; ninguna fila existente se reescribe). `REGISTROS`:
  `FECHA_INICIO` (primera sesión programada), `EXAMENES` (de un control), `FECHA_RETORNO` (de un control) y `EDITADO`
  (fecha y hora de la última edición). `ALTAS`: `DECISION` y `FECHA_RETORNO`. Las altas antiguas, sin `DECISION`, se leen como `ALTA`.
- **Parámetros nuevos de `REGLAS`:** `DIAS_POST_TRATAMIENTO` = 30 (días desde la última sesión hasta «Por reevaluar»),
  `DIAS_CONTROL_LAB` = 15 (fecha de retorno que propone Control + laboratorio) y `AVISO_ALTA_CONTROL_DIAS` = 30 (cuántos días antes
  del control vuelve el paciente a «Por contactar»). «Preparar hojas» los agrega si faltan.
- **«Agendó cita» es solo de reevaluación** (y de Control y Por reevaluar). En hierro y procedimiento por empezar el botón es
  **«Aceptó tratamiento» / «Aceptó procedimiento»**, que programa la `FECHA_INICIO` (o crea el registro si venía del historial); por eso
  el atajo **3** cambia de significado. «Aceptó» no tiene «Deshacer»: el aviso dice que, para cambiar la fecha o volver atrás, se edite o se anule el registro.
- **«Lo hizo» ya no se ofrece** en «¿Qué pasó?»: lo reemplazan «Marcar sesión k hecha» y «Anular la última» en las tarjetas En tratamiento.
  Las filas antiguas con `LO HIZO` se leen igual (`resultadoDe`) y no se reescriben.
- **Recorrido de un tratamiento:** Pendiente (cotizado) → Programado (`FECHA_INICIO`, en Agendado hasta `GRACIA_AGENDA_DIAS` después de esa
  fecha; pasado ese plazo, «No vino») → En tratamiento (con la primera sesión) → Completado → Por reevaluar a los 30 días de la última
  sesión (el estado se calcula con `estadoRegistro`, no se guarda). Un Control (Registro → Control + laboratorio) hace el mismo
  papel con su `FECHA_RETORNO`: en Agendado hasta pasada la gracia, luego «Control vencido»; la consulta realizada lo completa.
- **Registro tiene tres pestañas:** Indicación, Control + laboratorio y Decisión del médico. «Registrados» se ve por periodo (hoy o cada
  uno de los últimos 6 meses, `getRegistros`) y trae Anular y **Editar**.
- **Las cuatro decisiones del médico** (`ALTAS.DECISION`, `DECISIONES` en `Registro.gs`): `ALTA` (definitiva); `ALTA 6 MESES` y
  `ALTA 1 AÑO` (la fecha de retorno se calcula: fecha del alta + 6 o 12 meses; el paciente sigue de alta y vuelve a «Por contactar»
  `AVISO_ALTA_CONTROL_DIAS` días antes); `NUEVA REEVALUACION` (el médico da la fecha de retorno, de mañana a dos años; no deja el alta vigente).
  Una alta a 6 meses o 1 año sin fecha de retorno se trata como alta simple. Se registran en Registro → Decisión del médico o en la ficha
  («Decisión del médico…»); el mensaje sin doctor dice «Elija el doctor.» solo en la nueva reevaluación.
- **Editar** (`editarRegistro`, validada por `validarEdicionRegistro`): se puede cambiar fecha, doctor, nombre, contacto, tratamiento o
  procedimiento (`DETALLE`), marca, sesiones, `FECHA_INICIO` (solo si no empezó), y `EXAMENES` y `FECHA_RETORNO` de un control.
  **No** se puede cambiar el DNI (se anula y se registra de nuevo), ni las sesiones por debajo de las ya hechas, ni el tipo; un control no tiene
  detalle ni sesiones. Solo viaja lo que cambió. Cada cambio escribe una línea en `BITACORA` (`EDITAR REGISTRO`, con el valor anterior y el nuevo) y
  sella `EDITADO`. Las decisiones del médico no se editan: se anulan.
- **Tablero:** filtro por mes (`#fmes`, se recuerda en `seg.mes`) además del de tipo, médico y especialidad.
- **Publicar la Etapa 2:** «Preparar hojas» **antes** de usar las pantallas nuevas, y luego «Verificar»: sin las columnas nuevas,
  `guardarRegistro`, `editarRegistro` y `darDeAlta` se niegan a escribir (`REGISTROS` y `ALTAS` se escriben por posición). Después,
  probar en el `@HEAD` solo con un paciente de prueba, y avisar a las asesoras de que el atajo 3 ahora es «Aceptó».

## Publicar

En producción desde el 02/10/2026. Versión 3 (03/10/2026): interfaz editorial de Claude Design, en `docs/diseno/handoff-2a`.
El rediseño del 06/10/2026 (`docs/diseno/handoff-etapa1`) se publica todo junto, con estos pasos (especificación §6):

```bash
git pull                 # siempre primero
npm test && npm run test:ui
npm run subir            # solo cambia @HEAD, el banco de pruebas
# en el Sheets: menú Seguimientos → «Preparar hojas»
#   (agrega META_DIARIA_SEGUIMIENTOS a REGLAS, 15 por omisión, y las columnas que falten en SEGUIMIENTOS)
# luego «Verificar»: debe decir «SEGUIMIENTOS tiene todas sus columnas»
#   y en REGLAS, MAX_SEGUIMIENTOS debe valer 2 (si la celda falta, el código usa 3)
# en el @HEAD, probar: un resultado de cada tipo, «Deshacer», un registro y un alta,
#   una impresión del resumen, el celular y el modo oscuro
#   (solo sobre un paciente de prueba: ver «Probar en @HEAD escribe en el libro real», abajo)
npm run actualizar       # publica para el equipo conservando la URL, EN LA MISMA SESIÓN que las pruebas
# pedir a las asesoras que recarguen la app (las pestañas abiertas siguen con la versión vieja)
# y avisarles que H y D se reemplazan por 1 a 4 y X
```

Ese orden importa: hasta que «Preparar hojas» agrega las 5 columnas, `registrarResultado` y `anularResultado` se niegan a escribir (SEGUIMIENTOS se escribe por posición).
«Verificar» no muestra `MAX_SEGUIMIENTOS`: hay que mirarlo en la hoja `REGLAS`.

**Probar en @HEAD escribe en el libro real**, el mismo que lee la versión en producción (v3) que usa el equipo.
La v3 solo mira `ACCION` en SEGUIMIENTOS y no conoce la columna `ANULADO`: para ella, una fila deshecha o anulada
sigue viva. Un «No contestó», «Lo pensará» o «Agendó» de prueba saca al paciente de la bandeja del equipo durante
la espera, y un cierre lo deja como descartado, aunque después se pulse «Deshacer». Por eso:

- Pruebe los resultados sobre un **paciente de prueba** (un DNI de prueba, por ejemplo el registro de alguien del
  personal que lo autorice), nunca sobre pacientes reales que alguien vaya a llamar.
- **No pruebe «Falleció» ni los demás cierres** (alta, se atiende en otro lugar, no desea continuar) sobre pacientes reales.
- Ejecute `npm run actualizar` **en la misma sesión**, justo después de las pruebas. Si algo sale mal y la publicación
  se pospone, la v3 seguirá contando lo probado (anularlo no le basta) hasta que se publique: otra razón para usar
  solo el paciente de prueba.

- Script (incrustado en el libro madre): `10jN1KMUrKYWTAQNrh68hMlBrA6s5Hvc-YI06n1rHaZV9gDIT99hjdZZY`
- Deployment estable (el que usa el equipo): `AKfycbzSvnyttpl1VOiKNDilyPPoqlD7VkxPDxwExa4kS75mgbgTfRbe16kJj6fpfGoBUWCkcA`
  - URL: https://script.google.com/macros/s/AKfycbzSvnyttpl1VOiKNDilyPPoqlD7VkxPDxwExa4kS75mgbgTfRbe16kJj6fpfGoBUWCkcA/exec
- `@HEAD` (`AKfycbx9-YbDPycofyq2BSq3n9KtKZ_GdbHrtYnPgtOkCnE1`) sirve el último código subido y nadie del equipo lo tiene: úselo antes de publicar.
  - URL: https://script.google.com/macros/s/AKfycbx9-YbDPycofyq2BSq3n9KtKZ_GdbHrtYnPgtOkCnE1/dev
- **Nunca `clasp deploy` sin `--deploymentId`**: crea una URL nueva y la del equipo deja de actualizarse.

Para volver a una versión anterior:

```bash
npx clasp deploy --deploymentId AKfycbzSvnyttpl1VOiKNDilyPPoqlD7VkxPDxwExa4kS75mgbgTfRbe16kJj6fpfGoBUWCkcA --versionNumber <N> --description "vuelta a vN"
```
