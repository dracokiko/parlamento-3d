import { partidos as PARTIDOS } from '../data/mockPartidos';

const GP_DEPS = Object.fromEntries(Object.entries(PARTIDOS).map(([k, v]) => [k, v.deputados ?? 0]));

/**
 * Conta deputados a partir das entradas do campo `detalhe` da AR.
 *
 * A AR usa três formatos na mesma lista, por vezes misturados:
 *   "PSD"                → a bancada inteira votou assim (usamos o tamanho da bancada)
 *   "85-PSD"             → contagem exata (85 deputados do PSD) — tem prioridade
 *   "Pedro Nuno (PS)"    → um deputado nomeado, em divergência do seu grupo → conta 1
 *
 * Devolve { total, exato } — `exato` é falso quando tivemos de assumir o
 * tamanho da bancada, para o interface não apresentar o número como se fosse
 * uma contagem oficial.
 */
export function contarDeputados(entradas) {
  let total = 0;
  let exato = true;
  for (const bruto of entradas ?? []) {
    const s = String(bruto).trim();
    if (!s) continue;

    const comContagem = s.match(/^(\d+)\s*-\s*(.+)$/);
    if (comContagem) { total += Number(comContagem[1]); continue; }

    if (/\(.+\)/.test(s)) { total += 1; continue; }   // deputado nomeado

    if (s in GP_DEPS) { total += GP_DEPS[s]; exato = false; continue; }
    exato = false;                                     // sigla desconhecida
  }
  return { total, exato };
}

/**
 * Siglas que aparecem em mais do que uma secção da mesma votação (ex.: PSD em
 * "Contra" e em "Abstenção"). Nesses casos a bancada dividiu-se e a AR não diz
 * como — somar o tamanho total em ambos os lados dá mais deputados do que os
 * que existem, por isso o interface avisa em vez de inventar um número.
 */
export function siglasAmbiguas({ favor = [], contra = [], abstencao = [] }) {
  const seccoes = { favor, contra, abstencao };
  const ondeApareceu = {};
  for (const [sec, arr] of Object.entries(seccoes)) {
    for (const bruto of arr) {
      const s = String(bruto).trim();
      if (/^\d+\s*-/.test(s) || /\(.+\)/.test(s)) continue;  // contagem exata / nomeado: não é ambíguo
      if (!(s in GP_DEPS)) continue;
      (ondeApareceu[s] ??= new Set()).add(sec);
    }
  }
  return Object.entries(ondeApareceu).filter(([, secs]) => secs.size > 1).map(([s]) => s);
}
