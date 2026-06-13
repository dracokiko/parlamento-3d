/**
 * Diagnóstico aprofundado: corre o parser no debate suspeito e mostra o resultado.
 */
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { parsearIntervencoes } from './interventionParser.js';

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const DEBATE_ID = process.argv[2] ?? 'dar_093_2026-05-20';
const NOME_FILTRO = (process.argv[3] ?? 'Rita Matias').toLowerCase();

const { data: debate } = await db
  .from('ar_debates')
  .select('id, transcricao')
  .eq('id', DEBATE_ID)
  .single();

if (!debate?.transcricao) { console.log('Debate não encontrado ou sem transcrição.'); process.exit(); }

console.log(`\nDebate: ${DEBATE_ID} (${debate.transcricao.length} chars)\n`);

// Correr o parser e filtrar pelo nome
const ivs = parsearIntervencoes(debate.transcricao);
const deste = ivs.filter(iv => iv.nome.toLowerCase().includes(NOME_FILTRO));

console.log(`Total de intervenções no debate: ${ivs.length}`);
console.log(`Atribuídas a "${NOME_FILTRO}": ${deste.length}\n`);

for (const iv of deste) {
  console.log(`nome="${iv.nome}"  partido="${iv.partido}"  palavras=${iv.texto.trim().split(/\s+/).length}`);
  console.log(`  texto: "${iv.texto.slice(0, 150).replace(/\n/g, '↵')}"`);
  console.log();
}

// Procurar o texto "Eram todos amigos" na transcrição para perceber o contexto
const PROCURAR = 'Eram todos amigos';
const idx = debate.transcricao.indexOf(PROCURAR);
if (idx >= 0) {
  console.log(`\nContexto de "${PROCURAR}" na transcrição bruta (±400 chars):`);
  console.log('---');
  console.log(debate.transcricao.slice(Math.max(0, idx - 400), idx + 200));
  console.log('---');
}
