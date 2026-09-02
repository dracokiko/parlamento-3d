/**
 * Wrapper para a API Groq (gratuita).
 * Modelo: qwen/qwen3.8-27b — rápido e suficiente para resumos.
 * (llama-3.1-8b-instant foi descontinuado pela Groq em 2026.)
 *
 * Limites free tier: 30 req/min, 14.400 req/dia.
 * O pipeline corre uma vez por dia e só processa registos NOVOS,
 * pelo que na prática nunca atinge os limites após a primeira execução.
 */
import { GROQ_API_KEY } from './config.js';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL    = 'qwen/qwen3.8-27b';
const DELAY_MS = 2200; // ~27 req/min — margem segura abaixo do limite de 30

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─────────────────────────────────────────────────────────────────────────────
// PROMPTS — edita aqui para ajustar o estilo e foco dos resumos
// ─────────────────────────────────────────────────────────────────────────────

// Instruções comuns a todos os prompts
const INSTRUCOES_BASE = `Escreve em português de Portugal. Sê objectivo e factual.
Não uses frases introdutórias como "Este debate..." ou "Esta iniciativa...". Vai directo ao conteúdo.
Siglas dos partidos: PS (Partido Socialista), PSD (Partido Social Democrata), CH (Chega), IL (Iniciativa Liberal), BE (Bloco de Esquerda), PCP (Partido Comunista Português), L (Livre), PAN (Pessoas-Animais-Natureza), CDS-PP (CDS - Partido Popular), JPP (Juntos pelo Povo).`;

export function promptDebate(debate) {
  const MAX_CHARS   = 4_000;
  const transcricao = (debate.transcricao ?? '').slice(0, MAX_CHARS);
  const assunto     = debate.assunto ?? debate.artigo ?? 'Sessão Plenária';

  return `${INSTRUCOES_BASE}

Resume este debate parlamentar em 4-5 frases. Identifica os temas principais, as posições dos partidos e os pontos de discórdia ou consenso.

Data: ${debate.data_debate ?? '—'}
Assunto: ${assunto}

Transcrição (excerto):
${transcricao}`;
}

export function promptIniciativa(ini) {
  const autores = (ini.autores_gp ?? []).map(a => a.GP).filter(Boolean).join(', ')
    || (ini.autores_dep ?? []).map(a => a.nome).filter(Boolean).slice(0, 3).join(', ')
    || 'desconhecido';

  return `${INSTRUCOES_BASE}

Resume esta iniciativa legislativa em 2-3 frases. Foca-te no que propõe e no impacto esperado. Sem jargão político.

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

  return `${INSTRUCOES_BASE}

Com base nas iniciativas abaixo, resume em 3-4 frases a actividade parlamentar do deputado ${dep.nome_parlamentar} (${dep.partido_sigla || '—'}, círculo de ${dep.circulo || '—'}). Identifica os principais temas e áreas de interesse.

Iniciativas apresentadas:
${lista}`;
}

export function promptVotacao(vot, ini) {
  const gp = vot.detalhe_gp ?? {};
  const favor      = (gp.favor      ?? []).join(', ') || '—';
  const contra     = (gp.contra     ?? []).join(', ') || '—';
  const abstencao  = (gp.abstencao  ?? []).join(', ') || '—';
  const contexto   = ini?.resumo_ia ?? ini?.titulo ?? '—';

  return `${INSTRUCOES_BASE}

Resume em 2-3 frases o resultado desta votação parlamentar. Explica o que foi votado, o resultado e as posições dos partidos.

Iniciativa: ${ini?.titulo ?? '—'}
Tipo: ${ini?.desc_tipo ?? '—'}
Contexto: ${contexto}
Fase: ${vot.fase ?? '—'}
Resultado: ${vot.resultado ?? '—'}${vot.unanime ? ' (unânime)' : ''}
A Favor: ${favor}
Contra: ${contra}
Abstenção: ${abstencao}`;
}

export const TEMAS_DISPONIVEIS = [
  'Saúde', 'Educação', 'Habitação', 'Ambiente', 'Economia',
  'Justiça', 'Segurança', 'Trabalho', 'Transportes', 'Cultura',
  'Administração Pública', 'Relações Externas', 'Social', 'Tecnologia', 'Agricultura',
];

export function promptTemas(ini) {
  return `Classifica esta iniciativa parlamentar portuguesa em 1 a 3 temas da lista. Responde APENAS com um array JSON válido, sem texto extra.

Temas disponíveis: ${JSON.stringify(TEMAS_DISPONIVEIS)}

Tipo: ${ini.desc_tipo || ini.tipo || '—'}
Título: ${ini.titulo || '—'}
Epígrafe: ${ini.epigrafe || '—'}`;
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
