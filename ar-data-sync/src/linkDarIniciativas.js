/**
 * Extrai os links DAR de ar_iniciativas.eventos e:
 *   1. Preenche ar_iniciativas.dar_links (por iniciativa)
 *   2. Preenche ar_debates.iniciativa_ids (por sessão DAR)
 *
 * Formato de dar_links:
 *   [{ fase, codigoFase, data, darId, darNr, darData, paginaInicio, paginaFim, url }]
 *
 * Uso: node src/linkDarIniciativas.js
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { LEGISLATURA, LEGISLATURA_NUM, DAR_SERIE } from './config.js';
import { descobrirSessaoAtual } from './catalogueCrawler.js';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const PAGE = 500;

// O segmento de sessão legislativa (3º \d+) não é fixado aqui — os URLs
// URLDiario vêm da API oficial e podem referenciar qualquer sessão da
// legislatura corrente, por isso o regex aceita qualquer número.
const RE_DAR_URL = new RegExp(`dar/${DAR_SERIE}/${LEGISLATURA_NUM}/\\d+/(\\d+)/(\\d{4}-\\d{2}-\\d{2})(?:/(\\d+))?(?:\\?pgs=(\\d+)(?:-(\\d+))?)?`);

/** Extrai dar_id e páginas de um URLDiario do AR. */
export function parsearUrlDar(url) {
  if (!url) return null;
  const m = url.match(RE_DAR_URL);
  if (!m) return null;
  const darNr   = m[1];
  const darData = m[2];
  const pInicio = m[4] ? parseInt(m[4], 10) : (m[3] ? parseInt(m[3], 10) : null);
  const pFim    = m[5] ? parseInt(m[5], 10) : pInicio;
  return {
    darId:        `dar_${darNr}_${darData}`,
    darNr,
    darData,
    paginaInicio: pInicio,
    paginaFim:    pFim,
  };
}

/** Extrai dar_links de uma iniciativa a partir de eventos. */
export function extrairDarLinks(eventos) {
  if (!Array.isArray(eventos)) return [];
  const links = [];
  const vistos = new Set();

  for (const e of eventos) {
    const pubs = Array.isArray(e.PublicacaoFase) ? e.PublicacaoFase : [];
    for (const pub of pubs) {
      if (!pub.URLDiario) continue;
      const dar = parsearUrlDar(pub.URLDiario);
      if (!dar) continue;
      const chave = `${dar.darId}_${dar.paginaInicio}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      links.push({
        fase:        e.Fase        ?? null,
        codigoFase:  e.CodigoFase  ?? null,
        data:        e.DataFase    ?? null,
        darId:       dar.darId,
        darNr:       dar.darNr,
        darData:     dar.darData,
        paginaInicio: dar.paginaInicio,
        paginaFim:    dar.paginaFim,
        url:         pub.URLDiario,
      });
    }
  }

  return links;
}

export async function syncDarLinks() {
  return run();
}

const MAX_DETALHES = 200;

async function run() {
  console.log('\n' + '='.repeat(55));
  console.log('  LINK DAR ↔ INICIATIVAS');
  console.log('='.repeat(55));

  const sessaoLeg = await descobrirSessaoAtual();

  let offset = 0;
  let totalInis = 0, novos = 0, atualizados = 0, totalLinks = 0;
  const detalhes = [];

  // Mapa: darId → Set de iniciativa_ids
  const darMap = new Map();

  while (true) {
    const { data, error } = await db
      .from('ar_iniciativas')
      .select('id, numero, tipo, titulo, eventos, dar_links')
      .not('eventos', 'is', null)
      .range(offset, offset + PAGE - 1);

    if (error) { console.error('Erro:', error.message); break; }
    if (!data?.length) break;

    const batch = [];
    for (const ini of data) {
      totalInis++;
      const links = extrairDarLinks(ini.eventos);
      if (!links.length) continue;

      const eraNovo = !ini.dar_links || ini.dar_links.length === 0;
      if (eraNovo) {
        novos++;
        if (detalhes.length < MAX_DETALHES) {
          const ref = [ini.tipo, ini.numero].filter(Boolean).join(' ');
          detalhes.push({ label: `${ref}${ini.titulo ? ' · ' + ini.titulo.slice(0, 80) : ''} (${links.length} debate${links.length !== 1 ? 's' : ''})` });
        }
      } else {
        atualizados++;
      }

      totalLinks += links.length;
      batch.push({ id: ini.id, dar_links: links });

      for (const lnk of links) {
        if (!darMap.has(lnk.darId)) darMap.set(lnk.darId, new Set());
        darMap.get(lnk.darId).add(ini.id);
      }
    }

    // Actualizar dar_links nas iniciativas
    for (const { id, dar_links } of batch) {
      await db.from('ar_iniciativas').update({ dar_links }).eq('id', id);
    }

    process.stdout.write(`  … ${totalInis} iniciativas | ${novos} novas | ${atualizados} actualizadas | ${totalLinks} links\r`);

    if (data.length < PAGE) break;
    offset += PAGE;
  }

  console.log(`\n  ✓ Iniciativas processadas : ${totalInis}`);
  console.log(`  ✓ Novas ligações          : ${novos}`);
  console.log(`  ✓ Actualizadas            : ${atualizados}`);
  console.log(`  ✓ Total links             : ${totalLinks}`);
  console.log(`  ✓ DAR únicos referenciados: ${darMap.size}`);

  // Actualizar ar_debates.iniciativa_ids
  console.log('\n  A actualizar ar_debates.iniciativa_ids...');
  let debs = 0, debs_novos = 0;
  for (const [darId, ids] of darMap) {
    debs++;
    const iniciativa_ids = [...ids];

    // Fazer upsert (o debate pode ainda não existir — será criado pelo crawler)
    const { data: existing } = await db
      .from('ar_debates')
      .select('id, iniciativa_ids')
      .eq('id', darId)
      .single();

    if (existing) {
      // Merge com ids já existentes
      const existingIds = new Set(existing.iniciativa_ids ?? []);
      for (const id of iniciativa_ids) existingIds.add(id);
      await db.from('ar_debates').update({ iniciativa_ids: [...existingIds] }).eq('id', darId);
    } else {
      // Criar registo placeholder para o DAR (o crawler vai preenchê-lo com a transcrição)
      const m = darId.match(/^dar_(\d+)_(\d{4}-\d{2}-\d{2})$/);
      await db.from('ar_debates').upsert({
        id:             darId,
        data_debate:    m?.[2] ?? null,
        sessao:         sessaoLeg,
        legislatura:    LEGISLATURA,
        iniciativa_ids,
      }, { onConflict: 'id' });
      debs_novos++;
    }
  }

  console.log(`  ✓ ar_debates actualizados : ${debs} (${debs_novos} novos placeholders)`);
  console.log('\nFim.');
  return { ok: true, total: totalInis, inseridos: novos, atualizados, erros: 0, detalhes };
}

// Execução directa
if (process.argv[1]?.includes('linkDarIniciativas')) {
  run();
}
