import { useMemo } from 'react';
import { X, MapPin } from 'lucide-react';
import { useParlamento } from '../../context/ParlamentoContext';
import { partidos } from '../../data/mockPartidos';
import { getIntervencoesPorDeputado } from '../../data/mockIntervencoes';
import { obterIniciais } from '../../utils/formatters';
import { ListaIntervencoes } from './ListaIntervencoes';

export const PainelDeputado = () => {
  const { deputadoSelecionado, fecharPainel } = useParlamento();

  const intervencoes = useMemo(() => {
    if (!deputadoSelecionado) return [];
    return getIntervencoesPorDeputado(deputadoSelecionado.id);
  }, [deputadoSelecionado]);

  if (!deputadoSelecionado) return null;

  const partido = partidos[deputadoSelecionado.partido];

  return (
    <div
      className="absolute inset-0 flex overflow-hidden z-20 bg-white"
      role="dialog"
      aria-label={`Perfil de ${deputadoSelecionado.nome}`}
    >
      {/* Coluna esquerda: identidade do deputado */}
      <div
        className="w-72 flex-shrink-0 flex flex-col justify-between px-6 py-6 text-white relative"
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
          {/* Avatar / Foto */}
          <div className="w-28 mb-4 rounded-xl overflow-hidden border-2 border-white/40"
               style={{ height: '132px' }}>
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

          <h2 className="text-lg font-bold leading-tight">
            {deputadoSelecionado.nome}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            {partido?.logo && (
              <img
                src={partido.logo}
                alt={partido.id}
                className="w-6 h-6 object-contain rounded-sm"
                style={{ background: 'rgba(255,255,255,0.15)' }}
              />
            )}
            <p className="text-white/80 text-sm">{partido?.nome}</p>
          </div>
          {deputadoSelecionado.circulo && (
            <div className="flex items-center gap-1 text-white/60 text-xs mt-2">
              <MapPin size={11} />
              <span>{deputadoSelecionado.circulo}</span>
            </div>
          )}
        </div>

        {/* Lugar na assembleia */}
        {deputadoSelecionado.lugar && (
          <div className="mt-auto pt-4 border-t border-white/20">
            <span className="text-white/50 text-xs uppercase tracking-wider">Lugar</span>
            <p className="text-white font-mono text-2xl font-bold mt-0.5">
              {deputadoSelecionado.lugar}
            </p>
          </div>
        )}
      </div>

      {/* Coluna direita: intervenções */}
      <div className="flex-1 overflow-y-auto bg-white">
        <div className="px-5 pt-4 pb-2 border-b border-gray-100">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Intervenções parlamentares
          </h3>
        </div>
        <div className="px-5 py-3">
          <ListaIntervencoes intervencoes={intervencoes} />
        </div>
      </div>
    </div>
  );
};
