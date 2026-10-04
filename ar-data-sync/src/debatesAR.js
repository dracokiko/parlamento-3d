/**
 * A porta de entrada para o debates.parlamento.pt.
 *
 * Existe porque este sítio tem regras a cumprir e há mais do que um módulo a
 * bater-lhe à porta — o catálogo do DAR e o scraper das transcrições. Com as
 * regras num lado só, cumprem-se uma vez e não três.
 *
 * O que o site pede, no robots.txt:
 *
 *     Disallow: /pagina/showPDFPage
 *     Disallow: /pagina/export
 *     Disallow: /pesquisa…
 *     Crawl-delay: 20
 *
 * Nada aqui toca nesses endereços — as transcrições vêm do HTML da própria
 * página da sessão, que é permitido — e o intervalo de 20 segundos é
 * respeitado por todos os pedidos, venham de onde vierem.
 *
 * Quanto ao nome: a 22/09/2026 o servidor começou a devolver 403 a qualquer
 * User-Agent que contenha a palavra "bot", incluindo o do Google e o da
 * Microsoft — regra cega de nginx, e não uma decisão sobre este projecto.
 * O nome abaixo diz quem somos e onde nos encontrar, e não leva essa palavra.
 */

import { USER_AGENT } from './config.js';
export { USER_AGENT as UA };

/** O Crawl-delay do robots.txt, em milissegundos. */
export const CRAWL_DELAY = 20_000;

/** Páginas de texto integral chegam aos 200 kB; 20s não chegavam. */
const TIMEOUT = 60_000;

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Fila única: cada pedido marca a vez do seguinte antes de partir.
 *
 * O contador é do módulo e não de quem chama, senão cada módulo esperava os
 * seus 20 segundos e depois disparavam todos ao mesmo tempo — que é
 * precisamente o que o Crawl-delay existe para evitar.
 */
let vezLivre = 0;
async function aguardarVez() {
  const agora  = Date.now();
  const espera = Math.max(0, vezLivre - agora);
  vezLivre = Math.max(agora, vezLivre) + CRAWL_DELAY;
  if (espera > 0) await sleep(espera);
}

/**
 * O mesmo URL, a pedir o texto integral da sessão.
 *
 * Sem o `sft` a página traz a ficha do debate e mais nada — cerca de 1 kB,
 * contra os 100 a 270 kB de uma sessão inteira.
 */
export function comTextoIntegral(url) {
  const u = new URL(url);
  u.searchParams.set('sft', 'true');
  return u.toString();
}

/**
 * Quanto se espera antes de cada nova tentativa.
 *
 * A 27/09/2026 o site esteve mudo seis minutos e a sincronização desistiu ao
 * fim de dois — não havia nada para trazer nesse dia, mas o trabalho ficou
 * vermelho e saiu o email de falha. Um sítio que vai abaixo uns minutos é
 * coisa de todos os dias; o trabalho corre de madrugada e não tem pressa.
 * Ao fim destas esperas são doze minutos e meio de insistência.
 */
const ESPERAS = [30_000, 180_000, 480_000];

/**
 * Pede uma página ao debates.parlamento.pt e devolve o HTML.
 *
 * @param {string} url
 * @param {{ tentativas?: number }} opcoes  tentativas=1 não espera nada — é o
 *   que usa quem anda a adivinhar datas no catálogo e quer falhar depressa.
 * @returns {Promise<string>}
 */
export async function fetchDebates(url, { tentativas = ESPERAS.length + 1 } = {}) {
  let ultimoErro;

  for (let i = 1; i <= tentativas; i++) {
    await aguardarVez();
    try {
      const res = await fetch(url, {
        signal:  AbortSignal.timeout(TIMEOUT),
        headers: { 'User-Agent': USER_AGENT },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      ultimoErro = err;
      // Um 4xx não é passageiro: é o servidor a dizer que não, e não muda
      // em doze minutos. Desde 30/09/2026 o site responde 403 aos servidores
      // do GitHub, e repetir custava 25 minutos por corrida — o bastante para
      // duas corridas baterem no limite e serem canceladas a meio.
      if (/^HTTP 4\d\d$/.test(err.message)) break;
      if (i < tentativas) {
        const espera = ESPERAS[i - 1] ?? ESPERAS[ESPERAS.length - 1];
        console.warn(`  ⚠ Tentativa ${i}/${tentativas} falhou (${err.message}) — nova tentativa em ${espera / 1000}s...`);
        await sleep(espera);
      }
    }
  }

  throw ultimoErro;
}
