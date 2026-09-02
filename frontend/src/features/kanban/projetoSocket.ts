/**
 * Monta a URL de `/ws/projeto/{id}` (S3.11). O WebSocket nativo do browser não permite setar o
 * header Authorization no handshake, então o access token viaja como query param - único lugar
 * do app onde isso acontece (ver backend: ProjetoHandshakeInterceptor). `origem` recebe
 * `window.location.origin` em produção; é parâmetro explícito aqui só pra função ficar pura e
 * testável sem depender de `window` global.
 */
export function construirUrlWebSocketProjeto(projetoId: number, token: string, origem: string): string {
  const origemWs = origem.replace(/^http/, 'ws')
  return `${origemWs}/ws/projeto/${projetoId}?token=${encodeURIComponent(token)}`
}
