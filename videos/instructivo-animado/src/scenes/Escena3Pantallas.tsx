import type React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { AnimatedCursor, type PuntoCursor, sobre } from "../components/AnimatedCursor";
import { aparece, entre, escribiendo, progreso, resorte } from "../components/anim";
import { CalloutBox } from "../components/CalloutBox";
import { Escenario } from "../components/Escenario";
import { SectionTitle } from "../components/SectionTitle";
import { CAMARA_TOTAL, type Camara, camaraEn, CUERPO, POS_QUIEN, posMenu, SimulatedScreen, VISTA } from "../components/SimulatedScreen";
import { Badge } from "../components/ui/Badge";
import { Boton, Tecla } from "../components/ui/Boton";
import { FRANJA, Franja, type TarjetaAnimada } from "../components/ui/Franja";
import { Icono, type NombreIcono } from "../components/ui/Icono";
import { TarjetaPaciente } from "../components/ui/TarjetaPaciente";
import { AREA, CONTENIDO } from "../constants/areaSegura";
import { APP, CHP } from "../constants/colores";
import { ENFERMERIA_FILAS, FASES, HOY, INDICADORES, PACIENTE, USUARIOS_DEMO } from "../constants/datosDemo";
import { type EscenaId, inicioBeat } from "../constants/duraciones";
import { type BeatId, TEXTOS } from "../constants/guion";
import { inicioLinea } from "../constants/tiempos";
import { MONO, TITULAR, UI } from "../constants/tipografia";

/*
 * ESCENA 3 · LAS PANTALLAS — siete subescenas, cada una con dos capas: «Uso diario» y «Por qué se diseñó así» (para el
 * líder del proyecto; la insignia de la cabecera lo dice). Todas usan la pantalla simulada (components/SimulatedScreen).
 *
 * ▸ CAPTURAS REALES: cada <SimulatedScreen> acepta `captura="cap/…png"` (ver la prop). Las capturas del DEMO de
 *   src/Index.html están en ../tutorial-chp/public/cap y /ger (copiarlas a public/cap de este proyecto).
 * ▸ VOZ: una pista por subescena: <Audio src={staticFile("voz/escena-e3a.wav")} /> … e3g (ver components/Escenario.tsx).
 */

const KICKER = "Escena 3 · Las pantallas";
const P = TEXTOS.e3;

/** Coordenadas de la VISTA a partir de coordenadas del CUERPO. */
const enCuerpo = (x: number, y: number) => ({ x: CUERPO.x + x, y: CUERPO.y + y });
/** Coordenadas de la escena (1920 × 1080) a partir de las de la VISTA, sin zoom. */
const enEscena = (x: number, y: number) => ({ x: CONTENIDO.x + x, y: CONTENIDO.y + 40 + y });

/* ═════════════════ Piezas comunes ═════════════════ */

/** Capa «Por qué se diseñó así»: la pantalla se oscurece y aparece la explicación para el líder del proyecto. */
const PanelPorQue: React.FC<{ readonly desde: number; readonly puntos: readonly string[] }> = ({ desde, puntos }) => {
  const frame = useCurrentFrame();
  const r = resorte(frame, desde, 150, 17);
  if (frame < desde) return null;
  return (
    <div style={{ position: "absolute", left: AREA.x + 230, top: 200, width: AREA.w - 460, boxSizing: "border-box", padding: "34px 44px 38px", borderRadius: 26, backgroundColor: "#FFFFFF", border: `3px solid ${APP.info}`, boxShadow: "0 40px 90px rgba(10,20,60,0.35)", opacity: Math.min(1, r * 1.4), scale: String(0.92 + 0.08 * r), fontFamily: UI }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, color: APP.info, fontWeight: 700, fontSize: 26, letterSpacing: "0.04em" }}>
        <Icono n="info" t={32} />POR QUÉ SE DISEÑÓ ASÍ · para el líder del proyecto
      </div>
      <div style={{ fontFamily: TITULAR, fontSize: 70, lineHeight: 1, color: CHP.granate, textTransform: "uppercase", marginTop: 16, ...aparece(frame, desde + 6) }}>{puntos[0]}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 22 }}>
        {puntos.slice(1).map((p, i) => (
          <div key={p} style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 34, color: APP.ink, ...aparece(frame, desde + 26 + i * 26) }}>
            <Icono n="check" t={34} color={APP.info} grosor={3} />{p}
          </div>
        ))}
      </div>
    </div>
  );
};

/** Escenario común de una subescena de pantallas: fondo y título. */
const Pantallas: React.FC<{ readonly escena: EscenaId; readonly titulo: string; readonly children: React.ReactNode }> = ({ escena, titulo, children }) => (
  <Escenario escena={escena} fondo="hueso">
    <SectionTitle kicker={KICKER} titulo={titulo} />
    {children}
  </Escenario>
);

/** Aviso tipo «toast» de la app, abajo al centro de la vista. */
const Toast: React.FC<{ readonly texto: string; readonly desde: number; readonly hasta: number; readonly deshacerHover?: number; readonly centro?: number }> = ({ texto, desde, hasta, deshacerHover = 0, centro = VISTA.w / 2 }) => {
  const frame = useCurrentFrame();
  const o = entre(frame, desde, hasta);
  if (o <= 0) return null;
  return (
    <div style={{ position: "absolute", left: centro - 340, top: VISTA.h - 96, width: 680, height: 64, borderRadius: 12, backgroundColor: APP.toast, color: APP.toastInk, display: "flex", alignItems: "center", gap: 14, padding: "0 20px", boxSizing: "border-box", fontFamily: UI, fontSize: 21, opacity: o, translate: `0px ${(1 - o) * 20}px` }}>
      <Icono n="checkCirculo" t={24} color="#5CC98F" />
      <span style={{ flex: 1 }}>{texto}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 8, fontWeight: 700, color: "#F39489", backgroundColor: deshacerHover ? "rgba(243,148,137,0.18)" : "transparent" }}>
        <Icono n="deshacer" t={20} />Deshacer
      </span>
    </div>
  );
};

/** Campo de formulario de la app. */
const Campo: React.FC<{ readonly e: string; readonly v: string; readonly w: number; readonly foco?: number; readonly mono?: boolean }> = ({ e, v, w, foco = 0, mono }) => (
  <div style={{ width: w }}>
    <div style={{ fontSize: 16, color: APP.muted, marginBottom: 5 }}>{e}</div>
    <div style={{ height: 46, boxSizing: "border-box", borderRadius: 9, border: `${foco ? 2 : 1}px solid ${foco ? APP.accent : APP.line2}`, backgroundColor: "#fff", display: "flex", alignItems: "center", padding: "0 14px", fontSize: 19, fontFamily: mono ? MONO : UI, boxShadow: foco ? "0 0 0 4px rgba(140,29,24,0.15)" : "none", whiteSpace: "nowrap", overflow: "hidden" }}>{v}</div>
  </div>
);

/* ═════════════════ TABLERO (contenido reutilizado en 3A, 3B y 3G) ═════════════════ */

const Y_FRANJAS = 156;
const posTarjeta = (fase: number, k: number) => enCuerpo(10 + FRANJA.cabecera + 12 + k * (FRANJA.tarjetaW + FRANJA.gap), Y_FRANJAS + fase * (FRANJA.alto + FRANJA.separacion) + 6);
const BUSCADOR = { x: CUERPO.w - 420, y: 4, w: 420, h: 52 };

const ContenidoTablero: React.FC<{
  readonly aparicion?: (i: number) => number;
  readonly tarjetas?: (i: number) => readonly TarjetaAnimada[] | undefined;
  readonly cifras?: (i: number) => number | undefined;
  readonly resaltada?: (i: number) => number;
  readonly busqueda?: string;
  readonly buscadorFoco?: number;
  readonly filtrosFoco?: number;
  readonly saludo?: string;
  readonly sinMeta?: boolean;
}> = ({ aparicion, tarjetas, cifras, resaltada, busqueda = "", buscadorFoco = 0, filtrosFoco = 0, saludo = "Buenos días, Ana", sinMeta = false }) => {
  const maxC = Math.max(...FASES.map((f) => f.cifra));
  const anillo = filtrosFoco ? `0 0 0 ${4 * filtrosFoco}px rgba(140,29,24,0.25)` : "none";
  return (
    <>
      <div style={{ position: "absolute", left: 0, top: 0 }}>
        <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.01em" }}>{saludo}</div>
        <div style={{ fontSize: 18, color: APP.muted, marginTop: 4 }}>Jueves {HOY} · 23 por contactar</div>
        <div style={{ display: sinMeta ? "none" : "flex", alignItems: "center", gap: 12, marginTop: 8, fontSize: 16, color: APP.soft }}>
          <span style={{ width: 160, height: 7, borderRadius: 99, backgroundColor: APP.line, overflow: "hidden" }}><span style={{ display: "block", width: "40%", height: "100%", backgroundColor: APP.accent }} /></span>
          Hoy: 6 de 15 seguimientos
        </div>
      </div>
      <div style={{ position: "absolute", left: BUSCADOR.x, top: BUSCADOR.y, width: BUSCADOR.w, height: BUSCADOR.h, boxSizing: "border-box", borderRadius: 12, border: `${buscadorFoco ? 2 : 1}px solid ${buscadorFoco ? APP.accent : APP.line}`, backgroundColor: "#fff", display: "flex", alignItems: "center", gap: 10, padding: "0 16px", fontSize: 19, color: busqueda ? APP.ink : APP.muted, boxShadow: buscadorFoco ? "0 0 0 4px rgba(140,29,24,0.18)" : "none" }}>
        <Icono n="buscar" t={20} color={APP.muted} />{busqueda || "Buscar por nombre o DNI"}<span style={{ marginLeft: "auto" }}><Tecla t={14}>/</Tecla></span>
      </div>
      <div style={{ position: "absolute", left: 0, top: 96, right: 0, display: "flex", alignItems: "center", gap: 10, fontSize: 17 }}>
        <div style={{ display: "flex", gap: 2, padding: 4, borderRadius: 999, backgroundColor: "#fff", border: `1px solid ${APP.line}`, boxShadow: anillo }}>
          {([["Todos", 31], ["Reevaluaciones", 23], ["Hierro", 6], ["Procedimientos", 2]] as const).map(([t, n], i) => (
            <span key={t} style={{ padding: "7px 14px", borderRadius: 999, backgroundColor: i === 0 ? APP.accent : "transparent", color: i === 0 ? "#fff" : APP.soft, fontWeight: 500 }}>{t} <span style={{ opacity: 0.75 }}>{n}</span></span>
          ))}
        </div>
        <span style={{ flex: 1 }} />
        {([["Todos los médicos", "usuario"], ["Todos los meses", "calendario"], ["Todas las especialidades", "gota"]] as const).map(([t, i]) => (
          <span key={t} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 999, backgroundColor: "#fff", border: `1px solid ${APP.line}`, color: APP.soft, boxShadow: anillo }}>
            <Icono n={i} t={17} />{t}<Icono n="caret" t={15} />
          </span>
        ))}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: Y_FRANJAS, display: "flex", flexDirection: "column", gap: FRANJA.separacion }}>
        {FASES.map((f, i) => (
          <Franja key={f.id} fase={f} n={i + 1} maxCifra={maxC} aparicion={aparicion?.(i) ?? 1} tarjetas={tarjetas?.(i)} cifra={cifras?.(i)} resaltada={resaltada?.(i) ?? 0} />
        ))}
      </div>
    </>
  );
};

/* ═════════════════ 3A · TABLERO ═════════════════ */

const IntroPantallas: React.FC<{ readonly desde: number; readonly hasta: number }> = ({ desde, hasta }) => {
  const frame = useCurrentFrame();
  const o = entre(frame, desde, hasta);
  const l2 = inicioLinea("e3a", "e3a_intro", 1);
  const lista = Object.values(P.secciones);
  return (
    <AbsoluteFill style={{ opacity: o }}>
      <div style={{ position: "absolute", left: AREA.x, top: 190, width: 820 }}>
        <div style={{ fontFamily: TITULAR, fontSize: 110, lineHeight: 0.95, color: CHP.granate, textTransform: "uppercase", ...aparece(frame, desde + 4) }}>Las pantallas</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 30 }}>
          {lista.map((s, i) => (
            <div key={s} style={{ ...aparece(frame, desde + 14 + i * 5), padding: "12px 20px", borderRadius: 14, backgroundColor: "#FFFFFF", border: `2px solid ${CHP.linea}`, fontFamily: UI, fontSize: 28, fontWeight: 600, color: CHP.tinta }}>
              <span style={{ color: CHP.acento, marginRight: 10 }}>{i + 1}</span>{s}
            </div>
          ))}
        </div>
      </div>
      {[
        { t: "Uso diario", s: "Qué hacer en cada pantalla, paso a paso", c: "#15171C", i: "reloj" as const, d: desde + 30 },
        { t: "Por qué se diseñó así", s: "Las decisiones de diseño, para el líder del proyecto", c: APP.info, i: "info" as const, d: l2 },
      ].map((k, i) => (
        <div key={k.t} style={{ position: "absolute", left: 1000, top: 200 + i * 250, width: AREA.x + AREA.w - 1000, height: 220, boxSizing: "border-box", padding: "30px 34px", borderRadius: 24, backgroundColor: k.c, color: "#FFFFFF", fontFamily: UI, ...aparece(frame, k.d) }}>
          <Icono n={k.i} t={46} />
          <div style={{ fontFamily: TITULAR, fontSize: 60, textTransform: "uppercase", marginTop: 10, lineHeight: 1 }}>{k.t}</div>
          <div style={{ fontSize: 27, opacity: 0.85, marginTop: 8 }}>{k.s}</div>
        </div>
      ))}
    </AbsoluteFill>
  );
};

export const Escena3Tablero: React.FC = () => {
  const E = "e3a" as const;
  const frame = useCurrentFrame();
  const b = (id: BeatId) => inicioBeat(E, id);
  const fases = b("e3a_fases"), filtros = b("e3a_filtros"), buscador = b("e3a_buscador"), espera = b("e3a_espera"), porque = b("e3a_porque");
  const l2fases = inicioLinea(E, "e3a_fases", 1);
  const l2espera = inicioLinea(E, "e3a_espera", 1);
  // Las franjas entran una a una mientras la voz las nombra.
  const aparicion = (i: number) => progreso(frame, (i === 0 ? fases + 10 : l2fases) + i * 16, 14);
  const resaltada = (i: number) => (frame < filtros ? entre(frame, l2fases + i * 16, l2fases + i * 16 + 40) : 0);
  // Una tarjeta baja sola de «Por contactar» a «Contactado».
  const baja = filtros + 14, pB = progreso(frame, baja, 28);
  const desdeP = posTarjeta(0, 0), haciaP = posTarjeta(1, 0);
  const luis = FASES[0].tarjetas[0];
  const luisMovido: TarjetaAnimada = { ...luis, etiqueta: "No contestó · reintentar el 28/11" };
  const tarjetas = (i: number): readonly TarjetaAnimada[] | undefined => {
    if (i === 0) {
      const base = FASES[0].tarjetas.map((t, k) => (k === 0 ? { ...t, opacidad: frame >= baja ? 0 : 1 } : k === 2 ? { ...t, foco: entre(frame, espera + 10, l2espera) } : t));
      return frame >= baja + 28 ? base.slice(1) : base;
    }
    if (i === 1) return frame >= baja + 28 ? [luisMovido, FASES[1].tarjetas[0]] : FASES[1].tarjetas.map((t, k) => ({ ...t, dx: k === 0 ? interpolate(pB, [0, 1], [0, FRANJA.tarjetaW + FRANJA.gap]) : 0, opacidad: k === 1 ? 1 - pB : 1 }));
    return undefined;
  };
  const cifras = (i: number) => (frame >= baja + 28 ? (i === 0 ? 22 : i === 1 ? 6 : undefined) : undefined);
  const filtrosFoco = entre(frame, filtros + 60, buscador);
  // Buscador
  const clicBuscar = buscador + 18;
  const texto = escribiendo(frame, clicBuscar + 6, "quispe", 10);
  const fuera = progreso(frame, clicBuscar + 30, 12) * (1 - progreso(frame, espera - 8, 8));
  const centroBusc = enCuerpo(BUSCADOR.x + BUSCADOR.w / 2, BUSCADOR.y + 150);
  const enEsperaPos = posTarjeta(0, 2);
  const camara: Camara = camaraEn(frame, [
    [buscador, CAMARA_TOTAL],
    [buscador + 20, { s: 1.45, cx: centroBusc.x - 160, cy: centroBusc.y + 40 }],
    [espera - 10, { s: 1.45, cx: centroBusc.x - 160, cy: centroBusc.y + 40 }],
    [espera + 10, { s: 1.5, cx: enEsperaPos.x + 170, cy: enEsperaPos.y + 80 }],
    [l2espera - 10, { s: 1.5, cx: enEsperaPos.x + 170, cy: enEsperaPos.y + 80 }],
    [l2espera + 10, CAMARA_TOTAL],
  ]);
  const puntos: PuntoCursor[] = [
    { f: buscador, x: 900, y: 420 },
    { f: clicBuscar, x: CUERPO.x + BUSCADOR.x + 120, y: CUERPO.y + BUSCADOR.y + 26, clic: true },
    { f: espera - 10, x: CUERPO.x + BUSCADOR.x + 140, y: CUERPO.y + BUSCADOR.y + 60 },
  ];
  return (
    <Pantallas escena={E} titulo={frame < fases ? "Dos capas" : P.secciones.a}>
      {frame < fases + 12 ? <IntroPantallas desde={0} hasta={fases + 6} /> : null}
      {frame >= fases - 12 ? (
        <SimulatedScreen seccion="tablero" entra={fases - 10} camara={camara} velo={progreso(frame, porque, 14) * 1.6}
          capa={
            <>
              {frame >= baja && frame < baja + 28 ? (
                <div style={{ position: "absolute", left: interpolate(pB, [0, 1], [desdeP.x, haciaP.x]), top: interpolate(pB, [0, 1], [desdeP.y, haciaP.y]) - Math.sin(pB * Math.PI) * 30 }}>
                  <TarjetaPaciente t={luis} w={FRANJA.tarjetaW} h={FRANJA.alto - 12} compacta foco={1} />
                </div>
              ) : null}
              {fuera > 0 ? (
                <div style={{ position: "absolute", left: CUERPO.x + BUSCADOR.x - 360, top: CUERPO.y + BUSCADOR.y + 62, width: 780, padding: "16px 20px", boxSizing: "border-box", borderRadius: 12, backgroundColor: APP.infoSoft, border: "1px solid #AFC2F2", fontFamily: UI, fontSize: 17, color: APP.ink, opacity: fuera, boxShadow: "0 16px 40px rgba(21,23,28,0.18)" }}>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>2 pacientes con «quispe» no están en ninguna franja visible.</div>
                  {[["Carmen Quispe Prueba", "…4521", "tiene cita agendada el 03/12 (Hematología)"], ["Rosa Quispe Prueba", "…2333", "tiene alta médica vigente (Hematología, 20/11)"]].map(([n, d, m]) => (
                    <div key={n} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderTop: "1px solid #C9D6F5" }}>
                      <b style={{ whiteSpace: "nowrap" }}>{n}</b><span style={{ color: APP.muted, fontFamily: MONO }}>{d}</span><span style={{ flex: 1, color: APP.soft }}>{m}</span>
                      <span style={{ color: APP.info, fontWeight: 600, whiteSpace: "nowrap" }}>Ver ficha</span>
                    </div>
                  ))}
                </div>
              ) : null}
              <AnimatedCursor puntos={puntos} escala={camara.s} desde={buscador} hasta={espera} />
            </>
          }>
          <ContenidoTablero aparicion={aparicion} tarjetas={tarjetas} cifras={cifras} resaltada={resaltada} busqueda={frame >= espera ? "" : texto} buscadorFoco={frame >= clicBuscar && frame < espera ? 1 : 0} filtrosFoco={filtrosFoco} />
        </SimulatedScreen>
      ) : null}
      {frame >= filtros && frame < buscador ? <Toast texto="No contestó · Luis Ramos Prueba pasó a «Contactado»" desde={baja + 30} hasta={filtros + 120} /> : null}
      <CalloutBox x={1100} y={560} w={700} desde={espera + 24} hasta={l2espera} tono="claro" icono="reloj" titulo="Recién registrados · en espera" texto="Al final de «Por contactar», con borde punteado. No cuentan en ninguna cifra hasta que se le escribe." t={24} />
      {frame >= l2espera - 6 && frame < porque ? (
        <div style={{ position: "absolute", left: AREA.x + 150, top: 772, width: AREA.w - 300, ...aparece(frame, l2espera, porque), display: "flex", justifyContent: "center", gap: 26, padding: "18px 24px", borderRadius: 18, backgroundColor: "rgba(21,23,28,0.9)", fontFamily: UI, fontSize: 24, color: "#FAF6F1", boxSizing: "border-box" }}>
          {[["1", "No contestó"], ["2", "Lo pensará"], ["3", "Agendó cita"], ["4", "Pagó"], ["X", "Cerrar"]].map(([k, t]) => (
            <span key={k} style={{ display: "flex", alignItems: "center", gap: 10 }}><Tecla t={24} oscura>{k}</Tecla>{t}</span>
          ))}
        </div>
      ) : null}
      <PanelPorQue desde={porque + 6} puntos={P.porque.a} />
    </Pantallas>
  );
};

/* ═════════════════ 3B · «¿QUÉ PASÓ?» ═════════════════ */

const PANEL = { x: VISTA.w - 640, w: 640 };
const RESPUESTAS: readonly { t: string; i: NombreIcono; k: string }[] = [
  { t: "No contestó", i: "telefonoNo", k: "1" },
  { t: "Lo pensará", i: "reloj", k: "2" },
  { t: "Agendó cita", i: "calendario", k: "3" },
  { t: "Pagó", i: "dinero", k: "4" },
];
const CIERRES: readonly { t: string; i: NombreIcono }[] = [
  { t: "Número equivocado", i: "telefonoNo" },
  { t: "Sin contacto válido", i: "cerrar" },
  { t: "Se atiende en otro lugar", i: "flecha" },
  { t: "Falleció", i: "info" },
  { t: "No desea continuar", i: "cerrar" },
];
/** Posición (en la VISTA) del centro de un botón del panel. */
const Y_RESP = 330, Y_CIERRE = 504;
const posResp = (i: number) => ({ x: PANEL.x + 28 + (i % 2) * 297 + 146, y: Y_RESP + Math.floor(i / 2) * 64 + 27 });
const posCierre = (i: number) => ({ x: PANEL.x + 28 + (i % 2) * 297 + 146, y: Y_CIERRE + Math.floor(i / 2) * 56 + 24 });

const PanelQuePaso: React.FC<{ readonly entra: number; readonly hoverResp?: number; readonly hoverCierre?: number; readonly focoCierres?: number; readonly pulsado?: number; readonly paso?: number; readonly focoResp?: number }> = ({
  entra, hoverResp = -1, hoverCierre = -1, focoCierres = 0, pulsado = -1, paso = 0, focoResp = 0,
}) => {
  const frame = useCurrentFrame();
  const p = progreso(frame, entra, 18);
  if (p <= 0) return null;
  return (
    <div style={{ position: "absolute", left: PANEL.x + (1 - p) * PANEL.w, top: 0, width: PANEL.w, height: VISTA.h, boxSizing: "border-box", padding: "18px 28px", backgroundColor: APP.surface, borderLeft: `1px solid ${APP.line}`, boxShadow: "-24px 0 64px rgba(21,23,28,0.14)", fontFamily: UI, color: APP.ink }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}><Badge tono="info" t={16}>Reevaluación</Badge><span style={{ fontSize: 17, color: APP.muted }}>Paciente nuevo</span></div>
      <div style={{ fontSize: 30, fontWeight: 700, marginTop: 6 }}>{PACIENTE.nombre}</div>
      <div style={{ fontSize: 17, color: APP.muted, marginTop: 2 }}>DNI {PACIENTE.dni} · {PACIENTE.especialidad} · {PACIENTE.medico}</div>
      <div style={{ display: "flex", gap: 40, marginTop: 12, fontSize: 16, color: APP.muted }}>
        <div>Última consulta<div style={{ fontFamily: MONO, fontSize: 19, color: APP.ink }}>{PACIENTE.ultima}</div></div>
        <div>Debía volver el<div style={{ fontFamily: MONO, fontSize: 19, color: APP.ink }}>{PACIENTE.debia}</div></div>
        <div style={{ alignSelf: "flex-end", fontSize: 19, fontWeight: 700, color: APP.ink }}>{PACIENTE.atraso}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", marginTop: 12, padding: "8px 14px", border: `1px solid ${APP.line}`, borderRadius: 10 }}>
        <div style={{ flex: 1 }}><div style={{ fontSize: 14, color: APP.muted }}>Teléfono</div><div style={{ fontFamily: MONO, fontSize: 21 }}>{PACIENTE.telefono}</div></div>
        <Boton t={16} icono="copiar" tecla="C">Copiar</Boton>
      </div>
      <div style={{ position: "absolute", top: Y_RESP - 40, left: 28, fontSize: 21, fontWeight: 700 }}>¿Qué pasó?</div>
      <div style={{ position: "absolute", top: Y_RESP, left: 28, right: 28 }}>
        {paso > 0 ? (
          <div style={{ height: 118, boxSizing: "border-box", padding: "12px 16px", borderRadius: 12, border: `2px solid ${APP.accent}`, backgroundColor: APP.accentSoft, opacity: paso }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 19, fontWeight: 600 }}><Icono n="calendario" t={22} color={APP.accent} />Agendó cita · fecha de la cita</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
              <span style={{ padding: "6px 14px", border: `1px solid ${APP.line2}`, borderRadius: 8, fontFamily: MONO, fontSize: 19, backgroundColor: "#fff" }}>30/11/2026</span>
              <span style={{ fontSize: 16, color: APP.muted }}>Solo fechas futuras</span>
              <span style={{ marginLeft: "auto" }}><Boton variante="primario" t={16}>Guardar cita</Boton></span>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {RESPUESTAS.map((r, i) => (
              <Boton key={r.t} icono={r.i} tecla={r.k} t={19} alto={54} hover={hoverResp === i ? 1 : 0} pulsado={pulsado === i ? 1 : 0}
                style={i === 0 && focoResp ? { boxShadow: `0 0 0 ${4 * focoResp}px rgba(140,29,24,0.3)` } : undefined}>{r.t}</Boton>
            ))}
          </div>
        )}
      </div>
      <div style={{ position: "absolute", top: Y_CIERRE - 38, left: 28, display: "flex", alignItems: "center", gap: 10, fontSize: 18, fontWeight: 600, color: APP.soft }}>Cerrar el seguimiento <Tecla t={13}>X</Tecla></div>
      <div style={{ position: "absolute", top: Y_CIERRE, left: 28, right: 28, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, borderRadius: 12, boxShadow: focoCierres ? `0 0 0 ${5 * focoCierres}px rgba(140,29,24,0.25)` : "none" }}>
        {CIERRES.map((c, i) => (
          <Boton key={c.t} icono={c.i} t={17} alto={48} hover={hoverCierre === i ? 1 : 0}>{c.t}</Boton>
        ))}
      </div>
    </div>
  );
};

export const Escena3QuePaso: React.FC = () => {
  const E = "e3b" as const;
  const frame = useCurrentFrame();
  const b = (id: BeatId) => inicioBeat(E, id);
  const panel = b("e3b_panel"), reglas = b("e3b_reglas"), cierres = b("e3b_cierres"), porque = b("e3b_porque");
  const l2reglas = inicioLinea(E, "e3b_reglas", 1), l2cierres = inicioLinea(E, "e3b_cierres", 1);
  const tarjeta = posTarjeta(0, 0);
  const clicTarjeta = panel + 34;
  const clicAgendo = reglas + 20;
  const clicNoContesto = l2cierres + 40;
  const deshacer = { x: PANEL.x / 2 + 60 + 260, y: VISTA.h - 64 };
  const puntos: PuntoCursor[] = [
    { f: panel + 8, x: 700, y: 560 },
    { f: clicTarjeta, x: tarjeta.x + 150, y: tarjeta.y + 30, clic: true },
    { f: panel + 70, x: posResp(0).x, y: posResp(0).y },
    { f: panel + 95, x: posResp(1).x, y: posResp(1).y },
    { f: panel + 120, x: posResp(3).x, y: posResp(3).y },
    { f: clicAgendo, x: posResp(2).x, y: posResp(2).y, clic: true },
    { f: l2reglas + 10, x: posResp(0).x - 60, y: posResp(0).y + 40 },
    { f: cierres + 30, x: posCierre(1).x, y: posCierre(1).y },
    { f: l2cierres + 6, x: posCierre(1).x, y: posCierre(1).y },
    { f: clicNoContesto, x: posResp(0).x, y: posResp(0).y, clic: true },
    { f: clicNoContesto + 40, x: deshacer.x, y: deshacer.y },
  ];
  const paso = entre(frame, clicAgendo + 6, l2reglas);
  const sobreResp = RESPUESTAS.findIndex((_, i) => sobre(frame, puntos, { x: posResp(i).x - 146, y: posResp(i).y - 27, w: 292, h: 54 }));
  const sobreCierre = CIERRES.findIndex((_, i) => sobre(frame, puntos, { x: posCierre(i).x - 146, y: posCierre(i).y - 24, w: 292, h: 48 }));
  const pulsado = frame >= clicNoContesto - 3 && frame < clicNoContesto + 5 ? 0 : -1;
  const sc = enEscena(posResp(0).x, posResp(0).y);
  const scC = enEscena(posCierre(1).x, posCierre(1).y);
  return (
    <Pantallas escena={E} titulo={P.secciones.b}>
      <SimulatedScreen seccion="tablero" entra={0} velo={Math.max(progreso(frame, clicTarjeta + 2, 12), progreso(frame, porque, 14) * 1.6)}
        capa={
          <>
            <PanelQuePaso entra={clicTarjeta + 4} hoverResp={paso > 0 ? -1 : sobreResp} hoverCierre={sobreCierre} pulsado={pulsado} paso={paso}
              focoCierres={entre(frame, cierres + 6, l2cierres)} focoResp={entre(frame, l2reglas, cierres)} />
            <Toast texto="Guardado: No contestó · intento 1 de 2" desde={clicNoContesto + 8} hasta={porque} deshacerHover={frame > clicNoContesto + 40 ? 1 : 0} centro={PANEL.x / 2 + 60} />
            <AnimatedCursor puntos={puntos} hasta={porque} />
          </>
        }>
        <ContenidoTablero tarjetas={(i) => (i === 0 ? FASES[0].tarjetas.map((t, k) => ({ ...t, foco: k === 0 ? entre(frame, clicTarjeta - 4, porque) : 0 })) : undefined)} />
      </SimulatedScreen>
      <CalloutBox x={AREA.x + 40} y={420} w={720} desde={l2reglas} hasta={cierres} tono="claro" icono="telefonoNo" titulo="Dos «No contestó» seguidos" texto="El seguimiento se cierra solo (MAX_SEGUIMIENTOS = 2, en REGLAS)." flecha={{ x: sc.x - 150, y: sc.y }} t={26} />
      <CalloutBox x={AREA.x + 40} y={560} w={720} desde={l2cierres - 4} hasta={clicNoContesto} tono="aviso" icono="telefonoNo" titulo="¿Sin ningún teléfono?" texto="Use «Sin contacto válido». Si después aparece un número, la tarjeta vuelve sola." flecha={{ x: scC.x - 150, y: scC.y }} t={26} />
      <PanelPorQue desde={porque + 6} puntos={P.porque.b} />
    </Pantallas>
  );
};

/* ═════════════════ 3C · REGISTRO ═════════════════ */

const PESTANAS_REG: readonly { t: string; i: NombreIcono }[] = [
  { t: "Indicación", i: "lapiz" },
  { t: "Control + laboratorio", i: "hoja" },
  { t: "Decisión del médico", i: "usuario" },
];
const posPestanaReg = (i: number) => enCuerpo(4 + i * 252 + 126, 106);

export const Escena3Registro: React.FC = () => {
  const E = "e3c" as const;
  const frame = useCurrentFrame();
  const b = (id: BeatId) => inicioBeat(E, id);
  const pest = b("e3c_pestanas"), ind = b("e3c_indicacion"), prim = b("e3c_primera"), dec = b("e3c_decision"), porque = b("e3c_porque");
  const l2ind = inicioLinea(E, "e3c_indicacion", 1), l2prim = inicioLinea(E, "e3c_primera", 1);
  const clicHierro = ind + 24, clicPropio = l2ind + 12, clicYa = l2prim + 40, clicDec = dec + 14, clicSeis = dec + 60;
  // Posiciones dentro del formulario (que empieza en el CUERPO en x = 20, y = 146 + 22).
  const F = (x: number, y: number) => enCuerpo(20 + x, 168 + y);
  const HIERRO = F(240 + 3 + 222 + 111, 64 + 21 + 26), PROPIO = F(13, 300 + 13), YA = F(310 + 20 + 100, 350 + 21 + 23), TAB_DEC = posPestanaReg(2);
  const puntos: PuntoCursor[] = [
    { f: pest + 10, x: 900, y: 500 },
    { f: pest + 40, x: posPestanaReg(1).x, y: posPestanaReg(1).y },
    { f: pest + 70, x: posPestanaReg(0).x, y: posPestanaReg(0).y },
    { f: clicHierro, x: HIERRO.x, y: HIERRO.y, clic: true },
    { f: clicPropio, x: PROPIO.x, y: PROPIO.y, clic: true },
    { f: clicYa, x: YA.x, y: YA.y, clic: true },
    { f: clicDec, x: TAB_DEC.x, y: TAB_DEC.y, clic: true },
    { f: clicSeis, x: F(40, 128 + 60 + 26).x, y: F(40, 128 + 60 + 26).y, clic: true },
  ];
  const tab = frame >= clicDec ? 2 : 0;
  const hierro = frame >= clicHierro;
  const propio = frame >= clicPropio;
  const pregunta = progreso(frame, l2prim, 12);
  const yaHoy = frame >= clicYa;
  const seis = frame >= clicSeis;
  return (
    <Pantallas escena={E} titulo={P.secciones.c}>
      <SimulatedScreen seccion="registro" entra={0} velo={progreso(frame, porque, 14) * 1.6} capa={<AnimatedCursor puntos={puntos} hasta={porque} />}>
        <div style={{ fontSize: 34, fontWeight: 700 }}>Registro</div>
        <div style={{ fontSize: 18, color: APP.muted, marginTop: 4 }}>Lo que indica el doctor: procedimientos, tratamientos, controles y sus decisiones.</div>
        <div style={{ position: "absolute", top: 80, left: 0, display: "flex", padding: 4, borderRadius: 999, backgroundColor: "#fff", border: `1px solid ${APP.line}` }}>
          {PESTANAS_REG.map((p, i) => (
            <div key={p.t} style={{ width: 252, height: 44, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 18, fontWeight: 600, backgroundColor: i === tab ? APP.accent : "transparent", color: i === tab ? "#fff" : APP.soft, boxShadow: frame >= pest + 20 && frame < ind && i !== tab ? "inset 0 0 0 2px rgba(140,29,24,0.35)" : "none" }}>
              <Icono n={p.i} t={19} />{p.t}
            </div>
          ))}
        </div>
        <div style={{ position: "absolute", top: 146, left: 0, width: 900, height: 510, boxSizing: "border-box", padding: "22px 20px", borderRadius: 14, backgroundColor: "#fff", border: `1px solid ${APP.line}` }}>
          {tab === 0 ? (
            <div style={{ position: "relative", height: "100%" }}>
              <div style={{ display: "flex", gap: 20 }}>
                <Campo e="DNI" v="43444555" w={220} mono />
                <Campo e="Paciente" v="Elena Castro Prueba" w={300} />
                <Campo e="Doctor" v="Dr. Elí Cabanillas" w={300} />
              </div>
              <div style={{ display: "flex", gap: 20, marginTop: 18, alignItems: "flex-end" }}>
                <Campo e="Fecha" v={HOY} w={220} mono />
                <div>
                  <div style={{ fontSize: 16, color: APP.muted, marginBottom: 5 }}>¿Qué indicó?</div>
                  <div style={{ display: "flex", padding: 3, borderRadius: 10, border: `1px solid ${APP.line2}` }}>
                    {["Procedimiento", "Hierro"].map((t, i) => (
                      <span key={t} style={{ width: 222, height: 40, borderRadius: 8, display: "grid", placeItems: "center", fontSize: 19, fontWeight: 600, backgroundColor: (i === 1) === hierro ? APP.accentSoft : "transparent", color: (i === 1) === hierro ? APP.accent : APP.soft }}>{t}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 20, marginTop: 18 }}>
                <Campo e={hierro ? "Tratamiento | marca" : "Procedimiento"} v={hierro ? "HIERRO CARBOXIMALTOSA | FERINJECT" : "SANGRÍA"} w={560} foco={entre(frame, clicHierro, l2ind)} />
                <Campo e="Sesiones" v={hierro ? "2" : "1"} w={140} mono foco={entre(frame, clicHierro + 10, l2ind)} />
              </div>
              <div style={{ position: "absolute", top: 300, left: 0, display: "flex", alignItems: "center", gap: 12, fontSize: 19, opacity: hierro ? 1 : 0.4 }}>
                <span style={{ width: 26, height: 26, boxSizing: "border-box", borderRadius: 6, border: `2px solid ${propio ? APP.accent : APP.line2}`, backgroundColor: propio ? APP.accent : "#fff", display: "grid", placeItems: "center" }}>{propio ? <Icono n="check" t={20} color="#fff" grosor={3} /> : null}</span>
                Hierro propio del paciente (lo trae él)
              </div>
              <div style={{ position: "absolute", top: 350, left: 0, display: "flex", gap: 20, alignItems: "flex-end" }}>
                <Campo e="Primera sesión" v={`${HOY} (hoy)`} w={310} mono foco={entre(frame, prim + 6, l2prim)} />
                <div style={{ display: "flex", gap: 10, opacity: pregunta, translate: `${(1 - pregunta) * 20}px 0px` }}>
                  {["Ya se aplicó hoy", "Se aplicará más tarde"].map((t, i) => (
                    <span key={t} style={{ display: "flex", alignItems: "center", gap: 10, height: 46, boxSizing: "border-box", padding: "0 16px", borderRadius: 10, border: `2px solid ${i === 0 && yaHoy ? APP.accent : APP.line2}`, backgroundColor: i === 0 && yaHoy ? APP.accentSoft : "#fff", fontSize: 18, fontWeight: 600, whiteSpace: "nowrap" }}>
                      <span style={{ width: 18, height: 18, borderRadius: 99, border: `2px solid ${i === 0 && yaHoy ? APP.accent : APP.line2}`, backgroundColor: i === 0 && yaHoy ? APP.accent : "#fff", boxShadow: "inset 0 0 0 3px #fff" }} />{t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", gap: 20 }}>
                <Campo e="DNI" v="40444555" w={220} mono />
                <Campo e="Paciente" v={PACIENTE.nombre} w={300} />
                <Campo e="Doctor" v="Dra. Alejandra La Torre" w={300} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 600, marginTop: 22, marginBottom: 10 }}>Decisión</div>
              {[["Alta", "Alta definitiva en la especialidad"], ["Alta 6 meses", "Vuelve para su control en 6 meses"], ["Alta 1 año", "Vuelve para su control en 1 año"], ["Nueva reevaluación", "El médico da la fecha de retorno"]].map(([t, s], i) => {
                const sel = seis && i === 1;
                return (
                  <div key={t} style={{ display: "flex", alignItems: "center", gap: 14, height: 52, boxSizing: "border-box", padding: "0 16px", marginBottom: 8, borderRadius: 10, border: `${sel ? 2 : 1}px solid ${sel ? APP.accent : APP.line}`, backgroundColor: sel ? APP.accentSoft : "#fff", fontSize: 19, ...aparece(frame, clicDec + 4 + i * 5) }}>
                    <span style={{ width: 20, height: 20, borderRadius: 99, border: `2px solid ${sel ? APP.accent : APP.line2}`, backgroundColor: sel ? APP.accent : "#fff", boxShadow: "inset 0 0 0 3px #fff" }} />
                    <b>{t}</b><span style={{ color: APP.muted, fontSize: 17 }}>{s}</span>
                  </div>
                );
              })}
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 18, color: APP.info, marginTop: 6, ...aparece(frame, clicSeis + 6) }}>
                <Icono n="calendario" t={22} />Volverá a «Por contactar» el 26/04/2027 para agendar su control.
              </div>
            </div>
          )}
        </div>
        <div style={{ position: "absolute", top: 146, left: 920, width: CUERPO.w - 920, height: 510, boxSizing: "border-box", padding: "18px 20px", borderRadius: 14, backgroundColor: "#fff", border: `1px solid ${APP.line}` }}>
          <div style={{ fontSize: 21, fontWeight: 700 }}>Registrados <span style={{ fontFamily: MONO, color: APP.muted }}>3</span></div>
          {[["Víctor Paredes Prueba", "Hierro · Ferinject × 3"], ["Rosa Díaz Prueba", "Sangría"], ["Jorge Vega Prueba", "Control + laboratorio"]].map(([n, d]) => (
            <div key={n} style={{ padding: "12px 0", borderBottom: `1px solid ${APP.line}` }}>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{n}</div>
              <div style={{ fontSize: 16, color: APP.muted }}>{d} · hoy</div>
            </div>
          ))}
        </div>
      </SimulatedScreen>
      {/* La regla de la primera sesión, en tres fechas, encima de «Registrados». */}
      {frame >= prim && frame < dec ? (
        <div style={{ position: "absolute", left: enEscena(CUERPO.x + 920, 0).x, top: enEscena(0, CUERPO.y + 146).y, width: CUERPO.w - 920, display: "flex", flexDirection: "column", gap: 12, ...aparece(frame, prim + 10, dec) }}>
          {([["Fecha pasada", "Queda hecha (sesión 1)", "bien"], ["Fecha futura", "Queda programada", "info"], ["Hoy", "Pregunta: ¿ya se aplicó?", "acento"]] as const).map(([k, v, t], i) => (
            <div key={k} style={{ ...aparece(frame, prim + 14 + i * 14), padding: "16px 20px", borderRadius: 14, backgroundColor: "#FFFFFF", border: `2px solid ${i === 2 ? APP.accent : APP.line}`, boxShadow: "0 14px 30px rgba(21,23,28,0.15)", fontFamily: UI }}>
              <Badge tono={t} t={18}>{k}</Badge>
              <div style={{ fontSize: 24, fontWeight: 600, marginTop: 8, color: APP.ink }}>{v}</div>
            </div>
          ))}
        </div>
      ) : null}
      <PanelPorQue desde={porque + 6} puntos={P.porque.c} />
    </Pantallas>
  );
};

/* ═════════════════ 3D · PACIENTES Y FICHA ═════════════════ */

export const Escena3Pacientes: React.FC = () => {
  const E = "e3d" as const;
  const frame = useCurrentFrame();
  const b = (id: BeatId) => inicioBeat(E, id);
  const ficha = b("e3d_ficha"), tel = b("e3d_telefono"), porque = b("e3d_porque");
  const l2t = inicioLinea(E, "e3d_telefono", 1);
  const clicBusq = ficha + 14, clicRes = ficha + 64;
  const clicAgregar = tel + 20, escribe = tel + 34, clicGuardar = tel + 122;
  const busq = escribiendo(frame, clicBusq + 4, "41234", 9);
  const abierta = frame >= clicRes;
  const form = frame >= clicAgregar && frame < clicGuardar + 4;
  const guardado = frame >= clicGuardar + 4;
  const numero = escribiendo(frame, escribe, "987 654 321", 12);
  const nota = escribiendo(frame, escribe + 34, "Hija de la paciente", 16);
  // Ficha: empieza en y = 76; el bloque de contacto en y = 76 + 50.
  const AGREGAR = enCuerpo(20 + 190 + 120, 126 + 14 + 24 + 22), GUARDAR = enCuerpo(20 + 230 + 14 + 300 + 14 + 50, 126 + 14 + 24 + 10 + 21 + 23), BUSQ = enCuerpo(420, 26), RES = enCuerpo(420, 92);
  const puntos: PuntoCursor[] = [
    { f: ficha + 2, x: 1000, y: 400 },
    { f: clicBusq, x: BUSQ.x, y: BUSQ.y, clic: true },
    { f: clicRes, x: RES.x, y: RES.y, clic: true },
    { f: clicAgregar, x: AGREGAR.x, y: AGREGAR.y, clic: true },
    { f: clicGuardar, x: GUARDAR.x, y: GUARDAR.y, clic: true },
    { f: clicGuardar + 40, x: GUARDAR.x + 200, y: GUARDAR.y + 120 },
  ];
  const seccion = (t: string, filas: readonly (readonly [string, string, string?])[], y: number) => (
    <div style={{ position: "absolute", left: 0, top: y, width: CUERPO.w, opacity: abierta ? progreso(frame, clicRes + 6, 12) : 0 }}>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>{t}</div>
      {filas.map(([a, c, e]) => (
        <div key={a + c} style={{ display: "flex", gap: 20, padding: "9px 14px", borderRadius: 9, backgroundColor: "#fff", border: `1px solid ${APP.line}`, marginBottom: 6, fontSize: 18 }}>
          <span style={{ fontFamily: MONO, width: 130, color: APP.soft }}>{a}</span><span style={{ flex: 1 }}>{c}</span>{e ? <Badge tono={e.startsWith("REAL") ? "bien" : "neutro"} t={15}>{e}</Badge> : null}
        </div>
      ))}
    </div>
  );
  return (
    <Pantallas escena={E} titulo={P.secciones.d}>
      <SimulatedScreen seccion="pacientes" entra={0} velo={progreso(frame, porque, 14) * 1.6} capa={
        <>
          <Toast texto="Teléfono agregado a Carmen Quispe Prueba" desde={clicGuardar + 6} hasta={porque} />
          <AnimatedCursor puntos={puntos} hasta={porque} />
        </>
      }>
        <div style={{ fontSize: 34, fontWeight: 700 }}>Pacientes</div>
        <div style={{ position: "absolute", top: 0, left: 220, width: 600, height: 52, boxSizing: "border-box", borderRadius: 12, border: `${frame >= clicBusq ? 2 : 1}px solid ${frame >= clicBusq ? APP.accent : APP.line}`, backgroundColor: "#fff", display: "flex", alignItems: "center", gap: 10, padding: "0 16px", fontSize: 19, color: busq ? APP.ink : APP.muted }}>
          <Icono n="buscar" t={20} color={APP.muted} />{busq || "DNI o nombre (mínimo 3 letras)"}
        </div>
        {frame >= clicBusq + 30 && !abierta ? (
          <div style={{ position: "absolute", top: 60, left: 220, width: 600, boxSizing: "border-box", borderRadius: 12, backgroundColor: "#fff", border: `1px solid ${APP.line}`, boxShadow: "0 16px 40px rgba(21,23,28,0.16)", padding: 8, ...aparece(frame, clicBusq + 30) }}>
            <div style={{ padding: "12px 14px", borderRadius: 8, backgroundColor: APP.accentSoft, fontSize: 19 }}><b>Carmen Quispe Prueba</b> <span style={{ fontFamily: MONO, color: APP.muted }}>41234521</span></div>
          </div>
        ) : null}
        <div style={{ position: "absolute", top: 76, left: 0, width: CUERPO.w, opacity: abierta ? progreso(frame, clicRes, 12) : 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, height: 36 }}>
            <span style={{ fontSize: 30, fontWeight: 700 }}>Carmen Quispe Prueba</span>
            <span style={{ fontSize: 18, color: APP.muted }}>DNI 41234521 · Hematología · Dr. Víctor Seminario</span>
          </div>
          <div style={{ marginTop: 14, padding: "14px 20px", borderRadius: 12, backgroundColor: "#fff", border: `1px solid ${APP.line}`, width: 1000, boxSizing: "border-box", minHeight: 100 }}>
            <div style={{ fontSize: 16, color: APP.muted, height: 24 }}>Contacto</div>
            {guardado ? (
              <div style={aparece(frame, clicGuardar + 4)}>
                <div style={{ fontFamily: MONO, fontSize: 22 }}>987 654 321</div>
                <div style={{ fontSize: 16, color: APP.muted }}>Agregado por Ana el 26/11 · Hija de la paciente</div>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 16, height: 44 }}>
                <span style={{ width: 174, fontSize: 20, color: APP.warn, display: "flex", alignItems: "center", gap: 8 }}><Icono n="telefonoNo" t={20} />Sin teléfono</span>
                {!form ? <Boton t={17} icono="mas" hover={entre(frame, clicAgregar - 10, clicAgregar + 4)} ancho={240}>Agregar teléfono</Boton> : null}
              </div>
            )}
            {form ? (
              <div style={{ display: "flex", gap: 14, alignItems: "flex-end", marginTop: 10, ...aparece(frame, clicAgregar + 2) }}>
                <Campo e="Teléfono" v={numero} w={230} mono foco={1} />
                <Campo e="Nota (opcional)" v={nota} w={300} />
                <Boton variante="primario" t={17} ancho={100} alto={46} hover={entre(frame, clicGuardar - 8, clicGuardar + 4)}>Guardar</Boton>
                <Boton variante="fantasma" t={17} alto={46}>Cancelar</Boton>
              </div>
            ) : null}
          </div>
        </div>
        {seccion("Citas", [["03/12/2026", "Hematología · Dr. Víctor Seminario", "AGENDADO"], ["03/09/2026", "Hematología · Dr. Víctor Seminario", "REALIZADO"]], form ? 340 : 290)}
        {seccion("Seguimientos", [["24/11/2026", "Sin contacto válido · Ana"], ["10/11/2026", "Reevaluación vencida desde el 03/10"]], form ? 480 : 430)}
      </SimulatedScreen>
      <CalloutBox x={1080} y={540} w={720} desde={l2t} hasta={porque} tono="bien" icono="deshacer" titulo="Se reabre sola" texto="La tarjeta cerrada por «Sin contacto válido» vuelve a «Por contactar» con «Nuevo contacto: 987 654 321»." t={25} />
      <PanelPorQue desde={porque + 6} puntos={P.porque.d} />
    </Pantallas>
  );
};

/* ═════════════════ 3E · ENFERMERÍA ═════════════════ */

export const Escena3Enfermeria: React.FC = () => {
  const E = "e3e" as const;
  const frame = useCurrentFrame();
  const b = (id: BeatId) => inicioBeat(E, id);
  const lista = b("e3e_lista"), contacto = b("e3e_contacto"), porque = b("e3e_porque");
  const l2lista = inicioLinea(E, "e3e_lista", 1), l2c = inicioLinea(E, "e3e_contacto", 1);
  const FILA_Y = (i: number) => (i === 0 ? 120 : 260 + (i - 1) * 96);
  const filaSofia = 2;
  const BTN_YA = enCuerpo(CUERPO.w - 400, FILA_Y(filaSofia) + 43);
  const CHIP_NO = enCuerpo(190, FILA_Y(filaSofia) + 108);
  const GUARDAR = enCuerpo(CUERPO.w - 70, FILA_Y(filaSofia) + 108);
  const clicYa = contacto + 18, clicNo = contacto + 50, clicGuardar = contacto + 80;
  const puntos: PuntoCursor[] = [
    { f: contacto, x: 1000, y: 560 },
    { f: clicYa, x: BTN_YA.x, y: BTN_YA.y, clic: true },
    { f: clicNo, x: CHIP_NO.x, y: CHIP_NO.y, clic: true },
    { f: clicGuardar, x: GUARDAR.x, y: GUARDAR.y, clic: true },
    { f: l2c + 10, x: enCuerpo(900, FILA_Y(0) + 40).x, y: enCuerpo(900, FILA_Y(0) + 40).y },
  ];
  const abierto = frame >= clicYa + 2 && frame < clicGuardar + 4;
  const hecho = frame >= clicGuardar + 4;
  return (
    <Pantallas escena={E} titulo={P.secciones.e}>
      <SimulatedScreen seccion="enfermeria" usuario="Liset" entra={0} velo={progreso(frame, porque, 14) * 1.6} capa={<AnimatedCursor puntos={puntos} desde={contacto} hasta={porque} />}>
        <div style={{ fontSize: 34, fontWeight: 700 }}>Enfermería</div>
        <div style={{ fontSize: 18, color: APP.muted, marginTop: 4 }}>Tras cada sesión de hierro: al día siguiente, a los 3 y a los 5 días. En orden de llamada.</div>
        <div style={{ position: "absolute", top: 86, left: 0, fontSize: 20, fontWeight: 700, ...aparece(frame, lista + 6) }}>Vencidos <span style={{ fontWeight: 400, fontSize: 16, color: APP.muted }}>el más antiguo primero</span></div>
        <div style={{ position: "absolute", top: 226, left: 0, fontSize: 20, fontWeight: 700, ...aparece(frame, l2lista) }}>Hoy</div>
        {ENFERMERIA_FILAS.map((f, i) => {
          const esSofia = i === filaSofia;
          const ap = f.dia === "Aplicación";
          const alto = esSofia && abierto ? 150 : 86;
          const empuje = i > filaSofia && abierto ? 64 : 0;
          return (
            <div key={f.paciente} style={{ position: "absolute", top: FILA_Y(i) + empuje, left: 0, width: CUERPO.w, height: alto, boxSizing: "border-box", padding: "12px 18px", borderRadius: 12, backgroundColor: "#fff", border: `1px solid ${esSofia && abierto ? APP.accent : APP.line}`, ...aparece(frame, (i < 1 ? lista + 10 : l2lista) + i * 8), boxShadow: i === 0 && frame >= l2c ? `0 0 0 ${4 * entre(frame, l2c, porque)}px rgba(152,91,0,0.35)` : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, height: 60 }}>
                <Badge tono={ap ? "acento" : i === 0 ? "aviso" : "info"} t={16} style={{ width: 108, justifyContent: "center" }}>{f.dia}</Badge>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 600 }}>{f.paciente}</div>
                  <div style={{ fontSize: 16, color: APP.muted }}>{f.texto} · Ferinject · <span style={{ fontFamily: MONO }}>{f.tel}</span>{f.estado ? <span style={{ color: APP.warn }}> · {f.estado}</span> : null}</div>
                </div>
                <span style={{ flex: 1 }} />
                {esSofia && hecho ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 18, color: APP.good, fontWeight: 600, ...aparece(frame, clicGuardar + 4) }}><Icono n="checkCirculo" t={22} />Contactado · sin reacción <span style={{ color: APP.accent, marginLeft: 8 }}>Deshacer</span></span>
                ) : (
                  <div style={{ display: "flex", gap: 10, width: 400, justifyContent: "flex-end" }}>
                    <Boton variante="primario" icono="check" t={17} hover={esSofia ? entre(frame, clicYa - 8, clicYa + 4) : 0}>{ap ? "Registrar" : "Ya me contacté"}</Boton>
                    {ap ? null : <Boton t={17} icono="telefonoNo">No contestó</Boton>}
                  </div>
                )}
              </div>
              {esSofia && abierto ? (
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, fontSize: 18, ...aparece(frame, clicYa + 2) }}>
                  <b style={{ width: 150 }}>¿Tuvo reacción?</b>
                  {["No", "Inmediata", "Mediata"].map((t, k) => (
                    <span key={t} style={{ padding: "8px 18px", borderRadius: 999, border: `2px solid ${k === 0 && frame >= clicNo ? APP.accent : APP.line2}`, backgroundColor: k === 0 && frame >= clicNo ? APP.accentSoft : "#fff", fontWeight: 600 }}>{t}</span>
                  ))}
                  <span style={{ flex: 1 }} />
                  <Boton variante="primario" t={17} hover={entre(frame, clicGuardar - 8, clicGuardar + 4)}>Guardar</Boton>
                </div>
              ) : null}
            </div>
          );
        })}
        <div style={{ position: "absolute", top: FILA_Y(3) + 104 + (abierto ? 64 : 0), left: 0, fontSize: 19, fontWeight: 600, color: APP.soft, ...aparece(frame, l2lista + 30) }}>▸ Próximos 7 días <span style={{ color: APP.muted, fontWeight: 400 }}>(5)</span></div>
      </SimulatedScreen>
      <CalloutBox x={1060} y={640} w={740} desde={l2lista + 20} hasta={contacto} tono="claro" icono="calendario" titulo="Se calculan solos" texto="La «Aplicación» (día 0) y los días 1, 3 y 5 tras cada sesión: ENFERMERIA_DIAS en REGLAS." t={25} />
      <CalloutBox x={900} y={630} w={900} desde={l2c + 6} hasta={porque} tono="aviso" icono="telefonoNo" titulo="2.º «No contestó» → «No respondió»" texto="Ese día de llamada se cierra y sale de la lista." t={25} />
      <PanelPorQue desde={porque + 6} puntos={P.porque.e} />
    </Pantallas>
  );
};

/* ═════════════════ 3F · INDICADORES ═════════════════ */

export const Escena3Indicadores: React.FC = () => {
  const E = "e3f" as const;
  const frame = useCurrentFrame();
  const b = (id: BeatId) => inicioBeat(E, id);
  const metas = b("e3f_metas"), desc = b("e3f_descarga"), porque = b("e3f_porque");
  const l2m = inicioLinea(E, "e3f_metas", 1);
  const [l2d, l3d] = [1, 2].map((n) => inicioLinea(E, "e3f_descarga", n));
  const BTN_DESC = enCuerpo(CUERPO.w - 290 - 12 - 230, 25), BTN_IMP = enCuerpo(CUERPO.w - 145, 25);
  const clicDesc = desc + 20;
  const abierto = frame >= clicDesc + 2;
  const BTN_EXCEL = enCuerpo(24 + 500 + 16 + 100, 70 + 330 + 24), BTN_COPIAR = enCuerpo(24 + 500 + 16 + 200 + 16 + 110, 70 + 330 + 24);
  const puntos: PuntoCursor[] = [
    { f: metas + 6, x: 900, y: 500 },
    { f: l2m + 10, x: BTN_IMP.x, y: BTN_IMP.y },
    { f: clicDesc, x: BTN_DESC.x, y: BTN_DESC.y, clic: true },
    { f: l2d - 10, x: BTN_EXCEL.x, y: BTN_EXCEL.y },
    { f: l2d + 30, x: BTN_COPIAR.x, y: BTN_COPIAR.y },
  ];
  const kpi = (x: number, t: string, v: number, meta: number, d: string, desde: number) => {
    const p = progreso(frame, desde, 30);
    const ok = v >= meta;
    return (
      <div style={{ position: "absolute", left: x, top: 150, width: 452, height: 300, boxSizing: "border-box", padding: "20px 24px", borderRadius: 14, backgroundColor: "#fff", border: `1px solid ${APP.line}`, ...aparece(frame, desde) }}>
        <div style={{ fontSize: 19, color: APP.muted }}>{t}</div>
        <div style={{ fontSize: 64, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{Math.round(v * p)} %</div>
        <div style={{ position: "relative", height: 14, borderRadius: 99, backgroundColor: APP.line, marginTop: 6 }}>
          <div style={{ width: `${v * p}%`, height: "100%", borderRadius: 99, backgroundColor: ok ? APP.good : APP.warn }} />
          <div style={{ position: "absolute", left: `${meta}%`, top: -6, width: 3, height: 26, backgroundColor: APP.ink }} />
        </div>
        <div style={{ fontSize: 18, marginTop: 14, color: ok ? APP.good : APP.warn, fontWeight: 600 }}>{ok ? `Meta cumplida: ${v} % (meta ${meta} %)` : `Cumplimiento: ${v} % · a ${meta - v} puntos de la meta (${meta} %)`}</div>
        <div style={{ fontSize: 16, color: APP.muted, marginTop: 6 }}>{d}</div>
      </div>
    );
  };
  return (
    <Pantallas escena={E} titulo={P.secciones.f}>
      <SimulatedScreen seccion="indicadores" entra={0} velo={progreso(frame, porque, 14) * 1.6} capa={<AnimatedCursor puntos={puntos} hasta={porque} />}>
        <div style={{ fontSize: 34, fontWeight: 700 }}>Indicadores</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6, fontSize: 19 }}><Icono n="caret" t={18} style={{ rotate: "90deg" }} />Noviembre 2026<Icono n="caret" t={18} style={{ rotate: "-90deg" }} /></div>
        <div style={{ position: "absolute", top: 0, right: 0, display: "flex", gap: 12 }}>
          <Boton icono="descarga" t={18} ancho={460} hover={entre(frame, clicDesc - 10, clicDesc + 6)} style={{ boxShadow: frame >= desc && frame < clicDesc ? "0 0 0 4px rgba(140,29,24,0.25)" : "none" }}>Descargar pacientes que no regresaron</Boton>
          <Boton variante="primario" icono="impresora" t={18} ancho={290} style={{ boxShadow: entre(frame, l2m, desc) ? "0 0 0 5px rgba(140,29,24,0.3)" : "none" }}>Resumen para imprimir</Boton>
        </div>
        <div style={{ position: "absolute", top: 92, left: 0, display: "flex", gap: 6, fontSize: 16, color: APP.soft }}>
          {["Resumen del mes", "¿Hasta dónde llegan?", "Campañas", "Procedimientos", "Recuperación", "Motivos de cierre", "Procedimientos sin paciente"].map((t, i) => (
            <span key={t} style={{ padding: "7px 12px", borderRadius: 999, backgroundColor: i === 0 ? APP.accent : "#fff", color: i === 0 ? "#fff" : APP.soft, border: `1px solid ${APP.line}` }}>{t}</span>
          ))}
        </div>
        {kpi(0, "Volvió a su reevaluación", INDICADORES.volvio, INDICADORES.meta, "Meta de retorno: META_RETORNO_PCT en REGLAS", metas + 10)}
        {kpi(472, "Tratamiento de hierro · cumplimiento", INDICADORES.hierro, INDICADORES.metaHierro, "Indicados, completaron, no siguieron, en curso", metas + 30)}
        {kpi(944, "Procedimientos · cumplimiento", INDICADORES.procedimientos, INDICADORES.metaHierro, "Realizados y no realizados", metas + 50)}
        <div style={{ position: "absolute", top: 470, left: 0, width: CUERPO.w, padding: "16px 22px", boxSizing: "border-box", borderRadius: 14, backgroundColor: "#fff", border: `1px solid ${APP.line}`, fontSize: 18, color: APP.soft, ...aparece(frame, metas + 60) }}>
          Contactos de enfermería a tiempo: 91 % · reacciones: 3 pacientes (inmediatas 1, mediatas 2) · cerrados este mes: 12 · 4 sin contacto
        </div>
        {abierto ? (
          <div style={{ position: "absolute", top: 70, left: 0, width: CUERPO.w, height: 560, boxSizing: "border-box", padding: "18px 24px", borderRadius: 14, backgroundColor: "#fff", border: `1px solid ${APP.line}`, boxShadow: "0 20px 50px rgba(21,23,28,0.16)", ...aparece(frame, clicDesc + 2) }}>
            <div style={{ fontSize: 24, fontWeight: 700 }}>Pacientes que no regresaron</div>
            <div style={{ fontSize: 17, color: APP.muted, marginTop: 4 }}>Vinieron, se atendieron y no volvieron a su reevaluación: vencidos, antiguos (tan atrasados que ya no salen en el tablero) y cerrados.</div>
            <div style={{ display: "flex", gap: 16, marginTop: 18 }}>
              <Campo e="Última consulta desde" v="01/06/2026" w={230} mono />
              <Campo e="Hasta" v={HOY} w={200} mono />
              <Campo e="Especialidad" v="Todas" w={220} />
              <Campo e="Médico" v="Todos" w={220} />
              <Campo e="Grupo" v="Dejó de venir" w={220} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 18, fontSize: 18 }}>
              <b>Estado</b>
              {["Vencido", "Antiguo", "Cerrado"].map((t) => (
                <span key={t} style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 22, height: 22, borderRadius: 5, backgroundColor: APP.accent, display: "grid", placeItems: "center" }}><Icono n="check" t={16} color="#fff" grosor={3} /></span>{t}</span>
              ))}
            </div>
            <div style={{ position: "absolute", top: 306, left: 24, right: 24, display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ fontSize: 20, fontWeight: 600, width: 500 }}>{INDICADORES.noRegresaron} pacientes con estos filtros</span>
              <Boton variante="primario" icono="descarga" t={18} ancho={200} hover={entre(frame, l2d - 14, l2d + 6)}>Descargar (Excel)</Boton>
              <Boton icono="copiar" t={18} ancho={220} hover={entre(frame, l2d + 24, l3d)}>Copiar para Excel</Boton>
            </div>
            <div style={{ position: "absolute", top: 390, left: 24, right: 24, display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderRadius: 10, backgroundColor: entre(frame, l3d, porque) ? APP.warnSoft : APP.surface2, border: `2px solid ${entre(frame, l3d, porque) ? APP.warn : "transparent"}`, fontSize: 19 }}>
              <Icono n="candado" t={22} color={APP.warn} />Contiene datos personales: compártalo solo dentro del equipo.
            </div>
            <div style={{ position: "absolute", top: 470, left: 24, fontSize: 16, color: APP.muted, fontFamily: MONO }}>no_regresaron_2026-11-26.csv · UTF-8 · separado por «;» · se abre en columnas en Excel</div>
          </div>
        ) : null}
      </SimulatedScreen>
      <PanelPorQue desde={porque + 6} puntos={P.porque.f} />
    </Pantallas>
  );
};

/* ═════════════════ 3G · ROLES Y AVISOS ═════════════════ */

export const Escena3Roles: React.FC = () => {
  const E = "e3g" as const;
  const frame = useCurrentFrame();
  const b = (id: BeatId) => inicioBeat(E, id);
  const quien = b("e3g_quien"), consulta = b("e3g_consulta");
  const l2 = inicioLinea(E, "e3g_consulta", 1);
  const abre = quien + 20, elige = quien + 70, abre2 = quien + 150, elige2 = consulta + 14;
  const grupos: readonly [string, readonly string[]][] = [["Admisión", USUARIOS_DEMO.admision], ["Enfermería", USUARIOS_DEMO.enfermeria], ["Solo consulta", USUARIOS_DEMO.consulta]];
  const filasMenu: { t: string; grupo?: boolean }[] = grupos.flatMap(([g, us]) => [{ t: g, grupo: true }, ...us.map((u) => ({ t: u }))]);
  const OPC_Y0 = POS_QUIEN.y - 30 - filasMenu.length * 42 - 20;
  const yOpcion = (t: string) => OPC_Y0 + 10 + filasMenu.findIndex((f) => f.t === t && !f.grupo) * 42 + 21;
  const puntos: PuntoCursor[] = [
    { f: quien + 4, x: 700, y: 300 },
    { f: abre, x: POS_QUIEN.x, y: POS_QUIEN.y, clic: true },
    { f: elige, x: 130, y: yOpcion("Liset"), clic: true },
    { f: abre2, x: POS_QUIEN.x, y: POS_QUIEN.y, clic: true },
    { f: elige2, x: 130, y: yOpcion("Administración"), clic: true },
    { f: elige2 + 40, x: 900, y: 420 },
  ];
  const menu1 = frame >= abre && frame < elige + 4, menu2 = frame >= abre2 && frame < elige2 + 4;
  const usuario = frame < elige ? "Ana" : frame < elige2 ? "Liset" : "Administración";
  const enfermera = usuario === "Liset";
  const consultaRol = usuario === "Administración";
  const nuevoDia = progreso(frame, l2, 14);
  const pulsaF5 = interpolate(frame, [l2 + 50, l2 + 54, l2 + 62], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <Pantallas escena={E} titulo={P.secciones.g}>
      <SimulatedScreen seccion={enfermera ? "enfermeria" : "tablero"} usuario={usuario} soloConsulta={consultaRol} entra={0} velo={nuevoDia}
        capa={
          <>
            {/* Con la enfermera, el menú muestra solo Pacientes y Enfermería (aplicarRol): se tapan las demás. */}
            {enfermera ? (["tablero", "registro", "indicadores"] as const).map((s) => (
              <div key={s} style={{ position: "absolute", left: 14, top: posMenu(s).y - 24, width: 236, height: 48, backgroundColor: APP.side, opacity: progreso(frame, elige, 10) }} />
            )) : null}
            {menu1 || menu2 ? (
              <div style={{ position: "absolute", left: 16, top: OPC_Y0, width: 300, padding: "10px 0", borderRadius: 10, backgroundColor: "#fff", boxShadow: "0 16px 40px rgba(21,23,28,0.25)", border: `1px solid ${APP.line}`, fontFamily: UI }}>
                {filasMenu.map((f) => (
                  <div key={f.t + (f.grupo ? "g" : "")} style={{ height: 42, display: "flex", alignItems: "center", padding: f.grupo ? "0 14px" : "0 28px", fontSize: f.grupo ? 15 : 19, fontWeight: f.grupo ? 700 : 400, color: f.grupo ? APP.muted : APP.ink, textTransform: f.grupo ? "uppercase" : "none", letterSpacing: f.grupo ? "0.06em" : 0, backgroundColor: !f.grupo && ((menu1 && f.t === "Liset" && frame > elige - 14) || (menu2 && f.t === "Administración" && frame > elige2 - 14)) ? APP.accentSoft : "transparent" }}>{f.t}</div>
                ))}
              </div>
            ) : null}
            <AnimatedCursor puntos={puntos} hasta={l2} />
            {nuevoDia > 0 ? (
              <div style={{ position: "absolute", left: VISTA.w / 2 - 340, top: 120, width: 680, boxSizing: "border-box", padding: "34px 40px", borderRadius: 18, backgroundColor: "#fff", boxShadow: "0 30px 80px rgba(21,23,28,0.35)", textAlign: "center", fontFamily: UI, opacity: nuevoDia, scale: String(0.94 + 0.06 * nuevoDia) }}>
                <Icono n="calendario" t={56} color={APP.accent} />
                <div style={{ fontSize: 34, fontWeight: 700, marginTop: 10 }}>Es un nuevo día</div>
                <div style={{ fontSize: 20, color: APP.soft, marginTop: 10, lineHeight: 1.45 }}>La página se abrió el 25/11/2026. Para no guardar nada con la fecha de ese día, recárguela antes de seguir.</div>
                <div style={{ fontSize: 20, color: APP.soft, marginTop: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>Presione <Tecla t={22} pulsada={pulsaF5}>F5</Tecla> o cierre y vuelva a abrir el enlace.</div>
              </div>
            ) : null}
          </>
        }>
        {enfermera ? (
          <>
            <div style={{ fontSize: 34, fontWeight: 700 }}>Enfermería</div>
            <div style={{ fontSize: 18, color: APP.muted, marginTop: 4 }}>Entra directo a su pantalla; la ficha del paciente, en solo lectura.</div>
          </>
        ) : (
          <div style={{ position: "absolute", top: consultaRol ? 56 : 0, left: 0, right: 0, bottom: 0 }}>
            <ContenidoTablero saludo={consultaRol ? "Buenos días, Administración" : "Buenos días, Ana"} sinMeta={consultaRol} />
          </div>
        )}
      </SimulatedScreen>
      <CalloutBox x={AREA.x + 380} y={560} w={760} desde={elige + 8} hasta={abre2} tono="info" icono="botiquin" titulo="La enfermera entra directo a Enfermería" texto="Cada rol ve sus pantallas: Admisión, Enfermería o solo consulta (CATALOGOS)." t={25} />
      <CalloutBox x={AREA.x + 380} y={560} w={760} desde={elige2 + 8} hasta={l2} tono="info" icono="ojo" titulo="Solo consulta" texto="Ve todas las pantallas, sin meta del día y sin botones para guardar." t={25} />
    </Pantallas>
  );
};
