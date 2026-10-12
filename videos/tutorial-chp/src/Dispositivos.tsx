import type React from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { barlow, C, titular } from "./theme";

/** Escritorio en modo oscuro y celular, lado a lado. */
export const Dispositivos: React.FC<{ readonly enMovil: number }> = ({ enMovil }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ve = (d: number) => ({
    opacity: interpolate(frame, [d * fps, (d + 0.6) * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    translate: interpolate(frame, [d * fps, (d + 0.9) * fps], ["0px 50px", "0px 0px"], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) }),
  });
  return (
    <AbsoluteFill style={{ backgroundColor: "#EFE7DF", padding: "70px 90px" }}>
      <div style={{ fontFamily: barlow, fontWeight: 600, fontSize: 34, letterSpacing: "0.2em", color: C.granate, textTransform: "uppercase" }}>En cualquier dispositivo</div>
      <div style={{ fontFamily: titular, fontWeight: 600, fontSize: 84, color: C.tinta, textTransform: "uppercase", lineHeight: 1 }}>Computadora, celular, claro u oscuro</div>
      <div style={{ display: "flex", gap: 60, marginTop: 50, alignItems: "flex-start" }}>
        <Img src={staticFile("ger/g08-oscuro.png")} style={{ ...ve(0.4), width: 1240, borderRadius: 22, boxShadow: "0 20px 50px rgba(0,0,0,0.25)" }} />
        <Img src={staticFile("ger/g07-movil.png")} style={{ ...ve(enMovil), width: 340, borderRadius: 36, border: "10px solid #1b1415", boxShadow: "0 20px 50px rgba(0,0,0,0.3)" }} />
      </div>
    </AbsoluteFill>
  );
};
