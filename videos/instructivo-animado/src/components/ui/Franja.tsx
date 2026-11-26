import type React from "react";
import { APP } from "../../constants/colores";
import type { Fase, Tarjeta } from "../../constants/datosDemo";
import { UI } from "../../constants/tipografia";
import { TarjetaPaciente } from "./TarjetaPaciente";

export type TarjetaAnimada = Tarjeta & { readonly foco?: number; readonly opacidad?: number; readonly dx?: number };

export const FRANJA = { cabecera: 236, alto: 76, separacion: 5, tarjetaW: 340, gap: 10 } as const;

/**
 * FRANJA DEL TABLERO: una fase del embudo de seis (de arriba hacia abajo), con su número, nombre, cifra, una barra
 * proporcional y el carril horizontal de tarjetas. `tarjetas` permite sustituir las de la fase (para animar que una
 * tarjeta entra o sale). `aparicion` (0 → 1) la hace entrar desde la izquierda.
 */
export const Franja: React.FC<{
  readonly fase: Fase;
  readonly n: number;
  readonly maxCifra: number;
  readonly aparicion?: number;
  readonly tarjetas?: readonly TarjetaAnimada[];
  readonly resaltada?: number;
  readonly cifra?: number;
}> = ({ fase, n, maxCifra, aparicion = 1, tarjetas, resaltada = 0, cifra }) => {
  const lista: readonly TarjetaAnimada[] = tarjetas ?? fase.tarjetas;
  const c = cifra ?? fase.cifra;
  return (
    <div
      style={{
        display: "flex", height: FRANJA.alto, gap: 12, alignItems: "center", padding: "0 10px", borderRadius: 12,
        backgroundColor: resaltada > 0 ? `rgba(247,233,232,${resaltada})` : APP.col, fontFamily: UI,
        opacity: aparicion, translate: `${(1 - aparicion) * -40}px 0px`, outline: resaltada > 0 ? `2px solid rgba(140,29,24,${0.6 * resaltada})` : "none",
      }}
    >
      <div style={{ width: FRANJA.cabecera, flex: "0 0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 24, height: 24, borderRadius: 99, backgroundColor: APP.accent, color: "#fff", fontSize: 14, fontWeight: 700, display: "grid", placeItems: "center" }}>{n}</span>
          <span style={{ fontSize: 19, fontWeight: 600, color: APP.ink, whiteSpace: "nowrap" }}>{fase.nombre}</span>
          <span style={{ marginLeft: "auto", fontSize: 22, fontWeight: 700, color: APP.ink, fontVariantNumeric: "tabular-nums" }}>{c}</span>
        </div>
        <div style={{ height: 6, borderRadius: 99, backgroundColor: APP.line, marginTop: 8, overflow: "hidden" }}>
          <div style={{ width: `${(100 * c) / maxCifra}%`, height: "100%", backgroundColor: APP.accent, opacity: 0.75 }} />
        </div>
        <div style={{ fontSize: 14, color: APP.muted, marginTop: 5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{fase.detalle}</div>
      </div>
      <div style={{ display: "flex", gap: FRANJA.gap, flex: 1, position: "relative", height: FRANJA.alto - 10, alignItems: "center" }}>
        {lista.map((t) => (
          <TarjetaPaciente key={t.nombre} t={t} w={FRANJA.tarjetaW} h={FRANJA.alto - 12} compacta foco={t.foco} style={{ opacity: t.opacidad ?? 1, translate: `${t.dx ?? 0}px 0px` }} />
        ))}
        {c > lista.length ? <span style={{ fontSize: 16, fontWeight: 600, color: APP.accent, marginLeft: 6, whiteSpace: "nowrap" }}>Ver los {c} →</span> : null}
      </div>
    </div>
  );
};
