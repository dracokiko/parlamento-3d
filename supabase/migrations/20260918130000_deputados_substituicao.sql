-- Quem substituiu quem, na tabela dos 230 assentos.
--
-- A tabela `deputados` era um seed estático e ia derivando da realidade: um
-- deputado que suspende o mandato continuava sentado no hemiciclo (com zero
-- intervenções, porque deixou de falar) e quem o substituiu não aparecia.
-- Passa a ser derivada diariamente de ar_deputados.situacao, que a AR publica
-- com datas — ver ar-data-sync/src/deputadosAtuais.js.
--
-- Estas colunas guardam o rasto da substituição, para o perfil de quem entrou
-- poder dizer a quem sucedeu e desde quando.
--
-- O sincronizador funciona com ou sem elas, por isso a migração pode correr a
-- qualquer momento.

ALTER TABLE deputados ADD COLUMN IF NOT EXISTS substitui_id    BIGINT;
ALTER TABLE deputados ADD COLUMN IF NOT EXISTS substitui_nome  TEXT;
ALTER TABLE deputados ADD COLUMN IF NOT EXISTS substitui_desde DATE;

COMMENT ON COLUMN deputados.substitui_id IS 'DepId de quem ocupava este lugar antes (ar_deputados.id)';
COMMENT ON COLUMN deputados.substitui_nome IS 'Nome de quem ocupava este lugar antes — para mostrar no perfil sem segunda consulta';
COMMENT ON COLUMN deputados.substitui_desde IS 'Data em que o actual ocupante assumiu funções (início da situação de efectividade)';
