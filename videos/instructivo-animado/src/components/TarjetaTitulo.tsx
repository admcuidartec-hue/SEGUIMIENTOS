import type React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { FONDOS } from "../constants/colores";
import { BARLOW, TITULAR, UI } from "../constants/tipografia";
import { aparece, progreso } from "./anim";
import { Logo } from "./Logo";

/** Portada y tarjetas de capítulo, con la identidad del CHP: logo, antetítulo entre líneas y titular condensado. */
export const TarjetaTitulo: React.FC<{
  readonly kicker: string;
  readonly titulo: string;
  readonly bajada?: string;
  readonly portada?: boolean;
  readonly desde?: number;
  readonly hasta?: number;
}> = ({ kicker, titulo, bajada, portada = false, desde = 0, hasta }) => {
  const frame = useCurrentFrame();
  const linea = progreso(frame, desde + 6, 20) * 120;
  return (
    <AbsoluteFill style={{ background: FONDOS.granate, alignItems: "center", justifyContent: "center", padding: "0 160px 120px", textAlign: "center" }}>
      <div style={aparece(frame, desde, hasta)}>
        <Logo ancho={portada ? 420 : 320} style={{ marginBottom: portada ? 64 : 48 }} />
      </div>
      <div style={{ ...aparece(frame, desde + 5, hasta), display: "flex", alignItems: "center", gap: 28 }}>
        <div style={{ width: linea, height: 2, backgroundColor: "rgba(250,246,241,0.55)" }} />
        <div style={{ fontFamily: BARLOW, fontWeight: 600, fontSize: portada ? 40 : 34, letterSpacing: "0.22em", color: "#F2D6D0", textTransform: "uppercase" }}>{kicker}</div>
        <div style={{ width: linea, height: 2, backgroundColor: "rgba(250,246,241,0.55)" }} />
      </div>
      <div style={{ ...aparece(frame, desde + 10, hasta), fontFamily: TITULAR, fontWeight: 600, fontSize: portada ? 150 : 120, lineHeight: 1, color: "#FFFFFF", textTransform: "uppercase", marginTop: 26 }}>{titulo}</div>
      {bajada ? <div style={{ ...aparece(frame, desde + 18, hasta), fontFamily: UI, fontSize: 40, lineHeight: 1.3, color: "#EBD3CE", marginTop: 26, maxWidth: 1400 }}>{bajada}</div> : null}
    </AbsoluteFill>
  );
};
