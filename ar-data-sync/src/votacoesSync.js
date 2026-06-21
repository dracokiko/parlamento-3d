/**
 * Extrai resultados de votações dos IniEventos em ar_iniciativas
 * e guarda-os em ar_votacoes.
 *
 * Uso:
 *   node src/votacoesSync.js               — sync completo
 *   node src/votacoesSync.js --diagnostico — mostra exemplos sem guardar
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const PAGE = 500;

// Remove tags HTML; preserva newlines (usadas como separadores de secção)
function stripHtml(s) {
  return s ? s.replace(/<[^>]+>/g, '').replace(/[^\S\n]+/g, ' ').trim() : '';
}

// Extrai GPs de uma secção: "A Favor: PS, PSD..." → ["PS","PSD",...]
function parseSecaoGPs(texto, secao) {
  const re = new RegExp(secao + '.*?:\\s*([^\n]+)', 'i');
  const m = texto.match(re);
  if (!m) return [];
  return m[1].split(',').map(s => s.trim()).filter(Boolean);
}

// Processa o campo "detalhe" HTML em estrutura limpa
function parseDetalhe(detalhe) {
  if (!detalhe) return null;
  const comNewlines = detalhe.replace(/<BR\s*\/?>/gi, '\n');
  const txt = stripHtml(comNewlines);
  return {
    raw: txt,
    favor:     parseSecaoGPs(txt, 'A Favor'),
    contra:    parseSecaoGPs(txt, 'Contra'),
    abstencao: parseSecaoGPs(txt, 'Absten'),
  };
}

// Siglas de partidos conhecidos (para distinguir de nomes de deputados)
const SIGLAS_GP = new Set(['PSD','PS','CH','IL','BE','PCP','L','JPP','PAN','CDS-PP','CDS','PEV','PPD','PPM']);

// RE para "Nome Apelido (PARTIDO)" — o nome pode ter 2+ palavras com iniciais maiúsculas
const RE_NOME_DEP = /^(.+?)\s*\(([A-Z][\w-]+)\)$/;
// RE para "N-PARTIDO" — deputados anónimos em dissidência
const RE_ANON     = /^(\d+)-([A-Z][\w-]+)$/;

/**
 * Extrai deputados que votaram de forma diferente do seu grupo parlamentar.
 * Retorna array de { nome, partido, posicao, posicao_partido, rebelde }.
 */
export function parseDeputadosIsolados(detalheRaw) {
  if (!detalheRaw) return [];

  const comNewlines = detalheRaw.replace(/<BR\s*\/?>/gi, '\n');
  const txt = stripHtml(comNewlines);

  const SECOES = [
    { key: 'favor',     re: /A Favor[^:\n]*:(.*?)(?=Contra:|Absten|$)/is },
    { key: 'contra',    re: /Contra[^:\n]*:(.*?)(?=A Favor:|Absten|$)/is },
    { key: 'abstencao', re: /Absten[^:\n]*:(.*?)(?=A Favor:|Contra:|$)/is },
  ];

  // 1. Determinar posição do grupo de cada partido
  const posGrupo = {};
  for (const { key, re } of SECOES) {
    const m = txt.match(re);
    if (!m) continue;
    for (const item of m[1].split(',').map(s => s.trim()).filter(Boolean)) {
      if (SIGLAS_GP.has(item)) posGrupo[item] = key;
    }
  }

  // 2. Extrair deputados nomeados em dissidência
  const isolados = [];
  for (const { key, re } of SECOES) {
    const m = txt.match(re);
    if (!m) continue;
    for (const item of m[1].split(',').map(s => s.trim()).filter(Boolean)) {
      const mNome = item.match(RE_NOME_DEP);
      if (mNome) {
        const nome    = mNome[1].trim();
        const partido = mNome[2].trim();
        const posP    = posGrupo[partido] ?? null;
        isolados.push({
          nome,
          partido,
          posicao:         key,
          posicao_partido: posP,
          rebelde:         posP !== null && posP !== key,
        });
      }
    }
  }

  return isolados;
}

function safeDate(v) {
  if (!v) return null;
  const s = String(v).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function parseBool(v) {
  if (v == null) return null;
  if (typeof v === 'boolean') return v;
  const s = String(v).toUpperCase();
  return s === 'S' || s === '1' || s === 'TRUE' ? true : s === 'N' || s === '0' || s === 'FALSE' ? false : null;
}

function parseInt2(v) {
  const n = parseInt(v, 10);
  return isNaN(n) ? null : n;
}

/**
 * Extrai registos de votação de uma iniciativa.
 * Votacao é um array com objectos:
 *   { id, data, resultado, detalhe, reuniao, unanime, ausencias, tipoReuniao, publicacao }
 */
function extrairVotacoes(iniciativaId, eventos) {
  if (!Array.isArray(eventos)) return [];
  const registos = [];

  for (const evt of eventos) {
    const votArray = evt?.Votacao;
    if (!Array.isArray(votArray) || votArray.length === 0) continue;

    for (const vot of votArray) {
      if (!vot || typeof vot !== 'object') continue;

      const votId = String(vot.id ?? '');
      const oevId = String(evt.OevId ?? '');
      const key   = votId || oevId;
      if (!key) continue;

      const id = `${iniciativaId}_${key}`;

      registos.push({
        id,
        iniciativa_id: iniciativaId,
        vot_id:        votId || null,
        oev_id:        oevId || null,
        evt_id:        String(evt.EvtId ?? '') || null,
        fase:          evt.Fase ?? null,
        codigo_fase:   String(evt.CodigoFase ?? ''),
        data_votacao:  safeDate(vot.data ?? evt.DataFase),
        resultado:     vot.resultado ?? null,
        unanime:       parseBool(vot.unanime),
        ausencias:     parseInt2(vot.ausencias),
        reuniao:       vot.reuniao ?? null,
        tipo_reuniao:  vot.tipoReuniao ?? null,
        detalhe_raw:         vot.detalhe ?? null,
        detalhe_gp:          parseDetalhe(vot.detalhe),
        deputados_isolados:  parseDeputadosIsolados(vot.detalhe ?? null),
        publicacao:          evt.PublicacaoFase ?? null,
        json_raw:            vot,
      });
    }
  }

  return registos;
}

export async function syncVotacoes() {
  console.log('\n' + '='.repeat(55));
  console.log('  VOTAÇÕES — extracção de IniEventos');
  console.log('='.repeat(55));

  let offset = 0;
  let totalIniciativas = 0;
  let totalVotacoes = 0;
  let totalComDivergentes = 0;

  while (true) {
    const { data, error } = await db
      .from('ar_iniciativas')
      .select('id, eventos')
      .not('eventos', 'is', null)
      .range(offset, offset + PAGE - 1);

    if (error) { console.error('Erro ao ler ar_iniciativas:', error.message); break; }
    if (!data?.length) break;

    const batch = [];
    for (const ini of data) {
      totalIniciativas++;
      const vots = extrairVotacoes(ini.id, ini.eventos);
      batch.push(...vots);
      for (const v of vots) {
        if (v.deputados_isolados?.some(d => d.rebelde)) totalComDivergentes++;
      }
    }

    totalVotacoes += batch.length;

    if (batch.length) {
      const { error: upsertErr } = await db
        .from('ar_votacoes')
        .upsert(batch, { onConflict: 'id' });

      if (upsertErr) console.error('  Erro no upsert:', upsertErr.message);
    }

    process.stdout.write(`  … ${totalIniciativas} iniciativas | ${totalVotacoes} votações\r`);

    if (data.length < PAGE) break;
    offset += PAGE;
  }

  console.log(`\n  ✓ Iniciativas processadas  : ${totalIniciativas}`);
  console.log(`  ✓ Votações extraídas        : ${totalVotacoes}`);
  console.log(`  ✓ Com votos divergentes     : ${totalComDivergentes}`);
  return { ok: true, total: totalVotacoes, comDivergentes: totalComDivergentes };
}

async function diagnosticarVotacoes() {
  console.log('\n' + '='.repeat(55));
  console.log('  DIAGNÓSTICO: primeiras votações encontradas');
  console.log('='.repeat(55));

  let offset = 0;
  let encontrados = 0;

  while (encontrados < 5) {
    const { data } = await db
      .from('ar_iniciativas')
      .select('id, eventos')
      .not('eventos', 'is', null)
      .range(offset, offset + 199);

    if (!data?.length) break;

    for (const ini of data) {
      const vots = extrairVotacoes(ini.id, ini.eventos);
      if (vots.length) {
        console.log(`\n── Iniciativa ${ini.id} (${vots.length} votação(ões))`);
        console.log(JSON.stringify(vots[0], null, 2));
        encontrados++;
        if (encontrados >= 5) break;
      }
    }

    if (data.length < 200) break;
    offset += 200;
  }

  if (!encontrados) {
    console.log('  Nenhuma votação encontrada.');
  }
}

// Execução directa
if (process.argv[1]?.includes('votacoesSync')) {
  const args = process.argv.slice(2);
  if (args.includes('--diagnostico')) {
    await diagnosticarVotacoes();
  } else {
    await syncVotacoes();
  }
  console.log('\nFim.');
}
