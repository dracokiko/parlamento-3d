/**
 * Composição do Governo, a partir do artigo do Governo em curso na Wikipédia.
 *
 * Porquê a Wikipédia e não o portal do Governo: a página de composição do
 * portugal.gov.pt é montada no browser por um widget de pesquisa, e os nomes
 * não vêm no HTML. O artigo da Wikipédia tem as mesmas tabelas em wikitexto
 * — cargo, retrato, nome, partido e período — e o período é o que nos
 * interessa mais: quem saiu deixa de ter "presente" e sai da bancada.
 *
 * As fotografias são ficheiros do Wikimedia Commons, servidos por
 * Special:FilePath, que aceita uma largura e devolve a imagem já reduzida.
 *
 * Uso: node src/governoCrawler.js [--dry]
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { empurrarAmostra } from './resumoPublico.js';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

/** Muda quando o Governo mudar de número — é a única coisa que muda. */
export const ARTIGO_GOVERNO = 'XXV Governo Constitucional de Portugal';

const API = 'https://pt.wikipedia.org/w/api.php';
const COMMONS = 'https://commons.wikimedia.org/wiki/Special:FilePath';
const LARGURA_FOTO = 400;

const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** "[[Ministério X|Ministro de Estado]]" → "Ministro de Estado"; tira marcação. */
function limparWiki(texto = '') {
  return texto
    // Ficheiros primeiro e por inteiro: "[[Ficheiro:X.png|centro|200x200px]]"
    // tem canos lá dentro, e tratá-lo como ligação normal deixava
    // "centro|200x200px" colado ao cargo.
    .replace(/\[\[\s*(?:Ficheiro|File|Imagem|Image)\s*:[^\]]*\]\]/gi, ' ')
    .replace(/\[\[([^\]]*)\]\]/g, (_, dentro) => dentro.split('|').pop())
    .replace(/\[https?:[^\]\s]*\s*([^\]]*)\]/gi, '$1')   // [http://… texto] → texto
    .replace(/<[^>]+>/g, ' ')                      // <br>, <center>, <small>
    .replace(/\{\{[^}]*\}\}/g, '')                 // {{RGBpol|PSD}}
    .replace(/\b(?:width|bgcolor|colspan|rowspan|align|style)\s*=\s*"?[^"|\s]*"?/gi, ' ')
    .replace(/'{2,}/g, '')
    .replace(/\(\d{4}[^)]*\)/g, ' ')               // "(1968–)" na célula do nome
    .replace(/[|#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Siglas partidárias que aparecem na coluna do partido. */
const SIGLAS = /^(PPD\/PSD|PSD|CDS[-–]PP|CDS|PS|IL|CH|BE|PCP|PAN|L|JPP|Independente|Ind\.)$/i;

/**
 * O artigo escreve o cargo do chefe do Governo por extenso e com notas
 * ("Primeiro-Ministro da República Portuguesa (Artigo 183.º…)"). Na bancada
 * interessa o cargo, não a citação.
 */
function normalizarCargo(cargo = '') {
  const limpo = cargo.split('(')[0].trim();
  if (/^(?:vice-)?primeiro-ministr/i.test(limpo)) return limpo.replace(/\s+da Rep[úu]blica Portuguesa$/i, '');
  return limpo;
}

const ehCargo = (t = '') => /^(?:vice-)?(?:primeiro-ministr|ministr[oa]\b|secret[áa]ri[oa] de estado|subsecret)/i.test(t);

/** Nome do ficheiro de retrato de uma célula, se houver. */
function extrairRetrato(celula = '') {
  const m = celula.match(/\[\[\s*(?:Ficheiro|File|Imagem|Image)\s*:\s*([^|\]]+)/i);
  if (!m) return null;
  const ficheiro = m[1].trim();
  // Os logótipos dos ministérios também são ficheiros; o retrato é o da
  // coluna própria, mas por segurança ignoramos o que se anuncia como logo.
  if (/logo|bras[aã]o|ministry/i.test(ficheiro)) return null;
  return ficheiro;
}

const fotoDoCommons = (ficheiro) =>
  `${COMMONS}/${encodeURIComponent(ficheiro.replace(/ /g, '_'))}?width=${LARGURA_FOTO}`;

/** "5 de junho de 2025 – presente" → { inicio, fim, emFuncoes } */
function lerPeriodo(texto = '') {
  const limpo = limparWiki(texto);
  const [inicio, fim] = limpo.split(/\s*[–—-]\s*/);
  const emFuncoes = /presente|atualidade|actualidade/i.test(fim ?? '');
  return {
    inicio: inicio?.trim() || null,
    fim: emFuncoes ? null : (fim?.trim() || null),
    emFuncoes,
  };
}

/**
 * Lê as linhas das wikitables do artigo. Cada linha começa em "|-" e as
 * células em "|" no início de linha; interessa-nos a que tem o cargo, a do
 * retrato, a do nome, a do partido e a do período.
 */
function parsearTabelas(wikitexto) {
  const membros = [];

  for (const tabela of wikitexto.split('{|').slice(1)) {
    const corpo = tabela.split('|}')[0];
    // Duas formas de tabela no artigo: a dos ministros (Cargo, Retrato,
    // Nome, Partido, Período) e a dos secretários de Estado (Dependência,
    // Cargo, Detentor, Período), esta com a dependência em rowspan — ou
    // seja, ausente na maioria das linhas. Por isso as células não se lêem
    // por posição, mas pelo que cada uma é.
    if (!/!\s*(Nome|Detentor)/i.test(corpo)) continue;

    for (const linha of corpo.split(/^\|-/m).slice(1)) {
      const brutas = linha.split(/^\s*\|(?!\})/m).slice(1);
      if (brutas.length < 3) continue;

      const retrato = brutas.map(extrairRetrato).find(Boolean) ?? null;
      const limpas = brutas.map(limparWiki).filter(Boolean);

      const cargo = limpas.find(ehCargo);
      if (!cargo) continue;

      const iPeriodo = limpas.findLastIndex(c => /\d{4}/.test(c));
      if (iPeriodo < 0) continue;
      const periodo = lerPeriodo(limpas[iPeriodo]);

      const iPartido = limpas.findIndex((c, i) => i < iPeriodo && SIGLAS.test(c));
      const partido = iPartido >= 0 ? limpas[iPartido] : null;

      // O nome é a última célula antes do partido (ou antes do período,
      // quando não há coluna de partido) que não seja o cargo.
      const limite = iPartido >= 0 ? iPartido : iPeriodo;
      const nome = [...limpas.slice(0, limite)].reverse().find(c => c !== cargo && !ehCargo(c) && !/minist[ée]rio|presid[êe]ncia do conselho/i.test(c));

      if (!nome || nome.length > 60 || !/[a-zà-ú]/i.test(nome)) continue;

      membros.push({ cargo: normalizarCargo(cargo), nome, partido, retrato, ...periodo });
    }
  }

  return membros;
}

async function obterWikitexto(artigo) {
  const url = `${API}?action=parse&page=${encodeURIComponent(artigo)}&prop=wikitext&format=json&formatversion=2`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'parlamento-3d (github.com/dracokiko/parlamento-3d)' },
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Wikipédia HTTP ${res.status}`);
  const j = await res.json();
  const texto = j?.parse?.wikitext;
  if (!texto) throw new Error(`Artigo sem wikitexto: ${artigo}`);
  return texto;
}

export async function syncGoverno({ dry = false } = {}) {
  console.log('\n' + '='.repeat(55));
  console.log('  GOVERNO — COMPOSIÇÃO');
  console.log('='.repeat(55));

  const wikitexto = await obterWikitexto(ARTIGO_GOVERNO);
  const crus = parsearTabelas(wikitexto);

  // O Primeiro-Ministro à cabeça; a ordem das tabelas é a ordem de
  // precedência do artigo, que segue a dos decretos de nomeação.
  const registos = crus.map((m, i) => ({
    id: `${slug(m.nome)}--${slug(m.cargo)}`.slice(0, 120),
    nome: m.nome,
    cargo: m.cargo,
    partido: m.partido,
    foto_url: m.retrato ? fotoDoCommons(m.retrato) : null,
    ordem: /primeiro-ministr/i.test(m.cargo) ? 0 : i + 1,
    inicio: m.inicio,
    fim: m.fim,
    em_funcoes: m.emFuncoes,
    governo: ARTIGO_GOVERNO.replace(' de Portugal', ''),
    fonte: `https://pt.wikipedia.org/wiki/${encodeURIComponent(ARTIGO_GOVERNO.replace(/ /g, '_'))}`,
    synced_at: new Date().toISOString(),
  }));

  const emFuncoes = registos.filter(r => r.em_funcoes).length;
  console.log(`  → ${registos.length} membros no artigo, ${emFuncoes} em funções, ${registos.filter(r => r.foto_url).length} com retrato`);

  if (dry) {
    registos.slice(0, 12).forEach(r => console.log(`    [${String(r.ordem).padStart(2)}] ${r.nome.padEnd(30)} ${r.cargo.slice(0, 48).padEnd(50)} ${r.em_funcoes ? 'em funções' : 'saiu'}`));
    return { total: registos.length, inseridos: 0, atualizados: 0, erros: 0, novos: [], falhas: [] };
  }

  const novos = [], falhas = [];
  let inseridos = 0, erros = 0;

  const { data: existentes, error: erroTabela } = await db.from('governo_membros').select('id');
  if (erroTabela) {
    // A migração ainda não correu — nada a fazer, e não é motivo para
    // derrubar o pipeline: a bancada continua a funcionar sem a tabela.
    console.warn(`  ⚠ tabela governo_membros ainda não existe (${erroTabela.message}) — a saltar`);
    return { total: registos.length, inseridos: 0, atualizados: 0, erros: 0, novos: [], falhas: [], porMigrar: true };
  }
  const jaLa = new Set((existentes ?? []).map(r => r.id));

  for (let i = 0; i < registos.length; i += 100) {
    const lote = registos.slice(i, i + 100);
    const { error } = await db.from('governo_membros').upsert(lote, { onConflict: 'id' });
    if (error) {
      erros += lote.length;
      empurrarAmostra(falhas, { motivo: `Upsert de ${lote.length} membros falhou: ${error.message}` });
      continue;
    }
    for (const r of lote) {
      if (jaLa.has(r.id)) continue;
      inseridos++;
      empurrarAmostra(novos, { id: r.id, label: `${r.nome} — ${r.cargo}` });
    }
  }

  // Quem desapareceu do artigo deixou o Governo: não se apaga (o histórico
  // das intervenções continua a fazer sentido), marca-se como fora.
  const idsAtuais = new Set(registos.map(r => r.id));
  const { data: todos } = await db.from('governo_membros').select('id, nome, em_funcoes');
  const saidos = (todos ?? []).filter(r => r.em_funcoes && !idsAtuais.has(r.id));
  for (const s of saidos) {
    await db.from('governo_membros').update({ em_funcoes: false, synced_at: new Date().toISOString() }).eq('id', s.id);
    console.log(`  − ${s.nome} saiu do Governo`);
  }

  console.log(`\n  ✓ ${registos.length} membros (${inseridos} novos, ${saidos.length} que saíram), ${erros} erros`);
  return {
    total: registos.length, inseridos, atualizados: registos.length - inseridos, erros, novos, falhas,
  };
}

if (process.argv[1]?.includes('governoCrawler')) {
  await syncGoverno({ dry: process.argv.includes('--dry') });
  console.log('\nFim.');
}
