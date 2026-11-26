# Instructivo animado · Seguimientos CHP

Video instructivo de la plataforma, hecho con [Remotion](https://www.remotion.dev) y **sin capturas**: las
pantallas de la app y del Sheets están dibujadas con React (`src/components/SimulatedScreen.tsx` y
`src/components/ui/TablaHoja.tsx`), así que el cursor, los clics y los cambios de estado se animan cuadro a cuadro.
Todos los pacientes son inventados (los apellidos llevan «Prueba»): **ningún dato real**.

- Composición: `InstructivoAnimado`, 1920 × 1080, 30 cuadros por segundo, unos 9 minutos.
- Público: Enfermería, Asesoras (Admisión) y el líder del proyecto. Una insignia arriba a la derecha dice a quién va
  cada tramo; en la escena 3, además, si es «Uso diario» o «Por qué se diseñó así».
- Mismas versiones que `../tutorial-chp`: Remotion 4.0.534, React 19.2.3.

| Escena | Qué cuenta |
|---|---|
| 1 · Introducción | Para qué sirve, quién la usa y cómo fluye la información (SOFDOC → «Hoja 1» → Tablero → «¿Qué pasó?» → retorno) |
| 2 · La regla crítica diaria | SOFDOC cada mañana antes de las 7:00: por qué, qué pasa si no, los seis pasos y cómo saber que salió bien |
| 3 · Las pantallas | Tablero, «¿Qué pasó?», Registro, Pacientes y «Agregar teléfono», Enfermería, Indicadores y la descarga, roles |
| 4 · Configuración | Hojas REGLAS y CATALOGOS, el menú Seguimientos, cuidados y cómo publicar |
| 5 · Pendientes y cierre | Tablero de pendientes del líder, tres pilares y cierre |

## Ver y renderizar

```bash
cd videos/instructivo-animado
npm ci                                   # la primera vez
npx remotion studio src/index.ts         # vista previa en el navegador, con línea de tiempo
npx tsc --noEmit                         # revisión de tipos

npx remotion render src/index.ts InstructivoAnimado salida/instructivo-animado.mp4 --crf=26
npm run prueba                           # versión rápida a 960 × 540 (salida/prueba-540p.mp4)
npx remotion still src/index.ts InstructivoAnimado salida/cuadro.png --frame=4600   # un cuadro suelto
```

En el entorno en la nube de Claude Code se añade
`--browser-executable=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell`
(o la versión de `chromium_headless_shell-*` que haya en `/opt/pw-browsers`). `salida/` no se versiona.

## Dónde se cambia cada cosa

| Qué | Dónde |
|---|---|
| **Duración** de cada tramo (en segundos) y orden de las escenas | `src/constants/duraciones.ts` — el total se calcula solo |
| **Narración y subtítulos** (una línea = un subtítulo, máx. 2 renglones) y textos en pantalla | `src/constants/guion.ts` |
| Reparto de cada tramo entre sus líneas y la revisión de legibilidad | `src/constants/tiempos.ts` |
| Colores (CHP y tokens de la app) | `src/constants/colores.ts` |
| Fuentes y tamaños | `src/constants/tipografia.ts` (las fuentes están en `public/`) |
| Márgenes seguros (96 px a los lados, 60 px arriba y abajo) y zonas de cabecera, contenido y subtítulos | `src/constants/areaSegura.ts` |
| Pacientes, cifras y valores de ejemplo | `src/constants/datosDemo.ts` |

**La composición no carga si un subtítulo queda ilegible** (menos de 1 segundo por cada 3 palabras) o si un tramo del
guion no tiene duración: el error dice cuál y qué hacer. Si cambia un texto, alargue su tramo en `duraciones.ts`.
Las animaciones se anclan al inicio de cada tramo y de cada línea (`inicioBeat`, `inicioLinea`), así que se mueven solas
cuando cambian las duraciones.

## Poner la voz

El guion de `src/constants/guion.ts` es el texto exacto de la voz en off. Para generarla se usa el mismo camino que los
otros dos videos (`../voz.py`, con Gemini, Google Cloud TTS o Kokoro; ver `../LEEME.md`, sección «La voz»):

1. Pasar las líneas de cada escena (`e1`, `e2`, `e3a` … `e3g`, `e4`, `e5`) a un script como `../narrar.py`, que llame a
   `voz.py` con **un audio por escena** (así se gasta menos cupo de Gemini) y lo deje en
   `public/voz/escena-<id>.wav` (`public/voz/` no se versiona).
2. En cada escena, descomentar el `<Audio src={staticFile("voz/escena-<id>.wav")} />` indicado en su cabecera (ver
   `src/components/Escenario.tsx`).
3. Medir cada frase y ajustar los segundos de cada tramo en `duraciones.ts` para que el subtítulo y la voz coincidan.

## Poner capturas reales

`SimulatedScreen` acepta `captura="cap/archivo.png"`: dibuja la captura debajo de la simulación (sirve para comparar o
para sustituirla). Las capturas del DEMO de `src/Index.html` —pacientes inventados— están en `../tutorial-chp/public/cap`
y `../tutorial-chp/public/ger`; se copian a `public/cap/`. La ventana de SOFDOC (escena 2, paso 1) es un **esquema**:
si se quiere la pantalla real, una captura **sin datos de pacientes** en el lugar marcado en `Escena2Sofdoc.tsx`.

## Datos reales en las cifras

Las cifras (tablero, indicadores, mensajes de «Actualizar» y «Verificar») son de ejemplo y viven en
`src/constants/datosDemo.ts`. Si alguna vez se quieren cifras reales, se exportan a un JSON **sin nombres, DNI ni
teléfonos** y se leen con `staticFile` + `delayRender`. Las del caso real de la escena 2 (36 días, 183 reevaluaciones,
587 → 409) están en `guion.ts`.

## Mantenerlo al día

Este video es uno de los pendientes del líder del proyecto: cuando cambie la plataforma (una pantalla, un parámetro de
REGLAS, una opción del menú), cambie el texto en `guion.ts`, la simulación en `src/scenes/` y vuelva a renderizar.
