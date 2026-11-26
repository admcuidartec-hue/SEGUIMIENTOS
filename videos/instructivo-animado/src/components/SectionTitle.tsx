import type React from "react";
import { useCurrentFrame } from "remotion";
import { CABECERA } from "../constants/areaSegura";
import { CHP } from "../constants/colores";
import { BARLOW, TITULAR } from "../constants/tipografia";
import { progreso } from "./anim";

/**
 * TÍTULO DE SECCIÓN en la cabecera (arriba a la izquierda): antetítulo pequeño y titular condensado.
 * Se reserva el ancho para que nunca choque con las insignias de público de la derecha.
 */
export const SectionTitle: React.FC<{ readonly kicker: string; readonly titulo: string; readonly oscuro?: boolean; readonly ancho?: number }> = ({
  kicker, titulo, oscuro = false, ancho = 820,
}) => {
  const frame = useCurrentFrame();
  const p = progreso(frame, 4, 16);
  return (
    <div style={{ position: "absolute", left: CABECERA.x, top: CABECERA.y - 4, width: ancho, opacity: p, translate: `${(1 - p) * -20}px 0px` }}>
      <div style={{ fontFamily: BARLOW, fontWeight: 600, fontSize: 21, letterSpacing: "0.2em", textTransform: "uppercase", color: oscuro ? "#F2D6D0" : CHP.acento, whiteSpace: "nowrap" }}>{kicker}</div>
      <div style={{ fontFamily: TITULAR, fontWeight: 600, fontSize: 50, lineHeight: 1, textTransform: "uppercase", color: oscuro ? "#FFFFFF" : CHP.tinta, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{titulo}</div>
    </div>
  );
};
