import { useMemo } from 'react';
import { useParlamento } from '../context/ParlamentoContext';
import { nomeCorresponde } from '../utils/formatters';

/**
 * Devolve as intervenções de um deputado a partir do cache pré-carregado no contexto.
 * Resultado instantâneo — sem queries ao Supabase.
 */
export function useIntervencoesDeputado(nomeParlamentar, partidoSigla) {
  const { intervencoesMapa } = useParlamento();

  const intervencoes = useMemo(() => {
    if (!nomeParlamentar || !intervencoesMapa.size) return [];

    const termo   = nomeParlamentar.toLowerCase();
    const partido = partidoSigla?.toUpperCase() ?? null;
    const resultado = [];

    for (const [key, ivs] of intervencoesMapa) {
      if (key === termo || nomeCorresponde(key, termo)) {
        // Filtrar pelo partido quando disponível — rejeita erros de transcrição
        // onde o DAR atribui a sigla errada a uma interjeição
        const filtradas = partido
          ? ivs.filter(iv => !iv.partido || iv.partido.toUpperCase() === partido)
          : ivs;
        resultado.push(...filtradas);
      }
    }

    return resultado.sort((a, b) =>
      (b.data_debate ?? '').localeCompare(a.data_debate ?? '')
    );
  }, [nomeParlamentar, intervencoesMapa]);

  const carregando = intervencoesMapa.size === 0;

  return { intervencoes, carregando };
}
