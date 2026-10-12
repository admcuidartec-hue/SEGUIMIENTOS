import type React from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { barlow, C, FONDO_GRANATE, titular } from "./theme";

const Tecla: React.FC<{ readonly children: string }> = ({ children }) => (
  <span style={{ display: "inline-block", minWidth: 64, padding: "6px 16px", borderRadius: 12, border: "2px solid rgba(0,0,0,0.25)", borderBottomWidth: 6, backgroundColor: C.hueso, color: C.tinta, fontSize: 38, fontWeight: 600, textAlign: "center", marginRight: 10 }}>{children}</span>
);

const Fila: React.FC<{ readonly en: number; readonly teclas: string[]; readonly texto: string }> = ({ en, teclas, texto }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 28, fontSize: 46, color: C.hueso, fontFamily: barlow,
      opacity: interpolate(frame, [en * fps, (en + 0.5) * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      translate: interpolate(frame, [en * fps, (en + 0.7) * fps], ["0px 24px", "0px 0px"], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) }),
    }}>
      <div style={{ width: 420, flexShrink: 0 }}>{teclas.map((t) => <Tecla key={t}>{t}</Tecla>)}</div>
      <div>{texto}</div>
    </div>
  );
};

/** Los atajos del Tablero. */
export const Atajos: React.FC = () => (
  <AbsoluteFill style={{ background: FONDO_GRANATE, padding: "90px 200px", gap: 30 }}>
    <Img src={staticFile("logo-chp.png")} style={{ width: 300, marginBottom: 10 }} />
    <div style={{ fontFamily: barlow, color: "#F2D6D0", fontSize: 40, fontWeight: 600, letterSpacing: "0.22em", textTransform: "uppercase" }}>Para ir más rápido</div>
    <div style={{ fontFamily: titular, color: "#fff", fontSize: 120, fontWeight: 600, textTransform: "uppercase", lineHeight: 1, marginBottom: 16 }}>Atajos de teclado</div>
    <Fila en={0.5} teclas={["↑", "↓", "←", "→"]} texto="Moverse entre tarjetas" />
    <Fila en={0.9} teclas={["Enter"]} texto="Abrir la tarjeta" />
    <Fila en={1.3} teclas={["C"]} texto="Copiar el teléfono" />
    <Fila en={1.7} teclas={["1", "2", "3"]} texto="¿Qué pasó? (en el orden de los botones)" />
    <Fila en={2.1} teclas={["X"]} texto="Cerrar el seguimiento" />
    <Fila en={2.5} teclas={["/"]} texto="Buscar un paciente" />
  </AbsoluteFill>
);
