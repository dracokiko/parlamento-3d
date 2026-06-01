import { useState } from 'react';
import { X, Copy, Download, ExternalLink, Check, FileText } from 'lucide-react';
import { useParlamento } from '../../context/ParlamentoContext';
import { partidos } from '../../data/mockPartidos';
import { formatarData } from '../../utils/formatters';

/**
 * Modal com a transcrição oficial integral da intervenção.
 *
 * Funcionalidades:
 * - Texto integral formatado
 * - Botão copiar (com feedback visual)
 * - Botão download (gera ficheiro .txt — em produção seria PDF)
 * - Link para a fonte oficial (parlamento.pt)
 *
 * Usa um overlay com backdrop blur para focar a atenção no texto.
 */
export const ModalTranscricao = () => {
  const { transcricaoAberta, deputadoSelecionado, setTranscricaoAberta } = useParlamento();
  const [copiado, setCopiado] = useState(false);

  if (!transcricaoAberta || !deputadoSelecionado) return null;

  const { reuniao, intervencao } = transcricaoAberta;
  const partido = partidos[deputadoSelecionado.partido];

  const handleFechar = () => setTranscricaoAberta(null);

  // Copiar texto para clipboard com feedback visual
  const handleCopiar = async () => {
    try {
      await navigator.clipboard.writeText(intervencao.transcricaoOficial);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch (err) {
      console.error('Erro ao copiar:', err);
    }
  };

  // Download como ficheiro de texto (em produção: PDF gerado server-side)
  const handleDownload = () => {
    const conteudo = `INTERVENÇÃO PARLAMENTAR — TRANSCRIÇÃO OFICIAL
============================================

Deputado: ${deputadoSelecionado.nome}
Partido: ${partido.nome}
Reunião: ${reuniao.titulo}
Data: ${formatarData(reuniao.data)}
Hora da intervenção: ${intervencao.hora}
Duração: ${intervencao.duracao}
Tipo: ${intervencao.tipo}

--------------------------------------------

${intervencao.transcricaoOficial}

--------------------------------------------
Fonte: Diário da Assembleia da República (DAR)
${intervencao.linkFonteOficial}
`;

    const blob = new Blob([conteudo], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `intervencao_${deputadoSelecionado.nome.replace(/\s+/g, '_')}_${reuniao.id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4
                 bg-black/50 backdrop-blur-sm"
      onClick={handleFechar}
      role="dialog"
      aria-modal="true"
      aria-label="Transcrição oficial da intervenção"
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh]
                   flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <FileText size={16} className="text-blue-600" />
              <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
                Transcrição oficial — DAR
              </span>
            </div>
            <h2 className="text-lg font-bold text-gray-900 leading-snug truncate">
              {reuniao.titulo}
            </h2>
            <p className="text-sm text-gray-600 mt-0.5">
              {deputadoSelecionado.nome} ({partido.id}) ·{' '}
              {formatarData(reuniao.data)} · {intervencao.hora}
            </p>
          </div>

          <button
            onClick={handleFechar}
            className="p-1.5 rounded-full hover:bg-gray-100 transition-colors flex-shrink-0"
            aria-label="Fechar transcrição"
          >
            <X size={20} />
          </button>
        </div>

        {/* Conteúdo da transcrição */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="prose prose-sm max-w-none">
            <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800
                            leading-relaxed bg-transparent p-0 m-0">
              {intervencao.transcricaoOficial}
            </pre>
          </div>
        </div>

        {/* Rodapé com ações */}
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50
                        flex flex-wrap items-center justify-between gap-2">
          <a
            href={intervencao.linkFonteOficial}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-blue-600
                       hover:text-blue-800 hover:underline"
          >
            <ExternalLink size={14} />
            Ver no parlamento.pt
          </a>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopiar}
              className="inline-flex items-center gap-1.5 px-3 py-1.5
                         border border-gray-300 rounded-md text-sm
                         text-gray-700 hover:bg-gray-100 transition-colors"
            >
              {copiado ? (
                <>
                  <Check size={14} className="text-green-600" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy size={14} />
                  Copiar texto
                </>
              )}
            </button>

            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3 py-1.5
                         bg-blue-600 hover:bg-blue-700 text-white text-sm
                         rounded-md transition-colors"
            >
              <Download size={14} />
              Descarregar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
