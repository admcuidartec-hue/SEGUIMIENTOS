import sys, os, wave, struct
import sherpa_onnx
K = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'voces/kokoro-multi-lang-v1_0')
_tts = None
def tts():
    global _tts
    if _tts is None:
        cfg = sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(
            kokoro=sherpa_onnx.OfflineTtsKokoroModelConfig(model=f'{K}/model.onnx', voices=f'{K}/voices.bin', tokens=f'{K}/tokens.txt',
                data_dir=f'{K}/espeak-ng-data', dict_dir=f'{K}/dict', lexicon=f'{K}/lexicon-us-en.txt,{K}/lexicon-zh.txt', lang='es'),
            num_threads=4), max_num_sentences=1)
        _tts = sherpa_onnx.OfflineTts(cfg)
    return _tts
def sintetiza(texto, ruta, sid=28, velocidad=1.0):
    a = tts().generate(texto, sid=sid, speed=velocidad)
    with wave.open(ruta, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(a.sample_rate)
        w.writeframes(b''.join(struct.pack('<h', max(-32767, min(32767, int(x * 32767 * 0.9)))) for x in a.samples))
if __name__ == '__main__':
    sintetiza(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 28)
