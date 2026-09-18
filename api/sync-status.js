import { createClient } from '@supabase/supabase-js';

/**
 * Endpoint público de estado dos jobs de sincronização.
 * Lê os resumos agregados que os pipelines gravam na tabela pública
 * `sync_status` (RLS: leitura pública, escrita só via service_role).
 *
 * Forma da resposta: o topo (`status`/`lastRunAt`/`message`/`summary`) é
 * sempre o job diário `ar-sync` — é o contrato que os consumidores já usam e
 * não muda. `jobs` acrescenta todos os jobs, incluindo o semanal do EUR-Lex,
 * para quem quiser o quadro completo.
 */

/** Ordem em que os jobs aparecem em `jobs`; o primeiro é o que define o topo da resposta. */
const JOBS = [
  { job: 'ar-sync', label: 'Sincronização diária da AR', schedule: 'Diário · 03:00 UTC' },
  { job: 'eurlex-sync', label: 'Diretivas UE (EUR-Lex)', schedule: 'Semanal · domingos, 04:00 UTC' },
];

const JOB_PRINCIPAL = JOBS[0].job;

function normalizar(meta, row) {
  return {
    job: meta.job,
    label: meta.label,
    schedule: meta.schedule,
    status: row.status,
    lastRunAt: row.last_run_at,
    message: row.message ?? undefined,
    summary: row.summary ?? undefined,
  };
}

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
      .select('job, status, last_run_at, message, summary')
      .in('job', JOBS.map((j) => j.job));

    if (error) throw error;

    const rows = data ?? [];
    const jobs = JOBS.map((meta) => {
      const row = rows.find((r) => r.job === meta.job);
      return row ? normalizar(meta, row) : null;
    }).filter(Boolean);

    const principal = jobs.find((j) => j.job === JOB_PRINCIPAL);

    // Sem o job diário não há topo que fazer — mas os outros jobs já podem ter
    // corrido, por isso `jobs` vai na mesma.
    if (!principal) {
      return res.status(200).json({
        status: 'error',
        lastRunAt: null,
        message: 'Ainda sem execuções registadas',
        jobs,
      });
    }

    return res.status(200).json({
      status: principal.status,
      lastRunAt: principal.lastRunAt,
      message: principal.message,
      summary: principal.summary,
      jobs,
    });
  } catch (err) {
    return res.status(200).json({ status: 'error', lastRunAt: null, message: `Falha ao consultar estado: ${err.message}` });
  }
}
