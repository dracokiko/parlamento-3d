/**
 * Crawler das Presenças em Reuniões Plenárias — XVII Legislatura.
 * Fonte: parlamento.pt/DeputadoGP/Paginas/PresencasReunioesPlenarias.aspx?BID=XXXX
 *
 * Lê os BIDs da tabela ar_biografias e guarda o resumo + lista de sessões
 * na tabela ar_presencas (uma linha por deputado).
 *
 * Correr: npm run sync:presencas
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌  SUPABASE_URL e SUPABASE_SERVICE_KEY são obrigatórios no .env');
  process.exit(1);
}

const BASE    = 'https://www.parlamento.pt/DeputadoGP/Paginas/PresencasReunioesPlenarias.aspx?BID=';
const DELAY   = 800;
const TIMEOUT = 20_000;

let _client = null;
const db = () => {
  if (!_client) _client = createClient(SUPABASE_URL, SUPABASE_KEY);
  return _client;
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchHtml(url, tentativas = 3) {
  for (let i = 1; i <= tentativas; i++) {
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(TIMEOUT),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ParlamentoBot/1.0)' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    } catch (err) {
      if (i === tentativas) throw err;
      await sleep(i * 3000);
    }
  }
}

/** Parseia a página de presenças e devolve o registo a guardar. */
function parsePresencas(html, bid, nomeAbrev) {
  // Extrair todas as sessões individualmente
  const datas     = [...html.matchAll(/hplData[^>]*>(\d{4}-\d{2}-\d{2})<\/a>/g)].map(m => m[1]);
  const numeros   = [...html.matchAll(/hplNumero[^>]*>(\d+)<\/a>/g)].map(m => parseInt(m[1], 10));
  const tipos     = [...html.matchAll(/lblTipo[^>]*>([^<]+)<\/span>/g)].map(m => m[1].trim());
  const presencas = [...html.matchAll(/lblPresenca[^>]*>([^<]+)<\/span>/g)].map(m => m[1].trim());

  const sessoes = datas.map((data, i) => ({
    data,
    numero:   numeros[i]   ?? null,
    tipo:     tipos[i]     ?? null,
    presenca: presencas[i] ?? null,
  }));

  // Contagens por tipo
  const contar = prefixo => presencas.filter(p => p.startsWith(prefixo)).length;
  const total          = sessoes.length;
  const nPresencas     = contar('Presença');
  const nFaltasJust    = contar('Falta Just');
  const nAusenciasMP   = contar('Ausência em Missão');
  const nOutras        = total - nPresencas - nFaltasJust - nAusenciasMP;
  const taxa           = total > 0 ? Math.round((nPresencas / total) * 10000) / 100 : 0;

  return {
    bid,
    nome_abrev:    nomeAbrev,
    total_sessoes: total,
    presencas:     nPresencas,
    faltas_just:   nFaltasJust,
    ausencias_mp:  nAusenciasMP,
    outras:        nOutras > 0 ? nOutras : 0,
    taxa_presenca: taxa,
    sessoes,
    atualizado_em: new Date().toISOString(),
  };
}

export async function crawlerPresencas() {
  console.log('\n' + '='.repeat(55));
  console.log('  CRAWLER — PRESENÇAS DOS DEPUTADOS');
  console.log('='.repeat(55));

  // Buscar todos os BIDs de ar_deputados (mesma fonte que o crawler de biografias)
  const todos = [];
  const LOTE = 1000;
  for (let i = 0; ; i += LOTE) {
    const { data, error } = await db()
      .from('ar_deputados')
      .select('cad_id')
      .eq('legislatura', 'XVII')
      .not('cad_id', 'is', null)
      .range(i, i + LOTE - 1);
    if (error) { console.error('❌', error.message); process.exit(1); }
    if (!data?.length) break;
    todos.push(...data.map(d => parseInt(d.cad_id, 10)));
    if (data.length < LOTE) break;
  }
  const bids = [...new Set(todos)].sort((a, b) => a - b);

  // Lookup de nomes a partir de ar_biografias (best-effort)
  const { data: bioNomes } = await db()
    .from('ar_biografias')
    .select('bid, nome_abrev');
  const nomeMap = Object.fromEntries((bioNomes ?? []).map(b => [b.bid, b.nome_abrev]));

  console.log(`  → ${bids.length} BIDs em ar_deputados`);

  let ok = 0, erros = 0;

  for (const bid of bids) {
    const nome_abrev = nomeMap[bid] ?? `BID ${bid}`;
    try {
      const html     = await fetchHtml(`${BASE}${bid}`);
      const registo  = parsePresencas(html, bid, nome_abrev);

      if (registo.total_sessoes === 0) {
        console.warn(`\n  ⚠ BID ${bid} (${nome_abrev}): sem sessões — a saltar`);
        erros++;
        continue;
      }

      const { error: e } = await db()
        .from('ar_presencas')
        .upsert(registo, { onConflict: 'bid' });

      if (e) throw new Error(e.message);

      ok++;
      const linha = `  … ${ok}/${bios.length} — ${nome_abrev} (${registo.taxa_presenca}%)`;
      process.stdout.write(linha.padEnd(65) + '\r');
    } catch (err) {
      erros++;
      console.warn(`\n  ✗ BID ${bid} (${nome_abrev}): ${err.message}`);
    }
    await sleep(DELAY);
  }

  console.log(`\n\n  ✓ Concluído | OK: ${ok} | Erros: ${erros}`);
}

crawlerPresencas().catch(err => {
  console.error(err);
  process.exit(1);
});
