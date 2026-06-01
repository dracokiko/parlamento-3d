import PropTypes from 'prop-types';
import { Calendar, Clock, Star, ChevronRight } from 'lucide-react';
import { useParlamento } from '../../context/ParlamentoContext';
import { formatarDataCurta } from '../../utils/formatters';

/**
 * Lista de cards de reuniões plenárias onde o deputado interveio.
 *
 * Cada card mostra:
 * - Data
 * - Título da reunião
 * - Tema/área
 * - Número de intervenções
 * - Badge se for debate importante
 *
 * Clicar abre a vista detalhada da intervenção (Nível 3).
 */
export const ListaIntervencoes = ({ intervencoes }) => {
  const { abrirIntervencao } = useParlamento();

  if (!intervencoes || intervencoes.length === 0) {
    return (
      <p className="text-sm text-gray-500 italic text-center py-4">
        Sem intervenções registadas.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {intervencoes.map((intervencao) => (
        <button
          key={intervencao.id}
          onClick={() => abrirIntervencao(intervencao)}
          className="w-full text-left bg-white border border-gray-200 rounded-lg p-3
                     hover:border-blue-300 hover:shadow-md transition-all duration-200
                     group"
        >
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              {/* Data + badges */}
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Calendar size={12} />
                  <span>{formatarDataCurta(intervencao.reuniao.data)}</span>
                </div>

                {intervencao.reuniao.importante && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5
                                   bg-amber-100 text-amber-800 text-xs rounded-full
                                   font-medium">
                    <Star size={10} />
                    Importante
                  </span>
                )}

                <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 text-xs
                                rounded-full font-medium">
                  {intervencao.reuniao.tema}
                </span>
              </div>

              {/* Título */}
              <h4 className="text-sm font-medium text-gray-900 leading-snug mb-1.5">
                {intervencao.reuniao.titulo}
              </h4>

              {/* Metadados */}
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Clock size={11} />
                  {intervencao.intervencao.duracao}
                </span>
                <span>•</span>
                <span>{intervencao.intervencao.tipo}</span>
              </div>
            </div>

            <ChevronRight
              size={18}
              className="text-gray-300 group-hover:text-blue-500
                         group-hover:translate-x-0.5 transition-all"
            />
          </div>
        </button>
      ))}
    </div>
  );
};

ListaIntervencoes.propTypes = {
  intervencoes: PropTypes.array.isRequired
};
