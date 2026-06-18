import { useState } from 'react';
import { X, MapPin, FileText, Mic, ExternalLink, BookUser, CalendarCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useParlamento } from '../../context/ParlamentoContext';
import { partidos } from '../../data/mockPartidos';
import { obterIniciais } from '../../utils/formatters';
import { useArDeputado } from '../../hooks/useArDeputado';
import { useIntervencoesDeputado } from '../../hooks/useIntervencoesDeputado';
import { useBiografiaDeputado } from '../../hooks/useBiografiaDeputado';
import { useIsMobile } from '../../hooks/useIsMobile';
import { ModalIniciativa } from './ModalIniciativa';
import { ModalDebate } from './ModalDebate';
import { ModalBiografia } from './ModalBiografia';
import { ModalPresencas } from './ModalPresencas';
import { usePresencasDeputado } from '../../hooks/usePresencasDeputado';
import { InfoTooltip } from '../UI/InfoTooltip';

const ABAS = [
  { id: 'iniciativas',  label: 'Iniciativas',  icon: FileText },
  { id: 'intervencoes', label: 'Intervenções', icon: Mic      },
];

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

const MIN_PALAVRAS = 40;

// Extrai a data de publicação do url_diario (dia em que saiu no DAR, pode diferir
// da data_debate quando o debate foi na véspera da publicação).
// Fallback para data_debate se o URL não tiver data reconhecível.
const dataPublicacao = (iv) => {
  const m = (iv.url_diario ?? '').match(/\/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : (iv.data_debate ?? 'Sem data');
};

// URL da página HTML do artigo: remove os query params ?pgs=...&org=... que
// forçam o download do PDF. Sem eles, o site da AR abre a vista web.
const urlPaginaAR = (url) => url ? url.split('?')[0] : null;

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

  const porDia = lista.reduce((acc, iv) => {
    const dia = dataPublicacao(iv);
    (acc[dia] ??= []).push(iv);
    return acc;
  }, {});
  const dias = Object.keys(porDia).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-gray-400 pb-1 border-b border-gray-100">
        <span className="flex items-center gap-1">
          {lista.length} intervenções
          {filtradas > 0 && !mostrarTodas && (
            <span className="flex items-center gap-0.5">
              {` (${filtradas} interjeições ocultas)`}
              <InfoTooltip termo="Interjeições" />
            </span>
          )}
        </span>
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
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {iv.num_palavras != null && iv.num_palavras < MIN_PALAVRAS && (
                        <span className="text-[10px] text-gray-400 bg-gray-100 rounded px-1.5 py-0.5 leading-none">
                          🗯️ interjeição
                        </span>
                      )}
                      <span className="text-xs text-gray-300">{expandido === iv.id ? '▲' : '▼'}</span>
                    </div>
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
                        href={urlPaginaAR(iv.url_diario)}
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

// ── Abas partilhadas entre mobile e desktop ────────────────────
const Abas = ({ abaAtiva, setAbaAtiva, contagens }) => (
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
);

// ── Componente principal ──────────────────────────────────────
export const PainelDeputado = () => {
  const { deputadoSelecionado, fecharPainel } = useParlamento();
  const isMobile = useIsMobile();
  const [abaAtiva, setAbaAtiva] = useState('iniciativas');
  const [iniciativaSelecionada, setIniciativaSelecionada] = useState(null);
  const [debateSelecionado, setDebateSelecionado] = useState(null);
  const [biografiaAberta, setBiografiaAberta]   = useState(false);
  const [presencasAbertas, setPresencasAbertas] = useState(false);
  const { perfil, iniciativas, carregando } = useArDeputado(deputadoSelecionado);
  const nomeParlamentar = perfil?.nome_parlamentar ?? deputadoSelecionado?.nomeAbrev ?? '';
  const { intervencoes, carregando: carregandoInt } = useIntervencoesDeputado(nomeParlamentar, deputadoSelecionado.partido);
  const { bio, carregando: carregandoBio } = useBiografiaDeputado(perfil?.cad_id);
  const { presencas, carregando: carregandoPresencas } = usePresencasDeputado(perfil?.cad_id);

  if (!deputadoSelecionado) return null;

  const partido = partidos[deputadoSelecionado.partido];
  const contagens = {
    iniciativas:  iniciativas.length,
    intervencoes: intervencoes.length,
  };

  const conteudo = (
    <>
      {abaAtiva === 'iniciativas'  && <SecaoIniciativas  iniciativas={iniciativas}  carregando={carregando}    onClickIniciativa={setIniciativaSelecionada} />}
      {abaAtiva === 'intervencoes' && <SecaoIntervencoes intervencoes={intervencoes} carregando={carregandoInt} corPartido={partido?.cor} />}
    </>
  );

  const modais = (
    <>
      <ModalIniciativa
        iniciativa={iniciativaSelecionada}
        onFechar={() => setIniciativaSelecionada(null)}
      />
      <ModalDebate
        debate={debateSelecionado}
        onFechar={() => setDebateSelecionado(null)}
      />
      {biografiaAberta && (
        <ModalBiografia
          bio={bio}
          carregando={carregandoBio}
          nomeDeputado={deputadoSelecionado.nome}
          corPartido={partido?.cor}
          onFechar={() => setBiografiaAberta(false)}
        />
      )}
      {presencasAbertas && (
        <ModalPresencas
          presencas={presencas}
          carregando={carregandoPresencas}
          nomeDeputado={deputadoSelecionado.nome}
          corPartido={partido?.cor}
          onFechar={() => setPresencasAbertas(false)}
        />
      )}
    </>
  );

  // ── Layout mobile: bottom sheet ───────────────────────────────
  if (isMobile) {
    return (
      <>
        <div
          className="fixed bottom-0 left-0 right-0 z-30 flex flex-col bg-white rounded-t-2xl shadow-2xl border-t border-gray-100"
          style={{ maxHeight: '78vh' }}
        >
          {/* Handle */}
          <div className="flex justify-center pt-2.5 pb-1 flex-shrink-0">
            <div className="w-10 h-1 rounded-full bg-gray-200" />
          </div>

          {/* Cabeçalho compacto */}
          <div
            className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 flex-shrink-0"
            style={{ borderLeft: `4px solid ${partido?.cor ?? '#6b7280'}` }}
          >
            {/* Foto */}
            <div
              className="rounded-xl overflow-hidden border border-gray-200 flex-shrink-0"
              style={{ width: '44px', height: '52px' }}
            >
              {deputadoSelecionado.foto ? (
                <img
                  src={deputadoSelecionado.foto}
                  alt={deputadoSelecionado.nomeAbrev ?? deputadoSelecionado.nome}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }}
                />
              ) : (
                <div style={{
                  width: '100%', height: '100%',
                  background: partido?.cor ?? '#555',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: '18px', fontWeight: 700,
                }}>
                  {obterIniciais(deputadoSelecionado.nome)}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate leading-tight">
                {deputadoSelecionado.nome}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {partido?.logo && (
                  <img src={partido.logo} alt={partido.id} style={{ height: '13px', width: 'auto' }} />
                )}
                <span className="text-xs text-gray-500 truncate">{partido?.nome}</span>
              </div>
              {deputadoSelecionado.circulo && (
                <div className="flex items-center gap-1 mt-0.5">
                  <MapPin size={9} className="text-gray-400 flex-shrink-0" />
                  <span className="text-xs text-gray-400 truncate">{deputadoSelecionado.circulo}</span>
                </div>
              )}
            </div>

            {/* Fechar + stats */}
            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
              <button
                onClick={fecharPainel}
                className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
                aria-label="Fechar painel"
              >
                <X size={16} className="text-gray-500" />
              </button>
              <button
                onClick={() => setBiografiaAberta(true)}
                className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
                aria-label="Ver biografia"
              >
                <BookUser size={16} className="text-gray-400" />
              </button>
              <button
                onClick={() => setPresencasAbertas(true)}
                className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
                aria-label="Ver presenças"
              >
                <CalendarCheck size={16} className="text-gray-400" />
              </button>
              <span className="text-[10px] text-gray-400 text-right leading-tight">
                {iniciativas.length} init.<br />{intervencoes.length} interv.
              </span>
            </div>
          </div>

          {/* Abas */}
          <Abas abaAtiva={abaAtiva} setAbaAtiva={setAbaAtiva} contagens={contagens} />

          {/* Conteúdo scrollável */}
          <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
            {conteudo}
          </div>
        </div>
        {modais}
      </>
    );
  }

  // ── Layout desktop: painel lateral ───────────────────────────
  return (
    <>
      <div
        className="absolute inset-0 flex overflow-hidden z-20 bg-white"
        role="dialog"
        aria-label={`Perfil de ${deputadoSelecionado.nome}`}
      >
        {/* Coluna esquerda: identidade */}
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

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setBiografiaAberta(true)}
                className="flex-1 aspect-square rounded-2xl border-2 border-white/30 hover:border-white/60 hover:bg-white/10 transition-all flex flex-col items-center justify-center gap-2 group"
              >
                <BookUser size={24} className="text-white/60 group-hover:text-white transition-colors" />
                <span className="text-white/70 group-hover:text-white text-[10px] font-semibold uppercase tracking-wider transition-colors">
                  Biografia
                </span>
              </button>

              <button
                onClick={() => setPresencasAbertas(true)}
                className="flex-1 aspect-square rounded-2xl border-2 border-white/30 hover:border-white/60 hover:bg-white/10 transition-all flex flex-col items-center justify-center gap-2 group"
              >
                <CalendarCheck size={24} className="text-white/60 group-hover:text-white transition-colors" />
                <span className="text-white/70 group-hover:text-white text-[10px] font-semibold uppercase tracking-wider transition-colors">
                  Presenças
                </span>
              </button>
            </div>
          </div>

        </div>

        {/* Coluna direita: dados */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
          <Abas abaAtiva={abaAtiva} setAbaAtiva={setAbaAtiva} contagens={contagens} />
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {conteudo}
          </div>
        </div>
      </div>
      {modais}
    </>
  );
};