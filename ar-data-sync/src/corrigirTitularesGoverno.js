/**
 * Põe o nome da pessoa nas intervenções do Governo que ficaram com o cargo
 * no lugar do nome.
 *
 * Acontece quando o DAR nunca nomeia o ministro numa sessão — o parser só
 * sabe o que a sessão diz. Com o índice de titulares (ver titularesGoverno.js)
 * sabemos quem era, olhando para as outras sessões, e por data, para não
 * atribuir a um titular actual falas do seu antecessor.
 *
 * Correr depois de uma reindexação, ou uma vez para sanar o histórico:
 *   node src/corrigirTitularesGoverno.js
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { carregarTitularesGoverno, titularesNaData, titularDoCargo } from './titularesGoverno.js';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const normalizar = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();

export async function corrigirTitularesGoverno() {
  console.log('\n' + '='.repeat(55));
  console.log('  GOVERNO — NOME EM VEZ DE CARGO');
  console.log('='.repeat(55));

  const indice = await carregarTitularesGoverno(db);
  console.log(`  → ${indice.size} cargos com titular conhecido`);

  // Linhas por corrigir: aquelas em que o nome do orador é o próprio cargo.
  // Paginado — o PostgREST corta a resposta aos 1000 registos e as
  // intervenções do Governo são bem mais do que isso.
  const linhas = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db
      .from('ar_intervencoes')
      .select('id, nome_dep, cargo, data_debate')
      .eq('papel', 'governo')
      .order('id')
      .range(offset, offset + 999);

    if (error) throw new Error(error.message);
    linhas.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  console.log(`  → ${linhas.length} intervenções do Governo lidas`);

  const porCorrigir = linhas.filter(r => r.cargo && r.nome_dep === r.cargo);
  console.log(`  → ${porCorrigir.length} linhas com o cargo no lugar do nome`);

  const porData = new Map();   // data → Map(cargo → nome), calculado uma vez por data
  let corrigidas = 0, semTitular = 0;
  const resolvidos = new Map();

  for (const r of porCorrigir) {
    const data = r.data_debate ?? '';
    if (!porData.has(data)) porData.set(data, titularesNaData(indice, data));
    const nome = titularDoCargo(porData.get(data), r.cargo);

    if (!nome || nome === r.cargo) { semTitular++; continue; }

    const { error: errUpd } = await db.from('ar_intervencoes').update({ nome_dep: nome }).eq('id', r.id);
    if (errUpd) { console.warn(`  ⚠ ${r.id}: ${errUpd.message}`); continue; }

    corrigidas++;
    resolvidos.set(`${r.cargo} → ${nome}`, (resolvidos.get(`${r.cargo} → ${nome}`) ?? 0) + 1);
  }

  for (const [par, n] of [...resolvidos].sort((a, b) => b[1] - a[1])) {
    console.log(`  ↔ ${String(n).padStart(4)} × ${par}`);
  }
  console.log(`\n  ✓ ${corrigidas} corrigidas, ${semTitular} sem titular conhecido em nenhuma sessão`);
  return { total: porCorrigir.length, inseridos: 0, atualizados: corrigidas, erros: 0 };
}

if (process.argv[1]?.includes('corrigirTitularesGoverno')) {
  await corrigirTitularesGoverno();
  console.log('\nFim.');
}
