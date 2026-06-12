/**
 * Crawler do catálogo de debates do DAR (debates.parlamento.pt).
 *
 * Estratégia:
 *   1. Listar todos os (numero, data) do DAR na sessão actual
 *   2. Para cada par novo, buscar o texto completo via ?sft=true
 *   3. Guardar uma entrada por sessão em ar_debates com transcricao preenchida
 */

import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { extrairTextoHtml } from './scraper.js';

const BASE    = 'https://debates.parlamento.pt';
const TIMEOUT = 300_000;
const DELAY   = 1000; // ms entre pedidos
const MIN_TEXTO = 2000; // chars mínimos para ser considerado uma sessão real

let _client = null;
const db = () => {
  if (!_client) _client = createClient(SUPABASE_URL, SUPABASE_KEY);
  return _client;
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchHtml(url, tentativas = 2) {
  for (let i = 1; i <= tentativas; i++) {
    try {
      const res = await fetch(url, {
        signal:  AbortSignal.timeout(TIMEOUT),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ParlamentoBot/1.0)' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    } catch (err) {
      if (i === tentativas) throw err;
      console.warn(`  ⚠ Tentativa ${i}/${tentativas} falhou (${err.message}) — a repetir...`);
      await sleep(3000 * i);
    }
  }
}

/** Lista todos os (numero, data) do DAR disponíveis no catálogo. */
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
  return numeros.sort((a, b) => a.data.localeCompare(b.data));
}

/** IDs dar_ já existentes no Supabase para um dado numero. */
async function idsExistentes(numero) {
  const { data } = await db()
    .from('ar_debates')
    .select('id')
    .like('id', `dar_${numero}_%`);
  return new Set((data ?? []).map(r => r.id));
}

/**
 * Data mais recente com url_diario fornecida pela API AR (entradas não-dar_).
 * O crawler só precisa de processar sessões APÓS esta data.
 */
async function dataCoberturApiAR() {
  const { data } = await db()
    .from('ar_debates')
    .select('data_debate')
    .not('url_diario', 'is', null)
    .not('id', 'ilike', 'dar_%')
    .order('data_debate', { ascending: false })
    .limit(1);
  return data?.[0]?.data_debate ?? '2000-01-01';
}

/**
 * Busca o texto completo de uma sessão via ?sft=true.
 * Devolve { url, texto } ou null se texto insuficiente.
 */
async function fetchTextoSessao(numero, data) {
  const url = `${BASE}/catalogo/r3/dar/01/17/01/${numero}/${data}?sft=true`;
  const html = await fetchHtml(url);
  const texto = extrairTextoHtml(html);
  if (!texto || texto.length < MIN_TEXTO) return null;
  return { url: `${BASE}/catalogo/r3/dar/01/17/01/${numero}/${data}`, texto };
}

/**
 * Crawl principal: descobre sessões novas no catálogo do DAR
 * e insere em ar_debates com a transcrição completa já preenchida.
 */
export async function crawlerDebatesDAR() {
  console.log('\n  [DAR-CRAWL] A descobrir sessões no catálogo do DAR...');

  const [todosNumeros, cutoff] = await Promise.all([
    listarNumerosDar(),
    dataCoberturApiAR(),
  ]);

  // Só processar sessões com data APÓS a cobertura da API AR (evita duplicados)
  const numeros = todosNumeros.filter(({ data }) => data > cutoff);
  console.log(`  [DAR-CRAWL] ${todosNumeros.length} entradas no catálogo, ${numeros.length} a processar (após ${cutoff})`);

  let novos = 0, ignorados = 0, erros = 0;

  for (const { numero, data } of numeros) {
    const id = `dar_${numero}_${data}`;
    const existentes = await idsExistentes(numero);

    if (existentes.has(id)) { ignorados++; continue; }

    await sleep(DELAY);
    try {
      const sessao = await fetchTextoSessao(numero, data);
      if (!sessao) { ignorados++; continue; }

      const { error } = await db().from('ar_debates').upsert({
        id,
        data_debate:  data,
        sessao:       '01',
        legislatura:  'XVII',
        url_diario:   sessao.url,
        transcricao:  sessao.texto,
      }, { onConflict: 'id', ignoreDuplicates: true });

      if (error) {
        console.warn(`  ⚠ Upsert ${id}: ${error.message}`);
        erros++;
      } else {
        novos++;
        console.log(`  [DAR-CRAWL] +${novos} ${id} (${sessao.texto.length} chars)`);
      }

    } catch (e) {
      console.warn(`  ⚠ ${numero}/${data}: ${e.message}`);
      erros++;
    }
  }

  console.log(`\n  [DAR-CRAWL] Concluído — ${novos} novos, ${ignorados} ignorados, ${erros} erros`);
  return { novos, erros };
}
