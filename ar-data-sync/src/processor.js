/**
 * Normaliza registos brutos da AR para o esquema das tabelas Supabase.
 * Campos confirmados inspeccionando os JSONs reais da XVII Legislatura.
 */

const safeStr  = (v, max = 5000) => v == null ? null : String(v).slice(0, max);

// Data real de entrada da iniciativa — evento CodigoFase "10" ou Fase "Entrada"
const dataEntrada = eventos => {
  if (!Array.isArray(eventos)) return null;
  const ev = eventos.find(e => e.CodigoFase === '10' || e.Fase === 'Entrada');
  return safeDate(ev?.DataFase);
};

// Data de fim real — data do último evento registado
const dataFim = eventos => {
  if (!Array.isArray(eventos) || !eventos.length) return null;
  const datas = eventos.map(e => safeDate(e.DataFase)).filter(Boolean);
  return datas.length ? datas[datas.length - 1] : null;
};
const safeDate = v => {
  if (!v) return null;
  const s = String(v).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

// ── Iniciativas ───────────────────────────────────────────────────────────────
// Campos reais: IniId, IniNr, IniTipo, IniDescTipo, IniTitulo, IniEpigrafe,
//               IniLeg, IniAutorDeputados, IniAutorGruposParlamentares,
//               IniEventos, DataInicioleg, DataFimleg, IniLinkTexto
export function normalizarIniciativa(raw) {
  const id = safeStr(raw.IniId);
  if (!id) return null;
  return {
    id,
    numero:       safeStr(raw.IniNr),
    tipo:         safeStr(raw.IniTipo),
    desc_tipo:    safeStr(raw.IniDescTipo),
    titulo:       safeStr(raw.IniTitulo, 1000),
    epigrafe:     safeStr(raw.IniEpigrafe, 1000),
    legislatura:  safeStr(raw.IniLeg),
    data_inicio:  dataEntrada(raw.IniEventos) ?? safeDate(raw.DataInicioleg),
    data_fim:     dataFim(raw.IniEventos) ?? safeDate(raw.DataFimleg),
    autores_dep:  raw.IniAutorDeputados   ?? null,
    autores_gp:   raw.IniAutorGruposParlamentares ?? null,
    eventos:      raw.IniEventos          ?? null,
    link_texto:   safeStr(raw.IniLinkTexto),
    json_raw:     raw,
  };
}

// ── Deputados ─────────────────────────────────────────────────────────────────
// Campos reais: DepId, DepCadId, DepNomeParlamentar, DepNomeCompleto,
//               DepCPDes (círculo), DepCPId, DepGP (grupos parlamentares),
//               DepSituacao, LegDes
export function normalizarDeputado(raw) {
  const id = raw.DepId != null ? String(raw.DepId) : null;
  if (!id) return null;

  // Grupo parlamentar actual (último registo)
  const gps     = Array.isArray(raw.DepGP) ? raw.DepGP : [];
  const gpAtual = gps.find(g => !g.gpDtFim) || gps[gps.length - 1] || {};

  return {
    id,
    cad_id:           raw.DepCadId != null ? String(raw.DepCadId) : null,
    nome_parlamentar: safeStr(raw.DepNomeParlamentar),
    nome_completo:    safeStr(raw.DepNomeCompleto),
    circulo:          safeStr(raw.DepCPDes),
    circulo_id:       raw.DepCPId != null ? String(raw.DepCPId) : null,
    partido_sigla:    safeStr(gpAtual.gpSigla),
    legislatura:      safeStr(raw.LegDes),
    situacao:         raw.DepSituacao ?? null,
    grupos:           gps,
    json_raw:         raw,
  };
}

// ── Debates ───────────────────────────────────────────────────────────────────
// Campos reais: DebateId, Artigo, Assunto, AutoresDeputados, AutoresGP,
//               DataDebate, DataEntrada, Intervencoes, Publicacao, TipoDebateDesig
export function normalizarDebate(raw) {
  const id = safeStr(raw.DebateId);
  if (!id) return null;

  // URL do Diário da AR para scraping de transcrição
  const pub = Array.isArray(raw.Publicacao) ? raw.Publicacao[0] : null;
  const urlDiario = pub?.URLDiario ?? null;

  return {
    id,
    assunto:          safeStr(raw.Assunto, 500),
    artigo:           safeStr(raw.Artigo, 500),
    tipo_debate:      safeStr(raw.TipoDebateDesig),
    data_debate:      safeDate(raw.DataDebate),
    data_entrada:     safeDate(raw.DataEntrada),
    sessao:           safeStr(raw.Sessao),
    legislatura:      safeStr(raw.Legislatura),
    autores_dep:      raw.AutoresDeputados ?? null,
    autores_gp:       raw.AutoresGP        ?? null,
    intervencoes_ids: raw.Intervencoes      ?? null,
    url_diario:       urlDiario,
    json_raw:         raw,
  };
}

export const NORMALIZADORES = {
  iniciativas: normalizarIniciativa,
  deputados:   normalizarDeputado,
  debates:     normalizarDebate,
};
