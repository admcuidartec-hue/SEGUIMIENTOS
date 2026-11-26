import type React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { CHP } from "../constants/colores";
import { SUAVE } from "./anim";

/** Onda de clic: un anillo que crece y se desvanece donde se hizo clic. `escala` compensa el zoom de la cámara. */
export const ClickRipple: React.FC<{ readonly x: number; readonly y: number; readonly desde: number; readonly escala?: number; readonly color?: string }> = ({
  x, y, desde, escala = 1, color = CHP.acento,
}) => {
  const frame = useCurrentFrame();
  const t = frame - desde;
  if (t < 0 || t > 24) return null;
  const r = interpolate(t, [0, 22], [6, 48], { extrapolateRight: "clamp", easing: SUAVE }) / escala;
  const o = interpolate(t, [0, 4, 22], [0, 0.75, 0], { extrapolateRight: "clamp" });
  return (
    <>
      <div style={{ position: "absolute", left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: 999, border: `${4 / escala}px solid ${color}`, opacity: o, pointerEvents: "none" }} />
      <div style={{ position: "absolute", left: x - 10 / escala, top: y - 10 / escala, width: 20 / escala, height: 20 / escala, borderRadius: 999, backgroundColor: color, opacity: o * 0.35 }} />
    </>
  );
};
