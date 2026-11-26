import type React from "react";
import { APP } from "../../constants/colores";
import { UI } from "../../constants/tipografia";
import { Icono, type NombreIcono } from "./Icono";

export type Tono = "acento" | "info" | "bien" | "aviso" | "neutro";

export const TONOS: Record<Tono, { fondo: string; tinta: string }> = {
  acento: { fondo: APP.accentSoft, tinta: APP.accent },
  info: { fondo: APP.infoSoft, tinta: APP.info },
  bien: { fondo: APP.goodSoft, tinta: APP.good },
  aviso: { fondo: APP.warnSoft, tinta: APP.warn },
  neutro: { fondo: APP.col, tinta: APP.soft },
};

/** Etiqueta en forma de píldora, como las de las tarjetas de la app (Reevaluación, Ferinject × 3…). */
export const Badge: React.FC<{
  readonly children: React.ReactNode;
  readonly tono?: Tono;
  readonly icono?: NombreIcono;
  readonly t?: number;
  readonly style?: React.CSSProperties;
}> = ({ children, tono = "neutro", icono, t = 17, style }) => (
  <span
    style={{
      display: "inline-flex", alignItems: "center", gap: 6, padding: `${t * 0.22}px ${t * 0.6}px`, borderRadius: 999,
      backgroundColor: TONOS[tono].fondo, color: TONOS[tono].tinta, fontFamily: UI, fontWeight: 600, fontSize: t, lineHeight: 1.2,
      whiteSpace: "nowrap", ...style,
    }}
  >
    {icono ? <Icono n={icono} t={t * 1.05} /> : null}
    {children}
  </span>
);
