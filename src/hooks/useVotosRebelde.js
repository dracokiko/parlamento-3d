import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useVotosRebelde(nomeDeputado) {
  const [votos,      setVotos]      = useState([]);
  const [titulos,    setTitulos]    = useState({});
  const [carregando, setCarregando] = useState(false);
  const [erro,       setErro]       = useState(null);

  useEffect(() => {
    if (!nomeDeputado) { setVotos([]); setErro(null); return; }

    let vivo = true;
    async function carregar() {
      setCarregando(true);
      setErro(null);

      // PostgREST @> para JSONB array: encontra votações onde deputados_isolados
      // contém pelo menos um elemento com esse nome e rebelde:true
      const { data, error } = await supabase
        .from('ar_votacoes')
        .select('id, iniciativa_id, data_votacao, resultado, fase, deputados_isolados')
        .filter('deputados_isolados', 'cs', JSON.stringify([{ nome: nomeDeputado, rebelde: true }]))
        .order('data_votacao', { ascending: false });

      if (!vivo) return;

      if (error) {
        console.error('[useVotosRebelde] erro ao carregar votações:', error.message);
        setErro(error.message);
        setVotos([]);
        setCarregando(false);
        return;
      }

      const lista = data ?? [];
      setVotos(lista);

      const ids = [...new Set(lista.map(v => v.iniciativa_id).filter(Boolean))];
      if (ids.length) {
        const { data: inis, error: erroInis } = await supabase
          .from('ar_iniciativas')
          .select('id, titulo')
          .in('id', ids);
        if (erroInis) console.error('[useVotosRebelde] erro ao carregar títulos:', erroInis.message);
        if (vivo) setTitulos(Object.fromEntries((inis ?? []).map(i => [i.id, i.titulo])));
      }

      if (vivo) setCarregando(false);
    }

    carregar();
    return () => { vivo = false; };
  }, [nomeDeputado]);

  return { votos, titulos, carregando, erro };
}
