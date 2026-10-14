"""Fondo musical suave (pad de acordes y pulso tenue), generado aquí: sin derechos de autor. Uso: musica.py segundos salida.wav"""
import sys, wave, numpy as np
seg = float(sys.argv[1]); out = sys.argv[2]; sr = 44100
t = np.arange(int(seg * sr)) / sr
n = lambda m: 440 * 2 ** ((m - 69) / 12)
acordes = [[57, 60, 64, 69], [53, 57, 60, 65], [48, 55, 60, 64], [55, 59, 62, 67]]  # Am F C G
dur = 4.0
pad = np.zeros_like(t)
for k, acorde in enumerate(acordes * int(seg / (dur * 4) + 2)):
    a, b = k * dur, k * dur + dur + 1.5
    m = (t >= a) & (t < b)
    if not m.any(): continue
    tt = t[m] - a
    env = np.minimum(1, tt / 1.2) * np.minimum(1, (b - a - tt) / 1.5)
    for nota in acorde:
        f = n(nota)
        pad[m] += env * (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(2 * np.pi * f * 2.002 * tt) + 0.15 * np.sin(2 * np.pi * f * 0.5 * tt))
# pulso tenue cada medio segundo (nota grave)
pulso = np.zeros_like(t)
for k in range(int(seg * 2)):
    a = k * 0.5; m = (t >= a) & (t < a + 0.35)
    tt = t[m] - a
    raiz = acordes[int(a // dur) % 4][0] - 12
    pulso[m] += np.exp(-tt * 9) * np.sin(2 * np.pi * n(raiz) * tt)
mezcla = pad / np.max(np.abs(pad)) * 0.7 + pulso * 0.25
fade = np.minimum(1, t / 2) * np.minimum(1, (seg - t) / 3)
mezcla = mezcla * fade
mezcla = mezcla / np.max(np.abs(mezcla)) * 0.8
est = np.stack([mezcla, np.roll(mezcla, 300)], axis=1)
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(sr)
    w.writeframes((est * 32767).astype('<i2').tobytes())
print('ok', seg)
