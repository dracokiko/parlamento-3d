import { useState } from 'react';
import { X, MapPin, FileText, Mic, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useParlamento } from '../../context/ParlamentoContext';
import { partidos } from '../../data/mockPartidos';
import { obterIniciais } from '../../utils/formatters';
import { useArDeputado } from '../../hooks/useArDeputado';
import { useIntervencoesDeputado } from '../../hooks/useIntervencoesDeputado';
import { ModalIniciativa } from './ModalIniciativa';
import { ModalDebate } from './ModalDebate';

// ── Aba activa ────────────────────────────────────────────────
const ABAS = [
  { id: 'iniciativas',  label: 'Iniciativas',  icon: FileText },
  { id: 'intervencoes', label: 'Intervenções', icon: Mic      },
];

// ── Secção: Iniciativas ───────────────────────────────────────
const SecaoIniciativas = ({ iniciativas, carregando, onClickIniciativa }) => {
  if (carregando) return <p className="text-sm text-gray-400 italic">A carregar iniciativas...</p>;
  if (!iniciativas.length) return <p className="text-sm text-gray-400 italic">Sem iniciativas registadas.</p>;

  return (
    <div className="space-y-3">
      {iniciativas.map(ini => (
        <button
          key={ini.id}
          onClick={() => onClickIniciativa(ini)}
          className="w-full text-left border border-gray-100 rounded-xl p-3 hover:bg-blue-50 hover:border-blue-200 transition-colors group"
        >
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-medium text-blue-600 bg-blue-50 group-hover:bg-blue-100 rounded px-1.5 py-0.5">
              {ini.desc_tipo ?? ini.tipo ?? '—'}
            </span>
            {ini.legislatura && (
              <span className="text-xs text-gray-400">{ini.legislatura} Leg.</span>
            )}
            {ini.data_inicio && (
              <span className="text-xs text-gray-400">{ini.data_inicio}</span>
            )}
          </div>
          <p className="text-sm font-medium text-gray-800 leading-snug">{ini.titulo}</p>
          {ini.resumo_ia && (
            <p className="text-xs text-gray-500 mt-1.5 leading-relaxed border-l-2 border-amber-300 pl-2">
              {ini.resumo_ia}
              <span className="block text-gray-400 mt-0.5">Gerado automaticamente · pode conter imprecisões</span>
            </p>
          )}
        </button>
      ))}
    </div>
  );
};

// ── Secção: Debates ───────────────────────────────────────────
const SecaoDebates = ({ debates, carregando, onClickDebate }) => {
  if (carregando) return <p className="text-sm text-gray-400 italic">A carregar debates...</p>;
  if (!debates.length) return <p className="text-sm text-gray-400 italic">Sem debates registados.</p>;

  return (
    <div className="space-y-3">
      {debates.map(deb => (
        <button
          key={deb.id}
          onClick={() => onClickDebate(deb)}
          className="w-full text-left border border-gray-100 rounded-xl p-3 hover:bg-purple-50 hover:border-purple-200 transition-colors group"
        >
          {deb.tipo_debate && (
            <span className="inline-block text-xs font-medium text-purple-600 bg-purple-50 group-hover:bg-purple-100 rounded px-1.5 py-0.5 mb-1">
              {deb.tipo_debate}
            </span>
          )}
          <p className="text-sm font-medium text-gray-800">{deb.assunto ?? '—'}</p>
          {deb.artigo && <p className="text-xs text-gray-500 mt-0.5">{deb.artigo}</p>}
          {deb.data_debate && <span className="text-xs text-gray-400 mt-1 block">{deb.data_debate}</span>}
        </button>
      ))}
    </div>
  );
};

// Intervenções com menos de N palavras são consideradas interjeições/aplausos
const MIN_PALAVRAS = 40;

// ── Secção: Intervenções ──────────────────────────────────────
const SecaoIntervencoes = ({ intervencoes, carregando, corPartido }) => {
  const [expandido, setExpandido]       = useState(null);
  const [textos, setTextos]             = useState({});
  const [mostrarTodas, setMostrarTodas] = useState(false);

  const expandir = async (id) => {
    if (expandido === id) { setExpandido(null); return; }
    setExpandido(id);
    if (textos[id] !== undefined) return;
    setTextos(t => ({ ...t, [id]: null }));
    const { data } = await supabase.from('ar_intervencoes').select('texto').eq('id', id).single();
    setTextos(t => ({ ...t, [id]: data?.texto ?? '' }));
  };

  if (carregando) return <p className="text-sm text-gray-400 italic">A carregar intervenções...</p>;
  if (!intervencoes.length) return <p className="text-sm text-gray-400 italic">Sem intervenções indexadas. Corre o sync para as obter.</p>;

  const lista = mostrarTodas
    ? intervencoes
    : intervencoes.filter(iv => (iv.num_palavras ?? MIN_PALAVRAS) >= MIN_PALAVRAS);

  const filtradas = intervencoes.length - lista.length;

  // Agrupar por dia
  const porDia = lista.reduce((acc, iv) => {
    const dia = iv.data_debate ?? 'Sem data';
    (acc[dia] ??= []).push(iv);
    return acc;
  }, {});
  const dias = Object.keys(porDia).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-4">
      {/* Toggle filtro */}
      <div className="flex items-center justify-between text-xs text-gray-400 pb-1 border-b border-gray-100">
        <span>{lista.length} intervenções{filtradas > 0 && !mostrarTodas ? ` (${filtradas} interjeições ocultas)` : ''}</span>
        <button
          onClick={() => setMostrarTodas(v => !v)}
          className="text-blue-500 hover:text-blue-700 transition-colors font-medium"
        >
          {mostrarTodas ? 'Ocultar interjeições' : 'Ver todas'}
        </button>
      </div>
      {dias.map(dia => (
        <div key={dia}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2 sticky top-0 bg-white py-1"
             style={{ color: corPartido ?? '#9ca3af' }}>
            {dia === 'Sem data' ? dia : dia.split('-').reverse().join('-')}
          </p>
          <div className="space-y-1.5">
            {porDia[dia].map(iv => (
              <div key={iv.id} className="border border-gray-100 rounded-xl overflow-hidden">
                <button
                  onClick={() => expandir(iv.id)}
                  className="w-full text-left p-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-gray-500 truncate flex-1 italic">
                      {iv.assunto ?? 'Intervenção parlamentar'}
                    </p>
                    <span className="text-xs text-gray-300 flex-shrink-0">{expandido === iv.id ? '▲' : '▼'}</span>
                  </div>
                </button>

                {expandido === iv.id && (
                  <div className="px-3 pb-3 border-t border-gray-50">
                    {textos[iv.id] === undefined && (
                      <p className="text-xs text-gray-400 italic mt-2">A carregar...</p>
                    )}
                    {textos[iv.id] !== undefined && (
                      <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap mt-2 max-h-64 overflow-y-auto">
                        {textos[iv.id] || '—'}
                      </p>
                    )}
                    {iv.url_diario && (
                      <a
                        href={iv.url_diario}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 mt-2"
                      >
                        <ExternalLink size={10} />
                        Ver no site da AR
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// ── Componente principal ──────────────────────────────────────
export const PainelDeputado = () => {
  const { deputadoSelecionado, fecharPainel } = useParlamento();
  const [abaAtiva, setAbaAtiva] = useState('iniciativas');
  const [iniciativaSelecionada, setIniciativaSelecionada] = useState(null);
  const [debateSelecionado, setDebateSelecionado] = useState(null);
  const { perfil, iniciativas, carregando } = useArDeputado(deputadoSelecionado);
  const nomeParlamentar = perfil?.nome_parlamentar ?? deputadoSelecionado?.nomeAbrev ?? '';
  const { intervencoes, carregando: carregandoInt } = useIntervencoesDeputado(
    abaAtiva === 'intervencoes' ? nomeParlamentar : null
  );

  if (!deputadoSelecionado) return null;

  const partido = partidos[deputadoSelecionado.partido];

  const contagens = {
    iniciativas:  iniciativas.length,
    intervencoes: intervencoes.length,
  };

  return (
    <>
    <div
      className="absolute inset-0 flex overflow-hidden z-20 bg-white"
      role="dialog"
      aria-label={`Perfil de ${deputadoSelecionado.nome}`}
    >
      {/* ── Coluna esquerda: identidade ─────────────────────── */}
      <div
        className="w-64 flex-shrink-0 flex flex-col justify-between px-5 py-6 text-white relative"
        style={{ backgroundColor: partido?.cor ?? '#555' }}
      >
        <button
          onClick={fecharPainel}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-white/20 transition-colors"
          aria-label="Fechar painel"
        >
          <X size={18} />
        </button>

        <div>
          {/* Foto */}
          <div className="w-24 mb-4 rounded-xl overflow-hidden border-2 border-white/40" style={{ height: '112px' }}>
            {deputadoSelecionado.foto ? (
              <img
                src={deputadoSelecionado.foto}
                alt={deputadoSelecionado.nomeAbrev ?? deputadoSelecionado.nome}
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }}
              />
            ) : (
              <div className="w-full h-full bg-white/20 flex items-center justify-center text-2xl font-bold">
                {obterIniciais(deputadoSelecionado.nome)}
              </div>
            )}
          </div>

          <h2 className="text-base font-bold leading-tight">{deputadoSelecionado.nome}</h2>

          <div className="flex items-center gap-2 mt-1">
            {partido?.logo && (
              <img src={partido.logo} alt={partido.id}
                className="w-5 h-5 object-contain rounded-sm"
                style={{ background: 'rgba(255,255,255,0.15)' }}
              />
            )}
            <p className="text-white/80 text-xs">{partido?.nome}</p>
          </div>

          {deputadoSelecionado.circulo && (
            <div className="flex items-center gap-1 text-white/60 text-xs mt-2">
              <MapPin size={10} />
              <span>{deputadoSelecionado.circulo}</span>
            </div>
          )}

          {/* Estatísticas rápidas */}
          <div className="mt-4 space-y-1">
            <div className="flex justify-between text-xs text-white/70">
              <span>Iniciativas</span>
              <span className="font-bold text-white">{iniciativas.length}</span>
            </div>
            <div className="flex justify-between text-xs text-white/70">
              <span>Intervenções</span>
              <span className="font-bold text-white">{intervencoes.length}</span>
            </div>
          </div>
        </div>

        {deputadoSelecionado.lugar && (
          <div className="mt-auto pt-4 border-t border-white/20">
            <span className="text-white/50 text-xs uppercase tracking-wider">Lugar</span>
            <p className="text-white font-mono text-2xl font-bold mt-0.5">{deputadoSelecionado.lugar}</p>
          </div>
        )}
      </div>

      {/* ── Coluna direita: dados AR + IA ───────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white">

        {/* Abas */}
        <div className="flex border-b border-gray-100 px-4 pt-3 gap-1 flex-shrink-0">
          {ABAS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setAbaAtiva(id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg transition-colors ${
                abaAtiva === id
                  ? 'bg-white border border-b-white border-gray-200 text-gray-900 -mb-px'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Icon size={12} />
              {label}
              {contagens[id] > 0 && (
                <span className={`text-xs rounded-full px-1.5 py-0.5 ${
                  abaAtiva === id ? 'bg-gray-100 text-gray-600' : 'bg-gray-100 text-gray-400'
                }`}>
                  {contagens[id]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Conteúdo da aba */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {abaAtiva === 'iniciativas'  && <SecaoIniciativas  iniciativas={iniciativas}  carregando={carregando}    onClickIniciativa={setIniciativaSelecionada} />}
          {abaAtiva === 'intervencoes' && <SecaoIntervencoes intervencoes={intervencoes} carregando={carregandoInt} corPartido={partido?.cor} />}
        </div>
      </div>
    </div>

    <ModalIniciativa
      iniciativa={iniciativaSelecionada}
      onFechar={() => setIniciativaSelecionada(null)}
    />
    <ModalDebate
      debate={debateSelecionado}
      onFechar={() => setDebateSelecionado(null)}
    />
    </>
  );
};
