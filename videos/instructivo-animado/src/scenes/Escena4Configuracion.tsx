import type React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { AnimatedCursor, type PuntoCursor } from "../components/AnimatedCursor";
import { aparece, entre, progreso } from "../components/anim";
import { CalloutBox } from "../components/CalloutBox";
import { Escenario } from "../components/Escenario";
import { SectionTitle } from "../components/SectionTitle";
import { TarjetaTitulo } from "../components/TarjetaTitulo";
import { Tecla } from "../components/ui/Boton";
import { Icono } from "../components/ui/Icono";
import { OPCIONES_SEGUIMIENTOS, posCelda, posOpcion, TablaHoja } from "../components/ui/TablaHoja";
import { AREA } from "../constants/areaSegura";
import { APP, CHP, FONDOS } from "../constants/colores";
import { CATALOGOS_COLUMNAS, CATALOGOS_FILAS, REGLAS_PARAMETROS, REGLAS_PLAZOS } from "../constants/datosDemo";
import { finBeat, inicioBeat } from "../constants/duraciones";
import { type BeatId, TEXTOS } from "../constants/guion";
import { inicioLinea } from "../constants/tiempos";
import { MONO, TITULAR, UI } from "../constants/tipografia";

/*
 * ESCENA 4 · CONFIGURACIÓN — no hay pantalla de configuración en la app: todo vive en el libro BD SOFDOC SEGUIMIENTOS
 * (hojas REGLAS y CATALOGOS, y el menú «Seguimientos» de src/Menu.gs). Valores de REGLAS: los de la plataforma por omisión.
 *
 * ▸ VOZ: <Audio src={staticFile("voz/escena-e4.wav")} /> (ver components/Escenario.tsx).
 * ▸ CAPTURA REAL: para mostrar el Sheets de verdad, ponga una <Img src={staticFile("cap/reglas.png")} /> en lugar de
 *   <TablaHoja> (sin correos ni nombres reales a la vista).
 */

const E = "e4" as const;
const T = TEXTOS.e4;
const b = (id: BeatId) => inicioBeat(E, id);
const fb = (id: BeatId) => finBeat(E, id);
const PESTANAS = ["Hoja 1", "CITAS", "PACIENTES", "SEGUIMIENTOS", "REGLAS", "CATALOGOS"] as const;

const ANCHOS_REGLAS = [200, 170, 140, 30, 360, 330];
const FILA_META = 1 + REGLAS_PARAMETROS.findIndex(([k]) => k === "META_DIARIA_SEGUIMIENTOS") + 1;

const LEYENDA = [
  ["ESPERA_COTIZACION_DIAS", "días antes de llamar a un cotizado"],
  ["MAX_SEGUIMIENTOS", "«No contestó» seguidos que cierran"],
  ["GRACIA_AGENDA_DIAS", "días tras la cita antes de «No vino»"],
  ["CORTE_BANDEJA_DIAS", "más atrasado, ya no sale en el tablero"],
  ["DIAS_POST_TRATAMIENTO", "días hasta «Por reevaluar»"],
] as const;

/** Hoja REGLAS: plazos por especialidad (A–C) y parámetros (E–F); se edita la meta diaria. */
const HojaReglas: React.FC = () => {
  const frame = useCurrentFrame();
  const ini = b("e4_reglas"), editar = b("e4_editar");
  const l2 = inicioLinea(E, "e4_reglas", 1);
  const celda = posCelda(ANCHOS_REGLAS, FILA_META, 5);
  const clic = editar + 24, escribe = editar + 40, enter = editar + 70;
  const valor = frame < escribe ? "15" : frame < enter ? "20".slice(0, Math.min(2, Math.floor((frame - escribe) / 6) + 1)) : "20";
  const filas: string[][] = [["ESPECIALIDAD", "ESPERADO_DIAS", "VENCE_DIAS", "", "PARAMETRO", "VALOR"]];
  REGLAS_PARAMETROS.forEach(([k, v], i) => {
    const plazo = REGLAS_PLAZOS[i];
    filas.push([plazo?.[0] ?? "", plazo?.[1] ?? "", plazo?.[2] ?? "", "", k, k === "META_DIARIA_SEGUIMIENTOS" ? valor : v]);
  });
  const puntos: PuntoCursor[] = [
    { f: editar, x: 1000, y: 500 },
    { f: clic, x: celda.x - 40, y: celda.y, clic: true },
    { f: enter + 30, x: celda.x + 60, y: celda.y + 60 },
  ];
  const resaltadas = frame >= l2 && frame < editar ? ["1,0", "1,1", "1,2", "2,0", "2,1", "2,2", "3,0", "3,1", "3,2"] : [];
  const flash = entre(frame, enter, enter + 30);
  return (
    <TablaHoja filas={filas} anchos={ANCHOS_REGLAS} pestanas={PESTANAS} activa={4} entra={ini}
      seleccion={frame >= clic ? { fila: FILA_META, col: 5 } : { fila: 1, col: 4 }}
      formula={frame >= clic ? valor : "PARAMETRO"}
      resaltadas={resaltadas}
      estilosCelda={(f, c) => (f === FILA_META && c === 5 && flash > 0 ? { backgroundColor: `rgba(30,122,76,${0.25 * flash})`, fontWeight: 700 } : f === 1 ? { backgroundColor: "#F1F3F4" } : undefined)}>
      <div style={{ position: "absolute", left: 1300, top: 196, width: 400, display: "flex", flexDirection: "column", gap: 10, fontFamily: UI }}>
        {LEYENDA.map(([k, v], i) => (
          <div key={k} style={{ ...aparece(frame, ini + 20 + i * 14, editar), padding: "10px 14px", borderRadius: 12, backgroundColor: APP.surface2, border: `1px solid ${APP.line}` }}>
            <div style={{ fontFamily: MONO, fontSize: 16, color: CHP.acento, fontWeight: 700 }}>{k}</div>
            <div style={{ fontSize: 19, color: APP.ink }}>{v}</div>
          </div>
        ))}
      </div>
      <CalloutBox x={1240} y={300} w={450} desde={enter + 6} tono="bien" icono="checkCirculo" titulo="Sin publicar nada" texto="La app usa el valor nuevo cuando el equipo presiona F5." t={24} />
      <AnimatedCursor puntos={puntos} desde={editar - 6} />
    </TablaHoja>
  );
};

/** Hoja CATALOGOS: listas por columna; cuidados con los nombres y los encabezados. */
const HojaCatalogos: React.FC = () => {
  const frame = useCurrentFrame();
  const ini = b("e4_catalogos"), cuid = b("e4_cuidados");
  const l2c = inicioLinea(E, "e4_cuidados", 1);
  const anchos = [190, 270, 260, 260, 250, 270, 170];
  const filas = [CATALOGOS_COLUMNAS, ...CATALOGOS_FILAS];
  const col = Math.min(6, Math.max(0, Math.floor((frame - ini - 10) / 12)));
  const resaltadas = frame < cuid ? [`1,${col}`] : frame < l2c ? ["5,0", "2,1"] : anchos.map((_, c) => `1,${c}`);
  const a = posCelda(anchos, 5, 0), bb = posCelda(anchos, 2, 1);
  return (
    <TablaHoja filas={filas} anchos={anchos} pestanas={PESTANAS} activa={5} entra={ini - 6} resaltadas={resaltadas} seleccion={{ fila: 1, col: frame < cuid ? col : 0 }} formula={frame < cuid ? CATALOGOS_COLUMNAS[col] : "USUARIOS"}>
      {frame >= cuid && frame < l2c ? (
        <svg width={1728} height={700} style={{ position: "absolute", left: 0, top: 0, opacity: progreso(frame, cuid + 8, 10) }}>
          <path d={`M${a.x + 60},${a.y} C${a.x + 260},${a.y} ${bb.x - 200},${bb.y} ${bb.x - 60},${bb.y}`} fill="none" stroke={CHP.acento} strokeWidth={4} strokeDasharray="10 8" />
          <text x={(a.x + bb.x) / 2 + 40} y={(a.y + bb.y) / 2 + 8} fontFamily={UI} fontSize={30} fontWeight={700} fill={CHP.acento}>=</text>
        </svg>
      ) : null}
      <CalloutBox x={720} y={330} w={900} desde={cuid + 10} hasta={l2c} tono="aviso" icono="usuario" titulo="Escrito igual en las dos columnas" texto="El nombre de USUARIOS_ENFERMERIA debe ser idéntico al de USUARIOS (LISET = LISET)." t={25} />
      <CalloutBox x={720} y={330} w={900} desde={l2c} tono="aviso" icono="alerta" titulo="No borre columnas ni renombre encabezados" texto="La plataforma lee cada hoja por el nombre de su columna. Para agregar lo que falte, «Preparar hojas»." t={25} />
    </TablaHoja>
  );
};

const DESCRIPCION_MENU: Record<string, string> = {
  Actualizar: "Procesa la «Hoja 1» (a las 7:00 corre solo)",
  Verificar: "Revisa las hojas y hasta cuándo llega SOFDOC",
  "Activar actualización diaria (7:00)": "Programa el proceso de cada mañana",
  "Probar el correo de SOFDOC atrasado": "Envía la alerta de prueba",
  "Importar lo que falta de la base de hierro": "No usar: importación única, ya hecha",
  "Preparar hojas": "Agrega hojas, columnas y parámetros nuevos",
};

const HojaMenu: React.FC = () => {
  const frame = useCurrentFrame();
  const ini = b("e4_menu"), fin = fb("e4_menu");
  const opciones = OPCIONES_SEGUIMIENTOS.filter((o): o is string => o !== null);
  const paso = Math.max(1, Math.floor((fin - ini - 40) / opciones.length));
  const i = Math.min(opciones.length - 1, Math.max(0, Math.floor((frame - ini - 24) / paso)));
  const hover = frame >= ini + 24 ? opciones[i] : undefined;
  const puntos: PuntoCursor[] = opciones.map((o, k) => ({ f: ini + 24 + k * paso, x: posOpcion(o).x - 150, y: posOpcion(o).y }));
  return (
    <TablaHoja filas={[CATALOGOS_COLUMNAS, ...CATALOGOS_FILAS]} anchos={[190, 270, 260, 260, 250, 270, 170]} pestanas={PESTANAS} activa={5} entra={ini - 6}
      menuAbierto={progreso(frame, ini + 6, 8)} opcionHover={hover} opcionTachada="Importar lo que falta de la base de hierro">
      {/* Qué hace cada opción: a la izquierda del desplegable, en un panel propio para no mezclarse con las celdas. */}
      <div style={{ position: "absolute", left: 40, top: posOpcion(opciones[0]).y - 34, width: posOpcion(opciones[0]).x - 235 - 60, boxSizing: "border-box", padding: "12px 0", borderRadius: 14, backgroundColor: "#FFFFFF", boxShadow: "0 16px 40px rgba(21,23,28,0.18)", border: `1px solid ${APP.line}`, height: posOpcion(opciones[opciones.length - 1]).y - posOpcion(opciones[0]).y + 68, opacity: progreso(frame, ini + 10, 10) }} />
      {opciones.map((o, k) => {
        const p = posOpcion(o);
        const activo = hover === o;
        const no = o.startsWith("Importar");
        return (
          <div key={o} style={{ position: "absolute", left: 52, width: p.x - 235 - 84, top: p.y - 20, height: 40, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, padding: "0 16px", borderRadius: 10, fontFamily: UI, fontSize: 21, whiteSpace: "nowrap", backgroundColor: activo ? (no ? APP.accentSoft : CHP.granate) : "transparent", color: activo ? (no ? CHP.acento : "#FFFFFF") : APP.soft, opacity: frame >= ini + 24 + k * paso - 4 ? 1 : 0.35 }}>
            {no ? <Icono n="cerrar" t={20} /> : null}{DESCRIPCION_MENU[o]}<Icono n="flecha" t={20} />
          </div>
        );
      })}
      <AnimatedCursor puntos={puntos} />
    </TablaHoja>
  );
};

const Publicar: React.FC = () => {
  const frame = useCurrentFrame();
  const ini = b("e4_publicar");
  const l2 = inicioLinea(E, "e4_publicar", 1);
  const linea = (desde: number, t: string, c: string) => (
    <div style={{ ...aparece(frame, desde), fontFamily: MONO, fontSize: 34, color: c, padding: "6px 0" }}>{t}</div>
  );
  const pulsa = interpolate(frame, [ini + 30, ini + 34, ini + 42], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: FONDOS.noche, opacity: progreso(frame, ini - 6, 10) }}>
      <SectionTitle kicker="Escena 4 · Configuración" titulo="Después de cambiar · publicar" oscuro />
      <div style={{ position: "absolute", left: AREA.x, top: 190, width: 520, ...aparece(frame, ini + 8) }}>
        <div style={{ fontFamily: TITULAR, fontSize: 52, color: "#FAF6F1", textTransform: "uppercase", lineHeight: 1 }}>Tras un cambio en el Sheets</div>
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 24, fontFamily: UI, fontSize: 30, color: "#CDBDB9" }}>
          <Tecla t={48} oscura pulsada={pulsa}>F5</Tecla> el equipo recarga
        </div>
      </div>
      <div style={{ position: "absolute", left: AREA.x + 600, top: 180, width: AREA.w - 600, boxSizing: "border-box", padding: "28px 34px", borderRadius: 20, backgroundColor: "#0E0A0B", border: "1px solid rgba(250,246,241,0.18)", ...aparece(frame, ini + 14) }}>
        <div style={{ fontFamily: UI, fontSize: 22, color: "#CDBDB9", marginBottom: 10 }}>Para publicar código (líder del proyecto)</div>
        {linea(ini + 30, "$ git pull", "#FAF6F1")}
        {linea(ini + 50, "$ npm run actualizar", "#FAF6F1")}
        {linea(ini + 70, "# con hojas nuevas: Seguimientos → «Preparar hojas»", "#8FD4AE")}
      </div>
      <div style={{ position: "absolute", left: AREA.x + 600, top: 520, width: AREA.w - 600, boxSizing: "border-box", padding: "24px 34px", borderRadius: 20, backgroundColor: "rgba(140,29,24,0.35)", border: "2px solid #E39A8F", ...aparece(frame, l2) }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: TITULAR, fontSize: 44, color: "#FAF6F1", textTransform: "uppercase" }}><Icono n="cerrar" t={40} grosor={3} />Nunca</div>
        <div style={{ display: "flex", gap: 30, marginTop: 10 }}>
          {T.nunca.map((n) => <span key={n} style={{ fontFamily: MONO, fontSize: 32, color: "#FAF6F1", textDecoration: "line-through", textDecorationColor: "#E39A8F", textDecorationThickness: 3 }}>{n}</span>)}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const Escena4Configuracion: React.FC = () => {
  const frame = useCurrentFrame();
  const en = (a: BeatId, z: BeatId) => frame >= b(a) - 10 && frame < fb(z) + 10;
  const op = (a: BeatId, z: BeatId) => entre(frame, b(a) - 6, fb(z) + 6);
  const titulo = frame < b("e4_catalogos") ? "Hoja REGLAS" : frame < b("e4_menu") ? "Hoja CATALOGOS" : "Menú Seguimientos";
  return (
    <Escenario escena={E} fondo="hueso">
      {en("e4_sinPantalla", "e4_sinPantalla") ? <TarjetaTitulo kicker={T.kicker} titulo={T.titulo} bajada={T.bajada} hasta={fb("e4_sinPantalla") + 10} /> : null}
      {frame >= b("e4_reglas") && frame < b("e4_publicar") ? <SectionTitle kicker={`Escena 4 · ${T.libro}`} titulo={titulo} /> : null}
      {en("e4_reglas", "e4_editar") ? <AbsoluteFill style={{ opacity: op("e4_reglas", "e4_editar") }}><HojaReglas /></AbsoluteFill> : null}
      {en("e4_catalogos", "e4_cuidados") ? <AbsoluteFill style={{ opacity: op("e4_catalogos", "e4_cuidados") }}><HojaCatalogos /></AbsoluteFill> : null}
      {en("e4_menu", "e4_menu") ? <AbsoluteFill style={{ opacity: op("e4_menu", "e4_menu") }}><HojaMenu /></AbsoluteFill> : null}
      {en("e4_publicar", "e4_publicar") ? <Publicar /> : null}
    </Escenario>
  );
};
