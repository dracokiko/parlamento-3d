/**
 * O Diário da Assembleia da República, lido a partir do computador do
 * projecto.
 *
 * Desde 30/09/2026 o debates.parlamento.pt recusa os pedidos que vêm dos
 * servidores do GitHub (HTTP 403); os mesmos pedidos, feitos de outra rede,
 * passam. Enquanto a AR não responder ao pedido que lhe fizemos — e onde
 * dissemos que, entretanto, a leitura seria feita a partir de um computador
 * nosso —, os passos do Diário correm aqui, numa tarefa agendada do Windows,
 * e o workflow do GitHub salta-os (DIARIO_FORA_DO_GITHUB). Se a AR pedir que
 * paremos, desliga-se a tarefa no mesmo dia.
 *
 * Os mesmos passos, as mesmas regras (robots.txt, 20 s entre pedidos, o nosso
 * nome) e o mesmo trinco do pipeline. O resultado aparece no painel como um
 * trabalho próprio, `dar-local`.
 *
 * Correr: node src/darLocal.js   (com cwd = ar-data-sync, para ler o .env)
 */

import os from 'node:os';
import { acquireSyncLock, releaseSyncLock, registarLog, registarSyncStatus } from './database.js';
import { sincronizarCatalogoDAR } from './catalogueCrawler.js';
import { obterTranscricoesDebates, resumirDebates, indexarIntervencoes } from './summarizer.js';
import { linkIntervencoesIniciativas } from './linkIntervencoesIni.js';
import { linkIntervencoesViaDarLinks } from './linkIntervencoesDAR.js';
import { syncDarLinks } from './linkDarIniciativas.js';
import { gerarDestaques } from './destaques.js';
import { juntarAmostra } from './resumoPublico.js';

const JOB = 'dar-local';

/**
 * Quanto se espera pelo trinco. A corrida do GitHub pode estar a decorrer à
 * hora da tarefa (corre entre as 9h e as 11h de Lisboa, conforme o atraso do
 * cron); em vez de desistir e perder o dia, espera-se que acabe.
 */
const ESPERA_TRINCO_MS = 100 * 60_000;
const PASSO_TRINCO_MS = 2 * 60_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const host = `${JOB}@${os.hostname()}`;

async function obterTrinco() {
  const limite = Date.now() + ESPERA_TRINCO_MS;
  for (;;) {
    const t = await acquireSyncLock(host);
    if (t.acquired) return true;
    if (Date.now() > limite) {
      console.log(`⏭  O trinco continua ocupado (${t.host}, desde ${t.since}) — fica para a próxima.`);
      return false;
    }
    console.log(`  … sincronização em curso (${t.host}) — nova tentativa em ${PASSO_TRINCO_MS / 60_000} min`);
    await sleep(PASSO_TRINCO_MS);
  }
}

async function main() {
  console.log(`\n${new Date().toISOString()}  Diário da AR — a partir de ${os.hostname()}`);
  if (!(await obterTrinco())) return;

  const resumo = [];
  const avisos = [];
  let motivo = null;

  // O mesmo formato do pipeline (sync.js): o painel lê-o igual.
  const log = async (recurso, stats) => {
    const falhas = stats.falhas?.length ? stats.falhas : (!stats.sucesso && motivo) ? [{ motivo }] : [];
    motivo = null;
    await registarLog(recurso, { ...stats, falhas });
    const cap = (itens) => { const c = []; juntarAmostra(c, itens ?? []); return c; };
    resumo.push({
      recurso,
      sucesso:     stats.sucesso,
      total:       stats.total ?? 0,
      inseridos:   stats.inseridos ?? 0,
      atualizados: stats.atualizados ?? 0,
      erros:       stats.erros ?? 0,
      syncedAt:    new Date().toISOString(),
      ...(stats.novos?.length ? { novos: cap(stats.novos) } : {}),
      ...(falhas.length ? { falhas: cap(falhas) } : {}),
      ...(stats.info?.length ? { info: stats.info } : {}),
    });
  };
  const passo = async (nome, fn) => {
    try { return await fn(); }
    catch (err) { motivo = err.message; console.warn(`\n  ⚠ ${nome} falhou (${err.message})`); avisos.push(nome); return null; }
  };

  try {
    // 1. Catálogo: o que a AR publicou desde a última vez, e os buracos.
    const dar = await passo('dar', sincronizarCatalogoDAR);
    await log('dar', dar ?? { sucesso: false, total: 0, inseridos: 0, atualizados: 0, erros: 1, detalhes: [], novos: [], falhas: [] });

    // 2. Transcrições de debates que a API da AR já anuncia mas ainda não têm texto.
    const transc = await passo('transcricoes', obterTranscricoesDebates);
    await log('transcricoes', {
      sucesso: transc !== null, total: transc?.total ?? 0, inseridos: transc?.inseridos ?? 0, atualizados: 0,
      erros: transc?.erros ?? (transc === null ? 1 : 0), detalhes: [], novos: transc?.novos ?? [], falhas: transc?.falhas ?? [],
    });

    // 3. O que depende do texto novo — só quando chegou algum. Num dia sem
    //    Diário novo não há nada para indexar nem razão para gastar a IA.
    const chegouTexto = (dar?.inseridos ?? 0) + (transc?.inseridos ?? 0) > 0;
    if (chegouTexto) {
      await passo('resumirDebates', resumirDebates);
      const ind = await passo('indexarIntervencoes', indexarIntervencoes);
      // Nome próprio no painel: a corrida do GitHub também regista
      // "intervencoes", e aqui são as que vieram dos Diários de hoje.
      await log('intervencoes_diario', {
        sucesso: ind !== null, total: ind?.total ?? 0, inseridos: ind?.inseridos ?? 0, atualizados: 0,
        erros: ind?.erros ?? (ind === null ? 1 : 0), detalhes: [], novos: ind?.novos ?? [], falhas: ind?.falhas ?? [],
      });
      await passo('linkIntervencoesIniciativas', linkIntervencoesIniciativas);
      await passo('linkIntervencoesViaDarLinks', linkIntervencoesViaDarLinks);
    }

    // 4. Ligações DAR ↔ iniciativas (também lê o catálogo).
    const links = await passo('dar_links', syncDarLinks);
    const linksOk = links?.ok ?? links !== null;
    await log('dar_links', {
      sucesso: linksOk, total: links?.total ?? 0, inseridos: links?.inseridos ?? 0, atualizados: links?.atualizados ?? 0,
      erros: links === null ? 1 : (links?.erros ?? 0), detalhes: links?.detalhes ?? [], novos: links?.detalhes ?? [], falhas: links?.falhas ?? [],
    });
    if (!linksOk && !avisos.includes('dar_links')) avisos.push('dar_links');

    // 5. Com Diário novo, os destaques refazem-se já — a sessão de ontem pode
    //    ser a história de hoje. Os da corrida do GitHub ficam para trás.
    if (chegouTexto) await passo('destaques', () => gerarDestaques());

    const ok = avisos.length === 0;
    await registarSyncStatus(JOB, {
      status: ok ? 'ok' : 'error',
      message: ok
        ? (chegouTexto ? `Diário novo lido a partir de ${os.hostname()}` : `Nada de novo no Diário — lido a partir de ${os.hostname()}`)
        : `Avisos: ${[...new Set(avisos)].join(', ')}`,
      summary: resumo,
    });
    console.log(`\n${ok ? '✓' : '⚠'} ${new Date().toISOString()}  ${ok ? 'concluído' : `concluído com avisos: ${avisos.join(', ')}`}`);
    if (!ok) process.exitCode = 1;
  } finally {
    await releaseSyncLock();
  }
}

main().catch((err) => {
  console.error('Erro fatal:', err);
  process.exitCode = 1;
});
