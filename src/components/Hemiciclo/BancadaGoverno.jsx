import { useRef, useState, memo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Edges } from '@react-three/drei';
import PropTypes from 'prop-types';
import { useParlamento } from '../../context/ParlamentoContext';
import { useIsTouch } from '../../hooks/useIsMobile';
import {
  calcularLugaresGoverno, distribuirPorFilas,
  ESPACO_LUGAR, ESPACO_FILA, SUBIDA_FILA, Z_PRIMEIRA_FILA, ALTURA_ESTRADO, CORREDOR,
} from '../../utils/bancadaGoverno';
import { FrenteAlmofadada, TampoComPala, Microfone } from './Mobiliario';

/**
 * Couro verde-salva e nogueira, que é a madeira das carteiras da sala
 * (nogueira trabalhada ao estilo inglês). Sem cor de partido — o Governo não
 * é um grupo parlamentar. Claro o suficiente para se distinguir da madeira
 * à distância: o verde-garrafa anterior, contra a nogueira e com a sala em
 * contraluz, voltava a ler-se como uma mancha escura.
 */
const COR_CADEIRA    = '#6f9c85';
const COR_CADEIRA_PM = '#5c8872';   // o lugar do Primeiro-Ministro, um tom mais fundo
const COR_MADEIRA    = '#5b3a24';   // nogueira
const COR_TAMPO      = '#6b462b';
const COR_FRENTE     = '#4c3020';
const COR_LATAO      = '#b08d3f';
const COR_DEGRAU     = '#7a5536';
const COR_PALA       = '#6d2233';   // bordeaux do balcão, distinto do estofo

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
        {/* Almofada do assento, com debrum de madeira em redor */}
        <mesh {...eventos} position={[0, 0.44, 0.02]} castShadow receiveShadow>
          <boxGeometry args={[0.50, 0.11, 0.46]} />
          {material(brilho)}
        </mesh>
        <mesh position={[0, 0.39, 0.02]} castShadow>
          <boxGeometry args={[0.56, 0.07, 0.52]} />
          <meshStandardMaterial color={COR_MADEIRA} roughness={0.55} />
          <Edges threshold={25} color="#2e1c10" />
        </mesh>

        {/* Encosto reclinado, com remate arredondado em cima */}
        <mesh {...eventos} position={[0, 0.76, -0.21]} rotation={[-0.12, 0, 0]} castShadow>
          <boxGeometry args={[0.50, 0.56, 0.09]} />
          {material(brilho * 0.8)}
        </mesh>
        <mesh position={[0, 1.03, -0.245]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.055, 0.055, 0.50, 10]} />
          <meshStandardMaterial color={COR_MADEIRA} roughness={0.5} />
        </mesh>

        {/* Braços */}
        {[-1, 1].map((lado) => (
          <mesh key={`braco-${lado}`} position={[lado * 0.29, 0.62, 0.0]} castShadow>
            <boxGeometry args={[0.05, 0.05, 0.40]} />
            <meshStandardMaterial color={COR_MADEIRA} roughness={0.5} />
          </mesh>
        ))}

        {/* Pé central */}
        <mesh position={[0, 0.19, 0.02]} castShadow>
          <cylinderGeometry args={[0.06, 0.10, 0.38, 12]} />
          <meshStandardMaterial color="#3a2a1c" roughness={0.5} metalness={0.25} />
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

/**
 * A secretária corrida de uma fila: tampo com pala de couro, frente
 * almofadada virada para os deputados, e um microfone por lugar.
 */
const SecretariaFila = ({ largura, x, y, z, lugares = [] }) => (
  <group position={[x, y, z]}>
    <group position={[0, ALTURA_SECRETARIA, 0]}>
      {/* Pala em bordeaux e não no verde das cadeiras: com a mesma cor, o
          balcão e quem lá se senta liam-se como uma peça só. */}
      <TampoComPala largura={largura} profundidade={0.52} corMadeira={COR_TAMPO} corPala={COR_PALA} />
    </group>

    <group position={[0, ALTURA_SECRETARIA / 2 + 0.04, -0.26]}>
      <FrenteAlmofadada
        largura={largura}
        altura={ALTURA_SECRETARIA - 0.08}
        painéis={Math.max(1, Math.round(largura / 1.2))}
        cor={COR_MADEIRA}
        corFundo={COR_FRENTE}
        friso={COR_LATAO}
      />
    </group>

    {lugares.map((dx, i) => (
      <Microfone key={`mic-${i}`} position={[dx, ALTURA_SECRETARIA + 0.05, 0.12]} escala={0.85} />
    ))}
  </group>
);

SecretariaFila.propTypes = { largura: PropTypes.number.isRequired, x: PropTypes.number.isRequired, y: PropTypes.number.isRequired, z: PropTypes.number.isRequired, lugares: PropTypes.array };

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
  const { bancadaGoverno: membrosGoverno } = useParlamento();
  if (!membrosGoverno?.length) return null;

  const lugares = calcularLugaresGoverno(membrosGoverno.length);
  const filas = distribuirPorFilas(membrosGoverno.length);
  const larguraMaior = (Math.max(...filas) - 1) * ESPACO_LUGAR + CORREDOR + 1.4;

  return (
    <group>
      {filas.map((nesta, fila) => {
        const alturaDegrau = ALTURA_ESTRADO + fila * SUBIDA_FILA;
        const zFila = Z_PRIMEIRA_FILA + fila * ESPACO_FILA;
        // A secretária parte-se em duas ao corredor central, como os lugares,
        // e cada troço vai do corredor até ao último lugar do seu lado.
        const metade = Math.ceil(nesta / 2);
        const extremo = (quantos) => CORREDOR / 2 + (quantos - 0.5) * ESPACO_LUGAR;
        const troços = [
          { de: -extremo(metade), ate: -(CORREDOR / 2 + ESPACO_LUGAR / 2) },
          { de: CORREDOR / 2 + ESPACO_LUGAR / 2, ate: extremo(nesta - metade) },
        ].filter(t => t.ate >= t.de);

        return (
          <group key={`fila-governo-${fila}`}>
            {/* Degrau: nasce no chão e sobe até à fila, como as bancadas em
                frente. Em dois blocos, para o corredor central ficar ao
                nível do piso — é por lá que se passa, e é lá que assenta a
                passadeira que leva à escadaria da Mesa. */}
            {[-1, 1].map((lado) => {
              const largura = (larguraMaior - CORREDOR) / 2;
              return (
                <mesh
                  key={`degrau-${fila}-${lado}`}
                  position={[lado * (CORREDOR / 2 + largura / 2), alturaDegrau / 2, zFila - 0.25]}
                  receiveShadow
                  castShadow
                >
                  <boxGeometry args={[largura, alturaDegrau, ESPACO_FILA + 0.2]} />
                  <meshStandardMaterial color={COR_DEGRAU} roughness={0.85} />
                  <Edges threshold={30} color="#5b4227" />
                </mesh>
              );
            })}

            {troços.map((t, i) => {
              const centro = (t.de + t.ate) / 2;
              // Um microfone à frente de cada lugar do troço.
              const lugares = [];
              for (let x = t.de; x <= t.ate + 0.01; x += ESPACO_LUGAR) lugares.push(x - centro);
              return (
                <SecretariaFila
                  key={`secretaria-${fila}-${i}`}
                  largura={t.ate - t.de + 0.95}
                  x={centro}
                  y={alturaDegrau}
                  z={zFila - RECUO_SECRETARIA}
                  lugares={lugares}
                />
              );
            })}
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
