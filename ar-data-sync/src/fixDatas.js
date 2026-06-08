/**
 * Corrige data_inicio em ar_iniciativas:
 * usa o evento de Entrada (CodigoFase "10") em vez de DataInicioleg.
 *
 * Uso: node src/fixDatas.js
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const PAGE = 500;

const safeDate = v => {
  if (!v) return null;
  const s = String(v).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

function dataEntrada(eventos) {
  if (!Array.isArray(eventos)) return null;
  const ev = eventos.find(e => e.CodigoFase === '10' || e.Fase === 'Entrada');
  return safeDate(ev?.DataFase);
}

async function fixDatas() {
  console.log('A corrigir data_inicio em ar_iniciativas...\n');

  let offset = 0, total = 0, atualizados = 0;

  while (true) {
    const { data, error } = await db
      .from('ar_iniciativas')
      .select('id, eventos')
      .range(offset, offset + PAGE - 1);

    if (error) { console.error('Erro:', error.message); break; }
    if (!data?.length) break;

    const updates = [];
    for (const ini of data) {
      total++;
      const dataCorreta = dataEntrada(ini.eventos);
      if (dataCorreta) updates.push({ id: ini.id, data_inicio: dataCorreta });
    }

    if (updates.length) {
      const { error: upErr } = await db
        .from('ar_iniciativas')
        .upsert(updates, { onConflict: 'id' });
      if (upErr) console.error('  Erro upsert:', upErr.message);
      else atualizados += updates.length;
    }

    process.stdout.write(`  … ${total} processadas | ${atualizados} corrigidas\r`);
    if (data.length < PAGE) break;
    offset += PAGE;
  }

  console.log(`\n✓ Total: ${total} | Datas corrigidas: ${atualizados}`);
}

await fixDatas();
