import { fade } from "@remotion/transitions/fade";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import type React from "react";
import { Fragment } from "react";
import { AbsoluteFill } from "remotion";
import { CHP } from "./constants/colores";
import { duracionEscena, type EscenaId, ORDEN_ESCENAS, TRANSICION } from "./constants/duraciones";
import { Escena1Introduccion } from "./scenes/Escena1Introduccion";
import { Escena2Sofdoc } from "./scenes/Escena2Sofdoc";
import { Escena3Enfermeria, Escena3Indicadores, Escena3Pacientes, Escena3QuePaso, Escena3Registro, Escena3Roles, Escena3Tablero } from "./scenes/Escena3Pantallas";
import { Escena4Configuracion } from "./scenes/Escena4Configuracion";
import { Escena5Pendientes } from "./scenes/Escena5Pendientes";

const ESCENA: Record<EscenaId, React.FC> = {
  e1: Escena1Introduccion,
  e2: Escena2Sofdoc,
  e3a: Escena3Tablero,
  e3b: Escena3QuePaso,
  e3c: Escena3Registro,
  e3d: Escena3Pacientes,
  e3e: Escena3Enfermeria,
  e3f: Escena3Indicadores,
  e3g: Escena3Roles,
  e4: Escena4Configuracion,
  e5: Escena5Pendientes,
};

/**
 * EL VIDEO: las escenas encadenadas con un fundido. La duración de cada una sale de constants/duraciones.ts.
 *
 * ▸ MÚSICA DE FONDO (opcional): ../musica.py genera una pista; se añadiría aquí, a volumen bajo, con
 *   <Audio src={staticFile("voz/musica.wav")} volume={0.08} />.
 */
export const MainVideo: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: CHP.hueso }}>
    <TransitionSeries>
      {ORDEN_ESCENAS.map((id, i) => {
        const Comp = ESCENA[id];
        return (
          <Fragment key={id}>
            {i > 0 ? <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: TRANSICION })} /> : null}
            <TransitionSeries.Sequence durationInFrames={duracionEscena(id)} name={id}>
              <Comp />
            </TransitionSeries.Sequence>
          </Fragment>
        );
      })}
    </TransitionSeries>
  </AbsoluteFill>
);
