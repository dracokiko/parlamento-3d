import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import { supabase } from '../lib/supabase';
import { mapaLugares, calcularFocoPartido } from '../utils/posicoes3D';

/**
 * Context global da aplicação.
 *
 * Gere dois tipos de estado:
 *
 * 1. Dados remotos (Supabase)
 *    - deputados: lista completa carregada uma vez no arranque
 *    - posicoes3D: Map deputadoId → {position, rotation} construído a partir
 *                 do campo `lugar` de cada deputado (ex: "A1", "C15", "H40")
 *    - carregando / erro: estado do fetch
 *
 * 2. Navegação entre os 3 níveis de UI
 *    - Hemiciclo → Painel do Deputado → Detalhe de Intervenção
 */

const ParlamentoContext = createContext(null);

export const ParlamentoProvider = ({ children }) => {
  // ─── Dados remotos ────────────────────────────────────────────────────────
  const [deputados, setDeputados]   = useState([]);
  const [posicoes3D, setPosicoes3D] = useState(new Map());
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro]             = useState(null);

  useEffect(() => {
    const carregarDeputados = async () => {
      try {
        // Tenta incluir a coluna foto; se o schema cache ainda não a reconhecer,
        // faz fallback sem ela (erro comum após adicionar coluna nova no Supabase).
        let { data, error } = await supabase
          .from('deputados')
          .select('id, nome, nome_completo, partido_sigla, circulo_eleitoral, lugar, foto');

        if (error?.message?.includes('foto')) {
          console.warn('Coluna foto ainda não no cache do schema — a carregar sem foto. Faz Reload Schema Cache no painel do Supabase.');
          ({ data, error } = await supabase
            .from('deputados')
            .select('id, nome, nome_completo, partido_sigla, circulo_eleitoral, lugar'));
        }

        if (error) throw error;

        // Mapear colunas do Supabase para o modelo interno da app
        const mapeados = data.map((d) => ({
          id:                d.id,
          nome:              d.nome_completo || d.nome,
          nomeAbrev:         d.nome,
          partido:           d.partido_sigla,
          circulo:           d.circulo_eleitoral,
          lugar:             d.lugar,           // ex: "A1", "C15", "H40"
          foto:              d.foto ?? null,
          // Campos que ainda não existem no Supabase — ficam null
          taxaPresenca:      null,
          totalIntervencoes: null,
          biografia:         null,
          comissoes:         [],
        }));

        // Construir o mapa de posições 3D por id do deputado.
        // A posição de cada deputado vem diretamente do seu campo `lugar`,
        // usando o mapaLugares estático (calculado a partir da geometria do hemiciclo).
        // Deputados sem `lugar` definido ficam fora do mapa — não aparecem na cena.
        const posMap = new Map();
        for (const dep of mapeados) {
          if (!dep.lugar) continue;
          const pos = mapaLugares.get(dep.lugar);
          if (pos) posMap.set(dep.id, pos);
        }

        setDeputados(mapeados);
        setPosicoes3D(posMap);
      } catch (err) {
        setErro(err.message);
        console.error('Erro ao carregar deputados do Supabase:', err);
      } finally {
        setCarregando(false);
      }
    };

    carregarDeputados();
  }, []);

  // ─── Navegação / estado de UI ─────────────────────────────────────────────

  // Deputado atualmente selecionado (null = nenhum)
  const [deputadoSelecionado, setDeputadoSelecionado] = useState(null);

  // Partido em destaque no hemiciclo (filtro visual)
  const [partidoDestaque, setPartidoDestaque] = useState(null);

  // Intervenção a mostrar em detalhe (modal/drawer aberto)
  const [intervencaoAberta, setIntervencaoAberta] = useState(null);

  // Mostrar transcrição completa em modal
  const [transcricaoAberta, setTranscricaoAberta] = useState(null);

  // Deputado em hover (para tooltip 3D)
  const [deputadoHover, setDeputadoHover] = useState(null);

  // Selecionar um deputado (abre painel lateral)
  const selecionarDeputado = useCallback((deputado) => {
    setDeputadoSelecionado(deputado);
    setIntervencaoAberta(null);
  }, []);

  // Fechar painel do deputado
  const fecharPainel = useCallback(() => {
    setDeputadoSelecionado(null);
    setIntervencaoAberta(null);
    setTranscricaoAberta(null);
  }, []);

  // Destacar partido no hemiciclo
  const destacarPartido = useCallback((idPartido) => {
    setPartidoDestaque((atual) => atual === idPartido ? null : idPartido);
  }, []);

  // Abrir detalhe de uma intervenção
  const abrirIntervencao = useCallback((intervencao) => {
    setIntervencaoAberta(intervencao);
  }, []);

  // Fechar detalhe de intervenção
  const fecharIntervencao = useCallback(() => {
    setIntervencaoAberta(null);
    setTranscricaoAberta(null);
  }, []);

  // Abrir modal de transcrição oficial
  const abrirTranscricao = useCallback((intervencao) => {
    setTranscricaoAberta(intervencao);
  }, []);

  /**
   * Calcula o ponto de foco da câmara para um partido.
   * Encapsula posicoes3D + deputados para que os componentes
   * não precisem de importar diretamente de posicoes3D.js.
   */
  const calcularFocoDePartido = useCallback((idPartido) => {
    return calcularFocoPartido(posicoes3D, deputados, idPartido);
  }, [posicoes3D, deputados]);

  // Memoizar o value para evitar re-renders desnecessários
  const value = useMemo(() => ({
    // Dados
    deputados,
    posicoes3D,
    carregando,
    erro,
    // UI
    deputadoSelecionado,
    partidoDestaque,
    intervencaoAberta,
    transcricaoAberta,
    deputadoHover,
    // Ações
    selecionarDeputado,
    fecharPainel,
    destacarPartido,
    abrirIntervencao,
    fecharIntervencao,
    abrirTranscricao,
    setTranscricaoAberta,
    setDeputadoHover,
    calcularFocoDePartido,
  }), [
    deputados,
    posicoes3D,
    carregando,
    erro,
    deputadoSelecionado,
    partidoDestaque,
    intervencaoAberta,
    transcricaoAberta,
    deputadoHover,
    selecionarDeputado,
    fecharPainel,
    destacarPartido,
    abrirIntervencao,
    fecharIntervencao,
    abrirTranscricao,
    calcularFocoDePartido,
  ]);

  return (
    <ParlamentoContext.Provider value={value}>
      {children}
    </ParlamentoContext.Provider>
  );
};

ParlamentoProvider.propTypes = {
  children: PropTypes.node.isRequired
};

/**
 * Hook personalizado para aceder ao contexto.
 * Lança erro se usado fora do Provider, ajudando no debug.
 */
export const useParlamento = () => {
  const ctx = useContext(ParlamentoContext);
  if (!ctx) {
    throw new Error('useParlamento deve ser usado dentro de <ParlamentoProvider>');
  }
  return ctx;
};
