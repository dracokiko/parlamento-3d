import fs from 'fs';
import { AR_ENDPOINTS, BATCH_SIZE } from './config.js';
import { downloadToTemp, streamRecords } from './downloader.js';
import { NORMALIZADORES } from './processor.js';
import { upsertBatch, registarLog, acquireSyncLock, releaseSyncLock } from './database.js';
import { resumirIniciativas, resumirDeputados, resumirDebates, resumirVotacoes, obterTranscricoesDebates, indexarIntervencoes, classificarTemas } from './summarizer.js';
import { crawlerDebatesDAR } from './catalogueCrawler.js';
import { syncVotacoes } from './votacoesSync.js';
import { syncDarLinks } from './linkDarIniciativas.js';
import { crawlerPresencas } from './presencasCrawler.js';
import { crawlerBiografias } from './biografiasCrawler.js';
import { linkIntervencoesIniciativas } from './linkIntervencoesIni.js';
import { linkIntervencoesViaDarLinks } from './linkIntervencoesDAR.js';

const MAX_AMOSTRAS = 500;

function labelItem(recurso, reg) {
  switch (recurso) {
    case 'iniciativas':
      return { id: reg.id, label: `${reg.numero || reg.id} — ${(reg.epigrafe || reg.titulo || '').slice(0, 90)}` };
    case 'deputados':
      return { id: reg.id, label: `${reg.nome_parlamentar || reg.nome_completo || reg.id} (${reg.partido_sigla || '?'})` };
    case 'debates':
      return { id: reg.id, label: `${(reg.assunto || reg.artigo || reg.id || '').slice(0, 90)}` };
    default:
      return { id: reg.id, label: String(reg.id).slice(0, 80) };
  }
}

async function sincronizar(recurso) {
  const { url, path: nestedKey } = AR_ENDPOINTS[recurso];
  const normalizar = NORMALIZADORES[recurso];
  const inicio = Date.now();

  console.log(`\n${'='.repeat(55)}`);
  console.log(`  RECURSO : ${recurso.toUpperCase()}`);
  console.log('='.repeat(55));

  let tmpPath;
  try {
    tmpPath = await downloadToTemp(url);
  } catch (err) {
    console.error(`  ✗ Falha no download: ${err.message}`);
    await registarLog(recurso, { sucesso: false, total: 0, inseridos: 0, atualizados: 0, erros: 1, detalhes: [] });
    return false;
  }

  let batch = [], total = 0, inseridos = 0, atualizados = 0, erros = 0;
  const amostras = [];

  try {
    for await (const raw of streamRecords(tmpPath, nestedKey)) {
      try {
        const reg = normalizar(raw);
        if (!reg) { erros++; continue; }
        batch.push(reg);
        total++;

        if (batch.length >= BATCH_SIZE) {
          const r = await upsertBatch(recurso, batch);
          inseridos   += r.inseridos;
          atualizados += r.atualizados;
          if (amostras.length < MAX_AMOSTRAS) {
            r.novos.slice(0, MAX_AMOSTRAS - amostras.length).forEach(reg => {
              amostras.push(labelItem(recurso, reg));
            });
          }
          batch = [];
          process.stdout.write(`  … ${total} processados\r`);
        }
      } catch (err) {
        erros++;
        if (erros <= 5) console.warn(`\n  ⚠ ${err.message}`);
      }
    }

    if (batch.length) {
      const r = await upsertBatch(recurso, batch);
      inseridos   += r.inseridos;
      atualizados += r.atualizados;
      if (amostras.length < MAX_AMOSTRAS) {
        r.novos.slice(0, MAX_AMOSTRAS - amostras.length).forEach(reg => {
          amostras.push(labelItem(recurso, reg));
        });
      }
    }

    await registarLog(recurso, { sucesso: true, total, inseridos, atualizados, erros, detalhes: amostras });
    const s = ((Date.now() - inicio) / 1000).toFixed(1);
    console.log(`\n  ✓ ${s}s | Total: ${total} | Inseridos: ${inseridos} | Atualizados: ${atualizados} | Erros: ${erros}`);
    return { ok: true, inseridos };

  } catch (err) {
    console.error(`\n  ✗ Erro fatal: ${err.message}`);
    await registarLog(recurso, { sucesso: false, total, inseridos, atualizados, erros: erros + 1, detalhes: amostras });
    return { ok: false, inseridos: 0 };
  } finally {
    try { fs.unlinkSync(tmpPath); } catch {}
  }
}

async function main() {
  const args  = process.argv.slice(2);
  const alvos = args.length ? args : Object.keys(AR_ENDPOINTS);
  const falhas = [];
  const avisos = [];

  // 1. Sincronizar todos os recursos
  const resultados = {};
  for (const r of alvos) {
    if (!AR_ENDPOINTS[r]) {
      console.error(`Recurso desconhecido: "${r}". Opções: ${Object.keys(AR_ENDPOINTS).join(', ')}`);
      process.exitCode = 1;
      return;
    }
    const res = await sincronizar(r);
    resultados[r] = res;
    if (!res.ok) falhas.push(r);
  }

  // 2. Fase IA + scraping
  console.log(`\n${'='.repeat(55)}`);
  console.log('  FASE IA — RESUMOS AUTOMÁTICOS');
  console.log('='.repeat(55));

  // Resumos IA (acumula iniciativas + deputados + debates num único log)
  let aiTotal = 0, aiInseridos = 0, aiErros = 0;
  const acumularAi = r => { aiTotal += r?.total ?? 0; aiInseridos += r?.inseridos ?? 0; aiErros += r?.erros ?? 0; };

  try { if (resultados.iniciativas?.ok) acumularAi(await resumirIniciativas()); }
  catch (err) { console.warn(`\n  ⚠ resumirIniciativas falhou (${err.message})`); avisos.push('resumirIniciativas'); }

  // Classificação temática (corre após resumirIniciativas para garantir que temas novos são processados)
  let rTemas = null;
  try { rTemas = await classificarTemas(); }
  catch (err) { console.warn(`\n  ⚠ classificarTemas falhou (${err.message})`); avisos.push('classificarTemas'); }
  const temasOk = rTemas !== null && (rTemas?.erros ?? 0) >= 0;
  await registarLog('temas', {
    sucesso:     temasOk,
    total:       rTemas?.total       ?? 0,
    inseridos:   rTemas?.inseridos   ?? 0,
    atualizados: 0,
    erros:       rTemas === null || (rTemas?.erros ?? 0) < 0 ? 1 : (rTemas?.erros ?? 0),
    detalhes:    rTemas?.detalhes    ?? [],
  });
  if (!temasOk) avisos.push('temas');

  try { if (resultados.deputados?.ok) acumularAi(await resumirDeputados()); }
  catch (err) { console.warn(`\n  ⚠ resumirDeputados falhou (${err.message})`); avisos.push('resumirDeputados'); }

  // Catálogo DAR
  let rDar = null;
  try { rDar = await crawlerDebatesDAR(); }
  catch (err) { console.warn(`\n  ⚠ Crawler DAR falhou (${err.message})`); avisos.push('crawlerDebatesDAR'); }
  await registarLog('dar', {
    sucesso: rDar !== null,
    total:       (rDar?.novos ?? 0) + (rDar?.erros ?? 0),
    inseridos:    rDar?.novos  ?? 0,
    atualizados:  0,
    erros:        rDar?.erros  ?? (rDar === null ? 1 : 0),
    detalhes:    [],
  });
  if (!(rDar !== null)) avisos.push('dar');

  // Transcrições (scraping DAR PDF)
  let rTransc = null;
  try { rTransc = await obterTranscricoesDebates(); }
  catch (err) { console.warn(`\n  ⚠ obterTranscricoesDebates falhou (${err.message})`); avisos.push('obterTranscricoesDebates'); }
  await registarLog('transcricoes', {
    sucesso: rTransc !== null, total: rTransc?.total ?? 0, inseridos: rTransc?.inseridos ?? 0,
    atualizados: 0, erros: rTransc?.erros ?? (rTransc === null ? 1 : 0), detalhes: [],
  });
  if (!(rTransc !== null)) avisos.push('transcricoes');

  // Resumos IA debates + log combinado
  try { acumularAi(await resumirDebates()); }
  catch (err) { console.warn(`\n  ⚠ resumirDebates falhou (${err.message})`); avisos.push('resumirDebates'); }
  await registarLog('resumos_ia', {
    sucesso: aiErros === 0, total: aiTotal, inseridos: aiInseridos, atualizados: 0, erros: aiErros, detalhes: [],
  });
  if (!(aiErros === 0)) avisos.push('resumos_ia');

  // Intervenções (indexação a partir do texto PDF)
  let rInt = null;
  try { rInt = await indexarIntervencoes(); }
  catch (err) { console.warn(`\n  ⚠ indexarIntervencoes falhou (${err.message})`); avisos.push('indexarIntervencoes'); }
  await registarLog('intervencoes', {
    sucesso: rInt !== null, total: rInt?.total ?? 0, inseridos: rInt?.inseridos ?? 0,
    atualizados: 0, erros: rInt?.erros ?? (rInt === null ? 1 : 0), detalhes: [],
  });
  if (!(rInt !== null)) avisos.push('intervencoes');

  // Ligação intervenções → iniciativas (via Intervencoesdebates estruturado)
  let rIntLink = null;
  try { rIntLink = await linkIntervencoesIniciativas(); }
  catch (err) { console.warn(`\n  ⚠ linkIntervencoesIniciativas falhou (${err.message})`); avisos.push('linkIntervencoesIniciativas'); }
  await registarLog('intervencoes_links', {
    sucesso:     rIntLink !== null,
    total:       rIntLink?.total     ?? 0,
    inseridos:   rIntLink?.inseridos ?? 0,
    atualizados: 0,
    erros:       rIntLink === null ? 1 : (rIntLink?.erros ?? 0),
    detalhes:    [],
  });
  if (!(rIntLink !== null)) avisos.push('intervencoes_links');

  // Ligação complementar via dar_links + intervalos de página (cobre sessões recentes
  // onde Intervencoesdebates ainda não foi populado pelo API da AR)
  let rIntLinkDar = null;
  try { rIntLinkDar = await linkIntervencoesViaDarLinks(); }
  catch (err) { console.warn(`\n  ⚠ linkIntervencoesViaDarLinks falhou (${err.message})`); avisos.push('linkIntervencoesViaDarLinks'); }
  await registarLog('intervencoes_links_dar', {
    sucesso:     rIntLinkDar !== null,
    total:       rIntLinkDar?.total     ?? 0,
    inseridos:   rIntLinkDar?.inseridos ?? 0,
    atualizados: 0,
    erros:       rIntLinkDar === null ? 1 : (rIntLinkDar?.erros ?? 0),
    detalhes:    [],
  });
  if (!(rIntLinkDar !== null)) avisos.push('intervencoes_links_dar');

  // Votações (extracção + resumos IA) + deputados divergentes + dar_links
  if (resultados.iniciativas?.ok) {
    let rVot = null;
    try { rVot = await syncVotacoes(); }
    catch (err) { console.warn(`\n  ⚠ syncVotacoes falhou (${err.message})`); avisos.push('syncVotacoes'); }
    const votacoesSucesso = rVot?.ok ?? rVot !== null;
    await registarLog('votacoes', {
      sucesso: votacoesSucesso, total: rVot?.total ?? 0, inseridos: rVot?.total ?? 0,
      atualizados: 0, erros: rVot === null ? 1 : 0, detalhes: [],
    });
    if (!votacoesSucesso) avisos.push('votacoes');

    // Deputados divergentes — log separado com contagem
    await registarLog('deputados_divergentes', {
      sucesso: rVot !== null,
      total:       rVot?.comDivergentes ?? 0,
      inseridos:   rVot?.comDivergentes ?? 0,
      atualizados: 0,
      erros:       rVot === null ? 1 : 0,
      detalhes:    [],
    });
    if (!(rVot !== null)) avisos.push('deputados_divergentes');

    // Ligação DAR ↔ Iniciativas
    let rDarLinks = null;
    try { rDarLinks = await syncDarLinks(); }
    catch (err) { console.warn(`\n  ⚠ syncDarLinks falhou (${err.message})`); avisos.push('syncDarLinks'); }
    const darLinksSucesso = rDarLinks?.ok ?? rDarLinks !== null;
    await registarLog('dar_links', {
      sucesso:     darLinksSucesso,
      total:       rDarLinks?.total       ?? 0,
      inseridos:   rDarLinks?.inseridos   ?? 0,
      atualizados: rDarLinks?.atualizados ?? 0,
      erros:       rDarLinks === null ? 1 : 0,
      detalhes:    rDarLinks?.detalhes ?? [],
    });
    if (!darLinksSucesso) avisos.push('dar_links');

    let rVotAi = null;
    try { rVotAi = await resumirVotacoes(); }
    catch (err) { console.warn(`\n  ⚠ resumirVotacoes falhou (${err.message})`); avisos.push('resumirVotacoes'); }
    acumularAi(rVotAi);
  }

  // Biografias (scraping parlamento.pt)
  let rBio = null;
  try { rBio = await crawlerBiografias(); }
  catch (err) { console.warn(`\n  ⚠ crawlerBiografias falhou (${err.message})`); avisos.push('crawlerBiografias'); }
  await registarLog('biografias', {
    sucesso: rBio !== null, total: rBio?.total ?? 0, inseridos: rBio?.inseridos ?? 0,
    atualizados: 0, erros: rBio?.erros ?? (rBio === null ? 1 : 0), detalhes: [],
  });
  if (!(rBio !== null)) avisos.push('biografias');

  // Presenças (scraping parlamento.pt)
  let rPresencas = null;
  try { rPresencas = await crawlerPresencas(); }
  catch (err) { console.warn(`\n  ⚠ crawlerPresencas falhou (${err.message})`); avisos.push('crawlerPresencas'); }
  await registarLog('presencas', {
    sucesso: rPresencas !== null, total: rPresencas?.total ?? 0, inseridos: rPresencas?.inseridos ?? 0,
    atualizados: 0, erros: rPresencas?.erros ?? (rPresencas === null ? 1 : 0), detalhes: [],
  });
  if (!(rPresencas !== null)) avisos.push('presencas');

  // 3. Resultado final
  console.log(`\n${'='.repeat(55)}`);
  const avisosUnicos = [...new Set(avisos)];
  if (falhas.length) {
    console.error(`  FALHAS NA SINCRONIZAÇÃO: ${falhas.join(', ')}`);
    process.exitCode = 1;
  } else if (avisosUnicos.length) {
    console.error(`  PIPELINE CONCLUÍDO COM AVISOS: ${avisosUnicos.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('  PIPELINE COMPLETO ✓  (dados + resumos IA guardados)');
  }
}

async function run() {
  const lock = await acquireSyncLock();
  if (!lock.acquired) {
    console.log(`⏭  Sync já em curso desde ${lock.since} (${lock.host}) — a saltar esta execução.`);
    return;
  }
  try {
    await main();
  } finally {
    await releaseSyncLock();
  }
}

run().catch(err => {
  console.error('Erro fatal no pipeline:', err);
  process.exitCode = 1;
});
