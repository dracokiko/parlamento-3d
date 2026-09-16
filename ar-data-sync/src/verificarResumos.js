/**
 * Verifica os resumos gerados por IA das votações contra os dados estruturados.
 *
 * Nas votações há factos verificáveis por código: o resultado está em
 * `resultado` e o sentido de voto de cada bancada em `detalhe_gp`. Se o resumo
 * disser o contrário, o erro é do resumo.
 *
 * Só faz duas verificações, ambas de alta confiança:
 *
 *   A. Resultado — o resumo diz "foi aprovado" e os dados dizem "Rejeitado"?
 *   B. Unanimidade — o resumo diz "unânime"/"todos os partidos" e os dados
 *      mostram alguém contra ou abstido? Só conta como erro quando o resumo
 *      nem chega a nomear quem divergiu: dizer "unânime, excepto o PCP" é má
 *      redação, não desinformação, e não queremos misturar as duas coisas.
 *
 * NÃO tenta verificar o sentido de voto partido a partido. Foi tentado com
 * atribuição por proximidade entre siglas e expressões de voto e produziu
 * falsos positivos em massa: em português a sigla tanto vem antes do verbo
 * ("o PSD absteve-se") como depois ("a favor: PSD, PS"), "contra" aparece como
 * preposição ("proteção contra abusos"), e frases encadeadas ("o IL votou
 * contra e o PSD absteve-se") quebram qualquer regra de distância. Um
 * verificador que assinala 65% dos resumos é pior do que não ter verificador —
 * para essa parte é preciso leitura humana de uma amostra.
 *
 * Uso: node src/verificarResumos.js
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const norm = s => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Entradas de `detalhe_gp` que são bancadas, não deputados a título individual. */
const ehPartido = s => !/^\d+\s*-/.test(s) && !/\(.+\)/.test(s);

const mencionado = (texto, sigla) =>
  new RegExp(`(^|[^A-Za-zÀ-ÿ-])${sigla.replace('-', '\\-')}([^A-Za-zÀ-ÿ-]|$)`).test(texto);

/** O resultado que o resumo afirma, ou null se não afirma nenhum. */
function resultadoAfirmado(texto) {
  const m = norm(texto).match(/\bnao foi aprovad|foi aprovad|foi rejeitad|foi chumbad/);
  if (!m) return null;
  return m[0].startsWith('foi aprovad') ? 'Aprovado' : 'Rejeitado';
}

export function verificar(v) {
  const problemas = [];
  const g = v.detalhe_gp ?? {};
  const divergentes = [...(g.contra ?? []), ...(g.abstencao ?? [])]
    .map(s => s.trim()).filter(Boolean).filter(ehPartido);

  // A. Resultado
  const afirmado = resultadoAfirmado(v.resumo_ia);
  if (afirmado && v.resultado && afirmado !== v.resultado) {
    problemas.push({ tipo: 'resultado', diz: afirmado, real: v.resultado });
  }

  // B. Unanimidade afirmada sem nomear quem divergiu
  if (/\bunanim|todos os partidos|todas as bancadas/.test(norm(v.resumo_ia)) && divergentes.length) {
    const omitidos = divergentes.filter(s => !mencionado(v.resumo_ia, s));
    if (omitidos.length) problemas.push({ tipo: 'unanimidade', omitidos });
  }

  return problemas;
}

export async function verificarResumosVotacoes() {
  const r = { analisadas: 0, comErro: 0, porTipo: {}, casos: [] };
  let offset = 0;

  while (true) {
    const { data, error } = await db
      .from('ar_votacoes')
      .select('id, iniciativa_id, resultado, detalhe_gp, resumo_ia')
      .not('resumo_ia', 'is', null).neq('resumo_ia', '')
      .range(offset, offset + 499);
    if (error) { console.error('Erro a ler votações:', error.message); break; }
    if (!data?.length) break;

    for (const v of data) {
      r.analisadas++;
      const problemas = verificar(v);
      if (!problemas.length) continue;
      r.comErro++;
      for (const p of problemas) r.porTipo[p.tipo] = (r.porTipo[p.tipo] ?? 0) + 1;
      r.casos.push({ id: v.id, iniciativa_id: v.iniciativa_id, problemas, resumo: v.resumo_ia });
    }

    if (data.length < 500) break;
    offset += 500;
  }
  return r;
}

if (process.argv[1]?.includes('verificarResumos')) {
  const r = await verificarResumosVotacoes();
  console.log(`\nResumos de votações analisados: ${r.analisadas}`);
  console.log(`Com erro factual confirmado: ${r.comErro} (${(r.comErro / r.analisadas * 100).toFixed(2)}%)`);
  console.log('Por tipo:', JSON.stringify(r.porTipo));
  for (const c of r.casos) {
    console.log('\n' + c.id);
    for (const p of c.problemas) {
      console.log(p.tipo === 'resultado'
        ? `   resultado: resumo diz "${p.diz}", dados dizem "${p.real}"`
        : `   unanimidade: afirma unanimidade mas ${p.omitidos.join(', ')} divergiu(ram) e não é(são) mencionado(s)`);
    }
    console.log('   "' + c.resumo.replace(/\s+/g, ' ').slice(0, 180) + '"');
  }
}
