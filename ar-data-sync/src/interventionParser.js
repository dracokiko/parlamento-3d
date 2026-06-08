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
  `(?:^|\\n)\\s*(?:${TITULOS})\\b[^\\n:]{0,80}?(?:\\s*\\([^)\\n]{1,25}\\))?\\s*:\\s*[—\\-–]`,
  'g'
);

// Detecta apenas intervenções de deputados (têm sigla de GP em parêntesis)
const RE_DEPUTADO = new RegExp(
  `(?:^|\\n)\\s*(?:O Sr\\.|A Sr\\.ª|A Sra\\.)\\s+([^()\\n]{2,60}?)\\s*\\(([^)\\n]{1,20})\\)\\s*:\\s*[—\\-–]`,
  'g'
);

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
    const fimMarcador = match.index + match[0].length;
    const texto       = fatia.slice(fimMarcador).trim();

    if (!texto) continue;

    resultado.push({ nome, partido, texto });
  }

  return resultado;
}
