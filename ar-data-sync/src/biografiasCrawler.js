/**
 * Crawler das Biografias dos Deputados — XVII Legislatura, sessão 1.
 * Fonte: debates.parlamento.pt/catalogo/r3/dar/01/17/01
 *
 * Para correr directamente:
 *   node src/biografiasCrawler.js
 * Ou via npm:
 *   npm run sync:biografias
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌  SUPABASE_URL e SUPABASE_SERVICE_KEY são obrigatórios no .env');
  process.exit(1);
}

const BIO_BASE  = 'https://www.parlamento.pt/DeputadoGP/Paginas/Biografia.aspx?BID=';
const DELAY       = 800;
const TIMEOUT_BIO = 15_000;

let _client = null;
const db = () => {
  if (!_client) _client = createClient(SUPABASE_URL, SUPABASE_KEY);
  return _client;
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchHtml(url, timeout = TIMEOUT_BIO, tentativas = 3) {
  for (let i = 1; i <= tentativas; i++) {
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(timeout),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ParlamentoBot/1.0)' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    } catch (err) {
      if (i === tentativas) throw err;
      console.warn(`  ⚠ Tentativa ${i}/${tentativas} falhou (${err.message}) — a repetir em ${i * 3}s...`);
      await sleep(i * 3000);
    }
  }
}

function decodeHtml(str) {
  return str
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ').trim();
}

/**
 * Extrai os valores de texto de um painel pela sua ID parcial.
 * Cada painel tem a forma: <div id="...pnlXXX" class="TextoRegular-Titulo">
 * Os valores estão em spans com id sufixo "_lblText".
 */
function secao(html, pnlId) {
  const marker = `pnl${pnlId}"`;
  const a = html.indexOf(marker);
  if (a < 0) return [];
  const rest = html.slice(a + marker.length);
  // Limita ao conteúdo deste painel (até ao próximo pnlX...)
  const next = rest.search(/pnl[A-Z]/);
  const chunk = next >= 0 ? rest.slice(0, next) : rest.slice(0, 5000);
  return [...chunk.matchAll(/_lblText">([\s\S]*?)<\/span>/g)]
    .map(m => decodeHtml(m[1].trim()))
    .filter(Boolean);
}

/** Extrai um único valor por sufixo de ID. */
function valor(html, idSuffix) {
  const m = html.match(new RegExp(`id="[^"]*${idSuffix}"[^>]*>([^<]*)<`));
  return m ? decodeHtml(m[1].trim()) : null;
}

/** Parseia uma página de biografia e devolve o registo a guardar. */
function parseBio(html, bid) {
  // Cargos vêm num único bloco separado por \n
  const cargosRaw = secao(html, 'CargosExercidos');
  const cargos = cargosRaw.flatMap(c =>
    c.split('\n').map(s => s.trim()).filter(Boolean)
  );

  // Círculo aparece na versão mobile: "Círculo eleitoral:</span><span...> Aveiro"
  const circuloM = html.match(/Círculo eleitoral:<\/span><span[^>]*>\s*([^<]+)/);

  return {
    bid,
    nome_completo:    secao(html, 'NomeCompleto')[0] ?? null,
    nome_abrev:       valor(html, 'lblNomeDeputado'),
    partido:          valor(html, 'lblPartido'),
    circulo:          circuloM ? circuloM[1].trim() : null,
    data_nascimento:  secao(html, 'DOB')[0] ?? null,
    profissao:        secao(html, 'Prof')[0] ?? null,
    habilitacoes:     secao(html, 'Habilitacoes'),
    cargos_exercidos: cargos,
    comissoes:        secao(html, 'Comissoes'),
    atualizado_em:    new Date().toISOString(),
  };
}

/** Lê apenas os 230 deputados actuais, cruzando deputados.id com ar_deputados.id para obter cad_id. */
async function extrairBids() {
  const { data: activos, error: e1 } = await db().from('deputados').select('id, nome');
  if (e1) throw new Error(e1.message);
  const ids = (activos ?? []).map(d => d.id);

  const { data, error } = await db()
    .from('ar_deputados')
    .select('id, cad_id, nome_parlamentar')
    .in('id', ids)
    .not('cad_id', 'is', null);
  if (error) throw new Error(error.message);

  const porId = new Map((data ?? []).map(r => [r.id, r]));
  return (activos ?? [])
    .map(d => {
      const ar = porId.get(d.id);
      return ar ? { bid: ar.cad_id, nome: ar.nome_parlamentar ?? d.nome } : null;
    })
    .filter(Boolean);
}

export async function crawlerBiografias() {
  console.log('\n' + '='.repeat(55));
  console.log('  CRAWLER — BIOGRAFIAS DOS DEPUTADOS');
  console.log('='.repeat(55));

  const deputados = await extrairBids();
  console.log(`  → ${deputados.length} BIDs encontrados no catálogo`);

  let ok = 0, erros = 0;

  for (const { bid, nome: nomeFallback } of deputados) {
    try {
      const html = await fetchHtml(`${BIO_BASE}${bid}`);
      const bio  = parseBio(html, bid);

      // Usar nome_parlamentar da ar_deputados como fallback se o HTML não tiver nome
      if (!bio.nome_abrev) bio.nome_abrev = nomeFallback ?? null;

      if (!bio.nome_abrev) {
        console.warn(`  ⚠ BID ${bid}: sem nome mesmo com fallback — a saltar`);
        erros++;
        continue;
      }

      const { error } = await db()
        .from('ar_biografias')
        .upsert(bio, { onConflict: 'bid' });

      if (error) throw new Error(error.message);

      ok++;
      const linha = `  … ${ok}/${deputados.length} — ${bio.nome_abrev}`;
      process.stdout.write(linha.padEnd(60) + '\r');
    } catch (err) {
      erros++;
      console.warn(`\n  ✗ BID ${bid}: ${err.message}`);
    }
    await sleep(DELAY);
  }

  console.log(`\n\n  ✓ Concluído | OK: ${ok} | Erros: ${erros}`);
  return { total: ok + erros, inseridos: ok, atualizados: 0, erros };
}

// Auto-executa só quando chamado directamente
if (process.argv[1].endsWith('biografiasCrawler.js')) {
  crawlerBiografias().catch(err => { console.error(err); process.exit(1); });
}
