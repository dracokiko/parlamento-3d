import { useRef, useState, memo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Edges } from '@react-three/drei';
import PropTypes from 'prop-types';
import { useParlamento } from '../../context/ParlamentoContext';
import { useIsTouch } from '../../hooks/useIsMobile';
import {
  calcularLugaresGoverno, distribuirPorFilas,
  ESPACO_LUGAR, ESPACO_FILA, SUBIDA_FILA, Z_PRIMEIRA_FILA, ALTURA_ESTRADO,
} from '../../utils/bancadaGoverno';

/** Sem cor de partido: o Governo não é um grupo parlamentar. Couro escuro e madeira. */
const COR_CADEIRA = '#2f3542';
const COR_CADEIRA_PM = '#1f2430';   // o lugar do Primeiro-Ministro, um tom mais fundo
const COR_TAMPO   = '#8b6f47';
const COR_FRENTE  = '#6f5637';
const COR_LATAO   = '#b08d3f';
const COR_DEGRAU  = '#a68a64';

const ehPrimeiroMinistro = (cargo = '') => /^(?:vice-)?primeiro-ministr/i.test(cargo);

/** Altura do tampo da secretária acima do estrado da fila. */
const ALTURA_SECRETARIA = 0.74;
/** Distância entre a cadeira e a secretária que tem à frente. */
const RECUO_SECRETARIA = 0.62;

/**
 * Uma cadeira da bancada: assento, encosto e costas altas.
 * Reage ao rato como os assentos dos deputados, para o gesto ser o mesmo.
 */
const CadeiraGoverno = ({ membro, position, rotation }) => {
  const meshRef = useRef();
  const escalaAlvo = useRef(new THREE.Vector3(1, 1, 1));
  const [hovered, setHovered] = useState(false);

  const { governanteSelecionado, governanteHover, selecionarGovernante, setGovernanteHover } = useParlamento();
  const isTouch = useIsTouch();

  const cor = ehPrimeiroMinistro(membro.cargo) ? COR_CADEIRA_PM : COR_CADEIRA;
  const estaSelecionado = governanteSelecionado?.nome === membro.nome;
  const estaEmPopup = isTouch && governanteHover?.nome === membro.nome;

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    if (estaSelecionado || estaEmPopup) {
      const pulse = Math.sin(clock.elapsedTime * 3) * 0.04 + 1.10;
      meshRef.current.scale.set(pulse, pulse, pulse);
    } else {
      const alvo = (!isTouch && hovered) ? 1.12 : 1;
      escalaAlvo.current.set(alvo, alvo, alvo);
      meshRef.current.scale.lerp(escalaAlvo.current, 0.15);
    }
  });

  const brilho = (estaSelecionado || estaEmPopup) ? 0.55 : (!isTouch && hovered) ? 0.3 : 0.04;

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
    if (isTouch && governanteHover?.nome !== membro.nome) setGovernanteHover(membro);
    else selecionarGovernante(membro);
  };

  const eventos = { onClick: handleClick, onPointerOver: handlePointerOver, onPointerOut: handlePointerOut };
  const material = (intensidade) => (
    <meshStandardMaterial color={cor} emissive={cor} emissiveIntensity={intensidade} roughness={0.42} metalness={0.12} />
  );

  return (
    <group position={position} rotation={rotation}>
      <group ref={meshRef}>
        {/* Assento */}
        <mesh {...eventos} position={[0, 0.42, 0.02]} castShadow receiveShadow>
          <boxGeometry args={[0.56, 0.10, 0.50]} />
          {material(brilho)}
          <Edges threshold={20} color="#11131a" />
        </mesh>

        {/* Encosto, ligeiramente reclinado */}
        <mesh {...eventos} position={[0, 0.78, -0.22]} rotation={[-0.12, 0, 0]} castShadow>
          <boxGeometry args={[0.56, 0.62, 0.09]} />
          {material(brilho * 0.8)}
          <Edges threshold={20} color="#11131a" />
        </mesh>

        {/* Pé central — evita a cadeira a flutuar sobre o degrau */}
        <mesh position={[0, 0.19, 0.02]} castShadow>
          <cylinderGeometry args={[0.07, 0.11, 0.38, 12]} />
          <meshStandardMaterial color="#3f4450" roughness={0.5} metalness={0.35} />
        </mesh>
      </group>
    </group>
  );
};

CadeiraGoverno.propTypes = {
  membro:   PropTypes.object.isRequired,
  position: PropTypes.array.isRequired,
  rotation: PropTypes.array.isRequired,
};

/** A secretária corrida de uma fila: tampo, frente e friso de latão. */
const SecretariaFila = ({ largura, y, z }) => (
  <group position={[0, y, z]}>
    <mesh position={[0, ALTURA_SECRETARIA, 0]} castShadow receiveShadow>
      <boxGeometry args={[largura, 0.07, 0.52]} />
      <meshStandardMaterial color={COR_TAMPO} roughness={0.45} metalness={0.05} />
      <Edges threshold={20} color="#4a3721" />
    </mesh>

    <mesh position={[0, ALTURA_SECRETARIA / 2 + 0.04, -0.22]} castShadow>
      <boxGeometry args={[largura, ALTURA_SECRETARIA - 0.08, 0.08]} />
      <meshStandardMaterial color={COR_FRENTE} roughness={0.6} />
    </mesh>

    {/* Friso, a apanhar a luz como o resto da talha da sala */}
    <mesh position={[0, ALTURA_SECRETARIA - 0.12, -0.27]}>
      <boxGeometry args={[largura, 0.04, 0.02]} />
      <meshStandardMaterial color={COR_LATAO} roughness={0.35} metalness={0.7} />
    </mesh>
  </group>
);

SecretariaFila.propTypes = { largura: PropTypes.number.isRequired, y: PropTypes.number.isRequired, z: PropTypes.number.isRequired };

/**
 * A bancada do Governo — na metade da sala que o hemiciclo deixa vazia, de
 * frente para os deputados.
 *
 * Em degraus, como as bancadas dos deputados: sem eles as filas de trás
 * ficavam escondidas atrás das da frente, e as cadeiras pareciam empilhadas
 * no ar. Cada fila tem a sua secretária corrida à frente.
 *
 * Quem lá senta são os membros do Governo que usaram da palavra em plenário,
 * derivados das intervenções — não há lista oficial na base, e quem está no
 * Governo não é deputado. Um ministro que nunca tenha falado não tem lugar
 * aqui: é uma bancada de quem falou, não a composição do Governo.
 */
const BancadaGovernoComponent = () => {
  const { membrosGoverno } = useParlamento();
  if (!membrosGoverno?.length) return null;

  const lugares = calcularLugaresGoverno(membrosGoverno.length);
  const filas = distribuirPorFilas(membrosGoverno.length);
  const larguraMaior = (Math.max(...filas) - 1) * ESPACO_LUGAR + 1.4;

  return (
    <group>
      {filas.map((nesta, fila) => {
        const alturaDegrau = ALTURA_ESTRADO + fila * SUBIDA_FILA;
        const zFila = Z_PRIMEIRA_FILA + fila * ESPACO_FILA;
        const larguraFila = (nesta - 1) * ESPACO_LUGAR + 1.4;

        return (
          <group key={`fila-governo-${fila}`}>
            {/* Degrau: nasce no chão e sobe até à fila, como as bancadas em frente */}
            <mesh position={[0, alturaDegrau / 2, zFila - 0.25]} receiveShadow castShadow>
              <boxGeometry args={[larguraMaior, alturaDegrau, ESPACO_FILA + 0.2]} />
              <meshStandardMaterial color={COR_DEGRAU} roughness={0.85} />
            </mesh>

            <SecretariaFila largura={larguraFila} y={alturaDegrau} z={zFila - RECUO_SECRETARIA} />
          </group>
        );
      })}

      {membrosGoverno.map((membro, i) => {
        const lugar = lugares[i];
        if (!lugar) return null;
        return (
          <CadeiraGoverno
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
