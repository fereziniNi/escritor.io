/**
 * Monta a URL de `/ws/presenca` (S6.3), mesmo mecanismo de `construirUrlWebSocketProjeto`
 * (kanban, S3.11): o WebSocket nativo do browser não permite header `Authorization` no
 * handshake, então o token viaja como query param. Diferente de projeto, não há id de recurso -
 * o canal de presença é global, um só pra todo mundo autenticado.
 */
export function construirUrlWebSocketPresenca(token: string, origem: string): string {
  const origemWs = origem.replace(/^http/, 'ws')
  return `${origemWs}/ws/presenca?token=${encodeURIComponent(token)}`
}
