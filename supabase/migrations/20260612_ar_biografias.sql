CREATE TABLE IF NOT EXISTS ar_biografias (
  bid              INTEGER PRIMARY KEY,
  nome_completo    TEXT,
  nome_abrev       TEXT,
  partido          TEXT,
  circulo          TEXT,
  data_nascimento  TEXT,
  profissao        TEXT,
  habilitacoes     TEXT[],
  cargos_exercidos TEXT[],
  comissoes        TEXT[],
  atualizado_em    TIMESTAMPTZ DEFAULT now()
);
