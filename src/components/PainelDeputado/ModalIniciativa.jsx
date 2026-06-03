import { X, Sparkles, Users, Calendar, GitBranch } from 'lucide-react';

const Pill = ({ children, cor = 'blue' }) => {
  const cores = {
    blue:  'bg-blue-50 text-blue-700',
    green: 'bg-green-50 text-green-700',
    gray:  'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`inline-block text-xs font-medium rounded px-2 py-0.5 ${cores[cor]}`}>
      {children}
    </span>
  );
};

export const ModalIniciativa = ({ iniciativa, onFechar }) => {
  if (!iniciativa) return null;

  const autoresDep = iniciativa.autores_dep ?? [];
  const autoresGP  = iniciativa.autores_gp  ?? [];
  const eventos    = iniciativa.eventos      ?? [];

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
              <Pill>{iniciativa.desc_tipo ?? iniciativa.tipo ?? '—'}</Pill>
              {iniciativa.numero && <Pill cor="gray">Nº {iniciativa.numero}</Pill>}
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
            </div>
          )}

          {/* Datas */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-gray-400" />
              <div>
                <p className="text-xs text-gray-400">Entrada</p>
                <p className="text-sm font-medium text-gray-800">{iniciativa.data_inicio ?? '—'}</p>
              </div>
            </div>
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
                    <span className="text-sm text-gray-700 flex-1">{ev.Fase ?? ev.fase ?? '—'}</span>
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
