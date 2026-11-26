/**
 * DATOS DE DEMOSTRACIÓN — TODOS INVENTADOS. Ningún nombre, DNI ni teléfono es de un paciente real
 * (los apellidos llevan «Prueba», como en el DEMO de src/Index.html).
 *
 * ▸ Dónde enchufar datos reales: estas cifras podrían venir de un JSON exportado por la plataforma (por ejemplo,
 *   `getTablero()` o `getResumen()` pasados por un script que borre nombres y DNI) y leído con `staticFile('datos/…json')`
 *   + `delayRender`. Nunca se versionan datos de pacientes en el repositorio.
 */

export const HOY = "26/11/2026";
export const HOY_LARGO = "Jueves 26/11/2026";

/** Lo que dice la barra lateral bajo el logo cuando SOFDOC está al día. */
export const SOFDOC_AL_DIA = { hasta: "25/11/2026", cargado: "26/11/2026 06:42" };
/** …y cuando está atrasado (el aviso amarillo). */
export const SOFDOC_ATRASADO = { hasta: "18/11/2026", dias: 8 };

export type Tarjeta = {
  readonly nombre: string;
  readonly detalle: string;
  readonly etiqueta: string;
  readonly chip: { readonly t: string; readonly tono: "info" | "aviso" | "acento" | "bien" | "neutro" };
  readonly contacto?: string;
  readonly enEspera?: boolean;
};

export type Fase = { readonly id: string; readonly nombre: string; readonly cifra: number; readonly detalle: string; readonly tarjetas: readonly Tarjeta[] };

export const FASES: readonly Fase[] = [
  {
    id: "POR_CONTACTAR", nombre: "Por contactar", cifra: 23, detalle: "22 sin ningún intento · +1 en espera",
    tarjetas: [
      { nombre: "Luis Ramos Prueba", detalle: "Dra. La Torre · Hematología", etiqueta: "Debía volver el 26/10 · hace 31 días", chip: { t: "Reevaluación", tono: "info" }, contacto: "923 456 789" },
      { nombre: "Ana Flores Prueba", detalle: "Dr. Cabanillas · Hierro", etiqueta: "Cotizó hace 9 días", chip: { t: "Ferinject × 2", tono: "aviso" }, contacto: "@ana.prueba" },
      { nombre: "Lucía Prueba Ñahui", detalle: "Dr. Cabanillas · Hierro", etiqueta: "Cotizó hace 2 días · se le escribe desde el 01/12", chip: { t: "Monofer × 1", tono: "aviso" }, enEspera: true },
    ],
  },
  {
    id: "CONTACTADO", nombre: "Contactado", cifra: 5, detalle: "esperan respuesta",
    tarjetas: [
      { nombre: "Jorge Vega Prueba", detalle: "Dra. Matos · Hematología", etiqueta: "Reintentar el 27/11 · intento 2 de 2", chip: { t: "Reevaluación", tono: "info" }, contacto: "987 111 222" },
      { nombre: "Rosa Díaz Prueba", detalle: "Dr. Seminario · Procedimiento", etiqueta: "Lo pensará · llamar el 28/11", chip: { t: "Sangría", tono: "acento" }, contacto: "956 123 456" },
    ],
  },
  {
    id: "PAGO_REALIZADO", nombre: "Pago realizado", cifra: 2, detalle: "falta agendar",
    tarjetas: [{ nombre: "Elena Castro Prueba", detalle: "Dr. Cabanillas · Hierro", etiqueta: "Pagó el 24/11 · falta la fecha", chip: { t: "Likfer × 3", tono: "aviso" }, contacto: "976 543 210" }],
  },
  {
    id: "AGENDADO", nombre: "Agendado", cifra: 6, detalle: "2 citas esta semana",
    tarjetas: [
      { nombre: "María Torres Prueba", detalle: "Dra. La Torre · Hematología", etiqueta: "Cita el lun 30/11", chip: { t: "Reevaluación", tono: "info" }, contacto: "965 000 111" },
      { nombre: "Víctor Paredes Prueba", detalle: "Dr. Cabanillas · Hierro", etiqueta: "Sesión 2 el 01/12", chip: { t: "Ferinject × 3", tono: "aviso" }, contacto: "998 111 222" },
    ],
  },
  {
    id: "EN_TRATAMIENTO", nombre: "En tratamiento", cifra: 3, detalle: "ninguna atrasada",
    tarjetas: [{ nombre: "Sofía Ruiz Prueba", detalle: "Dra. Matos · Hierro", etiqueta: "Sesión 2 de 3 · próxima ~03/12", chip: { t: "Sacarato × 3", tono: "aviso" }, contacto: "987 666 777" }],
  },
  {
    id: "COMPLETADO", nombre: "Completado", cifra: 8, detalle: "en el mes",
    tarjetas: [
      { nombre: "Carlos Núñez Prueba", detalle: "Dr. Cabanillas · Hematología", etiqueta: "Volvió el 20/11", chip: { t: "Reevaluación", tono: "info" } },
      { nombre: "Gladys Huamán Prueba", detalle: "Dra. La Torre · Hierro", etiqueta: "Completó el tratamiento", chip: { t: "Monofer × 2", tono: "aviso" } },
    ],
  },
];

/** Paciente de la escena «¿Qué pasó?» y de la ficha. */
export const PACIENTE = {
  nombre: "Luis Ramos Prueba",
  dni: "40444555",
  especialidad: "Hematología",
  medico: "Dra. Alejandra La Torre",
  telefono: "923 456 789",
  ultima: "12/09/2026",
  debia: "26/10/2026",
  atraso: "hace 31 días que no vuelve",
};

/** Paciente del ejemplo de SOFDOC (escena 2). */
export const PACIENTE_SOFDOC = { nombre: "Rosa Quispe Prueba", dni: "41222333", cita: "20/11/2026", idcita: "C-0098812" };

/** Filas de la «Hoja 1» simulada: encabezado obligatorio del export de SOFDOC (SOFDOC_OBLIGATORIAS en src/Logica.gs). */
export const HOJA1_ENCABEZADO = ["IDCITA", "ESTADO DE CITA", "FECHA DE ATENCION | HORA", "PACIENTE", "DNI DEL PACIENTE", "ESPECIALIDAD MEDICA", "MEDICO"];
export const HOJA1_FILAS: readonly (readonly string[])[] = [
  ["C-0098812", "REALIZADO", "20/11/2026 09:20", "QUISPE PRUEBA ROSA", "41222333", "HEMATOLOGÍA", "Dra. LA TORRE"],
  ["C-0098840", "REALIZADO", "21/11/2026 10:00", "VEGA PRUEBA JORGE", "40111222", "HEMATOLOGÍA", "Dra. MATOS"],
  ["C-0098861", "NO ASISTIÓ", "23/11/2026 08:40", "RUIZ PRUEBA SOFÍA", "42333444", "HEMATOLOGÍA", "Dr. CABANILLAS"],
  ["C-0098877", "REALIZADO", "24/11/2026 11:15", "CASTRO PRUEBA ELENA", "43444555", "HEMATOLOGÍA", "Dr. SEMINARIO"],
  ["C-0098902", "REALIZADO", "25/11/2026 09:00", "TORRES PRUEBA MARÍA", "44555666", "HEMATOLOGÍA", "Dra. LA TORRE"],
  ["C-0098950", "AGENDADO", "30/11/2026 10:30", "NÚÑEZ PRUEBA CARLOS", "45666777", "HEMATOLOGÍA", "Dr. CABANILLAS"],
];

/** Mensaje de «Actualizar» (actualizar_ en src/Menu.gs), con cifras inventadas. */
export const MENSAJE_ACTUALIZAR =
  "Listo · 1 284 filas leídas, 38 citas nuevas, 4 cambiadas, 0 inválidas, 2 emparejamientos nuevos · En la bandeja: 23 reevaluaciones, 6 de hierro y 2 de procedimientos";

/** Líneas de «Verificar» sobre SOFDOC (lineasSofdoc en src/Logica.gs). */
export const VERIFICAR_OK = [
  "✓ SOFDOC: citas realizadas hasta el 25/11/2026 (ayer).",
  "ℹ SOFDOC: hay citas agendadas hasta el 30/12/2026.",
  "ℹ SOFDOC: última carga con citas nuevas el 26/11/2026 06:42 (ANA): 38 citas nuevas.",
];

/** Parámetros de la hoja REGLAS (valores por omisión de la plataforma). */
export const REGLAS_PARAMETROS: readonly (readonly [string, string])[] = [
  ["ESPERA_COTIZACION_DIAS", "7"],
  ["MAX_SEGUIMIENTOS", "2"],
  ["GRACIA_AGENDA_DIAS", "2"],
  ["META_DIARIA_SEGUIMIENTOS", "15"],
  ["CORTE_BANDEJA_DIAS", "180"],
  ["DIAS_POST_TRATAMIENTO", "30"],
  ["ENFERMERIA_DIAS", "1,3,5"],
  ["ENFERMERIA_MAX_INTENTOS", "2"],
  ["META_RETORNO_PCT", "60"],
  ["CORREOS_ALERTA_SOFDOC", "admision@…, jefatura@…"],
];
export const REGLAS_PLAZOS: readonly (readonly [string, string, string])[] = [
  ["*", "30", "45"],
  ["HEMATOLOGÍA", "30", "45"],
];

/** Columnas de CATALOGOS (con nombres de ejemplo). */
export const CATALOGOS_COLUMNAS = ["USUARIOS", "USUARIOS_ENFERMERIA", "USUARIOS_CONSULTA", "DOCTOR", "PROCEDIMIENTOS", "TRATAMIENTOS", "REACCIONES"];
export const CATALOGOS_FILAS: readonly (readonly string[])[] = [
  ["MAGALY", "LISET", "ADMINISTRACION", "Dr. Elí Cabanillas", "SANGRÍA", "HIERRO SACARATO", "Rubor"],
  ["ANA", "", "MARKETING", "Dra. Alejandra La Torre", "AMO", "HIERRO DERISOMALTOSA", "Prurito"],
  ["RACHEL", "", "", "Dr. Víctor Seminario", "BIOPSIA", "HIERRO CARBOXIMALTOSA", "Mareo"],
  ["LISET", "", "", "Dra. Karen Matos", "CITOMETRÍA DE FLUJO", "", "Otra"],
];

/** Usuarios del desplegable «¿Quién es usted?». */
export const USUARIOS_DEMO = {
  admision: ["Magaly", "Ana", "Rachel"],
  enfermeria: ["Liset"],
  consulta: ["Administración", "Marketing"],
};

/** Enfermería: filas del día (inventadas). */
export const ENFERMERIA_FILAS = [
  { grupo: "Vencidos", dia: "Día 3", texto: "Sesión 1 del 22/11", paciente: "Ana Flores Prueba", tel: "@ana.prueba", estado: "No contestó 1 vez · se cierra al siguiente intento" },
  { grupo: "Hoy", dia: "Aplicación", texto: "Sesión 1 del 26/11", paciente: "Víctor Paredes Prueba", tel: "998 111 222", estado: "" },
  { grupo: "Hoy", dia: "Día 1", texto: "Sesión 2 del 25/11", paciente: "Sofía Ruiz Prueba", tel: "987 666 777", estado: "" },
  { grupo: "Hoy", dia: "Día 5", texto: "Sesión 1 del 21/11", paciente: "Gladys Huamán Prueba", tel: "965 432 100", estado: "" },
];

/** Indicadores (cifras inventadas, con la forma de getResumen). */
export const INDICADORES = { volvio: 63, meta: 60, hierro: 92, metaHierro: 95, procedimientos: 88, noRegresaron: 41 };
