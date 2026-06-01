import PropTypes from 'prop-types';

/**
 * Indicador de carregamento genérico.
 * Usado tanto pelo Suspense da cena 3D como pelo fetch ao Supabase.
 */
export const LoadingScene = ({ mensagem = 'A carregar hemiciclo 3D...' }) => {
  return (
    <div className="absolute inset-0 flex items-center justify-center
                    bg-[#1a1a2e] z-50">
      <div className="text-center">
        <div className="inline-block w-12 h-12 border-4 border-blue-500
                        border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-white text-sm">{mensagem}</p>
      </div>
    </div>
  );
};

LoadingScene.propTypes = {
  mensagem: PropTypes.string,
};
