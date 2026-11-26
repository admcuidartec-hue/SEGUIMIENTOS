import type React from "react";
import { useCurrentFrame } from "remotion";
import { SUBTITULOS } from "../constants/areaSegura";
import { SUBTITULO } from "../constants/colores";
import type { EscenaId } from "../constants/duraciones";
import { T, UI } from "../constants/tipografia";
import { lineasDeEscena } from "../constants/tiempos";
import { progreso } from "./anim";

/**
 * SUBTÍTULOS. Muestra la línea del guion (constants/guion.ts) que corresponde al cuadro actual de la escena, con su
 * ventana calculada en constants/tiempos.ts. Dos renglones como máximo, centrados, anclados al borde inferior del
 * área segura: crecen hacia arriba y nunca bajan de los 60 px de margen.
 */
export const Subtitles: React.FC<{ readonly escena: EscenaId }> = ({ escena }) => {
  const frame = useCurrentFrame();
  const linea = lineasDeEscena(escena).find((l) => frame >= l.desde && frame < l.hasta);
  if (!linea) return null;
  const o = Math.min(progreso(frame, linea.desde, 5), 1 - progreso(frame, linea.hasta - 5, 5));
  return (
    <div style={{ position: "absolute", left: SUBTITULOS.x, top: SUBTITULOS.y, width: SUBTITULOS.w, height: SUBTITULOS.h, display: "flex", alignItems: "flex-end", justifyContent: "center", pointerEvents: "none" }}>
      <div
        style={{
          maxWidth: SUBTITULOS.w, boxSizing: "border-box", padding: "12px 30px 14px", borderRadius: 14, backgroundColor: SUBTITULO.fondo,
          border: `1px solid ${SUBTITULO.borde}`, color: SUBTITULO.tinta, fontFamily: UI, fontWeight: 500, fontSize: T.subtitulo, lineHeight: 1.3,
          textAlign: "center", opacity: o, translate: `0px ${(1 - o) * 8}px`, textWrap: "balance",
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
        }}
      >
        {linea.texto}
      </div>
    </div>
  );
};
