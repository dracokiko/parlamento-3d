import { Component } from 'react';
import PropTypes from 'prop-types';
import { RefreshCw } from 'lucide-react';

/** Apanha erros de render não tratados para evitar ecrã branco total. */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { erro: null };
  }

  static getDerivedStateFromError(erro) {
    return { erro };
  }

  componentDidCatch(erro, info) {
    console.error('Erro não tratado na aplicação:', erro, info?.componentStack);
  }

  render() {
    if (this.state.erro) {
      return (
        <div className="w-screen h-screen flex flex-col items-center justify-center gap-4 bg-[#0f172a] text-white px-6 text-center">
          <p className="text-lg font-semibold">Ocorreu um erro inesperado</p>
          <p className="text-sm text-gray-400 max-w-md">
            A aplicação encontrou um problema e não conseguiu continuar. Podes tentar recarregar a página.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 transition-colors px-4 py-2 rounded-lg text-sm font-medium"
          >
            <RefreshCw size={16} /> Recarregar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
};
