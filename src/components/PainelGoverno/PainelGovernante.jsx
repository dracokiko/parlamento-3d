import { useMemo } from 'react';
import { X, Mic, CalendarDays, Landmark } from 'lucide-react';
import { useParlamento } from '../../context/ParlamentoContext';
import { SecaoIntervencoes } from '../PainelDeputado/PainelDeputado';
import { formatarDataCurta, obterIniciais } from '../../utils/formatters';

/**
 * Painel de um membro do Governo, aberto ao clicar na bancada.
 *
 * Mais magro do que o do deputado, e de propósito: um governante não tem
 * círculo eleitoral, nem grupo parlamentar, nem iniciativas suas, nem
 * presenças em plenário. O que temos dele são as intervenções — e é isso que
 * o painel mostra, reaproveitando a mesma lista do painel dos deputados.
 */
export const PainelGovernante = () => {
  const { governanteSelecionado, fecharPainelGoverno, intervencoesMapa, iniciativasIdMapa } = useParlamento();

  const intervencoes = useMemo(() => {
    if (!governanteSelecionado) return [];
    const lista = intervencoesMapa.get(governanteSelecionado.nome.toLowerCase()) ?? [];
    return [...lista].sort((a, b) => (b.data_debate ?? '').localeCompare(a.data_debate ?? ''));
  }, [governanteSelecionado, intervencoesMapa]);

  if (!governanteSelecionado) return null;

  const { nome, cargo, ultima, primeira, partido, desde } = governanteSelecionado;

  return (
    <div className="fixed top-0 right-0 h-full w-full sm:w-[420px] bg-white shadow-2xl z-50 flex flex-col">
      <div className="border-b border-gray-100 p-4" style={{ borderLeft: '4px solid #6b7280' }}>
        <div className="flex items-start gap-3">
          {/* Retrato quando a composição oficial o traz (Commons); iniciais
              quando não há, como nos deputados sem foto. */}
          {governanteSelecionado.foto ? (
            <img
              src={governanteSelecionado.foto}
              alt={nome}
              loading="lazy"
              className="w-11 h-11 rounded-full object-cover flex-shrink-0 border border-gray-200"
            />
          ) : (
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
              style={{ background: '#6b7280' }}
            >
              {obterIniciais(nome)}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-gray-900 leading-tight truncate">{nome}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Landmark size={11} className="text-gray-400 flex-shrink-0" />
              <span className="text-xs text-gray-500 leading-snug">{cargo ?? 'Membro do Governo'}</span>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              Membro do Governo{partido ? ` (${partido})` : ''} — não é deputado, por isso não ocupa lugar
              no hemiciclo.{desde ? ` Em funções desde ${desde}.` : ''}
            </p>
          </div>

          <button
            onClick={fecharPainelGoverno}
            className="text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex gap-4 mt-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Mic size={11} className="text-gray-400" />
            {intervencoes.length} {intervencoes.length === 1 ? 'intervenção' : 'intervenções'}
          </span>
          {(primeira || ultima) && (
            <span className="flex items-center gap-1">
              <CalendarDays size={11} className="text-gray-400" />
              {primeira && formatarDataCurta(primeira)}
              {primeira && ultima && primeira !== ultima && ` – ${formatarDataCurta(ultima)}`}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <SecaoIntervencoes
          intervencoes={intervencoes}
          carregando={false}
          corPartido="#6b7280"
          onVerIniciativa={() => {}}
          iniciativasIdMapa={iniciativasIdMapa}
        />
      </div>
    </div>
  );
};
