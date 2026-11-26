import type React from "react";
import { Img, staticFile, useCurrentFrame } from "remotion";
import { CONTENIDO } from "../constants/areaSegura";
import { APP } from "../constants/colores";
import { SOFDOC_AL_DIA, SOFDOC_ATRASADO } from "../constants/datosDemo";
import { UI } from "../constants/tipografia";
import { progreso, SUAVE, tramos } from "./anim";
import { Icono, type NombreIcono } from "./ui/Icono";

/**
 * PANTALLA SIMULADA — la app «Seguimientos» dibujada con React y CSS (no es una captura), para que el cursor, los
 * clics y los cambios de estado se puedan animar. Reproduce el armazón de src/Index.html: menú lateral con el logo,
 * la fecha de SOFDOC bajo el logo, las cinco secciones, «¿Quién es usted?» y «Modo oscuro».
 *
 * Geometría (todas las coordenadas de las escenas son relativas a la VISTA, en píxeles 1:1):
 *   VISTA   = el área de la app dentro de la ventana del navegador (1728 × 678).
 *   CUERPO  = la zona de contenido a la derecha del menú. Lo que se pasa como `children` se coloca dentro de ella.
 *   `capa`  = encima de todo, en coordenadas de la VISTA (cursor, paneles laterales, avisos).
 */

export const BARRA = 40;
export const VISTA = { w: CONTENIDO.w, h: CONTENIDO.h - BARRA };
export const LATERAL = 264;
export const CUERPO = { x: LATERAL + 30, y: 22, w: VISTA.w - LATERAL - 60, h: VISTA.h - 22 };

export type Seccion = "tablero" | "registro" | "pacientes" | "indicadores" | "enfermeria";
const MENU: readonly { id: Seccion; t: string; i: NombreIcono }[] = [
  { id: "tablero", t: "Tablero", i: "tablero" },
  { id: "registro", t: "Registro", i: "lapiz" },
  { id: "pacientes", t: "Pacientes", i: "usuarios" },
  { id: "indicadores", t: "Indicadores", i: "grafico" },
  { id: "enfermeria", t: "Enfermería", i: "botiquin" },
];

/** Posición (en la VISTA) del centro de un botón del menú lateral: para mover el cursor hasta él. */
export const posMenu = (s: Seccion) => ({ x: 120, y: 196 + MENU.findIndex((m) => m.id === s) * 52 + 24 });
/** Posición del desplegable «¿Quién es usted?». */
export const POS_QUIEN = { x: 132, y: VISTA.h - 118 };

export type Camara = { readonly s: number; readonly cx: number; readonly cy: number };
/** Cámara en reposo: toda la vista. */
export const CAMARA_TOTAL: Camara = { s: 1, cx: VISTA.w / 2, cy: VISTA.h / 2 };

/** Interpola entre planos de cámara: `[cuadro, cámara]`. El punto (cx, cy) de la vista queda en el centro. */
export const camaraEn = (frame: number, planos: readonly (readonly [number, Camara])[]): Camara => {
  if (!planos.length) return CAMARA_TOTAL;
  const fs = planos.map((p) => p[0]);
  const v = (k: keyof Camara) => (planos.length === 1 ? planos[0][1][k] : tramos(frame, fs, planos.map((p) => p[1][k])));
  return { s: v("s"), cx: v("cx"), cy: v("cy") };
};

const transformar = (c: Camara) => {
  // Sin salirse de la vista: con zoom, el borde de la app nunca deja ver el fondo.
  const tx = Math.min(0, Math.max(VISTA.w - VISTA.w * c.s, VISTA.w / 2 - c.cx * c.s));
  const ty = Math.min(0, Math.max(VISTA.h - VISTA.h * c.s, VISTA.h / 2 - c.cy * c.s));
  return { tx, ty };
};

type Props = {
  readonly seccion: Seccion;
  readonly usuario?: string;
  /** Estado de SOFDOC bajo el logo y en el aviso amarillo. */
  readonly sofdoc?: "al-dia" | "atrasado";
  /** Aviso amarillo «Los datos de SOFDOC llegan hasta el…» (0 → 1). */
  readonly avisoSofdoc?: number;
  readonly soloConsulta?: boolean;
  readonly camara?: Camara;
  /** Cuadro en que la ventana entra (deslizándose). */
  readonly entra?: number;
  readonly children?: React.ReactNode;
  readonly capa?: React.ReactNode;
  /** Velo oscuro sobre la app (0 → 1), para destacar algo encima. */
  readonly velo?: number;
  /**
   * ▸ CAPTURA REAL (opcional): ruta en public/, p. ej. 'cap/t01-tablero.png' (las de ../tutorial-chp/public/cap y /ger
   *   salen del DEMO de src/Index.html, con pacientes inventados). Se dibuja debajo de todo, a tamaño de la vista, con la
   *   opacidad `capturaOpacidad`: sirve para comparar la simulación con la app real o para sustituirla.
   */
  readonly captura?: string;
  readonly capturaOpacidad?: number;
};

export const SimulatedScreen: React.FC<Props> = ({
  seccion, usuario = "Ana", sofdoc = "al-dia", avisoSofdoc = 0, soloConsulta = false, camara = CAMARA_TOTAL, entra = 0,
  children, capa, velo = 0, captura, capturaOpacidad = 1,
}) => {
  const frame = useCurrentFrame();
  const p = progreso(frame, entra, 22, SUAVE);
  const { tx, ty } = transformar(camara);
  const atrasado = sofdoc === "atrasado";
  return (
    <div
      style={{
        position: "absolute", left: CONTENIDO.x, top: CONTENIDO.y, width: CONTENIDO.w, height: CONTENIDO.h, borderRadius: 18, overflow: "hidden",
        backgroundColor: APP.bg, boxShadow: "0 30px 80px rgba(20,8,8,0.30), 0 0 0 1px rgba(20,8,8,0.08)",
        opacity: p, translate: `0px ${(1 - p) * 60}px`, scale: String(0.97 + 0.03 * p),
      }}
    >
      {/* barra del navegador */}
      <div style={{ height: BARRA, backgroundColor: "#E9E4E0", display: "flex", alignItems: "center", gap: 9, padding: "0 16px" }}>
        {["#E06C5F", "#E8B44C", "#6BBF63"].map((c) => <div key={c} style={{ width: 13, height: 13, borderRadius: 99, backgroundColor: c }} />)}
        <div style={{ marginLeft: 16, flex: 1, height: 26, borderRadius: 8, backgroundColor: "#F7F4F1", fontFamily: UI, fontSize: 16, color: "#7A6D6E", display: "flex", alignItems: "center", paddingLeft: 14 }}>
          Seguimientos · CHP
        </div>
      </div>
      {/* la app, con cámara */}
      <div style={{ position: "relative", width: VISTA.w, height: VISTA.h, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: VISTA.w, height: VISTA.h, transformOrigin: "0 0", translate: `${tx}px ${ty}px`, scale: String(camara.s) }}>
          {captura ? (
            // Captura real debajo de la simulación (ver la prop `captura`).
            <Img src={staticFile(captura)} style={{ position: "absolute", inset: 0, width: VISTA.w, height: VISTA.h, objectFit: "cover", opacity: capturaOpacidad }} />
          ) : null}
          {/* menú lateral */}
          <div style={{ position: "absolute", left: 0, top: 0, width: LATERAL, height: VISTA.h, backgroundColor: APP.side, borderRight: `1px solid ${APP.line}`, fontFamily: UI }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "22px 18px 0" }}>
              <div style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: APP.accent, color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 16 }}>CHP</div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 600, color: APP.ink, lineHeight: 1.1 }}>Seguimientos</div>
                <div style={{ fontSize: 15, color: APP.muted, lineHeight: 1.25, marginTop: 3 }}>Centro Hematológico del Perú</div>
              </div>
            </div>
            <div style={{ padding: "12px 18px 0", whiteSpace: "nowrap", fontSize: 15, lineHeight: 1.45, color: atrasado ? APP.warn : APP.muted, fontVariantNumeric: "tabular-nums" }}>
              {atrasado ? (
                <>SOFDOC hasta el {SOFDOC_ATRASADO.hasta}<br />Cargado el 18/11/2026 07:00</>
              ) : (
                <>SOFDOC hasta el {SOFDOC_AL_DIA.hasta}<br />Cargado el {SOFDOC_AL_DIA.cargado}</>
              )}
            </div>
            <div style={{ position: "absolute", left: 14, right: 14, top: 196, display: "flex", flexDirection: "column", gap: 4 }}>
              {MENU.map((m) => {
                const activo = m.id === seccion;
                return (
                  <div key={m.id} style={{ height: 48, display: "flex", alignItems: "center", gap: 12, padding: "0 14px", borderRadius: 9, backgroundColor: activo ? APP.accentSoft : "transparent", color: activo ? APP.accent : APP.soft, fontSize: 20, fontWeight: 500 }}>
                    <Icono n={m.i} t={22} />{m.t}
                  </div>
                );
              })}
            </div>
            <div style={{ position: "absolute", left: 16, right: 16, bottom: 18 }}>
              <div style={{ fontSize: 15, color: APP.muted, marginBottom: 6 }}>¿Quién es usted?</div>
              <div style={{ height: 46, border: `1px solid ${APP.line}`, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", fontSize: 19, fontWeight: 500, color: APP.ink }}>
                {usuario}<Icono n="caret" t={18} color={APP.muted} />
              </div>
              <div style={{ height: 42, display: "flex", alignItems: "center", gap: 10, padding: "0 4px", marginTop: 6, fontSize: 18, color: APP.soft }}>
                <Icono n="luna" t={19} />Modo oscuro
              </div>
            </div>
          </div>
          {/* cuerpo */}
          <div style={{ position: "absolute", left: CUERPO.x, top: CUERPO.y, width: CUERPO.w, height: CUERPO.h, fontFamily: UI, color: APP.ink }}>
            {soloConsulta ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", borderRadius: 9, backgroundColor: APP.infoSoft, fontSize: 18, fontWeight: 500, marginBottom: 12 }}>
                <Icono n="ojo" t={20} color={APP.info} />Usuario de solo consulta: puede ver todo, pero no modificar datos.
              </div>
            ) : null}
            {avisoSofdoc > 0 ? (
              <div style={{ position: "absolute", left: 0, right: 0, top: 0, zIndex: 5, opacity: avisoSofdoc, translate: `0px ${(1 - avisoSofdoc) * -16}px`, display: "flex", gap: 10, padding: "12px 16px", borderRadius: 9, backgroundColor: APP.warnSoft, borderLeft: `5px solid ${APP.warn}`, fontSize: 18, lineHeight: 1.45, boxShadow: "0 8px 24px rgba(152,91,0,0.18)" }}>
                <Icono n="alerta" t={22} color={APP.warn} style={{ marginTop: 2 }} />
                <span>
                  <b>Los datos de SOFDOC llegan hasta el {SOFDOC_ATRASADO.hasta}</b> (hace {SOFDOC_ATRASADO.dias} días). Los pacientes que volvieron después siguen en la lista y algunas «No vino» pueden no ser ciertas. Avise a quien carga SOFDOC: exportar, pegar en la «Hoja 1» y usar «Actualizar».
                </span>
              </div>
            ) : null}
            {children}
          </div>
          {velo > 0 ? <div style={{ position: "absolute", inset: 0, backgroundColor: APP.velo, opacity: velo }} /> : null}
          {capa}
        </div>
      </div>
    </div>
  );
};
