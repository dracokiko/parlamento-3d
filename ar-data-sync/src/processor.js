/**
 * Normaliza registos brutos da AR para o esquema das tabelas Supabase.
 * Campos confirmados inspeccionando os JSONs reais da XVII Legislatura.
 */

const safeStr  = (v, max = 5000) => v == null ? null : String(v).slice(0, max);
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
    data_inicio:  safeDate(raw.DataInicioleg),
    data_fim:     safeDate(raw.DataFimleg),
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
// Campos reais: Artigo, Assunto, AutoresDeputados, AutoresGP,
//               DataDebate, DataEntrada
export function normalizarDebate(raw) {
  // Debates podem não ter ID próprio — usamos hash de campos únicos
  const dataStr = safeDate(raw.DataDebate) || safeDate(raw.DataEntrada) || '';
  const assunto = safeStr(raw.Assunto, 200) || '';
  const id = `${dataStr}_${assunto.slice(0, 80)}`.replace(/\s+/g, '_');
  if (!id || id === '_') return null;

  return {
    id,
    assunto:       safeStr(raw.Assunto, 500),
    artigo:        safeStr(raw.Artigo, 500),
    data_debate:   safeDate(raw.DataDebate),
    data_entrada:  safeDate(raw.DataEntrada),
    autores_dep:   raw.AutoresDeputados ?? null,
    autores_gp:    raw.AutoresGP        ?? null,
    json_raw:      raw,
  };
}

export const NORMALIZADORES = {
  iniciativas: normalizarIniciativa,
  deputados:   normalizarDeputado,
  debates:     normalizarDebate,
};
