import { useParlamento } from '../../context/ParlamentoContext';
import { useIsMobile, useIsTouch } from '../../hooks/useIsMobile';

/**
 * Etiqueta de quem está sob o cursor na bancada do Governo.
 *
 * Mesma lógica do tooltip dos deputados — sobreposição fixa no topo, sem
 * seguir o rato — mas sem cor nem logótipo de partido: mostra o cargo, que é
 * o que identifica um membro do Governo.
 */
export const TooltipGovernante = () => {
  const { governanteHover, governanteSelecionado, selecionarGovernante } = useParlamento();
  const isMobile = useIsMobile();
  const isTouch = useIsTouch();

  if (!governanteHover || governanteSelecionado) return null;

  const estilo = {
    position: 'fixed',
    top: isMobile ? '156px' : '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 100,
    pointerEvents: isTouch ? 'auto' : 'none',
  };

  return (
    <div style={estilo}>
      <div
        onClick={() => isTouch && selecionarGovernante(governanteHover)}
        className="bg-white/95 backdrop-blur border border-gray-200 rounded-xl shadow-lg px-4 py-2 text-center"
      >
        <p className="text-sm font-semibold text-gray-900 leading-tight">{governanteHover.nome}</p>
        <p className="text-[11px] text-gray-500 leading-snug">{governanteHover.cargo ?? 'Governo'}</p>
        <p className="text-[10px] text-gray-400 mt-0.5">
          {governanteHover.intervencoes} {governanteHover.intervencoes === 1 ? 'intervenção' : 'intervenções'}
          {isTouch && ' · tocar para abrir'}
        </p>
      </div>
    </div>
  );
};
