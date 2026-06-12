import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useBiografiaDeputado(nomeAbrev) {
  const [bio, setBio] = useState(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!nomeAbrev) { setBio(null); return; }

    let cancelado = false;
    setCarregando(true);
    setBio(null);

    supabase
      .from('ar_biografias')
      .select('*')
      .ilike('nome_abrev', nomeAbrev)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelado) {
          setBio(data ?? null);
          setCarregando(false);
        }
      });

    return () => { cancelado = true; };
  }, [nomeAbrev]);

  return { bio, carregando };
}
