import type React from "react";
import { useCurrentFrame } from "remotion";
import { APP, CHP } from "../constants/colores";
import { TITULAR, UI } from "../constants/tipografia";
import { progreso, resorte } from "./anim";
import { Icono } from "./ui/Icono";

/**
 * «¿QUÉ PASA SI NO SE HACE?» — bloque de advertencia: un titular y una lista de consecuencias que entran una a una.
 * `cadencia` = cuadros entre una consecuencia y la siguiente.
 */
export const ConsequenceAlert: React.FC<{
  readonly titulo: string;
  readonly items: readonly string[];
  readonly desde: number;
  readonly cadencia?: number;
  readonly x: number;
  readonly y: number;
  readonly w: number;
}> = ({ titulo, items, desde, cadencia = 20, x, y, w }) => {
  const frame = useCurrentFrame();
  const r = resorte(frame, desde, 150, 15);
  const pulso = 0.5 + 0.5 * Math.sin((frame - desde) / 9);
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, boxSizing: "border-box", borderRadius: 24, overflow: "hidden", backgroundColor: "#FFFFFF", boxShadow: "0 30px 70px rgba(20,8,8,0.35)", opacity: Math.min(1, r * 1.4), scale: String(0.9 + 0.1 * r), fontFamily: UI }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "24px 32px", backgroundColor: CHP.granate, color: "#FFFFFF" }}>
        <div style={{ width: 58, height: 58, borderRadius: 999, display: "grid", placeItems: "center", backgroundColor: `rgba(250,246,241,${0.14 + 0.1 * pulso})` }}>
          <Icono n="alerta" t={34} color="#FFFFFF" />
        </div>
        <div style={{ fontFamily: TITULAR, fontSize: 54, lineHeight: 1, textTransform: "uppercase" }}>{titulo}</div>
      </div>
      <div style={{ padding: "18px 32px 26px", display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((it, i) => {
          const p = progreso(frame, desde + 14 + i * cadencia, 14);
          return (
            <div key={it} style={{ display: "flex", alignItems: "center", gap: 16, opacity: p, translate: `${(1 - p) * 30}px 0px`, fontSize: 30, color: APP.ink, padding: "8px 0", borderBottom: i < items.length - 1 ? `1px solid ${APP.line}` : "none" }}>
              <Icono n="cerrar" t={30} color={CHP.acento} grosor={3} />
              {it}
            </div>
          );
        })}
      </div>
    </div>
  );
};
