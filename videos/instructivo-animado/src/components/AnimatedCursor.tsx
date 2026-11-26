import type React from "react";
import { interpolate, spring, useCurrentFrame } from "remotion";
import { FPS } from "../constants/duraciones";
import { ClickRipple } from "./ClickRipple";

/**
 * CURSOR ANIMADO. Recorre una lista de puntos: cada punto dice dónde debe estar el cursor y en qué cuadro llega.
 * El trayecto entre dos puntos usa un resorte (frena al llegar, como una mano). Un punto con `clic` hace el gesto de
 * pulsar y deja una onda (ClickRipple). Las coordenadas son las de la VISTA de la pantalla simulada (o las de la
 * escena, si el cursor se dibuja fuera de una pantalla).
 */
export type PuntoCursor = { readonly f: number; readonly x: number; readonly y: number; readonly clic?: boolean };

const VIAJE_MAX = 26;

export const posCursor = (frame: number, puntos: readonly PuntoCursor[]) => {
  if (!puntos.length) return { x: 0, y: 0 };
  if (frame <= puntos[0].f) return { x: puntos[0].x, y: puntos[0].y };
  for (let i = 1; i < puntos.length; i++) {
    const a = puntos[i - 1], b = puntos[i];
    if (frame <= b.f) {
      const viaje = Math.max(6, Math.min(VIAJE_MAX, b.f - a.f));
      const inicio = b.f - viaje;
      if (frame <= inicio) return { x: a.x, y: a.y };
      const p = spring({ frame: frame - inicio, fps: FPS, durationInFrames: viaje, config: { damping: 22, stiffness: 140 } });
      // Un arco leve: la mano no va en línea recta.
      const arco = Math.sin(Math.min(1, p) * Math.PI) * Math.min(40, Math.hypot(b.x - a.x, b.y - a.y) * 0.08);
      return { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p - arco };
    }
  }
  const u = puntos[puntos.length - 1];
  return { x: u.x, y: u.y };
};

export const AnimatedCursor: React.FC<{
  readonly puntos: readonly PuntoCursor[];
  /** Zoom de la cámara: el cursor se dibuja siempre del mismo tamaño en pantalla. */
  readonly escala?: number;
  readonly desde?: number;
  readonly hasta?: number;
}> = ({ puntos, escala = 1, desde, hasta }) => {
  const frame = useCurrentFrame();
  const ini = desde ?? (puntos[0]?.f ?? 0) - 8;
  const fin = hasta ?? Infinity;
  if (frame < ini || frame > fin) return null;
  const { x, y } = posCursor(frame, puntos);
  const visible = Math.min(interpolate(frame, [ini, ini + 8], [0, 1], { extrapolateRight: "clamp" }), fin === Infinity ? 1 : interpolate(frame, [fin - 8, fin], [1, 0], { extrapolateLeft: "clamp" }));
  const clics = puntos.filter((p) => p.clic);
  const pulsa = clics.reduce((m, c) => Math.max(m, interpolate(frame, [c.f - 3, c.f, c.f + 6], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })), 0);
  const k = (1 - pulsa * 0.18) / escala;
  return (
    <>
      {clics.map((c, i) => <ClickRipple key={i} x={c.x} y={c.y} desde={c.f} escala={escala} />)}
      <div style={{ position: "absolute", left: x, top: y, width: 0, height: 0, opacity: visible, pointerEvents: "none" }}>
        <svg width={40} height={46} viewBox="0 0 20 23" style={{ position: "absolute", left: -3, top: -2, transformOrigin: "3px 2px", scale: String(k), filter: "drop-shadow(0 3px 5px rgba(0,0,0,0.35))", overflow: "visible" }}>
          <path d="M2 1.5 L2 18.5 L6.4 14.6 L9.4 21.2 L12.4 19.9 L9.5 13.4 L15.4 13.4 Z" fill="#15171C" stroke="#FFFFFF" strokeWidth={1.4} strokeLinejoin="round" />
        </svg>
      </div>
    </>
  );
};

/** 0 → 1 mientras el cursor está sobre una caja (para el estado «hover» de los botones). */
export const sobre = (frame: number, puntos: readonly PuntoCursor[], caja: { x: number; y: number; w: number; h: number }) => {
  const { x, y } = posCursor(frame, puntos);
  return x >= caja.x && x <= caja.x + caja.w && y >= caja.y && y <= caja.y + caja.h ? 1 : 0;
};
