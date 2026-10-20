# Enfermería: primera sesión ya aplicada y seguimiento tras cada sesión · Diseño

- Fecha: 20/10/2026
- Pedido de Liset (Enfermería), con las decisiones del coordinador. Lo marcado *(decidido aquí)* lo resolvió la implementación.
- Viene de: `2026-10-09-etapa2-tratamientos-y-decisiones-design.md` (registros, sesiones) y
  `2026-10-20-embudo-seis-fases-design.md` (Etapa 3).

## A. «Primera sesión» con fecha pasada

Hoy `validarRegistro` rechaza «La fecha de la primera sesión no puede ser pasada.», pero la enfermera registra
**después** de aplicar el tratamiento.

| Fecha de la primera sesión | Qué pasa al guardar |
|---|---|
| Vacía | Como hoy: cotizado |
| Hoy o futura (hasta 180 días) | Como hoy: programado (`FECHA_INICIO`) |
| Pasada, desde la `FECHA` del registro | Se crea el registro **y se marca la sesión 1 hecha** en esa fecha, en el mismo candado. La sesión la registra quien registra |
| Anterior a la `FECHA` del registro | Se rechaza: «La primera sesión no puede ser anterior a la fecha del registro (dd/mm/aaaa).» |

- `validarRegistro` devuelve además `sesionHecha` (la fecha pasada, o ''). `guardarRegistro` escribe el registro y, para
  cada fila creada, una fila de `SESIONES` (número 1) validada con `validarSesion`, con la bitácora de siempre.
  `FECHA_INICIO` queda con la misma fecha.
- Vale también para un procedimiento: la sesión 1 de un procedimiento de una sesión lo deja completo *(decidido aquí)*.
- En la interfaz, con fecha pasada, el texto bajo el campo dice «La sesión 1 se marcará como hecha el dd/mm», y el aviso
  «Se creará 1 registro» agrega «con la sesión 1 hecha el dd/mm». El campo admite desde la fecha del registro.

## B. Seguimiento de Enfermería tras cada sesión de hierro

Liset necesita: saber si hubo reacción (inmediata o mediata, y cuál), llamar al paciente al día siguiente, a los 3 y a
los 5 días, verlos en orden de llamada y marcar «ya me contacté» cada vez.

### B.1 Datos

- **Contactos programados**: por cada sesión hecha (no anulada) de un registro `HIERRO` no anulado, uno por cada día de
  `REGLAS.ENFERMERIA_DIAS` («1,3,5» por omisión): sesión + 1, + 3 y + 5 días. **Se calculan**, no se guardan.
- **Hoja `ENFERMERIA`** (la crea «Preparar hojas»): `ID` (`ENF-000001`), `FECHA_HORA`, `ID_REGISTRO`, `ID_SESION`,
  `NUMERO_SESION`, `DNI`, `DIA` (0, 1, 3, 5), `RESULTADO` (`CONTACTADO` | `NO CONTESTO`), `REACCION_TIPO`
  (`NINGUNA` | `INMEDIATA` | `MEDIATA`), `REACCION` (varias separadas por « · »), `NOTA`, `ENFERMERA`, `ANULADO`,
  `MOTIVO_ANULACION`. Por ID, nunca por fila; con candado; columnas nuevas solo al final (`encabezadoAmpliable`).
- **`CATALOGOS.REACCIONES`** (columna nueva; «Preparar hojas» la siembra): Náuseas, Vómitos, Cefalea, Mareo, Dolor en la
  zona de punción, Flebitis, Enrojecimiento o picazón, Erupción en la piel, Hipotensión, Palpitaciones, Fiebre, Dolor
  muscular o articular, Sabor metálico, Otra. Sin la columna, la app usa esa misma lista *(decidido aquí)*.
- **`REGLAS`**: `ENFERMERIA_DIAS` = «1,3,5» y `ENFERMERIA_CORTE_DIAS` = 10. «Preparar hojas» los agrega.

### B.2 Qué se muestra (`contactosEnfermeria`, puro)

- Un contacto está **cumplido** si tiene una fila `CONTACTADO` sin anular: deja de mostrarse.
- Una fila `NO CONTESTO` no lo cumple: se sigue mostrando, con «No contestó n veces».
- **No se muestran**: los de un registro o una sesión anulados; los de un paciente fallecido *(decidido aquí)*; los que
  tocaban hace más de `ENFERMERIA_CORTE_DIAS` días (para no inundar al publicar) *(decidido aquí: se mide desde la fecha
  en que tocaba el contacto)*; los que tocan dentro de más de 7 días.
- **Orden de llamada**: vencidos (lo que tocaba antes de hoy, el más antiguo primero), luego los de hoy, luego los
  próximos 7 días (plegable). Dentro de un mismo día, por nombre.
- Cada fila trae: paciente, teléfonos, tratamiento y marca, sesión k, «Día 1 · tocaba el dd/mm», las reacciones ya
  registradas en esa sesión (en la aplicación o en un contacto anterior) y cuántas veces no contestó.

### B.3 Registrar

- **«Ya me contacté»** abre un panel en la misma fila: ¿Tuvo reacción? **No / Inmediata / Mediata**. Con Inmediata o
  Mediata se elige una o varias reacciones (chips) y la nota es opcional, **obligatoria si se elige «Otra»**. Guardar →
  la fila sale de la lista (ese día queda cumplido) con «Deshacer», que anula la fila.
- **«No contestó»** guarda `NO CONTESTO` sin abrir nada; la fila se queda, con «No contestó n veces» y «Deshacer».
- **Al marcar una sesión de hierro** (panel del tablero y ficha), opcional: «¿Reacción durante la aplicación?» No / Sí →
  reacciones. Se guarda en el mismo candado como fila `ENFERMERIA` con `DIA = 0`, `RESULTADO = CONTACTADO`,
  `REACCION_TIPO = INMEDIATA`. Anular la sesión no borra esa fila, pero sus contactos dejan de mostrarse.
- Validaciones (`validarContactoEnfermeria`): usuario del catálogo; el contacto debe estar en la lista (pendiente); resultado
  válido; con reacción, al menos una del catálogo; «Otra» pide nota. Mensajes en el estilo de siempre («Elija…», «Escriba…»).
- Servidor: `getEnfermeria`, `registrarContactoEnfermeria`, `anularContactoEnfermeria` (solo `ENF-`). Ninguna función
  existente cambia de nombre; `marcarSesion` acepta un `reaccion` opcional.

### B.4 Pantalla «Enfermería»

En el menú lateral y en la barra del celular. Grupos «Vencidos», «Hoy» y «Próximos 7 días» (plegable, `<details>`).
Cada fila: nombre, teléfono con «Copiar», tratamiento y marca, «Sesión k · Día d · tocaba el dd/mm», las reacciones
previas y «No contestó n veces». La enfermera se identifica con «¿Quién es usted?» (su nombre sale de
`CATALOGOS.USUARIOS`; no se agrega ningún nombre real; el DEMO usa «ENFERMERA PRUEBA»).

### B.5 Ficha e Indicadores

- **Ficha**: bajo cada tratamiento de hierro, «Enfermería»: cada fila (día, resultado, reacción, quién) con las anuladas
  tachadas.
- **Indicadores** (tarjeta de hierro, Resumen del mes): «Reacciones: n pacientes (inmediatas x, mediatas y)» y
  «Contactos de enfermería a tiempo: p % (a de b)». El mes es el de la sesión; un contacto es «a tiempo» si se registró
  `CONTACTADO` a más tardar el día en que tocaba *(decidido aquí)*; la base son los contactos que ya tocaban (hasta hoy).
  Se calculan en `resumenPorMes` con campos nuevos al final de `CAMPOS_RESUMEN` (`REAC_PAC`, `REAC_INM`, `REAC_MED`,
  `ENF_DEBIDOS`, `ENF_A_TIEMPO`), por mes de la sesión y médico del registro.

## Pruebas

- `test/logica-enfermeria.test.js`: A (pasada válida, anterior al registro, hoy, futura) y B (contactos calculados, orden,
  cumplido, no contestó, anulados, corte, validación, cifras del resumen).
- `test/registro-servidor.test.js` y `test/resultado-servidor.test.js` (o un archivo nuevo de servidor): la sesión 1 en el
  mismo candado, y las tres funciones nuevas.
- `test/ui.test.js` con el DEMO: pantalla Enfermería, «Ya me contacté» con reacciones y «Otra», «No contestó», Deshacer,
  reacción al marcar una sesión, la ficha, el indicador y el Registro con fecha pasada.

## Publicar

`npm run subir` → «Preparar hojas» (crea `ENFERMERIA`, agrega `REACCIONES` a `CATALOGOS` y los dos parámetros a
`REGLAS`) → «Verificar» → agregar el nombre de la enfermera en `CATALOGOS.USUARIOS` → probar en `@HEAD` con el paciente de
prueba → `npm run actualizar`.
