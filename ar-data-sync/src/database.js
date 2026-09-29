import os from 'node:os';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY, BATCH_SIZE } from './config.js';

const TABELAS = {
  iniciativas: 'ar_iniciativas',
  deputados:   'ar_deputados',
  debates:     'ar_debates',
  votacoes:    'ar_votacoes',
};

let _client = null;
const getClient = () => {
  if (!_client) _client = createClient(SUPABASE_URL, SUPABASE_KEY);
  return _client;
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * A escrita foi pesada demais para o tempo que o Postgres lhe dá?
 *
 * "canceling statement due to statement timeout" não é a base de dados em
 * baixo: é ela a cortar uma instrução que demorou mais do que o limite — um
 * lote de 250 iniciativas, com o JSON de cada uma, passa-o às vezes. Partir o
 * lote ao meio resolve, porque cada metade é mais rápida; esperar e repetir o
 * mesmo lote não resolve nada.
 *
 * Até 29/09/2026 isto caía no "timeout" da regra de baixo, era tratado como
 * avaria, repetido inteiro e abandonado: a 28/09 e a 29/09 ficaram por
 * gravar mais de mil iniciativas, com o resumo a dizer "Erros: 0".
 */
const pesadaDemais = (msg = '') => /statement timeout|canceling statement/i.test(msg);

/**
 * O erro é da casa ou do registo?
 *
 * Um registo que viole uma restrição dá uma mensagem do PostgREST, com
 * código. Uma base de dados em baixo dá outra coisa: uma página de erro do
 * Cloudflare em HTML, um gateway que expirou, uma ligação que caiu. A
 * diferença importa porque só a segunda se resolve esperando.
 *
 * Sem "timeout" solto: apanhava também o timeout de instrução, que é outra
 * coisa (ver acima). Só os tempos esgotados de ligação contam.
 */
const pareceInfraestrutura = (msg = '') =>
  !pesadaDemais(msg) &&
  /<!DOCTYPE|<html|gateway|timed out|aborted due to timeout|ETIMEDOUT|fetch failed|network error|socket hang up|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|schema cache|error code: 5|Service Unavailable|Bad Gateway/i.test(msg);

/** Esperas antes de repetir uma escrita que falhou por razões de infraestrutura. */
const ESPERAS_ESCRITA = [5_000, 20_000];

/**
 * Quantas escritas seguidas podem falhar por infraestrutura antes de darmos
 * a base de dados por perdida.
 *
 * Cada uma já insistiu com as esperas acima, portanto cinco seguidas são uns
 * dois minutos de porta fechada. A 24/09/2026 o Supabase esteve em baixo e o
 * trabalho ficou três horas a insistir até o GitHub o matar — desistir cedo
 * liberta o trinco, guarda o estado e deixa o dia seguinte correr limpo.
 */
const LIMITE_FALHAS_SEGUIDAS = 5;
let falhasSeguidas = 0;

/** Erro que aborta o pipeline: não vale a pena continuar sem base de dados. */
export class BaseDeDadosIndisponivel extends Error {
  constructor(msg) {
    super(`Base de dados indisponível (${LIMITE_FALHAS_SEGUIDAS} escritas seguidas falharam): ${msg}`);
    this.name = 'BaseDeDadosIndisponivel';
  }
}

/**
 * Grava um lote e diz o que aconteceu a cada parte dele.
 *
 * `falhados` e `motivo` existem para que um registo não gravado apareça como
 * erro no resumo. Antes só vinham `inseridos`/`atualizados`, e o que ficava
 * por gravar simplesmente não entrava em conta nenhuma.
 *
 * @returns {Promise<{ inseridos: number, atualizados: number, novos: object[], falhados: number, motivo?: string }>}
 */
export async function upsertBatch(recurso, registos) {
  if (!registos.length) return { inseridos: 0, atualizados: 0, novos: [], falhados: 0 };

  const db     = getClient();
  const tabela = TABELAS[recurso];
  const ids    = registos.map(r => r.id).filter(Boolean);

  let existentesSet = new Set();
  try {
    const { data } = await db.from(tabela).select('id').in('id', ids);
    existentesSet = new Set((data || []).map(r => String(r.id)));
  } catch { /* continua sem saber quais são novos */ }

  const novos = registos.filter(r => !existentesSet.has(String(r.id)));

  // Repetir de início se o que falhou foi a casa e não o conteúdo; partir o
  // lote nesse caso não ajudava nada e multiplicava os pedidos por duzentos.
  let error;
  for (let i = 0; ; i++) {
    ({ error } = await db.from(tabela).upsert(registos, { onConflict: 'id' }));
    if (!error || !pareceInfraestrutura(error.message) || i >= ESPERAS_ESCRITA.length) break;
    console.warn(`  ⚠ Escrita falhou (${error.message.slice(0, 60)}) — a repetir em ${ESPERAS_ESCRITA[i] / 1000}s...`);
    await sleep(ESPERAS_ESCRITA[i]);
  }

  if (error) {
    if (pareceInfraestrutura(error.message)) {
      falhasSeguidas++;
      if (falhasSeguidas >= LIMITE_FALHAS_SEGUIDAS) throw new BaseDeDadosIndisponivel(error.message);
      console.error(`  ✗ Escrita falhou (lote de ${registos.length}): ${error.message.slice(0, 120)}`);
      return { inseridos: 0, atualizados: 0, novos: [], falhados: registos.length, motivo: error.message };
    }

    // A base de dados respondeu — está viva, mesmo que a escrita tenha falhado.
    falhasSeguidas = 0;

    // Erro do conteúdo, ou lote pesado demais para o limite de tempo: partir
    // ao meio isola o registo estragado, ou faz metades que já cabem no tempo.
    if (registos.length > 1) {
      const meio = Math.ceil(registos.length / 2);
      const r1 = await upsertBatch(recurso, registos.slice(0, meio));
      const r2 = await upsertBatch(recurso, registos.slice(meio));
      return {
        inseridos:   r1.inseridos   + r2.inseridos,
        atualizados: r1.atualizados + r2.atualizados,
        novos:       [...r1.novos,  ...r2.novos],
        falhados:    r1.falhados    + r2.falhados,
        motivo:      r1.motivo ?? r2.motivo,
      };
    }
    console.error(`  ✗ Upsert falhou para id=${registos[0]?.id}: ${error.message}`);
    return { inseridos: 0, atualizados: 0, novos: [], falhados: 1, motivo: `id=${registos[0]?.id}: ${error.message}` };
  }

  falhasSeguidas = 0;
  return {
    inseridos:   novos.length,
    atualizados: registos.length - novos.length,
    novos,
    falhados:    0,
  };
}

/**
 * Guarda uma linha em ar_sync_log — a tabela que alimenta a página pública de
 * Sincronizações do site (o calendário dia a dia).
 *
 * Só as colunas que a tabela tem. Até 29/09/2026 isto espalhava o objecto
 * inteiro; quando a 10/09 os resultados passaram a levar `novos` e `falhas`
 * (que vão para sync_status, não para aqui), o PostgREST passou a recusar
 * todos os inserts do pipeline diário por "coluna inexistente" — e como o
 * supabase-js devolve o erro em vez de o lançar, o catch nunca o viu. A
 * página ficou dezanove dias parada sem ninguém dar por isso.
 */
export async function registarLog(recurso, stats) {
  // Os passos mais novos só preenchem `novos`; a página lê `detalhes`, que é a
  // mesma forma ({ label }) — usa-se o que houver.
  const detalhes = stats.detalhes?.length ? stats.detalhes : (stats.novos ?? []);

  try {
    const { error } = await getClient().from('ar_sync_log').insert({
      recurso,
      sucesso:     stats.sucesso,
      total:       stats.total ?? 0,
      inseridos:   stats.inseridos ?? 0,
      atualizados: stats.atualizados ?? 0,
      erros:       stats.erros ?? 0,
      detalhes,
    });
    if (error) console.warn(`  ⚠ Log não guardado (${recurso}): ${error.message}`);
  } catch (err) {
    console.warn(`  ⚠ Log não guardado (${recurso}): ${err.message}`);
  }
}

/** Regista o resultado agregado de um job (tabela pública sync_status). */
export async function registarSyncStatus(job, { status, message, summary }) {
  try {
    await getClient().from('sync_status').upsert({
      job,
      status,
      message: message ?? null,
      summary: summary ?? null,
      last_run_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn(`  ⚠ Sync status não guardado: ${err.message}`);
  }
}

const TRES_HORAS_MS = 3 * 60 * 60 * 1000;

/**
 * Adquire o lock singleton de sincronização em ar_sync_lock.
 * Se já estiver a correr (running === true) e o início for há menos de 3h,
 * devolve { acquired: false, since, host } sem alterar nada.
 * Caso contrário, marca como a correr e devolve { acquired: true }.
 */
export async function acquireSyncLock(host) {
  const db = getClient();
  const { data } = await db.from('ar_sync_lock').select('*').eq('id', true).maybeSingle();

  if (data?.running === true && data?.started_at) {
    const desde = new Date(data.started_at).getTime();
    if (!isNaN(desde) && (Date.now() - desde) < TRES_HORAS_MS) {
      return { acquired: false, since: data.started_at, host: data.host };
    }
  }

  await db.from('ar_sync_lock').upsert({
    id:         true,
    running:    true,
    started_at: new Date().toISOString(),
    host:       host || os.hostname(),
    updated_at: new Date().toISOString(),
  });

  return { acquired: true };
}

/** Liberta o lock singleton de sincronização. */
export async function releaseSyncLock() {
  await getClient().from('ar_sync_lock').update({
    running:    false,
    updated_at: new Date().toISOString(),
  }).eq('id', true);
}
