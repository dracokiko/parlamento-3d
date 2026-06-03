import { useState } from 'react';
import { X, MapPin, FileText, MessageSquare } from 'lucide-react';
import { useParlamento } from '../../context/ParlamentoContext';
import { partidos } from '../../data/mockPartidos';
import { obterIniciais } from '../../utils/formatters';
import { useArDeputado } from '../../hooks/useArDeputado';
import { ModalIniciativa } from './ModalIniciativa';
import { ModalDebate } from './ModalDebate';

// ── Aba activa ────────────────────────────────────────────────
const ABAS = [
  { id: 'iniciativas', label: 'Iniciativas',  icon: FileText      },
  { id: 'debates',     label: 'Debates',      icon: MessageSquare },
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
          <div className="flex items-center gap-3 mt-1">
            {deb.data_debate && <span className="text-xs text-gray-400">{deb.data_debate}</span>}
            {deb.transcricao
              ? <span className="text-xs text-green-600">✓ Transcrição disponível</span>
              : deb.url_diario
                ? <span className="text-xs text-gray-400">Transcrição pendente</span>
                : null
            }
          </div>
        </button>
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
  const { perfil, iniciativas, debates, carregando } = useArDeputado(deputadoSelecionado);

  if (!deputadoSelecionado) return null;

  const partido = partidos[deputadoSelecionado.partido];

  const contagens = {
    resumo:      perfil?.resumo_ia ? 1 : 0,
    iniciativas: iniciativas.length,
    debates:     debates.length,
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
              <span>Debates</span>
              <span className="font-bold text-white">{debates.length}</span>
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
          {abaAtiva === 'iniciativas' && <SecaoIniciativas  iniciativas={iniciativas}  carregando={carregando} onClickIniciativa={setIniciativaSelecionada} />}
          {abaAtiva === 'debates'     && <SecaoDebates      debates={debates}           carregando={carregando} onClickDebate={setDebateSelecionado} />}
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
