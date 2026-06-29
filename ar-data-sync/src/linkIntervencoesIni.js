/**
 * Liga ar_intervencoes às iniciativas usando os dados estruturados
 * ar_iniciativas.eventos[].Intervencoesdebates[].oradores[].deputadosOradores[].
 *
 * Estratégia:
 *   1. Percorre todos os eventos de cada iniciativa e extrai, por sessão DAR
 *      (darId), a lista de oradores com o seu idCadastro.
 *   2. Para cada sessão DAR com dados estruturados, carrega as intervenções
 *      correspondentes em ar_intervencoes e faz a ligação por nome parlamentar.
 *   3. Actualiza iniciativa_id, id_cadastro e fase_debate nos registos ligados.
 *
 * Cobertura esperada: ~60-80% das intervenções (as que têm entrada formal nos
 * eventos da iniciativa; interjeiçoes e perguntas curtas ficam sem link).
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { parsearUrlDar } from './linkDarIniciativas.js';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const PAGE = 500;

/**
 * Compara dois nomes parlamentares: correspondem se o primeiro e o último
 * token forem iguais (cobre abreviações tipo "Ana Rita Fonseca" ↔ "Ana Fonseca").
 * Sem distinção de maiúsculas nem acentos.
 */
function nomeMatch(a, b) {
  if (!a || !b) return false;
  const norm = s => s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .trim();
  const an = norm(a), bn = norm(b);
  if (an === bn) return true;
  const wa = an.split(/\s+/), wb = bn.split(/\s+/);
  if (wa.length < 2 || wb.length < 2) return false;
  return wa[0] === wb[0] && wa[wa.length - 1] === wb[wb.length - 1];
}

/**
 * Constrói o mapa debateId → [{nome, idCadastro, iniciativa_id, fase}]
 * lendo ar_iniciativas.eventos.
 */
async function construirMapa() {
  // map: darId → [{nome, idCadastro, iniciativa_id, fase}]
  const mapa = new Map();
  let offset = 0, totalEntradas = 0;

  while (true) {
    const { data, error } = await db
      .from('ar_iniciativas')
      .select('id, eventos')
      .not('eventos', 'is', null)
      .range(offset, offset + PAGE - 1);

    if (error) { console.error('  ✗ Erro ao ler iniciativas:', error.message); break; }
    if (!data?.length) break;

    for (const ini of data) {
      for (const evt of ini.eventos ?? []) {
        for (const debateBloco of evt.Intervencoesdebates ?? []) {
          for (const orador of debateBloco.oradores ?? []) {
            // URL específico do orador (tem as suas páginas exactas no DAR)
            const urlDiario = orador.publicacao?.[0]?.URLDiario;
            const parsed = parsearUrlDar(urlDiario);
            if (!parsed?.darId) continue;

            const { darId } = parsed;
            if (!mapa.has(darId)) mapa.set(darId, []);

            for (const dep of orador.deputadosOradores ?? []) {
              if (!dep.nome || !dep.idCadastro) continue;
              mapa.get(darId).push({
                nome:          dep.nome,
                idCadastro:    String(dep.idCadastro),
                iniciativa_id: String(ini.id),
                fase:          evt.Fase ?? null,
              });
              totalEntradas++;
            }
          }
        }
      }
    }

    process.stdout.write(`  [LINK] Mapa: ${mapa.size} debates, ${totalEntradas} entradas\r`);
    if (data.length < PAGE) break;
    offset += PAGE;
  }

  return { mapa, totalEntradas };
}

export async function linkIntervencoesIniciativas() {
  console.log('\n  [LINK] A ligar intervenções → iniciativas (via Intervencoesdebates)...');

  const { mapa, totalEntradas } = await construirMapa();
  console.log(`\n  [LINK] Mapa construído: ${mapa.size} debates, ${totalEntradas} entradas`);

  if (!mapa.size) {
    console.log('  [LINK] Nenhum debate com dados estruturados — a terminar.');
    return { total: 0, inseridos: 0, atualizados: 0, erros: 0 };
  }

  let ligadas = 0, semMatch = 0, erros = 0;

  for (const [darId, entradas] of mapa) {
    // Buscar apenas as intervenções ainda não ligadas para este debate
    const { data: ivs, error } = await db
      .from('ar_intervencoes')
      .select('id, nome_dep')
      .eq('debate_id', darId)
      .is('iniciativa_id', null);

    if (error) {
      console.warn(`  ⚠ Erro ao buscar intervenções de ${darId}: ${error.message}`);
      erros++;
      continue;
    }
    if (!ivs?.length) continue;

    // Associar cada intervenção à primeira entrada com nome correspondente
    const updates = [];
    for (const iv of ivs) {
      const entrada = entradas.find(e => nomeMatch(iv.nome_dep, e.nome));
      if (entrada) {
        updates.push({
          id:            iv.id,
          iniciativa_id: entrada.iniciativa_id,
          id_cadastro:   entrada.idCadastro,
          fase_debate:   entrada.fase,
        });
      } else {
        semMatch++;
      }
    }

    if (!updates.length) continue;

    // Actualizar em paralelo (todos os registos do mesmo debate de uma vez)
    const resultados = await Promise.all(
      updates.map(u =>
        db.from('ar_intervencoes')
          .update({
            iniciativa_id: u.iniciativa_id,
            id_cadastro:   u.id_cadastro,
            fase_debate:   u.fase_debate,
          })
          .eq('id', u.id)
      )
    );

    for (const r of resultados) {
      if (r.error) erros++;
      else ligadas++;
    }

    process.stdout.write(`  [LINK] ${ligadas} ligadas, ${semMatch} sem match, ${erros} erros\r`);
  }

  console.log(`\n  [LINK] Concluído — ${ligadas} ligadas, ${semMatch} sem match estruturado, ${erros} erros`);
  return { total: ligadas + semMatch, inseridos: ligadas, atualizados: 0, erros };
}

// Execução directa
if (process.argv[1]?.includes('linkIntervencoesIni')) {
  const res = await linkIntervencoesIniciativas();
  console.log('\nFim.', res);
}
