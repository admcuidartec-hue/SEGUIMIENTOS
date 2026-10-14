# Videos de la plataforma

Proyecto que arma los dos videos de Seguimientos CHP con [Remotion](https://www.remotion.dev):

| Video | Composición | Guion | Script |
|---|---|---|---|
| Instructivo general | `TutorialSeguimientos` | `narrar.py` | `video-tutorial.py` |
| Presentación a gerencia | `PresentacionGerencia` | `narrar-ger.py` | `video-gerencia.py` |

Las capturas de `tutorial-chp/public/cap/` y `ger/` salen del modo demo de `src/Index.html`:
**pacientes inventados, ningún dato real**. Se rehacen con `video-caps.js`, `ger-caps.js` y
`ger-caps2.js` solo si cambia la interfaz.

## La voz

`voz.py` elige el motor según la clave que encuentre en el entorno:

| Clave | Motor | Notas |
|---|---|---|
| `GEMINI_API_KEY` | Gemini (Google AI Studio) | Nivel gratuito, sin tarjeta. Voz `VOZ_GEMINI` (por omisión `Kore`). |
| `GOOGLE_TTS_API_KEY` | Google Cloud Text-to-Speech | Requiere facturación. Voz `VOZ_GOOGLE` (por omisión `es-US-Chirp3-HD-Aoede`). |
| ninguna | Kokoro, local | Voz provisional. |

Las claves van en la configuración del entorno, **nunca en el código ni en el chat**. En el
entorno en la nube de Claude Code la clave de Gemini es un **secreto de red**: sitio permitido
`generativelanguage.googleapis.com`, encabezado `x-goog-api-key`. El proxy la añade a cada
petición y no aparece en el entorno, así que se corre con `MOTOR_VOZ=gemini`.

Con Gemini se pide un audio por escena, no por frase, para gastar menos cupo: el nivel
gratuito da **10 peticiones por día y por modelo**, y los dos videos suman unas 52 escenas.
Agrupar varias escenas en una petición y cortar por los silencios se probó y falla (Gemini hace
pausas igual de largas dentro de una escena que entre escenas), así que no se hace. El modelo
por omisión es `gemini-3.8-flash-tts`; `ESTILO_VOZ` va vacío porque los modelos 3.x leen la
indicación de estilo en voz alta. Cada audio queda
en `.cache-voz/`: si el cupo del día se acaba, el script lo dice y al correrlo de nuevo al día
siguiente sigue desde donde quedó. Si Google renombra el modelo, se cambia con `MODELO_GEMINI`.

## Generar y renderizar

```bash
cd videos
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
(cd tutorial-chp && npm ci)

# Solo si se usa Kokoro: descargar el modelo a voces/
mkdir -p voces && curl -L https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/kokoro-multi-lang-v1_0.tar.bz2 | tar -xj -C voces

MOTOR_VOZ=gemini .venv/bin/python video-tutorial.py   # voz, música y src/Tutorial.tsx
MOTOR_VOZ=gemini .venv/bin/python video-gerencia.py   # voz, música y src/Gerencia.tsx

cd tutorial-chp
npx remotion render TutorialSeguimientos ../salida/instructivo.mp4 --crf=26 --audio-bitrate=128k
npx remotion render PresentacionGerencia ../salida/gerencia.mp4 --crf=26 --audio-bitrate=128k
```

En el entorno en la nube de Claude Code se añade
`--browser-executable=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell`.

`rutas.js` sirve las librerías de la página desde copias locales (`cdn/`, no versionada) para
tomar capturas sin salida a internet.
