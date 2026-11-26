/**
 * DURACIONES — el único lugar donde se decide cuánto dura cada cosa.
 *
 * Cada escena es una lista ordenada de beats (tramos de narración, con su texto en `guion.ts`, misma clave) y la
 * duración de cada beat en SEGUNDOS. Todo lo demás se deriva de aquí: la duración de cada escena, el total de la
 * composición y los cuadros de inicio que usan las animaciones.
 *
 * Para ajustar al audio real de la voz: medir cada `voz/escena-X.wav` y cambiar aquí los segundos de sus beats.
 * Las duraciones se calcularon a ≈ 2,8 palabras por segundo, con aire para las animaciones; `tiempos.ts` comprueba
 * al cargar que cada subtítulo quede en pantalla al menos 1 s por cada 3 palabras (si no, la composición no carga).
 */

export const FPS = 30;
export const ANCHO = 1920;
export const ALTO = 1080;

/** Cuadros de la transición entre escenas (fundido). Se solapan: restan del total. */
export const TRANSICION = 15;

/** Pausa al inicio y al final de cada beat en la que no se muestra subtítulo (cuadros). */
export const RESPIRO_BEAT = 6;

export const ESCENAS = {
  e1: {
    titulo: "Introducción",
    beats: { e1_portada: 8.5, e1_proposito: 9.5, e1_quienes: 11, e1_flujo: 20, e1_fuentes: 12 },
  },
  e2: {
    titulo: "La regla crítica diaria",
    beats: {
      e2_titulo: 6.5,
      e2_sinApi: 13.5,
      e2_regla: 16,
      e2_porque: 11.5,
      e2_consecuencia: 14,
      e2_casoReal: 11,
      e2_paso1: 12,
      e2_paso23: 14,
      e2_paso4: 7,
      e2_paso5: 7,
      e2_paso6: 6,
      e2_senales: 14,
      e2_mensajes: 15.5,
    },
  },
  e3a: {
    titulo: "Tablero",
    beats: { e3a_intro: 9.5, e3a_fases: 10, e3a_filtros: 7.5, e3a_buscador: 8, e3a_espera: 10.5, e3a_porque: 11.5 },
  },
  e3b: {
    titulo: "¿Qué pasó?",
    beats: { e3b_panel: 7, e3b_reglas: 7.5, e3b_cierres: 12.5, e3b_porque: 6 },
  },
  e3c: {
    titulo: "Registro",
    beats: { e3c_pestanas: 5.5, e3c_indicacion: 9.5, e3c_primera: 11, e3c_decision: 7, e3c_porque: 8 },
  },
  e3d: {
    titulo: "Pacientes y ficha",
    beats: { e3d_ficha: 7, e3d_telefono: 10, e3d_porque: 8 },
  },
  e3e: {
    titulo: "Enfermería",
    beats: { e3e_lista: 9.5, e3e_contacto: 9, e3e_porque: 6 },
  },
  e3f: {
    titulo: "Indicadores",
    beats: { e3f_metas: 10.5, e3f_descarga: 13, e3f_porque: 8 },
  },
  e3g: {
    titulo: "Roles y avisos",
    beats: { e3g_quien: 7, e3g_consulta: 8 },
  },
  e4: {
    titulo: "Configuración",
    beats: {
      e4_sinPantalla: 6.5,
      e4_reglas: 11,
      e4_editar: 9,
      e4_catalogos: 6.5,
      e4_cuidados: 7,
      e4_menu: 8,
      e4_publicar: 11,
    },
  },
  e5: {
    titulo: "Pendientes y cierre",
    beats: {
      e5_tablero: 5.5,
      e5_porHacer: 11.5,
      e5_seguridad: 10,
      e5_evaluacion: 9.5,
      e5_externa: 6.5,
      e5_pilares: 10.5,
      e5_fin: 7,
    },
  },
} as const;

export type EscenaId = keyof typeof ESCENAS;
type BeatsDe<E extends EscenaId> = keyof (typeof ESCENAS)[E]["beats"];
export type BeatConDuracion = { [E in EscenaId]: BeatsDe<E> }[EscenaId];

export const ORDEN_ESCENAS: readonly EscenaId[] = ["e1", "e2", "e3a", "e3b", "e3c", "e3d", "e3e", "e3f", "e3g", "e4", "e5"];

/** Segundos → cuadros. */
export const cuadros = (segundos: number) => Math.round(segundos * FPS);

/** Los beats de una escena, en orden, con su inicio y duración en cuadros (relativos al inicio de la escena). */
export const beatsDeEscena = (e: EscenaId) => {
  let t = 0;
  return Object.entries(ESCENAS[e].beats as Record<string, number>).map(([id, s]) => {
    const b = { id, desde: t, duracion: cuadros(s) };
    t += b.duracion;
    return b;
  });
};

/** Duración de una escena en cuadros: la suma de sus beats. */
export const duracionEscena = (e: EscenaId) => beatsDeEscena(e).reduce((a, b) => a + b.duracion, 0);

/** Duración total de la composición: escenas menos los solapes de las transiciones. */
export const DURACION_TOTAL =
  ORDEN_ESCENAS.reduce((a, e) => a + duracionEscena(e), 0) - TRANSICION * (ORDEN_ESCENAS.length - 1);

/** Cuadro (relativo a la escena) en que empieza un beat. Lanza si el beat no está en esa escena: evita errores de tecleo. */
export const inicioBeat = (e: EscenaId, id: string) => {
  const b = beatsDeEscena(e).find((x) => x.id === id);
  if (!b) throw new Error(`El beat «${id}» no está en la escena ${e} (duraciones.ts).`);
  return b.desde;
};

/** Cuadro (relativo a la escena) en que termina un beat. */
export const finBeat = (e: EscenaId, id: string) => {
  const b = beatsDeEscena(e).find((x) => x.id === id);
  if (!b) throw new Error(`El beat «${id}» no está en la escena ${e} (duraciones.ts).`);
  return b.desde + b.duracion;
};
