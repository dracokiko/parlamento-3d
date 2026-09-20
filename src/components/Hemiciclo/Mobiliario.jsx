import PropTypes from 'prop-types';
import { Edges } from '@react-three/drei';

/**
 * Peças de marcenaria reutilizadas pela Mesa, pela tribuna e pela bancada do
 * Governo.
 *
 * O mobiliário da sala era caixas lisas: uma frente de madeira é uma frente
 * de madeira, e à distância lê-se como um bloco. O que dá leitura a uma peça
 * de carpintaria é o relevo — painéis almofadados, frisos a apanhar a luz e
 * os pequenos objectos que se sabe que lá estão (microfones). É tudo
 * geometria barata: caixas finas sobrepostas, sem texturas nem modelos.
 */

export const NOGUEIRA        = '#5b3a24';
export const NOGUEIRA_CLARA  = '#6b462b';
export const NOGUEIRA_ESCURA = '#432a18';
export const LATAO           = '#b08d3f';
export const BORDEAUX        = '#6d2233';
export const BORDEAUX_FUNDO  = '#571a28';

/**
 * Frente almofadada: o pano de fundo, uma moldura saliente em cada painel e
 * o fundo rebaixado lá dentro. Dois frisos, em cima e em baixo, a fechar.
 */
export const FrenteAlmofadada = ({ largura, altura, painéis = 3, cor = NOGUEIRA, corFundo = NOGUEIRA_ESCURA, friso = LATAO }) => {
  const margem = Math.min(0.16, largura * 0.04);
  const passo = (largura - margem * 2) / painéis;
  const larguraPainel = passo * 0.86;
  const alturaPainel = Math.max(altura - 0.26, 0.12);

  return (
    <group>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[largura, altura, 0.1]} />
        <meshStandardMaterial color={cor} roughness={0.55} />
        <Edges threshold={25} color="#2e1c10" />
      </mesh>

      {Array.from({ length: painéis }).map((_, i) => {
        const x = -largura / 2 + margem + passo * (i + 0.5);
        return (
          <group key={`painel-${i}`} position={[x, 0, 0.055]}>
            {/* Moldura saliente */}
            <mesh castShadow>
              <boxGeometry args={[larguraPainel, alturaPainel, 0.03]} />
              <meshStandardMaterial color={cor} roughness={0.5} />
            </mesh>
            {/* Fundo rebaixado, mais escuro: é a sombra que desenha o painel */}
            <mesh position={[0, 0, 0.005]}>
              <boxGeometry args={[larguraPainel - 0.12, alturaPainel - 0.12, 0.03]} />
              <meshStandardMaterial color={corFundo} roughness={0.65} />
            </mesh>
          </group>
        );
      })}

      {[altura / 2 - 0.05, -altura / 2 + 0.05].map((y, i) => (
        <mesh key={`friso-${i}`} position={[0, y, 0.062]}>
          <boxGeometry args={[largura, 0.035, 0.02]} />
          <meshStandardMaterial color={friso} roughness={0.3} metalness={0.75} />
        </mesh>
      ))}
    </group>
  );
};

FrenteAlmofadada.propTypes = {
  largura: PropTypes.number.isRequired,
  altura: PropTypes.number.isRequired,
  painéis: PropTypes.number,
  cor: PropTypes.string,
  corFundo: PropTypes.string,
  friso: PropTypes.string,
};

/** Tampo com pala de couro embutida e bordo em madeira. */
export const TampoComPala = ({ largura, profundidade, corMadeira = NOGUEIRA_CLARA, corPala = '#27443a' }) => (
  <group>
    <mesh castShadow receiveShadow>
      <boxGeometry args={[largura, 0.08, profundidade]} />
      <meshStandardMaterial color={corMadeira} roughness={0.42} />
      <Edges threshold={25} color="#2e1c10" />
    </mesh>
    <mesh position={[0, 0.043, 0]}>
      <boxGeometry args={[largura - 0.22, 0.008, profundidade - 0.18]} />
      <meshStandardMaterial color={corPala} roughness={0.6} />
    </mesh>
  </group>
);

TampoComPala.propTypes = {
  largura: PropTypes.number.isRequired,
  profundidade: PropTypes.number.isRequired,
  corMadeira: PropTypes.string,
  corPala: PropTypes.string,
};

/** Microfone de haste, virado para quem se senta. */
export const Microfone = ({ position = [0, 0, 0], rotation = [0, 0, 0], escala = 1 }) => (
  <group position={position} rotation={rotation} scale={escala}>
    <mesh castShadow>
      <cylinderGeometry args={[0.055, 0.065, 0.02, 14]} />
      <meshStandardMaterial color="#26262a" roughness={0.45} metalness={0.5} />
    </mesh>
    <mesh position={[0, 0.11, -0.03]} rotation={[0.3, 0, 0]} castShadow>
      <cylinderGeometry args={[0.008, 0.008, 0.22, 8]} />
      <meshStandardMaterial color="#3a3a40" roughness={0.4} metalness={0.6} />
    </mesh>
    <mesh position={[0, 0.215, -0.09]}>
      <sphereGeometry args={[0.022, 10, 10]} />
      <meshStandardMaterial color="#1d1d20" roughness={0.6} metalness={0.3} />
    </mesh>
  </group>
);

Microfone.propTypes = {
  position: PropTypes.array,
  rotation: PropTypes.array,
  escala: PropTypes.number,
};

/**
 * Cadeira estofada com estrutura de madeira.
 *
 * `altura` levanta o espaldar (a do Presidente é mais alta que a dos
 * Secretários) e `coroa` acrescenta o remate dourado no topo.
 */
export const CadeiraEstofada = ({
  position = [0, 0, 0], rotation = [0, 0, 0],
  cor = BORDEAUX, corFundo = BORDEAUX_FUNDO, madeira = NOGUEIRA,
  altura = 0.85, coroa = false, eventos = {},
}) => (
  <group position={position} rotation={rotation}>
    {/* Assento: almofada sobre uma base de madeira */}
    <mesh {...eventos} position={[0, 0.44, 0]} castShadow receiveShadow>
      <boxGeometry args={[0.52, 0.12, 0.48]} />
      <meshStandardMaterial color={cor} roughness={0.55} />
    </mesh>
    <mesh position={[0, 0.37, 0]} castShadow>
      <boxGeometry args={[0.58, 0.08, 0.54]} />
      <meshStandardMaterial color={madeira} roughness={0.5} />
      <Edges threshold={25} color="#2e1c10" />
    </mesh>

    {/* Espaldar: moldura de madeira com almofada embutida */}
    <group position={[0, 0.5 + altura / 2, -0.22]} rotation={[-0.1, 0, 0]}>
      <mesh castShadow>
        <boxGeometry args={[0.58, altura, 0.07]} />
        <meshStandardMaterial color={madeira} roughness={0.5} />
        <Edges threshold={25} color="#2e1c10" />
      </mesh>
      <mesh {...eventos} position={[0, 0, 0.045]}>
        <boxGeometry args={[0.46, altura - 0.14, 0.05]} />
        <meshStandardMaterial color={cor} roughness={0.55} />
      </mesh>
      <mesh position={[0, 0, 0.05]}>
        <boxGeometry args={[0.36, altura - 0.26, 0.04]} />
        <meshStandardMaterial color={corFundo} roughness={0.6} />
      </mesh>
      {coroa && (
        <mesh position={[0, altura / 2 + 0.04, 0.01]}>
          <boxGeometry args={[0.6, 0.07, 0.09]} />
          <meshStandardMaterial color={LATAO} roughness={0.28} metalness={0.8} />
        </mesh>
      )}
    </group>

    {/* Braços torneados */}
    {[-1, 1].map((lado) => (
      <group key={`braco-${lado}`}>
        <mesh position={[lado * 0.3, 0.63, -0.02]} castShadow>
          <boxGeometry args={[0.055, 0.05, 0.42]} />
          <meshStandardMaterial color={madeira} roughness={0.45} />
        </mesh>
        <mesh position={[lado * 0.3, 0.53, 0.16]} castShadow>
          <cylinderGeometry args={[0.028, 0.028, 0.2, 8]} />
          <meshStandardMaterial color={madeira} roughness={0.45} />
        </mesh>
      </group>
    ))}

    {/* Pés */}
    {[[-0.22, 0.2], [0.22, 0.2], [-0.22, -0.2], [0.22, -0.2]].map(([x, z], i) => (
      <mesh key={`pe-${i}`} position={[x, 0.17, z]} castShadow>
        <cylinderGeometry args={[0.028, 0.038, 0.34, 8]} />
        <meshStandardMaterial color={madeira} roughness={0.5} />
      </mesh>
    ))}
  </group>
);

CadeiraEstofada.propTypes = {
  position: PropTypes.array,
  rotation: PropTypes.array,
  cor: PropTypes.string,
  corFundo: PropTypes.string,
  madeira: PropTypes.string,
  altura: PropTypes.number,
  coroa: PropTypes.bool,
  eventos: PropTypes.object,
};
