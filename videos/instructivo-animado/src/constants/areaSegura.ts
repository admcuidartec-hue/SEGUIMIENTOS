/**
 * ÁREA SEGURA a 1920×1080: 96 px a cada lado y 60 px arriba y abajo. Todo contenedor de texto vive dentro de ella.
 *
 *   ┌──────────────────────────── 1920 ────────────────────────────┐
 *   │  60  ┌ CABECERA (título de sección · público) ───────────┐    │
 *   │      ├ CONTENIDO (pantallas, diagramas, tarjetas) ───────┤    │
 *   │      │                                                    │    │
 *   │      ├ SUBTÍTULOS (2 renglones como máximo) ─────────────┤    │
 *   │  60  └────────────────────────────────────────────────────┘    │
 *   └─ 96 ─────────────────────────────────────────────────── 96 ──┘
 */
import { ALTO, ANCHO } from "./duraciones";

export const MARGEN_X = 96;
export const MARGEN_Y = 60;

export type Caja = { readonly x: number; readonly y: number; readonly w: number; readonly h: number };

/** Toda el área segura. */
export const AREA: Caja = { x: MARGEN_X, y: MARGEN_Y, w: ANCHO - 2 * MARGEN_X, h: ALTO - 2 * MARGEN_Y };

/** Cabecera: título de sección a la izquierda, insignias de público a la derecha. */
export const CABECERA: Caja = { x: MARGEN_X, y: MARGEN_Y, w: AREA.w, h: 70 };

/** Subtítulos: abajo, centrados; el velo crece hacia arriba desde el borde inferior del área segura. */
export const SUBTITULOS: Caja = { x: MARGEN_X + 110, y: ALTO - MARGEN_Y - 140, w: AREA.w - 220, h: 140 };

/** Contenido: entre la cabecera y los subtítulos. Las pantallas simuladas se dibujan aquí y nunca bajo los subtítulos. */
export const CONTENIDO: Caja = { x: MARGEN_X, y: CABECERA.y + CABECERA.h + 16, w: AREA.w, h: SUBTITULOS.y - 16 - (CABECERA.y + CABECERA.h + 16) };

/** ¿La caja queda dentro del área segura? (útil para revisar posiciones calculadas). */
export const dentroDelArea = (c: Caja) => c.x >= AREA.x && c.y >= AREA.y && c.x + c.w <= AREA.x + AREA.w && c.y + c.h <= AREA.y + AREA.h;
