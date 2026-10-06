# Handoff: rediseño de Seguimientos CHP (Centro Hematológico del Perú)

> Para Claude Code. Este documento basta por sí solo: no hace falta haber visto la conversación de diseño.
> Todo el texto de la app va en **español** y las fechas en formato `dd/mm/aaaa`. Los nombres, DNI y teléfonos de las maquetas son **inventados**.

---

## 1. Resumen

Seguimientos es la web interna con la que tres asesoras (Magaly, Ana y Rachel) y un médico (Dr. Elí Cabanillas) recuperan a los pacientes que no volvieron a su reevaluación o que no siguieron un tratamiento de hierro o un procedimiento. El rediseño:

- reemplaza la «Bandeja» por un **tablero de 4 columnas**: Por contactar → Agendado → En tratamiento → Completado / Alta;
- agrega un **panel del paciente** con «¿Qué pasó?» (respuestas, pasos con fecha y confirmación de cierre);
- reorganiza el menú en **Tablero · Registro · Pacientes · Indicadores**. Indicadores une los antiguos «Resumen» y «Detalle»;
- agrega movimiento con propósito, modo oscuro, atajos de teclado, arrastrar y soltar, y un resumen imprimible para el director.

**No se elimina ninguna función de la app actual.** El brief original del cliente está en `brief-original.md`. Léalo: incluye las reglas de negocio completas (§3) y las palabras que no se deben usar (§7).

## 2. Archivos del paquete y cómo usarlos

| Archivo | Qué es | Uso |
|---|---|---|
| `referencia/Index.html` | **Implementación de referencia en un solo archivo** (HTML + CSS + JS sin compilar), con las 4 pantallas, el panel, el arrastre, los atajos, el modo oscuro y el modo de demostración. | **Punto de partida.** Ya cumple las restricciones de Apps Script. Hay que conectarlo al servidor real (§4). |
| `maquetas/*.dc.html` | Maquetas de diseño interactivas (alta fidelidad). Usan un runtime de prototipado (`support.js`) y **no** son código de producción. | Referencia visual y de comportamiento. Ábralas en el navegador para comparar. Si `referencia/Index.html` y una maqueta no coinciden, **manda la maqueta** en lo visual. |
| `maquetas/Resumen del mes.dc.html` | Documento A4 de 2 páginas para imprimir o pasar a PDF, pensado para el director. | Llevarlo a una vista de impresión (§6.5). |
| `maquetas/Especificacion.dc.html` | Tokens y tabla de movimientos. | Consulta. |
| `capturas/*.png` | Capturas de `referencia/Index.html` en modo de demostración (tablero claro y oscuro, panel, pasos de fecha y de cierre, registro, ficha y 4 pestañas de Indicadores). Solo muestran la parte visible de la pantalla. | Comparación rápida; para ver el diseño completo, abra los archivos. |
| `brief-original.md` | El brief del cliente. | Reglas de negocio y redacción. |

**Fidelidad: alta.** Los colores, tipos, espacios, radios, sombras y curvas de las maquetas son los finales. Reprodúzcalos con exactitud.

## 3. Restricciones técnicas (obligatorias, vienen del cliente)

1. La app es **un solo archivo** `src/Index.html` servido por **Google Apps Script** (`HtmlService`) dentro de un iframe.
2. **HTML + CSS + JavaScript sin compilar.** Nada de React, Vue, Next ni pasos de build.
3. Solo se pueden cargar recursos de CDN: Google Fonts (Geist y Geist Mono) y unpkg (`@phosphor-icons/web@2.1.1`). No hay archivos de imagen.
4. **Los colores viven solo en tokens CSS** (`:root` y `[data-tema="oscura"]`). Hay una prueba automática que falla si aparece un color escrito a mano fuera de esos bloques. `referencia/Index.html` ya lo cumple; mantenga esa regla en todo lo que agregue.
   - Excepción a revisar: `#FFFFFF` aparece escrito en `Resumen del mes`, que es un archivo aparte. Si lo integra en `Index.html`, use `var(--accent-ink)`.
5. Al abrir el archivo directamente en el navegador, la app debe funcionar en **modo de demostración** con el objeto `DEMO` que está al final del archivo.
6. Celular de 390 px **sin scroll horizontal**.
7. `<base target="_top">` es necesario en Apps Script. Por eso el menú **no** navega con `href="#..."`: lo intercepta un `click` y llama a `ir(seccion)`. No lo cambie.

## 4. Conectar con el servidor (tarea principal)

La función `api(nombre, ...args)` usa `google.script.run` cuando existe y, si no, `DEMO.api[nombre]`. Busque **`ADAPTAR`** en `referencia/Index.html`: cada marca indica un lugar donde se **supuso** qué envía o devuelve el servidor. Revise el código `.gs` real del proyecto y ajuste los adaptadores, **no** el servidor (salvo `buscarPaciente`, ver abajo).

| Llamada | Se usa en | Envía (supuesto) | Espera recibir (supuesto) |
|---|---|---|---|
| `getKpi` | arranque | `{ usuario }` | `{ medicos:[{k,full,short}], usuarios:[{v,l,rol:'Asesora'\|'Médico',med?}], hechosHoy }` |
| `getBandeja` | Tablero | `{ usuario }` | Lista de pacientes, cada uno con la forma de §5.1. Conviértala en `adaptarBandeja()`. |
| `getPaciente` | Registro (autocompletar por DNI), Pacientes (ficha) | `dni` | Ficha con la forma de §5.2, o `null` |
| `buscarPaciente` | Pacientes | texto normalizado (3 letras o más) | `[{ dni, n }]` (máx. 6). **No estaba en la lista del cliente: créela en el servidor o filtre en el cliente.** |
| `marcarSeguimiento` | Panel «¿Qué pasó?» | `{ id, dni, esp, resultado, fecha, nota, usuario }` | `{ ok }` |
| `guardarRegistro` | Registro | `{ dni, nombre, tel, fecha, med, items:[{det,key,trat?,ses?,marca?}], usuario }`, o `{ anular, motivo, usuario }` | `{ ids:['REG-000004',…] }` |
| `marcarSesion` | Pacientes (ficha) | `{ id, fecha, usuario }`, o `{ id, anular:true, usuario }` | `{ ok }` |
| `darDeAlta` | Registro (Alta médica) | `{ dni, esp, med, fecha, nota, usuario }` | `{ ok }` |
| `getResumen` | Indicadores | `{ mes, medico, esp }` | La forma de `DEMO` → `resumen` (§5.3) |

Valores de `resultado`: `nocontesto`, `pensara`, `agendo`, `lohizo`, `alta`, `numero`, `otrolugar`, `fallecio`, `otro`.

**Errores:** si una llamada falla, se muestra un aviso: «No se pudo guardar en el servidor. Intente de nuevo.» Si falla `getBandeja`, el tablero pasa al estado de error con el botón «Reintentar».

## 5. Modelo de datos (el que espera la interfaz)

### 5.1 Paciente del tablero
```js
{
  id, n /*nombre*/, dni, esp /*'Hematología'…*/, med /*clave del médico*/,
  t: 'reev' | 'hier' | 'proc',
  col: 1 | 2 | 3 | 4,            // 1 Por contactar · 2 Agendado · 3 En tratamiento · 4 Completado/Alta
  dias,                          // col 1: días desde «debía volver» (reev) o desde que cotizó o hizo la última sesión
  tel: ['987 654 321', …], malos: [], usuario: '@ana.flores' | '',
  intentos: 0 | 1, perfil: 'Paciente nuevo' | 'En control',
  ultima, debia,                 // reev, ISO aaaa-mm-dd
  cotizo,                        // hier/proc, ISO
  proc: 'AMO + biopsia',         // proc
  trat: { nombre:'Hierro carboximaltosa', marca:'Ferinject'|'', n, k /*hechas*/, ultima, prox, atr /*días de atraso*/ },
  cita: { tipo:'cita'|'llamar', f /*ISO*/ },   // col 2
  fin: 'Volvió el 02/10/2026' | 'Alta médica' | 'Completó el …',  // col 4
  oculto: false,                 // true = salió del tablero
  hist: [{ f:'01/10', txt:'Magaly: no contestó (intento 1 de 2)' }]  // la más reciente primero
}
```

### 5.2 Ficha (Pacientes)
`{ dni, n, tels, ultima, med, tel, esps:[…], especialidades:[{esp, estado:'No volvió'|'Al día'|'Alta médica', perfil, pend, consultas:[[tipo, fecha, detalle]]}], trats:[{id, titulo, f, med, quien, n, sesiones:[{f,quien}], anulado?, motivo?}], altas:[{esp,f,det}], previos:[{f,det,estado,obs}], hist:[…] }`

### 5.3 Resumen (Indicadores)
Vea `DEMO` → `resumen` en `referencia/Index.html`: `meses[]` (pct, tot, no, plazo, curso, sec[4]), `llegan` (cien[4], relato[], filas[]), `canales[]`, `campanas[]`, `procs[]` (con clave de grupo), `procGrupo{}` y `procMed[]`. Las cifras de enero a setiembre, canales, campañas y procedimientos **son reales** (vienen de capturas del cliente). Las de `meses` (Resumen del mes) son **de prueba**.

## 6. Pantallas

Distribución general en escritorio: menú lateral fijo de 232 px, fondo `--side`, con borde derecho de 1 px `--line` y `position:sticky` a altura completa. El contenido usa `padding:28px 32px 56px` y `max-width:1680px`.
- **Por debajo de 760 px:** el menú lateral se oculta y aparecen una barra superior (marca, selector de usuario y botón de tema) y una barra inferior de 64 px con 4 secciones. El padding pasa a `18px 14px 96px`.
- **Por debajo de 1180 px:** el tablero pasa a 2 columnas, y Registro, Pacientes y el Resumen pasan a 1 columna.
- **Por debajo de 1000 px:** las cifras del tablero pasan a 2×2.

Componentes del menú:
- **Marca:** cuadro de 36×36 px, radio 10 px, fondo `--accent`, texto «CHP» de 12,5 px en 700. Al lado, «Seguimientos» (15 px, 600) y «Centro Hematológico del Perú» (11,5 px, `--muted`).
- **Ítems:** 44 px de alto, radio 8 px, icono Phosphor de 18 px.
  - Activo: fondo `--accent-soft`, texto `--accent` e icono relleno (`ph-fill`).
  - Hover: fondo `--surface-2`.
- **Pie:** etiqueta «¿Quién es usted?», un `select` de 44 px y el botón «Modo oscuro» / «Modo claro». El tema y el usuario se guardan en `localStorage`, en `chp-tema` y `chp-usuario`.

### 6.1 Tablero (Etapa 1, prioridad)

**Cabecera**
- `h1` de 28 px en 600 (letter-spacing −0,025em): «Buenos días, Magaly», o «Buenos días, doctor Cabanillas» si el usuario es médico.
- Debajo, en `--muted`: «Lunes 05/10/2026 · 15 por contactar». Si es médico se agrega «· solo sus pacientes».
- **Meta del día:** una barra de 120×6 px (radio 3) más el texto «Hoy: 11 de 15 seguimientos». Al llegar a 15, cambia a verde y dice «Meta del día cumplida · 15 seguimientos».
- **Buscador** a la derecha: 300 px × 44 px, con icono de lupa, placeholder «Buscar por nombre o DNI» y la tecla `/` indicada a la derecha.

**Cifras**
- Una sola banda: fondo `--surface`, borde 1 px `--line`, radio 12 y `--shadow`, con 4 celdas separadas por líneas de 1 px.
- Cada celda: etiqueta de 12,5 px en `--muted`, número en Geist Mono de 28 px en 500 y una línea de 12 px.
- Las cuatro: Por contactar («N sin ningún intento»), Agendados («N citas esta semana»), En tratamiento («N sesión atrasada», en `--accent` si hay alguna) y Completados en el mes.

**Filtros**
- **Segmentado** Todos · Reevaluaciones · Hierro · Procedimientos, cada uno con su número. Los números cuentan **solo «Por contactar»**.
  - Contenedor con radio 999, padding 3 y borde `--line`. Botones de 40 px.
  - Una **pastilla granate se desliza** bajo la opción activa (ver §7).
- A la derecha: el selector de médico (deshabilitado si el usuario es médico, mostrando su nombre), el de especialidad y el botón «Solo sin teléfono», todos tipo píldora de 44 px.
- Línea de atajos de 12 px en `--muted` (se oculta en celular).

**Columnas**
- Fondo `--col`, radio 12, padding 10, separación de 14 px. Las columnas 2, 3 y 4 son `sticky` cuando hay 4 columnas.
- Encabezado `h2` de 13,5 px en 600 con un icono de color: `--accent`, `--info`, `--warn` y `--good`. El contador va en una píldora en Geist Mono.

**Agrupación de «Por contactar»** (para unos 800 pacientes)
- Grupos: **Recientes** (30 días o menos), **Hace 1 a 2 meses** (31 a 60) y **Más antiguos** (más de 60).
- Cada grupo muestra 6, 4 y 3 tarjetas, y el botón punteado «Ver 10 más de N» agrega 10.
- **Orden:** primero quien no tiene ningún intento; después, quien tiene menos días.

**Tarjeta**
- Fondo `--surface`, borde 1 px `--line`, radio 8, padding `12px 12px 11px`, `--shadow`.
- Fila 1: el nombre (13,5 px, 600, puede ocupar dos líneas) y la etiqueta de tipo, en píldora de 11 px:
  - Reevaluación: `--info` sobre `--info-soft`;
  - Hierro («Ferinject × 3»): `--warn` sobre `--warn-soft`;
  - Procedimiento: `--accent` sobre `--accent-soft`.
- Fila 2: «Dr. Cabanillas · Paciente nuevo» en 12,5 px `--muted`.
- Fila 3, según la columna:
  - **Por contactar:** teléfono, `@usuario` o «Sin teléfono», a la izquierda; a la derecha, «hace N días» en Geist Mono, en `--accent` si pasa de 30.
  - **Agendado:** chip azul «Cita jue 08/10» o «Llamar vie 09/10», y el teléfono a la derecha.
  - **En tratamiento:** barra de sesiones (segmentos de 5 px, los hechos en `--warn`), más «Sesión 2 de 3» y «próxima el 09/10». Si va atrasada: «atrasada 3 días» en `--accent`.
  - **Completado:** check verde con «Volvió el …», «Completó el …» o «Alta médica».
- **Seleccionada** (con el foco o el teclado): borde `--accent` y anillo `0 0 0 3px var(--accent-ring)`.

**Estados del tablero**
- **Cargando:** esqueletos con brillo lineal de 1,4 s. Las cifras muestran «—».
- **Vacío:** icono, «No hay pacientes por contactar.» (y un texto propio para cada columna). Con filtros activos: «Nadie con estos filtros.» y el botón «Quitar filtros».
- **Error:** banda con borde y fondo granate: «No se pudo cargar el tablero. Revise la conexión e intente de nuevo. Lo que ya registró está guardado.» y el botón «Reintentar».

**Celular**
- Se ve una columna a la vez, con pestañas en píldora arriba (la activa con fondo `--ink`).
- El arrastre está desactivado.

### 6.2 Panel del paciente

**Cómo se abre**
- Se abre al hacer clic en una tarjeta, con Enter o al soltar una tarjeta en otra columna.
- Es un cajón de 460 px desde la derecha (100 % en celular), con un velo `--velo` detrás.

**Encabezado**
- Etiqueta de tipo, perfil, nombre (`h2` de 22 px en 600) y la línea «DNI · especialidad · médico completo».
- Botón cerrar de 44×44 px. En celular, en su lugar va «‹ Volver».

**Datos clave**
- **Reevaluación:** Última consulta y Debía volver el.
- **Hierro:** Cotizó el, Sesión k de N y Última sesión, más la línea del tratamiento y su barra.
- **Procedimiento:** Cotizó el y Procedimiento.
- Debajo, una frase de 19 px en 600: «hace 45 días que no vuelve», «cotizó hace 16 días y no empezó», etc.

**Contacto**
- Una fila por teléfono (56 px), con el número en Geist Mono de 17 px y el botón **Copiar**. Al copiar cambia a «Copiado», con check verde.
- `@usuario` se muestra como «Usuario».
- Los números marcados como equivocados aparecen tachados.
- Sin contacto: «**Sin teléfono.** No hay número en SOFDOC ni en la otra base.»

**«¿Qué pasó?»** (título de 16 px)
- Cuatro botones en una cuadrícula de 2×2, de 48 px y radio 8, cada uno con su tecla 1–4: No contestó, Lo pensará, Agendó cita, y Lo hizo (este solo para hierro y procedimientos).
- Debajo, «Cerrar el seguimiento» con: Alta médica, Número equivocado (solo si tiene teléfono), Se atiende en otro lugar, Falleció y No desea continuar / otro.

**Pasos**
- Al elegir una respuesta que necesita datos, el bloque de botones se reemplaza por una caja con:
  - «‹ Cambiar respuesta»;
  - icono y título;
  - aviso (texto exacto en el código);
  - los campos que correspondan (fecha, doctor, cuál número, motivo);
  - el botón principal y «Cancelar».
- Las respuestas que **cierran** el seguimiento llevan un borde `--accent`.
- «No desea continuar / otro» no se puede confirmar sin motivo.

**Reglas de negocio** (de `brief-original.md` §3.2)

| Respuesta | Qué hace |
|---|---|
| No contestó | Suma un intento y la tarjeta sale del tablero. Vuelve en 15 días. Al 2.º intento, el seguimiento se cierra solo. |
| Lo pensará | Pide la fecha para volver a llamar y pasa a Agendado como «Llamar …». |
| Agendó cita | Pide la fecha y pasa a Agendado. |
| Lo hizo | Hierro: suma una sesión y pasa a En tratamiento (próxima en 7 días). Si era la última, pasa a Completado. Procedimiento: pasa a Completado. |
| Alta médica | Pide doctor y fecha, y pasa a Completado. |
| Número equivocado | Marca el número. Si queda otro, sigue; si no, se cierra. |
| Otros cierres | Salen del tablero. |

- Cada respuesta agrega una línea a la historia, por ejemplo «05/10 · Magaly: agendó cita para el 11/10».
- La nota opcional se guarda como «nota: «…»».
- Cada respuesta muestra un aviso con **Deshacer** durante 6 s. Por eso **no** se pide confirmación a las respuestas que no cierran el seguimiento.

**Al final del panel:** Nota (opcional), Historia (línea de tiempo con el punto más reciente en `--accent`) y el enlace «Ver ficha completa →», que lleva a Pacientes con ese DNI.

### 6.3 Registro (Etapa 2)

**Disposición**
- Segmentado **Indicación · Alta médica**, con pastilla deslizante.
- Dos columnas: el formulario (máx. 600 px) y «Registrados hoy», que queda fija.

**Indicación**
1. **Paciente**
   - DNI: 48 px, Geist Mono de 18 px, solo dígitos y 9 como máximo.
   - Al llegar a 8 dígitos se llama a `getPaciente`. Si existe, aparece el aviso azul «Paciente conocido · última consulta dd/mm/aaaa con Dr. X» y se completan nombre, teléfono y doctor.
   - Después: Nombres y apellidos, Teléfono o usuario, y Fecha.
2. **Doctor:** un `select`.
3. **Procedimiento** (si aplica): chips de selección **múltiple**: Sangría, AMO, Biopsia, Citometría de flujo, Cariotipo, Transfusión.
4. **Tratamiento** (si aplica): chips Ninguno, Hierro sacarato, Hierro derisomaltosa, Hierro carboximaltosa. Al elegir uno aparece una caja con:
   - **¿Cuántas sesiones?**: 1 a 5, u Otro (con un número entre 6 y 20);
   - **Marca:** carboximaltosa → Ferinject o Likfer; derisomaltosa → Monofer (preseleccionado); sacarato → «El sacarato no lleva marca.».

**Barra inferior fija**
- Botón «Registrar» de 48 px, deshabilitado mientras falte algo.
- Al lado, un texto: «Falta: DNI, doctor…» o «Se crearán N registros.».

**Al registrar**
- Si el mismo DNI ya tiene hoy el mismo procedimiento o tratamiento, aparece la caja ámbar «Posible duplicado» con «Registrar de todos modos» y «Revisar».
- Si todo va bien, se muestra el aviso «Registrado: … — NOMBRE · REG-…», el formulario se limpia y la fila nueva entra arriba en «Registrados hoy».

**Alta médica**
1. DNI.
2. Especialidad: solo las del paciente, como botones.
3. Doctor y fecha.
4. Nota.

Si el DNI no existe: «No encontramos ese DNI. El alta solo se registra para pacientes que ya tienen consultas.»

**Registrados hoy**
- Cada fila: hora (Geist Mono), NOMBRE · DNI, detalle y «REG-… · registró X», con el botón «Anular».
- «Anular» abre en la misma fila un campo de motivo (obligatorio) con «Anular» y «Cancelar».
- Las anuladas quedan tachadas, al 60 % de opacidad, con el rótulo «Anulado».

### 6.4 Pacientes (Etapa 2)

**Buscador**
- 52 px de alto, placeholder «DNI o nombre (mínimo 3 letras)».
- Muestra hasta 6 resultados en una lista flotante. Se navega con ↑ ↓, Enter abre y Esc cierra.

**Ficha** (dos columnas: contenido y lateral fijo)
- **Cabecera:** nombre de 36 px en 600 y «DNI …» en Geist Mono.
- **Especialidades:** el nombre, una píldora de estado y el perfil.
  - Píldoras: No volvió (granate), Al día (verde), Alta médica (azul).
  - Si aplica, «Procedimiento pendiente.» con icono ámbar.
  - Línea de tiempo de consultas: Primera cita, Reevaluación N y «Debía volver el … (plazo máximo …)» con un punto hueco granate.
  - Botón «Dar de alta…»: abre el doctor y la fecha en la misma especialidad.
- **Tratamientos y procedimientos registrados:** una caja por registro.
  - Título y estado: Pendiente, En curso, Completado o Anulado.
  - Línea «REG · fecha · médico · registró X».
  - Barra de sesiones y la lista «Sesión 1 · 05/08/2026 · Magaly».
  - La siguiente sesión pendiente tiene una fecha y el botón «Lo hizo».
  - «Anular sesión» solo en la última sesión hecha; «Anular registro» pide motivo.
- **Procedimientos indicados antes de la plataforma:** tabla con Fecha, Detalle, Estado y Observaciones.
- **Lateral:** Contacto (con Copiar), Altas médicas e Historia de seguimientos.

### 6.5 Indicadores (Etapa 2, para el director)

**Prioridad del cliente: que el director entienda las cifras.** Use frases que un médico entienda sin interpretar.

**Cabecera:** navegación ‹ mes ›, el botón granate «Resumen para imprimir» y los filtros de médico y especialidad.

**Pestañas** (segmentado con pastilla): Resumen del mes · ¿Hasta dónde llegan? · Campañas · Procedimientos · Recuperación · Motivos de cierre · Procedimientos sin paciente.
- `referencia/Index.html` implementa **solo las 4 primeras**. Las 3 últimas están en la maqueta con datos de prueba, porque el cliente todavía no entregó sus cifras.

**Resumen del mes**
- Cifra grande en Geist Mono de 120 px (84 px en celular), color `--accent`: «25%».
- La frase «de los pacientes de setiembre no volvieron a su reevaluación.» y «5 de 20 pacientes».
- El aviso de plazo y la meta: en verde si está dentro («Dentro de la meta: que vuelva el 60 %.»); en granate si no, indicando cuántos puntos falta.
- 4 cifras secundarias.
- **Mes a mes:** barras verticales de los últimos 6 meses. Rellenas si el mes está cerrado y rayadas si está en curso, más una línea punteada en la meta (40 % «no volvió»). Al hacer clic en una barra se cambia de mes.

**¿Hasta dónde llegan?**
- 100 cuadritos en una cuadrícula de 10×10 (66, 23, 5 y 6) con su leyenda.
- El relato:
  - la primera frase en 28 px;
  - el resto en 15 px;
  - la frase de la meta en negrita;
  - la última en `--soft`.
- Tabla «Mes por mes» con barra apilada (tonos `--w1` a `--w4`, rayado para «Aún en plazo», `--good` para Alta médica), más la fila Total y su nota.

**Campañas**
- Tablas «Por canal» y «Por campaña»: muestra 8 y «Ver las 18 campañas».
- La barra de «Volvieron a su 1.ª reevaluación» va en `--good`. Si la base es 0 se muestra «— (0/0)».
- **Se cambió «Sin lead en el CRM» por «Sin registro en el CRM»**: el brief prohíbe la palabra «lead».

**Procedimientos**
- Vistas **Por tipo · Como se escribió · Por médico**.
- «Por tipo» junta las variantes con errores de escritura (CITOMETREÍADE, BIOSIA, BIPOSIA…) en un grupo canónico, con la clave de grupo en `procs[i][4]`. Muestra el aviso: «Juntamos los nombres escritos de distinta forma…».
- **Recomendado:** normalizar esto en el servidor.

**Resumen imprimible** (`maquetas/Resumen del mes.dc.html`)
- 2 páginas A4, cada una con márgenes de 15 a 16 mm.
- **Página 1:** cifra grande, 4 frases, barras mes a mes y el recuadro «Qué conviene mirar».
- **Página 2:** 100 cuadritos con el relato, canales y procedimientos.
- **Implementación sugerida:** una vista oculta dentro de `Index.html` con `@media print`, que se muestra al pulsar el botón y se imprime con `window.print()`. Hoy `referencia/Index.html` imprime la pantalla tal como se ve: hay que mejorarlo.
- **Las frases de «Qué conviene mirar» deben generarse a partir de los datos reales.**

## 7. Movimiento (Emil Kowalski / Impeccable)

Principios:
- Solo animar lo que da **retroalimentación, continuidad espacial o un cambio de estado**.
- Solo `transform` y `opacity`; nunca `width`, `height`, `top` ni `left`.
- **Nada de rebote.**
- **Lo que se dispara con el teclado no se anima.** Si el panel se abre con Enter, aparece al instante.

Curvas (tokens):
- `--ease-out: cubic-bezier(.23,1,.32,1)` para entradas;
- `--ease-in-out: cubic-bezier(.77,0,.175,1)` para movimientos en pantalla;
- `--ease-drawer: cubic-bezier(.32,.72,0,1)` para el panel.

| Qué | Cómo | Duración | Curva |
|---|---|---|---|
| Cambio de pantalla | View Transitions (`document.startViewTransition`, o `@view-transition` entre documentos). Contenido: opacidad 0→1 y +8 px. El menú no se anima. | 220–240 ms | ease-out |
| Pastilla de segmentados | `transform: translateX` + `width`, medidos sobre el botón activo | 250 ms | ease-in-out |
| Tarjeta que cambia de columna | **FLIP**: se mide antes y después y la tarjeta viaja desde su posición anterior. Las vecinas se reacomodan. | 480 ms (vecinas 320) | ease-in-out |
| Realce de la tarjeta que llega | Anillo de 4 px `--accent-ring` (`--good` si completó el tratamiento) que se desvanece | 1400 ms | ease-out |
| Tarjeta que sale | Opacidad 1→0 y escala 1→0,96 antes de reacomodar | 180 ms | ease-out |
| Panel | `translateX(100%)` → 0, velo de 0 a 1 | 400 al entrar · 300 al salir | ease-drawer |
| Pasos, avisos internos, filas nuevas | Suben 6 px y aparecen. La fila nueva de Registro se tiñe de `--accent-soft` un momento. | 220 ms (tinte 1400) | ease-out |
| Aviso inferior | **Transición** (no keyframes, para poder interrumpirla): +16 px y opacidad | 300 ms | ease-out |
| Carga inicial | Cascada de tarjetas, 30 ms entre cada una (máx. 240) | 260 ms c/u | ease-out |
| Presionar | `scale(.97)` en botones y `scale(.985)` en tarjetas | 160 ms | ease-out |
| Barras de tablas (Indicadores) | `scaleX(0→1)` desde la izquierda al abrir una pestaña o cambiar de vista, cascada de 18 ms | 420 ms | ease-out |
| 100 cuadritos | Escala 0,6→1 en orden, 5 ms entre cada uno | 220 ms c/u | ease-out |
| Celebración | 10 «chispas» de 6 px que salen y se desvanecen. **Solo** al completar un tratamiento y al cumplir la meta del día. | 620–780 ms | ease-out |
| Hover y tema | Solo colores | 150 / 300 ms | ease |

**`prefers-reduced-motion`:** las duraciones bajan a 1 ms, no hay FLIP, cascada ni chispas, y las View Transitions se desactivan. Se mantienen los cambios de color.

## 8. Interacción y teclado

| Tecla | Tablero (sin panel) | Con el panel abierto |
|---|---|---|
| ↑ ↓ | Moverse dentro de una columna | — |
| ← → | Cambiar de columna (a la tarjeta más cercana) | — |
| Enter | Abrir el panel (sin animación) | — |
| C | Copiar el teléfono de la tarjeta seleccionada | Copiar el primer contacto |
| 1–4 | — | Responder «¿Qué pasó?» |
| / | Ir al buscador | — |
| Esc | Salir del campo | Cerrar el paso y luego el panel |

Los atajos «H hecho» y «D descartar» de la app actual se **reemplazan** por 1–4, porque ahora hay varias respuestas posibles. Avise a las asesoras.

**Arrastrar y soltar** (solo con puntero, a 760 px o más; las tarjetas de Completado no se arrastran)
- Empieza tras moverse 6 px. Se crea una copia flotante (rotación de 1,5°, escala 1,02, `--shadow-lg`) y la original queda al 35 % de opacidad.
- Columnas destino:
  - válidas: contorno `--line-2`;
  - la que está bajo el puntero: fondo `--accent-soft` y contorno de 2 px `--accent`;
  - no válidas: al 55 % de opacidad.
- Al soltar en una columna válida, **se abre el panel en el paso correspondiente**:
  - Agendado → «Agendó cita»;
  - En tratamiento → «Lo hizo» (solo hierro);
  - Completado → «Lo hizo» si era la última sesión o un procedimiento; si no, «Alta médica».
- Al soltar en una columna no válida, la copia vuelve en 220 ms y aparece un aviso: «Vuelve sola a «Por contactar» si pasa la fecha sin cita.» o «En tratamiento es solo para hierro.».

**Usuario médico:** el tablero se filtra solo a sus pacientes y el selector de médico queda deshabilitado.

## 9. Tokens

```css
:root{
  --bg:#F4F5F7;--side:#FFFFFF;--surface:#FFFFFF;--surface-2:#F8F9FB;--col:#ECEEF2;--line:#E4E6EB;--line-2:#CDD1D9;
  --ink:#15171C;--soft:#41464F;--muted:#636976;
  --accent:#8C1D18;--accent-hover:#741612;--accent-ink:#FFFFFF;--accent-soft:#F7E9E8;--accent-ring:rgb(140 29 24 / .28);
  --good:#1E7A4C;--good-soft:#E6F4EC;--warn:#985B00;--warn-soft:#FBF0DE;--info:#2F5BD3;--info-soft:#E8EEFC;
  --w1:#7A1A15;--w2:#B8433B;--w3:#DA857D;--w4:#F0C2BC;
  --velo:rgb(21 23 28 / .32);--skel:#E4E6EB;--skel-2:#F1F2F5;--toast:#1B1E25;--toast-ink:#F4F5F7;
  --shadow:0 1px 2px rgb(21 23 28 / .06),0 4px 14px rgb(21 23 28 / .05);--shadow-lg:-24px 0 64px rgb(21 23 28 / .14);
}
[data-tema="oscura"]{
  --bg:#0E1015;--side:#12151B;--surface:#171B22;--surface-2:#1D222B;--col:#13171D;--line:#272D38;--line-2:#3A4250;
  --ink:#ECEEF1;--soft:#C3C8D1;--muted:#98A0AD;
  --accent:#EC7B71;--accent-hover:#F39489;--accent-ink:#1A0908;--accent-soft:#2E1816;--accent-ring:rgb(236 123 113 / .35);
  --good:#5CC98F;--good-soft:#132A1F;--warn:#E7A94B;--warn-soft:#2D2312;--info:#8AABFF;--info-soft:#18213A;
  --w1:#EC7B71;--w2:#B85A52;--w3:#844640;--w4:#4E2C29;
  --velo:rgb(4 5 8 / .6);--skel:#1F242D;--skel-2:#2A303B;--toast:#ECEEF1;--toast-ink:#12151B;
  --shadow:0 1px 0 rgb(255 255 255 / .03) inset,0 6px 20px rgb(4 5 8 / .35);--shadow-lg:-24px 0 64px rgb(4 5 8 / .5);
}
```

- **Granate de marca:** `#6F1713`. El acento de la interfaz es `#8C1D18`, un paso más claro para que se lea bien, y debe seguir siendo granate.
- `--muted` cumple el contraste AA (4,5:1) sobre `--surface`.
- **Tipografía:**
  - Geist 400, 500, 600 y 700 para todo el texto;
  - Geist Mono 400, 500 y 600 para cifras, fechas, DNI y teléfonos (`font-variant-numeric: tabular-nums`);
  - escala: 28 (h1) · 22 (nombre en el panel) · 19 (alerta) · 17 (h2 de sección) · 16 («¿Qué pasó?», legend) · 14 (base) · 13,5 (tarjeta y botones) · 12,5 (apoyo) · 12 (dt) · 11 (etiqueta y kbd);
  - **nunca** Inter, Arial ni la fuente del sistema como opción visible.
- **Radios:** 12 en columnas, banda de cifras, cajas de paso y fichas; 8 en tarjetas y controles; 999 en píldoras y segmentados; 4 en kbd.
- **Espacios:** múltiplos de 4. 8 entre tarjetas, 14 entre columnas y 22 a 28 entre bloques.
- **Iconos:** solo Phosphor (`ph` para el normal y `ph-fill` para el activo).
- **Áreas táctiles:** 44 px o más (40 px dentro de los segmentados).
- **Foco:** `:focus-visible{outline:2px solid var(--accent);outline-offset:2px}`. Las tarjetas usan el anillo de selección.

## 10. Redacción (obligatoria)

- **No usar:** «cohorte», «días de atraso», «lead» ni «KPI».
- **Sí usar:** «no volvió», «hace N días», «debía volver el», «paciente nuevo», «en control», «reevaluación» y «procedimiento» (que son cosas distintas).
- **Hierro:** «Hierro carboximaltosa · Ferinject × 3 sesiones», «sesión 2 de 3 pendiente».
- **Cifras:** en frases simples («De cada 100 pacientes nuevos…»).
- Los textos exactos están en `referencia/Index.html`; respételos.

## 11. Lista de tareas para Claude Code

1. Revise el `src/Index.html` y el código `.gs` actuales del repositorio, y anote qué devuelve realmente cada función del servidor.
2. Reemplace el `src/Index.html` actual por `referencia/Index.html` (conserve una copia del anterior).
3. Ajuste cada `ADAPTAR`:
   - `adaptarBandeja()`;
   - las formas de `getKpi`, `getPaciente` y `getResumen`;
   - los argumentos de `marcarSeguimiento`, `guardarRegistro`, `marcarSesion` y `darDeAlta`.
4. Cree `buscarPaciente` en el servidor, o filtre en el cliente.
5. Calcule en el servidor el orden y los `dias` de «Por contactar», y la regla de 15 días de «No contestó».
6. Agregue a Indicadores las pestañas Recuperación, Motivos de cierre y Procedimientos sin paciente (ver la maqueta), y el filtro de especialidad.
7. Construya la vista de impresión de 2 páginas (§6.5) con datos reales.
8. Ejecute la prueba de colores fuera de tokens y corrija lo que marque.
9. Pruebe:
   - modo de demostración (abrir el archivo directamente);
   - Apps Script;
   - 1366, 1440, 1920 y 390 px;
   - modo claro y oscuro;
   - todo con teclado;
   - `prefers-reduced-motion`.
10. Compare cada pantalla con su maqueta en `maquetas/`.

## 12. Recursos

- **Fuentes:** Google Fonts, Geist y Geist Mono.
- **Iconos:** `https://unpkg.com/@phosphor-icons/web@2.1.1`.
- No hay imágenes ni otros archivos.
