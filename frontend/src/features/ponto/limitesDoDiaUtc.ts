/**
 * Início/fim do dia civil em UTC (mesma convenção do backend, ver javadoc de `JornadaService`:
 * "Dia é sempre o dia civil em UTC") - usado pra pedir o tempo apontado em cada tarefa só de hoje
 * (`listarTotalApontadoPorCard`). Recebe `agora` em vez de chamar `new Date()` sozinho, mesmo
 * espírito de `Clock` injetado no backend - deixa a função pura e testável.
 */
export function calcularLimitesDoDiaUtc(agora: Date): { inicio: string; fim: string } {
  const inicio = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate()))
  const fim = new Date(inicio.getTime() + 24 * 60 * 60 * 1000)
  return { inicio: inicio.toISOString(), fim: fim.toISOString() }
}
