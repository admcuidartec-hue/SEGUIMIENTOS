import type React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Logo } from "./Logo";
import { barlow, cursiva, type Fondo, FONDOS, titular } from "./theme";

type Props = { readonly kicker: string; readonly title: string; readonly cursivaTexto?: string; readonly fondo: Fondo };

/** Portadilla de sección a color pleno: antetítulo, titular condensado y subtítulo en cursiva. */
export const Seccion: React.FC<Props> = ({ kicker, title, cursivaTexto, fondo }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const F = FONDOS[fondo];
  const sube = (d: number) => ({
    opacity: interpolate(frame, [d * fps, (d + 0.6) * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    translate: interpolate(frame, [d * fps, (d + 0.8) * fps], ["0px 50px", "0px 0px"], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) }),
  });
  const palabras = title.split(" ");
  return (
    <AbsoluteFill style={{ background: F.fondo, padding: "0 150px", justifyContent: "center" }}>
      <Logo claro={F.claro} ancho={260} style={{ position: "absolute", left: 150, top: 90, ...sube(0) }} />
      <div style={{ ...sube(0.1), display: "flex", alignItems: "center", gap: 26 }}>
        <div style={{ width: interpolate(frame, [0.2 * fps, 0.9 * fps], [0, 110], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) }), height: 3, backgroundColor: F.acento }} />
        <div style={{ fontFamily: barlow, fontWeight: 600, fontSize: 40, letterSpacing: "0.22em", color: F.acento, textTransform: "uppercase" }}>{kicker}</div>
      </div>
      <div style={{ fontFamily: titular, fontWeight: 600, fontSize: 150, lineHeight: 0.98, color: F.texto, textTransform: "uppercase", marginTop: 26, maxWidth: 1620, display: "flex", flexWrap: "wrap", columnGap: 34 }}>
        {palabras.map((p, i) => <span key={i} style={sube(0.22 + i * 0.07)}>{p}</span>)}
      </div>
      {cursivaTexto ? (
        <div style={{ ...sube(0.3 + palabras.length * 0.07), fontFamily: cursiva, fontStyle: "italic", fontWeight: 500, fontSize: 64, lineHeight: 1.2, color: F.suave, marginTop: 30, maxWidth: 1500 }}>
          {cursivaTexto}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
