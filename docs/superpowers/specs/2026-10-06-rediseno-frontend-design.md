# Rediseño de la interfaz (Claude Design) · Diseño

- Fecha: 06/10/2026
- Estado: **borrador, para revisar** (decisiones por omisión marcadas en §2)
- Parte de: `2026-10-06-que-paso-y-tablero-design.md` (Etapa 1, ya implementada en el servidor)
- Paquete de diseño: `docs/diseno/handoff-etapa1/`
  - `README.md`: medidas, movimiento, tokens y redacción;
  - `referencia/Index.html`: implementación de referencia;
  - `maquetas/`, `capturas/`.
- Mapeo al servidor real: `docs/diseno/handoff-etapa1/MAPEO-SERVIDOR.md`. Es la **autoridad campo por campo** de este
  documento.

## 1. Qué se hace

**El diseño de Claude Design reemplaza a todo `src/Index.html`.** Tiene cuatro pantallas en un menú lateral:

| Pantalla | Qué es |
|---|---|
| **Tablero** | Cuatro columnas y el panel «¿Qué pasó?» |
| **Registro** | Igual que hoy |
| **Pacientes** | Buscador y ficha |
| **Indicadores** | Une «Resumen» y «Detalle», con siete pestañas y un resumen imprimible de dos páginas |

**El diseño manda en lo visual; el servidor real manda en los datos.** Lo visual son las medidas, los colores, los
tipos, el movimiento y los textos. El servidor real es lo implementado en la Etapa 1 y antes.

La referencia **supuso** las formas de los datos («ADAPTAR»). Muchas de esas suposiciones son incorrectas y se
corrigen como indica el mapeo.

### 1.1 Decisiones de la usuaria (06/10/2026)

1. **Tras «No contestó»**, la tarjeta queda en **Agendado** con «Reintentar el dd/mm · intento k de N».
   No sale del tablero.
2. **Se publica todo junto:** las cuatro pantallas, conectadas al servidor real.
3. **Indicadores tiene las siete pestañas** y el **resumen imprimible**, con datos reales.

### 1.2 Lo que no se pierde

El README pide no eliminar ninguna función, y `MAPEO-SERVIDOR.md` §5 tiene el inventario completo. Se conservan,
aunque la referencia no las tenga:

- **la identidad sin valor por omisión:** cada guardado exige elegir «¿Quién es usted?»;
- **en el tablero:**
  - el guardado optimista, que se corrige con la tarjeta que devuelve el servidor y vuelve atrás si hay error;
  - «Deshacer», que **anula en el servidor**;
  - la tecla X;
  - «No contestó» con la tecla 1, sin abrir el panel;
  - el enlace «N cerrados este mes»;
- **en Registro:**
  - los catálogos reales;
  - el carné de extranjería;
  - el contacto obligatorio;
  - el aviso de duplicado del servidor, a 7 días;
  - el aviso de fallecido;
  - las especialidades con alta vigente, deshabilitadas;
  - «Registrados hoy» desde el servidor, con anulación y motivo;
- **en la ficha:**
  - confirmar el emparejamiento;
  - «Dar de alta…»;
  - anular registro, sesión, alta y seguimiento, siempre con motivo;
  - el aviso de fallecido;
  - los números equivocados, tachados;
  - la línea «Debía volver el … (plazo máximo …)»;
- **en general:**
  - las preferencias `seg.*` (usuario, modo, tipo);
  - el modo oscuro, que la primera vez sigue al sistema;
  - copiar con plan B dentro del iframe.

## 2. Decisiones que tomé por omisión (revisar)

| # | Tema | Decisión | Por qué |
|---|---|---|---|
| D1 | **Meta del día** | Sí. Parámetro `META_DIARIA_SEGUIMIENTOS` en `REGLAS`, 15 por omisión. La barra cuenta **lo que registró esa persona hoy**: resultados de «¿Qué pasó?», sesiones y altas | El diseño la trae. Así es una celda y no un número fijo en el código |
| D2 | **Usuario médico** | Se le **propone** el filtro de su nombre y puede cambiarlo a «Todos». Al entrar, abre en Indicadores | Es lo que hace hoy la app. Bloquear el filtro le quitaría ver al equipo |
| D3 | **Filtro de especialidad en Indicadores** | Solo en las pestañas cuyos datos la traen. En las demás no aparece | El Resumen del mes no tiene la especialidad en el servidor |
| D4 | **Varios procedimientos en un registro** | El servidor acepta una lista y guarda todo en un solo bloqueo | El diseño permite elegir varios. Varias llamadas no serían atómicas |
| D5 | **Motivos de cierre** | Sin filtros de mes ni médico en esta etapa, con una nota que lo dice | El servidor no trae mes ni médico por motivo. Los cierres nuevos en Indicadores son de la Etapa 2 (especificación §8) |
| D6 | **«Recuperados del mes»** | Sale de la cabecera del tablero (ahí se ve «Completados en el mes») y queda en la pestaña Recuperación | Cuatro cifras, como el diseño |
| D7 | **Arrastrar y soltar** | Siempre abre el paso con confirmación; nunca guarda solo. Ver los destinos en `MAPEO` §3 E | La regla de la Etapa 1: nada cierra sin confirmar |
| D8 | **Saludo** | Según la hora: «Buenos días», «Buenas tardes» o «Buenas noches» | La referencia saluda «Buenos días» a cualquier hora |
| D9 | **Aviso con «Deshacer»** | 8 segundos | La especificación de la Etapa 1 lo pide; la referencia usa 6 |

## 3. Agregados al servidor (pequeños, con pruebas antes del código)

Los detalles están en `MAPEO-SERVIDOR.md` §1 y §4.

| Agregado | Qué hace |
|---|---|
| **S1** | `bootstrap` envía `reglas: { espera, maxSeguimientos, graciaAgenda, diasEntreSesiones, esperaCotizacion, metaRetorno, metaDiaria }`. Lee el parámetro nuevo `META_DIARIA_SEGUIMIENTOS`, que «Preparar hojas» agrega |
| **S2** | `armarTablero` agrega `cifras.hechosHoyPor`, que cuenta **por persona** las filas de hoy: resultados sin anular en `SEGUIMIENTOS`, sesiones en `SESIONES` y altas en `ALTAS` |
| **S3** | Pone el nombre en los «cerrados» de fallecidos y en las tarjetas de alta sin serie (última `NOMBRE` en `CITAS`) |
| **S4** | `registrarResultado` también devuelve `tarjeta` cuando delega en `darDeAlta` o en `marcarSesion` |
| **S5** | Un procedimiento completo dice «Se hizo el dd/mm», no «Completó el tratamiento» |
| **S6** | Las tarjetas de hierro traen `TRATAMIENTO` y `MARCA` por separado |
| **S7** | `guardarRegistro` acepta `procedimientos: [texto]` |
| **S8** | `getPaciente` envía `telefonos` del paciente |
| **S9** | `grupoProcedimiento(detalle)` junta los procedimientos escritos de distinta forma. `kpiIndicaciones` agrega `GRUPO` |
| **S10** | `getRegistrosHoy` agrega `MOTIVO_ANULACION` |

**Ningún nombre público cambia.** `getBandeja`, `marcarSeguimiento` y `descartar` siguen existiendo, aunque la app
nueva no las llame.

## 4. Reglas de la interfaz

**Dónde se adapta.** Todo dato pasa por una capa de adaptadores (`adaptarBoot`, `adaptarTarjeta`, `adaptarFicha`…),
que se escribe una vez y no pantalla por pantalla. Las reglas son las de `MAPEO` §0.

| Tema | Regla |
|---|---|
| Clave de tarjeta | `CLAVE`, como **texto** |
| Teléfonos | Se muestran con espacios y se envían sin espacios |
| Nombres | Se muestran con mayúscula inicial |
| Modo oscuro | `html[data-modo="oscuro"]`, que es lo que acepta la prueba de colores |

**Llamadas al servidor.**

- **Al arrancar:** `bootstrap` y `getTablero`, en paralelo.
- **Al entrar en Indicadores:** `getKpi` y `getResumen`. Se guardan en memoria y se vuelven a pedir después de
  cualquier escritura.
- **Al abrir el panel:** `getPaciente(dni)`, para la historia. Mientras llega, se ve un esqueleto.

**«¿Qué pasó?».**

- Se guarda con `registrarResultado`, con la tabla de claves de `MAPEO` §2.1.
- La tarjeta se mueve antes de la respuesta, con la regla del servidor.
- Al llegar la respuesta se corrige con `tarjeta`. Si la respuesta es un error, la tarjeta vuelve atrás.
- «Deshacer» llama a `anularResultado`, `anularAlta` o `anularSesion`, y después recarga el tablero.

**Etiquetas.** Cada tarjeta muestra la `ETIQUETA` del servidor, para que la app y las pruebas digan lo mismo.

**Columnas.** Siguen al servidor:

| Columna | Qué entra |
|---|---|
| Por contactar | Incluye las sesiones atrasadas |
| Agendado | Se agrupa en «Esta semana» y «Más adelante» |
| En tratamiento | Solo lo que está a tiempo |
| Completado | Solo lo del mes |

**Panel de una tarjeta de Completado.** Es solo de lectura: la historia y «Anular» del último resultado.

**Movimiento.** Lo que dice el README §7, respetando `prefers-reduced-motion`.

**Colores.** Solo tokens. La prueba de colores escritos a mano debe pasar.

**El `DEMO` se reescribe con las formas reales del servidor**, incluido `getTablero`. Los datos son inventados.

**Las pruebas de interfaz (`test/ui.test.js`) se reescriben** para la interfaz nueva. Cubren lo de la especificación
de la Etapa 1 §6 y lo de este documento.

## 5. Indicadores

Las siete pestañas salen de `getResumen()` y `getKpi()`, como hoy, y se calculan en el cliente. El detalle está en
`MAPEO` §4.

| Pestaña | Contenido |
|---|---|
| Resumen del mes | La meta sale de `REGLAS`. Recupera el desglose de pacientes nuevos y en control, y la nota de altas |
| ¿Hasta dónde llegan? | Los 100 cuadritos y el relato |
| Campañas | «Sin lead en el CRM» se muestra como «Sin registro en el CRM» |
| Procedimientos | Tres vistas: Por tipo (con S9), Como se escribió y Por médico |
| Recuperación | Sale de `kpiRecuperacion` |
| Motivos de cierre | Ver D5 |
| Procedimientos sin paciente | Sale de `sinCandidato` |

**El resumen imprimible** es una sección oculta que se muestra al imprimir:

- usa `@media print` y A4;
- son dos páginas, como en la maqueta;
- las frases de «Qué conviene mirar» se generan con reglas fijas a partir de las cifras.

## 6. Publicación

1. `git pull`.
2. `npm test && npm run test:ui`.
3. `npm run subir`.
4. En el Sheets, «Preparar hojas»: agrega `META_DIARIA_SEGUIMIENTOS`.
5. «Verificar»: comprobar `MAX_SEGUIMIENTOS = 2`, porque el código usa 3 si la celda falta.
6. En el `@HEAD`, probar:
   - un resultado de cada tipo;
   - Deshacer;
   - un registro y un alta;
   - una impresión;
   - celular y modo oscuro.
7. `npm run actualizar`.
8. Pedir a las asesoras que recarguen.
9. Avisarles que **H** y **D** se reemplazan por **1 a 4** y **X**.

## 7. Fuera de alcance

- **Las cifras de Indicadores no cambian su forma de cálculo.** Cómo cuentan los cierres nuevos y los fallecidos es de
  la Etapa 2.
- **No hay mensajes por WhatsApp.**
- **Pendientes del doctor:** los 45 días y los 15 días del hierro. Son celdas de `REGLAS`.
