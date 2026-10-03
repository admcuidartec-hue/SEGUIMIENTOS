# Integración con el CRM de leads — Diseño

- Fecha: 03/10/2026
- Estado: **borrador para revisión**
- Amplía: `2026-10-01-plataforma-seguimientos-design.md`
- Libro del CRM (solo lectura): `1dofPqkj644Y0kfYYpX2WG9g8JlHYFai8nk--CzFtbsM`, hoja `LEADS`

## 1. Para qué

1. **Más teléfonos.** De los ~800 pacientes en la bandeja, solo ~162 tienen teléfono. El
   CRM aporta unos 115 más.
2. **Medir por campaña y por canal.** La idea es saber qué medios y qué anuncios traen
   pacientes que **vuelven** a sus reevaluaciones, no solo los que sacan la primera cita.

Medido el 03/10/2026: de los 365 pacientes con primera consulta desde el 01/07/2026,
321 (88 %) se pueden unir a un lead (208 por DNI, 113 por nombre). El campo
CAMPAÑA casi siempre está vacío o dice «NINGUNA CAMPAÑA». El canal específico
(Facebook Ads, WhatsApp directo, Google…) sí viene lleno casi siempre.

## 2. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Acceso al CRM | **Solo lectura**, desde el script del libro madre (misma cuenta dueña). Nunca se escribe en el CRM |
| Qué se copia | Solo los leads con DNI o nombre, y solo 7 columnas, en la pestaña `CONTACTOS_CRM`, que se reemplaza entera en cada actualización |
| Atribución | Cada paciente va al **lead más reciente con fecha ≤ su primera consulta** (opción a) |
| Cuándo se actualiza | Con el botón «Actualizar» **y además cada día a las 7:00** con un activador (opción b) |
| Emparejamientos dudosos | No se usan. En esta versión no hay confirmación manual de leads |

## 3. Datos

### 3.1 Origen: `LEADS` del CRM

Las columnas se buscan **por el nombre del encabezado**: `ID`, `FECHA`, `NOMBRES`, `APELLIDOS`,
`DNI`, `TELEFONO`, `CANAL`, `CANAL_ESPECIFICO`, `CAMPANA`.

- **Obligatorias:** `ID`, `FECHA` y `TELEFONO`. Si falta alguna, no se toca `CONTACTOS_CRM`
  (ver §6).
- **Filtro:** se descartan los leads sin DNI y sin nombre, porque no se pueden unir con ningún
  paciente.

### 3.2 Nueva pestaña `CONTACTOS_CRM` (la escribe el script)

`ID_LEAD, FECHA, NOMBRE, DNI, TELEFONO, CANAL, CAMPANA, DNI_PACIENTE, EMPAREJAMIENTO`

- `NOMBRE`: NOMBRES + APELLIDOS, con espacios limpios.
- `DNI`: el del lead, normalizado con `normDni`. `TELEFONO`: normalizado con `normTelefono`.
- `CANAL`: `CANAL_ESPECIFICO`; si está vacío, `CANAL`; si ambos están vacíos, «Sin canal».
- `CAMPANA`: «Sin campaña» si viene vacía, «NINGUNA CAMPAÑA» o «NO SE VISUALIZA CAMPAÑA».
  Cualquier otro valor se guarda tal cual, sin espacios sobrantes.
- `DNI_PACIENTE` y `EMPAREJAMIENTO`:
  - **Por DNI:** si el DNI del lead existe en `CITAS` → ese DNI, `POR DNI`.
  - **Por nombre:** si no, `emparejar(NOMBRE)` (las mismas reglas que con hierro: al menos dos
    palabras y un único candidato) → `AUTOMÁTICO`.
  - **Si no:** `DNI_PACIENTE` vacío y `SIN CANDIDATO` o `POR CONFIRMAR`. Estos no se usan.

## 4. Teléfonos

`armarPacientes` recibe los contactos además de las indicaciones. Los teléfonos de un
paciente son la unión, sin repetidos, de:

- los teléfonos de `INDICACIONES` con su DNI;
- los teléfonos de `CONTACTOS_CRM` con `DNI_PACIENTE` igual a su DNI.

Primero van los de indicaciones, después los del CRM.

## 5. Atribución y medición por campaña

### 5.1 Atribución

- **Primera consulta:** la fecha de la primera cita realizada del DNI (en cualquier especialidad).
- **Inicio del CRM:** la fecha del lead más antiguo de `CONTACTOS_CRM`. Así se deduce solo,
  sin configurarlo.
- **Pacientes con primera consulta anterior al inicio del CRM:** quedan **fuera** de la medición.
- **Los demás:**
  - **Lead elegido:** el de fecha más reciente con `FECHA ≤ primera consulta` entre los emparejados
    a su DNI. Si hay empate de fecha, gana el `ID_LEAD` mayor.
  - **Sin ningún lead:** canal y campaña «Sin lead en el CRM».

### 5.2 Medición (`kpiCampanas`)

- **Qué se mide:** para cada paciente atribuido, si **volvió a su 1.ª reevaluación** en la especialidad
  de su primera consulta.
- **Cuándo cuenta:** solo los «maduros», es decir, los que ya volvieron o a los que ya se les venció
  el plazo. Los demás cuentan como **en curso**.

Devuelve una fila por mes de primera consulta, médico de esa consulta, canal y campaña:

`{ MES, MEDICO, CANAL, CAMPANA, NUEVOS, EN_CURSO, VOLVIERON }`

La app suma según los filtros. Porcentaje = VOLVIERON / (NUEVOS − EN_CURSO).

### 5.3 Pantalla (Detalle)

Nueva sección **«¿Qué campañas traen pacientes que vuelven?»**:

- **Explicación:** «Pacientes nuevos desde que existe el CRM, según el último anuncio o canal por el que
  escribieron antes de su primera consulta.»
- **Dos tablas: por canal y por campaña.**
  - Columnas: Pacientes nuevos · Volvieron a su 1.ª reevaluación (% y barra) · En curso.
  - Orden: de más a menos pacientes.
- **Filtros:** respeta los de mes (de la primera consulta) y médico del Detalle. El filtro de especialidad no
  la cambia, y se avisa en la explicación.

## 6. Actualización diaria y errores

- **`actualizar_()`** lee primero el CRM y después hace lo de siempre (Hoja 1 → CITAS →
  emparejamientos → PACIENTES → KPI).
- **Si el CRM no se puede abrir o le falta una columna obligatoria:**
  - se **conserva** la `CONTACTOS_CRM` anterior;
  - el resto se actualiza igual;
  - el mensaje y la `BITACORA` dicen «CRM no leído: …».
- **Menú nuevo «Activar actualización diaria (7:00)»:**
  - borra cualquier activador anterior de la misma función y crea uno diario a las 7:00
    (`America/Lima`) que llama a `actualizacionDiaria()`;
  - pulsarlo dos veces no duplica el activador.
- **`actualizacionDiaria()`:** lo mismo que «Actualizar», pero sin ventanas. Toma el candado, y si
  otra persona está guardando, lo intenta al día siguiente. Deja el resultado en `BITACORA`
  con el usuario «AUTOMÁTICO».
- **Manifiesto:** se añade el permiso `https://www.googleapis.com/auth/script.scriptapp`. Google
  pedirá autorizar una vez más.
- **`prepararHojas`** crea `CONTACTOS_CRM` si no existe.

## 7. Funciones

| Dónde | Función |
|---|---|
| `Logica.gs` | `contactosDesdeCrm(encabezado, filas) → { contactos, faltantes }` |
| `Logica.gs` | `emparejarContactos(contactos, citas) → número de emparejados` |
| `Logica.gs` | `atribuirCampanas(citas, contactos) → { [dni]: { CANAL, CAMPANA, ID_LEAD } }` |
| `Logica.gs` | `kpiCampanas(citas, contactos, reglas, hoy) → filas` (se añade a `calcularKpi` como `campanas`) |
| `Logica.gs` | `armarPacientes(…, contactos)`: nuevo parámetro opcional al final |
| `Codigo.gs` | `CONFIG.CRM_ID`, `leerContactos_()`, `datos_()` con contactos |
| `Menu.gs` | `traerCrm_()`, `actualizacionDiaria()`, `activarDiaria()`; menú nuevo |

## 8. Pruebas

**Lógica**, con datos inventados:
- columnas por nombre y columna faltante;
- normalización de canal y campaña;
- lead sin DNI ni nombre descartado;
- emparejamiento por DNI, por nombre y dudoso;
- teléfonos sin repetir;
- atribución al lead más reciente anterior a la primera consulta, y no a uno posterior;
- paciente anterior al CRM excluido;
- paciente sin lead;
- maduro / en curso.

**Menú**, con dobles de `SpreadsheetApp`, `ScriptApp` y `LockService`:
- `activarDiaria` no duplica el activador;
- si el CRM falla, `CONTACTOS_CRM` no se reescribe y el resto sí.

**Interfaz:** la sección nueva del Detalle aparece en modo DEMO y responde al filtro de médico.

## 9. Fuera de alcance

- Confirmar a mano leads dudosos.
- Usar los leads que solo tienen teléfono. Podrían unirse por teléfono con la base de hierro, pero
  es otra mejora.
- Medir por campaña el hierro o los procedimientos (solo se mide el retorno a la 1.ª reevaluación).
- Escribir cualquier dato en el CRM.
