/**
 * Diagnóstico do endpoint EUR-Lex CELLAR SPARQL.
 * Testa várias queries progressivamente simples para perceber
 * o que está disponível e quais propriedades existem.
 *
 * Uso: node src/eurlexTest.js
 */

import 'dotenv/config';

const SPARQL = 'https://publications.europa.eu/webapi/rdf/sparql';

async function testar(nome, query, { mostrarTodos = false } = {}) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`TESTE: ${nome}`);
  console.log('─'.repeat(60));

  try {
    const url = `${SPARQL}?query=${encodeURIComponent(query.trim())}&format=application%2Fsparql-results%2Bjson`;
    const res = await fetch(url, {
      headers: { Accept: 'application/sparql-results+json' },
      signal: AbortSignal.timeout(30_000),
    });

    console.log(`HTTP: ${res.status}`);
    if (!res.ok) {
      const txt = await res.text();
      console.error('Erro:', txt.slice(0, 800));
      return [];
    }

    const json = await res.json();
    const bindings = json.results?.bindings ?? [];
    console.log(`Resultados: ${bindings.length}`);
    if (mostrarTodos) {
      bindings.forEach((b, i) => console.log(`[${i}]`, JSON.stringify(b)));
    } else if (bindings.length > 0) {
      console.log('Amostra (1º resultado):');
      console.log(JSON.stringify(bindings[0], null, 2));
    }
    return bindings;
  } catch (err) {
    console.error('Exceção:', err.message);
    return [];
  }
}

async function main() {
  // T1 — O endpoint está vivo?
  await testar('Endpoint vivo (qualquer triple)', `
    SELECT ?s ?p ?o WHERE { ?s ?p ?o . } LIMIT 1
  `);

  // T2 — Existem instâncias de cdm:directive?
  await testar('Diretivas via a cdm:directive', `
    PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
    SELECT ?work WHERE { ?work a cdm:directive . } LIMIT 3
  `);

  // T3 — A propriedade de resource-type funciona?
  await testar('Diretivas via cdm:work_has_resource-type DIR', `
    SELECT ?work WHERE {
      ?work <http://publications.europa.eu/ontology/cdm#work_has_resource-type>
            <http://publications.europa.eu/resource/authority/resource-type/DIR> .
    } LIMIT 3
  `);

  // T4 — A propriedade de prazo de transposição existe?
  await testar('Prazo transposição (directive_transposition_date_deadline)', `
    PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
    SELECT ?work ?deadline WHERE {
      ?work cdm:directive_transposition_date_deadline ?deadline .
    } LIMIT 3
  `);

  // T5 — Diretiva conhecida (NIS2): que propriedades tem?
  await testar('Propriedades da diretiva NIS2 (CELEX URI direto)', `
    SELECT ?p ?o WHERE {
      <http://publications.europa.eu/resource/celex/32022L2555> ?p ?o .
    } LIMIT 60
  `);

  // T5b — TODAS as propriedades via owl:sameAs (NIS2 cellar UUID)
  await testar('TODAS as propriedades NIS2 via owl:sameAs', `
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
    SELECT ?p ?o WHERE {
      ?work owl:sameAs <http://publications.europa.eu/resource/celex/32022L2555> .
      ?work ?p ?o .
    } LIMIT 80
  `, { mostrarTodos: true });

  // T6 — National implementing measures existem no CELLAR?
  await testar('Medidas nacionais Portugal (directive_has_national_implementing_measure)', `
    PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
    SELECT ?directive ?nim WHERE {
      ?directive cdm:directive_has_national_implementing_measure ?nim .
      ?nim cdm:work_is_about_concept_country <http://publications.europa.eu/resource/authority/country/PRT> .
    } LIMIT 3
  `);

  // T7 — Versão alternativa da propriedade de país
  await testar('NIMs Portugal via resource_legal_is_about_country', `
    PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
    SELECT ?directive ?nim WHERE {
      ?directive cdm:directive_has_national_implementing_measure ?nim .
      ?nim <http://publications.europa.eu/ontology/cdm#resource_legal_is_about_country>
           <http://publications.europa.eu/resource/authority/country/PRT> .
    } LIMIT 3
  `);

  // T8 — Que tipos de trabalhos têm prazos de transposição? (qualquer propriedade contendo "transpos")
  await testar('Qualquer propriedade com "transpos" no nome', `
    SELECT DISTINCT ?p WHERE {
      ?s ?p ?o .
      FILTER(CONTAINS(LCASE(STR(?p)), "transpos"))
    } LIMIT 20
  `);

  // T9 — Tentar encontrar diretivas recentes pelo URI pattern
  await testar('Works com URI CELEX de 2022 (pattern URI)', `
    SELECT ?work WHERE {
      ?work ?p ?o .
      FILTER(STRSTARTS(STR(?work), "http://publications.europa.eu/resource/celex/3202"))
      FILTER(CONTAINS(STR(?work), "L"))
    } LIMIT 5
  `);

  console.log('\n' + '='.repeat(60));
  console.log('Diagnóstico concluído.');
  console.log('Partilha o output acima para corrigir o sync.');
}

main();