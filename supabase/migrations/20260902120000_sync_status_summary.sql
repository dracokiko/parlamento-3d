-- Adiciona um resumo por recurso ao estado público do sync, para que um
-- dashboard externo (ex: painel que agrega vários projetos) possa mostrar
-- o que foi acrescentado/atualizado a cada dia e não apenas ok/error.
--
-- Formato de `summary`: array de objetos
--   [{ recurso, sucesso, total, inseridos, atualizados, erros, syncedAt,
--      novos?: [{ id?, label }], falhas?: [{ id?, motivo }] }, ...]
-- (syncedAt/novos/falhas acrescentados depois, ver ar-data-sync/src/sync.js e
-- ar-data-sync/src/resumoPublico.js — sem migração própria porque a coluna é
-- jsonb, não precisa de alterar o esquema. novos/falhas são amostras, não a
-- lista completa — ver MAX_AMOSTRA_PUBLICA.)

ALTER TABLE sync_status ADD COLUMN IF NOT EXISTS summary jsonb;
