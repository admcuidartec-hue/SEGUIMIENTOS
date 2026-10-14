"""Genera la narración (Gemini o Google si hay clave, si no Kokoro), la música y el .tsx de un video con el estilo nuevo."""
import json, os, re, subprocess, sys, wave
D = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, D)
import voz
P = os.path.join(D, 'tutorial-chp')
FPS = 30; INICIO = 0.7; PAUSA = 0.35; COLA = 1.0; TR = 12

def _dur(path):
    with wave.open(path) as w: return w.getnframes() / w.getframerate()

def escribir(E, comp, componente, archivo_tsx, carpeta_voz):
    OUT = os.path.join(P, 'public', carpeta_voz); os.makedirs(OUT, exist_ok=True)
    print('voz:', voz.motor())
    escenas, fondo = [], 'granate'
    for i, e in enumerate(E):
        if e['t'] == 'card' and not e['p'].get('portada'):
            fondo = e.get('fondo', fondo)
        e = dict(e, fondo=e.get('fondo', fondo))
        if not e.get('f'):
            escenas.append(dict(e, audio=None, inicios=[], seg=e.get('seg', 3.5))); continue
        partes, inicios, t = [], [], INICIO
        if voz.por_escena():
            # Un solo audio por escena; el inicio de cada frase se estima por su largo en caracteres.
            fp = os.path.join(OUT, f'_{i:02d}_0.wav')
            try:
                voz.sintetiza(' '.join(e['f']), fp)
            except voz.CupoAgotado:
                sys.exit(f'Se agotó el cupo diario de Gemini en la escena {i} ({e["n"]}). '
                         'Lo hecho queda guardado: vuelva a correr el script mañana y seguirá desde ahí.')
            largos = [len(f) + 1 for f in e['f']]; d = _dur(fp)
            inicios = [round(INICIO + d * sum(largos[:j]) / sum(largos), 2) for j in range(len(largos))]
            partes = [fp]
        for j, frase in enumerate([] if voz.por_escena() else e['f']):
            fp = os.path.join(OUT, f'_{i:02d}_{j}.wav'); voz.sintetiza(frase, fp)
            inicios.append(round(t, 2)); t += _dur(fp) + PAUSA; partes.append(fp)
        with wave.open(partes[0]) as w0: params = w0.getparams(); rate = w0.getframerate()
        dest = os.path.join(OUT, f'{i:02d}.wav')
        with wave.open(dest, 'wb') as o:
            o.setparams(params); o.writeframes(b'\x00\x00' * int(INICIO * rate))
            for k, fp in enumerate(partes):
                with wave.open(fp) as w: o.writeframes(w.readframes(w.getnframes()))
                if k < len(partes) - 1: o.writeframes(b'\x00\x00' * int(PAUSA * rate))
        for fp in partes: os.remove(fp)
        escenas.append(dict(e, audio=f'{carpeta_voz}/{i:02d}.wav', inicios=inicios, seg=round(_dur(dest) + COLA, 1)))
        print(e['n'], escenas[-1]['seg'])
    js = lambda v: json.dumps(v, ensure_ascii=False)
    caja = lambda c: '{ x: %d, y: %d, w: %d, h: %d }' % (c['x'], c['y'], c['w'], c['h'])
    tr = '      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: %d })} />\n' % TR
    cuerpo = []
    for e in escenas:
        fr = round(e['seg'] * FPS); ini = e['inicios']; p = e.get('p', {})
        s = f'      <TransitionSeries.Sequence name={js(e["n"])} durationInFrames={{{fr}}} premountFor={{fps}}>\n'
        if e['t'] == 'apertura':
            s += f'        <Apertura palabras={{{js(p["palabras"])}}} lema={js(p["lema"])} />\n'
        elif e['t'] == 'cierre':
            s += f'        <Cierre frase={js(p["frase"])} pie={js(p["pie"])} />\n'
        elif e['t'] == 'card' and p.get('portada'):
            s += '        <Card ' + ' '.join((k if v is True else f'{k}={js(v)}') for k, v in p.items()) + ' />\n'
        elif e['t'] == 'card':
            s += f'        <Seccion kicker={js(p["kicker"])} title={js(p["title"])}' + (f' cursivaTexto={js(p["body"])}' if p.get('body') else '') + f' fondo={js(e["fondo"])} />\n'
        elif e['t'] == 'cifras':
            cif = ', '.join('{ valor: %s, texto: %s, en: %.2f }' % (js(v), js(tx), ini[idx] + 0.2) for v, tx, idx in e['c'])
            s += f'        <Cifras kicker={js(p["kicker"])} title={js(p["title"])} pie={js(p["pie"])} cifras={{[{cif}]}} />\n'
        elif e['t'] == 'flujo':
            s += '        <Flujo ' + ' '.join(f'{k}={{{ini[v] + 0.2:.2f}}}' for k, v in e['i'].items()) + ' />\n'
        elif e['t'] == 'dispositivos':
            s += f'        <Dispositivos enMovil={{{ini[e["i"]["enMovil"]] + 0.2:.2f}}} />\n'
        elif e['t'] == 'atajos':
            s += '        <Atajos />\n'
        else:
            marcas = ['{ caja: %s, en: %.2f%s }' % (caja(c), ini[idx] + 0.25, ', clic: true' if clic else '') for c, idx, clic in e['m']]
            extra = (f' ancho={{{p["ancho"]}}} alto={{{p["alto"]}}}' if 'ancho' in p else '')
            s += (f'        <Escena src={js(p["src"])} fondo={js(e["fondo"])} desde={{{caja(p["desde"])}}} hasta={{{caja(p["hasta"])}}}{extra}\n'
                  '          marcas={[\n            ' + ',\n            '.join(marcas) + '\n          ]}\n'
                  f'          paso={js(p["paso"])} title={js(p["title"])}\n          body={js(p["body"])} />\n')
        if e['audio']:
            s += f'        <Audio name="Voz" src={{staticFile({js(e["audio"])})}} premountFor={{fps}} />\n'
        s += '      </TransitionSeries.Sequence>\n'
        cuerpo.append(s)
    total = sum(round(e['seg'] * FPS) for e in escenas) - TR * (len(escenas) - 1)
    musica = f'{carpeta_voz}/musica.wav'
    subprocess.run([sys.executable, os.path.join(D, 'musica.py'), str(total / FPS + 1), os.path.join(P, 'public', musica)], check=True, capture_output=True)
    tsx = ('import { Audio } from "@remotion/media";\nimport { TransitionSeries, linearTiming } from "@remotion/transitions";\nimport { fade } from "@remotion/transitions/fade";\n'
           'import { staticFile, useVideoConfig } from "remotion";\nimport { Apertura } from "./Apertura";\nimport { Atajos } from "./Atajos";\nimport { Card } from "./Card";\nimport { Cierre } from "./Cierre";\n'
           'import { Cifras } from "./Cifras";\nimport { Dispositivos } from "./Dispositivos";\nimport { Escena } from "./Escena";\nimport { Flujo } from "./Flujo";\nimport { Seccion } from "./Seccion";\n\n'
           f'// Generado por generar.py (voz: {voz.motor()}).\n'
           f'export const {componente} = () => {{\n  const {{ fps }} = useVideoConfig();\n  return (\n    <>\n    <TransitionSeries>\n' + tr.join(cuerpo) +
           f'    </TransitionSeries>\n    <Audio name="Música" src={{staticFile({js(musica)})}} volume={{0.09}} />\n    </>\n  );\n}};\n')
    lineas = tsx.split('\n')
    usa = lambda nombre: re.search(r'<%s[\s/>]' % nombre, tsx) is not None
    lineas = [l for l in lineas if not (m := re.match(r'import \{ (\w+) \} from "\./', l)) or usa(m.group(1))]
    tsx = '\n'.join(lineas)
    open(os.path.join(P, 'src', archivo_tsx), 'w').write(tsx)
    r = open(os.path.join(P, 'src/Root.tsx')).read()
    if f'id="{comp}"' not in r:
        r = r.replace('import { RemotionRoot', 'import { RemotionRoot')
        r = f'import {{ {componente} }} from "./{archivo_tsx[:-4]}";\n' + r
        r = r.replace('      <Folder name="Elementos">', f'      <Composition\n        id="{comp}"\n        component={{{componente}}}\n        durationInFrames={{{total}}}\n        fps={{30}}\n        width={{1920}}\n        height={{1080}}\n      />\n      <Folder name="Elementos">')
    else:
        r = re.sub(r'(id="%s"\s*component=\{%s\}\s*durationInFrames=\{)\d+' % (comp, componente), lambda m: m.group(1) + str(total), r)
    open(os.path.join(P, 'src/Root.tsx'), 'w').write(r)
    print('total', total, round(total / FPS, 1))
