/**
 * Crawler do catálogo de debates do DAR (debates.parlamento.pt).
 *
 * Estratégia:
 *   1. Listar todos os (numero, data) do DAR em todas as sessões legislativas
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
import { empurrarAmostra } from './resumoPublico.js';

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

let _sessoesCache = null;

/**
 * Todas as sessões legislativas disponíveis no catálogo DAR para esta
 * legislatura (o 3º segmento do caminho, ex: 01/17/02), da mais recente para
 * a mais antiga. Lidas dos links "Sessão Legislativa NN" da página-índice.
 */
export async function descobrirSessoes() {
  if (_sessoesCache) return _sessoesCache;

  const html = await fetchHtml(`${BASE}/catalogo/r3/dar/${DAR_SERIE}/${LEGISLATURA_NUM}`);
  const re = new RegExp(`href="/catalogo/r3/dar/${DAR_SERIE}/${LEGISLATURA_NUM}/(\\d+)">\\s*Sessão Legislativa`, 'g');
  const sessoes = [...new Set([...html.matchAll(re)].map(m => m[1]))]
    .sort((a, b) => parseInt(b, 10) - parseInt(a, 10));

  if (!sessoes.length) {
    throw new Error(`Não foi possível descobrir as sessões legislativas no catálogo DAR (legislatura ${LEGISLATURA})`);
  }
  _sessoesCache = sessoes;
  return sessoes;
}

/**
 * A sessão legislativa em curso — a mais recente publicada. Muda todos os anos
 * a 15 de Setembro (art.º 174.º da Constituição), por isso é descoberta em vez
 * de fixada.
 */
export async function descobrirSessaoAtual() {
  return (await descobrirSessoes())[0];
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
  return numeros.sort((a, b) => a.data.localeCompare(b.data));
}

/**
 * O mesmo, mas para TODAS as sessões legislativas da legislatura.
 *
 * Olhar só para a sessão em curso parece natural e está errado: a sessão
 * legislativa muda a 15 de Setembro e a nova abre vazia, enquanto os últimos
 * DAR da anterior ainda estão por publicar. Nesse período a listagem da
 * sessão nova não devolve nada e os atrasados da antiga nunca seriam
 * descobertos — ficavam invisíveis, porque o modo 'missing' só repesca
 * sessões que já existam em ar_debates.
 */
async function listarNumerosDarTodas() {
  const sessoes = await descobrirSessoes();
  const porId = new Map();

  for (const sessaoLeg of sessoes) {
    const lista = await listarNumerosDar(sessaoLeg);
    console.log(`  [DAR-CRAWL] sessão legislativa ${sessaoLeg}: ${lista.length} no catálogo`);
    for (const item of lista) {
      if (!porId.has(item.id)) porId.set(item.id, { ...item, sessaoLeg });
    }
  }

  if (porId.size === 0) {
    console.error(`⚠ ATENÇÃO: 0 sessões encontradas em toda a legislatura ${LEGISLATURA} (sessões: ${sessoes.join(', ')}) — verificar URL do catálogo DAR`);
  }
  return [...porId.values()].sort((a, b) => a.data.localeCompare(b.data));
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
 *
 * Duas fontes de incerteza no URL, ambas tentadas aqui:
 *  - a data: a que vem nas publicações é a do DAR (1 dia após a sessão) e o
 *    catálogo usa a da sessão, por isso tentamos até 3 dias antes;
 *  - a sessão legislativa: uma sessão de Fevereiro pertence à sessão
 *    legislativa anterior à que está em curso a partir de 15 de Setembro.
 *    Preferir sempre `sessaoPreferida` (a mais provável para este registo) e
 *    só depois as outras — sem isto, assim que uma sessão legislativa nova
 *    abre, nenhuma sessão antiga em falta volta a ser encontrada.
 */
async function fetchTextoSessao(numero, data, sessaoPreferida) {
  const todas = await descobrirSessoes();
  const candidatas = [sessaoPreferida, ...todas.filter(s => s !== sessaoPreferida)];
  const d = new Date(data + 'T12:00:00Z');

  for (const sessaoLeg of candidatas) {
    const caminho = `${DAR_SERIE}/${LEGISLATURA_NUM}/${sessaoLeg}`;
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
      } catch { /* tentar próxima data/sessão */ }
    }
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
    const todas = await listarNumerosDarTodas();
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
  const amostraNovos = [], falhas = [];

  for (const { numero, data, id, sessaoLeg: sessaoDoItem } of sessoes) {
    // A sessão legislativa a que este DAR pertence — só a sabemos quando veio
    // da listagem do catálogo; no modo 'missing' o id não a guarda, e aí
    // partimos da actual (fetchTextoSessao tenta as outras a seguir).
    const sessaoItem = sessaoDoItem ?? sessaoLeg;

    // Verificar se já tem transcrição
    const { data: existing } = await db()
      .from('ar_debates')
      .select('id, transcricao')
      .eq('id', id)
      .single();

    if (existing?.transcricao && modo !== 'all') { ignorados++; continue; }

    await sleep(DELAY);
    try {
      const sessao = await fetchTextoSessao(numero, data, sessaoItem);
      if (!sessao) { ignorados++; continue; }

      const payload = {
        id,
        data_debate:   data,
        sessao:        sessaoItem,
        legislatura:   LEGISLATURA,
        url_diario:    sessao.url,
        transcricao:   sessao.texto,
      };

      const { error } = await db().from('ar_debates').upsert(payload, { onConflict: 'id' });

      if (error) {
        console.warn(`  ⚠ Upsert ${id}: ${error.message}`);
        erros++;
        empurrarAmostra(falhas, { id, motivo: error.message });
        continue;
      }

      const nInis = await linkIniciativas(id);
      const label = existing ? 'UPD' : '+  ';
      existing ? actualizados++ : novos++;
      console.log(`  [DAR-CRAWL] ${label} ${id} (${sessao.texto.length} chars, ${nInis} iniciativas)`);
      empurrarAmostra(amostraNovos, { id, label: `${data} — ${sessao.texto.length} chars, ${nInis} iniciativas` });

    } catch (e) {
      console.warn(`  ⚠ ${numero}/${data}: ${e.message}`);
      erros++;
      empurrarAmostra(falhas, { id, motivo: e.message });
    }
  }

  console.log(`\n  [DAR-CRAWL] Concluído — ${novos} novos, ${actualizados} actualizados, ${ignorados} ignorados, ${erros} erros`);
  return { novos, actualizados, erros, amostraNovos, falhas };
}

// Execução directa
if (process.argv[1]?.includes('catalogueCrawler')) {
  const args = process.argv.slice(2);
  const modo = args.includes('--all') ? 'all' : args.includes('--missing') ? 'missing' : 'new';
  await crawlerDebatesDAR(modo);
  console.log('\nFim.');
}
