import { Audio } from "@remotion/media";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { staticFile, useVideoConfig } from "remotion";
import { Apertura } from "./Apertura";
import { Card } from "./Card";
import { Cierre } from "./Cierre";
import { Cifras } from "./Cifras";
import { Dispositivos } from "./Dispositivos";
import { Escena } from "./Escena";
import { Flujo } from "./Flujo";
import { Seccion } from "./Seccion";

// Generado por generar.py (voz: kokoro).
export const Gerencia = () => {
  const { fps } = useVideoConfig();
  return (
    <>
    <TransitionSeries>
      <TransitionSeries.Sequence name="Apertura" durationInFrames={102} premountFor={fps}>
        <Apertura palabras={["Detectar", "Contactar", "Medir", "Recuperar", "Seguimiento", "Indicadores"]} lema="Presentación a gerencia" />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="Portada" durationInFrames={351} premountFor={fps}>
        <Card kicker="Presentación a gerencia" title="Plataforma de seguimiento de pacientes CHP" portada />
        <Audio name="Voz" src={staticFile("voz-ger/01.wav")} premountFor={fps} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="El problema" durationInFrames={789} premountFor={fps}>
        <Cifras kicker="El problema" title="Pacientes que se perdían en silencio" pie="Datos reales de enero a setiembre de 2026 (SOFDOC y base de cotizaciones). El monto es un techo: incluye pacientes que no debían volver." cifras={[{ valor: "74 %", texto: "no volvía a su reevaluación (meta: máximo 40 %)", en: 5.31 }, { valor: "48 % · 14 %", texto: "del hierro y de los procedimientos cotizados se realizaba", en: 14.96 }, { valor: "S/ 121–151 mil", texto: "al mes en juego", en: 20.35 }]} />
        <Audio name="Voz" src={staticFile("voz-ger/02.wav")} premountFor={fps} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="Antes" durationInFrames={426} premountFor={fps}>
        <Seccion kicker="Cómo se trabajaba" title="Un Excel y la memoria de cada asesora" cursivaTexto="Cotizaciones por nombre, sin DNI · llamadas sin registro · altas sin anotar · indicadores a mano" fondo="hueso" />
        <Audio name="Voz" src={staticFile("voz-ger/03.wav")} premountFor={fps} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="Cómo funciona" durationInFrames={672} premountFor={fps}>
        <Flujo enFuentes={0.90} enCentro={10.08} enPantallas={16.02} />
        <Audio name="Voz" src={staticFile("voz-ger/04.wav")} premountFor={fps} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="Tablero" durationInFrames={777} premountFor={fps}>
        <Escena src="ger/g01-tablero.png" fondo="granate" desde={{ x: 0, y: 0, w: 1600, h: 1000 }} hasta={{ x: 250, y: 80, w: 1340, h: 360 }}
          marcas={[
            { caja: { x: 264, y: 131, w: 1304, h: 108 }, en: 4.61 },
            { caja: { x: 264, y: 90, w: 302, h: 18 }, en: 10.82 },
            { caja: { x: 264, y: 261, w: 1135, h: 48 }, en: 14.73 },
            { caja: { x: 264, y: 357, w: 1304, h: 62 }, en: 19.01 }
          ]}
          paso="Pantalla 1 · Tablero" title="La lista de trabajo diaria"
          body="1 Cuatro cifras del día. 2 Meta diaria de seguimientos. 3 Filtros: tipo, médico, mes y especialidad. 4 Cuatro columnas por las que avanza cada paciente." />
        <Audio name="Voz" src={staticFile("voz-ger/05.wav")} premountFor={fps} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="Por médico" durationInFrames={303} premountFor={fps}>
        <Escena src="ger/g02-tablero-medico.png" fondo="granate" desde={{ x: 0, y: 0, w: 1600, h: 1000 }} hasta={{ x: 250, y: 80, w: 1340, h: 560 }}
          marcas={[
            { caja: { x: 782, y: 263, w: 189, h: 44 }, en: 0.95, clic: true },
            { caja: { x: 264, y: 131, w: 1304, h: 108 }, en: 4.88 }
          ]}
          paso="Tablero · por médico" title="Cada médico ve a sus pacientes"
          body="1 Filtro por médico. 2 Las cifras y las columnas se recalculan." />
        <Audio name="Voz" src={staticFile("voz-ger/06.wav")} premountFor={fps} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="Qué pasó" durationInFrames={543} premountFor={fps}>
        <Escena src="ger/g03-panel.png" fondo="granate" desde={{ x: 0, y: 0, w: 1600, h: 1000 }} hasta={{ x: 1140, y: 150, w: 460, h: 580 }}
          marcas={[
            { caja: { x: 1165, y: 179, w: 411, h: 25 }, en: 0.95 },
            { caja: { x: 1165, y: 393, w: 411, h: 104 }, en: 4.66 },
            { caja: { x: 1165, y: 537, w: 411, h: 168 }, en: 10.47 }
          ]}
          paso="Tablero · cada llamada" title="Cada llamada queda registrada"
          body="1 Por qué hay que llamar. 2 Qué pasó: no contestó, lo pensará, agendó o aceptó. 3 Cierre con motivo." />
        <Audio name="Voz" src={staticFile("voz-ger/07.wav")} premountFor={fps} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="Registro" durationInFrames={735} premountFor={fps}>
        <Escena src="ger/g04-registro.png" fondo="noche" desde={{ x: 0, y: 0, w: 1600, h: 1000 }} hasta={{ x: 0, y: 0, w: 1600, h: 1000 }}
          marcas={[
            { caja: { x: 264, y: 106, w: 480, h: 48 }, en: 0.95 },
            { caja: { x: 912, y: 232, w: 656, h: 303 }, en: 18.92 }
          ]}
          paso="Pantalla 2 · Registro" title="Lo que indica el médico"
          body="1 Indicación, control con laboratorio y decisión del médico. 2 Registrados: editar y anular, con bitácora." />
        <Audio name="Voz" src={staticFile("voz-ger/08.wav")} premountFor={fps} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="Pacientes" durationInFrames={426} premountFor={fps}>
        <Escena src="ger/g05-ficha.png" fondo="rubor" desde={{ x: 0, y: 0, w: 1600, h: 1000 }} hasta={{ x: 250, y: 140, w: 1340, h: 780 }}
          marcas={[
            { caja: { x: 264, y: 280, w: 791, h: 200 }, en: 0.95 },
            { caja: { x: 264, y: 557, w: 791, h: 291 }, en: 7.27 },
            { caja: { x: 1103, y: 288, w: 465, h: 230 }, en: 9.91 }
          ]}
          paso="Pantalla 3 · Pacientes" title="La ficha completa del paciente"
          body="1 Especialidades y cuándo debe volver. 2 Tratamientos, sesión por sesión. 3 Teléfonos, altas e historia de seguimientos." />
        <Audio name="Voz" src={staticFile("voz-ger/09.wav")} premountFor={fps} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="Indicadores" durationInFrames={222} premountFor={fps}>
        <Seccion kicker="Pantalla 4 · Indicadores" title="Siete vistas para la dirección" cursivaTexto="Las cifras que siguen son de demostración" fondo="noche" />
        <Audio name="Voz" src={staticFile("voz-ger/10.wav")} premountFor={fps} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="Resumen del mes" durationInFrames={579} premountFor={fps}>
        <Escena src="ger/i-resumen.png" fondo="noche" desde={{ x: 0, y: 0, w: 1600, h: 1000 }} hasta={{ x: 250, y: 80, w: 1340, h: 800 }}
          marcas={[
            { caja: { x: 264, y: 170, w: 480, h: 310 }, en: 0.95 },
            { caja: { x: 819, y: 380, w: 749, h: 105 }, en: 9.53 },
            { caja: { x: 264, y: 530, w: 1304, h: 330 }, en: 16.34 }
          ]}
          paso="Indicadores · Resumen del mes" title="El indicador principal, frente a la meta"
          body="1 % que no volvió a su reevaluación. 2 Hierro, procedimientos y recuperación. 3 Evolución mes a mes." />
        <Audio name="Voz" src={staticFile("voz-ger/11.wav")} premountFor={fps} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="Hasta dónde llegan" durationInFrames={471} premountFor={fps}>
        <Escena src="ger/i-llegan.png" fondo="noche" desde={{ x: 0, y: 0, w: 1600, h: 1000 }} hasta={{ x: 250, y: 160, w: 1340, h: 840 }}
          marcas={[
            { caja: { x: 264, y: 215, w: 400, h: 460 }, en: 0.95 },
            { caja: { x: 680, y: 215, w: 560, h: 420 }, en: 7.71 },
            { caja: { x: 264, y: 740, w: 1304, h: 260 }, en: 12.83 }
          ]}
          paso="Indicadores · ¿Hasta dónde llegan?" title="Dónde se pierden los pacientes nuevos"
          body="1 De cada 100 pacientes nuevos. 2 La lectura en una frase. 3 Mes por mes." />
        <Audio name="Voz" src={staticFile("voz-ger/12.wav")} premountFor={fps} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="Campañas" durationInFrames={342} premountFor={fps}>
        <Escena src="ger/i-campanas.png" fondo="noche" desde={{ x: 0, y: 0, w: 1600, h: 1000 }} hasta={{ x: 250, y: 160, w: 1340, h: 720 }}
          marcas={[
            { caja: { x: 264, y: 305, w: 1120, h: 440 }, en: 0.95 }
          ]}
          paso="Indicadores · Campañas" title="Qué campañas traen pacientes que vuelven"
          body="1 Por canal: pacientes nuevos y cuántos volvieron." />
        <Audio name="Voz" src={staticFile("voz-ger/13.wav")} premountFor={fps} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="Procedimientos" durationInFrames={231} premountFor={fps}>
        <Escena src="ger/i-procs.png" fondo="noche" desde={{ x: 0, y: 0, w: 1600, h: 1000 }} hasta={{ x: 250, y: 160, w: 1340, h: 560 }}
          marcas={[
            { caja: { x: 264, y: 400, w: 1120, h: 285 }, en: 0.95 }
          ]}
          paso="Indicadores · Procedimientos" title="De lo cotizado, cuánto se hizo"
          body="1 Cotizados, empezados y completados, por tipo." />
        <Audio name="Voz" src={staticFile("voz-ger/14.wav")} premountFor={fps} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="Por médico" durationInFrames={198} premountFor={fps}>
        <Escena src="ger/i-procs-medico.png" fondo="granate" desde={{ x: 0, y: 0, w: 1600, h: 1000 }} hasta={{ x: 250, y: 160, w: 1340, h: 400 }}
          marcas={[
            { caja: { x: 264, y: 311, w: 1120, h: 187 }, en: 0.95 }
          ]}
          paso="Indicadores · por médico" title="La conversión de cada médico"
          body="1 Cuánto de lo que indica cada doctor se realiza." />
        <Audio name="Voz" src={staticFile("voz-ger/15.wav")} premountFor={fps} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="Recuperación" durationInFrames={318} premountFor={fps}>
        <Escena src="ger/i-recup.png" fondo="noche" desde={{ x: 0, y: 0, w: 1600, h: 1000 }} hasta={{ x: 250, y: 160, w: 1340, h: 600 }}
          marcas={[
            { caja: { x: 264, y: 300, w: 860, h: 70 }, en: 0.95 },
            { caja: { x: 264, y: 440, w: 1120, h: 240 }, en: 7.58 }
          ]}
          paso="Indicadores · Recuperación" title="El efecto del seguimiento"
          body="1 Seguimientos, retornos y días hasta volver. 2 Por asesora." />
        <Audio name="Voz" src={staticFile("voz-ger/16.wav")} premountFor={fps} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="Motivos" durationInFrames={276} premountFor={fps}>
        <Escena src="ger/i-motivos.png" fondo="noche" desde={{ x: 0, y: 0, w: 1600, h: 1000 }} hasta={{ x: 250, y: 160, w: 1340, h: 480 }}
          marcas={[
            { caja: { x: 264, y: 345, w: 1120, h: 230 }, en: 0.95 }
          ]}
          paso="Indicadores · Motivos de cierre" title="Por qué no vuelven"
          body="1 Motivos de cierre y su peso." />
        <Audio name="Voz" src={staticFile("voz-ger/17.wav")} premountFor={fps} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="Imprimible" durationInFrames={228} premountFor={fps}>
        <Escena src="ger/g06-imprimible.png" fondo="noche" desde={{ x: 0, y: 0, w: 1600, h: 2003 }} hasta={{ x: 0, y: 0, w: 1600, h: 800 }} ancho={1600} alto={2003}
          marcas={[
            
          ]}
          paso="Indicadores · Resumen para imprimir" title="Un informe de dos páginas, con un botón"
          body="Listo para las reuniones de gerencia." />
        <Audio name="Voz" src={staticFile("voz-ger/18.wav")} premountFor={fps} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="Dispositivos" durationInFrames={315} premountFor={fps}>
        <Dispositivos enMovil={4.76} />
        <Audio name="Voz" src={staticFile("voz-ger/19.wav")} premountFor={fps} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="Control" durationInFrames={414} premountFor={fps}>
        <Seccion kicker="Control y trazabilidad" title="Nada se borra, todo se mide" cursivaTexto="Identificación por DNI · cada acción con nombre, fecha y hora · anulaciones con motivo · plazos y metas en una celda" fondo="rubor" />
        <Audio name="Voz" src={staticFile("voz-ger/20.wav")} premountFor={fps} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="Recuperar" durationInFrames={585} premountFor={fps}>
        <Cifras kicker="Lo que se puede recuperar" title="Rentable desde el 10 %" pie="Escenarios del informe del 06/10/2026, sobre una pérdida de S/ 121 200 a S/ 151 200 al mes." cifras={[{ valor: "S/ 12–15 mil", texto: "al mes, recuperando el 10 %", en: 0.90 }, { valor: "S/ 24–30 mil", texto: "al mes, recuperando el 20 %", en: 7.61 }, { valor: "S/ 66–82 mil", texto: "una vez: el 10 % de los perdidos de enero a setiembre", en: 11.35 }]} />
        <Audio name="Voz" src={staticFile("voz-ger/21.wav")} premountFor={fps} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="Próximos pasos" durationInFrames={381} premountFor={fps}>
        <Seccion kicker="Próximos pasos" title="Usarla todos los días y medir" cursivaTexto="Registrar todas las altas · todo hierro y procedimiento en la plataforma · 15 seguimientos por asesora al día · revisión mensual de Indicadores" fondo="hueso" />
        <Audio name="Voz" src={staticFile("voz-ger/22.wav")} premountFor={fps} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="Cierre" durationInFrames={258} premountFor={fps}>
        <Cierre frase="Detectar a tiempo, contactar y medir" pie="En producción desde el 02/10/2026" />
        <Audio name="Voz" src={staticFile("voz-ger/23.wav")} premountFor={fps} />
      </TransitionSeries.Sequence>
    </TransitionSeries>
    <Audio name="Música" src={staticFile("voz-ger/musica.wav")} volume={0.09} />
    </>
  );
};
