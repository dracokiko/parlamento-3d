import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY, BATCH_SIZE } from './config.js';

const TABELAS = {
  iniciativas: 'ar_iniciativas',
  deputados:   'ar_deputados',
  debates:     'ar_debates',
};

let _client = null;
const getClient = () => {
  if (!_client) _client = createClient(SUPABASE_URL, SUPABASE_KEY);
  return _client;
};

export async function upsertBatch(recurso, registos) {
  if (!registos.length) return { inseridos: 0, atualizados: 0 };

  const db     = getClient();
  const tabela = TABELAS[recurso];
  const ids    = registos.map(r => r.id).filter(Boolean);

  let existentes = 0;
  try {
    const { count } = await db
      .from(tabela)
      .select('id', { count: 'exact', head: true })
      .in('id', ids);
    existentes = count ?? 0;
  } catch { /* continua sem contagem exacta */ }

  await db.from(tabela).upsert(registos, { onConflict: 'id' });

  return {
    inseridos:   Math.max(0, ids.length - existentes),
    atualizados: existentes,
  };
}

export async function registarLog(recurso, stats) {
  try {
    await getClient().from('ar_sync_log').insert({ recurso, ...stats });
  } catch (err) {
    console.warn(`  ⚠ Log não guardado: ${err.message}`);
  }
}
