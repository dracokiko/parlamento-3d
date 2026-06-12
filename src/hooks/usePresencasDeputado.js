import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function usePresencasDeputado(bid) {
  const [presencas, setPresencas] = useState(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!bid) { setPresencas(null); return; }

    let cancelado = false;
    setCarregando(true);
    setPresencas(null);

    supabase
      .from('ar_presencas')
      .select('*')
      .eq('bid', bid)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelado) {
          setPresencas(data ?? null);
          setCarregando(false);
        }
      });

    return () => { cancelado = true; };
  }, [bid]);

  return { presencas, carregando };
}
