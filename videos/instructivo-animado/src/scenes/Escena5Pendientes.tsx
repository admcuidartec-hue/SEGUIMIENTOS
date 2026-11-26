import type React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { aparece, entre, progreso, resorte } from "../components/anim";
import { Escenario } from "../components/Escenario";
import { Logo } from "../components/Logo";
import { LowerThird } from "../components/LowerThird";
import { SectionTitle } from "../components/SectionTitle";
import { Icono, type NombreIcono } from "../components/ui/Icono";
import { AREA } from "../constants/areaSegura";
import { APP, CHP, FONDOS } from "../constants/colores";
import { HOY } from "../constants/datosDemo";
import { finBeat, inicioBeat } from "../constants/duraciones";
import { type BeatId, TEXTOS } from "../constants/guion";
import { BARLOW, TITULAR, UI } from "../constants/tipografia";

/*
 * ESCENA 5 · PENDIENTES Y CIERRE — el tablero de pendientes del líder del proyecto (tres columnas), los tres pilares y
 * la tarjeta final.
 *
 * ▸ VOZ: <Audio src={staticFile("voz/escena-e5.wav")} /> (ver components/Escenario.tsx).
 * ▸ DATOS REALES: los pendientes salen de TEXTOS.e5.tarjetas (constants/guion.ts); si se llevan en un tablero externo,
 *   se pueden exportar a JSON y leer con staticFile + delayRender. Al cerrar uno, quítelo de ahí y vuelva a renderizar.
 */

const E = "e5" as const;
const T = TEXTOS.e5;
const b = (id: BeatId) => inicioBeat(E, id);
const fb = (id: BeatId) => finBeat(E, id);

const ICONO_COL: readonly NombreIcono[] = ["lapiz", "info", "usuarios"];
const COLOR_COL = [CHP.acento, APP.info, APP.warn];

const Tablero: React.FC = () => {
  const frame = useCurrentFrame();
  const ini = b("e5_tablero");
  const G = 30, W = (AREA.w - 2 * G) / 3;
  const enfoque = (beat: string) => entre(frame, b(beat as BeatId), fb(beat as BeatId));
  return (
    <AbsoluteFill>
      {T.columnas.map((c, i) => {
        const tarjetas = T.tarjetas.filter((t) => t.col === i);
        return (
          <div key={c} style={{ position: "absolute", left: AREA.x + i * (W + G), top: 170, width: W, height: 550, boxSizing: "border-box", padding: "18px 18px", borderRadius: 22, backgroundColor: APP.col, ...aparece(frame, ini + 6 + i * 8) }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: TITULAR, fontSize: 40, textTransform: "uppercase", color: COLOR_COL[i] }}>
              <Icono n={ICONO_COL[i]} t={32} />{c}
              <span style={{ marginLeft: "auto", fontFamily: UI, fontSize: 24, color: APP.muted }}>{tarjetas.filter((t) => frame >= b(t.en as BeatId)).length}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
              {tarjetas.map((t, k) => {
                const desde = b(t.en as BeatId) + 10 + tarjetas.filter((x) => x.en === t.en).indexOf(t) * 14;
                const r = resorte(frame, desde, 160, 16);
                const foco = enfoque(t.en);
                return (
                  <div key={k} style={{ padding: "16px 18px", borderRadius: 14, backgroundColor: "#FFFFFF", borderLeft: `6px solid ${COLOR_COL[i]}`, boxShadow: foco ? "0 14px 30px rgba(21,23,28,0.16)" : "0 2px 6px rgba(21,23,28,0.06)", fontFamily: UI, fontSize: 25, lineHeight: 1.3, color: APP.ink, opacity: frame < desde ? 0 : Math.min(1, r * 1.4) * (0.55 + 0.45 * Math.max(foco, frame >= b("e5_pilares") ? 1 : 0)), translate: `0px ${(1 - r) * 30}px` }}>
                    {t.t}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

const Pilares: React.FC = () => {
  const frame = useCurrentFrame();
  const ini = b("e5_pilares");
  const G = 36, W = (AREA.w - 2 * G) / 3;
  return (
    <AbsoluteFill style={{ background: FONDOS.granate, opacity: progreso(frame, ini - 6, 12) }}>
      <SectionTitle kicker="Escena 5 · Cierre" titulo="Tres pilares" oscuro />
      {T.pilares.map((p, i) => {
        const r = resorte(frame, ini + 12 + i * 40, 150, 15);
        return (
          <div key={p.n} style={{ position: "absolute", left: AREA.x + i * (W + G), top: 220, width: W, height: 540, boxSizing: "border-box", padding: "40px 36px", borderRadius: 28, backgroundColor: i === 0 ? CHP.hueso : "rgba(250,246,241,0.10)", border: i === 0 ? "none" : "2px solid rgba(250,246,241,0.35)", opacity: Math.min(1, r * 1.4), translate: `0px ${(1 - r) * 60}px` }}>
            <div style={{ fontFamily: TITULAR, fontSize: 150, lineHeight: 0.9, color: i === 0 ? CHP.granate : "#F2D6D0" }}>{p.n}</div>
            <div style={{ fontFamily: TITULAR, fontSize: 64, lineHeight: 1, textTransform: "uppercase", color: i === 0 ? CHP.granate : "#FFFFFF", marginTop: 24 }}>{p.t}</div>
            <div style={{ fontFamily: UI, fontSize: 32, lineHeight: 1.3, color: i === 0 ? CHP.tinta : "#EBD3CE", marginTop: 18 }}>{p.s}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

const Fin: React.FC = () => {
  const frame = useCurrentFrame();
  const ini = b("e5_fin");
  return (
    <AbsoluteFill style={{ background: FONDOS.granate, alignItems: "center", justifyContent: "center", paddingBottom: 140, opacity: progreso(frame, ini - 6, 14) }}>
      <div style={aparece(frame, ini + 4)}><Logo ancho={440} /></div>
      <div style={{ ...aparece(frame, ini + 14), fontFamily: TITULAR, fontSize: 130, lineHeight: 1, color: "#FFFFFF", textTransform: "uppercase", marginTop: 50 }}>Gracias</div>
      <div style={{ ...aparece(frame, ini + 24), fontFamily: UI, fontSize: 44, color: "#EBD3CE", marginTop: 20 }}>{T.cierre}</div>
      <div style={{ ...aparece(frame, ini + 34), fontFamily: BARLOW, fontWeight: 600, fontSize: 28, letterSpacing: "0.2em", textTransform: "uppercase", color: "#F2D6D0", marginTop: 40 }}>{TEXTOS.marca} · {TEXTOS.institucion}</div>
    </AbsoluteFill>
  );
};

export const Escena5Pendientes: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <Escenario escena={E} fondo="hueso">
      {frame < b("e5_pilares") + 10 ? (
        <>
          <SectionTitle kicker={`${T.kicker} · ${T.titulo}`} titulo="Pendientes del líder del proyecto" ancho={1000} />
          <Tablero />
          <LowerThird kicker="Líder del proyecto" titulo={`Estado al ${HOY}`} detalle="Al cerrar un pendiente, quítelo de constants/guion.ts y vuelva a renderizar." desde={b("e5_tablero") + 30} hasta={b("e5_pilares")} />
        </>
      ) : null}
      {frame >= b("e5_pilares") - 10 && frame < b("e5_fin") + 10 ? <Pilares /> : null}
      {frame >= b("e5_fin") - 10 ? <Fin /> : null}
    </Escenario>
  );
};
