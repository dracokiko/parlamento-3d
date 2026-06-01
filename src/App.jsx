import { Suspense } from 'react';
import { ParlamentoProvider, useParlamento } from './context/ParlamentoContext';
import { CenaHemiciclo } from './components/Hemiciclo/CenaHemiciclo';
import { LegendaPartidos } from './components/Hemiciclo/LegendaPartidos';
import { ControlosCamara } from './components/Hemiciclo/ControlosCamara';
import { PainelDeputado } from './components/PainelDeputado/PainelDeputado';
import { DetalheIntervencao } from './components/IntervencaoView/DetalheIntervencao';
import { ModalTranscricao } from './components/IntervencaoView/ModalTranscricao';
import { Header } from './components/UI/Header';
import { LoadingScene } from './components/UI/LoadingScene';
import { TooltipDeputado } from './components/UI/TooltipDeputado';

/** Mostra erro/loading antes de renderizar a cena 3D. */
const BlocoHemiciclo = () => {
  const { carregando, erro } = useParlamento();
  if (carregando) return <LoadingScene mensagem="A carregar deputados..." />;
  if (erro) return (
    <div className="absolute inset-0 flex items-center justify-center bg-stone-50">
      <p className="text-red-400 text-sm">{erro}</p>
    </div>
  );
  return (
    <Suspense fallback={<LoadingScene />}>
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

function App() {
  return (
    <ParlamentoProvider>
      <div className="flex w-screen h-screen overflow-hidden bg-stone-50">

        {/* ── Painel esquerdo ────────────────────────────────── */}
        <aside className="w-64 h-full flex flex-col shrink-0 bg-[#16213e] border-r border-white/10 z-10">
          <Header />
          <div className="flex-1 overflow-y-auto">
            <LegendaPartidos />
          </div>
        </aside>

        {/* ── Painel direito: info + hemiciclo ──────────────── */}
        <div className="flex-1 h-full flex flex-col overflow-hidden">

          {/* Área superior: painel do deputado (só existe quando há seleção) */}
          <BlocoInfo />

          {/* Área inferior: hemiciclo 3D — cresce para ocupar tudo */}
          <div className="relative flex-1 min-h-0">
            <BlocoHemiciclo />
            <ControlosCamara />
          </div>

          {/* Modal transcrição — sobrepõe tudo */}
          <ModalTranscricao />
        </div>

      </div>

      {/* Tooltip de hover — fixo no canto inferior direito */}
      <TooltipDeputado />
    </ParlamentoProvider>
  );
}

export default App;
