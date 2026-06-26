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
import { resumir, promptIniciativa, promptDeputado, promptDebate, promptVotacao, promptTemas, TEMAS_DISPONIVEIS } from './ai.js';
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
  return { total: total + erros, inseridos: total, atualizados: 0, erros };
}

// ── Deputados ─────────────────────────────────────────────────────────────────

export async function resumirDeputados() {
  console.log('\n  [IA] A resumir perfis de deputados...');
  let total = 0, erros = 0;

  // Só os 230 deputados actuais (tabela deputados) — exclui suplentes históricos
  const { data: activos, error: errActivos } = await db().from('deputados').select('id');
  if (errActivos) { console.error('  ✗ Erro ao buscar deputados activos:', errActivos.message); return { total: 0, inseridos: 0, atualizados: 0, erros: 1 }; }
  const idsActivos = (activos ?? []).map(d => d.id);

  while (true) {
    const { data: deps, error } = await db()
      .from('ar_deputados')
      .select('id, cad_id, nome_parlamentar, partido_sigla, circulo')
      .is('resumo_ia', null)
      .in('id', idsActivos)
      .range(0, PAGINA - 1);

    if (error) { console.error('  ✗ Erro ao buscar deputados:', error.message); break; }
    if (!deps?.length) break;

    for (const dep of deps) {
      const { data: inis } = await db()
        .from('ar_iniciativas')
        .select('titulo, resumo_ia')
        .contains('autores_dep', JSON.stringify([{ idCadastro: dep.cad_id }]))
        .limit(30);

      // Sem iniciativas suficientes: marcar resumo_ia='' para sair da fila IS NULL
      if (!inis || inis.length < 2) {
        await db().from('ar_deputados').update({ resumo_ia: '' }).eq('id', dep.id);
        total++;
        continue;
      }

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
  return { total: total + erros, inseridos: total, atualizados: 0, erros };
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
  return { total: total + erros, inseridos: total, atualizados: 0, erros };
}

// ── Votações ──────────────────────────────────────────────────────────────────

export async function resumirVotacoes() {
  console.log('\n  [IA] A resumir votações novas...');
  let total = 0, erros = 0;

  while (true) {
    const { data: vots, error } = await db()
      .from('ar_votacoes')
      .select('id, iniciativa_id, fase, resultado, unanime, detalhe_gp')
      .is('resumo_ia', null)
      .not('resultado', 'is', null)
      .range(0, PAGINA - 1);

    if (error) { console.error('  ✗ Erro ao buscar votações:', error.message); break; }
    if (!vots?.length) break;

    // Buscar iniciativas correspondentes de uma vez
    const iniIds = [...new Set(vots.map(v => v.iniciativa_id).filter(Boolean))];
    const { data: inis } = await db()
      .from('ar_iniciativas')
      .select('id, titulo, desc_tipo, resumo_ia')
      .in('id', iniIds);
    const iniMapa = new Map((inis ?? []).map(i => [i.id, i]));

    for (const vot of vots) {
      const ini = iniMapa.get(vot.iniciativa_id) ?? null;
      const resumo = await resumir(promptVotacao(vot, ini));
      if (resumo) {
        await db().from('ar_votacoes').update({ resumo_ia: resumo }).eq('id', vot.id);
        total++;
      } else {
        // Marcar com string vazia para não re-tentar infinitamente
        await db().from('ar_votacoes').update({ resumo_ia: '' }).eq('id', vot.id);
        erros++;
      }
      process.stdout.write(`  [IA] Votações: ${total} resumidas, ${erros} erros\r`);
    }

    if (vots.length < PAGINA) break;
  }

  console.log(`\n  [IA] Votações concluído — ${total} resumidas, ${erros} erros`);
  return { total: total + erros, inseridos: total, atualizados: 0, erros };
}

// ── Classificação temática ────────────────────────────────────────────────────

function parseTemas(raw) {
  if (!raw) return null;
  const match = raw.match(/\[[\s\S]*?\]/);
  if (!match) return null;
  try {
    const arr = JSON.parse(match[0]);
    if (!Array.isArray(arr)) return null;
    const validos = arr.filter(t => TEMAS_DISPONIVEIS.includes(t));
    return validos.length ? validos : null;
  } catch { return null; }
}

export async function classificarTemas() {
  console.log('\n  [IA] A classificar temas de iniciativas...');
  let total = 0, erros = 0;
  const detalhes = [];

  while (true) {
    const { data, error } = await db()
      .from('ar_iniciativas')
      .select('id, titulo, epigrafe, tipo, desc_tipo')
      .is('temas', null)
      .range(0, PAGINA - 1);

    if (error) { console.error('  ✗ Erro ao buscar iniciativas:', error.message); break; }
    if (!data?.length) break;

    for (const ini of data) {
      const raw    = await resumir(promptTemas(ini));
      const temas  = parseTemas(raw);
      if (temas) {
        await db().from('ar_iniciativas').update({ temas }).eq('id', ini.id);
        total++;
        if (detalhes.length < 200) {
          const ref = [ini.desc_tipo ?? ini.tipo, ini.titulo?.slice(0, 70)].filter(Boolean).join(' · ');
          detalhes.push({ label: `[${temas.join(', ')}] ${ref}` });
        }
      } else {
        // Marcar como processado (sem temas) para não re-tentar
        await db().from('ar_iniciativas').update({ temas: [] }).eq('id', ini.id);
        erros++;
      }
      process.stdout.write(`  [IA] Temas: ${total} classificadas, ${erros} sem tema\r`);
    }

    if (data.length < PAGINA) break;
  }

  console.log(`\n  [IA] Temas concluído — ${total} classificadas, ${erros} sem tema`);
  return { total: total + erros, inseridos: total, atualizados: 0, erros, detalhes };
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
  return { total: total + erros, inseridos: total, atualizados: 0, erros };
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
  return { total: totalInt, inseridos: totalInt, atualizados: 0, erros: 0 };
}
