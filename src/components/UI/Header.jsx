import { FileText, Info, Vote, Building2 } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const NAV = [
  { to: '/',             label: 'Hemiciclo',    icone: Building2 },
  { to: '/votacoes',     label: 'Votações',     icone: Vote      },
  { to: '/diretivas-eu', label: 'Diretivas UE', icone: FileText  },
  { to: '/sobre',        label: 'Sobre',        icone: Info      },
];

export const Header = () => {
  const { pathname } = useLocation();

  return (
    <div className="shrink-0 border-b border-white/10">
      {/* Título */}
      <div className="flex items-center gap-3 px-4 py-4">
        <img
          src="/logo_solo.png"
          alt="Parlamento 3D"
          style={{ width: '56px', height: 'auto' }}
          className="shrink-0"
        />
        <div className="min-w-0">
          <h1 className="text-xs font-semibold text-white leading-tight">
            Assembleia da República
          </h1>
          <span className="text-[11px] text-gray-400">XVII Legislatura</span>
        </div>
      </div>

      {/* Navegação */}
      <nav className="px-2 pb-2 space-y-0.5">
        {NAV.map(({ to, label, icone: Icone }) => {
          const ativo = pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={`
                flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium
                transition-colors duration-150
                ${ativo
                  ? 'bg-blue-600/20 text-blue-300 border border-blue-600/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                }
              `}
            >
              <Icone size={13} className="shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
};