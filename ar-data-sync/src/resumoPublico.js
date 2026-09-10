/**
 * Amostra pública exposta em sync_status.summary[].novos / .falhas — muito menor
 * que o limite interno de ar_sync_log (até 500/recurso, tabela só para
 * "authenticated"): aqui só chega para um dashboard externo mostrar exemplos
 * concretos do que mudou ou falhou, não a lista completa (alguns recursos têm
 * dezenas de milhares de registos).
 */
export const MAX_AMOSTRA_PUBLICA = 30;

/** Acrescenta um item à amostra, sem exceder o limite (silenciosamente ignora o resto). */
export function empurrarAmostra(lista, item) {
  if (lista.length < MAX_AMOSTRA_PUBLICA) lista.push(item);
}

/** Junta vários itens de uma vez, respeitando sempre o mesmo limite. */
export function juntarAmostra(lista, itens) {
  for (const item of itens ?? []) {
    if (lista.length >= MAX_AMOSTRA_PUBLICA) break;
    lista.push(item);
  }
}
