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
