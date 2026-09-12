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
import { parsearUrlDar } from './linkDarIniciativas.js';
import { indexarPaginasTranscricao } from './interventionParser.js';

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

  // PublicacaoDebate (quando existe) é a publicação do DEBATE em plenário onde
  // este Voto/Moção foi discutido — distinta de Publicacao (a publicação do
  // texto em si, DAR II série). `pag` dá o intervalo de páginas específico
  // desta discussão dentro da sessão (que cobre vários assuntos nesse dia).
  const pubDebate = Array.isArray(raw.PublicacaoDebate) ? raw.PublicacaoDebate[0] : null;
  const darDebate = pubDebate?.URLDiario ? parsearUrlDar(pubDebate.URLDiario) : null;

  return {
    id,
    desc_tipo:     raw.DescTipo ?? null,
    tipo:          raw.Tipo ?? null,
    assunto:       raw.Assunto ? String(raw.Assunto).slice(0, 2000) : null,
    numero:        raw.Numero != null ? String(raw.Numero) : null,
    legislatura:   raw.Legislatura ?? null,
    sessao:        raw.Sessao ?? null,
    data_entrada:  raw.DataEntrada ?? null,
    autores_gp:    raw.AutoresGP ?? null,
    resultado:     votacao?.resultado ?? null,
    data_votacao:  votacao?.data ?? null,
    unanime:       votacao?.unanime ?? null,
    publicacao:    raw.Publicacao ?? null,
    debate_id:     darDebate?.darId ?? null,
    pagina_inicio: darDebate?.paginaInicio ?? null,
    pagina_fim:    darDebate?.paginaFim ?? null,
    intervencao_ids: null, // preenchido por ligarIntervencoes(), abaixo
    json_raw:      raw,
    synced_at:     new Date().toISOString(),
  };
}

function labelItem(reg) {
  const resultado = reg.resultado ? ` — ${reg.resultado}` : ' — ainda por votar';
  return { id: reg.id, label: `${reg.desc_tipo ?? '?'}: ${(reg.assunto ?? reg.id).slice(0, 80)}${resultado}` };
}

/**
 * Para cada registo com debate_id + intervalo de páginas, encontra as
 * intervenções de ar_intervencoes cuja página (via indexarPaginasTranscricao,
 * a mesma lógica de linkIntervencoesDAR.js) cai dentro desse intervalo — é
 * assim que se isola "só o que foi dito sobre este Voto/Moção" dentro de uma
 * sessão de plenário que discutiu vários assuntos nesse dia.
 * Muda `registos` in-place (define `intervencao_ids`); não falha o sync todo
 * se uma sessão individual der erro — só essa fica sem intervenções ligadas.
 */
async function ligarIntervencoes(registos) {
  const comIntervalo = registos.filter(r => r.debate_id && r.pagina_inicio != null);
  const debateIds = [...new Set(comIntervalo.map(r => r.debate_id))];
  if (!debateIds.length) return;

  console.log(`  [VOTOS-MOÇÕES] A ligar intervenções — ${debateIds.length} sessões de plenário únicas...`);

  const cachePorDebate = new Map(); // debateId → { pgMap, intervencoes }
  let ligados = 0;

  for (const debateId of debateIds) {
    try {
      const { data: deb } = await db.from('ar_debates').select('transcricao').eq('id', debateId).maybeSingle();
      if (!deb?.transcricao) { cachePorDebate.set(debateId, null); continue; }

      const { data: ivs } = await db.from('ar_intervencoes').select('id').eq('debate_id', debateId);
      const pgMap = indexarPaginasTranscricao(deb.transcricao);
      cachePorDebate.set(debateId, { pgMap, intervencoes: ivs ?? [] });
    } catch (err) {
      console.warn(`  ⚠ Falha ao carregar debate ${debateId}: ${err.message}`);
      cachePorDebate.set(debateId, null);
    }
  }

  for (const reg of comIntervalo) {
    const cache = cachePorDebate.get(reg.debate_id);
    if (!cache) continue;

    const ids = cache.intervencoes
      .filter(iv => {
        const i = parseInt(iv.id.slice(iv.id.lastIndexOf('_') + 1), 10) || 0;
        const pg = cache.pgMap.get(i);
        return pg != null && pg >= reg.pagina_inicio && pg <= (reg.pagina_fim ?? reg.pagina_inicio);
      })
      .map(iv => iv.id);

    if (ids.length) {
      reg.intervencao_ids = ids;
      ligados++;
    }
  }

  console.log(`  [VOTOS-MOÇÕES] Intervenções ligadas a ${ligados} de ${comIntervalo.length} registos com debate conhecido`);
}

export async function syncVotosMocoes() {
  console.log('\n  [VOTOS-MOÇÕES] A sincronizar votos e moções do plenário...');

  const raw = await fetchAtividades();
  const atividades = raw.AtividadesGerais?.Atividades ?? [];
  const alvo = atividades.filter(a => TIPOS_INCLUIDOS.has(a.DescTipo));
  console.log(`  [VOTOS-MOÇÕES] ${alvo.length} de ${atividades.length} atividades são Voto/Moção`);

  const registos = alvo.map(normalizar).filter(Boolean);

  try {
    await ligarIntervencoes(registos);
  } catch (err) {
    console.warn(`  ⚠ ligarIntervencoes falhou (${err.message}) — a continuar sem intervenções ligadas`);
  }

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
