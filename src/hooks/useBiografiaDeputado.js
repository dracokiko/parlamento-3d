import { useMemo } from 'react';
import { useParlamento } from '../context/ParlamentoContext';

export function useBiografiaDeputado(nomeAbrev) {
  const { biografiasMapa } = useParlamento();

  const bio = useMemo(() => {
    if (!nomeAbrev) return null;
    return biografiasMapa.get(nomeAbrev.toLowerCase()) ?? null;
  }, [biografiasMapa, nomeAbrev]);

  return { bio, carregando: false };
}