/**
 * Debug cirúrgico — mostra o contexto exato da data e de Portugal no HTML do EUR-Lex.
 * Uso: node src/eurlexDebugNIM.js
 */

const CELEX = '32022L2555';

const HEADERS = {
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'en-GB,en;q=0.9',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

async function fetchPage(url) {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(30_000) });
  return res.text();
}

function mostrarContextos(html, busca, label, raio = 300) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`CONTEXTOS de "${label}"`);
  const lower = html.toLowerCase();
  const buscaLower = busca.toLowerCase();
  let idx = 0, n = 0;
  while ((idx = lower.indexOf(buscaLower, idx)) !== -1 && n < 6) {
    const trecho = html.slice(Math.max(0, idx - raio), idx + raio + busca.length);
    console.log(`\n[ocorrência ${++n}, pos ${idx}]`);
    console.log(trecho);
    idx += busca.length;
  }
  if (n === 0) console.log('  (não encontrado)');
}

function mostrarJsonScript(html, label) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`JSON em <script> com "${label}"`);
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
  let found = 0;
  for (const s of scripts) {
    if (s[1].toLowerCase().includes(label.toLowerCase())) {
      console.log(s[1].slice(0, 600));
      if (++found >= 3) break;
    }
  }
  if (!found) console.log('  (não encontrado)');
}

// ── NIM page ───────────────────────────────────────────────────────────────
console.log('\n══ NIM PAGE ══');
const nimHtml = await fetchPage(
  `https://eur-lex.europa.eu/legal-content/EN/NIM/?uri=CELEX:${CELEX}`
);
console.log(`HTML: ${nimHtml.length} chars`);

mostrarContextos(nimHtml, '17/10/2024', '17/10/2024 (prazo NIS2)');
mostrarContextos(nimHtml, 'transposition', 'transposition');
mostrarContextos(nimHtml, 'Portugal', 'Portugal');
mostrarContextos(nimHtml, 'deadline', 'deadline');
mostrarJsonScript(nimHtml, 'portugal');
mostrarJsonScript(nimHtml, 'transpos');
mostrarJsonScript(nimHtml, '17/10');

// ── ALL page ───────────────────────────────────────────────────────────────
console.log('\n\n══ ALL PAGE ══');
const allHtml = await fetchPage(
  `https://eur-lex.europa.eu/legal-content/EN/ALL/?uri=CELEX:${CELEX}`
);
console.log(`HTML: ${allHtml.length} chars`);

mostrarContextos(allHtml, '17/10/2024', '17/10/2024 (prazo NIS2)');
mostrarContextos(allHtml, 'transposition', 'transposition');

console.log('\n\nFim.');