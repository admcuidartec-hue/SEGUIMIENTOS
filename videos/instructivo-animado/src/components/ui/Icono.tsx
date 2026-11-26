import type React from "react";

/**
 * Iconos de trazo, dibujados aquí (la app usa Phosphor desde un CDN; el render no sale a internet).
 * Trazos sencillos en una caja de 24 × 24.
 */
const TRAZOS = {
  telefono: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2",
  calendario: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  check: "M5 12.5l4.5 4.5L19 7.5",
  checkCirculo: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8 12.5l3 3 5-6",
  alerta: "M12 3l10 18H2zM12 10v5M12 18v.5",
  descarga: "M12 4v11M7 10l5 5 5-5M4 20h16",
  buscar: "M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zM15.5 15.5L21 21",
  reloj: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2",
  cerrar: "M6 6l12 12M18 6L6 18",
  usuario: "M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM4 21a8 8 0 0 1 16 0",
  tablero: "M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v6h-4z",
  lapiz: "M4 20l1-5L16 4l4 4L9 19zM14 6l4 4",
  usuarios: "M9 5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zM3 20a6 6 0 0 1 12 0M16 6a3 3 0 1 1 0 6M17 14a5 5 0 0 1 4 6",
  grafico: "M4 4v16h16M7 15l4-4 3 3 5-6",
  botiquin: "M4 7h16v13H4zM9 7V4h6v3M12 10v7M8.5 13.5h7",
  ojo: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z",
  copiar: "M8 8h12v12H8zM4 16V4h12",
  impresora: "M6 9V3h12v6M6 17H3v-8h18v8h-3M6 14h12v7H6z",
  deshacer: "M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10h-3",
  flecha: "M4 12h15M13 6l6 6-6 6",
  mas: "M12 5v14M5 12h14",
  dinero: "M3 6h18v12H3zM12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z",
  candado: "M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4",
  correo: "M3 6h18v12H3zM3 7l9 7 9-7",
  hoja: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7",
  nube: "M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z",
  rayo: "M13 3L5 14h6l-1 7 8-11h-6z",
  info: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5v.5",
  telefonoNo: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2M3 3l18 18",
  gota: "M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z",
  luna: "M20 14A8 8 0 1 1 10 4a6.5 6.5 0 0 0 10 10z",
  engranaje: "M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1",
  caret: "M6 9l6 6 6-6",
  escudo: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  carpeta: "M3 6h7l2 2h9v11H3z",
} as const;

export type NombreIcono = keyof typeof TRAZOS;

export const Icono: React.FC<{
  readonly n: NombreIcono;
  readonly t?: number;
  readonly color?: string;
  readonly grosor?: number;
  readonly style?: React.CSSProperties;
}> = ({ n, t = 22, color = "currentColor", grosor = 2, style }) => (
  <svg width={t} height={t} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={grosor} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto", ...style }}>
    <path d={TRAZOS[n]} />
  </svg>
);
