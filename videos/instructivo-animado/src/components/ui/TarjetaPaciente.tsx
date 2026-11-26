import type React from "react";
import { APP } from "../../constants/colores";
import type { Tarjeta } from "../../constants/datosDemo";
import { MONO, UI } from "../../constants/tipografia";
import { Badge } from "./Badge";
import { Icono } from "./Icono";

/**
 * TARJETA DE PACIENTE del tablero: nombre, chip (tipo o tratamiento), médico, la etiqueta de su fase y el contacto.
 * «En espera» va con borde punteado, como «Recién registrados · en espera» en la app. `foco` (0 → 1) la resalta.
 */
export const TarjetaPaciente: React.FC<{
  readonly t: Tarjeta;
  readonly w: number;
  readonly h?: number;
  readonly foco?: number;
  readonly compacta?: boolean;
  readonly style?: React.CSSProperties;
}> = ({ t, w, h, foco = 0, compacta = false, style }) => (
  <div
    style={{
      width: w, height: h, boxSizing: "border-box", padding: compacta ? "8px 12px" : "12px 16px", borderRadius: 11, backgroundColor: APP.surface,
      border: t.enEspera ? `2px dashed ${APP.line2}` : `1px solid ${foco > 0 ? APP.accent : APP.line}`,
      boxShadow: foco > 0 ? `0 0 0 ${3 * foco}px rgba(140,29,24,0.28), 0 10px 26px rgba(21,23,28,0.12)` : "0 1px 2px rgba(21,23,28,0.06), 0 4px 14px rgba(21,23,28,0.05)",
      fontFamily: UI, display: "flex", flexDirection: "column", gap: compacta ? 3 : 5, overflow: "hidden", ...style,
    }}
  >
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <div style={{ fontWeight: 600, fontSize: compacta ? 17 : 20, color: APP.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.nombre}</div>
      <Badge tono={t.chip.tono} t={compacta ? 13.5 : 15}>{t.chip.t}</Badge>
    </div>
    {compacta ? null : <div style={{ fontSize: 16, color: APP.muted }}>{t.detalle}</div>}
    <div style={{ fontSize: compacta ? 14.5 : 17, color: t.enEspera ? APP.muted : APP.soft, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.etiqueta}</div>
    {compacta || !t.contacto ? null : (
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: MONO, fontSize: 16, color: APP.soft }}>
        <Icono n="telefono" t={15} />{t.contacto}
      </div>
    )}
  </div>
);
