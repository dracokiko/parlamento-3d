/**
 * Crawler do catálogo de debates do DAR (debates.parlamento.pt).
 *
 * Descobre todos os artigos do Diário da AR (série I, XVII legislatura)
 * que correspondem a debates substantivos (artigos com vários intervenientes).
 *
 * Estratégia:
 *   1. Listar todos os números do DAR na sessão actual
 *   2. Para cada número, listar as páginas dos artigos
 *   3. Para cada artigo, obter o range de páginas (prettyLinkExtraParams)
 *   4. Artigos com ≥ 3 páginas são debates; os restantes são páginas de rotina
 *   5. Upsert na tabela ar_debates
 */

import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { extrairCamposForm } from './scraper.js';

const BASE    = 'https://debates.parlamento.pt';
const TIMEOUT = 15_000;
const DELAY   = 600; // ms entre pedidos — evita rate limit

let _client = null;
const db = () => {
  if (!_client) _client = createClient(SUPABASE_URL, SUPABASE_KEY);
  return _client;
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchHtml(url) {
  const res = await fetch(url, {
    signal:  AbortSignal.timeout(TIMEOUT),
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ParlamentoBot/1.0)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

const RE_ORG = /org=([A-Z]+)/;

/** Lista todos os números do DAR disponíveis no catálogo. */
async function listarNumerosDar() {
  const html = await fetchHtml(`${BASE}/catalogo/r3/dar/01/17/01`);
  const vistos = new Set();
  const numeros = [];
  for (const m of html.matchAll(/href="\/catalogo\/r3\/dar\/01\/17\/01\/(\d+)\/([0-9-]+)"/g)) {
    const chave = `${m[1]}_${m[2]}`;
    if (!vistos.has(chave)) {
      vistos.add(chave);
      numeros.push({ numero: m[1], data: m[2] });
    }
  }
  return numeros.sort((a, b) => a.numero.localeCompare(b.numero));
}

/** Para um número do DAR, devolve os IDs dos artigos existentes na BD. */
async function idsExistentes(numero) {
  const { data } = await db()
    .from('ar_debates')
    .select('id')
    .like('id', `dar_${numero}_%`);
  return new Set((data ?? []).map(r => r.id));
}

/** Extrai os números de página (artigos) listados na página de um número do DAR. */
async function listarPaginasDoNumero(numero, data) {
  const html = await fetchHtml(`${BASE}/catalogo/r3/dar/01/17/01/${numero}/${data}`);
  const pags = new Set();
  for (const m of html.matchAll(/href="\/catalogo\/r3\/dar\/01\/17\/01\/\d+\/[^\/]+\/(\d+)[^"]*"/g)) {
    pags.add(parseInt(m[1], 10));
  }
  return [...pags].sort((a, b) => a - b);
}

/** Obtém os metadados de um artigo usando os campos hidden do form de exportação. */
async function metadadosArtigo(numero, dataIssue, pagina) {
  const url  = `${BASE}/catalogo/r3/dar/01/17/01/${numero}/${dataIssue}/${pagina}`;
  const html = await fetchHtml(url);

  // O campo hidden <input name="pgs" value="3-16"> dá-nos o range do artigo
  const campos = extrairCamposForm(html);
  if (!campos?.pgs) return null;

  const pgsMatch = campos.pgs.match(/(\d+)-(\d+)/);
  if (!pgsMatch) return null;

  const pagInicio = parseInt(pgsMatch[1], 10);
  const pagFim    = parseInt(pgsMatch[2], 10);
  if (pagFim - pagInicio < 2) return null; // demasiado curto

  return {
    pagInicio,
    pagFim,
    urlDiario: `${BASE}/catalogo/r3/dar/01/17/01/${numero}/${dataIssue}/${pagina}?pgs=${pagInicio}-${pagFim}&org=PLC`,
  };
}

/**
 * Crawl principal: descobre artigos novos em todos os números do DAR
 * e faz upsert na tabela ar_debates.
 *
 * Só processa artigos cujo ID ainda não existe na BD.
 */
export async function crawlerDebatesDAR() {
  console.log('\n  [DAR-CRAWL] A descobrir artigos no catálogo do DAR...');

  const numeros = await listarNumerosDar();
  console.log(`  [DAR-CRAWL] ${numeros.length} números encontrados`);

  let novos = 0, ignorados = 0, erros = 0;

  for (const { numero, data } of numeros) {
    let paginas;
    try {
      paginas = await listarPaginasDoNumero(numero, data);
      await sleep(DELAY);
    } catch (e) {
      console.warn(`  ⚠ Nº ${numero}: ${e.message}`);
      erros++;
      continue;
    }

    // IDs já existentes para este número → skip
    const existentes = await idsExistentes(numero);

    for (const pg of paginas) {
      const id = `dar_${numero}_${pg}`;
      if (existentes.has(id)) { ignorados++; continue; }

      await sleep(DELAY);
      try {
        const meta = await metadadosArtigo(numero, data, pg);
        if (!meta) { ignorados++; continue; }

        const { error } = await db().from('ar_debates').upsert({
          id,
          data_debate:  data,
          sessao:       '01',
          legislatura:  'XVII',
          url_diario:   meta.urlDiario,
          // assunto, transcricao e resumo_ia preenchidos nas fases seguintes
        }, { onConflict: 'id', ignoreDuplicates: true });

        if (error) { erros++; }
        else        { novos++; process.stdout.write(`  [DAR-CRAWL] ${novos} novos artigos\r`); }

      } catch (e) {
        console.warn(`  ⚠ Artigo ${numero}/${data}/${pg}: ${e.message}`);
        erros++;
      }
    }
  }

  console.log(`\n  [DAR-CRAWL] Concluído — ${novos} novos, ${ignorados} já existentes, ${erros} erros`);
  return { novos, erros };
}
