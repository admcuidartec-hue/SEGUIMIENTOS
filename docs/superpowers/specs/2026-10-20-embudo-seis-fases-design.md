# Etapa 3: embudo de seis fases, «Pagó» y metas en positivo · Diseño

- Fecha: 20/10/2026
- Estado: **decisiones tomadas con el usuario (20/10/2026)**; lo marcado como *(decidido aquí)* lo resolvió la implementación
- Viene de: el acta de reunión, punto 6, y de `2026-10-06-que-paso-y-tablero-design.md` (Etapa 1) y
  `2026-10-09-etapa2-tratamientos-y-decisiones-design.md` (Etapa 2)

## 1. Qué pidió el equipo

1. **Metas en positivo**: «Meta de efectividad: 95 %», no «que no vuelva como máximo el 40 %».
2. **Una sola tarjeta** para el cumplimiento de un tratamiento (hierro) y sus no realizados, con su comparativo.
3. **Embudo tipo Kanban** de seis fases: Por contactar → Contactado → Pago realizado → Agendado → En tratamiento → Completado.
4. **Automatización**: la tarjeta avanza de fase sola cuando cambia su estado.

## 2. El embudo

### 2.1 Columnas

| Columna (`COLUMNA`) | `data-col` | Qué entra |
|---|---|---|
| `POR_CONTACTAR` | 1 | Lo de siempre: reevaluación vencida, cotización pendiente, sesión atrasada, por reevaluar, «No vino», control vencido |
| `CONTACTADO` | 5 | **Se le escribió y aún no acordó nada**: `ESTADO = AGENDADO` con `AGENDA` = `LLAMAR` (Lo pensará), `REINTENTAR` (No contestó, esperando) o `SIN RESPUESTA` (por cerrarse) |
| `PAGO_REALIZADO` | 6 | **Pagó y falta agendar**: `ESTADO = PAGO REALIZADO` (§3) |
| `AGENDADO` | 2 | Solo **fechas reales**: `CITA`, `SESION`, `CONTROL`, `PROXIMA_AGENDADA` de SOFDOC, programados con `FECHA_INICIO` |
| `EN_TRATAMIENTO` | 3 | Igual que hoy |
| `COMPLETADO` | 4 | Igual que hoy (solo del mes) |

**Los números de `data-col` no siguen el orden de pantalla** *(decidido aquí)*: las cuatro columnas de antes conservan su
número (1 a 4) para no tocar cada `p.col === 4` del código ni las pruebas que dependen de ellos; las nuevas son 5 y 6.
El orden en pantalla (de arriba hacia abajo) y el de las flechas del teclado lo da la lista `COLS` de `Index.html`.

Las etiquetas de Contactado son las de siempre («Llamar el lun 12/10», «Reintentar el 21/10 · intento 1 de 2»,
«Sin respuesta · se cierra el 21/10»). La de Pago realizado: **«Pagó el dd/mm · falta agendar»**.

`cifras` de `armarTablero` suma `contactados` y `pagados`; `porContactar`, `agendados`, `enTratamiento` y
`completadosMes` siguen con el mismo nombre (Agendado ya no cuenta los Contactado).

### 2.2 Regla general

**La tarjeta está en la fase más avanzada que alcanzó en su ciclo actual.** El ciclo es el de siempre (desde la
última consulta, la cotización, la última sesión, la fecha de inicio o la de reevaluar). Un ciclo nuevo empieza de cero.

- Una fecha real (Agendado) o una sesión (En tratamiento) ganan sobre un pago.
- Un pago gana sobre Por contactar y Contactado: un «No contestó» o un «Lo pensará» después de pagar **no lo hacen retroceder**.
- **Un paciente que pagó no se cierra solo por tiempo**: ni por `MAX_SEGUIMIENTOS` «No contestó» seguidos ni por pasar
  `CORTE_INDICACIONES_DIAS` (no queda ANTIGUO). Sí se cierra con un cierre explícito (Falleció, No desea…).
- Si una cita agendada después del pago pasa sin cita realizada, vuelve a Pago realizado *(decidido aquí)*, no a Por contactar.

### 2.3 Automatización

La columna se sigue **calculando del estado** en el servidor (`columnaDe`): nada se mueve a mano. En la app, al guardar
un resultado la tarjeta **se mueve en el acto** a su columna nueva (la previsión `previsto()` conoce las seis fases),
la respuesta del servidor la confirma o la corrige, y «Deshacer» la devuelve.

### 2.4 Arrastrar

| Soltar en | Abre |
|---|---|
| Contactado | «¿Qué pasó?» con No contestó y Lo pensará resaltados (`P.contacto`) |
| Pago realizado | El paso «Pagó», con fecha y confirmación |
| Agendado, En tratamiento, Completado | Lo de antes |
| Por contactar | El aviso de siempre |

Nunca se guarda sin confirmar. Un arrastre que no corresponde muestra un aviso: «Ya figura el pago» si la tarjeta ya
está en Pago realizado; «El pago se registra antes de agendar» si está en Agendado o más adelante.

### 2.5 Franjas de arriba hacia abajo (requisito del usuario, 20/10/2026)

El usuario primero pidió las seis columnas lado a lado y, el mismo día, lo cambió por **franjas horizontales apiladas**
(maqueta `Maqueta-Embudo-filas.png`): la tarjeta «baja» a la franja siguiente al avanzar.

- **Una franja por fase**, en el orden del embudo (1 Por contactar arriba … 6 Completado abajo), con una flecha ▼ entre franjas.
- **Cabecera fija a la izquierda (230 px)**: número de fase, nombre, cifra, una línea de detalle (la que antes iba en la
  franja de cifras de arriba: «N sin ningún intento», «esperan respuesta», «falta agendar», «N citas esta semana»,
  «ninguna atrasada», «volvieron, completaron o alta · N cerrados este mes») y una **barra proporcional** tipo embudo
  (la fase con más tarjetas, llena).
- **Carril a la derecha**: las tarjetas en fila (≈ 270 px), con desplazamiento horizontal dentro del carril; nunca de la página.
- **Tope de 12 tarjetas por franja** *(decidido aquí)*; al final, **«Ver los N →»** abre la franja entera en su carril
  (y «Ver menos» la recoge). Por contactar conserva sus separadores de grupo (Recientes, Hace 1 a 2 meses, Más antiguos)
  y Agendado los suyos (Esta semana, Más adelante), como un rótulo dentro del carril.
- **La franja de cifras de arriba (`#kpis`) se quita**: la cabecera de cada franja la reemplaza.
- **Celular (≤ 760 px)**: la cabecera va encima de su carril; el carril sigue horizontal con `scroll-snap` obligatorio y
  cada tarjeta mide ~82 % para que asome la siguiente. **Se quitan las pestañas de columnas** (`#coltabs`).
- **Teclado**: ↑ ↓ (j k) cambian de fase (a la tarjeta de la misma posición, o la última); ← → recorren la fase.
- **Arrastrar** a otra franja abre el paso con confirmación, como antes (§2.4). Como las franjas no siempre caben en la
  ventana, **la página se desplaza sola** cuando el puntero se acerca al borde de arriba o de abajo durante un arrastre.
- Modo oscuro con los tokens de siempre: no hacen falta colores nuevos (el número y la barra usan `--accent`, la franja `--col`, la cabecera `--surface`).

## 3. «Pagó»

| Campo | Valor |
|---|---|
| `RESULTADO` | `PAGO` (se muestra «Pagó») |
| Grupo (`resultadoDe`) | `PAGO`, propio *(decidido aquí)*: no es `SIGUE` (no cuenta como «volvió») ni `CIERRE` |
| `ACCION` | `PAGO` *(decidido aquí)*: `kpiRecuperacion` y «volvió antes de vencer» solo miran `HECHO`, así que el pago no infla «volvieron tras el seguimiento». La v12 en producción ignora la fila |
| `FECHA_PROXIMA` | La fecha del pago: de hace 30 días a hoy *(decidido aquí)*; por omisión, hoy |
| Tipos | Todos: reevaluación, hierro, procedimiento, control y por reevaluar |
| Dónde se acepta | Solo en tarjetas de **Por contactar** y **Contactado**. En Pago realizado: «Ya figura el pago del dd/mm.»; en Agendado o más adelante: «El paciente ya tiene fecha: el pago no cambia su fase.» |
| Cierre automático | No cuenta como «No contestó» y además lo impide (§2.2) |
| Intentos (`N_SEGUIMIENTOS`) | Sí cuenta *(decidido aquí)*: es un contacto con el paciente; así una reevaluación con pago que luego recibe cita de SOFDOC sigue en el tablero |
| Meta del día | Sí cuenta (`hechosHoy` y `hechosHoyPor`) |
| Deshacer / anular | Como los demás resultados (`anularResultado`) |
| Atajo | **4** |

`leerCiclo` devuelve además `pago` (la fecha del último pago del ciclo). `estadoDeSerie`, `pendientesIndicacion` y
`pendientesRegistro` ponen `ESTADO = 'PAGO REALIZADO'` y `FECHA_PAGO` cuando el ciclo tiene pago y el estado sería
Por contactar, Contactado o ANTIGUO. Todas las tarjetas traen `FECHA_PAGO` (vacía si no pagó).

Tras «Pagó», lo que sigue es «Agendó cita» (reevaluación, control, por reevaluar, en curso) o «Aceptó»
(hierro y procedimiento por empezar), que la llevan a Agendado.

## 4. Metas en positivo

- `textoMeta(meta, p)` recibe ahora el **% que volvió** y dice:
  - sin cifra: «Meta de retorno: 60 %.»
  - cumplida: «Meta cumplida: 63 % (meta 60 %).»
  - no cumplida: «Cumplimiento: 54 % · a 6 puntos de la meta (60 %).»
- **La cifra grande del Resumen del mes pasa a positivo** *(decidido aquí)*: «54 % de los pacientes de setiembre
  volvieron a su reevaluación», con «X de Y pacientes volvieron» y el desglose de nuevos y en control. Poner las barras en
  «volvió» y dejar la cifra grande en «no volvió» habría puesto dos porcentajes opuestos uno junto al otro.
- Barras de «Mes a mes · % que volvió», con la línea en la meta (60 %). La leyenda: «Meta: 60 %».
- «Qué conviene mirar» lee la tendencia del % que volvió: subir 5 puntos o más es «Mejoró».
- El relato de «¿Hasta dónde llegan?» ya estaba en positivo («La meta es que vuelva el 60 %; hoy vuelve el 54 %»); se
  cambia a «Meta de retorno: 60 %. Hoy vuelve el 54 %.»
- Parámetro nuevo de `REGLAS`: **`META_CUMPLIMIENTO_TRATAMIENTO_PCT` = 95**. Lo lee `reglasDesdeFilas`
  (`metaTratamiento`), lo agrega «Preparar hojas» (`PARAMETROS_REGISTRO`) y viaja a la app en `bootstrap().reglas` y en
  `getResumen().metaTratamiento`. «Verificar» no lo muestra, como los demás parámetros: se mira en la hoja.

## 5. Tarjeta unificada de tratamiento

En el Resumen del mes, las tres cifras sueltas (no siguieron el hierro, completaron el hierro, no siguieron
procedimientos) se reemplazan por **dos tarjetas** («Tratamiento de hierro» y «Procedimientos»); «volvieron tras el
seguimiento» se queda como cifra aparte.

| | Hierro | Procedimientos |
|---|---|---|
| Indicados | `HIERRO` | `PROC` |
| Cumplieron | `HIERRO_COMPLETO` («completaron») | `PROC - PROC_NO` («realizados») |
| No cumplieron | `HIERRO_NO` («no siguieron») | `PROC_NO` («no realizados») |
| En curso | `HIERRO - HIERRO_NO - HIERRO_COMPLETO` (empezaron y no terminaron) | — |

- **Cumplimiento** = cumplieron ÷ (cumplieron + no cumplieron). Los en curso todavía no cuentan, como en el resumen
  *(decidido aquí)*. Los porcentajes de la tarjeta usan esa misma base, para que sumen 100.
- Barra apilada: cumplieron (verde), no cumplieron (granate) y en curso (rayado).
- «Meta de cumplimiento: 95 %» y si se cumple o a cuántos puntos está.
- **Comparativo** con el mes anterior (mismo filtro de médico): «▲ 8 puntos mejor que agosto (52 %)» o «▼ …peor…»; igual:
  «Igual que agosto». Si el mes anterior no tiene base: «Agosto no tiene datos para comparar.»
- Igual en el resumen imprimible (página 1).

## 6. Pruebas

- `test/logica-pago.test.js` (nuevo): `resultadoDe` y `accionPara` de PAGO, `leerCiclo` (pago, sin cierre automático,
  agenda después del pago, cita vencida), los tres estados, `columnaDe`, `etiquetaDe`, `armarTablero` (cifras),
  `validarResultado` (columnas permitidas, fecha) y `META_CUMPLIMIENTO_TRATAMIENTO_PCT`.
- `test/resultado-servidor.test.js`: `ACCION = PAGO` al escribir, y Contactado como tarjeta abierta.
- `test/ui.test.js`: seis franjas en orden (escritorio y 390 px, sin scroll horizontal de la página), cabeceras con su
  cifra y detalle, tope de 12 y «Ver los N →», teclado ↑ ↓ / ← →, «Pagó» (atajo 4 y arrastre) moviendo la tarjeta y Deshacer, la tarjeta unificada y las metas en positivo.
- El DEMO tiene al menos una tarjeta en cada columna.

## 7. Publicar

`npm run subir` → «Preparar hojas» (agrega `META_CUMPLIMIENTO_TRATAMIENTO_PCT`) → «Verificar» → probar en `@HEAD` con el
paciente de prueba (un «Pagó», su «Deshacer», un «Agendó cita» tras el pago) → `npm run actualizar` en la misma sesión.
La v12 ignora las filas `ACCION = PAGO`: mientras se prueba, el paciente de prueba no cambia para el equipo.
