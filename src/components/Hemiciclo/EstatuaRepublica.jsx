import { memo } from 'react';
import PropTypes from 'prop-types';
import { Edges } from '@react-three/drei';

/**
 * A estátua da República, atrás da tribuna da Presidência.
 *
 * É uma peça real e identificada da sala: figura de corpo inteiro com uma
 * esfera armilar nas mãos, de Anjos Teixeira, 1916. Aqui é uma silhueta —
 * pedestal, manto, busto, cabeça e a esfera — e não uma escultura: com
 * geometria primitiva, tentar o rosto daria um boneco. O que se quer é que
 * se reconheça a figura de longe, no sítio onde ela está.
 */

const PEDRA        = '#cbbfa6';
const PEDRA_SOMBRA = '#b3a68c';
const BRONZE       = '#9c8b66';

const EstatuaRepublicaComponent = ({ position = [0, 0, 0], escala = 1 }) => (
  <group position={position} scale={escala}>
    {/* Pedestal, com plinto e cimalha */}
    <mesh position={[0, 0.07, 0]} castShadow receiveShadow>
      <boxGeometry args={[0.92, 0.14, 0.92]} />
      <meshStandardMaterial color={PEDRA_SOMBRA} roughness={0.85} />
      <Edges threshold={30} color="#8c8069" />
    </mesh>
    <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
      <boxGeometry args={[0.74, 0.72, 0.74]} />
      <meshStandardMaterial color={PEDRA} roughness={0.82} />
      <Edges threshold={30} color="#8c8069" />
    </mesh>
    <mesh position={[0, 0.9, 0]} castShadow>
      <boxGeometry args={[0.88, 0.1, 0.88]} />
      <meshStandardMaterial color={PEDRA_SOMBRA} roughness={0.85} />
    </mesh>

    {/* Manto: um tronco de cone, mais largo em baixo */}
    <mesh position={[0, 1.52, 0]} castShadow>
      <cylinderGeometry args={[0.2, 0.36, 1.14, 18]} />
      <meshStandardMaterial color={BRONZE} roughness={0.7} metalness={0.25} />
    </mesh>

    {/* Busto e ombros */}
    <mesh position={[0, 2.14, 0]} castShadow>
      <sphereGeometry args={[0.21, 16, 12]} />
      <meshStandardMaterial color={BRONZE} roughness={0.68} metalness={0.28} />
    </mesh>

    {/* Cabeça */}
    <mesh position={[0, 2.42, 0]} castShadow>
      <sphereGeometry args={[0.13, 16, 12]} />
      <meshStandardMaterial color={BRONZE} roughness={0.66} metalness={0.3} />
    </mesh>

    {/* Braços a segurar a esfera, à frente do peito */}
    {[-1, 1].map((lado) => (
      <mesh key={`braco-${lado}`} position={[lado * 0.16, 2.06, 0.14]} rotation={[0.5, 0, lado * 0.25]} castShadow>
        <cylinderGeometry args={[0.045, 0.05, 0.46, 10]} />
        <meshStandardMaterial color={BRONZE} roughness={0.68} metalness={0.28} />
      </mesh>
    ))}

    {/* Esfera armilar: o globo e os seus anéis */}
    <group position={[0, 1.96, 0.3]}>
      <mesh castShadow>
        <sphereGeometry args={[0.15, 16, 12]} />
        <meshStandardMaterial color={BRONZE} roughness={0.5} metalness={0.5} />
      </mesh>
      {[[0, 0, 0], [Math.PI / 2, 0, 0], [0, 0, Math.PI / 2.6]].map((rot, i) => (
        <mesh key={`anel-${i}`} rotation={rot}>
          <torusGeometry args={[0.19, 0.014, 8, 28]} />
          <meshStandardMaterial color="#b08d3f" roughness={0.35} metalness={0.8} />
        </mesh>
      ))}
    </group>
  </group>
);

EstatuaRepublicaComponent.propTypes = {
  position: PropTypes.array,
  escala: PropTypes.number,
};

export const EstatuaRepublica = memo(EstatuaRepublicaComponent);
