import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const nome = process.argv[2] ?? 'Pedro Pinto';
console.log(`\nA procurar intervenções de: "${nome}"\n`);

// Paginar ar_intervencoes para encontrar todas as entradas do deputado
let todas = [], offset = 0;
const LOTE = 1000;
while (true) {
  const { data } = await db
    .from('ar_intervencoes')
    .select('id, nome_dep, data_debate, assunto')
    .ilike('nome_dep', `%${nome}%`)
    .order('data_debate', { ascending: false })
    .range(offset, offset + LOTE - 1);
  if (!data?.length) break;
  todas.push(...data);
  if (data.length < LOTE) break;
  offset += LOTE;
}

if (!todas.length) {
  console.log('Nenhuma intervenção encontrada.');
} else {
  console.log(`Total: ${todas.length} intervenções\n`);
  console.log('Mais recentes:');
  todas.slice(0, 10).forEach(i =>
    console.log(`  ${i.data_debate}  ${(i.assunto ?? '').slice(0, 60)}`)
  );
  console.log('\nMais antigas:');
  todas.slice(-5).forEach(i =>
    console.log(`  ${i.data_debate}  ${(i.assunto ?? '').slice(0, 60)}`)
  );
}
