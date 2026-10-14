"""Presentación a gerencia con el estilo nuevo (toma el guion de narrar-ger.py)."""
import os, sys
D = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, D)
src = open(os.path.join(D, 'narrar-ger.py')).read(); ns = {'__file__': os.path.join(D, 'narrar-ger.py')}
exec(src[:src.index('def dur(')], ns)
E = ns['E']
FONDOS = {'Antes': 'hueso', 'Indicadores': 'noche', 'Control': 'rubor', 'Próximos pasos': 'hueso'}
POR_ESCENA = {'Tablero': 'granate', 'Por médico': 'granate', 'Qué pasó': 'granate', 'Registro': 'noche', 'Pacientes': 'rubor'}
for e in E:
    if e['n'] in FONDOS: e['fondo'] = FONDOS[e['n']]
    if e['n'] in POR_ESCENA and e['t'] == 'shot': e['fondo'] = POR_ESCENA[e['n']]
cierre = next(e for e in E if e['n'] == 'Cierre')
cierre.update(t='cierre', p=dict(frase='Detectar a tiempo, contactar y medir', pie='En producción desde el 02/10/2026'))
E.insert(0, dict(n='Apertura', t='apertura', seg=3.4, p=dict(palabras=['Detectar', 'Contactar', 'Medir', 'Recuperar', 'Seguimiento', 'Indicadores'], lema='Presentación a gerencia')))
from generar import escribir
escribir(E, 'PresentacionGerencia', 'Gerencia', 'Gerencia.tsx', 'voz-ger')
