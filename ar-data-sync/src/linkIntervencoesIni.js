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
import { indexarPaginasTranscricao } from './interventionParser.js';

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
                paginaInicio:  parsed.paginaInicio ?? null,
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

// Extrai o índice numérico do sufixo do id da intervenção (ordem real na sessão).
function ordemNaSessao(iv) {
  return parseInt(iv.id.slice(iv.id.lastIndexOf('_') + 1), 10) || 0;
}

export async function linkIntervencoesIniciativas(opts = {}) {
  // --force relinka intervenções já ligadas (útil para corrigir dados históricos)
  const force = opts.force ?? process.argv.includes('--force');

  console.log('\n  [LINK] A ligar intervenções → iniciativas (via Intervencoesdebates)...');
  if (force) console.log('  [LINK] Modo --force: a religar todas as intervenções');

  const { mapa, totalEntradas } = await construirMapa();
  console.log(`\n  [LINK] Mapa construído: ${mapa.size} debates, ${totalEntradas} entradas`);

  if (!mapa.size) {
    console.log('  [LINK] Nenhum debate com dados estruturados — a terminar.');
    return { total: 0, inseridos: 0, atualizados: 0, erros: 0 };
  }

  let ligadas = 0, semMatch = 0, erros = 0;

  // Pré-carregar as transcrições em batch para poder mapear _i → página.
  // Essencial para distinguir intervenções do mesmo deputado em tópicos diferentes
  // da mesma sessão DAR (ex: interjeição na pág 8 vs discurso principal na pág 24).
  const darIds = [...mapa.keys()];

  // Em modo force: limpar todos os links existentes antes de re-ligar do zero.
  // Sem esta limpeza, links antigos errados persistem mesmo após o re-link.
  if (force) {
    console.log('  [LINK] A limpar links existentes...');
    const BATCH_CLR = 50;
    for (let i = 0; i < darIds.length; i += BATCH_CLR) {
      await db.from('ar_intervencoes')
        .update({ iniciativa_id: null, id_cadastro: null, fase_debate: null })
        .in('debate_id', darIds.slice(i, i + BATCH_CLR));
    }
    console.log('  [LINK] Links limpos.');
  }
  const transcricoesMapa = new Map();
  const BATCH_TX = 50;
  for (let i = 0; i < darIds.length; i += BATCH_TX) {
    const { data: txRows } = await db
      .from('ar_debates')
      .select('id, transcricao')
      .in('id', darIds.slice(i, i + BATCH_TX));
    for (const r of txRows ?? []) {
      if (r.transcricao) transcricoesMapa.set(r.id, r.transcricao);
    }
  }
  console.log(`\n  [LINK] Transcrições carregadas: ${transcricoesMapa.size}/${darIds.length}`);

  for (const [darId, entradas] of mapa) {
    let q = db
      .from('ar_intervencoes')
      .select('id, nome_dep')
      .eq('debate_id', darId);
    if (!force) q = q.is('iniciativa_id', null);
    const { data: ivs, error } = await q;

    if (error) {
      console.warn(`  ⚠ Erro ao buscar intervenções de ${darId}: ${error.message}`);
      erros++;
      continue;
    }
    if (!ivs?.length) continue;

    // Ordenar intervenções pela ordem real da sessão (_i suffix no id)
    const ivsOrdenados = [...ivs].sort((a, b) => ordemNaSessao(a) - ordemNaSessao(b));

    // Mapa _i → página (construído a partir da transcrição)
    const paginaPorI = transcricoesMapa.has(darId)
      ? indexarPaginasTranscricao(transcricoesMapa.get(darId))
      : new Map();

    const paginaDeIv = iv => paginaPorI.get(ordemNaSessao(iv)) ?? null;

    const usados = new Set();
    const updates = [];

    // Ordenar entradas pela página onde o orador falou sobre a sua iniciativa
    const entradasOrdenadas = [...entradas].sort((a, b) => {
      if (a.paginaInicio == null && b.paginaInicio == null) return 0;
      if (a.paginaInicio == null) return 1;
      if (b.paginaInicio == null) return -1;
      return a.paginaInicio - b.paginaInicio;
    });

    for (const entrada of entradasOrdenadas) {
      // Candidatos: intervenções do mesmo deputado ainda não associadas
      const candidatos = ivsOrdenados.filter(
        iv => !usados.has(iv.id) && nomeMatch(iv.nome_dep, entrada.nome)
      );
      if (!candidatos.length) { semMatch++; continue; }

      let escolhido;
      if (entrada.paginaInicio != null && paginaPorI.size > 0) {
        // Escolher a intervenção cuja página está mais próxima da página do orador.
        // Isto evita associar interjeições de outros tópicos (pág. 8) ao discurso
        // principal desta iniciativa (pág. 24).
        const comDiff = candidatos.map(iv => ({
          iv,
          diff: Math.abs((paginaDeIv(iv) ?? entrada.paginaInicio) - entrada.paginaInicio),
        }));
        comDiff.sort((a, b) => a.diff - b.diff);
        escolhido = comDiff[0].iv;
      } else {
        // Fallback sem página: primeiro candidato na ordem da sessão
        escolhido = candidatos[0];
      }

      usados.add(escolhido.id);
      updates.push({
        id:            escolhido.id,
        iniciativa_id: entrada.iniciativa_id,
        id_cadastro:   entrada.idCadastro,
        fase_debate:   entrada.fase,
      });
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
