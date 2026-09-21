import { memo, Suspense } from 'react';
import { useTexture, Edges } from '@react-three/drei';
import { useParlamento } from '../../context/ParlamentoContext';
import { EstatuaRepublica } from './EstatuaRepublica';
import { FrenteAlmofadada, TampoComPala, Microfone, CadeiraEstofada, BORDEAUX_FUNDO } from './Mobiliario';

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
/**
 * O pano de fundo da presidência era castanho-escuro e ocupava toda a
 * largura: à distância lia-se como um muro, e era a mancha mais pesada da
 * sala. Em madeira clara acompanha o estuque das paredes e deixa respirar o
 * que está à frente.
 */
const COR_PANO     = '#b39466';
const VAO_ESTATUA  = 2.3;
const LARGURA_PANO = (9 + 1.6 - VAO_ESTATUA) / 2;

const Z_ESTRADO = 5.6;   // encostado à bancada: a 7,2 sobravam 4 m de chão vazio pelo meio
const ALTURA_ESTRADO = 1.8;
const LARGURA_MESA = 9;
/** O púlpito fica à frente de tudo, no piso do plenário e virado para os deputados. */
const Z_PULPITO = -0.6;

/** Escadaria central de acesso à Mesa, no eixo do corredor da bancada. */
const DEGRAUS        = 4;
const FUNDO_DEGRAU   = 0.34;
const Z_PE_ESCADA    = Z_ESTRADO - 1.6 - DEGRAUS * FUNDO_DEGRAU;
const COR_PASSADEIRA = '#6d2233';
const COR_LATAO_MESA = '#b08d3f';

const ArmasDaRepublica = () => {
  const armas = useTexture('/Coat_of_arms_of_the_Assembly_of_the_Portuguese_Republic.svg.png');
  return (
    <mesh position={[0, ALTURA_ESTRADO + 3.05, Z_ESTRADO + 1.62]} rotation={[0, Math.PI, 0]}>
      <planeGeometry args={[1.75, 1.75]} />
      <meshStandardMaterial map={armas} transparent alphaTest={0.05} roughness={0.5} />
    </mesh>
  );
};

/**
 * Quem se senta à Mesa, com os nomes reais.
 *
 * O Regimento é explícito: nas reuniões plenárias a Mesa é constituída pelo
 * Presidente da Assembleia e pelos Secretários. Os Vice-Presidentes assumem a
 * cadeira quando o Presidente não preside — não se sentam lá ao lado dele — e
 * os Vice-Secretários substituem os Secretários nas faltas. Por isso só estes
 * dois cargos aparecem.
 *
 * O Presidente ao centro, com cadeira mais alta, e os Secretários a
 * distribuir-se dois para cada lado. A ordem entre eles não está fixada em
 * lado nenhum que eu tenha encontrado: fica a alfabética, que é a que os
 * dados da AR dão.
 *
 * Clicar num lugar abre o perfil do deputado, porque é isso que eles são.
 */
const LugaresDaMesa = () => {
  const { mesaAR, deputados, selecionarDeputado, setMesaHover } = useParlamento();

  const presidente = mesaAR?.presidente;
  const secretarios = mesaAR?.secretarios ?? [];
  if (!presidente && !secretarios.length) return null;

  // Presidente ao centro (0); secretários a alternar para cada lado.
  const lados = [-1, 1, -2, 2];
  const ocupantes = [
    { membro: presidente, x: 0, presidencial: true },
    ...secretarios.slice(0, 4).map((s, i) => ({ membro: s, x: (lados[i] ?? 0) * 1.75, presidencial: false })),
  ].filter(o => o.membro);

  const deputadoDe = (membro) =>
    deputados.find(d => d.nomeAbrev === membro.nome || d.nome === membro.nome) ?? null;

  const abrirPerfil = (membro) => {
    const dep = deputadoDe(membro);
    if (dep) selecionarDeputado(dep);
  };

  return (
    <group>
      {ocupantes.map(({ membro, x, presidencial }) => (
        <group
          key={`lugar-mesa-${membro.nome}`}
          position={[x, ALTURA_ESTRADO, Z_ESTRADO + 0.15]}
          onClick={(e) => { e.stopPropagation(); abrirPerfil(membro); }}
          /* Cartão próprio, pequeno e encostado ao canto (ver CartaoMesa):
             o cartão dos deputados abre ao centro do ecrã, que é onde a
             Mesa está — bastava passar por cima para tapar a vista. */
          onPointerOver={(e) => {
            e.stopPropagation();
            setMesaHover({ ...membro, deputado: deputadoDe(membro) });
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={(e) => {
            e.stopPropagation();
            setMesaHover(null);
            document.body.style.cursor = 'default';
          }}
        >
          {/* Bordeaux, como o estofo da sala; o Presidente com espaldar mais
              alto e remate dourado. Viradas para os deputados (+Z é a
              bancada, por isso rodam meia volta). */}
          <CadeiraEstofada
            rotation={[0, Math.PI, 0]}
            altura={presidencial ? 1.15 : 0.82}
            coroa={presidencial}
          />
        </group>
      ))}
    </group>
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

    {/* Frente do estrado, almofadada como o resto da marcenaria: era uma
        face lisa de quase dois metros, a maior mancha cega da sala. */}
    <group position={[0, ALTURA_ESTRADO / 2, Z_ESTRADO - 1.66]}>
      <FrenteAlmofadada largura={LARGURA_MESA + 2.4} altura={ALTURA_ESTRADO - 0.12} painéis={7} cor={COR_CARVALHO} />
    </group>

    {/* Degraus laterais de acesso */}
    {[-1, 1].map((lado) => (
      <mesh key={`degrau-mesa-${lado}`} position={[lado * (LARGURA_MESA / 2 + 1.6), ALTURA_ESTRADO / 4, Z_ESTRADO - 0.4]} receiveShadow>
        <boxGeometry args={[1.2, ALTURA_ESTRADO / 2, 2.4]} />
        <meshStandardMaterial color={COR_CARVALHO_FUNDO} roughness={0.75} />
      </mesh>
    ))}

    {/* Escadaria central, alinhada com o corredor da bancada: é ela que liga
        o piso do plenário à Mesa e fecha o vazio que ficava pelo meio. */}
    {Array.from({ length: DEGRAUS }).map((_, i) => {
      const altura = (ALTURA_ESTRADO / DEGRAUS) * (i + 1);
      const z = Z_ESTRADO - 1.6 - (DEGRAUS - i - 0.5) * FUNDO_DEGRAU;
      return (
        <group key={`degrau-central-${i}`}>
          <mesh position={[0, altura / 2, z]} receiveShadow castShadow>
            <boxGeometry args={[2.6, altura, FUNDO_DEGRAU]} />
            <meshStandardMaterial color={COR_CARVALHO_FUNDO} roughness={0.7} />
            <Edges threshold={25} color="#4a3721" />
          </mesh>
          {/* Focinho dourado a marcar o degrau, e passadeira por cima */}
          <mesh position={[0, altura + 0.014, z - FUNDO_DEGRAU / 2 + 0.04]}>
            <boxGeometry args={[2.6, 0.03, 0.07]} />
            <meshStandardMaterial color={COR_LATAO_MESA} roughness={0.35} metalness={0.7} />
          </mesh>
          <mesh position={[0, altura + 0.016, z]}>
            <boxGeometry args={[1.5, 0.014, FUNDO_DEGRAU - 0.08]} />
            <meshStandardMaterial color={COR_PASSADEIRA} roughness={0.85} />
          </mesh>
        </group>
      );
    })}

    {/* Passadeira no piso, do púlpito à escadaria: é por este eixo que se
        sobe à tribuna, e é o que dá uso ao chão que estava vazio. */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, (Z_PULPITO + Z_PE_ESCADA) / 2]}>
      <planeGeometry args={[1.5, Z_PE_ESCADA - Z_PULPITO]} />
      <meshStandardMaterial color={COR_PASSADEIRA} roughness={0.88} />
    </mesh>

    {/* Frente da Mesa, almofadada */}
    <group position={[0, ALTURA_ESTRADO + 0.54, Z_ESTRADO - 1.24]}>
      <FrenteAlmofadada largura={LARGURA_MESA} altura={1.08} painéis={5} />
    </group>

    {/* Tampo com pala de couro */}
    <group position={[0, ALTURA_ESTRADO + 1.07, Z_ESTRADO - 0.75]}>
      <TampoComPala largura={LARGURA_MESA} profundidade={1.2} corPala={BORDEAUX_FUNDO} />
    </group>

    {/* Um microfone por lugar da Mesa */}
    {[-3.5, -1.75, 0, 1.75, 3.5].map((x) => (
      <Microfone key={`mic-mesa-${x}`} position={[x, ALTURA_ESTRADO + 1.12, Z_ESTRADO - 1.05]} rotation={[0, Math.PI, 0]} />
    ))}

    {/* Presidente ao centro, Secretários de cada lado — ver LugaresDaMesa */}
    <LugaresDaMesa />

    {/* Secretárias dos estenógrafos, ao nível do chão à frente do estrado —
        é um dos elementos próprios da sala, entre a Mesa e o púlpito. */}
    {[-1, 1].map((lado) => (
      <group key={`estenografo-${lado}`} position={[lado * 2.6, 0, Z_ESTRADO - 2.0]}>
        <mesh position={[0, 0.36, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.7, 0.72, 0.6]} />
          <meshStandardMaterial color={COR_CARVALHO_FUNDO} roughness={0.65} />
        </mesh>
        <group position={[0, 0.4, -0.32]}>
          <FrenteAlmofadada largura={1.7} altura={0.62} painéis={2} />
        </group>
        <group position={[0, 0.75, 0]}>
          <TampoComPala largura={1.8} profundidade={0.7} />
        </group>
        <Microfone position={[0, 0.8, -0.18]} rotation={[0, Math.PI, 0]} escala={0.85} />
      </group>
    ))}

    {/* Tribuna do orador, à frente e abaixo da Mesa */}
    <mesh position={[0, 0.62, Z_PULPITO]} castShadow receiveShadow>
      <boxGeometry args={[1.5, 1.24, 0.9]} />
      <meshStandardMaterial color={COR_CARVALHO} roughness={0.55} />
      <Edges threshold={20} color="#4a3721" />
    </mesh>
    {/* As quatro faces almofadadas, para o púlpito não ser um caixote */}
    {[[0, -0.46, 0], [0, 0.46, Math.PI], [-0.76, 0, -Math.PI / 2], [0.76, 0, Math.PI / 2]].map(([dx, dz, ry], i) => (
      <group key={`face-pulpito-${i}`} position={[dx, 0.66, Z_PULPITO + dz]} rotation={[0, ry, 0]}>
        <FrenteAlmofadada largura={i < 2 ? 1.44 : 0.84} altura={1.06} painéis={i < 2 ? 2 : 1} />
      </group>
    ))}
    <group position={[0, 1.28, Z_PULPITO]}>
      <TampoComPala largura={1.66} profundidade={1.02} corPala={BORDEAUX_FUNDO} />
    </group>
    <Microfone position={[0, 1.33, Z_PULPITO - 0.26]} />

    {/* Pano de fundo da presidência, em dois panos com um vão ao meio.
        O vão é o nicho da estátua da República, que na sala está atrás da
        tribuna da Presidência — e é ele que justifica partir o pano em dois
        em vez de uma parede corrida. */}
    {[-1, 1].map((lado) => (
      <mesh
        key={`pano-${lado}`}
        position={[lado * (VAO_ESTATUA / 2 + LARGURA_PANO / 2), ALTURA_ESTRADO + 1.8, Z_ESTRADO + 1.7]}
        rotation={[0, Math.PI, 0]}
      >
        <planeGeometry args={[LARGURA_PANO, 3.9]} />
        <meshStandardMaterial color={COR_PANO} roughness={0.68} />
      </mesh>
    ))}

    {/* A estátua, no vão, sobre o estrado */}
    <EstatuaRepublica position={[0, ALTURA_ESTRADO, Z_ESTRADO + 1.35]} escala={0.62} />

    <Suspense fallback={null}>
      <ArmasDaRepublica />
    </Suspense>
  </group>
);

export const MesaPresidencia = memo(MesaPresidenciaComponent);
