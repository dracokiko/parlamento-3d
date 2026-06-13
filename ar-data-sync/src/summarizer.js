/**
 * Summarizer — corre após a sincronização de dados.
 *
 * Estratégia incremental:
 *   1. Busca no Supabase registos com resumo_ia IS NULL (apenas novos)
 *   2. Para cada um, chama o Groq e guarda o resumo
 *   3. Faz o mesmo para deputados (baseado nas suas iniciativas)
 *
 * Nunca re-resume o que já foi resumido → na prática gratuito todos os dias.
 */
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { resumir, promptIniciativa, promptDeputado, promptDebate } from './ai.js';
import { obterTranscricao } from './scraper.js';
import { parsearIntervencoes } from './interventionParser.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));

let _client = null;
const db = () => {
  if (!_client) _client = createClient(SUPABASE_URL, SUPABASE_KEY);
  return _client;
};

const PAGINA = 50; // registos por página (evita timeout no Supabase)

// ── Iniciativas ───────────────────────────────────────────────────────────────

export async function resumirIniciativas() {
  console.log('\n  [IA] A resumir iniciativas novas...');
  let total = 0, erros = 0;

  while (true) {
    // Offset sempre 0: registos processados saem do conjunto IS NULL,
    // pelo que o "início" do conjunto muda a cada iteração.
    const { data, error } = await db()
      .from('ar_iniciativas')
      .select('id, titulo, epigrafe, tipo, desc_tipo, autores_dep, autores_gp')
      .is('resumo_ia', null)
      .range(0, PAGINA - 1);

    if (error) { console.error('  ✗ Erro ao buscar iniciativas:', error.message); break; }
    if (!data?.length) break;

    for (const ini of data) {
      const resumo = await resumir(promptIniciativa(ini));
      if (resumo) {
        await db().from('ar_iniciativas').update({ resumo_ia: resumo }).eq('id', ini.id);
        total++;
      } else {
        erros++;
      }
      process.stdout.write(`  [IA] Iniciativas: ${total} resumidas, ${erros} erros\r`);
    }

    if (data.length < PAGINA) break;
  }

  console.log(`\n  [IA] Iniciativas concluído — ${total} resumidas, ${erros} erros`);
}

// ── Deputados ─────────────────────────────────────────────────────────────────

export async function resumirDeputados() {
  console.log('\n  [IA] A resumir perfis de deputados...');
  let total = 0, erros = 0;

  while (true) {
    const { data: deps, error } = await db()
      .from('ar_deputados')
      .select('id, cad_id, nome_parlamentar, partido_sigla, circulo')
      .is('resumo_ia', null)
      .not('partido_sigla', 'is', null)
      .range(0, PAGINA - 1);

    if (error) { console.error('  ✗ Erro ao buscar deputados:', error.message); break; }
    if (!deps?.length) break;

    for (const dep of deps) {
      const { data: inis } = await db()
        .from('ar_iniciativas')
        .select('titulo, resumo_ia')
        .contains('autores_dep', JSON.stringify([{ idCadastro: dep.cad_id }]))
        .limit(30);

      // Só resume se tiver pelo menos 2 iniciativas (senão o resumo não tem valor)
      if (!inis || inis.length < 2) { total++; continue; }

      const resumo = await resumir(promptDeputado(dep, inis));
      if (resumo) {
        await db().from('ar_deputados').update({ resumo_ia: resumo }).eq('id', dep.id);
        total++;
      } else {
        erros++;
      }
      process.stdout.write(`  [IA] Deputados: ${total} processados, ${erros} erros\r`);
    }

    if (deps.length < PAGINA) break;
  }

  console.log(`\n  [IA] Deputados concluído — ${total} processados, ${erros} erros`);
}

// ── Resumos de Debates ────────────────────────────────────────────────────────

export async function resumirDebates() {
  console.log('\n  [IA] A resumir debates novos...');

  // Buscar todos os debates com transcrição mas sem resumo
  const { data, error } = await db()
    .from('ar_debates')
    .select('id, assunto, artigo, tipo_debate, data_debate, transcricao')
    .is('resumo_ia', null)
    .not('transcricao', 'is', null)
    .limit(200);

  if (error) { console.error('  ✗ Erro:', error.message); return; }
  if (!data?.length) { console.log('  [IA] Sem debates novos para resumir.'); return; }

  console.log(`  [IA] ${data.length} debates para resumir...`);
  let total = 0, erros = 0;

  for (const debate of data) {
    const resumo = await resumir(promptDebate(debate));
    if (resumo) {
      await db().from('ar_debates').update({ resumo_ia: resumo }).eq('id', debate.id);
      total++;
    } else {
      erros++;
    }
    process.stdout.write(`  [IA] Debates: ${total}/${data.length} resumidos, ${erros} erros\r`);
  }

  console.log(`\n  [IA] Debates concluído — ${total} resumidos, ${erros} erros`);
}

// ── Transcrições de Debates ───────────────────────────────────────────────────

export async function obterTranscricoesDebates() {
  console.log('\n  [DAR] A obter transcrições de debates...');
  let total = 0, erros = 0, offset = 0;

  while (true) {
    // Debates com url_diario mas sem transcrição ainda
    const { data: debates, error } = await db()
      .from('ar_debates')
      .select('id, assunto, url_diario')
      .is('transcricao', null)
      .not('url_diario', 'is', null)
      .range(offset, offset + 9); // 10 por vez — cada um faz vários pedidos HTTP

    if (error) { console.error('  ✗ Erro:', error.message); break; }
    if (!debates?.length) break;

    for (const debate of debates) {
      process.stdout.write(`  [DAR] ${total + 1} — ${(debate.assunto ?? '').slice(0, 50)}...\r`);
      const texto = await obterTranscricao(debate.url_diario);
      if (texto) {
        await db().from('ar_debates').update({ transcricao: texto }).eq('id', debate.id);
        total++;
      } else {
        erros++;
      }
    }

    if (debates.length < 10) break;
    offset += 10;
  }

  console.log(`\n  [DAR] Transcrições concluídas — ${total} obtidas, ${erros} erros`);
}

// ── Intervenções individuais ──────────────────────────────────────────────────

export async function indexarIntervencoes() {
  console.log('\n  [INT] A indexar intervenções...');

  let totalInt = 0, totalDeb = 0;
  let offset = 0;
  const PAGE = 50;

  while (true) {
    // Busca apenas IDs para não carregar texto de transcrições desnecessariamente
    const { data: lote, error } = await db()
      .from('ar_debates')
      .select('id')
      .not('transcricao', 'is', null)
      .range(offset, offset + PAGE - 1);

    if (error) { console.error('  ✗ Erro:', error.message); break; }
    if (!lote?.length) break;

    // Quais deste lote já têm intervenções indexadas?
    const { data: jaIndexados } = await db()
      .from('ar_intervencoes')
      .select('debate_id')
      .in('debate_id', lote.map(d => d.id));

    const indexadosSet = new Set((jaIndexados ?? []).map(r => r.debate_id));
    const novosIds = lote.filter(d => !indexadosSet.has(d.id)).map(d => d.id);

    if (novosIds.length) {
      // Só agora busca transcrições — apenas para os debates novos
      const { data: debates } = await db()
        .from('ar_debates')
        .select('id, assunto, data_debate, url_diario, transcricao')
        .in('id', novosIds);

      for (const debate of debates ?? []) {
        const intervencoes = parsearIntervencoes(debate.transcricao);
        if (!intervencoes.length) continue;

        const registos = intervencoes.map((iv, i) => ({
          id:           `${debate.id}_${i}`,
          debate_id:    debate.id,
          nome_dep:     iv.nome,
          partido:      iv.partido,
          texto:        iv.texto,
          data_debate:  debate.data_debate,
          assunto:      debate.assunto,
          url_diario:   debate.url_diario,
          num_palavras: iv.texto.trim().split(/\s+/).filter(Boolean).length,
        }));

        const { error: upsertErr } = await db()
          .from('ar_intervencoes')
          .upsert(registos, { onConflict: 'id', ignoreDuplicates: true });

        if (!upsertErr) {
          totalInt += registos.length;
          totalDeb++;
        }
        process.stdout.write(`  [INT] ${totalDeb} debates → ${totalInt} intervenções\r`);
      }
    }

    if (lote.length < PAGE) break;
    offset += PAGE;
  }

  console.log(`\n  [INT] Indexação concluída — ${totalDeb} debates, ${totalInt} intervenções`);
}
