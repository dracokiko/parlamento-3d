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
 * ampliada e estes valores acompanham (ver escalaDaVista).
 */
export const VISTA_GOVERNO = {
  // Dentro da sala: a parede (raio 17) é opaca dos dois lados, e a câmara
  // fora dela via o reverso do estuque em vez do plenário.
  camera: [0, 4.8, -14],
  alvo:   [0, 1.4, 2.6],
};

/** A cena é ampliada em ecrãs estreitos; a vista tem de crescer com ela. */
export const escalaDaVista = (vista, escala) => ({
  camera: vista.camera.map(v => v * escala),
  alvo:   vista.alvo.map(v => v * escala),
});

/**
 * Distribui `total` lugares por filas: a da frente é a primeira a encher,
 * porque é onde ficam o Primeiro-Ministro e os ministros.
 */
export function distribuirPorFilas(total, maxPorFila = MAX_POR_FILA) {
  const filas = [];
  let restantes = total;
  while (restantes > 0) {
    const nesta = Math.min(restantes, maxPorFila);
    filas.push(nesta);
    restantes -= nesta;
  }
  return filas;
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
    const larguraFila = (nesta - 1) * ESPACO_LUGAR + CORREDOR;
    const metade = Math.ceil(nesta / 2);

    for (let i = 0; i < nesta; i++) {
      // O corredor abre-se ao meio da fila; a segunda metade desloca-se.
      const passo = i * ESPACO_LUGAR + (i >= metade ? CORREDOR : 0);
      lugares.push({
        position: [-larguraFila / 2 + passo, y, z],
        // Viradas para o hemiciclo, que está todo em Z negativo.
        rotation: [0, Math.PI, 0],
        fila,
        indice: lugares.length,
      });
    }
  });

  return lugares;
}

/** Centro da bancada — para a câmara poder focá-la. */
export function focoBancada(total) {
  const lugares = calcularLugaresGoverno(total);
  if (!lugares.length) return null;
  const soma = lugares.reduce((acc, l) => [acc[0] + l.position[0], acc[1] + l.position[1], acc[2] + l.position[2]], [0, 0, 0]);
  return soma.map(v => v / lugares.length);
}
