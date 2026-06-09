import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X, ChevronDown, Check } from 'lucide-react';
import { useParlamento } from '../../context/ParlamentoContext';
import { partidos, ordemHemiciclo } from '../../data/mockPartidos';

function DropdownPartido({ valor, onChange }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const fechar = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setAberto(false);
    };
    document.addEventListener('mousedown', fechar);
    return () => document.removeEventListener('mousedown', fechar);
  }, []);

  const partidoAtual = valor ? partidos[valor] : null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setAberto((v) => !v)}
        className="w-full flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg
                   px-2.5 py-1.5 text-xs text-left hover:bg-white/10
                   focus:outline-none focus:border-blue-500/50 transition-colors"
      >
        {partidoAtual ? (
          <>
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: partidoAtual.cor }} />
            <span className="text-white font-medium flex-1 truncate">{valor}</span>
            <span className="text-gray-400 truncate flex-1">{partidoAtual.nome}</span>
          </>
        ) : (
          <span className="text-gray-400 flex-1">Todos os partidos</span>
        )}
        <ChevronDown size={11} className={`shrink-0 text-gray-500 transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </button>

      {aberto && (
        <div className="absolute top-full right-0 mt-1 w-full z-50
                        bg-[#0d1425] border border-white/10 rounded-lg shadow-2xl
                        max-h-52 overflow-y-auto">
          <button
            onClick={() => { onChange(''); setAberto(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs
                       hover:bg-white/10 transition-colors border-b border-white/5"
          >
            <span className="w-2 h-2 rounded-full bg-gray-600 shrink-0" />
            <span className={`flex-1 text-left ${!valor ? 'text-white font-medium' : 'text-gray-400'}`}>
              Todos os partidos
            </span>
            {!valor && <Check size={11} className="text-blue-400 shrink-0" />}
          </button>
          {ordemHemiciclo.map((id) => {
            const p = partidos[id];
            const ativo = valor === id;
            return (
              <button
                key={id}
                onClick={() => { onChange(id); setAberto(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs
                           hover:bg-white/10 transition-colors
                           border-b border-white/5 last:border-0"
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p?.cor }} />
                <span className={`font-medium shrink-0 ${ativo ? 'text-white' : 'text-gray-300'}`}>{id}</span>
                <span className="text-gray-500 truncate flex-1 text-left">{p?.nome}</span>
                <span className="text-gray-600 shrink-0 text-[10px]">{p?.deputados}</span>
                {ativo && <Check size={11} className="text-blue-400 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function PesquisaDeputado() {
  const { deputados, selecionarDeputado } = useParlamento();
  const [expandido, setExpandido] = useState(false);
  const [query, setQuery]         = useState('');
  const [partido, setPartido]     = useState('');
  const inputRef = useRef(null);
  const ref      = useRef(null);

  // Fechar ao clicar fora
  useEffect(() => {
    const fechar = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setExpandido(false);
        setQuery('');
        setPartido('');
      }
    };
    document.addEventListener('mousedown', fechar);
    return () => document.removeEventListener('mousedown', fechar);
  }, []);

  // Focar input quando expande
  useEffect(() => {
    if (expandido) setTimeout(() => inputRef.current?.focus(), 50);
  }, [expandido]);

  const resultados = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q && !partido) return [];
    return (deputados ?? [])
      .filter((d) => {
        const matchNome    = !q       || d.nomeAbrev?.toLowerCase().includes(q);
        const matchPartido = !partido || d.partido === partido;
        return matchNome && matchPartido;
      })
      .slice(0, 8);
  }, [deputados, query, partido]);

  function selecionar(dep) {
    selecionarDeputado(dep);
    setExpandido(false);
    setQuery('');
    setPartido('');
  }

  const temResultados = (query.trim() || partido) && resultados.length > 0;
  const semResultados = (query.trim() || partido) && resultados.length === 0;

  // ── Modo colapsado: só o botão de pesquisa ──────────────────────────────
  if (!expandido) {
    return (
      <button
        onClick={() => setExpandido(true)}
        className="flex items-center gap-2 bg-[#16213e]/90 backdrop-blur-sm
                   border border-white/10 rounded-xl px-3 py-2 text-xs text-gray-300
                   hover:bg-[#16213e] hover:text-white hover:border-white/20
                   transition-all shadow-lg"
        title="Pesquisar deputado"
      >
        <Search size={13} />
        <span>Pesquisar deputado</span>
      </button>
    );
  }

  // ── Modo expandido ──────────────────────────────────────────────────────
  return (
    <div
      ref={ref}
      className="w-64 bg-[#16213e]/95 backdrop-blur-sm border border-white/10
                 rounded-xl shadow-2xl overflow-visible"
    >
      {/* Cabeçalho */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
        <Search size={12} className="text-gray-400 shrink-0" />
        <span className="text-xs text-gray-300 font-medium flex-1">Pesquisar deputado</span>
        <button
          onClick={() => { setExpandido(false); setQuery(''); setPartido(''); }}
          className="text-gray-500 hover:text-white transition-colors"
        >
          <X size={13} />
        </button>
      </div>

      <div className="p-2 space-y-1.5">
        {/* Campo de nome */}
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            placeholder="Nome..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg
                       pl-3 pr-6 py-1.5 text-xs text-white placeholder-gray-500
                       focus:outline-none focus:border-blue-500/50 transition-colors"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
            >
              <X size={10} />
            </button>
          )}
        </div>

        {/* Dropdown partido */}
        <DropdownPartido valor={partido} onChange={setPartido} />
      </div>

      {/* Resultados */}
      {temResultados && (
        <div className="border-t border-white/10 max-h-56 overflow-y-auto">
          {resultados.map((d) => {
            const p = partidos[d.partido];
            return (
              <button
                key={d.id ?? d.nome}
                onClick={() => selecionar(d)}
                className="w-full text-left px-3 py-2 flex items-center gap-2
                           hover:bg-white/10 transition-colors
                           border-b border-white/5 last:border-0"
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p?.cor ?? '#6b7280' }} />
                <span className="text-white text-xs font-medium truncate flex-1">{d.nomeAbrev ?? d.nome}</span>
                <span className="text-gray-500 text-[10px] shrink-0">{d.partido}</span>
              </button>
            );
          })}
        </div>
      )}

      {semResultados && (
        <p className="text-xs text-gray-500 px-3 pb-2.5">Nenhum deputado encontrado.</p>
      )}
    </div>
  );
}
