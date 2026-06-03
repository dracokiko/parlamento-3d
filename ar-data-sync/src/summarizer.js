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
import { resumir, promptIniciativa, promptDeputado } from './ai.js';
import { obterTranscricao } from './scraper.js';

let _client = null;
const db = () => {
  if (!_client) _client = createClient(SUPABASE_URL, SUPABASE_KEY);
  return _client;
};

const PAGINA = 50; // registos por página (evita timeout no Supabase)

// ── Iniciativas ───────────────────────────────────────────────────────────────

export async function resumirIniciativas() {
  console.log('\n  [IA] A resumir iniciativas novas...');
  let offset = 0, total = 0, erros = 0;

  while (true) {
    const { data, error } = await db()
      .from('ar_iniciativas')
      .select('id, titulo, epigrafe, tipo, desc_tipo, autores_dep, autores_gp')
      .is('resumo_ia', null)
      .range(offset, offset + PAGINA - 1);

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
    offset += PAGINA;
  }

  console.log(`\n  [IA] Iniciativas concluído — ${total} resumidas, ${erros} erros`);
}

// ── Deputados ─────────────────────────────────────────────────────────────────

export async function resumirDeputados() {
  console.log('\n  [IA] A resumir perfis de deputados...');
  let total = 0, erros = 0, offset = 0;

  while (true) {
    // Busca deputados activos sem resumo (tem pelo menos partido definido)
    const { data: deps, error } = await db()
      .from('ar_deputados')
      .select('id, cad_id, nome_parlamentar, partido_sigla, circulo')
      .is('resumo_ia', null)
      .not('partido_sigla', 'is', null)
      .range(offset, offset + PAGINA - 1);

    if (error) { console.error('  ✗ Erro ao buscar deputados:', error.message); break; }
    if (!deps?.length) break;

    for (const dep of deps) {
      // Busca as iniciativas onde este deputado é autor (por cad_id)
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
    offset += PAGINA;
  }

  console.log(`\n  [IA] Deputados concluído — ${total} processados, ${erros} erros`);
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
