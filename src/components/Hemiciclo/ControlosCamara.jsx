import { useState } from 'react';
import { Info, RotateCcw, Maximize2 } from 'lucide-react';

/**
 * Painel de controlos da câmara 3D.
 *
 * Mostra ajuda contextual e botões de controlo.
 * Os controlos de zoom/rotação são geridos pelo OrbitControls,
 * mas adicionamos botões para utilizadores menos familiarizados.
 */
export const ControlosCamara = () => {
  const [mostrarAjuda, setMostrarAjuda] = useState(false);

  const handleReset = () => {
    // Forçar reload simples — alternativa: usar ref ao OrbitControls
    window.location.reload();
  };

  return (
    <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
      <button
        onClick={handleReset}
        className="bg-white/95 backdrop-blur-sm hover:bg-gray-50 p-2 rounded-lg shadow-lg transition-colors"
        title="Reset da câmara"
        aria-label="Resetar posição da câmara"
      >
        <RotateCcw size={18} className="text-gray-700" />
      </button>

      <button
        onClick={() => setMostrarAjuda(!mostrarAjuda)}
        className={`backdrop-blur-sm p-2 rounded-lg shadow-lg transition-colors ${
          mostrarAjuda ? 'bg-blue-100' : 'bg-white/95 hover:bg-gray-50'
        }`}
        title="Como navegar"
        aria-label="Mostrar ajuda de navegação"
      >
        <Info size={18} className="text-gray-700" />
      </button>

      {mostrarAjuda && (
        <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-3 w-64 text-sm text-gray-700 space-y-2">
          <h4 className="font-semibold flex items-center gap-1">
            <Maximize2 size={14} /> Como navegar
          </h4>
          <ul className="text-xs space-y-1 list-disc list-inside">
            <li><strong>Arrastar com botão esquerdo:</strong> rodar a vista</li>
            <li><strong>Arrastar com botão direito:</strong> mover (pan)</li>
            <li><strong>Roda do rato:</strong> zoom in/out</li>
            <li><strong>Clicar num assento:</strong> ver perfil do deputado</li>
            <li><strong>Clicar num partido na legenda:</strong> focar nesse grupo</li>
          </ul>
        </div>
      )}
    </div>
  );
};
