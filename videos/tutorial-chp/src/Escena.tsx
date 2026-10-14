import type React from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Logo } from "./Logo";
import { barlow, type Caja, CAPTURA, cursiva, type Fondo, FONDOS, titular } from "./theme";

export type Pieza = { readonly caja: Caja; readonly en: number; readonly clic?: boolean };

type Props = {
  readonly src: string;
  readonly desde: Caja;
  readonly hasta: Caja;
  readonly marcas: readonly Pieza[];
  readonly paso: string;
  readonly title: string;
  readonly body: string;
  readonly fondo: Fondo;
  readonly ancho?: number;
  readonly alto?: number;
};

// Ventana del navegador a la derecha; texto a la izquierda.
const VEN = { x: 720, y: 110, w: 1110, h: 860, barra: 46 };
const VP = { x: VEN.x, y: VEN.y + VEN.barra, w: VEN.w, h: VEN.h - VEN.barra };

const encuadre = (c: Caja, ancho: number, alto: number) => {
  const s = Math.min(VP.w / c.w, VP.h / c.h);
  const fija = (t: number, tam: number, esc: number) => (tam * s <= esc ? (esc - tam * s) / 2 : Math.min(0, Math.max(esc - tam * s, t)));
  return { s, tx: fija((VP.w - c.w * s) / 2 - c.x * s, ancho, VP.w), ty: fija((VP.h - c.h * s) / 2 - c.y * s, alto, VP.h) };
};

/** Un paso sobre la plataforma: la ventana entra en 3D, la cámara se acerca y cada pieza clave sale de la pantalla cuando la voz la nombra. */
export const Escena: React.FC<Props> = ({ src, desde, hasta, marcas, paso, title, body, fondo, ancho = CAPTURA.w, alto = CAPTURA.h }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const F = FONDOS[fondo];
  const ent = interpolate(frame, [0, 0.9 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });
  const t = interpolate(frame, [0.5 * fps, 1.7 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.65, 0, 0.35, 1) });
  const a = encuadre(desde, ancho, alto), b = encuadre(hasta, ancho, alto);
  const s = a.s + (b.s - a.s) * t, tx = a.tx + (b.tx - a.tx) * t, ty = a.ty + (b.ty - a.ty) * t;
  const sube = (d: number) => ({
    opacity: interpolate(frame, [d * fps, (d + 0.5) * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    translate: interpolate(frame, [d * fps, (d + 0.7) * fps], ["0px 34px", "0px 0px"], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) }),
  });
  // pieza activa: la última cuya hora ya llegó
  const activa = marcas.reduce((k, m, i) => (frame >= m.en * fps ? i : k), -1);
  const foco = activa >= 0 ? interpolate(frame, [marcas[activa].en * fps, (marcas[activa].en + 0.35) * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;

  const partes = body.split(/\s(?=\d\s[A-ZÁÉÍÓÚÑ«¿])/);
  const lista = /^\d\s/.test(body) ? partes.filter((x) => /^\d\s/.test(x)) : [];
  const resto = /^\d\s/.test(body) ? partes.filter((x) => !/^\d\s/.test(x)) : [body];

  return (
    <AbsoluteFill style={{ background: F.fondo }}>
      {/* texto */}
      <div style={{ position: "absolute", left: 100, top: 120, width: 560, display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ ...sube(0.15), fontFamily: barlow, fontWeight: 600, fontSize: 30, letterSpacing: "0.18em", color: F.acento, textTransform: "uppercase" }}>{paso}</div>
        <div style={{ ...sube(0.28), fontFamily: titular, fontWeight: 600, fontSize: 84, lineHeight: 0.98, color: F.texto, textTransform: "uppercase" }}>{title}</div>
        {lista.map((x, i) => {
          const m = marcas[i];
          const [txt, ...cola] = x.slice(2).split(/(?<=\.)\s/);
          const on = activa === i;
          return (
            <div key={i} style={{ ...sube(m ? m.en : 0.6 + i * 0.3), display: "flex", gap: 18, alignItems: "flex-start", opacity: (m && frame < m.en * fps) ? 0 : on || activa < 0 ? 1 : 0.55 }}>
              <div style={{ flexShrink: 0, width: 48, height: 48, borderRadius: 999, backgroundColor: F.claro ? "#6F1713" : "#FAF6F1", color: F.claro ? "#FAF6F1" : "#6F1713", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: barlow, fontWeight: 600, fontSize: 28 }}>{x[0]}</div>
              <div style={{ fontFamily: barlow, fontSize: 36, lineHeight: 1.25, color: F.texto }}>
                {txt}
                {cola.length ? <div style={{ fontFamily: cursiva, fontStyle: "italic", fontSize: 30, color: F.suave, marginTop: 8 }}>{cola.join(" ")}</div> : null}
              </div>
            </div>
          );
        })}
        {resto.map((x, i) => <div key={"r" + i} style={{ ...sube(0.6), fontFamily: cursiva, fontStyle: "italic", fontSize: 42, lineHeight: 1.3, color: F.suave }}>{x}</div>)}
      </div>
      <Logo claro={F.claro} ancho={210} style={{ position: "absolute", left: 100, bottom: 70, opacity: 0.9 }} />

      {/* ventana del navegador, con entrada en 3D */}
      <div style={{ position: "absolute", inset: 0, perspective: 2200 }}>
        <div style={{
          position: "absolute", left: VEN.x, top: VEN.y, width: VEN.w, height: VEN.h, borderRadius: 22, overflow: "hidden",
          backgroundColor: "#F3F1F0", boxShadow: "0 40px 90px rgba(10,4,4,0.45)", transformOrigin: "100% 50%",
          rotate: `y ${interpolate(ent, [0, 1], [-28, 0])}deg`, translate: `${interpolate(ent, [0, 1], [160, 0])}px 0px`, opacity: ent,
        }}>
          <div style={{ height: VEN.barra, backgroundColor: "#E7E1DC", display: "flex", alignItems: "center", gap: 9, padding: "0 18px" }}>
            {["#E06C5F", "#E8B44C", "#6BBF63"].map((c) => <div key={c} style={{ width: 13, height: 13, borderRadius: 99, backgroundColor: c }} />)}
            <div style={{ marginLeft: 18, flex: 1, height: 26, borderRadius: 8, backgroundColor: "#F7F4F1", fontFamily: barlow, fontSize: 17, color: "#7A6D6E", display: "flex", alignItems: "center", paddingLeft: 14 }}>Seguimientos CHP · Centro Hematológico del Perú</div>
          </div>
          <div style={{ position: "relative", width: VP.w, height: VP.h, overflow: "hidden" }}>
            <Img src={staticFile(src)} style={{ position: "absolute", left: 0, top: 0, width: ancho, height: alto, transformOrigin: "0 0", translate: `${tx}px ${ty}px`, scale: String(s) }} />
            <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(20,8,8,0.42)", opacity: foco }} />
          </div>
        </div>
      </div>

      {/* piezas que salen de la pantalla */}
      {marcas.map((m, i) => {
        if (i !== activa) return null;
        const ini = m.en * fps;
        const p = interpolate(frame, [ini, ini + 0.55 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.34, 1.56, 0.64, 1) });
        const pad = 8;
        const bx = (m.caja.x - pad) * s + tx, by = (m.caja.y - pad) * s + ty, bw = (m.caja.w + pad * 2) * s, bh = (m.caja.h + pad * 2) * s;
        const k = Math.max(1, Math.min(1.3, (VP.w * 0.94) / bw, (VP.h * 0.8) / bh));
        const kk = 1 + (k - 1) * p;
        const w = bw * kk, h = bh * kk;
        const cx = Math.min(Math.max(VP.x + bx + bw / 2, VP.x + w / 2 + 10), VP.x + VP.w - w / 2 - 10);
        const cy = Math.min(Math.max(VP.y + by + bh / 2, VP.y + h / 2 + 10), VP.y + VP.h - h / 2 - 10);
        return (
          <div key={i} style={{ position: "absolute", left: cx - w / 2, top: cy - h / 2 - 14 * p, width: w, height: h }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: 16, overflow: "hidden", backgroundColor: "#fff", boxShadow: `0 ${24 * p}px ${60 * p}px rgba(10,4,4,${0.45 * p})`, outline: `4px solid rgba(250,246,241,${p})` }}>
              <Img src={staticFile(src)} style={{ position: "absolute", left: 0, top: 0, width: ancho, height: alto, transformOrigin: "0 0", translate: `${-(m.caja.x - pad) * s * kk}px ${-(m.caja.y - pad) * s * kk}px`, scale: String(s * kk) }} />
            </div>
            <div style={{ position: "absolute", left: -24, top: -24, width: 54, height: 54, borderRadius: 999, backgroundColor: "#6F1713", border: "3px solid #FAF6F1", color: "#FAF6F1", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: barlow, fontWeight: 600, fontSize: 28, opacity: p }}>{i + 1}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
