/**
 * Utilitários de formatação de datas, percentagens, etc.
 */

/**
 * Compara dois nomes parlamentares de forma robusta.
 *
 * Regra: dois nomes "correspondem" se partilham o primeiro E o último
 * token (palavras), e cada nome tem pelo menos 2 palavras. Isto cobre
 * variações de nome completo vs. abreviado (ex: "Ana Rita Fonseca" ↔
 * "Ana Fonseca") sem apanhar falsos positivos de substring.
 */
export const nomeCorresponde = (a, b) => {
  if (!a || !b) return false;
  if (a === b) return true;
  const wa = a.split(/\s+/).filter(Boolean);
  const wb = b.split(/\s+/).filter(Boolean);
  if (wa.length < 2 || wb.length < 2) return false;
  return wa[0] === wb[0] && wa.at(-1) === wb.at(-1);
};

/**
 * Formata uma data ISO para o formato português.
 * Ex: "2025-01-15T14:00:00" -> "15 de janeiro de 2025, 14:00"
 */
export const formatarData = (isoString) => {
  const data = new Date(isoString);
  const meses = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];

  const dia = data.getDate();
  const mes = meses[data.getMonth()];
  const ano = data.getFullYear();
  const hora = String(data.getHours()).padStart(2, '0');
  const minutos = String(data.getMinutes()).padStart(2, '0');

  return `${dia} de ${mes} de ${ano}, ${hora}:${minutos}`;
};

/**
 * Formata apenas a data (sem hora).
 */
export const formatarDataCurta = (isoString) => {
  const data = new Date(isoString);
  return data.toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

/**
 * Devolve as iniciais de um nome para usar como placeholder de avatar.
 * Ex: "João Silva Santos" -> "JS"
 */
export const obterIniciais = (nomeCompleto) => {
  if (!nomeCompleto) return '?';
  const partes = nomeCompleto.trim().split(/\s+/);
  if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
};

/**
 * Devolve cor de fundo e texto para um indicador de posição.
 * Usado nos badges de "a favor / contra / neutra".
 */
export const obterEstiloPosicao = (posicao) => {
  switch (posicao) {
    case 'a_favor':
      return {
        bg: 'bg-green-100',
        text: 'text-green-800',
        border: 'border-green-300',
        label: 'A favor',
        icon: '✓'
      };
    case 'contra':
      return {
        bg: 'bg-red-100',
        text: 'text-red-800',
        border: 'border-red-300',
        label: 'Contra',
        icon: '✕'
      };
    case 'neutra':
    default:
      return {
        bg: 'bg-gray-100',
        text: 'text-gray-800',
        border: 'border-gray-300',
        label: 'Neutra',
        icon: '○'
      };
  }
};
