/**
 * Votos e Moções do Plenário — extraídos de AtividadesGerais.Atividades, uma
 * chave do MESMO ficheiro que já descarregamos para "debates"
 * (AtividadesXVII_json.txt) mas que até agora ignorávamos. Faz o seu próprio
 * fetch (em vez de reaproveitar o download de "debates" via sincronizar())
 * porque essa função só sabe extrair um único array de topo — esta chave
 * está aninhada dois níveis abaixo.
 *
 * "Voto": declarações de pesar/condenação/saudação/solidariedade do plenário.
 * "Moção": moções de rejeição do Programa do Governo, moções de censura, etc.
 *
 * Uso: node src/votosMocoesSync.js
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { fetchAtividades } from './atividadesGerais.js';
import { empurrarAmostra } from './resumoPublico.js';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const BATCH_SIZE = 250;

// Só estes dois tipos — Interpelação ao Governo, Programa do Governo, Cerimónia
// e Eleições/composições de órgãos ficam de fora por agora.
const TIPOS_INCLUIDOS = new Set(['Voto', 'Moção']);

/**
 * Sem id próprio na AR para este tipo de registo — construído a partir de
 * Tipo+Legislatura+Sessao+Numero+DataEntrada (confirmado único: 711/711 em
 * produção nesta legislatura).
 */
function normalizar(raw) {
  const id = [raw.Tipo, raw.Legislatura, raw.Sessao, raw.Numero, raw.DataEntrada].filter(Boolean).join('_');
  if (!id) return null;

  const votacao = Array.isArray(raw.VotacaoDebate) ? raw.VotacaoDebate[0] : null;

  return {
    id,
    desc_tipo:    raw.DescTipo ?? null,
    tipo:         raw.Tipo ?? null,
    assunto:      raw.Assunto ? String(raw.Assunto).slice(0, 2000) : null,
    numero:       raw.Numero != null ? String(raw.Numero) : null,
    legislatura:  raw.Legislatura ?? null,
    sessao:       raw.Sessao ?? null,
    data_entrada: raw.DataEntrada ?? null,
    autores_gp:   raw.AutoresGP ?? null,
    resultado:    votacao?.resultado ?? null,
    data_votacao: votacao?.data ?? null,
    unanime:      votacao?.unanime ?? null,
    publicacao:   raw.Publicacao ?? null,
    json_raw:     raw,
    synced_at:    new Date().toISOString(),
  };
}

function labelItem(reg) {
  const resultado = reg.resultado ? ` — ${reg.resultado}` : ' — ainda por votar';
  return { id: reg.id, label: `${reg.desc_tipo ?? '?'}: ${(reg.assunto ?? reg.id).slice(0, 80)}${resultado}` };
}

export async function syncVotosMocoes() {
  console.log('\n  [VOTOS-MOÇÕES] A sincronizar votos e moções do plenário...');

  const raw = await fetchAtividades();
  const atividades = raw.AtividadesGerais?.Atividades ?? [];
  const alvo = atividades.filter(a => TIPOS_INCLUIDOS.has(a.DescTipo));
  console.log(`  [VOTOS-MOÇÕES] ${alvo.length} de ${atividades.length} atividades são Voto/Moção`);

  const registos = alvo.map(normalizar).filter(Boolean);

  let inseridos = 0, atualizados = 0, erros = 0;
  const novos = [], falhas = [];

  for (let i = 0; i < registos.length; i += BATCH_SIZE) {
    const lote = registos.slice(i, i + BATCH_SIZE);
    const ids = lote.map(r => r.id);

    let existentesSet = new Set();
    try {
      const { data } = await db.from('ar_votos_mocoes').select('id').in('id', ids);
      existentesSet = new Set((data || []).map(r => String(r.id)));
    } catch { /* continua sem saber quais são novos */ }

    const { error } = await db.from('ar_votos_mocoes').upsert(lote, { onConflict: 'id' });
    if (error) {
      console.error(`  ✗ Upsert falhou (lote de ${lote.length}): ${error.message}`);
      erros += lote.length;
      empurrarAmostra(falhas, { motivo: `Upsert de ${lote.length} registos falhou: ${error.message}` });
      continue;
    }

    for (const reg of lote) {
      if (existentesSet.has(reg.id)) atualizados++;
      else {
        inseridos++;
        empurrarAmostra(novos, labelItem(reg));
      }
    }
  }

  console.log(`  [VOTOS-MOÇÕES] Concluído — ${inseridos} novos, ${atualizados} atualizados, ${erros} erros`);
  return { total: registos.length, inseridos, atualizados, erros, novos, falhas };
}

// Execução directa
if (process.argv[1]?.includes('votosMocoesSync')) {
  const r = await syncVotosMocoes();
  console.log('\nFim.', r);
}
