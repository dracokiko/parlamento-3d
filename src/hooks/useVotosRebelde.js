import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useVotosRebelde(nomeDeputado) {
  const [votos,      setVotos]      = useState([]);
  const [titulos,    setTitulos]    = useState({});
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!nomeDeputado) { setVotos([]); return; }

    let vivo = true;
    async function carregar() {
      setCarregando(true);

      // PostgREST @> para JSONB array: encontra votações onde deputados_isolados
      // contém pelo menos um elemento com esse nome e rebelde:true
      const { data } = await supabase
        .from('ar_votacoes')
        .select('id, iniciativa_id, data_votacao, resultado, fase, deputados_isolados')
        .filter('deputados_isolados', 'cs', JSON.stringify([{ nome: nomeDeputado, rebelde: true }]))
        .order('data_votacao', { ascending: false });

      if (!vivo) return;

      const lista = data ?? [];
      setVotos(lista);

      const ids = [...new Set(lista.map(v => v.iniciativa_id).filter(Boolean))];
      if (ids.length) {
        const { data: inis } = await supabase
          .from('ar_iniciativas')
          .select('id, titulo')
          .in('id', ids);
        if (vivo) setTitulos(Object.fromEntries((inis ?? []).map(i => [i.id, i.titulo])));
      }

      if (vivo) setCarregando(false);
    }

    carregar();
    return () => { vivo = false; };
  }, [nomeDeputado]);

  return { votos, titulos, carregando };
}
