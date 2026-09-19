/**
 * Ordenação da bancada do Governo quando não há composição oficial.
 *
 * A ordem a sério vem da tabela `governo_membros`, sincronizada do artigo do
 * Governo em curso: traz o campo `ordem`, e é essa que a bancada usa. Aqui
 * ficou só o caminho de recurso, para quando a tabela está vazia (antes da
 * primeira sincronização) e a bancada tem de ser inferida das intervenções.
 *
 * Havia aqui uma lista com os 17 cargos do XXV Governo pela ordem do
 * decreto. Foi removida de propósito: a mesma informação passou a existir na
 * base de dados, e duas listas da mesma coisa acabam sempre a discordar —
 * esta teria de ser editada à mão a cada remodelação, e ninguém se lembra.
 */

/** Palavras sem valor distintivo ao comparar dois nomes de cargo. */
const VAZIAS = new Set(['de', 'do', 'da', 'dos', 'das', 'e', 'o', 'a']);

const tokens = (cargo = '') => new Set(
  cargo.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().split(/[^a-z]+/).filter(t => t && !VAZIAS.has(t)),
);

const ehPrimeiroMinistro = (cargo = '') => /^(?:vice-)?primeiro-ministr/i.test(cargo);
const ehSecretarioEstado = (cargo = '') => /secret[áa]ri[oa]\s+de\s+estado|subsecret/i.test(cargo);

/**
 * O que o DAR chama cargo nem sempre é um cargo: quando um deputado diz "A
 * Sr.ª Ministra está quase no Chega!" a meio da fala, o marcador de orador
 * apanha a frase inteira. Um cargo verdadeiro não leva pontuação de frase e
 * não passa de meia dúzia de palavras.
 */
export function cargoCredivel(cargo = '') {
  if (!cargo) return false;
  if (/[!?;:]/.test(cargo)) return false;
  if (cargo.split(/\s+/).length > 9) return false;
  return /^(?:vice-)?(?:primeiro-ministr|ministr|secret[áa]ri|subsecret)/i.test(cargo);
}

/** Primeiro-Ministro, depois ministros, depois secretários de Estado. */
export function precedenciaDoCargo(cargo = '') {
  if (ehPrimeiroMinistro(cargo)) return 0;
  if (ehSecretarioEstado(cargo)) return 2;
  return tokens(cargo).size ? 1 : 3;
}

/**
 * Ordem de recurso: pelo escalão do cargo e, dentro dele, por quem mais
 * usou da palavra — que não é precedência nenhuma, mas é o único critério
 * defensável sem a composição oficial.
 */
export function ordenarPorPrecedencia(membros) {
  return [...membros].sort((a, b) =>
    precedenciaDoCargo(a.cargo) - precedenciaDoCargo(b.cargo) ||
    (b.intervencoes ?? 0) - (a.intervencoes ?? 0) ||
    a.nome.localeCompare(b.nome, 'pt'),
  );
}
