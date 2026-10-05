# Pestaña Registro y arquitectura del libro madre — Diseño

- Fecha: 05/10/2026
- Estado: **borrador para revisión**
- Amplía: `2026-10-01-plataforma-seguimientos-design.md` y `2026-10-03-filtro-tipos-y-resumen-3a-design.md`
- Libro madre: **BD SOFDOC SEGUIMIENTOS** (`1L8fY-NXWE1agakIPEdqoLnLry0-lvYr0Z-9JfsfGxRM`)

## 1. Para qué

Hoy los procedimientos y los tratamientos de hierro se anotan en un Excel aparte y llegan a la
plataforma emparejados **por nombre**. Desde esta versión, las asesoras registran **solo en la
plataforma**, en una pestaña nueva, **Registro**. Esa pestaña escribe en el libro madre y deja
trazabilidad completa:

- **El DNI desde el origen**, sin emparejar por nombre.
- **Quién registró, qué doctor lo indicó y cuándo.**
- **Cada sesión del tratamiento**, con su fecha y con quién la marcó.

## 2. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Estado de una indicación | Se registra como **cotizada**. Cuando el paciente lo hace, se marca con un botón **«Lo hizo»** (opción A) |
| Marcas de hierro | Cada tratamiento muestra **solo sus marcas**: carboximaltosa → Ferinject o Likfer; derisomaltosa → Monofer; sacarato, sin marca. Todo tratamiento pide número de sesiones |
| Sesiones | **«Lo hizo» se marca por sesión.** El paciente sigue en la bandeja hasta la última dosis. Si pasan 7 días sin la sesión siguiente, vuelve a aparecer |
| Dónde se guarda | Dos hojas nuevas, `REGISTROS` y `SESIONES`, en el libro madre (camino 1). `INDICACIONES` se congela como historial |
| Excel aparte | **Se deja de usar.** Solo se registra en la plataforma |
| Cuándo entra un cotizado en la bandeja | A los **7 días** sin «Lo hizo» (`ESPERA_COTIZACION_DIAS`) |

## 3. Arquitectura del libro madre

**Cada pestaña tiene un solo dueño:** o la escribe una persona (desde la app o a mano), o la
escribe el script, nunca los dos. **Los estados no se guardan: se calculan** a partir de los
hechos registrados.

| Rol | Pestaña | Quién la escribe | Contenido |
|---|---|---|---|
| Entrada | `Hoja 1` | Usted, pegando la exportación de SOFDOC | Citas tal como salen de SOFDOC |
| Entrada | `REGISTROS` *(nueva)* | La app: pestaña Registro | Una fila por indicación |
| Entrada | `SESIONES` *(nueva)* | La app: botón «Lo hizo» | Una fila por sesión hecha |
| Entrada | `SEGUIMIENTOS` | La app: «Seguimiento hecho» y «Descartar» | Igual que hoy, con la columna nueva `REFERENCIA` |
| Configuración | `REGLAS`, `CATALOGOS` | A mano | Plazos, parámetros y listas |
| Copia del script | `CITAS`, `CONTACTOS_CRM`, `PACIENTES`, `KPI` | El script, al pulsar «Actualizar» | Igual que hoy. No se editan |
| Historial | `INDICACIONES` | Nadie (congelada) | Lo anterior al Registro. Sigue contando en la bandeja y en las cifras |
| Auditoría | `BITACORA` | La app | Cada registro, cada sesión, cada anulación y cada seguimiento |

### 3.1 `REGISTROS`

`ID, FECHA_HORA, FECHA, ASESORA, DOCTOR, NOMBRE, DNI, CONTACTO, TIPO, DETALLE, MARCA, SESIONES, ANULADO, MOTIVO_ANULACION`

- **`ID`:** `REG-000001`, correlativo, asignado dentro del candado.
- **Fechas:**
  - `FECHA_HORA`: cuándo se guardó.
  - `FECHA`: la de la indicación, tomada del formulario.
- **`TIPO`:**
  - **`PROCEDIMIENTO`:** `DETALLE` es el procedimiento y `SESIONES` = 1.
  - **`HIERRO`:** `DETALLE` es el tratamiento y `SESIONES` va de 1 a N.
- **Procedimiento y tratamiento juntos:** si un formulario trae los dos, se escriben **dos filas** con la
  misma `FECHA_HORA`.
- **Anulación:**
  - `ANULADO` vale `SÍ` o queda vacío. Una fila nunca se borra.
  - **Al anular** también se anulan sus sesiones, que dejan de contar.
- **Valores fijos:** lo indicado no se modifica después. Para corregirlo se anula y se registra de nuevo.

### 3.2 `SESIONES`

`ID, FECHA_HORA, ID_REGISTRO, NUMERO, FECHA, ASESORA, NOTA, ANULADO, MOTIVO_ANULACION`

- **`NUMERO`:** 1, 2, 3…, el que le toca. No puede pasar de las `SESIONES` indicadas.
- **`FECHA`:** la de la sesión. No puede ser futura ni anterior a la `FECHA` del registro.

### 3.3 Estado calculado de un registro

Solo cuentan las sesiones no anuladas:

| Estado | Condición |
|---|---|
| ANULADO | `ANULADO` = SÍ |
| COMPLETO | sesiones = `SESIONES` indicadas |
| EN CURSO | entre 1 y `SESIONES` − 1 |
| COTIZADO | 0 sesiones |

### 3.4 `CATALOGOS`: columnas nuevas

Las listas iniciales salen de la imagen del flujo:

- **`DOCTOR` y `DOCTOR_SOFDOC`**, dos columnas lado a lado:
  - **`DOCTOR`:** lo que ve la asesora en el formulario y lo que se guarda en `REGISTROS`.
  - **`DOCTOR_SOFDOC`:** cómo aparece ese médico en `CITAS`. Sirve para los filtros por médico, para
    proponer el doctor de la última consulta y para atribuir las cifras.
  - **Si `DOCTOR_SOFDOC` está vacío** (un médico que aún no tiene citas en SOFDOC), las cifras usan
    `DOCTOR` tal cual.

  | DOCTOR | DOCTOR_SOFDOC |
  |---|---|
  | Dr. Elí Cabanillas | Dr. ELÍ FABRIZIO CABANILLAS HUALPA |
  | Dra. Alejandra La Torre | Dra. ALEJANDRA LA TORRE MATUK |
  | Dr. Víctor Seminario | Dr. VICTOR ERNESTO SEMINARIO MARCELO |
  | Dr. Álvaro Villanueva | *(vacío: no aparece en las citas exportadas hasta hoy)* |
  | Dra. Karen Matos | Dra. KAREN DIANA MATOS PEÑA |
  | Dra. Karen Matos – Particular | Dra. KAREN DIANA MATOS PEÑA |
  | Dr. Iván Pacheco | Dr. IVAN PAOLO PACHECO MODESTO |

  «Particular» queda guardado en el registro, para distinguirlo, pero en las cifras cuenta como la
  Dra. Matos.
- **`PROCEDIMIENTOS`:** SANGRÍA, AMO, BIOPSIA, CITOMETRÍA DE FLUJO, CARIOTIPO, TRANSFUSIÓN DE SANGRE.
- **`TRATAMIENTOS`:** HIERRO SACARATO, HIERRO DERISOMALTOSA, HIERRO CARBOXIMALTOSA.
- **`MARCAS`**, con el formato `TRATAMIENTO | MARCA`:
  - `HIERRO CARBOXIMALTOSA | FERINJECT`
  - `HIERRO CARBOXIMALTOSA | LIKFER`
  - `HIERRO DERISOMALTOSA | MONOFER`

  Un tratamiento sin ninguna fila en `MARCAS` no pide marca.

### 3.5 `REGLAS`: parámetros nuevos

| Parámetro | Valor | Para qué |
|---|---|---|
| `ESPERA_COTIZACION_DIAS` | 7 | Días sin «Lo hizo» antes de que un cotizado aparezca en la bandeja |
| `DIAS_ENTRE_SESIONES` | 7 | Días después de la última sesión antes de que «sesión k de N pendiente» aparezca en la bandeja |

### 3.6 `SEGUIMIENTOS`: columna nueva `REFERENCIA`

- **Qué guarda:** el `ID` del registro (`REG-…`) cuando el seguimiento es de un registro. Queda
  vacía para reevaluaciones y para lo histórico.
- **Cómo se agrega:** va al final de `COLUMNAS_SEGUIMIENTOS`. «Preparar hojas» agrega el encabezado
  si falta, porque `anexarObjeto_` escribe por posición.

## 4. Pantalla Registro

Es una pestaña nueva de la barra, **Registro**, con estilo editorial y en una sola columna. El
orden es el de la imagen.

**1. Datos del paciente** (obligatorios)
- **DNI primero.** Acepta 8 dígitos (DNI) o de 9 a 12 caracteres alfanuméricos (carné de
  extranjería). Al completarlo, la app busca en `CITAS`:
  - **Si lo encuentra:** completa el nombre, sugiere el teléfono conocido y propone el doctor de la
    última consulta. Muestra «Paciente conocido · última consulta dd/mm/aaaa con Dr. X». Todo se
    puede corregir.
  - **Si no lo encuentra:** muestra «Todavía no está en SOFDOC» y deja continuar.
- **Nombres y apellidos.**
- **Teléfono o usuario:** texto libre.
- **Fecha:** hoy por omisión. No puede ser futura.
- **Asesora:** sale del selector «¿Quién es usted?», no se escribe de nuevo.

**2. Doctor:** la columna `DOCTOR` de `CATALOGOS`. Si el DNI es conocido, propone el `DOCTOR`
cuyo `DOCTOR_SOFDOC` coincide con el médico de la última consulta.

**3. Procedimiento (opcional):** la lista `PROCEDIMIENTOS`.

**4. Tratamiento (opcional):** la lista `TRATAMIENTOS`. Al elegirlo aparecen:
- **«¿Cuántas sesiones?»:** 1, 2, 3, 4, 5 u «Otro». «Otro» abre una casilla para un número del 6 al 20.
- **«Marca»:** solo las de ese tratamiento. Es obligatoria si el tratamiento tiene marcas.

Hace falta **al menos uno**, procedimiento o tratamiento.

**Al pulsar «Registrar»**

1. **El servidor revisa lo mismo que la pantalla, con `validarRegistro`.** Rechaza:
   - un campo obligatorio vacío;
   - una fecha futura;
   - un doctor, procedimiento, tratamiento o marca fuera del catálogo;
   - una marca que no corresponde al tratamiento;
   - sesiones fuera del rango 1–20;
   - una asesora que no está en `USUARIOS`.
2. **Posible duplicado.** Si el mismo DNI tiene la misma indicación (mismo `TIPO` y `DETALLE`), sin
   anular, en los últimos 7 días, la app pregunta «Ya se registró el dd/mm (REG-…). ¿Registrar de todos
   modos?». Al confirmar se reenvía con `confirmado: true`.
3. **Escritura.** Va dentro de `LockService`, con IDs correlativos, fechas a mediodía y textos por
   `textoSeguro`. Deja una línea en `BITACORA` por fila.
4. **Confirmación.** Muestra, por ejemplo, «Registrado: Hierro carboximaltosa · Ferinject × 3 sesiones —
   NOMBRE · REG-000123». Limpia el formulario, salvo la asesora y la fecha.

**Si falla**, el formulario no se borra y aparece «No se guardó: …».

**«Registrados hoy».** Debajo del formulario, la lista de lo registrado en el día: hora, asesora,
paciente e indicación. Cada fila tiene un botón **Anular**, con motivo obligatorio.

## 5. Bandeja, ficha y «Lo hizo»

### 5.1 Qué entra en la bandeja

Los registros se suman a las listas **Hierro** y **Procedimientos**, una fila por registro (clave
`REG-…`).

**Registro COTIZADO.** Entra si `hoy − FECHA ≥ ESPERA_COTIZACION_DIAS`:
- Texto: «Hierro carboximaltosa · Ferinject × 3 · Dr. X · cotizó el dd/mm · hace N días».
- Días que se muestran: desde la `FECHA` del registro.

**Registro EN CURSO.** Entra si `hoy − fecha de la última sesión ≥ DIAS_ENTRE_SESIONES`:
- Texto: «Ferinject · sesión k+1 de N pendiente · última el dd/mm · hace N días».
- Días que se muestran: desde la última sesión.

**Seguimientos.** «Seguimiento hecho» y «Descartar» funcionan igual que hoy:
- Se guardan con `ESPECIALIDAD` = TIPO y `REFERENCIA` = ID del registro.
- **Los intentos** se cuentan desde la `FECHA` del registro, si es cotizado, o desde la última sesión, si
  está en curso.
- **Los estados** se aplican igual: CONTACTADO durante la espera, y DESCARTADO por motivo o por llegar a
  `MAX_SEGUIMIENTOS` intentos sin respuesta.
- **Límite de antigüedad:** `CORTE_INDICACIONES_DIAS` sigue aplicando, contado desde la misma fecha.

**Historial.** Las filas de `INDICACIONES` siguen saliendo como hoy (`pendientesIndicacion`, con clave
DNI + tipo).

### 5.2 «Lo hizo»

**Dónde está**
- **En el panel de la bandeja**, en cualquier fila de un registro.
- **En la ficha del paciente.** La ficha muestra cada registro con su avance, por ejemplo «sesión 1 ✓
  02/10 · sesión 2 pendiente», y botones para:
  - **«Lo hizo»**, aunque el registro no esté en la bandeja;
  - **anular el registro**;
  - **anular una sesión.**

**Qué pide:** la fecha (hoy por omisión) y una nota opcional.

**Qué guarda:** escribe en `SESIONES` el número que le toca, dentro del candado.

**Qué rechaza** (con `validarSesion`):
- un registro anulado o completo;
- una fecha futura o anterior a la `FECHA` del registro;
- una fecha anterior a la sesión previa.

**Al guardarla:** el registro sale de la bandeja al instante, con el mismo comportamiento optimista de
«Hecho».

### 5.3 Teléfonos

- **`CONTACTO`** se suma a `telefonosPorDni` cuando, al normalizarlo, queda un número de 9 dígitos.
- **Si no es un número**, se muestra en el panel como «Usuario: …», sin botón de copiar.

## 6. Cifras

Para medir, los registros se convierten a indicaciones con esta equivalencia:

| Registro | Equivale en el historial |
|---|---|
| COTIZADO | `COTIZÓ` |
| EN CURSO o COMPLETO | `ACEPTÓ` |
| ANULADO | No cuenta |

**Médico:** el `DOCTOR_SOFDOC` que corresponde al `DOCTOR` del registro. Si está vacío, el `DOCTOR` tal cual.

**Resumen**
- «No siguieron el hierro» y «No siguieron otros procedimientos» se calculan como hoy, con esa
  equivalencia. Un registro todavía dentro de su espera de 7 días no cuenta como «no siguió».
- **Métrica nueva: «completaron el tratamiento»**, de los hierros que empezaron, cuántos llegaron a
  todas sus sesiones. Responde a la pregunta 9b del doctor. Lo histórico `ACEPTÓ` cuenta como completo,
  porque no hay sesiones de esa época.

**Detalle**
- La sección «Procedimientos (hierro y otros)» pasa a tener las columnas **Cotizados · Empezaron ·
  Completaron**, por tipo y por médico.

## 7. Funciones

| Dónde | Función |
|---|---|
| `Logica.gs` | `COLUMNAS_REGISTROS`, `COLUMNAS_SESIONES` |
| `Logica.gs` | `catalogosDesdeFilas`: añade `doctores` (`[{ doctor, sofdoc }]`), `procedimientos`, `tratamientos` y `marcas` (`{ tratamiento: [marcas] }`) |
| `Logica.gs` | `validarRegistro(p, catalogos, hoy) → { error, filas }`: devuelve las 1 o 2 filas listas, sin `ID` |
| `Logica.gs` | `duplicadoReciente(registros, fila, hoy) → registro o null` |
| `Logica.gs` | `estadoRegistro(registro, sesiones) → { estado, hechas, ultima }` |
| `Logica.gs` | `validarSesion(registro, sesiones, fecha, hoy) → error` |
| `Logica.gs` | `pendientesRegistro(registros, sesiones, seguimientos, citas, reglas, hoy, contactos) → filas de bandeja`, con la misma forma que `pendientesIndicacion` más `ID_REGISTRO`, `SESIONES`, `HECHAS` y `ULTIMA_SESION` |
| `Logica.gs` | `indicacionesDeRegistros(registros, sesiones) → indicaciones`, para las cifras |
| `Logica.gs` | `reglasDesdeFilas`: añade `esperaCotizacion` y `diasEntreSesiones` |
| `Codigo.gs` | `guardarRegistro(p)`, `marcarSesion(p)`, `anularRegistro(p)`, `anularSesion(p)` y `getRegistrosHoy()` |
| `Codigo.gs` | `bootstrap` envía los catálogos nuevos; `buscarPacienteRegistro(dni)` devuelve nombre, teléfonos, último médico y última fecha |
| `Codigo.gs` | `datos_()` lee `REGISTROS` y `SESIONES` (vacías si las hojas no existen todavía) |
| `Codigo.gs` | `getPaciente` añade los registros con su avance |
| `Menu.gs` | `prepararHojas`: hojas, columnas y parámetros nuevos sin tocar lo existente |
| `Menu.gs` | `verificar`: revisa todo eso |
| `Menu.gs` | Se quita «Importar hierro y procedimientos» del menú |
| `Index.html` | Pestaña Registro, «Lo hizo» en el panel y en la ficha, filas de registro en la bandeja, métrica nueva en Resumen y columnas nuevas en Detalle. El DEMO se amplía con registros y sesiones inventados |

## 8. Puesta en marcha

1. Publicar (`npm run actualizar`).
2. Menú **Preparar hojas.** Crea `REGISTROS` y `SESIONES`, agrega `REFERENCIA` a
   `SEGUIMIENTOS`, agrega las columnas de catálogo con sus listas y agrega los dos parámetros. No toca
   lo existente.
3. Menú **Verificar.**
4. Desde ese día, las asesoras registran **solo en la plataforma**. El Excel aparte se deja de usar.

**Vuelta atrás:** publicar la versión anterior. Las hojas nuevas no estorban.

## 9. Pruebas

Siempre con datos inventados.

**Lógica**
- `validarRegistro`:
  - cada campo obligatorio;
  - fecha futura;
  - catálogo;
  - marca que no corresponde;
  - sesiones fuera de rango;
  - procedimiento + tratamiento → 2 filas.
- `duplicadoReciente`:
  - dentro y fuera de los 7 días;
  - un duplicado anulado no cuenta.
- `estadoRegistro`: cotizado, en curso, completo, anulado y sesión anulada.
- `validarSesion`:
  - completo;
  - anulado;
  - fecha antes del registro;
  - fecha antes de la sesión previa.
- `pendientesRegistro`:
  - entra a los 7 días y no antes;
  - «sesión 2 de 3» a los 7 días de la última;
  - CONTACTADO y DESCARTADO por `REFERENCIA`;
  - el corte por antigüedad.
- `indicacionesDeRegistros` y la métrica «completaron».
- Mezcla con el historial: un DNI con una indicación histórica y un registro produce dos filas, que
  no se pisan.

**Menú**
- `prepararHojas` agrega sin borrar.
- `verificar` avisa si falta una hoja o una columna.

**Interfaz (DEMO)**
- Registro:
  - la marca cambia según el tratamiento;
  - «Otro» pide un número;
  - el DNI conocido completa los datos;
  - el aviso de duplicado;
  - «Registrados hoy» y Anular.
- «Lo hizo» desde el panel y desde la ficha.
- En celular, sin desborde horizontal.

## 10. Fuera de alcance

- Plazo de reevaluación según el diagnóstico: SOFDOC no trae el diagnóstico.
- Modificar una indicación ya registrada. Se anula y se registra de nuevo.
- Mensajes automáticos al paciente: no hay conexión a WhatsApp.
- Migrar el Excel aparte a `REGISTROS`. Lo anterior ya está en `INDICACIONES`, que sigue contando.
