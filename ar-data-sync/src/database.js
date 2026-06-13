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

  const { error } = await db.from(tabela).upsert(registos, { onConflict: 'id' });
  if (error) {
    // Tentar lote a metade para isolar o registo problemático
    if (registos.length > 1) {
      const meio = Math.ceil(registos.length / 2);
      const r1 = await upsertBatch(recurso, registos.slice(0, meio));
      const r2 = await upsertBatch(recurso, registos.slice(meio));
      return { inseridos: r1.inseridos + r2.inseridos, atualizados: r1.atualizados + r2.atualizados };
    }
    console.error(`  ✗ Upsert falhou para id=${registos[0]?.id}: ${error.message}`);
    return { inseridos: 0, atualizados: 0 };
  }

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
