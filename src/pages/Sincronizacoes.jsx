import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  CheckCircle, XCircle, AlertTriangle, Clock, LogOut, Lock,
  RefreshCw, Calendar, Database,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAdmin } from '../hooks/useAdmin';

// ── Configuração de recursos ──────────────────────────────────────────────────

const RECURSOS_CONFIG = {
  iniciativas:  { label: 'Iniciativas',   cor: '#0066cc', fonte: 'parlamento.pt · Últimas Iniciativas Entradas',        url: 'https://www.parlamento.pt/Paginas/UltimasIniciativasEntradas.aspx' },
  deputados:    { label: 'Deputados',     cor: '#7c3aed', fonte: 'parlamento.pt · Lista de Deputados',                 url: 'https://www.parlamento.pt/DeputadoGP/Paginas/Deputados.aspx' },
  debates:      { label: 'Debates',       cor: '#059669', fonte: 'debates.parlamento.pt · Catálogo DAR',               url: 'https://debates.parlamento.pt/catalogo/r3/dar/01/17/01' },
  votacoes:     { label: 'Votações',      cor: '#d97706', fonte: 'parlamento.pt · extraídas dos eventos de cada iniciativa', url: 'https://www.parlamento.pt/Paginas/UltimasIniciativasEntradas.aspx' },
  dar:          { label: 'Catálogo DAR',  cor: '#475569', fonte: 'debates.parlamento.pt · Catálogo DAR XVII Leg.',      url: 'https://debates.parlamento.pt/catalogo/r3/dar/01/17/01' },
  transcricoes: { label: 'Transcrições',  cor: '#0891b2', fonte: 'debates.parlamento.pt · PDF de cada sessão',         url: 'https://debates.parlamento.pt/catalogo/r3/dar/01/17/01' },
  resumos_ia:   { label: 'Resumos IA',    cor: '#8b5cf6', fonte: 'Groq API · llama-3.1-8b-instant',                   url: 'https://console.groq.com' },
  intervencoes: { label: 'Intervenções',  cor: '#0f766e', fonte: 'derivado das transcrições (processamento interno)',  url: null },
  biografias:   { label: 'Biografias',    cor: '#b45309', fonte: 'parlamento.pt · Biografia por BID',                  url: 'https://www.parlamento.pt/DeputadoGP/Paginas/Biografia.aspx' },
  presencas:    { label: 'Presenças',     cor: '#be185d', fonte: 'parlamento.pt · Presenças em Plenário por BID',      url: 'https://www.parlamento.pt/DeputadoGP/Paginas/PresencasReunioesPlenarias.aspx' },
  diretivas_ue: { label: 'Diretivas UE', cor: '#ca8a04', fonte: 'EUR-Lex · SPARQL endpoint + scraping de fichas',     url: 'https://eur-lex.europa.eu/search.html?type=named&name=CURRENT_ACTS' },
};

// ── Regras de sincronização (retiradas dos GitHub Actions) ────────────────────

const SYNC_JOBS = [
  {
    id: 'ar',
    nome: 'AR Data Sync',
    cron: '0 3 * * *',
    hora: '04:00 Lisboa',
    frequencia: 'Todos os dias',
    timeout: '3 horas',
    cor: '#0066cc',
    dotCor: '#93c5fd',
    recursos: [
      { nome: 'Iniciativas',   fonte: 'API Dados Abertos AR',      cor: '#0066cc' },
      { nome: 'Deputados',     fonte: 'API Dados Abertos AR',      cor: '#7c3aed' },
      { nome: 'Debates',       fonte: 'API Dados Abertos AR',      cor: '#059669' },
      { nome: 'Votações',      fonte: 'eventos das iniciativas',   cor: '#d97706' },
      { nome: 'Transcrições',  fonte: 'scraping DAR (PDF)',        cor: '#64748b' },
      { nome: 'Resumos IA',    fonte: 'Groq API',                  cor: '#64748b' },
      { nome: 'Intervenções',  fonte: 'análise das transcrições',  cor: '#64748b' },
      { nome: 'Biografias',    fonte: 'scraping parlamento.pt',    cor: '#64748b' },
      { nome: 'Presenças',     fonte: 'scraping parlamento.pt',    cor: '#64748b' },
    ],
  },
  {
    id: 'eurlex',
    nome: 'EUR-Lex Sync',
    cron: '0 4 * * 0',
    hora: '05:00 Lisboa',
    frequencia: 'Todos os domingos',
    timeout: '1 hora',
    cor: '#ca8a04',
    dotCor: '#fbbf24',
    recursos: [
      { nome: 'Diretivas UE', fonte: 'EUR-Lex (SPARQL + scraping)', cor: '#ca8a04' },
    ],
  },
];

// ── Utilitários de calendário ─────────────────────────────────────────────────

const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

const MESES_PT = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dowFromKey(chave) {
  // Usar T12:00:00 evita ambiguidade de timezone
  return new Date(chave + 'T12:00:00').getDay(); // 0=Dom, 1=Seg…
}

function gerarDiasCalendario(ano, mes) {
  const primeiroDia = new Date(ano, mes, 1);
  const ultimoDia   = new Date(ano, mes + 1, 0);
  const inicioDow   = (primeiroDia.getDay() + 6) % 7; // 0=Seg
  const dias = [];
  for (let i = 0; i < inicioDow; i++) dias.push(null);
  for (let d = 1; d <= ultimoDia.getDate(); d++) dias.push(d);
  while (dias.length % 7 !== 0) dias.push(null);
  return dias;
}

function formatarData(chave) {
  if (!chave) return '';
  const [ano, mes, dia] = chave.split('-');
  return `${parseInt(dia)} de ${MESES_PT[parseInt(mes) - 1]} de ${ano}`;
}

function formatarHora(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}

function proximaOcorrencia(job, aPartirDe = new Date()) {
  const d = new Date(aPartirDe);
  d.setDate(d.getDate() + 1); // começa amanhã
  for (let i = 0; i < 14; i++) {
    const dow = d.getDay();
    if (job.id === 'ar') return toDateKey(d); // todos os dias
    if (job.id === 'eurlex' && dow === 0) return toDateKey(d); // domingo
    d.setDate(d.getDate() + 1);
  }
  return null;
}

// ── Status por dia ────────────────────────────────────────────────────────────

function statusDia(logs) {
  if (!logs?.length) return 'sem_sync';
  if (logs.some(l => !l.sucesso)) return 'falha';
  if (logs.some(l => l.erros > 0)) return 'parcial';
  return 'ok';
}

const COR_STATUS = {
  ok:       { bg: '#dcfce7', ponto: '#16a34a' },
  parcial:  { bg: '#fef9c3', ponto: '#ca8a04' },
  falha:    { bg: '#fee2e2', ponto: '#dc2626' },
  sem_sync: { bg: 'transparent', ponto: '#e5e7eb' },
};

const LABEL_STATUS = {
  ok:       'Tudo OK',
  parcial:  'Com erros',
  falha:    'Falhou',
  sem_sync: 'Sem sync',
};

function IconeStatus({ status, size = 16 }) {
  if (status === 'ok')      return <CheckCircle   size={size} color="#16a34a" />;
  if (status === 'falha')   return <XCircle       size={size} color="#dc2626" />;
  if (status === 'parcial') return <AlertTriangle size={size} color="#ca8a04" />;
  return <Clock size={size} color="#9ca3af" />;
}

// ── Login gate ───────────────────────────────────────────────────────────────

function LoginGate({ onEntrar }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [erro, setErro]         = useState('');
  const [loading, setLoading]   = useState(false);

  async function submeter(e) {
    e.preventDefault();
    setErro('');
    setLoading(true);
    const msg = await onEntrar(email, password);
    if (msg) setErro('Credenciais inválidas. Tenta novamente.');
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-[#f0f4f8] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="flex flex-col items-center mb-7">
            <div className="w-12 h-12 rounded-2xl bg-[#1a1a2e] flex items-center justify-center mb-4">
              <Lock size={22} color="#fff" />
            </div>
            <h1 className="text-base font-bold text-gray-900">Área restrita</h1>
            <p className="text-xs text-gray-400 mt-1">Acesso limitado ao administrador</p>
          </div>
          <form onSubmit={submeter} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input
                type="email" required value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-500 transition-colors"
                placeholder="email@exemplo.com" autoComplete="email"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
              <input
                type="password" required value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-500 transition-colors"
                placeholder="••••••••" autoComplete="current-password"
              />
            </div>
            {erro && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{erro}</p>}
            <button
              type="submit" disabled={loading}
              className="w-full py-2.5 rounded-xl bg-[#1a1a2e] text-white text-sm font-medium hover:bg-[#0f0f1e] transition-colors disabled:opacity-60 mt-1"
            >
              {loading ? 'A entrar…' : 'Entrar'}
            </button>
          </form>
        </div>
        <p className="text-center text-[10px] text-gray-400 mt-4">Parlamento 3D · Administração</p>
      </div>
    </div>
  );
}

// ── Painel de regras (coluna direita) ─────────────────────────────────────────

function PainelRegras() {
  const hoje = new Date();

  return (
    <div className="space-y-4">
      {SYNC_JOBS.map(job => {
        const proxima = proximaOcorrencia(job, hoje);
        return (
          <div key={job.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Cabeçalho do job */}
            <div className="px-4 py-3 flex items-center gap-2.5" style={{ borderLeft: `3px solid ${job.cor}` }}>
              <RefreshCw size={14} color={job.cor} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900">{job.nome}</p>
                <p className="text-[10px] text-gray-500">{job.frequencia} às {job.hora}</p>
              </div>
              <span className="text-[10px] text-gray-400 bg-gray-100 rounded-full px-2 py-0.5 flex-shrink-0">
                timeout {job.timeout}
              </span>
            </div>

            {/* Recursos */}
            <div className="px-4 py-3 space-y-1.5">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-2">Recursos sincronizados</p>
              {job.recursos.map(r => {
                const url = Object.values(RECURSOS_CONFIG).find(c => c.label === r.nome)?.url ?? null;
                return (
                  <div key={r.nome} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: r.cor }} />
                    <span className="text-xs font-medium text-gray-700 w-24 flex-shrink-0">{r.nome}</span>
                    {url
                      ? <a href={url} target="_blank" rel="noreferrer" className="text-[10px] text-gray-400 truncate hover:underline hover:text-blue-500 transition-colors">{r.fonte} ↗</a>
                      : <span className="text-[10px] text-gray-400 truncate">{r.fonte}</span>}
                  </div>
                );
              })}
            </div>

            {/* Próxima ocorrência */}
            {proxima && (
              <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 flex items-center gap-2">
                <Calendar size={11} color="#9ca3af" />
                <span className="text-[10px] text-gray-500">
                  Próxima: <strong className="text-gray-700">{formatarData(proxima)} às {job.hora}</strong>
                </span>
              </div>
            )}
          </div>
        );
      })}

      {/* Legenda de cores do calendário */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-3">Legenda do calendário</p>
        <div className="space-y-2">
          <div className="text-[10px] text-gray-500 font-medium mb-1">Dias passados</div>
          {Object.entries(COR_STATUS).map(([k, v]) => (
            <div key={k} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: v.ponto }} />
              <span className="text-[10px] text-gray-500">{LABEL_STATUS[k]}</span>
            </div>
          ))}
          <div className="border-t border-gray-100 pt-2 mt-2">
            <div className="text-[10px] text-gray-500 font-medium mb-1">Dias futuros</div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#93c5fd' }} />
              <span className="text-[10px] text-gray-500">AR Data Sync agendado</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#fbbf24' }} />
              <span className="text-[10px] text-gray-500">EUR-Lex agendado (domingos)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Célula de calendário ──────────────────────────────────────────────────────

function CelulaCalendario({ dia, chave, logsNesteDia, diaAtivo, ehHoje, onSelect }) {
  const hojeChave = toDateKey(new Date());
  const ehFuturo  = chave > hojeChave;
  const status    = statusDia(logsNesteDia);
  const cor       = COR_STATUS[status];
  const ativo     = diaAtivo === chave;
  const dow       = dowFromKey(chave); // 0=Dom
  const ehDomingo = dow === 0;

  return (
    <button
      onClick={() => onSelect(chave)}
      className="flex flex-col items-center py-1.5 rounded-xl transition-all"
      style={{
        background: ativo
          ? '#1a1a2e'
          : ehFuturo
            ? 'transparent'
            : cor.bg,
        outline:     ehHoje && !ativo ? '2px solid #0066cc' : undefined,
        border:      ehFuturo && !ativo ? '1px dashed #d1d5db' : undefined,
      }}
    >
      <span
        className="text-xs font-medium leading-none"
        style={{ color: ativo ? '#fff' : ehFuturo ? '#9ca3af' : '#374151' }}
      >
        {dia}
      </span>

      {/* Indicadores */}
      <div className="flex gap-0.5 mt-1">
        {ehFuturo ? (
          <>
            {/* AR sync esperado todos os dias */}
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#93c5fd' }} />
            {/* EUR-Lex só aos domingos */}
            {ehDomingo && <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#fbbf24' }} />}
          </>
        ) : (
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: ativo ? 'rgba(255,255,255,0.5)' : cor.ponto }}
          />
        )}
      </div>
    </button>
  );
}

// ── Detalhe de um recurso no dia ──────────────────────────────────────────────

function RecursoDetalhe({ recurso, runs, expandido, onToggle }) {
  const cfg        = RECURSOS_CONFIG[recurso] ?? { label: recurso, cor: '#6b7280' };
  const ultimo     = runs[0];
  const status     = runs.some(r => !r.sucesso) ? 'falha' : runs.some(r => r.erros > 0) ? 'parcial' : 'ok';
  const totalIns   = runs.reduce((s, r) => s + (r.inseridos   ?? 0), 0);
  const totalAt    = runs.reduce((s, r) => s + (r.atualizados ?? 0), 0);
  const totalErros = runs.reduce((s, r) => s + (r.erros       ?? 0), 0);
  const detalhes   = runs.flatMap(r => r.detalhes ?? []);

  return (
    <div>
      <button
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors text-left"
        onClick={onToggle}
      >
        <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: cfg.cor }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-semibold text-gray-900">{cfg.label}</span>
            <IconeStatus status={status} size={13} />
            {runs.length > 1 && (
              <span className="text-[10px] text-gray-400 bg-gray-100 rounded-full px-1.5 py-0.5">
                {runs.length} runs
              </span>
            )}
          </div>
          {cfg.fonte && (
            <p className="text-[10px] text-gray-400 mb-1">
              {cfg.url
                ? <a href={cfg.url} target="_blank" rel="noreferrer" className="hover:underline hover:text-blue-500 transition-colors">{cfg.fonte} ↗</a>
                : cfg.fonte}
            </p>
          )}
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-500">
            <span>Total: <strong className="text-gray-700">{(ultimo.total ?? 0).toLocaleString('pt-PT')}</strong></span>
            <span style={{ color: totalIns > 0 ? '#16a34a' : '#9ca3af' }}>+{totalIns} novos</span>
            <span>{totalAt} atualizados</span>
            {totalErros > 0 && <span style={{ color: '#dc2626' }}>{totalErros} erros</span>}
            <span className="text-gray-400">{formatarHora(ultimo.created_at)}</span>
          </div>
        </div>
        <div className="flex-shrink-0 text-gray-400">
          {expandido ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {expandido && (
        <div className="border-t border-gray-100 bg-gray-50">
          {detalhes.length > 0 ? (
            <div className="px-5 py-3">
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                  {totalIns} {totalIns === 1 ? 'registo novo' : 'registos novos'}
                </p>
                {totalIns > detalhes.length && (
                  <span className="text-[10px] text-amber-600 bg-amber-50 rounded-full px-2 py-0.5">
                    a mostrar {detalhes.length} de {totalIns}
                  </span>
                )}
              </div>
              <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                {detalhes.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 py-0.5">
                    <span
                      className="text-[10px] font-mono text-gray-400 mt-0.5 flex-shrink-0 w-5 text-right"
                    >
                      {i + 1}.
                    </span>
                    <span className="text-[11px] text-gray-700 leading-snug">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="px-5 py-3 flex items-center gap-2">
              <Database size={13} color="#9ca3af" />
              <p className="text-[11px] text-gray-400">
                {totalIns > 0
                  ? `${totalIns} registos novos — detalhe capturado a partir da próxima sync`
                  : totalAt > 0
                    ? `${totalAt} registos atualizados (sem novos)`
                    : 'Sem alterações nesta sincronização'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Dashboard principal ───────────────────────────────────────────────────────

function Dashboard({ onSair }) {
  const hoje = new Date();
  const [logs, setLogs]                 = useState([]);
  const [loading, setLoading]           = useState(true);
  const [mes, setMes]                   = useState({ ano: hoje.getFullYear(), mes: hoje.getMonth() });
  const [diaAtivo, setDiaAtivo]         = useState(toDateKey(hoje));
  const [recursoExpandido, setRecursoExpandido] = useState(null);

  useEffect(() => {
    supabase
      .from('ar_sync_log')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setLogs(data);
        setLoading(false);
      });
  }, []);

  const logsPorDia = useMemo(() => {
    const mapa = {};
    for (const log of logs) {
      const chave = log.created_at.slice(0, 10);
      if (!mapa[chave]) mapa[chave] = [];
      mapa[chave].push(log);
    }
    return mapa;
  }, [logs]);

  const diasCalendario = useMemo(
    () => gerarDiasCalendario(mes.ano, mes.mes),
    [mes.ano, mes.mes],
  );

  const logsAtivos = logsPorDia[diaAtivo] ?? [];

  const porRecurso = useMemo(() => {
    const mapa = {};
    for (const log of logsAtivos) {
      if (!mapa[log.recurso]) mapa[log.recurso] = [];
      mapa[log.recurso].push(log);
    }
    return mapa;
  }, [logsAtivos]);

  function navegarMes(delta) {
    setMes(prev => {
      let m = prev.mes + delta, a = prev.ano;
      if (m < 0)  { m = 11; a--; }
      if (m > 11) { m = 0;  a++; }
      return { ano: a, mes: m };
    });
  }

  function selecionarDia(chave) {
    setDiaAtivo(chave);
    setRecursoExpandido(null);
  }

  const stats30 = useMemo(() => {
    const limite = new Date();
    limite.setDate(limite.getDate() - 30);
    const recentes = logs.filter(l => new Date(l.created_at) >= limite);
    return {
      diasComSync: new Set(recentes.map(l => l.created_at.slice(0, 10))).size,
      totalNovos:  recentes.reduce((s, l) => s + (l.inseridos ?? 0), 0),
      comFalha:    recentes.filter(l => !l.sucesso).length,
    };
  }, [logs]);

  const hojeChave = toDateKey(hoje);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f0f4f8] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f4f8]">

      {/* Cabeçalho */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <Link to="/" className="text-gray-500 hover:text-gray-800 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-base font-bold text-gray-900 leading-tight">Sincronizações</h1>
          <p className="text-[11px] text-gray-400">Histórico e agenda de atualizações de dados</p>
        </div>
        <button
          onClick={onSair}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors px-2 py-1.5 rounded-lg hover:bg-gray-100"
        >
          <LogOut size={14} />
          Sair
        </button>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-[11px] text-gray-400 mb-1">Dias sincronizados (30d)</p>
            <p className="text-2xl font-bold text-gray-900">{stats30.diasComSync}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-[11px] text-gray-400 mb-1">Registos novos (30d)</p>
            <p className="text-2xl font-bold text-blue-600">{stats30.totalNovos.toLocaleString('pt-PT')}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-[11px] text-gray-400 mb-1">Falhas (30d)</p>
            <p className="text-2xl font-bold" style={{ color: stats30.comFalha > 0 ? '#dc2626' : '#16a34a' }}>
              {stats30.comFalha}
            </p>
          </div>
        </div>

        {/* Layout dois colunas */}
        <div className="flex flex-col lg:flex-row gap-5 items-start">

          {/* ── Coluna esquerda: calendário + detalhe ── */}
          <div className="flex-1 min-w-0 space-y-5">

            {/* Calendário */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

              {/* Navegação mês */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                <button onClick={() => navegarMes(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500">
                  <ChevronLeft size={18} />
                </button>
                <span className="text-sm font-semibold text-gray-800">{MESES_PT[mes.mes]} {mes.ano}</span>
                <button onClick={() => navegarMes(1)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500">
                  <ChevronRight size={18} />
                </button>
              </div>

              {/* Cabeçalho dias semana */}
              <div className="grid grid-cols-7 px-3 pt-2 pb-1">
                {DIAS_SEMANA.map(d => (
                  <div key={d} className="text-center text-[10px] font-medium text-gray-400 py-1">{d}</div>
                ))}
              </div>

              {/* Grelha */}
              <div className="grid grid-cols-7 px-3 pb-3 gap-y-1">
                {diasCalendario.map((dia, i) => {
                  if (!dia) return <div key={`v-${i}`} />;
                  const chave = `${mes.ano}-${String(mes.mes + 1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
                  return (
                    <CelulaCalendario
                      key={chave}
                      dia={dia}
                      chave={chave}
                      logsNesteDia={logsPorDia[chave] ?? []}
                      diaAtivo={diaAtivo}
                      ehHoje={chave === hojeChave}
                      onSelect={selecionarDia}
                    />
                  );
                })}
              </div>
            </div>

            {/* Painel do dia selecionado */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">Dia selecionado</p>
                  <h2 className="text-sm font-semibold text-gray-900 mt-0.5">{formatarData(diaAtivo)}</h2>
                </div>
                <div className="flex items-center gap-1.5">
                  <IconeStatus status={statusDia(logsAtivos)} size={15} />
                  <span className="text-xs text-gray-500">{LABEL_STATUS[statusDia(logsAtivos)]}</span>
                </div>
              </div>

              {diaAtivo > hojeChave ? (
                /* Dia futuro: mostrar o que está agendado */
                <div className="px-5 py-5">
                  <p className="text-xs font-medium text-gray-600 mb-3">Sincronizações agendadas</p>
                  <div className="space-y-2.5">
                    {SYNC_JOBS.filter(j => j.id === 'ar' || (j.id === 'eurlex' && dowFromKey(diaAtivo) === 0)).map(j => (
                      <div key={j.id} className="flex items-center gap-3 py-2 px-3 rounded-xl bg-gray-50 border border-gray-100">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: j.dotCor }} />
                        <div>
                          <p className="text-xs font-semibold text-gray-800">{j.nome}</p>
                          <p className="text-[10px] text-gray-400">às {j.hora}</p>
                        </div>
                        <div className="ml-auto flex flex-wrap gap-1">
                          {j.recursos.slice(0, 4).map(r => (
                            <span key={r.nome} className="text-[10px] text-gray-500 bg-white border border-gray-200 rounded-full px-1.5 py-0.5">
                              {r.nome}
                            </span>
                          ))}
                          {j.recursos.length > 4 && (
                            <span className="text-[10px] text-gray-400 px-1 py-0.5">+{j.recursos.length - 4}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : logsAtivos.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <Clock size={28} color="#d1d5db" className="mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Sem sincronizações neste dia</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {Object.entries(porRecurso).map(([recurso, runs]) => (
                    <RecursoDetalhe
                      key={recurso}
                      recurso={recurso}
                      runs={runs}
                      expandido={recursoExpandido === recurso}
                      onToggle={() => setRecursoExpandido(prev => prev === recurso ? null : recurso)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Histórico recente */}
            {logs.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-800">Últimas sincronizações</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {logs.slice(0, 15).map(log => {
                    const cfg = RECURSOS_CONFIG[log.recurso] ?? { label: log.recurso, cor: '#6b7280' };
                    const st  = !log.sucesso ? 'falha' : log.erros > 0 ? 'parcial' : 'ok';
                    return (
                      <button
                        key={log.id}
                        className="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 transition-colors text-left"
                        onClick={() => {
                          const chave = log.created_at.slice(0, 10);
                          const [ano, m] = chave.split('-').map(Number);
                          setMes({ ano, mes: m - 1 });
                          selecionarDia(chave);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                      >
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.cor }} />
                        <span className="text-xs font-medium text-gray-700 w-28 flex-shrink-0">{cfg.label}</span>
                        <span className="text-[11px] text-gray-400 flex-1">
                          {new Date(log.created_at).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })}
                          {' · '}{formatarHora(log.created_at)}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {log.inseridos > 0 && (
                            <span className="text-[10px] font-medium text-green-600 bg-green-50 rounded-full px-1.5 py-0.5">
                              +{log.inseridos}
                            </span>
                          )}
                          <IconeStatus status={st} size={13} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── Coluna direita: regras ── */}
          <div className="w-full lg:w-72 lg:sticky lg:top-6 flex-shrink-0">
            <PainelRegras />
          </div>

        </div>
      </div>
    </div>
  );
}

// ── Página pública (com gate de autenticação) ─────────────────────────────────

export function Sincronizacoes() {
  const { loading, autenticado, entrar, sair } = useAdmin();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f0f4f8] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!autenticado) return <LoginGate onEntrar={entrar} />;

  return <Dashboard onSair={sair} />;
}
