-- Auditoria de segurança 2026-07-13: várias tabelas nunca tiveram RLS
-- explicitamente ativado nas migrations (algumas foram criadas fora do
-- histórico, diretamente no dashboard/SQL editor do Supabase). Com RLS
-- desligado, a chave anon (pública, embutida no bundle JS) tem acesso
-- total de leitura E ESCRITA via REST a essas tabelas.
--
-- Esta migration é idempotente e segura de correr contra a base de dados
-- já existente:
--   - CREATE TABLE IF NOT EXISTS não faz nada se a tabela já existir
--     (serve de baseline documentada para disaster recovery)
--   - ALTER TABLE ... ENABLE ROW LEVEL SECURITY não faz nada se já
--     estiver ativo
--   - DROP POLICY IF EXISTS + CREATE POLICY garante o mesmo acesso de
--     leitura pública que já existia (sem RLS, tudo era legível; com
--     RLS + policy "true" para SELECT, continua a ser legível) e fecha
--     escrita pública (só o service_role, que ignora RLS, escreve)

-- ── Baseline: tabelas core que nunca tiveram CREATE TABLE neste repo ──
-- Colunas capturadas via introspecção do schema real (OpenAPI do PostgREST).

CREATE TABLE IF NOT EXISTS ar_deputados (
  id              TEXT PRIMARY KEY,
  cad_id          TEXT,
  nome_parlamentar TEXT,
  nome_completo   TEXT,
  circulo         TEXT,
  circulo_id      TEXT,
  partido_sigla   TEXT,
  legislatura     TEXT,
  situacao        JSONB,
  grupos          JSONB,
  json_raw        JSONB,
  synced_at       TIMESTAMPTZ,
  resumo_ia       TEXT
);

CREATE TABLE IF NOT EXISTS ar_iniciativas (
  id              TEXT PRIMARY KEY,
  numero          TEXT,
  tipo            TEXT,
  desc_tipo       TEXT,
  titulo          TEXT,
  epigrafe        TEXT,
  legislatura     TEXT,
  data_inicio     DATE,
  data_fim        DATE,
  autores_dep     JSONB,
  autores_gp      JSONB,
  eventos         JSONB,
  link_texto      TEXT,
  json_raw        JSONB,
  synced_at       TIMESTAMPTZ,
  resumo_ia       TEXT,
  dar_links       JSONB,
  temas           TEXT[]
);

CREATE TABLE IF NOT EXISTS ar_debates (
  id                TEXT PRIMARY KEY,
  assunto           TEXT,
  artigo            TEXT,
  data_debate       DATE,
  data_entrada      DATE,
  autores_dep       JSONB,
  autores_gp        JSONB,
  json_raw          JSONB,
  synced_at         TIMESTAMPTZ,
  url_diario        TEXT,
  transcricao       TEXT,
  tipo_debate       TEXT,
  sessao            TEXT,
  legislatura       TEXT,
  intervencoes_ids  JSONB,
  resumo_ia         TEXT,
  iniciativa_ids    JSONB
);

CREATE TABLE IF NOT EXISTS ar_intervencoes (
  id            TEXT PRIMARY KEY,
  debate_id     TEXT,
  nome_dep      TEXT NOT NULL,
  partido       TEXT,
  texto         TEXT,
  data_debate   DATE,
  assunto       TEXT,
  url_diario    TEXT,
  num_palavras  INTEGER,
  iniciativa_id TEXT,
  id_cadastro   TEXT,
  fase_debate   TEXT
);

CREATE TABLE IF NOT EXISTS deputados (
  id                 INTEGER PRIMARY KEY,
  nome               TEXT NOT NULL,
  partido_sigla      TEXT,
  circulo_eleitoral  TEXT,
  nome_completo      TEXT,
  lugar              TEXT,
  foto               TEXT
);

CREATE TABLE IF NOT EXISTS intervencoes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deputado_id       INTEGER,
  data_intervencao  DATE NOT NULL,
  tipo              TEXT NOT NULL,
  resumo            TEXT,
  link_video        TEXT,
  criado_em         TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS partidos (
  sigla  TEXT PRIMARY KEY,
  nome   TEXT NOT NULL,
  cor    TEXT NOT NULL
);

-- ── RLS: ativar + leitura pública em todas as tabelas de dados ──

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ar_biografias', 'ar_presencas', 'ar_deputados', 'ar_iniciativas',
    'ar_debates', 'ar_intervencoes', 'deputados', 'intervencoes', 'partidos'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Leitura pública" ON %I', t);
    EXECUTE format('CREATE POLICY "Leitura pública" ON %I FOR SELECT USING (true)', t);
  END LOOP;
END $$;

-- ── Lock de sincronização ──
-- Evita que o GitHub Actions (cron diário) e o Task Scheduler local
-- (sync-local.ps1) corram o pipeline em simultâneo.

CREATE TABLE IF NOT EXISTS ar_sync_lock (
  id          BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  running     BOOLEAN NOT NULL DEFAULT false,
  started_at  TIMESTAMPTZ,
  host        TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO ar_sync_lock (id, running) VALUES (true, false) ON CONFLICT (id) DO NOTHING;

ALTER TABLE ar_sync_lock ENABLE ROW LEVEL SECURITY;
-- Sem policies públicas: só o service_role (usado pelo sync.js, ignora RLS)
-- lê/escreve esta tabela. Ninguém deve aceder a isto via anon key.
