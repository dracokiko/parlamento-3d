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
 * O erro é da casa ou do registo?
 *
 * Um registo que viole uma restrição dá uma mensagem do PostgREST, com
 * código. Uma base de dados em baixo dá outra coisa: uma página de erro do
 * Cloudflare em HTML, um gateway que expirou, uma ligação que caiu. A
 * diferença importa porque só a segunda se resolve esperando.
 */
const pareceInfraestrutura = (msg = '') =>
  /<!DOCTYPE|<html|gateway|timeout|timed out|fetch failed|network error|socket hang up|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|schema cache|error code: 5|Service Unavailable|Bad Gateway/i.test(msg);

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

export async function upsertBatch(recurso, registos) {
  if (!registos.length) return { inseridos: 0, atualizados: 0, novos: [] };

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
      return { inseridos: 0, atualizados: 0, novos: [] };
    }

    // Erro do conteúdo: partir o lote ao meio isola o registo que o causa.
    if (registos.length > 1) {
      const meio = Math.ceil(registos.length / 2);
      const r1 = await upsertBatch(recurso, registos.slice(0, meio));
      const r2 = await upsertBatch(recurso, registos.slice(meio));
      return {
        inseridos:   r1.inseridos   + r2.inseridos,
        atualizados: r1.atualizados + r2.atualizados,
        novos:       [...r1.novos,  ...r2.novos],
      };
    }
    console.error(`  ✗ Upsert falhou para id=${registos[0]?.id}: ${error.message}`);
    return { inseridos: 0, atualizados: 0, novos: [] };
  }

  falhasSeguidas = 0;
  return {
    inseridos:   novos.length,
    atualizados: registos.length - novos.length,
    novos,
  };
}

export async function registarLog(recurso, stats) {
  try {
    await getClient().from('ar_sync_log').insert({ recurso, ...stats });
  } catch (err) {
    console.warn(`  ⚠ Log não guardado: ${err.message}`);
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
