import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Sparkles, Users, Calendar, GitBranch,
  Vote, ExternalLink, Mic,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { partidos as PARTIDOS } from '../data/mockPartidos';
import { InfoTooltip } from '../components/UI/InfoTooltip';

const GP_INFO  = Object.fromEntries(Object.entries(PARTIDOS).map(([k, v]) => [k, { cor: v.cor, deps: v.deputados ?? 0 }]));
const totalDeps = siglas => siglas.reduce((a, s) => a + (GP_INFO[s.trim()]?.deps ?? 0), 0);

const Pill = ({ children, cor = 'blue' }) => {
  const cls = {
    blue:   'bg-blue-50 text-blue-700',
    green:  'bg-green-50 text-green-700',
    red:    'bg-red-50 text-red-700',
    yellow: 'bg-yellow-50 text-yellow-700',
    gray:   'bg-gray-100 text-gray-600',
  };
  return <span className={`inline-block text-xs font-medium rounded px-2 py-0.5 ${cls[cor]}`}>{children}</span>;
};

const GPBadge = ({ sigla }) => {
  const cor  = GP_INFO[sigla.trim()]?.cor ?? '#888';
  const deps = GP_INFO[sigla.trim()]?.deps;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold rounded px-2 py-0.5"
      style={{ backgroundColor: cor + '22', color: cor, border: `1px solid ${cor}55` }}>
      {sigla.trim()}{deps != null && <span className="opacity-60 font-normal">({deps})</span>}
    </span>
  );
};

const BarraVotos = ({ favor, contra, abstencao }) => {
  const nF = totalDeps(favor), nC = totalDeps(contra), nA = totalDeps(abstencao);
  const tot = nF + nC + nA || 1;
  return (
    <div className="space-y-1.5">
      <div className="flex rounded-full overflow-hidden h-2.5 gap-px">
        {nF > 0 && <div className="bg-green-500" style={{ width: `${nF / tot * 100}%` }} />}
        {nC > 0 && <div className="bg-red-500"   style={{ width: `${nC / tot * 100}%` }} />}
        {nA > 0 && <div className="bg-yellow-400" style={{ width: `${nA / tot * 100}%` }} />}
      </div>
      <div className="flex gap-4 text-xs text-gray-500">
        {nF > 0 && <span><span className="text-green-600 font-semibold">{nF}</span> a favor</span>}
        {nC > 0 && <span><span className="text-red-600 font-semibold">{nC}</span> contra</span>}
        {nA > 0 && <span><span className="text-yellow-600 font-semibold">{nA}</span> abstenção</span>}
      </div>
    </div>
  );
};

const corResultado = r => {
  if (!r) return 'gray';
  const l = r.toLowerCase();
  if (l.includes('aprovad')) return 'green';
  if (l.includes('rejeitad')) return 'red';
  return 'yellow';
};

// Extrai darId de uma URL do DAR: .../r3/dar/01/17/01/066/2026-03-13/... → dar_066_2026-03-13
const extractDarId = url => {
  const m = url?.match(/\/(\d{3})\/(\d{4}-\d{2}-\d{2})\//);
  return m ? `dar_${m[1]}_${m[2]}` : null;
};

export function IniciativaDetalhe() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const [iniciativa, setIniciativa] = useState(null);
  const [votacoes,   setVotacoes]   = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregar() {
      const [{ data: ini }, { data: vots }] = await Promise.all([
        supabase.from('ar_iniciativas').select('*').eq('id', id).single(),
        supabase.from('ar_votacoes')
          .select('id, fase, data_votacao, resultado, unanime, reuniao, detalhe_gp, publicacao, resumo_ia')
          .eq('iniciativa_id', id)
          .order('data_votacao', { ascending: true }),
      ]);
      setIniciativa(ini ?? null);
      setVotacoes(vots ?? []);
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

  if (!iniciativa) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <p className="text-gray-500">Iniciativa não encontrada.</p>
        <button onClick={() => navigate(-1)} className="text-blue-600 text-sm">Voltar</button>
      </div>
    );
  }

  const darLinks = iniciativa.dar_links ?? [];
  const eventos  = iniciativa.eventos   ?? [];

  // Construir mapa darId → Set de oradores a partir dos eventos estruturados
  const oradoresPorDarId = {};
  for (const ev of eventos) {
    for (const debate of ev.Intervencoesdebates ?? []) {
      for (const orador of debate.oradores ?? []) {
        const darId = extractDarId(orador.publicacao?.[0]?.URLDiario);
        if (!darId) continue;
        if (!oradoresPorDarId[darId]) oradoresPorDarId[darId] = new Map();
        for (const dep of orador.deputadosOradores ?? []) {
          if (dep.nome) oradoresPorDarId[darId].set(dep.nome, dep.GP ?? null);
        }
      }
    }
  }

  // Ordenar dar_links cronologicamente
  const darLinksOrdenados = [...darLinks]
    .filter(dl => dl.darId)
    .sort((a, b) => (a.darData ?? '').localeCompare(b.darData ?? ''));

  const autoresDep = iniciativa.autores_dep ?? [];
  const autoresGP  = iniciativa.autores_gp  ?? [];
  const urlOficial = iniciativa.id
    ? `https://www.parlamento.pt/ActividadeParlamentar/Paginas/DetalheIniciativa.aspx?BID=${iniciativa.id}`
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Topo */}
      <div className="bg-[#16213e] border-b border-white/10 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-400 hover:text-white transition-colors p-1 -ml-1"
        >
          <ArrowLeft size={20} />
        </button>
        <span className="text-white/60 text-sm truncate flex-1">{iniciativa.desc_tipo ?? iniciativa.tipo ?? 'Iniciativa'}</span>
        {urlOficial && (
          <a href={urlOficial} target="_blank" rel="noreferrer"
            className="text-gray-400 hover:text-white transition-colors p-1 shrink-0">
            <ExternalLink size={16} />
          </a>
        )}
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">

        {/* Cabeçalho */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            {iniciativa.desc_tipo && (
              <Pill>
                <span className="inline-flex items-center gap-0.5">
                  {iniciativa.desc_tipo}<InfoTooltip termo={iniciativa.desc_tipo} />
                </span>
              </Pill>
            )}
            {iniciativa.numero     && <Pill cor="gray">Nº {iniciativa.numero}</Pill>}
            {iniciativa.legislatura && <Pill cor="gray">{iniciativa.legislatura} Leg.</Pill>}
          </div>
          <h1 className="text-xl font-bold text-gray-900 leading-snug">{iniciativa.titulo}</h1>
          {iniciativa.epigrafe && (
            <p className="text-sm text-gray-500 italic">{iniciativa.epigrafe}</p>
          )}
        </div>

        {/* Resumo IA */}
        {iniciativa.resumo_ia && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-1.5">
              <Sparkles size={13} className="text-amber-500" />
              <span className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Resumo IA</span>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">{iniciativa.resumo_ia}</p>
            <p className="text-xs text-gray-400">Gerado automaticamente · pode conter imprecisões</p>
          </div>
        )}

        {/* Datas + Autores */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(iniciativa.data_inicio || iniciativa.data_fim) && (
            <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-start gap-4">
              <Calendar size={16} className="text-gray-400 mt-0.5 shrink-0" />
              <div className="space-y-1">
                {iniciativa.data_inicio && (
                  <div>
                    <p className="text-xs text-gray-400">Entrada</p>
                    <p className="text-sm font-medium text-gray-800">{iniciativa.data_inicio}</p>
                  </div>
                )}
                {iniciativa.data_fim && (
                  <div>
                    <p className="text-xs text-gray-400">Fim</p>
                    <p className="text-sm font-medium text-gray-800">{iniciativa.data_fim}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {(autoresDep.length > 0 || autoresGP.length > 0) && (
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Users size={14} className="text-gray-400" />
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Autores</span>
              </div>
              {autoresGP.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {autoresGP.map((g, i) => <GPBadge key={i} sigla={g.GP} />)}
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {autoresDep.slice(0, 8).map((a, i) => (
                    <span key={i} className="text-xs bg-gray-100 text-gray-700 rounded-full px-2.5 py-1">
                      {a.nome}{a.GP && <span className="text-gray-400 ml-1">· {a.GP}</span>}
                    </span>
                  ))}
                  {autoresDep.length > 8 && (
                    <span className="text-xs text-gray-400 py-1">+{autoresDep.length - 8}</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Discussão */}
        {darLinksOrdenados.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Mic size={16} className="text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                Debate parlamentar
              </h2>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
              {darLinksOrdenados.map((dl, i) => {
                const oradores = oradoresPorDarId[dl.darId]
                  ? [...oradoresPorDarId[dl.darId].entries()].map(([nome, gp]) => ({ nome, gp }))
                  : [];
                return (
                  <div key={i} className="px-4 py-3 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {dl.fase && (
                        <span className="text-xs font-semibold text-gray-700 inline-flex items-center gap-0.5">
                          {dl.fase}<InfoTooltip termo={dl.fase} />
                        </span>
                      )}
                      {dl.darData && (
                        <span className="text-xs text-gray-400">
                          {new Date(dl.darData).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      )}
                      {dl.darNr && (
                        <span className="text-xs text-gray-400">DAR nº {parseInt(dl.darNr, 10)}</span>
                      )}
                      {dl.url && (
                        <a href={dl.url} target="_blank" rel="noreferrer"
                          className="ml-auto inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 shrink-0">
                          <ExternalLink size={10} /> Ver no DAR
                        </a>
                      )}
                    </div>
                    {oradores.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {oradores.map(({ nome, gp }) => {
                          const cor = GP_INFO[gp?.trim()]?.cor ?? '#9ca3af';
                          return (
                            <span key={nome} className="text-[10px] rounded px-2 py-0.5 font-medium"
                              style={{ backgroundColor: cor + '15', color: cor, border: `1px solid ${cor}40` }}>
                              {nome}{gp && <span className="opacity-60 ml-1">· {gp}</span>}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Votações */}
        {votacoes.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Vote size={16} className="text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                Votações ({votacoes.length})
              </h2>
            </div>
            <div className="space-y-4">
              {votacoes.map(v => {
                const gp        = v.detalhe_gp ?? {};
                const favor     = gp.favor     ?? [];
                const contra    = gp.contra    ?? [];
                const abstencao = gp.abstencao ?? [];
                const urlDar    = v.publicacao?.[0]?.URLDiario ?? null;
                const temBreak  = favor.length + contra.length + abstencao.length > 0;
                return (
                  <Link key={v.id} to={`/votacoes/${v.id}`}
                    className="block bg-white rounded-xl border border-gray-100 p-4 space-y-3 hover:border-gray-300 transition-colors">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <Pill cor={corResultado(v.resultado)}>{v.resultado ?? '—'}</Pill>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        {v.fase && <span className="italic inline-flex items-center gap-0.5">{v.fase}<InfoTooltip termo={v.fase} /></span>}
                        {v.data_votacao && (
                          <span>{new Date(v.data_votacao).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        )}
                      </div>
                    </div>
                    {v.resumo_ia && <p className="text-xs text-gray-600 leading-relaxed">{v.resumo_ia}</p>}
                    {temBreak && <BarraVotos favor={favor} contra={contra} abstencao={abstencao} />}
                    {temBreak && (
                      <div className="space-y-2">
                        {favor.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-green-700 uppercase mb-1">A favor</p>
                            <div className="flex flex-wrap gap-1">{favor.map(s => <GPBadge key={s} sigla={s} />)}</div>
                          </div>
                        )}
                        {contra.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-red-700 uppercase mb-1">Contra</p>
                            <div className="flex flex-wrap gap-1">{contra.map(s => <GPBadge key={s} sigla={s} />)}</div>
                          </div>
                        )}
                        {abstencao.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-yellow-700 uppercase mb-1">Abstenção</p>
                            <div className="flex flex-wrap gap-1">{abstencao.map(s => <GPBadge key={s} sigla={s} />)}</div>
                          </div>
                        )}
                      </div>
                    )}
                    {urlDar && (
                      <span className="inline-flex items-center gap-1 text-xs text-blue-500">
                        <ExternalLink size={10} /> Ver no DAR
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Fases */}
        {eventos.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <GitBranch size={16} className="text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                Fases ({eventos.length})
              </h2>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
              {eventos.map((ev, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-300 shrink-0" />
                  <span className="text-sm text-gray-700 flex-1 inline-flex items-center gap-0.5">
                    {ev.Fase ?? ev.fase ?? '—'}<InfoTooltip termo={ev.Fase ?? ev.fase} />
                  </span>
                  {(ev.DataFase ?? ev.dataFase) && (
                    <span className="text-xs text-gray-400 shrink-0">{ev.DataFase ?? ev.dataFase}</span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
