import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { useParlamento } from '../../context/ParlamentoContext';
import { getCorPartido } from '../../data/mockPartidos';
import { obterIniciais } from '../../utils/formatters';

/** O cargo como se diz, e não como vem nos dados da AR. */
const TITULO = {
  'Presidente': 'Presidente da Assembleia da República',
  'Vice-Presidente': 'Vice-Presidente da Assembleia',
  'Secretário': 'Secretário da Mesa',
  'Vice-Secretário': 'Vice-Secretário da Mesa',
};

/**
 * Cartão de quem está sob o rato na Mesa.
 *
 * Pequeno e encostado ao canto, ao contrário do cartão dos deputados, que
 * abre ao centro do ecrã e é desenhado para quando se percorre o hemiciclo.
 * A Mesa está ao fundo da sala, no eixo da vista: um cartão ao centro tapava
 * exactamente o que se está a olhar.
 */
export const CartaoMesa = () => {
  const { mesaHover } = useParlamento();
  // Guarda-se o retrato que falhou, e não um sim/não: senão a primeira
  // fotografia em falta escondia as dos lugares seguintes.
  const [fotoEmFalta, setFotoEmFalta] = useState(null);

  if (!mesaHover) return null;

  const { nome, cargo, partido, deputado } = mesaHover;
  const sigla = deputado?.partido ?? partido;
  const cor = getCorPartido(sigla);
  const foto = deputado?.foto;

  return (
    <div className="absolute bottom-5 left-20 z-30 pointer-events-none max-w-[calc(100%-6rem)]">
      <div className="relative flex items-center gap-3 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-gray-200/80 pl-3 pr-4 py-2 overflow-hidden">
        <span className="absolute left-0 top-0 h-full w-1" style={{ background: cor }} />

        {foto && foto !== fotoEmFalta ? (
          <img
            src={foto}
            alt={nome}
            onError={() => setFotoEmFalta(foto)}
            className="w-11 h-11 rounded-xl object-cover flex-shrink-0 ring-1 ring-gray-200"
          />
        ) : (
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
            style={{ background: cor }}
          >
            {obterIniciais(nome)}
          </div>
        )}

        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-gray-900 leading-tight truncate">{nome}</p>
          <p className="text-[11px] text-gray-500 leading-snug truncate">{TITULO[cargo] ?? cargo}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {sigla && (
              <span className="text-[10px] font-semibold rounded-full px-1.5 py-px" style={{ background: `${cor}1a`, color: cor }}>
                {sigla}
              </span>
            )}
            {deputado?.circulo && (
              <span className="flex items-center gap-1 text-[10px] text-gray-400 truncate">
                <MapPin size={9} /> {deputado.circulo}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
