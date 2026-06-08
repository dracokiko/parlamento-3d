-- Tabela: ar_votacoes
-- Armazena resultados de votações extraídos dos IniEventos das iniciativas AR.
-- Populada por: ar-data-sync/src/votacoesSync.js
--
-- Estrutura real descoberta: IniEventos[].Votacao é um array com:
--   { id, data, resultado, detalhe (HTML por GP), reuniao, unanime, ausencias, tipoReuniao }

CREATE TABLE IF NOT EXISTS ar_votacoes (
  id              TEXT PRIMARY KEY,      -- "{iniciativa_id}_{vot_id|oev_id}"

  iniciativa_id   TEXT,
  vot_id          TEXT,                  -- id interno da votação na AR
  oev_id          TEXT,                  -- id do evento
  evt_id          TEXT,

  fase            TEXT,                  -- "Votação na generalidade", etc.
  codigo_fase     TEXT,                  -- "250", etc.
  data_votacao    DATE,

  resultado       TEXT,                  -- "Aprovado", "Rejeitado"
  unanime         BOOLEAN,
  ausencias       INT,
  reuniao         TEXT,                  -- número da reunião plenária
  tipo_reuniao    TEXT,                  -- "RP" (Reunião Plenária), etc.

  detalhe_raw     TEXT,                  -- HTML original do campo detalhe
  detalhe_gp      JSONB,                 -- { raw, favor: [], contra: [], abstencao: [] }

  publicacao      JSONB,                 -- PublicacaoFase do evento

  json_raw        JSONB,
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_votacoes_iniciativa  ON ar_votacoes (iniciativa_id);
CREATE INDEX IF NOT EXISTS idx_votacoes_data        ON ar_votacoes (data_votacao DESC);
CREATE INDEX IF NOT EXISTS idx_votacoes_resultado   ON ar_votacoes (resultado);
CREATE INDEX IF NOT EXISTS idx_votacoes_reuniao     ON ar_votacoes (reuniao);

ALTER TABLE ar_votacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura pública" ON ar_votacoes FOR SELECT USING (true);
