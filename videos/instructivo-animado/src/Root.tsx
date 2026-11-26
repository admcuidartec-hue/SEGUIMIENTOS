import { Composition } from "remotion";
import "./constants/tipografia";
import { ALTO, ANCHO, DURACION_TOTAL, FPS } from "./constants/duraciones";
import { revisarGuion } from "./constants/tiempos";
import { MainVideo } from "./MainVideo";

// Si un subtítulo queda ilegible o un beat no tiene duración, la composición no carga y el error dice por qué.
revisarGuion();

export const RemotionRoot: React.FC = () => (
  <Composition id="InstructivoAnimado" component={MainVideo} durationInFrames={DURACION_TOTAL} fps={FPS} width={ANCHO} height={ALTO} />
);
