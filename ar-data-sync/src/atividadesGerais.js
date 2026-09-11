/**
 * Descarrega (uma única vez por execução) o ficheiro completo de Atividades
 * XVII — o mesmo usado para "debates" (AtividadesXVII_json.txt) — e devolve o
 * JSON completo. Vários sub-sincronizadores (votos/moções, audições,
 * audiências, deslocações, eventos, orçamento) partilham este fetch em vez
 * de descarregarem cada um o mesmo ficheiro de ~1.6 MB.
 */
import { AR_ENDPOINTS } from './config.js';

let _cache = null;

export async function fetchAtividades() {
  if (_cache) return _cache;
  const res = await fetch(AR_ENDPOINTS.debates.url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ao descarregar ${AR_ENDPOINTS.debates.url}`);
  _cache = await res.json();
  return _cache;
}
