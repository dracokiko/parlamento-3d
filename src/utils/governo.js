/**
 * Ordem de precedência do Governo.
 *
 * Tal como a Mesa segue o Regimento, a bancada do Governo segue a ordem por
 * que o Governo é nomeado e listado — não o número de intervenções, que era
 * o critério anterior e não quer dizer nada protocolarmente.
 *
 * Esta é a composição do XXV Governo Constitucional (Decreto-Lei n.º
 * 87-A/2025). Quando o Governo mudar, é esta lista que muda: ao contrário da
 * Mesa, cujos cargos a AR publica nos seus dados, não há fonte de dados do
 * Governo no que sincronizamos — só os cargos que o DAR menciona quando
 * alguém fala.
 */
export const PRECEDENCIA_GOVERNO = [
  'Primeiro-Ministro',
  'Ministro de Estado e dos Negócios Estrangeiros',
  'Ministro de Estado e das Finanças',
  'Ministro da Presidência',
  'Ministro da Economia e da Coesão Territorial',
  'Ministro Adjunto e da Reforma do Estado',
  'Ministro dos Assuntos Parlamentares',
  'Ministro da Defesa Nacional',
  'Ministro das Infraestruturas e Habitação',
  'Ministro da Justiça',
  'Ministro da Administração Interna',
  'Ministro da Educação, Ciência e Inovação',
  'Ministro da Saúde',
  'Ministro do Trabalho, Solidariedade e Segurança Social',
  'Ministro do Ambiente e Energia',
  'Ministro da Cultura, Juventude e Desporto',
  'Ministro da Agricultura e Mar',
];

/** Palavras sem valor distintivo ao comparar dois nomes de cargo. */
const VAZIAS = new Set(['de', 'do', 'da', 'dos', 'das', 'e', 'o', 'a', 'ministro', 'ministra', 'estado', 'secretario', 'secretaria', 'adjunto', 'adjunta']);

const tokens = (cargo = '') => new Set(
  cargo.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().split(/[^a-z]+/).filter(t => t && !VAZIAS.has(t)),
);

const ehPrimeiroMinistro = (cargo = '') => /^(?:vice-)?primeiro-ministr/i.test(cargo);
const ehSecretarioEstado = (cargo = '') => /secret[áa]ri[oa]\s+de\s+estado|subsecret/i.test(cargo);

/**
 * Qual das pastas oficiais este cargo é, comparando pelas palavras com
 * conteúdo. O DAR escreve o mesmo cargo de várias maneiras ("Ministro de
 * Estado das Finanças", "Ministro das Finanças") e tem gralhas, por isso não
 * dá para comparar texto com texto.
 */
function pastaMaisProxima(cargo) {
  const alvo = tokens(cargo);
  if (!alvo.size) return -1;

  let melhor = -1;
  let melhorPontos = 0;

  PRECEDENCIA_GOVERNO.forEach((oficial, i) => {
    const b = tokens(oficial);
    const comuns = [...alvo].filter(t => b.has(t)).length;
    if (!comuns) return;
    const pontos = comuns / Math.max(alvo.size, b.size);
    if (pontos > melhorPontos) { melhorPontos = pontos; melhor = i; }
  });

  return melhorPontos >= 0.34 ? melhor : -1;
}

/**
 * Posição de um membro na bancada. Primeiro o Primeiro-Ministro, depois os
 * ministros pela ordem oficial, depois os secretários de Estado logo a
 * seguir à pasta a que pertencem, e por fim quem não encaixa em nenhuma.
 */
export function precedenciaDoCargo(cargo = '') {
  if (ehPrimeiroMinistro(cargo)) return 0;

  const pasta = pastaMaisProxima(cargo);
  if (ehSecretarioEstado(cargo)) return pasta < 0 ? 800 : 100 + pasta;
  if (pasta < 0) return 900;                      // cargo irreconhecível: fica no fim
  return pasta;
}

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

/** Ordena uma lista de membros do Governo pela precedência oficial. */
export function ordenarPorPrecedencia(membros) {
  return [...membros].sort((a, b) =>
    precedenciaDoCargo(a.cargo) - precedenciaDoCargo(b.cargo) ||
    (a.cargo ?? '').localeCompare(b.cargo ?? '', 'pt') ||
    a.nome.localeCompare(b.nome, 'pt'),
  );
}
