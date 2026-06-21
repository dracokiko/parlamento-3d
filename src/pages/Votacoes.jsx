import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Vote, ExternalLink, CheckCircle2, XCircle, MinusCircle, ChevronRight, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { partidos as PARTIDOS } from '../data/mockPartidos';
import { InfoTooltip } from '../components/UI/InfoTooltip';
import { useIsMobile } from '../hooks/useIsMobile';

const GP_COR  = Object.fromEntries(Object.entries(PARTIDOS).map(([k, v]) => [k, v.cor]));
const GP_DEPS = Object.fromEntries(Object.entries(PARTIDOS).map(([k, v]) => [k, v.deputados ?? 0]));
const SIGLAS  = Object.keys(PARTIDOS);
const totalDeps = siglas => siglas.reduce((a, s) => a + (GP_DEPS[s.trim()] ?? 0), 0);

const DISPLAY_STEP = 40;

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

      {temBreakdown && <BarraVotos favor={favor} contra={contra} abstencao={abstencao} />}

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

      <div className="flex flex-wrap gap-4 mt-3">
        <a href={urlOficial} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800">
          <ExternalLink size={11} />
          Parlamento.pt
        </a>
        {urlDar && (
          <a href={urlDar} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-700">
            <ExternalLink size={11} />
            Diário da AR
          </a>
        )}
      </div>
    </div>
  );
};

const CartaoVotacaoMobile = ({ voto, tituloIni, descTipo }) => {
  const { bg, text, icon: Icon } = corResultado(voto.resultado);
  return (
    <Link
      to={`/votacoes/${voto.id}`}
      className="block bg-white border border-gray-100 rounded-2xl px-4 py-3.5 shadow-sm active:bg-gray-50 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {descTipo && (
            <span className="inline-flex items-center text-[10px] font-medium text-blue-600 bg-blue-50 rounded px-1.5 py-0.5 mb-1">
              {descTipo}
            </span>
          )}
          <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">
            {tituloIni ?? <span className="text-gray-400 italic">Iniciativa #{voto.iniciativa_id}</span>}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <div className={`flex items-center gap-1 rounded-full px-2.5 py-1 ${bg}`}>
            <Icon size={11} className={text} />
            <span className={`text-xs font-bold ${text}`}>{voto.resultado ?? '—'}</span>
          </div>
          <ChevronRight size={14} className="text-gray-300 ml-0.5" />
        </div>
      </div>
      {voto.data_votacao && (
        <p className="text-xs text-gray-400 mt-1.5">
          {new Date(voto.data_votacao).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })}
        </p>
      )}
    </Link>
  );
};

export function Votacoes() {
  const isMobile = useIsMobile();
  const [votacoes,    setVotacoes]    = useState([]);
  const [titulos,     setTitulos]     = useState({});
  const [carregando,  setCarregando]  = useState(true);
  const [filtroResult, setFiltroResult] = useState('todos');
  const [filtroPartido, setFiltroPartido] = useState('');
  const [filtroData,   setFiltroData]   = useState('');
  const [displayCount, setDisplayCount] = useState(DISPLAY_STEP);

  useEffect(() => {
    async function carregar() {
      setCarregando(true);
      const { data } = await supabase
        .from('ar_votacoes')
        .select('id, iniciativa_id, fase, data_votacao, resultado, unanime, reuniao, tipo_reuniao, detalhe_gp, publicacao')
        .order('data_votacao', { ascending: false })
        .limit(3000);

      const lista = data ?? [];
      setVotacoes(lista);

      const ids = [...new Set(lista.map(v => v.iniciativa_id).filter(Boolean))];
      if (ids.length) {
        const { data: inis } = await supabase
          .from('ar_iniciativas')
          .select('id, titulo, desc_tipo')
          .in('id', ids);
        setTitulos(Object.fromEntries((inis ?? []).map(i => [i.id, { titulo: i.titulo, desc_tipo: i.desc_tipo }])));
      }
      setCarregando(false);
    }
    carregar();
  }, []);

  // Reset display count whenever any filter changes
  useEffect(() => { setDisplayCount(DISPLAY_STEP); }, [filtroResult, filtroPartido, filtroData]);

  const filtrados = useMemo(() => {
    return votacoes.filter(v => {
      if (filtroResult !== 'todos' && v.resultado !== filtroResult) return false;
      if (filtroData && v.data_votacao?.slice(0, 10) !== filtroData) return false;
      if (filtroPartido) {
        const gp = v.detalhe_gp ?? {};
        const todos = [...(gp.favor ?? []), ...(gp.contra ?? []), ...(gp.abstencao ?? [])];
        if (!todos.some(s => s.trim() === filtroPartido)) return false;
      }
      return true;
    });
  }, [votacoes, filtroResult, filtroData, filtroPartido]);

  const visiveis = filtrados.slice(0, displayCount);
  const temFiltroAtivo = filtroPartido || filtroData || filtroResult !== 'todos';

  const limparFiltros = () => {
    setFiltroResult('todos');
    setFiltroPartido('');
    setFiltroData('');
  };

  const RESULTADO_FILTROS = [
    { id: 'todos',     label: 'Todos' },
    { id: 'Aprovado',  label: 'Aprovados' },
    { id: 'Rejeitado', label: 'Rejeitados' },
  ];

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
          {!carregando && (
            <span className="ml-auto text-[11px] text-gray-400">
              {filtrados.length !== votacoes.length
                ? `${filtrados.length} / ${votacoes.length}`
                : votacoes.length.toLocaleString('pt-PT')} votações
            </span>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-5">

        {/* Filtros — resultado */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {RESULTADO_FILTROS.map(f => {
            const count = f.id === 'todos'
              ? filtrados.length
              : filtrados.filter(v => v.resultado === f.id).length;
            return (
              <button
                key={f.id}
                onClick={() => setFiltroResult(f.id)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  filtroResult === f.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300 hover:text-blue-600'
                }`}
              >
                {f.label}
                <span className={`text-xs rounded-full px-1.5 py-0.5 ${filtroResult === f.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  {count.toLocaleString('pt-PT')}
                </span>
              </button>
            );
          })}
        </div>

        {/* Filtros — partido e data */}
        <div className="flex flex-wrap items-center gap-2 mb-5">

          {/* Partido */}
          <div className="relative">
            <select
              value={filtroPartido}
              onChange={e => setFiltroPartido(e.target.value)}
              className={`appearance-none pl-3 pr-7 py-1.5 rounded-full text-sm border transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-300 ${
                filtroPartido
                  ? 'font-bold border-transparent text-white'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
              }`}
              style={filtroPartido ? {
                backgroundColor: (GP_COR[filtroPartido] ?? '#888') + 'cc',
                borderColor: GP_COR[filtroPartido] ?? '#888',
              } : {}}
            >
              <option value="">Todos os partidos</option>
              {SIGLAS.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-current opacity-60 text-xs">▾</span>
          </div>

          {/* Data */}
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={filtroData}
              onChange={e => setFiltroData(e.target.value)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 ${
                filtroData
                  ? 'bg-blue-600 text-white border-blue-600 font-medium'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
              }`}
            />
            {filtroData && (
              <button
                onClick={() => setFiltroData('')}
                className="p-1 text-gray-400 hover:text-gray-700"
                title="Limpar data"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Limpar tudo */}
          {temFiltroAtivo && (
            <button
              onClick={limparFiltros}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <X size={12} />
              Limpar filtros
            </button>
          )}
        </div>

        {/* Lista */}
        {!carregando && filtrados.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-16">Nenhuma votação encontrada.</p>
        )}

        <div className="space-y-3">
          {visiveis.map(v =>
            isMobile ? (
              <CartaoVotacaoMobile
                key={v.id}
                voto={v}
                tituloIni={titulos[v.iniciativa_id]?.titulo}
                descTipo={titulos[v.iniciativa_id]?.desc_tipo}
              />
            ) : (
              <CartaoVotacao
                key={v.id}
                voto={v}
                tituloIni={titulos[v.iniciativa_id]?.titulo}
                descTipo={titulos[v.iniciativa_id]?.desc_tipo}
              />
            )
          )}
        </div>

        {/* Carregar mais */}
        {displayCount < filtrados.length && (
          <div className="flex justify-center mt-8">
            <button
              onClick={() => setDisplayCount(c => c + DISPLAY_STEP)}
              className="flex items-center gap-2 px-6 py-2.5 bg-white border border-gray-200 rounded-full text-sm font-medium text-gray-700 hover:border-blue-300 hover:text-blue-600 transition-colors"
            >
              Carregar mais ({filtrados.length - displayCount} restantes)
            </button>
          </div>
        )}

        {carregando && (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}
