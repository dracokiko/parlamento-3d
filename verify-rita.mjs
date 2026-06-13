import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 30000 });

// Aguardar até o ecrã de loading desaparecer (o spinner tem texto "A verificar...")
console.log('A aguardar que o loading desapareça...');
try {
  await page.waitForFunction(() => {
    // O loading screen tem um spinner com mensagens de loading
    const loadingTexts = ['A imprimir', 'A verificar', 'A regar', 'A contar', 'A calcular', 'diplomas', 'telemóvel', 'plantas'];
    const body = document.body.innerText;
    return !loadingTexts.some(t => body.includes(t));
  }, { timeout: 30000, polling: 1000 });
  console.log('Loading terminou!');
} catch {
  console.log('Timeout — loading não terminou em 30s');
}

await page.waitForTimeout(1000);
await page.screenshot({ path: 'verify-01-loaded.png' });
console.log('Screenshot 1: app carregada');

// Clicar no botão "Pesquisar deputado"
const searchBtn = await page.$('button:has-text("Pesquisar"), [class*="pesquis" i], [class*="search" i]');
if (searchBtn) {
  await searchBtn.click();
  await page.waitForTimeout(500);
}

// Encontrar o input que aparece
const searchInput = await page.$('input');
if (searchInput) {
  console.log('Input de pesquisa encontrado');
  await searchInput.fill('Rita Matias');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'verify-02-search.png' });
  console.log('Screenshot 2: após pesquisar "Rita Matias"');

  // Clicar no resultado
  const result = await page.$('text=Rita Matias');
  if (result) {
    await result.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'verify-03-painel.png' });
    console.log('Screenshot 3: painel aberto');

    const painelText = await page.evaluate(() => document.body.innerText);
    console.log('Sem iniciativas?', painelText.includes('Sem iniciativas'));
    const linhas = painelText.split('\n').filter(l => l.trim());
    const idxIniciativas = linhas.findIndex(l => l.includes('Iniciativas'));
    if (idxIniciativas >= 0) {
      console.log('Contexto à volta de "Iniciativas":');
      linhas.slice(idxIniciativas, idxIniciativas + 8).forEach(l => console.log(' ', l));
    }
  } else {
    console.log('Resultado Rita Matias não apareceu');
  }
} else {
  console.log('Input de pesquisa não encontrado depois de clicar no botão');
  const bodySnippet = await page.evaluate(() => document.body.innerText.slice(0, 300));
  console.log('Texto visível:', bodySnippet);
}

await browser.close();
