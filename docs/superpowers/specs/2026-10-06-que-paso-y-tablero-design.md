# Etapa 1: «¿Qué pasó?» y el tablero de cuatro columnas · Diseño

- Fecha: 06/10/2026
- Estado: **aprobado** («sí a las tres, sigue con el plan», 06/10/2026)
- Amplía:
  - `2026-10-03-filtro-tipos-y-resumen-3a-design.md`
  - `2026-10-05-pestana-registro-design.md`
- Acompaña al encargo visual `docs/diseno/brief-rediseno-2026-10.md`, §3 y §4.1 a §4.2.

## 1. Para qué

Hoy la asesora solo puede marcar **Seguimiento hecho** o **Descartar**. No queda registrado qué
pasó en la llamada, y por eso:

- **No se distingue** un paciente que no contestó de uno que dijo «lo voy a pensar».
- **Un paciente que agendó** sigue en la lista hasta que SOFDOC trae su cita.
- **Un número equivocado** cierra el seguimiento aunque el paciente tenga otro teléfono.
- **Un paciente fallecido** sigue apareciendo en las otras especialidades y en el hierro.

La Etapa 1 cambia dos cosas:

1. **La pregunta «¿Qué pasó?».** Reemplaza a los dos botones con nueve resultados.
2. **El tablero.** Una pantalla principal con cuatro columnas que muestra dónde está cada paciente.

**Lo que esta especificación NO decide:** el aspecto. El aspecto lo propone Claude Design con el
brief, y se aplica sobre la lógica que se define aquí. Mientras tanto, la Etapa 1 se puede
construir y probar con la maqueta del estilo A.

## 2. Decisiones

| Tema | Decisión |
|---|---|
| Dónde se guarda el resultado | En `SEGUIMIENTOS`, con columnas nuevas al final. **No se crea otra hoja** |
| Lista de resultados | **Fija en el código**, porque cada uno hace algo distinto. `MOTIVOS_DESCARTE` deja de alimentar el panel |
| Compatibilidad | Las filas antiguas (`HECHO` y `DESCARTADO` sin resultado) se leen como antes. Las cifras de Indicadores no cambian |
| Intentos | Solo **No contestó** cuenta para el cierre automático. Al 2.º seguido (`MAX_SEGUIMIENTOS`), y pasada la espera, se cierra solo |
| Número equivocado | Se marca **ese teléfono** para el paciente en todas sus listas. Se cierra solo si no le queda ningún contacto |
| Falleció | Vale para **el paciente entero**: sale de todas las listas, y Registro avisa si se le intenta registrar algo |
| Se atiende en otro lugar | Cierra **solo ese seguimiento** (esa especialidad o ese tratamiento) |
| Alta médica | En una reevaluación, usa el «Dar de alta» que ya existe (hoja `ALTAS`). En hierro o procedimiento, cierra con motivo «ALTA MÉDICA» |
| Deshacer | Cada resultado se puede anular: al instante, con el aviso «Deshacer», o después, desde la historia, con motivo. **Ninguna fila se borra** |
| Cotización en sus 7 días de espera | **No aparece en el tablero**; se ve en Registro y en la ficha, como hoy |
| Sesión atrasada | Pasa a **Por contactar** con la etiqueta en rojo «Sesión 2 de 3 · atrasada N días». Cambia la maqueta, donde la tarjeta roja seguía en «En tratamiento» |
| Esperando reintento tras «No contestó» | Va a **Agendado** con «Reintentar el dd/mm» |

## 3. Datos

### 3.1 `SEGUIMIENTOS`: columnas nuevas

Se agregan al final, después de `REFERENCIA`. `Preparar hojas` las crea con
`encabezadoAmpliable`, igual que se hizo con `REFERENCIA`.

| Columna | Qué guarda |
|---|---|
| `RESULTADO` | Uno de los valores de §3.2. Vacío en las filas antiguas |
| `FECHA_PROXIMA` | Fecha de la cita (Agendó cita) o de volver a llamar (Lo pensará). Se guarda a mediodía |
| `TELEFONO` | El número marcado como equivocado (9 dígitos normalizados) |
| `ANULADO` | `SÍ` si se deshizo |
| `MOTIVO_ANULACION` | Obligatorio al anular desde la historia; «Deshecho al momento» desde el aviso |

`FECHA_PROXIMA` entra en `COLUMNAS_FECHA`.

**Toda la lógica ignora las filas con `ANULADO = SÍ`.** Se filtran una sola vez, en
`leerSeguimientos_`, para que ninguna función se olvide.

### 3.2 Resultados

`ACCION` se sigue escribiendo, para que `kpiRecuperacion`, `kpiMotivos` y las cifras actuales
no cambien.

| `RESULTADO` | Grupo | `ACCION` | `MOTIVO` | Pide | Tipos |
|---|---|---|---|---|---|
| `NO CONTESTÓ` | Sigue | `HECHO` | | | Todos |
| `LO PENSARÁ` | Sigue | `HECHO` | | Fecha para volver a llamar: de mañana a 90 días | Todos |
| `AGENDÓ CITA` | Sigue | `HECHO` | | Fecha de la cita: de hoy a 180 días | Todos |
| `LO HIZO` | Sigue | `HECHO` | | Fecha de la sesión: no futura | Hierro y procedimiento |
| `ALTA MÉDICA` | Cierra | `DESCARTADO` | `ALTA MÉDICA` | Doctor y fecha | Hierro y procedimiento |
| `NÚMERO EQUIVOCADO` | Cierra o sigue | `TELEFONO` o `DESCARTADO` | `NÚMERO EQUIVOCADO` | Cuál teléfono | Todos |
| `SE ATIENDE EN OTRO LUGAR` | Cierra | `DESCARTADO` | el mismo | | Todos |
| `FALLECIÓ` | Cierra | `DESCARTADO` | `FALLECIÓ` | | Todos |
| `NO DESEA CONTINUAR` | Cierra | `DESCARTADO` | el texto escrito | Motivo, obligatorio | Todos |

**Alta médica en una reevaluación.** No escribe en `SEGUIMIENTOS`: llama a `darDeAlta`, que ya
guarda en `ALTAS` y ya tiene sus reglas.

**«Lo hizo» en un registro de la pestaña Registro.** Llama a `marcarSesion`, que ya existe.

**«Lo hizo» en una cotización antigua** (de `INDICACIONES`, sin registro). Escribe
`RESULTADO = LO HIZO` y la fila sale de la lista como completada. No se sabe cuántas sesiones
hizo, y no se inventa.

**Número equivocado.** `ACCION = TELEFONO` cuando al paciente le queda otro contacto: no cuenta
como intento ni como descarte. Cuando no le queda ninguno, `ACCION = DESCARTADO`. El servidor
decide cuál de los dos, dentro del bloqueo.

### 3.3 Cómo se leen las filas antiguas

| Fila antigua | Se lee como |
|---|---|
| `HECHO` sin resultado | `NO CONTESTÓ`: cuenta como intento, igual que hoy |
| `DESCARTADO`, motivo `FALLECIÓ` | `FALLECIÓ`, y por lo tanto vale para todo el paciente |
| `DESCARTADO`, motivo `ALTA MÉDICA` | Lo que ya hace `altasVigentes` |
| `DESCARTADO`, cualquier otro motivo | Cierre de ese seguimiento, como hoy |

`Verificar` informa cuántas filas antiguas hay de cada clase. **No se reescribe ninguna.**

## 4. Lógica (funciones puras en `Logica.gs` o un `Tablero.gs` nuevo)

### 4.1 `resultadoDe(s)`

Devuelve el resultado efectivo de una fila de `SEGUIMIENTOS`: su `RESULTADO`, o la lectura de
§3.3 si es antigua.

Todo lo demás usa esta función, nunca `ACCION` directamente.

### 4.2 Teléfonos

`telefonosPorDni(indicaciones, contactos, seguimientos)` gana un tercer argumento.

- **Quita** los números marcados como `NÚMERO EQUIVOCADO` para ese DNI.
- **Un número marcado vuelve** si llega de nuevo por un registro con fecha posterior a la marca:
  alguien lo confirmó.
- **Además devuelve** la lista de los quitados, para que la ficha los muestre tachados.

**Sin contacto.** Un paciente queda sin contacto si no le quedan teléfonos **y** no tiene
usuario (`@...`).

### 4.3 Fallecidos

`fallecidos(seguimientos)` devuelve los DNI con un `FALLECIÓ` vigente.

`armarPacientes`, `pendientesIndicacion` y `pendientesRegistro` ponen
`ESTADO = 'FALLECIDO'` a todas las filas de esos DNI. Esas filas no entran en ninguna columna.

### 4.4 Estado de un seguimiento con los resultados nuevos

Se amplían las tres funciones de estado:

- `estadoDeSerie`;
- `pendientesIndicacion`;
- `pendientesRegistro`.

Solo cuentan los seguimientos del ciclo actual: después de la última consulta, de la
cotización o de la última sesión, como hoy. **Gana la primera regla que se cumple.**

1. **`FALLECIDO`**: el DNI está en `fallecidos`.
2. **`ALTA`**: solo en reevaluación, como hoy.
3. **`CERRADO`**, con su motivo:
   - el último resultado es de cierre (`DESCARTADO`); o
   - el paciente se quedó **sin contacto**.

   Reemplaza a `DESCARTADO`. El motivo va en un campo nuevo, `CIERRE`.
4. **`CERRADO` con motivo «SIN RESPUESTA»**: los últimos `MAX_SEGUIMIENTOS` resultados son
   `NO CONTESTÓ` seguidos, y ya pasó la espera desde el último.
   - Un «Lo pensará» o un «Agendó cita» en medio **reinicia la cuenta**: el paciente sí contestó.
5. **`COMPLETADO`**: «Lo hizo» en una cotización antigua, o un registro `COMPLETO`.
6. **`EN TRATAMIENTO`**: registro `EN CURSO` sin atraso. El atraso empieza cuando
   `hoy > última sesión + DIAS_ENTRE_SESIONES`.
7. **`AGENDADO`**, con su `FECHA_PROXIMA`:
   - **SOFDOC tiene una cita futura.** Solo en reevaluación, y gana sobre lo que haya dicho
     la asesora.
   - **El último resultado es «Agendó cita»** y `hoy ≤ FECHA_PROXIMA + GRACIA_AGENDA_DIAS`.
     - La gracia (2 días por omisión, parámetro nuevo en `REGLAS`) cubre el día que tarda en
       llegar la actualización de SOFDOC.
     - En una reevaluación, una consulta realizada después del resultado ya cambió el ciclo
       (lleva a `RECUPERADO` o `AL DÍA`), así que esta regla no llega a mirarse.
   - **El último resultado es «Lo pensará»** y `hoy < FECHA_PROXIMA`.
   - **El último resultado es «No contestó»**, y ha pasado menos tiempo que la espera desde
     él. Aquí `FECHA_PROXIMA` es la fecha del resultado más la espera. Se muestra como
     «Reintentar el dd/mm».
8. **Lo de hoy, sin cambios:**
   - para reevaluación: `RECUPERADO`, `AL DÍA`, `POR VENCER`, `VENCIDO` y `ANTIGUO`;
   - para hierro y procedimiento: `EN ESPERA`, `PENDIENTE` y `ANTIGUO`.

   El estado `CONTACTADO` desaparece: lo absorbe la regla 7.

**`N_SEGUIMIENTOS`.** Pasa a contar los resultados del grupo «Sigue» del ciclo. **«Nunca
recibió un seguimiento»** sigue siendo `N_SEGUIMIENTOS = 0`.

### 4.5 `columnaDe(fila, hoy, mes)` y `armarTablero(d)`

**Columna de cada fila:**

| Columna | Qué filas entran |
|---|---|
| `POR_CONTACTAR` | Reevaluación `VENCIDO`; hierro o procedimiento `PENDIENTE`, incluido un registro en curso atrasado |
| `AGENDADO` | `AGENDADO` |
| `EN_TRATAMIENTO` | `EN TRATAMIENTO` |
| `COMPLETADO` | Ver abajo |
| ninguna | Todo lo demás: `AL DÍA`, `POR VENCER`, `ANTIGUO`, `EN ESPERA`, `CERRADO` y `FALLECIDO` |

**Qué entra en `COMPLETADO`.** Solo lo de este mes, y solo si pasó por seguimiento o por el
registro:

- reevaluación que **volvió** este mes después de un seguimiento: el retorno de
  `kpiRecuperacion`;
- un registro `COMPLETO` cuya última sesión fue este mes;
- «Lo hizo» de este mes en una cotización antigua;
- un alta vigente con fecha de este mes.

**Qué devuelve `armarTablero(d)`:**

```
{
  columnas: { POR_CONTACTAR: [...], AGENDADO: [...], EN_TRATAMIENTO: [...], COMPLETADO: [...] },
  cifras: { porContactar, agendados, enTratamiento, completadosMes, cerradosMes, hechosHoy }
}
```

**Campos de cada tarjeta:**

- los campos que ya tiene hoy en la bandeja;
- `CLAVE`: `ID_REGISTRO` o `DNI|ESPECIALIDAD`, la misma que usa la bandeja hoy;
- `COLUMNA`;
- `ETIQUETA`: el texto corto de la tarjeta, ver §5.2;
- `FECHA_CLAVE`: la fecha por la que se ordena la columna;
- `ATRASO`: días de atraso de una sesión; 0 si no hay;
- `SIN_CONTACTO`;
- `TELEFONOS_DESCARTADOS`.

**Orden dentro de cada columna:**

| Columna | Orden |
|---|---|
| `POR_CONTACTAR` | El de `ordenarBandeja`, que no cambia: menos intentos, con algo pendiente, menos días. Grupos: «Recientes (30 días o menos)», «Hace 1 a 2 meses», «Más antiguos» |
| `AGENDADO` | Fecha más cercana primero. Grupos: «Esta semana», «Más adelante» |
| `EN_TRATAMIENTO` | Próxima sesión más cercana primero |
| `COMPLETADO` | Lo más reciente primero |

**`cerradosMes`.** Cuenta los cierres del mes que no son éxitos: no desea continuar, otro
lugar, número equivocado, sin respuesta y falleció. Se muestra como enlace bajo la columna
Completado: «N cerrados este mes». Al pulsarlo se abre la lista; no es una quinta columna.

### 4.6 `validarResultado(p, d)`

Revisa:

- el usuario;
- que la tarjeta exista: la misma regla que hoy, con `referencia`;
- que el resultado esté en la tabla de §3.2 y corresponda al tipo de seguimiento;
- las fechas, en sus rangos;
- el teléfono, que debe estar entre los del paciente;
- el motivo, obligatorio en «No desea continuar».

**Mensajes** en español, en el estilo de los de hoy («Elija…», «Falta…»).

## 5. Servidor e interfaz

### 5.1 Funciones nuevas en `Codigo.gs`

| Función | Qué hace |
|---|---|
| `getTablero()` | `armarTablero(datos_())`, pasado por `limpiarParaEnvio` |
| `registrarResultado(p)` | Valida, toma el bloqueo, **vuelve a validar dentro**, escribe la fila y la bitácora, y termina con `soltar_(lock)`. Devuelve `{ ok, seguimiento, tarjeta }`: la tarjeta recalculada, para que la app confirme el movimiento |
| `anularResultado(p)` | `{ usuario, id, motivo }`. Solo filas `SEG-`. Anular un `FALLECIÓ` devuelve al paciente a todas sus listas |

**Lo que no cambia de nombre:**

- `marcarSeguimiento` y `descartar` siguen vivas, como envoltorios de `registrarResultado`
  (No contestó, y cierre con motivo), hasta que la app nueva esté publicada;
- `darDeAlta` y `marcarSesion`.

**Un arreglo de paso.** `registrar_` hoy suelta el bloqueo con `releaseLock()` sin `flush`. Se
cambia a `soltar_`.

### 5.2 Etiquetas de las tarjetas

Todas se arman en el servidor, para que la app y las pruebas digan lo mismo.

| Situación | Etiqueta |
|---|---|
| Reevaluación por contactar | «Debía volver el 09/09 · hace 27 días» |
| Hierro o procedimiento por contactar | «Cotizó hace 16 días» |
| Sesión atrasada | «Sesión 2 de 3 · atrasada 3 días», en rojo |
| Agendó, o tiene cita en SOFDOC | «Cita el jue 08/10» |
| Lo pensará | «Llamar el lun 12/10» |
| No contestó, esperando reintento | «Reintentar el 21/10 · intento 1 de 2» |
| En tratamiento | «Sesión 2 de 3 · próxima ~09/10» |
| Completado | «Volvió el 02/10», «Completó el tratamiento», «Alta médica · Dr. …» |

### 5.3 Panel «¿Qué pasó?»

Lo que la interfaz tiene que **hacer**. Cómo se ve lo decide el diseño.

1. **Los grupos «Sigue en seguimiento» y «Cierra el seguimiento»**, con los resultados de §3.2
   que corresponden al tipo. «Lo hizo» solo aparece en hierro y procedimiento.
2. **Resultados con un dato.** Al elegir uno que pide un dato (fecha, doctor, teléfono,
   motivo), aparece **un solo paso** con ese dato y el botón Guardar. Cada fecha propone un
   valor:
   - mañana para «Lo pensará»;
   - hoy para «Lo hizo»;
   - la fecha de la cita en SOFDOC, si la hay.
3. **Confirmación de un cierre**, en el mismo panel y nunca con un `confirm()` del navegador:
   - «¿Cerrar el seguimiento de Rosa Quispe en Hematología? Motivo: se atiende en otro lugar.»
   - **Falleció** dice además: «Se cerrarán todos sus seguimientos».
4. **Número equivocado:**
   - con un solo teléfono, ese queda elegido;
   - con varios, se elige cuál;
   - la confirmación dice si el seguimiento sigue («Le queda el 987…») o se cierra.
5. **Al guardar:**
   - la tarjeta **se mueve en el acto** a su columna nueva, con la regla de §4.4 aplicada en
     el navegador y el movimiento animado;
   - aparece el aviso «Guardado · Deshacer» durante 8 segundos;
   - cuando llega la respuesta, la app la compara con `tarjeta`;
   - si el servidor la puso en otra columna, la mueve ahí;
   - si hubo error, **la devuelve** a donde estaba y muestra el mensaje.
6. **La historia del paciente** une seguimientos, sesiones y altas en una línea de tiempo:
   - una entrada se ve así: «04/10 Rachel: agendó para el 12/10»;
   - las anuladas aparecen tachadas, con su motivo;
   - **la última entrada** tiene «Anular».
7. **Atajos de teclado.** Se mantienen ↑ ↓, Enter y C (copiar teléfono). H y D se reemplazan por:

   | Tecla | Resultado |
   |---|---|
   | 1 | No contestó |
   | 2 | Lo pensará |
   | 3 | Agendó cita |
   | 4 | Lo hizo |
   | X | Abre el grupo de cierre |

   **Ninguna tecla guarda sola un cierre.**

### 5.4 Registro

**Paciente fallecido.** `buscarPacienteRegistro` devuelve `FALLECIDO: true`. El formulario
avisa: «Este paciente figura como fallecido el dd/mm (Magaly)». No bloquea, porque puede ser un
error: se anula desde la ficha.

## 6. Pruebas (antes del código, como siempre)

**Lógica, en Node:**

- **`resultadoDe`** con filas nuevas, antiguas y anuladas.
- **Cierre automático:**
  - dos «No contestó» seguidos, antes y después de la espera;
  - con un «Lo pensará» en medio, que reinicia la cuenta.
- **Agendado:**
  - con la gracia, el día antes y el día después;
  - la cita de SOFDOC gana;
  - una consulta realizada después del «Agendó» lleva a `RECUPERADO`.
- **Número equivocado:**
  - con otro teléfono, sigue;
  - con un usuario `@`, sigue;
  - sin nada, se cierra;
  - un número marcado que vuelve por un registro posterior.
- **Falleció:**
  - el paciente sale de reevaluaciones, hierro y registros;
  - una fila antigua con motivo FALLECIÓ también lo saca;
  - al anularlo, vuelve.
- **«Lo hizo»:**
  - en una cotización antigua lleva a `COMPLETADO`;
  - en un registro llama a la sesión.
- **Columnas:** cada estado va a su columna; Completado es solo del mes.
- **Orden y grupos** de cada columna.
- **Cifras:** `cerradosMes` no cuenta los éxitos.
- **Indicadores sin cambios:** `kpiRecuperacion` y `kpiMotivos` dan lo mismo con filas
  antiguas que antes.
- **`validarResultado`:** cada error tiene su mensaje.

**Servidor, con dobles de las hojas:**

- `registrarResultado` vuelve a validar dentro del bloqueo;
- número equivocado decide `TELEFONO` o `DESCARTADO` dentro del bloqueo;
- `anularResultado` rechaza ids que no son `SEG-`;
- todo termina con `soltar_`.

**Interfaz, en modo DEMO:**

- elegir cada resultado mueve la tarjeta a su columna;
- Deshacer la devuelve;
- un error la devuelve;
- la confirmación de cierre;
- los atajos 1 a 4 y X.

## 7. Orden de trabajo

1. Columnas nuevas, lectura de filas antiguas, `resultadoDe` y teléfonos.
2. Estados y fallecidos.
3. `columnaDe`, `armarTablero`, etiquetas.
4. Servidor: `registrarResultado`, `anularResultado` y `getTablero`.
5. Interfaz:
   - el panel «¿Qué pasó?» sobre la bandeja actual, para poder publicarlo pronto;
   - después, el tablero con el diseño que llegue de Claude Design.

Los pasos 1 a 4 no cambian nada visible y se pueden publicar solos. Los envoltorios de §5.1
mantienen funcionando la app actual.

## 8. Fuera de alcance

- **El aspecto visual.** Llega de Claude Design.
- **Registro, Pacientes e Indicadores.** Su rediseño es de la Etapa 2.
- **Cómo cuentan en Indicadores los fallecidos y los cierres nuevos.** Es de la Etapa 2; hasta
  entonces, las cifras se calculan como hoy.
- **Mensajes por WhatsApp desde la app.**
- **Plazos que dependan del diagnóstico.**

## 9. Respuestas y precisiones

**Respuestas del 06/10/2026.** Se aprobaron las tres propuestas:
- «Se atiende en otro lugar» cierra solo ese seguimiento.
- Tras «No contestó», la tarjeta espera en Agendado.
- La sesión atrasada pasa a Por contactar.

**Precisiones que salieron al escribir el plan:**

1. **«No desea continuar»** guarda `MOTIVO = NO DESEA CONTINUAR` y el texto escrito en `NOTA`
   («Motivo: …»). Así «Motivos de descarte» en Indicadores no se parte en un renglón por cada
   texto distinto.
2. **Alta médica en hierro o procedimiento** pide solo el doctor, que se guarda en `NOTA`
   («Alta: Dra. …»). La fecha es la del registro.
3. **Una reevaluación `AGENDADO` entra al tablero solo si tuvo seguimiento en el ciclo**
   (`N_SEGUIMIENTOS > 0`). Sin esta regla, todos los pacientes con una cita futura en SOFDOC
   llenarían la columna.
4. **«Sin contacto»** solo cierra cuando hay al menos un número marcado como equivocado. Un
   paciente que nunca tuvo teléfono sigue en Por contactar, como hoy, con «Sin teléfono».
5. **Los registros completos** dejan de desaparecer de `pendientesRegistro`: vuelven con
   `ESTADO = COMPLETADO`, para la columna Completado.
6. **El plan cubre los pasos 1 a 5a de §7.** El tablero visual (5b) tendrá su propio plan
   cuando llegue el diseño de Claude Design. `getTablero` queda listo y probado desde ahora.

**Pendiente del doctor:**
- qué significan los 45 días de la pregunta 1;
- los 15 días del hierro (pregunta 9a).

No bloquean esta etapa: son parámetros de `REGLAS`.
