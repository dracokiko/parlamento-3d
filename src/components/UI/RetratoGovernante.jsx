import { useState } from 'react';
import PropTypes from 'prop-types';
import { obterIniciais } from '../../utils/formatters';

/** Verde-salva da bancada do Governo, para o cartão pertencer à mesma família. */
export const VERDE_GOVERNO = '#6f9c85';

/**
 * Retrato de um membro do Governo, com as iniciais como alternativa.
 *
 * As fotografias vêm do Wikimedia Commons e nem todos os membros têm uma —
 * os secretários de Estado não têm retrato no artigo. E uma imagem externa
 * pode sempre falhar: sem este tratamento, ficava o ícone de imagem partida
 * em vez de uma cara.
 */
export const RetratoGovernante = ({ nome, foto, tamanho = 64, anel = true }) => {
  const [falhou, setFalhou] = useState(false);
  const estilo = { width: tamanho, height: tamanho };

  if (!foto || falhou) {
    return (
      <div
        style={{ ...estilo, background: VERDE_GOVERNO, fontSize: tamanho * 0.32 }}
        className={`rounded-2xl flex items-center justify-center text-white font-semibold flex-shrink-0 ${anel ? 'ring-2 ring-white shadow-md' : ''}`}
      >
        {obterIniciais(nome)}
      </div>
    );
  }

  return (
    <img
      src={foto}
      alt={nome}
      loading="lazy"
      onError={() => setFalhou(true)}
      style={estilo}
      className={`rounded-2xl object-cover flex-shrink-0 bg-gray-100 ${anel ? 'ring-2 ring-white shadow-md' : ''}`}
    />
  );
};

RetratoGovernante.propTypes = {
  nome: PropTypes.string.isRequired,
  foto: PropTypes.string,
  tamanho: PropTypes.number,
  anel: PropTypes.bool,
};
