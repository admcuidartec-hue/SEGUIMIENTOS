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
- Tras publicar, usar «Preparar hojas», que agrega 5 columnas a `SEGUIMIENTOS` y `GRACIA_AGENDA_DIAS` a `REGLAS`, y después «Verificar».

## Publicar

En producción desde el 02/10/2026. Versión 3 (03/10/2026): interfaz editorial de Claude Design, en `docs/diseno/handoff-2a`.

```bash
git pull                 # siempre primero
npm test && npm run test:ui
npm run subir            # solo cambia @HEAD, el banco de pruebas
npm run actualizar       # publica para el equipo conservando la URL
# después, en el Sheets: menú Preparar hojas y luego Verificar
```

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
