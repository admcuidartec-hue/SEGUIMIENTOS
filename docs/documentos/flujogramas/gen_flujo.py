"""Flujogramas por fase (estilo BPMN como el PRC.LOG.001) en SVG."""
import os, html
D = os.path.dirname(os.path.abspath(__file__)); OUT = D
H = 890
LANES = [('Médico', 150, 290), ('Asesora de Admisión', 290, 560), ('Plataforma Seguimientos CHP', 560, 800), ('Dirección Médica', 800, 880)]
TW, TH = 136, 58
AZUL, AZUL_F = '#2F5597', '#E9EEF8'

def esc(t): return html.escape(t)

def lineas(cx, cy, texto, size=12, bold=False, color='#111', anchor='middle'):
    ls = texto.split('\n'); y0 = cy - (len(ls) - 1) * (size + 2) / 2 + size / 3
    w = ' font-weight="700"' if bold else ''
    return ''.join(f'<text x="{cx}" y="{y0 + i * (size + 2):.1f}" font-size="{size}" text-anchor="{anchor}" fill="{color}"{w}>{esc(l)}</text>' for i, l in enumerate(ls))

class F:
    def __init__(s, W, titulo): s.W, s.t, s.p = W, titulo, []
    def tarea(s, x, y, txt, tipo='user'):
        s.p.append(f'<rect x="{x-TW/2}" y="{y-TH/2}" width="{TW}" height="{TH}" rx="8" fill="{AZUL_F}" stroke="{AZUL}" stroke-width="1.6"/>')
        ic = {'user': '👤', 'send': '✉', 'auto': '⚙'}[tipo]
        s.p.append(f'<text x="{x-TW/2+6}" y="{y-TH/2+13}" font-size="10" fill="{AZUL}">{ic}</text>')
        s.p.append(lineas(x + 4, y, txt, 11.5))
    def rombo(s, x, y, txt='', dy=40, dx=0):
        s.p.append(f'<polygon points="{x-23},{y} {x},{y-23} {x+23},{y} {x},{y+23}" fill="#FFF3A6" stroke="#A89400" stroke-width="1.6"/>')
        if txt: s.p.append(lineas(x + dx, y + dy, txt, 11, True))
    def inicio(s, x, y, txt, timer=False):
        s.p.append(f'<circle cx="{x}" cy="{y}" r="16" fill="#C9F2B0" stroke="#4E9A2A" stroke-width="2"/>')
        if timer: s.p.append(f'<circle cx="{x}" cy="{y}" r="9" fill="#fff" stroke="#4E9A2A" stroke-width="1.4"/><path d="M{x} {y-6}V{y}H{x+5}" stroke="#4E9A2A" stroke-width="1.4" fill="none"/>')
        s.p.append(lineas(x, y + 32, txt, 10.5, True))
    def fin(s, x, y, txt=''):
        s.p.append(f'<circle cx="{x}" cy="{y}" r="16" fill="#F2A3A3" stroke="#A31515" stroke-width="3.5"/>')
        if txt: s.p.append(lineas(x, y + 32, txt, 10.5, True))
    def reloj(s, x, y, txt):
        s.p.append(f'<circle cx="{x}" cy="{y}" r="16" fill="#fff" stroke="#8A7A00" stroke-width="1.6"/><circle cx="{x}" cy="{y}" r="12" fill="#fff" stroke="#8A7A00" stroke-width="1.2"/><path d="M{x} {y-8}V{y}H{x+6}" stroke="#8A7A00" stroke-width="1.4" fill="none"/>')
        s.p.append(lineas(x, y + 32, txt, 10.5, True))
    def enlace(s, x, y, txt, entra=False, arriba=False):
        f = '#fff' if entra else '#8A8A2A'
        s.p.append(f'<circle cx="{x}" cy="{y}" r="16" fill="#F4F1C9" stroke="#8A8A2A" stroke-width="1.6"/><circle cx="{x}" cy="{y}" r="12" fill="#F4F1C9" stroke="#8A8A2A" stroke-width="1.2"/>')
        s.p.append(f'<path d="M{x-7} {y-3}h7v-4l7 7-7 7v-4h-7z" fill="{f}" stroke="#8A8A2A" stroke-width="1"/>')
        n = txt.count('\n') + 1
        s.p.append(lineas(x, y - 26 - (n - 1) * 6.5 if arriba else y + 34, txt, 11, True))
    def flecha(s, pts, txt='', tx=None, ty=None, anchor='middle'):
        d = 'M' + ' L'.join(f'{a} {b}' for a, b in pts)
        s.p.append(f'<path d="{d}" fill="none" stroke="#222" stroke-width="1.4" marker-end="url(#fl)"/>')
        if txt: s.p.append(lineas(tx, ty, txt, 10.5, True, '#111', anchor))
    def mensaje(s, pts):
        d = 'M' + ' L'.join(f'{a} {b}' for a, b in pts)
        s.p.append(f'<path d="{d}" fill="none" stroke="#666" stroke-width="1.2" stroke-dasharray="6 4" marker-end="url(#ms)" marker-start="url(#mo)"/>')
    def svg(s):
        W = s.W; L = []
        L.append(f'<rect x="4" y="10" width="{W-8}" height="120" fill="#fff" stroke="#333" stroke-width="1.4"/>')
        L.append(f'<line x1="36" y1="10" x2="36" y2="130" stroke="#333" stroke-width="1.4"/>')
        L.append(f'<text transform="translate(24 70) rotate(-90)" font-size="13" font-weight="700" text-anchor="middle">Paciente</text>')
        L.append(f'<rect x="4" y="150" width="{W-8}" height="{H-150-6}" fill="#fff" stroke="#333" stroke-width="1.4"/>')
        L.append(f'<line x1="36" y1="150" x2="36" y2="{H-6}" stroke="#333" stroke-width="1.4"/>')
        L.append(f'<text transform="translate(24 {(150+H)/2}) rotate(-90)" font-size="13" font-weight="700" text-anchor="middle">{esc(s.t)}</text>')
        for nombre, y0, y1 in LANES:
            L.append(f'<line x1="36" y1="{y0}" x2="{W-4}" y2="{y0}" stroke="#333" stroke-width="1"/>')
            L.append(f'<line x1="84" y1="{y0}" x2="84" y2="{min(y1, H-6)}" stroke="#333" stroke-width="1"/>')
            n = nombre.split(' ')
            if y1 - y0 < 120 and len(n) > 1: n = [' '.join(n[:1]), ' '.join(n[1:])]
            elif len(nombre) > 22: n = [' '.join(n[:1]), ' '.join(n[1:])]
            else: n = [nombre]
            for i, t in enumerate(n):
                L.append(f'<text transform="translate({64 + i*14 - (len(n)-1)*7} {(y0+min(y1,H-6))/2}) rotate(-90)" font-size="11.5" font-weight="700" text-anchor="middle">{esc(t)}</text>')
        defs = ('<defs><marker id="fl" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0L10 5L0 10z" fill="#222"/></marker>'
                '<marker id="ms" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto"><path d="M0 0L10 5L0 10z" fill="#fff" stroke="#666"/></marker>'
                '<marker id="mo" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7"><circle cx="5" cy="5" r="4" fill="#fff" stroke="#666"/></marker></defs>')
        return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" font-family="Segoe UI, Arial, sans-serif">{defs}'
                f'<rect width="{W}" height="{H}" fill="#fff"/>' + ''.join(L) + ''.join(s.p) + '</svg>')

T = 'Proceso de Seguimiento y Recuperación de Pacientes'

# ---------- Fase 1 ----------
f = F(1660, T)
f.inicio(110, 220, 'Paciente en\nconsulta')
f.flecha([(126, 220), (162, 220)])
f.tarea(230, 220, 'Evaluar e indicar\nconducta')
f.tarea(230, 70, 'Recibe la\nindicación', 'user')
f.mensaje([(230, 191), (230, 99)])
f.flecha([(230, 249), (230, 396)])
f.tarea(230, 425, 'Recibir indicación\ne identificar por DNI')
f.flecha([(298, 425), (377, 425)])
f.rombo(400, 425, '¿Qué se\nregistra?', dy=0, dx=-62)
f.flecha([(400, 402), (400, 340), (492, 340)], 'decisión', 445, 330)
f.flecha([(423, 425), (492, 425)], 'control', 455, 415)
f.flecha([(400, 448), (400, 510), (492, 510)], 'indicación', 447, 500)
f.tarea(560, 340, 'Registrar decisión\ndel médico')
f.tarea(560, 425, 'Registrar control +\nlaboratorio (retorno\npropuesto: 15 días)')
f.tarea(560, 510, 'Registrar indicación\n(hierro o\nprocedimiento)')
f.flecha([(628, 510), (740, 510), (740, 617)])
f.rombo(740, 640, '¿Tiene fecha\nde 1.ª sesión?', dy=0, dx=-80)
f.flecha([(763, 640), (800, 640), (800, 610), (852, 610)], 'sí', 812, 600)
f.flecha([(740, 663), (740, 720), (852, 720)], 'no', 760, 710)
f.flecha([(628, 425), (895, 425), (895, 581)])
f.tarea(920, 610, 'Crear tarjeta en\n«Agendado»', 'auto')
f.tarea(920, 720, 'Crear tarjeta en\n«Por contactar»', 'auto')
f.flecha([(988, 610), (1062, 610)]); f.enlace(1080, 610, 'B\nVa a Fase 3')
f.flecha([(988, 720), (1062, 720)]); f.enlace(1080, 720, 'A\nVa a Fase 2')
f.flecha([(628, 340), (1127, 340)])
f.rombo(1150, 340, '¿Decisión?', dy=-34, dx=-48)
f.flecha([(1173, 340), (1272, 340)], 'alta', 1222, 330)
f.fin(1290, 340, 'Sale del\nseguimiento')
f.flecha([(1150, 363), (1150, 470), (945, 470), (945, 581)], 'nueva reevaluación\ncon fecha', 1050, 450)
f.flecha([(1150, 317), (1150, 305), (1400, 305), (1400, 581)], 'alta con control\na 6 meses o 1 año', 1470, 400)
f.tarea(1400, 610, 'Programar aviso\n30 días antes\ndel control', 'auto')
f.flecha([(1468, 610), (1542, 610)]); f.enlace(1560, 610, 'A\nVa a Fase 2')
open(os.path.join(OUT, 'fase1.svg'), 'w').write(f.svg())

# ---------- Fase 2 ----------
f = F(1240, T)
f.enlace(135, 610, 'A · Viene de\nFase 1 o 3', entra=True, arriba=True)
f.flecha([(151, 610), (192, 610)])
f.tarea(260, 610, 'Mostrar en «Por\ncontactar» (Tablero)', 'auto')
f.flecha([(260, 581), (260, 454)])
f.tarea(260, 425, 'Elegir paciente y\ncopiar teléfono (C)')
f.flecha([(328, 425), (362, 425)])
f.tarea(430, 425, 'Enviar mensaje\nde WhatsApp', 'send')
f.tarea(430, 70, 'Lee y responde\nel mensaje')
f.mensaje([(430, 396), (430, 99)])
f.flecha([(498, 425), (577, 425)])
f.rombo(600, 425, '¿Respondió?', dy=-34)
f.flecha([(600, 448), (600, 481)], 'no', 612, 468, 'start')
f.tarea(600, 510, 'Anotar\n«No contestó»')
f.flecha([(600, 539), (600, 671)])
f.tarea(600, 700, 'Programar el\nsiguiente intento', 'auto')
f.flecha([(532, 700), (260, 700), (260, 639)], 'nuevo intento en la fecha', 400, 690)
f.flecha([(623, 425), (757, 425)], 'sí', 690, 415)
f.rombo(780, 425, '¿Qué\ndecide?', dy=40, dx=-48)
f.flecha([(780, 402), (780, 369)], 'no volverá', 790, 390, 'start')
f.tarea(780, 340, 'Cerrar el seguimiento\ncon motivo (X)')
f.flecha([(848, 340), (942, 340)]); f.fin(960, 340, 'Seguimiento\ncerrado')
f.flecha([(780, 448), (780, 481)], 'lo pensará', 790, 468, 'start')
f.tarea(780, 510, 'Anotar «Lo pensará»\ny fecha de contacto')
f.flecha([(780, 539), (780, 700), (669, 700)])
f.flecha([(803, 425), (1052, 425)], 'acepta o agenda', 930, 415)
f.tarea(1120, 425, 'Agendar cita o\n1.ª sesión (Agendó\ncita / Aceptó)')
f.tarea(1120, 70, 'Confirma la fecha\npor WhatsApp')
f.mensaje([(1120, 396), (1120, 99)])
f.flecha([(1120, 454), (1120, 581)])
f.tarea(1120, 610, 'Mover a\n«Agendado»', 'auto')
f.flecha([(1052, 610), (1000, 610)])
f.enlace(980, 610, 'B\nVa a Fase 3')
open(os.path.join(OUT, 'fase2.svg'), 'w').write(f.svg())

# ---------- Fase 3 ----------
f = F(1480, T)
f.enlace(135, 610, 'B · Viene de\nFase 1 o 2', entra=True, arriba=True)
f.flecha([(151, 610), (192, 610)])
f.tarea(260, 610, '«Agendado»:\ncita o sesión', 'auto')
f.tarea(260, 70, 'Acude a su cita\no sesión')
f.flecha([(260, 581), (260, 448)])
f.rombo(260, 425, '¿Asistió?', dy=-32, dx=-42)
f.flecha([(260, 402), (260, 249)], 'sí, consulta', 270, 330, 'start')
f.mensaje([(260, 99), (260, 191)])
f.tarea(260, 220, 'Evaluar y decidir')
f.flecha([(328, 220), (402, 220)]); f.enlace(420, 220, 'C · Va a Fase 1\n(registrar decisión)')
f.flecha([(283, 425), (532, 425)], 'sí, sesión', 400, 415)
f.flecha([(237, 425), (100, 425), (100, 730), (192, 730)], 'no (2 días\nsin marcar)', 108, 470, 'start')
f.tarea(260, 730, 'Mover a «Por\ncontactar»: No vino', 'auto')
f.flecha([(328, 730), (402, 730)]); f.enlace(420, 730, 'A\nVa a Fase 2')
f.tarea(600, 425, 'Marcar sesión hecha\ny poner la próxima')
f.flecha([(668, 425), (747, 425)])
f.rombo(770, 425, '¿Última\nsesión?', dy=-44)
f.flecha([(770, 448), (770, 581)], 'no', 782, 520, 'start')
f.tarea(770, 610, 'Volver a «Agendado»\n(o «En tratamiento»)', 'auto')
f.flecha([(702, 610), (328, 610)], 'siguiente sesión', 520, 600)
f.flecha([(793, 425), (950, 425), (950, 581)], 'sí', 870, 415)
f.tarea(950, 610, 'Pasar a\n«Completado»', 'auto')
f.flecha([(1018, 610), (1084, 610)]); f.reloj(1100, 610, '30 días')
f.flecha([(1116, 610), (1172, 610)])
f.tarea(1240, 610, 'Mover a «Por\ncontactar»: Por\nreevaluar', 'auto')
f.flecha([(1308, 610), (1372, 610)]); f.enlace(1390, 610, 'A\nVa a Fase 2')
f.inicio(120, 836, 'Cierre de mes', timer=True)
f.flecha([(136, 836), (352, 836)])
f.tarea(420, 836, 'Revisar indicadores\ndel mes')
f.flecha([(488, 836), (582, 836)]); f.fin(600, 836)
open(os.path.join(OUT, 'fase3.svg'), 'w').write(f.svg())
print('ok')
