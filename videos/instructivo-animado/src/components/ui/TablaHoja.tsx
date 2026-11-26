import type React from "react";
import { useCurrentFrame } from "remotion";
import { CONTENIDO } from "../../constants/areaSegura";
import { APP, HOJA } from "../../constants/colores";
import { UI } from "../../constants/tipografia";
import { progreso, SUAVE } from "../anim";
import { Icono } from "./Icono";

/**
 * HOJA DE CÁLCULO SIMULADA (genérica, sin marcas): el libro BD SOFDOC SEGUIMIENTOS con su barra de menús (incluido el
 * menú «Seguimientos» de src/Menu.gs), la barra de fórmulas, la rejilla y las pestañas de abajo. Ocupa la zona de
 * contenido. Las coordenadas que exporta (HG) son relativas a la ventana, como las de la pantalla de la app.
 */

export const HG = {
  barra: 40,
  titulo: 46,
  menu: 38,
  formula: 40,
  cabCol: 30,
  fila: 34,
  numFila: 50,
  pestanas: 46,
  w: CONTENIDO.w,
  h: CONTENIDO.h,
};
/** y donde empieza la primera fila de datos (fila 1 de la hoja). */
export const Y_FILA1 = HG.barra + HG.titulo + HG.menu + HG.formula + HG.cabCol;

const MENUS: readonly (readonly [string, number])[] = [
  ["Archivo", 88], ["Editar", 76], ["Ver", 54], ["Insertar", 90], ["Formato", 92], ["Datos", 70], ["Herramientas", 136], ["Extensiones", 126], ["Ayuda", 70], ["Seguimientos", 142],
];
const X_MENU0 = 62;
/** Centro de un menú de la barra (para el cursor). */
export const posMenuHoja = (nombre: string) => {
  let x = X_MENU0;
  for (const [n, w] of MENUS) {
    if (n === nombre) return { x: x + w / 2, y: HG.barra + HG.titulo + HG.menu / 2 };
    x += w;
  }
  return { x: 0, y: 0 };
};

/** Las opciones del menú «Seguimientos», en el orden de src/Menu.gs. `null` es el separador. */
export const OPCIONES_SEGUIMIENTOS: readonly (string | null)[] = [
  "Actualizar",
  "Verificar",
  "Activar actualización diaria (7:00)",
  "Probar el correo de SOFDOC atrasado",
  "Importar lo que falta de la base de hierro",
  null,
  "Preparar hojas",
];
const ALTO_OPCION = 44;
const ANCHO_DESPLEGABLE = 470;
/** Centro de una opción del desplegable «Seguimientos». */
export const posOpcion = (opcion: string) => {
  const m = posMenuHoja("Seguimientos");
  let y = HG.barra + HG.titulo + HG.menu + 8;
  for (const o of OPCIONES_SEGUIMIENTOS) {
    if (o === opcion) return { x: m.x - 60 + ANCHO_DESPLEGABLE / 2, y: y + ALTO_OPCION / 2 };
    y += o === null ? 13 : ALTO_OPCION;
  }
  return m;
};

/** Centro de la pestaña `i` (para el cursor). */
export const posPestana = (pestanas: readonly string[], i: number) => {
  let x = 120;
  for (let k = 0; k < i; k++) x += anchoPestana(pestanas[k]);
  return { x: x + anchoPestana(pestanas[i]) / 2, y: HG.h - HG.pestanas / 2 };
};
const anchoPestana = (n: string) => 34 + n.length * 11.5;

/** Centro de la celda (fila desde 1, columna desde 0), con los anchos de columna dados. */
export const posCelda = (anchos: readonly number[], fila: number, col: number) => {
  const x = HG.numFila + anchos.slice(0, col).reduce((a, b) => a + b, 0) + anchos[col] / 2;
  return { x, y: Y_FILA1 + (fila - 1) * HG.fila + HG.fila / 2 };
};

type Props = {
  readonly filas: readonly (readonly string[])[];
  readonly anchos: readonly number[];
  /** Celda activa (fila desde 1, columna desde 0). */
  readonly seleccion?: { readonly fila: number; readonly col: number };
  /** Todo seleccionado (Ctrl+A). */
  readonly todo?: number;
  readonly formula?: string;
  readonly pestanas: readonly string[];
  readonly activa: number;
  /** Filas visibles desde el cuadro dado, de una en una (efecto de pegado). */
  readonly pegadoDesde?: number;
  /** Primera fila en negrita (encabezados). */
  readonly encabezado?: boolean;
  /** Desplegable «Seguimientos» abierto (0 → 1) y la opción bajo el cursor. */
  readonly menuAbierto?: number;
  readonly opcionHover?: string;
  /** Opción tachada (no usar). */
  readonly opcionTachada?: string;
  /** Celdas resaltadas: "fila,col". */
  readonly resaltadas?: readonly string[];
  readonly entra?: number;
  readonly children?: React.ReactNode;
  readonly estilosCelda?: (fila: number, col: number) => React.CSSProperties | undefined;
};

const letra = (i: number) => String.fromCharCode(65 + i);

export const TablaHoja: React.FC<Props> = ({
  filas, anchos, seleccion, todo = 0, formula = "", pestanas, activa, pegadoDesde, encabezado = true, menuAbierto = 0, opcionHover,
  opcionTachada, resaltadas = [], entra = 0, children, estilosCelda,
}) => {
  const frame = useCurrentFrame();
  const p = progreso(frame, entra, 22, SUAVE);
  const filasVisibles = Math.floor((HG.h - Y_FILA1 - HG.pestanas) / HG.fila);
  const ref = seleccion ? `${letra(seleccion.col)}${seleccion.fila}` : "A1";
  const menuSeg = posMenuHoja("Seguimientos");
  return (
    <div
      style={{
        position: "absolute", left: CONTENIDO.x, top: CONTENIDO.y, width: HG.w, height: HG.h, borderRadius: 18, overflow: "hidden", backgroundColor: HOJA.fondo,
        boxShadow: "0 30px 80px rgba(20,8,8,0.30), 0 0 0 1px rgba(20,8,8,0.08)", fontFamily: UI, opacity: p, translate: `0px ${(1 - p) * 60}px`,
      }}
    >
      <div style={{ height: HG.barra, backgroundColor: "#E9E4E0", display: "flex", alignItems: "center", gap: 9, padding: "0 16px" }}>
        {["#E06C5F", "#E8B44C", "#6BBF63"].map((c) => <div key={c} style={{ width: 13, height: 13, borderRadius: 99, backgroundColor: c }} />)}
        <div style={{ marginLeft: 16, flex: 1, height: 26, borderRadius: 8, backgroundColor: "#F7F4F1", fontSize: 16, color: "#7A6D6E", display: "flex", alignItems: "center", paddingLeft: 14 }}>
          BD SOFDOC SEGUIMIENTOS · hoja de cálculo
        </div>
      </div>
      <div style={{ height: HG.titulo, display: "flex", alignItems: "center", gap: 12, padding: "0 18px", backgroundColor: HOJA.barra }}>
        <Icono n="hoja" t={28} color={HOJA.verdeDialogo} />
        <span style={{ fontSize: 22, color: APP.ink }}>BD SOFDOC SEGUIMIENTOS</span>
      </div>
      <div style={{ height: HG.menu, display: "flex", alignItems: "center", paddingLeft: X_MENU0, backgroundColor: HOJA.barra, fontSize: 18, color: APP.soft }}>
        {MENUS.map(([n, w]) => (
          <div key={n} style={{ width: w, textAlign: "center", fontWeight: n === "Seguimientos" ? 600 : 400, color: n === "Seguimientos" ? APP.accent : APP.soft, backgroundColor: n === "Seguimientos" && menuAbierto > 0 ? "#E8EAED" : "transparent", borderRadius: 6, padding: "4px 0" }}>{n}</div>
        ))}
      </div>
      <div style={{ height: HG.formula, display: "flex", alignItems: "center", borderTop: `1px solid ${HOJA.rejilla}`, borderBottom: `1px solid ${HOJA.rejilla}`, fontSize: 18 }}>
        <div style={{ width: 90, textAlign: "center", color: APP.soft, borderRight: `1px solid ${HOJA.rejilla}` }}>{ref}</div>
        <div style={{ padding: "0 12px", color: HOJA.cabeceraTinta, fontStyle: "italic" }}>fx</div>
        <div style={{ color: APP.ink }}>{formula}</div>
      </div>
      {/* rejilla */}
      <div style={{ position: "absolute", left: 0, top: Y_FILA1 - HG.cabCol, right: 0, height: HG.cabCol, display: "flex", backgroundColor: HOJA.cabecera, borderBottom: `1px solid ${HOJA.rejilla}`, fontSize: 15, color: HOJA.cabeceraTinta }}>
        <div style={{ width: HG.numFila, borderRight: `1px solid ${HOJA.rejilla}` }} />
        {anchos.map((w, i) => (
          <div key={i} style={{ width: w, borderRight: `1px solid ${HOJA.rejilla}`, display: "grid", placeItems: "center", backgroundColor: seleccion?.col === i ? "#D3E3FD" : undefined }}>{letra(i)}</div>
        ))}
      </div>
      {Array.from({ length: filasVisibles }).map((_, r) => {
        const fila = filas[r];
        const visible = pegadoDesde === undefined ? 1 : progreso(frame, pegadoDesde + r * 2, 6);
        return (
          <div key={r} style={{ position: "absolute", left: 0, right: 0, top: Y_FILA1 + r * HG.fila, height: HG.fila, display: "flex", borderBottom: `1px solid ${HOJA.rejilla}`, fontSize: 16.5 }}>
            <div style={{ width: HG.numFila, flex: "0 0 auto", backgroundColor: HOJA.cabecera, borderRight: `1px solid ${HOJA.rejilla}`, display: "grid", placeItems: "center", fontSize: 15, color: HOJA.cabeceraTinta }}>{r + 1}</div>
            {anchos.map((w, c) => {
              const sel = seleccion && seleccion.fila === r + 1 && seleccion.col === c;
              const res = resaltadas.includes(`${r + 1},${c}`);
              return (
                <div key={c} style={{
                  width: w, flex: "0 0 auto", boxSizing: "border-box", borderRight: `1px solid ${HOJA.rejilla}`, padding: "0 8px", display: "flex", alignItems: "center",
                  whiteSpace: "nowrap", overflow: "hidden", fontWeight: encabezado && r === 0 ? 700 : 400, color: APP.ink,
                  backgroundColor: res ? "#FFF4CC" : todo > 0 ? `rgba(26,115,232,${0.12 * todo})` : undefined,
                  outline: sel ? `2.5px solid ${HOJA.seleccion}` : undefined, outlineOffset: -2, ...estilosCelda?.(r + 1, c),
                }}>
                  <span style={{ opacity: visible }}>{fila?.[c] ?? ""}</span>
                </div>
              );
            })}
          </div>
        );
      })}
      {/* pestañas */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: HG.pestanas, display: "flex", alignItems: "center", backgroundColor: HOJA.barra, borderTop: `1px solid ${HOJA.rejilla}`, paddingLeft: 120, fontSize: 17 }}>
        {pestanas.map((n, i) => (
          <div key={n} style={{ width: anchoPestana(n), textAlign: "center", padding: "8px 0", borderRadius: 6, fontWeight: i === activa ? 700 : 400, color: i === activa ? "#0B57D0" : APP.soft, backgroundColor: i === activa ? HOJA.pestanaActiva : "transparent" }}>{n}</div>
        ))}
      </div>
      {/* desplegable «Seguimientos» */}
      {menuAbierto > 0 ? (
        <div style={{ position: "absolute", left: menuSeg.x - 60, top: HG.barra + HG.titulo + HG.menu + 2, width: ANCHO_DESPLEGABLE, padding: "6px 0", borderRadius: 8, backgroundColor: "#FFFFFF", boxShadow: "0 10px 30px rgba(0,0,0,0.25)", opacity: menuAbierto, translate: `0px ${(1 - menuAbierto) * -10}px`, fontSize: 19 }}>
          {OPCIONES_SEGUIMIENTOS.map((o, i) =>
            o === null ? (
              <div key={i} style={{ height: 1, backgroundColor: HOJA.rejilla, margin: "6px 0" }} />
            ) : (
              <div key={o} style={{ height: ALTO_OPCION, display: "flex", alignItems: "center", padding: "0 20px", backgroundColor: o === opcionHover ? "#E8EAED" : "transparent", color: o === opcionTachada ? APP.muted : APP.ink, textDecoration: o === opcionTachada ? "line-through" : "none" }}>
                {o}
              </div>
            ),
          )}
        </div>
      ) : null}
      {children}
    </div>
  );
};

/** Diálogo de aviso del Sheets (el `alert` de Apps Script): título, mensaje y «Aceptar». */
export const DialogoHoja: React.FC<{ readonly titulo: string; readonly lineas: readonly React.ReactNode[]; readonly desde: number; readonly hasta?: number; readonly ancho?: number }> = ({
  titulo, lineas, desde, hasta, ancho = 880,
}) => {
  const frame = useCurrentFrame();
  const p = progreso(frame, desde, 12);
  const s = hasta === undefined ? 0 : progreso(frame, hasta - 8, 8);
  if (p <= 0 || s >= 1) return null;
  return (
    <div style={{ position: "absolute", inset: 0, backgroundColor: `rgba(0,0,0,${0.32 * p * (1 - s)})`, display: "grid", placeItems: "center" }}>
      <div style={{ width: ancho, padding: "28px 32px 22px", borderRadius: 10, backgroundColor: "#FFFFFF", boxShadow: "0 20px 60px rgba(0,0,0,0.35)", opacity: p * (1 - s), scale: String(0.94 + 0.06 * p), fontFamily: UI }}>
        <div style={{ fontSize: 26, fontWeight: 600, color: APP.ink, marginBottom: 14 }}>{titulo}</div>
        {lineas.map((l, i) => <div key={i} style={{ fontSize: 21, lineHeight: 1.45, color: APP.soft, marginBottom: 6 }}>{l}</div>)}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
          <div style={{ padding: "10px 26px", borderRadius: 6, backgroundColor: "#0B57D0", color: "#FFFFFF", fontSize: 19, fontWeight: 600 }}>Aceptar</div>
        </div>
      </div>
    </div>
  );
};
