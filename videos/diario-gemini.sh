#!/bin/bash
# Tanda diaria de voz con Gemini (10 peticiones por día en el nivel gratuito).
# Genera lo que falte del instructivo y luego de gerencia, guarda la caché en git
# e indica si ya están todas las escenas. Uso: bash videos/diario-gemini.sh
set -u
cd "$(dirname "$0")"
PY=${PY:-.venv/bin/python}
if [ ! -x "$PY" ]; then python3 -m venv .venv && .venv/bin/pip install -q -r requirements.txt; PY=.venv/bin/python; fi
export MOTOR_VOZ=gemini
listo=0
"$PY" video-tutorial.py && "$PY" video-gerencia.py && listo=1
git add .cache-voz
git commit -q -m "Videos: tanda diaria de voz Gemini" || true
echo "escenas en caché: $(ls .cache-voz/gemini-*.wav | wc -l) de 49"
[ $listo = 1 ] && echo "NARRACION_COMPLETA" || echo "NARRACION_PENDIENTE"
