import { partidos, ordemHemiciclo } from './mockPartidos';

/**
 * Gera lista de deputados mock para todos os partidos.
 *
 * Cada deputado tem uma posição fixa no hemiciclo (fila, assento)
 * que é usada para o posicionamento 3D na cena Three.js.
 *
 * O hemiciclo é organizado em filas concêntricas (semicírculos),
 * com os partidos distribuídos da esquerda para a direita.
 */

// Nomes mock realistas para deputados portugueses
const nomesProprios = [
  'João', 'Maria', 'António', 'Ana', 'Pedro', 'Sofia', 'Miguel', 'Catarina',
  'Carlos', 'Inês', 'Manuel', 'Beatriz', 'Francisco', 'Margarida', 'José',
  'Isabel', 'Luís', 'Teresa', 'Rui', 'Helena', 'Paulo', 'Cristina', 'André',
  'Patrícia', 'Bruno', 'Joana', 'Tiago', 'Mariana', 'Ricardo', 'Filipa'
];

const apelidos = [
  'Silva', 'Santos', 'Ferreira', 'Pereira', 'Oliveira', 'Costa', 'Rodrigues',
  'Martins', 'Sousa', 'Almeida', 'Carvalho', 'Lopes', 'Marques', 'Gomes',
  'Ribeiro', 'Pinto', 'Mendes', 'Vieira', 'Correia', 'Cardoso', 'Teixeira',
  'Moreira', 'Coelho', 'Antunes', 'Nogueira', 'Cunha', 'Reis', 'Castro'
];

const circulosEleitorais = [
  'Lisboa', 'Porto', 'Setúbal', 'Braga', 'Aveiro', 'Coimbra', 'Leiria',
  'Faro', 'Santarém', 'Viseu', 'Madeira', 'Açores', 'Évora', 'Beja',
  'Castelo Branco', 'Guarda', 'Bragança', 'Viana do Castelo', 'Vila Real',
  'Portalegre', 'Europa', 'Fora da Europa'
];

/**
 * Pseudo-random determinístico baseado em seed.
 * Garante que os dados mock são consistentes entre renders.
 */
const seededRandom = (seed) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

const pick = (arr, seed) => arr[Math.floor(seededRandom(seed) * arr.length)];

// ─── Constantes de geometria (espelham posicoes3D.js) ────────────────────────
// Usadas para calcular a capacidade proporcional de cada fila sem criar
// uma dependência circular com o módulo posicoes3D.
const RAIO_INTERNO_G = 6;
const ESPACAMENTO_FILA_G = 1.8;
const NUM_FILAS = 7;

// Raios de cada fila: [6, 7.8, 9.6, 11.4, 13.2, 15.0, 16.8]
const radiiPorFila = Array.from(
  { length: NUM_FILAS },
  (_, i) => RAIO_INTERNO_G + i * ESPACAMENTO_FILA_G
);
const somaRadii = radiiPorFila.reduce((a, b) => a + b, 0); // 79.8

// Frações cumulativas para atribuição proporcional ao arco de cada fila.
// Fila 0 (menor raio) recebe ~7.5% dos deputados de cada partido,
// fila 6 (maior raio) recebe ~21%.
const fracoesCumulativas = radiiPorFila.reduce((acc, r) => {
  const anterior = acc.length > 0 ? acc[acc.length - 1] : 0;
  acc.push(anterior + r / somaRadii);
  return acc;
}, []);
// Resultado: [0.0751, 0.1729, 0.2932, 0.4361, 0.6015, 0.7895, 1.0]

/**
 * Dado o índice dentro do partido (0..N-1) e o tamanho do partido,
 * devolve a fila onde o deputado deve sentar-se.
 *
 * Os partidos pequenos (≤ NUM_FILAS) ficam espalhados pelas filas centrais;
 * os grandes preenchem todas as filas proporcionalmente ao arco disponível.
 */
const getFilaParaDeputado = (indiceNaParty, tamanhoParty) => {
  if (tamanhoParty <= 1) return 0;
  const t = indiceNaParty / tamanhoParty;
  const idx = fracoesCumulativas.findIndex(fc => t < fc);
  return idx === -1 ? NUM_FILAS - 1 : idx;
};

/**
 * Gera a lista completa de deputados com posições 3D pré-calculadas.
 *
 * A distribuição por fila é proporcional ao comprimento do arco de cada
 * fila, garantindo que nenhuma fila interior excede a sua capacidade física.
 */
const gerarDeputados = () => {
  const deputados = [];
  let idCounter = 1;
  let indiceGlobal = 0;

  for (const idPartido of ordemHemiciclo) {
    const partido = partidos[idPartido];
    const numDeputados = partido.deputados;

    // Contador independente por fila para calcular o assento dentro da fila
    const contadorPorFila = new Array(NUM_FILAS).fill(0);

    for (let i = 0; i < numDeputados; i++) {
      const fila = getFilaParaDeputado(i, numDeputados);
      const assentoNaFila = contadorPorFila[fila]++;

      const seed = idCounter * 13.37;
      const nome = `${pick(nomesProprios, seed)} ${pick(apelidos, seed * 2)} ${pick(apelidos, seed * 3)}`;

      deputados.push({
        id: idCounter,
        nome,
        partido: idPartido,
        circulo: pick(circulosEleitorais, seed * 5),
        posicaoHemiciclo: {
          fila,
          assento: assentoNaFila,
          indiceGlobal
        },
        taxaPresenca: Math.round((75 + seededRandom(seed * 7) * 23) * 10) / 10,
        totalIntervencoes: Math.floor(20 + seededRandom(seed * 11) * 200),
        biografia: `Deputado(a) eleito(a) pelo círculo de ${pick(circulosEleitorais, seed * 5)}, integra o grupo parlamentar do ${partido.nome}.`,
        comissoes: ['Comissão de Assuntos Constitucionais', 'Comissão de Saúde'].slice(0, 1 + Math.floor(seededRandom(seed * 13) * 2))
      });

      idCounter++;
      indiceGlobal++;
    }
  }

  return deputados;
};

export const deputados = gerarDeputados();

/**
 * Helpers para filtrar e procurar deputados
 */
export const getDeputadoPorId = (id) => deputados.find(d => d.id === id);
export const getDeputadosPorPartido = (idPartido) =>
  deputados.filter(d => d.partido === idPartido);
