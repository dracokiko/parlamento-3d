import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Users, Search, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { partidos as PARTIDOS } from '../data/mockPartidos';
import { useIsMobile } from '../hooks/useIsMobile';
import { usePresencasDeputado } from '../hooks/usePresencasDeputado';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { ModalPresencas } from '../components/PainelDeputado/ModalPresencas';

const corTaxa = taxa => {
  if (taxa == null) return '#9ca3af';
  if (taxa >= 95) return '#16a34a';
  if (taxa >= 85) return '#22c55e';
  if (taxa >= 75) return '#f59e0b';
  return '#ef4444';
};

const RankBadge = ({ n }) => {
  const base = 'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0';
  if (n === 1) return <div className={`${base} bg-yellow-400 text-white`}>1</div>;
  if (n === 2) return <div className={`${base} bg-gray-300 text-gray-700`}>2</div>;
  if (n === 3) return <div className={`${base} bg-amber-600 text-white`}>3</div>;
  return <div className={`${base} text-gray-400`}>{n}</div>;
};

const StatCard = ({ label, valor, sub, cor }) => (
  <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
    <p className="text-[11px] text-gray-400 mb-0.5 leading-tight">{label}</p>
    <p className="text-lg font-bold truncate leading-tight" style={{ color: cor ?? '#111827' }}>
      {valor ?? '—'}
    </p>
    {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
  </div>
);

const BarraPresenca = ({ taxa }) => {
  const cor = corTaxa(taxa);
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 bg-gray-100 rounded-full h-1.5 min-w-0">
        <div
          className="h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${taxa ?? 0}%`, backgroundColor: cor }}
        />
      </div>
      <span className="text-sm font-bold w-12 text-right flex-shrink-0" style={{ color: cor }}>
        {taxa != null ? `${Number(taxa).toFixed(1)}%` : '—'}
      </span>
    </div>
  );
};

const CartaoDeputado = ({ deputado, rank, corPartido, onClick, isMobile }) => {
  const cor = corPartido ?? '#6b7280';

  return (
    <div
      className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-[0.99] overflow-hidden flex"
      style={{ borderLeft: `4px solid ${cor}` }}
      onClick={onClick}
    >
      <div className="flex items-center gap-3 px-4 py-3 flex-1 min-w-0">
        {/* Rank */}
        {rank != null && <RankBadge n={rank} />}

        {/* Foto */}
        <div
          className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 border-2"
          style={{ borderColor: cor }}
        >
          {deputado.foto ? (
            <img
              src={deputado.foto}
              alt={deputado.nome_abrev}
              className="w-full h-full object-cover object-top"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center text-white text-sm font-bold"
              style={{ background: cor }}
            >
              {(deputado.nome_abrev ?? '?').charAt(0)}
            </div>
          )}
        </div>

        {/* Nome + partido */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate leading-tight">
            {deputado.nome_abrev ?? '—'}
          </p>
          {deputado.partido && (
            <span
              className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-1"
              style={{ backgroundColor: cor, color: '#fff' }}
            >
              {deputado.partido}
            </span>
          )}
        </div>

        {/* Barra + breakdown */}
        <div className={isMobile ? 'w-28 flex-shrink-0' : 'w-52 flex-shrink-0'}>
          <BarraPresenca taxa={deputado.taxa_presenca} />
          {!isMobile && (
            <div className="flex gap-3 mt-1.5 text-[10px] text-gray-400">
              <span>
                <span className="text-green-600 font-semibold">{deputado.presencas ?? '—'}</span> P
              </span>
              <span>
                <span className="text-yellow-600 font-semibold">{deputado.faltas_just ?? '—'}</span> FJ
              </span>
              <span>
                <span className="text-blue-600 font-semibold">{deputado.ausencias_mp ?? '—'}</span> AMP
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export function Presencas() {
  useDocumentTitle('Presenças');
  const isMobile = useIsMobile();

  const [dados, setDados] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [pesquisa, setPesquisa] = useState('');
  const [partidoFiltro, setPartidoFiltro] = useState(null);
  const [ordem, setOrdem] = useState('taxa_desc');
  const [deputadoSelecionado, setDeputadoSelecionado] = useState(null);

  const { presencas: presencasDetalhe, carregando: carregandoDetalhe } =
    usePresencasDeputado(deputadoSelecionado?.bid ?? null);

  useEffect(() => {
    async function carregar() {
      setCarregando(true);
      setErro(null);
      const [{ data: presencas, error: erroPres }, { data: deps, error: erroDeps }] = await Promise.all([
        supabase
          .from('ar_presencas')
          .select('bid, nome_abrev, total_sessoes, presencas, faltas_just, ausencias_mp, outras, taxa_presenca'),
        supabase
          .from('deputados')
          .select('id, nome, partido_sigla, foto'),
      ]);

      if (erroPres || erroDeps) {
        console.error('[Presencas] erro ao carregar dados:', erroPres?.message, erroDeps?.message);
        setErro((erroPres ?? erroDeps).message);
        setDados([]);
        setCarregando(false);
        return;
      }

      // Normaliza removendo acentos e espaços extra
      const norm = s =>
        Array.from((s ?? '').toLowerCase().trim().normalize('NFD'))
          .filter(c => { const n = c.charCodeAt(0); return n < 0x0300 || n > 0x036F; })
          .join('').replace(/\s+/g, ' ');

      // Fallback: primeiro + último token (lida com abreviaturas de nomes do meio)
      const primUlt = s => {
        const t = norm(s).split(' ').filter(Boolean);
        return t.length > 1 ? `${t[0]} ${t[t.length - 1]}` : t[0] ?? '';
      };

      // Dois índices sobre ar_presencas
      const presNome   = new Map((presencas ?? []).map(p => [norm(p.nome_abrev), p]));
      const presInicio = new Map();
      for (const p of (presencas ?? [])) {
        const k = primUlt(p.nome_abrev);
        if (!presInicio.has(k)) presInicio.set(k, p);
      }

      // Partir sempre dos 230 deputados (fonte da verdade) — ex-deputados ficam de fora
      const merged = (deps ?? []).map(dep => {
        const pres = presNome.get(norm(dep.nome)) ?? presInicio.get(primUlt(dep.nome));
        return {
          bid:          dep.id,
          nome_abrev:   dep.nome,
          partido:      dep.partido_sigla,
          foto:         dep.foto ?? null,
          total_sessoes: pres?.total_sessoes ?? null,
          presencas:    pres?.presencas    ?? null,
          faltas_just:  pres?.faltas_just  ?? null,
          ausencias_mp: pres?.ausencias_mp ?? null,
          outras:       pres?.outras       ?? null,
          taxa_presenca: pres?.taxa_presenca ?? null,
        };
      }).filter(d => d.taxa_presenca != null);
      setDados(merged);
      setCarregando(false);
    }
    carregar();
  }, []);

  const partidosComDados = useMemo(() => {
    const found = new Set(dados.filter(d => d.partido).map(d => d.partido));
    return Object.keys(PARTIDOS).filter(p => found.has(p));
  }, [dados]);

  const lista = useMemo(() => {
    let r = [...dados];

    if (pesquisa.trim()) {
      const q = pesquisa.trim().toLowerCase();
      r = r.filter(d => d.nome_abrev?.toLowerCase().includes(q));
    }

    if (partidoFiltro) {
      r = r.filter(d => d.partido === partidoFiltro);
    }

    switch (ordem) {
      case 'taxa_asc':
        r.sort((a, b) => (a.taxa_presenca ?? -1) - (b.taxa_presenca ?? -1));
        break;
      case 'nome_asc':
        r.sort((a, b) => (a.nome_abrev ?? '').localeCompare(b.nome_abrev ?? '', 'pt'));
        break;
      default:
        r.sort((a, b) => (b.taxa_presenca ?? -1) - (a.taxa_presenca ?? -1));
    }

    return r;
  }, [dados, pesquisa, partidoFiltro, ordem]);

  const stats = useMemo(() => {
    const validas = dados.filter(d => d.taxa_presenca != null);
    if (!validas.length) return null;
    const media = validas.reduce((s, d) => s + Number(d.taxa_presenca), 0) / validas.length;
    return { total: validas.length, media: media.toFixed(1) };
  }, [dados]);

  const corDeputado = p => PARTIDOS[p]?.cor ?? '#6b7280';

  const mostrarRank = ordem !== 'nome_asc' && !pesquisa && !partidoFiltro;

  const ORDENS = [
    { id: 'taxa_desc', label: 'Mais assíduos' },
    { id: 'taxa_asc',  label: 'Menos assíduos' },
    { id: 'nome_asc',  label: 'Nome A–Z' },
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
            <Users size={16} className="text-blue-400" />
            <div>
              <h1 className="text-sm font-bold text-white">Presenças</h1>
              <p className="text-[11px] text-gray-400">XVII Legislatura · Assembleia da República</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Deputados com dados" valor={stats.total} />
            <StatCard label="Presença média" valor={`${stats.media}%`} />
          </div>
        )}

        {/* Filtros */}
        <div className="space-y-3">

          {/* Pesquisa */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={pesquisa}
              onChange={e => setPesquisa(e.target.value)}
              placeholder="Pesquisar deputado..."
              className="w-full pl-8 pr-8 py-2 text-sm border border-gray-200 rounded-full bg-white focus:outline-none focus:border-blue-400 transition-colors"
            />
            {pesquisa && (
              <button
                onClick={() => setPesquisa('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Ordenação */}
          <div className="flex gap-2 flex-wrap">
            {ORDENS.map(o => (
              <button
                key={o.id}
                onClick={() => setOrdem(o.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  ordem === o.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300 hover:text-blue-600'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>

          {/* Filtro por partido */}
          {partidosComDados.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setPartidoFiltro(null)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  !partidoFiltro
                    ? 'bg-gray-800 text-white'
                    : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-400'
                }`}
              >
                Todos
              </button>
              {partidosComDados.map(p => {
                const ativo = partidoFiltro === p;
                const cor = PARTIDOS[p].cor;
                return (
                  <button
                    key={p}
                    onClick={() => setPartidoFiltro(ativo ? null : p)}
                    className="px-3 py-1 rounded-full text-xs font-bold transition-colors"
                    style={ativo
                      ? { backgroundColor: cor, color: '#fff', border: `1px solid ${cor}` }
                      : { backgroundColor: '#fff', color: cor, border: `1px solid ${cor}44` }
                    }
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Contagem */}
        {!carregando && (
          <p className="text-xs text-gray-400">
            {lista.length} deputado{lista.length !== 1 ? 's' : ''}
            {(pesquisa || partidoFiltro) && ' encontrado' + (lista.length !== 1 ? 's' : '')}
          </p>
        )}

        {/* Lista */}
        {carregando ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : erro ? (
          <div className="text-center py-16">
            <p className="text-red-500 text-sm">Erro ao carregar dados de presenças. Tenta novamente mais tarde.</p>
          </div>
        ) : lista.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 text-sm">Nenhum deputado encontrado.</p>
            {dados.length === 0 && (
              <p className="text-gray-400 text-xs mt-2">
                Corre <code className="bg-gray-100 px-1 rounded">npm run sync:presencas</code> para importar os dados.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {lista.map((d, i) => (
              <CartaoDeputado
                key={d.bid}
                deputado={d}
                rank={mostrarRank ? i + 1 : null}
                corPartido={corDeputado(d.partido)}
                onClick={() => setDeputadoSelecionado(d)}
                isMobile={isMobile}
              />
            ))}
          </div>
        )}

      </div>

      {/* Modal detalhe */}
      {deputadoSelecionado && (
        <ModalPresencas
          presencas={presencasDetalhe}
          carregando={carregandoDetalhe}
          nomeDeputado={deputadoSelecionado.nome_abrev}
          corPartido={corDeputado(deputadoSelecionado.partido)}
          onFechar={() => setDeputadoSelecionado(null)}
        />
      )}
    </div>
  );
}
