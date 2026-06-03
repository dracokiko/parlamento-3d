/**
 * Wrapper para a API Groq (gratuita).
 * Modelo: llama-3.1-8b-instant — rápido e suficiente para resumos.
 *
 * Limites free tier: 30 req/min, 14.400 req/dia.
 * O pipeline corre uma vez por dia e só processa registos NOVOS,
 * pelo que na prática nunca atinge os limites após a primeira execução.
 */
import { GROQ_API_KEY } from './config.js';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL    = 'llama-3.1-8b-instant';
const DELAY_MS = 2200; // ~27 req/min — margem segura abaixo do limite de 30

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─────────────────────────────────────────────────────────────────────────────
// PROMPTS — edita aqui para ajustar o estilo e foco dos resumos
// ─────────────────────────────────────────────────────────────────────────────

export function promptIniciativa(ini) {
  const autores = (ini.autores_gp ?? []).map(a => a.GP).filter(Boolean).join(', ')
    || (ini.autores_dep ?? []).map(a => a.nome).filter(Boolean).slice(0, 3).join(', ')
    || 'desconhecido';

  return `És um assistente especializado no parlamento português.
Resumo esta iniciativa legislativa em 2-3 frases curtas e objectivas, em português de Portugal.
Foca-te no que propõe e no impacto esperado. Sem jargão político. Sem introdução.

Tipo: ${ini.desc_tipo || ini.tipo || '—'}
Título: ${ini.titulo || '—'}
Epígrafe: ${ini.epigrafe || '—'}
Autores: ${autores}`;
}

export function promptDeputado(dep, iniciativas) {
  const lista = iniciativas
    .slice(0, 25)
    .map(i => `• ${i.titulo}`)
    .join('\n');

  return `És um assistente especializado no parlamento português.
Com base nas iniciativas abaixo, resume em 3-4 frases a actividade parlamentar do deputado ${dep.nome_parlamentar} (${dep.partido_sigla || '—'}, círculo de ${dep.circulo || '—'}), em português de Portugal.
Identifica os principais temas, áreas de interesse e posicionamento. Sê objectivo e factual. Sem introdução.

Iniciativas apresentadas:
${lista}`;
}

// ─────────────────────────────────────────────────────────────────────────────

async function chamarGroq(prompt) {
  const res = await fetch(GROQ_URL, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      model:       MODEL,
      messages:    [{ role: 'user', content: prompt }],
      max_tokens:  350,
      temperature: 0.3,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (res.status === 429) throw new Error('RATE_LIMIT');
  if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? null;
}

/**
 * Chama o Groq com retry automático em caso de rate limit.
 * Aguarda o delay entre chamadas para nunca exceder 30 req/min.
 */
export async function resumir(prompt, maxRetries = 3) {
  for (let i = 1; i <= maxRetries; i++) {
    try {
      const resultado = await chamarGroq(prompt);
      await sleep(DELAY_MS);
      return resultado;
    } catch (err) {
      if (err.message === 'RATE_LIMIT') {
        const espera = 65_000 * i;
        console.warn(`  ⚠ Rate limit Groq — a aguardar ${espera / 1000}s...`);
        await sleep(espera);
      } else {
        console.warn(`  ⚠ Groq erro: ${err.message}`);
        return null;
      }
    }
  }
  return null;
}
