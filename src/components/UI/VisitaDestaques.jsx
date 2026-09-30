import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, ChevronLeft, ChevronRight, X, ExternalLink } from 'lucide-react';
import { track } from '@vercel/analytics';
import { supabase } from '../../lib/supabase';
import { useParlamento } from '../../context/ParlamentoContext';
import { useIsMobile, useIsTabletPortrait } from '../../hooks/useIsMobile';
import { getCorPartido } from '../../data/mockPartidos';
import { obterIniciais } from '../../utils/formatters';
import {
  escalaDaCena, lenteDoCartao, vistaDeputados, vistaInicial, vistaVotacao, voarPara,
} from '../../utils/vistasHemiciclo';

/**
 * A visita guiada aos destaques: três a cinco paragens com o que importa,
 * escolhido todos os dias pelo pipeline (ar-data-sync/src/destaques.js).
 *
 * Em cada paragem a sala mostra a história — as bancadas pintadas pela
 * posição numa votação, ou os deputados em causa acesos — e um cartão conta-a
 * numa frase, com os números, todos os lados, e a fonte.
 *
 * Abre sozinha a quem chega pela primeira vez e sempre que os destaques
 * mudam; quem já os viu tem o botão. É uma porta de entrada, não uma
 * barreira: salta-se num toque, e acaba com a sala livre para explorar.
 */

/** Tempo de leitura de uma paragem: um título, duas frases e uns números. */
const DURACAO_MS = 14_000;
/** Depois de a sala aparecer, uma pausa antes de a visita começar sozinha. */
const ESPERA_ABERTURA_MS = 1_400;
const CHAVE_VISTO = 'destaques:visto';

const COR = { favor: '#16a34a', contra: '#dc2626', abstencao: '#d97706' };
const ROTULO_LADO = { favor: 'A favor', contra: 'Contra', abstencao: 'Abstenção' };

function lerVisto() {
  try { return window.localStorage.getItem(CHAVE_VISTO); } catch { return null; }
}
function guardarVisto(id) {
  try { window.localStorage.setItem(CHAVE_VISTO, id); } catch { /* sem armazenamento: volta a abrir, e mais nada */ }
}
const prefereMenosMovimento = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const n = (x) => Number(x).toLocaleString('pt-PT');

// ── Peças do cartão ───────────────────────────────────────────────────────────

/** A votação numa barra: cada lado com a largura dos seus lugares. */
function BarraVotacao({ numeros, lados }) {
  const porTom = Object.fromEntries(numeros.map((x) => [x.tom, x.valor]));
  const partes = ['favor', 'contra', 'abstencao'].filter((t) => porTom[t] > 0);
  const total = partes.reduce((s, t) => s + porTom[t], 0) || 1;

  return (
    <div className="mt-3">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-gray-100" aria-hidden="true">
        {partes.map((t) => (
          <div key={t} style={{ width: `${(porTom[t] / total) * 100}%`, background: COR[t] }} />
        ))}
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2">
        {['favor', 'contra', 'abstencao'].map((t) => (
          <div key={t} className="min-w-0">
            <dt className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: COR[t] }}>
              <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: COR[t] }} />
              {ROTULO_LADO[t]}
            </dt>
            <dd className="text-sm font-semibold tabular-nums text-gray-900">
              {n(porTom[t] ?? 0)} <span className="text-[10px] font-normal text-gray-400">lugares</span>
            </dd>
            {lados?.[t]?.length > 0 && (
              <dd className="text-[11px] leading-snug text-gray-500">{lados[t].join(', ')}</dd>
            )}
          </div>
        ))}
      </dl>
    </div>
  );
}

/** As caras de quem está na história — tocar abre o perfil. */
function Pessoas({ pessoas, deputadosPorId, onAbrir }) {
  if (!pessoas?.length) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {pessoas.map((p) => {
        const dep = deputadosPorId.get(p.id);
        const cor = getCorPartido(p.partido);
        return (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => dep && onAbrir(dep)}
              disabled={!dep}
              className="flex items-center gap-2 rounded-full border border-gray-200 bg-white py-1 pl-1 pr-3 text-left transition hover:border-gray-300 hover:shadow-sm disabled:cursor-default"
            >
              {dep?.foto ? (
                <img src={dep.foto} alt="" className="h-7 w-7 rounded-full object-cover" />
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-white" style={{ background: cor }}>
                  {obterIniciais(p.nome)}
                </span>
              )}
              <span className="text-xs font-medium text-gray-800">{p.nome}</span>
              <span className="text-[10px] font-semibold" style={{ color: cor }}>{p.partido}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ── A visita ──────────────────────────────────────────────────────────────────

export const VisitaDestaques = () => {
  const {
    tudoCarregado, deputados, posicoes3D, cameraControlsRef,
    selecionarDeputado, deputadoSelecionado, governanteSelecionado, vistaGoverno,
    setCenaDestaque, setVisitaAberta,
  } = useParlamento();
  const isMobile = useIsMobile();
  const isTabletPortrait = useIsTabletPortrait();

  const [dados, setDados] = useState(null);
  const [aberta, setAberta] = useState(false);
  const [indice, setIndice] = useState(0);
  const [pausada, setPausada] = useState(false);
  // Em telemóvel a explicação fica fechada: o cartão tem de deixar a sala à
  // vista por cima dele, e três frases de texto ocupavam o ecrã todo.
  const [explicacaoAberta, setExplicacaoAberta] = useState(false);
  const decidiuAbrir = useRef(false);
  const cancelarVoo = useRef(() => {});
  const cartaoRef = useRef(null);

  const deputadosPorId = useMemo(() => new Map(deputados.map((d) => [d.id, d])), [deputados]);
  const destaques = dados?.destaques ?? [];
  const atual = destaques[indice];
  const ultima = indice === destaques.length - 1;
  const semMovimento = prefereMenosMovimento();

  // ── Carregar os destaques do dia ──
  useEffect(() => {
    const { data } = supabase.storage.from('destaques').getPublicUrl('atual.json');
    if (!data?.publicUrl) return;
    let vivo = true;
    fetch(data.publicUrl, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (vivo && j?.destaques?.length) setDados(j); })
      .catch(() => { /* sem destaques: o site funciona como antes, só sem a visita */ });
    return () => { vivo = false; };
  }, []);

  // ── Abrir e fechar ──
  const abrir = useCallback((origem) => {
    setIndice(0);
    setPausada(false);
    setAberta(true);
    setVisitaAberta(true);
    track('visita_abriu', { origem });
  }, [setVisitaAberta]);

  const fechar = useCallback((motivo) => {
    setAberta(false);
    setVisitaAberta(false);
    setCenaDestaque(null);
    if (dados?.id) guardarVisto(dados.id);
    cancelarVoo.current();
    const area = document.querySelector('.hemiciclo-canvas-wrap');
    if (motivo !== 'perfil') {
      // De volta à vista inicial, e a lente volta ao centro no mesmo voo.
      cancelarVoo.current = voarPara(cameraControlsRef.current, vistaInicial({ isMobile }), {
        duracao: semMovimento ? 1 : 1200, lente: { dx: 0, dy: 0 }, area,
      });
    } else {
      // Abriu-se um perfil: a câmara fica onde está, mas sem o descentramento
      // — o painel do deputado não conta com ele.
      const camara = cameraControlsRef.current?.object;
      if (camara?.view?.enabled) camara.clearViewOffset();
    }
    track('visita_fechou', { motivo, paragem: indice + 1, de: destaques.length });
  }, [dados, setVisitaAberta, setCenaDestaque, cameraControlsRef, isMobile, semMovimento, indice, destaques.length]);

  // Sozinha na primeira visita, e quando os destaques mudaram desde a última.
  useEffect(() => {
    if (!dados || !tudoCarregado || decidiuAbrir.current) return;
    decidiuAbrir.current = true;
    if (lerVisto() === dados.id) return;
    const t = window.setTimeout(() => abrir('automatica'), ESPERA_ABERTURA_MS);
    return () => window.clearTimeout(t);
  }, [dados, tudoCarregado, abrir]);

  // Quem abre um perfil escolheu explorar: a visita sai da frente.
  useEffect(() => {
    if (aberta && (deputadoSelecionado || governanteSelecionado)) fechar('perfil');
  }, [aberta, deputadoSelecionado, governanteSelecionado, fechar]);

  // ── Cada paragem: a sala conta a história ──
  useEffect(() => {
    if (!aberta || !atual) return;
    setCenaDestaque(atual.cena);
    track('visita_paragem', { paragem: indice + 1, tipo: atual.tipo });

    const escala = escalaDaCena({ isMobile, isTabletPortrait });
    const ids = atual.cena?.deputados ?? [];
    const pontos = ids
      .map((id) => posicoes3D.get(id)?.position)
      .filter(Boolean)
      .map((p) => p.map((v) => v * escala));

    // As pessoas, se a história tiver pessoas; senão a sala inteira, de cima.
    const destino = pontos.length
      ? vistaDeputados(pontos, { escala, isMobile })
      : vistaVotacao({ isMobile, escala });

    // A história vai para o meio do espaço que o cartão deixa livre — à
    // direita dele no computador, acima dele no telemóvel. Medido depois de o
    // cartão desta paragem estar desenhado, que muda de altura entre paragens.
    const area = document.querySelector('.hemiciclo-canvas-wrap');
    const lente = lenteDoCartao(cartaoRef.current, area);

    cancelarVoo.current();
    cancelarVoo.current = voarPara(cameraControlsRef.current, destino, {
      duracao: semMovimento ? 1 : 1400, lente, area,
    });
  }, [aberta, atual, indice, isMobile, isTabletPortrait, posicoes3D, cameraControlsRef, setCenaDestaque, semMovimento]);

  // Cada paragem começa com a explicação fechada (em telemóvel).
  useEffect(() => { setExplicacaoAberta(false); }, [indice]);

  useEffect(() => () => cancelarVoo.current(), []);

  const seguinte = useCallback(() => {
    if (ultima) fechar('terminou');
    else setIndice((i) => i + 1);
  }, [ultima, fechar]);
  const anterior = useCallback(() => setIndice((i) => Math.max(0, i - 1)), []);

  // Teclado: setas para andar, Esc para sair.
  useEffect(() => {
    if (!aberta) return;
    const tecla = (e) => {
      if (e.key === 'ArrowRight') seguinte();
      else if (e.key === 'ArrowLeft') anterior();
      else if (e.key === 'Escape') fechar('esc');
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [aberta, seguinte, anterior, fechar]);

  if (!dados) return null;

  // ── Fechada: o botão para voltar a ver ──
  if (!aberta) {
    if (vistaGoverno || deputadoSelecionado || governanteSelecionado) return null;
    return (
      <button
        type="button"
        onClick={() => abrir('botao')}
        className="absolute left-3 top-14 z-20 flex items-center gap-2 rounded-full border border-gray-200 bg-white/95 px-3.5 py-2 text-xs font-semibold text-gray-900 shadow-lg backdrop-blur transition hover:bg-white hover:shadow-xl md:top-3"
      >
        <Sparkles size={14} className="text-amber-500" />
        O que importa esta semana
        <span className="rounded-full bg-gray-900 px-1.5 text-[10px] font-semibold tabular-nums text-white">{destaques.length}</span>
      </button>
    );
  }

  // ── Aberta: o cartão da paragem ──
  // Barra de progresso em CSS: o fim da animação avança, e pausar é só parar
  // a animação — sem temporizadores a dessincronizar do que se vê.
  const avancaSozinha = !semMovimento && !ultima && !explicacaoAberta;
  // No computador cabe tudo; no telemóvel o essencial à vista e o resto a um toque.
  const mostrarTudo = !isMobile || explicacaoAberta;

  return (
    <section
      ref={cartaoRef}
      role="dialog"
      aria-modal="false"
      aria-label="O que importa esta semana"
      onMouseEnter={() => setPausada(true)}
      onMouseLeave={() => setPausada(false)}
      onTouchStart={() => setPausada(true)}
      className="absolute inset-x-0 bottom-0 z-30 max-h-[52%] overflow-y-auto overflow-x-hidden rounded-t-2xl border border-gray-200 bg-white/95 shadow-2xl backdrop-blur-md md:inset-x-auto md:bottom-4 md:left-4 md:max-h-[calc(100%-2rem)] md:w-[440px] md:rounded-2xl"
    >
      <style>{`@keyframes progressoVisita { from { width: 0% } to { width: 100% } }`}</style>

      <div className="sticky top-0 z-10 bg-white/95 px-4 pb-2 pt-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-600">
            <Sparkles size={13} /> O que importa
            <span className="font-normal normal-case tracking-normal text-gray-400">
              · {indice + 1} de {destaques.length}
            </span>
          </p>
          <button
            type="button"
            onClick={() => fechar('saltou')}
            className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"
            aria-label="Saltar a visita"
          >
            Saltar <X size={13} />
          </button>
        </div>

        <div className="mt-2 flex gap-1" aria-hidden="true">
          {destaques.map((d, i) => (
            <div key={d.id} className="h-1 flex-1 overflow-hidden rounded-full bg-gray-200">
              {i < indice && <div className="h-full w-full bg-gray-800" />}
              {i === indice && (
                <div
                  key={`${d.id}-${indice}`}
                  className="h-full bg-gray-800"
                  style={
                    avancaSozinha
                      ? { animation: `progressoVisita ${DURACAO_MS}ms linear forwards`, animationPlayState: pausada ? 'paused' : 'running' }
                      : { width: '100%' }
                  }
                  onAnimationEnd={avancaSozinha ? seguinte : undefined}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 pb-4" aria-live="polite">
        <p className="truncate text-[11px] text-gray-400 md:whitespace-normal">{atual.contexto}</p>
        <h2 className="mt-1 text-base font-bold leading-snug text-gray-900 md:text-lg">{atual.titulo}</h2>

        {atual.explicacao && mostrarTudo && (
          <p className="mt-2 text-[13px] leading-relaxed text-gray-600">
            {atual.explicacao}
            {atual.escritoPorIA && (
              <span className="ml-1.5 whitespace-nowrap rounded bg-gray-100 px-1.5 py-px text-[10px] font-medium text-gray-400">
                resumo automático
              </span>
            )}
          </p>
        )}

        {atual.cena?.modo === 'votacao' && atual.numeros?.some((x) => x.tom === 'favor') && (
          <BarraVotacao numeros={atual.numeros} lados={atual.lados} />
        )}

        <Pessoas pessoas={atual.pessoas} deputadosPorId={deputadosPorId} onAbrir={selecionarDeputado} />

        <p className="mt-3 border-l-2 border-amber-400 pl-2.5 text-[12px] leading-snug text-gray-600">
          <span className="font-semibold text-gray-800">Porque aparece: </span>
          {atual.porque}
        </p>

        {!mostrarTudo && (atual.explicacao || atual.fonte?.url) && (
          <button
            type="button"
            onClick={() => setExplicacaoAberta(true)}
            className="mt-2 text-[12px] font-medium text-sky-700 underline decoration-sky-300 underline-offset-2"
          >
            Ler mais
          </button>
        )}

        {mostrarTudo && atual.fonte?.url && (
          <a
            href={atual.fonte.url}
            target="_blank"
            rel="noreferrer"
            onClick={() => track('visita_fonte', { tipo: atual.tipo })}
            className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-900"
          >
            {atual.fonte.rotulo} <ExternalLink size={12} />
          </a>
        )}

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={anterior}
            disabled={indice === 0}
            className="flex items-center gap-1 rounded-full px-3 py-2 text-xs font-medium text-gray-600 transition hover:bg-gray-100 disabled:opacity-30"
          >
            <ChevronLeft size={14} /> Anterior
          </button>
          <button
            type="button"
            onClick={seguinte}
            className="flex items-center gap-1 rounded-full bg-gray-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-gray-700"
          >
            {ultima ? 'Explorar a sala' : 'Seguinte'} {!ultima && <ChevronRight size={14} />}
          </button>
        </div>

        {mostrarTudo && (
          <p className="mt-3 text-[10px] leading-snug text-gray-400">
            Escolhido todos os dias a partir dos dados abertos da Assembleia: os números são calculados, e a IA só escreve
            as frases. Numa votação, contam-se os lugares de cada bancada.
          </p>
        )}
      </div>
    </section>
  );
};
