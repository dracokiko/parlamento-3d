/**
 * Liga ar_intervencoes às iniciativas usando os dar_links das iniciativas.
 *
 * Estratégia alternativa (mais simples e com melhor cobertura):
 *   1. Lê ar_iniciativas.dar_links que têm paginaInicio/paginaFim.
 *   2. Para cada sessão DAR, usa indexarPaginasTranscricao para mapear _i → página.
 *   3. Liga todas as intervenções dentro do intervalo de páginas da iniciativa.
 *
 * Vantagens vs linkIntervencoesIniciativas:
 *   - Não precisa de Intervencoesdebates (que demora meses a ser populado no API)
 *   - Usa PublicacaoFase (disponível mais cedo) → melhor cobertura recente
 *   - Sem matching de nomes → sem erros de associação entre tópicos da mesma sessão
 *   - Cobre TODOS os oradores na discussão, não apenas os formalmente listados
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { indexarPaginasTranscricao } from './interventionParser.js';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const PAGE = 500;

export async function linkIntervencoesViaDarLinks(opts = {}) {
  const force = opts.force ?? process.argv.includes('--force');
  console.log('\n  [LINK-DAR] A ligar intervenções via dar_links + intervalos de página...');
  if (force) console.log('  [LINK-DAR] Modo --force: inclui intervenções já ligadas');

  // 1. Recolher todos os dar_links com paginaInicio de todas as iniciativas
  //    Estrutura: darId → [{ iniciativa_id, paginaInicio, paginaFim, fase }]
  const mapaLinks = new Map(); // darId → [{iniciativa_id, pInicio, pFim, fase}]
  let offset = 0;

  while (true) {
    const { data, error } = await db
      .from('ar_iniciativas')
      .select('id, dar_links')
      .not('dar_links', 'is', null)
      .range(offset, offset + PAGE - 1);

    if (error) { console.error('  ✗ Erro ao ler iniciativas:', error.message); break; }
    if (!data?.length) break;

    for (const ini of data) {
      for (const dl of ini.dar_links ?? []) {
        if (!dl.darId || dl.paginaInicio == null) continue;
        if (!mapaLinks.has(dl.darId)) mapaLinks.set(dl.darId, []);
        mapaLinks.get(dl.darId).push({
          iniciativa_id: String(ini.id),
          pInicio:       dl.paginaInicio,
          pFim:          dl.paginaFim ?? dl.paginaInicio,
          fase:          dl.fase ?? null,
        });
      }
    }

    if (data.length < PAGE) break;
    offset += PAGE;
  }

  console.log(`  [LINK-DAR] ${mapaLinks.size} sessões DAR com dar_links`);
  if (!mapaLinks.size) return { total: 0, inseridos: 0, erros: 0 };

  // 2. Carregar transcrições em batch
  const darIds = [...mapaLinks.keys()];
  const txMapa = new Map();
  const BATCH = 50;
  for (let i = 0; i < darIds.length; i += BATCH) {
    const { data } = await db
      .from('ar_debates')
      .select('id, transcricao')
      .in('id', darIds.slice(i, i + BATCH));
    for (const r of data ?? []) {
      if (r.transcricao) txMapa.set(r.id, r.transcricao);
    }
  }
  console.log(`  [LINK-DAR] Transcrições carregadas: ${txMapa.size}/${darIds.length}`);

  let ligadas = 0, semTx = 0, erros = 0;

  for (const [darId, links] of mapaLinks) {
    if (!txMapa.has(darId)) { semTx += links.length; continue; }

    // Mapa _i → página real no DAR
    const pgMap = indexarPaginasTranscricao(txMapa.get(darId));
    if (!pgMap.size) { semTx += links.length; continue; }

    // Carregar intervenções desta sessão
    let q = db.from('ar_intervencoes').select('id').eq('debate_id', darId);
    if (!force) q = q.is('iniciativa_id', null);
    const { data: ivs, error } = await q;

    if (error) { console.warn(`  ⚠ ${darId}: ${error.message}`); erros++; continue; }
    if (!ivs?.length) continue;

    // Ordenar links por página para processar em sequência sem sobreposições
    const linksOrdenados = [...links].sort((a, b) => a.pInicio - b.pInicio);

    // Associar cada intervenção à iniciativa cujo intervalo de páginas a contém.
    // Se uma intervenção está em [19, 34], fica ligada à iniciativa desse bloco.
    const updates = [];
    const usados = new Set();

    for (const iv of ivs) {
      const i = parseInt(iv.id.slice(iv.id.lastIndexOf('_') + 1), 10) || 0;
      const pg = pgMap.get(i);
      if (pg == null) continue;

      // Procurar o link cujo intervalo contém esta página
      for (const lk of linksOrdenados) {
        if (pg >= lk.pInicio && pg <= lk.pFim && !usados.has(iv.id)) {
          usados.add(iv.id);
          updates.push({
            id:            iv.id,
            iniciativa_id: lk.iniciativa_id,
            fase_debate:   lk.fase,
          });
          break;
        }
      }
    }

    if (!updates.length) continue;

    // Atualizar em paralelo
    const resultados = await Promise.all(
      updates.map(u =>
        db.from('ar_intervencoes')
          .update({ iniciativa_id: u.iniciativa_id, fase_debate: u.fase_debate })
          .eq('id', u.id)
      )
    );

    for (const r of resultados) {
      if (r.error) erros++;
      else ligadas++;
    }

    process.stdout.write(`  [LINK-DAR] ${ligadas} ligadas, ${semTx} sem transcrição, ${erros} erros\r`);
  }

  console.log(`\n  [LINK-DAR] Concluído — ${ligadas} ligadas, ${erros} erros`);
  return { total: ligadas, inseridos: ligadas, erros };
}

// Execução directa
if (process.argv[1]?.includes('linkIntervencoesDAR')) {
  const res = await linkIntervencoesViaDarLinks();
  console.log('\nFim.', res);
}
