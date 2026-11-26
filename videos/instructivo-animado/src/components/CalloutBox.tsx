import type React from "react";
import { useCurrentFrame } from "remotion";
import { APP, CHP } from "../constants/colores";
import { TITULAR, UI } from "../constants/tipografia";
import { progreso, resorte } from "./anim";
import { Icono, type NombreIcono } from "./ui/Icono";

type Tono = "granate" | "claro" | "aviso" | "bien" | "info";
const ESTILO: Record<Tono, { fondo: string; tinta: string; suave: string; borde: string }> = {
  granate: { fondo: CHP.granate, tinta: "#FFFFFF", suave: "#F2D6D0", borde: CHP.granate },
  claro: { fondo: "#FFFFFF", tinta: APP.ink, suave: APP.soft, borde: "#E2B3AE" },
  aviso: { fondo: APP.warnSoft, tinta: APP.ink, suave: "#5E4A2A", borde: APP.warn },
  bien: { fondo: APP.goodSoft, tinta: APP.ink, suave: "#2D5B43", borde: APP.good },
  info: { fondo: APP.infoSoft, tinta: APP.ink, suave: "#2C3F73", borde: APP.info },
};

/**
 * NOTA DESTACADA. Una caja que aparece con un resorte, con título y texto, y opcionalmente una flecha que señala un
 * punto de la pantalla (coordenadas de la escena, 1920 × 1080). La caja debe quedar dentro del área segura: quien la
 * coloca lo comprueba con `dentroDelArea` de constants/areaSegura.ts.
 */
export const CalloutBox: React.FC<{
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly desde: number;
  readonly hasta?: number;
  readonly titulo?: string;
  readonly texto?: React.ReactNode;
  readonly tono?: Tono;
  readonly icono?: NombreIcono;
  readonly numero?: string;
  readonly flecha?: { readonly x: number; readonly y: number };
  readonly t?: number;
}> = ({ x, y, w, desde, hasta, titulo, texto, tono = "claro", icono, numero, flecha, t = 26 }) => {
  const frame = useCurrentFrame();
  const r = resorte(frame, desde, 170, 16);
  const sale = hasta === undefined ? 0 : progreso(frame, hasta - 10, 10);
  const o = Math.min(1, progreso(frame, desde, 8)) * (1 - sale);
  if (o <= 0) return null;
  const e = ESTILO[tono];
  const trazo = progreso(frame, desde + 6, 14);
  return (
    <>
      {flecha ? (
        <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible", opacity: o }} width={1} height={1}>
          {(() => {
            // La flecha sale del borde de la caja más cercano al punto.
            const ax = Math.min(Math.max(flecha.x, x), x + w);
            const ay = flecha.y < y ? y : y + 10;
            const bx = ax + (flecha.x - ax) * trazo, by = ay + (flecha.y - ay) * trazo;
            return (
              <>
                <line x1={ax} y1={ay} x2={bx} y2={by} stroke={e.borde === "#FFFFFF" ? CHP.granate : e.borde} strokeWidth={4} strokeLinecap="round" />
                <circle cx={flecha.x} cy={flecha.y} r={10 * trazo} fill={CHP.acento} stroke="#FFFFFF" strokeWidth={3} />
              </>
            );
          })()}
        </svg>
      ) : null}
      <div
        style={{
          position: "absolute", left: x, top: y, width: w, boxSizing: "border-box", padding: `${t * 0.75}px ${t * 0.9}px`, borderRadius: 18,
          backgroundColor: e.fondo, color: e.tinta, border: `2px solid ${e.borde}`, boxShadow: "0 22px 50px rgba(20,8,8,0.28)",
          opacity: o, scale: String(0.85 + 0.15 * r), transformOrigin: "50% 100%", fontFamily: UI,
        }}
      >
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          {numero ? (
            <div style={{ flex: "0 0 auto", width: t * 1.7, height: t * 1.7, borderRadius: 999, backgroundColor: tono === "granate" ? CHP.hueso : CHP.granate, color: tono === "granate" ? CHP.granate : CHP.hueso, display: "grid", placeItems: "center", fontFamily: TITULAR, fontSize: t * 1.15 }}>{numero}</div>
          ) : icono ? (
            <Icono n={icono} t={t * 1.3} color={tono === "granate" ? CHP.hueso : e.borde} style={{ marginTop: 2 }} />
          ) : null}
          <div style={{ flex: 1 }}>
            {titulo ? <div style={{ fontWeight: 700, fontSize: t * 1.05, lineHeight: 1.2 }}>{titulo}</div> : null}
            {texto ? <div style={{ fontSize: t * 0.88, lineHeight: 1.35, color: e.suave, marginTop: titulo ? 6 : 0 }}>{texto}</div> : null}
          </div>
        </div>
      </div>
    </>
  );
};
