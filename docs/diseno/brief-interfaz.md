# Seguimientos CHP — Encargo de diseño de interfaz

> Documento para pedir **propuestas alternativas de interfaz**. Describe qué es la
> plataforma, quién la usa, qué muestra cada pantalla, con qué datos y qué
> restricciones técnicas debe respetar el diseño. Las capturas de la versión actual
> están en esta misma carpeta (`actual-*.png`). Todos los nombres, DNI y teléfonos
> de las capturas y de los ejemplos son **inventados**.

---

## 1. Qué es y para qué sirve

**Centro Hematológico del Perú.** Todo paciente que viene a su primera consulta
debería volver a su **1.ª reevaluación**, luego a la 2.ª, y así sucesivamente. Muchos
no vuelven y nadie lo nota a tiempo: de los pacientes nuevos de enero a setiembre de
2026, **solo un 33 % volvió**. Además, a muchos pacientes el médico les indica
**hierro endovenoso (Ferinject)** u **otros procedimientos** (aspirado de médula ósea
[AMO], biopsia, citometría de flujo), y algunos los cotizan y nunca se los hacen.

La plataforma tiene tres objetivos:

1. **Detectar** a quién le tocaba volver y no volvió, y quién cotizó un procedimiento y no se lo hizo.
2. **Darle a una persona los datos para escribirle** al paciente (nombre, teléfono, médico,
   qué tiene pendiente). **No hay integración con WhatsApp**: la persona escribe por su
   cuenta y luego marca **«Seguimiento hecho»**.
3. **Medir** por mes y por médico qué porcentaje de pacientes se pierde y cuántos
   se recuperan después del seguimiento.

**Escala real hoy:**
- 1.289 series (paciente + especialidad).
- **≈800 pacientes que no volvieron.**
- Solo **≈20 % de ellos tienen teléfono conocido**. SOFDOC, el sistema de citas, no lo
  exporta; sale de otra base. «Sin teléfono» es un caso frecuente, no excepcional.

## 2. Quién la usa y cómo

| Usuario | Qué necesita | Frecuencia |
|---|---|---|
| **Magaly, Ana, Rachel** (asesoras de atención) | Una lista de trabajo diaria: a quién escribir hoy, copiar el teléfono, marcar «hecho» o «descartar». | Todos los días, varias horas, en computadora |
| **Dr. Eli Cabanillas** (médico hematólogo, dueño del centro) | Ver **sus** pacientes perdidos de un vistazo: cuántos, qué porcentaje, por mes. A veces escribe él mismo a sus pacientes. | Varias veces por semana, a menudo en **celular** |

- **Identidad:** no hay login. Google no le dice a la app quién la usa, así que cada
  persona elige su nombre en un selector «¿Quién es usted?» y la app lo recuerda.
- **Médicos:** cuando quien entra es un médico, la app se abre en el **Resumen** y
  filtrada en sus pacientes.

## 3. Glosario: los términos que confundieron al equipo

El equipo **no** es técnico. En la primera versión se confundieron con estas palabras;
la interfaz debe evitarlas o explicarlas siempre:

| Evitar | Usar en su lugar |
|---|---|
| «Cohorte» | «Pacientes nuevos de julio 2026» |
| «Días de atraso» | «Debía volver el 04/09/2026 · hace 27 días que no vuelve» |
| «Reevaluación» y «procedimiento» mezclados | Son **dos cosas distintas**, con color distinto. **Reevaluación** = volver a consulta con el médico. **Procedimiento** = hierro, AMO, biopsia… que el paciente cotizó. |
| «Indicación», «tasa», «conversión» | «Procedimiento», «porcentaje», «volvieron» |
| Estados internos (VENCIDO, CONTACTADO…) | «No volvió», «Se le escribió, esperando respuesta»… (ver §6) |

**Tres tipos de caso** que el diseño debe distinguir al instante:
- 🔵 **Paciente nuevo**: vino a su primera consulta y **no volvió a su 1.ª reevaluación**.
- 🟣 **Paciente en control**: ya venía, pero **faltó a su 2.ª, 3.ª… reevaluación**.
- 🟠 **Procedimiento pendiente**: además, cotizó hierro (Ferinject) u otro procedimiento y
  no se lo hizo. Puede combinarse con cualquiera de los dos anteriores.

## 4. Pantallas actuales

Navegación: **barra lateral** granate con 4 secciones, el selector «¿Quién es usted?» y
un botón de modo claro/oscuro. En celular la barra pasa arriba.

### 4.1 Resumen *(captura `actual-2-resumen.png`)*

Para el médico. Arriba hay filtros de **mes** y **médico**. Luego vienen **4 tarjetas**,
cada una con un porcentaje grande, «X de Y pacientes» y una explicación de una línea:

1. **No volvieron a su reevaluación**, separando nuevos y en control.
2. **No siguieron el hierro (Ferinject).**
3. **No siguieron otros procedimientos.**
4. **Volvieron después del seguimiento** (la métrica positiva).

Debajo, una tabla **«Mes a mes»** de los últimos 6 meses con esas mismas cifras.

**Regla del mes:** un paciente que no volvió cuenta en el **mes de su última consulta**.
Los meses recientes tienen pacientes **«en curso»**, a los que aún no les toca volver;
no cuentan todavía en el porcentaje. El diseño debe mostrar que un mes está
**incompleto** sin que parezca un error.

### 4.2 Bandeja del día *(capturas `actual-1-bandeja.png`, `actual-5-movil.png`)*

La lista de trabajo de las asesoras.

- **Arriba, tres contadores:** por atender, seguimientos hechos hoy, recuperados este mes.
- **Filtros:** especialidad, médico, «solo sin teléfono».
- **Una tarjeta por paciente**, con:
  - Nombre, en grande y clicable, que abre su ficha.
  - Etiqueta de tipo de caso (🔵 / 🟣) y, si aplica, 🟠 «Procedimiento pendiente».
  - DNI · especialidad · médico.
  - Teléfono(s) con botón **Copiar**, o la etiqueta «Sin teléfono».
  - «Última consulta 05/08/2026 · **Debía volver el 04/09/2026** · hace 27 días que no vuelve».
  - El detalle del pendiente: «Hierro (Ferinject) ×2: cotizó y no lo hizo».
  - Si ya se le escribió antes: «Ya se le escribió 1 vez · la última el 10/09/2026».
  - Un campo de nota opcional.
  - Botones **«Seguimiento hecho»** (principal) y **«Descartar»** (secundario; abre un
    diálogo con motivo obligatorio: se atiende en otro lugar, número equivocado, ya no lo
    necesita, falleció, otro).
- **Al marcar «hecho»**, la tarjeta sale de la bandeja. El paciente vuelve a aparecer a los
  15 días si no sacó cita. Al tercer intento sin respuesta se descarta solo.
- **Orden:** primer intento antes que reintentos; con procedimiento pendiente primero;
  luego los que menos días llevan sin volver (son los más recuperables).

### 4.3 Buscar paciente / Ficha *(captura `actual-3-ficha.png`)*

- **Buscador** por DNI o nombre.
- **La ficha muestra:**
  - Nombre y DNI.
  - **Por cada especialidad:** estado en palabras, tipo de caso, teléfonos, procedimiento
    pendiente y una **línea de tiempo** (Primera cita → Reevaluación 1 → … → «Debía volver
    el …»).
  - Tabla de **procedimientos indicados**: fecha, tipo, detalle, «Cotizó, no lo hizo» / «Lo hizo», teléfono, observaciones.
  - Tabla de **seguimientos**: fecha, quién, acción, motivo, nota.
  - Cuando el nombre de una cotización coincide con varios pacientes, un bloque
    **«¿Es esta la misma persona?»** con botones para elegir el paciente correcto.

### 4.4 Detalle *(captura `actual-4-detalle-oscuro.png`)*

Para análisis. Filtros de mes, especialidad y médico.

- **¿Vuelven los pacientes nuevos?** Pacientes nuevos agrupados por mes de primera
  consulta, con el % que volvió a la 1.ª, 2.ª y 3.ª reevaluación. Cada cifra lleva su barra.
- **Procedimientos (hierro y otros):** cotizados contra realizados, por procedimiento y por médico.
- **Recuperación:** seguimientos hechos y cuántos volvieron, en cuántos días (mediana),
  por responsable y por mes.
- **Motivos de descarte.**
- **Procedimientos sin paciente:** cotizaciones cuyo nombre no se encontró en SOFDOC.

## 5. Datos disponibles por paciente (para diseñar con datos reales)

| Campo | Ejemplo |
|---|---|
| Nombre, DNI | ROSA ELENA QUISPE HUAMÁN · 40111222 |
| Especialidad | HEMATOLOGÍA (95 % de los casos), reumatología, endocrinología, nutrición… |
| Médico de la última consulta | Dr. ELÍ FABRIZIO CABANILLAS HUALPA |
| Teléfonos | 987654321 (0, 1 o varios) |
| Primera consulta, última consulta, nº de consultas | 10/06/2026 · 05/08/2026 · 2 |
| Debía volver el / plazo máximo | 04/09/2026 / 19/09/2026 (30 y 45 días, configurables por especialidad) |
| Días sin volver | 27 |
| Estado | ver §6 |
| Seguimientos previos | 0–3, con fecha del último |
| Procedimiento pendiente | «Hierro (Ferinject) ×2: cotizó y no lo hizo» |

## 6. Estados de un paciente (texto que ve el usuario)

| Interno | Lo que se muestra | ¿En la bandeja? |
|---|---|---|
| VENCIDO | **No volvió** | Sí |
| POR VENCER | Le toca volver pronto | No |
| AL DÍA | Al día | No |
| CONTACTADO | Se le escribió, esperando respuesta | No (vuelve a los 15 días) |
| RECUPERADO | Volvió tras el seguimiento | No |
| AGENDADO | Ya tiene cita | No |
| DESCARTADO | Descartado | No |
| ANTIGUO | No vuelve hace más de 6 meses | No (solo en estadísticas) |

## 7. Identidad visual actual

- **Paleta institucional:** granate `#6F1713` (marca, barra lateral) y hueso `#FAF6F1` (fondos de tarjeta).
  - Acento de texto y botones principales: `#A8352C`.
  - Fondo general: `#EFE7DE`.
  - Verde para lo positivo: `#2F6B45`.
  - Ámbar para lo pendiente: `#B26B00`.
  - Azul para «paciente nuevo»: `#1F5A8C`.
  - Morado para «en control»: `#6A3D8F`.
- **Modo oscuro** completo: fondo casi negro granate `#150A0A`, tarjetas `#24100F`, acento `#E0736B`.
- **Tipografía:** *Barlow* para el texto y *Barlow Condensed* para títulos y cifras grandes (Google Fonts).
- **Tono:** sobrio, clínico pero cálido; nada de colores chillones ni estética de «startup».

## 8. Restricciones técnicas (el diseño debe poder construirse así)

- **Un único archivo HTML** (`Index.html`) servido por Google Apps Script
  (HtmlService). CSS y JavaScript van dentro del mismo archivo. Se pueden cargar
  fuentes de Google y librerías ligeras desde CDN si hiciera falta, pero hoy no se usa
  ningún framework (JavaScript simple).
- **Colores solo como variables CSS** (`--chp-*`) definidas una vez para modo claro y otra
  para oscuro. Ningún color escrito a mano en el resto del CSS.
- **Funciona en celular** (≈390 px de ancho) **y en computadora**, sin scroll horizontal.
- **Idioma:** todo en **español** (Perú). Fechas `dd/mm/aaaa`. Meses en minúscula, con
  «setiembre» (sin p).
- **Datos:** la app llama a funciones del servidor que devuelven JSON (`getBandeja`,
  `getPaciente`, `getResumen`, `getKpi`…). Cada llamada tarda 1–3 s, así que hacen falta
  estados de **cargando**, **vacío** y **error**.
- **Accesibilidad básica:** contraste suficiente en ambos modos, foco visible,
  botones grandes para dedos en celular.

## 9. Lo que se pide

Proponer **2 o 3 modelos de interfaz alternativos** a la actual, para las 4 pantallas
(o al menos Resumen y Bandeja, que son las más usadas). En cada propuesta, mostrar:

1. **Cómo se ve la jornada de una asesora:** encontrar a quién escribir, copiar el
   teléfono y marcar «hecho» en el menor número de clics. Considerar una vista de
   **lista compacta** además de tarjetas: con 800 pacientes, las tarjetas grandes
   obligan a hacer mucho scroll.
2. **Cómo ve el Dr. Eli sus números en el celular** en menos de 10 segundos.
3. **Cómo se distinguen** paciente nuevo / en control / procedimiento pendiente sin leer.
4. **Cómo se comunica** un mes «en curso» (cifras aún incompletas).
5. **Cómo se ve** «sin teléfono», con 1 teléfono y con varios.
6. **Modo claro y oscuro.**

**Ideas abiertas** que vale la pena explorar (opcionales):
- La bandeja agrupada por urgencia («esta semana», «este mes», «más antiguos»).
- Un gráfico de tendencia mensual en el Resumen.
- Atajos de teclado para las asesoras.
- Una vista por médico que compare a los médicos entre sí.

**Lo que no debe cambiar:**
- Sin WhatsApp integrado.
- Seguir pidiendo «¿Quién es usted?».
- Mantener la paleta granate/hueso como identidad.
- Todo en español sencillo, sin jerga.
