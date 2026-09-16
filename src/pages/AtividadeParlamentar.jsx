import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Landmark, Gavel, Mic2, Handshake, Plane, CalendarDays, Wallet, FileSearch,
  ExternalLink, CheckCircle2, XCircle, MinusCircle, Search, X, ChevronLeft, ChevronRight,
  MessageSquare, ChevronDown, ChevronUp, HelpCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { partidos as PARTIDOS } from '../data/mockPartidos';
import { useIsMobile } from '../hooks/useIsMobile';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

const GP_COR = Object.fromEntries(Object.entries(PARTIDOS).map(([k, v]) => [k, v.cor]));

// ── Configuração de cada separador ──────────────────────────────────────────
// A maior parte destes recursos vem da mesma fonte (o ficheiro
// AtividadesXVII_json.txt já descarregado diariamente); "Inquéritos" vem da
// tabela de iniciativas, filtrada pelo tipo. `descricao` é o texto que
// explica o conceito, mostrado no topo de cada separador.

const TABS = [
  {
    id: 'votos_mocoes', label: 'Votos e Moções', icon: Gavel, tabela: 'ar_votos_mocoes',
    colunas: 'id, desc_tipo, assunto, numero, data_entrada, resultado, data_votacao, unanime, autores_gp, publicacao, intervencao_ids, observacoes:json_raw->>Observacoes',
    ordenar: 'data_entrada',
    descricao: 'Votos: declarações do plenário sobre um assunto de interesse público (pesar, condenação, saudação, solidariedade) — não criam lei, são uma tomada de posição política. Moções: forçam uma votação sobre a confiança no Governo (censura ou rejeição do programa) — se aprovadas, o Governo cai.',
  },
  {
    id: 'audicoes', label: 'Audições', icon: Mic2, tabela: 'ar_audicoes',
    colunas: 'id, assunto, data, entidades, numero',
    ordenar: 'data',
    descricao: 'Reunião de uma comissão parlamentar com uma entidade externa — associação, autarquia, cidadão — para ouvir a sua posição sobre um assunto em discussão, muitas vezes no âmbito de uma petição.',
  },
  {
    id: 'audiencias', label: 'Audiências', icon: Handshake, tabela: 'ar_audiencias',
    colunas: 'id, assunto, data, entidades, concedida, numero',
    ordenar: 'data',
    descricao: 'Reunião de um deputado ou órgão da Assembleia com uma entidade externa — embaixador, ministro estrangeiro, organização — fora do processo legislativo formal.',
  },
  {
    id: 'deslocacoes', label: 'Deslocações', icon: Plane, tabela: 'ar_deslocacoes',
    colunas: 'id, designacao, tipo, data_inicio, data_fim, local_evento',
    ordenar: 'data_inicio',
    descricao: 'Viagens oficiais de deputados em representação da Assembleia — reuniões interparlamentares, conferências internacionais ou eventos de representação institucional.',
  },
  {
    id: 'eventos', label: 'Eventos', icon: CalendarDays, tabela: 'ar_eventos',
    colunas: 'id, designacao, tipo_evento, data, local_evento',
    ordenar: 'data',
    descricao: 'Iniciativas abertas ao público organizadas pela Assembleia — conferências, seminários, cerimónias e workshops realizados nas suas instalações.',
  },
  {
    id: 'orcamento', label: 'Orçamento', icon: Wallet, tabela: 'ar_orcamento',
    colunas: 'id, titulo, ano, tipo, data_aprovacao_ca',
    ordenar: 'data_aprovacao_ca',
    descricao: 'O processo de aprovação do orçamento e das contas de gerência da própria Assembleia da República — o dinheiro para o seu funcionamento, não o Orçamento do Estado.',
  },
  {
    id: 'inqueritos', label: 'Inquéritos', icon: FileSearch, tabela: 'ar_iniciativas',
    colunas: 'id, numero, titulo, epigrafe, data_inicio, autores_gp',
    ordenar: 'data_inicio',
    filtroEq: ['desc_tipo', 'Inquérito Parlamentar'],
    descricao: 'Comissões criadas pela Assembleia para investigar um assunto de interesse público (ex.: gestão de uma instituição, decisão do Governo) — têm poderes equiparados aos de um tribunal para convocar testemunhas e pedir documentos.',
  },
];

const formatarData = (iso, opts) =>
  iso ? new Date(iso).toLocaleDateString('pt-PT', opts ?? { day: '2-digit', month: 'short', year: 'numeric' }) : null;

/** Página oficial no site da AR para cada tipo de atividade, quando existe. */
function urlOficial(tab, item) {
  switch (tab.id) {
    case 'votos_mocoes': return item.publicacao?.[0]?.URLDiario ?? null;
    case 'audicoes':     return `https://www.parlamento.pt/ActividadeParlamentar/Paginas/DetalheAudicao.aspx?BID=${item.id}`;
    case 'audiencias':   return `https://www.parlamento.pt/ActividadeParlamentar/Paginas/DetalheAudiencia.aspx?BID=${item.id}`;
    case 'deslocacoes':  return `https://www.parlamento.pt/ActividadeParlamentar/Paginas/DetalheDeslocacao.aspx?BID=${item.id}`;
    case 'eventos':      return `https://www.parlamento.pt/ActividadeParlamentar/Paginas/DetalheEvento.aspx?BID=${item.id}`;
    case 'inqueritos':   return `https://www.parlamento.pt/ActividadeParlamentar/Paginas/DetalheIniciativa.aspx?BID=${item.id}`;
    default: return null; // orçamento — sem página de detalhe própria conhecida
  }
}

// ── Badges reutilizáveis ─────────────────────────────────────────────────────

/**
 * Estado de um voto/moção.
 *
 * IMPORTANTE: a ausência de resultado nos dados abertos da AR NÃO significa
 * "ainda por votar" — significa apenas que este conjunto de dados não regista
 * um resultado. Confirmado por cruzamento com as atas do DAR: há votos sem
 * resultado registado que foram aprovados em plenário, outros que foram
 * retirados pelo autor, substituídos por um voto conjunto, ou decididos em
 * comissão. Por isso nunca afirmamos que está "por votar" — dizemos o que
 * sabemos e, quando a AR regista uma observação, mostramos essa observação.
 */
const corResultado = (r, observacoes) => {
  if (r) {
    if (r.toLowerCase().includes('aprovad'))  return { bg: 'bg-green-50', text: 'text-green-700', icon: CheckCircle2, label: r };
    if (r.toLowerCase().includes('rejeitad')) return { bg: 'bg-red-50',   text: 'text-red-700',   icon: XCircle,      label: r };
    return { bg: 'bg-yellow-50', text: 'text-yellow-700', icon: MinusCircle, label: r };
  }
  const obs = (observacoes ?? '').toLowerCase();
  if (/retirad/.test(obs))
    return { bg: 'bg-gray-100', text: 'text-gray-600', icon: XCircle, label: 'Retirado' };
  if (/substituído pelo|substituída pelo|substituido pelo/.test(obs))
    return { bg: 'bg-gray-100', text: 'text-gray-600', icon: MinusCircle, label: 'Substituído' };
  if (/prescindiu|abdica/.test(obs))
    return { bg: 'bg-gray-100', text: 'text-gray-600', icon: MinusCircle, label: 'Votação dispensada' };
  if (/adotado pela|adoptado pela/.test(obs))
    return { bg: 'bg-blue-50', text: 'text-blue-700', icon: CheckCircle2, label: 'Adotado em comissão' };
  return { bg: 'bg-gray-100', text: 'text-gray-500', icon: HelpCircle, label: 'Sem resultado registado' };
};

const AutorBadge = ({ nome }) => {
  const sigla = Object.keys(GP_COR).find(s => nome === s || nome.endsWith(`(${s})`));
  const cor = sigla ? GP_COR[sigla] : '#888';
  return (
    <span
      className="inline-flex items-center text-[10px] font-semibold rounded-full px-2 py-0.5"
      style={{ backgroundColor: cor + '1a', color: cor }}
    >
      {nome}
    </span>
  );
};

/**
 * Lista expansível das intervenções (quem disse o quê) de um Voto/Moção que
 * foi debatido em plenário — só carrega o texto ao abrir, não à partida
 * (cada cartão pode ter dezenas de intervenções, não vale a pena pedir tudo
 * só por a página ter carregado).
 */
function IntervencoesExpansiveis({ ids }) {
  const [aberto, setAberto] = useState(false);
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(false);

  const toggle = async () => {
    if (!aberto && !dados) {
      setCarregando(true);
      const { data, error } = await supabase.from('ar_intervencoes').select('id, nome_dep, partido, texto').in('id', ids);
      if (error) {
        console.error('[AtividadeParlamentar] erro ao carregar intervenções:', error.message);
      } else {
        const ordem = new Map(ids.map((id, i) => [id, i]));
        setDados([...(data ?? [])].sort((a, b) => (ordem.get(a.id) ?? 0) - (ordem.get(b.id) ?? 0)));
      }
      setCarregando(false);
    }
    setAberto(a => !a);
  };

  return (
    <div className="mt-2 border-t border-gray-100 pt-2">
      <button
        onClick={toggle}
        className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
      >
        <MessageSquare size={12} />
        {aberto ? 'Ocultar' : 'Ver'} intervenções ({ids.length})
        {aberto ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {aberto && (
        <div className="mt-2 flex flex-col gap-2.5 max-h-72 overflow-y-auto pr-1">
          {carregando && <p className="text-xs text-gray-400">A carregar…</p>}
          {dados?.map(iv => (
            <div key={iv.id} className="text-xs">
              <p className="font-semibold text-gray-800">
                {iv.nome_dep} {iv.partido && <span className="font-normal text-gray-400">({iv.partido})</span>}
              </p>
              <p className="text-gray-600 leading-snug mt-0.5">{iv.texto}</p>
            </div>
          ))}
          {dados && dados.length === 0 && (
            <p className="text-xs text-gray-400">Não foi possível carregar o texto destas intervenções.</p>
          )}
        </div>
      )}
    </div>
  );
}

/** Link para a página oficial — mesmo estilo em todos os cartões que o têm. */
const LinkOficial = ({ url, label = 'Ver no Parlamento.pt' }) => {
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-500 hover:text-blue-700">
      <ExternalLink size={11} />{label}
    </a>
  );
};

// ── Um cartão por tipo de atividade ──────────────────────────────────────────

function CartaoAtividade({ tab, item }) {
  const url = urlOficial(tab, item);

  if (tab.id === 'votos_mocoes') {
    const { bg, text, icon: Icon, label } = corResultado(item.resultado, item.observacoes);
    const isMocao = item.desc_tipo === 'Moção';
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between gap-3 mb-2">
          <span className={`inline-flex items-center text-[11px] font-bold rounded px-1.5 py-0.5 ${
            isMocao ? 'text-violet-700 bg-violet-50' : 'text-blue-600 bg-blue-50'
          }`}>
            {item.desc_tipo ?? 'Voto'}
          </span>
          <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 shrink-0 ${bg}`}>
            <Icon size={12} className={text} />
            <span className={`text-[11px] font-bold ${text}`}>{label}</span>
          </div>
        </div>
        <p className="text-sm font-semibold text-gray-900 leading-snug mb-2">{item.assunto ?? '—'}</p>
        {item.observacoes && (
          <p className="text-[11px] text-gray-500 italic leading-snug mb-2 border-l-2 border-gray-200 pl-2">
            {item.observacoes}
          </p>
        )}
        {(item.autores_gp ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {item.autores_gp.map((a, i) => <AutorBadge key={i} nome={a} />)}
          </div>
        )}
        <div className="flex items-center justify-between gap-2 text-xs text-gray-400">
          <span>{formatarData(item.data_entrada)}{item.unanime ? ' · Unânime' : ''}</span>
          <LinkOficial url={url} label="Diário da AR" />
        </div>
        {(item.intervencao_ids ?? []).length > 0 && (
          <IntervencoesExpansiveis ids={item.intervencao_ids} />
        )}
      </div>
    );
  }

  if (tab.id === 'audicoes' || tab.id === 'audiencias') {
    const concedida = item.concedida;
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between gap-3 mb-1.5">
          {item.numero && (
            <span className="inline-flex items-center text-[10px] font-bold text-gray-500 bg-gray-100 rounded px-1.5 py-0.5">
              {item.numero}
            </span>
          )}
          {concedida && (
            <span className={`text-[11px] font-bold rounded-full px-2 py-0.5 ${
              concedida.toLowerCase().includes('conced') ? 'text-green-700 bg-green-50' : 'text-gray-500 bg-gray-100'
            }`}>
              {concedida}
            </span>
          )}
        </div>
        <p className="text-sm font-semibold text-gray-900 leading-snug mb-1">{item.assunto ?? '—'}</p>
        {item.entidades && <p className="text-xs text-gray-500 leading-snug mb-2">{item.entidades}</p>}
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-gray-400">{formatarData(item.data)}</p>
          <LinkOficial url={url} />
        </div>
      </div>
    );
  }

  if (tab.id === 'deslocacoes') {
    const mesmoDia = item.data_inicio && item.data_inicio === item.data_fim;
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between gap-3 mb-1.5">
          {item.tipo && (
            <span className="inline-flex items-center text-[11px] font-bold text-blue-600 bg-blue-50 rounded px-1.5 py-0.5">
              {item.tipo}
            </span>
          )}
        </div>
        <p className="text-sm font-semibold text-gray-900 leading-snug mb-1">{item.designacao ?? '—'}</p>
        {item.local_evento && <p className="text-xs text-gray-500 mb-2">{item.local_evento}</p>}
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-gray-400">
            {mesmoDia
              ? formatarData(item.data_inicio)
              : `${formatarData(item.data_inicio) ?? '?'} — ${formatarData(item.data_fim) ?? '?'}`}
          </p>
          <LinkOficial url={url} />
        </div>
      </div>
    );
  }

  if (tab.id === 'eventos') {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
        {item.tipo_evento && (
          <span className="inline-flex items-center text-[11px] font-bold text-amber-600 bg-amber-50 rounded px-1.5 py-0.5 mb-1.5">
            {item.tipo_evento}
          </span>
        )}
        <p className="text-sm font-semibold text-gray-900 leading-snug mb-1">{item.designacao ?? '—'}</p>
        {item.local_evento && <p className="text-xs text-gray-500 mb-2">{item.local_evento}</p>}
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-gray-400">{formatarData(item.data)}</p>
          <LinkOficial url={url} />
        </div>
      </div>
    );
  }

  if (tab.id === 'orcamento') {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between gap-3 mb-1.5">
          {item.ano && (
            <span className="inline-flex items-center text-[11px] font-bold text-emerald-700 bg-emerald-50 rounded px-1.5 py-0.5">
              {item.ano}
            </span>
          )}
          {item.tipo && <span className="text-[11px] text-gray-400">{item.tipo}</span>}
        </div>
        <p className="text-sm font-semibold text-gray-900 leading-snug mb-2">{item.titulo ?? '—'}</p>
        {item.data_aprovacao_ca && (
          <p className="text-xs text-gray-400">Aprovado em {formatarData(item.data_aprovacao_ca)}</p>
        )}
      </div>
    );
  }

  if (tab.id === 'inqueritos') {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
        {item.numero && (
          <span className="inline-flex items-center text-[11px] font-bold text-rose-700 bg-rose-50 rounded px-1.5 py-0.5 mb-1.5">
            Inquérito n.º {item.numero}
          </span>
        )}
        <p className="text-sm font-semibold text-gray-900 leading-snug mb-1">
          {item.epigrafe ?? item.titulo ?? '—'}
        </p>
        {(item.autores_gp ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2 mt-1">
            {item.autores_gp.filter(a => a?.GP).map(a => <AutorBadge key={a.GP} nome={a.GP} />)}
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-gray-400">{formatarData(item.data_inicio)}</p>
          <LinkOficial url={url} label="Parlamento.pt" />
        </div>
      </div>
    );
  }

  return null;
}

// ── Paginação (mesma lógica de Votações.jsx) ─────────────────────────────────

const POR_PAGINA = 30;

function gerarPaginas(atual, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const conjunto = new Set([1, total]);
  for (let i = Math.max(2, atual - 2); i <= Math.min(total - 1, atual + 2); i++) conjunto.add(i);
  const ordenadas = [...conjunto].sort((a, b) => a - b);
  const resultado = [];
  for (let i = 0; i < ordenadas.length; i++) {
    if (i > 0 && ordenadas[i] - ordenadas[i - 1] > 1) resultado.push('…');
    resultado.push(ordenadas[i]);
  }
  return resultado;
}

function Paginacao({ pagina, total, onChange }) {
  const totalPaginas = Math.ceil(total / POR_PAGINA);
  if (totalPaginas <= 1) return null;
  const paginas = gerarPaginas(pagina, totalPaginas);
  return (
    <div className="flex items-center justify-center gap-1 mt-6 flex-wrap">
      <button onClick={() => onChange(pagina - 1)} disabled={pagina === 1}
        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-gray-500 bg-white border border-gray-200 hover:border-blue-300 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
        <ChevronLeft size={14} />Anterior
      </button>
      {paginas.map((p, i) => p === '…' ? (
        <span key={`e-${i}`} className="px-1 text-gray-400 text-sm">…</span>
      ) : (
        <button key={p} onClick={() => onChange(p)}
          className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
            p === pagina ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300 hover:text-blue-600'
          }`}>
          {p}
        </button>
      ))}
      <button onClick={() => onChange(pagina + 1)} disabled={pagina === totalPaginas}
        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-gray-500 bg-white border border-gray-200 hover:border-blue-300 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
        Próxima<ChevronRight size={14} />
      </button>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────────

const CAMPOS_PESQUISA = {
  votos_mocoes: r => [r.assunto, r.desc_tipo, r.resultado, r.observacoes].join(' '),
  audicoes:     r => [r.assunto, r.entidades].join(' '),
  audiencias:   r => [r.assunto, r.entidades].join(' '),
  deslocacoes:  r => [r.designacao, r.local_evento].join(' '),
  eventos:      r => [r.designacao, r.local_evento].join(' '),
  orcamento:    r => [r.titulo].join(' '),
  inqueritos:   r => [r.epigrafe, r.titulo].join(' '),
};

export function AtividadeParlamentar() {
  useDocumentTitle('Atividade Parlamentar');
  useIsMobile();
  const [abaId, setAbaId] = useState(TABS[0].id);
  const [cache, setCache] = useState({});           // { [tabId]: { dados, carregando, erro } }
  const [pesquisa, setPesquisa] = useState('');
  const [pagina, setPagina] = useState(1);

  const tab = TABS.find(t => t.id === abaId);
  const estado = cache[abaId];

  useEffect(() => {
    if (cache[abaId]) return; // já carregado — cada separador só busca uma vez
    let cancelado = false;
    setCache(c => ({ ...c, [abaId]: { dados: [], carregando: true, erro: null } }));

    let query = supabase.from(tab.tabela).select(tab.colunas);
    if (tab.filtroEq) query = query.eq(tab.filtroEq[0], tab.filtroEq[1]);
    query
      .order(tab.ordenar, { ascending: false, nullsFirst: false })
      .limit(3000)
      .then(({ data, error }) => {
        if (cancelado) return;
        if (error) {
          console.error(`[AtividadeParlamentar] erro ao carregar ${tab.tabela}:`, error.message);
          setCache(c => ({ ...c, [abaId]: { dados: [], carregando: false, erro: error.message } }));
          return;
        }
        setCache(c => ({ ...c, [abaId]: { dados: data ?? [], carregando: false, erro: null } }));
      });

    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abaId]);

  useEffect(() => { setPagina(1); setPesquisa(''); }, [abaId]);
  useEffect(() => { setPagina(1); }, [pesquisa]);

  const filtrados = useMemo(() => {
    const dados = estado?.dados ?? [];
    const q = pesquisa.trim().toLowerCase();
    if (!q) return dados;
    const campo = CAMPOS_PESQUISA[abaId];
    return dados.filter(r => campo(r).toLowerCase().includes(q));
  }, [estado, pesquisa, abaId]);

  const visiveis = filtrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Barra superior */}
      <div className="bg-[#16213e] border-b border-white/10 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link to="/" className="text-gray-400 hover:text-white transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div className="flex items-center gap-2.5">
            <Landmark size={16} className="text-blue-400" />
            <div>
              <h1 className="text-sm font-bold text-white">Atividade Parlamentar</h1>
              <p className="text-[11px] text-gray-400">XVII Legislatura · Assembleia da República</p>
            </div>
          </div>
          {estado && !estado.carregando && !estado.erro && (
            <span className="ml-auto text-[11px] text-gray-400">
              {filtrados.length !== estado.dados.length
                ? `${filtrados.length} / ${estado.dados.length}`
                : estado.dados.length.toLocaleString('pt-PT')}{' '}registos
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100 overflow-x-auto">
        <div className="max-w-4xl mx-auto px-6 flex gap-0 min-w-max">
          {TABS.map(({ id, label, icon: TabIcon }) => (
            <button
              key={id}
              onClick={() => setAbaId(id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                abaId === id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <TabIcon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-5">

        {/* Texto informativo — o que é isto? */}
        {tab.descricao && (
          <div className="bg-blue-50/60 border border-blue-100 rounded-xl px-4 py-3 mb-4">
            <p className="text-xs text-blue-900 leading-relaxed">{tab.descricao}</p>
          </div>
        )}

        {/* Ressalva sobre o estado — os dados abertos da AR não registam resultado
            para a maioria dos votos, e ausência de resultado não significa pendente. */}
        {tab.id === 'votos_mocoes' && (
          <div className="bg-amber-50/70 border border-amber-100 rounded-xl px-4 py-3 mb-4">
            <p className="text-xs text-amber-900 leading-relaxed">
              <strong>&ldquo;Sem resultado registado&rdquo;</strong> não quer dizer que esteja por votar — quer
              dizer que não sabemos. Cruzámos estes votos com as atas de todas as sessões plenárias desta
              legislatura: os que têm resultado aparecem lá em 96% dos casos, os que não têm praticamente
              nunca aparecem. Não foram, portanto, votados em plenário. Alguns foram retirados ou
              substituídos pelo autor — e nesses a Assembleia regista a observação, que mostramos no cartão.
              Sobre os restantes, os dados abertos não dizem nada, e nós também não.
            </p>
          </div>
        )}

        {/* Pesquisa */}
        <div className="relative mb-4">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={pesquisa}
            onChange={e => setPesquisa(e.target.value)}
            placeholder={`Pesquisar em ${tab.label.toLowerCase()}…`}
            className="w-full pl-8 pr-8 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent transition-all"
          />
          {pesquisa && (
            <button onClick={() => setPesquisa('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
              <X size={14} />
            </button>
          )}
        </div>

        {estado?.carregando && (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {estado && !estado.carregando && estado.erro && (
          <p className="text-center text-red-500 text-sm py-16">Erro ao carregar dados. Tenta novamente mais tarde.</p>
        )}

        {estado && !estado.carregando && !estado.erro && filtrados.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-16">Nenhum registo encontrado.</p>
        )}

        {estado && !estado.carregando && !estado.erro && filtrados.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {visiveis.map(item => <CartaoAtividade key={item.id} tab={tab} item={item} />)}
            </div>
            <Paginacao pagina={pagina} total={filtrados.length} onChange={p => { setPagina(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
          </>
        )}
      </div>
    </div>
  );
}
