/**
 * Mantém a tabela `deputados` — os 230 assentos do hemiciclo — a par de quem
 * está realmente em funções.
 *
 * A tabela era um seed estático e ia derivando: um deputado que suspende o
 * mandato continuava sentado na cena 3D, com zero intervenções, enquanto quem
 * o substituiu não aparecia em lado nenhum. A AR já publica o necessário para
 * resolver isto — `ar_deputados.situacao` diz, com datas, quem está Efetivo,
 * Suplente, Suspenso ou Renunciou.
 *
 * Regras:
 *   - está sentado quem tenha hoje uma situação "Efetivo*" (Efetivo, Efetivo
 *     Temporário ou Efetivo Definitivo) — são exactamente 230;
 *   - quem entra herda o lugar de quem sai, preferindo o mesmo partido e
 *     círculo (é assim que a substituição funciona na prática);
 *   - a foto não vem da AR, por isso quem entra fica sem ela até ser carregada.
 *
 * Uso: node src/deputadosAtuais.js
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { empurrarAmostra } from './resumoPublico.js';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

/** Situações que põem alguém efectivamente sentado no hemiciclo. */
const RE_EFETIVO = /^Efetivo/i;

const hojeISO = () => new Date().toISOString().slice(0, 10);

/** Situações em vigor numa data — a AR mantém o histórico todo no mesmo array. */
function situacoesVigentes(deputado, hoje) {
  return (deputado.situacao ?? []).filter(
    s => (s.sioDtInicio ?? '') <= hoje && (!s.sioDtFim || s.sioDtFim >= hoje),
  );
}

const estaSentado = (d, hoje) => situacoesVigentes(d, hoje).some(s => RE_EFETIVO.test(s.sioDes));

/** Desde quando ocupa o lugar — início da situação de efectividade em vigor. */
function efetivoDesde(d, hoje) {
  const s = situacoesVigentes(d, hoje).find(x => RE_EFETIVO.test(x.sioDes));
  return s?.sioDtInicio ?? null;
}

async function todos(tabela, campos) {
  const out = [];
  for (let i = 0; ; i += 1000) {
    const { data, error } = await db.from(tabela).select(campos).order('id').range(i, i + 999);
    if (error) throw new Error(`${tabela}: ${error.message}`);
    out.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  return out;
}

/**
 * `substitui_*` é opcional: são colunas novas (ver supabase/migrations) e o
 * sync tem de funcionar antes e depois da migração correr.
 */
async function temColunasSubstituicao() {
  const { error } = await db.from('deputados').select('substitui_nome').limit(1);
  if (error) console.warn('  [ASSENTOS] colunas substitui_* ainda não existem — a sincronizar sem elas');
  return !error;
}

export async function syncDeputadosAtuais() {
  console.log('\n' + '='.repeat(55));
  console.log('  ASSENTOS — QUEM ESTÁ SENTADO HOJE');
  console.log('='.repeat(55));

  const hoje = hojeISO();
  const comSubstituicao = await temColunasSubstituicao();

  const ar = await todos('ar_deputados', 'id, nome_parlamentar, nome_completo, partido_sigla, circulo, situacao');
  const assentos = await todos('deputados', 'id, nome, nome_completo, partido_sigla, circulo_eleitoral, lugar');

  const sentados = ar.filter(d => estaSentado(d, hoje));
  console.log(`  → ${sentados.length} deputados em funções | ${assentos.length} assentos na tabela`);

  const idsSentados = new Set(sentados.map(d => String(d.id)));
  const idsAssentos = new Set(assentos.map(a => String(a.id)));

  const aSair   = assentos.filter(a => !idsSentados.has(String(a.id)));
  const aEntrar = sentados.filter(d => !idsAssentos.has(String(d.id)));

  if (!aSair.length && !aEntrar.length) {
    console.log('  ✓ Nada a fazer — a composição não mudou');
    return { total: assentos.length, inseridos: 0, atualizados: 0, erros: 0, novos: [], falhas: [] };
  }

  const novos = [], falhas = [];
  let inseridos = 0, atualizados = 0, erros = 0;

  // Quem entra herda o lugar de quem sai: mesmo partido e círculo primeiro
  // (é a substituição real), depois só o partido, e só então qualquer um.
  const livres = [...aSair];
  const tirarLugar = (d) => {
    const escolher = (teste) => {
      const i = livres.findIndex(teste);
      return i >= 0 ? livres.splice(i, 1)[0] : null;
    };
    return escolher(a => a.partido_sigla === d.partido_sigla && a.circulo_eleitoral === d.circulo)
        ?? escolher(a => a.partido_sigla === d.partido_sigla)
        ?? escolher(() => true);
  };

  for (const d of aEntrar) {
    const anterior = tirarLugar(d);
    if (!anterior) {
      erros++;
      empurrarAmostra(falhas, { id: String(d.id), motivo: `${d.nome_parlamentar} entrou mas não há lugar livre para lhe dar` });
      continue;
    }

    // O lugar só fica livre depois de sair quem lá estava: `lugar` é único.
    const { error: errDel } = await db.from('deputados').delete().eq('id', anterior.id);
    if (errDel) {
      erros++;
      empurrarAmostra(falhas, { id: String(anterior.id), motivo: `Não foi possível libertar o lugar de ${anterior.nome}: ${errDel.message}` });
      continue;
    }

    const registo = {
      id:                d.id,
      nome:              d.nome_parlamentar,
      nome_completo:     d.nome_completo,
      partido_sigla:     d.partido_sigla,
      circulo_eleitoral: d.circulo,
      lugar:             anterior.lugar,
      ...(comSubstituicao ? {
        substitui_id:    anterior.id,
        substitui_nome:  anterior.nome,
        substitui_desde: efetivoDesde(d, hoje),
      } : {}),
    };

    const { error: errIns } = await db.from('deputados').upsert(registo, { onConflict: 'id' });
    if (errIns) {
      erros++;
      empurrarAmostra(falhas, { id: String(d.id), motivo: `Upsert de ${d.nome_parlamentar}: ${errIns.message}` });
      continue;
    }

    inseridos++;
    console.log(`  ↔ ${anterior.nome} (${anterior.partido_sigla}) → ${d.nome_parlamentar} (${d.partido_sigla}) no lugar ${anterior.lugar}`);
    empurrarAmostra(novos, {
      id: String(d.id),
      label: `${d.nome_parlamentar} (${d.partido_sigla}) assume o lugar ${anterior.lugar} de ${anterior.nome}`,
    });
  }

  // Quem ficou sem substituto sai na mesma — um lugar vazio é mais honesto do
  // que mostrar sentado quem já não está.
  for (const a of livres) {
    const { error } = await db.from('deputados').delete().eq('id', a.id);
    if (error) {
      erros++;
      empurrarAmostra(falhas, { id: String(a.id), motivo: `Não foi possível remover ${a.nome}: ${error.message}` });
      continue;
    }
    atualizados++;
    console.log(`  − ${a.nome} (${a.partido_sigla}) deixou o lugar ${a.lugar} — sem substituto conhecido`);
    empurrarAmostra(novos, { id: String(a.id), label: `${a.nome} (${a.partido_sigla}) saiu do lugar ${a.lugar}` });
  }

  console.log(`\n  ✓ ${inseridos} substituições, ${atualizados} saídas sem substituto, ${erros} erros`);
  return { total: sentados.length, inseridos, atualizados, erros, novos, falhas };
}

if (process.argv[1]?.includes('deputadosAtuais')) {
  await syncDeputadosAtuais();
  console.log('\nFim.');
}
