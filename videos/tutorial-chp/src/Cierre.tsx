import type React from "react";
import { AbsoluteFill, Easing, Img, interpolate, random, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { barlow, cursiva, FONDO_GRANATE } from "./theme";

/** Cierre: partículas que se juntan y forman el logo del CHP, con una frase debajo. */
export const Cierre: React.FC<{ readonly frase: string; readonly pie: string }> = ({ frase, pie }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const junta = interpolate(frame, [0, 1.6 * fps], [0, 1], { extrapolateRight: "clamp", easing: Easing.bezier(0.65, 0, 0.35, 1) });
  const logo = interpolate(frame, [1.3 * fps, 2 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const N = 220, W = 700, H = 186; // el logo mide 458 × 122 → a 700 px de ancho
  return (
    <AbsoluteFill style={{ background: FONDO_GRANATE, alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "relative", width: W, height: H }}>
        {Array.from({ length: N }).map((_, i) => {
          const sx = (random("sx" + i) - 0.5) * 2600, sy = (random("sy" + i) - 0.5) * 1500;
          const ex = random("ex" + i) * W, ey = random("ey" + i) * H;
          const x = sx + (ex - sx) * junta, y = sy + (ey - sy) * junta;
          const tam = 4 + random("t" + i) * 7;
          return <div key={i} style={{ position: "absolute", left: x, top: y, width: tam, height: tam, borderRadius: 99, backgroundColor: i % 5 === 0 ? "#F2D6D0" : "#fff", opacity: (1 - logo) * 0.9 }} />;
        })}
        <Img src={staticFile("logo-chp.png")} style={{ position: "absolute", left: 0, top: 0, width: W, opacity: logo, scale: String(0.94 + 0.06 * logo) }} />
      </div>
      <div style={{ marginTop: 70, fontFamily: cursiva, fontStyle: "italic", fontSize: 64, color: "#F2D6D0", opacity: interpolate(frame, [2 * fps, 2.7 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>{frase}</div>
      <div style={{ marginTop: 24, fontFamily: barlow, fontSize: 34, letterSpacing: "0.12em", color: "rgba(250,246,241,0.75)", textTransform: "uppercase", opacity: interpolate(frame, [2.4 * fps, 3.1 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>{pie}</div>
    </AbsoluteFill>
  );
};
