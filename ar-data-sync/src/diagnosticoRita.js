/**
 * Diagnóstico: por que razão a Rita Matias não tem iniciativas no painel?
 *
 * A cadeia de lookup é:
 *   deputados.nome (nomeAbrev) → ar_deputados.nome_parlamentar → ar_deputados.cad_id
 *   → ar_iniciativas.autores_dep[].idCadastro
 *
 * Este script verifica cada elo da cadeia.
 */
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const db = createClient(SUPABASE_URL, SUPABASE_KEY);
const NOME = process.argv[2] ?? 'Rita Matias';
const nomeLower = NOME.toLowerCase();

console.log(`\n=== Diagnóstico de iniciativas para: "${NOME}" ===\n`);

// 1. O que está na tabela deputados (hemiciclo 3D)?
console.log('--- 1. Tabela deputados (hemiciclo) ---');
const { data: deps } = await db
  .from('deputados')
  .select('id, nome, nome_completo, partido_sigla')
  .ilike('nome', `%${NOME.split(' ').pop()}%`);

if (!deps?.length) {
  console.log('  ✗ Não encontrado na tabela deputados');
} else {
  deps.forEach(d => console.log(`  id=${d.id}  nome="${d.nome}"  nome_completo="${d.nome_completo}"  partido=${d.partido_sigla}`));
}

// 2. O que está em ar_deputados?
console.log('\n--- 2. Tabela ar_deputados (XVII) ---');
const { data: arDeps } = await db
  .from('ar_deputados')
  .select('id, cad_id, nome_parlamentar, nome_completo, partido_sigla, legislatura')
  .ilike('nome_parlamentar', `%${NOME.split(' ').pop()}%`);

if (!arDeps?.length) {
  console.log('  ✗ Não encontrado em ar_deputados');
} else {
  arDeps.forEach(d =>
    console.log(`  id=${d.id}  cad_id=${d.cad_id}  nome_parlamentar="${d.nome_parlamentar}"  leg=${d.legislatura}  partido=${d.partido_sigla}`)
  );
}

// 3. O match de nomes que useArDeputado faz
console.log('\n--- 3. Simulação do match de nome ---');
const { data: perfisXVII } = await db
  .from('ar_deputados')
  .select('id, cad_id, nome_parlamentar')
  .eq('legislatura', 'XVII');

if (!perfisXVII?.length) {
  console.log('  ✗ Nenhum registo em ar_deputados com legislatura="XVII"!');
  console.log('  → Verifica o valor exacto do campo legislatura na tabela');

  // Mostrar os valores distintos
  const { data: legs } = await db.from('ar_deputados').select('legislatura').limit(20);
  const valores = [...new Set((legs ?? []).map(r => r.legislatura))];
  console.log('  → Valores de legislatura encontrados:', valores);
} else {
  // Tentar match exacto
  const exactMatch = perfisXVII.find(p => p.nome_parlamentar?.toLowerCase() === nomeLower);
  if (exactMatch) {
    console.log(`  ✓ Match EXACTO: "${exactMatch.nome_parlamentar}" (cad_id=${exactMatch.cad_id})`);
  } else {
    // Tentar match parcial (como faz useArDeputado)
    const partialMatch = perfisXVII.find(p => {
      const key = (p.nome_parlamentar ?? '').toLowerCase();
      return key.includes(nomeLower) || nomeLower.includes(key);
    });
    if (partialMatch) {
      console.log(`  ✓ Match PARCIAL: "${partialMatch.nome_parlamentar}" (cad_id=${partialMatch.cad_id})`);
    } else {
      console.log(`  ✗ Nenhum match para "${NOME}" em ar_deputados XVII`);
      // Mostrar os nomes mais próximos
      const primeiro = NOME.split(' ')[0].toLowerCase();
      const ultimos  = NOME.split(' ').slice(-1)[0].toLowerCase();
      const pertos = perfisXVII.filter(p => {
        const k = (p.nome_parlamentar ?? '').toLowerCase();
        return k.includes(primeiro) || k.includes(ultimos);
      });
      if (pertos.length) {
        console.log('  → Nomes semelhantes encontrados:');
        pertos.forEach(p => console.log(`    "${p.nome_parlamentar}" (cad_id=${p.cad_id})`));
      }
    }
  }
}

// 3b. Verificar o valor EXACTO do campo legislatura para a Rita Matias
const ritaRow = arDeps?.find(d => d.nome_parlamentar === 'Rita Matias');
if (ritaRow) {
  const legRaw = ritaRow.legislatura;
  const legBytes = Buffer.from(String(legRaw)).toString('hex');
  console.log(`\n--- 3b. Valor exacto de legislatura para Rita Matias ---`);
  console.log(`  legislatura = "${legRaw}"  (hex: ${legBytes})`);
  console.log(`  Comparação com 'XVII': ${legRaw === 'XVII' ? '✓ IGUAL' : '✗ DIFERENTE'}`);
}

// 4. Verificar iniciativas usando o cad_id correto da Rita Matias (7390)
const cadIdRita = ritaRow?.cad_id ?? arDeps?.find(d => d.nome_parlamentar?.toLowerCase().includes('rita'))?.cad_id;
if (cadIdRita) {
  console.log(`\n--- 4. Iniciativas com cad_id=${cadIdRita} (Rita Matias) ---`);

  // Tentar como string
  const { data: inisStr, count: countStr } = await db
    .from('ar_iniciativas')
    .select('id, titulo, legislatura, data_inicio', { count: 'exact' })
    .contains('autores_dep', JSON.stringify([{ idCadastro: cadIdRita }]))
    .limit(5);

  if (countStr) {
    console.log(`  ✓ ${countStr} iniciativas (idCadastro como string "${cadIdRita}"):`);
    inisStr.forEach(i => console.log(`    ${i.data_inicio}  ${i.titulo?.slice(0, 70)}`));
  } else {
    console.log(`  ✗ Nenhuma iniciativa com idCadastro="${cadIdRita}" (string)`);

    // Tentar como número
    const cadIdNum = Number(cadIdRita);
    if (!isNaN(cadIdNum)) {
      const { count: countNum, data: inisNum } = await db
        .from('ar_iniciativas')
        .select('id, titulo, data_inicio', { count: 'exact' })
        .contains('autores_dep', JSON.stringify([{ idCadastro: cadIdNum }]))
        .limit(5);

      if (countNum) {
        console.log(`  ✓ ${countNum} iniciativas com idCadastro=${cadIdNum} (número):`);
        inisNum.forEach(i => console.log(`    ${i.data_inicio}  ${i.titulo?.slice(0, 70)}`));
        console.log('\n  → BUG CONFIRMADO: cad_id guardado como string, autores_dep usa número inteiro!');
        console.log('  → Fix: mudar String(a.idCadastro) em ParlamentoContext ou normalizar na ingestão');
      } else {
        console.log(`  ✗ Nenhuma iniciativa mesmo com idCadastro=${cadIdNum} (número)`);

        // Verificar se ela tem alguma iniciativa de outra forma
        const { data: sample } = await db
          .from('ar_iniciativas')
          .select('autores_dep')
          .not('autores_dep', 'is', null)
          .limit(3);
        if (sample?.length) {
          console.log('\n  → Exemplo de autores_dep (para verificar estrutura do JSON):');
          sample.forEach(s => console.log('   ', JSON.stringify(s.autores_dep?.[0])));
        }
      }
    }
  }
} else {
  console.log('\n--- 4. Saltado — cad_id da Rita Matias não determinado ---');
}
