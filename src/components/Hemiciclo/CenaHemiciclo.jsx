import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment } from '@react-three/drei';
import { Suspense, useRef } from 'react';
import PropTypes from 'prop-types';
import { Assento } from './Assento';
import { EstruturaHemiciclo } from './EstruturaHemiciclo';
import { useParlamento } from '../../context/ParlamentoContext';
import { useIsMobile } from '../../hooks/useIsMobile';

/** Sinaliza ao contexto que o Three.js renderizou pelo menos uma frame com deputados. */
const SinalPronto = () => {
  const { deputados, setCena3DPronta } = useParlamento();
  const disparado = useRef(false);
  useFrame(() => {
    if (!disparado.current && deputados.length > 0) {
      disparado.current = true;
      setCena3DPronta(true);
    }
  });
  return null;
};

const BG = '#f0f4f8';

const ControladorCamara = ({ controlsRef }) => {
  void controlsRef;
  return null;
};

ControladorCamara.propTypes = { controlsRef: PropTypes.object.isRequired };

export const CenaHemiciclo = () => {
  const controlsRef = useRef();
  const { deputados, posicoes3D } = useParlamento();
  const isMobile = useIsMobile();

  // Mobile: a cena inteira é escalada 1.4× — aumenta posições E geometria (espaçamento + tamanho).
  // Câmara em Y=36 desce o hemiciclo para a borda inferior do ecrã portrait.
  // Target Y=31 mantém a câmara quase horizontal respeitando maxPolarAngle (85.7°).
  // z=46 com fov=90 e aspect≈0.47 mostra ~43u de largura → cobre as filas A–E (1.4× = 19.9u).
  // Y=24 dá ângulo ~24° sobre as cadeiras (frontal, como audiência).
  // Target Y=18 mantém câmara acima do target (polar constraint) e olha ligeiramente para baixo.
  // sceneScale=2.3 compensa o afastamento e aumenta tamanho + espaçamento.
  // Target Y=61 (quase igual ao Y da câmara=75) → look direction apenas 12° para baixo.
  // Com a câmara alta e olhar quase horizontal, o chão (atan(75/50)=56°) cai para
  // ~1% da borda inferior do ecrã portrait.
  const sceneScale   = isMobile ? 2.8             : 1;
  const cameraPos    = isMobile ? [0, 58, 70]    : [0, 12, 24];
  const cameraFov    = isMobile ? 90              : 48;
  const maxDist      = isMobile ? 90              : 42;
  const fogNear      = isMobile ? 75              : 30;
  const fogFar       = isMobile ? 190             : 90;
  const orbitTarget  = isMobile ? [0, 51, -16]    : [0, 10, -16];

  return (
    <Canvas
      shadows="soft"
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: false }}
      style={{ background: BG }}
      onCreated={({ gl }) => gl.setClearColor(BG, 1)}
      aria-label="Visualização 3D do hemiciclo da Assembleia da República"
    >
      <Suspense fallback={null}>
        <color attach="background" args={[BG]} />

        {/* Névoa suave para dar profundidade */}
        <fog attach="fog" color={BG} near={fogNear} far={fogFar} />

        <PerspectiveCamera
          makeDefault
          position={cameraPos}
          fov={cameraFov}
          near={0.1}
          far={200}
        />

        <OrbitControls
          ref={controlsRef}
          enableDamping
          dampingFactor={0.08}
          minDistance={10}
          maxDistance={maxDist}
          maxPolarAngle={Math.PI / 2.1}
          target={orbitTarget}
          enableRotate={false}
          enablePan={false}
          enableZoom={false}
        />

        <ControladorCamara controlsRef={controlsRef} />

        {/* ── Iluminação ────────────────────────────────────── */}

        {/* Luz ambiente quente */}
        <ambientLight intensity={0.65} color="#fff8f0" />

        {/* Luz direcional principal — simula claraboia acima */}
        <directionalLight
          position={[0, 28, 8]}
          intensity={1.1}
          color="#fffaf4"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-near={1}
          shadow-camera-far={70}
          shadow-camera-left={-28}
          shadow-camera-right={28}
          shadow-camera-top={28}
          shadow-camera-bottom={-28}
          shadow-bias={-0.001}
        />

        {/* Preenchimento suave da esquerda */}
        <directionalLight position={[-18, 10, 6]} intensity={0.3} color="#e8f0ff" />

        {/* Preenchimento suave da direita */}
        <directionalLight position={[18, 10, 6]} intensity={0.3} color="#e8f0ff" />

        {/* Luz quente da tribuna (fundo da cena) */}
        <pointLight position={[0, 4, -14]} intensity={1.2} color="#ffdea0" distance={28} decay={2} />

        {/* Estrutura e assentos — grupo escalado para mobile */}
        <group scale={sceneScale}>
          <EstruturaHemiciclo />
          <SinalPronto />

          {deputados.map((deputado) => {
            const pos = posicoes3D.get(deputado.id);
            if (!pos) return null;
            return (
              <Assento
                key={deputado.id}
                deputado={deputado}
                position={pos.position}
                rotation={pos.rotation}
              />
            );
          })}
        </group>

      </Suspense>
    </Canvas>
  );
};
