import type React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { cursiva, FONDO_GRANATE, titular } from "./theme";

/** Apertura: un cilindro de palabras que gira en 3D (inspirado en el video de referencia) y se aleja. */
export const Apertura: React.FC<{ readonly palabras: readonly string[]; readonly lema: string }> = ({ palabras, lema }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const n = palabras.length, radio = 620;
  const giro = interpolate(frame, [0, durationInFrames], [-40, 250], { easing: Easing.bezier(0.45, 0, 0.2, 1) });
  const sale = interpolate(frame, [durationInFrames - 0.7 * fps, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const entra = interpolate(frame, [0, 0.5 * fps], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: FONDO_GRANATE, alignItems: "center", justifyContent: "center", perspective: 1600, overflow: "hidden" }}>
      {[0].map((fila) => (
        <div key={fila} style={{ position: "absolute", top: 440 + fila, left: 960, width: 0, height: 170, transformStyle: "preserve-3d", rotate: `x 8deg`, opacity: entra * sale }}>
          <div style={{ transformStyle: "preserve-3d", rotate: `y ${giro * (fila === 0 ? 1 : -0.8) + fila * 20}deg` }}>
            {palabras.map((p, i) => (
              <div key={i} style={{
                position: "absolute", left: -560, width: 1120, height: 170, display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: titular, fontWeight: 600, fontSize: 150, color: "#fff", textTransform: "uppercase", whiteSpace: "nowrap",
                backfaceVisibility: "hidden", transform: `rotateY(${(i * 360) / n}deg) translateZ(${radio}px)`,
              }}>{p}</div>
            ))}
          </div>
        </div>
      ))}
      <div style={{ position: "absolute", bottom: 150, fontFamily: cursiva, fontStyle: "italic", fontSize: 58, color: "#F2D6D0", opacity: interpolate(frame, [0.8 * fps, 1.4 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) * sale }}>{lema}</div>
    </AbsoluteFill>
  );
};
