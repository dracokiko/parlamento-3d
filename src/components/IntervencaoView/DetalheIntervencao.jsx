import { X, Calendar, Clock, MapPin, FileText, Sparkles, ArrowLeft } from 'lucide-react';
import { useParlamento } from '../../context/ParlamentoContext';
import { partidos } from '../../data/mockPartidos';
import { formatarData, obterEstiloPosicao } from '../../utils/formatters';
import { ResumoIA } from './ResumoIA';

/**
 * Vista detalhada de uma intervenção parlamentar (Nível 3).
 *
 * Mostra:
 * - Cabeçalho da reunião (data, título, tema, duração)
 * - Resumo gerado por IA (card destacado)
 * - Metadados da intervenção (hora, duração, tipo)
 * - Botão para ver transcrição oficial completa
 *
 * Sobrepõe-se ao painel do deputado quando aberta.
 */
export const DetalheIntervencao = () => {
  const {
    intervencaoAberta,
    deputadoSelecionado,
    fecharIntervencao,
    abrirTranscricao
  } = useParlamento();

  if (!intervencaoAberta || !deputadoSelecionado) return null;

  const partido = partidos[deputadoSelecionado.partido];
  const { reuniao, intervencao } = intervencaoAberta;

  return (
    <div
      className="absolute inset-0 bg-white overflow-y-auto z-30"
      role="dialog"
      aria-label={`Detalhe da intervenção em ${reuniao.titulo}`}
    >
      {/* Cabeçalho */}
      <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={fecharIntervencao}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900
                       transition-colors"
            aria-label="Voltar ao perfil do deputado"
          >
            <ArrowLeft size={16} />
            <span>Voltar ao perfil</span>
          </button>

          <button
            onClick={fecharIntervencao}
            className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Identificação do deputado em modo compacto */}
        <div className="flex items-center gap-2 text-sm">
          <span
            className="inline-block w-3 h-3 rounded-full"
            style={{ backgroundColor: partido.cor }}
            aria-hidden="true"
          />
          <span className="font-medium text-gray-900">{deputadoSelecionado.nome}</span>
          <span className="text-gray-500">·</span>
          <span className="text-gray-600">{partido.id}</span>
        </div>
      </div>

      {/* Cabeçalho da reunião */}
      <div className="px-6 py-5 bg-gradient-to-br from-blue-50 to-indigo-50 border-b border-gray-200">
        <div className="flex items-center gap-2 mb-2">
          <span className="px-2 py-0.5 bg-blue-600 text-white text-xs font-medium
                          rounded-full">
            {reuniao.tema}
          </span>
          {reuniao.importante && (
            <span className="px-2 py-0.5 bg-amber-500 text-white text-xs font-medium
                            rounded-full">
              Debate importante
            </span>
          )}
        </div>

        <h2 className="text-lg font-bold text-gray-900 leading-snug mb-3">
          {reuniao.titulo}
        </h2>

        <div className="flex flex-wrap gap-4 text-xs text-gray-600">
          <div className="flex items-center gap-1.5">
            <Calendar size={13} />
            <span>{formatarData(reuniao.data)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock size={13} />
            <span>Duração total: {reuniao.duracaoTotal}</span>
          </div>
        </div>
      </div>

      {/* Metadados da intervenção */}
      <div className="px-6 py-4 grid grid-cols-3 gap-3 border-b border-gray-100">
        <div>
          <div className="text-xs text-gray-500 mb-0.5">Hora</div>
          <div className="text-sm font-medium text-gray-900">{intervencao.hora}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-0.5">Duração</div>
          <div className="text-sm font-medium text-gray-900">{intervencao.duracao}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-0.5">Tipo</div>
          <div className="text-sm font-medium text-gray-900">{intervencao.tipo}</div>
        </div>
      </div>

      {/* Resumo gerado por IA */}
      <div className="px-6 py-5">
        <ResumoIA resumo={intervencao.resumoIA} />
      </div>

      {/* CTA principal: ver transcrição */}
      <div className="px-6 pb-6">
        <button
          onClick={() => abrirTranscricao(intervencaoAberta)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3
                     bg-blue-600 hover:bg-blue-700 text-white font-medium
                     rounded-lg transition-colors shadow-sm"
        >
          <FileText size={18} />
          <span>Ver transcrição oficial completa</span>
        </button>
        <p className="text-xs text-gray-500 mt-2 text-center">
          Diário da Assembleia da República (DAR) — Reunião nº {reuniao.id}
        </p>
      </div>
    </div>
  );
};
