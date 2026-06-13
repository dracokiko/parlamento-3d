import { useMemo } from 'react';
import { useParlamento } from '../context/ParlamentoContext';
import { nomeCorresponde } from '../utils/formatters';

/**
 * Devolve as intervenções de um deputado a partir do cache pré-carregado no contexto.
 * Resultado instantâneo — sem queries ao Supabase.
 */
export function useIntervencoesDeputado(nomeParlamentar) {
  const { intervencoesMapa } = useParlamento();

  const intervencoes = useMemo(() => {
    if (!nomeParlamentar || !intervencoesMapa.size) return [];

    const termo = nomeParlamentar.toLowerCase();
    const resultado = [];

    for (const [key, ivs] of intervencoesMapa) {
      if (key === termo || nomeCorresponde(key, termo)) {
        resultado.push(...ivs);
      }
    }

    return resultado.sort((a, b) =>
      (b.data_debate ?? '').localeCompare(a.data_debate ?? '')
    );
  }, [nomeParlamentar, intervencoesMapa]);

  const carregando = intervencoesMapa.size === 0;

  return { intervencoes, carregando };
}
