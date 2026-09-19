/**
 * Alinha os oradores do Governo nas intervenções com a composição oficial.
 *
 * Resolve duas coisas que o Diário deixa por resolver e que o crawler do
 * Governo agora permite fechar:
 *
 *  1. Intervenções em que o nome do orador é o próprio cargo, porque naquela
 *     sessão o DAR nunca o nomeou e nenhuma outra sessão o nomeou também.
 *     Com a composição em mãos, o cargo diz quem é.
 *
 *  2. O mesmo governante escrito de duas maneiras — "Gonçalo Matias" no
 *     Diário e "Gonçalo Saraiva Matias" na composição. Passa a valer a forma
 *     oficial, para não haver duas pessoas onde há uma.
 *
 * Corre no pipeline diário, a seguir ao crawler do Governo.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { empurrarAmostra } from './resumoPublico.js';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const VAZIAS = new Set(['de', 'do', 'da', 'dos', 'das', 'e', 'o', 'a']);

const tokens = (s = '') => new Set(
  s.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().split(/[^a-z]+/).filter(t => t && !VAZIAS.has(t)),
);

/** Mesmo cargo escrito de outra maneira: compara pelas palavras com conteúdo. */
function cargosBatem(a, b) {
  const ta = tokens(a), tb = tokens(b);
  if (!ta.size || !tb.size) return 0;
  const comuns = [...ta].filter(t => tb.has(t)).length;
  return comuns / Math.max(ta.size, tb.size);
}

const primeiroUltimo = (nome = '') => {
  const p = nome.toLowerCase().split(/\s+/).filter(Boolean);
  return p.length >= 2 ? `${p[0]} ${p[p.length - 1]}` : nome.toLowerCase();
};

export async function alinharComGoverno() {
  console.log('\n' + '='.repeat(55));
  console.log('  GOVERNO — ALINHAR ORADORES COM A COMPOSIÇÃO');
  console.log('='.repeat(55));

  const { data: oficiais, error } = await db
    .from('governo_membros')
    .select('nome, cargo, em_funcoes');

  if (error) {
    console.warn(`  ⚠ sem composição oficial (${error.message}) — nada a alinhar`);
    return { total: 0, inseridos: 0, atualizados: 0, erros: 0, novos: [], falhas: [] };
  }
  if (!oficiais?.length) {
    console.warn('  ⚠ composição oficial vazia — nada a alinhar');
    return { total: 0, inseridos: 0, atualizados: 0, erros: 0, novos: [], falhas: [] };
  }

  // Quem está em funções ganha nos empates: é o titular mais provável de uma
  // intervenção recente, e o passado já costuma vir nomeado no próprio DAR.
  const porNomeCurto = new Map();
  for (const o of [...oficiais].sort((a, b) => Number(b.em_funcoes) - Number(a.em_funcoes))) {
    const chave = primeiroUltimo(o.nome);
    if (!porNomeCurto.has(chave)) porNomeCurto.set(chave, o.nome);
  }

  const todas = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error: erroLeitura } = await db
      .from('ar_intervencoes')
      .select('id, nome_dep, cargo')
      .eq('papel', 'governo')
      .order('id')
      .range(offset, offset + 999);
    if (erroLeitura) throw new Error(erroLeitura.message);
    todas.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }

  let porCargo = 0, porNome = 0, erros = 0;
  const novos = [], falhas = [];

  for (const iv of todas) {
    let destino = null;
    let motivo = null;

    if (iv.cargo && iv.nome_dep === iv.cargo) {
      // Sem nome: o cargo identifica a pessoa na composição.
      let melhor = null, pontos = 0.5;
      for (const o of oficiais) {
        const p = cargosBatem(iv.cargo, o.cargo);
        if (p > pontos) { pontos = p; melhor = o; }
      }
      if (melhor) { destino = melhor.nome; motivo = 'cargo'; }
    } else {
      const oficial = porNomeCurto.get(primeiroUltimo(iv.nome_dep ?? ''));
      if (oficial && oficial !== iv.nome_dep) { destino = oficial; motivo = 'nome'; }
    }

    if (!destino) continue;

    const { error: erroUpd } = await db.from('ar_intervencoes').update({ nome_dep: destino }).eq('id', iv.id);
    if (erroUpd) {
      erros++;
      empurrarAmostra(falhas, { id: iv.id, motivo: erroUpd.message });
      continue;
    }

    if (motivo === 'cargo') porCargo++; else porNome++;
    empurrarAmostra(novos, { id: iv.id, label: `${iv.nome_dep} → ${destino} (${motivo})` });
  }

  console.log(`  ✓ ${porCargo} resolvidas pelo cargo, ${porNome} uniformizadas pelo nome oficial, ${erros} erros`);
  return {
    total: porCargo + porNome, inseridos: 0, atualizados: porCargo + porNome, erros, novos, falhas,
  };
}

if (process.argv[1]?.includes('alinharComGoverno')) {
  await alinharComGoverno();
  console.log('\nFim.');
}
