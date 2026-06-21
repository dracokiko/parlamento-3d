-- Ligação directa entre iniciativas e sessões do DAR
ALTER TABLE ar_iniciativas ADD COLUMN IF NOT EXISTS dar_links jsonb;

-- Ligação inversa: quais iniciativas foram debatidas/votadas neste DAR
ALTER TABLE ar_debates ADD COLUMN IF NOT EXISTS iniciativa_ids jsonb;

-- Índice GIN para pesquisa eficiente dentro dos arrays JSONB
CREATE INDEX IF NOT EXISTS idx_ar_iniciativas_dar_links ON ar_iniciativas USING gin (dar_links);
CREATE INDEX IF NOT EXISTS idx_ar_debates_iniciativa_ids ON ar_debates USING gin (iniciativa_ids);
