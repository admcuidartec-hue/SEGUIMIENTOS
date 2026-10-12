import type React from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { barlow, FONDO_GRANATE, titular } from "./theme";

type Props = {
  readonly kicker: string;
  readonly title: string;
  readonly body?: string;
  readonly portada?: boolean;
};

/** Portada y tarjetas de capítulo con la identidad del CHP: logo, antetítulo entre líneas y titular condensado. */
export const Card: React.FC<Props> = ({ kicker, title, body, portada = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sube = (desde: number) => ({
    opacity: interpolate(frame, [desde * fps, (desde + 0.6) * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    translate: interpolate(frame, [desde * fps, (desde + 0.8) * fps], ["0px 40px", "0px 0px"], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1),
    }),
  });
  const linea = (desde: number) => ({
    width: interpolate(frame, [desde * fps, (desde + 0.7) * fps], [0, 120], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1),
    }),
    height: 2, backgroundColor: "rgba(250,246,241,0.55)",
  });
  return (
    <AbsoluteFill style={{ background: FONDO_GRANATE, alignItems: "center", justifyContent: "center", padding: "0 140px", textAlign: "center" }}>
      <Img src={staticFile("logo-chp.png")} style={{ ...sube(0), width: portada ? 460 : 340, marginBottom: portada ? 84 : 60 }} />
      <div style={{ ...sube(0.12), display: "flex", alignItems: "center", gap: 30 }}>
        <div style={linea(0.2)} />
        <div style={{ fontFamily: barlow, fontWeight: 600, fontSize: portada ? 46 : 40, letterSpacing: "0.22em", color: "#F2D6D0", textTransform: "uppercase" }}>{kicker}</div>
        <div style={linea(0.2)} />
      </div>
      <div style={{ ...sube(0.3), fontFamily: titular, fontWeight: 600, fontSize: portada ? 140 : 118, lineHeight: 1.02, color: "#FFFFFF", textTransform: "uppercase", marginTop: 34, maxWidth: 1560, letterSpacing: "0.005em" }}>
        {title}
      </div>
      {body ? (
        <div style={{ ...sube(0.55), fontFamily: barlow, fontWeight: 400, fontSize: 46, lineHeight: 1.3, color: "#EBD3CE", marginTop: 34, maxWidth: 1400 }}>
          {body}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
