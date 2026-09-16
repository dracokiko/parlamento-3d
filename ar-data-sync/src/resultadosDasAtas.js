/**
 * Lê as atas do DAR à procura do desfecho dos projetos de voto, para comparar
 * com o que os dados abertos da AR registam.
 *
 * CONCLUSÃO DA MEDIÇÃO (setembro de 2026, com as 116 atas da legislatura):
 * não há resultados por recuperar. Dos votos que a AR dá como votados, 96%
 * aparecem nas atas — o parser encontra-os com 97,7% de precisão. Dos 529 sem
 * resultado, aparecem 2. Os dois registos concordam: esses votos não foram
 * votados em plenário, e a ausência de resultado não é uma falha de registo da
 * AR. Alguns foram retirados ou substituídos (têm observação oficial a dizê-lo),
 * outros terão sido decididos em comissão — mas isso não está em lado nenhum
 * nos dados abertos, e por isso o site não o afirma.
 *
 * Vale a pena voltar a correr isto de tempos a tempos: se a AR mudar a forma
 * como regista, o número muda. Uso: node src/resultadosDasAtas.js
 *
 * Os dados abertos da AR só registam resultado para cerca de um quarto dos
 * votos. As atas do plenário registam-nos em texto corrido:
 *
 *   "Foram lidos os Projetos de Voto n.os 1/XVII/1.ª (apresentado pelo PCP)
 *    — De pesar pelo falecimento de Eduardo Gageiro e 8/XVII/1.ª (...) — De
 *    pesar pelo falecimento de Fernando Venâncio, tendo sido aprovadas as
 *    respetivas partes deliberativas (a)."
 *
 * Extrair isto exige cuidado em três pontos:
 *  - o mesmo número existe em Projetos de Lei/Resolução, por isso só contam
 *    os números cujo tipo mais próximo antes deles seja "Projeto de Voto";
 *  - as atas têm gralhas de numeração (encontrámos uma a dizer 606 para o
 *    assunto do 608), por isso o número sozinho não chega: confirmamos também
 *    pelo assunto;
 *  - uma frase pode enumerar vários votos e terminar com um único desfecho
 *    comum, que se aplica a todos os da enumeração.
 */

const NUM_RE = /(\d{1,4})\/XVII\/\d+\.?[ªa]?/g;
const TIPO_RE = /Projetos? de (Voto|Resolução|Lei|Deliberação)|Propostas? de (Lei|Resolução)/g;

const norm = s => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

/** Palavras com peso para comparar assuntos (ignora artigos e preposições). */
const VAZIAS = new Set(['de', 'do', 'da', 'dos', 'das', 'e', 'o', 'a', 'os', 'as', 'em', 'no', 'na',
  'pelo', 'pela', 'para', 'com', 'ao', 'aos', 'que', 'um', 'uma', 'por', 'se', 'sobre']);

function palavras(texto) {
  return new Set(norm(texto).split(' ').filter(p => p.length > 2 && !VAZIAS.has(p)));
}

/** Semelhança entre dois assuntos: proporção de palavras do mais curto que o outro contém. */
export function semelhanca(a, b) {
  const pa = palavras(a), pb = palavras(b);
  if (!pa.size || !pb.size) return 0;
  const [menor, maior] = pa.size <= pb.size ? [pa, pb] : [pb, pa];
  let comuns = 0;
  for (const p of menor) if (maior.has(p)) comuns++;
  return comuns / menor.size;
}

/** Desfecho declarado num troço de ata, ou null. */
function desfecho(trecho) {
  const t = norm(trecho);
  if (/\brejeitad/.test(t)) return 'Rejeitado';
  if (/\baprovad/.test(t)) return 'Aprovado';
  return null;
}

/**
 * Extrai de uma ata todas as menções a projetos de voto.
 * Devolve [{ numero, assunto, resultado }].
 */
export function extrairVotosDaAta(transcricao) {
  if (!transcricao) return [];

  // Onde começa cada tipo de iniciativa, para saber a que tipo pertence cada número
  const tipos = [];
  TIPO_RE.lastIndex = 0;
  for (const m of transcricao.matchAll(TIPO_RE)) {
    tipos.push({ idx: m.index, tipo: m[1] ?? m[2] });
  }

  const tipoAntesDe = pos => {
    let t = null;
    for (const x of tipos) { if (x.idx < pos) t = x.tipo; else break; }
    return t;
  };

  // Ocorrências de "N/XVII/..." que pertencem a projetos de voto
  const ocorrencias = [];
  NUM_RE.lastIndex = 0;
  for (const m of transcricao.matchAll(NUM_RE)) {
    if (tipoAntesDe(m.index) !== 'Voto') continue;
    ocorrencias.push({ numero: m[1], inicio: m.index, fim: m.index + m[0].length });
  }
  if (!ocorrencias.length) return [];

  const out = [];
  for (let i = 0; i < ocorrencias.length; i++) {
    const oc = ocorrencias[i];
    const seguinte = ocorrencias[i + 1];

    // O assunto vem depois do travessão que se segue ao número, até ao próximo
    // número da enumeração ou até ao fim da frase.
    const limite = seguinte ? seguinte.inicio : Math.min(oc.fim + 900, transcricao.length);
    const depois = transcricao.slice(oc.fim, limite);
    const mTravessao = depois.match(/[—–-]\s*([^.]{5,300})/);
    const assunto = mTravessao ? mTravessao[1].trim() : null;

    // O desfecho pode estar logo a seguir a este voto ou no fim da enumeração:
    // procuramos a partir daqui até ao fim da frase que fecha a enumeração.
    const janelaFim = Math.min((seguinte ? seguinte.fim : oc.fim) + 1200, transcricao.length);
    let janela = transcricao.slice(oc.fim, janelaFim);
    // não atravessar para outro tipo de iniciativa
    const corte = janela.search(/Projetos? de (Resolução|Lei|Deliberação)|Propostas? de (Lei|Resolução)/);
    if (corte > 0) janela = janela.slice(0, corte);

    out.push({ numero: oc.numero, assunto, resultado: desfecho(janela) });
  }
  return out;
}

// ── Diagnóstico ───────────────────────────────────────────────────────────────

const LIMIAR_SEMELHANCA = 0.5;

/** Compara os votos da base de dados com o que as atas dizem. */
export async function compararComAtas(db) {
  const { data: debs } = await db.from('ar_debates').select('id, data_debate, transcricao').not('transcricao', 'is', null);
  const porNumero = new Map();
  for (const d of debs ?? []) {
    for (const v of extrairVotosDaAta(d.transcricao)) {
      if (!porNumero.has(v.numero)) porNumero.set(v.numero, []);
      porNumero.get(v.numero).push({ ...v, data: d.data_debate, debate: d.id });
    }
  }

  const { data: votos } = await db.from('ar_votos_mocoes').select('id, numero, assunto, data_entrada, resultado').limit(5000);
  const naAta = v => (porNumero.get(String(v.numero)) ?? [])
    .filter(c => c.resultado && (!v.data_entrada || c.data >= v.data_entrada))
    .map(c => ({ ...c, sim: semelhanca(v.assunto, c.assunto ?? '') }))
    .filter(c => c.sim >= LIMIAR_SEMELHANCA)
    .sort((a, b) => b.sim - a.sim)[0] ?? null;

  const r = { atas: debs?.length ?? 0, comResultado: 0, confirmados: 0, divergentes: [], semResultado: 0, recuperaveis: [] };
  for (const v of votos ?? []) {
    const c = naAta(v);
    if (v.resultado) {
      r.comResultado++;
      if (!c) continue;
      if (c.resultado === v.resultado) r.confirmados++;
      else r.divergentes.push({ numero: v.numero, oficial: v.resultado, ata: c.resultado, data: c.data });
    } else {
      r.semResultado++;
      if (c) r.recuperaveis.push({ numero: v.numero, resultado: c.resultado, data: c.data, assunto: v.assunto });
    }
  }
  return r;
}

if (process.argv[1]?.includes('resultadosDasAtas')) {
  const { createClient } = await import('@supabase/supabase-js');
  const { SUPABASE_URL, SUPABASE_KEY } = await import('./config.js');
  const r = await compararComAtas(createClient(SUPABASE_URL, SUPABASE_KEY));
  const decididos = r.confirmados + r.divergentes.length;
  console.log(`\natas lidas: ${r.atas}`);
  console.log(`votos com resultado oficial: ${r.comResultado} → encontrados na ata: ${decididos}, dos quais ${r.confirmados} confirmam (${decididos ? (r.confirmados / decididos * 100).toFixed(1) : 0}% de precisão)`);
  for (const d of r.divergentes.slice(0, 5)) console.log(`   divergência: nº${d.numero} oficial=${d.oficial} ata=${d.ata} (${d.data})`);
  console.log(`\nvotos sem resultado: ${r.semResultado} → com desfecho recuperável da ata: ${r.recuperaveis.length}`);
  for (const x of r.recuperaveis.slice(0, 10)) console.log(`   nº${x.numero} → ${x.resultado} (ata ${x.data}) — ${(x.assunto ?? '').slice(0, 70)}`);
}
