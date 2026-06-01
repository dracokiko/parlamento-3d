import PropTypes from 'prop-types';
import { Sparkles, Hash } from 'lucide-react';
import { obterEstiloPosicao } from '../../utils/formatters';

/**
 * Card destacado com o resumo gerado por IA da intervenção.
 *
 * Estrutura:
 * - Badge "Resumo gerado por IA"
 * - Contexto (uma frase sobre o tema específico)
 * - Pontos principais (bullets)
 * - Posição (badge colorido: a favor / contra / neutra)
 * - Tom da intervenção
 * - Tags/palavras-chave
 *
 * O design destaca visualmente que é conteúdo gerado por IA
 * (não é a fonte primária), criando expectativa correta no utilizador.
 */
export const ResumoIA = ({ resumo }) => {
  const estiloPosicao = obterEstiloPosicao(resumo.posicao);

  return (
    <div className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50
                    rounded-lg p-5 space-y-4">
      {/* Badge IA */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1
                        bg-purple-600 text-white text-xs font-medium rounded-full">
          <Sparkles size={12} />
          Resumo gerado por IA
        </span>

        {/* Badge de posição */}
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1
                      text-xs font-medium rounded-full border
                      ${estiloPosicao.bg} ${estiloPosicao.text} ${estiloPosicao.border}`}
        >
          <span className="text-base leading-none">{estiloPosicao.icon}</span>
          {estiloPosicao.label}
        </span>
      </div>

      {/* Contexto */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
          Contexto
        </h4>
        <p className="text-sm text-gray-800 leading-relaxed">
          {resumo.contexto}
        </p>
      </div>

      {/* Pontos principais */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Pontos principais
        </h4>
        <ul className="space-y-2">
          {resumo.pontosPrincipais.map((ponto, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-800">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-500
                              flex-shrink-0 mt-1.5" aria-hidden="true" />
              <span className="leading-relaxed">{ponto}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Tom */}
      <div className="pt-3 border-t border-purple-200/50">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Tom da intervenção
            </h4>
            <p className="text-sm font-medium text-gray-800 mt-0.5">
              {resumo.tom}
            </p>
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5">
          {resumo.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-0.5 px-2 py-0.5
                         bg-white text-blue-700 text-xs rounded-full
                         border border-blue-200 font-medium"
            >
              <Hash size={10} />
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Disclaimer pequeno */}
      <p className="text-xs text-gray-500 italic pt-2 border-t border-purple-200/50">
        Resumo automático — para a versão integral, consulte a transcrição oficial.
      </p>
    </div>
  );
};

ResumoIA.propTypes = {
  resumo: PropTypes.shape({
    contexto: PropTypes.string.isRequired,
    pontosPrincipais: PropTypes.arrayOf(PropTypes.string).isRequired,
    posicao: PropTypes.string.isRequired,
    tom: PropTypes.string.isRequired,
    tags: PropTypes.arrayOf(PropTypes.string).isRequired
  }).isRequired
};
