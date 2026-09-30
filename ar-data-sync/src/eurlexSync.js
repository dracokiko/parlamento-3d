/**
 * EUR-Lex sync — Diretivas UE vs Portugal
 *
 * Tudo pelo SPARQL do Serviço das Publicações da UE (CELLAR), que é a fonte
 * aberta e feita para ser lida por máquinas:
 *  1. lista de diretivas DIR em vigor desde ANO_INICIO
 *  2. por lotes, para cada uma:
 *     - cdm:directive_date_transposition → prazo de transposição
 *     - título na expressão portuguesa
 *     - medidas nacionais (cdm:measure_national_implementing_*) cujo país é
 *       Portugal (PRT) → se Portugal comunicou transposição
 *  3. Upsert em Supabase (tabela diretivas_ue)
 *
 * Até 30/09/2026 o passo 2 lia as páginas NIM do eur-lex.europa.eu. Essas
 * páginas estão agora atrás de uma firewall (AWS WAF) que exige JavaScript:
 * a um pedido automático respondem HTTP 202 com uma página de 2 KB, que o
 * código tomava pela diretiva — ficavam sem prazo, sem título e "não
 * transpostas", e isso era gravado por cima do que lá estava. 803 das 824
 * diretivas estavam assim. Não se contorna a firewall: os mesmos dados
 * estão no SPARQL.
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

/** Diretivas por lote no passo 2 — cada lote são três perguntas curtas ao SPARQL. */
const TAMANHO_LOTE = 100;
const DELAY_LOTE   = 800; // ms entre lotes, para não martelar o SPARQL

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

export async function obterDiretivas() {
  const hoje = new Date();
  const map  = new Map();
  let offset = 0;

  while (true) {
    const bindings = await comRetry(() => sparqlPage(offset));

    for (const b of bindings) {
      const celex = b.celex?.value;
      if (!celex) continue;

      // Só a diretiva em si: 3 + AAAA + L + NNNN, e nada mais. Um CELEX com
      // sufixo — "32019L0790R(01)" — é uma rectificação, que corrige gralhas
      // de uma diretiva que já está na lista: não tem prazo nem se transpõe.
      // Até 30/09/2026 entravam como diretivas, e eram 521 das 824.
      const anoMatch = celex.match(/^3(\d{4})L\d{4}$/);
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

// ─── SPARQL: prazo, título e medidas portuguesas, por lote ────────────────

async function perguntarSparql(query) {
  const url = `${SPARQL}?query=${encodeURIComponent(query)}&format=application%2Fsparql-results%2Bjson`;
  const res = await fetch(url, {
    headers: { Accept: 'application/sparql-results+json' },
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`SPARQL ${res.status}`);
  const j = await res.json();
  return j.results?.bindings ?? [];
}

const PAIS_PT = '<http://publications.europa.eu/resource/authority/country/PRT>';
const LINGUA_PT = '<http://publications.europa.eu/resource/authority/language/POR>';

/**
 * Prazo de transposição, título em português e número de medidas nacionais
 * portuguesas de um lote de diretivas.
 *
 * Três perguntas separadas e sem agregações, com a contagem feita aqui. Num
 * SELECT único com vários OPTIONAL e MIN/COUNT, o motor do SPARQL trocava
 * valores entre diretivas do mesmo lote — a 2019/790 saía com o prazo da
 * 2023/970. O CELEX vai com o tipo (xsd:string) para ligar directamente.
 *
 * Lança se alguma das perguntas falhar: um lote sem resposta não pode virar
 * "sem prazo e não transposta" — quem chama salta-o e fica o que havia.
 */
export async function detalhesDoLote(celexes) {
  const valores = celexes.map((c) => `"${c}"^^<http://www.w3.org/2001/XMLSchema#string>`).join(' ');
  const base = `VALUES ?celex { ${valores} }\n  ?work ${P('resource_legal_id_celex')} ?celex .`;

  const [prazos, titulos, medidas] = await Promise.all([
    comRetry(() => perguntarSparql(`SELECT ?celex ?p WHERE {\n  ${base}\n  ?work ${P('directive_date_transposition')} ?p .\n}`)),
    comRetry(() => perguntarSparql(`SELECT ?celex ?t WHERE {\n  ${base}\n  ?expr ${P('expression_belongs_to_work')} ?work ;\n        ${P('expression_uses_language')} ${LINGUA_PT} ;\n        ${P('expression_title')} ?t .\n}`)),
    comRetry(() => perguntarSparql(`SELECT DISTINCT ?celex ?nim WHERE {\n  ${base}\n  ?nim ${P('measure_national_implementing_implements_resource_legal')} ?work ;\n       ${P('measure_national_implementing_implemented_by_country')} ${PAIS_PT} .\n}`)),
  ]);

  const porCelex = new Map(celexes.map((c) => [c, { prazo: null, titulo: null, medidasPt: 0 }]));
  for (const b of prazos) {
    const d = porCelex.get(b.celex.value);
    const p = b.p.value.slice(0, 10);
    // Prazos escalonados (há diretivas com três ou quatro): conta o primeiro.
    if (d && (!d.prazo || p < d.prazo)) d.prazo = p;
  }
  for (const b of titulos) {
    const d = porCelex.get(b.celex.value);
    if (d && !d.titulo) d.titulo = b.t.value.replace(/\s+/g, ' ').trim().slice(0, 500);
  }
  for (const b of medidas) {
    const d = porCelex.get(b.celex.value);
    if (d) d.medidasPt += 1;
  }
  return porCelex;
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

// ─── Main ──────────────────────────────────────────────────────────────────

export async function syncDiretivasUE() {
  const db = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log('\n' + '='.repeat(55));
  console.log('  DIRETIVAS UE — SPARQL do Serviço das Publicações (CELLAR)');
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

  // Fase 2: prazo, título e medidas portuguesas, por lotes
  console.log(`\n[2/3] SPARQL — prazo, título e medidas nacionais portuguesas (lotes de ${TAMANHO_LOTE})...`);
  const hoje = new Date();
  const registos = [];
  const lotesFalhados = [];

  for (let i = 0; i < celexList.length; i += TAMANHO_LOTE) {
    const lote = celexList.slice(i, i + TAMANHO_LOTE);
    let detalhes;
    try {
      detalhes = await detalhesDoLote(lote);
    } catch (err) {
      // Fica o que havia na base para estas diretivas: sem resposta não se
      // escreve "sem prazo e não transposta" por cima.
      console.warn(`\n  ⚠ lote ${i / TAMANHO_LOTE + 1} (${lote.length} diretivas) falhou: ${err.message} — ficam os dados anteriores`);
      lotesFalhados.push({ motivo: `${lote.length} diretivas sem resposta do SPARQL (${lote[0]}…): ${err.message}` });
      continue;
    }

    for (const celex of lote) {
      const { prazo, titulo, medidasPt } = detalhes.get(celex);
      const transpostoPt = medidasPt > 0;
      registos.push({
        id:                 celex,
        titulo,
        prazo_transposicao: prazo,
        transposto_pt:      transpostoPt,
        em_atraso:          !transpostoPt && !!prazo && new Date(prazo) < hoje,
        link_eurlex:        `${EURLEX}/legal-content/PT/TXT/?uri=CELEX:${celex}`,
        atualizado_em:      hoje.toISOString(),
      });
    }
    process.stdout.write(`  … ${Math.min(i + TAMANHO_LOTE, celexList.length)}/${celexList.length}\r`);
    if (i + TAMANHO_LOTE < celexList.length) await delay(DELAY_LOTE);
  }

  const comPrazoLidas = registos.filter((r) => r.prazo_transposicao).length;
  const comTitulo = registos.filter((r) => r.titulo).length;
  console.log(`\n  → ${registos.length} registos prontos (${comPrazoLidas} com prazo, ${comTitulo} com título)${lotesFalhados.length ? `, ${lotesFalhados.length} lotes saltados` : ''}`);

  // Fase 3: Supabase
  //
  // Contam-se como novas só as diretivas que ainda não estavam na base. Até
  // 29/09/2026 todas as guardadas iam para `inseridos` e o painel anunciava
  // as ~820 como novas todas as semanas.
  console.log('\n[3/3] Supabase upsert...');
  const BATCH = 50;
  let saved = 0, novas = 0, naoGravadas = 0;
  const amostraNovas = [], falhas = [...lotesFalhados];
  const naoLidas = lotesFalhados.length ? celexList.length - registos.length : 0;
  for (let i = 0; i < registos.length; i += BATCH) {
    const lote = registos.slice(i, i + BATCH);
    const { data: jaHavia, error: erroLeitura } = await db
      .from('diretivas_ue').select('id').in('id', lote.map((r) => r.id));
    // Sem saber o que já havia, nada se anuncia como novo.
    const existentes = erroLeitura ? new Set(lote.map((r) => r.id)) : new Set((jaHavia ?? []).map((r) => r.id));

    const { error } = await db.from('diretivas_ue').upsert(lote, { onConflict: 'id' });
    if (error) {
      console.warn(`  ⚠ batch ${i}: ${error.message}`);
      naoGravadas += lote.length;
      if (falhas.length < 30) falhas.push({ motivo: `${lote.length} diretivas não gravadas — ${error.message}` });
      continue;
    }
    saved += lote.length;
    for (const r of lote) {
      if (existentes.has(r.id)) continue;
      novas++;
      if (amostraNovas.length < 30) amostraNovas.push({ id: r.id, label: `${r.id} — ${r.titulo ?? 'sem título'}` });
    }
  }

  // Fase 4: o que já não está na lista sai da tabela — as rectificações que
  // entravam como diretivas até 30/09/2026 e, daqui para a frente, as
  // diretivas que deixam de estar em vigor. Só com uma lista plausível: uma
  // lista vazia ou curta por avaria do SPARQL não pode esvaziar a tabela.
  let removidas = 0, rectificacoesRemovidas = 0;
  if (celexList.length >= 100) {
    const naLista = new Set(celexList);
    const existentes = [];
    for (let o = 0; ; o += 1000) {
      const { data, error } = await db.from('diretivas_ue').select('id').order('id').range(o, o + 999);
      if (error) { console.warn(`  ⚠ não foi possível ler a tabela para limpar: ${error.message}`); existentes.length = 0; break; }
      existentes.push(...(data ?? []).map((r) => r.id));
      if (!data || data.length < 1000) break;
    }
    const aRemover = existentes.filter((id) => !naLista.has(id));
    for (let i = 0; i < aRemover.length; i += 100) {
      const parte = aRemover.slice(i, i + 100);
      const { error } = await db.from('diretivas_ue').delete().in('id', parte);
      if (error) { console.warn(`  ⚠ remoção falhou: ${error.message}`); break; }
      removidas += parte.length;
      rectificacoesRemovidas += parte.filter((id) => /R\(\d+\)$/.test(id)).length;
    }
    if (removidas) console.log(`  → ${removidas} removidas da tabela (${rectificacoesRemovidas} rectificações, ${removidas - rectificacoesRemovidas} já não em vigor)`);
  }

  // Só as diretivas COM prazo são relevantes para monitorizar Portugal
  const comPrazo    = registos.filter((r) => !!r.prazo_transposicao);
  const transpostas = registos.filter((r) => r.transposto_pt).length;
  const emAtraso    = comPrazo.filter((r) => r.em_atraso).length;
  const porTranspor = comPrazo.filter((r) => !r.transposto_pt && !r.em_atraso).length;
  const semPrazo    = registos.filter((r) => !r.prazo_transposicao).length;

  console.log(`\n  ✓ ${saved} diretivas guardadas (${novas} novas)`);
  console.log(`    Com prazo de transposição : ${comPrazo.length}`);
  console.log(`    Transpostas PT            : ${transpostas}`);
  console.log(`    Em atraso (multa possível): ${emAtraso}`);
  console.log(`    Por transpor (no prazo)   : ${porTranspor}`);
  console.log(`    Sem prazo (delg./execução): ${semPrazo}`);

  // Uma diretiva que não se conseguiu ler conta como erro, tal como uma que
  // não se conseguiu gravar — as duas ficaram com os dados da semana passada.
  const sucesso = naoGravadas === 0 && naoLidas === 0;
  const contagens = { total: celexList.length, inseridos: novas, atualizados: saved - novas, erros: naoGravadas + naoLidas };

  try {
    await db.from('ar_sync_log').insert({ recurso: 'diretivas_ue', sucesso, ...contagens, detalhes: amostraNovas });
  } catch {}

  return {
    ok:      sucesso,
    message: sucesso ? null : [
      naoLidas ? `${naoLidas} diretivas sem resposta do SPARQL` : null,
      naoGravadas ? `${naoGravadas} diretivas não gravadas` : null,
    ].filter(Boolean).join('; '),
    summary: [{
      recurso: 'diretivas_ue', sucesso, ...contagens,
      syncedAt: new Date().toISOString(),
      ...(amostraNovas.length ? { novos: amostraNovas } : {}),
      ...(falhas.length ? { falhas } : {}),
      // O que interessa a quem lê: o estado de Portugal, não só os números do fetch.
      info: [
        {
          nivel: 'info',
          texto: `${emAtraso} diretivas em atraso de transposição em Portugal (prazo passado, sem medidas nacionais comunicadas) e ${porTranspor} ainda dentro do prazo, de ${comPrazo.length} com prazo.`,
        },
        ...(removidas ? [{
          nivel: 'info',
          texto: `${removidas} registos retirados da tabela por já não estarem na lista (${rectificacoesRemovidas} eram rectificações, que não são diretivas).`,
        }] : []),
      ],
    }],
  };
}

async function registarStatus(status, message, summary) {
  try {
    const db = createClient(SUPABASE_URL, SUPABASE_KEY);
    await db.from('sync_status').upsert({
      job: 'eurlex-sync',
      status,
      message: message ?? null,
      summary: summary ?? null,
      last_run_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn(`  ⚠ Sync status não guardado: ${err.message}`);
  }
}

if (process.argv[1].includes('eurlexSync')) {
  syncDiretivasUE()
    .then((r) => registarStatus(r?.ok === false ? 'error' : 'ok', r?.message, r?.summary))
    .catch(async (err) => {
      console.error('  ✗', err.message);
      await registarStatus('error', err.message, null);
      process.exit(1);
    });
}