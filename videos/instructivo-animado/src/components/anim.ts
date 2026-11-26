/**
 * Ayudas de movimiento. Todo se calcula a partir del cuadro actual (`interpolate`, `spring`, `Easing`): nada de
 * animaciones CSS, para que el render sea determinista cuadro a cuadro.
 */
import { Easing, interpolate, spring } from "remotion";
import { FPS } from "../constants/duraciones";

export const SUAVE = Easing.bezier(0.16, 1, 0.3, 1);
export const VAIVEN = Easing.bezier(0.65, 0, 0.35, 1);

const fijo = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 0 → 1 entre dos cuadros, con curva suave. */
export const progreso = (frame: number, desde: number, dur = 18, easing = SUAVE) =>
  interpolate(frame, [desde, desde + dur], [0, 1], { ...fijo, easing });

/** Resorte de 0 a 1 que arranca en `desde`. */
export const resorte = (frame: number, desde: number, rigidez = 140, amortiguacion = 18) =>
  spring({ frame: frame - desde, fps: FPS, config: { stiffness: rigidez, damping: amortiguacion, mass: 1 } });

/** Estilo de aparición: sube y se desvanece hacia dentro. Si `hasta` se da, sale con un fundido. */
export const aparece = (frame: number, desde: number, hasta?: number, distancia = 28): React.CSSProperties => {
  const p = progreso(frame, desde, 16);
  const salida = hasta === undefined ? 1 : 1 - progreso(frame, hasta - 10, 10, VAIVEN);
  return { opacity: p * salida, translate: `0px ${(1 - p) * distancia}px` };
};

/** Visible solo entre dos cuadros (con fundido de 8 cuadros a cada lado). */
export const entre = (frame: number, desde: number, hasta: number) =>
  Math.min(progreso(frame, desde, 8, VAIVEN), 1 - progreso(frame, hasta - 8, 8, VAIVEN));

/** Interpolación con varios tramos y suavizado. */
export const tramos = (frame: number, cuadros: number[], valores: number[], easing = VAIVEN) =>
  interpolate(frame, cuadros, valores, { ...fijo, easing });

/** Texto que se escribe letra a letra (para buscadores y celdas). */
export const escribiendo = (frame: number, desde: number, texto: string, letrasPorSegundo = 14) => {
  const n = Math.floor(Math.max(0, frame - desde) * (letrasPorSegundo / FPS));
  return texto.slice(0, Math.min(texto.length, n));
};
