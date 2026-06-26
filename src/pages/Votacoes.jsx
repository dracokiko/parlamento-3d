import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Vote, ExternalLink, CheckCircle2, XCircle, MinusCircle,
  ChevronRight, X, BarChart2, AlertTriangle, Sparkles,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { partidos as PARTIDOS } from '../data/mockPartidos';
import { InfoTooltip } from '../components/UI/InfoTooltip';
import { useIsMobile } from '../hooks/useIsMobile';
import { useParlamento } from '../context/ParlamentoContext';

const GP_COR  = Object.fromEntries(Object.entries(PARTIDOS).map(([k, v]) => [k, v.cor]));
const GP_DEPS = Object.fromEntries(Object.entries(PARTIDOS).map(([k, v]) => [k, v.deputados ?? 0]));
const SIGLAS  = Object.keys(PARTIDOS);
const DISPLAY_STEP = 40;

const totalDeps = siglas => siglas.reduce((a, s) => a + (GP_DEPS[s.trim()] ?? 0), 0);

const corResultado = r => {
  if (!r) return { bg: 'bg-gray-100', text: 'text-gray-500', icon: MinusCircle };
  if (r.toLowerCase().includes('aprovad'))  return { bg: 'bg-green-50',  text: 'text-green-700',  icon: CheckCircle2 };
  if (r.toLowerCase().includes('rejeitad')) return { bg: 'bg-red-50',    text: 'text-red-700',    icon: XCircle };
  return { bg: 'bg-yellow-50', text: 'text-yellow-700', icon: MinusCircle };
};

function posicaoPartido(gp, partido) {
  if (!gp || !partido) return null;
  if ((gp.favor      ?? []).some(s => s.trim() === partido)) return 'favor';
  if ((gp.contra     ?? []).some(s => s.trim() === partido)) return 'contra';
  if ((gp.abstencao  ?? []).some(s => s.trim() === partido)) return 'abstencao';
  return null;
}

const POSICAO_LABEL = {
  favor:     { label: 'A favor',    bg: 'bg-green-100',  text: 'text-green-700',  icon: CheckCircle2 },
  contra:    { label: 'Contra',     bg: 'bg-red-100',    text: 'text-red-700',    icon: XCircle },
  abstencao: { label: 'Abstenção',  bg: 'bg-yellow-100', text: 'text-yellow-700', icon: MinusCircle },
};

function calcularConcordancia(votacoes) {
  const dados = {};
  for (const v of votacoes) {
    const gp = v.detalhe_gp ?? {};
    const pos = {};
    for (const s of (gp.favor      ?? [])) pos[s.trim()] = 'favor';
    for (const s of (gp.contra     ?? [])) pos[s.trim()] = 'contra';
    for (const s of (gp.abstencao  ?? [])) pos[s.trim()] = 'abstencao';

    const parts = Object.keys(pos).filter(p => SIGLAS.includes(p));
    for (let i = 0; i < parts.length; i++) {
      for (let j = i + 1; j < parts.length; j++) {
        const [a, b] = [parts[i], parts[j]].sort();
        const key = `${a}_${b}`;
        if (!dados[key]) dados[key] = { same: 0, total: 0 };
        dados[key].total++;
        if (pos[parts[i]] === pos[parts[j]]) dados[key].same++;
      }
    }
  }
  return dados;
}

function corConcordancia(pct) {
  if (pct === null) return { bg: '#e5e7eb', text: '#9ca3af' };
  // 0% → vermelho vivo, 50% → âmbar, 100% → verde vivo
  // Três pontos de cor para gradiente mais expressivo
  let r, g, b;
  if (pct < 0.5) {
    const t = pct * 2; // 0→1
    r = Math.round(220 + (250 - 220) * t);  // 220→250
    g = Math.round(38  + (176 - 38)  * t);  // 38→176
    b = Math.round(38  + (9   - 38)  * t);  // 38→9
  } else {
    const t = (pct - 0.5) * 2; // 0→1
    r = Math.round(250 + (22  - 250) * t);  // 250→22
    g = Math.round(176 + (163 - 176) * t);  // 176→163
    b = Math.round(9   + (74  - 9)   * t);  // 9→74
  }
  return {
    bg:   `rgba(${r},${g},${b},0.22)`,
    text: `rgb(${Math.round(r*0.6)},${Math.round(g*0.55)},${Math.round(b*0.55)})`,
    border: `rgba(${r},${g},${b},0.55)`,
  };
}

const GPBadge = ({ sigla }) => {
  const cor  = GP_COR[sigla.trim()] ?? '#888';
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
        {nF > 0 && <div className="bg-green-500"  style={{ width: `${nF/tot*100}%` }} />}
        {nC > 0 && <div className="bg-red-500"    style={{ width: `${nC/tot*100}%` }} />}
        {nA > 0 && <div className="bg-yellow-400" style={{ width: `${nA/tot*100}%` }} />}
      </div>
      <div className="flex gap-4 text-xs text-gray-400">
        {nF > 0 && <span><span className="text-green-600 font-semibold">{nF}</span> a favor</span>}
        {nC > 0 && <span><span className="text-red-600   font-semibold">{nC}</span> contra</span>}
        {nA > 0 && <span><span className="text-yellow-600 font-semibold">{nA}</span> abstenção</span>}
      </div>
    </div>
  );
};

// ── Cartão desktop ─────────────────────────────────────────────────────────────

const CartaoVotacao = ({ voto, tituloIni, descTipo, autoresGp, partidoFiltrado }) => {
  const gp        = voto.detalhe_gp ?? {};
  const favor     = gp.favor      ?? [];
  const contra    = gp.contra     ?? [];
  const abstencao = gp.abstencao  ?? [];
  const urlDar    = voto.publicacao?.[0]?.URLDiario ?? null;
  const urlOficial = `https://www.parlamento.pt/ActividadeParlamentar/Paginas/DetalheIniciativa.aspx?BID=${voto.iniciativa_id}`;
  const { bg, text, icon: Icon } = corResultado(voto.resultado);
  const temBreakdown = favor.length + contra.length + abstencao.length > 0;

  const posicao = posicaoPartido(gp, partidoFiltrado);
  const posInfo = posicao ? POSICAO_LABEL[posicao] : null;
  const autores = (autoresGp ?? []).filter(a => a?.GP);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">

      {/* Partido(s) proponente + posição do partido filtrado */}
      {(autores.length > 0 || posInfo) && (
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          {autores.length > 0 && (
            <>
              <span className="text-[10px] text-gray-400">Proposta por</span>
              {autores.map(a => (
                <span
                  key={a.GP}
                  className="inline-flex items-center text-[11px] font-bold rounded-full px-2.5 py-0.5"
                  style={{ backgroundColor: (GP_COR[a.GP.trim()] ?? '#888') + '22', color: GP_COR[a.GP.trim()] ?? '#888' }}
                >
                  {a.GP}
                </span>
              ))}
            </>
          )}
          {posInfo && (
            <span className={`inline-flex items-center gap-1 text-[11px] font-bold rounded-full px-2.5 py-0.5 ${posInfo.bg} ${posInfo.text}`}>
              <posInfo.icon size={11} />
              {partidoFiltrado}: {posInfo.label}
            </span>
          )}
        </div>
      )}

      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          {descTipo && (
            <span className="inline-flex items-center text-[11px] font-medium text-blue-600 bg-blue-50 rounded px-1.5 py-0.5 mb-1.5">
              {descTipo}<InfoTooltip termo={descTipo} />
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
        {voto.fase && (
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
        {voto.unanime && <span className="text-green-600 font-medium">Unânime</span>}
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

      {voto.resumo_ia && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mt-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Sparkles size={11} className="text-amber-500" />
            <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide">Resumo IA</span>
          </div>
          <p className="text-xs text-gray-700 leading-relaxed">{voto.resumo_ia}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-4 mt-3">
        <a href={urlOficial} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800">
          <ExternalLink size={11} />Parlamento.pt
        </a>
        {urlDar && (
          <a href={urlDar} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-700">
            <ExternalLink size={11} />Diário da AR
          </a>
        )}
      </div>
    </div>
  );
};

// ── Cartão mobile ──────────────────────────────────────────────────────────────

const CartaoVotacaoMobile = ({ voto, tituloIni, descTipo, autoresGp, partidoFiltrado }) => {
  const gp      = voto.detalhe_gp ?? {};
  const posicao = posicaoPartido(gp, partidoFiltrado);
  const posInfo = posicao ? POSICAO_LABEL[posicao] : null;
  const autores = (autoresGp ?? []).filter(a => a?.GP);
  const { bg, text, icon: Icon } = corResultado(voto.resultado);

  return (
    <Link
      to={`/votacoes/${voto.id}`}
      className="block bg-white border border-gray-100 rounded-2xl px-4 py-3.5 shadow-sm active:bg-gray-50 transition-colors"
    >
      {(autores.length > 0 || posInfo) && (
        <div className="flex flex-wrap items-center gap-1 mb-2">
          {autores.length > 0 && (
            <>
              <span className="text-[10px] text-gray-400">Proposta por</span>
              {autores.map(a => (
                <span
                  key={a.GP}
                  className="text-[10px] font-bold rounded-full px-2 py-0.5"
                  style={{ backgroundColor: (GP_COR[a.GP.trim()] ?? '#888') + '22', color: GP_COR[a.GP.trim()] ?? '#888' }}
                >
                  {a.GP}
                </span>
              ))}
            </>
          )}
          {posInfo && (
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold rounded-full px-2 py-0.5 ${posInfo.bg} ${posInfo.text}`}>
              <posInfo.icon size={10} />{partidoFiltrado}: {posInfo.label}
            </span>
          )}
        </div>
      )}
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
      {voto.resumo_ia && (
        <p className="text-[11px] text-gray-500 mt-2 leading-relaxed line-clamp-2 border-l-2 border-amber-300 pl-2">
          {voto.resumo_ia}
        </p>
      )}
      {voto.data_votacao && (
        <p className="text-xs text-gray-400 mt-1.5">
          {new Date(voto.data_votacao).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })}
        </p>
      )}
    </Link>
  );
};

// ── Matriz de concordância ─────────────────────────────────────────────────────

function MatrizConcordancia({ votacoes }) {
  const [excluirUnanimes, setExcluirUnanimes] = useState(true);

  const base = useMemo(
    () => excluirUnanimes ? votacoes.filter(v => !v.unanime) : votacoes,
    [votacoes, excluirUnanimes],
  );

  const dados = useMemo(() => calcularConcordancia(base), [base]);

  const pct = (a, b) => {
    if (a === b) return -1; // diagonal
    const [x, y] = [a, b].sort();
    const d = dados[`${x}_${y}`];
    return (d?.total ?? 0) >= 5 ? d.same / d.total : null;
  };

  // Ordenar partidos por tamanho (maior primeiro) para leitura mais intuitiva
  const siglasPorTamanho = [...SIGLAS].sort((a, b) => (GP_DEPS[b] ?? 0) - (GP_DEPS[a] ?? 0));

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <p className="text-sm text-gray-500 flex-1">
          Percentagem de votações em que cada par de partidos votou no mesmo sentido.
          {' '}Mínimo 5 votações partilhadas para mostrar valor.
        </p>
        <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none shrink-0">
          <input
            type="checkbox"
            checked={excluirUnanimes}
            onChange={e => setExcluirUnanimes(e.target.checked)}
            className="accent-blue-600"
          />
          Excluir unânimes
        </label>
      </div>

      <div className="overflow-x-auto -mx-6 px-6">
        <table className="text-xs border-separate border-spacing-1 min-w-max mx-auto">
          <thead>
            <tr>
              <th className="w-10" />
              {siglasPorTamanho.map(s => (
                <th key={s} className="text-center pb-1" style={{ width: 46 }}>
                  <span
                    className="inline-block text-[11px] font-bold px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: (GP_COR[s] ?? '#888') + '22', color: GP_COR[s] ?? '#555' }}
                  >
                    {s}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {siglasPorTamanho.map(a => (
              <tr key={a}>
                <td className="pr-2 text-right">
                  <span
                    className="inline-block text-[11px] font-bold px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: (GP_COR[a] ?? '#888') + '22', color: GP_COR[a] ?? '#555' }}
                  >
                    {a}
                  </span>
                </td>
                {siglasPorTamanho.map(b => {
                  const p = pct(a, b);
                  if (p === -1) {
                    return (
                      <td key={b} className="text-center rounded-lg font-semibold"
                        style={{ width: 46, height: 38, backgroundColor: '#f8fafc', color: '#cbd5e1' }}>
                        —
                      </td>
                    );
                  }
                  const { bg, text, border } = corConcordancia(p);
                  return (
                    <td key={b} className="text-center rounded-lg font-bold transition-all"
                      style={{ width: 46, height: 38, backgroundColor: bg, color: text, border: `1.5px solid ${border}` }}>
                      {p !== null ? `${Math.round(p * 100)}%` : '·'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legenda */}
      <div className="flex items-center gap-3 mt-4 justify-center">
        <span className="text-[11px] text-gray-400">Menos acordo</span>
        <div className="flex gap-0.5">
          {[0, 25, 50, 75, 100].map(v => {
            const { bg } = corConcordancia(v / 100);
            return <div key={v} className="w-7 h-3 rounded-sm" style={{ backgroundColor: bg }} />;
          })}
        </div>
        <span className="text-[11px] text-gray-400">Mais acordo</span>
      </div>
    </div>
  );
}

// ── Tab Rebeldes ──────────────────────────────────────────────────────────────

const POSICAO_LABEL_CURTO = { favor: 'A favor', contra: 'Contra', abstencao: 'Abstenção' };
const POSICAO_COR = {
  favor:     { bg: 'bg-green-100',  text: 'text-green-700'  },
  contra:    { bg: 'bg-red-100',    text: 'text-red-700'    },
  abstencao: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
};

function CartaoRebelde({ dep, titulos, foto }) {
  const [expandido, setExpandido] = useState(false);
  const cor = GP_COR[dep.partido] ?? '#888';

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      <button
        onClick={() => setExpandido(e => !e)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
      >
        <div
          className="w-9 h-9 rounded-full shrink-0 overflow-hidden border-2"
          style={{ borderColor: cor + '88' }}
        >
          {foto
            ? <img src={foto} alt={dep.nome} className="w-full h-full object-cover object-top" />
            : <div className="w-full h-full flex items-center justify-center text-xs font-bold"
                style={{ backgroundColor: cor + '22', color: cor }}>{dep.partido}</div>
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{dep.nome}</p>
          <p className="text-xs text-gray-400">{dep.partido}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-bold bg-amber-100 text-amber-700 rounded-full px-2.5 py-0.5">
            {dep.votos.length}× divergente
          </span>
          {expandido ? <ChevronRight size={15} className="text-gray-300 rotate-90" /> : <ChevronRight size={15} className="text-gray-300" />}
        </div>
      </button>

      {expandido && (
        <div className="border-t border-gray-50 divide-y divide-gray-50">
          {dep.votos.map(v => {
            const ini = titulos[v.iniciativa_id];
            const posP = POSICAO_COR[v.posicao_partido] ?? {};
            const posD = POSICAO_COR[v.posicao] ?? {};
            return (
              <Link key={v.id} to={`/votacoes/${v.id}`}
                className="block px-5 py-3 hover:bg-gray-50 transition-colors">
                <p className="text-xs font-medium text-gray-800 line-clamp-2 mb-1.5">
                  {ini?.titulo ?? `Votação ${v.id}`}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  {v.data_votacao && (
                    <span className="text-[10px] text-gray-400">
                      {new Date(v.data_votacao).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  )}
                  <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${posP.bg} ${posP.text}`}>
                    {dep.partido}: {POSICAO_LABEL_CURTO[v.posicao_partido] ?? '?'}
                  </span>
                  <span className="text-[10px] text-gray-400">→</span>
                  <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${posD.bg} ${posD.text}`}>
                    Votou: {POSICAO_LABEL_CURTO[v.posicao] ?? '?'}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TabRebeldes({ votacoes, titulos, carregando }) {
  const { deputados } = useParlamento();

  const fotosMapa = useMemo(() => {
    const m = new Map();
    for (const d of deputados) {
      if (d.foto) m.set(d.nomeAbrev, d.foto);
    }
    return m;
  }, [deputados]);

  const rebeldes = useMemo(() => {
    const map = new Map();
    for (const v of votacoes) {
      for (const dep of (v.deputados_isolados ?? [])) {
        if (!dep.rebelde) continue;
        const key = `${dep.nome}|${dep.partido}`;
        if (!map.has(key)) map.set(key, { nome: dep.nome, partido: dep.partido, votos: [] });
        map.get(key).votos.push({
          id:              v.id,
          iniciativa_id:   v.iniciativa_id,
          data_votacao:    v.data_votacao,
          resultado:       v.resultado,
          fase:            v.fase,
          posicao:         dep.posicao,
          posicao_partido: dep.posicao_partido,
        });
      }
    }
    return [...map.values()].sort((a, b) => b.votos.length - a.votos.length);
  }, [votacoes]);

  if (carregando) return null;

  if (!rebeldes.length) {
    return (
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
        <AlertTriangle size={32} className="text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">Nenhum voto divergente encontrado nos dados actuais.</p>
        <p className="text-xs text-gray-400 mt-1">
          Apenas votações com deputados identificados individualmente no detalhe da votação são contabilizadas.
        </p>
      </div>
    );
  }

  const totalVotacoes = rebeldes.reduce((s, d) => s + d.votos.length, 0);

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-100 rounded-2xl px-5 py-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-amber-800">
        <span><strong>{rebeldes.length}</strong> deputados com votos divergentes</span>
        <span><strong>{totalVotacoes}</strong> votos fora da disciplina partidária</span>
        <span className="text-amber-500">Apenas votações em que o nome do deputado é registado individualmente</span>
      </div>
      <div className="space-y-2">
        {rebeldes.map(dep => (
          <CartaoRebelde key={`${dep.nome}|${dep.partido}`} dep={dep} titulos={titulos} foto={fotosMapa.get(dep.nome)} />
        ))}
      </div>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────────

const RESULTADO_FILTROS = [
  { id: 'todos',     label: 'Todos' },
  { id: 'Aprovado',  label: 'Aprovados' },
  { id: 'Rejeitado', label: 'Rejeitados' },
];

export function Votacoes() {
  const isMobile = useIsMobile();
  const [votacoes,      setVotacoes]      = useState([]);
  const [titulos,       setTitulos]       = useState({});
  const [carregando,    setCarregando]    = useState(true);
  const [aba,           setAba]           = useState('lista');
  const [filtroResult,  setFiltroResult]  = useState('todos');
  const [filtroPartido, setFiltroPartido] = useState('');
  const [filtroData,    setFiltroData]    = useState('');
  const [filtroProposta,setFiltroProposta]= useState(false);
  const [displayCount,  setDisplayCount]  = useState(DISPLAY_STEP);

  useEffect(() => {
    async function carregar() {
      setCarregando(true);
      const { data } = await supabase
        .from('ar_votacoes')
        .select('id, iniciativa_id, fase, data_votacao, resultado, unanime, reuniao, tipo_reuniao, detalhe_gp, publicacao, deputados_isolados, resumo_ia')
        .order('data_votacao', { ascending: false })
        .limit(3000);

      const lista = data ?? [];
      setVotacoes(lista);

      const ids = [...new Set(lista.map(v => v.iniciativa_id).filter(Boolean))];
      if (ids.length) {
        const { data: inis } = await supabase
          .from('ar_iniciativas')
          .select('id, titulo, desc_tipo, autores_gp')
          .in('id', ids);
        setTitulos(Object.fromEntries(
          (inis ?? []).map(i => [i.id, { titulo: i.titulo, desc_tipo: i.desc_tipo, autores_gp: i.autores_gp }])
        ));
      }
      setCarregando(false);
    }
    carregar();
  }, []);

  useEffect(() => { setDisplayCount(DISPLAY_STEP); }, [filtroResult, filtroPartido, filtroData, filtroProposta]);

  // Reset sub-filtro proposta quando partido muda
  useEffect(() => { setFiltroProposta(false); }, [filtroPartido]);

  const filtrados = useMemo(() => {
    return votacoes.filter(v => {
      if (filtroResult !== 'todos' && v.resultado !== filtroResult) return false;
      if (filtroData && v.data_votacao?.slice(0, 10) !== filtroData) return false;
      if (filtroPartido) {
        const gp = v.detalhe_gp ?? {};
        const todos = [...(gp.favor ?? []), ...(gp.contra ?? []), ...(gp.abstencao ?? [])];
        if (!todos.some(s => s.trim() === filtroPartido)) return false;
      }
      if (filtroProposta && filtroPartido) {
        const ini = titulos[v.iniciativa_id];
        if (!(ini?.autores_gp ?? []).some(a => a?.GP?.trim() === filtroPartido)) return false;
      }
      return true;
    });
  }, [votacoes, filtroResult, filtroData, filtroPartido, filtroProposta, titulos]);

  const visiveis = filtrados.slice(0, displayCount);
  const temFiltroAtivo = filtroPartido || filtroData || filtroResult !== 'todos';

  const limparFiltros = () => {
    setFiltroResult('todos');
    setFiltroPartido('');
    setFiltroData('');
    setFiltroProposta(false);
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
          {!carregando && (
            <span className="ml-auto text-[11px] text-gray-400">
              {filtrados.length !== votacoes.length
                ? `${filtrados.length} / ${votacoes.length}`
                : votacoes.length.toLocaleString('pt-PT')}{' '}votações
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-6 flex gap-0">
          {[
            { id: 'lista',        label: 'Votações',     icon: Vote },
            { id: 'concordancia', label: 'Concordância', icon: BarChart2 },
            { id: 'rebeldes',     label: 'Divergentes',  icon: AlertTriangle },
          ].map(({ id, label, icon: TabIcon }) => (
            <button
              key={id}
              onClick={() => setAba(id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                aba === id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <TabIcon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-5">

        {/* ── Tab: lista ─────────────────────────────────────────────────────── */}
        {aba === 'lista' && (
          <>
            {/* Filtro resultado */}
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

            {/* Filtro partido + data */}
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <div className="relative">
                <select
                  value={filtroPartido}
                  onChange={e => setFiltroPartido(e.target.value)}
                  className={`appearance-none pl-3 pr-7 py-1.5 rounded-full text-sm border transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-300 ${
                    filtroPartido ? 'font-bold text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                  }`}
                  style={filtroPartido ? { backgroundColor: (GP_COR[filtroPartido] ?? '#888') + 'cc', borderColor: GP_COR[filtroPartido] ?? '#888' } : {}}
                >
                  <option value="">Todos os partidos</option>
                  {SIGLAS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 opacity-60 text-xs">▾</span>
              </div>

              <div className="flex items-center gap-1">
                <input
                  type="date"
                  value={filtroData}
                  onChange={e => setFiltroData(e.target.value)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 ${
                    filtroData ? 'bg-blue-600 text-white border-blue-600 font-medium' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                  }`}
                />
                {filtroData && (
                  <button onClick={() => setFiltroData('')} className="p-1 text-gray-400 hover:text-gray-700">
                    <X size={14} />
                  </button>
                )}
              </div>

              {temFiltroAtivo && (
                <button onClick={limparFiltros}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors">
                  <X size={12} />Limpar
                </button>
              )}
            </div>

            {/* Sub-filtro "só propostas" — aparece apenas quando partido seleccionado */}
            {filtroPartido && (
              <div className="mb-4">
                <label className="flex items-center gap-2 text-xs cursor-pointer w-fit select-none">
                  <input
                    type="checkbox"
                    checked={filtroProposta}
                    onChange={e => setFiltroProposta(e.target.checked)}
                    className="accent-blue-600"
                  />
                  <span className="text-gray-600">
                    Mostrar apenas propostas do{' '}
                    <span className="font-bold" style={{ color: GP_COR[filtroPartido] }}>{filtroPartido}</span>
                  </span>
                </label>
              </div>
            )}

            {/* Lista */}
            {!carregando && filtrados.length === 0 && (
              <p className="text-center text-gray-400 text-sm py-16">Nenhuma votação encontrada.</p>
            )}

            <div className="space-y-3">
              {visiveis.map(v => {
                const ini = titulos[v.iniciativa_id];
                return isMobile ? (
                  <CartaoVotacaoMobile
                    key={v.id} voto={v}
                    tituloIni={ini?.titulo}
                    descTipo={ini?.desc_tipo}
                    autoresGp={ini?.autores_gp}
                    partidoFiltrado={filtroPartido}
                  />
                ) : (
                  <CartaoVotacao
                    key={v.id} voto={v}
                    tituloIni={ini?.titulo}
                    descTipo={ini?.desc_tipo}
                    autoresGp={ini?.autores_gp}
                    partidoFiltrado={filtroPartido}
                  />
                );
              })}
            </div>

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
          </>
        )}

        {/* ── Tab: concordância ──────────────────────────────────────────────── */}
        {aba === 'concordancia' && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h2 className="text-base font-bold text-gray-900 mb-1">Concordância entre partidos</h2>
            <MatrizConcordancia votacoes={votacoes} />
          </div>
        )}

        {/* ── Tab: rebeldes ──────────────────────────────────────────────────── */}
        {aba === 'rebeldes' && (
          <TabRebeldes votacoes={votacoes} titulos={titulos} carregando={carregando} />
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
