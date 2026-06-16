import fs from 'fs';
import { AR_ENDPOINTS, BATCH_SIZE } from './config.js';
import { downloadToTemp, streamRecords } from './downloader.js';
import { NORMALIZADORES } from './processor.js';
import { upsertBatch, registarLog } from './database.js';
import { resumirIniciativas, resumirDeputados, resumirDebates, obterTranscricoesDebates, indexarIntervencoes } from './summarizer.js';
import { crawlerDebatesDAR } from './catalogueCrawler.js';
import { syncVotacoes } from './votacoesSync.js';
import { crawlerPresencas } from './presencasCrawler.js';
import { crawlerBiografias } from './biografiasCrawler.js';

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

  // 1. Sincronizar todos os recursos
  const resultados = {};
  for (const r of alvos) {
    if (!AR_ENDPOINTS[r]) {
      console.error(`Recurso desconhecido: "${r}". Opções: ${Object.keys(AR_ENDPOINTS).join(', ')}`);
      process.exit(1);
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

  if (resultados.iniciativas?.ok) acumularAi(await resumirIniciativas());
  if (resultados.deputados?.ok)   acumularAi(await resumirDeputados());

  // Catálogo DAR
  let rDar = null;
  try {
    rDar = await crawlerDebatesDAR();
  } catch (err) {
    console.warn(`\n  ⚠ Crawler DAR falhou (${err.message}) — a continuar pipeline`);
  }
  await registarLog('dar', {
    sucesso: rDar !== null,
    total:       (rDar?.novos ?? 0) + (rDar?.erros ?? 0),
    inseridos:    rDar?.novos  ?? 0,
    atualizados:  0,
    erros:        rDar?.erros  ?? (rDar === null ? 1 : 0),
    detalhes:    [],
  });

  // Transcrições (scraping DAR PDF)
  const rTransc = await obterTranscricoesDebates();
  await registarLog('transcricoes', {
    sucesso: true, total: rTransc?.total ?? 0, inseridos: rTransc?.inseridos ?? 0,
    atualizados: 0, erros: rTransc?.erros ?? 0, detalhes: [],
  });

  // Resumos IA debates + log combinado
  acumularAi(await resumirDebates());
  await registarLog('resumos_ia', {
    sucesso: true, total: aiTotal, inseridos: aiInseridos, atualizados: 0, erros: aiErros, detalhes: [],
  });

  // Intervenções
  const rInt = await indexarIntervencoes();
  await registarLog('intervencoes', {
    sucesso: true, total: rInt?.total ?? 0, inseridos: rInt?.inseridos ?? 0,
    atualizados: 0, erros: rInt?.erros ?? 0, detalhes: [],
  });

  // Votações
  if (resultados.iniciativas?.ok) await syncVotacoes();

  // Biografias (scraping parlamento.pt)
  const rBio = await crawlerBiografias();
  await registarLog('biografias', {
    sucesso: true, total: rBio?.total ?? 0, inseridos: rBio?.inseridos ?? 0,
    atualizados: 0, erros: rBio?.erros ?? 0, detalhes: [],
  });

  // Presenças (scraping parlamento.pt)
  const rPresencas = await crawlerPresencas();
  await registarLog('presencas', {
    sucesso: true, total: rPresencas?.total ?? 0, inseridos: rPresencas?.inseridos ?? 0,
    atualizados: 0, erros: rPresencas?.erros ?? 0, detalhes: [],
  });

  // 3. Resultado final
  console.log(`\n${'='.repeat(55)}`);
  if (falhas.length) {
    console.error(`  FALHAS NA SINCRONIZAÇÃO: ${falhas.join(', ')}`);
    process.exit(1);
  } else {
    console.log('  PIPELINE COMPLETO ✓  (dados + resumos IA guardados)');
  }
}

main();
