import type React from "react";
import { AbsoluteFill } from "remotion";
import { FONDOS } from "../constants/colores";
import type { EscenaId } from "../constants/duraciones";
import { AudienceBadge } from "./AudienceBadge";
import { SectionTitle } from "./SectionTitle";
import { Subtitles } from "./Subtitles";

/**
 * ESCENARIO de una escena: fondo, título de sección, el contenido, las insignias de público y los subtítulos.
 * Los subtítulos y las insignias se dibujan al final: siempre quedan encima de todo.
 *
 * ▸ VOZ EN OFF: cada escena tiene su audio en public/voz/escena-<id>.wav (lo genera ../voz.py; ver el LEEME.md).
 *   Para activarlo, descomente en cada escena:
 *     import { Audio } from "@remotion/media";   // o `Audio` de "remotion"
 *     <Audio src={staticFile("voz/escena-e1.wav")} />
 *   y ajuste los segundos de los beats en constants/duraciones.ts a la duración real de cada frase.
 */
export const Escenario: React.FC<{
  readonly escena: EscenaId;
  readonly fondo?: keyof typeof FONDOS;
  readonly kicker?: string;
  readonly titulo?: string;
  readonly children: React.ReactNode;
}> = ({ escena, fondo = "hueso", kicker, titulo, children }) => {
  const oscuro = fondo === "granate" || fondo === "noche";
  return (
    <AbsoluteFill style={{ background: FONDOS[fondo], overflow: "hidden" }}>
      {kicker && titulo ? <SectionTitle kicker={kicker} titulo={titulo} oscuro={oscuro} /> : null}
      {children}
      <AudienceBadge escena={escena} oscuro={oscuro} />
      <Subtitles escena={escena} />
    </AbsoluteFill>
  );
};
