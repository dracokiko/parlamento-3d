import { X } from 'lucide-react';

const STATUS_COR = {
  P:   { bg: 'bg-green-100',  text: 'text-green-700',  label: 'P'   },
  FJ:  { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'FJ'  },
  AMP: { bg: 'bg-blue-100',   text: 'text-blue-700',   label: 'AMP' },
};

function corStatus(presenca) {
  if (!presenca) return STATUS_COR.P;
  if (presenca.startsWith('Presença'))           return STATUS_COR.P;
  if (presenca.startsWith('Falta Just'))         return STATUS_COR.FJ;
  if (presenca.startsWith('Ausência em Missão')) return STATUS_COR.AMP;
  return { bg: 'bg-gray-100', text: 'text-gray-600', label: '?' };
}

function abrevStatus(presenca) {
  return corStatus(presenca).label;
}

export const ModalPresencas = ({ presencas, carregando, nomeDeputado, corPartido, onFechar }) => {
  if (!presencas && !carregando) return null;

  const cor = corPartido ?? '#6b7280';

  const Stat = ({ valor, label, cor: c }) => (
    <div className="text-center">
      <p className="text-2xl font-bold" style={{ color: c ?? cor }}>{valor}</p>
      <p className="text-xs text-gray-400 mt-0.5 leading-tight">{label}</p>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onFechar}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ backgroundColor: cor }}
        >
          <div>
            <p className="text-white/70 text-xs uppercase tracking-wider">Presenças Plenárias</p>
            <h2 className="text-white font-bold text-base">{nomeDeputado}</h2>
          </div>
          <button
            onClick={onFechar}
            className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
          >
            <X size={18} className="text-white" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {carregando && (
            <p className="text-sm text-gray-400 italic">A carregar presenças...</p>
          )}

          {!carregando && !presencas && (
            <p className="text-sm text-gray-400 italic">
              Sem dados de presenças. Corre <code className="text-xs bg-gray-100 px-1 rounded">npm run sync:presencas</code>.
            </p>
          )}

          {!carregando && presencas && (
            <div className="space-y-6">
              {/* Resumo */}
              <div className="grid grid-cols-4 gap-3 py-4 border-b border-gray-100">
                <Stat
                  valor={`${presencas.taxa_presenca}%`}
                  label="Taxa de presença"
                  c={cor}
                />
                <Stat valor={presencas.presencas}   label="Presenças"          c="#16a34a" />
                <Stat valor={presencas.faltas_just} label="Faltas just."        c="#ca8a04" />
                <Stat valor={presencas.ausencias_mp} label="Missão parl."      c="#2563eb" />
              </div>

              <p className="text-xs text-gray-400 -mt-3">
                {presencas.total_sessoes} reuniões plenárias
                {presencas.outras > 0 && ` · ${presencas.outras} outras ausências`}
              </p>

              {/* Lista de sessões */}
              {presencas.sessoes?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                    Detalhe por sessão
                  </p>
                  <div className="space-y-1">
                    {presencas.sessoes.map((s, i) => {
                      const { bg, text } = corStatus(s.presenca);
                      return (
                        <div
                          key={i}
                          className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0"
                        >
                          <span className="text-xs text-gray-400 w-24 flex-shrink-0">{s.data}</span>
                          <span className="text-xs text-gray-500 flex-shrink-0 w-6 text-right">{s.numero}</span>
                          <span className="text-xs text-gray-400 flex-1 truncate">{s.tipo}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${bg} ${text} flex-shrink-0`}>
                            {abrevStatus(s.presenca)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
