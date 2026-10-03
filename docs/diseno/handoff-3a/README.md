# Handoff: Seguimientos CHP — Bandeja «Editorial + panel» (2a) y Resumen (3a)

## Resumen
Rediseño de la **Bandeja del día** de la app Seguimientos del Centro Hematológico del Perú. Es la lista diaria de trabajo de las asesoras (Magaly, Ana, Rachel). En ella ven a quién escribir, copian su teléfono y marcan «Seguimiento hecho» o «Descartar». El estilo es editorial: no hay tarjetas ni sombras. El orden se logra con tipografía grande, aire y líneas finas. Al hacer clic en una fila se abre un **panel lateral** con el detalle del paciente.

Como pantalla compañera para celular va el **Resumen editorial del Dr. Eli** (propuesta 1b, marco de celular en modo oscuro). Úsalo como guía de estilo para el Resumen.

El contexto completo del producto, el glosario, los estados y las restricciones están en `brief-interfaz.md`. **Léelo primero.**

## Sobre los archivos de diseño
`referencia/Seguimientos Propuestas.dc.html` es un **prototipo de referencia hecho en HTML**. Muestra el aspecto y el comportamiento buscados, pero **no es código para copiar tal cual**. El archivo contiene todas las propuestas; la que se implementa es la sección **2a** (arriba del todo). Para verlo, abre el archivo en un navegador desde la carpeta `referencia/` (necesita `support.js` al lado).

La tarea es **recrear este diseño en el código existente**: un único `Index.html` servido por Google Apps Script (HtmlService), con CSS y JS simples dentro del mismo archivo y sin framework. El brief (§8) lo explica.

## Fidelidad
**Alta fidelidad.** Los colores, la tipografía, los tamaños y las interacciones son los definitivos. Hay que reproducirlos con precisión. Los datos son de ejemplo (todos inventados).

---

## Pantalla: Bandeja del día (computadora, ≥1024 px)

### Estructura general
- Fondo de página `--chp-bg` (#FAF6F1, hueso). **Sin tarjetas, bordes de caja ni sombras.**
- Contenedor a pantalla completa, con relleno de 32 px arriba y 64 px a la izquierda.
- **Barra superior** (una fila, `align-items: baseline`, separación de 40 px entre bloques):
  - Marca: «Seguimientos» en Barlow Condensed 24/700, color `--chp-brand` (#6F1713). Al lado, «CENTRO HEMATOLÓGICO DEL PERÚ» en 12 px, espaciado de letras .08em, color `--chp-muted` (#7A6460).
  - Navegación en texto, 15 px, separación de 28 px: Resumen · **Bandeja** · Buscar paciente · Detalle. La sección activa va en 600, color `--chp-brand`, con un subrayado `border-bottom: 2px solid` y `padding-bottom: 4px`. Las demás van en #5A4440.
  - A la derecha: «¿Quién es usted?» (14 px, muted) y un `<select>` sin caja, con línea inferior de 1 px `--chp-ink` y texto en 600 15 px.
- **Cuerpo**: `display:flex`, con **lista** (flex:1, padding-right de 40 px) y **panel** (460 px, solo cuando hay un paciente abierto).

### Columna de lista
1. **Encabezado** (margin-top de 36 px, flex con espacio entre bloques, alineado abajo):
   - «Bandeja del día»: Barlow Condensed 68/600, interlineado .9.
   - Debajo, la fecha «Jueves 01/10/2026»: 16 px, muted, 10 px arriba.
   - A la derecha, **3 contadores** separados 40 px. Cada uno lleva el número en Barlow Condensed 64/600 (interlineado .85) y la etiqueta en 13 px #5A4440:
     - «por atender», color `--chp-accent` (#A8352C)
     - «hechos hoy», color `--chp-ink`
     - «recuperados», color `--chp-good` (#2F6B45)
2. **Barra de filtros** (margin-top de 28 px, padding-bottom de 12 px, **`border-bottom: 1px solid --chp-ink`**, 14 px, separación de 24 px):
   - «Especialidad [Todas ▾]» y «Médico [Todos ▾]»: etiqueta muted y `<select>` transparente sin borde, en 600.
   - Casilla «Solo sin teléfono» (`accent-color: --chp-brand`).
   - A la derecha, la leyenda de atajos: «↑ ↓ · **Enter** abrir · **C** copiar · **H** hecho · **D** descartar» (muted, teclas en negrita ink).
3. **Lista** (con scroll vertical, `overflow-x:hidden`), agrupada por urgencia:
   - **Encabezado de grupo**: padding de 24 px arriba y 8 px abajo, `border-bottom: 1px solid --chp-rule` (#E3D8CF). El título va en Barlow Condensed 22/700, mayúsculas, espaciado .04em, color `--chp-brand`. El subtítulo, en 14 px muted: «{rango} · N pacientes».
     - **Esta semana**: «debían volver hace 7 días o menos» (días ≤ 7)
     - **Este mes**: «hace 8 a 30 días» (8–30)
     - **Más antiguos**: «hace más de 30 días» (> 30)
     - Los grupos vacíos no se muestran.
   - **Fila** (flex, separación de 16 px, padding de 14 px 12 px, `border-bottom: 1px solid --chp-rule`, cursor pointer):
     - Hover: fondo #F6EEE7. Fila seleccionada o abierta: fondo #F3E8E0.
     - **Marcadores** (columna de 14 px, apilados con 5 px de separación). Ver «Código de tipo de caso».
     - **Texto** (flex:1, recortado con elipsis):
       - Nombre en 17/600.
       - Línea 13 px muted: «{Nuevo | En control} · {Dr. Apellido} · Debía volver el dd/mm/aaaa · <span accent>hace N días</span>».
     - **Teléfono** (170 px; **solo con el panel cerrado**): botón de texto con el número (500 16 px, cifras tabulares) y «Copiar» (12/600 accent). Al copiar, el texto cambia a «Copiado ✓» durante 1,5 s. Si no hay número, muestra «Sin teléfono» en 14/600 accent.
     - **Botón «Hecho»**: fondo y borde `--chp-brand`, texto hueso, 14/600, padding de 7 px 14 px, radio de 2 px. Hover: fondo `--chp-accent`.
     - Chevron «›» en muted, 18 px.
   - Los clics en Copiar y en Hecho **no** abren el panel (`stopPropagation`).
   - **Vacío**: «Bandeja vacía.» en Barlow Condensed 48/600, y debajo «No queda nadie a quien escribir hoy.» en 16 px.

### Panel lateral (460 px)
- `border-left: 1px solid --chp-ink`, fondo #FFFCF8, padding de 28 px 40 px 28 px 36px, scroll vertical, columna con separación de 18 px.
- De arriba abajo:
  1. «PACIENTE» (12 px, espaciado .1em, muted) y, a la derecha, el botón de texto «Cerrar  Esc».
  2. Nombre en Barlow Condensed 38/600, interlineado 1. Debajo, en 14 px muted: «DNI 40111222 · HEMATOLOGÍA» y, en otra línea, el nombre completo del médico.
  3. Tipo de caso: marcador y texto completo, 15 px. Por ejemplo, «Paciente nuevo · no volvió a su 1.ª reevaluación» o «En control · faltó a su 2.ª reevaluación».
  4. Bloque de fechas (línea superior en `--chp-rule`, rejilla de 2 columnas):
     - «Última consulta» / dd/mm/aaaa (17 px)
     - «Debía volver el» / dd/mm/aaaa (17/600)
     - En toda la fila: «hace N días que no vuelve» en Barlow Condensed 28/600 accent.
  5. Si tiene procedimiento: triángulo ámbar y «**Procedimiento pendiente.** Hierro (Ferinject) ×2: cotizó y no lo hizo», en 15 px color #8A5300.
  6. **Teléfonos**: etiqueta en 12 px muted. Cada número va en Barlow Condensed 30/600 tabular y, a la derecha, un botón «Copiar» con borde de 1 px #CDBFB5, texto 600 accent y radio de 2 px. Si no hay número: «**Sin teléfono.** No hay número en SOFDOC ni en la otra base.» en `--chp-brand`.
  7. Si hubo seguimientos previos: «Ya se le escribió 1 vez · la última el 16/09/2026» (14 px, cursiva, muted).
  8. Nota: `<textarea>` sin caja, solo con línea inferior de 1 px ink. Placeholder «Nota (opcional)».
  9. Botones:
     - **«Seguimiento hecho  H»**: flex:1, fondo `--chp-brand`, 16/600, padding de 13 px, radio de 2 px.
     - **«Descartar  D»**: borde #CDBFB5, fondo transparente.
  10. Al pulsar Descartar se despliega «Motivo (obligatorio)» con una lista de botones de texto, cada uno con línea inferior: Se atiende en otro lugar · Número equivocado · Ya no lo necesita · Falleció · Otro. Al elegir un motivo se descarta el paciente.
  11. Enlace «Ver ficha completa →» al pie, que lleva a Buscar paciente con la ficha de ese paciente.

### Código de tipo de caso (forma + color, para reconocerlo sin leer)
- **Paciente nuevo**: círculo de 10 px, `--chp-new` (#1F5A8C).
- **En control**: cuadrado de 10 px, `--chp-control` (#6A3D8F).
- **Procedimiento pendiente**: triángulo (bordes de 6 px a cada lado y 10 px abajo), `--chp-pending` (#B26B00). Se combina con cualquiera de los dos anteriores.

---

## Interacciones y comportamiento
- **Clic en una fila** o **Enter**: abre el panel con ese paciente. Con el panel abierto, la columna del teléfono desaparece de las filas.
- **↑ ↓** (o j / k): mueven la selección. Si el panel está abierto, cambia también el paciente mostrado.
- **C**: copia el primer teléfono del paciente seleccionado.
- **H**: marca «Seguimiento hecho». **D**: abre los motivos de descarte. **Esc**: cierra el panel.
- Los atajos se ignoran cuando el foco está en un input, textarea o select, o si hay Ctrl/Cmd pulsado.
- **Al marcar «Hecho»**: el paciente sale de la lista, «hechos hoy» sube en 1 y «por atender» baja en 1. La selección (y el panel, si estaba abierto) **pasa al siguiente paciente**, o al anterior si era el último.
- **Al descartar con motivo**: el paciente sale de la lista, pero «hechos hoy» no cambia.
- **Copiar**: usar `navigator.clipboard.writeText` y mostrar «Copiado ✓» durante 1,5 s.
- **Orden de la lista** (brief §4.2):
  1. Primeros intentos antes que reintentos (`prev === 0` primero).
  2. Con procedimiento pendiente primero.
  3. Menos días sin volver primero.
  Después se agrupan por urgencia, manteniendo ese orden dentro de cada grupo.
- **Estados de carga** (no están en el prototipo; son obligatorios según el brief §8):
  - Cargando: líneas fantasma de la altura de una fila, con la misma regla inferior.
  - Error: texto en accent «No se pudo cargar la bandeja.» y un botón de texto «Reintentar».
  - Vacío: como se describe arriba.
- **Celular (< 768 px)**:
  - El panel pasa a ocupar la pantalla completa, por encima de la lista, con «‹ Volver» en lugar de «Cerrar».
  - Los contadores pasan a una fila debajo del título.
  - Todos los botones deben tener al menos 44 px de alto.
  - Sin scroll horizontal.
- **Focus**: `:focus-visible { outline: 2px solid var(--chp-accent); outline-offset: 2px; }`.

## Estado
- `bandeja[]` (de `getBandeja`), `hechos[]` y `descartados[]` (ids), `hoy` (contador), `seleccionadoId`, `abiertoId` (o `null`), `descartandoId`, `copiado` (número + temporizador), y los filtros (`especialidad`, `medico`, `soloSinTelefono`).
- Hecho y Descartar llaman al servidor. Conviene una actualización optimista: el paciente sale de la lista al instante y vuelve con un aviso si la llamada falla.

## Tokens (variables CSS `--chp-*`)
| Variable | Claro | Oscuro |
|---|---|---|
| `--chp-bg` | #FAF6F1 | #150A0A |
| `--chp-panel` | #FFFCF8 | #1E0E0D |
| `--chp-ink` | #2A1715 | #F3E9E4 |
| `--chp-muted` | #7A6460 | #BFA9A3 |
| `--chp-rule` | #E3D8CF | #4A2A27 |
| `--chp-row-hover` | #F6EEE7 | #221110 |
| `--chp-row-sel` | #F3E8E0 | #2A1513 |
| `--chp-brand` | #6F1713 | #E0736B (botones con texto #150A0A) |
| `--chp-accent` | #A8352C | #E0736B |
| `--chp-good` | #2F6B45 | #7CCB98 |
| `--chp-pending` | #B26B00 (texto #8A5300) | #E0A84A |
| `--chp-new` | #1F5A8C | #7FB0E0 |
| `--chp-control` | #6A3D8F | #B48BD6 |

- **Tipografía** (Google Fonts):
  - Títulos y cifras: Barlow Condensed (500/600/700).
  - Texto: Barlow (400/500/600/700).
  - Escala usada: 76 · 68 · 64 · 48 · 38 · 30 · 28 · 24 · 22 · 17 · 16 · 15 · 14 · 13 · 12.
- **Radio**: 2 px, solo en botones. Todo lo demás va sin radio.
- **Sombras**: ninguna.
- **Líneas**: 1 px `--chp-rule` entre filas y 1 px `--chp-ink` para los separadores principales (barra de filtros, borde del panel).

## Pantalla: Resumen (computadora, propuesta 3a)
Sección **3a** del archivo de referencia (arriba del todo). Sigue el mismo lenguaje editorial que la 2a: sin tarjetas ni sombras, y con los mismos tokens.
- **Barra superior**: igual que en la Bandeja, con «Resumen» como pestaña activa. A la derecha, el selector de usuario y el interruptor «Modo oscuro».
- **Encabezado** (línea inferior de 1 px ink):
  - El mes, «agosto 2026», en Barlow Condensed 60/600.
  - Los botones «‹ julio» y «setiembre ›» (borde #CDBFB5, radio de 2 px).
  - A la derecha, el filtro «Médico».
- **Bloque principal** (rejilla 5fr / 7fr, línea inferior en `--chp-rule`):
  - **Izquierda**:
    - «82%» en Barlow Condensed 128/600, color accent.
    - La frase «de los pacientes de agosto no volvieron a su reevaluación.» en 20 px.
    - «91 de 111 pacientes».
    - El desglose con marcadores: Nuevos 65 de 78 · En control 26 de 33.
    - La nota en cursiva «A 65 pacientes de este mes aún no les toca volver: no cuentan todavía.»
  - **Derecha**: 3 métricas en columnas iguales, separadas por una línea izquierda de 1 px `--chp-rule`. Cada una lleva el número en Barlow Condensed 72/600, la descripción en 16 px y el «X de Y» en 14 px muted.
    - Hierro (Ferinject) y otros procedimientos van en `--chp-pending`.
    - «Volvieron tras el seguimiento» va en `--chp-good`. Muestra «—» cuando no hay datos.
- **Mes a mes**:
  - Etiqueta «MES A MES · % QUE NO VOLVIÓ» y una leyenda con «Mes cerrado» (relleno) y «En curso» (rayado).
  - Rejilla de 6 columnas. Cada columna tiene un área de 190 px con el % en Barlow Condensed 32/600 y una barra vertical (altura proporcional al %, color accent).
  - Debajo de cada barra, una línea de base de 1 px ink, el nombre del mes y una nota en 13 px muted: «cerrado», «en curso · a N aún no les toca volver» o «sin pacientes con plazo vencido».
  - Mes en curso: barra rayada a 135° con borde de 1 px accent. Meses sin datos: «—» en #B8A79F, sin barra.
- Los datos salen de `getResumen(mes, medico)` (ver brief).

## Pantalla compañera: Resumen en celular (propuesta 1b, oscuro)
Está en el marco de celular de la sección 1b del archivo de referencia. Tiene el mismo lenguaje editorial:
- Selector de mes «‹ julio | agosto 2026 | setiembre ›».
- La cifra principal «47%» en Barlow Condensed ~128 px accent, con la frase «de sus pacientes de agosto no volvieron a su reevaluación.» y el desglose «59 de 125 · nuevos 44 de 75 · en control 15 de 50».
- Las otras tres métricas en filas separadas por líneas: número de 40 px y etiqueta.
- «MES A MES»: barras finas de 4 px.
- Mes en curso: barra **a trazos** y la nota en cursiva «setiembre está en curso: a 35 pacientes aún no les toca volver.»

## Recursos
No hay imágenes ni iconos externos. Los marcadores (círculo, cuadrado y triángulo) se hacen solo con CSS.

## Archivos
- `referencia/Seguimientos Propuestas.dc.html`: el prototipo (sección **2a**; Resumen en el celular de la sección **1b**). La lógica de datos de ejemplo, el orden y los atajos está en la clase `Component`, al final del archivo.
- `referencia/support.js`: lo que necesita el prototipo para abrirse en el navegador. No forma parte de la implementación.
- `capturas/2a-bandeja-panel-cerrado.png`, `capturas/2a-bandeja-panel-abierto.png`, `capturas/1b-resumen-celular-oscuro.png`, `capturas/3a-resumen-computadora.png`: capturas a 2× del prototipo.
- `brief-interfaz.md`: el encargo original, con el producto, el glosario, los estados, los datos y las restricciones.
