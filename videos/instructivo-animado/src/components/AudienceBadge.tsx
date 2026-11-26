import type React from "react";
import { useCurrentFrame } from "remotion";
import { CABECERA } from "../constants/areaSegura";
import { AUDIENCIA } from "../constants/colores";
import type { EscenaId } from "../constants/duraciones";
import { beatsDeEscena } from "../constants/duraciones";
import { type BeatId, GUION, NOMBRE_AUDIENCIA, NOMBRE_CAPA, type Audiencia } from "../constants/guion";
import { beatEnCuadro } from "../constants/tiempos";
import { T, UI } from "../constants/tipografia";
import { progreso } from "./anim";
import { Icono, type NombreIcono } from "./ui/Icono";

const ICONO: Record<Audiencia, NombreIcono> = { enfermeria: "botiquin", asesoras: "telefono", lider: "escudo" };
const ORDEN: readonly Audiencia[] = ["enfermeria", "asesoras", "lider"];

/** Una ficha de público: «Enfermería», «Asesoras · Admisión» o «Líder del proyecto». */
export const ChipAudiencia: React.FC<{ readonly a: Audiencia; readonly activo: number }> = ({ a, activo }) => (
  <div
    style={{
      display: "flex", alignItems: "center", gap: 8, height: 44, padding: "0 16px", borderRadius: 999, fontFamily: UI, fontWeight: 600, fontSize: T.pequeno,
      backgroundColor: AUDIENCIA[a].fondo, color: AUDIENCIA[a].tinta, border: `2px solid ${AUDIENCIA[a].borde}`,
      opacity: 0.28 + 0.72 * activo, scale: String(0.94 + 0.06 * activo), filter: `saturate(${0.3 + 0.7 * activo})`,
    }}
  >
    <Icono n={ICONO[a]} t={20} />
    {NOMBRE_AUDIENCIA[a]}
  </div>
);

/**
 * INSIGNIAS DE PÚBLICO. Arriba a la derecha, en la cabecera: las tres fichas siempre visibles y encendidas solo las del
 * público del beat que suena (`audiencia` en guion.ts). En la escena 3, además, la capa: «Uso diario» o «Por qué se
 * diseñó así».
 */
export const AudienceBadge: React.FC<{ readonly escena: EscenaId; readonly oscuro?: boolean }> = ({ escena, oscuro = false }) => {
  const frame = useCurrentFrame();
  const id = beatEnCuadro(escena, frame);
  const beat = GUION[id as BeatId] as { audiencia: readonly Audiencia[]; capa?: "uso" | "porque" };
  const inicio = beatsDeEscena(escena).find((b) => b.id === id)?.desde ?? 0;
  const cambio = progreso(frame, inicio, 10);
  const entrada = progreso(frame, 8, 14);
  return (
    <div style={{ position: "absolute", right: 1920 - CABECERA.x - CABECERA.w, top: CABECERA.y + 4, display: "flex", gap: 10, alignItems: "center", opacity: entrada }}>
      {beat.capa ? (
        <div
          style={{
            height: 44, display: "flex", alignItems: "center", gap: 8, padding: "0 16px", borderRadius: 10, fontFamily: UI, fontWeight: 700, fontSize: T.pequeno,
            backgroundColor: beat.capa === "porque" ? "#2F5BD3" : oscuro ? "rgba(250,246,241,0.16)" : "#15171C", color: "#FFFFFF", marginRight: 8,
            opacity: cambio, translate: `${(1 - cambio) * 12}px 0px`,
          }}
        >
          <Icono n={beat.capa === "porque" ? "info" : "reloj"} t={20} />
          {NOMBRE_CAPA[beat.capa]}
        </div>
      ) : null}
      {ORDEN.map((a) => <ChipAudiencia key={a} a={a} activo={beat.audiencia.includes(a) ? 1 : 0} />)}
    </div>
  );
};
