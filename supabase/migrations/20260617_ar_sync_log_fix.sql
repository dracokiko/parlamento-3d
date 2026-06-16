-- Adicionar colunas que faltavam na ar_sync_log (tabela existia com schema antigo)
ALTER TABLE ar_sync_log ADD COLUMN IF NOT EXISTS id          uuid         DEFAULT gen_random_uuid();
ALTER TABLE ar_sync_log ADD COLUMN IF NOT EXISTS sucesso     boolean      NOT NULL DEFAULT true;
ALTER TABLE ar_sync_log ADD COLUMN IF NOT EXISTS detalhes    jsonb        NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE ar_sync_log ADD COLUMN IF NOT EXISTS created_at  timestamptz  NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS ar_sync_log_created_at_idx ON ar_sync_log (created_at DESC);
CREATE INDEX IF NOT EXISTS ar_sync_log_recurso_idx    ON ar_sync_log (recurso, created_at DESC);

ALTER TABLE ar_sync_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin pode ler sync log" ON ar_sync_log;
CREATE POLICY "admin pode ler sync log"
  ON ar_sync_log FOR SELECT
  TO authenticated
  USING (true);
