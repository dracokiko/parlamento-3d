import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Vote, ExternalLink, CheckCircle2, XCircle, MinusCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { partidos as PARTIDOS } from '../data/mockPartidos';
import { InfoTooltip } from '../components/UI/InfoTooltip';

const PAGE = 40;

const GP_COR  = Object.fromEntries(Object.entries(PARTIDOS).map(([k, v]) => [k, v.cor]));
const GP_DEPS = Object.fromEntries(Object.entries(PARTIDOS).map(([k, v]) => [k, v.deputados ?? 0]));
const totalDeps = siglas => siglas.reduce((a, s) => a + (GP_DEPS[s.trim()] ?? 0), 0);

const FILTROS = [
  { id: 'todos',      label: 'Todos' },
  { id: 'Aprovado',   label: 'Aprovados' },
  { id: 'Rejeitado',  label: 'Rejeitados' },
];

const corResultado = r => {
  if (!r) return { bg: 'bg-gray-100', text: 'text-gray-500', icon: MinusCircle };
  if (r.toLowerCase().includes('aprovad'))  return { bg: 'bg-green-50',  text: 'text-green-700',  icon: CheckCircle2 };
  if (r.toLowerCase().includes('rejeitad')) return { bg: 'bg-red-50',    text: 'text-red-700',    icon: XCircle      };
  return { bg: 'bg-yellow-50', text: 'text-yellow-700', icon: MinusCircle };
};

const GPBadge = ({ sigla }) => {
  const cor = GP_COR[sigla.trim()] ?? '#888';
  const deps = GP_DEPS[sigla.trim()];
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-bold rounded px-2 py-0.5 shrink-0"
      style={{ backgroundColor: cor + '22', color: cor, border: `1px solid ${cor}55` }}
    >
      {sigla.trim()}
      {deps != null && <span className="opacity-60 font-normal">({deps})</span>}
    </span>
  );
};

const BarraVotos = ({ favor, contra, abstencao }) => {
  const nF = totalDeps(favor), nC = totalDeps(contra), nA = totalDeps(abstencao);
  const tot = nF + nC + nA || 1;
  return (
    <div className="space-y-1">
      <div className="flex rounded-full overflow-hidden h-2 gap-px">
        {nF > 0 && <div className="bg-green-500" style={{ width: `${nF/tot*100}%` }} title={`A favor: ${nF}`} />}
        {nC > 0 && <div className="bg-red-500"   style={{ width: `${nC/tot*100}%` }} title={`Contra: ${nC}`} />}
        {nA > 0 && <div className="bg-yellow-400" style={{ width: `${nA/tot*100}%` }} title={`Abstenção: ${nA}`} />}
      </div>
      <div className="flex gap-4 text-xs text-gray-400">
        {nF > 0 && <span><span className="text-green-600 font-semibold">{nF}</span> a favor</span>}
        {nC > 0 && <span><span className="text-red-600   font-semibold">{nC}</span> contra</span>}
        {nA > 0 && <span><span className="text-yellow-600 font-semibold">{nA}</span> abstenção</span>}
      </div>
    </div>
  );
};

const CartaoVotacao = ({ voto, tituloIni, descTipo }) => {
  const gp         = voto.detalhe_gp ?? {};
  const favor      = gp.favor      ?? [];
  const contra     = gp.contra     ?? [];
  const abstencao  = gp.abstencao  ?? [];
  const urlDar     = voto.publicacao?.[0]?.URLDiario ?? null;
  const urlOficial = `https://www.parlamento.pt/ActividadeParlamentar/Paginas/DetalheIniciativa.aspx?BID=${voto.iniciativa_id}`;
  const { bg, text, icon: Icon } = corResultado(voto.resultado);
  const temBreakdown = favor.length + contra.length + abstencao.length > 0;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">

      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          {descTipo && (
            <span className="inline-flex items-center text-[11px] font-medium text-blue-600 bg-blue-50 rounded px-1.5 py-0.5 mb-1.5">
              {descTipo}
              <InfoTooltip termo={descTipo} />
            </span>
          )}
          <p className="text-sm font-semibold text-gray-900 leading-snug">
            {tituloIni ?? <span className="text-gray-400 italic">Iniciativa #{voto.iniciativa_id}</span>}
          </p>
        </div>

        <div className={`flex items-center gap-1.5 shrink-0 rounded-full px-3 py-1 ${bg}`}>
          <Icon size={13} className={text} />
          <span className={`text-xs font-bold ${text}`}>{voto.resultado ?? '—'}</span>
        </div>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400 mb-3">
        {voto.fase    && (
          <span className="inline-flex items-center gap-0.5 italic">
            {voto.fase}<InfoTooltip termo={voto.fase} />
          </span>
        )}
        {voto.reuniao && (
          <span className="inline-flex items-center gap-0.5">
            Reunião plenária {voto.reuniao}<InfoTooltip termo="Reunião plenária" />
          </span>
        )}
        {voto.data_votacao && (
          <span>{new Date(voto.data_votacao).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
        )}
        {voto.unanime    && <span className="text-green-600 font-medium">Unânime</span>}
      </div>

      {/* Barra proporcional */}
      {temBreakdown && <BarraVotos favor={favor} contra={contra} abstencao={abstencao} />}

      {/* GPs por sentido */}
      {temBreakdown && (
        <div className="mt-3 space-y-2">
          {favor.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-green-700 uppercase tracking-wide mb-1">A favor</p>
              <div className="flex flex-wrap gap-1">{favor.map(s => <GPBadge key={s} sigla={s} />)}</div>
            </div>
          )}
          {contra.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-red-700 uppercase tracking-wide mb-1">Contra</p>
              <div className="flex flex-wrap gap-1">{contra.map(s => <GPBadge key={s} sigla={s} />)}</div>
            </div>
          )}
          {abstencao.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-yellow-700 uppercase tracking-wide mb-1">Abstenção</p>
              <div className="flex flex-wrap gap-1">{abstencao.map(s => <GPBadge key={s} sigla={s} />)}</div>
            </div>
          )}
        </div>
      )}

      {/* Links */}
      <div className="flex flex-wrap gap-4 mt-3">
        <a
          href={urlOficial} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800"
        >
          <ExternalLink size={11} />
          Parlamento.pt
        </a>
        {urlDar && (
          <a
            href={urlDar} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-700"
          >
            <ExternalLink size={11} />
            Diário da AR
          </a>
        )}
      </div>
    </div>
  );
};

export function Votacoes() {
  const [votos,      setVotos]      = useState([]);
  const [titulos,    setTitulos]    = useState({});   // iniciativa_id → { titulo, desc_tipo }
  const [filtro,     setFiltro]     = useState('todos');
  const [offset,     setOffset]     = useState(0);
  const [temMais,    setTemMais]    = useState(true);
  const [carregando, setCarregando] = useState(false);
  const [totais,     setTotais]     = useState({ todos: 0, Aprovado: 0, Rejeitado: 0 });

  // Contagens totais (uma vez)
  useEffect(() => {
    const contar = async (resultado) => {
      const q = supabase.from('ar_votacoes').select('*', { count: 'exact', head: true });
      if (resultado) q.eq('resultado', resultado);
      const { count } = await q;
      return count ?? 0;
    };
    Promise.all([contar(null), contar('Aprovado'), contar('Rejeitado')]).then(
      ([todos, aprovado, rejeitado]) => setTotais({ todos, Aprovado: aprovado, Rejeitado: rejeitado })
    );
  }, []);

  const carregarPagina = useCallback(async (filtroAtual, offsetAtual, append) => {
    setCarregando(true);
    try {
      const q = supabase
        .from('ar_votacoes')
        .select('id, iniciativa_id, fase, data_votacao, resultado, unanime, reuniao, tipo_reuniao, detalhe_gp, publicacao')
        .order('data_votacao', { ascending: false })
        .range(offsetAtual, offsetAtual + PAGE - 1);

      if (filtroAtual !== 'todos') q.eq('resultado', filtroAtual);

      const { data: novos, error } = await q;
      if (error) { console.error(error); return; }

      const lista = novos ?? [];

      // Buscar títulos das iniciativas que ainda não temos
      const idsNovos = [...new Set(lista.map(v => v.iniciativa_id))].filter(id => !titulos[id]);
      if (idsNovos.length) {
        const { data: inis } = await supabase
          .from('ar_iniciativas')
          .select('id, titulo, desc_tipo')
          .in('id', idsNovos);
        const novosMapa = Object.fromEntries((inis ?? []).map(i => [i.id, { titulo: i.titulo, desc_tipo: i.desc_tipo }]));
        setTitulos(prev => ({ ...prev, ...novosMapa }));
      }

      setVotos(prev => append ? [...prev, ...lista] : lista);
      setTemMais(lista.length === PAGE);
    } finally {
      setCarregando(false);
    }
  }, [titulos]);

  // Carregar ao montar e ao mudar filtro
  useEffect(() => {
    setVotos([]);
    setOffset(0);
    setTemMais(true);
    carregarPagina(filtro, 0, false);
  }, [filtro]); // eslint-disable-line react-hooks/exhaustive-deps

  const carregarMais = () => {
    const novoOffset = offset + PAGE;
    setOffset(novoOffset);
    carregarPagina(filtro, novoOffset, true);
  };

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Barra superior */}
      <div className="bg-[#16213e] border-b border-white/10 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link to="/" className="text-gray-400 hover:text-white transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div className="flex items-center gap-2.5">
            <Vote size={16} className="text-blue-400" />
            <div>
              <h1 className="text-sm font-bold text-white">Votações</h1>
              <p className="text-[11px] text-gray-400">XVII Legislatura · Assembleia da República</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6">

        {/* Filtros */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          {FILTROS.map(f => {
            const count = totais[f.id] ?? totais['todos'];
            return (
              <button
                key={f.id}
                onClick={() => setFiltro(f.id)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  filtro === f.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300 hover:text-blue-600'
                }`}
              >
                {f.label}
                <span className={`text-xs rounded-full px-1.5 py-0.5 ${filtro === f.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  {count.toLocaleString('pt-PT')}
                </span>
              </button>
            );
          })}
        </div>

        {/* Lista */}
        {votos.length === 0 && !carregando && (
          <p className="text-center text-gray-400 text-sm py-16">Nenhuma votação encontrada.</p>
        )}

        <div className="space-y-4">
          {votos.map(v => (
            <CartaoVotacao
              key={v.id}
              voto={v}
              tituloIni={titulos[v.iniciativa_id]?.titulo}
              descTipo={titulos[v.iniciativa_id]?.desc_tipo}
            />
          ))}
        </div>

        {/* Carregar mais */}
        {temMais && votos.length > 0 && (
          <div className="flex justify-center mt-8">
            <button
              onClick={carregarMais}
              disabled={carregando}
              className="flex items-center gap-2 px-6 py-2.5 bg-white border border-gray-200 rounded-full text-sm font-medium text-gray-700 hover:border-blue-300 hover:text-blue-600 transition-colors disabled:opacity-50"
            >
              {carregando ? 'A carregar…' : 'Carregar mais'}
            </button>
          </div>
        )}

        {carregando && votos.length === 0 && (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

      </div>
    </div>
  );
}
