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

  const { error } = await db.from(tabela).upsert(registos, { onConflict: 'id' });
  if (error) {
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
export async function registarSyncStatus(job, { status, message }) {
  try {
    await getClient().from('sync_status').upsert({
      job,
      status,
      message: message ?? null,
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
