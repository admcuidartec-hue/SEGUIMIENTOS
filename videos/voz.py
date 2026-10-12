"""Voz de los videos. Elige el motor según las claves del entorno:

  GEMINI_API_KEY      → Gemini (Google AI Studio, nivel gratuito). Voz: VOZ_GEMINI (Kore por omisión).
  GOOGLE_TTS_API_KEY  → Google Cloud Text-to-Speech, voces Chirp 3 HD. Voz: VOZ_GOOGLE.
  ninguna             → Kokoro, local (voz provisional).

Cada audio se guarda en una caché (.cache-voz/) por texto, motor y voz: si el cupo diario de
Gemini se agota a mitad de camino, al volver a correr el script se retoma donde quedó.
"""
import base64, hashlib, json, os, re, shutil, sys, time, urllib.error, urllib.request, wave

D = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(D, '.cache-voz')
GEMINI = os.environ.get('GEMINI_API_KEY', '')
GOOGLE = os.environ.get('GOOGLE_TTS_API_KEY', '')
VOZ_GEMINI = os.environ.get('VOZ_GEMINI', 'Kore')
MODELO_GEMINI = os.environ.get('MODELO_GEMINI', 'gemini-2.5-flash-preview-tts')
ESTILO = os.environ.get('ESTILO_VOZ', 'Lee en español latinoamericano, con voz cálida, clara y pausada, como una instructora')
VOZ_GOOGLE = os.environ.get('VOZ_GOOGLE', 'es-US-Chirp3-HD-Aoede')


class CupoAgotado(Exception):
    """El nivel gratuito de Gemini llegó a su tope del día."""


def motor():
    return 'gemini' if GEMINI else 'google' if GOOGLE else 'kokoro'


def por_escena():
    """Gemini cobra el cupo por petición: se pide un audio por escena, no por frase."""
    return motor() == 'gemini'


def _post(url, cuerpo, cabeceras):
    req = urllib.request.Request(url, data=json.dumps(cuerpo).encode(),
                                 headers={'Content-Type': 'application/json', **cabeceras})
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.load(r)


def _gemini(texto, ruta):
    url = f'https://generativelanguage.googleapis.com/v1beta/models/{MODELO_GEMINI}:generateContent'
    cuerpo = {'contents': [{'parts': [{'text': f'{ESTILO}: {texto}'}]}],
              'generationConfig': {'responseModalities': ['AUDIO'],
                                   'speechConfig': {'voiceConfig': {'prebuiltVoiceConfig': {'voiceName': VOZ_GEMINI}}}}}
    for intento in range(6):
        try:
            r = _post(url, cuerpo, {'x-goog-api-key': GEMINI})
            break
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors='replace')
            if e.code == 429 and re.search(r'PerDay|per day|daily', msg, re.I):
                raise CupoAgotado(msg[:400])
            if e.code in (429, 500, 503) and intento < 5:
                m = re.search(r'"retryDelay":\s*"(\d+)', msg)
                espera = int(m.group(1)) + 2 if m else 20 * (intento + 1)
                print(f'  Gemini {e.code}: espero {espera} s', file=sys.stderr); time.sleep(espera); continue
            if e.code == 404:
                raise SystemExit(f'El modelo {MODELO_GEMINI} no existe. Defina MODELO_GEMINI con uno vigente.\n{msg[:400]}')
            raise SystemExit(f'Gemini respondió {e.code}:\n{msg[:600]}')
    parte = r['candidates'][0]['content']['parts'][0]['inlineData']
    m = re.search(r'rate=(\d+)', parte.get('mimeType', ''))
    with wave.open(ruta, 'wb') as w:  # llega PCM de 16 bits, mono, sin cabecera
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(int(m.group(1)) if m else 24000)
        w.writeframes(base64.b64decode(parte['data']))


def _google(texto, ruta, velocidad):
    cuerpo = {'input': {'text': texto}, 'voice': {'languageCode': VOZ_GOOGLE[:5], 'name': VOZ_GOOGLE},
              'audioConfig': {'audioEncoding': 'LINEAR16', 'sampleRateHertz': 24000, 'speakingRate': velocidad}}
    r = _post('https://texttospeech.googleapis.com/v1/text:synthesize', cuerpo, {'x-goog-api-key': GOOGLE})
    open(ruta, 'wb').write(base64.b64decode(r['audioContent']))  # LINEAR16 llega con cabecera WAV


def sintetiza(texto, ruta, sid=28, velocidad=1.0):
    m = motor()
    voz = {'gemini': f'{MODELO_GEMINI}/{VOZ_GEMINI}/{ESTILO}', 'google': VOZ_GOOGLE, 'kokoro': str(sid)}[m]
    clave = hashlib.sha1(f'{m}|{voz}|{velocidad}|{texto}'.encode()).hexdigest()[:16]
    guardado = os.path.join(CACHE, f'{m}-{clave}.wav')
    if not os.path.exists(guardado):
        os.makedirs(CACHE, exist_ok=True)
        tmp = guardado + '.tmp'
        if m == 'gemini':
            _gemini(texto, tmp)
        elif m == 'google':
            _google(texto, tmp, velocidad)
        else:
            from kokoro_tts import sintetiza as kokoro
            kokoro(texto, tmp, sid=sid, velocidad=velocidad)
        os.replace(tmp, guardado)
    shutil.copyfile(guardado, ruta)
