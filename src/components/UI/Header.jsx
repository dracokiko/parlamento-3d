import { Building2 } from 'lucide-react';

/**
 * Cabeçalho da aplicação.
 *
 * Posicionado em overlay sobre a cena 3D no topo central.
 * Estilo minimalista para não competir com o conteúdo principal.
 */
export const Header = () => {
  return (
    <header className="flex items-center gap-3 px-4 py-5 border-b border-white/10 shrink-0">
      <Building2 size={20} className="text-blue-400 shrink-0" />
      <div className="min-w-0">
        <h1 className="text-sm font-semibold text-white leading-tight">
          Assembleia da República
        </h1>
        <span className="text-xs text-gray-400">XVII Legislatura</span>
      </div>
    </header>
  );
};
