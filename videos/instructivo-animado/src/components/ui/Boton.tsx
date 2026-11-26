import type React from "react";
import { APP } from "../../constants/colores";
import { MONO, UI } from "../../constants/tipografia";
import { Icono, type NombreIcono } from "./Icono";

/** Tecla (kbd), como los atajos de la app. */
export const Tecla: React.FC<{ readonly children: React.ReactNode; readonly t?: number; readonly oscura?: boolean; readonly pulsada?: number }> = ({
  children, t = 16, oscura = false, pulsada = 0,
}) => (
  <span
    style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: t * 1.6, height: t * 1.6, padding: `0 ${t * 0.4}px`,
      borderRadius: t * 0.35, border: `1.5px solid ${oscura ? "rgba(250,246,241,0.55)" : APP.line2}`,
      borderBottomWidth: 3 - pulsada * 1.5, translate: `0px ${pulsada * 1.5}px`,
      backgroundColor: oscura ? "rgba(250,246,241,0.10)" : pulsada > 0.5 ? APP.accentSoft : APP.surface,
      color: oscura ? "#FAF6F1" : APP.soft, fontFamily: MONO, fontSize: t, fontWeight: 600, lineHeight: 1,
    }}
  >
    {children}
  </span>
);

type Variante = "primario" | "secundario" | "fantasma" | "peligro";

/**
 * Botón de la app. `hover` (0 → 1) y `pulsado` (0 → 1) se animan desde fuera, con el cursor: así el clic se ve.
 */
export const Boton: React.FC<{
  readonly children: React.ReactNode;
  readonly variante?: Variante;
  readonly icono?: NombreIcono;
  readonly tecla?: string;
  readonly hover?: number;
  readonly pulsado?: number;
  readonly t?: number;
  readonly ancho?: number | string;
  readonly alto?: number;
  readonly apagado?: boolean;
  readonly style?: React.CSSProperties;
}> = ({ children, variante = "secundario", icono, tecla, hover = 0, pulsado = 0, t = 19, ancho, alto, apagado, style }) => {
  const base: Record<Variante, { fondo: string; tinta: string; borde: string }> = {
    primario: { fondo: APP.accent, tinta: "#FFFFFF", borde: APP.accent },
    secundario: { fondo: APP.surface, tinta: APP.ink, borde: APP.line },
    fantasma: { fondo: "transparent", tinta: APP.soft, borde: "transparent" },
    peligro: { fondo: APP.surface, tinta: APP.accent, borde: APP.line },
  };
  const b = base[variante];
  const fondoHover = variante === "primario" ? "#741612" : APP.accentSoft;
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 10, width: ancho, height: alto ?? t * 2.5, padding: `0 ${t * 0.8}px`, borderRadius: 10,
        border: `1.5px solid ${hover > 0.5 && variante !== "primario" ? "#E2B3AE" : b.borde}`,
        backgroundColor: hover > 0.5 ? fondoHover : b.fondo, color: b.tinta, fontFamily: UI, fontWeight: 600, fontSize: t,
        scale: String(1 - pulsado * 0.05), opacity: apagado ? 0.45 : 1, boxSizing: "border-box", whiteSpace: "nowrap", ...style,
      }}
    >
      {icono ? <Icono n={icono} t={t * 1.15} /> : null}
      <span style={{ flex: 1 }}>{children}</span>
      {tecla ? <Tecla t={t * 0.72}>{tecla}</Tecla> : null}
    </div>
  );
};
