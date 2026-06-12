import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { parsearIntervencoes } from './interventionParser.js';

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// Contagens gerais
const { count: totalComUrl } = await db
  .from('ar_debates')
  .select('*', { count: 'exact', head: true })
  .not('url_diario', 'is', null);

const { count: totalComTranscricao } = await db
  .from('ar_debates')
  .select('*', { count: 'exact', head: true })
  .not('transcricao', 'is', null);

const { count: totalSemTranscricao } = await db
  .from('ar_debates')
  .select('*', { count: 'exact', head: true })
  .not('url_diario', 'is', null)
  .is('transcricao', null);

const { count: totalIndexados } = await db
  .from('ar_intervencoes')
  .select('debate_id', { count: 'exact', head: true });

const { data: debatesIndexados } = await db
  .from('ar_intervencoes')
  .select('debate_id');
const uniqueDebatesIndexados = new Set((debatesIndexados ?? []).map(r => r.debate_id)).size;

console.log('\n=== ESTADO GERAL ===');
console.log(`Debates com url_diario:          ${totalComUrl}`);
console.log(`Debates com transcrição:         ${totalComTranscricao}`);
console.log(`Debates SEM transcrição:         ${totalSemTranscricao}`);
console.log(`Debates únicos com intervenções: ${uniqueDebatesIndexados}`);
console.log(`Total de intervenções:           ${totalIndexados}`);

// Buscar debates COM transcrição mas SEM entradas em ar_intervencoes
const { data: comTranscricao } = await db
  .from('ar_debates')
  .select('id')
  .not('transcricao', 'is', null);

const { data: jaIndexados } = await db
  .from('ar_intervencoes')
  .select('debate_id');

const indexadosSet = new Set((jaIndexados ?? []).map(r => r.debate_id));
const naoIndexados = (comTranscricao ?? []).filter(d => !indexadosSet.has(d.id));

console.log(`\nDebates com transcrição mas NÃO indexados: ${naoIndexados.length}`);

// Amostra dos não indexados — testar se parser encontra alguma coisa
const { data: amostra } = await db
  .from('ar_debates')
  .select('id, data_debate, transcricao')
  .in('id', naoIndexados.slice(0, 10).map(d => d.id));

let comIntervencoes = 0, semIntervencoes = 0;
for (const d of amostra ?? []) {
  const n = parsearIntervencoes(d.transcricao ?? '').length;
  if (n > 0) comIntervencoes++;
  else semIntervencoes++;
}

console.log(`  → Dos primeiros 10: ${comIntervencoes} têm intervenções, ${semIntervencoes} não têm (sumários/vazios)`);
