import { useMemo } from 'react';
import { useParlamento } from '../context/ParlamentoContext';

export function usePresencasDeputado(bid) {
  const { presencasMapa } = useParlamento();

  const presencas = useMemo(() => {
    if (bid == null) return null;
    return presencasMapa.get(String(bid)) ?? null;
  }, [presencasMapa, bid]);

  return { presencas, carregando: false };
}