import fs from 'fs';
import { AR_ENDPOINTS, BATCH_SIZE } from './config.js';
import { downloadToTemp, streamRecords } from './downloader.js';
import { NORMALIZADORES } from './processor.js';
import { upsertBatch, registarLog, acquireSyncLock, releaseSyncLock, registarSyncStatus } from './database.js';
import { resumirIniciativas, resumirDeputados, resumirDebates, resumirVotacoes, obterTranscricoesDebates, indexarIntervencoes, classificarTemas } from './summarizer.js';
import { crawlerDebatesDAR } from './catalogueCrawler.js';
import { syncVotacoes } from './votacoesSync.js';
import { syncVotosMocoes } from './votosMocoesSync.js';
import { syncAudicoes, syncAudiencias, syncDeslocacoes, syncEventos, syncOrcamento } from './atividadesSimples.js';
import { syncDarLinks } from './linkDarIniciativas.js';
import { crawlerPresencas } from './presencasCrawler.js';
import { crawlerBiografias } from './biografiasCrawler.js';
import { linkIntervencoesIniciativas } from './linkIntervencoesIni.js';
import { linkIntervencoesViaDarLinks } from './linkIntervencoesDAR.js';
import { juntarAmostra } from './resumoPublico.js';

/** Copia até ao limite público, independentemente do tamanho da lista de origem (algumas funções mantêm um cap interno maior, só para ar_sync_log). */
function capPublico(itens) {
  const cap = [];
  juntarAmostra(cap, itens);
  return cap;
}

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

// Id do registo bruto (antes de normalizar) — usado quando um registo falha a
// normalização, por isso não temos o `reg` normalizado para o identificar.
function rawIdItem(recurso, raw) {
  switch (recurso) {
    case 'iniciativas': return raw?.IniId != null ? String(raw.IniId) : undefined;
    case 'deputados':   return raw?.DepId != null ? String(raw.DepId) : undefined;
    case 'debates':      return raw?.DebateId != null ? String(raw.DebateId) : undefined;
    default:             return undefined;
  }
}

async function sincronizar(recurso, log) {
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
    await log(recurso, {
      sucesso: false, total: 0, inseridos: 0, atualizados: 0, erros: 1, detalhes: [],
      falhas: [{ motivo: `Falha no download: ${err.message}` }],
    });
    return false;
  }

  let batch = [], total = 0, inseridos = 0, atualizados = 0, erros = 0;
  const amostras = [];   // até 500 — só para ar_sync_log (interno)
  const novosPublicos = []; // amostra menor — vai para o summary público
  const falhas = [];

  try {
    for await (const raw of streamRecords(tmpPath, nestedKey)) {
      try {
        const reg = normalizar(raw);
        if (!reg) {
          erros++;
          falhas.push({ id: rawIdItem(recurso, raw), motivo: 'Registo sem id — normalização devolveu null.' });
          continue;
        }
        batch.push(reg);
        total++;

        if (batch.length >= BATCH_SIZE) {
          const r = await upsertBatch(recurso, batch);
          inseridos   += r.inseridos;
          atualizados += r.atualizados;
          const novosEtiquetados = r.novos.map(reg => labelItem(recurso, reg));
          if (amostras.length < MAX_AMOSTRAS) {
            amostras.push(...novosEtiquetados.slice(0, MAX_AMOSTRAS - amostras.length));
          }
          juntarAmostra(novosPublicos, novosEtiquetados);
          batch = [];
          process.stdout.write(`  … ${total} processados\r`);
        }
      } catch (err) {
        erros++;
        falhas.push({ id: rawIdItem(recurso, raw), motivo: err.message });
        if (erros <= 5) console.warn(`\n  ⚠ ${err.message}`);
      }
    }

    if (batch.length) {
      const r = await upsertBatch(recurso, batch);
      inseridos   += r.inseridos;
      atualizados += r.atualizados;
      const novosEtiquetados = r.novos.map(reg => labelItem(recurso, reg));
      if (amostras.length < MAX_AMOSTRAS) {
        amostras.push(...novosEtiquetados.slice(0, MAX_AMOSTRAS - amostras.length));
      }
      juntarAmostra(novosPublicos, novosEtiquetados);
    }

    await log(recurso, { sucesso: true, total, inseridos, atualizados, erros, detalhes: amostras, novos: novosPublicos, falhas });
    const s = ((Date.now() - inicio) / 1000).toFixed(1);
    console.log(`\n  ✓ ${s}s | Total: ${total} | Inseridos: ${inseridos} | Atualizados: ${atualizados} | Erros: ${erros}`);
    return { ok: true, inseridos };

  } catch (err) {
    console.error(`\n  ✗ Erro fatal: ${err.message}`);
    falhas.push({ motivo: `Erro fatal: ${err.message}` });
    await log(recurso, { sucesso: false, total, inseridos, atualizados, erros: erros + 1, detalhes: amostras, novos: novosPublicos, falhas });
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

  // Resumo por recurso (contagens do dia + amostras do que mudou/falhou) —
  // exposto publicamente via sync_status.summary para consumo por dashboards
  // externos. `novos`/`falhas` só entram quando não vazios, para não inchar
  // o JSON em recursos sem nada a reportar.
  const resumo = [];
  const log = async (recurso, stats) => {
    await registarLog(recurso, stats);
    resumo.push({
      recurso,
      sucesso:     stats.sucesso,
      total:       stats.total ?? 0,
      inseridos:   stats.inseridos ?? 0,
      atualizados: stats.atualizados ?? 0,
      erros:       stats.erros ?? 0,
      // Momento em que este recurso concluiu — os recursos correm sequencialmente e um
      // pipeline completo pode demorar minutos, por isso não têm todos a mesma hora.
      syncedAt:    new Date().toISOString(),
      ...(stats.novos?.length  ? { novos:  capPublico(stats.novos)  } : {}),
      ...(stats.falhas?.length ? { falhas: capPublico(stats.falhas) } : {}),
    });
  };

  // 1. Sincronizar todos os recursos
  const resultados = {};
  for (const r of alvos) {
    if (!AR_ENDPOINTS[r]) {
      console.error(`Recurso desconhecido: "${r}". Opções: ${Object.keys(AR_ENDPOINTS).join(', ')}`);
      process.exitCode = 1;
      return { ok: false, message: `Recurso desconhecido: ${r}` };
    }
    const res = await sincronizar(r, log);
    resultados[r] = res;
    if (!res.ok) falhas.push(r);
  }

  // 2. Fase IA + scraping
  console.log(`\n${'='.repeat(55)}`);
  console.log('  FASE IA — RESUMOS AUTOMÁTICOS');
  console.log('='.repeat(55));

  // Resumos IA (acumula iniciativas + deputados + debates + votações num único log)
  let aiTotal = 0, aiInseridos = 0, aiErros = 0;
  let aiNovos = [], aiFalhas = [];
  const acumularAi = r => {
    aiTotal += r?.total ?? 0; aiInseridos += r?.inseridos ?? 0; aiErros += r?.erros ?? 0;
    juntarAmostra(aiNovos, r?.novos);
    juntarAmostra(aiFalhas, r?.falhas);
  };

  try { if (resultados.iniciativas?.ok) acumularAi(await resumirIniciativas()); }
  catch (err) { console.warn(`\n  ⚠ resumirIniciativas falhou (${err.message})`); avisos.push('resumirIniciativas'); }

  // Classificação temática (corre após resumirIniciativas para garantir que temas novos são processados)
  let rTemas = null;
  try { rTemas = await classificarTemas(); }
  catch (err) { console.warn(`\n  ⚠ classificarTemas falhou (${err.message})`); avisos.push('classificarTemas'); }
  const temasOk = rTemas !== null && (rTemas?.erros ?? 0) >= 0;
  await log('temas', {
    sucesso:     temasOk,
    total:       rTemas?.total       ?? 0,
    inseridos:   rTemas?.inseridos   ?? 0,
    atualizados: 0,
    erros:       rTemas === null || (rTemas?.erros ?? 0) < 0 ? 1 : (rTemas?.erros ?? 0),
    detalhes:    rTemas?.detalhes    ?? [],
    novos:       rTemas?.detalhes    ?? [],
    falhas:      rTemas?.falhas      ?? [],
  });
  if (!temasOk) avisos.push('temas');

  try { if (resultados.deputados?.ok) acumularAi(await resumirDeputados()); }
  catch (err) { console.warn(`\n  ⚠ resumirDeputados falhou (${err.message})`); avisos.push('resumirDeputados'); }

  // Catálogo DAR — duas passagens:
  //   'new'     apanha as sessões publicadas desde a última corrida;
  //   'missing' repesca placeholders antigos ainda sem transcrição.
  // Sem a segunda, qualquer buraco ficava permanente: 'new' só olha para
  // sessões posteriores à mais recente já crawlada, nunca para trás.
  let rDar = null;
  try {
    const rNovas   = await crawlerDebatesDAR('new');
    const rFaltas  = await crawlerDebatesDAR('missing');
    rDar = {
      novos:        (rNovas.novos ?? 0)        + (rFaltas.novos ?? 0),
      actualizados: (rNovas.actualizados ?? 0) + (rFaltas.actualizados ?? 0),
      erros:        (rNovas.erros ?? 0)        + (rFaltas.erros ?? 0),
      amostraNovos: [...(rNovas.amostraNovos ?? []), ...(rFaltas.amostraNovos ?? [])],
      falhas:       [...(rNovas.falhas ?? []),       ...(rFaltas.falhas ?? [])],
    };
  }
  catch (err) { console.warn(`\n  ⚠ Crawler DAR falhou (${err.message})`); avisos.push('crawlerDebatesDAR'); }
  await log('dar', {
    sucesso: rDar !== null,
    total:       (rDar?.novos ?? 0) + (rDar?.actualizados ?? 0) + (rDar?.erros ?? 0),
    inseridos:    rDar?.novos  ?? 0,
    atualizados:  rDar?.actualizados ?? 0,
    erros:        rDar?.erros  ?? (rDar === null ? 1 : 0),
    detalhes:    [],
    novos:       rDar?.amostraNovos ?? [],
    falhas:      rDar?.falhas ?? [],
  });
  if (!(rDar !== null)) avisos.push('dar');

  // Votos e Moções do Plenário (extraídos do mesmo ficheiro de "debates",
  // chave AtividadesGerais.Atividades — inclui moções de censura)
  let rVotMoc = null;
  try { rVotMoc = await syncVotosMocoes(); }
  catch (err) { console.warn(`\n  ⚠ syncVotosMocoes falhou (${err.message})`); avisos.push('syncVotosMocoes'); }
  await log('votos_mocoes', {
    sucesso:     rVotMoc !== null,
    total:       rVotMoc?.total       ?? 0,
    inseridos:   rVotMoc?.inseridos   ?? 0,
    atualizados: rVotMoc?.atualizados ?? 0,
    erros:       rVotMoc?.erros       ?? (rVotMoc === null ? 1 : 0),
    detalhes:    [],
    novos:       rVotMoc?.novos  ?? [],
    falhas:      rVotMoc?.falhas ?? [],
  });
  if (!(rVotMoc !== null)) avisos.push('votos_mocoes');

  // Atalho para recursos "simples" (fetch/normalizar/upsert só, mesma forma de
  // retorno de atividadesSimples.js) — evita repetir o mesmo mapeamento
  // sucesso/erros/novos/falhas cinco vezes seguidas.
  const logSimples = async (recurso, resultado) => {
    await log(recurso, {
      sucesso:     resultado !== null,
      total:       resultado?.total       ?? 0,
      inseridos:   resultado?.inseridos   ?? 0,
      atualizados: resultado?.atualizados ?? 0,
      erros:       resultado?.erros       ?? (resultado === null ? 1 : 0),
      detalhes:    [],
      novos:       resultado?.novos  ?? [],
      falhas:      resultado?.falhas ?? [],
    });
    return resultado !== null;
  };

  // Audições, Audiências, Deslocações, Eventos, Orçamento (mesmo ficheiro de
  // "debates", chaves de AtividadesGerais até agora ignoradas)
  let rAud = null;
  try { rAud = await syncAudicoes(); }
  catch (err) { console.warn(`\n  ⚠ syncAudicoes falhou (${err.message})`); avisos.push('syncAudicoes'); }
  if (!(await logSimples('audicoes', rAud))) avisos.push('audicoes');

  let rAudi = null;
  try { rAudi = await syncAudiencias(); }
  catch (err) { console.warn(`\n  ⚠ syncAudiencias falhou (${err.message})`); avisos.push('syncAudiencias'); }
  if (!(await logSimples('audiencias', rAudi))) avisos.push('audiencias');

  let rDesloc = null;
  try { rDesloc = await syncDeslocacoes(); }
  catch (err) { console.warn(`\n  ⚠ syncDeslocacoes falhou (${err.message})`); avisos.push('syncDeslocacoes'); }
  if (!(await logSimples('deslocacoes', rDesloc))) avisos.push('deslocacoes');

  let rEvt = null;
  try { rEvt = await syncEventos(); }
  catch (err) { console.warn(`\n  ⚠ syncEventos falhou (${err.message})`); avisos.push('syncEventos'); }
  if (!(await logSimples('eventos', rEvt))) avisos.push('eventos');

  let rOrc = null;
  try { rOrc = await syncOrcamento(); }
  catch (err) { console.warn(`\n  ⚠ syncOrcamento falhou (${err.message})`); avisos.push('syncOrcamento'); }
  if (!(await logSimples('orcamento', rOrc))) avisos.push('orcamento');

  // Transcrições (scraping DAR PDF)
  let rTransc = null;
  try { rTransc = await obterTranscricoesDebates(); }
  catch (err) { console.warn(`\n  ⚠ obterTranscricoesDebates falhou (${err.message})`); avisos.push('obterTranscricoesDebates'); }
  await log('transcricoes', {
    sucesso: rTransc !== null, total: rTransc?.total ?? 0, inseridos: rTransc?.inseridos ?? 0,
    atualizados: 0, erros: rTransc?.erros ?? (rTransc === null ? 1 : 0), detalhes: [],
    novos: rTransc?.novos ?? [], falhas: rTransc?.falhas ?? [],
  });
  if (!(rTransc !== null)) avisos.push('transcricoes');

  // Resumos IA debates + log combinado
  try { acumularAi(await resumirDebates()); }
  catch (err) { console.warn(`\n  ⚠ resumirDebates falhou (${err.message})`); avisos.push('resumirDebates'); }
  await log('resumos_ia', {
    sucesso: aiErros === 0, total: aiTotal, inseridos: aiInseridos, atualizados: 0, erros: aiErros, detalhes: [],
    novos: aiNovos, falhas: aiFalhas,
  });
  if (!(aiErros === 0)) avisos.push('resumos_ia');

  // Intervenções (indexação a partir do texto PDF)
  let rInt = null;
  try { rInt = await indexarIntervencoes(); }
  catch (err) { console.warn(`\n  ⚠ indexarIntervencoes falhou (${err.message})`); avisos.push('indexarIntervencoes'); }
  await log('intervencoes', {
    sucesso: rInt !== null, total: rInt?.total ?? 0, inseridos: rInt?.inseridos ?? 0,
    atualizados: 0, erros: rInt?.erros ?? (rInt === null ? 1 : 0), detalhes: [],
    novos: rInt?.novos ?? [], falhas: rInt?.falhas ?? [],
  });
  if (!(rInt !== null)) avisos.push('intervencoes');

  // Ligação intervenções → iniciativas (via Intervencoesdebates estruturado)
  let rIntLink = null;
  try { rIntLink = await linkIntervencoesIniciativas(); }
  catch (err) { console.warn(`\n  ⚠ linkIntervencoesIniciativas falhou (${err.message})`); avisos.push('linkIntervencoesIniciativas'); }
  await log('intervencoes_links', {
    sucesso:     rIntLink !== null,
    total:       rIntLink?.total     ?? 0,
    inseridos:   rIntLink?.inseridos ?? 0,
    atualizados: 0,
    erros:       rIntLink === null ? 1 : (rIntLink?.erros ?? 0),
    detalhes:    [],
    novos:       rIntLink?.novos  ?? [],
    falhas:      rIntLink?.falhas ?? [],
  });
  if (!(rIntLink !== null)) avisos.push('intervencoes_links');

  // Ligação complementar via dar_links + intervalos de página (cobre sessões recentes
  // onde Intervencoesdebates ainda não foi populado pelo API da AR)
  let rIntLinkDar = null;
  try { rIntLinkDar = await linkIntervencoesViaDarLinks(); }
  catch (err) { console.warn(`\n  ⚠ linkIntervencoesViaDarLinks falhou (${err.message})`); avisos.push('linkIntervencoesViaDarLinks'); }
  await log('intervencoes_links_dar', {
    sucesso:     rIntLinkDar !== null,
    total:       rIntLinkDar?.total     ?? 0,
    inseridos:   rIntLinkDar?.inseridos ?? 0,
    atualizados: 0,
    erros:       rIntLinkDar === null ? 1 : (rIntLinkDar?.erros ?? 0),
    detalhes:    [],
    novos:       rIntLinkDar?.novos  ?? [],
    falhas:      rIntLinkDar?.falhas ?? [],
  });
  if (!(rIntLinkDar !== null)) avisos.push('intervencoes_links_dar');

  // Votações (extracção + resumos IA) + deputados divergentes + dar_links
  if (resultados.iniciativas?.ok) {
    let rVot = null;
    try { rVot = await syncVotacoes(); }
    catch (err) { console.warn(`\n  ⚠ syncVotacoes falhou (${err.message})`); avisos.push('syncVotacoes'); }
    const votacoesSucesso = rVot?.ok ?? rVot !== null;
    await log('votacoes', {
      sucesso: votacoesSucesso, total: rVot?.total ?? 0, inseridos: rVot?.total ?? 0,
      atualizados: 0, erros: rVot?.erros ?? (rVot === null ? 1 : 0), detalhes: [],
      novos: rVot?.novos ?? [], falhas: rVot?.falhas ?? [],
    });
    if (!votacoesSucesso) avisos.push('votacoes');

    // Deputados divergentes — log separado com contagem
    await log('deputados_divergentes', {
      sucesso: rVot !== null,
      total:       rVot?.comDivergentes ?? 0,
      inseridos:   rVot?.comDivergentes ?? 0,
      atualizados: 0,
      erros:       rVot === null ? 1 : 0,
      detalhes:    [],
      novos:       rVot?.divergentesAmostra ?? [],
      falhas:      [],
    });
    if (!(rVot !== null)) avisos.push('deputados_divergentes');

    // Ligação DAR ↔ Iniciativas
    let rDarLinks = null;
    try { rDarLinks = await syncDarLinks(); }
    catch (err) { console.warn(`\n  ⚠ syncDarLinks falhou (${err.message})`); avisos.push('syncDarLinks'); }
    const darLinksSucesso = rDarLinks?.ok ?? rDarLinks !== null;
    await log('dar_links', {
      sucesso:     darLinksSucesso,
      total:       rDarLinks?.total       ?? 0,
      inseridos:   rDarLinks?.inseridos   ?? 0,
      atualizados: rDarLinks?.atualizados ?? 0,
      erros:       rDarLinks === null ? 1 : (rDarLinks?.erros ?? 0),
      detalhes:    rDarLinks?.detalhes ?? [],
      novos:       rDarLinks?.detalhes ?? [],
      falhas:      rDarLinks?.falhas   ?? [],
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
  await log('biografias', {
    sucesso: rBio !== null, total: rBio?.total ?? 0, inseridos: rBio?.inseridos ?? 0,
    atualizados: 0, erros: rBio?.erros ?? (rBio === null ? 1 : 0), detalhes: [],
    novos: rBio?.novos ?? [], falhas: rBio?.falhas ?? [],
  });
  if (!(rBio !== null)) avisos.push('biografias');

  // Presenças (scraping parlamento.pt)
  let rPresencas = null;
  try { rPresencas = await crawlerPresencas(); }
  catch (err) { console.warn(`\n  ⚠ crawlerPresencas falhou (${err.message})`); avisos.push('crawlerPresencas'); }
  await log('presencas', {
    sucesso: rPresencas !== null, total: rPresencas?.total ?? 0, inseridos: rPresencas?.inseridos ?? 0,
    atualizados: 0, erros: rPresencas?.erros ?? (rPresencas === null ? 1 : 0), detalhes: [],
    novos: rPresencas?.novos ?? [], falhas: rPresencas?.falhas ?? [],
  });
  if (!(rPresencas !== null)) avisos.push('presencas');

  // 3. Resultado final
  console.log(`\n${'='.repeat(55)}`);
  const avisosUnicos = [...new Set(avisos)];
  if (falhas.length) {
    console.error(`  FALHAS NA SINCRONIZAÇÃO: ${falhas.join(', ')}`);
    process.exitCode = 1;
    return { ok: false, message: `Falhas: ${falhas.join(', ')}`, summary: resumo };
  } else if (avisosUnicos.length) {
    console.error(`  PIPELINE CONCLUÍDO COM AVISOS: ${avisosUnicos.join(', ')}`);
    process.exitCode = 1;
    return { ok: false, message: `Avisos: ${avisosUnicos.join(', ')}`, summary: resumo };
  } else {
    console.log('  PIPELINE COMPLETO ✓  (dados + resumos IA guardados)');
    return { ok: true, message: null, summary: resumo };
  }
}

async function run() {
  const lock = await acquireSyncLock();
  if (!lock.acquired) {
    console.log(`⏭  Sync já em curso desde ${lock.since} (${lock.host}) — a saltar esta execução.`);
    return;
  }
  let resultado;
  try {
    resultado = await main();
  } catch (err) {
    resultado = { ok: false, message: `Erro fatal: ${err.message}` };
    throw err;
  } finally {
    await registarSyncStatus('ar-sync', {
      status:  resultado?.ok ? 'ok' : 'error',
      message: resultado?.message ?? null,
      summary: resultado?.summary ?? null,
    });
    await releaseSyncLock();
  }
}

run().catch(err => {
  console.error('Erro fatal no pipeline:', err);
  process.exitCode = 1;
});
