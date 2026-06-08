/**
 * Diagnóstico: mostra a estrutura dos JSONs da AR para perceber
 * onde estão os dados de votações.
 *
 * Uso: node src/diagnosticoVotacoes.js
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

// ── 1. Chaves do ficheiro AtividadesXVII ─────────────────────────────────────

const URL_ATIVIDADES = 'https://app.parlamento.pt/webutils/docs/doc.txt?path=MvC%2beisjw0NRM%2b5VPH%2bMQs5Gt2qv74TPZF5glj1aifwO0zMmLlbffto8DV6i%2bOqsFwvUGB1aoK1MS0SUSBj6QdbFHywkApglmKeKfi2BmkQARJ5ySv5SIETQTYxHz5PxIX%2fGM693nC1O0q4rroauUdKupOi8zzMeCFNuYpl6Kt1BTDwkV%2fBz%2fHQg8JCYa5Jauy53%2bdAiC2ePgjFzCqAK8HZHByoUg0bgVvKEBzx4VzNV0dXT1JM6UaKOI3DxVyer61k2d6PBzqopQNLIcybR%2fjqPwQopwp58n3uXv1x3sAEhwsNyV8rVL%2bAuz%2biUEk1Y%2bb6mW2UH0SsJCHdsEq150IMI6F1Qp9kEPjopgvYcqgQmjbMlqAEmnSNn6kleSQm4&fich=AtividadesXVII_json.txt&Inline=true';

async function verEstrutura(nome, url, maxBytes = 8000) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`FICHEIRO: ${nome}`);
  console.log('='.repeat(60));
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) { console.error(`HTTP ${res.status}`); return; }

    // Ler apenas os primeiros maxBytes
    const reader = res.body.getReader();
    let bytes = new Uint8Array(0);
    while (bytes.length < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      const merged = new Uint8Array(bytes.length + value.length);
      merged.set(bytes); merged.set(value, bytes.length);
      bytes = merged;
    }
    reader.cancel();

    const txt = new TextDecoder().decode(bytes.slice(0, maxBytes));
    console.log('Início do ficheiro (primeiros 8000 chars):');
    console.log(txt);

    // Tentar extrair chaves de topo do JSON
    const topKeysMatch = txt.match(/^\s*\{([^{[\]]*)/);
    if (topKeysMatch) {
      const keys = [...txt.matchAll(/"([^"]+)"\s*:/g)].slice(0, 20).map(m => m[1]);
      console.log('\nPrimeiras chaves encontradas:', [...new Set(keys)]);
    }
  } catch (err) {
    console.error('Erro:', err.message);
  }
}

// ── 2. Estrutura dos IniEventos em Supabase ──────────────────────────────────

async function verEventosIniciativas() {
  console.log(`\n${'='.repeat(60)}`);
  console.log('SUPABASE: ar_iniciativas.eventos (amostra com eventos não-nulos)');
  console.log('='.repeat(60));

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.log('(sem credenciais Supabase — a saltar)');
    return;
  }

  const db = createClient(SUPABASE_URL, SUPABASE_KEY);

  const { data, error } = await db
    .from('ar_iniciativas')
    .select('id, titulo, eventos')
    .not('eventos', 'is', null)
    .limit(3);

  if (error) { console.error('Erro:', error.message); return; }

  for (const ini of (data ?? [])) {
    console.log(`\n── ${ini.id}: ${ini.titulo?.slice(0, 80)}`);
    console.log(JSON.stringify(ini.eventos, null, 2));
  }
}

// ── 3. Estrutura do json_raw de uma iniciativa com votação ──────────────────

async function verJsonRawComVotacao() {
  console.log(`\n${'='.repeat(60)}`);
  console.log('SUPABASE: ar_iniciativas.json_raw com "Votação" nos eventos');
  console.log('='.repeat(60));

  if (!SUPABASE_URL || !SUPABASE_KEY) { return; }

  const db = createClient(SUPABASE_URL, SUPABASE_KEY);

  const { data, error } = await db
    .from('ar_iniciativas')
    .select('id, json_raw')
    .not('json_raw', 'is', null)
    .limit(5);

  if (error) { console.error('Erro:', error.message); return; }

  for (const ini of (data ?? [])) {
    const raw = ini.json_raw;
    const eventos = raw?.IniEventos;
    if (!Array.isArray(eventos)) continue;
    const comVoto = eventos.find(e =>
      JSON.stringify(e).toLowerCase().includes('votac') ||
      JSON.stringify(e).toLowerCase().includes('aprova') ||
      JSON.stringify(e).toLowerCase().includes('rejeit')
    );
    if (comVoto) {
      console.log(`\n── ${ini.id}`);
      console.log('Evento com votação:', JSON.stringify(comVoto, null, 2));
      console.log('Todas as chaves do IniEventos[0]:', Object.keys(eventos[0] || {}));
      break;
    }
  }
}

await verEstrutura('AtividadesXVII_json.txt', URL_ATIVIDADES, 8000);
await verEventosIniciativas();
await verJsonRawComVotacao();

console.log('\n\nDiagnóstico concluído.');
