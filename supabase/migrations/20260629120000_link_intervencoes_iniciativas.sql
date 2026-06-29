-- Liga ar_intervencoes directamente às iniciativas usando os dados estruturados
-- dos eventos (Intervencoesdebates), sem necessidade de IA.
ALTER TABLE ar_intervencoes ADD COLUMN IF NOT EXISTS iniciativa_id TEXT;
ALTER TABLE ar_intervencoes ADD COLUMN IF NOT EXISTS id_cadastro   TEXT;
ALTER TABLE ar_intervencoes ADD COLUMN IF NOT EXISTS fase_debate   TEXT;

CREATE INDEX IF NOT EXISTS idx_ar_intervencoes_iniciativa ON ar_intervencoes (iniciativa_id);
CREATE INDEX IF NOT EXISTS idx_ar_intervencoes_id_cadastro ON ar_intervencoes (id_cadastro);
