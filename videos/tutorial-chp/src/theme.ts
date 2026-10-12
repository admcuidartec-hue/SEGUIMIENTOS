import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

// Onest (Google Fonts), guardada en public/: el navegador del render no sale a internet.
loadFont({ family: "Onest", url: staticFile("Onest-latin.woff2"), weight: "400 700" });
loadFont({ family: "Barlow Condensed", url: staticFile("BarlowCondensed-600.woff2"), weight: "600" });
loadFont({ family: "Barlow", url: staticFile("Barlow-400.woff2"), weight: "400" });
loadFont({ family: "Barlow", url: staticFile("Barlow-600.woff2"), weight: "600" });
loadFont({ family: "Playfair Display", url: staticFile("Playfair-Italic.woff2"), weight: "500", style: "italic" });
export const fontFamily = "Onest, 'Segoe UI', sans-serif";
export const titular = "'Barlow Condensed', 'Arial Narrow', sans-serif";
export const barlow = "Barlow, 'Segoe UI', sans-serif";
/** Fondo de las portadas: granate con luz al centro, como la portada institucional. */
export const FONDO_GRANATE = "radial-gradient(ellipse at 50% 42%, #8E1F1A 0%, #6F1713 45%, #3E0B09 100%)";

export const C = {
  granate: "#6F1713",
  granateHondo: "#4A0E0B",
  hueso: "#FAF6F1",
  tinta: "#23191A",
  gris: "#6E6062",
  linea: "#E8DED5",
  rosa: "#F4E4E1",
};

/** Rectángulo en píxeles CSS de la captura (1600 × 1000). */
export type Caja = { x: number; y: number; w: number; h: number };
export const CAPTURA = { w: 1600, h: 1000 };

export const cursiva = "'Playfair Display', Georgia, serif";

/** Colores de sección (inspirados en el video de referencia: un color pleno por sección, dentro de la paleta del CHP). */
export type Fondo = "granate" | "noche" | "hueso" | "rubor";
export const FONDOS: Record<Fondo, { fondo: string; texto: string; suave: string; acento: string; claro: boolean }> = {
  granate: { fondo: FONDO_GRANATE, texto: "#FFFFFF", suave: "#EBD3CE", acento: "#F2D6D0", claro: false },
  noche: { fondo: "radial-gradient(ellipse at 30% 35%, #3A1A1C 0%, #1E1112 55%, #120A0B 100%)", texto: "#FAF6F1", suave: "#CDBDB9", acento: "#E39A8F", claro: false },
  hueso: { fondo: "#FAF6F1", texto: "#23191A", suave: "#6E6062", acento: "#6F1713", claro: true },
  rubor: { fondo: "linear-gradient(135deg, #F4E4E1 0%, #E9CFC9 100%)", texto: "#23191A", suave: "#5E4A4C", acento: "#6F1713", claro: true },
};
