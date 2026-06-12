import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { parsearIntervencoes } from './interventionParser.js';

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// Debates mais recentes com transcrição
const { data: debates } = await db
  .from('ar_debates')
  .select('id, assunto, data_debate, transcricao')
  .not('transcricao', 'is', null)
  .order('data_debate', { ascending: false })
  .limit(20);

// Quais já estão indexados
const { data: indexados } = await db
  .from('ar_intervencoes')
  .select('debate_id')
  .in('debate_id', debates.map(d => d.id));

const indexadosSet = new Set((indexados ?? []).map(r => r.debate_id));

console.log('\nÚltimos 20 debates com transcrição:\n');
console.log('ID'.padEnd(25), 'Data'.padEnd(12), 'Indexado'.padEnd(10), 'Interv.'.padEnd(10), 'Texto (chars)');
console.log('-'.repeat(75));

for (const d of debates) {
  const indexed  = indexadosSet.has(d.id);
  const parsed   = parsearIntervencoes(d.transcricao ?? '');
  const chars    = d.transcricao?.length ?? 0;
  console.log(
    d.id.padEnd(25),
    (d.data_debate ?? '').padEnd(12),
    String(indexed).padEnd(10),
    String(parsed.length).padEnd(10),
    chars
  );

  // Mostrar amostra de transcrições não indexadas com texto mas 0 intervenções
  if (!indexed && parsed.length === 0 && chars > 200) {
    console.log('\n  >>> AMOSTRA (primeiros 600 chars):');
    console.log(d.transcricao.slice(0, 600).replace(/\n/g, '\n  '));
    console.log();
  }
}
