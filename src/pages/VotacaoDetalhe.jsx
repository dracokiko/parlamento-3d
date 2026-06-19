import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, XCircle, MinusCircle, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { partidos as PARTIDOS } from '../data/mockPartidos';
import { InfoTooltip } from '../components/UI/InfoTooltip';

const GP_COR  = Object.fromEntries(Object.entries(PARTIDOS).map(([k, v]) => [k, v.cor]));
const GP_DEPS = Object.fromEntries(Object.entries(PARTIDOS).map(([k, v]) => [k, v.deputados ?? 0]));
const totalDeps = siglas => siglas.reduce((a, s) => a + (GP_DEPS[s.trim()] ?? 0), 0);

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
      className="inline-flex items-center gap-1 text-xs font-bold rounded px-2 py-0.5"
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
    <div className="space-y-2">
      <div className="flex rounded-full overflow-hidden h-3 gap-px">
        {nF > 0 && <div className="bg-green-500" style={{ width: `${nF / tot * 100}%` }} />}
        {nC > 0 && <div className="bg-red-500"   style={{ width: `${nC / tot * 100}%` }} />}
        {nA > 0 && <div className="bg-yellow-400" style={{ width: `${nA / tot * 100}%` }} />}
      </div>
      <div className="flex gap-4 text-sm text-gray-500">
        {nF > 0 && <span><span className="text-green-600 font-bold">{nF}</span> a favor</span>}
        {nC > 0 && <span><span className="text-red-600 font-bold">{nC}</span> contra</span>}
        {nA > 0 && <span><span className="text-yellow-600 font-bold">{nA}</span> abstenção</span>}
      </div>
    </div>
  );
};

export function VotacaoDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [voto, setVoto]           = useState(null);
  const [iniciativa, setIniciativa] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregar() {
      const { data } = await supabase
        .from('ar_votacoes')
        .select('*')
        .eq('id', id)
        .single();

      if (data) {
        setVoto(data);
        if (data.iniciativa_id) {
          const { data: ini } = await supabase
            .from('ar_iniciativas')
            .select('id, titulo, desc_tipo')
            .eq('id', data.iniciativa_id)
            .single();
          setIniciativa(ini ?? null);
        }
      }
      setCarregando(false);
    }
    carregar();
  }, [id]);

  if (carregando) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!voto) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <p className="text-gray-500">Votação não encontrada.</p>
        <button onClick={() => navigate(-1)} className="text-blue-600 text-sm">Voltar</button>
      </div>
    );
  }

  const gp         = voto.detalhe_gp ?? {};
  const favor      = gp.favor      ?? [];
  const contra     = gp.contra     ?? [];
  const abstencao  = gp.abstencao  ?? [];
  const urlDar     = voto.publicacao?.[0]?.URLDiario ?? null;
  const urlOficial = `https://www.parlamento.pt/ActividadeParlamentar/Paginas/DetalheIniciativa.aspx?BID=${voto.iniciativa_id}`;
  const { bg, text, icon: Icon } = corResultado(voto.resultado);
  const temBreakdown = favor.length + contra.length + abstencao.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#16213e] border-b border-white/10 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-400 hover:text-white transition-colors p-1 -ml-1"
        >
          <ArrowLeft size={20} />
        </button>
        <span className="text-white text-sm font-semibold flex-1 truncate">Votação</span>
        <div className={`flex items-center gap-1.5 shrink-0 rounded-full px-3 py-1 ${bg}`}>
          <Icon size={12} className={text} />
          <span className={`text-xs font-bold ${text}`}>{voto.resultado ?? '—'}</span>
        </div>
      </div>

      <div className="px-4 py-5 space-y-4 max-w-lg mx-auto">
        <div>
          {iniciativa?.desc_tipo && (
            <span className="inline-flex items-center text-[11px] font-medium text-blue-600 bg-blue-50 rounded px-1.5 py-0.5 mb-2">
              {iniciativa.desc_tipo}
              <InfoTooltip termo={iniciativa.desc_tipo} />
            </span>
          )}
          <h1 className="text-base font-bold text-gray-900 leading-snug">
            {iniciativa?.titulo ?? <span className="text-gray-400 italic">Iniciativa #{voto.iniciativa_id}</span>}
          </h1>
        </div>

        <div className="flex flex-col gap-1 text-sm text-gray-500">
          {voto.data_votacao && (
            <span>
              {new Date(voto.data_votacao).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })}
            </span>
          )}
          {voto.fase && (
            <span className="inline-flex items-center gap-0.5 italic">
              {voto.fase}<InfoTooltip termo={voto.fase} />
            </span>
          )}
          {voto.reuniao && <span>Reunião plenária {voto.reuniao}</span>}
          {voto.unanime && <span className="text-green-600 font-medium">Votação unânime</span>}
        </div>

        {voto.resumo_ia && (
          <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
            <p className="text-sm text-gray-800 leading-relaxed">{voto.resumo_ia}</p>
            <p className="text-[10px] text-gray-400 mt-2">Gerado automaticamente · pode conter imprecisões</p>
          </div>
        )}

        {temBreakdown && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <BarraVotos favor={favor} contra={contra} abstencao={abstencao} />
          </div>
        )}

        {temBreakdown && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
            {favor.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-green-700 uppercase tracking-wide mb-1.5">A favor</p>
                <div className="flex flex-wrap gap-1">{favor.map(s => <GPBadge key={s} sigla={s} />)}</div>
              </div>
            )}
            {contra.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-red-700 uppercase tracking-wide mb-1.5">Contra</p>
                <div className="flex flex-wrap gap-1">{contra.map(s => <GPBadge key={s} sigla={s} />)}</div>
              </div>
            )}
            {abstencao.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-yellow-700 uppercase tracking-wide mb-1.5">Abstenção</p>
                <div className="flex flex-wrap gap-1">{abstencao.map(s => <GPBadge key={s} sigla={s} />)}</div>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <a
            href={urlOficial} target="_blank" rel="noreferrer"
            className="flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-100 shadow-sm"
          >
            <span className="text-sm font-medium text-gray-700">Ver em Parlamento.pt</span>
            <ExternalLink size={15} className="text-gray-400" />
          </a>
          {urlDar && (
            <a
              href={urlDar} target="_blank" rel="noreferrer"
              className="flex items-center justify-between p-4 bg-white rounded-2xl border border-blue-100 shadow-sm"
            >
              <span className="text-sm font-medium text-blue-700">Ver no Diário da AR</span>
              <ExternalLink size={15} className="text-blue-400" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
