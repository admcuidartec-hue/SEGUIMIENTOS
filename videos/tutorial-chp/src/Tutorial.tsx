import { Audio } from "@remotion/media";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { staticFile, useVideoConfig } from "remotion";
import { Apertura } from "./Apertura";
import { Atajos } from "./Atajos";
import { Card } from "./Card";
import { Cierre } from "./Cierre";
import { Escena } from "./Escena";
import { Seccion } from "./Seccion";

// Generado por generar.py (voz: kokoro).
export const Tutorial = () => {
  const { fps } = useVideoConfig();
  return (
    <>
    <TransitionSeries>
      <TransitionSeries.Sequence name="Apertura" durationInFrames={102} premountFor={fps}>
        <Apertura palabras={["Seguimiento", "Pacientes", "Sesiones", "Registro", "Control", "Indicadores"]} lema="Plataforma de seguimiento de pacientes" />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="Portada" durationInFrames={396} premountFor={fps}>
        <Card kicker="Video instructivo" title="Plataforma de seguimiento de pacientes CHP" portada />
        <Audio name="Voz" src={staticFile("voz/01.wav")} premountFor={fps} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="Elegir nombre" durationInFrames={399} premountFor={fps}>
        <Escena src="cap/t01-tablero.png" fondo="noche" desde={{ x: 0, y: 0, w: 1600, h: 1000 }} hasta={{ x: 0, y: 560, w: 760, h: 440 }}
          marcas={[
            { caja: { x: 16, y: 888, w: 199, h: 44 }, en: 0.95, clic: true }
          ]}
          paso="Antes de empezar" title="Elija su nombre en «¿Quién es usted?»"
          body="Todo lo que guarde queda a su nombre. Si ya tenía la app abierta, recargue la página (F5)." />
        <Audio name="Voz" src={staticFile("voz/02.wav")} premountFor={fps} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="Tablero" durationInFrames={630} premountFor={fps}>
        <Escena src="cap/t01-tablero.png" fondo="noche" desde={{ x: 0, y: 0, w: 1600, h: 1000 }} hasta={{ x: 250, y: 220, w: 1340, h: 620 }}
          marcas={[
            { caja: { x: 280, y: 371, w: 284, h: 21 }, en: 6.68 },
            { caja: { x: 610, y: 371, w: 284, h: 21 }, en: 9.89 },
            { caja: { x: 939, y: 371, w: 284, h: 21 }, en: 12.77 },
            { caja: { x: 1269, y: 371, w: 284, h: 21 }, en: 16.13 }
          ]}
          paso="El Tablero" title="Cada tarjeta es un paciente"
          body="1 Por contactar: hay que llamarle. 2 Agendado: ya tiene fecha. 3 En tratamiento. 4 Completado o alta." />
        <Audio name="Voz" src={staticFile("voz/03.wav")} premountFor={fps} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="Caso 1" durationInFrames={210} premountFor={fps}>
        <Seccion kicker="Caso 1 · Reevaluación" title="Luis no volvió a su reevaluación" cursivaTexto="Lo llamamos y acepta volver a consulta." fondo="granate" />
        <Audio name="Voz" src={staticFile("voz/04.wav")} premountFor={fps} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="Caso 1 · panel" durationInFrames={360} premountFor={fps}>
        <Escena src="cap/c1a-panel.png" fondo="granate" desde={{ x: 0, y: 0, w: 1600, h: 1000 }} hasta={{ x: 1140, y: 150, w: 460, h: 400 }}
          marcas={[
            { caja: { x: 1437, y: 293, w: 133, h: 44 }, en: 4.13 },
            { caja: { x: 1165, y: 449, w: 202, h: 48 }, en: 7.59, clic: true }
          ]}
          paso="Caso 1 · paso 1" title="Llame y anote lo que pasó"
          body="1 Copie el teléfono (tecla C). 2 Luis acepta: pulse «Agendó cita» (tecla 3)." />
        <Audio name="Voz" src={staticFile("voz/05.wav")} premountFor={fps} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="Caso 1 · fecha" durationInFrames={153} premountFor={fps}>
        <Escena src="cap/c1b-agendo.png" fondo="granate" desde={{ x: 1140, y: 150, w: 460, h: 400 }} hasta={{ x: 1140, y: 330, w: 460, h: 360 }}
          marcas={[
            { caja: { x: 1182, y: 525, w: 377, h: 44 }, en: 0.95 },
            { caja: { x: 1182, y: 579, w: 158, h: 44 }, en: 3.35, clic: true }
          ]}
          paso="Caso 1 · paso 2" title="Ponga la fecha de la cita"
          body="1 Elija la fecha que acordó con el paciente. 2 Guarde." />
        <Audio name="Voz" src={staticFile("voz/06.wav")} premountFor={fps} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="Caso 1 · agendado" durationInFrames={252} premountFor={fps}>
        <Escena src="cap/c1c-agendado.png" fondo="granate" desde={{ x: 0, y: 0, w: 1600, h: 1000 }} hasta={{ x: 560, y: 320, w: 640, h: 340 }}
          marcas={[
            { caja: { x: 604, y: 435, w: 296, h: 98 }, en: 0.95 }
          ]}
          paso="Caso 1 · listo" title="Luis pasa a Agendado"
          body="Su tarjeta dice «Cita el jue 01/10». Si no viene, volverá a Por contactar." />
        <Audio name="Voz" src={staticFile("voz/07.wav")} premountFor={fps} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="Caso 2" durationInFrames={210} premountFor={fps}>
        <Seccion kicker="Caso 2 · Hierro" title="Silvia aceptó su tratamiento de hierro" cursivaTexto="Ferinject, 3 sesiones. Cotizó hace 10 días." fondo="noche" />
        <Audio name="Voz" src={staticFile("voz/08.wav")} premountFor={fps} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="Caso 2 · aceptó" durationInFrames={318} premountFor={fps}>
        <Escena src="cap/c2a-panel.png" fondo="noche" desde={{ x: 0, y: 0, w: 1600, h: 1000 }} hasta={{ x: 1140, y: 300, w: 460, h: 460 }}
          marcas={[
            { caja: { x: 1165, y: 490, w: 202, h: 57 }, en: 0.95, clic: true },
            { caja: { x: 1375, y: 650, w: 202, h: 48 }, en: 4.98 }
          ]}
          paso="Caso 2 · paso 1" title="En hierro y procedimientos: «Aceptó»"
          body="1 «Aceptó tratamiento» (tecla 3). 2 Si no quiere hacérselo: «No desea realizarse», con el motivo." />
        <Audio name="Voz" src={staticFile("voz/09.wav")} premountFor={fps} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="Caso 2 · primera sesión" durationInFrames={189} premountFor={fps}>
        <Escena src="cap/c2b-acepto.png" fondo="noche" desde={{ x: 1140, y: 300, w: 460, h: 460 }} hasta={{ x: 1140, y: 380, w: 460, h: 330 }}
          marcas={[
            { caja: { x: 1182, y: 566, w: 377, h: 44 }, en: 0.95 },
            { caja: { x: 1182, y: 620, w: 158, h: 44 }, en: 3.62, clic: true }
          ]}
          paso="Caso 2 · paso 2" title="Fecha de la primera sesión"
          body="1 Ponga el día de su primera sesión. 2 «Pasar a Agendado»." />
        <Audio name="Voz" src={staticFile("voz/10.wav")} premountFor={fps} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="Caso 2 · agendada" durationInFrames={135} premountFor={fps}>
        <Escena src="cap/c2c-agendado.png" fondo="noche" desde={{ x: 0, y: 0, w: 1600, h: 1000 }} hasta={{ x: 560, y: 330, w: 640, h: 340 }}
          marcas={[
            { caja: { x: 604, y: 451, w: 296, h: 98 }, en: 0.95 }
          ]}
          paso="Caso 2 · listo" title="«Sesión 1 el jue 01/10»"
          body="Silvia queda agendada para su primera sesión." />
        <Audio name="Voz" src={staticFile("voz/11.wav")} premountFor={fps} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="Caso 3" durationInFrames={225} premountFor={fps}>
        <Seccion kicker="Caso 3 · Sesiones" title="Hoy es la primera sesión de Silvia" cursivaTexto="Vino, se hizo su sesión y ya acordó la siguiente." fondo="rubor" />
        <Audio name="Voz" src={staticFile("voz/12.wav")} premountFor={fps} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="Caso 3 · marcar" durationInFrames={405} premountFor={fps}>
        <Escena src="cap/c3a-sesion.png" fondo="rubor" desde={{ x: 0, y: 0, w: 1600, h: 1000 }} hasta={{ x: 1140, y: 380, w: 460, h: 320 }}
          marcas={[
            { caja: { x: 1165, y: 458, w: 411, h: 44 }, en: 0.95 },
            { caja: { x: 1165, y: 536, w: 411, h: 44 }, en: 5.58 },
            { caja: { x: 1165, y: 590, w: 202, h: 57 }, en: 8.89, clic: true }
          ]}
          paso="Caso 3 · un solo paso" title="Marque la sesión y agende la siguiente"
          body="1 Fecha de la sesión (hoy). 2 Próxima sesión. 3 «Marcar sesión 1 hecha»." />
        <Audio name="Voz" src={staticFile("voz/13.wav")} premountFor={fps} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="Caso 3 · sesión 2" durationInFrames={225} premountFor={fps}>
        <Escena src="cap/c3b-sesion2.png" fondo="rubor" desde={{ x: 0, y: 0, w: 1600, h: 1000 }} hasta={{ x: 560, y: 360, w: 640, h: 340 }}
          marcas={[
            { caja: { x: 604, y: 484, w: 296, h: 98 }, en: 0.95 }
          ]}
          paso="Caso 3 · listo" title="«Sesión 2 el jue 08/10»"
          body="Silvia vuelve a Agendado con su próxima sesión. Así en cada sesión, hasta la última." />
        <Audio name="Voz" src={staticFile("voz/14.wav")} premountFor={fps} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="Recuerde · sesiones" durationInFrames={387} premountFor={fps}>
        <Seccion kicker="Recuerde" title="Si pasa la fecha sin marcar la sesión" cursivaTexto="La tarjeta vuelve a Por contactar como «No vino a su sesión». En la última sesión no se pide próxima fecha: pasa a Completado." fondo="hueso" />
        <Audio name="Voz" src={staticFile("voz/15.wav")} premountFor={fps} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="Caso 4" durationInFrames={171} premountFor={fps}>
        <Seccion kicker="Caso 4 · Por reevaluar" title="Beatriz terminó su tratamiento hace un mes" cursivaTexto="Le toca volver a consulta." fondo="granate" />
        <Audio name="Voz" src={staticFile("voz/16.wav")} premountFor={fps} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="Caso 4 · panel" durationInFrames={324} premountFor={fps}>
        <Escena src="cap/c4-porreevaluar.png" fondo="granate" desde={{ x: 0, y: 0, w: 1600, h: 1000 }} hasta={{ x: 1140, y: 180, w: 460, h: 400 }}
          marcas={[
            { caja: { x: 1165, y: 249, w: 411, h: 25 }, en: 0.95 },
            { caja: { x: 1165, y: 490, w: 202, h: 48 }, en: 6.51, clic: true }
          ]}
          paso="Caso 4" title="«Por reevaluar»"
          body="1 Treinta días después de la última sesión aparece en Por contactar. 2 Llámela y use «Agendó cita»." />
        <Audio name="Voz" src={staticFile("voz/17.wav")} premountFor={fps} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="Caso 5" durationInFrames={213} premountFor={fps}>
        <Seccion kicker="Caso 5 · Registro" title="Rosa vuelve con exámenes en 15 días" cursivaTexto="El doctor le pidió hemograma y ferritina." fondo="noche" />
        <Audio name="Voz" src={staticFile("voz/18.wav")} premountFor={fps} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="Caso 5 · control" durationInFrames={543} premountFor={fps}>
        <Escena src="cap/c5a-control.png" fondo="noche" desde={{ x: 0, y: 0, w: 1600, h: 1000 }} hasta={{ x: 250, y: 200, w: 640, h: 800 }}
          marcas={[
            { caja: { x: 264, y: 238, w: 600, h: 48 }, en: 4.46 },
            { caja: { x: 264, y: 719, w: 600, h: 64 }, en: 9.52 },
            { caja: { x: 264, y: 821, w: 600, h: 44 }, en: 11.47 },
            { caja: { x: 264, y: 933, w: 179, h: 48 }, en: 15.27, clic: true }
          ]}
          paso="Registro → Control + laboratorio" title="Registre el control"
          body="1 DNI: aparece «Paciente conocido». 2 Exámenes. 3 El retorno se propone a 15 días. 4 «Registrar control»." />
        <Audio name="Voz" src={staticFile("voz/19.wav")} premountFor={fps} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="Caso 5 · registrado" durationInFrames={264} premountFor={fps}>
        <Escena src="cap/c5b-registrado.png" fondo="noche" desde={{ x: 0, y: 0, w: 1600, h: 1000 }} hasta={{ x: 890, y: 180, w: 700, h: 340 }}
          marcas={[
            { caja: { x: 912, y: 233, w: 656, h: 105 }, en: 0.95 }
          ]}
          paso="Caso 5 · listo" title="Queda en «Registrados»"
          body="Si Rosa no vuelve para esa fecha, aparecerá en Por contactar." />
        <Audio name="Voz" src={staticFile("voz/20.wav")} premountFor={fps} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="Caso 6" durationInFrames={183} premountFor={fps}>
        <Seccion kicker="Caso 6 · Decisión del médico" title="Alta con control en 6 meses" cursivaTexto="El doctor le da el alta a Rosa, pero quiere verla en medio año." fondo="rubor" />
        <Audio name="Voz" src={staticFile("voz/21.wav")} premountFor={fps} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="Caso 6 · decisión" durationInFrames={486} premountFor={fps}>
        <Escena src="cap/c6-decision.png" fondo="rubor" desde={{ x: 0, y: 0, w: 1600, h: 1000 }} hasta={{ x: 250, y: 380, w: 640, h: 620 }}
          marcas={[
            { caja: { x: 264, y: 403, w: 600, h: 44 }, en: 0.95 },
            { caja: { x: 264, y: 693, w: 600, h: 44 }, en: 5.60, clic: true },
            { caja: { x: 264, y: 855, w: 600, h: 40 }, en: 8.33 },
            { caja: { x: 264, y: 940, w: 190, h: 48 }, en: 13.31, clic: true }
          ]}
          paso="Registro → Decisión del médico" title="Elija la decisión"
          body="1 Especialidad. 2 «Alta · control en 6 meses». 3 La app dice cuándo volverá a Por contactar. 4 «Registrar decisión»." />
        <Audio name="Voz" src={staticFile("voz/22.wav")} premountFor={fps} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="Caso 7" durationInFrames={144} premountFor={fps}>
        <Seccion kicker="Caso 7 · Corregir" title="El teléfono de Rosa cambió" cursivaTexto="Se corrige en el mismo registro, sin registrarlo otra vez." fondo="granate" />
        <Audio name="Voz" src={staticFile("voz/23.wav")} premountFor={fps} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="Caso 7 · editar" durationInFrames={360} premountFor={fps}>
        <Escena src="cap/c7-editar.png" fondo="granate" desde={{ x: 0, y: 0, w: 1600, h: 1000 }} hasta={{ x: 900, y: 300, w: 700, h: 520 }}
          marcas={[
            { caja: { x: 989, y: 493, w: 177, h: 68 }, en: 0.95 },
            { caja: { x: 989, y: 747, w: 150, h: 44 }, en: 4.43, clic: true }
          ]}
          paso="Registrados → Editar" title="Corrija y guarde"
          body="1 Cambie el teléfono. 2 «Guardar cambios». El DNI no se edita: si está mal, anule y registre de nuevo." />
        <Audio name="Voz" src={staticFile("voz/24.wav")} premountFor={fps} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="Atajos" durationInFrames={366} premountFor={fps}>
        <Atajos />
        <Audio name="Voz" src={staticFile("voz/25.wav")} premountFor={fps} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="Cierre" durationInFrames={306} premountFor={fps}>
        <Cierre frase="¿Dudas? Envíe una captura de pantalla" pie="Consulte el manual de la plataforma" />
        <Audio name="Voz" src={staticFile("voz/26.wav")} premountFor={fps} />
      </TransitionSeries.Sequence>
    </TransitionSeries>
    <Audio name="Música" src={staticFile("voz/musica.wav")} volume={0.09} />
    </>
  );
};
