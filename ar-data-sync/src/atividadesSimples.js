/**
 * Sincronizações "simples" de AtividadesGerais — arrays planos com id próprio
 * e sem sub-estruturas a resolver (ao contrário de votos/moções). Todas
 * partilham o mesmo fetch (ver atividadesGerais.js) e a mesma lógica de
 * upsert em lote — só mudam a chave de origem, a tabela e o mapeamento de
 * campos.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { fetchAtividades } from './atividadesGerais.js';
import { empurrarAmostra } from './resumoPublico.js';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const BATCH_SIZE = 250;

const safeDate = v => {
  if (!v) return null;
  const s = String(v).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

/**
 * Sincroniza uma lista simples: descarrega (via callback `itens`), normaliza,
 * e faz upsert em lote na tabela indicada — devolve o mesmo formato que os
 * outros recursos (total/inseridos/atualizados/erros/novos/falhas) para
 * encaixar directamente num log() de sync.js.
 */
async function syncListaSimples({ nome, itens, tabela, normalizar, labelItem }) {
  console.log(`\n  [${nome}] A sincronizar ${itens.length} registos...`);
  const registos = itens.map(normalizar).filter(Boolean);

  let inseridos = 0, atualizados = 0, erros = 0;
  const novos = [], falhas = [];

  for (let i = 0; i < registos.length; i += BATCH_SIZE) {
    const lote = registos.slice(i, i + BATCH_SIZE);
    const ids = lote.map(r => r.id);

    let existentesSet = new Set();
    try {
      const { data } = await db.from(tabela).select('id').in('id', ids);
      existentesSet = new Set((data || []).map(r => String(r.id)));
    } catch { /* continua sem saber quais são novos */ }

    const { error } = await db.from(tabela).upsert(lote, { onConflict: 'id' });
    if (error) {
      console.error(`  ✗ [${nome}] Upsert falhou (lote de ${lote.length}): ${error.message}`);
      erros += lote.length;
      empurrarAmostra(falhas, { motivo: `Upsert de ${lote.length} registos falhou: ${error.message}` });
      continue;
    }

    for (const reg of lote) {
      if (existentesSet.has(String(reg.id))) atualizados++;
      else {
        inseridos++;
        empurrarAmostra(novos, labelItem(reg));
      }
    }
  }

  console.log(`  [${nome}] Concluído — ${inseridos} novos, ${atualizados} atualizados, ${erros} erros`);
  return { total: registos.length, inseridos, atualizados, erros, novos, falhas };
}

// ── Audições ─────────────────────────────────────────────────────────────────

function normalizarAudicao(raw) {
  const id = raw.IDAudicao != null ? String(raw.IDAudicao) : null;
  if (!id) return null;
  return {
    id,
    assunto:     raw.Assunto ? String(raw.Assunto).slice(0, 2000) : null,
    data:        safeDate(raw.Data),
    entidades:   raw.Entidades ? String(raw.Entidades).slice(0, 2000) : null,
    numero:      raw.NumeroAudicao ?? null,
    legislatura: raw.Legislatura ?? null,
    sessao:      raw.SessaoLegislativa ?? null,
    documentos:  raw.Documentos ?? null,
    links:       raw.Links ?? null,
    json_raw:    raw,
    synced_at:   new Date().toISOString(),
  };
}

export async function syncAudicoes() {
  const dados = await fetchAtividades();
  return syncListaSimples({
    nome: 'AUDIÇÕES',
    itens: dados.Audicoes ?? [],
    tabela: 'ar_audicoes',
    normalizar: normalizarAudicao,
    labelItem: (r) => ({ id: r.id, label: (r.assunto ?? r.id).slice(0, 90) }),
  });
}

// ── Audiências ───────────────────────────────────────────────────────────────

function normalizarAudiencia(raw) {
  const id = raw.IDAudiencia != null ? String(raw.IDAudiencia) : null;
  if (!id) return null;
  return {
    id,
    assunto:     raw.Assunto ? String(raw.Assunto).slice(0, 2000) : null,
    data:        safeDate(raw.Data),
    entidades:   raw.Entidades ? String(raw.Entidades).slice(0, 2000) : null,
    concedida:   raw.Concedida ?? null,
    numero:      raw.NumeroAudiencia ?? null,
    legislatura: raw.Legislatura ?? null,
    sessao:      raw.SessaoLegislativa ?? null,
    documentos:  raw.Documentos ?? null,
    links:       raw.Links ?? null,
    json_raw:    raw,
    synced_at:   new Date().toISOString(),
  };
}

export async function syncAudiencias() {
  const dados = await fetchAtividades();
  return syncListaSimples({
    nome: 'AUDIÊNCIAS',
    itens: dados.Audiencias ?? [],
    tabela: 'ar_audiencias',
    normalizar: normalizarAudiencia,
    labelItem: (r) => ({ id: r.id, label: (r.assunto ?? r.id).slice(0, 90) }),
  });
}

// ── Deslocações ──────────────────────────────────────────────────────────────

function normalizarDeslocacao(raw) {
  const id = raw.IDDeslocacao != null ? String(raw.IDDeslocacao) : null;
  if (!id) return null;
  return {
    id,
    designacao:   raw.Designacao ? String(raw.Designacao).slice(0, 2000) : null,
    tipo:         raw.Tipo ?? null,
    data_inicio:  safeDate(raw.DataIni),
    data_fim:     safeDate(raw.DataFim),
    local_evento: raw.LocalEvento ?? null,
    legislatura:  raw.Legislatura ?? null,
    sessao:       raw.SessaoLegislativa ?? null,
    documentos:   raw.Documentos ?? null,
    links:        raw.Links ?? null,
    json_raw:     raw,
    synced_at:    new Date().toISOString(),
  };
}

export async function syncDeslocacoes() {
  const dados = await fetchAtividades();
  return syncListaSimples({
    nome: 'DESLOCAÇÕES',
    itens: dados.Deslocacoes ?? [],
    tabela: 'ar_deslocacoes',
    normalizar: normalizarDeslocacao,
    labelItem: (r) => ({ id: r.id, label: (r.designacao ?? r.id).slice(0, 90) }),
  });
}

// ── Eventos ──────────────────────────────────────────────────────────────────

function normalizarEvento(raw) {
  const id = raw.IDEvento != null ? String(raw.IDEvento) : null;
  if (!id) return null;
  return {
    id,
    designacao:   raw.Designacao ? String(raw.Designacao).slice(0, 2000) : null,
    tipo_evento:  raw.TipoEvento ?? null,
    data:         safeDate(raw.Data),
    local_evento: raw.LocalEvento ?? null,
    legislatura:  raw.Legislatura ?? null,
    sessao:       raw.SessaoLegislativa ?? null,
    documentos:   raw.Documentos ?? null,
    links:        raw.Links ?? null,
    json_raw:     raw,
    synced_at:    new Date().toISOString(),
  };
}

export async function syncEventos() {
  const dados = await fetchAtividades();
  return syncListaSimples({
    nome: 'EVENTOS',
    itens: dados.Eventos ?? [],
    tabela: 'ar_eventos',
    normalizar: normalizarEvento,
    labelItem: (r) => ({ id: r.id, label: (r.designacao ?? r.id).slice(0, 90) }),
  });
}

// ── Orçamento da Assembleia ────────────────────────────────────────────────

function normalizarOrcamento(raw) {
  const id = raw.id != null ? String(raw.id) : null;
  if (!id) return null;
  return {
    id,
    ano:                raw.ano ?? null,
    titulo:             raw.titulo ? String(raw.titulo).slice(0, 2000) : null,
    tipo:               raw.tipo ?? null,
    tp:                 raw.tp ?? null,
    data_aprovacao_ca:  safeDate(raw.dtAprovacaoCA),
    data_agendamento:   safeDate(raw.dtAgendamento),
    legislatura:        raw.leg ?? null,
    sessao:             raw.SL ?? null,
    votacao:            raw.votacao ?? null,
    textos_aprovados:   raw.textosAprovados ?? null,
    anexos:             raw.anexos ?? null,
    json_raw:           raw,
    synced_at:          new Date().toISOString(),
  };
}

export async function syncOrcamento() {
  const dados = await fetchAtividades();
  return syncListaSimples({
    nome: 'ORÇAMENTO',
    itens: dados.OrcamentoContasGerencia ?? [],
    tabela: 'ar_orcamento',
    normalizar: normalizarOrcamento,
    labelItem: (r) => ({ id: r.id, label: (r.titulo ?? r.id).slice(0, 90) }),
  });
}
