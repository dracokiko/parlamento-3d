-- Liga cada Voto/Moção ao debate de plenário onde foi discutido (quando existe)
-- e às intervenções individuais dentro desse intervalo de páginas — para
-- mostrar "quem disse o quê", não só quem propôs.
--
-- debate_id: id do ar_debates correspondente a PublicacaoDebate[0].URLDiario
-- pagina_inicio/pagina_fim: intervalo de páginas do DAR I série onde este
--   Voto/Moção foi discutido especificamente (a sessão de plenário cobre
--   muitos assuntos no mesmo dia — sem isto mostraríamos intervenções de
--   outros temas)
-- intervencao_ids: ids de ar_intervencoes já resolvidos dentro desse
--   intervalo, calculados em ar-data-sync/src/votosMocoesSync.js

ALTER TABLE ar_votos_mocoes ADD COLUMN IF NOT EXISTS debate_id TEXT;
ALTER TABLE ar_votos_mocoes ADD COLUMN IF NOT EXISTS pagina_inicio INTEGER;
ALTER TABLE ar_votos_mocoes ADD COLUMN IF NOT EXISTS pagina_fim INTEGER;
ALTER TABLE ar_votos_mocoes ADD COLUMN IF NOT EXISTS intervencao_ids JSONB;

CREATE INDEX IF NOT EXISTS idx_votos_mocoes_debate_id ON ar_votos_mocoes (debate_id);
