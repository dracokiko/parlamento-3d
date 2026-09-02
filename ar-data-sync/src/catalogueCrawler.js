/**
 * Crawler do catálogo de debates do DAR (debates.parlamento.pt).
 *
 * Estratégia:
 *   1. Listar todos os (numero, data) do DAR na sessão actual
 *   2. Para cada par novo, buscar o texto completo via ?sft=true
 *   3. Guardar em ar_debates (id: dar_NNN_DATE) com transcricao preenchida
 *   4. Ligar as iniciativas que referenciam esse DAR (iniciativa_ids)
 *
 * Modos:
 *   --all      crawl completo (todas as sessões, inclui retroactivas)
 *   --missing  apenas sessões referenciadas em ar_iniciativas.dar_links mas sem transcricao
 *   (padrão)   apenas sessões novas (após a mais recente já crawlada)
 */

import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY, LEGISLATURA, LEGISLATURA_NUM, DAR_SERIE } from './config.js';
import { extrairTextoHtml } from './scraper.js';

const BASE      = 'https://debates.parlamento.pt';
const TIMEOUT   = 300_000;
const DELAY     = 1200; // ms entre pedidos
const MIN_TEXTO = 2000;

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

let _sessaoCache = null;

/**
 * Descobre a sessão legislativa mais recente disponível no catálogo DAR
 * (o 3º segmento do caminho, ex: 01/17/02), lendo os links "Sessão
 * Legislativa NN" da página-índice da legislatura. Evita ter de actualizar
 * manualmente um número de sessão fixo todos os anos por volta de Setembro.
 */
export async function descobrirSessaoAtual() {
  if (_sessaoCache) return _sessaoCache;

  const html = await fetchHtml(`${BASE}/catalogo/r3/dar/${DAR_SERIE}/${LEGISLATURA_NUM}`);
  const re = new RegExp(`href="/catalogo/r3/dar/${DAR_SERIE}/${LEGISLATURA_NUM}/(\\d+)">\\s*Sessão Legislativa`, 'g');
  let melhor = null;
  for (const m of html.matchAll(re)) {
    if (melhor === null || parseInt(m[1], 10) > parseInt(melhor, 10)) melhor = m[1];
  }
  if (!melhor) {
    throw new Error(`Não foi possível descobrir a sessão legislativa actual no catálogo DAR (legislatura ${LEGISLATURA})`);
  }
  _sessaoCache = melhor;
  return melhor;
}

/** Lista todos os (numero, data) do DAR disponíveis no catálogo, para a sessão dada. */
async function listarNumerosDar(sessaoLeg) {
  const caminho = `${DAR_SERIE}/${LEGISLATURA_NUM}/${sessaoLeg}`;
  const html = await fetchHtml(`${BASE}/catalogo/r3/dar/${caminho}`);
  const vistos = new Set();
  const numeros = [];
  const rePath = new RegExp(`href="/catalogo/r3/dar/${caminho}/(\\d+)/([0-9-]+)"`, 'g');
  for (const m of html.matchAll(rePath)) {
    const chave = `${m[1]}_${m[2]}`;
    if (!vistos.has(chave)) {
      vistos.add(chave);
      numeros.push({ numero: m[1], data: m[2], id: `dar_${m[1]}_${m[2]}` });
    }
  }
  const resultado = numeros.sort((a, b) => a.data.localeCompare(b.data));
  if (resultado.length === 0) {
    console.error(`⚠ ATENÇÃO: 0 sessões encontradas para a legislatura ${LEGISLATURA} / sessão legislativa ${sessaoLeg} — verificar URL do catálogo DAR`);
  }
  return resultado;
}

/** Sessões DAR referenciadas em ar_iniciativas.dar_links mas sem transcrição. */
async function sessoesMissing() {
  const { data } = await db()
    .from('ar_debates')
    .select('id, data_debate')
    .like('id', 'dar_%')
    .is('transcricao', null);
  return (data ?? []).map(r => {
    const m = r.id.match(/^dar_(\d+)_(\d{4}-\d{2}-\d{2})$/);
    return m ? { numero: m[1], data: m[2], id: r.id } : null;
  }).filter(Boolean);
}

/** Data mais recente já crawlada (com transcrição). */
async function dataUltimaCrawlada() {
  const { data } = await db()
    .from('ar_debates')
    .select('data_debate')
    .like('id', 'dar_%')
    .not('transcricao', 'is', null)
    .order('data_debate', { ascending: false })
    .limit(1);
  return data?.[0]?.data_debate ?? null;
}

/**
 * Busca o texto completo de uma sessão via ?sft=true.
 * Tenta a data fornecida e até 3 dias antes (a data no URL das publicações
 * é a data do DAR, 1 dia após a sessão; o catálogo usa a data da sessão).
 */
async function fetchTextoSessao(numero, data, sessaoLeg) {
  const caminho = `${DAR_SERIE}/${LEGISLATURA_NUM}/${sessaoLeg}`;
  const d = new Date(data + 'T12:00:00Z');
  for (let offset = 0; offset <= 3; offset++) {
    const tryDate = new Date(d.getTime() - offset * 86_400_000)
      .toISOString().slice(0, 10);
    const url = `${BASE}/catalogo/r3/dar/${caminho}/${numero}/${tryDate}?sft=true`;
    try {
      const html = await fetchHtml(url, 1); // 1 tentativa — falha rápido
      const texto = extrairTextoHtml(html);
      if (texto && texto.length >= MIN_TEXTO) {
        return { url: `${BASE}/catalogo/r3/dar/${caminho}/${numero}/${tryDate}`, texto };
      }
    } catch { /* tentar próxima data */ }
  }
  return null;
}

/** Depois de inserir/actualizar uma sessão DAR, liga as iniciativas que a referenciam. */
async function linkIniciativas(darId) {
  const { data: inis } = await db()
    .from('ar_iniciativas')
    .select('id')
    .filter('dar_links', 'cs', JSON.stringify([{ darId }]));

  if (!inis?.length) return 0;
  const ids = inis.map(i => i.id);

  // Merge com iniciativa_ids já existentes
  const { data: existing } = await db()
    .from('ar_debates')
    .select('iniciativa_ids')
    .eq('id', darId)
    .single();

  const existingSet = new Set(existing?.iniciativa_ids ?? []);
  for (const id of ids) existingSet.add(id);

  await db().from('ar_debates')
    .update({ iniciativa_ids: [...existingSet] })
    .eq('id', darId);

  return ids.length;
}

/**
 * Crawl principal.
 * modo: 'new' | 'missing' | 'all'
 */
export async function crawlerDebatesDAR(modo = 'new') {
  console.log(`\n  [DAR-CRAWL] modo=${modo}`);

  const sessaoLeg = await descobrirSessaoAtual();
  console.log(`  [DAR-CRAWL] sessão legislativa actual: ${sessaoLeg}`);

  let sessoes;

  if (modo === 'missing') {
    sessoes = await sessoesMissing();
    console.log(`  [DAR-CRAWL] ${sessoes.length} sessões com placeholder sem transcrição`);
  } else {
    const todas = await listarNumerosDar(sessaoLeg);
    if (modo === 'new') {
      const ultima = await dataUltimaCrawlada();
      sessoes = ultima ? todas.filter(s => s.data > ultima) : todas;
      console.log(`  [DAR-CRAWL] ${todas.length} no catálogo, ${sessoes.length} novas (após ${ultima ?? 'início'})`);
    } else {
      // 'all'
      sessoes = todas;
      console.log(`  [DAR-CRAWL] ${sessoes.length} sessões no catálogo (modo completo)`);
    }
  }

  let novos = 0, actualizados = 0, ignorados = 0, erros = 0;

  for (const { numero, data, id } of sessoes) {
    // Verificar se já tem transcrição
    const { data: existing } = await db()
      .from('ar_debates')
      .select('id, transcricao')
      .eq('id', id)
      .single();

    if (existing?.transcricao && modo !== 'all') { ignorados++; continue; }

    await sleep(DELAY);
    try {
      const sessao = await fetchTextoSessao(numero, data, sessaoLeg);
      if (!sessao) { ignorados++; continue; }

      const payload = {
        id,
        data_debate:   data,
        sessao:        sessaoLeg,
        legislatura:   LEGISLATURA,
        url_diario:    sessao.url,
        transcricao:   sessao.texto,
      };

      const { error } = await db().from('ar_debates').upsert(payload, { onConflict: 'id' });

      if (error) {
        console.warn(`  ⚠ Upsert ${id}: ${error.message}`);
        erros++;
        continue;
      }

      const nInis = await linkIniciativas(id);
      const label = existing ? 'UPD' : '+  ';
      existing ? actualizados++ : novos++;
      console.log(`  [DAR-CRAWL] ${label} ${id} (${sessao.texto.length} chars, ${nInis} iniciativas)`);

    } catch (e) {
      console.warn(`  ⚠ ${numero}/${data}: ${e.message}`);
      erros++;
    }
  }

  console.log(`\n  [DAR-CRAWL] Concluído — ${novos} novos, ${actualizados} actualizados, ${ignorados} ignorados, ${erros} erros`);
  return { novos, actualizados, erros };
}

// Execução directa
if (process.argv[1]?.includes('catalogueCrawler')) {
  const args = process.argv.slice(2);
  const modo = args.includes('--all') ? 'all' : args.includes('--missing') ? 'missing' : 'new';
  await crawlerDebatesDAR(modo);
  console.log('\nFim.');
}
