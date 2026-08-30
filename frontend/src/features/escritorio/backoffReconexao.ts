/**
 * PRD §4 (E5): "Reconexão automática do WebSocket com backoff exponencial". `tentativa` é
 * zero-based (a primeira reconexão depois de cair usa `tentativa=0`) - dobra a cada tentativa
 * sucessiva sem reconectar, até o teto.
 */
export function calcularAtrasoReconexao(tentativa: number, baseMs: number, maximoMs: number): number {
  return Math.min(baseMs * 2 ** tentativa, maximoMs)
}
