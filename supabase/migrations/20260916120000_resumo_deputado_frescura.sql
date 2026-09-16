-- O perfil de cada deputado é escrito por IA a partir das suas iniciativas, mas
-- até agora era escrito uma única vez e nunca mais reescrito: um deputado com
-- 366 iniciativas ficava com um perfil construído a partir das primeiras
-- dezenas, do momento em que o resumo correu.
--
-- Estas duas colunas permitem saber quando o perfil ficou desatualizado (as
-- iniciativas cresceram muito desde então) e dizê-lo ao leitor, em vez de
-- apresentar um retrato antigo como se fosse actual.
--
-- Populadas por: ar-data-sync/src/summarizer.js (resumirDeputados)

ALTER TABLE ar_deputados ADD COLUMN IF NOT EXISTS resumo_ia_iniciativas INTEGER;
ALTER TABLE ar_deputados ADD COLUMN IF NOT EXISTS resumo_ia_em TIMESTAMPTZ;

COMMENT ON COLUMN ar_deputados.resumo_ia_iniciativas IS
  'Quantas iniciativas do deputado existiam quando o resumo foi gerado. Serve para detectar perfis desactualizados.';
COMMENT ON COLUMN ar_deputados.resumo_ia_em IS
  'Momento em que o resumo_ia foi gerado.';
