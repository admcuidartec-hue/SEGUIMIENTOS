import { Composition, Folder } from "remotion";
import { Atajos } from "./Atajos";
import { Card } from "./Card";
import { Gerencia } from "./Gerencia";
import { Tutorial } from "./Tutorial";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="TutorialSeguimientos"
        component={Tutorial}
        durationInFrames={7644}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="PresentacionGerencia"
        component={Gerencia}
        durationInFrames={9666}
        fps={30}
        width={1920}
        height={1080}
      />
      <Folder name="Elementos">
        <Composition
          id="Tarjeta"
          component={Card}
          durationInFrames={90}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{ kicker: "Caso 1 · Reevaluación", title: "Luis no volvió a su reevaluación", body: "Lo llamamos y acepta volver a consulta." }}
        />
        <Composition
          id="Atajos"
          component={Atajos}
          durationInFrames={210}
          fps={30}
          width={1920}
          height={1080}
        />
      </Folder>
    </>
  );
};
