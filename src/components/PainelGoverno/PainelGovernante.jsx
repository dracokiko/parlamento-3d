import { useMemo } from 'react';
import { X, Mic, CalendarDays, Landmark } from 'lucide-react';
import { useParlamento } from '../../context/ParlamentoContext';
import { SecaoIntervencoes } from '../PainelDeputado/PainelDeputado';
import { formatarDataCurta } from '../../utils/formatters';
import { RetratoGovernante, VERDE_GOVERNO } from '../UI/RetratoGovernante';

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
    const nome = governanteSelecionado.nome;

    // A mesma tolerância que a bancada usa para contar: o Diário e a
    // composição nem sempre escrevem o nome por extenso da mesma maneira, e
    // sem isto o cartão dizia 247 intervenções e a lista aparecia vazia.
    let lista = intervencoesMapa.get(nome.toLowerCase());
    if (!lista) {
      const partes = nome.toLowerCase().split(/\s+/);
      for (const [chave, valores] of intervencoesMapa) {
        const outras = chave.split(/\s+/);
        if (outras[0] === partes[0] && outras[outras.length - 1] === partes[partes.length - 1]) {
          lista = valores;
          break;
        }
      }
    }

    return [...(lista ?? [])].sort((a, b) => (b.data_debate ?? '').localeCompare(a.data_debate ?? ''));
  }, [governanteSelecionado, intervencoesMapa]);

  if (!governanteSelecionado) return null;

  const { nome, cargo, ultima, primeira, partido, desde } = governanteSelecionado;

  return (
    <div className="fixed top-0 right-0 h-full w-full sm:w-[420px] bg-white shadow-2xl z-50 flex flex-col">
      {/* Cartão de apresentação: retrato grande sobre um fundo em verde da
          bancada, para o painel do Governo se distinguir do de um deputado
          sem recorrer a cor de partido, que aqui não existe. */}
      <div className="relative">
        <div
          className="h-20"
          style={{ background: `linear-gradient(135deg, ${VERDE_GOVERNO} 0%, #4e7a66 100%)` }}
        />

        <button
          onClick={fecharPainelGoverno}
          className="absolute top-3 right-3 text-white/80 hover:text-white transition-colors"
          aria-label="Fechar"
        >
          <X size={18} />
        </button>

        <div className="px-4 pb-4 -mt-10">
          <RetratoGovernante nome={nome} foto={governanteSelecionado.foto} tamanho={84} />

          <p className="text-lg font-semibold text-gray-900 leading-tight mt-2">{nome}</p>

          <div className="flex items-start gap-1.5 mt-1">
            <Landmark size={12} className="text-gray-400 flex-shrink-0 mt-0.5" />
            <span className="text-sm text-gray-600 leading-snug">{cargo ?? 'Membro do Governo'}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-2.5">
            {partido && (
              <span className="text-[11px] font-semibold text-gray-700 bg-gray-100 rounded-full px-2 py-0.5">
                {partido}
              </span>
            )}
            {desde && (
              <span className="text-[11px] text-gray-500 bg-gray-50 border border-gray-100 rounded-full px-2 py-0.5">
                Em funções desde {desde}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
              <p className="text-base font-semibold text-gray-900 tabular-nums">{intervencoes.length}</p>
              <p className="text-[10px] text-gray-500 flex items-center gap-1">
                <Mic size={9} /> {intervencoes.length === 1 ? 'intervenção' : 'intervenções'}
              </p>
            </div>
            {(primeira || ultima) && (
              <div className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                <p className="text-[11px] font-medium text-gray-800 leading-tight">
                  {primeira && formatarDataCurta(primeira)}
                  {primeira && ultima && primeira !== ultima && ` – ${formatarDataCurta(ultima)}`}
                </p>
                <p className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5">
                  <CalendarDays size={9} /> no plenário
                </p>
              </div>
            )}
          </div>

          <p className="text-[11px] text-gray-400 mt-3 leading-snug">
            Membro do Governo — não é deputado, por isso não ocupa lugar no hemiciclo.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <SecaoIntervencoes
          intervencoes={intervencoes}
          carregando={false}
          corPartido={VERDE_GOVERNO}
          onVerIniciativa={() => {}}
          iniciativasIdMapa={iniciativasIdMapa}
        />
      </div>
    </div>
  );
};
