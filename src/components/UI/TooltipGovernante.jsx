import { Mic } from 'lucide-react';
import { useParlamento } from '../../context/ParlamentoContext';
import { useIsMobile, useIsTouch } from '../../hooks/useIsMobile';
import { RetratoGovernante, VERDE_GOVERNO } from './RetratoGovernante';

/**
 * Cartão de quem está sob o cursor na bancada do Governo.
 *
 * Com retrato: é a cara que identifica uma pessoa, e sem ela o cartão era
 * três linhas de texto a pairar no ecrã. Sem cor de partido — o Governo não
 * é um grupo parlamentar — mas com o verde da bancada, para se perceber de
 * onde veio o cartão.
 */
export const TooltipGovernante = () => {
  const { governanteHover, governanteSelecionado, selecionarGovernante } = useParlamento();
  const isMobile = useIsMobile();
  const isTouch = useIsTouch();

  if (!governanteHover || governanteSelecionado) return null;

  const { nome, cargo, partido, foto, intervencoes } = governanteHover;

  return (
    <div
      style={{
        position: 'fixed',
        top: isMobile ? '150px' : '18px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        pointerEvents: isTouch ? 'auto' : 'none',
      }}
    >
      <div
        onClick={() => isTouch && selecionarGovernante(governanteHover)}
        className="flex items-center gap-3 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200/80 pl-3 pr-4 py-2.5 max-w-[22rem] overflow-hidden"
      >
        {/* Faixa da bancada, encostada à esquerda */}
        <span className="absolute left-0 top-0 h-full w-1" style={{ background: VERDE_GOVERNO }} />

        <RetratoGovernante nome={nome} foto={foto} tamanho={54} />

        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 leading-tight truncate">{nome}</p>
          <p className="text-[11px] text-gray-500 leading-snug line-clamp-2">{cargo ?? 'Membro do Governo'}</p>
          <div className="flex items-center gap-2 mt-1">
            {partido && (
              <span className="text-[10px] font-semibold text-gray-600 bg-gray-100 rounded-full px-1.5 py-px">
                {partido}
              </span>
            )}
            <span className="flex items-center gap-1 text-[10px] text-gray-400">
              <Mic size={9} />
              {intervencoes} {intervencoes === 1 ? 'intervenção' : 'intervenções'}
            </span>
          </div>
        </div>
      </div>

      {isTouch && (
        <p className="text-[10px] text-center text-gray-500 mt-1">tocar para abrir</p>
      )}
    </div>
  );
};
