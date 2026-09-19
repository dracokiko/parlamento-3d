import { useRef, useState, memo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Edges } from '@react-three/drei';
import PropTypes from 'prop-types';
import { useParlamento } from '../../context/ParlamentoContext';
import { useIsTouch } from '../../hooks/useIsMobile';
import { calcularLugaresGoverno, ESPACO_LUGAR, ESPACO_FILA, Z_PRIMEIRA_FILA, ALTURA_ESTRADO, distribuirPorFilas } from '../../utils/bancadaGoverno';

/** Cinzento institucional: o Governo não é um grupo parlamentar e não tem cor de partido. */
const COR_BANCADA = '#6b7280';
const COR_PRIMEIRO_MINISTRO = '#4b5563';

const ehPrimeiroMinistro = (cargo = '') => /^(?:vice-)?primeiro-ministr/i.test(cargo);

/** Uma cadeira da bancada. Mesma linguagem visual dos assentos, sem cor de partido. */
const LugarGoverno = ({ membro, position, rotation }) => {
  const meshRef = useRef();
  const escalaAlvo = useRef(new THREE.Vector3(1, 1, 1));
  const [hovered, setHovered] = useState(false);

  const { governanteSelecionado, governanteHover, selecionarGovernante, setGovernanteHover } = useParlamento();
  const isTouch = useIsTouch();

  const cor = ehPrimeiroMinistro(membro.cargo) ? COR_PRIMEIRO_MINISTRO : COR_BANCADA;
  const estaSelecionado = governanteSelecionado?.nome === membro.nome;
  const estaEmPopup = isTouch && governanteHover?.nome === membro.nome;

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    if (estaSelecionado || estaEmPopup) {
      const pulse = Math.sin(clock.elapsedTime * 3) * 0.05 + 1.15;
      meshRef.current.scale.set(pulse, pulse, pulse);
    } else {
      const alvo = (!isTouch && hovered) ? 1.25 : 1;
      escalaAlvo.current.set(alvo, alvo, alvo);
      meshRef.current.scale.lerp(escalaAlvo.current, 0.15);
    }
  });

  const emissiveIntensity = (estaSelecionado || estaEmPopup) ? 0.8 : (!isTouch && hovered) ? 0.4 : 0.05;

  const handlePointerOver = (e) => {
    e.stopPropagation();
    if (isTouch) return;
    setHovered(true);
    setGovernanteHover(membro);
    document.body.style.cursor = 'pointer';
  };

  const handlePointerOut = (e) => {
    e.stopPropagation();
    setHovered(false);
    if (!isTouch) {
      setGovernanteHover(null);
      document.body.style.cursor = 'default';
    }
  };

  const handleClick = (e) => {
    e.stopPropagation();
    // Em touch, o primeiro toque mostra quem é; o segundo abre o painel.
    if (isTouch && governanteHover?.nome !== membro.nome) setGovernanteHover(membro);
    else selecionarGovernante(membro);
  };

  const eventos = { onClick: handleClick, onPointerOver: handlePointerOver, onPointerOut: handlePointerOut };

  return (
    <group position={position} rotation={rotation}>
      <group ref={meshRef}>
        <mesh {...eventos} position={[0, 0.18, 0.06]} castShadow receiveShadow>
          <boxGeometry args={[0.72, 0.12, 0.60]} />
          <meshStandardMaterial color={cor} emissive={cor} emissiveIntensity={emissiveIntensity} roughness={0.45} metalness={0.1} />
          <Edges threshold={15} color="#000000" />
        </mesh>
        <mesh {...eventos} position={[0, 0.62, -0.21]} rotation={[-0.18, 0, 0]} castShadow>
          <boxGeometry args={[0.72, 0.60, 0.10]} />
          <meshStandardMaterial color={cor} emissive={cor} emissiveIntensity={emissiveIntensity * 0.7} roughness={0.5} />
        </mesh>
      </group>
    </group>
  );
};

LugarGoverno.propTypes = {
  membro:   PropTypes.object.isRequired,
  position: PropTypes.array.isRequired,
  rotation: PropTypes.array.isRequired,
};

/**
 * A bancada do Governo — na metade da sala que o hemiciclo deixa vazia (Z
 * positivo), de frente para os deputados.
 *
 * Quem lá senta são os membros do Governo que usaram da palavra em plenário,
 * derivados das intervenções: não há lista oficial na base de dados, e quem
 * está no Governo não é deputado (suspende o mandato). Um ministro que nunca
 * tenha falado não tem lugar aqui — é uma bancada de quem falou, não a
 * composição do Governo.
 */
const BancadaGovernoComponent = () => {
  const { membrosGoverno } = useParlamento();
  if (!membrosGoverno?.length) return null;

  const lugares = calcularLugaresGoverno(membrosGoverno.length);
  const filas = distribuirPorFilas(membrosGoverno.length);
  const larguraMaior = (Math.max(...filas) - 1) * ESPACO_LUGAR + 1.6;
  const profundidade = (filas.length - 1) * ESPACO_FILA + 1.8;
  const zCentro = Z_PRIMEIRA_FILA + ((filas.length - 1) * ESPACO_FILA) / 2;

  return (
    <group>
      {/* Estrado, para a bancada assentar em algo e não flutuar sobre o chão.
          Em tom de madeira, como o resto do piso: a branco lia-se como uma
          laje pousada em cima da sala. */}
      <mesh position={[0, ALTURA_ESTRADO / 2, zCentro]} receiveShadow castShadow>
        <boxGeometry args={[larguraMaior, ALTURA_ESTRADO, profundidade]} />
        <meshStandardMaterial color="#a68a64" roughness={0.85} />
      </mesh>

      {membrosGoverno.map((membro, i) => {
        const lugar = lugares[i];
        if (!lugar) return null;
        return (
          <LugarGoverno
            key={membro.nome}
            membro={membro}
            position={lugar.position}
            rotation={lugar.rotation}
          />
        );
      })}
    </group>
  );
};

export const BancadaGoverno = memo(BancadaGovernoComponent);
