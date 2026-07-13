import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';

function formatarData(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function diasAtraso(prazo) {
  if (!prazo) return 0;
  return Math.floor((Date.now() - new Date(prazo).getTime()) / 86_400_000);
}

export function DiretivaDetalhe() {
  const { celex } = useParams();
  const navigate = useNavigate();
  const [diretiva, setDiretiva]   = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro]             = useState(null);

  useEffect(() => {
    let vivo = true;
    async function carregar() {
      setCarregando(true);
      setErro(null);
      const { data, error } = await supabase
        .from('diretivas_ue')
        .select('*')
        .eq('id', celex)
        .single();
      if (!vivo) return;
      if (error) {
        console.error('[DiretivaDetalhe] erro ao carregar diretiva:', error.message);
        setErro(error.message);
      } else {
        setDiretiva(data ?? null);
      }
      setCarregando(false);
    }
    carregar();
    return () => { vivo = false; };
  }, [celex]);

  if (carregando) {
    return (
      <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (erro) {
    return (
      <div className="min-h-screen bg-[#1a1a2e] flex flex-col items-center justify-center gap-4">
        <p className="text-red-400">Erro ao carregar a diretiva. Tenta novamente mais tarde.</p>
        <button onClick={() => navigate(-1)} className="text-blue-400 text-sm">Voltar</button>
      </div>
    );
  }

  if (!diretiva) {
    return (
      <div className="min-h-screen bg-[#1a1a2e] flex flex-col items-center justify-center gap-4">
        <p className="text-gray-400">Diretiva não encontrada.</p>
        <button onClick={() => navigate(-1)} className="text-blue-400 text-sm">Voltar</button>
      </div>
    );
  }

  const atraso = diretiva.em_atraso ? diasAtraso(diretiva.prazo_transposicao) : 0;

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-gray-100">
      <div className="bg-[#16213e] border-b border-white/10 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-400 hover:text-white transition-colors p-1 -ml-1"
        >
          <ArrowLeft size={20} />
        </button>
        <span className="text-white text-sm font-semibold flex-1 truncate">Diretiva UE</span>
        <span className="font-mono text-xs text-gray-400">{diretiva.id}</span>
      </div>

      <div className="px-4 py-5 space-y-4 max-w-lg mx-auto">
        <div>
          {diretiva.transposto_pt ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-emerald-900/40 text-emerald-300 border border-emerald-700/40">
              <CheckCircle2 size={14} /> Transposta por Portugal
            </span>
          ) : diretiva.em_atraso ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-red-900/40 text-red-300 border border-red-700/40">
              <AlertTriangle size={14} /> Em atraso ({atraso} dias)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-amber-900/40 text-amber-300 border border-amber-700/40">
              <Clock size={14} /> Por transpor
            </span>
          )}
        </div>

        <h1 className="text-base font-bold text-white leading-snug">
          {diretiva.titulo ?? '—'}
        </h1>

        <div className="bg-white/5 rounded-2xl border border-white/10 divide-y divide-white/5">
          <div className="px-4 py-3 flex justify-between items-center gap-3">
            <span className="text-xs text-gray-400 uppercase tracking-wide">CELEX</span>
            <span className="font-mono text-sm text-gray-200">{diretiva.id}</span>
          </div>
          {diretiva.prazo_transposicao && (
            <div className="px-4 py-3 flex justify-between items-center gap-3">
              <span className="text-xs text-gray-400 uppercase tracking-wide">Prazo</span>
              <span className={`text-sm font-medium ${diretiva.em_atraso ? 'text-red-400' : 'text-gray-200'}`}>
                {formatarData(diretiva.prazo_transposicao)}
              </span>
            </div>
          )}
          {diretiva.em_atraso && atraso > 0 && (
            <div className="px-4 py-3 flex justify-between items-center gap-3">
              <span className="text-xs text-gray-400 uppercase tracking-wide">Atraso</span>
              <span className="text-sm font-bold text-red-400">{atraso} dias</span>
            </div>
          )}
        </div>

        {diretiva.link_eurlex && (
          <a
            href={diretiva.link_eurlex}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10 hover:border-blue-500/40 transition-colors"
          >
            <span className="text-sm font-medium text-blue-300">Ver no EUR-Lex</span>
            <ExternalLink size={15} className="text-blue-400" />
          </a>
        )}
      </div>
    </div>
  );
}
