/**
 * EUR-Lex sync — Diretivas UE vs Portugal
 *
 * Estratégia:
 *  1. EUR-Lex CELLAR SPARQL → lista de diretivas DIR em vigor desde ANO_INICIO
 *  2. EUR-Lex NIM pages (HTML scraping) → prazo + estado Portugal
 *     - id="PRT_transposition"   → prazo de transposição (mesmo para todos os países)
 *     - id="PRT_numOfNims"       → nº de medidas nacionais portuguesas notificadas
 *  3. Upsert em Supabase (tabela diretivas_ue)
 *
 * Nota: o EUR-Lex bloqueia User-Agents não-browser — usa sempre o UA de Chrome.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌  SUPABASE_URL e SUPABASE_SERVICE_KEY são obrigatórios no .env');
  process.exit(1);
}

const SPARQL     = 'https://publications.europa.eu/webapi/rdf/sparql';
const EURLEX     = 'https://eur-lex.europa.eu';
const ANO_INICIO = 2015;

// Requer User-Agent de browser real — o EUR-Lex bloqueia bots
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const CONCORRENCIA = 3;   // pedidos paralelos ao EUR-Lex
const DELAY_LOTE   = 800; // ms entre lotes

// Full IRIs para evitar problemas com hífens em prefixed names
const P = (local) => `<http://publications.europa.eu/ontology/cdm#${local}>`;

// ─── SPARQL: lista de diretivas ────────────────────────────────────────────

function buildQuery(offset) {
  return `
SELECT DISTINCT ?celex ?dateEnd
WHERE {
  ?work ${P('work_has_resource-type')}
        <http://publications.europa.eu/resource/authority/resource-type/DIR> .

  ?work ${P('resource_legal_id_celex')} ?celex .

  OPTIONAL { ?work ${P('resource_legal_date_end-of-validity')} ?dateEnd . }
}
ORDER BY DESC(?celex)
LIMIT 500
OFFSET ${offset}
  `.trim();
}

async function sparqlPage(offset) {
  const url = `${SPARQL}?query=${encodeURIComponent(buildQuery(offset))}&format=application%2Fsparql-results%2Bjson`;
  const res = await fetch(url, {
    headers: { Accept: 'application/sparql-results+json' },
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`SPARQL ${res.status}`);
  const j = await res.json();
  return j.results?.bindings ?? [];
}

async function obterDiretivas() {
  const hoje = new Date();
  const map  = new Map();
  let offset = 0;

  while (true) {
    const bindings = await comRetry(() => sparqlPage(offset));

    for (const b of bindings) {
      const celex = b.celex?.value;
      if (!celex) continue;

      // Filtrar por ano (CELEX: 3 + YYYY + L)
      const anoMatch = celex.match(/^3(\d{4})L/);
      if (!anoMatch || parseInt(anoMatch[1], 10) < ANO_INICIO) continue;

      // Só diretivas em vigor
      const fim = b.dateEnd?.value ?? '9999-12-31';
      if (new Date(fim.split('T')[0]) < hoje) continue;

      if (!map.has(celex)) map.set(celex, celex);
    }

    if (bindings.length < 500) break;
    offset += 500;
    await delay(1200);
  }

  return Array.from(map.keys());
}

// ─── EUR-Lex NIM page scraping ─────────────────────────────────────────────

async function fetchNIM(celex) {
  const url = `${EURLEX}/legal-content/PT/NIM/?uri=CELEX:${celex}`;

  let html;
  try {
    const res = await comRetry(() => fetch(url, {
      headers: {
        Accept:           'text/html,application/xhtml+xml',
        'Accept-Language': 'en-GB,en;q=0.9',
        'User-Agent':      UA,
      },
      signal: AbortSignal.timeout(45_000),
    }), 3, 2000);
    if (!res.ok) return vazio();
    html = await res.text();
  } catch {
    return vazio();
  }

  return {
    prazo:        extrairPrazo(html),
    transpostoPt: verificarPortugal(html),
    titulo:       extrairTitulo(html),
  };
}

function vazio() {
  return { prazo: null, transpostoPt: false, titulo: null };
}

/** Extrai o prazo de transposição do div id="PRT_transposition".
 *  Fallback: primeiro país disponível (o prazo é igual para todos). */
function extrairPrazo(html) {
  // Tentar Portugal primeiro
  const ptMatch = html.match(/id="PRT_transposition"[^>]*>([^<]+)/);
  if (ptMatch) {
    const d = parseDataEU(ptMatch[1].trim());
    if (d) return d;
  }

  // Fallback: qualquer país (BEL, BGR, CZE, …)
  const anyMatch = html.match(/id="\w{3}_transposition"[^>]*>([^<]+)/);
  if (anyMatch) {
    return parseDataEU(anyMatch[1].trim());
  }

  return null;
}

/** Verifica se Portugal notificou ≥1 medida nacional.
 *  Usa id="PRT_numOfNims" → <span class="VMIMore">N</span> com N > 0. */
function verificarPortugal(html) {
  // Secção principal: id="PRT_numOfNims"
  const sectionMatch = html.match(/id="PRT_numOfNims"([\s\S]{0,600})/);
  if (sectionMatch) {
    const vmMore = sectionMatch[1].match(/<span class="VMIMore">(\d+)<\/span>/);
    if (vmMore) return parseInt(vmMore[1], 10) > 0;
  }

  // Fallback: existência de pelo menos um <li class="PRT_ntm">
  return /<li\s+class="PRT_ntm"/i.test(html);
}

/** Extrai o título da diretiva da secção da página NIM (PT ou EN). */
function extrairTitulo(html) {
  // Padrão PT: "Medidas nacionais de transposição ... relativas a: <strong>TÍTULO</strong>"
  // Padrão EN: "National transposition measures communicated ... concerning: <strong>TÍTULO</strong>"
  const m = html.match(
    /(?:Medidas nacionais de transposição|National transposition measures communicated)[\s\S]{0,400}?<strong>([^<]{30,})<\/strong>/i,
  );
  if (m) return m[1].replace(/\s+/g, ' ').trim().slice(0, 500);

  // Fallback: primeiro <strong> longo no painel principal
  const painel = html.match(/class="panel-body"[^>]*>([\s\S]{0,2000})/i);
  if (painel) {
    const s = painel[1].match(/<strong>([^<]{30,})<\/strong>/i);
    if (s) return s[1].replace(/\s+/g, ' ').trim().slice(0, 500);
  }

  return null;
}

function parseDataEU(str) {
  // DD/MM/YYYY → YYYY-MM-DD
  const m = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  const [, d, mo, y] = m;
  if (+y < 2000 || +y > 2040) return null;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

// ─── Utilidades ────────────────────────────────────────────────────────────

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function comRetry(fn, retries = 3, delayBase = 3000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries) throw err;
      const wait = delayBase * attempt;
      console.warn(`  ⚠ Tentativa ${attempt}/${retries} falhou: ${err.message} — aguardar ${wait / 1000}s`);
      await delay(wait);
    }
  }
}

async function emLotes(items, fn, n) {
  const results = [];
  for (let i = 0; i < items.length; i += n) {
    const lote = items.slice(i, i + n);
    const r    = await Promise.all(lote.map(fn));
    results.push(...r);
    process.stdout.write(`  … NIM ${Math.min(i + n, items.length)}/${items.length}\r`);
    if (i + n < items.length) await delay(DELAY_LOTE);
  }
  return results;
}

// ─── Main ──────────────────────────────────────────────────────────────────

export async function syncDiretivasUE() {
  const db = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log('\n' + '='.repeat(55));
  console.log('  DIRETIVAS UE — EUR-Lex CELLAR + NIM scraping');
  console.log('='.repeat(55));

  // Fase 1: lista de diretivas
  console.log(`\n[1/3] SPARQL — diretivas DIR em vigor desde ${ANO_INICIO}...`);
  let celexList;
  try {
    celexList = await obterDiretivas();
  } catch (err) {
    console.error('  ✗ SPARQL falhou:', err.message);
    throw err;
  }
  console.log(`  → ${celexList.length} diretivas encontradas`);

  // Fase 2: NIM pages
  console.log(`\n[2/3] NIM — prazo + estado PT (${CONCORRENCIA} em paralelo)...`);
  const hoje = new Date();

  const registos = await emLotes(
    celexList,
    async (celex) => {
      const { prazo, transpostoPt, titulo } = await fetchNIM(celex);
      const emAtraso = !transpostoPt && !!prazo && new Date(prazo) < hoje;
      return {
        id:                 celex,
        titulo,
        prazo_transposicao: prazo,
        transposto_pt:      transpostoPt,
        em_atraso:          emAtraso,
        link_eurlex:        `${EURLEX}/legal-content/PT/TXT/?uri=CELEX:${celex}`,
        atualizado_em:      hoje.toISOString(),
      };
    },
    CONCORRENCIA,
  );

  console.log(`\n  → ${registos.length} registos prontos`);

  // Fase 3: Supabase
  console.log('\n[3/3] Supabase upsert...');
  const BATCH = 50;
  let saved = 0;
  let batchErros = 0;
  for (let i = 0; i < registos.length; i += BATCH) {
    const { error } = await db
      .from('diretivas_ue')
      .upsert(registos.slice(i, i + BATCH), { onConflict: 'id' });
    if (error) { console.warn(`  ⚠ batch ${i}: ${error.message}`); batchErros++; }
    else saved += Math.min(BATCH, registos.length - i);
  }

  // Só as diretivas COM prazo são relevantes para monitorizar Portugal
  const comPrazo    = registos.filter((r) => !!r.prazo_transposicao);
  const transpostas = registos.filter((r) => r.transposto_pt).length;
  const emAtraso    = comPrazo.filter((r) => r.em_atraso).length;
  const porTranspor = comPrazo.filter((r) => !r.transposto_pt && !r.em_atraso).length;
  const semPrazo    = registos.filter((r) => !r.prazo_transposicao).length;

  console.log(`\n  ✓ ${saved} diretivas guardadas`);
  console.log(`    Com prazo de transposição : ${comPrazo.length}`);
  console.log(`    Transpostas PT            : ${transpostas}`);
  console.log(`    Em atraso (multa possível): ${emAtraso}`);
  console.log(`    Por transpor (no prazo)   : ${porTranspor}`);
  console.log(`    Sem prazo (delg./execução): ${semPrazo}`);

  try {
    await db.from('ar_sync_log').insert({
      recurso: 'diretivas_ue', sucesso: batchErros === 0,
      total: registos.length, inseridos: saved, atualizados: 0, erros: batchErros,
      detalhes: [],
    });
  } catch {}

  return {
    ok:      batchErros === 0,
    message: batchErros ? `${batchErros} lote(s) falharam ao gravar` : null,
  };
}

async function registarStatus(status, message) {
  try {
    const db = createClient(SUPABASE_URL, SUPABASE_KEY);
    await db.from('sync_status').upsert({
      job: 'eurlex-sync',
      status,
      message: message ?? null,
      last_run_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn(`  ⚠ Sync status não guardado: ${err.message}`);
  }
}

if (process.argv[1].includes('eurlexSync')) {
  syncDiretivasUE()
    .then((r) => registarStatus(r?.ok === false ? 'error' : 'ok', r?.message))
    .catch(async (err) => {
      console.error('  ✗', err.message);
      await registarStatus('error', err.message);
      process.exit(1);
    });
}