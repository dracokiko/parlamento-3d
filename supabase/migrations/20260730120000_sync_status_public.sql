-- Status público e agregado dos jobs de sincronização diários/semanais,
-- para consumo por um dashboard externo de monitorização.
--
-- Ao contrário de ar_sync_log (leitura só para "authenticated", guarda
-- amostras de dados por recurso), esta tabela guarda apenas um resumo por
-- job — seguro para expor com leitura pública.

CREATE TABLE IF NOT EXISTS sync_status (
  job         text        PRIMARY KEY,
  status      text        NOT NULL CHECK (status IN ('ok', 'error')),
  last_run_at timestamptz NOT NULL,
  message     text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sync_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura pública" ON sync_status FOR SELECT USING (true);
-- Sem policy de escrita pública: só o service_role (usado pelos scripts de
-- sync, ignora RLS) escreve aqui.
