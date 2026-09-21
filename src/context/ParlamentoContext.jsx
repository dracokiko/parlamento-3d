import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { supabase } from '../lib/supabase';
import { mapaLugares, calcularFocoPartido } from '../utils/posicoes3D';
import { ordenarPorPrecedencia, cargoCredivel } from '../utils/governo';

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

/**
 * A Mesa da Assembleia, a partir dos cargos que a AR publica em
 * ar_deputados (DepCargo, com datas).
 *
 * O Regimento diz que, nas reuniões plenárias, a Mesa é constituída pelo
 * Presidente da Assembleia e pelos Secretários — os Vice-Presidentes
 * substituem o Presidente na cadeira e os Vice-Secretários substituem os
 * Secretários, mas não se sentam à Mesa ao mesmo tempo. É por isso que só
 * estes dois cargos vão para a cena.
 */
function derivarMesa(perfis) {
  const hoje = new Date().toISOString().slice(0, 10);
  const emFuncoes = (c) => (c.carDtInicio ?? '') <= hoje && (!c.carDtFim || c.carDtFim >= hoje);

  const porCargo = { Presidente: [], 'Vice-Presidente': [], 'Secretário': [], 'Vice-Secretário': [] };

  for (const p of perfis) {
    const cargos = p.DepCargo;
    if (!cargos) continue;
    for (const c of (Array.isArray(cargos) ? cargos : [cargos])) {
      if (!emFuncoes(c) || !porCargo[c.carDes]) continue;
      porCargo[c.carDes].push({ nome: p.nome_parlamentar, partido: p.partido_sigla, cargo: c.carDes, desde: c.carDtInicio });
    }
  }

  const porNome = (a, b) => a.nome.localeCompare(b.nome, 'pt');
  return {
    presidente:      porCargo.Presidente[0] ?? null,
    secretarios:     porCargo['Secretário'].sort(porNome),
    vicePresidentes: porCargo['Vice-Presidente'].sort(porNome),
    viceSecretarios: porCargo['Vice-Secretário'].sort(porNome),
  };
}

/**
 * Os membros do Governo que falaram em plenário, um por pessoa.
 *
 * Não há tabela de governantes — o Governo não é eleito para a Assembleia e
 * quem lá entra suspende o mandato de deputado. O que existe são as suas
 * intervenções, com o cargo que o DAR lhes dá. O cargo mostrado é o da
 * intervenção mais recente: quem muda de pasta aparece na actual, não na
 * primeira que teve.
 */
function derivarMembrosGoverno(intervencoes) {
  const porPessoa = new Map();

  for (const iv of intervencoes) {
    if (iv.papel !== 'governo' || !iv.nome_dep) continue;
    const actual = porPessoa.get(iv.nome_dep) ?? { nome: iv.nome_dep, cargo: iv.cargo, intervencoes: 0, ultima: '', primeira: '' };
    actual.intervencoes++;
    const data = iv.data_debate ?? '';
    if (data > actual.ultima)   { actual.ultima = data; actual.cargo = iv.cargo ?? actual.cargo; }
    if (!actual.primeira || (data && data < actual.primeira)) actual.primeira = data;
    porPessoa.set(iv.nome_dep, actual);
  }

  const identificados = [...porPessoa.values()].filter(m =>
    // Sem nome próprio (o DAR nunca o nomeou) não há quem sentar, e uma
    // cadeira chamada "Ministro das Finanças" não é ninguém.
    cargoCredivel(m.cargo) && m.nome !== m.cargo,
  );

  return ordenarPorPrecedencia(juntarVariantesDeNome(identificados));
}

/**
 * O DAR trata a mesma pessoa por "Rita Alarcão Júdice" e "Rita Júdice".
 * Com o mesmo cargo e o mesmo primeiro e último nome, é a mesma pessoa —
 * fica o nome mais completo, e as intervenções somam-se.
 */
function juntarVariantesDeNome(membros) {
  const mesmaPessoa = (a, b) => {
    if (a.cargo !== b.cargo) return false;
    const pa = a.nome.toLowerCase().split(/\s+/), pb = b.nome.toLowerCase().split(/\s+/);
    return pa[0] === pb[0] && pa[pa.length - 1] === pb[pb.length - 1];
  };

  const juntos = [];
  for (const m of membros) {
    const igual = juntos.find(j => mesmaPessoa(j, m));
    if (!igual) { juntos.push({ ...m }); continue; }
    igual.intervencoes += m.intervencoes;
    if (m.nome.length > igual.nome.length) igual.nome = m.nome;
    if ((m.ultima ?? '') > (igual.ultima ?? '')) igual.ultima = m.ultima;
  }
  return juntos;
}

export const ParlamentoProvider = ({ children }) => {
  // ─── Dados remotos ────────────────────────────────────────────────────────
  const [deputados, setDeputados]   = useState([]);
  const [posicoes3D, setPosicoes3D] = useState(new Map());
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro]             = useState(null);

  // Pré-carregados no arranque para acesso instantâneo ao clicar num deputado
  const [perfisMapa, setPerfisMapa]               = useState(new Map());
  const [intervencoesMapa, setIntervencoesMapa]   = useState(new Map());
  const [iniciativasMapa, setIniciativasMapa]     = useState(new Map());
  const [iniciativasIdMapa, setIniciativasIdMapa] = useState(new Map()); // id → iniciativa
  const [biografiasMapa, setBiografiasMapa]       = useState(new Map());
  const [presencasMapa, setPresencasMapa]         = useState(new Map());
  // Membros do Governo que usaram da palavra em plenário — derivados das
  // intervenções, porque não são deputados e não existem em lado nenhum na
  // base como pessoas. É esta lista que povoa a bancada do Governo.
  const [membrosGoverno, setMembrosGoverno]       = useState([]);
  // Composição oficial do Governo (tabela governo_membros), quando existe.
  const [governoOficial, setGovernoOficial]       = useState(null);
  // Quem se senta à Mesa: Presidente e Secretários em funções.
  const [mesaAR, setMesaAR]                       = useState({ presidente: null, secretarios: [], vicePresidentes: [], viceSecretarios: [] });

  // Flags individuais para saber quando cada recurso terminou
  const [perfisProntos, setPerfisProntos]             = useState(false);
  const [intervencoesProntas, setIntervencoesProntas] = useState(false);
  const [iniciativasProntas, setIniciativasProntas]   = useState(false);
  const [biografiasProntas, setBiografiasProntas]     = useState(false);
  const [presencasProntas, setPresencasProntas]       = useState(false);
  const [cena3DPronta, setCena3DPronta]               = useState(false);

  useEffect(() => {
    const LOTE = 1000;

    const paginar = async (tabela, campos, ordenar, filtrar) => {
      const todos = [];
      for (let i = 0; ; i += LOTE) {
        let q = supabase.from(tabela).select(campos).range(i, i + LOTE - 1);
        if (ordenar) q = q.order(ordenar, { ascending: false });
        if (filtrar) q = filtrar(q);
        const { data, error } = await q;
        if (error) {
          console.error(`[paginar] erro em ${tabela} offset=${i}:`, error.message);
          break;
        }
        if (!data?.length) break;
        todos.push(...data);
        if (data.length < LOTE) break;
      }
      return todos;
    };

    // Perfis AR — paginar para não perder deputados além do limite de 1000 linhas do Supabase
    paginar('ar_deputados', 'id, cad_id, nome_parlamentar, nome_completo, partido_sigla, circulo, resumo_ia, resumo_ia_iniciativas, json_raw->DepCargo', null, q => q.eq('legislatura', 'XVII'))
      .then(todos => {
        const mapa = new Map();
        todos.forEach(p => { if (p.nome_parlamentar) mapa.set(p.nome_parlamentar.toLowerCase(), p); });
        setPerfisMapa(mapa);
        setMesaAR(derivarMesa(todos));
        setPerfisProntos(true);
      });

    // Governo — a composição oficial, quando a tabela já existe. É ela que
    // manda: traz retratos, partido e período, e quem saiu do Governo deixa
    // de vir (em_funcoes). Sem tabela, a bancada continua a ser inferida das
    // intervenções, que é o que havia antes.
    supabase
      .from('governo_membros')
      .select('nome, cargo, partido, foto_url, ordem, inicio, em_funcoes')
      .eq('em_funcoes', true)
      .order('ordem')
      .then(({ data, error }) => {
        if (error) { console.info('[governo] tabela ainda não existe — bancada inferida das intervenções'); return; }
        setGovernoOficial(data ?? []);
      });

    // Intervenções (sem texto — carregado em batch ao abrir painel do deputado)
    paginar('ar_intervencoes', 'id, debate_id, nome_dep, partido, data_debate, assunto, url_diario, num_palavras, fase_debate, iniciativa_id, papel, cargo', 'data_debate')
      .then(todas => {
        const mapa = new Map();
        todas.forEach(iv => {
          const key = (iv.nome_dep ?? '').toLowerCase();
          if (!mapa.has(key)) mapa.set(key, []);
          mapa.get(key).push(iv);
        });
        setIntervencoesMapa(mapa);
        setMembrosGoverno(derivarMembrosGoverno(todas));
        setIntervencoesProntas(true);
      });

    // Iniciativas (sem eventos e autores_gp — campos pesados desnecessários para listagem)
    paginar('ar_iniciativas', 'id, numero, titulo, epigrafe, desc_tipo, tipo, resumo_ia, data_inicio, data_fim, legislatura, autores_dep, dar_links', 'data_inicio')
      .then(todas => {
        const mapa   = new Map(); // cad_id → [iniciativas]
        const idMapa = new Map(); // id     → iniciativa
        todas.forEach(ini => {
          idMapa.set(String(ini.id), ini);
          (ini.autores_dep ?? []).forEach(a => {
            const cid = a.idCadastro ? String(a.idCadastro) : null;
            if (!cid) return;
            if (!mapa.has(cid)) mapa.set(cid, []);
            mapa.get(cid).push(ini);
          });
        });
        setIniciativasMapa(mapa);
        setIniciativasIdMapa(idMapa);
        setIniciativasProntas(true);
      });

    // Biografias — indexadas por bid (cad_id)
    paginar('ar_biografias', '*', null, null)
      .then(todas => {
        const mapa = new Map();
        todas.forEach(b => { if (b.bid != null) mapa.set(String(b.bid), b); });
        setBiografiasMapa(mapa);
        setBiografiasProntas(true);
      });

    // Presenças — indexadas por bid
    paginar('ar_presencas', '*', null, null)
      .then(todas => {
        const mapa = new Map();
        todas.forEach(p => { if (p.bid != null) mapa.set(String(p.bid), p); });
        setPresencasMapa(mapa);
        setPresencasProntas(true);
      });
  }, []);

  useEffect(() => {
    const carregarDeputados = async () => {
      try {
        // Tenta incluir as colunas opcionais — a foto e o rasto de
        // substituição, que só existe depois de a migração correr. Se o
        // schema cache ainda não as reconhecer, faz fallback sem elas.
        const BASE = 'id, nome, nome_completo, partido_sigla, circulo_eleitoral, lugar';
        let { data, error } = await supabase
          .from('deputados')
          .select(`${BASE}, foto, substitui_nome, substitui_desde`);

        if (error?.message?.includes('substitui')) {
          ({ data, error } = await supabase.from('deputados').select(`${BASE}, foto`));
        }
        if (error?.message?.includes('foto')) {
          console.warn('Coluna foto ainda não no cache do schema — a carregar sem foto. Faz Reload Schema Cache no painel do Supabase.');
          ({ data, error } = await supabase.from('deputados').select(BASE));
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
          // Quem ocupava este lugar antes, quando o actual ocupante entrou a
          // meio da legislatura (substituição). Ausente antes da migração.
          substituiu:        d.substitui_nome ?? null,
          substituiuDesde:   d.substitui_desde ?? null,
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

  // Deputado em hover (para tooltip 3D)
  const [deputadoHover, setDeputadoHover] = useState(null);

  // A sala está virada para o Governo? Muda o que faz sentido mostrar: a
  // publicidade e o brasão sobreposto são da vista do hemiciclo.
  const [vistaGoverno, setVistaGoverno] = useState(false);

  // Membro do Governo selecionado / em hover na bancada
  const [governanteSelecionado, setGovernanteSelecionado] = useState(null);
  const [governanteHover, setGovernanteHover]             = useState(null);

  // Ref partilhada para o OrbitControls do hemiciclo 3D — permite que
  // componentes fora do Canvas (ex: botão de reset em ControlosCamara)
  // chamem métodos da câmara sem recorrer a window.location.reload().
  const cameraControlsRef = useRef(null);

  // Selecionar um deputado (abre painel lateral). Só um painel de cada vez:
  // abrir um deputado fecha o membro do Governo que estivesse aberto.
  const selecionarDeputado = useCallback((deputado) => {
    setGovernanteSelecionado(null);
    setDeputadoSelecionado(deputado);
  }, []);

  // Fechar painel do deputado
  const fecharPainel = useCallback(() => {
    setDeputadoSelecionado(null);
  }, []);

  // Selecionar um membro do Governo na bancada
  const selecionarGovernante = useCallback((membro) => {
    setDeputadoSelecionado(null);
    setGovernanteSelecionado(membro);
  }, []);

  const fecharPainelGoverno = useCallback(() => {
    setGovernanteSelecionado(null);
  }, []);

  // Destacar partido no hemiciclo
  const destacarPartido = useCallback((idPartido) => {
    setPartidoDestaque((atual) => atual === idPartido ? null : idPartido);
  }, []);

  /**
   * Calcula o ponto de foco da câmara para um partido.
   * Encapsula posicoes3D + deputados para que os componentes
   * não precisem de importar diretamente de posicoes3D.js.
   */
  const calcularFocoDePartido = useCallback((idPartido) => {
    return calcularFocoPartido(posicoes3D, deputados, idPartido);
  }, [posicoes3D, deputados]);

  /**
   * Quem ocupa a bancada do Governo.
   *
   * A composição oficial manda, quando existe: é a única que sabe quem está
   * em funções hoje e traz retrato e partido. Sem ela, resta o que se infere
   * das intervenções — que mostra quem já saiu do Governo enquanto houver
   * falas dele no Diário, e é precisamente o que a tabela veio resolver.
   *
   * O número de intervenções vem sempre do Diário, casado pelo nome.
   */
  const bancadaGoverno = useMemo(() => {
    if (!governoOficial?.length) return membrosGoverno;

    // A composição e o Diário nem sempre escrevem o nome da mesma maneira
    // ("Gonçalo Saraiva Matias" e "Gonçalo Matias" são a mesma pessoa, com
    // 247 intervenções). Falhar o cruzamento mostrava-o com zero.
    const chaveAlternativa = (nome) => {
      const partes = nome.toLowerCase().split(/\s+/);
      for (const [chave] of intervencoesMapa) {
        const outras = chave.split(/\s+/);
        if (outras[0] === partes[0] && outras[outras.length - 1] === partes[partes.length - 1]) return chave;
      }
      return null;
    };

    const ehMinistro = (cargo = '') => !/secret[áa]ri[oa]\s+de\s+estado|subsecret/i.test(cargo);

    return governoOficial.map((m) => {
      const chave = m.nome.toLowerCase();
      const suas = intervencoesMapa.get(chave) ?? intervencoesMapa.get(chaveAlternativa(m.nome)) ?? [];
      const datas = suas.map(iv => iv.data_debate ?? '').filter(Boolean).sort();
      return {
        nome: m.nome,
        cargo: m.cargo,
        partido: m.partido,
        foto: m.foto_url ?? null,
        desde: m.inicio ?? null,
        intervencoes: suas.length,
        primeira: datas[0] ?? '',
        ultima: datas[datas.length - 1] ?? '',
        ehMinistro: ehMinistro(m.cargo),
      };
    })
      // Só o Primeiro-Ministro e os ministros. A bancada do Governo não tem
      // lugar para os 43 secretários de Estado: eles descem ao plenário
      // quando o assunto é da sua área, não têm cadeira permanente. As suas
      // intervenções continuam todas na base — o que não têm é lugar.
      .filter(m => m.ehMinistro);
  }, [governoOficial, membrosGoverno, intervencoesMapa]);

  // Memoizar o value para evitar re-renders desnecessários
  const value = useMemo(() => ({
    // Dados
    deputados,
    posicoes3D,
    carregando,
    erro,
    perfisMapa,
    intervencoesMapa,
    iniciativasMapa,
    iniciativasIdMapa,
    biografiasMapa,
    presencasMapa,
    membrosGoverno,
    bancadaGoverno,
    governoOficial,
    mesaAR,
    tudoCarregado: !carregando && perfisProntos && intervencoesProntas && iniciativasProntas && biografiasProntas && presencasProntas && cena3DPronta,
    setCena3DPronta,
    // UI
    deputadoSelecionado,
    partidoDestaque,
    deputadoHover,
    governanteSelecionado,
    governanteHover,
    vistaGoverno,
    // Ações
    selecionarDeputado,
    fecharPainel,
    destacarPartido,
    setDeputadoHover,
    selecionarGovernante,
    fecharPainelGoverno,
    setGovernanteHover,
    setVistaGoverno,
    calcularFocoDePartido,
    cameraControlsRef,
  }), [
    deputados,
    posicoes3D,
    carregando,
    erro,
    perfisMapa,
    intervencoesMapa,
    iniciativasMapa,
    iniciativasIdMapa,
    biografiasMapa,
    presencasMapa,
    membrosGoverno,
    bancadaGoverno,
    governoOficial,
    mesaAR,
    perfisProntos,
    intervencoesProntas,
    iniciativasProntas,
    biografiasProntas,
    presencasProntas,
    cena3DPronta,
    deputadoSelecionado,
    partidoDestaque,
    deputadoHover,
    governanteSelecionado,
    governanteHover,
    vistaGoverno,
    selecionarDeputado,
    selecionarGovernante,
    fecharPainelGoverno,
    fecharPainel,
    destacarPartido,
    calcularFocoDePartido,
    cameraControlsRef,
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
