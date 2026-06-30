/**
 * Parseia transcrições do DAR e extrai intervenções individuais por deputado.
 *
 * Estratégia em dois passos:
 *  1. Detectar TODOS os marcadores de mudança de orador (incluindo Presidente de
 *     sessão, membros do Governo, etc.) para dividir o texto correctamente.
 *  2. Emitir apenas as intervenções de oradores que tenham sigla de GP em parêntesis.
 *
 * Formato típico do DAR:
 *   "O Sr. Nome Sobrenome (SIGLA): — texto do discurso"
 *   "A Sr.ª Nome Sobrenome (SIGLA): — texto do discurso"
 *   "O Sr. Presidente: — texto"           ← sem sigla → divide mas não emite
 *   "O Sr. Ministro Tal: — texto"          ← sem sigla → divide mas não emite
 */

// Títulos reconhecidos no início de turno de palavra
const TITULOS = [
  'O Sr\\.', 'A Sr\\.ª', 'A Sra\\.', 'O Senhor', 'A Senhora',
  'O Ministro', 'A Ministra', 'O Secretário', 'A Secretária',
  'O Presidente', 'A Presidente',
].join('|');

// Detecta o início de QUALQUER intervenção (com ou sem sigla de GP)
const RE_QUALQUER = new RegExp(
  `(?:^|\\n)\\s*(?:${TITULOS})[^\\n:]{0,80}?(?:\\s*\\([^)\\n]{1,25}\\))?\\s*:\\s*[—\\-–]`,
  'g'
);

// Detecta apenas intervenções de deputados (têm sigla de GP em parêntesis)
const RE_DEPUTADO = new RegExp(
  `(?:^|\\n)\\s*(?:O Sr\\.|A Sr\\.ª|A Sra\\.)\\s+([^()\\n]{2,60}?)\\s*\\(([^)\\n]{1,20})\\)\\s*:\\s*[—\\-–]`,
  'g'
);

// Marcador de orador inline — sem exigir \n, para truncar falas que contêm
// mudanças de orador numa só linha (interjeiçõoes no meio do texto)
const RE_INLINE_ORADOR = new RegExp(
  `\\s+(?:${TITULOS})[^:]{0,80}?(?:\\([^)]{1,25}\\))?\\s*:\\s*[—\\-–]`
);

/**
 * Constrói um Map de índice de intervenção (_i) para número de página aproximado.
 * Os números de página aparecem como \n{N}\n no texto extraído do DAR.
 *
 * @param {string} transcricao
 * @returns {Map<number, number>}  _i → pagina
 */
export function indexarPaginasTranscricao(transcricao) {
  if (!transcricao) return new Map();

  // Marcadores de página: \n{1-3 dígitos}\n
  const pageMarkers = [];
  for (const m of transcricao.matchAll(/\n(\d{1,3})\n/g)) {
    pageMarkers.push({ pg: parseInt(m[1], 10), idx: m.index });
  }
  const paginaEm = pos => {
    let pg = 1;
    for (const { pg: p, idx } of pageMarkers) {
      if (idx > pos) break;
      pg = p;
    }
    return pg;
  };

  // Posições de todos os oradores (mesmo os sem sigla de GP)
  const todos = [];
  RE_QUALQUER.lastIndex = 0;
  let m;
  while ((m = RE_QUALQUER.exec(transcricao)) !== null) todos.push(m.index);
  todos.push(transcricao.length);

  const paginaPorI = new Map();
  let di = 0; // índice entre os deputados (= sufixo _i no id)
  for (let i = 0; i < todos.length - 1; i++) {
    const fatia = transcricao.slice(todos[i], todos[i + 1]);
    RE_DEPUTADO.lastIndex = 0;
    if (!RE_DEPUTADO.exec(fatia)) continue;
    paginaPorI.set(di, paginaEm(todos[i]));
    di++;
  }
  return paginaPorI;
}

/**
 * Dado o texto completo de uma transcrição do DAR, devolve todas as intervenções
 * de deputados (com sigla de GP).
 *
 * @param {string} transcricao
 * @returns {{ nome: string, partido: string, texto: string }[]}
 */
export function parsearIntervencoes(transcricao) {
  if (!transcricao) return [];

  // Passo 1: encontrar posições de TODOS os marcadores de orador
  const todos = [];
  RE_QUALQUER.lastIndex = 0;
  let m;
  while ((m = RE_QUALQUER.exec(transcricao)) !== null) {
    todos.push(m.index);
  }
  todos.push(transcricao.length); // sentinela final

  if (todos.length <= 1) return [];

  // Passo 2: para cada fatia, verificar se é de um deputado (tem sigla GP)
  const resultado = [];
  for (let i = 0; i < todos.length - 1; i++) {
    const fatia = transcricao.slice(todos[i], todos[i + 1]);

    RE_DEPUTADO.lastIndex = 0;
    const match = RE_DEPUTADO.exec(fatia);
    if (!match) continue; // não é deputado identificável → descarta

    const nome    = match[1].replace(/\s+/g, ' ').trim();
    const partido = match[2].trim();

    // Texto da fala = tudo após o marcador "NOME (SIGLA): —"
    // Truncar no primeiro marcador de orador inline (mudança de linha sem \n)
    const fimMarcador = match.index + match[0].length;
    const raw         = fatia.slice(fimMarcador);
    const inlineCorte = raw.search(RE_INLINE_ORADOR);
    const texto       = (inlineCorte > 0 ? raw.slice(0, inlineCorte) : raw).trim();

    if (!texto) continue;

    resultado.push({ nome, partido, texto });
  }

  return resultado;
}
