"""Video instructivo con el estilo nuevo (toma el guion de narrar.py)."""
import os, sys
D = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, D)
src = open(os.path.join(D, 'narrar.py')).read(); ns = {'__file__': os.path.join(D, 'narrar.py')}
exec(src[:src.index('def dur(')], ns)
E = ns['E']
FONDOS = {'Caso 1': 'granate', 'Caso 2': 'noche', 'Caso 3': 'rubor', 'Recuerde · sesiones': 'hueso', 'Caso 4': 'granate', 'Caso 5': 'noche', 'Caso 6': 'rubor', 'Caso 7': 'granate'}
for e in E:
    if e['n'] in FONDOS: e['fondo'] = FONDOS[e['n']]
    if e['n'] in ('Elegir nombre', 'Tablero'): e['fondo'] = 'noche'
cierre = next(e for e in E if e['n'] == 'Cierre')
cierre.update(t='cierre', p=dict(frase='¿Dudas? Envíe una captura de pantalla', pie='Consulte el manual de la plataforma'))
E.insert(0, dict(n='Apertura', t='apertura', seg=3.4, p=dict(palabras=['Seguimiento', 'Pacientes', 'Sesiones', 'Registro', 'Control', 'Indicadores'], lema='Plataforma de seguimiento de pacientes')))
from generar import escribir
escribir(E, 'TutorialSeguimientos', 'Tutorial', 'Tutorial.tsx', 'voz')
