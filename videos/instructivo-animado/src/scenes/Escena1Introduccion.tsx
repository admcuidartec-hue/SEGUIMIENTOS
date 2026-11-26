import type React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { aparece, entre, progreso, resorte } from "../components/anim";
import { Escenario } from "../components/Escenario";
import { type Flecha, FlowDiagram, type Nodo } from "../components/FlowDiagram";
import { SectionTitle } from "../components/SectionTitle";
import { TarjetaTitulo } from "../components/TarjetaTitulo";
import { Icono, type NombreIcono } from "../components/ui/Icono";
import { AREA, CONTENIDO } from "../constants/areaSegura";
import { APP, CHP, FONDOS } from "../constants/colores";
import { finBeat, inicioBeat } from "../constants/duraciones";
import { TEXTOS } from "../constants/guion";
import { inicioLinea } from "../constants/tiempos";
import { TITULAR, UI } from "../constants/tipografia";

const E = "e1" as const;
const T = TEXTOS.e1;
const b = (id: string) => inicioBeat(E, id);

/* ▸ VOZ: <Audio src={staticFile("voz/escena-e1.wav")} /> (ver components/Escenario.tsx). */

const ICONOS_PROPOSITO: readonly NombreIcono[] = ["calendario", "gota", "lapiz", "hoja", "botiquin"];

/** Beat «propósito»: el lema y las cinco cosas que cuida la plataforma. */
const Proposito: React.FC = () => {
  const frame = useCurrentFrame();
  const ini = b("e1_proposito"), fin = finBeat(E, "e1_proposito");
  const l2 = inicioLinea(E, "e1_proposito", 1);
  const ancho = (AREA.w - 4 * 22) / 5;
  return (
    <AbsoluteFill style={{ opacity: entre(frame, ini, fin + 8) }}>
      <div style={{ position: "absolute", left: CONTENIDO.x, top: 210, width: AREA.w, ...aparece(frame, ini + 6), fontFamily: TITULAR, fontSize: 92, lineHeight: 1, color: CHP.granate, textTransform: "uppercase" }}>
        {T.propositoTitulo}
      </div>
      <div style={{ position: "absolute", left: CONTENIDO.x, top: 420, display: "flex", gap: 22 }}>
        {T.proposito.map((p, i) => {
          const r = resorte(frame, l2 + i * 7, 150, 16);
          return (
            <div key={p.t} style={{ width: ancho, height: 270, boxSizing: "border-box", padding: "30px 26px", borderRadius: 22, backgroundColor: "#FFFFFF", border: `2px solid ${CHP.linea}`, boxShadow: "0 18px 40px rgba(111,23,19,0.10)", opacity: Math.min(1, r * 1.4), translate: `0px ${(1 - r) * 50}px`, fontFamily: UI }}>
              <div style={{ width: 70, height: 70, borderRadius: 18, backgroundColor: CHP.rosa, display: "grid", placeItems: "center" }}>
                <Icono n={ICONOS_PROPOSITO[i]} t={40} color={CHP.acento} />
              </div>
              <div style={{ fontFamily: TITULAR, fontSize: 46, color: CHP.granate, textTransform: "uppercase", marginTop: 26, lineHeight: 1 }}>{p.t}</div>
              <div style={{ fontSize: 25, color: CHP.gris, marginTop: 10, lineHeight: 1.3 }}>{p.s}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/** Beat «quiénes»: los tres roles y el médico, que no la usa. */
const Quienes: React.FC = () => {
  const frame = useCurrentFrame();
  const ini = b("e1_quienes"), fin = finBeat(E, "e1_quienes");
  const l2 = inicioLinea(E, "e1_quienes", 1);
  const iconos: readonly NombreIcono[] = ["telefono", "botiquin", "ojo"];
  const ancho = (AREA.w - 2 * 40) / 3;
  return (
    <AbsoluteFill style={{ opacity: entre(frame, ini, fin + 8) }}>
      <div style={{ position: "absolute", left: CONTENIDO.x, top: 190, display: "flex", gap: 40 }}>
        {T.roles.map((r, i) => {
          const s = resorte(frame, ini + 8 + i * 10, 150, 16);
          return (
            <div key={r.t} style={{ width: ancho, height: 400, boxSizing: "border-box", padding: "34px 34px", borderRadius: 24, backgroundColor: i === 2 ? "#FFFFFF" : CHP.granate, color: i === 2 ? CHP.tinta : "#FFFFFF", border: i === 2 ? `2px dashed ${CHP.gris}` : "none", opacity: Math.min(1, s * 1.4), scale: String(0.9 + 0.1 * s), fontFamily: UI }}>
              <Icono n={iconos[i]} t={52} color={i === 2 ? CHP.acento : "#F2D6D0"} />
              <div style={{ fontFamily: TITULAR, fontSize: 64, textTransform: "uppercase", marginTop: 18, lineHeight: 1 }}>{r.t}</div>
              <div style={{ fontSize: 28, marginTop: 18, lineHeight: 1.3, color: i === 2 ? CHP.gris : "#EBD3CE" }}>{r.s}</div>
              <div style={{ display: "inline-block", fontSize: 25, marginTop: 22, padding: "8px 16px", borderRadius: 12, backgroundColor: i === 2 ? CHP.rosa : "rgba(250,246,241,0.14)", fontWeight: 600 }}>{r.d}</div>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: CONTENIDO.x, top: 630, width: AREA.w, height: 100, boxSizing: "border-box", display: "flex", alignItems: "center", gap: 22, padding: "0 34px", borderRadius: 20, backgroundColor: APP.warnSoft, border: `2px solid ${APP.warn}`, ...aparece(frame, l2), fontFamily: UI, fontSize: 32, color: CHP.tinta, fontWeight: 600 }}>
        <Icono n="usuario" t={44} color={APP.warn} />
        {T.medico}
      </div>
    </AbsoluteFill>
  );
};

/** Beats «flujo» y «fuentes»: el recorrido de la información y las dos fuentes que se suman. */
const Flujo: React.FC = () => {
  const frame = useCurrentFrame();
  const ini = b("e1_flujo"), finF = finBeat(E, "e1_flujo");
  const [l1, l2, l3, l4] = [0, 1, 2, 3].map((n) => inicioLinea(E, "e1_flujo", n));
  const fuentes = b("e1_fuentes");
  const W = 292, G = (AREA.w - 5 * W) / 4, H = 136, Y1 = 250, Y2 = 540;
  const X = (i: number) => AREA.x + i * (W + G);
  const n = T.flujo;
  const foco = (desde: number, hasta: number) => entre(frame, desde, hasta);
  const nodos: Nodo[] = [
    { id: "sofdoc", t: n[0].t, s: n[0].s, x: X(0), y: Y1, w: W, h: H, desde: l1, tono: "fuerte", foco: foco(l4 + 20, finF) },
    { id: "excel", t: n[1].t, s: n[1].s, x: X(1), y: Y1, w: W, h: H, desde: l1 + 12 },
    { id: "hoja1", t: n[2].t, s: n[2].s, x: X(2), y: Y1, w: W, h: H, desde: l1 + 24 },
    { id: "actualizar", t: n[3].t, s: n[3].s, x: X(3), y: Y1, w: W, h: H, desde: l2 },
    { id: "citas", t: n[4].t, s: n[4].s, x: X(4), y: Y1, w: W, h: H, desde: l2 + 12 },
    { id: "tablero", t: n[5].t, s: n[5].s, x: X(4), y: Y2, w: W, h: H, desde: l2 + 26, tono: "fuerte" },
    { id: "llamada", t: n[6].t, s: n[6].s, x: X(3), y: Y2, w: W, h: H, desde: l3 },
    { id: "quepaso", t: n[7].t, s: n[7].s, x: X(2), y: Y2, w: W, h: H, desde: l3 + 12 },
    { id: "retorno", t: n[8].t, s: n[8].s, x: X(1), y: Y2, w: W, h: H, desde: l4, tono: "fuerte" },
  ];
  const flechas: Flecha[] = [
    { de: "sofdoc", a: "excel", desde: l1 + 8, paquete: true },
    { de: "excel", a: "hoja1", desde: l1 + 20, paquete: true },
    { de: "hoja1", a: "actualizar", desde: l2 - 6, paquete: true },
    { de: "actualizar", a: "citas", desde: l2 + 8, paquete: true },
    { de: "citas", a: "tablero", desde: l2 + 20 },
    { de: "tablero", a: "llamada", desde: l3 - 4 },
    { de: "llamada", a: "quepaso", desde: l3 + 8 },
    { de: "quepaso", a: "retorno", desde: l4 - 4 },
    { de: "retorno", a: "sofdoc", desde: l4 + 14, lado: { de: "izq", a: "aba" }, via: [{ x: X(0) + W / 2, y: Y2 + H / 2 }], punteada: true },
  ];
  const atenua = 1 - progreso(frame, fuentes - 4, 16);
  return (
    <AbsoluteFill style={{ background: FONDOS.granate, opacity: progreso(frame, ini - 10, 12) }}>
      <SectionTitle kicker="Escena 1 · Introducción" titulo={frame < fuentes ? T.flujoTitulo : T.fuentesTitulo} oscuro />
      <AbsoluteFill style={{ opacity: atenua }}>
        <FlowDiagram nodos={nodos} flechas={flechas} />
      </AbsoluteFill>
      <Fuentes desde={fuentes} />
    </AbsoluteFill>
  );
};

const Fuentes: React.FC<{ readonly desde: number }> = ({ desde }) => {
  const frame = useCurrentFrame();
  if (frame < desde - 4) return null;
  const l2 = inicioLinea(E, "e1_fuentes", 1);
  const f = T.fuentes;
  const nodos: Nodo[] = [
    { id: "crm", t: f[0].t, s: f[0].s, x: 260, y: 230, w: 440, h: 150, desde: desde + 6, tono: "suave", icono: "telefono" },
    { id: "registro", t: f[1].t, s: f[1].s, x: 260, y: 520, w: 440, h: 150, desde: l2, tono: "suave", icono: "lapiz" },
    { id: "tablero", t: "Tablero", s: "Las tarjetas de cada día", x: 1180, y: 360, w: 480, h: 180, desde: desde + 12, tono: "fuerte", icono: "tablero" },
  ];
  const flechas: Flecha[] = [
    { de: "crm", a: "tablero", desde: desde + 18, lado: { de: "der", a: "izq" }, via: [{ x: 940, y: 305 }, { x: 940, y: 450 }], paquete: true },
    { de: "registro", a: "tablero", desde: l2 + 10, lado: { de: "der", a: "izq" }, via: [{ x: 940, y: 595 }, { x: 940, y: 450 }], paquete: true },
  ];
  return (
    <AbsoluteFill>
      <FlowDiagram nodos={nodos} flechas={flechas} tamTitulo={44} />
      <div style={{ position: "absolute", left: 740, top: 236, width: 190, ...aparece(frame, desde + 24), fontFamily: UI, fontSize: 23, lineHeight: 1.3, color: "#F2D6D0", textAlign: "center" }}>{f[0].d}</div>
      <div style={{ position: "absolute", left: 740, top: 610, width: 190, ...aparece(frame, l2 + 16), fontFamily: UI, fontSize: 23, lineHeight: 1.3, color: "#F2D6D0", textAlign: "center" }}>{f[1].d}</div>
    </AbsoluteFill>
  );
};

export const Escena1Introduccion: React.FC = () => {
  const frame = useCurrentFrame();
  const fp = b("e1_proposito");
  return (
    <Escenario escena={E} fondo="hueso">
      {frame < fp + 10 ? <TarjetaTitulo portada kicker={T.kicker} titulo={T.titulo} bajada={T.bajada} hasta={fp + 10} /> : null}
      {frame >= fp && frame < b("e1_flujo") + 10 ? (
        <>
          <SectionTitle kicker="Escena 1 · Introducción" titulo={frame < b("e1_quienes") ? "Para qué sirve" : T.rolesTitulo} />
          <Proposito />
          <Quienes />
        </>
      ) : null}
      {frame >= b("e1_flujo") - 10 ? <Flujo /> : null}
    </Escenario>
  );
};
