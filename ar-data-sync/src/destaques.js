/**
 * Destaques — o que vale a pena ver no Parlamento, escolhido todos os dias.
 *
 * O site tem 230 deputados, dezenas de milhares de intervenções, milhares de
 * votações; tudo ao mesmo nível, ninguém sabe por onde começar. Isto escolhe
 * três a cinco coisas e prepara-as para uma visita guiada na sala 3D.
 *
 * A regra que manda em tudo o resto: **os factos são calculados, não
 * escritos.** Cada destaque nasce de uma consulta aos dados — uma votação
 * decidida por abstenção, deputados a votar contra a bancada, diretivas em
 * atraso — com os números e as pessoas já apurados. A IA só faz duas coisas:
 * escolhe as palavras do título e explica em linguagem corrente o que está
 * em causa. Não acrescenta números, não opina, e se a resposta dela não
 * passar a validação usa-se o título-base escrito aqui. Num site sobre
 * política, um destaque inventado custava mais do que todos os outros valem.
 *
 * O resultado é um JSON público no Storage do Supabase (bucket `destaques`),
 * o mesmo para todos os visitantes, gerado uma vez por dia no pipeline.
 */

import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { resumir } from './ai.js';

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const BUCKET = 'destaques';
const MAX_DESTAQUES = 5;
const MAX_POR_TIPO = 2;
/** Até onde se vai buscar votações — mais atrás já não é notícia. */
const JANELA_VOTACOES_DIAS = 45;

const SIGLAS = new Set(['PSD', 'PS', 'CH', 'IL', 'BE', 'PCP', 'L', 'JPP', 'PAN', 'CDS-PP']);
const RE_NOME_DEP = /^(.+?)\s*\(([A-Z][\w-]+)\)$/;
const RE_ANON = /^(\d+)-([A-Z][\w-]+)$/;

/** Fases que decidem alguma coisa. Requerimentos e afins ficam de fora. */
const PESO_FASE = {
  'Votação final global': 20,
  'Votação global': 16,
  'Votação final': 14,
  'Votação na generalidade': 8,
  'Votação Deliberação': 4,
  'Votação na especialidade': 2,
};

/**
 * O que cada tipo de iniciativa pesa para quem não segue o Parlamento.
 * Uma lei muda a vida das pessoas; um projeto de resolução recomenda ao
 * Governo que faça alguma coisa, e o Governo não é obrigado. Há dezenas por
 * semana — sem este desconto, a visita era feita só delas.
 */
const PESO_TIPO = {
  'Proposta de Lei': 12,          // do Governo
  'Projeto de Lei': 10,
  'Inquérito Parlamentar': 12,
  'Projeto de Resolução': -6,
  'Proposta de Resolução': 0,
  'Projeto de Deliberação': -6,
};

/**
 * Temas que tocam o dia-a-dia de quem lê: impostos, preços, casa, saúde,
 * salários e pensões, energia, escola. É um critério de assunto e nunca de
 * partido — vale o mesmo venha a proposta de onde vier — e está aqui escrito
 * para se poder discutir e mudar.
 */
const RE_DIA_A_DIA = /(?<![\p{L}])(IVA|IRS|IMI|ISP|impost|taxa|preço|custo de vida|cabaz|renda|arrendamento|habitação|casa|creche|propina|escola|salário|salarial|pensão|pensões|reforma|SNS|saúde|médic|hospital|urgência|energia|eletricidade|gás|combustív|transporte|passe|portagem)/iu;
const BONUS_DIA_A_DIA = 10;

// ── Utilitários ───────────────────────────────────────────────────────────────

const hojeISO = () => new Date().toISOString().slice(0, 10);
const diasDesde = (iso) => Math.max(0, Math.floor((Date.now() - new Date(`${iso}T12:00:00Z`).getTime()) / 86_400_000));
/** Decai para metade a cada `meiaVida` dias: o que é de ontem vale mais do que o de há um mês. */
const recencia = (iso, meiaVida, peso) => peso * 0.5 ** (diasDesde(iso) / meiaVida);

const MESES = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
/** "25 set." — para linhas de contexto. */
const dataCurta = (iso) => `${Number(iso.slice(8, 10))} ${MESES[Number(iso.slice(5, 7)) - 1]}`;
/** "25 de setembro" — para frases. */
const dataLonga = (iso) => `${Number(iso.slice(8, 10))} de ${MESES_LONGOS[Number(iso.slice(5, 7)) - 1]}`;

/** "pelos Açores", "pela Madeira", "por Lisboa" — o círculo com a preposição certa. */
const PELO_CIRCULO = {
  'Açores': 'pelos Açores', 'Madeira': 'pela Madeira', 'Porto': 'pelo Porto', 'Guarda': 'pela Guarda',
  'Europa': 'pelo círculo da Europa', 'Fora da Europa': 'pelo círculo de fora da Europa',
};
const peloCirculo = (c) => PELO_CIRCULO[c] ?? `por ${c}`;

const linkIniciativa = (id) => `https://www.parlamento.pt/ActividadeParlamentar/Paginas/DetalheIniciativa.aspx?BID=${id}`;

/** Títulos oficiais são compridos; o essencial costuma estar antes do primeiro parêntese ou ponto e vírgula. */
function tituloCurto(titulo = '', max = 110) {
  const limpo = titulo.replace(/\s+/g, ' ').trim();
  const corte = limpo.split(/\s[(;]/)[0];
  const base = corte.length >= 25 ? corte : limpo;
  return base.length > max ? `${base.slice(0, max - 1).replace(/\s\S*$/, '')}…` : base;
}

/**
 * Os partidos como o público os conhece, com artigo: "o PS", "a IL",
 * "o Chega". CH e L são siglas de uso interno; ninguém diz "o CH".
 */
const NOME_PUBLICO = { CH: 'Chega', L: 'Livre' };
const FEMININOS = new Set(['IL']);
const nomePublico = (p) => NOME_PUBLICO[p] ?? p;
const comArtigo = (p) => `${FEMININOS.has(p) ? 'a' : 'o'} ${nomePublico(p)}`;
const doPartido = (p) => `${FEMININOS.has(p) ? 'da' : 'do'} ${nomePublico(p)}`;

const juntar = (itens) =>
  itens.length <= 1 ? (itens[0] ?? '') : `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`;
/** "o PS e o PSD" — para frases onde o partido é sujeito. */
const listaComArtigo = (ps) => juntar(ps.map(comArtigo));
/** "do PS e do PSD" — para depois de "de". */
const listaDo = (ps) => juntar(ps.map(doPartido));
/** Quem apresentou a iniciativa, pelos grupos parlamentares — ou "Governo" nas propostas de lei. */
function autoresDe(ini) {
  const gps = (ini?.autores_gp ?? []).map((a) => a?.GP ?? a).filter((x) => typeof x === 'string' && x);
  if (gps.length) return [...new Set(gps)].map(nomePublico);
  return ini?.desc_tipo === 'Proposta de Lei' ? ['Governo'] : [];
}

/** "PS, PSD e Chega" — para listas curtas sem artigo. */
const listaPartidos = (ps) => juntar(ps.map(nomePublico));

async function lerTudo(consulta, pagina = 1000) {
  const tudo = [];
  for (let de = 0; ; de += pagina) {
    // O id desempata: sem ordem estável, o OFFSET pode repetir e saltar linhas.
    const { data, error } = await consulta().order('id').range(de, de + pagina - 1);
    if (error) throw new Error(error.message);
    tudo.push(...(data ?? []));
    if (!data || data.length < pagina) return tudo;
  }
}

// ── Contexto: quem ocupa que lugar ────────────────────────────────────────────

async function carregarContexto() {
  const deputados = await lerTudo(() =>
    db.from('deputados').select('id, nome, nome_completo, partido_sigla, circulo_eleitoral'),
  );
  const lugaresPorPartido = {};
  for (const d of deputados) lugaresPorPartido[d.partido_sigla] = (lugaresPorPartido[d.partido_sigla] ?? 0) + 1;

  const porNome = new Map();
  for (const d of deputados) {
    porNome.set(d.nome, d);
    if (d.nome_completo) porNome.set(d.nome_completo, d);
  }
  return { deputados, lugaresPorPartido, porNome };
}

// ── Contagem de lugares numa votação ──────────────────────────────────────────

/**
 * Quantos lugares estão por trás de cada posição.
 *
 * Não são votos contados: o Parlamento vota por bancada, e o registo diz a
 * posição de cada grupo mais os deputados que dela se afastaram ("5-PSD", ou
 * "Fulano (PSD)"). Somam-se os lugares de cada grupo, tirando os que votaram
 * de outra maneira. "5-PSD" e os cinco nomes do PSD na mesma lista são as
 * mesmas pessoas — conta-se uma vez.
 */
export function contarLugares(gp, lugaresPorPartido) {
  const posicoes = ['favor', 'contra', 'abstencao'];
  const lugares = { favor: 0, contra: 0, abstencao: 0 };
  const saidas = {};
  const posGrupo = {};

  for (const p of posicoes) {
    for (const item of gp?.[p] ?? []) if (SIGLAS.has(item)) posGrupo[item] = p;
  }

  for (const p of posicoes) {
    const itens = gp?.[p] ?? [];
    const anonimos = {};
    for (const item of itens) {
      const m = item.match(RE_ANON);
      if (m) anonimos[m[2]] = (anonimos[m[2]] ?? 0) + Number(m[1]);
    }
    for (const [partido, n] of Object.entries(anonimos)) {
      lugares[p] += n;
      saidas[partido] = (saidas[partido] ?? 0) + n;
    }
    for (const item of itens) {
      const m = item.match(RE_NOME_DEP);
      if (!m || anonimos[m[2]]) continue;
      lugares[p] += 1;
      saidas[m[2]] = (saidas[m[2]] ?? 0) + 1;
    }
  }

  for (const [partido, p] of Object.entries(posGrupo)) {
    lugares[p] += Math.max(0, (lugaresPorPartido[partido] ?? 0) - (saidas[partido] ?? 0));
  }
  return { lugares, posGrupo };
}

/** Os deputados que o registo nomeia, com a posição de cada um. */
function nomeados(gp) {
  const out = [];
  for (const p of ['favor', 'contra', 'abstencao']) {
    for (const item of gp?.[p] ?? []) {
      const m = item.match(RE_NOME_DEP);
      if (m) out.push({ nome: m[1].trim(), partido: m[2], posicao: p });
    }
  }
  return out;
}

// ── Geradores de factos ───────────────────────────────────────────────────────
//
// Cada um devolve candidatos { chave, tipo, pontuacao, ... }. Nenhum escreve
// prosa além de um título-base e de um "porquê" — a frase que diz ao
// visitante porque é que aquilo lhe está a ser mostrado.

async function carregarVotacoesRecentes() {
  const desde = new Date(Date.now() - JANELA_VOTACOES_DIAS * 86_400_000).toISOString().slice(0, 10);
  const votos = await lerTudo(() =>
    db.from('ar_votacoes')
      .select('id, iniciativa_id, fase, data_votacao, resultado, unanime, detalhe_gp')
      .gte('data_votacao', desde)
      .lte('data_votacao', hojeISO()),
  );
  const ids = [...new Set(votos.map((v) => v.iniciativa_id).filter(Boolean))];
  const inis = new Map();
  for (let i = 0; i < ids.length; i += 150) {
    const { data, error } = await db.from('ar_iniciativas')
      .select('id, titulo, desc_tipo, resumo_ia, autores_gp')
      .in('id', ids.slice(i, i + 150));
    if (error) throw new Error(error.message);
    for (const ini of data ?? []) inis.set(String(ini.id), ini);
  }
  return votos.map((v) => ({ ...v, ini: inis.get(String(v.iniciativa_id)) })).filter((v) => v.ini);
}

/**
 * Votações que vale a pena contar: as que passaram por pouco, e sobretudo as
 * que só passaram porque alguém se absteve em vez de votar contra.
 */
function factosVotacoes(votacoes, ctx) {
  const factos = [];

  for (const v of votacoes) {
    const pesoFase = PESO_FASE[v.fase];
    const pesoTipo = PESO_TIPO[v.ini.desc_tipo];
    if (pesoFase === undefined || pesoTipo === undefined) continue;
    if (v.unanime || !v.detalhe_gp) continue;

    const { lugares, posGrupo } = contarLugares(v.detalhe_gp, ctx.lugaresPorPartido);
    const { favor, contra, abstencao } = lugares;
    if (favor + contra + abstencao < 150) continue; // registo incompleto — melhor não contar

    const aprovado = /aprovad/i.test(v.resultado ?? '');
    const margem = Math.abs(favor - contra);

    // Uma abstenção decide quando, trocada por um voto, virava o resultado:
    // numa aprovada, se passasse a contra; numa chumbada, se passasse a favor.
    // Só conta quando havia de facto dois lados — aprovar com 63 a favor, 0
    // contra e o resto a abster-se não foi "salvo" por ninguém.
    const abstencoes = Object.entries(posGrupo).filter(([, p]) => p === 'abstencao').map(([partido]) => partido);
    const lugaresDe = (partido) => ctx.lugaresPorPartido[partido] ?? 0;
    // Dois lados a sério: pelo menos 10% dos lugares de cada. Com 62 a favor
    // e 3 contra não houve disputa que alguém tenha "decidido".
    const haDoisLados = Math.min(favor, contra) >= 23;
    const decisivos = !haDoisLados ? [] : aprovado
      ? abstencoes.filter((p) => contra + lugaresDe(p) >= favor)
      : abstencoes.filter((p) => favor + lugaresDe(p) > contra);

    // O título diz o que aconteceu e a quê; não põe o resultado às costas de
    // um partido. Quem votou contra chumbou tanto como quem se absteve — a
    // conta do "se tivesse votado de outra forma" fica no porquê, e o cartão
    // mostra a posição de todos.
    let angulo = null, pontosAngulo = 0, porque = '', tituloBase = '';
    const assunto = tituloCurto(v.ini.titulo, 90);
    const quemDecidiu = listaComArtigo(decisivos);
    const verbo = decisivos.length === 1 ? 'tivesse' : 'tivessem';
    const Resultado = aprovado ? 'Aprovado' : 'Chumbado';

    if (decisivos.length && aprovado) {
      angulo = 'viabilizada';
      pontosAngulo = 28;
      porque = `Passou com ${favor} lugares a favor e ${contra} contra. Se ${quemDecidiu} ${verbo} votado contra em vez de se abster, tinha sido chumbado.`;
      tituloBase = `${Resultado}: ${assunto}`;
    } else if (decisivos.length && !aprovado) {
      angulo = 'travada';
      pontosAngulo = 28;
      porque = `Chumbado com ${favor} lugares a favor e ${contra} contra. Se ${quemDecidiu} ${verbo} votado a favor em vez de se abster, tinha passado.`;
      tituloBase = `${Resultado}: ${assunto}`;
    } else if (margem <= 20) {
      angulo = 'renhida';
      pontosAngulo = 22 * (1 - margem / 24);
      porque = `${Resultado} por ${margem} ${margem === 1 ? 'lugar' : 'lugares'} de diferença: ${favor} a favor, ${contra} contra.`;
      tituloBase = `${Resultado} por ${margem} ${margem === 1 ? 'lugar' : 'lugares'}: ${assunto}`;
    } else if (aprovado && v.fase === 'Votação final global' && pesoTipo >= 8) {
      angulo = 'aprovada';
      pontosAngulo = 10;
      porque = `Votação final global — é aqui que uma lei fica aprovada. ${favor} lugares a favor, ${contra} contra.`;
      tituloBase = `Aprovada em votação final global: ${assunto}`;
    } else continue;

    const posicoes = { ...posGrupo };
    const excecoes = {};
    for (const n of nomeados(v.detalhe_gp)) {
      const dep = ctx.porNome.get(n.nome);
      if (dep && n.posicao !== posGrupo[n.partido]) excecoes[dep.id] = n.posicao;
    }

    factos.push({
      chave: `votacao:${v.id}`,
      tipo: 'votacao',
      angulo,
      iniciativa: String(v.iniciativa_id),
      pontuacao: recencia(v.data_votacao, 7, 40) + pesoFase + pesoTipo + pontosAngulo
        + (RE_DIA_A_DIA.test(v.ini.titulo ?? '') ? BONUS_DIA_A_DIA : 0),
      data: v.data_votacao,
      tituloBase,
      porque,
      contexto: `${v.fase} · ${v.ini.desc_tipo} · ${dataCurta(v.data_votacao)}`,
      numeros: [
        { rotulo: 'a favor', valor: favor, tom: 'favor' },
        { rotulo: 'contra', valor: contra, tom: 'contra' },
        ...(abstencao ? [{ rotulo: 'abstenção', valor: abstencao, tom: 'abstencao' }] : []),
      ],
      // Quem votou o quê, por extenso — é o que torna o destaque justo: o
      // leitor vê todos os lados, não só o que o ângulo escolheu.
      lados: {
        favor: Object.keys(posGrupo).filter((p) => posGrupo[p] === 'favor').map(nomePublico),
        contra: Object.keys(posGrupo).filter((p) => posGrupo[p] === 'contra').map(nomePublico),
        abstencao: Object.keys(posGrupo).filter((p) => posGrupo[p] === 'abstencao').map(nomePublico),
      },
      materia: v.ini.resumo_ia ?? v.ini.titulo,
      fonte: { rotulo: 'Ver a iniciativa no Parlamento', url: linkIniciativa(v.iniciativa_id) },
      cena: { modo: 'votacao', posicoes, excecoes },
      pessoas: [],
      partidosFoco: decisivos,
      dadosParaIA: { angulo, resultado: v.resultado, fase: v.fase, tipo: v.ini.desc_tipo, lugares_a_favor: favor, lugares_contra: contra, lugares_abstencao: abstencao, margem_em_lugares: margem, abstencao_decisiva: decisivos.map(nomePublico), autores: autoresDe(v.ini), titulo_oficial: v.ini.titulo },
    });
  }
  return factos;
}

/**
 * Deputados que votaram contra a própria bancada. É raro — umas três
 * dezenas de votações numa legislatura —, e por isso é notícia mesmo com
 * semanas. Quando são todos eleitos pela mesma região, é essa a história.
 */
async function factosContraBancada(ctx) {
  const votos = await lerTudo(() =>
    db.from('ar_votacoes')
      .select('id, iniciativa_id, fase, data_votacao, resultado, detalhe_gp, deputados_isolados')
      .neq('deputados_isolados', '[]')
      .not('data_votacao', 'is', null),
  );

  // Para dizer quão raro é com números, e não com um "raramente" a olho.
  const { count: totalVotacoes } = await db.from('ar_votacoes').select('id', { count: 'exact', head: true });
  const votacoesComRebeldes = votos.filter((v) => (v.deputados_isolados ?? []).some((d) => d.rebelde)).length;

  const idsIni = [...new Set(votos.map((v) => v.iniciativa_id))];
  const inis = new Map();
  for (let i = 0; i < idsIni.length; i += 150) {
    const { data } = await db.from('ar_iniciativas').select('id, titulo, desc_tipo, resumo_ia, autores_gp').in('id', idsIni.slice(i, i + 150));
    for (const ini of data ?? []) inis.set(String(ini.id), ini);
  }

  const factos = [];
  for (const v of votos) {
    const rebeldes = (v.deputados_isolados ?? []).filter((d) => d.rebelde);
    if (!rebeldes.length) continue;
    const ini = inis.get(String(v.iniciativa_id));
    if (!ini) continue;

    const comLugar = rebeldes.map((r) => ({ ...r, dep: ctx.porNome.get(r.nome) }));
    const n = rebeldes.length;
    const circulos = [...new Set(comLugar.map((r) => r.dep?.circulo_eleitoral).filter(Boolean))];
    // "Todos da mesma região" só é uma história com mais do que um.
    const mesmaRegiao = n >= 2 && circulos.length === 1 && comLugar.every((r) => r.dep) ? circulos[0] : null;
    const partidos = [...new Set(rebeldes.map((r) => r.partido))];
    const assunto = tituloCurto(ini.titulo, 80);

    const { posGrupo } = contarLugares(v.detalhe_gp, ctx.lugaresPorPartido);
    const posicoes = { ...posGrupo };
    const excecoes = {};
    for (const r of comLugar) if (r.dep) excecoes[r.dep.id] = r.posicao;

    // Dito com precisão: "votou a favor quando a bancada se absteve", e não
    // um vago "votou contra a bancada", que nem sempre é verdade à letra.
    const VOTOU = { favor: 'votou a favor', contra: 'votou contra', abstencao: 'absteve-se' };
    const BANCADA = { favor: 'a bancada votou a favor', contra: 'a bancada votou contra', abstencao: 'a bancada se absteve' };
    const r0 = rebeldes[0];
    const tituloBase = n === 1
      ? `${r0.nome} (${nomePublico(r0.partido)}) ${VOTOU[r0.posicao]} quando ${BANCADA[r0.posicao_partido] ?? 'a bancada votou de outra forma'}`
      : `${n} deputados ${listaDo(partidos)}${mesmaRegiao ? `, todos eleitos ${peloCirculo(mesmaRegiao)},` : ''} votaram ao contrário da bancada`;

    factos.push({
      chave: `contra_bancada:${v.id}`,
      tipo: 'contra_bancada',
      angulo: 'contra_bancada',
      iniciativa: String(v.iniciativa_id),
      // Raro: decai devagar (meia-vida de um mês) e parte de uma base alta.
      pontuacao: 30 + recencia(v.data_votacao, 30, 40) + Math.min(10, 2 * n) + (mesmaRegiao ? 8 : 0),
      data: v.data_votacao,
      tituloBase,
      porque: `Votação de ${dataLonga(v.data_votacao)}. Nesta legislatura, só em ${votacoesComRebeldes} de ${totalVotacoes ?? '?'} votações houve deputados a votar diferente do seu partido.`,
      contexto: `${v.fase} · ${dataCurta(v.data_votacao)} · ${assunto}`,
      numeros: [{ rotulo: n === 1 ? 'deputado' : 'deputados', valor: n, tom: 'destaque' }],
      materia: ini.resumo_ia ?? ini.titulo,
      fonte: { rotulo: 'Ver a iniciativa no Parlamento', url: linkIniciativa(v.iniciativa_id) },
      cena: { modo: 'votacao', posicoes, excecoes, deputados: comLugar.filter((r) => r.dep).map((r) => r.dep.id) },
      lados: {
        favor: Object.keys(posGrupo).filter((p) => posGrupo[p] === 'favor').map(nomePublico),
        contra: Object.keys(posGrupo).filter((p) => posGrupo[p] === 'contra').map(nomePublico),
        abstencao: Object.keys(posGrupo).filter((p) => posGrupo[p] === 'abstencao').map(nomePublico),
      },
      pessoas: comLugar.filter((r) => r.dep).slice(0, 6).map((r) => ({ id: r.dep.id, nome: r.nome, partido: r.partido })),
      partidosFoco: partidos,
      dadosParaIA: {
        n, regiao: mesmaRegiao, partidos, votacoes_com_divergencias: votacoesComRebeldes, total_votacoes: totalVotacoes,
        rebeldes: rebeldes.map((r) => ({ nome: r.nome, partido: r.partido, votou: r.posicao, bancada: r.posicao_partido })),
        fase: v.fase, tipo: ini.desc_tipo, resultado: v.resultado, autores: autoresDe(ini), titulo_oficial: ini.titulo,
      },
    });
  }
  return factos;
}

/**
 * Com que parte das diretivas se sabe o prazo de transposição, abaixo da
 * qual não se afirma nada sobre "quantas estão em atraso". A 30/09/2026 os
 * dados só tinham prazo para 7 de 824 — dizer "Portugal tem 4 diretivas em
 * atraso" seria publicar uma lacuna nossa como se fosse um facto do país.
 */
const COBERTURA_MINIMA_PRAZOS = 0.5;

/** Diretivas europeias que Portugal já devia ter passado para a lei nacional. */
async function factosDiretivas() {
  const todas = await lerTudo(() => db.from('diretivas_ue').select('id, titulo, prazo_transposicao, transposto_pt, em_atraso, link_eurlex'));
  const comPrazo = todas.filter((d) => d.prazo_transposicao).length;
  if (!todas.length || comPrazo / todas.length < COBERTURA_MINIMA_PRAZOS) {
    console.warn(`  ⚠ [DESTAQUES] diretivas de fora: só ${comPrazo} de ${todas.length} têm prazo conhecido`);
    return [];
  }
  const atrasadas = todas.filter((d) => d.em_atraso && d.prazo_transposicao)
    .sort((a, b) => a.prazo_transposicao.localeCompare(b.prazo_transposicao));
  if (!atrasadas.length) return [];

  const maisAntiga = atrasadas[0];
  const diasAtraso = diasDesde(maisAntiga.prazo_transposicao);
  const dentroPrazo = todas.filter((d) => d.prazo_transposicao && !d.transposto_pt && !d.em_atraso).length;

  return [{
    chave: `diretivas:${atrasadas.length}`,
    tipo: 'diretivas',
    // Não é notícia de hoje, mas é das poucas coisas com consequência directa
    // (a Comissão Europeia pode abrir processo); fica como reserva sólida.
    pontuacao: 26,
    data: hojeISO(),
    tituloBase: `Portugal tem ${atrasadas.length} diretivas europeias em atraso`,
    porque: `Passado o prazo, a Comissão Europeia pode abrir um processo de infração. A mais antiga está em atraso há ${diasAtraso} dias.`,
    contexto: `Diretivas da UE · ${dentroPrazo} ainda dentro do prazo`,
    numeros: [
      { rotulo: 'em atraso', valor: atrasadas.length, tom: 'contra' },
      { rotulo: 'dias de atraso da mais antiga', valor: diasAtraso, tom: 'neutro' },
    ],
    materia: maisAntiga.titulo,
    fonte: { rotulo: 'Ver a diretiva mais atrasada', url: maisAntiga.link_eurlex },
    cena: { modo: 'sala' },
    pessoas: [],
    partidosFoco: [],
    dadosParaIA: { em_atraso: atrasadas.length, dentro_prazo: dentroPrazo, dias_atraso_mais_antiga: diasAtraso, titulo_mais_antiga: maisAntiga.titulo },
  }];
}

/**
 * Quem falou mais na última sessão com transcrição — pelas palavras, não
 * pelo número de intervenções, que os apartes de três palavras inflacionam.
 */
async function factosQuemFalou(ctx) {
  const { data: ultima } = await db.from('ar_debates')
    .select('id, data_debate')
    .like('id', 'dar_%')
    .not('transcricao', 'is', null)
    .order('data_debate', { ascending: false })
    .limit(1);
  const sessao = ultima?.[0];
  if (!sessao) return [];

  const ivs = await lerTudo(() =>
    db.from('ar_intervencoes').select('nome_dep, partido, num_palavras, papel').eq('debate_id', sessao.id),
  );
  const porDeputado = new Map();
  for (const iv of ivs) {
    if (iv.papel && iv.papel !== 'deputado') continue;
    if (!iv.nome_dep) continue;
    const a = porDeputado.get(iv.nome_dep) ?? { nome: iv.nome_dep, partido: iv.partido, palavras: 0, vezes: 0 };
    a.palavras += iv.num_palavras ?? 0;
    a.vezes += 1;
    porDeputado.set(iv.nome_dep, a);
  }
  const ranking = [...porDeputado.values()].sort((a, b) => b.palavras - a.palavras);
  const top = ranking.slice(0, 3).map((r) => ({ ...r, dep: ctx.porNome.get(r.nome) })).filter((r) => r.dep);
  if (!top.length) return [];

  const primeiro = top[0];
  return [{
    chave: `quem_falou:${sessao.id}`,
    tipo: 'quem_falou',
    pontuacao: 12 + recencia(sessao.data_debate, 7, 30),
    data: sessao.data_debate,
    tituloBase: `Quem mais falou na sessão de ${dataCurta(sessao.data_debate)}: ${primeiro.nome} (${nomePublico(primeiro.partido)})`,
    porque: `Contado em palavras ditas, não em intervenções. É a última sessão com transcrição publicada pela AR.`,
    contexto: `Sessão plenária · ${dataCurta(sessao.data_debate)}`,
    numeros: top.map((t) => ({ rotulo: t.nome, valor: t.palavras, tom: 'neutro', unidade: 'palavras' })),
    materia: null,
    fonte: { rotulo: 'Ver o Diário da sessão', url: null },
    cena: { modo: 'deputados', deputados: top.map((t) => t.dep.id) },
    pessoas: top.map((t) => ({ id: t.dep.id, nome: t.nome, partido: t.partido })),
    partidosFoco: [...new Set(top.map((t) => t.partido))],
    dadosParaIA: { sessao: sessao.data_debate, top: top.map((t) => ({ nome: t.nome, partido: t.partido, palavras: t.palavras, intervencoes: t.vezes })) },
  }];
}

// ── Escolha ───────────────────────────────────────────────────────────────────

/**
 * Os melhores, com duas regras de equilíbrio: no máximo dois do mesmo tipo
 * (senão, numa semana de muitas votações, a visita era só votações), e nos
 * destaques centrados em pessoas, no máximo um por partido — não queremos
 * uma visita que, por acaso dos números, só aponte a um lado da sala.
 */
function escolher(candidatos) {
  const ordenados = [...candidatos].sort((a, b) => b.pontuacao - a.pontuacao);
  // A mesma iniciativa votada na generalidade e na final global é uma só
  // história; e oito "chumbado com a abstenção de" seguidos são uma visita
  // aborrecida — um de cada ângulo.
  const iniciativasUsadas = new Set();
  const angulosUsados = new Set();
  const escolhidos = [];
  const porTipo = {};
  const aparicoes = {};
  const MAX_POR_PARTIDO = 2;

  for (const c of ordenados) {
    if (escolhidos.length >= MAX_DESTAQUES) break;
    if ((porTipo[c.tipo] ?? 0) >= MAX_POR_TIPO) continue;
    if (c.iniciativa && iniciativasUsadas.has(c.iniciativa)) continue;
    if (c.angulo && angulosUsados.has(c.angulo)) continue;
    if (c.partidosFoco.some((p) => (aparicoes[p] ?? 0) >= MAX_POR_PARTIDO)) continue;
    escolhidos.push(c);
    porTipo[c.tipo] = (porTipo[c.tipo] ?? 0) + 1;
    if (c.iniciativa) iniciativasUsadas.add(c.iniciativa);
    if (c.angulo) angulosUsados.add(c.angulo);
    for (const p of c.partidosFoco) aparicoes[p] = (aparicoes[p] ?? 0) + 1;
  }
  // O mais forte primeiro: a primeira paragem decide se a pessoa fica para a
  // segunda. Já vêm ordenados pela pontuação, que pesa a novidade.
  return escolhidos;
}

// ── A parte da IA ─────────────────────────────────────────────────────────────

/**
 * Palavras que dão opinião em vez de informar — só no início de palavra, para
 * "bomba" não apanhar "bombeiros". E uma palavra que já está no próprio
 * assunto não conta: se a lei é sobre o "centro histórico", o título pode
 * dizê-lo.
 */
const PROIBIDAS = /(?<![\p{L}])(polémic|polemic|escandal|vergonh|incrív|chocant|históric|brutal|surpreendent|lamentáv|felizmente|infelizmente|finalmente|absurd|ridícul|polémica|polêmic|controvers|dramátic|gritante)/giu;

function palavrasDeOpiniao(texto, fonte) {
  const naFonte = new Set([...(fonte.matchAll(PROIBIDAS))].map((m) => m[1].toLowerCase()));
  return [...texto.matchAll(PROIBIDAS)].map((m) => m[1].toLowerCase()).filter((p) => !naFonte.has(p));
}

/**
 * Os números que um texto afirma — em algarismos e por extenso. Sem os
 * extensos, um "doze" inventado passava pela verificação. "Um/uma" ficam de
 * fora: são quase sempre artigos.
 */
const EXTENSO = {
  dois: 2, duas: 2, 'três': 3, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
  onze: 11, doze: 12, treze: 13, catorze: 14, quinze: 15, dezasseis: 16, dezassete: 17, dezoito: 18,
  dezanove: 19, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70,
  oitenta: 80, noventa: 90, cem: 100, cento: 100, duzentos: 200, trezentos: 300, mil: 1000,
};
const RE_EXTENSO = new RegExp(`(?<![\\p{L}])(${Object.keys(EXTENSO).join('|')})(?![\\p{L}])`, 'giu');

const numerosDe = (texto) => [
  ...(texto.match(/\d[\d.\s]*\d|\d/g) ?? []).map((s) => s.replace(/[.\s]/g, '')),
  ...[...texto.matchAll(RE_EXTENSO)].map((m) => String(EXTENSO[m[1].toLowerCase()])),
];

/**
 * Pede à IA o título e a explicação, e só aceita se passar em tudo: JSON
 * válido, comprimento certo, nenhuma palavra de opinião, e nenhum número que
 * não esteja nos dados — é aí que um modelo mais facilmente inventa.
 */
async function escreverComIA(facto, recusaAnterior = null) {
  // Números permitidos: os dos dados, os do título-base e do porquê, e os da
  // data (dia, mês, ano) — "a 25 de setembro" não é invenção.
  const [ano, mes, dia] = facto.data.split('-');
  const permitidos = new Set([
    ...numerosDe(`${JSON.stringify(facto.dadosParaIA)} ${facto.tituloBase} ${facto.porque} ${facto.contexto}`),
    String(Number(dia)), String(Number(mes)), ano,
  ]);

  const prompt = `És editor de um site que explica o Parlamento português a quem não o segue. Escreve em português de Portugal.

Tens um facto já apurado. Devolve APENAS um objecto JSON, sem mais nada, com:
- "titulo": uma frase até 90 caracteres que diga o que aconteceu, como título de notícia sóbria.
- "explicacao": uma a duas frases (até 220 caracteres) que expliquem em linguagem corrente o que está em causa e porque importa a quem vive em Portugal.

Regras obrigatórias:
- Usa só a informação dada. Não acrescentes números, datas, nomes ou consequências que não estejam aqui.
- Escreve os números em algarismos, tal como estão nos dados.
- Os números de uma votação são lugares das bancadas, não votos contados: diz "lugares", nunca "votos".
- Se disseres quem apresentou a proposta, usa só o que está em "autores". Se "autores" estiver vazio, não digas quem foi.
- Respeita o "tipo" do documento. Um decreto-lei é sempre do Governo: numa "Apreciação Parlamentar", os autores só pediram ao Parlamento que apreciasse o decreto-lei do Governo.
- Sem adjectivos de opinião (nada de "polémico", "histórico", "surpreendente", "vergonhoso"). Descreve, não julgues.
- Não digas porque é que isto é relevante ou merece destaque — isso já aparece noutro sítio. Explica só do que se trata.
- No título, não atribuas o resultado de uma votação a um só partido: o cartão mostra ao lado a posição de todos.
- Chama aos partidos pelo nome corrente: "Chega" e não "CH", "Livre" e não "L".
- Não uses siglas sem as dizer por extenso quando for a primeira vez que aparecem na explicação, excepto partidos.

Título-base (podes melhorar a clareza, não o sentido): ${facto.tituloBase}
Porque é destaque: ${facto.porque}
Dados: ${JSON.stringify(facto.dadosParaIA)}
${facto.materia ? `Do que se trata: ${String(facto.materia).slice(0, 900)}` : ''}${recusaAnterior ? `\n\nA tua resposta anterior foi recusada por isto: ${recusaAnterior}. Corrige.` : ''}`;

  const resposta = await resumir(prompt);
  if (!resposta) return { ok: false, motivo: 'sem resposta' };

  const texto = resposta.replace(/<think>[\s\S]*?<\/think>/gi, '');
  const json = texto.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return { ok: false, motivo: 'sem JSON' };

  let obj;
  try { obj = JSON.parse(json); } catch { return { ok: false, motivo: 'JSON inválido' }; }

  const titulo = String(obj.titulo ?? '').trim();
  const explicacao = String(obj.explicacao ?? '').trim();
  if (titulo.length < 15 || titulo.length > 110) return { ok: false, motivo: `título com ${titulo.length} caracteres` };
  if (explicacao.length > 300) return { ok: false, motivo: 'explicação longa demais' };
  // O Parlamento vota por bancada; os números são lugares. "70 votos" dá a
  // entender uma contagem de votos que ninguém fez.
  if (/\d+\s+votos?(?![\p{L}])/iu.test(`${titulo} ${explicacao}`)) return { ok: false, motivo: 'chamou "votos" aos lugares' };
  const fonte = `${facto.materia ?? ''} ${JSON.stringify(facto.dadosParaIA)}`;
  const opiniao = palavrasDeOpiniao(`${titulo} ${explicacao}`, fonte);
  if (opiniao.length) return { ok: false, motivo: `palavra de opinião: "${opiniao.join('", "')}"` };

  const inventados = [...numerosDe(titulo), ...numerosDe(explicacao)].filter((n) => !permitidos.has(n));
  if (inventados.length) return { ok: false, motivo: `números que não estão nos dados: ${inventados.join(', ')}` };

  return { ok: true, titulo, explicacao };
}

// ── Publicação ────────────────────────────────────────────────────────────────

async function garantirBucket() {
  const { data } = await db.storage.getBucket(BUCKET);
  if (data) return;
  const { error } = await db.storage.createBucket(BUCKET, { public: true });
  if (error && !/already exists/i.test(error.message)) throw new Error(`bucket: ${error.message}`);
}

async function publicar(conteudo) {
  await garantirBucket();
  const corpo = JSON.stringify(conteudo, null, 1);
  for (const caminho of ['atual.json', `historico/${hojeISO()}.json`]) {
    const { error } = await db.storage.from(BUCKET).upload(caminho, corpo, {
      upsert: true,
      contentType: 'application/json',
      // Curto: o pipeline corre uma vez por dia, mas uma correcção manual
      // deve chegar aos visitantes em minutos, não em horas.
      cacheControl: '300',
    });
    if (error) throw new Error(`${caminho}: ${error.message}`);
  }
}

// ── Entrada ───────────────────────────────────────────────────────────────────

/**
 * @param {{ publicar?: boolean }} opcoes  publicar=false para ver o resultado sem o pôr no ar.
 */
export async function gerarDestaques({ publicar: devePublicar = true } = {}) {
  console.log('\n  [DESTAQUES] A escolher o que vale a pena ver...');

  const ctx = await carregarContexto();
  const votacoes = await carregarVotacoesRecentes();

  const candidatos = [
    ...factosVotacoes(votacoes, ctx),
    ...(await factosContraBancada(ctx)),
    ...(await factosDiretivas()),
    ...(await factosQuemFalou(ctx)),
  ];
  const escolhidos = escolher(candidatos);
  if (!devePublicar) {
    console.log('  [DESTAQUES] Candidatos, do mais forte para o mais fraco:');
    for (const c of [...candidatos].sort((a, b) => b.pontuacao - a.pontuacao).slice(0, 14)) {
      const escolhido = escolhidos.includes(c) ? '●' : ' ';
      console.log(`    ${escolhido} ${String(Math.round(c.pontuacao)).padStart(3)}  ${c.tipo.padEnd(15)} [${c.partidosFoco.join(',')}]  ${c.tituloBase.slice(0, 90)}`);
    }
  }
  console.log(`  [DESTAQUES] ${candidatos.length} candidatos, ${escolhidos.length} escolhidos`);

  const falhas = [];
  const destaques = [];
  for (const f of escolhidos) {
    let ia = await escreverComIA(f);
    // Uma segunda tentativa, a dizer o que falhou: quase sempre é um número
    // que ela foi buscar a outro lado ou uma palavra a mais.
    if (!ia.ok && ia.motivo !== 'sem resposta') ia = await escreverComIA(f, ia.motivo);
    if (!ia.ok) {
      falhas.push({ id: f.chave, motivo: `IA recusada (${ia.motivo}) — usado o título-base` });
      console.warn(`  ⚠ ${f.chave}: IA recusada (${ia.motivo})`);
    }
    destaques.push({
      id: f.chave,
      tipo: f.tipo,
      titulo: ia.ok ? ia.titulo : f.tituloBase,
      explicacao: ia.ok ? ia.explicacao : null,
      porque: f.porque,
      contexto: f.contexto,
      numeros: f.numeros,
      data: f.data,
      fonte: f.fonte,
      cena: f.cena,
      pessoas: f.pessoas,
      lados: f.lados ?? null,
      pontuacao: Math.round(f.pontuacao),
      escritoPorIA: ia.ok,
    });
  }

  // O id do conjunto só muda quando os destaques mudam — é por ele que o
  // site decide se abre a visita sozinho a quem já a viu.
  const id = createHash('sha1').update(destaques.map((d) => d.id).join('|')).digest('hex').slice(0, 12);
  const conteudo = { versao: 1, id, geradoEm: new Date().toISOString(), destaques };

  if (devePublicar && destaques.length) await publicar(conteudo);

  return {
    conteudo,
    total: candidatos.length,
    inseridos: destaques.length,
    atualizados: 0,
    erros: 0, // uma recusa da IA não é erro: o destaque sai na mesma, com o título-base
    novos: destaques.map((d) => ({ id: d.id, label: d.titulo })),
    falhas,
    info: [{
      nivel: 'info',
      texto: `${destaques.length} destaques publicados, de ${candidatos.length} candidatos; ${destaques.filter((d) => d.escritoPorIA).length} com texto da IA, os outros com o título-base.`,
    }],
  };
}

// Execução directa: `node src/destaques.js --seco` mostra sem publicar.
if (process.argv[1]?.endsWith('destaques.js')) {
  const seco = process.argv.includes('--seco');
  gerarDestaques({ publicar: !seco })
    .then((r) => console.log(JSON.stringify(r.conteudo, null, 2)))
    .catch((err) => { console.error(err); process.exitCode = 1; });
}
