import type React from "react";
import { useCurrentFrame } from "remotion";
import { APP, CHP } from "../constants/colores";
import { TITULAR, UI } from "../constants/tipografia";
import { progreso, resorte } from "./anim";
import { Icono, type NombreIcono } from "./ui/Icono";

/**
 * DIAGRAMA DE FLUJO ANIMADO. Los nodos aparecen con un resorte y las flechas se dibujan de a poco (trazo progresivo).
 * Una flecha puede llevar un «paquete» que la recorre en bucle (el dato que viaja) o estar «cortada» (sin conexión).
 * Coordenadas de la escena (1920 × 1080).
 */
export type Nodo = {
  readonly id: string;
  readonly t: string;
  readonly s?: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly desde: number;
  readonly tono?: "fuerte" | "suave" | "claro" | "alerta";
  readonly icono?: NombreIcono;
  /** Resaltado (0 → 1): anillo de foco. */
  readonly foco?: number;
};

export type Flecha = {
  readonly de: string;
  readonly a: string;
  readonly desde: number;
  /** Puntos intermedios (codos), en coordenadas de la escena. */
  readonly via?: readonly { x: number; y: number }[];
  readonly lado?: { readonly de?: Lado; readonly a?: Lado };
  readonly paquete?: boolean;
  readonly cortada?: boolean;
  readonly etiqueta?: string;
  readonly punteada?: boolean;
};
type Lado = "der" | "izq" | "arr" | "aba";

const ancla = (n: Nodo, lado: Lado) =>
  lado === "der" ? { x: n.x + n.w, y: n.y + n.h / 2 } : lado === "izq" ? { x: n.x, y: n.y + n.h / 2 } : lado === "arr" ? { x: n.x + n.w / 2, y: n.y } : { x: n.x + n.w / 2, y: n.y + n.h };

const ladoAuto = (a: Nodo, b: Nodo): [Lado, Lado] => {
  const dx = b.x + b.w / 2 - (a.x + a.w / 2), dy = b.y + b.h / 2 - (a.y + a.h / 2);
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? ["der", "izq"] : ["izq", "der"];
  return dy > 0 ? ["aba", "arr"] : ["arr", "aba"];
};

const largo = (pts: { x: number; y: number }[]) => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p.x - pts[i].x, p.y - pts[i].y), 0);
const puntoEn = (pts: { x: number; y: number }[], f: number) => {
  let d = largo(pts) * f;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (d <= seg) {
      const k = seg ? d / seg : 0;
      return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * k, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * k, ang: Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x) };
    }
    d -= seg;
  }
  const n = pts.length;
  return { x: pts[n - 1].x, y: pts[n - 1].y, ang: Math.atan2(pts[n - 1].y - pts[n - 2].y, pts[n - 1].x - pts[n - 2].x) };
};

const ESTILO_NODO = {
  fuerte: { fondo: CHP.hueso, tinta: CHP.granate, sub: CHP.tinta, borde: "transparent" },
  suave: { fondo: "rgba(250,246,241,0.10)", tinta: "#FFFFFF", sub: "#EBD3CE", borde: "rgba(250,246,241,0.40)" },
  claro: { fondo: "#FFFFFF", tinta: CHP.granate, sub: APP.soft, borde: "#E2B3AE" },
  alerta: { fondo: APP.warnSoft, tinta: APP.warn, sub: APP.ink, borde: APP.warn },
};

export const FlowDiagram: React.FC<{
  readonly nodos: readonly Nodo[];
  readonly flechas: readonly Flecha[];
  /** Color de las flechas (claro sobre fondos oscuros). */
  readonly color?: string;
  readonly tamTitulo?: number;
}> = ({ nodos, flechas, color = "rgba(250,246,241,0.75)", tamTitulo = 34 }) => {
  const frame = useCurrentFrame();
  const porId = Object.fromEntries(nodos.map((n) => [n.id, n]));
  return (
    <>
      <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        {flechas.map((f, i) => {
          const a = porId[f.de], b = porId[f.a];
          if (!a || !b) return null;
          const [la, lb] = ladoAuto(a, b);
          const pts = [ancla(a, f.lado?.de ?? la), ...(f.via ?? []), ancla(b, f.lado?.a ?? lb)];
          const L = largo(pts);
          const p = progreso(frame, f.desde, 20);
          if (p <= 0) return null;
          const fin = puntoEn(pts, p);
          const c = f.cortada ? CHP.acento : color;
          const d = "M" + pts.map((q) => `${q.x},${q.y}`).join(" L");
          const medio = puntoEn(pts, 0.5);
          const paq = f.paquete ? puntoEn(pts, ((frame - f.desde) % 45) / 45) : null;
          return (
            <g key={i}>
              <path d={d} fill="none" stroke={c} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round"
                strokeDasharray={f.punteada || f.cortada ? `12 10` : `${L} ${L}`} strokeDashoffset={f.punteada || f.cortada ? 0 : L * (1 - p)}
                opacity={f.punteada || f.cortada ? p : 1} />
              {p > 0.9 && !f.cortada ? (
                <polygon points="0,-9 16,0 0,9" fill={c} transform={`translate(${fin.x},${fin.y}) rotate(${(fin.ang * 180) / Math.PI}) translate(-14,0)`} />
              ) : null}
              {f.cortada ? (
                <g transform={`translate(${medio.x},${medio.y})`} opacity={progreso(frame, f.desde + 12, 10)}>
                  <circle r={26} fill={CHP.acento} stroke="#FFFFFF" strokeWidth={4} />
                  <path d="M-10,-10 L10,10 M10,-10 L-10,10" stroke="#FFFFFF" strokeWidth={5} strokeLinecap="round" />
                </g>
              ) : null}
              {paq && p >= 1 ? <circle cx={paq.x} cy={paq.y} r={8} fill="#FFFFFF" stroke={CHP.acento} strokeWidth={3} /> : null}
              {f.etiqueta ? (
                <text x={medio.x} y={f.cortada ? medio.y + 64 : medio.y - 16} textAnchor="middle" fontFamily={UI} fontSize={26} fontWeight={600} fill={c} opacity={progreso(frame, f.desde + 10, 10)}>{f.etiqueta}</text>
              ) : null}
            </g>
          );
        })}
      </svg>
      {nodos.map((n) => {
        const r = resorte(frame, n.desde, 160, 15);
        if (frame < n.desde) return null;
        const e = ESTILO_NODO[n.tono ?? "suave"];
        return (
          <div key={n.id} style={{
            position: "absolute", left: n.x, top: n.y, width: n.w, height: n.h, boxSizing: "border-box", borderRadius: 18, padding: "10px 16px",
            backgroundColor: e.fondo, border: `2px solid ${e.borde}`, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center",
            opacity: Math.min(1, r * 1.5), scale: String(0.7 + 0.3 * r), boxShadow: n.foco ? `0 0 0 ${6 * n.foco}px rgba(242,214,208,${0.55 * n.foco}), 0 18px 40px rgba(0,0,0,0.25)` : "0 14px 30px rgba(0,0,0,0.18)",
          }}>
            {n.icono ? <Icono n={n.icono} t={tamTitulo * 0.9} color={e.tinta} style={{ marginBottom: 4 }} /> : null}
            <div style={{ fontFamily: TITULAR, fontSize: tamTitulo, lineHeight: 1.02, color: e.tinta, textTransform: "uppercase" }}>{n.t}</div>
            {n.s ? <div style={{ fontFamily: UI, fontSize: tamTitulo * 0.62, lineHeight: 1.25, color: e.sub, marginTop: 4 }}>{n.s}</div> : null}
          </div>
        );
      })}
    </>
  );
};
