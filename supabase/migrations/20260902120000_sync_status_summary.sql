-- Adiciona um resumo por recurso ao estado público do sync, para que um
-- dashboard externo (ex: painel que agrega vários projetos) possa mostrar
-- o que foi acrescentado/atualizado a cada dia e não apenas ok/error.
--
-- Formato de `summary`: array de objetos
--   [{ recurso, sucesso, total, inseridos, atualizados, erros, syncedAt }, ...]
-- (syncedAt acrescentado depois, ver ar-data-sync/src/sync.js — sem migração própria
-- porque a coluna é jsonb, não precisa de alterar o esquema.)

ALTER TABLE sync_status ADD COLUMN IF NOT EXISTS summary jsonb;
