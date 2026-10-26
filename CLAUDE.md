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
| `src/Enfermeria.gs` | Lógica pura de Enfermería: contactos tras cada sesión de hierro, reacciones y sus cifras |
| `src/EnfermeriaServidor.gs` | Funciones de Enfermería que leen y escriben `ENFERMERIA` |
| `src/Menu.gs` | Menú `Seguimientos` del Sheets |
| `src/Index.html` | La app. El bloque `DEMO` del final permite abrirla en el navegador sin desplegar: **no lo elimine** |

## Reglas al modificar

- `npm test` (lógica) y `npm run test:ui` (interfaz) deben pasar antes de subir.
- No cambie los nombres `doGet`, `bootstrap`, `getBandeja`, `getPaciente`, `buscar`,
  `marcarSeguimiento`, `descartar`, `confirmarEmparejamiento`, `getKpi`, `getResumen`, `guardarRegistro`,
  `marcarSesion`, `anularRegistro`, `anularSesion`, `darDeAlta`, `anularAlta`, `getRegistrosHoy`,
  `buscarPacienteRegistro`, `registrarResultado`, `anularResultado`, `getTablero`, `getEnfermeria`,
  `registrarContactoEnfermeria`, `anularContactoEnfermeria`.
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
  DNI, y mira citas, Registro e `INDICACIONES`. Los buscadores comparan con `normBusqueda` (servidor, `Index.html` y DEMO):
  sin tildes, apóstrofos ni puntos, y el guion separa palabras («ohiggins» encuentra a «Ñahui-O'Higgins»).
- **Documento**: el campo DNI de Registro ya no corta a 12 caracteres en silencio: con más de 12 avisa («El documento tiene 13
  caracteres: el carné de extranjería va de 9 a 12.») y no deja registrar (`dniLargo`). Un documento escrito que no vale dice
  **por qué**, con el mismo texto en el servidor, la pantalla y el DEMO (`documentoMal`), en vez de «Falta: DNI»: 7 dígitos;
  una **Ñ** o una tilde (antes «ÑA1234567» se guardaba como «NA1234567», otro documento: ahora se rechaza); y un número de
  9 a 12 dígitos que **empieza con 0** («0012345678»), que `normDni` convertiría en otro DNI (12345678): se rechaza y se pide
  el DNI de 8 dígitos o el carné con sus letras (CE…). `normDni` no cambia (lo ya guardado se sigue emparejando igual).
- **Textos libres**: el nombre va hasta 120 caracteres y la nota, el motivo, los exámenes y la nota de una reacción hasta 2000
  (`LARGO_NOMBRE`, `LARGO_TEXTO`, `largoMal_`); el servidor lo rechaza con «El nombre va hasta 120 caracteres (tiene 999).» y
  la app lo dice antes de enviar (`textoDemasiadoLargo` en `llamar`). `textoLimpio_` quita al guardar los caracteres de
  control y de dirección (U+0000…, U+200B, U+202E…). La ficha y el panel parten las palabras larguísimas (`overflow-wrap`).
- **Teléfono**: lo que parece un número (solo dígitos, espacios, +, guiones, puntos y paréntesis) debe dar 9 dígitos con
  `normTelefono` (vale el +51 y el 01 de un fijo de Lima); si no, «El teléfono debe tener 9 dígitos.» y no se guarda
  (`telefonoMal_` al registrar y al editar; `telefonoMal` en la pantalla y el DEMO). Un texto con @ o con letras es un usuario.
- El DNI se guarda y se compara con `normDni` (sin puntos ni guiones, y sin ceros a la izquierda si es solo dígitos), también
  en el buscador del tablero (`normDni` de `Index.html`) y en el DEMO: «09997401» y «9997401» encuentran al mismo paciente.
- Una fila de Registro nunca se borra: se anula (`ANULADO` = SÍ + motivo). Solo se anula la última sesión, y nunca la de un
  registro anulado (salvo la que quedó viva de un registro que se deshizo por un fallo: `anuladoPorFallo`). Al anular un registro se anula **en el mismo candado** su agenda viva (`agendaVivaDeRegistro`: la próxima
  sesión agendada al marcar una y un «Agendó cita» que aún no pasó); sus sesiones hechas no se tocan y siguen contando en la
  meta del día en que se hicieron. La próxima sesión agendada al marcar una **no suma aparte** en la meta del día: es parte de
  la sesión (`hechosHoyPor_` salta las agendas ligadas con `sesionLigada`).
- El estado de un registro (cotizado, en curso, completo, anulado) se calcula con `estadoRegistro`; no se guarda.
- Las hojas se leen **y se escriben por nombre de columna** (`normColumna`: sin espacios de más, mayúsculas, sin tildes): ver
  «Correcciones de la batería de 80 pruebas». Una columna nueva se sigue agregando al final («Preparar hojas»).
- Sin conexión a WhatsApp: la app muestra los datos y se marca «Seguimiento hecho».
- La bandeja tiene tres tipos de seguimiento: reevaluación (series `VENCIDO`), hierro y
  procedimiento (cotizado y no hecho, `pendientesIndicacion`). Los de hierro y procedimiento
  se guardan en `SEGUIMIENTOS` con `ESPECIALIDAD` = `HIERRO` o `PROCEDIMIENTO` y no cuentan
  en «volvieron tras el seguimiento». Parámetros en `REGLAS`: `CORTE_INDICACIONES_DIAS` (180)
  y `META_RETORNO_PCT` (60).

## Escrituras seguras y rendimiento (23/10/2026, batería de 50 pruebas)

- **Idempotencia (`op`)**: cada acción que escribe (`registrarResultado`, `marcarSesion`, `guardarRegistro`,
  `registrarContactoEnfermeria`, `darDeAlta` y las cinco anulaciones) lleva un identificador de operación que pone `llamar`
  (`conOp`). Si la respuesta se pierde y la persona repite lo mismo, va el **mismo** `op` y el servidor devuelve lo de la
  primera vez (`repetida: true`) sin escribir otra vez (`opDe_`, `filasDeOp_`). Se guarda en una columna **`OP` al final** de
  `SEGUIMIENTOS`, `SESIONES`, `REGISTROS`, `ALTAS`, `ENFERMERIA` y `BITACORA` (las anulaciones se reconocen por la BITACORA;
  las filas derivadas llevan `op#agenda`, `op#reaccion`, `op#registro`, `op#1`, `op#s1`…). **Tras publicar, use «Preparar
  hojas»**: agrega esas seis columnas. Sin ellas el servidor escribe como antes, sin idempotencia (`conOp_`): nunca se niega a
  escribir por eso, y `exigirColumnas_` acepta la hoja con o sin `OP` (`columnasListas_`).
- **Todo o nada**: `guardarRegistro` valida todas las filas antes de escribir la primera y, si una falla a mitad (la hoja no
  responde), anula en el mismo candado lo escrito en esa llamada y responde «… No quedó nada guardado: se deshizo lo escrito.»
  (`deshacerEscritura_`); el «Aceptó» que crea un registro, igual. Lo anulado no cuenta como posible duplicado al reintentar.
- **La BITACORA va al final y no tumba la operación**: si falla después de guardar, la respuesta es `ok` con `aviso`
  («Se guardó, pero no se pudo escribir la BITACORA: …», `bitacora_` + `avisos_`), nunca «No se guardó» habiendo guardado.
  Con `marcarSesion`, si fallan la reacción o la próxima sesión, la sesión queda y se avisa (`reaccionError`, `agendaError`).
- **Carreras**: `marcarSesion` recibe la sesión que vio la persona (`sesion: k`) y, dentro del candado, si ya no es la
  siguiente responde «La sesión k ya se registró; recargue.» (`sesionYaNoEsLaSiguiente`). `guardarRegistro` vuelve a mirar
  `duplicadoReciente` dentro del candado.
- **Rendimiento**: con 5000 citas y 1000 registros cada lectura tardaba ~9 s en Node y «No contestó» retenía el candado 8 s.
  `especialidadesDeMedico_` usa un índice médico → especialidades armado una vez por petición (`indiceEspecialidadesMedico`,
  `d.espPorMedico` en `derivar_`); Enfermería, uno por sesión (`filasPorSesion_`); y `registrarResultado` valida dentro del
  candado con las filas del paciente (`soloDelPaciente_`), que dan sus mismas tarjetas (`test/logica-rendimiento.test.js`).
  Ahora: lecturas de 0,4 a 0,7 s y el candado de «No contestó» ~20 ms en Node.
- **Lo aceptado que no se realizó** (Indicadores, spec de la Etapa 3 §5.1): un programado sin sesiones que se cerró («No desea
  realizarse»…) o que no vino pasada la gracia cuenta como «no siguió» / «no realizado» (`marcarNoRealizados`); la ficha lo
  dice «Cerrado» sin «Lo hizo». **Pagó y no vino**: el «Pagó» de la cotización sigue en el ciclo del programado; si no viene,
  vuelve a Pago realizado y un segundo «Pagó» se rechaza.

## Correcciones de la batería de 60 pruebas (24/10/2026)

- **Consulta que SOFDOC trae tarde** (caso 27): en `estadoDeSerie` un ciclo nuevo empieza solo en la fecha esperada de la
  última consulta; un seguimiento entre la consulta y esa fecha se hizo sin saber de ella y no abre «Reintentar» (Contactado).
  `armarTablero` deja **cada CLAVE en una sola franja**, la más avanzada (Completado gana a Contactado).
- **Fechas escritas a mano** (caso 60): `fechaIso` rechaza las que no existen (2026-02-31); `mesDe` solo da el mes de una fecha
  válida; `diasEntre` da 0 (nunca NaN) si alguna no lo es. Los lectores (`leerCitas_`, `leerIndicaciones_`, `leerSeguimientos_`,
  `leerRegistros_`, `leerSesiones_`, `leerAltas_`, `leerEnfermeria_`, `leerContactos_`) pasan por `fechas_` → `normalizarFechas`:
  lo que no es una fecha queda vacío y una cita sin fecha se ignora. Indicadores y el filtro de mes solo ofrecen meses `yyyy-mm`.
- **Registro a medias** (caso 6): si un `op` tiene vivas menos filas (o sesiones 1) de las que pide el reintento, no cuenta
  como hecho: dentro del candado se anula lo que quedó («Se rehízo: el intento anterior quedó a medias») y se escribe todo
  (`registroRepetido_` con `incompleto`, `anularIncompleto_`); si no se puede anular, se rechaza pidiendo revisar Registrados.
- **Fallecido** (caso 38): con «Falleció» vigente, `guardarRegistro` y `marcarSesion` se rechazan con «Este paciente figura como
  fallecido desde el …: para registrar, primero anule «Falleció» en su ficha.» (`mensajeFallecido`, igual en la pantalla y el DEMO).
- **Tipos** (caso 58): `largoMal_` rechaza un objeto o arreglo («La nota debe ser un texto.»); `sesionYaNoEsLaSiguiente` rechaza
  un número de sesión que no sea entero positivo («El número de sesión no es válido; recargue.»).
- El `aviso` de una escritura (BITACORA caída tras guardar) se muestra en `#aviso-srv`, encima del aviso de guardado.
- El filtro de especialidad agrupa por `normTexto` y muestra la forma más usada (`formasMasFrecuentes` en `bootstrap`).
- La ficha de un registro «Cerrado» solo lista las sesiones hechas. El buscador del tablero muestra el foco (`.buscar:focus-within`).
- **Alta definitiva y tratamiento en curso** (caso 39, decidido el 24/10/2026): ver «Etapa 2», «Las cuatro decisiones del médico».

## Correcciones de la batería de 80 pruebas (26/10/2026)

- **Encabezados escritos o movidos a mano** (casos 49 y 50). `leerObjetos_` normaliza el nombre de cada columna (`normColumna`:
  «fecha», « FECHA » y «Fécha» son FECHA). `anexarObjeto_` **escribe por nombre**: cada valor va bajo la columna que se llama así
  en la fila 1, esté donde esté; nunca por posición. Si falta una columna (salvo `OP`) o está repetida, se niega sin escribir con
  un mensaje claro (`revisarEncabezado` → `errorEncabezado`): «Falta preparar las hojas: a SESIONES le falta la columna FECHA…»
  si «Preparar hojas» lo arregla, o «La hoja SESIONES tiene columnas renombradas o que la app no reconoce (…): use «Verificar»…».
  Así ninguna hoja (tampoco SESIONES ni BITACORA) queda desalineada. `conOp_`, `exigirColumnas_`, `marcarAnulado_`,
  `actualizarCeldas_`, asignar/confirmar DNI y la importación buscan las columnas por nombre normalizado. `marcarSesion` y el
  registro con la sesión 1 aplicada revisan SESIONES antes de escribir nada. **«Verificar»** revisa el encabezado de las seis
  hojas que se escriben y de INDICACIONES (`lineasEncabezado`): ✗ si falta o está repetida una columna o hay una renombrada, ⚠ si
  está en otra grafía o cambiada de lugar (funciona igual, conviene corregirla), ℹ si hay columnas propias. «Preparar hojas»
  agrega lo que falta aunque haya columnas movidas, y no toca una hoja con una columna renombrada (quedaría dos veces).
- **«Volvieron tras el seguimiento»** (caso 13): `kpiRecuperacion` tampoco cuenta los seguimientos de un Control
  (`ESPECIALIDAD` = CONTROL) ni ninguno con `REFERENCIA` a un registro: no tienen serie y nunca «vuelven».
- **Sesión con la fecha ilegible** (caso 6): `sumarDias` con una fecha vacía o ilegible devuelve ''; `estadoRegistro.ultima` es
  la fecha válida más reciente (la sesión sin fecha cuenta como hecha, pero no da la «próxima»); la etiqueta de En tratamiento
  omite «próxima ~» si no hay fecha. Salvaguarda general en `tarjeta_`: ninguna `ETIQUETA` con NaN/undefined (se quita ese trozo)
  ni `FECHA_CLAVE` que no sea una fecha sale del servidor.
- **Deshacer que falla a medias** (caso 7, decidido el 26/10/2026). Un registro anulado al deshacer un fallo («No se guardó…» o
  «Se rehízo…», `anuladoPorFallo`) nunca existió: si quedó viva una sesión suya (falló también anularla), (1) el reintento con el
  mismo op la ve como «a medias» y la anula en el candado (`registroRepetido_`); (2) `anularSesion` la acepta; (3) no suma en la
  meta (`hechosHoyPor_`); (4) la ficha la muestra bajo el registro anulado con «Anular sesión»; (5) «Verificar» la lista
  (`sesionesDeRegistrosDeshechos`). Las sesiones de un registro anulado a mano siguen como antes: cuentan y no se anulan.
- **Impresión** (caso 61): los tokens de `html[data-modo="oscuro"]` valen solo en `@media screen`; lo impreso (el «Resumen
  para imprimir» o un Ctrl+P) sale siempre con los de `:root`.
- **Fallecido**: con «Falleció» vigente también se rechazan la decisión del médico (`darDeAlta`), Editar, asignar y confirmar DNI,
  con el mismo `mensajeFallecido`; anular sí se puede. La pantalla tampoco los ofrece (Registro → Decisión deshabilita
  «Registrar»; la ficha no muestra «Decisión del médico…» ni «Editar»).
- **Volver al Tablero** (caso 63): si se escribió desde otra pantalla (`S.escribioFuera`) o la última carga tiene más de 60 s
  (`S.tableroEn`, `TABLERO_VIEJO_MS`), se recarga en silencio, sin perder filtros.
- **Editar**: con las sesiones por debajo de las ya hechas, «Guardar cambios» se deshabilita con el texto del servidor
  («Ya hizo N sesiones: el total no puede ser menor.», `fechaMalEdicion`).
- **Dos decisiones en carrera** (caso 41, decidido el 26/10/2026): dentro del candado, `darDeAlta` rechaza la decisión si hay
  otra viva del mismo DNI y especialidad registrada con otro op en los últimos `VENTANA_DECISION_MIN` (2) minutos —`FECHA_HORA` va
  al minuto—: «Ya se registró una decisión hoy para esta especialidad; anúlela para cambiarla.» (`decisionDeHoy`). Una decisión
  posterior, fuera de esa ventana, sigue reemplazando a la anterior (`decisionPosterior_`). El DEMO, de una sola pestaña, no la
  simula.

## «¿Qué pasó?» (Etapa 1)

- La lista de resultados vive en `RESULTADOS` (`src/Resultados.gs`), no en `CATALOGOS`.
- Cada fila de `SEGUIMIENTOS` lleva `RESULTADO`, y además `ACCION` (`HECHO`, `TELEFONO` o
  `DESCARTADO`), para que las cifras antiguas no cambien.
- Las filas antiguas, sin `RESULTADO`, se leen con `resultadoDe`; no se reescriben.
- Los resultados solo se aceptan sobre tarjetas abiertas (Por contactar, Agendado o En tratamiento): un resultado tardío no reabre un seguimiento ya cerrado; para corregir un cierre, primero se anula.
- Solo «No contestó» cuenta para el cierre automático (`MAX_SEGUIMIENTOS` seguidos, más la espera).
- «Número equivocado» marca el número y no cierra mientras quede otro contacto: otro teléfono o el contacto de Registro que no
  es teléfono («@usuario», `usuariosPorDni`), que llega a todas las tarjetas del DNI (también a la reevaluación) como `USUARIO`.
- «Falleció» vale para todo el paciente.
- Las filas anuladas (`ANULADO = SI`) no cuentan en ninguna cifra; `datos_` las filtra.
- Tras publicar, usar «Preparar hojas», que agrega 5 columnas a `SEGUIMIENTOS` y los parámetros que falten en `REGLAS`
  (`GRACIA_AGENDA_DIAS` y `META_DIARIA_SEGUIMIENTOS`), y después «Verificar».

## La interfaz (rediseño de Claude Design, 06/10/2026)

El diseño está en `docs/diseno/handoff-etapa1` (las maquetas mandan en lo visual) y la especificación en
`docs/superpowers/specs/2026-10-06-rediseno-frontend-design.md`. Todo vive en `src/Index.html`.

- **Menú lateral** (en el celular, barra superior y barra inferior): Tablero, Registro, Pacientes, Indicadores y Enfermería,
  más «¿Quién es usted?» y el modo claro u oscuro. Las preferencias se guardan en `seg.usuario`, `seg.modo` y, del tablero, `seg.tipo`, `seg.mes`, `seg.medico` y `seg.esp`
  (un médico, especialidad o mes recordado que ya no está en la lista se ignora; «Quitar filtros» los borra).
- **Tablero:** el embudo de seis fases en franjas (ver «Etapa 3») y el panel «¿Qué pasó?» de cada
  tarjeta. La meta del día sale de `META_DIARIA_SEGUIMIENTOS`.
  Cuenta (`hechosHoyPor_`) lo que registró hoy **cada usuario del catálogo, sea quien sea, incluida la enfermera**: resultados
  de «¿Qué pasó?», sesiones marcadas y decisiones del médico, a nombre de quien estaba elegido al guardar. Los contactos de
  Enfermería (`ENFERMERIA`) no cuentan. Lo anulado deja de contar; una sesión hecha de un registro anulado sigue contando. Se puede arrastrar una tarjeta a otra columna: abre el
  paso con confirmación, nunca guarda solo.
- **Registro:** indicaciones (procedimientos y tratamientos) y altas médicas, con «Registrados hoy».
- **Pacientes:** buscador y ficha completa, con anulaciones, Editar y «Decisión del médico…» (antes «Dar de alta…»). El buscador
  muestra 6 resultados; si hay más lo dice («Se muestran 6 de 8: escriba más para afinar.»; con 20, el tope del servidor,
  «6 de 20 o más»).
- **Indicadores:** siete pestañas para el director y el botón «Resumen para imprimir» (dos páginas A4). Un Ctrl+P sin
  ese botón imprime la pantalla tal como se ve.
- Los nombres se guardan en MAYÚSCULAS y se muestran con `nombreBonito` (mayúscula inicial, también tras guion y apóstrofo:
  «Ñahui-O'Higgins»; DE, DEL e Y en minúscula).
- Si `bootstrap` falla al abrir, cada pantalla dice «No se pudo iniciar: …» con el botón **«Reintentar»** (`arrancar`), que
  vuelve a pedirlo sin recargar la página.
- Lo que se dispara con el teclado no se anima, y con «reducir movimiento» del sistema nada se anima.

**Atajos del tablero.** **H** («hecho») y **D** («descartar») ya no existen: se reemplazan por **1 a 4** y **X** (ver «Etapa 2» y «Etapa 3»).

| Tecla | Qué hace |
|---|---|
| ↑ ↓ (o j k) | Cambiar de fase (la franja de arriba o de abajo) |
| ← → | Moverse entre las tarjetas de la fase |
| Enter | Abrir el panel de la tarjeta |
| 1 a 4 | «¿Qué pasó?»: 1 = No contestó, 2 = Lo pensará, 3 = Agendó cita (reevaluación, Control, Por reevaluar y tratamiento en curso) o Aceptó (hierro y procedimiento por empezar), 4 = **Pagó** (solo en Por contactar y Contactado; abre el paso con la fecha, nunca guarda solo). El 1 guarda sin abrir el panel. En una tarjeta En tratamiento, el 1 es «Marcar sesión k hecha» |
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
- **«Agendó cita» es solo de reevaluación** (y de Control, Por reevaluar y un tratamiento **en curso**, donde agenda la próxima sesión).
  «Aceptó» sobre un registro que ya no está cotizado ni programado se rechaza: «El tratamiento ya empezó: use «Agendó cita» para la
  próxima sesión.» (`validarResultado`). En hierro y procedimiento por empezar el botón es
  **«Aceptó tratamiento» / «Aceptó procedimiento»**, que programa la `FECHA_INICIO` (o crea el registro si venía del historial); por eso
  el atajo **3** cambia de significado. «Aceptó» no tiene «Deshacer»: el aviso dice que, para cambiar la fecha o volver atrás, se edite o se anule el registro.
- **«Próxima sesión» (`#pfp`, opcional):** `marcarSesion({ proxima })` guarda la sesión y, en el mismo candado, un «Agendó cita» ligado a ella (la sesión va en `NOTA`): la tarjeta pasa a Agendado
  «Sesión k+1 el …» (de mañana o hoy a 180 días). Anular la sesión (o «Deshacer») anula esa agenda y la de después; si la fecha pasa sin marcarla, «No vino a su sesión k». Agendado con sesión: 1 marcar, 2 Cambiar fecha (sin «No contestó»).
- **«Lo hizo» ya no se ofrece** en «¿Qué pasó?»: lo reemplazan «Marcar sesión k hecha» y «Anular la última» en las tarjetas En tratamiento.
  Las filas antiguas con `LO HIZO` se leen igual (`resultadoDe`) y no se reescriben.
- **Recorrido de un tratamiento:** Pendiente (cotizado) → Programado (`FECHA_INICIO`, en Agendado hasta `GRACIA_AGENDA_DIAS` después de esa
  fecha; pasado ese plazo, «No vino») → En tratamiento (con la primera sesión) → Completado → Por reevaluar a los 30 días de la última
  sesión (el estado se calcula con `estadoRegistro`, no se guarda). Un Control (Registro → Control + laboratorio) hace el mismo
  papel con su `FECHA_RETORNO`: en Agendado hasta pasada la gracia, luego «Control vencido»; lo completa una consulta realizada
  **después** de la fecha del registro (la del mismo día no cuenta) y en la especialidad de su doctor (la que tiene ese médico en
  las citas; si no se sabe, cualquiera). Sin teléfonos conocidos del DNI, la tarjeta usa el `CONTACTO` del registro (si no está marcado).
  Un «Por reevaluar» cuya fecha de reevaluar pasó hace más de `CORTE_INDICACIONES_DIAS` queda ANTIGUO y no se muestra (para no
  inundar el tablero al publicar). La tarjeta de un registro por reevaluar, esté en Por contactar o ya en Agendado, tapa la
  reevaluación del mismo paciente y especialidad. Esa especialidad (`ESPECIALIDAD_CONSULTA`, `especialidadDelRegistro_`) es la
  que **su doctor** tiene en las citas (si el paciente tiene consultas en varias de ellas, la más reciente); si no se sabe, la
  de la última consulta del paciente hasta el fin del tratamiento. Solo una consulta realizada **de esa especialidad** después
  de la última sesión lo da por «Volvió».
- **Registro tiene tres pestañas:** Indicación, Control + laboratorio y Decisión del médico. «Registrados» se ve por periodo (hoy o cada
  uno de los últimos 6 meses, `getRegistros`) y trae Anular y **Editar**.
- **Las cuatro decisiones del médico** (`ALTAS.DECISION`, `DECISIONES` en `Registro.gs`): `ALTA` (definitiva); `ALTA 6 MESES` y
  `ALTA 1 AÑO` (la fecha de retorno se calcula: fecha del alta + 6 o 12 meses; el paciente sigue de alta y vuelve a «Por contactar»
  `AVISO_ALTA_CONTROL_DIAS` días antes: ese día la serie ya está vencida, `estadoDeSerie` pone `vence` = `esperada`); `NUEVA REEVALUACION` (el médico da la fecha de retorno, de mañana a dos años; no deja el alta vigente).
  Una alta a 6 meses o 1 año sin fecha de retorno se trata como alta simple. **Un `ALTA` definitiva vigente en la especialidad de la reevaluación de un tratamiento, con fecha
  posterior a la del registro, lo deja sin reevaluación** (`altaSinReevaluacion_`): las sesiones siguen igual, pero al completarse
  queda Completado («Completó el dd/mm · alta definitiva del dd/mm», `SIN_REEVALUACION`) sin «Por reevaluar»; la ficha dice
  «Sin reevaluación: alta definitiva del dd/mm/aaaa». Un alta anterior o del mismo día no lo afecta; 6 meses, 1 año y nueva
  reevaluación no cambian nada; anulada el alta, vuelve la reevaluación. Se registran en Registro → Decisión del médico o en la ficha
  («Decisión del médico…»); el mensaje sin doctor dice «Elija el doctor.» solo en la nueva reevaluación.
  En la ficha, «Altas médicas» muestra la decisión, «vuelve el …» y cuándo vuelve a «Por contactar», con el estado que calcula
  `altasParaFicha` (vigente, pendiente de su retorno, cerrada porque volvió —solo con una consulta realizada después—, reemplazada o anulada).
- **Editar** (`editarRegistro`, validada por `validarEdicionRegistro`): se puede cambiar fecha, doctor, nombre, contacto, tratamiento o
  procedimiento (`DETALLE`), marca, sesiones, `FECHA_INICIO` (solo si no empezó), y `EXAMENES` y `FECHA_RETORNO` de un control.
  **No** se puede cambiar el DNI (se anula y se registra de nuevo), ni las sesiones por debajo de las ya hechas, ni el tipo; un control no tiene
  detalle ni sesiones. Solo viaja lo que cambió. Cada cambio escribe una línea en `BITACORA` (`EDITAR REGISTRO`, con el valor anterior y el nuevo) y
  sella `EDITADO`. Las decisiones del médico no se editan: se anulan.
  Editar aplica **los mismos topes de fecha que Registro** (fecha no futura ni posterior a la primera sesión, primera sesión de
  hoy a 180 días, retorno de un control hasta un año); el formulario deshabilita «Guardar cambios» y dice por qué
  (`fechaMalEdicion`, como `fechaMalRegistro`).
- **«Hasta un año» y «hasta dos años» son por calendario**: la misma fecha del año siguiente o de dentro de dos años, sumando
  meses como las altas (`topeUnAnio_` / `topeDosAnios_` con `sumarMeses_`; `topeUnAnio` / `topeDosAnios` en `Index.html` y el
  DEMO), no 365 ni 730 días. Los plazos en días (180 de la primera sesión, 30 del pago) siguen en días.
- **Tablero:** filtro por mes (`#fmes`, se recuerda en `seg.mes`) además del de tipo, médico y especialidad.
- **Publicar la Etapa 2:** «Preparar hojas» **antes** de usar las pantallas nuevas, y luego «Verificar»: sin las columnas nuevas,
  `guardarRegistro`, `editarRegistro` y `darDeAlta` se niegan a escribir (`REGISTROS` y `ALTAS` se escriben por posición). Después,
  probar en el `@HEAD` solo con un paciente de prueba, y avisar a las asesoras de que el atajo 3 ahora es «Aceptó».

## Etapa 3 (20/10/2026): embudo de seis fases y metas en positivo

Especificación: `docs/superpowers/specs/2026-10-20-embudo-seis-fases-design.md` (acta de reunión, punto 6).

- **Seis fases** (`COLUMNAS_TABLERO` en `Tablero.gs`): Por contactar → **Contactado** → **Pago realizado** → Agendado →
  En tratamiento → Completado. Contactado = `ESTADO AGENDADO` con `AGENDA` `LLAMAR`, `REINTENTAR` o `SIN RESPUESTA`
  (`AGENDAS_CONTACTO`); Agendado queda solo para fechas reales (cita, sesión, control, programado). La columna se calcula del
  estado (`columnaDe`), nunca se guarda; la app mueve la tarjeta en el acto (`previsto`) y la respuesta lo confirma.
- **Regla general**: la tarjeta está en la fase más avanzada de su ciclo. Quien pagó no vuelve a Contactado con un
  «No contestó» o «Lo pensará», **no se cierra solo por tiempo** (ni por `MAX_SEGUIMIENTOS` ni por `CORTE_INDICACIONES_DIAS`) y
  vuelve a Pago realizado si su cita pasa sin realizarse. Una fecha real o una sesión ganan sobre el pago.
- **«Pagó»** (`RESULTADO = PAGO`, `ACCION = PAGO`, grupo propio `PAGO` en `RESULTADOS`): para todos los tipos, solo sobre
  tarjetas de Por contactar y Contactado, con la fecha del pago (de hace 30 días a hoy) en `FECHA_PROXIMA`. Cuenta para la meta
  del día y como intento (`N_SEGUIMIENTOS`); **no** cuenta como «volvió» ni para el cierre automático. Se deshace como los
  demás. Las tarjetas traen `FECHA_PAGO`; `ESTADO = 'PAGO REALIZADO'`.
- **`data-col`**: las cuatro columnas de antes conservan su número (1 Por contactar, 2 Agendado, 3 En tratamiento,
  4 Completado); Contactado es **5** y Pago realizado **6**. El orden de pantalla lo da `COLS` en `Index.html`.
- **Franjas de arriba hacia abajo**: cada fase es una franja con su cabecera (número, nombre, cifra, detalle y barra
  proporcional) y un carril horizontal con hasta 12 tarjetas y «Ver los N →». Ya no hay franja de cifras arriba (`#kpis`) ni
  pestañas de columnas en el celular (`#coltabs`): allí la cabecera va encima del carril, que se desliza con `scroll-snap`.
  Arrastrar a otra franja abre el paso (a Pago realizado, «Pagó»; a Contactado, el panel con No contestó y Lo pensará
  señalados); durante el arrastre la página se desplaza sola al acercarse al borde.
- **Metas en positivo** (`textoMeta`): «Meta de retorno: 60 %», «Meta cumplida: 63 % (meta 60 %)», «Cumplimiento: 54 % · a 6
  puntos de la meta (60 %)». La cifra grande del Resumen del mes, sus barras y la línea de meta hablan del **% que volvió**;
  «Qué conviene mirar» lee la tendencia al revés que antes (subir es mejorar).
- **Tarjeta unificada** (Resumen del mes y resumen impreso): «Tratamiento de hierro» (indicados, completaron, no siguieron,
  en curso) y «Procedimientos» (realizados, no realizados), con barra apilada, «Meta de cumplimiento» y el comparativo con el
  mes anterior («▲ 8 puntos mejor que agosto (52 %)»; sin base, «Agosto no tiene datos para comparar.»). Cumplimiento =
  cumplieron ÷ (cumplieron + no cumplieron): los en curso aún no cuentan.
- **Parámetro nuevo de `REGLAS`**: `META_CUMPLIMIENTO_TRATAMIENTO_PCT` = 95 (`metaTratamiento`), en `bootstrap().reglas` y en
  `getResumen().metaTratamiento`. «Preparar hojas» lo agrega si falta.
- **Publicar la Etapa 3**: `npm run subir` → en el Sheets, «Preparar hojas» (agrega `META_CUMPLIMIENTO_TRATAMIENTO_PCT`) →
  «Verificar» → en el `@HEAD`, con el **paciente de prueba**: un «Pagó», su «Deshacer», otro «Pagó» seguido de «Agendó cita»,
  y mirar el Resumen del mes y el resumen impreso → `npm run actualizar` en la misma sesión. La v12 ignora las filas
  `ACCION = PAGO` (no las cuenta ni las muestra), así que lo probado no cambia nada para el equipo. Avisar a las asesoras:
  ↑ ↓ ahora cambian de fase, ← → recorren la fase, y el 4 es «Pagó».

## Enfermería (20/10/2026)

Pedido de Liset (Enfermería). Especificación: `docs/superpowers/specs/2026-10-20-enfermeria-design.md`.

- **Primera sesión ya aplicada** (Registro → Indicación, campo 5): una fecha pasada, desde la `FECHA` del registro, crea el
  registro **y marca la sesión 1 hecha** en esa fecha en el mismo candado (`validarRegistro` → `sesionHecha`; la sesión la
  registra quien registra). Hoy o futura, como siempre: programada. Antes de la fecha del registro, se rechaza.
- **Contactos tras cada sesión de hierro**: sesión + 1, + 3 y + 5 días (`REGLAS.ENFERMERIA_DIAS` = «1,3,5»). Se **calculan**
  (`contactosEnfermeria`); en la hoja **`ENFERMERIA`** solo queda lo registrado (`CONTACTADO` o `NO CONTESTO`, con
  `REACCION_TIPO` `NINGUNA` / `INMEDIATA` / `MEDIATA` y `REACCION` del catálogo `CATALOGOS.REACCIONES`). Un contacto
  `CONTACTADO` queda cumplido; un `NO CONTESTO` lo deja en la lista. No se muestran los de registros o sesiones anulados,
  los de un fallecido ni los que tocaban hace más de `ENFERMERIA_CORTE_DIAS` (10).
- **Pantalla «Enfermería»** (menú y barra del celular): vencidos (el más antiguo primero), hoy y próximos 7 días (plegable).
  «Ya me contacté» abre en la misma fila: ¿reacción? No / Inmediata / Mediata, cuáles (chips) y nota (obligatoria con «Otra»).
  «No contestó» guarda directo. Todo con «Deshacer» (`anularContactoEnfermeria`, solo `ENF-…`).
- **Al marcar una sesión de hierro** (tablero y ficha): «¿Reacción durante la aplicación?» opcional; `marcarSesion({ reaccion })`
  la guarda en el mismo candado como fila `ENFERMERIA` con `DIA = 0` e `INMEDIATA`.
- **Ficha**: bajo cada tratamiento de hierro, su historial de Enfermería. **Indicadores**: la tarjeta de hierro suma
  «Reacciones: n pacientes (inmediatas x, mediatas y)» y «Contactos de enfermería a tiempo: p %» (campos `REAC_*` y `ENF_*`
  al final de `CAMPOS_RESUMEN`, por mes de la sesión).
- La enfermera elige su nombre en «¿Quién es usted?»: hay que **agregarlo a `CATALOGOS.USUARIOS`** (no se escribe en el código).
- **Publicar**: `npm run subir` → «Preparar hojas» (crea `ENFERMERIA`, agrega `REACCIONES` a `CATALOGOS` y
  `ENFERMERIA_DIAS` y `ENFERMERIA_CORTE_DIAS` a `REGLAS`) → «Verificar» (debe listar `ENFERMERIA`) → agregar a la enfermera en
  `USUARIOS` → en el `@HEAD`, con el paciente de prueba: registrar un hierro con la primera sesión de ayer, ver sus contactos,
  un «Ya me contacté» con reacción y su «Deshacer» → `npm run actualizar`. Sin «Preparar hojas», registrar un contacto o una
  reacción se niega a escribir (`ENFERMERIA` se escribe por posición).

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
**Desde la versión con idempotencia (23/10/2026), tras publicar use otra vez «Preparar hojas»**: agrega la columna `OP` al final
de `SEGUIMIENTOS`, `SESIONES`, `REGISTROS`, `ALTAS`, `ENFERMERIA` y `BITACORA`. Mientras falte, todo se guarda igual pero un
reintento tras una respuesta perdida puede duplicar; «Verificar» lo dice («A SEGUIMIENTOS le falta la columna OP»).
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
  - En producción: **v13** (21/10/2026), con la Etapa 3 (embudo de seis fases, «Pagó», metas en positivo) y Enfermería. Para volver atrás: `--versionNumber 12`.
  - URL: https://script.google.com/macros/s/AKfycbzSvnyttpl1VOiKNDilyPPoqlD7VkxPDxwExa4kS75mgbgTfRbe16kJj6fpfGoBUWCkcA/exec
- `@HEAD` (`AKfycbx9-YbDPycofyq2BSq3n9KtKZ_GdbHrtYnPgtOkCnE1`) sirve el último código subido y nadie del equipo lo tiene: úselo antes de publicar.
  - URL: https://script.google.com/macros/s/AKfycbx9-YbDPycofyq2BSq3n9KtKZ_GdbHrtYnPgtOkCnE1/dev
- **Nunca `clasp deploy` sin `--deploymentId`**: crea una URL nueva y la del equipo deja de actualizarse.

Para volver a una versión anterior:

```bash
npx clasp deploy --deploymentId AKfycbzSvnyttpl1VOiKNDilyPPoqlD7VkxPDxwExa4kS75mgbgTfRbe16kJj6fpfGoBUWCkcA --versionNumber <N> --description "vuelta a vN"
```
