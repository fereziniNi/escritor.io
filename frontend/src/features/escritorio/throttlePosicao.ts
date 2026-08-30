/**
 * PRD §4 (E5): "Movimento enviado ao servidor no máximo a cada 100 ms". Só limita a *rede* - o
 * movimento local (predição) continua imediato a cada tecla, não passa por aqui. Throttle de
 * borda final (trailing): se chegar uma posição nova dentro da janela, ela substitui a pendente e
 * é mandada assim que a janela fechar, garantindo que a posição final sempre chega no servidor
 * mesmo que o usuário solte a tecla no meio da janela - uma versão de borda inicial (leading)
 * simples poderia descartar esse último movimento sem nunca reenviar.
 */
export function criarEnviadorComThrottle(
  enviar: (x: number, y: number) => void,
  atrasoMs: number,
  agora: () => number = Date.now,
): (x: number, y: number) => void {
  let ultimoEnvio = -Infinity
  let timeoutPendente: ReturnType<typeof setTimeout> | null = null
  let posicaoPendente: { x: number; y: number } | null = null

  return function agendarEnvio(x: number, y: number) {
    const decorrido = agora() - ultimoEnvio

    if (decorrido >= atrasoMs) {
      ultimoEnvio = agora()
      enviar(x, y)
      return
    }

    posicaoPendente = { x, y }
    if (timeoutPendente) {
      return
    }
    timeoutPendente = setTimeout(() => {
      timeoutPendente = null
      ultimoEnvio = agora()
      if (posicaoPendente) {
        enviar(posicaoPendente.x, posicaoPendente.y)
        posicaoPendente = null
      }
    }, atrasoMs - decorrido)
  }
}
