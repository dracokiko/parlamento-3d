import { useState, useRef, useEffect } from 'react';
import { RotateCw } from 'lucide-react';
import { useParlamento } from '../../context/ParlamentoContext';
import { useIsMobile, useIsTabletPortrait } from '../../hooks/useIsMobile';
import { VISTA_GOVERNO, escalaDaVista } from '../../utils/bancadaGoverno';

/** Duração da volta. Devagar o suficiente para se perceber que a sala girou. */
const DURACAO_MS = 1400;

/** Aceleração e travagem suaves — a velocidade constante parece um corte de plano. */
const suavizar = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const lerp = (a, b, t) => a + (b - a) * t;

/** Ângulo em torno do eixo vertical da sala, e distância a esse eixo. */
const paraPolar = ([x, y, z]) => ({ raio: Math.hypot(x, z), azimute: Math.atan2(x, z), altura: y });
const paraCartesiano = ({ raio, azimute, altura }) => [Math.sin(azimute) * raio, altura, Math.cos(azimute) * raio];

/** Leva o ângulo para o intervalo [-π, π] — evita dar a volta pelo caminho mais longo. */
const normalizarAngulo = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * O botão que vira a sala ao contrário.
 *
 * O Governo senta-se de frente para os deputados, portanto da vista de
 * origem só se lhe vêem as costas. Isto dá meia volta à sala e pousa numa
 * vista fixa, de frente para a bancada, por cima das últimas filas.
 *
 * A vista de chegada é fixa de propósito: rodar 180° a câmara onde o
 * utilizador a tivesse deixado dava vistas de cima da sala — que é tudo
 * menos olhar alguém de frente. O caminho continua a ser uma meia volta em
 * torno do eixo da sala; só o destino é que é escolhido.
 */
export const BotaoVirarParaGoverno = () => {
  const { cameraControlsRef, membrosGoverno, deputadoSelecionado, governanteSelecionado, setVistaGoverno } = useParlamento();
  const isMobile = useIsMobile();
  const isTabletPortrait = useIsTabletPortrait();

  const [aVerGoverno, setAVerGoverno] = useState(false);
  const [aRodar, setARodar] = useState(false);
  const animacaoRef = useRef(null);
  // Vista de onde viemos, para o caminho de volta ser o inverso exacto.
  const vistaAnterior = useRef(null);

  useEffect(() => () => cancelAnimationFrame(animacaoRef.current), []);

  const escala = isTabletPortrait ? 2.2 : (isMobile ? 2.7 : 1);

  const animarAte = (destino, aoTerminar) => {
    const controlos = cameraControlsRef.current;
    if (!controlos) return;

    const camaraDe = paraPolar(controlos.object.position.toArray());
    const alvoDe   = controlos.target.toArray();
    const camaraPara = paraPolar(destino.camera);
    const alvoPara   = destino.alvo;

    // Meia volta no sentido mais curto até ao azimute de chegada.
    const voltaExtra = Math.sign(normalizarAngulo(camaraPara.azimute - camaraDe.azimute) || 1) * Math.PI;
    const azimuteFinal = camaraDe.azimute + normalizarAngulo(camaraPara.azimute - camaraDe.azimute - voltaExtra) + voltaExtra;

    const inicio = performance.now();
    setARodar(true);

    const passo = (agora) => {
      const t = suavizar(Math.min((agora - inicio) / DURACAO_MS, 1));

      controlos.object.position.set(...paraCartesiano({
        raio:    lerp(camaraDe.raio, camaraPara.raio, t),
        azimute: lerp(camaraDe.azimute, azimuteFinal, t),
        altura:  lerp(camaraDe.altura, camaraPara.altura, t),
      }));
      controlos.target.set(
        lerp(alvoDe[0], alvoPara[0], t),
        lerp(alvoDe[1], alvoPara[1], t),
        lerp(alvoDe[2], alvoPara[2], t),
      );
      controlos.update();

      if ((agora - inicio) < DURACAO_MS) {
        animacaoRef.current = requestAnimationFrame(passo);
      } else {
        setARodar(false);
        aoTerminar?.();
      }
    };

    animacaoRef.current = requestAnimationFrame(passo);
  };

  const virar = () => {
    const controlos = cameraControlsRef.current;
    if (!controlos || aRodar) return;

    if (aVerGoverno) {
      const destino = vistaAnterior.current ?? { camera: [0, 12, 24], alvo: [0, 10, -16] };
      // Logo no arranque: a publicidade e o brasão voltam com a sala, não no fim.
      setVistaGoverno(false);
      animarAte(destino, () => setAVerGoverno(false));
      return;
    }

    vistaAnterior.current = {
      camera: controlos.object.position.toArray(),
      alvo:   controlos.target.toArray(),
    };
    setVistaGoverno(true);
    animarAte(escalaDaVista(VISTA_GOVERNO, escala), () => setAVerGoverno(true));
  };

  // Sem ninguém na bancada não há nada para onde virar. Com um painel aberto
  // o botão só estorvava — em ecrã pequeno o painel sobe justamente daí.
  if (!membrosGoverno?.length || deputadoSelecionado || governanteSelecionado) return null;

  return (
    /* Encostado à direita: ao centro tapava os lugares da frente, que é
       justamente onde está quem estamos a tentar mostrar. */
    <div className="absolute bottom-5 right-4 z-20 max-w-[calc(100%-2rem)]">
      <button
        onClick={virar}
        disabled={aRodar}
        className={`flex items-center justify-center gap-3 rounded-2xl px-5 py-3.5 shadow-xl border transition-all
          text-sm sm:text-base font-semibold tracking-tight
          ${aRodar
            ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-wait'
            : 'bg-white/95 backdrop-blur text-gray-900 border-gray-200 hover:bg-white hover:shadow-2xl active:scale-[0.99]'}`}
        aria-label={aVerGoverno ? 'Rodar a sala de volta para o hemiciclo' : 'Rodar a sala para ver a bancada do Governo'}
      >
        <RotateCw size={22} className={aRodar ? 'animate-spin text-gray-400' : 'text-gray-500'} />
        <span>{aVerGoverno ? 'Voltar ao hemiciclo' : 'Virar para o Governo'}</span>
        <span className="hidden sm:inline text-xs font-normal text-gray-400">180°</span>
      </button>
    </div>
  );
};
