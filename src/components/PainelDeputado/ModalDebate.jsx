import { X, Sparkles, Users, Calendar, ExternalLink } from 'lucide-react';

export const ModalDebate = ({ debate, onFechar }) => {
  if (!debate) return null;

  const autoresDep = typeof debate.autores_dep === 'string'
    ? debate.autores_dep
    : null;

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
            {debate.tipo_debate && (
              <span className="inline-block text-xs font-medium text-purple-600 bg-purple-50 rounded px-2 py-0.5 mb-2">
                {debate.tipo_debate}
              </span>
            )}
            <h2 className="text-base font-bold text-gray-900 leading-snug">
              {debate.assunto ?? '—'}
            </h2>
            {debate.artigo && (
              <p className="text-sm text-gray-500 mt-1 italic">{debate.artigo}</p>
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

          {/* Meta info */}
          <div className="flex items-center gap-6 flex-wrap">
            {debate.data_debate && (
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-gray-400" />
                <div>
                  <p className="text-xs text-gray-400">Data</p>
                  <p className="text-sm font-medium text-gray-800">{debate.data_debate}</p>
                </div>
              </div>
            )}
            {debate.sessao && (
              <div>
                <p className="text-xs text-gray-400">Sessão</p>
                <p className="text-sm font-medium text-gray-800">{debate.sessao}</p>
              </div>
            )}
            {debate.legislatura && (
              <div>
                <p className="text-xs text-gray-400">Legislatura</p>
                <p className="text-sm font-medium text-gray-800">{debate.legislatura}</p>
              </div>
            )}
          </div>

          {/* Autores */}
          {autoresDep && (
            <div className="flex items-start gap-2">
              <Users size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-gray-700">{autoresDep}</p>
            </div>
          )}

          {/* Resumo IA */}
          {debate.resumo_ia && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles size={13} className="text-amber-500" />
                <span className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Resumo</span>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{debate.resumo_ia}</p>
              <p className="text-xs text-gray-400 mt-2">Gerado automaticamente · pode conter imprecisões</p>
            </div>
          )}

          {/* Link para a AR */}
          {debate.url_diario && (
            <a
              href={debate.url_diario}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors"
            >
              <ExternalLink size={14} />
              Ver debate no site da Assembleia da República
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
