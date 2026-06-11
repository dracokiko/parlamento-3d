import { partidos, ordemHemiciclo } from '../../data/mockPartidos';

// Ordenação por nº de deputados (maior → menor) apenas para a legenda.
// ordemHemiciclo mantém a ordem espacial no hemiciclo 3D.
const ordemLegenda = [...ordemHemiciclo].sort(
  (a, b) => (partidos[b]?.deputados ?? 0) - (partidos[a]?.deputados ?? 0)
);
import { useParlamento } from '../../context/ParlamentoContext';

/**
 * Legenda dos partidos políticos.
 *
 * Mostra:
 * - Cor identificativa
 * - Sigla e nome do partido
 * - Número de deputados
 *
 * Clicar num partido destaca-o no hemiciclo 3D (a câmara aproxima-se
 * dessa zona e os deputados dos outros partidos ficam esbatidos).
 */
export const LegendaPartidos = ({ onSelect } = {}) => {
  const { partidoDestaque, destacarPartido } = useParlamento();

  return (
    <div className="p-3 w-full">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
        Grupos parlamentares
      </h3>
      <div className="space-y-0.5">
        {ordemLegenda.map((idPartido) => {
          const partido = partidos[idPartido];
          const ativo = partidoDestaque === idPartido;
          const inativo = partidoDestaque !== null && partidoDestaque !== idPartido;

          return (
            <button
              key={idPartido}
              onClick={() => { destacarPartido(idPartido); onSelect?.(); }}
              className={`
                w-full flex items-center gap-2 px-2 py-1.5 rounded-md
                text-left transition-all duration-200
                ${ativo ? 'bg-white/10 ring-1 ring-blue-400' : ''}
                ${inativo ? 'opacity-30' : 'hover:bg-white/5'}
              `}
              aria-label={`Destacar ${partido.nome} (${partido.deputados} deputados)`}
            >
              {partido.logo ? (
                <img
                  src={partido.logo}
                  alt={partido.id}
                  style={{ height: '18px', width: 'auto', flexShrink: 0, display: 'block' }}
                />
              ) : (
                <span
                  className="inline-block w-3.5 h-3.5 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: partido.cor }}
                />
              )}
              <span className="font-medium text-sm text-gray-100 flex-shrink-0">
                {partido.id}
              </span>
              <span className="text-xs text-gray-400 truncate flex-1">
                {partido.nome}
              </span>
              <span className="text-xs font-mono text-gray-500 flex-shrink-0">
                {partido.deputados}
              </span>
            </button>
          );
        })}
      </div>

      {partidoDestaque && (
        <button
          onClick={() => destacarPartido(partidoDestaque)}
          className="mt-2 text-xs text-blue-400 hover:text-blue-300 px-2"
        >
          ← Limpar destaque
        </button>
      )}
    </div>
  );
};
