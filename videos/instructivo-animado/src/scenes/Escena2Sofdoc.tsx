import type React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { AnimatedCursor, type PuntoCursor } from "../components/AnimatedCursor";
import { aparece, entre, progreso, resorte, tramos } from "../components/anim";
import { CalloutBox } from "../components/CalloutBox";
import { ConsequenceAlert } from "../components/ConsequenceAlert";
import { Escenario } from "../components/Escenario";
import { type Flecha, FlowDiagram, type Nodo } from "../components/FlowDiagram";
import { SectionTitle } from "../components/SectionTitle";
import { SimulatedScreen } from "../components/SimulatedScreen";
import { TarjetaTitulo } from "../components/TarjetaTitulo";
import { Badge } from "../components/ui/Badge";
import { Tecla } from "../components/ui/Boton";
import { Icono } from "../components/ui/Icono";
import { DialogoHoja, HG, posCelda, posMenuHoja, posOpcion, posPestana, TablaHoja } from "../components/ui/TablaHoja";
import { TarjetaPaciente } from "../components/ui/TarjetaPaciente";
import { AREA, CONTENIDO } from "../constants/areaSegura";
import { APP, CHP, FONDOS } from "../constants/colores";
import { HOJA1_ENCABEZADO, HOJA1_FILAS, HOY, MENSAJE_ACTUALIZAR, PACIENTE_SOFDOC, SOFDOC_AL_DIA, SOFDOC_ATRASADO, VERIFICAR_OK } from "../constants/datosDemo";
import { finBeat, inicioBeat } from "../constants/duraciones";
import { TEXTOS } from "../constants/guion";
import { inicioLinea } from "../constants/tiempos";
import { MONO, TITULAR, UI } from "../constants/tipografia";

const E = "e2" as const;
const T = TEXTOS.e2;
const b = (id: string) => inicioBeat(E, id);
const fb = (id: string) => finBeat(E, id);
const L = (id: Parameters<typeof inicioLinea>[1], n = 0) => inicioLinea(E, id, n);

/* ▸ VOZ: <Audio src={staticFile("voz/escena-e2.wav")} /> (ver components/Escenario.tsx). */

/* ─────────── Sin API: la plataforma no descarga nada sola ─────────── */
const SinApi: React.FC = () => {
  const ini = b("e2_sinApi");
  const l2 = L("e2_sinApi", 1);
  const W = 420, H = 150;
  const nodos: Nodo[] = [
    { id: "sofdoc", t: "SOFDOC", s: "Sistema de citas", x: AREA.x + 40, y: 220, w: W, h: H, desde: ini + 8, tono: "fuerte", icono: "calendario" },
    { id: "plataforma", t: "Plataforma", s: "Seguimientos CHP", x: AREA.x + AREA.w - W - 40, y: 220, w: W, h: H, desde: ini + 14, tono: "fuerte", icono: "tablero" },
    { id: "persona", t: "Una persona", s: "Exporta el reporte y lo pega", x: AREA.x + 40, y: 520, w: W, h: H, desde: l2, tono: "suave", icono: "usuario" },
    { id: "hoja1", t: "«Hoja 1»", s: "BD SOFDOC SEGUIMIENTOS", x: (1920 - W) / 2, y: 520, w: W, h: H, desde: l2 + 12, tono: "suave", icono: "hoja" },
    { id: "siete", t: "7:00", s: "Vuelve a procesar la «Hoja 1»", x: AREA.x + AREA.w - W - 40, y: 520, w: W, h: H, desde: l2 + 24, tono: "suave", icono: "reloj" },
  ];
  const flechas: Flecha[] = [
    { de: "sofdoc", a: "plataforma", desde: ini + 24, cortada: true, etiqueta: "Sin conexión (API)" },
    { de: "sofdoc", a: "persona", desde: l2 - 6 },
    { de: "persona", a: "hoja1", desde: l2 + 8, paquete: true },
    { de: "hoja1", a: "siete", desde: l2 + 20, paquete: true },
    { de: "siete", a: "plataforma", desde: l2 + 32 },
  ];
  return <FlowDiagram nodos={nodos} flechas={flechas} tamTitulo={44} />;
};

/* ─────────── La regla, con un reloj ─────────── */
const Reloj: React.FC<{ readonly minutos: number; readonly t: number }> = ({ minutos, t }) => {
  const h = (minutos / 60) % 12, m = minutos % 60;
  const ah = (h / 12) * 360, am = (m / 60) * 360;
  const mano = (ang: number, largo: number, ancho: number, color: string) => (
    <line x1={0} y1={0} x2={Math.sin((ang * Math.PI) / 180) * largo} y2={-Math.cos((ang * Math.PI) / 180) * largo} stroke={color} strokeWidth={ancho} strokeLinecap="round" />
  );
  return (
    <svg width={t} height={t} viewBox="-110 -110 220 220">
      <circle r={102} fill="#FFFFFF" stroke={CHP.granate} strokeWidth={8} />
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return <line key={i} x1={Math.sin(a) * 84} y1={-Math.cos(a) * 84} x2={Math.sin(a) * 94} y2={-Math.cos(a) * 94} stroke={CHP.tinta} strokeWidth={i % 3 === 0 ? 6 : 3} strokeLinecap="round" />;
      })}
      {mano(ah, 52, 9, CHP.tinta)}
      {mano(am, 78, 6, CHP.acento)}
      <circle r={8} fill={CHP.acento} />
    </svg>
  );
};

const Regla: React.FC = () => {
  const frame = useCurrentFrame();
  const ini = b("e2_regla");
  const [l1, l2, l3] = [0, 1, 2].map((n) => L("e2_regla", n));
  const minutos = tramos(frame, [ini, l3 - 10, l3 + 10], [6 * 60 + 10, 6 * 60 + 52, 7 * 60]);
  const latido = l3 + 10 <= frame ? 1 + 0.04 * Math.sin((frame - l3) / 4) * Math.max(0, 1 - (frame - l3 - 10) / 40) : 1;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: AREA.x + 30, top: 200, ...aparece(frame, ini + 4), scale: String(latido) }}>
        <Reloj minutos={minutos} t={360} />
      </div>
      <div style={{ position: "absolute", left: AREA.x + 470, top: 190, width: AREA.w - 470 }}>
        <div style={{ ...aparece(frame, l1), fontFamily: TITULAR, fontSize: 104, lineHeight: 0.98, color: CHP.granate, textTransform: "uppercase" }}>{T.regla}</div>
        <div style={{ ...aparece(frame, l1 + 14), fontFamily: UI, fontSize: 42, lineHeight: 1.3, color: CHP.tinta, marginTop: 22 }}>{T.reglaDetalle}</div>
        <div style={{ ...aparece(frame, l2 + 4), display: "flex", gap: 16, marginTop: 26, flexWrap: "wrap" }}>
          <Badge tono="neutro" icono="descarga" t={26}>Exportar de SOFDOC</Badge>
          <Badge tono="neutro" icono="hoja" t={26}>Pegar en «Hoja 1»</Badge>
          <Badge tono="bien" icono="reloj" t={26}>7:00 · se procesa sola</Badge>
        </div>
      </div>
      <div style={{ position: "absolute", left: AREA.x + 30, top: 640, width: AREA.w - 60, boxSizing: "border-box", padding: "22px 30px", borderRadius: 18, backgroundColor: APP.warnSoft, border: `2px solid ${APP.warn}`, display: "flex", alignItems: "center", gap: 18, fontFamily: UI, fontSize: 32, color: CHP.tinta, ...aparece(frame, l3) }}>
        <Icono n="reloj" t={40} color={APP.warn} />
        {T.reglaTarde}
      </div>
    </AbsoluteFill>
  );
};

/* ─────────── Por qué: solo vuelve quien SOFDOC marca REALIZADO ─────────── */
const PorQue: React.FC = () => {
  const frame = useCurrentFrame();
  const ini = b("e2_porque");
  const l2 = L("e2_porque", 1);
  const llega = ini + 40, mueve = ini + 80;
  const pFila = progreso(frame, llega - 24, 24);
  const pMueve = progreso(frame, mueve, 26);
  const col = (x: number, titulo: string, n: number) => (
    <div style={{ position: "absolute", left: x, top: 330, width: 760, height: 290, borderRadius: 20, backgroundColor: APP.col, padding: "18px 22px", boxSizing: "border-box", fontFamily: UI }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 28, fontWeight: 600, color: APP.ink }}>
        <span style={{ width: 34, height: 34, borderRadius: 99, backgroundColor: APP.accent, color: "#fff", fontSize: 19, display: "grid", placeItems: "center" }}>{n}</span>
        {titulo}
      </div>
    </div>
  );
  const tarjeta = {
    nombre: PACIENTE_SOFDOC.nombre, detalle: "Dra. La Torre · Hematología",
    etiqueta: pMueve > 0.5 ? `Volvió el ${PACIENTE_SOFDOC.cita.slice(0, 5)}` : "Debía volver el 10/11 · hace 16 días",
    chip: { t: "Reevaluación", tono: "info" as const }, contacto: pMueve > 0.5 ? undefined : "923 000 111",
  };
  const x0 = AREA.x + 40, x1 = AREA.x + AREA.w - 800;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: AREA.x, top: 170, width: AREA.w, ...aparece(frame, ini + 4), fontFamily: TITULAR, fontSize: 64, color: CHP.granate, textTransform: "uppercase" }}>{T.porqueTitulo}</div>
      {col(x0, "Por contactar", 1)}
      {col(x1, "Completado", 6)}
      {/* la fila de SOFDOC que llega con el export */}
      <div style={{ position: "absolute", left: interpolate(pFila, [0, 1], [-700, 700]), top: 245, opacity: pFila * (1 - progreso(frame, mueve + 30, 14)), display: "flex", alignItems: "center", gap: 14, padding: "12px 20px", borderRadius: 12, backgroundColor: "#FFFFFF", border: `2px solid ${APP.good}`, fontFamily: MONO, fontSize: 24, color: APP.ink, boxShadow: "0 12px 30px rgba(0,0,0,0.15)" }}>
        <Icono n="hoja" t={26} color={APP.good} />{PACIENTE_SOFDOC.idcita} · {PACIENTE_SOFDOC.dni} · <b style={{ color: APP.good }}>REALIZADO</b> · {PACIENTE_SOFDOC.cita}
      </div>
      <div style={{ position: "absolute", left: interpolate(pMueve, [0, 1], [x0 + 22, x1 + 22]), top: 400 + Math.sin(pMueve * Math.PI) * -40, scale: "1.4", transformOrigin: "0 0" }}>
        <TarjetaPaciente t={tarjeta} w={510} foco={entre(frame, mueve - 6, mueve + 40)} />
        {pMueve > 0.6 ? <Icono n="checkCirculo" t={46} color={APP.good} style={{ position: "absolute", right: -18, top: -18, backgroundColor: "#fff", borderRadius: 99, opacity: progreso(frame, mueve + 16, 10) }} /> : null}
      </div>
      <CalloutBox x={AREA.x + 120} y={660} w={AREA.w - 240} desde={l2} tono="aviso" icono="alerta" titulo="Sin el export de hoy, la tarjeta se queda en «Por contactar»" texto="…y alguien llamaría a una paciente que ya vino." />
    </AbsoluteFill>
  );
};

/* ─────────── Caso real ─────────── */
const CasoReal: React.FC = () => {
  const frame = useCurrentFrame();
  const ini = b("e2_casoReal");
  const l2 = L("e2_casoReal", 1);
  const n1 = Math.round(tramos(frame, [ini + 10, ini + 50], [0, 36]));
  const n2 = Math.round(tramos(frame, [ini + 30, ini + 80], [0, 183]));
  const tab = Math.round(tramos(frame, [l2 + 10, l2 + 60], [587, 409]));
  const anchoBarra = 1300;
  return (
    <AbsoluteFill style={{ background: FONDOS.noche, opacity: progreso(frame, ini - 6, 10) }}>
      <SectionTitle kicker="Escena 2 · SOFDOC" titulo={T.casoTitulo} oscuro ancho={900} />
      <div style={{ position: "absolute", left: AREA.x + 40, top: 200, display: "flex", gap: 60 }}>
        {[{ n: n1, t: T.caso[0].t }, { n: n2, t: T.caso[1].t }].map((c, i) => (
          <div key={i} style={{ width: 780, ...aparece(frame, ini + 6 + i * 18) }}>
            <div style={{ fontFamily: TITULAR, fontSize: 200, lineHeight: 0.9, color: i === 1 ? "#E39A8F" : "#FAF6F1", fontVariantNumeric: "tabular-nums" }}>{c.n}</div>
            <div style={{ fontFamily: UI, fontSize: 38, color: "#CDBDB9", marginTop: 8 }}>{c.t}</div>
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", left: AREA.x + 40, top: 560, ...aparece(frame, l2) }}>
        <div style={{ fontFamily: UI, fontSize: 32, color: "#FAF6F1", marginBottom: 14 }}>Tarjetas en el tablero al cargar SOFDOC</div>
        <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
          <div style={{ width: anchoBarra, height: 56, borderRadius: 12, backgroundColor: "rgba(250,246,241,0.12)", overflow: "hidden" }}>
            <div style={{ width: (anchoBarra * tab) / 587, height: "100%", backgroundColor: "#E39A8F" }} />
          </div>
          <div style={{ fontFamily: TITULAR, fontSize: 84, color: "#FAF6F1", fontVariantNumeric: "tabular-nums", width: 200 }}>{tab}</div>
        </div>
        <div style={{ fontFamily: UI, fontSize: 26, color: "#CDBDB9", marginTop: 10 }}>Al cargar, salieron del tablero las tarjetas de pacientes que ya habían vuelto.</div>
      </div>
    </AbsoluteFill>
  );
};

/* ─────────── Paso 1: exportar de SOFDOC ─────────── */
const VentanaSofdoc: React.FC = () => {
  const frame = useCurrentFrame();
  const ini = b("e2_paso1");
  const l2 = L("e2_paso1", 1);
  const clic = ini + 70;
  // Coordenadas dentro de la ventana.
  const puntos: PuntoCursor[] = [
    { f: ini + 10, x: 1100, y: 520 },
    { f: ini + 34, x: 640, y: 215 },
    { f: ini + 50, x: 640, y: 215 },
    { f: clic, x: 180, y: 300, clic: true },
    { f: clic + 40, x: 260, y: 380 },
  ];
  const descarga = progreso(frame, clic + 8, 14);
  const pulsado = frame >= clic - 3 && frame < clic + 5;
  return (
    // ▸ Esquema de SOFDOC: no es una captura y sus menús reales pueden verse distintos. Si se quiere la pantalla real,
    //   ponga aquí <Img src={staticFile("cap/sofdoc-export.png")} /> con una captura SIN datos de pacientes.
    <div style={{ position: "absolute", left: CONTENIDO.x + 160, top: CONTENIDO.y + 20, width: CONTENIDO.w - 320, height: 640, borderRadius: 18, overflow: "hidden", backgroundColor: "#FFFFFF", boxShadow: "0 30px 80px rgba(20,8,8,0.3)", fontFamily: UI, ...aparece(frame, ini + 2) }}>
      <div style={{ height: 64, backgroundColor: "#24476B", color: "#FFFFFF", display: "flex", alignItems: "center", padding: "0 28px", fontSize: 26, fontWeight: 600, gap: 14 }}>
        <Icono n="calendario" t={28} />SOFDOC · Reportes · Citas
        <span style={{ marginLeft: "auto", fontSize: 18, fontWeight: 400, opacity: 0.85 }}>Esquema: la pantalla real puede verse distinta</span>
      </div>
      <div style={{ padding: "32px 48px", display: "flex", flexDirection: "column", gap: 26 }}>
        <div style={{ fontSize: 30, fontWeight: 600, color: APP.ink }}>Reporte de citas</div>
        <div style={{ display: "flex", gap: 30 }}>
          {([["Desde", "01/11/2026", false], ["Hasta", `${HOY} (hoy)`, true]] as const).map(([k, v, foco]) => (
            <div key={k}>
              <div style={{ fontSize: 20, color: APP.muted, marginBottom: 8 }}>{k}</div>
              <div style={{ width: 380, height: 58, boxSizing: "border-box", borderRadius: 10, border: `2px solid ${foco && frame > ini + 40 ? APP.accent : APP.line2}`, display: "flex", alignItems: "center", padding: "0 18px", fontSize: 24, fontFamily: MONO, color: APP.ink, boxShadow: foco && frame > ini + 40 ? "0 0 0 5px rgba(140,29,24,0.15)" : "none" }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ height: 62, padding: "0 30px", borderRadius: 10, backgroundColor: pulsado ? "#1B3654" : "#24476B", color: "#FFFFFF", display: "flex", alignItems: "center", gap: 12, fontSize: 24, fontWeight: 600, scale: String(pulsado ? 0.96 : 1) }}>
            <Icono n="descarga" t={26} />Exportar a Excel
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, opacity: descarga, translate: `${(1 - descarga) * -20}px 0px`, fontSize: 22, color: APP.good, fontWeight: 600 }}>
            <Icono n="checkCirculo" t={28} />reporte_citas.xlsx descargado
          </div>
        </div>
      </div>
      <CalloutBox x={48} y={440} w={1000} desde={l2} tono="info" icono="info" titulo="Repetir fechas no duplica nada" texto="Cada cita se reconoce por su IDCITA: si ya estaba, se actualiza." t={24} />
      <AnimatedCursor puntos={puntos} />
    </div>
  );
};

/* ─────────── Pasos 2 a 5: la hoja de cálculo ─────────── */
const ANCHOS = [150, 170, 230, 250, 170, 200, 190, 240];
const PESTANAS = ["Hoja 1", "CITAS", "PACIENTES", "SEGUIMIENTOS", "REGLAS", "CATALOGOS"] as const;
const FILAS_NUEVAS = [HOJA1_ENCABEZADO, ...HOJA1_FILAS];
const FILAS_VIEJAS = [HOJA1_ENCABEZADO, ...HOJA1_FILAS.slice(0, 3).map((f) => f.map((c) => c.replace(/2[0-5]\/11/, "17/11")))];
const FILAS_CITAS = [["IDCITA", "DNI", "NOMBRE", "FECHA", "ESTADO", "ESPECIALIDAD", "MEDICO"], ...HOJA1_FILAS.map((f) => [f[0], f[4], f[3], f[2].slice(0, 10), f[1], f[5], f[6]])];

const Hoja: React.FC = () => {
  const frame = useCurrentFrame();
  const p23 = b("e2_paso23"), p4 = b("e2_paso4"), p5 = b("e2_paso5");
  const [l1, l2, l3] = [0, 1, 2].map((n) => L("e2_paso23", n));
  const clicPestana = l1 + 40;
  const ctrlA = l2 + 6, supr = l2 + 34, clicA1 = l3 + 6, pegar = l3 + 26;
  const tab0 = posPestana(PESTANAS, 0);
  const a1 = posCelda(ANCHOS, 1, 0);
  const seg = posMenuHoja("Seguimientos");
  const act = posOpcion("Actualizar"), ver = posOpcion("Verificar");
  const abre4 = p4 + 22, clic4 = p4 + 50, abre5 = p5 + 18, clic5 = p5 + 44;
  const puntos: PuntoCursor[] = [
    { f: p23 + 6, x: 900, y: 420 },
    { f: clicPestana, x: tab0.x, y: tab0.y, clic: true },
    { f: clicA1 - 20, x: 700, y: 400 },
    { f: clicA1, x: a1.x, y: a1.y, clic: true },
    { f: pegar + 30, x: a1.x + 60, y: a1.y + 60 },
    { f: abre4, x: seg.x, y: seg.y, clic: true },
    { f: clic4 - 10, x: act.x - 120, y: act.y },
    { f: clic4, x: act.x - 120, y: act.y, clic: true },
    { f: abre5, x: seg.x, y: seg.y, clic: true },
    { f: clic5 - 10, x: ver.x - 120, y: ver.y },
    { f: clic5, x: ver.x - 120, y: ver.y, clic: true },
  ];
  const activa = frame < clicPestana ? 1 : 0;
  const vacia = frame >= supr && frame < pegar;
  const filas = activa === 1 ? FILAS_CITAS : frame < supr ? FILAS_VIEJAS : vacia ? [] : FILAS_NUEVAS;
  const todo = frame >= ctrlA && frame < clicA1 ? 1 : 0;
  const menu4 = frame >= abre4 && frame < clic4 + 4 ? progreso(frame, abre4, 6) : 0;
  const menu5 = frame >= abre5 && frame < clic5 + 4 ? progreso(frame, abre5, 6) : 0;
  const teclas = (desde: number, hasta: number, ts: string[]) => {
    const o = entre(frame, desde, hasta);
    if (o <= 0) return null;
    const pul = interpolate(frame, [desde + 6, desde + 10, desde + 16], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return (
      <div style={{ position: "absolute", left: HG.w / 2 - 220, top: 250, width: 440, display: "flex", justifyContent: "center", gap: 16, alignItems: "center", opacity: o, scale: String(0.9 + 0.1 * o), padding: "24px 0", borderRadius: 24, backgroundColor: "rgba(21,23,28,0.86)" }}>
        {ts.map((t, i) => (
          <span key={t} style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {i > 0 ? <span style={{ color: "#FAF6F1", fontSize: 40, fontFamily: UI }}>+</span> : null}
            <Tecla t={46} oscura pulsada={pul}>{t}</Tecla>
          </span>
        ))}
      </div>
    );
  };
  return (
    <TablaHoja
      filas={filas}
      anchos={ANCHOS}
      pestanas={PESTANAS}
      activa={activa}
      seleccion={{ fila: 1, col: 0 }}
      formula={activa === 0 && !vacia ? "IDCITA" : activa === 1 ? "IDCITA" : ""}
      todo={todo}
      pegadoDesde={frame >= pegar && frame < p4 ? pegar : undefined}
      resaltadas={frame >= pegar + 10 && frame < p4 ? ANCHOS.slice(0, 7).map((_, c) => `1,${c}`) : []}
      menuAbierto={Math.max(menu4, menu5)}
      opcionHover={menu4 > 0 ? "Actualizar" : menu5 > 0 ? "Verificar" : undefined}
      entra={p23}
    >
      {teclas(ctrlA, supr - 2, ["Ctrl", "A"])}
      {teclas(supr, clicA1 - 4, ["Supr"])}
      {teclas(pegar - 10, pegar + 26, ["Ctrl", "V"])}
      <CalloutBox x={1040} y={330} w={620} desde={pegar + 12} hasta={p4} tono="claro" icono="check" titulo="Con la fila de títulos" texto="IDCITA, ESTADO DE CITA, FECHA DE ATENCION | HORA, PACIENTE, DNI DEL PACIENTE, ESPECIALIDAD MEDICA, MEDICO…" t={22} />
      <DialogoHoja desde={clic4 + 14} hasta={p5 + 10} titulo="Actualizar" lineas={MENSAJE_ACTUALIZAR.split(" · ")} />
      <DialogoHoja desde={clic5 + 14} titulo="Verificar" ancho={1080} lineas={VERIFICAR_OK.map((l, i) => (
        <span key={i} style={i === 0 ? { color: APP.good, fontWeight: 700, backgroundColor: APP.goodSoft, padding: "2px 8px", borderRadius: 6 } : undefined}>{l}</span>
      ))} />
      <AnimatedCursor puntos={puntos} />
    </TablaHoja>
  );
};

/* ─────────── Paso 6: el equipo presiona F5 ─────────── */
const PasoF5: React.FC = () => {
  const frame = useCurrentFrame();
  const ini = b("e2_paso6");
  const pulsa = ini + 30;
  const pul = interpolate(frame, [pulsa - 4, pulsa, pulsa + 8], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const carga = entre(frame, pulsa + 2, pulsa + 26);
  const nuevo = frame >= pulsa + 14;
  const cifras = nuevo ? [["Por contactar", "23"], ["Agendado", "6"], ["Completado", "8"]] : [["Por contactar", "41"], ["Agendado", "6"], ["Completado", "3"]];
  return (
    <>
      <SimulatedScreen seccion="tablero" usuario="Magaly" sofdoc={nuevo ? "al-dia" : "atrasado"} entra={ini}>
        <div style={{ opacity: 1 - carga * 0.8 }}>
          <div style={{ fontSize: 38, fontWeight: 700 }}>Buenos días, Magaly</div>
          <div style={{ fontSize: 21, color: APP.muted, marginTop: 6 }}>Jueves {HOY} · {cifras[0][1]} por contactar</div>
          <div style={{ marginTop: 36, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
            {cifras.map(([k, v]) => (
              <div key={k} style={{ padding: "22px 26px", borderRadius: 14, backgroundColor: "#fff", border: `1px solid ${APP.line}` }}>
                <div style={{ fontSize: 21, color: APP.muted }}>{k}</div>
                <div style={{ fontSize: 56, fontWeight: 700 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      </SimulatedScreen>
      <div style={{ position: "absolute", left: 1180, top: 560, opacity: progreso(frame, ini + 10, 10), scale: String(1 + 0.1 * pul) }}>
        <Tecla t={80} pulsada={pul}>F5</Tecla>
      </div>
      {carga > 0 ? (
        <div style={{ position: "absolute", left: 1080, top: 420, width: 60, height: 60, borderRadius: 99, border: `7px solid ${APP.line}`, borderTopColor: APP.accent, rotate: `${(frame - pulsa) * 18}deg`, opacity: carga }} />
      ) : null}
    </>
  );
};

/* ─────────── Señales de éxito y de falla ─────────── */
const Senales: React.FC = () => {
  const frame = useCurrentFrame();
  const [l1, l2] = [0, 1].map((n) => L("e2_senales", n));
  const W = (AREA.w - 40) / 2;
  const fila = (desde: number, contenido: React.ReactNode, i: number) => (
    <div key={i} style={{ ...aparece(frame, desde), padding: "16px 20px", borderRadius: 14, backgroundColor: "#FFFFFF", border: `1px solid ${APP.line}`, fontSize: 24, display: "flex", alignItems: "center", gap: 14, minHeight: 100, boxSizing: "border-box" }}>{contenido}</div>
  );
  return (
    <AbsoluteFill style={{ fontFamily: UI }}>
      {[{ t: T.exitoTitulo, c: APP.good, s: APP.goodSoft, d: l1 }, { t: T.fallaTitulo, c: APP.warn, s: APP.warnSoft, d: l2 }].map((k, i) => (
        <div key={k.t} style={{ position: "absolute", left: AREA.x + i * (W + 40), top: 190, width: W, boxSizing: "border-box", padding: 26, borderRadius: 24, backgroundColor: k.s, border: `3px solid ${k.c}`, ...aparece(frame, k.d - 4) }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontFamily: TITULAR, fontSize: 56, color: k.c, textTransform: "uppercase", marginBottom: 18 }}>
            <Icono n={i === 0 ? "checkCirculo" : "alerta"} t={50} />{k.t}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {i === 0
              ? [
                  fila(l1 + 8, <><Icono n="checkCirculo" t={30} color={APP.good} /><span style={{ fontFamily: MONO, fontSize: 21 }}>{VERIFICAR_OK[0]}</span></>, 0),
                  fila(l1 + 30, <><Icono n="tablero" t={30} color={APP.accent} /><span>Bajo el logo:<br /><span style={{ fontSize: 21, color: APP.muted }}>SOFDOC hasta el {SOFDOC_AL_DIA.hasta} · Cargado el {SOFDOC_AL_DIA.cargado}</span></span></>, 1),
                  fila(l1 + 52, <><Icono n="check" t={30} color={APP.good} /><span>Sin aviso amarillo en ninguna pantalla</span></>, 2),
                ]
              : [
                  fila(l2 + 4, <><Icono n="alerta" t={30} color={APP.warn} /><span style={{ fontSize: 21 }}><b>Aviso amarillo: «Los datos de SOFDOC llegan hasta el {SOFDOC_ATRASADO.hasta}»</b> (hace {SOFDOC_ATRASADO.dias} días)…</span></>, 0),
                  fila(l2 + 24, <><Icono n="alerta" t={30} color={APP.warn} /><span style={{ fontFamily: MONO, fontSize: 21 }}>⚠ SOFDOC: citas realizadas hasta el {SOFDOC_ATRASADO.hasta}, hace {SOFDOC_ATRASADO.dias} días…</span></>, 1),
                  fila(l2 + 44, <><Icono n="correo" t={30} color={APP.warn} /><span><b>SOFDOC atrasado en Seguimientos CHP</b><br /><span style={{ fontSize: 21, color: APP.muted }}>Correo de las 7:00, cada día que siga atrasado</span></span></>, 2),
                ]}
          </div>
        </div>
      ))}
    </AbsoluteFill>
  );
};

/* ─────────── Mensajes que conviene reconocer ─────────── */
const Mensajes: React.FC = () => {
  const frame = useCurrentFrame();
  const ds = [0, 1, 2].map((n) => L("e2_mensajes", n));
  return (
    <AbsoluteFill style={{ fontFamily: UI }}>
      {T.mensajes.map((m, i) => {
        const r = resorte(frame, ds[i], 150, 16);
        const no = i === 2;
        return (
          <div key={m.m} style={{ position: "absolute", left: AREA.x, top: 180 + i * 220, width: AREA.w, height: 196, boxSizing: "border-box", display: "flex", alignItems: "center", gap: 36, padding: "0 40px", borderRadius: 22, backgroundColor: "#FFFFFF", border: `2px solid ${no ? CHP.acento : APP.line}`, opacity: Math.min(1, r * 1.4), translate: `${(1 - r) * 60}px 0px` }}>
            <div style={{ width: 720, flex: "0 0 auto", fontFamily: MONO, fontSize: 30, color: no ? APP.muted : APP.ink, padding: "14px 20px", borderRadius: 12, backgroundColor: no ? APP.accentSoft : APP.surface2, textDecoration: no ? "line-through" : "none", lineHeight: 1.3, boxSizing: "border-box" }}>
              {no ? "Seguimientos → " : ""}{m.m}
            </div>
            <Icono n="flecha" t={44} color={CHP.acento} />
            <div style={{ fontSize: 32, lineHeight: 1.3, color: CHP.tinta }}>
              {no ? <Badge tono="acento" icono="cerrar" t={24} style={{ marginBottom: 10 }}>No usar</Badge> : null}
              <div>{m.s}</div>
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export const Escena2Sofdoc: React.FC = () => {
  const frame = useCurrentFrame();
  const en = (id: string, margen = 10) => frame >= b(id) - margen && frame < fb(id) + margen;
  const op = (id: string) => entre(frame, b(id) - 6, fb(id) + 6);
  const kicker = "Escena 2 · SOFDOC";
  const titulos: Record<string, string> = {
    e2_regla: "La regla",
    e2_porque: "Por qué importa",
    e2_consecuencia: "Si no se actualiza",
    e2_paso1: "Paso 1 de 6 · Exportar de SOFDOC",
    e2_paso23: frame < L("e2_paso23", 1) ? "Paso 2 de 6 · Abrir la «Hoja 1»" : "Paso 3 de 6 · Vaciar y pegar en A1",
    e2_paso4: "Paso 4 de 6 · Actualizar",
    e2_paso5: "Paso 5 de 6 · Verificar",
    e2_paso6: "Paso 6 de 6 · F5",
    e2_senales: "¿Salió bien?",
    e2_mensajes: "Mensajes que conviene reconocer",
  };
  const actual = Object.keys(titulos).find((id) => frame >= b(id) && frame < fb(id));
  return (
    <Escenario escena={E} fondo="hueso">
      {en("e2_titulo") ? <TarjetaTitulo kicker={T.kicker} titulo={T.titulo} bajada={T.bajada} hasta={fb("e2_titulo") + 10} /> : null}
      {en("e2_sinApi") ? (
        <AbsoluteFill style={{ background: FONDOS.noche, opacity: op("e2_sinApi") }}>
          <SectionTitle kicker={kicker} titulo="La plataforma no descarga sola" oscuro />
          <SinApi />
        </AbsoluteFill>
      ) : null}
      {actual ? <SectionTitle kicker={kicker} titulo={titulos[actual]} ancho={1000} /> : null}
      {en("e2_regla") ? <AbsoluteFill style={{ opacity: op("e2_regla") }}><Regla /></AbsoluteFill> : null}
      {en("e2_porque") ? <AbsoluteFill style={{ opacity: op("e2_porque") }}><PorQue /></AbsoluteFill> : null}
      {en("e2_consecuencia") ? (
        <AbsoluteFill style={{ opacity: op("e2_consecuencia") }}>
          <ConsequenceAlert titulo={T.alertaTitulo} items={T.alerta} desde={b("e2_consecuencia") + 6} cadencia={Math.round((fb("e2_consecuencia") - b("e2_consecuencia") - 90) / 5)} x={AREA.x + 260} y={170} w={AREA.w - 520} />
        </AbsoluteFill>
      ) : null}
      {en("e2_casoReal") ? <AbsoluteFill style={{ opacity: op("e2_casoReal") }}><CasoReal /></AbsoluteFill> : null}
      {en("e2_paso1") ? <AbsoluteFill style={{ opacity: op("e2_paso1") }}><VentanaSofdoc /></AbsoluteFill> : null}
      {frame >= b("e2_paso23") - 10 && frame < fb("e2_paso5") + 10 ? (
        <AbsoluteFill style={{ opacity: entre(frame, b("e2_paso23") - 6, fb("e2_paso5") + 6) }}><Hoja /></AbsoluteFill>
      ) : null}
      {en("e2_paso6") ? <AbsoluteFill style={{ opacity: op("e2_paso6") }}><PasoF5 /></AbsoluteFill> : null}
      {en("e2_senales") ? <AbsoluteFill style={{ opacity: op("e2_senales") }}><Senales /></AbsoluteFill> : null}
      {en("e2_mensajes") ? <AbsoluteFill style={{ opacity: op("e2_mensajes") }}><Mensajes /></AbsoluteFill> : null}
    </Escenario>
  );
};
