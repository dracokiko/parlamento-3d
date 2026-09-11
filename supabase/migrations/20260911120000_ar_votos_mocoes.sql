-- Votos e Moções do Plenário — extraídos de AtividadesGerais.Atividades, uma
-- chave do MESMO ficheiro que já descarregamos para "debates"
-- (AtividadesXVII_json.txt) mas que até agora ignorávamos.
--
-- "Voto": declarações de pesar/condenação/saudação/solidariedade do plenário.
-- "Moção": moções de rejeição do Programa do Governo, moções de censura, etc.
-- (ex.: a moção de censura do Chega, votada e chumbada a 08/09/2026).
--
-- Sem id próprio na AR para este tipo de registo — construído a partir de
-- Tipo+Legislatura+Sessao+Numero+DataEntrada (confirmado único: 711/711 em
-- produção nesta legislatura). Populada por: ar-data-sync/src/votosMocoesSync.js

CREATE TABLE IF NOT EXISTS ar_votos_mocoes (
  id              TEXT PRIMARY KEY,      -- "{Tipo}_{Legislatura}_{Sessao}_{Numero}_{DataEntrada}"

  desc_tipo       TEXT,                  -- "Voto" | "Moção"
  tipo            TEXT,                  -- código AR: "VOT" | "MOC"
  assunto         TEXT,
  numero          TEXT,
  legislatura     TEXT,
  sessao          TEXT,
  data_entrada    DATE,

  autores_gp      JSONB,                 -- grupos parlamentares/deputados subscritores

  resultado       TEXT,                  -- "Aprovado", "Rejeitado" — null se ainda não votado
  data_votacao    DATE,
  unanime         TEXT,

  publicacao      JSONB,                 -- Publicacao do registo (DAR II série B, etc.)

  json_raw        JSONB,
  synced_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_votos_mocoes_data       ON ar_votos_mocoes (data_entrada DESC);
CREATE INDEX IF NOT EXISTS idx_votos_mocoes_desc_tipo  ON ar_votos_mocoes (desc_tipo);
CREATE INDEX IF NOT EXISTS idx_votos_mocoes_resultado  ON ar_votos_mocoes (resultado);

ALTER TABLE ar_votos_mocoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura pública" ON ar_votos_mocoes FOR SELECT USING (true);
