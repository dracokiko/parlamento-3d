/**
 * Vistas da câmara no hemiciclo, e o voo entre elas.
 *
 * A vista inicial vivia só dentro da CenaHemiciclo; a visita aos destaques
 * precisa de voltar exactamente a ela no fim, por isso passou para aqui e a
 * cena usa-a daqui também. Um sítio só para os números afinados à mão.
 */

/** A cena é ampliada em ecrãs estreitos (ver CenaHemiciclo). */
export function escalaDaCena({ isMobile, isTabletPortrait }) {
  return isTabletPortrait ? 2.2 : (isMobile ? 2.7 : 1);
}

/** A vista com que a sala abre. Os valores e a razão deles estão na CenaHemiciclo. */
export function vistaInicial({ isMobile }) {
  return isMobile
    ? { camera: [0, 61, 62], alvo: [0, 61, -16] }
    : { camera: [0, 12, 24], alvo: [0, 10, -16] };
}

/**
 * Para ver uma votação: a sala inteira, de cima e de frente, para as cores
 * das bancadas se lerem de uma vez. Afastada até ao limite dos controlos —
 * o cartão ocupa parte do ecrã e a sala tem de caber no resto.
 *
 * Em telemóvel olha mais a pique: a sala fica mais baixa no ecrã ao alto e
 * cabe acima do cartão, que ali ocupa o fundo. Com a vista inicial, que é
 * quase horizontal, o hemiciclo ficava todo por trás dele.
 */
export function vistaVotacao({ isMobile, escala = 1 }) {
  return isMobile
    ? { camera: [0, 26 * escala, 15 * escala], alvo: [0, 0, -6.5 * escala] }
    : { camera: [0, 24, 31], alvo: [0, 1, -7] };
}

/**
 * Para ver umas pessoas: de frente para elas e um pouco acima, afastado o
 * bastante para caberem todas — os deputados dos Açores estão juntos, mas
 * uma história pode ter um de cada ponta da sala.
 *
 * @param {[number,number,number][]} pontos  posições dos lugares, já na escala da cena
 */
export function vistaDeputados(pontos, { escala, isMobile = false }) {
  if (!pontos.length) return null;
  const centro = pontos.reduce((a, p) => [a[0] + p[0], a[1] + p[1], a[2] + p[2]], [0, 0, 0]).map((v) => v / pontos.length);
  const espalhamento = Math.max(0, ...pontos.map((p) => Math.hypot(p[0] - centro[0], p[2] - centro[2])));
  // Com contexto à volta: as pessoas lêem-se melhor no meio da bancada delas
  // do que num grande plano em que não se percebe onde se está.
  const distancia = Math.max(14 * escala, espalhamento * 2.4 + 10 * escala);

  // Os lugares olham para a Mesa (+Z): a câmara fica desse lado, acima —
  // mais a pique em telemóvel, pela mesma razão da vista de votação.
  const dir = isMobile ? [0, 1.1, 1] : [0, 0.75, 1];
  const norma = Math.hypot(...dir);
  return {
    camera: centro.map((v, i) => v + (dir[i] / norma) * distancia),
    alvo: [centro[0], centro[1] + 0.4 * escala, centro[2]],
  };
}

/**
 * Quanto a imagem tem de deslizar, em píxeis, para o centro da vista cair no
 * meio do espaço que o cartão deixa livre (+dx direita, +dy cima).
 *
 * Mede o que está de facto no ecrã: o cartão muda de altura de paragem para
 * paragem, e é lateral no computador e uma folha no fundo no telemóvel.
 */
export function lenteDoCartao(cartao, area, { margem = 16 } = {}) {
  if (!cartao || !area) return { dx: 0, dy: 0 };
  const a = area.getBoundingClientRect();
  const c = cartao.getBoundingClientRect();
  if (!a.width || !a.height) return { dx: 0, dy: 0 };

  // Conta-se pelo tamanho do cartão e pelo sítio onde ele está ancorado, e
  // não pela posição que o navegador lhe dá no instante da medição: logo a
  // seguir a abrir, essa posição ainda não é a final — no computador media
  // 440 px ao lado, e a sala ia parar à borda do ecrã.
  if (c.width < a.width * 0.7) {
    const direitaDoCartao = a.left + margem + c.width;       // encostado à esquerda
    const centroLivre = (direitaDoCartao + a.right) / 2;
    return { dx: centroLivre - (a.left + a.width / 2), dy: 0 };
  }
  const topoDoCartao = a.bottom - c.height;                  // folha no fundo
  const centroLivre = (a.top + topoDoCartao) / 2;
  return { dx: 0, dy: a.top + a.height / 2 - centroLivre };
}

/** O deslize em que a lente está agora — zero se não houver nenhum. */
function lenteAtual(camara) {
  const v = camara.view;
  return v?.enabled ? { dx: -v.offsetX, dy: v.offsetY } : { dx: 0, dy: 0 };
}

/**
 * Descentra a imagem sem mexer na câmara — como uma objectiva de
 * descentramento. Mover a câmara de lado mudava a perspectiva: a sala
 * aparecia de esguelha e cortada na borda. Assim fica exactamente como na
 * vista pensada para ela, só desenhada noutro sítio do ecrã.
 */
function aplicarLente(camara, { dx, dy }, largura, altura) {
  if (!dx && !dy) {
    if (camara.view?.enabled) camara.clearViewOffset();
    return;
  }
  camara.setViewOffset(largura, altura, -dx, dy, largura, altura);
}

const suavizar = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Leva a câmara até uma vista, com aceleração e travagem suaves.
 *
 * A distância é presa aos limites dos controlos antes de partir: se o
 * destino ficasse mais perto do que o mínimo, o OrbitControls corrigia-o no
 * fim e a câmara dava um salto. Devolve uma função que cancela o voo.
 */
export function voarPara(controlos, destino, { duracao = 1300, lente = { dx: 0, dy: 0 }, area = null } = {}) {
  if (!controlos || !destino) return () => {};
  const camara = controlos.object;
  const largura = area?.clientWidth || 0;
  const altura = area?.clientHeight || 0;
  const lenteDe = lenteAtual(camara);
  const comLente = largura > 0 && altura > 0;

  const alvo = destino.alvo;
  const vetor = destino.camera.map((v, i) => v - alvo[i]);
  const dist = Math.hypot(...vetor) || 1;
  const min = (controlos.minDistance ?? 0) + 0.5;
  const max = (controlos.maxDistance ?? Infinity) - 0.5;
  const presa = Math.min(Math.max(dist, min), max);
  const camaraPara = alvo.map((v, i) => v + (vetor[i] / dist) * presa);

  const camaraDe = controlos.object.position.toArray();
  const alvoDe = controlos.target.toArray();
  const inicio = performance.now();
  let pedido = 0;

  const passo = (agora) => {
    const t = suavizar(Math.min((agora - inicio) / duracao, 1));
    controlos.object.position.set(...camaraDe.map((v, i) => lerp(v, camaraPara[i], t)));
    controlos.target.set(...alvoDe.map((v, i) => lerp(v, alvo[i], t)));
    if (comLente) {
      aplicarLente(camara, { dx: lerp(lenteDe.dx, lente.dx, t), dy: lerp(lenteDe.dy, lente.dy, t) }, largura, altura);
    }
    controlos.update();
    if (t < 1) pedido = requestAnimationFrame(passo);
  };
  pedido = requestAnimationFrame(passo);
  return () => cancelAnimationFrame(pedido);
}
