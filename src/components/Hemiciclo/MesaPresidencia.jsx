import { memo, Suspense } from 'react';
import { useTexture, Edges } from '@react-three/drei';

/**
 * A Mesa da Assembleia — o estrado da presidência, ao fundo da sala, virado
 * para os deputados.
 *
 * Na sala real é isto que se vê de frente quando se olha da bancada para o
 * topo: o estrado elevado com a Mesa em carvalho, a tribuna do orador à
 * frente e, ao fundo, a parede com as armas da República. Sem nada disto,
 * virar a câmara dava uma parede nua atrás do Governo.
 *
 * Fica atrás da bancada do Governo (que ocupa z 0,6 a 4,3) e elevada, para
 * se ver por cima das cadeiras.
 */

const COR_CARVALHO       = '#8a6236';
const COR_CARVALHO_FUNDO = '#6d4d29';
const COR_TAMPO          = '#9c7643';
const COR_LATAO          = '#b08d3f';
const COR_ESTOFO         = '#3b2f2a';

const Z_ESTRADO = 7.2;
const ALTURA_ESTRADO = 1.8;
const LARGURA_MESA = 9;

const ArmasDaRepublica = () => {
  const armas = useTexture('/Coat_of_arms_of_the_Assembly_of_the_Portuguese_Republic.svg.png');
  return (
    <mesh position={[0, ALTURA_ESTRADO + 2.5, Z_ESTRADO + 1.72]} rotation={[0, Math.PI, 0]}>
      <planeGeometry args={[2.6, 2.6]} />
      <meshStandardMaterial map={armas} transparent alphaTest={0.05} roughness={0.5} />
    </mesh>
  );
};

const MesaPresidenciaComponent = () => (
  <group>
    {/* Estrado */}
    <mesh position={[0, ALTURA_ESTRADO / 2, Z_ESTRADO]} receiveShadow castShadow>
      <boxGeometry args={[LARGURA_MESA + 2.4, ALTURA_ESTRADO, 3.2]} />
      <meshStandardMaterial color={COR_CARVALHO_FUNDO} roughness={0.7} />
      <Edges threshold={20} color="#4a3721" />
    </mesh>

    {/* Degraus laterais de acesso */}
    {[-1, 1].map((lado) => (
      <mesh key={`degrau-mesa-${lado}`} position={[lado * (LARGURA_MESA / 2 + 1.6), ALTURA_ESTRADO / 4, Z_ESTRADO - 0.4]} receiveShadow>
        <boxGeometry args={[1.2, ALTURA_ESTRADO / 2, 2.4]} />
        <meshStandardMaterial color={COR_CARVALHO_FUNDO} roughness={0.75} />
      </mesh>
    ))}

    {/* Frente da Mesa, com friso dourado */}
    <mesh position={[0, ALTURA_ESTRADO + 0.52, Z_ESTRADO - 1.2]} castShadow>
      <boxGeometry args={[LARGURA_MESA, 1.04, 0.22]} />
      <meshStandardMaterial color={COR_CARVALHO} roughness={0.55} />
      <Edges threshold={20} color="#4a3721" />
    </mesh>
    <mesh position={[0, ALTURA_ESTRADO + 0.86, Z_ESTRADO - 1.33]}>
      <boxGeometry args={[LARGURA_MESA, 0.06, 0.03]} />
      <meshStandardMaterial color={COR_LATAO} roughness={0.3} metalness={0.75} />
    </mesh>

    {/* Tampo */}
    <mesh position={[0, ALTURA_ESTRADO + 1.07, Z_ESTRADO - 0.75]} castShadow receiveShadow>
      <boxGeometry args={[LARGURA_MESA, 0.09, 1.2]} />
      <meshStandardMaterial color={COR_TAMPO} roughness={0.45} />
    </mesh>

    {/* Presidente ao centro, secretários de cada lado */}
    {[-2.6, 0, 2.6].map((x) => (
      <group key={`cadeira-mesa-${x}`} position={[x, ALTURA_ESTRADO, Z_ESTRADO + 0.15]}>
        <mesh position={[0, 0.45, 0]} castShadow>
          <boxGeometry args={[0.6, 0.1, 0.55]} />
          <meshStandardMaterial color={COR_ESTOFO} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.9, 0.26]} castShadow>
          <boxGeometry args={[0.6, 0.8 + (x === 0 ? 0.35 : 0), 0.1]} />
          <meshStandardMaterial color={COR_ESTOFO} roughness={0.5} />
        </mesh>
      </group>
    ))}

    {/* Tribuna do orador, à frente e abaixo da Mesa */}
    <mesh position={[0, 0.62, Z_ESTRADO - 2.9]} castShadow receiveShadow>
      <boxGeometry args={[1.5, 1.24, 0.9]} />
      <meshStandardMaterial color={COR_CARVALHO} roughness={0.55} />
      <Edges threshold={20} color="#4a3721" />
    </mesh>
    <mesh position={[0, 1.28, Z_ESTRADO - 2.9]} castShadow>
      <boxGeometry args={[1.66, 0.08, 1.02]} />
      <meshStandardMaterial color={COR_TAMPO} roughness={0.45} />
    </mesh>

    {/* Pano de fundo da presidência, contra a parede */}
    <mesh position={[0, ALTURA_ESTRADO + 1.8, Z_ESTRADO + 1.7]} rotation={[0, Math.PI, 0]}>
      <planeGeometry args={[LARGURA_MESA + 1.6, 3.9]} />
      <meshStandardMaterial color={COR_CARVALHO_FUNDO} roughness={0.7} />
    </mesh>

    <Suspense fallback={null}>
      <ArmasDaRepublica />
    </Suspense>
  </group>
);

export const MesaPresidencia = memo(MesaPresidenciaComponent);
