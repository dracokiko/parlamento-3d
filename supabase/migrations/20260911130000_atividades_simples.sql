-- Restantes chaves de AtividadesGerais/Atividades no ficheiro já descarregado
-- para "debates" (AtividadesXVII_json.txt) — ao contrário de
-- AtividadesGerais.Atividades (votos/moções), estas são arrays planos com
-- id próprio, sem sub-estruturas a resolver.
-- Populadas por: ar-data-sync/src/atividadesSimples.js

CREATE TABLE IF NOT EXISTS ar_audicoes (
  id            TEXT PRIMARY KEY,   -- IDAudicao
  assunto       TEXT,
  data          DATE,
  entidades     TEXT,
  numero        TEXT,               -- NumeroAudicao, ex: "4-CAEne-XVII" — identifica a comissão
  legislatura   TEXT,
  sessao        TEXT,
  documentos    JSONB,
  links         JSONB,
  json_raw      JSONB,
  synced_at     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS ar_audiencias (
  id            TEXT PRIMARY KEY,   -- IDAudiencia
  assunto       TEXT,
  data          DATE,
  entidades     TEXT,
  concedida     TEXT,
  numero        TEXT,               -- NumeroAudiencia
  legislatura   TEXT,
  sessao        TEXT,
  documentos    JSONB,
  links         JSONB,
  json_raw      JSONB,
  synced_at     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS ar_deslocacoes (
  id            TEXT PRIMARY KEY,   -- IDDeslocacao
  designacao    TEXT,
  tipo          TEXT,               -- ex: "Representação"
  data_inicio   DATE,
  data_fim      DATE,
  local_evento  TEXT,
  legislatura   TEXT,
  sessao        TEXT,
  documentos    JSONB,
  links         JSONB,
  json_raw      JSONB,
  synced_at     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS ar_eventos (
  id            TEXT PRIMARY KEY,   -- IDEvento
  designacao    TEXT,
  tipo_evento   TEXT,
  data          DATE,
  local_evento  TEXT,
  legislatura   TEXT,
  sessao        TEXT,
  documentos    JSONB,
  links         JSONB,
  json_raw      JSONB,
  synced_at     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS ar_orcamento (
  id                  TEXT PRIMARY KEY,  -- id (já vem como string, ex: "664")
  ano                 TEXT,
  titulo              TEXT,
  tipo                TEXT,              -- ex: "Orçamento da A.R."
  tp                  TEXT,              -- ex: "OAR"
  data_aprovacao_ca   DATE,              -- dtAprovacaoCA
  data_agendamento    DATE,              -- dtAgendamento
  legislatura         TEXT,              -- leg
  sessao              TEXT,              -- SL
  votacao             JSONB,
  textos_aprovados    JSONB,
  anexos              JSONB,
  json_raw            JSONB,
  synced_at           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_audicoes_data     ON ar_audicoes (data DESC);
CREATE INDEX IF NOT EXISTS idx_audiencias_data    ON ar_audiencias (data DESC);
CREATE INDEX IF NOT EXISTS idx_deslocacoes_data   ON ar_deslocacoes (data_inicio DESC);
CREATE INDEX IF NOT EXISTS idx_eventos_data       ON ar_eventos (data DESC);
CREATE INDEX IF NOT EXISTS idx_orcamento_ano      ON ar_orcamento (ano);

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ar_audicoes', 'ar_audiencias', 'ar_deslocacoes', 'ar_eventos', 'ar_orcamento'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Leitura pública" ON %I', t);
    EXECUTE format('CREATE POLICY "Leitura pública" ON %I FOR SELECT USING (true)', t);
  END LOOP;
END $$;
