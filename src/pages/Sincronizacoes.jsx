import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, CheckCircle, XCircle, AlertTriangle, Clock, LogOut, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAdmin } from '../hooks/useAdmin';

const RECURSOS_CONFIG = {
  iniciativas: { label: 'Iniciativas',  cor: '#0066cc' },
  deputados:   { label: 'Deputados',    cor: '#7c3aed' },
  debates:     { label: 'Debates',      cor: '#059669' },
  votacoes:    { label: 'Votações',     cor: '#d97706' },
};

const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

const MESES_PT = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

function toLocaleDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function statusDia(logs) {
  if (!logs || !logs.length) return 'sem_sync';
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

function gerarDiasCalendario(ano, mes) {
  const primeiroDia = new Date(ano, mes, 1);
  const ultimoDia   = new Date(ano, mes + 1, 0);
  const inicioDow   = (primeiroDia.getDay() + 6) % 7;
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

function formatarHora(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}

// ── Login gate ───────────────────────────────────────────────────────────────

function LoginGate({ onEntrar }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

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
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-500 transition-colors"
                placeholder="email@exemplo.com"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-500 transition-colors"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            {erro && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{erro}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-[#1a1a2e] text-white text-sm font-medium hover:bg-[#0f0f1e] transition-colors disabled:opacity-60 mt-1"
            >
              {loading ? 'A entrar…' : 'Entrar'}
            </button>
          </form>
        </div>

        <p className="text-center text-[10px] text-gray-400 mt-4">
          Parlamento 3D · Painel de administração
        </p>
      </div>
    </div>
  );
}

// ── Dashboard ────────────────────────────────────────────────────────────────

function Dashboard({ onSair }) {
  const hoje = new Date();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mes, setMes] = useState({ ano: hoje.getFullYear(), mes: hoje.getMonth() });
  const [diaAtivo, setDiaAtivo] = useState(toLocaleDateKey(hoje));
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
      let m = prev.mes + delta;
      let a = prev.ano;
      if (m < 0)  { m = 11; a--; }
      if (m > 11) { m = 0;  a++; }
      return { ano: a, mes: m };
    });
  }

  function selecionarDia(dia) {
    if (!dia) return;
    const chave = `${mes.ano}-${String(mes.mes + 1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
    setDiaAtivo(chave);
    setRecursoExpandido(null);
  }

  function toggleRecurso(recurso) {
    setRecursoExpandido(prev => prev === recurso ? null : recurso);
  }

  const stats30 = useMemo(() => {
    const limite = new Date();
    limite.setDate(limite.getDate() - 30);
    const recentes = logs.filter(l => new Date(l.created_at) >= limite);
    return {
      diasComSync:  new Set(recentes.map(l => l.created_at.slice(0, 10))).size,
      totalNovos:   recentes.reduce((s, l) => s + (l.inseridos ?? 0), 0),
      comFalha:     recentes.filter(l => !l.sucesso).length,
    };
  }, [logs]);

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
          <p className="text-[11px] text-gray-400">Histórico de atualizações de dados</p>
        </div>
        <button
          onClick={onSair}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors px-2 py-1.5 rounded-lg hover:bg-gray-100"
          title="Terminar sessão"
        >
          <LogOut size={14} />
          Sair
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Cards de resumo */}
        <div className="grid grid-cols-3 gap-3">
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

        {/* Calendário */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <button onClick={() => navegarMes(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500">
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-semibold text-gray-800">{MESES_PT[mes.mes]} {mes.ano}</span>
            <button onClick={() => navegarMes(1)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500">
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="grid grid-cols-7 px-3 pt-2 pb-1">
            {DIAS_SEMANA.map(d => (
              <div key={d} className="text-center text-[10px] font-medium text-gray-400 py-1">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 px-3 pb-3 gap-y-1">
            {diasCalendario.map((dia, i) => {
              if (!dia) return <div key={`v-${i}`} />;
              const chave = `${mes.ano}-${String(mes.mes + 1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
              const logsNesteDia = logsPorDia[chave] ?? [];
              const status = statusDia(logsNesteDia);
              const cor    = COR_STATUS[status];
              const ativo  = diaAtivo === chave;
              const ehHoje = chave === toLocaleDateKey(new Date());

              return (
                <button
                  key={chave}
                  onClick={() => selecionarDia(dia)}
                  className="flex flex-col items-center gap-0.5 py-1.5 rounded-xl transition-all"
                  style={{
                    background: ativo ? '#1a1a2e' : cor.bg,
                    outline: ehHoje && !ativo ? '2px solid #0066cc' : undefined,
                  }}
                >
                  <span className="text-xs font-medium leading-none" style={{ color: ativo ? '#fff' : '#374151' }}>
                    {dia}
                  </span>
                  <div className="w-1.5 h-1.5 rounded-full mt-0.5" style={{ backgroundColor: ativo ? 'rgba(255,255,255,0.5)' : cor.ponto }} />
                </button>
              );
            })}
          </div>

          {/* Legenda */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 border-t border-gray-100 bg-gray-50">
            {Object.entries(COR_STATUS).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: v.ponto }} />
                <span className="text-[10px] text-gray-500">{LABEL_STATUS[k]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Painel do dia selecionado */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-gray-400 uppercase tracking-wide">Dia selecionado</p>
              <h2 className="text-sm font-semibold text-gray-900 mt-0.5">{formatarData(diaAtivo)}</h2>
            </div>
            <div className="flex items-center gap-1.5">
              <IconeStatus status={statusDia(logsAtivos)} size={15} />
              <span className="text-xs text-gray-500">{LABEL_STATUS[statusDia(logsAtivos)]}</span>
            </div>
          </div>

          {logsAtivos.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <Clock size={28} color="#d1d5db" className="mx-auto mb-2" />
              <p className="text-sm text-gray-400">Sem sincronizações neste dia</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {Object.entries(porRecurso).map(([recurso, runs]) => {
                const cfg       = RECURSOS_CONFIG[recurso] ?? { label: recurso, cor: '#6b7280' };
                const ultimo    = runs[0];
                const status    = runs.some(r => !r.sucesso) ? 'falha' : runs.some(r => r.erros > 0) ? 'parcial' : 'ok';
                const totalIns  = runs.reduce((s, r) => s + (r.inseridos ?? 0), 0);
                const totalAt   = runs.reduce((s, r) => s + (r.atualizados ?? 0), 0);
                const totalErros = runs.reduce((s, r) => s + (r.erros ?? 0), 0);
                const detalhes  = runs.flatMap(r => r.detalhes ?? []);
                const expandido = recursoExpandido === recurso;

                return (
                  <div key={recurso}>
                    <button
                      className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors text-left"
                      onClick={() => toggleRecurso(recurso)}
                    >
                      <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: cfg.cor }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-gray-900">{cfg.label}</span>
                          <IconeStatus status={status} size={13} />
                          {runs.length > 1 && (
                            <span className="text-[10px] text-gray-400 bg-gray-100 rounded-full px-1.5 py-0.5">
                              {runs.length} runs
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-500">
                          <span>Total: <strong className="text-gray-700">{(ultimo.total ?? 0).toLocaleString('pt-PT')}</strong></span>
                          <span style={{ color: totalIns > 0 ? '#16a34a' : '#9ca3af' }}>+{totalIns} novos</span>
                          <span>{totalAt} atualizados</span>
                          {totalErros > 0 && <span style={{ color: '#dc2626' }}>{totalErros} erros</span>}
                          <span className="text-gray-400">{formatarHora(ultimo.created_at)}</span>
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-gray-400">
                        {detalhes.length > 0
                          ? (expandido ? <ChevronUp size={16} /> : <ChevronDown size={16} />)
                          : <ChevronDown size={16} color="#e5e7eb" />}
                      </div>
                    </button>

                    {expandido && (
                      <div className="px-5 pb-4 bg-gray-50 border-t border-gray-100">
                        {detalhes.length > 0 ? (
                          <>
                            <p className="text-[10px] text-gray-400 uppercase tracking-wide pt-3 pb-2">
                              {detalhes.length} {detalhes.length === 1 ? 'registo novo' : 'registos novos'}
                              {totalIns > detalhes.length && ` (mostrando ${detalhes.length} de ${totalIns})`}
                            </p>
                            <ul className="space-y-1">
                              {detalhes.map((item, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <div className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: cfg.cor }} />
                                  <span className="text-[11px] text-gray-600 leading-snug">{item.label}</span>
                                </li>
                              ))}
                            </ul>
                          </>
                        ) : (
                          <p className="text-[11px] text-gray-400 pt-3">
                            {totalIns > 0
                              ? `${totalIns} registos novos — detalhe disponível a partir da próxima sincronização`
                              : 'Sem registos novos nesta sincronização'}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
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
              {logs.slice(0, 20).map(log => {
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
                      setDiaAtivo(chave);
                      setRecursoExpandido(null);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.cor }} />
                    <span className="text-xs font-medium text-gray-700 w-24 flex-shrink-0">{cfg.label}</span>
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
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────────────────────

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
