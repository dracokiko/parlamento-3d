-- Distingue o tipo de orador em ar_intervencoes.
--
-- Até agora só entravam oradores com sigla de grupo parlamentar. Ficavam de
-- fora quem preside à sessão (o DAR escreve "O Sr. Presidente:", sem sigla —
-- ~100 turnos por sessão, o orador mais frequente de todos) e os membros do
-- Governo, que o DAR identifica por cargo com o nome entre parêntesis; estes
-- últimos entravam mal, com o cargo em `nome_dep` e a pessoa em `partido`.
--
-- papel: 'deputado' | 'presidencia' | 'governo'
-- cargo: o cargo exercido, quando é por ele que o orador é identificado
--        ("Presidente", "Ministro da Justiça"). NULL para deputados.
--
-- Populadas por: ar-data-sync/src/interventionParser.js (via summarizer.js).
-- O indexador funciona com ou sem estas colunas, por isso a migração pode
-- correr a qualquer momento — mas só depois dela é possível separar as falas
-- de presidência das intervenções políticas de um deputado.

ALTER TABLE ar_intervencoes ADD COLUMN IF NOT EXISTS papel TEXT;
ALTER TABLE ar_intervencoes ADD COLUMN IF NOT EXISTS cargo TEXT;

-- As consultas típicas filtram por papel ('só deputados' na lista de um
-- perfil, 'só presidência' num separador à parte).
CREATE INDEX IF NOT EXISTS ar_intervencoes_papel_idx ON ar_intervencoes (papel);

COMMENT ON COLUMN ar_intervencoes.papel IS 'deputado | presidencia | governo — NULL nas linhas anteriores à migração';
COMMENT ON COLUMN ar_intervencoes.cargo IS 'Cargo pelo qual o DAR identifica o orador (presidência e Governo); NULL para deputados';
