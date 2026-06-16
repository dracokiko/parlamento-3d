CREATE TABLE IF NOT EXISTS ar_presencas (
  bid              INTEGER PRIMARY KEY,
  nome_abrev       TEXT,
  total_sessoes    INTEGER,
  presencas        INTEGER,
  faltas_just      INTEGER,
  ausencias_mp     INTEGER,
  outras           INTEGER,
  taxa_presenca    NUMERIC(5,2),
  sessoes          JSONB,
  atualizado_em    TIMESTAMPTZ DEFAULT now()
);
