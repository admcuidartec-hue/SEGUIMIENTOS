/**
 * TIEMPOS DEL GUION — reparte cada beat entre sus líneas de subtítulo, según el número de palabras, y comprueba que
 * todo cuadre con `duraciones.ts`. Si algo no cuadra, lanza un error al cargar la composición con el motivo: así un
 * cambio de texto que deje un subtítulo ilegible no llega al render.
 */
import { type EscenaId, ESCENAS, FPS, ORDEN_ESCENAS, RESPIRO_BEAT, TRANSICION, beatsDeEscena } from "./duraciones";
import { type BeatId, GUION } from "./guion";

export type LineaConTiempo = {
  readonly texto: string;
  /** Cuadros relativos al inicio de la escena. */
  readonly desde: number;
  readonly hasta: number;
  readonly beat: BeatId;
};

/** Mínimo de legibilidad: 1 segundo por cada 3 palabras (y nunca menos de 1,2 s). */
export const minimoLegible = (texto: string) => Math.max(1.2 * FPS, (contarPalabras(texto) / 3) * FPS);

export const contarPalabras = (t: string) => t.split(/\s+/).filter((p) => /[\p{L}\p{N}]/u.test(p)).length;

const PAUSA_ENTRE_LINEAS = 3;

/** Las líneas de subtítulo de una escena, con su ventana en cuadros relativos al inicio de la escena. */
export const lineasDeEscena = (e: EscenaId): LineaConTiempo[] => {
  const beats = beatsDeEscena(e);
  const i = ORDEN_ESCENAS.indexOf(e);
  const primera = i === 0, ultima = i === ORDEN_ESCENAS.length - 1;
  const out: LineaConTiempo[] = [];
  beats.forEach((b, k) => {
    const guion = GUION[b.id as BeatId];
    // El primer beat de una escena (salvo la primera) y el último (salvo la última) comparten cuadros con la transición:
    // ahí no se muestra subtítulo para que nunca haya dos a la vez.
    const ini = b.desde + RESPIRO_BEAT + (k === 0 && !primera ? TRANSICION : 0);
    const fin = b.desde + b.duracion - RESPIRO_BEAT - (k === beats.length - 1 && !ultima ? TRANSICION : 0);
    const pesos = guion.lineas.map((l) => contarPalabras(l) + 2);
    const total = pesos.reduce((a, p) => a + p, 0);
    const util = fin - ini - PAUSA_ENTRE_LINEAS * (guion.lineas.length - 1);
    let t = ini;
    guion.lineas.forEach((texto, j) => {
      const largo = Math.floor((util * pesos[j]) / total);
      out.push({ texto, desde: t, hasta: t + largo, beat: b.id as BeatId });
      t += largo + PAUSA_ENTRE_LINEAS;
    });
  });
  return out;
};

/** El beat que suena en un cuadro de la escena (para la insignia de público y la capa de la escena 3). */
export const beatEnCuadro = (e: EscenaId, frame: number): BeatId => {
  const beats = beatsDeEscena(e);
  const b = beats.find((x) => frame >= x.desde && frame < x.desde + x.duracion) ?? beats[beats.length - 1];
  return b.id as BeatId;
};

/** Revisión completa: cada beat del guion tiene duración y viceversa, y cada subtítulo es legible. */
export const revisarGuion = () => {
  const problemas: string[] = [];
  const conDuracion = new Set<string>();
  ORDEN_ESCENAS.forEach((e) => Object.keys(ESCENAS[e].beats).forEach((id) => conDuracion.add(id)));
  Object.keys(GUION).forEach((id) => {
    if (!conDuracion.has(id)) problemas.push(`El beat «${id}» está en guion.ts pero no tiene duración en duraciones.ts.`);
  });
  conDuracion.forEach((id) => {
    if (!(id in GUION)) problemas.push(`El beat «${id}» tiene duración pero no texto en guion.ts.`);
  });
  if (!problemas.length) {
    ORDEN_ESCENAS.forEach((e) =>
      lineasDeEscena(e).forEach((l) => {
        const min = minimoLegible(l.texto);
        if (l.hasta - l.desde < min) {
          problemas.push(
            `Subtítulo demasiado breve en ${l.beat}: «${l.texto}» dura ${((l.hasta - l.desde) / FPS).toFixed(1)} s y necesita ` +
              `${(min / FPS).toFixed(1)} s. Alargue el beat en duraciones.ts o acorte el texto.`,
          );
        }
        if (l.texto.length > 120) problemas.push(`Subtítulo de más de 120 caracteres (no cabe en 2 renglones): «${l.texto}».`);
      }),
    );
  }
  if (problemas.length) throw new Error("Revisión del guion:\n- " + problemas.join("\n- "));
};

/** Cuadro (relativo a la escena) en que aparece la línea `n` (desde 0) de un beat: para sincronizar animaciones con la voz. */
export const inicioLinea = (e: EscenaId, beat: BeatId, n = 0) => {
  const l = lineasDeEscena(e).filter((x) => x.beat === beat)[n];
  if (!l) throw new Error(`El beat «${beat}» no tiene la línea ${n} en la escena ${e}.`);
  return l.desde;
};
