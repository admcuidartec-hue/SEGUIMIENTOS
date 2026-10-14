import type React from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { barlow, C, CAPTURA, type Caja, fontFamily } from "./theme";

export type Marca = { readonly caja: Caja; readonly en: number; readonly clic?: boolean };

type Props = {
  readonly src: string;
  readonly desde: Caja;          // encuadre inicial
  readonly hasta: Caja;          // encuadre al que se acerca la cámara
  readonly marcas: readonly Marca[];
  readonly paso: string;
  readonly title: string;
  readonly body: string;
  readonly ancho?: number;        // tamaño CSS de la captura (por omisión 1600 × 1000)
  readonly alto?: number;
};

// Escenario a la izquierda (captura), texto a la derecha.
const ESC = { x: 64, y: 64, w: 1176, h: 952 };
const PANEL_X = 1304;

/** Encuadra la zona `c` en el escenario sin mostrar nada fuera de la captura (de `ancho` × `alto`). */
const encuadre = (c: Caja, ancho: number, alto: number) => {
  const s = Math.min(ESC.w / c.w, ESC.h / c.h);
  const fija = (t: number, tam: number, esc: number, ini: number) =>
    tam * s <= esc ? ini + (esc - tam * s) / 2 : Math.min(ini, Math.max(ini + esc - tam * s, t));
  return {
    s,
    tx: fija(ESC.x + (ESC.w - c.w * s) / 2 - c.x * s, ancho, ESC.w, ESC.x),
    ty: fija(ESC.y + (ESC.h - c.h * s) / 2 - c.y * s, alto, ESC.h, ESC.y),
  };
};

/** Un paso sobre una captura: la cámara se acerca a la zona y se marcan los botones en orden. */
export const Shot: React.FC<Props> = ({ src, desde, hasta, marcas, paso, title, body, ancho = CAPTURA.w, alto = CAPTURA.h }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = interpolate(frame, [0.3 * fps, 1.5 * fps], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.65, 0, 0.35, 1),
  });
  const a = encuadre(desde, ancho, alto), b = encuadre(hasta, ancho, alto);
  const s = a.s + (b.s - a.s) * t, tx = a.tx + (b.tx - a.tx) * t, ty = a.ty + (b.ty - a.ty) * t;
  const texto = (d: number) => ({
    opacity: interpolate(frame, [d * fps, (d + 0.5) * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    translate: interpolate(frame, [d * fps, (d + 0.7) * fps], ["30px 0px", "0px 0px"], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1),
    }),
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#EFE7DF", fontFamily }}>
      <div style={{ position: "absolute", left: ESC.x - 8, top: ESC.y - 8, width: ESC.w + 16, height: ESC.h + 16, borderRadius: 28, backgroundColor: "#E4D9CF" }} />
      <div style={{ position: "absolute", left: ESC.x, top: ESC.y, width: ESC.w, height: ESC.h, overflow: "hidden", borderRadius: 20, backgroundColor: "#F3F1F0" }}>
        <Img
          src={staticFile(src)}
          style={{
            position: "absolute", left: 0, top: 0, width: ancho, height: alto, transformOrigin: "0 0",
            translate: `${tx - ESC.x}px ${ty - ESC.y}px`, scale: String(s),
          }}
        />
        {marcas.map((m, i) => {
          const ini = m.en * fps;
          const p = interpolate(frame, [ini, ini + 0.45 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });
          const pulso = frame > ini + 0.45 * fps ? 1 + 0.03 * Math.sin(((frame - ini) / fps) * Math.PI * 2) : 1;
          const pad = 6;
          const x = (m.caja.x - pad) * s + tx - ESC.x, y = (m.caja.y - pad) * s + ty - ESC.y;
          const w = (m.caja.w + pad * 2) * s, h = (m.caja.h + pad * 2) * s;
          const onda = m.clic ? interpolate(frame, [ini + 0.5 * fps, ini + 1.2 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
          return (
            <div key={i} style={{ position: "absolute", left: x, top: y, width: w, height: h, opacity: p, scale: String((1.15 - 0.15 * p) * pulso) }}>
              <div style={{ position: "absolute", inset: 0, borderRadius: 14, border: `6px solid ${C.granate}`, boxShadow: "0 0 0 8px rgba(111,23,19,0.18), 0 10px 30px rgba(74,14,11,0.25)" }} />
              {m.clic ? (
                <div style={{
                  position: "absolute", left: "50%", top: "50%", width: 90, height: 90, marginLeft: -45, marginTop: -45, borderRadius: 999,
                  backgroundColor: C.granate, opacity: onda > 0 && onda < 1 ? 0.35 * (1 - onda) : 0, scale: String(0.3 + onda * 1.4),
                }} />
              ) : null}
              <div style={{
                position: "absolute", left: -22, top: -22, width: 52, height: 52, borderRadius: 999, backgroundColor: C.granate, color: C.hueso,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 700, boxShadow: "0 4px 12px rgba(0,0,0,.25)",
              }}>{i + 1}</div>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: PANEL_X, top: 0, width: 1920 - PANEL_X, height: 1080, backgroundColor: C.hueso, padding: "120px 72px 100px 64px", display: "flex", flexDirection: "column", gap: 28 }}>
        <div style={{ ...texto(0.2), fontFamily: barlow, color: C.granate, fontSize: 32, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase" }}>{paso}</div>
        <div style={{ ...texto(0.35), color: C.tinta, fontSize: 64, fontWeight: 700, lineHeight: 1.08, letterSpacing: "-0.015em" }}>{title}</div>
        {(() => {
          // «1 Copie… 2 Pulse…»: cada número se lista junto a su círculo en pantalla, y aparece cuando se marca.
          const partes = body.split(/\s(?=\d\s[A-ZÁÉÍÓÚÑ«¿])/);
          const lista = /^\d\s/.test(body) ? partes.filter((x) => /^\d\s/.test(x)) : [];
          const resto = /^\d\s/.test(body) ? partes.filter((x) => !/^\d\s/.test(x)) : [body];
          return (
            <>
              {lista.map((x, i) => {
                const m = marcas[i];
                const d = m ? m.en : 0.6 + i * 0.3;
                const [txt, ...cola] = x.slice(2).split(/(?<=\.)\s/);
                return (
                  <div key={i} style={{ ...texto(d), display: "flex", gap: 22, alignItems: "flex-start" }}>
                    <div style={{ flexShrink: 0, width: 52, height: 52, borderRadius: 999, backgroundColor: C.granate, color: C.hueso, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 700, marginTop: 2 }}>{x[0]}</div>
                    <div style={{ color: C.tinta, fontSize: 38, fontWeight: 500, lineHeight: 1.3 }}>
                      {txt}
                      {cola.length ? <div style={{ color: C.gris, fontSize: 34, marginTop: 10 }}>{cola.join(" ")}</div> : null}
                    </div>
                  </div>
                );
              })}
              {resto.map((x, i) => (
                <div key={"r" + i} style={{ ...texto(0.6), color: C.gris, fontSize: 40, fontWeight: 500, lineHeight: 1.35 }}>{x}</div>
              ))}
            </>
          );
        })()}
        <div style={{
          position: "absolute", left: 64, bottom: 56, width: 250, height: 67, backgroundColor: C.granate,
          WebkitMaskImage: `url(${staticFile("logo-chp.png")})`, WebkitMaskSize: "contain", WebkitMaskRepeat: "no-repeat",
          maskImage: `url(${staticFile("logo-chp.png")})`, maskSize: "contain", maskRepeat: "no-repeat",
        }} />
      </div>
    </AbsoluteFill>
  );
};
