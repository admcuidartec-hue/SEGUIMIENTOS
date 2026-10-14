"""Genera la narración (Piper) por escena y escribe src/Tutorial.tsx con duraciones y marcas sincronizadas a cada frase."""
import json, os, subprocess, wave, struct, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kokoro_tts import sintetiza
VOZ = 28  # ef_dora (Kokoro), voz femenina en español
VELOCIDAD = 1.0
D = os.path.dirname(os.path.abspath(__file__))
P = os.path.join(D, 'tutorial-chp')
V = os.path.join(D, 'voces/vits-piper-es_MX-claude-high/es_MX-claude-high')
OUT = os.path.join(P, 'public/voz'); os.makedirs(OUT, exist_ok=True)
FPS = 30; INICIO = 0.7; PAUSA = 0.35; COLA = 1.0
TODO = dict(x=0, y=0, w=1600, h=1000)

def B(x, y, w, h): return dict(x=x, y=y, w=w, h=h)

# Cada escena: tipo, props visuales, frases habladas. En los «shot», marcas = [(caja, índice de frase, clic)].
E = [
 dict(n='Portada', t='card', p=dict(kicker='Video instructivo', title='Plataforma de seguimiento de pacientes CHP', portada=True),
      f=['Bienvenida al video instructivo de la plataforma de seguimiento de pacientes del Centro Hematológico del Perú.', 'Vamos a recorrerla con siete casos de ejemplo. Los pacientes que aparecen son inventados.']),
 dict(n='Elegir nombre', t='shot', p=dict(src='cap/t01-tablero.png', desde=TODO, hasta=B(0,560,760,440), paso='Antes de empezar', title='Elija su nombre en «¿Quién es usted?»', body='Todo lo que guarde queda a su nombre. Si ya tenía la app abierta, recargue la página (F5).'),
      m=[(B(16,888,199,44), 0, True)],
      f=['Antes de empezar, elija su nombre abajo a la izquierda, en «¿Quién es usted?».', 'Todo lo que guarde queda a su nombre.', 'Y si ya tenía la plataforma abierta, recargue la página con la tecla efe cinco.']),
 dict(n='Tablero', t='shot', p=dict(src='cap/t01-tablero.png', desde=TODO, hasta=B(250,220,1340,620), paso='El Tablero', title='Cada tarjeta es un paciente', body='1 Por contactar: hay que escribirle. 2 Agendado: ya tiene fecha. 3 En tratamiento. 4 Completado o alta.'),
      m=[(B(280,371,284,21),1,False),(B(610,371,284,21),2,False),(B(939,371,284,21),3,False),(B(1269,371,284,21),4,False)],
      f=['Este es el Tablero. Cada tarjeta es un paciente, y la columna dice en qué punto está.', 'En Por contactar están los pacientes a los que hay que escribir hoy.', 'En Agendado, los que ya tienen una fecha.', 'En tratamiento, los que ya empezaron sus sesiones.', 'Y en Completado, los que volvieron, terminaron o recibieron el alta.']),
 dict(n='Caso 1', t='card', p=dict(kicker='Caso 1 · Reevaluación', title='Luis no volvió a su reevaluación', body='Le escribimos por WhatsApp y acepta volver a consulta.'),
      f=['Caso uno. Luis no volvió a su reevaluación. Le escribimos por WhatsApp, y acepta volver.']),
 dict(n='Caso 1 · panel', t='shot', p=dict(src='cap/c1a-panel.png', desde=TODO, hasta=B(1140,150,460,400), paso='Caso 1 · paso 1', title='Escriba y anote lo que pasó', body='1 Copie el teléfono (tecla C) y escríbale por WhatsApp. 2 Luis acepta: pulse «Agendó cita» (tecla 3).'),
      m=[(B(1437,293,133,44),1,False),(B(1165,449,202,48),2,True)],
      f=['Al hacer clic en su tarjeta, se abre su panel.', 'Copie el teléfono con este botón, o con la tecla ce, y escríbale por WhatsApp.', 'Cuando responda, como Luis aceptó, pulse Agendó cita.']),
 dict(n='Caso 1 · fecha', t='shot', p=dict(src='cap/c1b-agendo.png', desde=B(1140,150,460,400), hasta=B(1140,330,460,360), paso='Caso 1 · paso 2', title='Ponga la fecha de la cita', body='1 Elija la fecha que acordó con el paciente. 2 Guarde.'),
      m=[(B(1182,525,377,44),0,False),(B(1182,579,158,44),1,True)],
      f=['Ponga la fecha que acordó con él.', 'Y guarde.']),
 dict(n='Caso 1 · agendado', t='shot', p=dict(src='cap/c1c-agendado.png', desde=TODO, hasta=B(560,320,640,340), paso='Caso 1 · listo', title='Luis pasa a Agendado', body='Su tarjeta dice «Cita el jue 01/10». Si no viene, volverá a Por contactar.'),
      m=[(B(604,435,296,98),0,False)],
      f=['Listo. Luis pasa a Agendado, con su cita.', 'Si no viene ese día, volverá solo a Por contactar.']),
 dict(n='Caso 2', t='card', p=dict(kicker='Caso 2 · Hierro', title='Silvia aceptó su tratamiento de hierro', body='Ferinject, 3 sesiones. Cotizó hace 10 días.'),
      f=['Caso dos. Silvia cotizó un tratamiento de hierro de tres sesiones, y hoy nos dice que acepta.']),
 dict(n='Caso 2 · aceptó', t='shot', p=dict(src='cap/c2a-panel.png', desde=TODO, hasta=B(1140,300,460,460), paso='Caso 2 · paso 1', title='En hierro y procedimientos: «Aceptó»', body='1 «Aceptó tratamiento» (tecla 3). 2 Si no quiere hacérselo: «No desea realizarse», con el motivo.'),
      m=[(B(1165,490,202,57),0,True),(B(1375,650,202,48),1,False)],
      f=['En hierro y en procedimientos, el botón es Aceptó tratamiento.', 'Si el paciente no quiere hacérselo, ciérrelo con No desea realizarse, y escriba el motivo.']),
 dict(n='Caso 2 · primera sesión', t='shot', p=dict(src='cap/c2b-acepto.png', desde=B(1140,300,460,460), hasta=B(1140,380,460,330), paso='Caso 2 · paso 2', title='Fecha de la primera sesión', body='1 Ponga el día de su primera sesión. 2 «Pasar a Agendado».'),
      m=[(B(1182,566,377,44),0,False),(B(1182,620,158,44),1,True)],
      f=['Ponga la fecha de su primera sesión.', 'Y pulse Pasar a Agendado.']),
 dict(n='Caso 2 · agendada', t='shot', p=dict(src='cap/c2c-agendado.png', desde=TODO, hasta=B(560,330,640,340), paso='Caso 2 · listo', title='«Sesión 1 el jue 01/10»', body='Silvia queda agendada para su primera sesión.'),
      m=[(B(604,451,296,98),0,False)],
      f=['Silvia queda en Agendado, con su sesión uno.']),
 dict(n='Caso 3', t='card', p=dict(kicker='Caso 3 · Sesiones', title='Hoy es la primera sesión de Silvia', body='Vino, se hizo su sesión y ya acordó la siguiente.'),
      f=['Caso tres. Hoy es la primera sesión de Silvia. Vino, se la hizo, y ya acordó la siguiente.']),
 dict(n='Caso 3 · marcar', t='shot', p=dict(src='cap/c3a-sesion.png', desde=TODO, hasta=B(1140,380,460,320), paso='Caso 3 · un solo paso', title='Marque la sesión y agende la siguiente', body='1 Fecha de la sesión (hoy). 2 Próxima sesión. 3 «Marcar sesión 1 hecha».'),
      m=[(B(1165,458,411,44),0,False),(B(1165,536,411,44),1,False),(B(1165,590,202,57),2,True)],
      f=['Abra su tarjeta. La fecha de la sesión ya viene con la de hoy.', 'En Próxima sesión, ponga la fecha de la siguiente.', 'Y pulse Marcar sesión uno hecha. Todo en un solo paso.']),
 dict(n='Caso 3 · sesión 2', t='shot', p=dict(src='cap/c3b-sesion2.png', desde=TODO, hasta=B(560,360,640,340), paso='Caso 3 · listo', title='«Sesión 2 el jue 08/10»', body='Silvia vuelve a Agendado con su próxima sesión. Así en cada sesión, hasta la última.'),
      m=[(B(604,484,296,98),0,False)],
      f=['Silvia vuelve a Agendado, ahora con su sesión dos.', 'Así en cada sesión, hasta la última.']),
 dict(n='Recuerde · sesiones', t='card', p=dict(kicker='Recuerde', title='Si pasa la fecha sin marcar la sesión', body='La tarjeta vuelve a Por contactar como «No vino a su sesión». En la última sesión no se pide próxima fecha: pasa a Completado.'),
      f=['Recuerde: si pasa la fecha y nadie marcó la sesión, la tarjeta vuelve a Por contactar, como No vino a su sesión.', 'Y en la última sesión no se pide próxima fecha: el paciente pasa a Completado.']),
 dict(n='Caso 4', t='card', p=dict(kicker='Caso 4 · Por reevaluar', title='Beatriz terminó su tratamiento hace un mes', body='Le toca volver a consulta.'),
      f=['Caso cuatro. Beatriz terminó su tratamiento hace un mes.']),
 dict(n='Caso 4 · panel', t='shot', p=dict(src='cap/c4-porreevaluar.png', desde=TODO, hasta=B(1140,180,460,400), paso='Caso 4', title='«Por reevaluar»', body='1 Treinta días después de la última sesión aparece en Por contactar. 2 Llámela y use «Agendó cita».'),
      m=[(B(1165,249,411,25),0,False),(B(1165,490,202,48),1,True)],
      f=['Treinta días después de su última sesión, aparece sola en Por contactar, como Por reevaluar.', 'Llámela para su consulta, y si acepta, use Agendó cita.']),
 dict(n='Caso 5', t='card', p=dict(kicker='Caso 5 · Registro', title='Rosa vuelve con exámenes en 15 días', body='El doctor le pidió hemograma y ferritina.'),
      f=['Caso cinco. El doctor le pidió a Rosa hemograma y ferritina, y quiere verla en quince días.']),
 dict(n='Caso 5 · control', t='shot', p=dict(src='cap/c5a-control.png', desde=TODO, hasta=B(250,200,640,800), paso='Registro → Control + laboratorio', title='Registre el control', body='1 DNI: aparece «Paciente conocido». 2 Exámenes. 3 El retorno se propone a 15 días. 4 «Registrar control».'),
      m=[(B(264,238,600,48),1,False),(B(264,719,600,64),2,False),(B(264,821,600,44),3,False),(B(264,933,179,48),4,True)],
      f=['Vaya a Registro, pestaña Control más laboratorio.', 'Escriba su de, ene, i. Si ya es paciente, la plataforma la reconoce.', 'Anote los exámenes.', 'La fecha de retorno ya viene propuesta a quince días.', 'Y pulse Registrar control.']),
 dict(n='Caso 5 · registrado', t='shot', p=dict(src='cap/c5b-registrado.png', desde=TODO, hasta=B(890,180,700,340), paso='Caso 5 · listo', title='Queda en «Registrados»', body='Si Rosa no vuelve para esa fecha, aparecerá en Por contactar.'),
      m=[(B(912,233,656,105),0,False)],
      f=['El registro aparece a la derecha, en Registrados.', 'Si Rosa no vuelve para esa fecha, aparecerá en Por contactar.']),
 dict(n='Caso 6', t='card', p=dict(kicker='Caso 6 · Decisión del médico', title='Alta con control en 6 meses', body='El doctor le da el alta a Rosa, pero quiere verla en medio año.'),
      f=['Caso seis. El doctor le da el alta a Rosa, pero quiere verla en seis meses.']),
 dict(n='Caso 6 · decisión', t='shot', p=dict(src='cap/c6-decision.png', desde=TODO, hasta=B(250,380,640,620), paso='Registro → Decisión del médico', title='Elija la decisión', body='1 Especialidad. 2 «Alta · control en 6 meses». 3 La app dice cuándo volverá a Por contactar. 4 «Registrar decisión».'),
      m=[(B(264,403,600,44),0,False),(B(264,693,600,44),1,True),(B(264,855,600,40),2,False),(B(264,940,190,48),3,True)],
      f=['En la pestaña Decisión del médico, escriba el de, ene, i y elija la especialidad.', 'Marque Alta, control en seis meses.', 'La plataforma le dice qué día volverá Rosa a Por contactar, para agendar su control.', 'Y pulse Registrar decisión.']),
 dict(n='Caso 7', t='card', p=dict(kicker='Caso 7 · Corregir', title='El teléfono de Rosa cambió', body='Se corrige en el mismo registro, sin registrarlo otra vez.'),
      f=['Caso siete. El teléfono de Rosa cambió.']),
 dict(n='Caso 7 · editar', t='shot', p=dict(src='cap/c7-editar.png', desde=TODO, hasta=B(900,300,700,520), paso='Registrados → Editar', title='Corrija y guarde', body='1 Cambie el teléfono. 2 «Guardar cambios». El DNI no se edita: si está mal, anule y registre de nuevo.'),
      m=[(B(989,493,177,68),0,False),(B(989,747,150,44),1,True)],
      f=['En Registrados, pulse Editar y cambie el teléfono.', 'Luego, Guardar cambios.', 'El de, ene, i no se puede editar: si está mal, anule el registro y regístrelo de nuevo.']),
 dict(n='Atajos', t='atajos', p={},
      f=['Para ir más rápido, use el teclado.', 'Con las flechas se mueve entre tarjetas, con Enter la abre, con la ce copia el teléfono,', 'y con uno, dos y tres anota lo que pasó.']),
 dict(n='Cierre', t='card', p=dict(kicker='¿Dudas?', title='Envíe una captura de pantalla', body='Para más detalle, consulte el manual de la plataforma. ¡Gracias!'),
      f=['Si tiene alguna duda, envíe una captura de pantalla de lo que está viendo.', 'Para más detalle, consulte el manual de la plataforma. ¡Gracias!']),
]

def dur(path):
    with wave.open(path) as w: return w.getnframes() / w.getframerate()

def silencio(n_seg, rate):
    return b'\x00\x00' * int(n_seg * rate)

escenas = []
for i, e in enumerate(E):
    partes, inicios, t = [], [], INICIO
    for j, frase in enumerate(e['f']):
        fp = os.path.join(OUT, f'_{i:02d}_{j}.wav')
        sintetiza(frase, fp, sid=VOZ, velocidad=VELOCIDAD)
        inicios.append(round(t, 2)); t += dur(fp) + PAUSA; partes.append(fp)
    # concatena con pausas en un wav por escena
    with wave.open(partes[0]) as w0: params = w0.getparams(); rate = w0.getframerate()
    dest = os.path.join(OUT, f'{i:02d}.wav')
    with wave.open(dest, 'wb') as o:
        o.setparams(params)
        o.writeframes(silencio(INICIO, rate))
        for k, fp in enumerate(partes):
            with wave.open(fp) as w: o.writeframes(w.readframes(w.getnframes()))
            if k < len(partes) - 1: o.writeframes(silencio(PAUSA, rate))
        for fp in partes: os.remove(fp)
    total = dur(dest)
    segundos = round(total + COLA, 1)
    escenas.append(dict(e, audio=f'voz/{i:02d}.wav', inicios=inicios, seg=segundos))
    print(e['n'], segundos)

def js(v): return json.dumps(v, ensure_ascii=False)
def caja(c): return '{ x: %d, y: %d, w: %d, h: %d }' % (c['x'], c['y'], c['w'], c['h'])
TR = '      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />\n'
cuerpo = []
for e in escenas:
    fr = round(e['seg'] * FPS)
    s = f'      <TransitionSeries.Sequence name={js(e["n"])} durationInFrames={{{fr}}} premountFor={{fps}}>\n'
    if e['t'] == 'card':
        props = ' '.join((k if v is True else f'{k}={js(v)}') for k, v in e['p'].items())
        s += f'        <Card {props} />\n'
    elif e['t'] == 'atajos':
        s += '        <Atajos />\n'
    else:
        p = e['p']; marcas = []
        for (c, idx, clic) in e['m']:
            en = e['inicios'][idx] + 0.2
            marcas.append('{ caja: %s, en: %.2f%s }' % (caja(c), en, ', clic: true' if clic else ''))
        s += (f'        <Shot src={js(p["src"])} desde={{{caja(p["desde"])}}} hasta={{{caja(p["hasta"])}}}\n'
              f'          marcas={{[\n            ' + ',\n            '.join(marcas) + '\n          ]}\n'
              f'          paso={js(p["paso"])} title={js(p["title"])}\n          body={js(p["body"])} />\n')
    s += f'        <Audio name="Voz" src={{staticFile({js(e["audio"])})}} premountFor={{fps}} />\n'
    s += '      </TransitionSeries.Sequence>\n'
    cuerpo.append(s)
tsx = ('import { Audio } from "@remotion/media";\nimport { TransitionSeries, linearTiming } from "@remotion/transitions";\nimport { fade } from "@remotion/transitions/fade";\n'
       'import { staticFile, useVideoConfig } from "remotion";\nimport { Atajos } from "./Atajos";\nimport { Card } from "./Card";\nimport { Shot } from "./Shot";\n\n'
       '// Generado por narrar.py: cada escena dura lo que su narración, y cada marca aparece con la frase que la nombra.\n'
       'export const Tutorial = () => {\n  const { fps } = useVideoConfig();\n  return (\n    <TransitionSeries>\n' + TR.join(cuerpo) + '    </TransitionSeries>\n  );\n};\n')
open(os.path.join(P, 'src/Tutorial.tsx'), 'w').write(tsx)
total = sum(round(e['seg'] * FPS) for e in escenas) - 12 * (len(escenas) - 1)
r = open(os.path.join(P, 'src/Root.tsx')).read()
import re
r = re.sub(r'(id="TutorialSeguimientos"\s*component=\{Tutorial\}\s*durationInFrames=\{)\d+', lambda m: m.group(1) + str(total), r)
open(os.path.join(P, 'src/Root.tsx'), 'w').write(r)
print('total frames', total, 'seg', total / FPS)
