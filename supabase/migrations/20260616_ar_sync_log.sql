-- Log de sincronizações diárias de dados
CREATE TABLE IF NOT EXISTS ar_sync_log (
  id          uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  recurso     text         NOT NULL,
  sucesso     boolean      NOT NULL DEFAULT true,
  total       int          NOT NULL DEFAULT 0,
  inseridos   int          NOT NULL DEFAULT 0,
  atualizados int          NOT NULL DEFAULT 0,
  erros       int          NOT NULL DEFAULT 0,
  detalhes    jsonb        NOT NULL DEFAULT '[]'::jsonb,
  created_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ar_sync_log_created_at_idx ON ar_sync_log (created_at DESC);
CREATE INDEX IF NOT EXISTS ar_sync_log_recurso_idx    ON ar_sync_log (recurso, created_at DESC);

-- Só utilizadores autenticados podem ler
ALTER TABLE ar_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin pode ler sync log"
  ON ar_sync_log FOR SELECT
  TO authenticated
  USING (true);

-- O service_role (usado pelo sync script) ignora RLS automaticamente
