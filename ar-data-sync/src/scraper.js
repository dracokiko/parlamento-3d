/**
 * Scraper do DAR (Diário da Assembleia da República).
 *
 * Usa o endpoint POST /pagina/export do debates.parlamento.pt para descarregar
 * o PDF completo do artigo (debate) em UMA única operação.
 *
 * Estratégia:
 *   1. Fetch do HTML da página do debate (tem um <form> com os campos necessários)
 *   2. Extrair os campos hidden do form (periodo, serie, legis, pgs, limits, …)
 *   3. POST para /pagina/export → recebe PDF completo
 *   4. Parsear o PDF com pdf-parse → texto completo sem páginas em falta
 */

import { createRequire } from 'module';
const require  = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

const EXPORT_URL   = 'https://debates.parlamento.pt/pagina/export';
const PAGE_TIMEOUT = 20_000;
const PDF_TIMEOUT  = 90_000;

// ── Extracção dos campos do formulário ────────────────────────────────────────

/**
 * Extrai o valor de um campo hidden do form de exportação.
 * Aceita tanto name="x" value="y" como value="y" name="x".
 */
function campo(html, name) {
  const a = html.match(new RegExp(`name="${name}"[^>]*value="([^"]*)"`, 'i'));
  const b = html.match(new RegExp(`value="([^"]*)"[^>]*name="${name}"`, 'i'));
  return (a || b)?.[1] ?? null;
}

/**
 * Extrai todos os campos relevantes do form de exportação da página HTML.
 * Devolve null se a página não tiver o form (ex: não é uma página do DAR).
 */
export function extrairCamposForm(html) {
  const periodo    = campo(html, 'periodo');
  const publicacao = campo(html, 'publicacao');
  const serie      = campo(html, 'serie');
  const legis      = campo(html, 'legis');
  const sessao     = campo(html, 'sessao');
  const numero     = campo(html, 'numero');
  const data       = campo(html, 'data');
  const pagina     = campo(html, 'pagina');
  const pgs        = campo(html, 'pgs');    // ex: "3-16"
  const limits     = campo(html, 'limits'); // ex: "0001-0062"

  if (!periodo || !publicacao || !numero || !data) return null;

  return { periodo, publicacao, serie, legis, sessao, numero, data, pagina, pgs, limits };
}

// ── Download do PDF via POST ──────────────────────────────────────────────────

/**
 * Faz POST para /pagina/export e devolve o texto extraído do PDF.
 *
 * @param {object} campos  - campos extraídos do form (de extrairCamposForm)
 * @param {string} referer - URL da página de origem (para o header Referer)
 */
async function exportarPdf(campos, referer) {
  const pgsMatch = campos.pgs?.match(/(\d+)-(\d+)/);
  const paginaInicial = pgsMatch?.[1] ?? '1';
  const paginaFinal   = pgsMatch?.[2] ?? (campos.limits?.match(/\d+$/)?.[0] ?? '100');

  const body = new URLSearchParams({
    exportType:    'pdf',
    exportControl: 'paginas',
    periodo:       campos.periodo,
    publicacao:    campos.publicacao,
    serie:         campos.serie    ?? '01',
    legis:         campos.legis    ?? '17',
    sessao:        campos.sessao   ?? '01',
    numero:        campos.numero,
    data:          campos.data,
    pagina:        campos.pagina   ?? '1',
    paginaInicial,
    paginaFinal,
  });

  const res = await fetch(EXPORT_URL, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent':   'Mozilla/5.0 (compatible; ParlamentoBot/1.0)',
      'Referer':      referer,
    },
    body:   body.toString(),
    signal: AbortSignal.timeout(PDF_TIMEOUT),
  });

  if (!res.ok) throw new Error(`Export HTTP ${res.status}`);
  const buf      = Buffer.from(await res.arrayBuffer());
  const { text } = await pdfParse(buf);
  return text?.trim() ?? '';
}

// ── Fallback: extracção HTML ──────────────────────────────────────────────────

function extrairTextoHtml(html) {
  const markerIdx = html.indexOf('id="pageTextRaw"');
  if (markerIdx === -1) return '';

  const divStart = html.lastIndexOf('<div', markerIdx);
  if (divStart === -1) return '';

  let depth = 0, pos = divStart, section = '';
  while (pos < html.length) {
    const nextOpen  = html.indexOf('<div',  pos);
    const nextClose = html.indexOf('</div>', pos);
    if (nextClose === -1) break;
    if (nextOpen !== -1 && nextOpen < nextClose) { depth++; pos = nextOpen + 4; }
    else {
      depth--;
      if (depth === 0) { section = html.slice(divStart, nextClose + 6); break; }
      pos = nextClose + 6;
    }
  }
  if (!section) section = html.slice(divStart);

  const paragrafos = [];
  const re = /<p[^>]*>([\s\S]*?)<\/p>/g;
  let m;
  while ((m = re.exec(section)) !== null) {
    const texto = m[1]
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
      .trim();
    if (texto) paragrafos.push(texto);
  }
  return paragrafos.join('\n');
}

// ── Entrada pública ───────────────────────────────────────────────────────────

/**
 * Dado o URLDiario de um debate, descarrega e devolve a transcrição completa.
 *
 * @param {string} urlDiario
 * @returns {string|null}
 */
export async function obterTranscricao(urlDiario) {
  if (!urlDiario) return null;

  try {
    const res = await fetch(urlDiario, {
      signal:  AbortSignal.timeout(PAGE_TIMEOUT),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ParlamentoBot/1.0)' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    // Tentar exportação PDF (abordagem principal)
    const campos = extrairCamposForm(html);
    if (campos?.pgs) {
      try {
        const texto = await exportarPdf(campos, urlDiario);
        if (texto) return texto;
      } catch (e) {
        console.warn(`    ⚠ Export PDF falhou (${e.message}), a usar HTML...`);
      }
    }

    // Fallback: texto da página HTML visível
    return extrairTextoHtml(html) || null;

  } catch (err) {
    console.warn(`    ⚠ Erro ao obter transcrição: ${err.message}`);
    return null;
  }
}
