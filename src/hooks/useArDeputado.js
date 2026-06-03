import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useArDeputado(deputado) {
  const [dados, setDados] = useState({
    perfil:      null,
    iniciativas: [],
    debates:     [],
    carregando:  false,
    erro:        null,
  });

  useEffect(() => {
    if (!deputado) {
      setDados({ perfil: null, iniciativas: [], debates: [], carregando: false, erro: null });
      return;
    }

    let cancelado = false;

    async function carregar() {
      setDados(d => ({ ...d, carregando: true, erro: null }));

      try {
        const nomeAbrev   = deputado.nomeAbrev ?? '';
        const nomeCompleto = deputado.nome ?? '';

        // ── 1. Encontrar perfil em ar_deputados ───────────────
        // Tenta: nome_parlamentar exacto → nome_completo exacto → ilike nome_parlamentar
        let perfil = null;

        if (nomeAbrev) {
          const { data } = await supabase
            .from('ar_deputados')
            .select('id, cad_id, nome_parlamentar, nome_completo, partido_sigla, circulo, resumo_ia')
            .eq('nome_parlamentar', nomeAbrev)
            .limit(1);
          perfil = data?.[0] ?? null;
        }

        if (!perfil && nomeCompleto) {
          const { data } = await supabase
            .from('ar_deputados')
            .select('id, cad_id, nome_parlamentar, nome_completo, partido_sigla, circulo, resumo_ia')
            .eq('nome_completo', nomeCompleto)
            .limit(1);
          perfil = data?.[0] ?? null;
        }

        if (!perfil && nomeAbrev) {
          const { data } = await supabase
            .from('ar_deputados')
            .select('id, cad_id, nome_parlamentar, nome_completo, partido_sigla, circulo, resumo_ia')
            .ilike('nome_parlamentar', `%${nomeAbrev}%`)
            .limit(1);
          perfil = data?.[0] ?? null;
        }

        const cadId         = perfil?.cad_id   ? String(perfil.cad_id)   : null;
        const nomeParlamentar = perfil?.nome_parlamentar ?? nomeAbrev;

        // ── 2. Iniciativas ────────────────────────────────────
        // Tenta por cad_id → fallback por nome
        let iniciativas = [];

        if (cadId) {
          const { data } = await supabase
            .from('ar_iniciativas')
            .select('id, numero, titulo, epigrafe, desc_tipo, tipo, resumo_ia, data_inicio, data_fim, legislatura, autores_dep, autores_gp, eventos')
            .filter('autores_dep', 'cs', JSON.stringify([{ idCadastro: cadId }]))
            .order('data_inicio', { ascending: false })
            .limit(30);
          iniciativas = data ?? [];
        }

        // Fallback: filtra por nome no JSONB autores_dep
        if (!iniciativas.length && nomeParlamentar) {
          const { data } = await supabase
            .from('ar_iniciativas')
            .select('id, numero, titulo, epigrafe, desc_tipo, tipo, resumo_ia, data_inicio, data_fim, legislatura, autores_dep, autores_gp, eventos')
            .filter('autores_dep', 'cs', JSON.stringify([{ nome: nomeParlamentar }]))
            .order('data_inicio', { ascending: false })
            .limit(30);
          iniciativas = data ?? [];
        }

        // ── 3. Debates ────────────────────────────────────────
        let debates = [];
        if (nomeParlamentar) {
          const { data } = await supabase
            .from('ar_debates')
            .select('id, assunto, artigo, tipo_debate, data_debate, sessao, legislatura, autores_dep, autores_gp, url_diario, transcricao, resumo_ia')
            .filter('autores_dep', 'cs', JSON.stringify([{ nome: nomeParlamentar }]))
            .order('data_debate', { ascending: false })
            .limit(20);
          debates = data ?? [];
        }

        if (!cancelado) {
          setDados({ perfil, iniciativas, debates, carregando: false, erro: null });
        }
      } catch (err) {
        if (!cancelado) {
          setDados(d => ({ ...d, carregando: false, erro: err.message }));
        }
      }
    }

    carregar();
    return () => { cancelado = true; };
  }, [deputado?.id]);

  return dados;
}
