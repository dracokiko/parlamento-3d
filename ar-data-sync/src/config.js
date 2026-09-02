import 'dotenv/config';

export const SUPABASE_URL = process.env.SUPABASE_URL;
export const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

export const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌  SUPABASE_URL e SUPABASE_SERVICE_KEY são obrigatórios no .env');
  process.exit(1);
}
if (!GROQ_API_KEY) {
  console.error('❌  GROQ_API_KEY é obrigatório no .env');
  process.exit(1);
}

// Legislatura corrente. Usado para construir caminhos do catálogo DAR.
// NOTA: os URLs em AR_ENDPOINTS abaixo são links assinados individualmente
// emitidos pelo parlamento.pt para ficheiros específicos e NÃO podem ser
// templated a partir de LEGISLATURA — têm de ser substituídos manualmente
// quando a legislatura mudar.
export const LEGISLATURA = 'XVII';
export const LEGISLATURA_NUM = '17';
// Série I do catálogo DAR. A sessão legislativa (o 3º segmento do caminho,
// ex: 01/17/02) NÃO é fixa aqui — muda todos os anos por volta de meados de
// Setembro, por isso é descoberta dinamicamente em catalogueCrawler.js.
export const DAR_SERIE = '01';

// URLs reais dos Dados Abertos da AR — XVII Legislatura
// Fonte: https://www.parlamento.pt/Cidadania/Paginas/DadosAbertos.aspx
//
// Estrutura:
//   iniciativas → array raiz de objectos
//   deputados   → objecto com chave "Deputados" (array)
//   debates     → objecto com chave "Debates" (array, dentro de Atividades)
export const AR_ENDPOINTS = {
  iniciativas: {
    url:  'https://app.parlamento.pt/webutils/docs/doc.txt?path=vT4NKYCAcAkVhsxkek0X9GR7eZ0OofLhvaamIHFKZGIIYlhnxu7zKIsblH59KL72h98Zu1N1YTqN8DXZMgmt3EbdPgzlwhrmIMsaAAVbmHdJph0ajupa9JllbEogo%2fqScLfsVIOicGp1PUvXnG1iXa7YUCL7474EaFm4dv0QL6fNQlcFkI97C0SXv5ry3OgJC8HCmkJqINrPay1OF9uNI4iJaHCchWhK0Z2ojcLFwyJz7YF0bimXQgilgr3eE5OFAFyTax77Lv8ioecHw7ZXt%2fJppcfvF0%2bPRnNoPelExY4Q36mLd%2fmOQxfNwa3clarGoyTjcrzuDlexcc%2bpWM0RUy51EQt2FjJqLFwjbLFDw2E%3d&fich=IniciativasXVII_json.txt&Inline=true',
    path: null,          // array na raiz
  },
  deputados: {
    url:  'https://app.parlamento.pt/webutils/docs/doc.txt?path=5zyAbVC5P5iHxLFX4dvvYn4459K3M9lWQH%2fDcO4IKLXMkN5Hq425yPeRcYFgb%2bc9DlwE0R6cUU5It3LijJBhLPUtaTjLFF9s8dGGHH0M4uqbYAe%2fs5fZg%2fUtcGhKciBr2UtOK4Ni3dUZ7gP9e5liyqHrAZAq7gSTC0sOd09nqPmhcE4irF1LnPUOWEkBTMZ0vShEUbCe7xVRvZrVB92ezvEC1kU%2bR97%2f0dzjL1wDss6Axa1dI2UbSwuzK3uQ3NGl%2feA6BlJaGr3k3zpVIsFoUskWmsgn6ZiIAfMLO1mKE8pmm%2bwMQT7ymW8%2bOSPw51PEFpUPFEU6KqvWL%2bkPKgv9qt4MytM%2fqFtBAbe4DDF%2f3sXzYYGU6GO2UASQhaA2ESwUMofHxV52YK52uXEunzHZZg%3d%3d&fich=InformacaoBaseXVII_json.txt&Inline=true',
    path: 'Deputados',   // array aninhado sob esta chave
  },
  debates: {
    url:  'https://app.parlamento.pt/webutils/docs/doc.txt?path=MvC%2beisjw0NRM%2b5VPH%2bMQs5Gt2qv74TPZF5glj1aifwO0zMmLlbffto8DV6i%2bOqsFwvUGB1aoK1MS0SUSBj6QdbFHywkApglmKeKfi2BmkQARJ5ySv5SIETQTYxHz5PxIX%2fGM693nC1O0q4rroauUdKupOi8zzMeCFNuYpl6Kt1BTDwkV%2fBz%2fHQg8JCYa5Jauy53%2bdAiC2ePgjFzCqAK8HZHByoUg0bgVvKEBzx4VzNV0dXT1JM6UaKOI3DxVyer61k2d6PBzqopQNLIcybR%2fjqPwQopwp58n3uXv1x3sAEhwsNyV8rVL%2bAuz%2biUEk1Y%2bb6mW2UH0SsJCHdsEq150IMI6F1Qp9kEPjopgvYcqgQmjbMlqAEmnSNn6kleSQm4&fich=AtividadesXVII_json.txt&Inline=true',
    path: 'Debates',     // array aninhado sob esta chave
  },
};

export const BATCH_SIZE = 250;
