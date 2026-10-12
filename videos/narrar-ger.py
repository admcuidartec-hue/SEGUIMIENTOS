"""Video para gerencia: narración Kokoro por escena y src/Gerencia.tsx sincronizado con cada frase."""
import json, os, re, sys, wave
D = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, D)
from kokoro_tts import sintetiza
P = os.path.join(D, 'tutorial-chp'); OUT = os.path.join(P, 'public/voz-ger'); os.makedirs(OUT, exist_ok=True)
FPS = 30; INICIO = 0.7; PAUSA = 0.35; COLA = 1.0; VOZ = 28
TODO = dict(x=0, y=0, w=1600, h=1000)
def B(x, y, w, h): return dict(x=x, y=y, w=w, h=h)

E = [
 dict(n='Portada', t='card', p=dict(kicker='Presentación a gerencia', title='Plataforma de seguimiento de pacientes CHP', portada=True),
  f=['Esta es la plataforma de seguimiento de pacientes del Centro Hematológico del Perú.', 'Veremos qué problema resuelve, qué se construyó, y qué información pone en manos de la gerencia.']),
 dict(n='El problema', t='cifras', p=dict(kicker='El problema', title='Pacientes que se perdían en silencio', pie='Datos reales de enero a setiembre de 2026 (SOFDOC y base de cotizaciones). El monto es un techo: incluye pacientes que no debían volver.'),
  c=[('74 %', 'no volvía a su reevaluación (meta: máximo 40 %)', 1), ('48 % · 14 %', 'del hierro y de los procedimientos cotizados se realizaba', 2), ('S/ 121–151 mil', 'al mes en juego', 3)],
  f=['Antes de la plataforma, nadie tenía una lista de a quién le tocaba volver.', 'Con datos reales de dos mil veintiséis, el setenta y cuatro por ciento de los pacientes no volvía a su reevaluación, cuando la meta es que no vuelva como máximo el cuarenta.', 'Solo la mitad del hierro cotizado, y uno de cada siete procedimientos, se llegaban a realizar.', 'Se estima que entre ciento veintiún mil y ciento cincuenta y un mil soles al mes quedan en juego.']),
 dict(n='Antes', t='card', p=dict(kicker='Cómo se trabajaba', title='Un Excel y la memoria de cada asesora', body='Cotizaciones por nombre, sin DNI · llamadas sin registro · altas sin anotar · indicadores a mano'),
  f=['El seguimiento dependía de un Excel de cotizaciones, por nombre y sin DNI, y de la memoria de cada asesora.', 'Las llamadas no quedaban registradas, las altas no se anotaban, y los indicadores se armaban a mano, si se armaban.']),
 dict(n='Cómo funciona', t='flujo', i=dict(enFuentes=0, enCentro=1, enPantallas=2),
  f=['La plataforma une tres fuentes: las citas de SOFDOC, los contactos del CRM de leads, y lo que indica el médico, que ahora se registra en la propia plataforma.', 'Cada mañana a las siete cruza la información, aplica las reglas de plazos, y arma la lista de trabajo.', 'Todo se ve en cuatro pantallas, y corre sobre la cuenta de Google de la institución, sin licencias adicionales.']),
 dict(n='Tablero', t='shot', p=dict(src='ger/g01-tablero.png', desde=TODO, hasta=B(250,80,1340,360), paso='Pantalla 1 · Tablero', title='La lista de trabajo diaria', body='1 Cuatro cifras del día. 2 Meta diaria de seguimientos. 3 Filtros: tipo, médico, mes y especialidad. 4 Cuatro columnas por las que avanza cada paciente.'),
  m=[(B(264,131,1304,108),1,False),(B(264,90,302,18),2,False),(B(264,261,1135,48),3,False),(B(264,357,1304,62),4,False)],
  f=['El Tablero es la pantalla de trabajo de las asesoras.', 'Arriba, cuatro cifras: pacientes por contactar, agendados, en tratamiento, y completados en el mes.', 'La barra muestra el avance de la meta diaria de seguimientos.', 'Se puede filtrar por tipo de paciente, médico, mes y especialidad.', 'Y cada paciente avanza solo por cuatro columnas: por contactar, agendado, en tratamiento y completado.']),
 dict(n='Por médico', t='shot', p=dict(src='ger/g02-tablero-medico.png', desde=TODO, hasta=B(250,80,1340,560), paso='Tablero · por médico', title='Cada médico ve a sus pacientes', body='1 Filtro por médico. 2 Las cifras y las columnas se recalculan.'),
  m=[(B(782,263,189,44),0,True),(B(264,131,1304,108),1,False)],
  f=['Al elegir un médico, el tablero muestra solo a sus pacientes.', 'Las cifras se recalculan, y cada médico puede ver quiénes de los suyos no volvieron.']),
 dict(n='Qué pasó', t='shot', p=dict(src='ger/g03-panel.png', desde=TODO, hasta=B(1140,150,460,580), paso='Tablero · cada llamada', title='Cada llamada queda registrada', body='1 Por qué hay que llamar. 2 Qué pasó: no contestó, lo pensará, agendó o aceptó. 3 Cierre con motivo.'),
  m=[(B(1165,179,411,25),0,False),(B(1165,393,411,104),1,False),(B(1165,537,411,168),2,False)],
  f=['Cada tarjeta dice por qué hay que llamar y desde cuándo.', 'La asesora registra qué pasó: no contestó, lo pensará, agendó cita, o aceptó el tratamiento.', 'Si el paciente no va a volver, el seguimiento se cierra con un motivo. Todo queda con fecha, hora, y el nombre de quien lo hizo.']),
 dict(n='Registro', t='shot', p=dict(src='ger/g04-registro.png', desde=TODO, hasta=TODO, paso='Pantalla 2 · Registro', title='Lo que indica el médico', body='1 Indicación, control con laboratorio y decisión del médico. 2 Registrados: editar y anular, con bitácora.'),
  m=[(B(264,106,480,48),0,False),(B(912,232,656,303),2,False)],
  f=['En Registro se anota lo que indica el médico: tratamientos de hierro y procedimientos con sus sesiones, controles con laboratorio, y la decisión del médico, que puede ser alta, alta con control a seis meses o a un año, o una nueva reevaluación.', 'Este registro reemplaza al Excel, con listas desplegables y el nombre del médico.', 'Nada se borra: se edita o se anula con un motivo, y cada cambio queda en una bitácora.']),
 dict(n='Pacientes', t='shot', p=dict(src='ger/g05-ficha.png', desde=TODO, hasta=B(250,140,1340,780), paso='Pantalla 3 · Pacientes', title='La ficha completa del paciente', body='1 Especialidades y cuándo debe volver. 2 Tratamientos, sesión por sesión. 3 Teléfonos, altas e historia de seguimientos.'),
  m=[(B(264,280,791,200),0,False),(B(264,557,791,291),1,False),(B(1103,288,465,230),2,False)],
  f=['La ficha de cada paciente reúne en una sola pantalla sus especialidades, sus citas y cuándo debe volver.', 'Sus tratamientos, sesión por sesión.', 'Y sus teléfonos, sus altas, y toda la historia de seguimientos.']),
 dict(n='Indicadores', t='card', p=dict(kicker='Pantalla 4 · Indicadores', title='Siete vistas para la dirección', body='Las cifras que siguen son de demostración'),
  f=['Para la gerencia, la pantalla clave es Indicadores. Las cifras que veremos son de demostración.']),
 dict(n='Resumen del mes', t='shot', p=dict(src='ger/i-resumen.png', desde=TODO, hasta=B(250,80,1340,800), paso='Indicadores · Resumen del mes', title='El indicador principal, frente a la meta', body='1 % que no volvió a su reevaluación. 2 Hierro, procedimientos y recuperación. 3 Evolución mes a mes.'),
  m=[(B(264,170,480,310),0,False),(B(819,380,749,105),1,False),(B(264,530,1304,330),2,False)],
  f=['El Resumen del mes muestra el indicador principal: qué porcentaje de los pacientes no volvió a su reevaluación, frente a la meta del cuarenta por ciento.', 'Al lado, cuántos no siguieron el tratamiento de hierro u otros procedimientos, y cuántos volvieron gracias al seguimiento.', 'Abajo, la evolución mes a mes.']),
 dict(n='Hasta dónde llegan', t='shot', p=dict(src='ger/i-llegan.png', desde=TODO, hasta=B(250,160,1340,840), paso='Indicadores · ¿Hasta dónde llegan?', title='Dónde se pierden los pacientes nuevos', body='1 De cada 100 pacientes nuevos. 2 La lectura en una frase. 3 Mes por mes.'),
  m=[(B(264,215,400,460),0,False),(B(680,215,560,420),1,False),(B(264,740,1304,260),2,False)],
  f=['Esta vista muestra, de cada cien pacientes nuevos, cuántos vuelven a su primera, segunda y tercera reevaluación.', 'La plataforma lo resume en una frase: dónde más se pierden y cómo va frente a la meta.', 'Y el mismo reparto, mes por mes.']),
 dict(n='Campañas', t='shot', p=dict(src='ger/i-campanas.png', desde=TODO, hasta=B(250,160,1340,720), paso='Indicadores · Campañas', title='Qué campañas traen pacientes que vuelven', body='1 Por canal: pacientes nuevos y cuántos volvieron.'),
  m=[(B(264,305,1120,440),0,False)],
  f=['Campañas cruza cada paciente con el CRM de leads.', 'Muestra qué canales y qué campañas traen pacientes que realmente vuelven, no solo los que sacan la primera cita.']),
 dict(n='Procedimientos', t='shot', p=dict(src='ger/i-procs.png', desde=TODO, hasta=B(250,160,1340,560), paso='Indicadores · Procedimientos', title='De lo cotizado, cuánto se hizo', body='1 Cotizados, empezados y completados, por tipo.'),
  m=[(B(264,400,1120,285),0,False)],
  f=['Procedimientos compara lo cotizado con lo que se empezó y se completó, por tipo de tratamiento o procedimiento.']),
 dict(n='Por médico', t='shot', p=dict(src='ger/i-procs-medico.png', desde=TODO, hasta=B(250,160,1340,400), paso='Indicadores · por médico', title='La conversión de cada médico', body='1 Cuánto de lo que indica cada doctor se realiza.'),
  m=[(B(264,311,1120,187),0,False)],
  f=['Y la misma conversión por médico: cuánto de lo que indica cada doctor llega a realizarse.']),
 dict(n='Recuperación', t='shot', p=dict(src='ger/i-recup.png', desde=TODO, hasta=B(250,160,1340,600), paso='Indicadores · Recuperación', title='El efecto del seguimiento', body='1 Seguimientos, retornos y días hasta volver. 2 Por asesora.'),
  m=[(B(264,300,860,70),0,False),(B(264,440,1120,240),1,False)],
  f=['Recuperación mide el efecto del seguimiento: cuántos pacientes volvieron después de ser contactados, y en cuántos días.', 'Y el resultado de cada asesora.']),
 dict(n='Motivos', t='shot', p=dict(src='ger/i-motivos.png', desde=TODO, hasta=B(250,160,1340,480), paso='Indicadores · Motivos de cierre', title='Por qué no vuelven', body='1 Motivos de cierre y su peso.'),
  m=[(B(264,345,1120,230),0,False)],
  f=['Motivos de cierre explica por qué se pierden los pacientes: se atienden en otro lugar, no desean continuar, número equivocado, o fallecimiento.']),
 dict(n='Imprimible', t='shot', p=dict(src='ger/g06-imprimible.png', desde=B(0,0,1600,2003), hasta=B(0,0,1600,800), ancho=1600, alto=2003, paso='Indicadores · Resumen para imprimir', title='Un informe de dos páginas, con un botón', body='Listo para las reuniones de gerencia.'),
  m=[],
  f=['Con un botón, Resumen para imprimir arma un informe de dos páginas, listo para las reuniones de gerencia.']),
 dict(n='Dispositivos', t='dispositivos', i=dict(enMovil=1),
  f=['La plataforma funciona en computadora, en modo claro u oscuro,', 'y también en el celular. Varias personas pueden trabajar a la vez sin pisarse.']),
 dict(n='Control', t='card', p=dict(kicker='Control y trazabilidad', title='Nada se borra, todo se mide', body='Identificación por DNI · cada acción con nombre, fecha y hora · anulaciones con motivo · plazos y metas en una celda'),
  f=['Cada paciente se identifica por su de, ene, i. Cada acción guarda quién la hizo, la fecha y la hora, y nada se borra: se anula con un motivo.', 'Los plazos y las metas se cambian editando una celda, sin programar.']),
 dict(n='Recuperar', t='cifras', p=dict(kicker='Lo que se puede recuperar', title='Rentable desde el 10 %', pie='Escenarios del informe del 06/10/2026, sobre una pérdida de S/ 121 200 a S/ 151 200 al mes.'),
  c=[('S/ 12–15 mil', 'al mes, recuperando el 10 %', 0), ('S/ 24–30 mil', 'al mes, recuperando el 20 %', 1), ('S/ 66–82 mil', 'una vez: el 10 % de los perdidos de enero a setiembre', 2)],
  f=['Con recuperar solo el diez por ciento de lo que se pierde, la plataforma devuelve entre doce y quince mil soles al mes.', 'Con el veinte por ciento, entre veinticuatro y treinta mil.', 'Y llamando a los pacientes perdidos de enero a setiembre, el diez por ciento equivale a entre sesenta y cinco y ochenta y dos mil soles.']),
 dict(n='Próximos pasos', t='card', p=dict(kicker='Próximos pasos', title='Usarla todos los días y medir', body='Registrar todas las altas · todo hierro y procedimiento en la plataforma · 15 seguimientos por asesora al día · revisión mensual de Indicadores'),
  f=['Los próximos pasos son registrar todas las altas y todo hierro y procedimiento en la plataforma, mantener la meta de quince seguimientos por asesora al día, y revisar los indicadores al cierre de cada mes.']),
 dict(n='Cierre', t='card', p=dict(kicker='Seguimientos CHP', title='Detectar, contactar y medir', body='En producción desde el 02/10/2026'),
  f=['Seguimientos CHP: detectar a tiempo, contactar, y medir. En producción desde el dos de octubre de dos mil veintiséis.']),
]

def dur(path):
    with wave.open(path) as w: return w.getnframes() / w.getframerate()
escenas = []
for i, e in enumerate(E):
    partes, inicios, t = [], [], INICIO
    for j, frase in enumerate(e['f']):
        fp = os.path.join(OUT, f'_{i:02d}_{j}.wav'); sintetiza(frase, fp, sid=VOZ)
        inicios.append(round(t, 2)); t += dur(fp) + PAUSA; partes.append(fp)
    with wave.open(partes[0]) as w0: params = w0.getparams(); rate = w0.getframerate()
    dest = os.path.join(OUT, f'{i:02d}.wav')
    with wave.open(dest, 'wb') as o:
        o.setparams(params); o.writeframes(b'\x00\x00' * int(INICIO * rate))
        for k, fp in enumerate(partes):
            with wave.open(fp) as w: o.writeframes(w.readframes(w.getnframes()))
            if k < len(partes) - 1: o.writeframes(b'\x00\x00' * int(PAUSA * rate))
    for fp in partes: os.remove(fp)
    escenas.append(dict(e, audio=f'voz-ger/{i:02d}.wav', inicios=inicios, seg=round(dur(dest) + COLA, 1)))
    print(e['n'], escenas[-1]['seg'])

js = lambda v: json.dumps(v, ensure_ascii=False)
caja = lambda c: '{ x: %d, y: %d, w: %d, h: %d }' % (c['x'], c['y'], c['w'], c['h'])
TR = '      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />\n'
cuerpo = []
for e in escenas:
    fr = round(e['seg'] * FPS); ini = e['inicios']
    s = f'      <TransitionSeries.Sequence name={js(e["n"])} durationInFrames={{{fr}}} premountFor={{fps}}>\n'
    if e['t'] == 'card':
        s += '        <Card ' + ' '.join((k if v is True else f'{k}={js(v)}') for k, v in e['p'].items()) + ' />\n'
    elif e['t'] == 'cifras':
        cif = ', '.join('{ valor: %s, texto: %s, en: %.2f }' % (js(v), js(tx), ini[idx] + 0.2) for v, tx, idx in e['c'])
        s += f'        <Cifras kicker={js(e["p"]["kicker"])} title={js(e["p"]["title"])} pie={js(e["p"]["pie"])} cifras={{[{cif}]}} />\n'
    elif e['t'] == 'flujo':
        s += '        <Flujo ' + ' '.join(f'{k}={{{ini[v] + 0.2:.2f}}}' for k, v in e['i'].items()) + ' />\n'
    elif e['t'] == 'dispositivos':
        s += f'        <Dispositivos enMovil={{{ini[e["i"]["enMovil"]] + 0.2:.2f}}} />\n'
    else:
        p = e['p']
        marcas = ['{ caja: %s, en: %.2f%s }' % (caja(c), ini[idx] + 0.2, ', clic: true' if clic else '') for c, idx, clic in e['m']]
        extra = (f' ancho={{{p["ancho"]}}} alto={{{p["alto"]}}}' if 'ancho' in p else '')
        s += (f'        <Shot src={js(p["src"])} desde={{{caja(p["desde"])}}} hasta={{{caja(p["hasta"])}}}{extra}\n'
              '          marcas={[\n            ' + ',\n            '.join(marcas) + '\n          ]}\n'
              f'          paso={js(p["paso"])} title={js(p["title"])}\n          body={js(p["body"])} />\n')
    s += f'        <Audio name="Voz" src={{staticFile({js(e["audio"])})}} premountFor={{fps}} />\n      </TransitionSeries.Sequence>\n'
    cuerpo.append(s)
tsx = ('import { Audio } from "@remotion/media";\nimport { TransitionSeries, linearTiming } from "@remotion/transitions";\nimport { fade } from "@remotion/transitions/fade";\n'
       'import { staticFile, useVideoConfig } from "remotion";\nimport { Card } from "./Card";\nimport { Cifras } from "./Cifras";\nimport { Dispositivos } from "./Dispositivos";\nimport { Flujo } from "./Flujo";\nimport { Shot } from "./Shot";\n\n'
       '// Generado por narrar-ger.py: presentación de la plataforma a gerencia.\n'
       'export const Gerencia = () => {\n  const { fps } = useVideoConfig();\n  return (\n    <TransitionSeries>\n' + TR.join(cuerpo) + '    </TransitionSeries>\n  );\n};\n')
open(os.path.join(P, 'src/Gerencia.tsx'), 'w').write(tsx)
total = sum(round(e['seg'] * FPS) for e in escenas) - 12 * (len(escenas) - 1)
r = open(os.path.join(P, 'src/Root.tsx')).read()
if 'PresentacionGerencia' not in r:
    r = r.replace('import { Tutorial } from "./Tutorial";', 'import { Gerencia } from "./Gerencia";\nimport { Tutorial } from "./Tutorial";')
    r = r.replace('      <Folder name="Elementos">', '      <Composition\n        id="PresentacionGerencia"\n        component={Gerencia}\n        durationInFrames={%d}\n        fps={30}\n        width={1920}\n        height={1080}\n      />\n      <Folder name="Elementos">' % total)
else:
    r = re.sub(r'(id="PresentacionGerencia"\s*component=\{Gerencia\}\s*durationInFrames=\{)\d+', lambda m: m.group(1) + str(total), r)
open(os.path.join(P, 'src/Root.tsx'), 'w').write(r)
print('total', total, total / FPS)
