/**
 * GUION DEL INSTRUCTIVO ANIMADO — toda la narración y todos los textos en pantalla.
 *
 * - Cada «beat» es un tramo de narración con su público. Su duración NO está aquí: vive en `duraciones.ts`,
 *   con la misma clave. `tiempos.ts` reparte cada beat entre sus líneas según el número de palabras.
 * - Cada línea es un subtítulo: como máximo dos renglones en pantalla (≈ 110 caracteres).
 * - La voz en off lee exactamente estas líneas (ver ../voz.py y el LEEME.md de este proyecto).
 * - Ningún dato real de pacientes: los nombres, DNI y teléfonos de `datosDemo.ts` son inventados.
 *
 * Registro: español del Perú, de «usted».
 */

export type Audiencia = "enfermeria" | "asesoras" | "lider";
/** Solo en la escena 3: la capa de uso diario o la explicación del diseño para el líder del proyecto. */
export type Capa = "uso" | "porque";

export type Beat = {
  readonly audiencia: readonly Audiencia[];
  readonly capa?: Capa;
  readonly lineas: readonly string[];
};

export const NOMBRE_AUDIENCIA: Record<Audiencia, string> = {
  enfermeria: "Enfermería",
  asesoras: "Asesoras · Admisión",
  lider: "Líder del proyecto",
};

export const NOMBRE_CAPA: Record<Capa, string> = {
  uso: "Uso diario",
  porque: "Por qué se diseñó así",
};

const TODOS: readonly Audiencia[] = ["enfermeria", "asesoras", "lider"];
const ADM: readonly Audiencia[] = ["asesoras", "lider"];
const LIDER: readonly Audiencia[] = ["lider"];

export const GUION = {
  /* ───────────────────────── ESCENA 1 · INTRODUCCIÓN ───────────────────────── */
  e1_portada: {
    audiencia: TODOS,
    lineas: [
      "Este es el instructivo de Seguimientos CHP.",
      "La plataforma del Centro Hematológico del Perú para no perder pacientes.",
    ],
  },
  e1_proposito: {
    audiencia: TODOS,
    lineas: [
      "Su objetivo es simple: que ningún paciente se quede sin volver.",
      "Reevaluaciones, hierro, procedimientos, controles y el seguimiento de enfermería.",
    ],
  },
  e1_quienes: {
    audiencia: TODOS,
    lineas: [
      "La usan Admisión y Enfermería. Administración y Marketing entran solo a consultar.",
      "El médico no la usa: comunica sus decisiones y Admisión las registra.",
    ],
  },
  e1_flujo: {
    audiencia: TODOS,
    lineas: [
      "Las citas salen de SOFDOC, se exportan a Excel y se pegan en la «Hoja 1».",
      "«Actualizar» arma las citas y los pacientes, y el Tablero dice a quién llamar.",
      "Cada llamada se registra en «¿Qué pasó?».",
      "El ciclo se cierra cuando SOFDOC muestra la cita del paciente como REALIZADO.",
    ],
  },
  e1_fuentes: {
    audiencia: ADM,
    lineas: [
      "Hay dos fuentes más: el CRM de leads, que solo se lee, aporta teléfonos y campaña.",
      "Y Registro, donde Admisión anota tratamientos, controles y decisiones del médico.",
    ],
  },

  /* ───────────────────────── ESCENA 2 · LA REGLA CRÍTICA DIARIA ───────────────────────── */
  e2_titulo: {
    audiencia: TODOS,
    lineas: ["Ahora, lo más importante de todo el instructivo: la regla diaria de SOFDOC."],
  },
  e2_sinApi: {
    audiencia: ADM,
    lineas: [
      "SOFDOC no tiene conexión con la plataforma: ella no puede descargar nada por sí sola.",
      "El proceso automático de las 7:00 solo vuelve a procesar lo que ya está en la «Hoja 1».",
    ],
  },
  e2_regla: {
    audiencia: TODOS,
    lineas: [
      "La regla: cada mañana, antes de las 7:00, alguien exporta las citas de SOFDOC.",
      "Y las pega en la «Hoja 1». A las 7:00, la plataforma las procesa sola.",
      "Si se pegaron después de las 7:00, use el menú Seguimientos → «Actualizar».",
    ],
  },
  e2_porque: {
    audiencia: TODOS,
    lineas: [
      "La plataforma sabe que un paciente volvió solo cuando SOFDOC marca su cita REALIZADO.",
      "Sin datos frescos, sigue pidiendo que se llame a quien ya vino.",
    ],
  },
  e2_consecuencia: {
    audiencia: TODOS,
    lineas: [
      "¿Qué pasa si no se actualiza? La lista se infla con pacientes que ya volvieron.",
      "Hay llamadas inútiles e incómodas, «No vino» falsos e indicadores errados.",
      "Y el equipo deja de confiar en la plataforma.",
    ],
  },
  e2_casoReal: {
    audiencia: TODOS,
    lineas: [
      "Ya pasó: 36 días sin cargar dejaron 183 reevaluaciones de pacientes que ya habían vuelto.",
      "Al cargar SOFDOC, el tablero bajó de 587 a 409 tarjetas.",
    ],
  },
  e2_paso1: {
    audiencia: ADM,
    lineas: [
      "Paso uno: en SOFDOC, exporte el reporte de citas a Excel, hasta la fecha de hoy.",
      "Repetir fechas no duplica nada: cada cita se reconoce por su IDCITA.",
    ],
  },
  e2_paso23: {
    audiencia: ADM,
    lineas: [
      "Paso dos: abra el libro BD SOFDOC SEGUIMIENTOS, en la pestaña «Hoja 1».",
      "Paso tres: Ctrl+A y Supr para vaciarla.",
      "Luego pegue en la celda A1, con la fila de títulos incluida.",
    ],
  },
  e2_paso4: {
    audiencia: ADM,
    lineas: ["Paso cuatro: menú Seguimientos, «Actualizar». Espere el mensaje «Listo», con las citas nuevas."],
  },
  e2_paso5: {
    audiencia: ADM,
    lineas: ["Paso cinco: menú Seguimientos, «Verificar». Debe decir ✓ SOFDOC, hasta hoy o ayer."],
  },
  e2_paso6: {
    audiencia: TODOS,
    lineas: ["Paso seis: el equipo presiona F5 y ve la lista al día."],
  },
  e2_senales: {
    audiencia: TODOS,
    lineas: [
      "Salió bien si Verificar muestra ✓, bajo el logo se lee hasta cuándo llega SOFDOC y no hay aviso amarillo.",
      "Si falla: aviso amarillo, ⚠ en Verificar y el correo «SOFDOC atrasado» a las 7:00.",
    ],
  },
  e2_mensajes: {
    audiencia: ADM,
    lineas: [
      "«0 citas nuevas»: el export no traía nada nuevo; revise el rango de fechas.",
      "«Faltan estas columnas»: reporte equivocado, o sin la fila de títulos.",
      "Y no use «Importar lo que falta de la base de hierro»: fue una importación única.",
    ],
  },

  /* ───────────────────────── ESCENA 3 · LAS PANTALLAS ───────────────────────── */
  // 3A · Tablero
  e3a_intro: {
    audiencia: TODOS,
    lineas: [
      "Ahora, las pantallas. Cada una en dos capas: el uso diario…",
      "…y, para el líder del proyecto, por qué se diseñó así.",
    ],
  },
  e3a_fases: {
    audiencia: ADM,
    capa: "uso",
    lineas: [
      "El Tablero ordena el trabajo del día en seis fases.",
      "De Por contactar a Contactado, Pago realizado, Agendado, En tratamiento y Completado.",
    ],
  },
  e3a_filtros: {
    audiencia: ADM,
    capa: "uso",
    lineas: ["Cada tarjeta baja sola al registrar lo que pasó. Los filtros de arriba acotan la lista."],
  },
  e3a_buscador: {
    audiencia: ADM,
    capa: "uso",
    lineas: ["Si alguien no aparece, el buscador explica por qué: una cita agendada, un alta médica…"],
  },
  e3a_espera: {
    audiencia: ADM,
    capa: "uso",
    lineas: [
      "Lo recién registrado espera siete días al final de Por contactar.",
      "Atajos: del 1 al 4 para «¿Qué pasó?» y la X para cerrar.",
    ],
  },
  e3a_porque: {
    audiencia: LIDER,
    capa: "porque",
    lineas: [
      "Por qué se diseñó así: una sola lista de trabajo, calculada y no armada a mano.",
      "Las fases se calculan a partir de los datos: nunca se guardan.",
    ],
  },
  // 3B · ¿Qué pasó?
  e3b_panel: {
    audiencia: ADM,
    capa: "uso",
    lineas: ["Al abrir una tarjeta: No contestó, Lo pensará, Agendó cita o Pagó."],
  },
  e3b_reglas: {
    audiencia: ADM,
    capa: "uso",
    lineas: [
      "«Agendó cita» solo acepta fechas futuras.",
      "Dos «No contestó» seguidos cierran el seguimiento solos.",
    ],
  },
  e3b_cierres: {
    audiencia: ADM,
    capa: "uso",
    lineas: [
      "Para cerrar a mano: Número equivocado, Sin contacto válido, Se atiende en otro lugar, Falleció o No desea continuar.",
      "Sin ningún teléfono, use «Sin contacto válido». Y todo tiene «Deshacer».",
    ],
  },
  e3b_porque: {
    audiencia: LIDER,
    capa: "porque",
    lineas: ["Por qué se diseñó así: cada contacto queda medido, con su resultado."],
  },
  // 3C · Registro
  e3c_pestanas: {
    audiencia: ADM,
    capa: "uso",
    lineas: ["Registro anota lo que indica el médico, en tres pestañas."],
  },
  e3c_indicacion: {
    audiencia: ADM,
    capa: "uso",
    lineas: [
      "En Indicación: procedimiento o hierro, y el número de sesiones.",
      "Si el paciente trae su hierro, marque «Hierro propio del paciente».",
    ],
  },
  e3c_primera: {
    audiencia: ADM,
    capa: "uso",
    lineas: [
      "Primera sesión con fecha pasada: queda hecha. Con fecha futura: programada.",
      "Si es hoy, elija «Ya se aplicó hoy» o «Se aplicará más tarde».",
    ],
  },
  e3c_decision: {
    audiencia: ADM,
    capa: "uso",
    lineas: ["Decisión del médico: Alta, Alta 6 meses, Alta 1 año o Nueva reevaluación."],
  },
  e3c_porque: {
    audiencia: LIDER,
    capa: "porque",
    lineas: ["Por qué se diseñó así: el médico no usa la plataforma; lo que Admisión registra crea las tarjetas."],
  },
  // 3D · Pacientes y ficha
  e3d_ficha: {
    audiencia: TODOS,
    capa: "uso",
    lineas: ["En Pacientes, busque por DNI o nombre: la ficha muestra todo el historial."],
  },
  e3d_telefono: {
    audiencia: TODOS,
    capa: "uso",
    lineas: [
      "¿Consiguió un teléfono? «Agregar teléfono» lo deja en todas sus tarjetas.",
      "Y reabre la que estaba cerrada por «Sin contacto válido».",
    ],
  },
  e3d_porque: {
    audiencia: LIDER,
    capa: "porque",
    lineas: ["Por qué se diseñó así: SOFDOC no trae teléfono, y el número debe quedar en un solo lugar."],
  },
  // 3E · Enfermería
  e3e_lista: {
    audiencia: ["enfermeria", "lider"],
    capa: "uso",
    lineas: [
      "Enfermería tiene su propia pantalla.",
      "Tras cada sesión de hierro: la fila «Aplicación» y contactos a los días 1, 3 y 5.",
    ],
  },
  e3e_contacto: {
    audiencia: ["enfermeria", "lider"],
    capa: "uso",
    lineas: [
      "«Ya me contacté» registra la reacción: ninguna, inmediata o mediata.",
      "Dos «No contestó» lo dejan como «No respondió».",
    ],
  },
  e3e_porque: {
    audiencia: LIDER,
    capa: "porque",
    lineas: ["Por qué se diseñó así: el seguimiento asistencial va aparte del de Admisión."],
  },
  // 3F · Indicadores
  e3f_metas: {
    audiencia: ADM,
    capa: "uso",
    lineas: [
      "Indicadores muestra el porcentaje que volvió frente a la meta, y el cumplimiento de hierro y procedimientos.",
      "«Resumen para imprimir» arma dos páginas A4.",
    ],
  },
  e3f_descarga: {
    audiencia: ADM,
    capa: "uso",
    lineas: [
      "«Descargar pacientes que no regresaron» filtra y baja un archivo para Excel.",
      "Si la descarga se bloquea, use «Copiar para Excel».",
      "Tiene datos personales: compártalo solo dentro del equipo.",
    ],
  },
  e3f_porque: {
    audiencia: LIDER,
    capa: "porque",
    lineas: ["Por qué se diseñó así: las cifras salen de los mismos datos que el tablero, sin cuentas a mano."],
  },
  // 3G · Roles
  e3g_quien: {
    audiencia: TODOS,
    capa: "uso",
    lineas: ["Al entrar, elija su nombre en «¿Quién es usted?»: de eso dependen sus pantallas."],
  },
  e3g_consulta: {
    audiencia: TODOS,
    capa: "uso",
    lineas: [
      "Solo consulta ve todo, sin modificar nada.",
      "Y si aparece «Es un nuevo día», presione F5.",
    ],
  },

  /* ───────────────────────── ESCENA 4 · CONFIGURACIÓN ───────────────────────── */
  e4_sinPantalla: {
    audiencia: LIDER,
    lineas: ["No hay pantalla de configuración: todo vive en el Sheets, BD SOFDOC SEGUIMIENTOS."],
  },
  e4_reglas: {
    audiencia: LIDER,
    lineas: [
      "La hoja REGLAS guarda plazos, metas y los días de enfermería.",
      "A la izquierda, los plazos por especialidad: cuándo se espera al paciente y cuándo vence.",
    ],
  },
  e4_editar: {
    audiencia: LIDER,
    lineas: [
      "Cambiar una celda cambia el comportamiento, sin publicar nada.",
      "Por ejemplo, la meta diaria: de 15 a 20.",
    ],
  },
  e4_catalogos: {
    audiencia: LIDER,
    lineas: ["CATALOGOS guarda los usuarios de cada rol, doctores, procedimientos, tratamientos y reacciones."],
  },
  e4_cuidados: {
    audiencia: LIDER,
    lineas: [
      "El nombre en USUARIOS_ENFERMERIA va igual que en USUARIOS.",
      "No borre columnas ni renombre encabezados.",
    ],
  },
  e4_menu: {
    audiencia: LIDER,
    lineas: ["El menú Seguimientos: Actualizar, Verificar, la actualización de las 7:00, el correo de prueba y Preparar hojas."],
  },
  e4_publicar: {
    audiencia: LIDER,
    lineas: [
      "Tras un cambio, F5. Para publicar código: git pull y npm run actualizar.",
      "Con hojas nuevas, «Preparar hojas». Nunca npm run publicar ni npm audit fix --force.",
    ],
  },

  /* ───────────────────────── ESCENA 5 · PENDIENTES Y CIERRE ───────────────────────── */
  e5_tablero: {
    audiencia: LIDER,
    lineas: ["Para el líder del proyecto quedan pendientes, en tres columnas."],
  },
  e5_porHacer: {
    audiencia: LIDER,
    lineas: [
      "Por hacer: «Ya vino a su cita», validar los roles y corregir el KPI de recuperación.",
      "Además, una copia de seguridad semanal, y actualizar este video y la capacitación.",
    ],
  },
  e5_seguridad: {
    audiencia: LIDER,
    lineas: [
      "En evaluación, la seguridad: hoy la identidad es un desplegable, y el enlace no debe circular.",
      "Se evalúa un ingreso con usuario y clave.",
    ],
  },
  e5_evaluacion: {
    audiencia: LIDER,
    lineas: [
      "También cargar SOFDOC, CRM y Rapifac desde una carpeta de Drive.",
      "Y priorizar a los pacientes perdidos: el «dinero en la mesa».",
    ],
  },
  e5_externa: {
    audiencia: LIDER,
    lineas: ["Gestión externa: pedir a TI teléfono y citas futuras en el export de SOFDOC."],
  },
  e5_pilares: {
    audiencia: TODOS,
    lineas: [
      "Tres pilares. Uno: SOFDOC cada mañana, antes de las 7:00, con Verificar en ✓.",
      "Dos: buen uso según su rol. Tres: seguimiento de los pendientes.",
    ],
  },
  e5_fin: {
    audiencia: TODOS,
    lineas: ["Gracias. Que ningún paciente se quede sin volver."],
  },
} as const satisfies Record<string, Beat>;

export type BeatId = keyof typeof GUION;

/* ═════════════════════════ TEXTOS EN PANTALLA ═════════════════════════ */

export const TEXTOS = {
  marca: "Seguimientos CHP",
  institucion: "Centro Hematológico del Perú",

  e1: {
    kicker: "Instructivo animado",
    titulo: "Seguimientos CHP",
    bajada: "Para Enfermería, Admisión y el líder del proyecto",
    propositoTitulo: "Que ningún paciente se quede sin volver",
    proposito: [
      { t: "Reevaluaciones", s: "Quien vino y debe volver" },
      { t: "Hierro", s: "Cada sesión del tratamiento" },
      { t: "Procedimientos", s: "Cotizados y no realizados" },
      { t: "Controles", s: "Con su laboratorio" },
      { t: "Enfermería", s: "Contactos tras cada sesión" },
    ],
    rolesTitulo: "Quién la usa",
    roles: [
      { t: "Admisión", s: "Tablero, Registro, Pacientes, Indicadores", d: "Registra todo menos Enfermería" },
      { t: "Enfermería", s: "Enfermería y la ficha del paciente", d: "Contactos, reacciones y teléfonos" },
      { t: "Solo consulta", s: "Administración y Marketing", d: "Ve todo, no modifica nada" },
    ],
    medico: "El médico no usa la plataforma: Admisión registra sus decisiones.",
    flujoTitulo: "Cómo fluye la información",
    flujo: [
      { t: "SOFDOC", s: "Citas" },
      { t: "Excel", s: "Reporte exportado" },
      { t: "«Hoja 1»", s: "Se pega aquí" },
      { t: "Actualizar", s: "7:00 o a mano" },
      { t: "CITAS · PACIENTES", s: "Hojas calculadas" },
      { t: "Tablero", s: "A quién llamar" },
      { t: "Llamada", s: "Teléfono o WhatsApp" },
      { t: "«¿Qué pasó?»", s: "Se registra" },
      { t: "Retorno", s: "Cita REALIZADO en SOFDOC" },
    ],
    fuentesTitulo: "Dos fuentes más",
    fuentes: [
      { t: "CRM de leads", s: "Solo lectura", d: "Teléfonos, canal y campaña" },
      { t: "Registro", s: "Lo escribe Admisión", d: "Tratamientos, controles y decisiones del médico" },
    ],
  },

  e2: {
    kicker: "Escena 2",
    titulo: "La regla crítica diaria",
    bajada: "SOFDOC cargado cada mañana, antes de las 7:00",
    sinApi: "SOFDOC no tiene conexión (API) con la plataforma",
    persona: "Una persona exporta y pega",
    reproceso: "7:00 · vuelve a procesar la «Hoja 1»",
    regla: "Cada mañana, antes de las 7:00",
    reglaDetalle: "Exportar las citas de SOFDOC y pegarlas en la «Hoja 1»",
    reglaTarde: "¿Se pegó después de las 7:00? Seguimientos → «Actualizar»",
    porqueTitulo: "Solo vuelve quien SOFDOC marca REALIZADO",
    alertaTitulo: "¿Qué pasa si NO se actualiza?",
    alerta: [
      "Lista inflada con pacientes que ya volvieron",
      "Llamadas inútiles e incómodas",
      "«No vino» falsos",
      "Indicadores errados",
      "Pérdida de confianza en la plataforma",
    ],
    casoTitulo: "Caso real · octubre y noviembre de 2026",
    caso: [
      { n: 36, t: "días sin cargar SOFDOC" },
      { n: 183, t: "reevaluaciones que ya habían vuelto" },
    ],
    pasos: [
      "Exportar el reporte de citas en SOFDOC",
      "Abrir el Sheets, pestaña «Hoja 1»",
      "Ctrl+A, Supr y pegar en A1",
      "Seguimientos → Actualizar",
      "Seguimientos → Verificar",
      "El equipo presiona F5",
    ],
    exitoTitulo: "Salió bien",
    exito: ["✓ en Verificar", "«SOFDOC hasta el …» bajo el logo", "Sin aviso amarillo"],
    fallaTitulo: "Algo falla",
    falla: ["Aviso amarillo en la app", "Correo a las 7:00: «SOFDOC atrasado en Seguimientos CHP»", "⚠ en Verificar"],
    mensajes: [
      { m: "0 citas nuevas", s: "El export no traía nada nuevo: revise el rango de fechas." },
      { m: "Faltan estas columnas…", s: "Reporte equivocado o sin la fila de títulos." },
      { m: "Importar lo que falta de la base de hierro", s: "Fue una importación única y ya se hizo." },
    ],
  },

  e3: {
    kicker: "Escena 3 · Las pantallas",
    secciones: {
      a: "Tablero",
      b: "«¿Qué pasó?»",
      c: "Registro",
      d: "Pacientes y ficha",
      e: "Enfermería",
      f: "Indicadores",
      g: "Roles y avisos",
    },
    porque: {
      a: ["Una sola lista de trabajo", "Calculada, nunca armada a mano", "Las fases se calculan; nunca se guardan"],
      b: ["Cada contacto queda medido", "Resultado de cada llamada", "Base para medir trabajo y retorno"],
      c: ["El médico no usa la plataforma", "Admisión registra lo que decide", "Las tarjetas salen solas del registro"],
      d: ["SOFDOC no trae teléfono", "Se consigue por otros caminos", "Un solo lugar, para todas las tarjetas"],
      e: ["Seguimiento asistencial aparte", "Enfermería y Admisión no comparten funciones", "Días 1, 3 y 5 se calculan solos"],
      f: ["Mismos datos que el tablero", "Sin cuentas a mano", "Trabajar a quien no regresó, fuera del tablero"],
    },
  },

  e4: {
    kicker: "Escena 4",
    titulo: "Configuración",
    bajada: "No hay pantalla de configuración: todo vive en el Sheets",
    libro: "BD SOFDOC SEGUIMIENTOS",
    impactoTitulo: "Cambiar una celda cambia el comportamiento sin publicar",
    cuidados: [
      "USUARIOS_ENFERMERIA: el nombre, igual que en USUARIOS",
      "No borre columnas ni renombre encabezados",
      "Después de un cambio, el equipo presiona F5",
    ],
    publicar: ["git pull", "npm run actualizar", "«Preparar hojas» si hay hojas nuevas"],
    nunca: ["npm run publicar", "npm audit fix --force"],
  },

  e5: {
    kicker: "Escena 5",
    titulo: "Pendientes y cierre",
    columnas: ["Por hacer", "En evaluación", "Gestión externa"],
    tarjetas: [
      { col: 0, t: "Botón «Ya vino a su cita»", en: "e5_porHacer" },
      { col: 0, t: "Validar nombres de rol en Verificar", en: "e5_porHacer" },
      { col: 0, t: "KPI de recuperación: solo citas realizadas", en: "e5_porHacer" },
      { col: 0, t: "Copia de seguridad semanal", en: "e5_porHacer" },
      { col: 0, t: "Actualizar este video y la capacitación", en: "e5_porHacer" },
      { col: 1, t: "Ingreso con usuario y clave (hoy: desplegable; el enlace no debe circular)", en: "e5_seguridad" },
      { col: 1, t: "Carpeta de Drive: SOFDOC, CRM y Rapifac automáticos", en: "e5_evaluacion" },
      { col: 1, t: "Prioridad y segmentos de pacientes perdidos", en: "e5_evaluacion" },
      { col: 1, t: "«Dinero en la mesa»", en: "e5_evaluacion" },
      { col: 2, t: "TI: teléfono y citas futuras en el export de SOFDOC", en: "e5_externa" },
    ],
    pilares: [
      { n: "1", t: "SOFDOC cada mañana", s: "Antes de las 7:00, con Verificar en\u00A0✓" },
      { n: "2", t: "Buen uso por rol", s: "Admisión, Enfermería y solo consulta" },
      { n: "3", t: "Seguir los pendientes", s: "El líder del proyecto los impulsa" },
    ],
    cierre: "Que ningún paciente se quede sin volver",
  },
} as const;
