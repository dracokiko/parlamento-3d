/**
 * Quem exerce cada cargo do Governo, ao longo do tempo.
 *
 * O DAR nomeia o ministro na primeira vez que ele fala numa sessão ("O Sr.
 * Ministro da Justiça (Rita Alarcão Júdice): —") e nas seguintes escreve só o
 * cargo. Há sessões em que nunca chega a nomeá-lo — e aí o orador ficava
 * registado com o nome do cargo, separado da pessoa: o Primeiro-Ministro
 * aparecia como duas entidades, "Luís Montenegro" com 1383 intervenções e
 * "Primeiro-Ministro" com 312.
 *
 * Isto resolve-o olhando para todas as sessões: se em alguma o cargo foi
 * nomeado, sabemos quem era. Por data, e não um titular único por cargo,
 * porque os governos remodelam — a mesma pasta muda de mãos e atribuir tudo
 * ao titular actual reescreveria o passado.
 */

/** Índice cargo (normalizado) → ocorrências nomeadas, ordenadas por data. */
export async function carregarTitularesGoverno(db) {
  const indice = new Map();

  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db
      .from('ar_intervencoes')
      .select('nome_dep, cargo, data_debate')
      .eq('papel', 'governo')
      .not('cargo', 'is', null)
      .order('id')
      .range(offset, offset + 999);

    if (error) throw new Error(`titulares do Governo: ${error.message}`);
    if (!data?.length) break;

    for (const r of data) {
      // Linhas em que o nome é o próprio cargo não identificam ninguém.
      if (!r.nome_dep || !r.cargo || r.nome_dep === r.cargo) continue;
      const chave = r.cargo.toLowerCase().replace(/\s+/g, ' ').trim();
      const lista = indice.get(chave) ?? [];
      if (!lista.some(x => x.nome === r.nome_dep && x.data === r.data_debate)) {
        lista.push({ nome: r.nome_dep, data: r.data_debate ?? '' });
      }
      indice.set(chave, lista);
    }

    if (data.length < 1000) break;
  }

  for (const lista of indice.values()) lista.sort((a, b) => a.data.localeCompare(b.data));
  return indice;
}

/** Palavras sem valor distintivo ao comparar dois nomes de cargo. */
const VAZIAS = new Set(['de', 'do', 'da', 'dos', 'das', 'e', 'o', 'a']);

const tokens = (cargo) => new Set(
  cargo.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().split(/[^a-z]+/).filter(t => t && !VAZIAS.has(t)),
);

/**
 * O mesmo cargo escrito de duas maneiras é o mesmo cargo: o DAR alterna
 * "Secretário de Estado Adjunto da Política da Defesa Nacional" com
 * "...Adjunto e da Política da Defesa Nacional", e tem gralhas ("Ministro
 * Ajunto"). Compara pelas palavras com conteúdo, tolerando uma diferente.
 */
function cargoSemelhante(alvo, candidato) {
  const a = tokens(alvo), b = tokens(candidato);
  if (!a.size || !b.size) return false;
  const comuns = [...a].filter(t => b.has(t)).length;
  const maior = Math.max(a.size, b.size);
  return comuns >= maior - 1 && comuns / maior >= 0.7;
}

/**
 * Titulares em vigor numa data — para cada cargo, a pessoa nomeada mais
 * próxima no tempo, preferindo uma nomeação anterior ou do próprio dia
 * (a posterior só serve quando não há nenhuma antes).
 */
export function titularesNaData(indice, data) {
  const alvo = data ?? '';
  const mapa = new Map();

  for (const [cargo, lista] of indice) {
    let escolhido = null;
    for (const item of lista) {
      if (item.data <= alvo) escolhido = item;          // a mais recente até à data
      else if (!escolhido) { escolhido = item; break; } // nenhuma antes: a primeira a seguir
      else break;
    }
    if (escolhido) mapa.set(cargo, escolhido.nome);
  }

  return mapa;
}

/**
 * O titular de um cargo numa data, aceitando variações na escrita do cargo.
 * Usar isto em vez de `mapa.get(cargo)` quando o cargo vem do texto do DAR.
 */
export function titularDoCargo(mapa, cargo) {
  if (!cargo) return null;
  const chave = cargo.toLowerCase().replace(/\s+/g, ' ').trim();
  const exacto = mapa.get(chave);
  if (exacto) return exacto;

  for (const [outro, nome] of mapa) {
    if (cargoSemelhante(chave, outro)) return nome;
  }
  return null;
}
