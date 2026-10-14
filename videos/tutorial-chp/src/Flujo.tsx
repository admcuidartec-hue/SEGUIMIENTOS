import type React from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { barlow, C, FONDO_GRANATE, titular } from "./theme";

type Props = { readonly enFuentes: number; readonly enCentro: number; readonly enPantallas: number };

const Caja: React.FC<{ readonly t: string; readonly s: string; readonly style: React.CSSProperties; readonly fuerte?: boolean }> = ({ t, s, style, fuerte }) => (
  <div style={{ ...style, borderRadius: 22, padding: "26px 30px", backgroundColor: fuerte ? C.hueso : "rgba(250,246,241,0.10)", border: fuerte ? "none" : "2px solid rgba(250,246,241,0.35)", textAlign: "left" }}>
    <div style={{ fontFamily: titular, fontWeight: 600, fontSize: fuerte ? 64 : 48, lineHeight: 1, color: fuerte ? C.granate : "#fff", textTransform: "uppercase" }}>{t}</div>
    <div style={{ fontFamily: barlow, fontSize: 30, lineHeight: 1.3, color: fuerte ? C.tinta : "#EBD3CE", marginTop: 10 }}>{s}</div>
  </div>
);

/** Esquema: tres fuentes → la plataforma → cuatro pantallas. */
export const Flujo: React.FC<Props> = ({ enFuentes, enCentro, enPantallas }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ve = (d: number) => ({
    opacity: interpolate(frame, [d * fps, (d + 0.6) * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    translate: interpolate(frame, [d * fps, (d + 0.8) * fps], ["0px 30px", "0px 0px"], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) }),
  });
  const flecha = (d: number) => ({ ...ve(d), fontFamily: barlow, fontSize: 80, color: "rgba(250,246,241,0.6)", alignSelf: "center" as const });
  return (
    <AbsoluteFill style={{ background: FONDO_GRANATE, padding: "70px 100px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: barlow, fontWeight: 600, fontSize: 36, letterSpacing: "0.22em", color: "#F2D6D0", textTransform: "uppercase" }}>Cómo funciona</div>
          <div style={{ fontFamily: titular, fontWeight: 600, fontSize: 92, color: "#fff", textTransform: "uppercase", lineHeight: 1 }}>Tres fuentes, una sola lista</div>
        </div>
        <Img src={staticFile("logo-chp.png")} style={{ width: 300 }} />
      </div>
      <div style={{ display: "flex", gap: 40, marginTop: 70, flex: 1 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 26, width: 520 }}>
          <Caja t="SOFDOC" s="Citas: quién vino y quién no" style={ve(enFuentes)} />
          <Caja t="CRM de leads" s="Teléfonos, canal y campaña" style={ve(enFuentes + 0.5)} />
          <Caja t="Registro" s="Lo que indica el médico" style={ve(enFuentes + 1)} />
        </div>
        <div style={flecha(enCentro - 0.3)}>→</div>
        <Caja fuerte t="Plataforma" s="Cada mañana a las 7:00 cruza las fuentes, aplica los plazos y arma la lista" style={{ ...ve(enCentro), width: 470, alignSelf: "center" }} />
        <div style={flecha(enPantallas - 0.3)}>→</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20, width: 420 }}>
          <Caja t="Tablero" s="A quién llamar hoy" style={ve(enPantallas)} />
          <Caja t="Registro" s="Indicaciones y altas" style={ve(enPantallas + 0.3)} />
          <Caja t="Pacientes" s="La ficha completa" style={ve(enPantallas + 0.6)} />
          <Caja t="Indicadores" s="Para la dirección" style={ve(enPantallas + 0.9)} />
        </div>
      </div>
    </AbsoluteFill>
  );
};
