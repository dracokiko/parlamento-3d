/**
 * Utilitários geométricos para o hemiciclo 3D.
 *
 * Sistema de coordenadas:
 * - Eixo X: largura (esquerda–direita)
 * - Eixo Y: altura (para cima)
 * - Eixo Z: profundidade (negativo = tribuna; positivo = câmara)
 *
 * Estrutura real da Assembleia da República — 6 filas, 230 lugares:
 *   Fila A (interior, 24 lugares): A1  … A24
 *   Fila B (30 lugares):           B1  … B30
 *   Fila C (36 lugares):           C1  … C36
 *   Fila D (38 lugares):           D1  … D38
 *   Fila E (46 lugares):           E1  … E46
 *   Fila F (exterior, 56 lugares): F1  … F56
 *
 * Dentro de cada fila, o número 1 está do lado esquerdo (PCP/BE)
 * e o número máximo está do lado direito (CH).
 */

// ─── Constantes de geometria ──────────────────────────────────────────────────

export const RAIO_INTERNO     = 7;    // raio da fila mais interior (metros)
export const ESPACAMENTO_FILA = 1.8;  // distância radial entre filas (metros)
export const ALTURA_DEGRAU    = 0.4;  // desnível vertical entre filas (metros)

/**
 * Número de lugares por fila, do centro (A) para o exterior (F).
 * Total: 24+30+36+38+46+56 = 230.
 */
export const LUGARES_POR_FILA = [24, 30, 36, 38, 46, 56];

export const NUM_FILAS = LUGARES_POR_FILA.length; // 6

/** Letras correspondentes a cada fila (A = interior, F = exterior) */
export const LETRAS_FILA = ['A', 'B', 'C', 'D', 'E', 'F'];

// ─── Mapa estático de lugares ─────────────────────────────────────────────────

/**
 * mapaLugares — Map estático de nome do lugar → dados de posição 3D.
 *
 * É calculado uma única vez no arranque da aplicação.
 * A chave é o nome do lugar (ex: "A1", "C15", "F56").
 *
 * Este mapa é independente dos dados dos deputados: as 230 posições existem
 * sempre, estejam ou não ocupadas.
 */
export const mapaLugares = (() => {
  const map = new Map();

  // Usa 85 % do semicírculo para que as cadeiras das pontas
  // nunca saiam do ecrã nem sejam cortadas pela câmara.
  const ABERTURA_ARCO = Math.PI * 0.85;
  const MARGEM        = (Math.PI - ABERTURA_ARCO) / 2; // ~10.8° em cada lado

  for (let fila = 0; fila < LUGARES_POR_FILA.length; fila++) {
    const numLugares = LUGARES_POR_FILA[fila];
    const raio       = RAIO_INTERNO + fila * ESPACAMENTO_FILA;
    const y          = fila * ALTURA_DEGRAU;
    const letra      = LETRAS_FILA[fila];

    for (let assento = 0; assento < numLugares; assento++) {
      // Nome do lugar: letra + número (começa em 1, da esquerda para a direita)
      const nomeLugar = `${letra}${assento + 1}`;

      // Ângulo dentro do semicírculo: assento 0 = esquerda (π), N-1 = direita (0)
      const angulo = numLugares === 1
        ? Math.PI / 2
        : Math.PI - MARGEM - (assento / (numLugares - 1)) * ABERTURA_ARCO;

      const x = Math.cos(angulo) * raio;
      const z = -Math.sin(angulo) * raio; // negativo → tribuna em −Z

      // Rotação Y para o assento apontar para o centro do hemiciclo
      const rotacaoY = angulo - Math.PI / 2;

      map.set(nomeLugar, {
        position: [x, y, z],
        rotation: [0, rotacaoY, 0],
        angulo,
        raio,
        fila,
        letra,
        numero: assento + 1,
      });
    }
  }

  return map;
})();

// ─── Utilitários ─────────────────────────────────────────────────────────────

/**
 * Calcula o centroide das posições de um partido para focar a câmara.
 *
 * @param {Map}    posicoesPorId  Map  deputadoId → posição (do contexto)
 * @param {Array}  listaDeputados Array de deputados carregados
 * @param {string} idPartido      Sigla do partido
 * @returns {[number, number, number] | null}
 */
export const calcularFocoPartido = (posicoesPorId, listaDeputados, idPartido) => {
  const deps = listaDeputados.filter(d => d.partido === idPartido);
  if (deps.length === 0) return null;

  let somaX = 0, somaY = 0, somaZ = 0, count = 0;
  for (const dep of deps) {
    const pos = posicoesPorId.get(dep.id);
    if (!pos) continue;
    somaX += pos.position[0];
    somaY += pos.position[1];
    somaZ += pos.position[2];
    count++;
  }

  if (count === 0) return null;
  return [somaX / count, somaY / count + 2, somaZ / count];
};
