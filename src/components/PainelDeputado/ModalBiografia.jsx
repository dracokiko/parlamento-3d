import { X, GraduationCap, Briefcase, Users } from 'lucide-react';

function calcularIdade(dataNasc) {
  if (!dataNasc) return null;
  const [y, m, d] = dataNasc.split('-').map(Number);
  const hoje = new Date();
  let idade = hoje.getFullYear() - y;
  if (hoje.getMonth() + 1 < m || (hoje.getMonth() + 1 === m && hoje.getDate() < d)) idade--;
  return idade;
}

const Seccao = ({ icon: Icon, titulo, items, cor }) => {
  if (!items?.length) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} style={{ color: cor }} />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">{titulo}</h3>
      </div>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-gray-700 flex items-start gap-2.5">
            <span className="w-1 h-1 rounded-full flex-shrink-0 mt-2" style={{ backgroundColor: cor }} />
            <span className="leading-snug">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export const ModalBiografia = ({ bio, carregando, nomeDeputado, corPartido, onFechar }) => {
  if (!bio && !carregando) return null;

  const cor    = corPartido ?? '#6b7280';
  const idade  = calcularIdade(bio?.data_nascimento);

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
            <p className="text-white/70 text-xs uppercase tracking-wider">Biografia</p>
            <h2 className="text-white font-bold text-base leading-snug">
              {bio?.nome_completo ?? nomeDeputado ?? '—'}
            </h2>
          </div>
          <button
            onClick={onFechar}
            className="p-1.5 rounded-full hover:bg-white/20 transition-colors flex-shrink-0"
          >
            <X size={18} className="text-white" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {carregando && (
            <p className="text-sm text-gray-400 italic">A carregar...</p>
          )}

          {!carregando && bio && (
            <div className="space-y-6">
              {/* Dados pessoais */}
              {(idade != null || bio.profissao) && (
                <div className="flex gap-6">
                  {idade != null && (
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Idade</p>
                      <p className="text-2xl font-bold" style={{ color: cor }}>{idade}</p>
                      <p className="text-xs text-gray-400">{bio.data_nascimento}</p>
                    </div>
                  )}
                  {bio.profissao && (
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Profissão</p>
                      <p className="text-sm font-medium text-gray-800">{bio.profissao}</p>
                    </div>
                  )}
                </div>
              )}

              <Seccao
                icon={GraduationCap}
                titulo="Habilitações literárias"
                items={bio.habilitacoes}
                cor={cor}
              />
              <Seccao
                icon={Briefcase}
                titulo="Cargos exercidos"
                items={bio.cargos_exercidos}
                cor={cor}
              />
              <Seccao
                icon={Users}
                titulo="Comissões parlamentares"
                items={bio.comissoes}
                cor={cor}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
