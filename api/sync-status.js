import { createClient } from '@supabase/supabase-js';

/**
 * Endpoint público de estado do job diário de sincronização (ar-sync).
 * Lê o resumo agregado gravado pelo pipeline em ar-data-sync/src/sync.js
 * na tabela pública `sync_status` (RLS: leitura pública, escrita só via
 * service_role).
 */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');

  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return res.status(500).json({ status: 'error', lastRunAt: null, message: 'Supabase não configurado' });
  }

  try {
    const supabase = createClient(url, key);
    const { data, error } = await supabase
      .from('sync_status')
      .select('status, last_run_at, message, summary')
      .eq('job', 'ar-sync')
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return res.status(200).json({ status: 'error', lastRunAt: null, message: 'Ainda sem execuções registadas' });
    }

    return res.status(200).json({
      status: data.status,
      lastRunAt: data.last_run_at,
      message: data.message ?? undefined,
      summary: data.summary ?? undefined,
    });
  } catch (err) {
    return res.status(200).json({ status: 'error', lastRunAt: null, message: `Falha ao consultar estado: ${err.message}` });
  }
}
