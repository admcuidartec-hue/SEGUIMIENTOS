import type React from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { barlow, FONDO_GRANATE, titular } from "./theme";

type Cifra = { readonly valor: string; readonly texto: string; readonly en: number };
type Props = { readonly kicker: string; readonly title: string; readonly cifras: readonly Cifra[]; readonly pie?: string };

/** Escena de cifras grandes con la identidad del CHP; cada cifra entra cuando la narración la nombra. */
export const Cifras: React.FC<Props> = ({ kicker, title, cifras, pie }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sube = (d: number) => ({
    opacity: interpolate(frame, [d * fps, (d + 0.6) * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    translate: interpolate(frame, [d * fps, (d + 0.8) * fps], ["0px 40px", "0px 0px"], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) }),
  });
  return (
    <AbsoluteFill style={{ background: FONDO_GRANATE, padding: "80px 130px", alignItems: "center", textAlign: "center" }}>
      <Img src={staticFile("logo-chp.png")} style={{ ...sube(0), width: 280 }} />
      <div style={{ ...sube(0.1), fontFamily: barlow, fontWeight: 600, fontSize: 38, letterSpacing: "0.22em", color: "#F2D6D0", textTransform: "uppercase", marginTop: 46 }}>{kicker}</div>
      <div style={{ ...sube(0.25), fontFamily: titular, fontWeight: 600, fontSize: 96, lineHeight: 1.02, color: "#fff", textTransform: "uppercase", marginTop: 18, maxWidth: 1600 }}>{title}</div>
      <div style={{ display: "flex", gap: 60, marginTop: 70, justifyContent: "center", width: "100%" }}>
        {cifras.map((c, i) => (
          <div key={i} style={{ ...sube(c.en), flex: 1, maxWidth: 520, borderTop: "2px solid rgba(250,246,241,0.4)", paddingTop: 30 }}>
            <div style={{ fontFamily: titular, fontWeight: 600, fontSize: 112, lineHeight: 1, color: "#fff", whiteSpace: "nowrap" }}>{c.valor}</div>
            <div style={{ fontFamily: barlow, fontSize: 40, lineHeight: 1.25, color: "#EBD3CE", marginTop: 18 }}>{c.texto}</div>
          </div>
        ))}
      </div>
      {pie ? <div style={{ ...sube(cifras.length ? cifras[cifras.length - 1].en + 0.6 : 1), fontFamily: barlow, fontSize: 30, color: "rgba(250,246,241,0.7)", marginTop: 60, maxWidth: 1400 }}>{pie}</div> : null}
    </AbsoluteFill>
  );
};
