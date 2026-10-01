# Plataforma de Seguimientos CHP — Diseño

- Fecha: 01/10/2026
- Estado: **borrador para revisión**
- Libro madre: `BD SOFDOC SEGUIMIENTOS` (`1L8fY-NXWE1agakIPEdqoLnLry0-lvYr0Z-9JfsfGxRM`)
- Zona horaria: `America/Lima` · Idioma: español · Paleta: granate `#6F1713`, hueso `#FAF6F1`

## 1. Para qué sirve

Todo paciente que vino a su primera cita debería volver a su reevaluación 1, luego a la 2,
y así sucesivamente. Hoy muchos no vuelven y nadie lo nota a tiempo. Con los datos de
enero a setiembre de 2026, de 1111 pacientes nuevos **solo 363 (33 %)** tuvieron una
segunda cita realizada.

La plataforma tiene tres objetivos:

1. **Detectar** a quién le tocaba volver y no volvió.
2. **Dar sus datos** (nombre, teléfono, médico, lo que tiene pendiente) a quien le va a
   escribir.
3. **Medir** la tasa de retorno y de conversión por mes, especialidad, médico y
   procedimiento.

**Éxito** significa que cada semana la bandeja muestra solo a los pacientes recuperables, que cada
seguimiento queda registrado con su responsable, y que el tablero dice qué porcentaje de
los contactados volvió.

**Usuarios:** Magaly, Ana, Rachel (asesoras) y el Dr. Eli Cabanillas.

## 2. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Enfoque | Propuesta 2: «Bandeja de recuperación», app web en Apps Script sobre el Sheets |
| Plazo de reevaluación | Por especialidad, editable en la hoja `REGLAS` |
| SOFDOC | Se exporta y se pega en `Hoja 1` periódicamente |
| Hierro y procedimientos | Se importan **una vez** al libro madre (`INDICACIONES`). Desde entonces se anota ahí |
| WhatsApp | **Ninguna conexión.** La app muestra los datos; quien escribe lo hace por su cuenta y marca «Seguimiento hecho» |
| Quién ve qué | Los cuatro usuarios ven a todos los pacientes. Filtro por médico |
| Bandeja | Solo pacientes vencidos hace menos de 180 días (ajustable) |

## 3. Fuentes de datos

### 3.1 SOFDOC (`Hoja 1`)

Hay 21 columnas, con el encabezado en la fila 1 y una cita por fila. Estas son las que se usan:

| Columna | Uso |
|---|---|
| `FECHA DE REGISTRO` | Desempate entre duplicados de `IDCITA` |
| `IDCITA` | Identificador de la cita |
| `ESTADO DE CITA` | Solo `Realizado` cuenta como asistencia. `Agendado` cuenta como cita futura |
| `FECHA DE ATENCION \| HORA` | Formato `2026-09-28 \| 02:00 PM` |
| `MODALDIAD` | Clínica, virtual, a domicilio, informe médico (así, con la errata del original) |
| `PACIENTE` | Nombre |
| `ESTADO DE PAGO`, `PAGO REALIZADO` | Informativo |
| `DNI DEL PACIENTE` | **Identificador del paciente.** Puede ser carné de extranjería o pasaporte (`PE3111043`) |
| `TIPO PACIENTE` | `NUEVO PACIENTE` / `REVALUACIÓN` (informativo; el orden real lo dan las fechas) |
| `ESPECIALIDAD MEDICA`, `MEDICO`, `MARCA`, `REGISTRADO POR` | Dimensiones |

SOFDOC **no trae teléfono**.

### 3.2 Base de hierro y procedimientos

`BASE DE SEGUIMIENTOS DE HIERRO Y PROCEDIMIENTOS` (`1FrJ9oXyeHLLABqLcSA2VyXry-x_ZeFow6LsSACeJw8o`)
es una hoja de cálculo de Google en la misma carpeta que el libro madre. Se convirtió del `.xlsx` el 01/10/2026.
Tiene dos pestañas con la misma estructura y el encabezado en la fila 1:

| Pestaña | Filas | Columnas |
|---|---|---|
| `HIERRO` | 227 | FECHA, (mes, sin título), ASESOR, NOMBRE, TELÉFONO, CANTIDAD, ¿ACEPTARON? ¿COTIZACIÓN?, OBSERVACIONES |
| `PROCEDIMIENTOS` | 68 | FECHA, (mes, sin título), ASESOR, NOMBRE, TELÉFONO, TIPO DE EXÁMENES, ¿ACEPTARON? ¿COTIZACIÓN?, OBSERVACIONES |

- La importación busca las columnas **por el nombre del encabezado** (sin espacios sobrantes ni
  tildes), no por su posición.
- No hay DNI ni médico solicitante. A veces el médico aparece en OBSERVACIONES («DR ALVARO»),
  pero no se interpreta: queda como texto.
- El emparejamiento por nombre con SOFDOC funciona en el 86 % de HIERRO y el 91 % de
  PROCEDIMIENTOS (medido el 01/10/2026).

## 4. Pestañas del libro madre

Solo la app y el script escriben en las pestañas que genera el script. Cada pestaña lleva el encabezado en la fila 1.

| Pestaña | Escribe | Contenido |
|---|---|---|
| `Hoja 1` | Usted (pegado) | Export de SOFDOC, sin tocar |
| `CITAS` | Script | Citas limpias. Clave: `IDCITA` |
| `PACIENTES` | Script | Una fila por DNI y especialidad (una «serie»), con su estado |
| `INDICACIONES` | Importación, asesoras | Hierro y procedimientos, con DNI emparejado |
| `SEGUIMIENTOS` | App | Una fila por seguimiento hecho o descarte |
| `REGLAS` | Usted | Plazos por especialidad y parámetros generales |
| `CATALOGOS` | Usted | Usuarios, motivos de descarte, alias de médicos |
| `KPI` | Script | Tablas de conversión ya calculadas |
| `BITACORA` | Script, app | Una línea por actualización, importación y escritura |

### 4.1 `CITAS`

`IDCITA, DNI, NOMBRE, FECHA, ESTADO, ESPECIALIDAD, MEDICO, MODALIDAD, TIPO_PACIENTE, MARCA,
PAGO, ESTADO_PAGO, REGISTRADO_POR, FECHA_REGISTRO`

- `DNI`: se quitan los espacios y se pasa a mayúsculas.
- `NOMBRE`: se recortan los espacios.
- `FECHA`: se guarda a **mediodía** del día de atención; la hora se descarta.
- `MEDICO`: se traduce con la tabla de alias de `CATALOGOS` (`Dr. ELI FABRIZIO CABANILLAS HUALPA` →
  `Dr. ELÍ FABRIZIO CABANILLAS HUALPA`). Un médico sin alias se deja tal cual.
- Si un `IDCITA` aparece repetido, gana la fila con `FECHA DE REGISTRO` más reciente.

### 4.2 `PACIENTES` (una fila por serie DNI + especialidad)

`DNI, ESPECIALIDAD, NOMBRE, TELEFONOS, MEDICO_ULTIMO, PRIMERA_CITA, ULTIMA_CITA, N_REALIZADAS,
PROXIMA_ESPERADA, VENCE, DIAS_ATRASO, PROXIMA_AGENDADA, ESTADO, N_SEGUIMIENTOS,
ULTIMO_SEGUIMIENTO, PENDIENTE`

- `PROXIMA_ESPERADA` = `ULTIMA_CITA` + `ESPERADO_DIAS` de la especialidad.
- `VENCE` = `ULTIMA_CITA` + `VENCE_DIAS`.
- `DIAS_ATRASO` = hoy − `VENCE` (0 si no ha vencido).
- `PENDIENTE`: resumen de las indicaciones cotizadas y no aceptadas (por ejemplo, «Ferinject ×2 cotizado»).
- `TELEFONOS`: los teléfonos de sus indicaciones emparejadas, normalizados a 9 dígitos y
  separados por « / ».

### 4.3 `INDICACIONES`

`ID, FECHA, TIPO, DETALLE, CANTIDAD, MEDICO_SOLICITANTE, ASESORA, NOMBRE, TELEFONO, ESTADO,
OBSERVACIONES, DNI, EMPAREJAMIENTO, ORIGEN`

- `TIPO`: `HIERRO` o `PROCEDIMIENTO`.
- `ESTADO`: `COTIZÓ` o `ACEPTÓ`.
- `EMPAREJAMIENTO`: `AUTOMÁTICO`, `CONFIRMADO`, `POR CONFIRMAR` o `SIN CANDIDATO`.
- `ORIGEN`: pestaña y fila de la base de hierro (por ejemplo `HIERRO!14`), o `MANUAL`.
- `MEDICO_SOLICITANTE`: queda vacío en lo importado; se llena en las indicaciones nuevas.
- Si falta `MEDICO_SOLICITANTE`, los KPI usan el médico de la última cita realizada del
  paciente en o antes de la fecha de la indicación.

### 4.4 `SEGUIMIENTOS`

`ID, FECHA_HORA, DNI, ESPECIALIDAD, RESPONSABLE, ACCION, MOTIVO, NOTA`

- `ACCION`: `HECHO` o `DESCARTADO`.
- `MOTIVO` (solo si se descarta): se atiende en otro lugar, número equivocado, ya no lo
  necesita, falleció, otro. La lista está en `CATALOGOS`.

### 4.5 `REGLAS`

| ESPECIALIDAD | ESPERADO_DIAS | VENCE_DIAS |
|---|---|---|
| `*` (por defecto) | 30 | 45 |
| HEMATOLOGÍA | 30 | 45 |

Valores de referencia en hematología: la mediana entre citas es de 24 días y el 75 % vuelve antes de los 42.

Parámetros generales (clave y valor): `ESPERA_TRAS_SEGUIMIENTO_DIAS = 15`,
`MAX_SEGUIMIENTOS = 3`, `CORTE_BANDEJA_DIAS = 180`.

## 5. Reglas de estado

El estado se calcula para cada serie (DNI + especialidad). **Las especialidades no se
mezclan**: ir a nutrición no cuenta como reevaluación de hematología. Gana la primera regla que se cumpla:

1. **DESCARTADO**: el último seguimiento es un `DESCARTADO`, o se hicieron
   `MAX_SEGUIMIENTOS` sin que el paciente volviera después del primero.
2. **AGENDADO**: tiene una cita `Agendado` con fecha de hoy o posterior.
3. **CONTACTADO**: hay un seguimiento `HECHO` posterior a la última cita realizada y
   todavía no han pasado `ESPERA_TRAS_SEGUIMIENTO_DIAS` días desde él.
4. **RECUPERADO**: la última cita realizada es posterior a un seguimiento `HECHO` y aún no ha
   vencido.
5. **AL DÍA**: hoy < `PROXIMA_ESPERADA`.
6. **POR VENCER**: `PROXIMA_ESPERADA` ≤ hoy < `VENCE`.
7. **VENCIDO**: `VENCE` ≤ hoy y `DIAS_ATRASO` ≤ `CORTE_BANDEJA_DIAS`. Entra en la bandeja.
8. **ANTIGUO**: vencido hace más de `CORTE_BANDEJA_DIAS`. Se ve en el tablero, no en la bandeja.

Si un paciente CONTACTADO no vuelve dentro de la espera, cae de nuevo en la regla 7 y
reaparece en la bandeja como segundo intento.

Después de tres seguimientos sin retorno pasa a DESCARTADO.

## 6. Emparejamiento por nombre

1. Para normalizar un nombre se quitan las tildes, se pasa a mayúsculas, se separa en palabras y se descartan
   `DE, DEL, LA, LOS, Y`.
2. Una indicación es candidata de un paciente si **todas** sus palabras están en el nombre
   del paciente en SOFDOC.
3. **Un solo candidato** → `AUTOMÁTICO`. **Varios** → `POR CONFIRMAR`. **Ninguno** → `SIN CANDIDATO`.
4. `CONFIRMADO` y `AUTOMÁTICO` no se recalculan; el DNI ya queda escrito.
5. En la ficha, una indicación `POR CONFIRMAR` muestra sus candidatos y el usuario elige.
   Una indicación `SIN CANDIDATO` aparece en una lista aparte del tablero para revisarla a mano.

## 7. La app

Es una app web con `executeAs: USER_DEPLOYING` y `access: ANYONE`, igual que el CRM de leads. Los usuarios
no necesitan acceso al Sheets. Google no dice quién usa la app, así que el **usuario** se elige
arriba, es obligatorio y se recuerda en el navegador. Hay modo claro y oscuro, con los colores
en tokens `--chp-*`.

### 7.1 Bandeja

- Muestra las series en estado VENCIDO.
- **Orden:** primero las que tienen una indicación pendiente (cotizada y no aceptada); luego por
  `DIAS_ATRASO` ascendente; los segundos y terceros intentos van al final.
- **Tarjeta:** nombre, DNI, teléfonos (con botón para copiar), especialidad, médico, última
  cita, días de atraso, pendiente y número de seguimientos previos.
- **Acciones:** **Seguimiento hecho**, con nota opcional, que lo pasa a CONTACTADO. **Descartar**,
  con motivo obligatorio.
- **Filtros:** especialidad, médico y «sin teléfono».
- **Contador del día:** por atender, seguimientos hechos hoy y recuperados este mes.

### 7.2 Ficha del paciente

- Se abre desde la bandeja o desde el buscador (DNI o nombre).
- Muestra la línea de tiempo de citas por especialidad, con la reevaluación esperada marcada.
- Muestra las indicaciones, el historial de seguimientos y la confirmación de emparejamiento pendiente.

### 7.3 Tablero de conversión

Todos los indicadores se filtran por mes, especialidad y médico.

- **Retorno por cohorte.** La cohorte es el mes de la primera cita realizada de la serie. Para
  cada cohorte se muestra el porcentaje que llegó a la reevaluación 1, 2 y 3. Solo cuentan los
  miembros **maduros**, es decir, aquellos cuyo `VENCE` de esa etapa ya pasó. Así un mes reciente
  no aparece con un retorno artificialmente bajo.
- **Indicaciones.** Cuántas se cotizaron y cuántas se aceptaron, con su porcentaje, por tipo,
  detalle y médico solicitante.
- **Recuperación.** De las series con un seguimiento `HECHO`, qué porcentaje tuvo una cita realizada o
  agendada después de él y la mediana de días hasta esa cita. Se ve por responsable y por mes.
- **Motivos de descarte.**
- **Indicaciones `SIN CANDIDATO`.**

## 8. Funciones

### Menú del Sheets `Seguimientos`

- **Actualizar:** `Hoja 1` → `CITAS` → `PACIENTES` → `KPI`.
- **Importar hierro y procedimientos:** se usa una sola vez.
- **Verificar:** no escribe nada.

### Funciones que llama la app

`bootstrap`, `getBandeja`, `getPaciente`, `buscar`, `marcarSeguimiento`,
`descartar`, `confirmarEmparejamiento`, `getKpi`.

### Archivos

| Archivo | Rol |
|---|---|
| `src/Logica.gs` | Funciones puras: limpiar citas, estado, emparejamiento, KPI. **Sin llamadas a Google** |
| `src/Codigo.gs` | `doGet`, funciones públicas, lectura y escritura del Sheets |
| `src/Menu.gs` | Menú, actualizar, importar, verificar |
| `src/Index.html` | La app, con bloque `DEMO` de datos simulados al final |
| `src/appsscript.json` | Manifiesto |
| `test/*.test.js` | Pruebas de `Logica.gs` con `node --test` |

El script va **incrustado en el libro madre** y se sube con clasp 2.x, igual que el CRM.

## 9. Errores y casos difíciles

- **Encabezado de `Hoja 1` distinto del esperado:** «Actualizar» aborta sin escribir nada y nombra la columna que falta.
- **Ninguna fila con DNI y fecha válidos:** aborta sin escribir.
- **Escrituras concurrentes:** toda escritura usa `LockService` (30 s). Dos seguimientos
  simultáneos del mismo paciente se guardan los dos.
- **Números:** todo número pasa por `numero_()` antes de enviarse a la app. Un `NaN` hace que
  `google.script.run` devuelva `null`.
- **Fechas:** siempre a mediodía, para que no se guarden como el día anterior.
- **Importación:** se niega a correr si `INDICACIONES` ya tiene filas. Así no se duplica.
- **Registro:** cada actualización deja en `BITACORA` cuántas citas leyó, cuántas son nuevas, cuántas cambiaron y
  cuántas se descartaron por inválidas.

## 10. Requisitos antes de construir

1. ~~Convertir la base de hierro a Hojas de cálculo de Google~~. Hecho el 01/10/2026 (`1FrJ9oXy…`).
2. Confirmar que desde ahora hierro y procedimientos se anotan en el libro madre y no en el
   archivo de enfermería.

## 11. Pruebas

- `Logica.gs`, probado con `node --test` sobre casos extraídos de los datos reales:
  - un `IDCITA` duplicado
  - el alias ELÍ/ELI
  - un documento extranjero
  - un paciente con dos especialidades
  - un paciente con una cita futura
  - un nombre con dos candidatos
  - una cohorte inmadura
  - las ocho reglas de estado
- Interfaz: `Index.html` abierto en el navegador con `DEMO`.
- Integración: despliegue `@HEAD` contra el libro madre antes de compartir la URL estable.

## 12. Fuera de alcance (primera entrega)

- Conexión con WhatsApp o SMS.
- Recordatorios automáticos antes del vencimiento (propuesta 3).
- Formulario de nuevas indicaciones dentro de la app (mientras tanto se anotan en `INDICACIONES`).
- Lectura automática de SOFDOC (sigue siendo pegado manual).
- Restricción de acceso por usuario.
