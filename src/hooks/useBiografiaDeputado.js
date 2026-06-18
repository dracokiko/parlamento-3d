import { useMemo } from 'react';
import { useParlamento } from '../context/ParlamentoContext';

export function useBiografiaDeputado(cadId) {
  const { biografiasMapa } = useParlamento();

  const bio = useMemo(() => {
    if (cadId == null) return null;
    return biografiasMapa.get(String(cadId)) ?? null;
  }, [biografiasMapa, cadId]);

  return { bio, carregando: false };
}
