-- Classificação temática das iniciativas (gerada por IA no sync diário)
ALTER TABLE ar_iniciativas ADD COLUMN IF NOT EXISTS temas TEXT[];
CREATE INDEX IF NOT EXISTS idx_ar_iniciativas_temas ON ar_iniciativas USING GIN(temas);
