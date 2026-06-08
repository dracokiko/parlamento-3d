import { Suspense, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ParlamentoProvider, useParlamento } from './context/ParlamentoContext';
import { CenaHemiciclo } from './components/Hemiciclo/CenaHemiciclo';
import { LegendaPartidos } from './components/Hemiciclo/LegendaPartidos';
import { ControlosCamara } from './components/Hemiciclo/ControlosCamara';
import { PainelDeputado } from './components/PainelDeputado/PainelDeputado';
import { DetalheIntervencao } from './components/IntervencaoView/DetalheIntervencao';
import { ModalTranscricao } from './components/IntervencaoView/ModalTranscricao';
import { LoadingScene } from './components/UI/LoadingScene';
import { TooltipDeputado, CoatOfArmsAR } from './components/UI/TooltipDeputado';
import { Header } from './components/UI/Header';
import { PesquisaDeputado } from './components/UI/PesquisaDeputado';
import { DiretivasUE } from './pages/DiretivasUE';
import { Votacoes } from './pages/Votacoes';
import { Sobre } from './pages/Sobre';

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

/** Ecrã de loading que cobre tudo até todos os recursos estarem prontos. */
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
        <div className="inline-block w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6" />
        <p className="text-white text-base font-semibold mb-2">Parlamento 3D</p>
        <p className="text-blue-300 text-sm transition-all duration-500">{MENSAGENS[idx]}</p>
      </div>
    </div>
  );
};

/** Hemiciclo 3D — renderiza sempre em background, fica pronto quando o loading desaparece. */
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

/**
 * Renderiza a área de informação (painel do deputado / intervenção)
 * apenas quando há um deputado selecionado. Quando retorna null,
 * a canvas 3D expande-se para ocupar toda a altura disponível.
 */
const BlocoInfo = () => {
  const { deputadoSelecionado } = useParlamento();
  if (!deputadoSelecionado) return null;
  return (
    <div className="relative h-screen w-full overflow-hidden">
  {/* O Canvas ocupa sempre 100% do espaço, nunca é encolhido */}
  <CenaHemiciclo />

  {/* O painel é injetado por cima, sem mexer no tamanho do Canvas */}
  {deputadoSelecionado && <PainelDeputado />}
</div>
  );
};

/** Página do hemiciclo 3D — layout com sidebar. */
function HemicicloPage() {
  return (
    <ParlamentoProvider>
      <div className="flex w-screen h-screen overflow-hidden" style={{ background: '#f0f4f8' }}>

        {/* ── Painel esquerdo ────────────────────────────────── */}
        <aside className="w-64 h-full flex flex-col shrink-0 bg-[#16213e] border-r border-white/10 z-10">
          <Header />
          <div className="flex-1 overflow-y-auto">
            <LegendaPartidos />
          </div>
          {/* Disclaimer */}
          <div className="px-4 py-2.5 border-t border-white/5 shrink-0">
            <p className="text-[10px] text-gray-600 leading-relaxed">
              Informação não oficial. Os dados podem estar incompletos ou desatualizados.
              Consulte sempre fontes oficiais.
            </p>
          </div>
        </aside>

        {/* ── Painel direito: info + hemiciclo ──────────────── */}
        <div className="flex-1 h-full flex flex-col overflow-hidden" style={{ background: '#f0f4f8' }}>

          {/* Área superior: painel do deputado (só existe quando há seleção) */}
          <BlocoInfo />

          {/* Área inferior: hemiciclo 3D — cresce para ocupar tudo */}
          <div className="relative flex-1 min-h-0">
            <BlocoHemiciclo />
            <ControlosCamara />
            {/* Pesquisa flutuante — canto superior direito */}
            <div className="absolute top-4 right-4 z-20">
              <PesquisaDeputado />
            </div>
          </div>

          {/* Modal transcrição — sobrepõe tudo */}
          <ModalTranscricao />
        </div>

      </div>

      {/* Coat of arms — aparece quando nenhum deputado está em hover */}
      <CoatOfArmsAR />
      {/* Tooltip de hover — substitui o coat of arms quando há hover */}
      <TooltipDeputado />

      {/* Loading — cobre tudo até estar pronto, depois desaparece com fade */}
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
