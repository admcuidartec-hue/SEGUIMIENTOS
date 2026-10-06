# Seguimientos CHP: encargo de rediseño del frontend

> **Para Claude Design.** Este documento reúne todo lo decidido con el director médico hasta el
> 06/10/2026. Explica qué hace la plataforma, quién la usa y cómo es el proceso de seguimiento,
> además de qué pantallas hay, con qué datos y bajo qué restricciones técnicas.
>
> El paquete incluye:
> - `maqueta-estilo-A.html`: maqueta interactiva del **tablero**, con el estilo elegido (A).
> - `actual-*.png`: capturas de la app actual.
>
> Todos los nombres, DNI y teléfonos son **inventados**.

---

## 1. El encargo

La app actual funciona bien, pero **se ve genérica y poco profesional**. El objetivo es que se vea
y se sienta como un **producto web profesional**:
- tipografía y espaciado cuidados;
- movimientos y transiciones suaves entre pestañas y estados;
- una jerarquía clara.

Lo que hace hoy la app se mantiene **sin perder ninguna función**.

- **Referencia de sensación:** https://cfanalisis.com/. Al director le gustan sus movimientos y las
  transiciones entre pestañas. No pudimos abrirla desde nuestro entorno; revísenla ustedes.
- **Estilo elegido entre tres propuestas: «A · Clínica clara»** (ver §5 y `maqueta-estilo-A.html`).
- **Se hace en dos etapas** (ver §9). Este encargo cubre **todas las pantallas**, para que el
  sistema visual sea uno solo. La **Etapa 1** (tablero y proceso) es la prioridad.

---

## 2. Producto y usuarios

**Centro Hematológico del Perú.** Todo paciente que viene a su primera consulta debería volver a
su 1.ª reevaluación, luego a la 2.ª, y así. **De cada 100 pacientes nuevos, unos 66 no vuelven
nunca.** Además, a muchos el médico les indica:
- **hierro endovenoso** (sacarato, derisomaltosa o carboximaltosa, en 1 a 5 sesiones o más);
- **procedimientos**: sangría, AMO, biopsia, citometría de flujo, cariotipo, transfusión.

Algunos los cotizan y nunca se los hacen; otros empiezan y no completan las sesiones.

**La plataforma:**
1. **Detecta** a quién le tocaba volver y no volvió, y quién cotizó o empezó un tratamiento y no
   siguió.
2. **Da a la asesora los datos para escribirle**: nombre, teléfono, médico y qué tiene pendiente.
   **No hay integración con WhatsApp**: la asesora escribe por su cuenta y registra el resultado.
3. **Acompaña** al paciente que acepta: cita agendada, sesiones de tratamiento y alta médica.
4. **Mide** por mes y por médico cuántos se pierden, cuántos vuelven y cuántos completan.

**Usuarios.** Tres asesoras (Magaly, Ana y Rachel) y un médico (Dr. Elí Cabanillas). La usan
**todos los días**, en computadora (1366 a 1920 px) y a veces en celular (390 px). No hay inicio de
sesión: cada persona se identifica con un selector «¿Quién es usted?». Cuando el usuario es un
médico, la app filtra sola a **sus** pacientes.

**Escala real:**
- unos 1300 pacientes-especialidad;
- unos 800 por contactar;
- 15 a 30 seguimientos por día.

---

## 3. El proceso de seguimiento (lo central)

### 3.1 Tres tipos de seguimiento

| Tipo | Cuándo entra en «Por contactar» |
|---|---|
| **Reevaluación** | El paciente no volvió en su plazo (unos 45 días desde su última consulta) |
| **Hierro** | Cotizó y no empezó en 7 días, **o** empezó y no hizo la sesión siguiente en 7 días («sesión 2 de 3 pendiente») |
| **Procedimiento** | Cotizó y no lo hizo en 7 días |

### 3.2 «¿Qué pasó?» (lo que registra la asesora al contactar)

Al abrir a un paciente, la pregunta central es **«¿Qué pasó?»**. Los resultados van en dos grupos.

**Sigue en seguimiento:**

| Resultado | Qué hace |
|---|---|
| **No contestó** | Cuenta un intento. Vuelve a la lista en 15 días. Al 2.º intento sin respuesta se cierra solo. |
| **Lo pensará** | Pide **fecha para volver a llamar**. Sale de la lista hasta ese día. |
| **Agendó cita** | Pide **fecha de la cita**. Pasa a «Agendado». Si la fecha pasa sin cita realizada en SOFDOC, vuelve a «Por contactar». |
| **Lo hizo** | Solo hierro y procedimientos. Marca la sesión (fecha). Pasa a «En tratamiento» o, si era la última, a «Completado». |

**Cierra el seguimiento** (pide confirmación):

| Resultado | Qué hace |
|---|---|
| **Alta médica** | Pide doctor y fecha. Es por especialidad. No cuenta como «no volvió». |
| **Número equivocado** | Marca ese teléfono. Si hay otro número, sigue; si no, se cierra. |
| **Se atiende en otro lugar** | Cierra. |
| **Falleció** | Cierra y el paciente no vuelve a aparecer en ninguna lista. |
| **No desea continuar / otro** | Pide motivo y cierra. |

Cada resultado queda en la **historia del paciente**, con quién y cuándo. Por ejemplo:
«01/10 Magaly: no contestó · 04/10 Rachel: agendó para el 12/10».

### 3.3 El recorrido del paciente: tablero de cuatro columnas (pantalla principal)

| Por contactar | Agendado | En tratamiento | Completado / Alta |
|---|---|---|---|
| A quién hay que contactar hoy | Tiene cita, o «lo pensará» con fecha | Hierro en curso: barra de sesiones (2 de 3) y fecha esperada de la próxima; **en rojo si se atrasa** | Lo cerrado en el mes: volvió a su reevaluación, completó el tratamiento, alta médica |

- Los pacientes **se mueven de columna** según lo que registra la asesora o lo que llega de
  SOFDOC. El movimiento debe **verse** (animación de la tarjeta al cambiar de columna).
- Filtros: **Todos · Reevaluaciones · Hierro · Procedimientos** (con su número), médico,
  especialidad y «solo sin teléfono». Un buscador por nombre o DNI.
- **Orden en «Por contactar»:** primero quien nunca recibió un seguimiento; luego quien tiene algo
  pendiente; luego quien lleva menos días (es más fácil de recuperar).
- Con 800 pacientes, «Por contactar» necesita **agrupar** o paginar. Hoy se agrupa en Recientes
  (30 días o menos), Hace 1 a 2 meses y Más antiguos. Proponer la mejor solución.
- Hoy la app tiene **atajos de teclado** (↑ ↓ moverse, Enter abrir, C copiar teléfono, H hecho,
  D descartar), y las asesoras los usan. Mantenerlos o adaptarlos.

---

## 4. Pantallas

Menú lateral: **Tablero · Registro · Pacientes · Indicadores**.

### 4.1 Tablero (Etapa 1)
Lo descrito en §3.3. Arriba:
- un saludo con la fecha;
- **cuatro cifras**: por contactar, agendados, en tratamiento y completados en el mes.

### 4.2 Panel del paciente (se abre al tocar una tarjeta)
- **Encabezado:** nombre, DNI, especialidad, médico y tipo de seguimiento.
- **Datos clave:**
  - reevaluación: última consulta, debía volver el, hace N días;
  - hierro: cotizó el, sesión k de N, última sesión.
- **Teléfonos** con botón **Copiar** (el uso más frecuente). Si el contacto no es un número
  (`@usuario`), se muestra como «Usuario: …».
- **«¿Qué pasó?»** con los dos grupos de §3.2, y el paso de fecha cuando corresponde.
- **Nota** opcional.
- **Historia** del paciente (línea de tiempo).
- Enlace **«Ver ficha completa»**.
- En celular ocupa toda la pantalla con «‹ Volver».

### 4.3 Registro (ya existe; Etapa 2 visual)
Aquí las asesoras registran lo que indica el doctor.

**Dos modos: Indicación · Alta médica.**

**Indicación:**
1. **Paciente:**
   - DNI (al escribirlo completa nombre, teléfono y doctor si el paciente ya existe, y avisa
     «Paciente conocido · última consulta dd/mm con Dr. X»);
   - nombres y apellidos;
   - teléfono o usuario;
   - fecha.
2. **Doctor:** lista.
3. **Procedimiento:** opcional.
4. **Tratamiento:** opcional. Al elegirlo aparecen **¿Cuántas sesiones?** (1 a 5 u «Otro») y la
   **Marca**, solo las de ese tratamiento: carboximaltosa → Ferinject o Likfer; derisomaltosa →
   Monofer; sacarato, sin marca.

**Al registrar:**
- aviso de **posible duplicado** con «Registrar de todos modos»;
- confirmación;
- lista **«Registrados hoy»** con **Anular** (pide motivo).

**Alta médica:** DNI → especialidad (solo las que tiene) → doctor → fecha → nota.

### 4.4 Pacientes: buscar y ficha completa (Etapa 2)
- Buscador por nombre o DNI.
- La **ficha** muestra:
  - cada especialidad con su estado («No volvió», «Al día», «Alta médica»…) y la línea de tiempo
    de consultas;
  - los **tratamientos registrados**, con sus sesiones (Sesión 1 ✓ 05/08 · Sesión 2 pendiente),
    «Lo hizo», «Anular sesión» (solo la última) y «Anular registro»;
  - las **altas médicas**;
  - los procedimientos anteriores a la plataforma;
  - toda la **historia de seguimientos**.

### 4.5 Indicadores (une los actuales «Resumen» y «Detalle»; Etapa 2)

**Resumen del mes:**
- navegación ‹ mes ›;
- filtro de médico;
- una cifra grande: **% que no volvió a su reevaluación** ese mes;
- cuatro cifras secundarias:
  - no siguieron el tratamiento de hierro;
  - completaron el tratamiento de hierro;
  - no siguieron otros procedimientos;
  - volvieron tras el seguimiento;
- la **meta**: que vuelva el 60 %;
- **mes a mes**: barras verticales de los últimos 6 meses, rellenas si el mes está cerrado y
  rayadas si está en curso, con una línea para la meta.

**«¿Hasta dónde llegan los pacientes nuevos?»:**
- un relato en frases simples, por ejemplo «De cada 100 pacientes nuevos, 66 no vuelven nunca…»;
- un **dibujo de 100 cuadritos** de colores;
- una tabla **mes por mes** con barra apilada: no volvió nunca, volvió a 1, a 2, a 3 o más, aún en
  plazo, alta médica.

**Otras secciones:**
- **¿Qué campañas traen pacientes que vuelven?**, por canal y por campaña del CRM de leads;
- **Procedimientos**: cotizados, empezaron, completaron (por tipo y por médico);
- **Recuperación**: seguimientos hechos, volvieron, días;
- **Motivos de cierre**;
- **Procedimientos sin paciente**.

Filtros: mes, especialidad y médico.

---

## 5. Sistema visual: estilo A «Clínica clara» (punto de partida)

Ver `maqueta-estilo-A.html`. Es una maqueta para elegir dirección, no el diseño final: pueden
mejorarla.

- **Estructura:**
  - menú lateral blanco (232 px) con la marca «CHP», el nombre y el usuario abajo;
  - contenido sobre fondo frío muy claro;
  - en celular, el menú lateral se oculta.
- **Tipografía:** **Geist** (Google Fonts) y Geist Mono para cifras. Nada de Inter por defecto.
- **Color**, en tokens:

  | Uso | Color |
  |---|---|
  | Fondo | `#F4F5F7` |
  | Superficies | `#FFFFFF` |
  | Líneas | `#E4E6EB` |
  | Texto | `#15171C` |
  | Acento (granate institucional, solo para lo importante) | `#8C1D18` |
  | Éxito | `#1E7A4C` |
  | Atención / hierro | `#A86400` |
  | Info / agendado | `#2F5BD3` |

  La marca del Centro es **granate `#6F1713`** con hueso: el acento debe seguir siendo granate.
- **Formas:** radio 12 px en tarjetas y cajas, 8 px en controles, pastillas para filtros y
  etiquetas. Sombras suaves teñidas, nunca negras.
- **Íconos:** **Phosphor** (desde unpkg), una sola familia.
- **Movimiento** (motivado, nunca decorativo):
  - pastilla deslizante en los filtros;
  - tarjeta que viaja de columna (técnica FLIP);
  - panel lateral que entra desde la derecha;
  - avisos que suben;
  - realce breve de la tarjeta que llega;
  - curva `cubic-bezier(.2,.8,.2,1)`, 200 a 500 ms;
  - **respetar `prefers-reduced-motion`**.
- **Modo oscuro:** obligatorio, con sus propios tokens (hoy existe con selector «Modo oscuro»).
- **Accesibilidad:** contraste AA, foco visible y teclado completo.

---

## 6. Restricciones técnicas (obligatorias)

- **La app es un solo archivo HTML** (`src/Index.html`) servido por **Google Apps Script**
  (HtmlService) dentro de un iframe. Debe ser **HTML + CSS + JavaScript sin compilar**: nada de
  React, Next ni pasos de compilación.
- Se pueden cargar **fuentes de Google Fonts** y **scripts desde CDN** (unpkg, jsDelivr, cdnjs). No
  hay servidor propio ni archivos de imagen.
- **Los colores viven solo en tokens CSS** (`:root` y el bloque del modo oscuro). Hay una prueba
  automática que falla si aparece un color escrito a mano fuera de ellos.
- La app llama al servidor con `google.script.run` (funciones `getBandeja`, `getPaciente`,
  `marcarSeguimiento`, `guardarRegistro`, `marcarSesion`, `darDeAlta`, `getKpi`, `getResumen`…).
  Al abrir el archivo directamente en el navegador, usa un **modo de demostración** con datos
  inventados (objeto `DEMO` al final). **El diseño debe seguir funcionando en ese modo.**
- Todo el texto en **español**. Fechas `dd/mm/aaaa`. Nada de anglicismos innecesarios.
- Celular de 390 px **sin scroll horizontal**.

---

## 7. Palabras y reglas de redacción (ya acordadas)

- **No usar** «cohorte», «días de atraso», «lead» ni «KPI» en pantalla.
- Decir:
  - «no volvió», «hace N días», «debía volver el»;
  - «paciente nuevo» y «en control»;
  - «reevaluación» y «procedimiento», que son cosas distintas.
- Hierro: «Hierro carboximaltosa · Ferinject × 3 sesiones», «sesión 2 de 3 pendiente».
- Cifras: frases que un médico entienda sin interpretar («De cada 100 pacientes nuevos…»).

---

## 8. Datos de ejemplo (inventados) para las maquetas

| Paciente | Tipo | Médico | Estado |
|---|---|---|---|
| Rosa Quispe Huamán | Reevaluación | Dr. Cabanillas | Por contactar · hace 27 días · 987 654 321 |
| Jorge Mendoza Paredes | Reevaluación | Dra. Matos | Por contactar · hace 45 días · sin teléfono |
| Ana Flores Ríos | Hierro carboximaltosa · Ferinject × 1 | Dr. Cabanillas | Por contactar · cotizó hace 16 días · `@ana.flores` |
| Luis Ramos Vega | Procedimiento · AMO + biopsia | Dra. La Torre | Por contactar · hace 50 días |
| Pedro Salas Ccori | Reevaluación | Dr. Cabanillas | Agendado · jue 8 oct |
| Elena Cárdenas Lima | Ferinject × 3 | Dr. Cabanillas | En tratamiento · sesión 2 de 3 · próxima el 9 oct |
| Raúl Pinto Mamani | Monofer × 2 | Dra. Matos | En tratamiento · sesión 1 de 2 · **atrasada 3 días** |
| Teresa Vilca Rojas | Reevaluación | Dr. Cabanillas | Completado · volvió el 2 oct |
| Nora Bustamante Gil | Reevaluación | Dr. Seminario | Completado · alta médica |

**Médicos:**
- Dr. Elí Cabanillas
- Dra. Alejandra La Torre
- Dr. Víctor Seminario
- Dr. Álvaro Villanueva
- Dra. Karen Matos
- Dra. Karen Matos – Particular
- Dr. Iván Pacheco

**Cifras reales de referencia:**
- 66 % de pacientes nuevos no vuelve nunca;
- meta: que vuelva el 60 %;
- unos 800 por contactar.

---

## 9. Etapas y entregables que pedimos

**Etapa 1 (prioridad):**
- el **tablero** (escritorio y celular);
- el **panel del paciente** con «¿Qué pasó?», en todos sus pasos (fecha, confirmación de cierre);
- los estados vacío, cargando y error;
- el modo oscuro.

**Etapa 2:**
- **Registro**;
- **Pacientes** (buscar y ficha);
- **Indicadores**.

**Para cada pantalla:**
- escritorio a 1440 px y celular a 390 px;
- modo claro y oscuro;
- estados de interacción (hover, foco, activo, deshabilitado);
- **especificación de movimientos**: qué se mueve, duración y curva;
- los tokens finales (colores, tipografía, espacios, radios, sombras).

Si pueden, entreguen **HTML/CSS de referencia** con la misma estructura de la maqueta: así se
traslada directamente a `Index.html`.

---

## 10. Capturas de la app actual (en este paquete)

| Archivo | Qué muestra |
|---|---|
| `actual-registro.png`, `actual-registro-guardado.png`, `actual-alta.png` | Pestaña Registro |
| `actual-bandeja-lo-hizo.png`, `actual-bandeja-alta.png` | La lista actual, que se reemplaza por el tablero |
| `actual-ficha.png` | Ficha del paciente |
| `actual-resumen.png`, `actual-detalle.png` | Las dos pantallas que se unen en «Indicadores» |
| `actual-celular-oscuro.png` | Celular, modo oscuro |
| `estilos-A-B-C-*.png` | Las tres direcciones que se mostraron; se eligió la A |
