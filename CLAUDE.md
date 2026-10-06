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
- **Pacientes:** buscador y ficha completa, con anulaciones y «Dar de alta…».
- **Indicadores:** siete pestañas para el director y el botón «Resumen para imprimir» (dos páginas A4). Un Ctrl+P sin
  ese botón imprime la pantalla tal como se ve.
- Lo que se dispara con el teclado no se anima, y con «reducir movimiento» del sistema nada se anima.

**Atajos del tablero.** **H** («hecho») y **D** («descartar») ya no existen: se reemplazan por **1 a 4** y **X**.

| Tecla | Qué hace |
|---|---|
| ↑ ↓ (o j k) y ← → | Moverse entre tarjetas y columnas |
| Enter | Abrir el panel de la tarjeta |
| 1 a 4 | «¿Qué pasó?»: No contestó, Lo pensará, Agendó cita, Lo hizo. El 1 guarda sin abrir el panel |
| X | Cerrar el seguimiento (abre las opciones de cierre; nada se cierra sin confirmar) |
| C | Copiar el teléfono |
| / | Ir al buscador |
| Esc | Cerrar el paso y luego el panel; salir de un campo |

En un paso con fecha o motivo, Enter confirma.

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
npm run actualizar       # publica para el equipo conservando la URL
# pedir a las asesoras que recarguen la app (las pestañas abiertas siguen con la versión vieja)
# y avisarles que H y D se reemplazan por 1 a 4 y X
```

Ese orden importa: hasta que «Preparar hojas» agrega las 5 columnas, `registrarResultado` y `anularResultado` se niegan a escribir (SEGUIMIENTOS se escribe por posición).
«Verificar» no muestra `MAX_SEGUIMIENTOS`: hay que mirarlo en la hoja `REGLAS`.

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
