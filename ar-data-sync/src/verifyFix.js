/**
 * Verifica que o fix de paginação em ParlamentoContext funciona para a Rita Matias.
 * Reproduz exactamente a lógica do useArDeputado + ParlamentoContext após o fix.
 */
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const db = createClient(SUPABASE_URL, SUPABASE_KEY);
const LOTE = 1000;

const paginar = async (tabela, campos, ordenar, filtrar) => {
  const todos = [];
  for (let i = 0; ; i += LOTE) {
    let q = db.from(tabela).select(campos).range(i, i + LOTE - 1);
    if (ordenar) q = q.order(ordenar, { ascending: false });
    if (filtrar) q = filtrar(q);
    const { data } = await q;
    if (!data?.length) break;
    todos.push(...data);
    if (data.length < LOTE) break;
  }
  return todos;
};

console.log('\n=== Verificação do fix de paginação ===\n');

// ANTES do fix: query sem paginação (como estava antes)
const { data: semPaginacao } = await db
  .from('ar_deputados')
  .select('id, cad_id, nome_parlamentar')
  .eq('legislatura', 'XVII');

const semPag_rita = semPaginacao?.find(p => p.nome_parlamentar?.toLowerCase() === 'rita matias');
console.log(`ANTES (sem paginação): ${semPaginacao?.length} deputados carregados`);
console.log(`  Rita Matias encontrada: ${semPag_rita ? `✓ (cad_id=${semPag_rita.cad_id})` : '✗ NÃO encontrada'}`);

// DEPOIS do fix: com paginação
const comPaginacao = await paginar('ar_deputados', 'id, cad_id, nome_parlamentar', null, q => q.eq('legislatura', 'XVII'));
const comPag_rita = comPaginacao.find(p => p.nome_parlamentar?.toLowerCase() === 'rita matias');
console.log(`\nDEPOIS (com paginação): ${comPaginacao.length} deputados carregados`);
console.log(`  Rita Matias encontrada: ${comPag_rita ? `✓ (cad_id=${comPag_rita.cad_id})` : '✗ NÃO encontrada'}`);

if (comPag_rita) {
  // Reproduzir o useArDeputado: buscar iniciativas pelo cad_id
  const cadId = String(comPag_rita.cad_id);
  const { count } = await db
    .from('ar_iniciativas')
    .select('id', { count: 'exact', head: true })
    .contains('autores_dep', JSON.stringify([{ idCadastro: cadId }]));

  console.log(`\n  Iniciativas da Rita Matias (cad_id=${cadId}): ${count}`);
  console.log(count > 0 ? '\n✅ FIX CONFIRMADO — Rita Matias agora tem iniciativas' : '\n❌ Ainda sem iniciativas');
}
