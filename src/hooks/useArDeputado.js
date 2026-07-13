import { useMemo } from 'react';
import { useParlamento } from '../context/ParlamentoContext';
import { nomeCorresponde } from '../utils/formatters';

/**
 * Devolve perfil e iniciativas de um deputado a partir do cache pré-carregado.
 * Resultado instantâneo — sem queries ao Supabase.
 */
export function useArDeputado(deputado) {
  const { perfisMapa, iniciativasMapa } = useParlamento();

  return useMemo(() => {
    if (!deputado) return { perfil: null, iniciativas: [], carregando: false, erro: null };

    const nomeAbrev = (deputado.nomeAbrev ?? '').toLowerCase();

    // Perfil — exacto primeiro, depois primeiro+último token
    let perfil = perfisMapa.get(nomeAbrev) ?? null;
    if (!perfil) {
      for (const [key, p] of perfisMapa) {
        if (nomeCorresponde(key, nomeAbrev)) { perfil = p; break; }
      }
    }

    const cadId      = perfil?.cad_id ? String(perfil.cad_id) : null;
    const iniciativas = cadId ? (iniciativasMapa.get(cadId) ?? []) : [];
    const carregando  = perfisMapa.size === 0 || iniciativasMapa.size === 0;

    return { perfil, iniciativas, carregando, erro: null };
    // Memoiza por deputado?.id (não pelo objecto) de propósito — o objecto `deputado`
    // pode ter uma referência nova a cada render sem o id mudar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deputado?.id, perfisMapa, iniciativasMapa]);
}
