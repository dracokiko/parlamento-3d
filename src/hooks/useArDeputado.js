import { useMemo } from 'react';
import { useParlamento } from '../context/ParlamentoContext';

/**
 * Devolve perfil e iniciativas de um deputado a partir do cache pré-carregado.
 * Resultado instantâneo — sem queries ao Supabase.
 */
export function useArDeputado(deputado) {
  const { perfisMapa, iniciativasMapa } = useParlamento();

  return useMemo(() => {
    if (!deputado) return { perfil: null, iniciativas: [], carregando: false, erro: null };

    const nomeAbrev = (deputado.nomeAbrev ?? '').toLowerCase();

    // Perfil — correspondência exacta primeiro, depois parcial
    let perfil = perfisMapa.get(nomeAbrev) ?? null;
    if (!perfil) {
      for (const [key, p] of perfisMapa) {
        if (key.includes(nomeAbrev) || nomeAbrev.includes(key)) { perfil = p; break; }
      }
    }

    const cadId      = perfil?.cad_id ? String(perfil.cad_id) : null;
    const iniciativas = cadId ? (iniciativasMapa.get(cadId) ?? []) : [];
    const carregando  = perfisMapa.size === 0 || iniciativasMapa.size === 0;

    return { perfil, iniciativas, carregando, erro: null };
  }, [deputado?.id, perfisMapa, iniciativasMapa]);
}
