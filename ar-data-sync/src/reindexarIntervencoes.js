/**
 * Apaga todas as ar_intervencoes e re-indexa a partir das transcrições existentes.
 * Usar quando o parser foi corrigido e os dados antigos estão errados.
 */
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { indexarIntervencoes } from './summarizer.js';

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// Contar antes de apagar
const { count: total } = await db
  .from('ar_intervencoes')
  .select('id', { count: 'exact', head: true });

console.log(`\n  ar_intervencoes: ${total} registos existentes`);
console.log('  A apagar tudo...');

// Apagar em lotes (Supabase não apaga tabelas inteiras sem filtro por defeito)
let apagados = 0;
while (true) {
  const { data: lote } = await db
    .from('ar_intervencoes')
    .select('id')
    .limit(1000);

  if (!lote?.length) break;

  const ids = lote.map(r => r.id);
  await db.from('ar_intervencoes').delete().in('id', ids);
  apagados += ids.length;
  process.stdout.write(`  Apagados: ${apagados}/${total}\r`);
}

console.log(`\n  ✓ ${apagados} registos apagados`);
console.log('\n  A re-indexar com o parser corrigido...\n');

await indexarIntervencoes();

console.log('\n  ✓ Re-indexação concluída');
