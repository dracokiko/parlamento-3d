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
 *   - quem entra leva o retrato oficial da AR, servido por cad_id.
 *
 * Uso: node src/deputadosAtuais.js
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { empurrarAmostra } from './resumoPublico.js';
// A planta da sala é a do site: os mesmos 230 lugares, de A1 a F56.
import { mapaLugares } from '../../src/utils/posicoes3D.js';

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
 * Retrato oficial servido pela AR, por cad_id. Quem entra a meio da
 * legislatura chegava sem fotografia — as que lá estavam vieram de um
 * carregamento manual — e ficava com as iniciais no lugar da cara.
 */
const fotoDaAR = (cadId) =>
  cadId ? `https://app.parlamento.pt/webutils/getimage.aspx?id=${cadId}&type=deputado` : null;

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

  const ar = await todos('ar_deputados', 'id, cad_id, nome_parlamentar, nome_completo, partido_sigla, circulo, situacao');
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

  // Quem sai nesta corrida deixa o lugar livre para quem entra.
  const livres = [...aSair];

  // Lugares que já estavam vazios — alguém saiu num dia e o substituto só
  // chegou noutro. Até 04/10/2026 estes não se viam: os livres eram só os de
  // quem saía na mesma corrida. A 1/10 saiu um deputado do PS do E9, a 2/10
  // entrou o seu substituto, e como o E9 já não "existia" a regra de último
  // recurso deu-lhe o lugar do Bloco de Esquerda que ficara livre nesse dia;
  // a 3/10 voltou o deputado do Bloco e já não havia lugar para ele. Agora os
  // vazios contam-se pela planta da sala, a mesma que o site desenha: os 230
  // lugares menos os ocupados.
  const ocupados = new Map(assentos.filter(a => a.lugar).map(a => [a.lugar, a]));
  const vazios = [...mapaLugares.keys()].filter(l => !ocupados.has(l));
  const vizinhosDoPartido = (lugar, partido) => {
    const fila = lugar[0], n = Number(lugar.slice(1));
    return [-2, -1, 1, 2].filter(dd => ocupados.get(`${fila}${n + dd}`)?.partido_sigla === partido).length;
  };

  /**
   * Onde se senta quem entra. Por esta ordem:
   *  1. o lugar de quem sai, do mesmo partido e círculo — a substituição real;
   *  2. o lugar de quem sai, do mesmo partido;
   *  3. um lugar vago no meio da bancada do partido — quase sempre o lugar que
   *     o partido perdeu noutro dia;
   *  4. só então qualquer lugar de quem sai, ou qualquer vago.
   * O 3 vem antes do 4 de propósito: um lugar de outro partido só se usa
   * quando o do próprio não existe.
   */
  const escolherSitio = (d) => {
    const deQuemSai = (teste) => {
      const i = livres.findIndex(teste);
      return i >= 0 ? { anterior: livres.splice(i, 1)[0] } : null;
    };
    const vago = (minimoVizinhos) => {
      let melhor = -1, melhorN = minimoVizinhos - 1;
      vazios.forEach((l, i) => {
        const nv = vizinhosDoPartido(l, d.partido_sigla);
        if (nv > melhorN) { melhor = i; melhorN = nv; }
      });
      return melhor >= 0 ? { lugar: vazios.splice(melhor, 1)[0] } : null;
    };
    return deQuemSai(a => a.partido_sigla === d.partido_sigla && a.circulo_eleitoral === d.circulo)
        ?? deQuemSai(a => a.partido_sigla === d.partido_sigla)
        ?? vago(1)
        ?? deQuemSai(() => true)
        ?? vago(0);
  };

  for (const d of aEntrar) {
    const sitio = escolherSitio(d);
    if (!sitio) {
      erros++;
      empurrarAmostra(falhas, { id: String(d.id), motivo: `${d.nome_parlamentar} entrou mas não há lugar livre para lhe dar (os 230 estão ocupados)` });
      continue;
    }
    const anterior = sitio.anterior ?? null;
    if (!anterior) {
      const { lugar } = sitio;
      // Num lugar que já estava vago não se sabe ao certo quem ele substitui:
      // não se inventa, fica sem `substitui_*`.
      const { error } = await db.from('deputados').upsert({
        id:                d.id,
        nome:              d.nome_parlamentar,
        nome_completo:     d.nome_completo,
        partido_sigla:     d.partido_sigla,
        circulo_eleitoral: d.circulo,
        lugar,
        foto:              fotoDaAR(d.cad_id),
      }, { onConflict: 'id' });
      if (error) {
        erros++;
        empurrarAmostra(falhas, { id: String(d.id), motivo: `Upsert de ${d.nome_parlamentar}: ${error.message}` });
        continue;
      }
      ocupados.set(lugar, { lugar, partido_sigla: d.partido_sigla });
      inseridos++;
      console.log(`  + ${d.nome_parlamentar} (${d.partido_sigla}) ocupa o lugar vago ${lugar}`);
      empurrarAmostra(novos, { id: String(d.id), label: `${d.nome_parlamentar} (${d.partido_sigla}) ocupa o lugar vago ${lugar}` });
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
      foto:              fotoDaAR(d.cad_id),
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
