import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Search, AlertTriangle, CheckCircle2, Clock, Building2, RefreshCw, ChevronRight } from 'lucide-react';
import { useIsMobile } from '../hooks/useIsMobile';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { supabase } from '../lib/supabase';

const FILTROS = [
  { id: 'comPrazo',    label: 'Com prazo' },
  { id: 'atraso',      label: 'Em atraso' },
  { id: 'pendentes',   label: 'Por transpor' },
  { id: 'transpostas', label: 'Transpostas' },
  { id: 'todas',       label: 'Todas (incl. delegadas)' },
];

/**
 * Converte o título formal de uma diretiva num título legível.
 *
 * Estratégia:
 *  1. Remove o prefixo padrão (tipo + número + instituição + data),
 *     que termina sempre com o ano de publicação seguido de vírgula.
 *  2. Limpa preposições e locuções iniciais ("relativa a", "que altera", etc.).
 *  3. Capitaliza a primeira letra.
 *
 * Ex: "Diretiva (UE) 2022/2555 do PE e do Conselho, de 14 de dezembro de 2022,
 *      relativa a medidas destinadas a garantir um elevado nível de cibersegurança"
 *   → "Medidas destinadas a garantir um elevado nível de cibersegurança"
 */
function tituloCurto(titulo) {
  if (!titulo) return null;

  // 1. Remover prefixo formal até depois da data de publicação
  //    O ano de publicação é sempre o último \d{4} antes da vírgula que precede a descrição.
  const semPrefixo = titulo.replace(/^.+?\b\d{4}\b,\s*/, '').trim();
  let t = semPrefixo.length > 20 && semPrefixo !== titulo ? semPrefixo : titulo;

  // 2. Limpar locuções e preposições iniciais (PT e EN)
  t = t
    // PT: "relativa(s)/relativo(s) a/ao/à/..."
    .replace(/^relativ[ao]s?\s+(?:ao?s?\b\s*|às?\s*|a\s+)/i, '')
    // PT: "respeitante a / ao..."
    .replace(/^respeitante\s+[aà](?:o?s?)?\s+/i, '')
    // PT: "no que diz respeito a"
    .replace(/^no\s+que\s+(?:se\s+)?(?:diz\s+respeito|refere)\s+[aà]\s+/i, '')
    // PT: "sobre"
    .replace(/^sobre\s+/i, '')
    // PT: "que altera(m)" / "que revoga(m)" → forma mais curta
    .replace(/^que\s+alteram?\s+/i, 'Altera ')
    .replace(/^que\s+revogam?\s+/i, 'Revoga ')
    // PT: "que [outro verbo]" → capitaliza o verbo, remove "que"
    .replace(/^que\s+([a-záéíóúâêôãõç])/i, (_, c) => c.toUpperCase())
    // EN fallbacks
    .replace(/^on\s+/i, '')
    .replace(/^concerning\s+/i, '')
    .replace(/^laying\s+down\s+/i, '')
    .replace(/^establishing\s+/i, '')
    .replace(/^amending\s+/i, 'Altera ')
    .replace(/^implementing\s+/i, '')
    .replace(/^supplementing\s+/i, '')
    .trim();

  if (!t || t.length < 5) return titulo;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function TituloCell({ titulo }) {
  const curto = tituloCurto(titulo);
  return (
    <td className="px-4 py-3 text-gray-200 max-w-xs">
      <div className="relative group">
        <span className="line-clamp-2 cursor-default leading-snug">
          {curto ?? '—'}
        </span>
        {titulo && (
          <div
            className="
              pointer-events-none absolute z-30 left-0 top-full mt-1
              w-96 max-w-[min(24rem,80vw)]
              bg-gray-900 border border-white/15 rounded-lg px-4 py-3
              text-xs text-gray-200 leading-relaxed shadow-2xl
              invisible opacity-0
              group-hover:visible group-hover:opacity-100
              transition-opacity duration-150
            "
          >
            <p className="text-gray-400 text-[10px] uppercase tracking-wider mb-1">Título completo</p>
            {titulo}
          </div>
        )}
      </div>
    </td>
  );
}

function StatusBadge({ em_atraso, transposto_pt }) {
  if (transposto_pt)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-900/40 text-emerald-300 border border-emerald-700/40">
        <CheckCircle2 size={11} /> Transposta
      </span>
    );
  if (em_atraso)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-900/40 text-red-300 border border-red-700/40">
        <AlertTriangle size={11} /> Em atraso
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-900/40 text-amber-300 border border-amber-700/40">
      <Clock size={11} /> Pendente
    </span>
  );
}

function diasAtraso(prazo) {
  if (!prazo) return 0;
  return Math.floor((Date.now() - new Date(prazo).getTime()) / 86_400_000);
}

function formatarData(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function EstatCard({ valor, label, cor }) {
  return (
    <div className={`rounded-xl border p-4 ${cor}`}>
      <div className="text-2xl font-bold text-white">{valor}</div>
      <div className="text-xs text-gray-400 mt-0.5">{label}</div>
    </div>
  );
}

const CartaoDiretivaMobile = ({ d }) => {
  const atraso = d.em_atraso ? diasAtraso(d.prazo_transposicao) : 0;
  return (
    <Link
      to={`/diretivas-eu/${encodeURIComponent(d.id)}`}
      className="block bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 active:bg-white/10 transition-colors"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="font-mono text-xs text-gray-400 shrink-0">{d.id}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          <StatusBadge em_atraso={d.em_atraso} transposto_pt={d.transposto_pt} />
          <ChevronRight size={14} className="text-gray-600" />
        </div>
      </div>
      <p className="text-sm text-gray-200 leading-snug line-clamp-2">
        {tituloCurto(d.titulo) ?? '—'}
      </p>
      {d.prazo_transposicao && (
        <p className={`text-xs mt-1.5 ${d.em_atraso ? 'text-red-400' : 'text-gray-500'}`}>
          Prazo: {formatarData(d.prazo_transposicao)}
          {d.em_atraso && <span className="ml-1 font-medium">({atraso}d atraso)</span>}
        </p>
      )}
    </Link>
  );
};

export function DiretivasUE() {
  useDocumentTitle('Diretivas UE');
  const isMobile = useIsMobile();
  const [diretivas, setDiretivas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [filtro, setFiltro] = useState('comPrazo');
  const [busca, setBusca] = useState('');

  useEffect(() => {
    async function carregar() {
      setCarregando(true);
      setErro(null);
      const { data, error } = await supabase
        .from('diretivas_ue')
        .select('*')
        .order('prazo_transposicao', { ascending: false });

      if (error) {
        setErro(error.message);
      } else {
        setDiretivas(data ?? []);
      }
      setCarregando(false);
    }
    carregar();
  }, []);

  const stats = useMemo(() => {
    const comPrazo = diretivas.filter((d) => !!d.prazo_transposicao);
    return {
      comPrazo:    comPrazo.length,
      transpostas: diretivas.filter((d) => d.transposto_pt).length,
      atraso:      comPrazo.filter((d) => d.em_atraso).length,
      pendentes:   comPrazo.filter((d) => !d.transposto_pt && !d.em_atraso).length,
    };
  }, [diretivas]);

  const listagem = useMemo(() => {
    let lista = diretivas;

    if (filtro === 'comPrazo')    lista = lista.filter((d) => !!d.prazo_transposicao);
    if (filtro === 'atraso')      lista = lista.filter((d) => d.em_atraso);
    if (filtro === 'pendentes')   lista = lista.filter((d) => !d.transposto_pt && !d.em_atraso && !!d.prazo_transposicao);
    if (filtro === 'transpostas') lista = lista.filter((d) => d.transposto_pt);

    if (busca.trim()) {
      const q = busca.toLowerCase();
      lista = lista.filter(
        (d) =>
          d.id?.toLowerCase().includes(q) ||
          d.titulo?.toLowerCase().includes(q)
      );
    }

    return lista;
  }, [diretivas, filtro, busca]);

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-gray-100 flex flex-col">
      {/* ── Top nav ──────────────────────────────────────── */}
      <header className="sticky top-0 z-10 bg-[#16213e] border-b border-white/10 px-6 py-3 flex items-center gap-4">
        <Link to="/" className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
          <Building2 size={16} />
          <span>Parlamento 3D</span>
        </Link>
        <span className="text-white/20">›</span>
        <span className="text-sm font-semibold text-white">Diretivas UE</span>
        <div className="flex-1" />
        <Link to="/sobre" className="text-xs text-gray-400 hover:text-white transition-colors">Sobre</Link>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8">
        {/* ── Título ───────────────────────────────────── */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-white">Transposição de Diretivas da UE</h1>
          <p className="text-sm text-gray-400 mt-1">
            Diretivas europeias com prazo de transposição para Portugal, com base nos dados públicos do{' '}
            <a href="https://eur-lex.europa.eu" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
              EUR-Lex
            </a>
            . Portugal incorre em multas por cada diretiva transposta fora de prazo.
            As diretivas delegadas e de execução (sem prazo de notificação nacional) estão disponíveis no filtro &quot;Todas&quot;.
          </p>
        </div>

        {/* ── Disclaimer ───────────────────────────────── */}
        <div className="rounded-lg border border-amber-700/30 bg-amber-900/10 px-4 py-3 mb-6 text-xs text-amber-200/80 leading-relaxed">
          <strong className="text-amber-300">Aviso sobre a fiabilidade dos dados:</strong>{' '}
          O estado &quot;Transposta&quot; indica apenas que Portugal <em>comunicou</em> à Comissão Europeia a existência de medidas nacionais de implementação — não garante que a transposição seja correta ou completa.
          A Comissão pode abrir processos de infração mesmo após notificação, se considerar que a transposição é deficiente ou insuficiente.
          Para informação oficial sobre processos de infração em curso, consulte o{' '}
          <a
            href="https://ec.europa.eu/atwork/applying-eu-law/infringements-proceedings/infringement_decisions/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-amber-100"
          >
            registo de infrações da Comissão Europeia
          </a>
          .
        </div>

        {/* ── Estado: erro ou loading ──────────────────── */}
        {carregando && (
          <div className="flex items-center justify-center py-20 text-gray-400 gap-3">
            <RefreshCw size={18} className="animate-spin" />
            <span className="text-sm">A carregar diretivas...</span>
          </div>
        )}

        {!carregando && erro && (
          <div className="rounded-xl border border-red-700/40 bg-red-900/20 p-6 text-center">
            <p className="text-red-300 font-semibold mb-1">Erro ao carregar dados</p>
            <p className="text-sm text-red-400">{erro}</p>
            {erro.includes('does not exist') && (
              <p className="text-xs text-gray-400 mt-4">
                A tabela <code className="bg-white/10 px-1 rounded">diretivas_ue</code> ainda não existe no Supabase.
                Corre a migração em{' '}
                <code className="bg-white/10 px-1 rounded">supabase/migrations/20240101_diretivas_ue.sql</code>{' '}
                e depois executa <code className="bg-white/10 px-1 rounded">node ar-data-sync/src/eurlexSync.js</code>.
              </p>
            )}
          </div>
        )}

        {!carregando && !erro && diretivas.length === 0 && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
            <p className="text-gray-300 font-semibold mb-2">Sem dados ainda</p>
            <p className="text-sm text-gray-400 mb-4">
              Para popular esta página, executa o script de sincronização:
            </p>
            <code className="block text-xs bg-black/30 rounded-lg px-4 py-3 text-blue-300 font-mono text-left max-w-sm mx-auto">
              node ar-data-sync/src/eurlexSync.js
            </code>
            <p className="text-xs text-gray-500 mt-3">
              (Requer a migração SQL e as variáveis .env com as credenciais Supabase)
            </p>
          </div>
        )}

        {!carregando && !erro && diretivas.length > 0 && (
          <>
            {/* ── Estatísticas ─────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <EstatCard valor={stats.comPrazo}    label="Diretivas com prazo"         cor="border-white/10 bg-white/5" />
              <EstatCard valor={stats.transpostas} label="Transpostas por Portugal"   cor="border-emerald-700/30 bg-emerald-900/10" />
              <EstatCard valor={stats.pendentes}   label="Por transpor (no prazo)"    cor="border-amber-700/30 bg-amber-900/10" />
              <EstatCard valor={stats.atraso}      label="Em atraso (multa possível)" cor="border-red-700/30 bg-red-900/10" />
            </div>

            {/* ── Filtros + Busca ──────────────────────── */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="flex gap-1 bg-white/5 rounded-lg p-1">
                {FILTROS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFiltro(f.id)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      filtro === f.id
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Pesquisar por título ou nº CELEX..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
                />
              </div>
            </div>

            <p className="text-xs text-gray-500 mb-3">{listagem.length} diretivas</p>

            {/* ── Lista (mobile) / Tabela (desktop) ────── */}
            {isMobile ? (
              <div className="space-y-3">
                {listagem.map(d => <CartaoDiretivaMobile key={d.id} d={d} />)}
                {listagem.length === 0 && (
                  <p className="text-center py-10 text-gray-500 text-sm">Nenhuma diretiva encontrada.</p>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-white/10 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-white/5 text-xs text-gray-400 uppercase tracking-wider">
                      <th className="text-left px-4 py-3">Estado</th>
                      <th className="text-left px-4 py-3">CELEX</th>
                      <th className="text-left px-4 py-3">Título</th>
                      <th className="text-left px-4 py-3">Prazo</th>
                      <th className="text-left px-4 py-3">Atraso</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {listagem.map((d, i) => {
                      const atraso = d.em_atraso ? diasAtraso(d.prazo_transposicao) : 0;
                      return (
                        <tr
                          key={d.id}
                          className={`border-t border-white/5 transition-colors hover:bg-white/[0.03] ${
                            i % 2 === 0 ? '' : 'bg-white/[0.02]'
                          }`}
                        >
                          <td className="px-4 py-3 whitespace-nowrap">
                            <StatusBadge em_atraso={d.em_atraso} transposto_pt={d.transposto_pt} />
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-300 whitespace-nowrap">
                            {d.id}
                          </td>
                          <TituloCell titulo={d.titulo} />
                          <td className="px-4 py-3 whitespace-nowrap text-gray-400 text-xs">
                            {formatarData(d.prazo_transposicao)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-xs">
                            {d.em_atraso ? (
                              <span className="text-red-400 font-medium">{atraso}d</span>
                            ) : (
                              <span className="text-gray-600">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            {d.link_eurlex && (
                              <a
                                href={d.link_eurlex}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300 transition-colors"
                                title="Ver no EUR-Lex"
                              >
                                <ExternalLink size={14} />
                              </a>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {listagem.length === 0 && (
                  <div className="text-center py-10 text-gray-500 text-sm">
                    Nenhuma diretiva encontrada com este filtro.
                  </div>
                )}
              </div>
            )}

            <p className="text-xs text-gray-600 mt-4 text-center">
              Dados sincronizados via EUR-Lex CELLAR SPARQL · Atualização manual via script
            </p>
          </>
        )}
      </main>
    </div>
  );
}