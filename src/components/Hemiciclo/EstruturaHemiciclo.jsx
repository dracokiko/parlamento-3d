import { useRef, useMemo, memo, Suspense, Component } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import { RAIO_INTERNO, NUM_FILAS, ESPACAMENTO_FILA, ALTURA_DEGRAU } from '../../utils/posicoes3D';
import { useIsMobile } from '../../hooks/useIsMobile';

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
const COR_PAREDE  = '#200045'; // âmbar dourado
const COR_CORNIJA = '#a07830';
const DOUBLE_SIDE = 2;

// 250° centrado no fundo (cilindros): thetaStart=55°, length=250°
const WALL_THETA_START  = Math.PI / 2 - 7 * Math.PI / 36;
const WALL_THETA_LENGTH = 25 * Math.PI / 18;

// 250° equivalente para ringGeometry (após rotação [-π/2,0,0])
const RING_THETA_START  = -7 * Math.PI / 36;
const RING_THETA_LENGTH = 25 * Math.PI / 18;

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

      {/* ── Banda separadora (entre hemiciclo e banner) ─────── */}
      <mesh position={[0, SEPARADOR_Y, 0]}>
        <cylinderGeometry
          args={[WALL_RADIUS - 0.04, WALL_RADIUS - 0.04, SEPARADOR_HEIGHT, 80, 1, true, WALL_THETA_START, WALL_THETA_LENGTH]}
        />
        <meshStandardMaterial color="#ffffff" roughness={0.25} metalness={0.08} side={DOUBLE_SIDE} />
      </mesh>

      {/* ── Banner publicitário ──────────────────────────────── */}
      <BannerPublicitario />

    </group>
  );
};

export const EstruturaHemiciclo = memo(EstruturaHemicicloComponent);
