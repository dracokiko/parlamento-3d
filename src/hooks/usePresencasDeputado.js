import { useMemo } from 'react';
import { useParlamento } from '../context/ParlamentoContext';

export function usePresencasDeputado(bid) {
  const { presencasMapa } = useParlamento();

  const presencas = useMemo(() => {
    if (!bid) return null;
    return presencasMapa.get(bid) ?? null;
  }, [presencasMapa, bid]);

  return { presencas, carregando: false };
}