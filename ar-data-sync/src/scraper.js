/**
 * Scraper do DAR (Diário da Assembleia da República).
 *
 * O texto de cada sessão está em:
 *   https://debates.parlamento.pt/catalogo/r3/dar/01/17/01/007/2025-07-03/{pagina}
 *
 * O campo URLDiario de cada debate tem o URL da primeira página + range de páginas:
 *   https://debates.parlamento.pt/catalogo/r3/dar/.../3?pgs=3-16&org=PLC
 *
 * Este módulo:
 *   1. Extrai a URL base e o range de páginas
 *   2. Faz fetch de cada página
 *   3. Extrai o texto do elemento #pageTextRaw
 *   4. Devolve o texto completo concatenado
 */

const PAGE_TIMEOUT = 30_000;

/**
 * Extrai o texto de uma página do DAR a partir do HTML.
 * O texto está em parágrafos <p> dentro de #pageTextRaw.
 */
function extrairTexto(html) {
  // Encontrar o bloco #pageTextRaw
  const match = html.match(/id="pageTextRaw"[^>]*>([\s\S]*?)<\/div>/);
  if (!match) return '';

  const inner = match[1];

  // Extrair conteúdo dos <p>
  const paragrafos = [];
  const re = /<p[^>]*>([\s\S]*?)<\/p>/g;
  let m;
  while ((m = re.exec(inner)) !== null) {
    const texto = m[1]
      .replace(/<[^>]+>/g, '')   // remover HTML interno
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .trim();
    if (texto) paragrafos.push(texto);
  }

  return paragrafos.join('\n');
}

/**
 * Faz fetch de uma página do DAR e devolve o texto.
 */
async function fetchPagina(url) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(PAGE_TIMEOUT),
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ParlamentoBot/1.0)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
  const html = await res.text();
  return extrairTexto(html);
}

/**
 * Dado o URLDiario de um debate, descarrega e devolve a transcrição completa.
 *
 * @param {string} urlDiario - ex: "https://debates.parlamento.pt/.../3?pgs=3-16&org=PLC"
 * @returns {string|null} - texto completo ou null se falhar
 */
/**
 * Dado o URLDiario de um debate, descarrega e devolve a transcrição completa.
 *
 * O URL do tipo ".../007/2025-07-03/3?pgs=3-16&org=PLC" aponta para um único
 * artigo do Diário que já contém todas as páginas do debate (/3 é o id do
 * artigo, não o número de página iterável). Basta fazer um único fetch.
 *
 * @param {string} urlDiario
 * @returns {string|null}
 */
export async function obterTranscricao(urlDiario) {
  if (!urlDiario) return null;

  try {
    const texto = await fetchPagina(urlDiario);
    return texto || null;
  } catch (err) {
    console.warn(`    ⚠ Erro ao obter transcrição: ${err.message}`);
    return null;
  }
}
