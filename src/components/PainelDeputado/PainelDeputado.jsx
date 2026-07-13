import { useState, useEffect } from 'react';
import { X, MapPin, FileText, Mic, ExternalLink, BookUser, CalendarCheck, AlertTriangle, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useParlamento } from '../../context/ParlamentoContext';
import { partidos } from '../../data/mockPartidos';
import { obterIniciais } from '../../utils/formatters';
import { useArDeputado } from '../../hooks/useArDeputado';
import { useIntervencoesDeputado } from '../../hooks/useIntervencoesDeputado';
import { useBiografiaDeputado } from '../../hooks/useBiografiaDeputado';
import { useVotosRebelde } from '../../hooks/useVotosRebelde';
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
            {ini.dar_links?.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 bg-indigo-50 group-hover:bg-indigo-100 rounded px-1.5 py-0.5">
                <BookOpen size={9} />
                {ini.dar_links.length} debate{ini.dar_links.length !== 1 ? 's' : ''} no DAR
              </span>
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

const MIN_PALAVRAS = 40;
const SNIPPET_LEN  = 180;

const MES_NOME = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const dataPublicacao = (iv) => {
  const m = (iv.url_diario ?? '').match(/\/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : (iv.data_debate ?? 'Sem data');
};

const urlPaginaAR = (url) => url ? url.split('?')[0] : null;

const mesAnoKey   = (iv) => dataPublicacao(iv).slice(0, 7);  // YYYY-MM (sortable)
const mesAnoLabel = (iv) => {
  const d = dataPublicacao(iv);
  if (d === 'Sem data') return 'Sem data';
  const [y, mo] = d.split('-');
  return `${MES_NOME[parseInt(mo, 10) - 1]} ${y}`;
};

const CartaoIntervencao = ({ iv, texto, carregandoTextos, expandido, onToggle, iniciativa }) => {
  const temTexto     = typeof texto === 'string' && texto.length > 0;
  const podeExpandir = temTexto && texto.length > SNIPPET_LEN;
  const snippet      = temTexto
    ? texto.trim().slice(0, SNIPPET_LEN) + (podeExpandir ? '…' : '')
    : null;

  return (
    <div className={`border rounded-xl overflow-hidden transition-all duration-150 ${
      expandido ? 'border-gray-300 shadow-sm' : 'border-gray-100 hover:border-gray-200'
    }`}>
      <button
        onClick={onToggle}
        className="w-full text-left p-3 hover:bg-gray-50 transition-colors"
      >
        {/* Badges */}
        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
          {iv.fase_debate && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 border border-violet-100">
              {iv.fase_debate}
            </span>
          )}
          {iv.num_palavras != null && iv.num_palavras < MIN_PALAVRAS && (
            <span className="text-[10px] text-gray-400 bg-gray-50 rounded-full px-2 py-0.5 border border-gray-100">
              🗯️ interjeição
            </span>
          )}
        </div>

        {/* Assunto — sempre visível, com fallback */}
        <p className="text-xs font-semibold text-gray-700 mb-1.5 leading-snug">
          {iv.assunto ?? 'Intervenção parlamentar'}
        </p>

        {/* Iniciativa associada — navega para a página completa */}
        {iv.iniciativa_id && iniciativa && (
          <Link
            to={`/iniciativas/${iv.iniciativa_id}`}
            onClick={e => e.stopPropagation()}
            className="flex items-start gap-1 mb-1.5 text-left group/ini w-full"
          >
            <FileText size={10} className="text-blue-400 mt-0.5 flex-shrink-0 group-hover/ini:text-blue-600" />
            <span className="text-[10px] text-blue-500 group-hover/ini:text-blue-700 leading-snug line-clamp-2 transition-colors">
              {iniciativa.desc_tipo ? `${iniciativa.desc_tipo} · ` : ''}{iniciativa.titulo}
            </span>
          </Link>
        )}

        {/* Snippet / texto completo / loading skeleton */}
        {carregandoTextos ? (
          <div className="space-y-1.5 mt-1">
            <div className="h-2.5 bg-gray-100 rounded animate-pulse w-full" />
            <div className="h-2.5 bg-gray-100 rounded animate-pulse w-4/5" />
          </div>
        ) : temTexto ? (
          <p className={`text-xs text-gray-500 leading-relaxed ${expandido ? 'whitespace-pre-wrap' : 'line-clamp-2'}`}>
            {expandido ? texto : snippet}
          </p>
        ) : null}

        {/* Footer */}
        <div className="flex items-center justify-between mt-2">
          {iv.url_diario ? (
            <a
              href={urlPaginaAR(iv.url_diario)}
              target="_blank"
              rel="noreferrer"
              onClick={e => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-600 transition-colors"
            >
              <ExternalLink size={9} />
              Ver no DAR
            </a>
          ) : <span />}
          {podeExpandir && (
            <span className="text-[10px] text-gray-300">
              {expandido ? '▲ ver menos' : '▼ ver mais'}
            </span>
          )}
        </div>
      </button>
    </div>
  );
};

const SecaoIntervencoes = ({ intervencoes, carregando, corPartido, onVerIniciativa, iniciativasIdMapa }) => {
  const [textos, setTextos]             = useState({});
  const [carregandoTextos, setLoadTx]   = useState(false);
  const [expandido, setExpandido]       = useState(null);
  const [mostrarTodas, setMostrarTodas] = useState(false);

  // Pré-carrega textos de todas as intervenções do deputado actual.
  // Faz chunks de 200 para não exceder o limite de tamanho de URL do PostgREST.
  useEffect(() => {
    if (!intervencoes.length) return;
    setTextos({});
    setExpandido(null);
    setLoadTx(true);
    const ids = intervencoes.map(iv => iv.id);
    const CHUNK = 200;
    const chunks = [];
    for (let i = 0; i < ids.length; i += CHUNK) chunks.push(ids.slice(i, i + CHUNK));
    Promise.all(
      chunks.map(chunk => supabase.from('ar_intervencoes').select('id, texto').in('id', chunk))
    ).then(results => {
      const t = {};
      results.forEach(({ data }) => {
        (data ?? []).forEach(iv => { t[iv.id] = iv.texto ?? ''; });
      });
      setTextos(t);
      setLoadTx(false);
    });
  }, [intervencoes]);

  if (carregando) return <p className="text-sm text-gray-400 italic">A carregar intervenções...</p>;
  if (!intervencoes.length) return <p className="text-sm text-gray-400 italic">Sem intervenções indexadas.</p>;

  const lista     = mostrarTodas ? intervencoes : intervencoes.filter(iv => (iv.num_palavras ?? MIN_PALAVRAS) >= MIN_PALAVRAS);
  const filtradas = intervencoes.length - lista.length;

  // Agrupar por mês
  const grupos = {};
  for (const iv of lista) {
    const key   = mesAnoKey(iv) || '0000-00';
    const label = mesAnoLabel(iv);
    if (!grupos[key]) grupos[key] = { label, items: [] };
    grupos[key].items.push(iv);
  }
  const meses = Object.entries(grupos).sort(([a], [b]) => b.localeCompare(a));

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

      {meses.map(([key, { label, items }]) => (
        <div key={key}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2 sticky top-0 bg-white py-1"
             style={{ color: corPartido ?? '#9ca3af' }}>
            {label}
          </p>
          <div className="space-y-2">
            {items.map(iv => (
              <CartaoIntervencao
                key={iv.id}
                iv={iv}
                texto={textos[iv.id]}
                carregandoTextos={carregandoTextos}
                expandido={expandido === iv.id}
                onToggle={() => setExpandido(p => p === iv.id ? null : iv.id)}
                iniciativa={iv.iniciativa_id ? iniciativasIdMapa?.get(String(iv.iniciativa_id)) : null}
                onVerIniciativa={onVerIniciativa}
              />
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

// ── Modal de votos divergentes ────────────────────────────────

const POSICAO_COR_MODAL = {
  favor:     { bg: 'bg-green-100',  text: 'text-green-700'  },
  contra:    { bg: 'bg-red-100',    text: 'text-red-700'    },
  abstencao: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
};
const POSICAO_LABEL_MODAL = { favor: 'A favor', contra: 'Contra', abstencao: 'Abstenção' };

function ModalVotosDivergentes({ votos, titulos, nomeDeputado, corPartido, onFechar }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100" style={{ borderTopColor: corPartido }}>
          <AlertTriangle size={16} className="text-amber-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900">Votos divergentes</p>
            <p className="text-xs text-gray-500 truncate">{nomeDeputado}</p>
          </div>
          <button onClick={onFechar} className="p-1.5 rounded-full hover:bg-gray-100 transition-colors">
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        {/* Lista */}
        <div className="overflow-y-auto flex-1 divide-y divide-gray-50">
          {votos.map(v => {
            const dep = (v.deputados_isolados ?? []).find(d => d.nome === nomeDeputado);
            const posP = POSICAO_COR_MODAL[dep?.posicao_partido];
            const posD = POSICAO_COR_MODAL[dep?.posicao];
            return (
              <Link
                key={v.id}
                to={`/votacoes/${v.id}`}
                onClick={onFechar}
                className="block px-5 py-3.5 hover:bg-gray-50 transition-colors"
              >
                <p className="text-xs font-medium text-gray-800 line-clamp-2 mb-2">
                  {titulos[v.iniciativa_id] ?? `Votação ${v.id}`}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  {v.data_votacao && (
                    <span className="text-[10px] text-gray-400">
                      {new Date(v.data_votacao).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  )}
                  {dep && (
                    <>
                      <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${posP?.bg} ${posP?.text}`}>
                        Partido: {POSICAO_LABEL_MODAL[dep.posicao_partido] ?? '?'}
                      </span>
                      <span className="text-[10px] text-gray-400">→</span>
                      <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${posD?.bg} ${posD?.text}`}>
                        Votou: {POSICAO_LABEL_MODAL[dep.posicao] ?? '?'}
                      </span>
                    </>
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
          <p className="text-[10px] text-gray-400 text-center">
            Apenas votações com registo individual do deputado no detalhe oficial
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────
export const PainelDeputado = () => {
  const { deputadoSelecionado, fecharPainel } = useParlamento();
  const isMobile = useIsMobile();
  const [abaAtiva, setAbaAtiva] = useState('iniciativas');
  const [iniciativaSelecionada, setIniciativaSelecionada] = useState(null);
  const [debateSelecionado, setDebateSelecionado] = useState(null);
  const [biografiaAberta, setBiografiaAberta]   = useState(false);
  const [presencasAbertas, setPresencasAbertas] = useState(false);
  const [rebeldesAbertos, setRebeldesAbertos]   = useState(false);
  const { iniciativasIdMapa } = useParlamento();
  const { perfil, iniciativas, carregando } = useArDeputado(deputadoSelecionado);
  const nomeParlamentar = perfil?.nome_parlamentar ?? deputadoSelecionado?.nomeAbrev ?? '';
  const { intervencoes, carregando: carregandoInt } = useIntervencoesDeputado(nomeParlamentar, deputadoSelecionado.partido);
  const { bio, carregando: carregandoBio } = useBiografiaDeputado(perfil?.cad_id);
  const { presencas, carregando: carregandoPresencas } = usePresencasDeputado(perfil?.cad_id);
  const { votos: votosRebelde, titulos: titulosRebelde } = useVotosRebelde(nomeParlamentar);

  if (!deputadoSelecionado) return null;

  const partido = partidos[deputadoSelecionado.partido];
  const contagens = {
    iniciativas:  iniciativas.length,
    intervencoes: intervencoes.length,
  };

  const conteudo = (
    <>
      {abaAtiva === 'iniciativas'  && <SecaoIniciativas  iniciativas={iniciativas}  carregando={carregando}    onClickIniciativa={setIniciativaSelecionada} />}
      {abaAtiva === 'intervencoes' && <SecaoIntervencoes intervencoes={intervencoes} carregando={carregandoInt} corPartido={partido?.cor} onVerIniciativa={setIniciativaSelecionada} iniciativasIdMapa={iniciativasIdMapa} />}
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
      {rebeldesAbertos && (
        <ModalVotosDivergentes
          votos={votosRebelde}
          titulos={titulosRebelde}
          nomeDeputado={deputadoSelecionado.nome}
          corPartido={partido?.cor}
          onFechar={() => setRebeldesAbertos(false)}
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
              {votosRebelde.length > 0 && (
                <div className="flex justify-between text-xs text-amber-200/80 mt-1 pt-1 border-t border-white/10">
                  <span className="flex items-center gap-1">
                    <AlertTriangle size={10} />Votos divergentes
                  </span>
                  <span className="font-bold text-amber-200">{votosRebelde.length}</span>
                </div>
              )}
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

              {votosRebelde.length > 0 && (
                <button
                  onClick={() => setRebeldesAbertos(true)}
                  className="flex-1 aspect-square rounded-2xl border-2 border-amber-300/50 hover:border-amber-300 hover:bg-amber-400/10 transition-all flex flex-col items-center justify-center gap-2 group relative"
                >
                  <AlertTriangle size={24} className="text-amber-300/70 group-hover:text-amber-300 transition-colors" />
                  <span className="text-amber-200/70 group-hover:text-amber-200 text-[10px] font-semibold uppercase tracking-wider transition-colors">
                    Divergente
                  </span>
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-400 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {votosRebelde.length}
                  </span>
                </button>
              )}
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