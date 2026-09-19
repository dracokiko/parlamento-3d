-- Os membros do Governo, como pessoas.
--
-- Até aqui a bancada do Governo era inferida das intervenções: só existia
-- quem tivesse falado em plenário, sabia-se o nome e o cargo e mais nada, e
-- a ordem de precedência era uma lista escrita à mão no frontend. Nada disto
-- envelhece bem — um ministro que saia continua na bancada enquanto houver
-- intervenções dele.
--
-- Esta tabela é alimentada por ar-data-sync/src/governoCrawler.js a partir do
-- artigo do Governo em curso na Wikipédia, que tem cargo, nome, retrato
-- (ficheiro do Commons), partido e período. É o período que resolve a
-- desactualização: quem saiu deixa de ter "presente" e `em_funcoes` passa a
-- falso, saindo da bancada sem deixar de existir no histórico.

CREATE TABLE IF NOT EXISTS governo_membros (
  id           TEXT PRIMARY KEY,   -- slug do nome + cargo
  nome         TEXT NOT NULL,
  cargo        TEXT NOT NULL,
  partido      TEXT,
  foto_url     TEXT,               -- Special:FilePath do Commons
  ordem        INTEGER,            -- precedência: 0 = Primeiro-Ministro
  inicio       TEXT,               -- como vem no artigo ("5 de junho de 2025")
  fim          TEXT,               -- NULL enquanto estiver em funções
  em_funcoes   BOOLEAN NOT NULL DEFAULT TRUE,
  governo      TEXT,               -- ex.: "XXV Governo Constitucional"
  fonte        TEXT,               -- URL do artigo de onde saiu
  synced_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS governo_membros_em_funcoes_idx ON governo_membros (em_funcoes, ordem);

-- Leitura pública, escrita só pelo sincronizador (service_role), como o resto.
ALTER TABLE governo_membros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "governo_membros leitura pública" ON governo_membros;
CREATE POLICY "governo_membros leitura pública" ON governo_membros FOR SELECT USING (true);

COMMENT ON COLUMN governo_membros.em_funcoes IS 'Falso assim que o artigo deixa de dizer "presente" no período — é o que impede a bancada de mostrar quem já saiu';
COMMENT ON COLUMN governo_membros.ordem IS 'Precedência oficial: 0 Primeiro-Ministro, depois os ministros pela ordem do artigo, e os secretários de Estado a seguir';
