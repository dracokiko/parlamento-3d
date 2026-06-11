import { Suspense, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { ParlamentoProvider, useParlamento } from './context/ParlamentoContext';
import { CenaHemiciclo } from './components/Hemiciclo/CenaHemiciclo';
import { LegendaPartidos } from './components/Hemiciclo/LegendaPartidos';
import { ControlosCamara } from './components/Hemiciclo/ControlosCamara';
import { PainelDeputado } from './components/PainelDeputado/PainelDeputado';
import { ModalTranscricao } from './components/IntervencaoView/ModalTranscricao';
import { TooltipDeputado, CoatOfArmsAR } from './components/UI/TooltipDeputado';
import { Header } from './components/UI/Header';
import { PesquisaDeputado } from './components/UI/PesquisaDeputado';
import { DiretivasUE } from './pages/DiretivasUE';
import { Votacoes } from './pages/Votacoes';
import { Sobre } from './pages/Sobre';
import { useIsMobile } from './hooks/useIsMobile';

const MENSAGENS = [
  'A verificar se há quórum...',
  'Os deputados estão a procurar as suas cadeiras...',
  'A traduzir legislação em pixels...',
  'A garantir que ninguém está a dormir...',
  'A contar os votos — desta vez são mesmo todos...',
  'A dar lustre às bancadas...',
  'O Presidente pede ordem na sala...',
  'A aguardar que a oposição chegue a acordo...',
  'A organizar os partidos por ordem alfabética... ou não...',
  'A verificar se alguém usou o telemóvel durante o debate...',
  'A passar a acta da última sessão...',
  'Os assessores estão a fazer café — já vamos...',
  'A sincronizar relógios com a hora oficial de Lisboa...',
  'A regar as plantas do corredor do Parlamento...',
  'A subir as bandeiras dos partidos por ordem de votos...',
  'A imprimir os diplomas em papel timbrado...',
  'O microfone do plenário está a ser testado: 1, 2, 3...',
  'A encadernar as propostas de lei da semana...',
  'A ajustar o termostato do hemiciclo — os debates esquentam...',
  'A garantir que a tribuna está bem aparafusada...',
];

const TelaCarregamento = () => {
  const { tudoCarregado } = useParlamento();
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * MENSAGENS.length));

  useEffect(() => {
    const t = setInterval(() => {
      setIdx(prev => {
        let next;
        do { next = Math.floor(Math.random() * MENSAGENS.length); } while (next === prev);
        return next;
      });
    }, 2800);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#1a1a2e] transition-opacity duration-700"
      style={{ opacity: tudoCarregado ? 0 : 1, pointerEvents: tudoCarregado ? 'none' : 'all' }}
    >
      <div className="text-center px-8">
        <img
          src="/logo_com_nome.png"
          alt="Parlamento 3D"
          className="mx-auto mb-4"
          style={{ width: '280px', height: 'auto', opacity: 0.92 }}
        />
        <div className="inline-block w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6" />

        <p className="text-blue-300 text-sm transition-all duration-500">{MENSAGENS[idx]}</p>
      </div>
    </div>
  );
};

const BlocoHemiciclo = () => {
  const { erro } = useParlamento();
  if (erro) return (
    <div className="absolute inset-0 flex items-center justify-center bg-stone-50">
      <p className="text-red-400 text-sm">{erro}</p>
    </div>
  );
  return (
    <Suspense fallback={null}>
      <CenaHemiciclo />
    </Suspense>
  );
};

/** Desktop only: painel lateral + canvas sobreposto quando há deputado selecionado. */
const BlocoInfo = () => {
  const { deputadoSelecionado } = useParlamento();
  const isMobile = useIsMobile();
  if (!deputadoSelecionado || isMobile) return null;
  return (
    <div className="relative h-screen w-full overflow-hidden">
      <CenaHemiciclo />
      <PainelDeputado />
    </div>
  );
};

/** Mobile only: renderiza o PainelDeputado quando há deputado selecionado. */
const MobilePainel = () => {
  const { deputadoSelecionado } = useParlamento();
  const isMobile = useIsMobile();
  if (!isMobile || !deputadoSelecionado) return null;
  return <PainelDeputado />;
};

const NAV_LINKS = [
  { to: '/',             label: 'Hemiciclo'    },
  { to: '/votacoes',     label: 'Votações'     },
  { to: '/diretivas-eu', label: 'Diretivas UE' },
  { to: '/sobre',        label: 'Sobre'        },
];

function HemicicloPage() {
  const [drawerAberto, setDrawerAberto] = useState(false);
  const { pathname } = useLocation();

  return (
    <ParlamentoProvider>

      {/* ── Barra topo mobile ──────────────────────────────────── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center gap-3 px-4 py-3 bg-[#16213e] border-b border-white/10">
        <button
          onClick={() => setDrawerAberto(true)}
          className="text-gray-300 hover:text-white transition-colors p-0.5"
          aria-label="Abrir menu"
        >
          <Menu size={22} />
        </button>
        <img src="/logo_solo.png" alt="" style={{ width: '70px', height: 'auto' }} />
        <span className="text-white text-sm font-semibold flex-1 truncate">Parlamento 3D</span>
      </div>

      {/* ── Drawer mobile ──────────────────────────────────────── */}
      {drawerAberto && (
        <div
          className="md:hidden fixed inset-0 z-50"
          onClick={() => setDrawerAberto(false)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <aside
            className="absolute left-0 top-0 h-full w-72 bg-[#16213e] flex flex-col border-r border-white/10"
            onClick={e => e.stopPropagation()}
          >
            {/* Cabeçalho do drawer */}
            <div className="flex items-center gap-3 px-4 py-4 border-b border-white/10 shrink-0">
              <img src="/logo_solo.png" alt="" style={{ width: '75px', height: 'auto' }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white leading-tight">Assembleia da República</p>
                <span className="text-[11px] text-gray-400">XVII Legislatura</span>
              </div>
              <button
                onClick={() => setDrawerAberto(false)}
                className="text-gray-400 hover:text-white transition-colors p-1"
                aria-label="Fechar menu"
              >
                <X size={18} />
              </button>
            </div>

            {/* Navegação */}
            <nav className="px-2 py-2 border-b border-white/5 shrink-0 space-y-0.5">
              {NAV_LINKS.map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setDrawerAberto(false)}
                  className={`block px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                    pathname === to
                      ? 'bg-blue-600/20 text-blue-300 border border-blue-600/30'
                      : 'text-gray-300 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  {label}
                </Link>
              ))}
            </nav>

            {/* Legenda partidos */}
            <div className="flex-1 overflow-y-auto">
              <LegendaPartidos />
            </div>

            <div className="px-4 py-2.5 border-t border-white/5 shrink-0">
              <p className="text-[10px] text-gray-600 leading-relaxed">
                Informação não oficial. Os dados podem estar incompletos ou desatualizados.
              </p>
            </div>
          </aside>
        </div>
      )}

      {/* ── Layout principal ────────────────────────────────────── */}
      <div
        className="flex w-screen overflow-hidden"
        style={{ background: '#f0f4f8', height: '100dvh' }}
      >
        {/* Sidebar — só desktop */}
        <aside className="hidden md:flex w-64 h-full flex-col shrink-0 bg-[#16213e] border-r border-white/10 z-10">
          <Header />
          <div className="flex-1 overflow-y-auto">
            <LegendaPartidos />
          </div>
          <div className="px-4 py-2.5 border-t border-white/5 shrink-0">
            <p className="text-[10px] text-gray-600 leading-relaxed">
              Informação não oficial. Os dados podem estar incompletos ou desatualizados.
              Consulte sempre fontes oficiais.
            </p>
          </div>
        </aside>

        {/* Área principal */}
        <div
          className="flex-1 h-full flex flex-col overflow-hidden pt-[52px] md:pt-0"
          style={{ background: '#f0f4f8' }}
        >
          {/* Desktop: painel do deputado sobreposto ao canvas */}
          <BlocoInfo />

          {/* Canvas 3D — ocupa todo o espaço restante */}
          <div className="relative flex-1 min-h-0">
            <BlocoHemiciclo />
            <ControlosCamara />
            {/* Pesquisa flutuante */}
            <div className="absolute top-6 md:top-3 right-3 z-20">
              <PesquisaDeputado />
            </div>
          </div>

          <ModalTranscricao />
        </div>
      </div>

      {/* Mobile: painel do deputado como bottom sheet */}
      <MobilePainel />

      {/* Coat of arms — oculto em mobile */}
      <CoatOfArmsAR />
      <TooltipDeputado />
      <TelaCarregamento />
    </ParlamentoProvider>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"             element={<HemicicloPage />} />
        <Route path="/diretivas-eu" element={<DiretivasUE />} />
        <Route path="/votacoes"     element={<Votacoes />} />
        <Route path="/sobre"        element={<Sobre />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;