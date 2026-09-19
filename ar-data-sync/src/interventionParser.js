/**
 * Parseia transcrições do DAR e extrai as intervenções individuais.
 *
 * Estratégia em dois passos:
 *  1. Detectar TODOS os marcadores de mudança de orador — incluindo os que
 *     aparecem a meio da linha (apartes) — para dividir o texto correctamente.
 *  2. Classificar cada fatia: deputado, presidência da sessão ou membro do
 *     Governo. Oradores que não caiam em nenhum dos três servem só de
 *     fronteira e não são emitidos.
 *
 * Formatos típicos do DAR:
 *   "O Sr. Nome Sobrenome (SIGLA): — texto"        ← deputado
 *   "O Sr. Presidente: — texto"                    ← quem preside, sem nome
 *   "A Sr.ª Presidente (Nome): — texto"            ← quem preside, nomeado
 *   "O Sr. Ministro da Justiça (Nome): — texto"    ← Governo
 *
 * Quem preside não se identifica em cada turno: o DAR nomeia-o no cabeçalho
 * ("Presidente: Ex.mo Sr. …") e só volta a nomeá-lo quando a presidência
 * muda. Por isso acompanhamos quem está na cadeira ao longo da sessão — sem
 * isso, o orador que mais fala em cada sessão ficava sem registo nenhum.
 */

// Títulos reconhecidos no início de turno de palavra
const TITULOS = [
  'O Sr\\.', 'A Sr\\.ª', 'A Sra\\.', 'O Senhor', 'A Senhora',
  'O Ministro', 'A Ministra', 'O Secretário', 'A Secretária',
  'O Presidente', 'A Presidente',
].join('|');

/** Cargos da Mesa: o que estiver entre parêntesis é a pessoa, não um grupo parlamentar. */
const CARGOS_PRESIDENCIA = new Set([
  'presidente', 'vice-presidente',
  'secretário', 'secretária', 'vice-secretário', 'vice-secretária',
  'secretário da mesa', 'secretária da mesa',
]);

/** Cargos do Governo — idem: o parêntesis traz o nome de quem exerce o cargo. */
const RE_CARGO_GOVERNO = /^(?:vice-)?(?:primeiro-ministr[oa]|ministr[oa]\b|secretári[oa] de estado|subsecretári[oa])/i;

/**
 * Nem tudo o que começa por "Ministra" é um cargo: quando um deputado diz
 * "A Sr.ª Ministra está quase no Chega!" a meio da fala, o marcador de
 * orador apanha a frase inteira e nascia daí um governante chamado
 * "Ministra está quase no Chega! O Sr. Presidente". Um cargo não leva
 * pontuação de frase nem passa de meia dúzia de palavras.
 */
const cargoPlausivel = (etiqueta = '') =>
  !/[!?;:]/.test(etiqueta) && etiqueta.split(/\s+/).length <= 9;

/**
 * Um marcador de mudança de orador. Aceita início de linha ou meio de linha
 * (apartes como "… Aplausos do PS. O Sr. Fulano (PS): — O pacote já caiu!"),
 * que antes só serviam para cortar a fala anterior e desapareciam.
 */
const MARCADOR = `(?:${TITULOS})[^\\n:]{0,80}?(?:\\s*\\([^)\\n]{1,40}\\))?\\s*:\\s*[—\\-–]`;
const RE_MARCADOR_GLOBAL = new RegExp(`(?:^|\\n|(?<=\\s))${MARCADOR}`, 'g');

/** Cabeçalho da fatia: título + nome/cargo + (parêntesis opcional). */
const RE_CABECALHO = new RegExp(
  `^\\s*(?:${TITULOS})\\s*([^()\\n:]{2,70}?)\\s*(?:\\(([^)\\n]{1,40})\\))?\\s*:\\s*[—\\-–]`
);

/** Uma sigla de grupo parlamentar não tem espaços e é toda em maiúsculas (PS, CDS-PP, PSD/CDS). */
const ehSiglaGP = (s) => !!s && !/\s/.test(s) && s === s.toUpperCase() && /[A-ZÀ-Ú]/.test(s);

const normalizarCargo = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Nome de quem abre a sessão na cadeira da presidência, lido do cabeçalho do
 * DAR ("Presidente: Ex.mo Sr. José Pedro Correia de Aguiar-Branco").
 * Só procura no cabeçalho, para não confundir com um turno de palavra.
 */
export function extrairPresidenteDaSessao(transcricao) {
  if (!transcricao) return null;
  const m = transcricao.slice(0, 3000).match(/Presidente:\s*Ex\.?\s*m[oa]\.?\s*Sr\.?ª?\s*([^\n]{5,70})/);
  return m ? (m[1].replace(/\s+/g, ' ').trim() || null) : null;
}

/**
 * Classifica uma fatia de texto que começa num marcador de orador.
 * Devolve `null` quando o orador não é identificável (fica só como fronteira).
 *
 * `titulares` (cargo normalizado → nome) acompanha quem exerce cada cargo ao
 * longo da sessão: tanto a presidência como o Governo são nomeados à primeira
 * intervenção e passam a aparecer só pelo cargo daí em diante. É por cargo e
 * não uma variável única porque "O Sr. Secretário (Fulano)" não faz de Fulano
 * o presidente da sessão.
 */
function classificar(fatia, titulares) {
  const m = RE_CABECALHO.exec(fatia);
  if (!m) return null;

  const etiqueta  = m[1].replace(/\s+/g, ' ').trim();
  const parentese = m[2]?.replace(/\s+/g, ' ').trim() || null;
  const texto     = fatia.slice(m.index + m[0].length).trim();
  if (!texto) return null;

  const cargo = normalizarCargo(etiqueta);

  // Presidência da sessão — o parêntesis, quando existe, nomeia quem assumiu
  // a cadeira; sem ele, continua quem lá estava.
  if (CARGOS_PRESIDENCIA.has(cargo)) {
    const nome = parentese ?? titulares.get(cargo);
    if (!nome) return null;   // ninguém identificado ainda → não inventamos
    return { nome, partido: null, cargo: etiqueta, papel: 'presidencia', texto, registar: parentese ? { cargo, nome: parentese } : null };
  }

  // Governo — "Ministro da Justiça (Rita Alarcão Júdice)". O nome da pessoa
  // vai para `nome_dep` e o cargo para o seu próprio campo; antes o cargo
  // ficava como nome do orador e a pessoa aparecia no campo do partido.
  // Quando a sessão já o nomeou, os turnos seguintes só trazem o cargo.
  if (RE_CARGO_GOVERNO.test(etiqueta) && cargoPlausivel(etiqueta)) {
    const nome = parentese ?? titulares.get(cargo) ?? etiqueta;
    return { nome, partido: null, cargo: etiqueta, papel: 'governo', texto, registar: parentese ? { cargo, nome: parentese } : null };
  }

  // Deputado — só quando o parêntesis é mesmo uma sigla de grupo parlamentar.
  if (parentese && ehSiglaGP(parentese)) {
    return { nome: etiqueta, partido: parentese, cargo: null, papel: 'deputado', texto };
  }

  return null;
}

/**
 * Percorre a transcrição e devolve as intervenções pela ordem em que ocorrem,
 * cada uma com a posição onde começa. Núcleo partilhado por
 * `parsearIntervencoes` e `indexarPaginasTranscricao` — os índices têm de
 * bater certo entre os dois (são o sufixo `_i` do id da intervenção).
 */
function extrairIntervencoes(transcricao, titularesGoverno = new Map()) {
  if (!transcricao) return [];

  const posicoes = [];
  RE_MARCADOR_GLOBAL.lastIndex = 0;
  let m;
  while ((m = RE_MARCADOR_GLOBAL.exec(transcricao)) !== null) posicoes.push(m.index);
  if (!posicoes.length) return [];
  posicoes.push(transcricao.length); // sentinela

  // Titulares do Governo conhecidos de outras sessões: há sessões em que o
  // DAR nunca nomeia o ministro, e sem isto ficava "Ministra do Ambiente e
  // Energia" como nome do orador, separada da pessoa. Só para o Governo — a
  // presidência muda de sessão para sessão e tem de vir sempre do texto.
  const titulares = new Map(titularesGoverno);
  const presidenteInicial = extrairPresidenteDaSessao(transcricao);
  if (presidenteInicial) titulares.set('presidente', presidenteInicial);

  const resultado = [];

  for (let i = 0; i < posicoes.length - 1; i++) {
    const inicio = posicoes[i];
    const item = classificar(transcricao.slice(inicio, posicoes[i + 1]), titulares);
    if (!item) continue;
    if (item.registar) titulares.set(item.registar.cargo, item.registar.nome);
    resultado.push({
      inicio, nome: item.nome, partido: item.partido,
      cargo: item.cargo, papel: item.papel, texto: item.texto,
    });
  }

  return resultado;
}

/**
 * Constrói um Map de índice de intervenção (_i) para número de página aproximado.
 * Os números de página aparecem como \n{N}\n no texto extraído do DAR.
 *
 * @param {string} transcricao
 * @returns {Map<number, number>}  _i → pagina
 */
export function indexarPaginasTranscricao(transcricao, titularesGoverno) {
  if (!transcricao) return new Map();

  const pageMarkers = [];
  for (const m of transcricao.matchAll(/\n(\d{1,3})\n/g)) {
    pageMarkers.push({ pg: parseInt(m[1], 10), idx: m.index });
  }
  const paginaEm = (pos) => {
    let pg = 1;
    for (const { pg: p, idx } of pageMarkers) {
      if (idx > pos) break;
      pg = p;
    }
    return pg;
  };

  const paginaPorI = new Map();
  extrairIntervencoes(transcricao, titularesGoverno).forEach((iv, i) => paginaPorI.set(i, paginaEm(iv.inicio)));
  return paginaPorI;
}

/**
 * Dado o texto completo de uma transcrição do DAR, devolve todas as
 * intervenções identificáveis — de deputados, de quem preside e de membros
 * do Governo, distinguidas por `papel`.
 *
 * @param {string} transcricao
 * @returns {{ nome: string, partido: string|null, cargo: string|null, papel: 'deputado'|'presidencia'|'governo', texto: string }[]}
 */
export function parsearIntervencoes(transcricao, titularesGoverno) {
  return extrairIntervencoes(transcricao, titularesGoverno).map(({ nome, partido, cargo, papel, texto }) => ({
    nome, partido, cargo, papel, texto,
  }));
}
