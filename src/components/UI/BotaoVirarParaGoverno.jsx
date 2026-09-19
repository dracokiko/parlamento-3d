import { useState, useRef, useEffect } from 'react';
import { RotateCw } from 'lucide-react';
import { useParlamento } from '../../context/ParlamentoContext';

/** Duração da rotação. Devagar o suficiente para se perceber que a sala girou. */
const DURACAO_MS = 1400;

/** Aceleração e travagem suaves — uma rotação a velocidade constante parece um corte. */
const suavizar = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Roda um ponto 180°×`fracao` em torno do eixo vertical que passa no centro da sala. */
function rodar([x, y, z], angulo) {
  const cos = Math.cos(angulo);
  const sen = Math.sin(angulo);
  return [x * cos + z * sen, y, -x * sen + z * cos];
}

/**
 * O botão que vira a sala ao contrário.
 *
 * O Governo senta-se de frente para os deputados, o que quer dizer que da
 * vista de origem só se lhe vêem as costas. Em vez de mais um controlo de
 * câmara escondido a um canto, isto roda a sala meia volta: a Assembleia
 * fica de costas para nós e o Governo de frente. Voltar a carregar traz a
 * vista inicial.
 */
export const BotaoVirarParaGoverno = () => {
  const { cameraControlsRef, membrosGoverno, deputadoSelecionado, governanteSelecionado } = useParlamento();
  const [aVerGoverno, setAVerGoverno] = useState(false);
  const [aRodar, setARodar] = useState(false);
  const animacaoRef = useRef(null);

  // Uma rotação a meio caminho deixava a câmara num sítio arbitrário.
  useEffect(() => () => cancelAnimationFrame(animacaoRef.current), []);

  const virar = () => {
    const controlos = cameraControlsRef.current;
    if (!controlos || aRodar) return;

    const camaraInicial = controlos.object.position.toArray();
    const alvoInicial   = controlos.target.toArray();
    const inicio = performance.now();

    setARodar(true);

    const passo = (agora) => {
      const t = Math.min((agora - inicio) / DURACAO_MS, 1);
      const angulo = Math.PI * suavizar(t);

      controlos.object.position.set(...rodar(camaraInicial, angulo));
      controlos.target.set(...rodar(alvoInicial, angulo));
      controlos.update();

      if (t < 1) {
        animacaoRef.current = requestAnimationFrame(passo);
      } else {
        setARodar(false);
        setAVerGoverno(v => !v);
      }
    };

    animacaoRef.current = requestAnimationFrame(passo);
  };

  // Sem ninguém na bancada não há nada para onde virar. Com um painel aberto
  // o botão só estorvava — em ecrã pequeno o painel sobe justamente daí.
  if (!membrosGoverno?.length || deputadoSelecionado || governanteSelecionado) return null;

  return (
    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 px-3 w-full max-w-md">
      <button
        onClick={virar}
        disabled={aRodar}
        className={`w-full flex items-center justify-center gap-3 rounded-2xl px-6 py-4 shadow-xl border transition-all
          text-base sm:text-lg font-semibold tracking-tight
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
