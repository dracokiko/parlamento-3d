import { useMemo, memo, Suspense, Component } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import { RAIO_INTERNO, NUM_FILAS, ESPACAMENTO_FILA, ALTURA_DEGRAU } from '../../utils/posicoes3D';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useParlamento } from '../../context/ParlamentoContext';

class TexturaBoundary extends Component {
  constructor(props) { super(props); this.state = { erro: false }; }
  static getDerivedStateFromError() { return { erro: true }; }
  render() { return this.state.erro ? null : this.props.children; }
}

const EmblemaChao = () => {
  const emblema = useTexture('/simbolo-republica.png');
  const isMobile = useIsMobile();
  const largura = isMobile ? 7.5 : 4;
  const altura  = isMobile ? 4.5 : 4;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, -3]}>
      <planeGeometry args={[largura, altura]} />
      <meshStandardMaterial
        map={emblema} transparent alphaTest={0.05}
        opacity={0.80} roughness={0.55} depthWrite={false}
      />
    </mesh>
  );
};


// ─────────────────────────────────────────────────────────────
// CONFIGURAÇÃO DO BANNER PUBLICITÁRIO
// Altere estas propriedades para colocar publicidade real.
// ─────────────────────────────────────────────────────────────
const BANNER_CONFIG = {
  texto:      '  ★  SPOT PUBLICITÁRIO  —  Para anunciar contacte: parlamento3d@gmail.com  ★  ',
  corFundo:   '#eef2f7',   // fundo do banner (azul-acinzentado claro)
  corTexto:   '#2c5282',   // cor do texto (azul médio)
  velocidade: 0.04,        // velocidade de scroll (unidades/s); aumente para mais rápido
};
// ─────────────────────────────────────────────────────────────

// Gradiente de madeira quente por fila
const PLATAFORMAS = [
  { plat: '#c8a87a', riser: '#9e7848', nosing: '#dfc090' },
  { plat: '#c0a070', riser: '#986e40', nosing: '#d8b888' },
  { plat: '#b89868', riser: '#906638', nosing: '#d0b080' },
  { plat: '#b09060', riser: '#886030', nosing: '#c8a878' },
  { plat: '#a88858', riser: '#805828', nosing: '#c0a070' },
  { plat: '#a08050', riser: '#785020', nosing: '#b89868' },
];

const COR_SOALHO  = '#e8dcc8'; // bege claro polido
// Estuque claro, como a sala real: neoclássico de Ventura Terra, iluminado de
// cima pela claraboia. Estava #200045 — roxo quase preto — e era o que fazia a
// sala parecer um estúdio de televisão em vez do Palácio de São Bento.
const COR_PAREDE   = '#e7ddc9';
const COR_CARVALHO = '#8a6236'; // lambril e mobiliário, em carvalho
const COR_CORNIJA = '#a07830';
const COR_TECTO   = '#f2ece0';
const COR_VIDRO    = '#fdf8ea'; // vidro da claraboia, aceso de dia
const COR_FERRO    = '#8a7f6d'; // caixilharia
const COR_CAIXOTAO = '#e6dfd0'; // almofadas do tecto
const DOUBLE_SIDE = 2;

// 250° centrado no fundo (cilindros): thetaStart=55°, length=250°
const WALL_THETA_START  = Math.PI / 2 - 7 * Math.PI / 36;
const WALL_THETA_LENGTH = 25 * Math.PI / 18;

// 250° equivalente para ringGeometry (após rotação [-π/2,0,0])
const RAIO_VIDRO = RAIO_INTERNO - 1.6;
/**
 * A claraboia é uma abóbada de flecha baixa, não uma meia esfera: sobe 90 cm
 * sobre um vão de 5,4 m de raio. Daí a esfera de onde se corta a calote ser
 * tão grande — R = (r² + f²) / 2f, com a calote a acabar exactamente no aro.
 */
const FLECHA_CALOTE = 0.9;
const RAIO_CALOTE   = (RAIO_VIDRO ** 2 + FLECHA_CALOTE ** 2) / (2 * FLECHA_CALOTE);
const THETA_CALOTE  = Math.asin(RAIO_VIDRO / RAIO_CALOTE);

const RING_THETA_START  = -7 * Math.PI / 36;
const RING_THETA_LENGTH = 25 * Math.PI / 18;

// Os 110° que faltavam para fechar a sala, atrás da bancada do Governo.
const FECHO_THETA_START      = WALL_THETA_START + WALL_THETA_LENGTH;
const FECHO_THETA_LENGTH     = 2 * Math.PI - WALL_THETA_LENGTH;
const FECHO_RING_THETA_START = RING_THETA_START + RING_THETA_LENGTH;

// Geometria computada uma única vez
const RAIO_EXTERIOR  = RAIO_INTERNO + NUM_FILAS * ESPACAMENTO_FILA;
const WALL_RADIUS    = RAIO_EXTERIOR + 1.0;
const WALL_HEIGHT    = (NUM_FILAS - 1) * ALTURA_DEGRAU + 4.2;
const WALL_CENTER_Y  = WALL_HEIGHT / 2 - 0.05;
const BANNER_HEIGHT  = 2.5;
const BANNER_Y       = 4.5;
const SEPARADOR_HEIGHT = 0.28;
const SEPARADOR_Y      = BANNER_Y - BANNER_HEIGHT / 2 - SEPARADOR_HEIGHT / 2;

// Cria um canvas com o texto do banner repetido e pronto a scrollar.
// Não usa espelhamento: o offset.x negativo trata da direcção correcta.
function criarTexturaBanner(cfg) {
  const W = 4096, H = 256;
  const canvas = document.createElement('canvas');
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Fundo
  ctx.fillStyle = cfg.corFundo;
  ctx.fillRect(0, 0, W, H);

  // Faixas decorativas
  ctx.fillStyle = cfg.corTexto;
  ctx.fillRect(0, 0, W, 6);
  ctx.fillRect(0, H - 6, W, 6);

  // Texto desenhado espelhado para aparecer correcto do interior do cilindro
  const fontSize = Math.floor(H * 0.32);
  ctx.font      = `bold ${fontSize}px Arial, sans-serif`;
  ctx.fillStyle = cfg.corTexto;
  ctx.textBaseline = 'middle';
  const textW = ctx.measureText(cfg.texto).width;
  const step  = textW + 120;
  ctx.save();
  ctx.translate(W, 0);
  ctx.scale(-1, 1);
  for (let x = 0; x < W + step; x += step) {
    ctx.fillText(cfg.texto, x, H / 2);
  }
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

// Componente animado do banner
const BannerPublicitario = () => {
  const isMobile = useIsMobile();
  const texture = useMemo(() => criarTexturaBanner(BANNER_CONFIG), []);

  const altura = isMobile ? BANNER_HEIGHT * 2 : BANNER_HEIGHT;
  const posY   = isMobile ? BANNER_Y + BANNER_HEIGHT / 2 : BANNER_Y;

  useFrame((_, delta) => {
    texture.offset.x += delta * BANNER_CONFIG.velocidade;
    texture.needsUpdate = false;
  });

  return (
    <mesh position={[0, posY, 0]}>
      <cylinderGeometry
        args={[WALL_RADIUS - 0.05, WALL_RADIUS - 0.05, altura, 120, 1, true, WALL_THETA_START, WALL_THETA_LENGTH]}
      />
      <meshStandardMaterial
        map={texture}
        emissiveMap={texture}
        emissive={new THREE.Color(0.55, 0.65, 0.80)}
        roughness={0.3}
        metalness={0.05}
        side={DOUBLE_SIDE}
      />
    </mesh>
  );
};

const EstruturaHemicicloComponent = () => {
  const { vistaGoverno } = useParlamento();
  const alturaUltimaDegrau = (NUM_FILAS - 1) * ALTURA_DEGRAU;
  const isMobile = useIsMobile();

  return (
    <group>

      {/* ── Plano de base — tapa o gap branco no fundo em portrait/mobile ── */}
      {isMobile && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.15, 0]}>
          <planeGeometry args={[300, 300]} />
          <meshStandardMaterial color={COR_SOALHO} roughness={0.5} metalness={0.05} />
        </mesh>
      )}

      {/* ── Soalho central — bege claro ─────────────────────── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <circleGeometry args={[RAIO_INTERNO - 0.3, 80, RING_THETA_START, RING_THETA_LENGTH]} />
        <meshStandardMaterial color={COR_SOALHO} roughness={0.30} metalness={0.08} />
      </mesh>

      {/* ── Linha negra — delimita o chão bege das bancadas ─── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]}>
        <ringGeometry args={[RAIO_INTERNO - 0.34, RAIO_INTERNO - 0.28, 80, 1, RING_THETA_START, RING_THETA_LENGTH]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.7} />
      </mesh>

      {/* Emblema no chão */}
      <TexturaBoundary>
        <Suspense fallback={null}>
          <EmblemaChao />
        </Suspense>
      </TexturaBoundary>


{/* ── Degraus com riser e nosing ───────────────────────── */}
      {Array.from({ length: NUM_FILAS }).map((_, i) => {
        const raioInt = RAIO_INTERNO + i * ESPACAMENTO_FILA - 0.45;
        const raioExt = RAIO_INTERNO + (i + 1) * ESPACAMENTO_FILA - 0.45;
        const yPlat   = i * ALTURA_DEGRAU - 0.05;
        const yRiser  = yPlat - ALTURA_DEGRAU / 2;
        const { plat, riser, nosing } = PLATAFORMAS[i] ?? PLATAFORMAS[PLATAFORMAS.length - 1];

        return (
          <group key={`bancada-${i}`}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, yPlat, 0]} receiveShadow>
              <ringGeometry args={[raioInt + 0.10, raioExt, 80, 1, RING_THETA_START, RING_THETA_LENGTH]} />
              <meshStandardMaterial color={plat} roughness={0.50} metalness={0.06} />
            </mesh>

            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, yPlat + 0.001, 0]}>
              <ringGeometry args={[raioInt, raioInt + 0.10, 80, 1, RING_THETA_START, RING_THETA_LENGTH]} />
              <meshStandardMaterial color={nosing} roughness={0.30} metalness={0.20} />
            </mesh>

            {i > 0 && (
              <mesh position={[0, yRiser, 0]} receiveShadow>
                <cylinderGeometry args={[raioInt, raioInt, ALTURA_DEGRAU, 80, 1, true, WALL_THETA_START, WALL_THETA_LENGTH]} />
                <meshStandardMaterial color={riser} roughness={0.68} metalness={0.05} side={DOUBLE_SIDE} />
              </mesh>
            )}
          </group>
        );
      })}

      {/* ── Bordo exterior dos degraus ──────────────────────── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, alturaUltimaDegrau - 0.05, 0]} receiveShadow>
        <ringGeometry args={[RAIO_EXTERIOR - 0.45, RAIO_EXTERIOR + 0.35, 80, 1, RING_THETA_START, RING_THETA_LENGTH]} />
        <meshStandardMaterial color="#6e4e20" roughness={0.82} />
      </mesh>

      {/* ── Soalho perimetral ────────────────────────────────── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 0]} receiveShadow>
        <ringGeometry args={[RAIO_EXTERIOR + 0.35, WALL_RADIUS + 0.1, 80, 1, RING_THETA_START, RING_THETA_LENGTH]} />
        <meshStandardMaterial color={COR_SOALHO} roughness={0.30} metalness={0.08} />
      </mesh>

      {/* ── Fecho do círculo, atrás da bancada do Governo ─────
          A sala tinha 110° em aberto — por onde a câmara inicial espreita.
          Fechá-la com uma parede normal tapava essa vista, por isso este
          troço só existe do lado de dentro (BackSide): quem está fora
          continua a ver o plenário, quem se vira para o Governo deixa de ver
          o vazio branco. */}
      <group>
        <mesh position={[0, WALL_CENTER_Y, 0]} receiveShadow>
          <cylinderGeometry args={[WALL_RADIUS, WALL_RADIUS, WALL_HEIGHT, 80, 1, true, FECHO_THETA_START, FECHO_THETA_LENGTH]} />
          <meshStandardMaterial color={COR_PAREDE} roughness={0.78} metalness={0.04} side={THREE.BackSide} />
        </mesh>

        {/* Rodapé e cornija, para o fecho ser do mesmo edifício */}
        <mesh position={[0, 0.25, 0]}>
          <cylinderGeometry args={[WALL_RADIUS + 0.07, WALL_RADIUS + 0.07, 0.50, 80, 1, true, FECHO_THETA_START, FECHO_THETA_LENGTH]} />
          <meshStandardMaterial color={COR_CORNIJA} roughness={0.72} side={THREE.BackSide} />
        </mesh>
        <mesh position={[0, WALL_HEIGHT - 0.05, 0]}>
          <cylinderGeometry args={[WALL_RADIUS + 0.10, WALL_RADIUS + 0.10, 0.30, 80, 1, true, FECHO_THETA_START, FECHO_THETA_LENGTH]} />
          <meshStandardMaterial color={COR_CORNIJA} roughness={0.72} side={THREE.BackSide} />
        </mesh>

        {/* Soalho do sector que faltava — sem ele a bancada assentava no vazio */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 0]} receiveShadow>
          <circleGeometry args={[WALL_RADIUS + 0.1, 80, FECHO_RING_THETA_START, FECHO_THETA_LENGTH]} />
          <meshStandardMaterial color={COR_SOALHO} roughness={0.30} metalness={0.08} />
        </mesh>
      </group>

      {/* ── Parede traseira ──────────────────────────────────── */}
      <mesh position={[0, WALL_CENTER_Y, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[WALL_RADIUS, WALL_RADIUS, WALL_HEIGHT, 80, 1, true, WALL_THETA_START, WALL_THETA_LENGTH]} />
        <meshStandardMaterial color={COR_PAREDE} roughness={0.78} metalness={0.04} side={DOUBLE_SIDE} />
      </mesh>

      {/* Rodapé */}
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[WALL_RADIUS + 0.07, WALL_RADIUS + 0.07, 0.50, 80, 1, true, WALL_THETA_START, WALL_THETA_LENGTH]} />
        <meshStandardMaterial color={COR_CORNIJA} roughness={0.72} side={DOUBLE_SIDE} />
      </mesh>

      {/* Friso intermédio */}
      <mesh position={[0, WALL_CENTER_Y * 0.72, 0]}>
        <cylinderGeometry args={[WALL_RADIUS + 0.05, WALL_RADIUS + 0.05, 0.18, 80, 1, true, WALL_THETA_START, WALL_THETA_LENGTH]} />
        <meshStandardMaterial color={COR_CORNIJA} roughness={0.72} side={DOUBLE_SIDE} />
      </mesh>

      {/* Cornija */}
      <mesh position={[0, WALL_HEIGHT - 0.05, 0]}>
        <cylinderGeometry args={[WALL_RADIUS + 0.10, WALL_RADIUS + 0.10, 0.30, 80, 1, true, WALL_THETA_START, WALL_THETA_LENGTH]} />
        <meshStandardMaterial color={COR_CORNIJA} roughness={0.72} side={DOUBLE_SIDE} />
      </mesh>

      {/* ── Lambril de carvalho ──────────────────────────────
          A parede real não é estuque até ao chão: tem um lambril de madeira
          à altura das bancadas, que é o que liga visualmente as carteiras à
          sala. Dois troços, porque o fecho atrás do Governo só existe visto
          de dentro. */}
      <mesh position={[0, 1.45, 0]} receiveShadow>
        <cylinderGeometry args={[WALL_RADIUS - 0.03, WALL_RADIUS - 0.03, 1.9, 80, 1, true, WALL_THETA_START, WALL_THETA_LENGTH]} />
        <meshStandardMaterial color={COR_CARVALHO} roughness={0.62} metalness={0.05} side={DOUBLE_SIDE} />
      </mesh>
      <mesh position={[0, 1.45, 0]} receiveShadow>
        <cylinderGeometry args={[WALL_RADIUS - 0.03, WALL_RADIUS - 0.03, 1.9, 80, 1, true, FECHO_THETA_START, FECHO_THETA_LENGTH]} />
        <meshStandardMaterial color={COR_CARVALHO} roughness={0.62} metalness={0.05} side={THREE.BackSide} />
      </mesh>

      {/* ── Tecto e claraboia ────────────────────────────────
          A sala é iluminada de cima, por uma claraboia de ferro e vidro — é
          a marca da Sala das Sessões. Tudo virado para baixo (só se vê de
          dentro): a câmara inicial está acima desta cota e um tecto opaco
          fechava-lhe a vista. */}
      <group>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, WALL_HEIGHT - 0.05, 0]}>
          <ringGeometry args={[RAIO_INTERNO - 1.2, WALL_RADIUS + 0.1, 64, 1]} />
          <meshStandardMaterial color={COR_TECTO} roughness={0.9} side={THREE.FrontSide} />
        </mesh>

        {/* Vidro, numa calote ligeiramente abobadada em vez de um disco
            plano: a claraboia real é uma cúpula, e uma tampa lisa lia-se
            como um alçapão branco no tecto. */}
        <mesh position={[0, WALL_HEIGHT - 0.12 - RAIO_CALOTE * Math.cos(THETA_CALOTE), 0]}>
          <sphereGeometry args={[RAIO_CALOTE, 48, 16, 0, Math.PI * 2, 0, THETA_CALOTE]} />
          <meshStandardMaterial
            color={COR_VIDRO}
            emissive={COR_VIDRO}
            emissiveIntensity={0.5}
            roughness={0.25}
            side={THREE.BackSide}
          />
        </mesh>

        {/* Caixilharia radial, como um leque, e dois anéis a travá-la —
            era uma grelha ortogonal, que num tecto redondo não assenta. */}
        {Array.from({ length: 16 }).map((_, i) => {
          const angulo = (i / 16) * Math.PI * 2;
          return (
            <mesh
              key={`nervura-${i}`}
              rotation={[Math.PI / 2, 0, -angulo]}
              position={[Math.cos(angulo) * RAIO_VIDRO / 2, WALL_HEIGHT - 0.1, Math.sin(angulo) * RAIO_VIDRO / 2]}
            >
              <planeGeometry args={[RAIO_VIDRO, 0.05]} />
              <meshStandardMaterial color={COR_FERRO} roughness={0.5} metalness={0.55} side={THREE.FrontSide} />
            </mesh>
          );
        })}
        {[0.42, 0.78].map((fraccao) => (
          <mesh key={`anel-vidro-${fraccao}`} rotation={[Math.PI / 2, 0, 0]} position={[0, WALL_HEIGHT - 0.1, 0]}>
            <ringGeometry args={[RAIO_VIDRO * fraccao - 0.025, RAIO_VIDRO * fraccao + 0.025, 64]} />
            <meshStandardMaterial color={COR_FERRO} roughness={0.5} metalness={0.55} side={THREE.FrontSide} />
          </mesh>
        ))}

        {/* Aro dourado a rematar a abertura, e uma moldura de estuque à volta */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, WALL_HEIGHT - 0.08, 0]}>
          <ringGeometry args={[RAIO_VIDRO, RAIO_VIDRO + 0.22, 64]} />
          <meshStandardMaterial color={COR_CORNIJA} roughness={0.35} metalness={0.7} side={THREE.FrontSide} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, WALL_HEIGHT - 0.07, 0]}>
          <ringGeometry args={[RAIO_VIDRO + 0.22, RAIO_VIDRO + 0.95, 64]} />
          <meshStandardMaterial color={COR_TECTO} roughness={0.92} side={THREE.FrontSide} />
        </mesh>

        {/* Caixotões: dois anéis de almofadas, a dar relevo ao tecto liso */}
        {[{ raio: RAIO_VIDRO + 1.5, quantos: 24 }, { raio: RAIO_VIDRO + 3.1, quantos: 32 }].map(({ raio, quantos }) => (
          Array.from({ length: quantos }).map((_, i) => {
            const angulo = (i / quantos) * Math.PI * 2;
            return (
              <mesh
                key={`caixotao-${raio}-${i}`}
                rotation={[Math.PI / 2, 0, -angulo]}
                position={[Math.cos(angulo) * raio, WALL_HEIGHT - 0.09, Math.sin(angulo) * raio]}
              >
                <planeGeometry args={[1.1, 0.72]} />
                <meshStandardMaterial color={COR_CAIXOTAO} roughness={0.95} side={THREE.FrontSide} />
              </mesh>
            );
          })
        ))}

        {/* A luz que entra por ela */}
        <pointLight position={[0, WALL_HEIGHT - 0.6, 0]} intensity={0.9} color="#fff6e0" distance={34} decay={2} />
      </group>

      {/* ── Banda separadora e publicidade ───────────────────
          Só na vista do hemiciclo: virados para o Governo, o anúncio ficava
          a ladear a Mesa da Assembleia. */}
      {!vistaGoverno && (
       <>
      <mesh position={[0, SEPARADOR_Y, 0]}>
        <cylinderGeometry
          args={[WALL_RADIUS - 0.04, WALL_RADIUS - 0.04, SEPARADOR_HEIGHT, 80, 1, true, WALL_THETA_START, WALL_THETA_LENGTH]}
        />
        <meshStandardMaterial color="#ffffff" roughness={0.25} metalness={0.08} side={DOUBLE_SIDE} />
      </mesh>

      <BannerPublicitario />
       </>
      )}

    </group>
  );
};

export const EstruturaHemiciclo = memo(EstruturaHemicicloComponent);
