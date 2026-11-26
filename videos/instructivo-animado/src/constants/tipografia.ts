/**
 * TIPOGRAFÍA — fuentes guardadas en public/ (el navegador del render no sale a internet) y la escala de tamaños.
 * Ningún texto del video baja de `T.minimo` (20 px a 1080p): por debajo deja de leerse en un televisor o proyector.
 */
import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

loadFont({ family: "Onest", url: staticFile("Onest-latin.woff2"), weight: "400 700" });
loadFont({ family: "Onest", url: staticFile("Onest-latin-ext.woff2"), weight: "400 700" });
loadFont({ family: "Barlow Condensed", url: staticFile("BarlowCondensed-600.woff2"), weight: "600" });
loadFont({ family: "Barlow", url: staticFile("Barlow-400.woff2"), weight: "400" });
loadFont({ family: "Barlow", url: staticFile("Barlow-600.woff2"), weight: "600" });
loadFont({ family: "Playfair Display", url: staticFile("Playfair-Italic.woff2"), weight: "500", style: "italic" });

/** Texto de interfaz y subtítulos (la app usa Geist; Onest es su pariente más cercano entre las fuentes del repositorio). */
export const UI = "Onest, 'Segoe UI', 'DejaVu Sans', sans-serif";
/** Titulares condensados, como la portada institucional. */
export const TITULAR = "'Barlow Condensed', 'Arial Narrow', sans-serif";
/** Antetítulos y textos de apoyo. */
export const BARLOW = "Barlow, 'Segoe UI', sans-serif";
/** Cursiva editorial. */
export const CURSIVA = "'Playfair Display', Georgia, serif";
/** Cifras, teclas y código. */
export const MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, 'DejaVu Sans Mono', monospace";

/** Escala (px a 1920×1080). */
export const T = {
  minimo: 20,
  pequeno: 22,
  cuerpo: 26,
  destacado: 32,
  subtitulo: 40,
  titulo: 64,
  portada: 140,
} as const;
