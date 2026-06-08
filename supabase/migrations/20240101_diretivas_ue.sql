-- Tabela: diretivas_ue
-- Armazena as diretivas da UE com prazo de transposição e estado para Portugal.
-- Populada pelo script: ar-data-sync/src/eurlexSync.js
-- Fonte de dados: EUR-Lex CELLAR SPARQL (publications.europa.eu)

CREATE TABLE IF NOT EXISTS diretivas_ue (
  -- Número CELEX, e.g. "32023L0977" = Diretiva 2023/977/UE
  id                  TEXT PRIMARY KEY,

  titulo              TEXT,
  prazo_transposicao  DATE,

  -- true se Portugal notificou medidas nacionais de implementação (NIMs)
  transposto_pt       BOOLEAN NOT NULL DEFAULT FALSE,

  -- true se prazo ultrapassado E não transposto
  em_atraso           BOOLEAN NOT NULL DEFAULT FALSE,

  -- Link direto para a página EUR-Lex em português
  link_eurlex         TEXT,

  atualizado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para os filtros mais comuns na UI
CREATE INDEX IF NOT EXISTS idx_diretivas_prazo      ON diretivas_ue (prazo_transposicao DESC);
CREATE INDEX IF NOT EXISTS idx_diretivas_transposto ON diretivas_ue (transposto_pt);
CREATE INDEX IF NOT EXISTS idx_diretivas_atraso     ON diretivas_ue (em_atraso);

-- RLS: leitura pública (anon key), escrita apenas pelo service role
ALTER TABLE diretivas_ue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura pública" ON diretivas_ue
  FOR SELECT USING (true);