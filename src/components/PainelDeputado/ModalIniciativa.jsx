import { useEffect, useState } from 'react';
import { X, Sparkles, Users, Calendar, GitBranch, Vote, ExternalLink, BookOpen, ChevronRight, Mic } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { partidos as PARTIDOS } from '../../data/mockPartidos';
import { InfoTooltip } from '../UI/InfoTooltip';

// Mapeia sigla → { cor, deputados }
const GP_INFO = Object.fromEntries(
  Object.entries(PARTIDOS).map(([k, v]) => [k, { cor: v.cor, deputados: v.deputados ?? 0 }])
);

const Pill = ({ children, cor = 'blue' }) => {
  const cores = {
    blue:   'bg-blue-50 text-blue-700',
    green:  'bg-green-50 text-green-700',
    red:    'bg-red-50 text-red-700',
    yellow: 'bg-yellow-50 text-yellow-700',
    gray:   'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`inline-block text-xs font-medium rounded px-2 py-0.5 ${cores[cor]}`}>
      {children}
    </span>
  );
};

const corResultado = r => {
  if (!r) return 'gray';
  const l = r.toLowerCase();
  if (l.includes('aprovad')) return 'green';
  if (l.includes('rejeitad')) return 'red';
  return 'yellow';
};

// Calcula total de deputados para uma lista de siglas
const totalDeps = siglas =>
  siglas.reduce((acc, s) => acc + (GP_INFO[s.trim()]?.deputados ?? 0), 0);

// Badge colorido com a cor oficial do partido
const GPBadge = ({ sigla }) => {
  const info = GP_INFO[sigla.trim()];
  const cor  = info?.cor ?? '#888';
  const deps = info?.deputados;
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

// Barra de proporção de votos
const BarraVotos = ({ favor, contra, abstencao }) => {
  const nF = totalDeps(favor);
  const nC = totalDeps(contra);
  const nA = totalDeps(abstencao);
  const total = nF + nC + nA || 1;
  const pF = (nF / total * 100).toFixed(1);
  const pC = (nC / total * 100).toFixed(1);
  const pA = (nA / total * 100).toFixed(1);

  return (
    <div className="space-y-1.5">
      <div className="flex rounded-full overflow-hidden h-2.5 gap-px">
        {nF > 0 && (
          <div className="bg-green-500 transition-all" style={{ width: `${pF}%` }} title={`A favor: ${nF} dep.`} />
        )}
        {nC > 0 && (
          <div className="bg-red-500 transition-all" style={{ width: `${pC}%` }} title={`Contra: ${nC} dep.`} />
        )}
        {nA > 0 && (
          <div className="bg-yellow-400 transition-all" style={{ width: `${pA}%` }} title={`Abstenção: ${nA} dep.`} />
        )}
      </div>
      <div className="flex gap-4 text-xs text-gray-500">
        {nF > 0 && <span><span className="text-green-600 font-semibold">{nF}</span> a favor</span>}
        {nC > 0 && <span><span className="text-red-600 font-semibold">{nC}</span> contra</span>}
        {nA > 0 && <span><span className="text-yellow-600 font-semibold">{nA}</span> abstencao</span>}
      </div>
    </div>
  );
};

const SecaoVotacoes = ({ votacoes, carregando }) => {
  if (carregando) return <p className="text-xs text-gray-400 italic">A carregar votações…</p>;
  if (!votacoes.length) return <p className="text-xs text-gray-400 italic">Sem registo de votação.</p>;

  return (
    <div className="space-y-4">
      {votacoes.map(v => {
        const gp        = v.detalhe_gp ?? {};
        const favor     = gp.favor     ?? [];
        const contra    = gp.contra    ?? [];
        const abstencao = gp.abstencao ?? [];
        const urlDar    = v.publicacao?.[0]?.URLDiario ?? null;

        return (
          <div key={v.id} className="border border-gray-100 rounded-xl p-4 space-y-3">

            {/* Cabeçalho: resultado + metadados */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Pill cor={corResultado(v.resultado)}>
                  {v.resultado ?? '—'}
                </Pill>
                {v.unanime && <Pill cor="green">Unânime</Pill>}
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                {v.fase && (
                  <span className="inline-flex items-center gap-0.5 italic">
                    {v.fase}<InfoTooltip termo={v.fase} />
                  </span>
                )}
                {v.reuniao && <span>Reunião Plenária {v.reuniao}</span>}
                {v.data_votacao && <span>{v.data_votacao}</span>}
              </div>
            </div>

            {/* Barra de proporção */}
            {(favor.length + contra.length + abstencao.length) > 0 && (
              <BarraVotos favor={favor} contra={contra} abstencao={abstencao} />
            )}

            {/* GPs por sentido de voto */}
            {favor.length > 0 && (
              <div className="space-y-1">
                <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">A favor</span>
                <div className="flex flex-wrap gap-1.5">
                  {favor.map(s => <GPBadge key={s} sigla={s} />)}
                </div>
              </div>
            )}
            {contra.length > 0 && (
              <div className="space-y-1">
                <span className="text-xs font-semibold text-red-700 uppercase tracking-wide">Contra</span>
                <div className="flex flex-wrap gap-1.5">
                  {contra.map(s => <GPBadge key={s} sigla={s} />)}
                </div>
              </div>
            )}
            {abstencao.length > 0 && (
              <div className="space-y-1">
                <span className="text-xs font-semibold text-yellow-700 uppercase tracking-wide">Abstenção</span>
                <div className="flex flex-wrap gap-1.5">
                  {abstencao.map(s => <GPBadge key={s} sigla={s} />)}
                </div>
              </div>
            )}

            {/* Link DAR */}
            {urlDar && (
              <a
                href={urlDar}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-700 mt-1"
              >
                <ExternalLink size={11} />
                Ver no Diário da AR
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ── Secção de debates / intervenções no DAR ────────────────────────────────

const FASE_LABEL = fase => {
  if (!fase) return null;
  const f = fase.toLowerCase();
  if (f.includes('discuss') || f.includes('debate') || f.includes('aprecia')) return fase;
  return null; // filtrar só fases de debate
};

function CartaoDar({ link, intervencoes }) {
  const [expandido, setExpandido] = useState(false);
  const nInt = intervencoes?.length ?? 0;
  const label = FASE_LABEL(link.fase);

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="w-1 rounded-full self-stretch bg-blue-200 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          {label && (
            <p className="text-xs font-semibold text-gray-700 mb-0.5">{label}</p>
          )}
          <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
            {link.data && <span>{new Date(link.data).toLocaleDateString('pt-PT', { day:'2-digit', month:'short', year:'numeric' })}</span>}
            {link.darNr && <span>DAR nº {parseInt(link.darNr, 10)}</span>}
            {link.paginaInicio && (
              <span>pp. {link.paginaInicio}{link.paginaFim && link.paginaFim !== link.paginaInicio ? `–${link.paginaFim}` : ''}</span>
            )}
            <a
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-0.5 text-blue-500 hover:text-blue-700"
            >
              <ExternalLink size={10} /> Ver no DAR
            </a>
          </div>
        </div>
        {nInt > 0 && (
          <button
            onClick={() => setExpandido(e => !e)}
            className="flex items-center gap-1 text-[10px] font-semibold text-indigo-600 bg-indigo-50 rounded-full px-2.5 py-1 hover:bg-indigo-100 transition-colors shrink-0"
          >
            <Mic size={9} />
            {nInt} intervenç{nInt === 1 ? 'ão' : 'ões'}
            <ChevronRight size={10} className={expandido ? 'rotate-90' : ''} />
          </button>
        )}
      </div>

      {expandido && nInt > 0 && (
        <div className="border-t border-gray-50 divide-y divide-gray-50 max-h-64 overflow-y-auto">
          {intervencoes.map((iv, i) => (
            <div key={i} className="px-4 py-2.5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-gray-800">{iv.nome_dep}</span>
                {iv.partido && (
                  <span className="text-[10px] text-gray-400 bg-gray-100 rounded px-1.5 py-0.5">{iv.partido}</span>
                )}
              </div>
              <p className="text-xs text-gray-600 line-clamp-3 leading-relaxed">{iv.texto}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SecaoDar({ darLinks, carregando }) {
  const [intencoesPorDar, setIntencoesPorDar] = useState({});

  useEffect(() => {
    if (!darLinks?.length) return;
    const darIds = [...new Set(darLinks.map(l => l.darId))];
    supabase
      .from('ar_intervencoes')
      .select('debate_id, nome_dep, partido, texto, num_palavras')
      .in('debate_id', darIds)
      .order('id')
      .then(({ data }) => {
        const mapa = {};
        for (const iv of data ?? []) {
          (mapa[iv.debate_id] ??= []).push(iv);
        }
        setIntencoesPorDar(mapa);
      });
  }, [darLinks]);

  if (carregando) return null;
  if (!darLinks?.length) return null;

  // Mostrar só fases de debate/discussão, depois restantes
  const comFase = darLinks.filter(l => FASE_LABEL(l.fase));
  const semFase = darLinks.filter(l => !FASE_LABEL(l.fase));
  const ordenados = [...comFase, ...semFase];

  const totalInt = Object.values(intencoesPorDar).reduce((s, a) => s + a.length, 0);

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-3">
        <BookOpen size={13} className="text-gray-400" />
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Debates no DAR{totalInt > 0 ? ` · ${totalInt} intervenções` : ''}
        </span>
      </div>
      <div className="space-y-2">
        {ordenados.map((link, i) => (
          <CartaoDar
            key={i}
            link={link}
            intervencoes={intencoesPorDar[link.darId]}
          />
        ))}
      </div>
      {totalInt === 0 && (
        <p className="text-xs text-gray-400 mt-2 italic">
          As transcrições das sessões referenciadas ainda estão a ser importadas.
        </p>
      )}
    </div>
  );
}

// ── Modal principal ─────────────────────────────────────────────────────────

export const ModalIniciativa = ({ iniciativa, onFechar, onClickDebate }) => {
  const [votacoes,   setVotacoes]   = useState([]);
  const [eventos,    setEventos]    = useState([]);
  const [darLinks,   setDarLinks]   = useState([]);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!iniciativa?.id) return;
    setVotacoes([]);
    setEventos([]);
    setDarLinks([]);
    setCarregando(true);

    Promise.all([
      supabase
        .from('ar_votacoes')
        .select('id, fase, data_votacao, resultado, unanime, reuniao, detalhe_gp, publicacao')
        .eq('iniciativa_id', iniciativa.id)
        .order('data_votacao', { ascending: true }),
      supabase
        .from('ar_iniciativas')
        .select('eventos, dar_links')
        .eq('id', iniciativa.id)
        .single(),
    ]).then(([{ data: vots }, { data: ini }]) => {
      setVotacoes(vots ?? []);
      setEventos(ini?.eventos ?? []);
      setDarLinks(ini?.dar_links ?? []);
    }).finally(() => setCarregando(false));
  }, [iniciativa?.id]);

  if (!iniciativa) return null;

  const autoresDep = iniciativa.autores_dep ?? [];
  const autoresGP  = iniciativa.autores_gp  ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onFechar}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-gray-100">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <Pill>
                <span className="inline-flex items-center">
                  {iniciativa.desc_tipo ?? iniciativa.tipo ?? '—'}
                  <InfoTooltip termo={iniciativa.desc_tipo ?? iniciativa.tipo} />
                </span>
              </Pill>
              {iniciativa.numero     && <Pill cor="gray">Nº {iniciativa.numero}</Pill>}
              {iniciativa.legislatura && <Pill cor="gray">{iniciativa.legislatura} Leg.</Pill>}
            </div>
            <h2 className="text-base font-bold text-gray-900 leading-snug">
              {iniciativa.titulo ?? '—'}
            </h2>
            {iniciativa.epigrafe && (
              <p className="text-sm text-gray-500 mt-1 italic">{iniciativa.epigrafe}</p>
            )}
          </div>
          <button
            onClick={onFechar}
            className="p-1.5 rounded-full hover:bg-gray-100 transition-colors flex-shrink-0"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Conteúdo com scroll */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Resumo IA */}
          {iniciativa.resumo_ia && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles size={13} className="text-amber-500" />
                <span className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Resumo IA</span>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{iniciativa.resumo_ia}</p>
              <p className="text-xs text-gray-400 mt-2">Gerado automaticamente · pode conter imprecisões</p>
            </div>
          )}

          {/* Datas */}
          <div className="flex items-center gap-6">
            {iniciativa.data_inicio && (
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-gray-400" />
                <div>
                  <p className="text-xs text-gray-400">Entrada</p>
                  <p className="text-sm font-medium text-gray-800">{iniciativa.data_inicio}</p>
                </div>
              </div>
            )}
            {iniciativa.data_fim && (
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-gray-400" />
                <div>
                  <p className="text-xs text-gray-400">Fim</p>
                  <p className="text-sm font-medium text-gray-800">{iniciativa.data_fim}</p>
                </div>
              </div>
            )}
          </div>

          {/* Autores deputados */}
          {autoresDep.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Users size={13} className="text-gray-400" />
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Autores ({autoresDep.length})
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {autoresDep.map((a, i) => (
                  <span key={i} className="text-xs bg-gray-100 text-gray-700 rounded-full px-2.5 py-1">
                    {a.nome}
                    {a.GP && <span className="text-gray-400 ml-1">· {a.GP}</span>}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Grupos parlamentares */}
          {autoresGP.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Grupos parlamentares
              </p>
              <div className="flex flex-wrap gap-1.5">
                {autoresGP.map((g, i) => (
                  <Pill key={i}>{g.GP}</Pill>
                ))}
              </div>
            </div>
          )}

          {/* Votações */}
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <Vote size={13} className="text-gray-400" />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Votações{votacoes.length > 0 ? ` (${votacoes.length})` : ''}
              </span>
            </div>
            <SecaoVotacoes votacoes={votacoes} carregando={carregando} />
          </div>

          {/* Debates no DAR */}
          <SecaoDar darLinks={darLinks} carregando={carregando} />

          {/* Fases / Eventos */}
          {eventos.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-3">
                <GitBranch size={13} className="text-gray-400" />
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Fases ({eventos.length})
                </span>
              </div>
              <div className="space-y-1.5">
                {eventos.map((ev, i) => (
                  <div key={i} className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-300 flex-shrink-0" />
                    <span className="text-sm text-gray-700 flex-1 inline-flex items-center gap-0.5">
                      {ev.Fase ?? ev.fase ?? '—'}
                      <InfoTooltip termo={ev.Fase ?? ev.fase} />
                    </span>
                    {(ev.DataFase ?? ev.dataFase) && (
                      <span className="text-xs text-gray-400 flex-shrink-0">{ev.DataFase ?? ev.dataFase}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
