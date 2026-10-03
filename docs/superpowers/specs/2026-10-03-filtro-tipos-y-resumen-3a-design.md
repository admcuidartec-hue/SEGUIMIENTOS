# Filtro por tipo de seguimiento y Resumen 3a — Diseño

- Fecha: 03/10/2026
- Estado: **aprobado** («sí, aprobado, implementa filtro y resumen 3a»)
- Amplía: `2026-10-01-plataforma-seguimientos-design.md`

## 1. Para qué

El doctor quiere ver por separado los seguimientos de **reevaluaciones**, de **hierro
(Ferinject)** y de **procedimientos**.

Medido el 03/10/2026, la bandeja solo tenía a quienes no volvieron a su reevaluación. Por eso
faltaba gente:

| Cotizó y no lo hizo | Total | Fuera de la bandeja |
|---|---|---|
| Hierro | 99 | 27 |
| Procedimientos | 53 | 14 |

## 2. Decisiones

| Tema | Decisión |
|---|---|
| Hierro y procedimientos | Son **listas propias**: entran todos los que cotizaron y no lo hicieron, estén o no al día con su reevaluación |
| Cómo se registran | En `SEGUIMIENTOS`, con `ESPECIALIDAD` = `HIERRO` o `PROCEDIMIENTO`. No se agregan columnas |
| Intentos | Cada tipo lleva su cuenta. Escribirle por el hierro no cuenta como seguimiento de su reevaluación |
| Límite de días | Parámetro nuevo en `REGLAS`: `CORTE_INDICACIONES_DIAS`, 180 por omisión, hasta que el doctor aclare la pregunta 9a |
| `prepararHojas` | Una hoja `REGLAS` nueva trae `MAX_SEGUIMIENTOS` = 2 (respuesta 7 del doctor) y `CATALOGOS` trae «ALTA MÉDICA». En el libro en producción esas celdas se editan a mano |
| Meta | Parámetro nuevo en `REGLAS`: `META_RETORNO_PCT`, 60 por omisión (respuesta 12 del doctor) |
| Recuperación | «Volvieron tras el seguimiento» sigue midiendo solo reevaluaciones |

## 3. Lógica

### 3.1 `pendientesIndicacion(citas, indicaciones, seguimientos, reglas, hoy)`

Devuelve una fila por DNI y tipo (`HIERRO` o `PROCEDIMIENTO`) con al menos una cotización
pendiente **con fecha**.

**Cotización pendiente.** Es un `COTIZÓ` sin un `ACEPTÓ` del mismo DNI y tipo con fecha igual
o posterior. Es la misma regla que ya usa `pendientesPorDni`.

**Campos de cada fila:**
- `DNI`
- `ESPECIALIDAD`: el tipo, que sirve de clave junto con el DNI.
- `TIPO_SEGUIMIENTO`
- `NOMBRE`: el de la última cita; si no hay cita, el de la indicación.
- `TELEFONOS`
- `MEDICO_ULTIMO`: el médico solicitante; si falta, el de la última cita realizada hasta la
  cotización; si tampoco hay, el de la última cita.
- `ESPECIALIDAD_CONSULTA`: la de esa misma cita. La usa el filtro de especialidad.
- `FECHA_COTIZACION`: la de la cotización pendiente más reciente.
- `DETALLE`: por ejemplo «Hierro (Ferinject) ×2» o «AMO + BIOPSIA», sin repetidos.
- `DIAS`: días desde `FECHA_COTIZACION`.
- `ULTIMA_CITA`
- `N_SEGUIMIENTOS`
- `ULTIMO_SEGUIMIENTO`
- `ESTADO`

**Estado.** Gana la primera regla que se cumple. Solo cuentan los seguimientos de ese tipo con
fecha igual o posterior a `FECHA_COTIZACION`.

1. **DESCARTADO** si el último seguimiento es un descarte.
2. **DESCARTADO** si ya se hicieron `maxSeguimientos` intentos y pasó la espera.
3. **CONTACTADO** si el último «hecho» tiene menos días que la espera.
4. **ANTIGUO** si `DIAS` es mayor que `corteIndicaciones`.
5. **PENDIENTE** en cualquier otro caso. Solo esta fila entra en la bandeja.

### 3.2 Bandeja

`ordenarBandeja(pacientes, pendientes)` une:
- las series `VENCIDO`, con `TIPO_SEGUIMIENTO` = `REEVALUACION`;
- las filas `PENDIENTE`.

El orden es:
1. menos intentos;
2. con algo pendiente (una reevaluación con `PENDIENTE` o una fila de hierro o de
   procedimiento);
3. menos días (`DIAS_ATRASO` o `DIAS`);
4. DNI;
5. tipo.

### 3.3 Otros cambios

- **`validarAccion`** acepta también las filas de hierro y procedimiento, porque recibe
  pacientes y pendientes juntos.
- **`kpiRecuperacion`** ignora los seguimientos de `HIERRO` y `PROCEDIMIENTO`.

## 4. Interfaz

### 4.1 Bandeja

Botones **Todos · Reevaluaciones · Hierro (Ferinject) · Procedimientos**, cada uno con el
número que muestra con los demás filtros aplicados.

**Filas de hierro o procedimiento:**
- Llevan el triángulo.
- El texto es: «Hierro (Ferinject) ×2 · Dr. Cabanillas · Cotizó el 05/08/2026 · hace N días».
- Se agrupan por los días desde la cotización.

**Panel:** «cotizó y no lo hizo», la fecha de la cotización y la última consulta. Las acciones
son las mismas: Seguimiento hecho y Descartar.

### 4.2 Resumen 3a

En computadora:
- **Encabezado:** el mes en grande, los botones ‹ › y el filtro de médico a la derecha.
- **Bloque principal:**
  - a la izquierda, el % que no volvió, con su frase y el desglose con marcadores;
  - a la derecha, tres métricas en columnas.
- **Meta:** «Meta: que vuelva el 60 %».
- **Mes a mes:** seis columnas con barras verticales.
  - Las barras son rellenas para un mes cerrado y rayadas para un mes en curso, y una línea
    marca la meta.
  - Debajo de cada barra hay una nota: «cerrado», «en curso · a N aún no les toca volver» o
    «sin pacientes con plazo vencido».
  - Al pulsar una columna se elige ese mes.

En celular se apila lo mismo.

## 5. Fuera de alcance

- Que el plazo dependa del diagnóstico: SOFDOC no trae el diagnóstico.
- Seguir que se completen las dosis de Ferinject (pregunta 9b).
- Medir la recuperación del hierro y de los procedimientos.
