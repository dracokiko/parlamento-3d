/**
 * Scraper do DAR (Diário da Assembleia da República).
 *
 * O texto vem do HTML da própria página da sessão, pedida com `sft=true`
 * (show full text): uma resposta única com o debate inteiro e os números de
 * página pelo meio, que é o que o indexador de intervenções procura.
 *
 * Havia aqui um segundo caminho, o `POST /pagina/export`, que devolvia o PDF
 * da sessão e era o principal — o HTML era só o plano B. Saiu em 22/09/2026:
 * o robots.txt do site proíbe `/pagina/export` e `/pagina/showPDFPage`.
 *
 * Não se perdeu nada. Comparadas três sessões já guardadas com o que o HTML
 * devolve hoje, o texto bate quase ao carácter (106 336 contra 106 336 numa
 * delas; 273 431 contra 273 432 noutra) e com o mesmo número de marcadores de
 * página. E passou a ser um pedido por sessão, em vez de dois.
 */

import { fetchDebates, comTextoIntegral } from './debatesAR.js';

// ── Extracção do texto ────────────────────────────────────────────────────────

export function extrairTextoHtml(html) {
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

/** Remove o parâmetro `org` do URL, ou null se não existir. */
function semParamOrg(urlStr) {
  const u = new URL(urlStr);
  if (!u.searchParams.has('org')) return null;
  u.searchParams.delete('org');
  return u.toString();
}

/**
 * Dado o URLDiario de um debate, descarrega e devolve a transcrição completa.
 *
 * @param {string} urlDiario
 * @returns {string|null}
 */
export async function obterTranscricao(urlDiario) {
  if (!urlDiario) return null;

  try {
    let html;
    try {
      html = await fetchDebates(comTextoIntegral(urlDiario));
    } catch (err) {
      // debates.parlamento.pt devolve 404 para alguns URLs com `org=` (ex.: "org=PLC")
      // mesmo vindo directamente da própria API da AR — confirmado em produção: o
      // mesmo URL sem esse parâmetro funciona. Antes de desistir, tenta uma vez sem ele.
      const semOrg = semParamOrg(urlDiario);
      if (!semOrg) throw err;
      console.warn(`    ⚠ ${err.message} — a tentar sem "org="...`);
      html = await fetchDebates(comTextoIntegral(semOrg));
    }

    return extrairTextoHtml(html) || null;

  } catch (err) {
    console.warn(`    ⚠ Erro ao obter transcrição: ${err.message}`);
    return null;
  }
}
