/**
 * Função pura de propósito (mesmo espírito de rotuloEvento/resolverMovimento): o timer roda num
 * `setInterval` no componente, mas o formato "quantos segundos viram que texto" é testável
 * isoladamente sem precisar de fake timers montando o componente inteiro.
 */
export function formatarDuracao(segundosTotais: number): string {
  const segundos = Math.max(0, Math.floor(segundosTotais))
  const horas = Math.floor(segundos / 3600)
  const minutos = Math.floor((segundos % 3600) / 60)
  const resto = segundos % 60

  const mm = String(minutos).padStart(2, '0')
  const ss = String(resto).padStart(2, '0')

  return horas > 0 ? `${horas}:${mm}:${ss}` : `${mm}:${ss}`
}
