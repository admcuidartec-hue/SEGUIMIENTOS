/**
 * COLORES — identidad del CHP (la misma de ../tutorial-chp/src/theme.ts) y los tokens de la app (`:root` de src/Index.html),
 * para que las pantallas simuladas se parezcan a la real. No escriba colores sueltos en los componentes: tómelos de aquí.
 */

/** Paleta institucional. */
export const CHP = {
  granate: "#6F1713",
  acento: "#8C1D18",
  granateHondo: "#4A0E0B",
  hueso: "#FAF6F1",
  tinta: "#23191A",
  gris: "#6E6062",
  linea: "#E8DED5",
  rosa: "#F4E4E1",
  rubor: "#EBD3CE",
  blanco: "#FFFFFF",
} as const;

/** Fondos de portada y de sección. */
export const FONDOS = {
  granate: "radial-gradient(ellipse at 50% 42%, #8E1F1A 0%, #6F1713 45%, #3E0B09 100%)",
  noche: "radial-gradient(ellipse at 30% 35%, #3A1A1C 0%, #1E1112 55%, #120A0B 100%)",
  hueso: "#FAF6F1",
  rubor: "linear-gradient(135deg, #F4E4E1 0%, #E9CFC9 100%)",
} as const;

/** Tokens de la app (modo claro de src/Index.html). */
export const APP = {
  bg: "#F4F5F7",
  side: "#FFFFFF",
  surface: "#FFFFFF",
  surface2: "#F8F9FB",
  col: "#ECEEF2",
  line: "#E4E6EB",
  line2: "#CDD1D9",
  ink: "#15171C",
  soft: "#41464F",
  muted: "#636976",
  accent: "#8C1D18",
  accentSoft: "#F7E9E8",
  good: "#1E7A4C",
  goodSoft: "#E6F4EC",
  warn: "#985B00",
  warnSoft: "#FBF0DE",
  info: "#2F5BD3",
  infoSoft: "#E8EEFC",
  velo: "rgba(21,23,28,0.32)",
  toast: "#1B1E25",
  toastInk: "#F4F5F7",
} as const;

/** Hoja de cálculo simulada (genérica). */
export const HOJA = {
  fondo: "#FFFFFF",
  rejilla: "#E2E3E3",
  cabecera: "#F8F9FA",
  cabeceraTinta: "#5F6368",
  seleccion: "#1A73E8",
  seleccionSuave: "rgba(26,115,232,0.10)",
  barra: "#F9FBFD",
  pestanaActiva: "#E1E9F7",
  verdeDialogo: "#188038",
} as const;

/** Público de cada beat (AudienceBadge). */
export const AUDIENCIA = {
  enfermeria: { fondo: "#E6F4EC", tinta: "#1E7A4C", borde: "#9DD3B5" },
  asesoras: { fondo: "#F7E9E8", tinta: "#8C1D18", borde: "#E2B3AE" },
  lider: { fondo: "#E8EEFC", tinta: "#2F5BD3", borde: "#AFC2F2" },
} as const;

/** Subtítulos: texto claro sobre un velo oscuro, legible sobre cualquier fondo. */
export const SUBTITULO = { fondo: "rgba(18,10,11,0.86)", tinta: "#FFFFFF", borde: "rgba(250,246,241,0.18)" } as const;
