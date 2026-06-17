import { useRef, useState, memo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Edges } from '@react-three/drei';
import PropTypes from 'prop-types';
import { getCorPartido } from '../../data/mockPartidos';
import { useParlamento } from '../../context/ParlamentoContext';
import { useIsTouch } from '../../hooks/useIsMobile';

/**
 * Componente Assento — representa um deputado no hemiciclo 3D.
 *
 * Correção crítica: .lerp() exige um THREE.Vector3, não um objeto literal {x,y,z}.
 * Passar um objeto literal causa "Cannot read properties of undefined (reading 'label')"
 * dentro do reconciler do R3F.
 */
const AssentoComponent = ({ deputado, position, rotation, scale = 1 }) => {
  const meshRef = useRef();
  // Vector3 reutilizável como alvo da interpolação
  const escalaAlvo = useRef(new THREE.Vector3(1, 1, 1));
  const [hovered, setHovered] = useState(false);

  const {
    deputadoSelecionado,
    deputadoHover,
    partidoDestaque,
    selecionarDeputado,
    setDeputadoHover
  } = useParlamento();
  const isTouch = useIsTouch();

  const corBase = getCorPartido(deputado?.partido);
  const estaSelecionado = deputadoSelecionado?.id === deputado?.id;
  const estaEmPopup = isTouch && deputadoHover?.id === deputado?.id;
  const partidoEstaDestaque = partidoDestaque === null || partidoDestaque === deputado?.partido;

  useFrame(({ clock }) => {
    if (!meshRef.current) return;

    if (estaSelecionado || estaEmPopup) {
      // Touch: pulso mais amplo e escala maior para destacar bem num ecrã táctil
      const amp    = isTouch ? 0.10 : 0.05;
      const centro = isTouch ? 1.45 : 1.15;
      const speed  = isTouch ? 4    : 3;
      const pulse  = Math.sin(clock.elapsedTime * speed) * amp + centro;
      meshRef.current.scale.set(pulse, pulse, pulse);
    } else {
      // Em touch não há efeito de hover ao deslizar o dedo
      const alvo = (!isTouch && hovered) ? 1.25 : 1;
      escalaAlvo.current.set(alvo, alvo, alvo);
      meshRef.current.scale.lerp(escalaAlvo.current, 0.15);
    }
  });

  const opacity = partidoEstaDestaque ? 1 : 0.38;
  const emissiveIntensity = (estaSelecionado || estaEmPopup)
    ? (isTouch ? 1.0 : 0.8)
    : (!isTouch && hovered) ? 0.4 : (partidoEstaDestaque ? 0.05 : 0);

  const handlePointerOver = (e) => {
    e.stopPropagation();
    if (isTouch) return; // deslizar o dedo não faz nada em touch
    setHovered(true);
    setDeputadoHover(deputado);
    document.body.style.cursor = 'pointer';
  };

  const handlePointerOut = (e) => {
    e.stopPropagation();
    setHovered(false);
    // Em touch o tooltip persiste até clicar nele ou fora — não limpar aqui
    if (!isTouch) {
      setDeputadoHover(null);
      document.body.style.cursor = 'default';
    }
  };

  const handleClick = (e) => {
    e.stopPropagation();
    if (isTouch) {
      // 1.º toque: mostrar tooltip; a navegação acontece ao clicar no tooltip
      setDeputadoHover(deputado);
    } else {
      selecionarDeputado(deputado);
    }
  };

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* Grupo escalável — hover e select animam a cadeira inteira */}
      <group ref={meshRef}>
        {/* Assento (seat pad) */}
        <mesh
          onClick={handleClick}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
          position={[0, 0.18, 0.06]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[0.72, 0.12, 0.60]} />
          <meshStandardMaterial
            color={corBase}
            emissive={corBase}
            emissiveIntensity={emissiveIntensity}
            transparent
            opacity={opacity}
            roughness={0.45}
            metalness={0.1}
          />
          {partidoEstaDestaque && <Edges threshold={15} color="#000000" />}
        </mesh>

        {/* Encosto — ligeiramente inclinado para trás */}
        <mesh
          onClick={handleClick}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
          position={[0, 0.62, -0.21]}
          rotation={[-0.18, 0, 0]}
          castShadow
        >
          <boxGeometry args={[0.72, 0.60, 0.10]} />
          <meshStandardMaterial
            color={corBase}
            emissive={corBase}
            emissiveIntensity={emissiveIntensity * 0.7}
            transparent
            opacity={opacity * 0.9}
            roughness={0.5}
            metalness={0.08}
          />
          {partidoEstaDestaque && <Edges threshold={15} color="#000000" />}
        </mesh>
      </group>

    </group>
  );
};

AssentoComponent.propTypes = {
  deputado: PropTypes.shape({
    id:             PropTypes.number.isRequired,
    nome:           PropTypes.string,
    nomeAbrev:      PropTypes.string,
    partido:        PropTypes.string,
    circulo:        PropTypes.string,
    foto:           PropTypes.string,
    taxaPresenca:   PropTypes.number,
  }).isRequired,
  position: PropTypes.arrayOf(PropTypes.number).isRequired,
  rotation:  PropTypes.arrayOf(PropTypes.number).isRequired,
  scale:     PropTypes.number,
};

export const Assento = memo(AssentoComponent);