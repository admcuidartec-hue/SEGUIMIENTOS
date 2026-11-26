import type React from "react";
import { useCurrentFrame } from "remotion";
import { CONTENIDO } from "../constants/areaSegura";
import { CHP } from "../constants/colores";
import { BARLOW, TITULAR, UI } from "../constants/tipografia";
import { progreso } from "./anim";

/**
 * RÓTULO INFERIOR. Una franja que entra desde la izquierda, apoyada en el borde inferior de la zona de contenido
 * (justo encima de los subtítulos, nunca debajo). Para «Paso 3 de 6», el nombre de una pantalla, etc.
 */
export const LowerThird: React.FC<{
  readonly kicker: string;
  readonly titulo: string;
  readonly desde: number;
  readonly hasta?: number;
  readonly detalle?: string;
  readonly x?: number;
  readonly yInferior?: number;
}> = ({ kicker, titulo, desde, hasta, detalle, x = CONTENIDO.x, yInferior = CONTENIDO.y + CONTENIDO.h }) => {
  const frame = useCurrentFrame();
  const p = progreso(frame, desde, 18);
  const s = hasta === undefined ? 0 : progreso(frame, hasta - 12, 12);
  if (p <= 0 || s >= 1) return null;
  return (
    <div style={{ position: "absolute", left: x, bottom: 1080 - yInferior, display: "flex", alignItems: "stretch", opacity: 1 - s, clipPath: `inset(0 ${(1 - p) * 100}% 0 0)` }}>
      <div style={{ width: 10, backgroundColor: CHP.acento, borderRadius: "8px 0 0 8px" }} />
      <div style={{ backgroundColor: CHP.granate, padding: "12px 26px 14px", borderRadius: "0 12px 12px 0", boxShadow: "0 16px 40px rgba(20,8,8,0.3)" }}>
        <div style={{ fontFamily: BARLOW, fontWeight: 600, fontSize: 21, letterSpacing: "0.18em", textTransform: "uppercase", color: "#F2D6D0" }}>{kicker}</div>
        <div style={{ fontFamily: TITULAR, fontSize: 44, lineHeight: 1.05, color: "#FFFFFF", textTransform: "uppercase" }}>{titulo}</div>
        {detalle ? <div style={{ fontFamily: UI, fontSize: 22, color: "#EBD3CE", marginTop: 2 }}>{detalle}</div> : null}
      </div>
    </div>
  );
};
