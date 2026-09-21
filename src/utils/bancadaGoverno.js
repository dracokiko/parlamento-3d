import { RAIO_INTERNO, ESPACAMENTO_FILA, NUM_FILAS, ALTURA_DEGRAU } from './posicoes3D';

/**
 * Geometria da bancada do Governo.
 *
 * O hemiciclo ocupa só metade da sala: todos os 230 lugares caem em Z
 * negativo (ver posicoes3D.js — `z = -sin(angulo) * raio`). A metade de Z
 * positivo está vazia, e é lá que fica a bancada, de frente para os
 * deputados.
 *
 * Filas rectas, e não um segundo arco: um arco em frente do hemiciclo lia-se
 * como uma extensão dele, e a bancada do Governo não é mais uma bancada
 * parlamentar.
 */

/** Distância entre lugares dentro da mesma fila (metros). */
export const ESPACO_LUGAR = 1.15;
/** Distância entre filas, e desnível para a fila de trás não ficar escondida. */
export const ESPACO_FILA = 1.1;
export const SUBIDA_FILA = 0.30;
/** Estrado, para a bancada assentar em algo em vez de flutuar sobre o chão. */
export const ALTURA_ESTRADO = 0.25;
/**
 * Z da primeira fila — encostada à boca do hemiciclo, não ao meio da sala.
 *
 * Não é só estética: a câmara de origem está alta (y=12) e olha quase na
 * horizontal para o fundo do arco, pelo que tudo o que fique a menos de ~22 m
 * dela cai abaixo do ecrã. Uma bancada a z=5 ou mais só se via depois de
 * rodar a câmara — e ninguém ia procurar o que não sabe que existe.
 */
export const Z_PRIMEIRA_FILA = 0.6;
/**
 * Dez por fila, cinco de cada lado do corredor central.
 *
 * O corredor não é enfeite: na sala real o eixo tribuna–Mesa–estátua da
 * República está desimpedido, e é por ele que o orador sobe ao púlpito. Uma
 * bancada corrida a tapar esse eixo era o que fazia a composição parecer
 * errada mesmo sem se saber porquê.
 */
export const MAX_POR_FILA = 10;

/** Largura do corredor central, à medida do púlpito do orador (1,5 m). */
export const CORREDOR = 1.7;

/**
 * Vista de onde se olha para a bancada de frente: do fundo da sala, por cima
 * das últimas filas de deputados, com o olhar quase horizontal.
 *
 * Fixa, e não "o que lá estiver rodado 180°": rodar a câmara onde o
 * utilizador a tivesse deixado dava vistas de cima, que é tudo menos olhar
 * alguém de frente. Em unidades de cena — em ecrãs pequenos a cena é
 * ampliada e a vista acompanha (ver vistaDaBancada).
 */
export const VISTA_GOVERNO = {
  // Dentro da sala: a parede (raio 17) é opaca dos dois lados, e a câmara
  // fora dela via o reverso do estuque em vez do plenário.
  camera: [0, 4.8, -14],
  alvo:   [0, 1.4, 2.6],
};

/**
 * A sala, para a câmara não sair dela.
 *
 * Os mesmos números de EstruturaHemiciclo: a parede fica uma unidade para lá
 * da última fila, e é opaca dos dois lados — uma câmara do lado de fora vê o
 * reverso do estuque em vez do plenário.
 */
const RAIO_PAREDE   = RAIO_INTERNO + NUM_FILAS * ESPACAMENTO_FILA + 1.0;
const ALTURA_PAREDE = (NUM_FILAS - 1) * ALTURA_DEGRAU + 4.2;

/**
 * Até onde a câmara pode recuar numa direção sem atravessar a parede ou o
 * tecto, a partir do alvo.
 */
function recuoMaximo(alvo, direcao, escala) {
  const raio   = RAIO_PAREDE * escala * 0.94;
  const altura = ALTURA_PAREDE * escala - 0.6 * escala;

  // Parede: raiz positiva de |alvo + direção·t| = raio, no plano horizontal.
  const a = direcao[0] ** 2 + direcao[2] ** 2;
  const b = 2 * (alvo[0] * direcao[0] + alvo[2] * direcao[2]);
  const c = alvo[0] ** 2 + alvo[2] ** 2 - raio ** 2;
  const disc = b * b - 4 * a * c;
  const ateParede = (a > 1e-6 && disc > 0) ? (-b + Math.sqrt(disc)) / (2 * a) : Infinity;

  // Tecto: a vista sobe à medida que recua.
  const ateTecto = direcao[1] > 1e-6 ? (altura - alvo[1]) / direcao[1] : Infinity;

  return Math.max(0, Math.min(ateParede, ateTecto));
}

/**
 * Distribui `total` lugares por filas: a da frente é a primeira a encher,
 * porque é onde ficam o Primeiro-Ministro e os ministros.
 */
export function distribuirPorFilas(total, maxPorFila = MAX_POR_FILA) {
  if (total <= 0) return [];

  // Equilibradas, e não a encher até ao limite e deixar o resto na última:
  // 42 lugares davam 10+10+10+10+2, com dois lugares perdidos na fila de
  // trás. Assim dão 9+9+8+8+8. As filas da frente ficam com os que sobram,
  // por serem as de quem tem precedência.
  const nFilas = Math.ceil(total / maxPorFila);
  const base = Math.floor(total / nFilas);
  const sobra = total % nFilas;

  return Array.from({ length: nFilas }, (_, i) => base + (i < sobra ? 1 : 0));
}

/**
 * Posições dos lugares da bancada, pela ordem em que devem ser ocupados.
 *
 * @param {number} total  número de lugares a criar
 * @returns {{ position: [number,number,number], rotation: [number,number,number], fila: number, indice: number }[]}
 */
export function calcularLugaresGoverno(total) {
  if (!total || total < 1) return [];

  const lugares = [];
  const filas = distribuirPorFilas(total);

  filas.forEach((nesta, fila) => {
    const z = Z_PRIMEIRA_FILA + fila * ESPACO_FILA;
    const y = ALTURA_ESTRADO + fila * SUBIDA_FILA;

    // Os lugares contam-se a partir do corredor para fora, e não de uma
    // ponta à outra: só assim o corredor fica exactamente no eixo da sala
    // mesmo em filas ímpares. Contado à antiga, a fila de nove deixava uma
    // cadeira em cima da abertura.
    const daFila = [];
    const metade = Math.ceil(nesta / 2);
    for (let i = 0; i < nesta; i++) {
      const lado = i < metade ? -1 : 1;
      const ordem = i < metade ? i : i - metade;
      daFila.push({
        position: [lado * (CORREDOR / 2 + (ordem + 0.5) * ESPACO_LUGAR), y, z],
        // Viradas para o hemiciclo, que está todo em Z negativo.
        rotation: [0, Math.PI, 0],
        fila,
      });
    }

    // Do centro para fora, alternando os lados: quem chega primeiro senta-se
    // junto ao corredor. Sem isto o Primeiro-Ministro ficava na ponta
    // esquerda da primeira fila, que não é lugar de quem chefia o Governo.
    daFila.sort((a, b) => Math.abs(a.position[0]) - Math.abs(b.position[0]) || a.position[0] - b.position[0]);
    for (const lugar of daFila) lugares.push({ ...lugar, indice: lugares.length });
  });

  return lugares;
}

/**
 * A vista de frente para a bancada, enquadrada para o ecrã que a vai mostrar.
 *
 * A vista fixa acima foi medida em ecrã largo (campo de visão de 48°,
 * paisagem). Em telemóvel a câmara abre 90° na vertical mas o ecrã é
 * estreito, o que deixa *menos* campo na horizontal — e a bancada é larga.
 * Multiplicar a vista pela escala da cena, que era o que se fazia, mantinha
 * o tamanho angular do desktop e cortava as pontas das filas.
 *
 * Aqui a direção do olhar é a mesma; só a distância é calculada a partir do
 * campo de visão real, e nunca encurta a vista de origem.
 *
 * @param {number} total   lugares na bancada (define a largura a enquadrar)
 * @param {number} escala  escala da cena (1 em desktop, maior em ecrã estreito)
 * @param {number} fov     campo de visão vertical da câmara, em graus
 * @param {number} aspect  largura/altura do canvas
 * @param {number} limite  distância máxima permitida pelos controlos
 */
export function vistaDaBancada({ total, escala = 1, fov = 48, aspect = 1.6, limite = Infinity }) {
  const alvo = VISTA_GOVERNO.alvo.map(v => v * escala);
  const camaraBase = VISTA_GOVERNO.camera.map(v => v * escala);

  const vetor = camaraBase.map((v, i) => v - alvo[i]);
  const distanciaBase = Math.hypot(...vetor);
  if (!distanciaBase) return { camera: camaraBase, alvo };
  const direcao = vetor.map(v => v / distanciaBase);

  const filas = distribuirPorFilas(total);
  const porFila = filas.length ? Math.max(...filas) : MAX_POR_FILA;
  // Meia largura da fila maior, com o corredor e uma margem para as pontas
  // não ficarem coladas à borda.
  const meiaLargura = ((porFila / 2) * ESPACO_LUGAR + CORREDOR / 2 + 1.4) * escala;
  // Da base do estrado ao topo dos espaldares da última fila.
  const meiaAltura = (ALTURA_ESTRADO + filas.length * SUBIDA_FILA + 1.5) * escala;

  const vertical = (fov * Math.PI) / 180;
  const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * aspect);
  const precisa = Math.max(
    meiaLargura / Math.tan(horizontal / 2),
    meiaAltura / Math.tan(vertical / 2),
  );

  // Nunca mais perto do que a vista de origem, nem para lá do que os
  // controlos deixam — nem, sobretudo, fora da sala: num ecrã muito estreito
  // a largura pedida passa a profundidade que a sala tem, e o que se ganhava
  // em enquadramento perdia-se a ver o hemiciclo por detrás da parede.
  const distancia = Math.min(
    Math.max(distanciaBase, precisa),
    limite,
    recuoMaximo(alvo, direcao, escala),
  );

  return { camera: alvo.map((v, i) => v + direcao[i] * distancia), alvo };
}

/** Centro da bancada — para a câmara poder focá-la. */
export function focoBancada(total) {
  const lugares = calcularLugaresGoverno(total);
  if (!lugares.length) return null;
  const soma = lugares.reduce((acc, l) => [acc[0] + l.position[0], acc[1] + l.position[1], acc[2] + l.position[2]], [0, 0, 0]);
  return soma.map(v => v / lugares.length);
}
