/**
 * Dados mock de intervenções parlamentares e reuniões plenárias.
 *
 * Cada intervenção inclui:
 * - Metadados da reunião (data, tema, duração)
 * - Resumo gerado por IA (contexto, pontos principais, posição, tom)
 * - Transcrição oficial completa
 *
 * Em produção, estes dados viriam da API oficial da Assembleia da República
 * (DAR - Diário da Assembleia da República).
 */

export const reunioes = [
  {
    id: 101,
    data: '2025-01-15T14:00:00',
    titulo: 'Debate do Orçamento do Estado 2025 - Área da Saúde',
    tema: 'Saúde',
    duracaoTotal: '4h 30min',
    importante: true
  },
  {
    id: 102,
    data: '2025-02-03T15:30:00',
    titulo: 'Debate sobre Política de Habitação Acessível',
    tema: 'Habitação',
    duracaoTotal: '3h 15min',
    importante: true
  },
  {
    id: 103,
    data: '2025-02-20T10:00:00',
    titulo: 'Discussão na Generalidade da Lei da Nacionalidade',
    tema: 'Justiça',
    duracaoTotal: '5h 00min',
    importante: false
  },
  {
    id: 104,
    data: '2025-03-12T14:30:00',
    titulo: 'Debate Quinzenal com o Primeiro-Ministro',
    tema: 'Política Geral',
    duracaoTotal: '2h 00min',
    importante: true
  },
  {
    id: 105,
    data: '2025-03-28T15:00:00',
    titulo: 'Debate sobre Educação Superior e Investigação Científica',
    tema: 'Educação',
    duracaoTotal: '3h 45min',
    importante: false
  }
];

/**
 * Helper para gerar intervenções mock para qualquer deputado.
 * Cria 2-4 intervenções por deputado, escolhidas das reuniões disponíveis.
 */
const seededRandom = (seed) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

const tons = ['Técnico', 'Emotivo', 'Crítico', 'Propositivo', 'Técnico e propositivo', 'Conciliador'];
const tipos = ['Debate inicial', 'Réplica', 'Direito de resposta', 'Pergunta', 'Declaração política'];
const posicoes = ['a_favor', 'contra', 'neutra'];

const templatesResumo = {
  Saúde: {
    contexto: 'Financiamento do Serviço Nacional de Saúde para 2025',
    pontos: [
      'Defendeu aumento de 500M€ no orçamento dos hospitais públicos',
      'Criticou a falta de investimento em cuidados de saúde primários',
      'Propôs plano de contratação de 2000 enfermeiros até final do ano',
      'Alertou para o aumento das listas de espera em cirurgias não urgentes'
    ],
    tags: ['SNS', 'Financiamento', 'Enfermeiros', 'Listas de Espera']
  },
  Habitação: {
    contexto: 'Medidas para a crise habitacional e renda acessível',
    pontos: [
      'Defendeu programa nacional de construção pública de habitação',
      'Criticou especulação imobiliária e arrendamento de curta duração',
      'Propôs limite máximo às rendas em zonas de pressão urbana',
      'Sublinhou a necessidade de apoios à compra de primeira habitação'
    ],
    tags: ['Habitação', 'Rendas', 'Jovens', 'Especulação']
  },
  Justiça: {
    contexto: 'Alteração à Lei da Nacionalidade Portuguesa',
    pontos: [
      'Defendeu manutenção dos critérios atuais de atribuição',
      'Criticou propostas que alargam ou restringem demasiado o acesso',
      'Propôs reforço de meios nos serviços de registo civil',
      'Alertou para os direitos dos descendentes de emigrantes'
    ],
    tags: ['Nacionalidade', 'Cidadania', 'Emigração', 'Direitos']
  },
  'Política Geral': {
    contexto: 'Balanço da governação e prioridades nacionais',
    pontos: [
      'Questionou o Governo sobre cumprimento do programa eleitoral',
      'Apresentou propostas para o crescimento económico',
      'Criticou a comunicação política do executivo',
      'Defendeu maior diálogo entre partidos do arco da governação'
    ],
    tags: ['Governo', 'Economia', 'Diálogo', 'Reformas']
  },
  Educação: {
    contexto: 'Investimento no ensino superior e investigação',
    pontos: [
      'Defendeu aumento das bolsas de doutoramento',
      'Criticou a precariedade dos investigadores em Portugal',
      'Propôs reforço do financiamento à FCT',
      'Alertou para a fuga de cérebros para o estrangeiro'
    ],
    tags: ['Ensino Superior', 'Investigação', 'FCT', 'Bolsas']
  }
};

const gerarTranscricaoMock = (deputado, reuniao) => {
  return `Sr. Presidente, Srs. Deputados,

Venho hoje a esta tribuna intervir no âmbito do debate sobre ${reuniao.tema.toLowerCase()}, uma matéria que considero da maior importância para o futuro do nosso país e para o bem-estar dos portugueses.

Permitam-me começar por sublinhar que o ${deputado.partido} sempre defendeu uma abordagem séria, responsável e baseada em evidências para questões desta natureza. Não podemos continuar a adiar decisões que afetam diretamente a vida de milhares de cidadãos.

[Desenvolvimento da argumentação]

Os dados que temos à nossa disposição são claros: a situação atual não é sustentável e exige medidas concretas e imediatas. Os portugueses esperam de nós, deputados, mais do que palavras — esperam ação.

Em primeiro lugar, é fundamental reconhecer que os recursos atualmente alocados são manifestamente insuficientes para responder às necessidades identificadas. Em segundo lugar, importa garantir que as soluções propostas são tecnicamente robustas e financeiramente sustentáveis. Em terceiro lugar, devemos assegurar que os mecanismos de monitorização e avaliação são reforçados.

[Resposta a intervenções anteriores]

Ouvi com atenção as intervenções dos Srs. Deputados que me precederam e gostaria de esclarecer alguns pontos que considero não terem sido devidamente abordados. A questão central não é apenas de natureza ideológica — é uma questão de eficiência, de transparência e, sobretudo, de justiça social.

[Conclusão]

Termino, Sr. Presidente, reiterando o compromisso do meu grupo parlamentar em trabalhar construtivamente com todas as forças políticas que partilhem destes princípios. A democracia exige diálogo, exige consensos, mas exige também coragem para tomar decisões difíceis quando o interesse nacional o impõe.

Muito obrigado.`;
};

/**
 * Gera intervenções mock para um deputado específico.
 * As intervenções são determinísticas baseadas no ID do deputado.
 */
export const getIntervencoesPorDeputado = (deputadoId) => {
  const deputado = { id: deputadoId, partido: 'PS' };
  const numIntervencoes = 2 + Math.floor(seededRandom(deputadoId * 3) * 3);

  const intervencoes = [];
  for (let i = 0; i < numIntervencoes; i++) {
    const reuniaoIndex = Math.floor(seededRandom(deputadoId * (i + 1) * 7) * reunioes.length);
    const reuniao = reunioes[reuniaoIndex];
    const template = templatesResumo[reuniao.tema] || templatesResumo.Saúde;

    intervencoes.push({
      id: deputadoId * 100 + i,
      deputadoId,
      reuniao,
      intervencao: {
        ordem: i + 1,
        tipo: tipos[Math.floor(seededRandom(deputadoId * i * 2) * tipos.length)],
        hora: `${14 + Math.floor(seededRandom(deputadoId * i * 3) * 4)}:${String(Math.floor(seededRandom(deputadoId * i * 5) * 60)).padStart(2, '0')}`,
        duracao: `${3 + Math.floor(seededRandom(deputadoId * i * 7) * 10)}min ${Math.floor(seededRandom(deputadoId * i * 11) * 60)}s`,
        resumoIA: {
          contexto: template.contexto,
          pontosPrincipais: template.pontos,
          posicao: posicoes[Math.floor(seededRandom(deputadoId * i * 13) * posicoes.length)],
          posicaoTexto: 'Posição argumentada com base em dados técnicos',
          tom: tons[Math.floor(seededRandom(deputadoId * i * 17) * tons.length)],
          tags: template.tags
        },
        transcricaoOficial: gerarTranscricaoMock(deputado, reuniao),
        linkFonteOficial: `https://www.parlamento.pt/DAR/Paginas/DAR.aspx?id=${reuniao.id}`
      }
    });
  }

  return intervencoes;
};
