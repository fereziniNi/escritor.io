import type { Apontamento } from './types'

/**
 * Função pura de propósito (mesmo espírito de `rotuloEvento`): traduz um apontamento (timer ou
 * lançamento manual) pro texto exibido no Histórico do card - pedido do usuário: "eu iniciei o
 * timer de uma atividade... mas ela não ficou marcada no historico!! no historico deve estar o
 * dia hora e quanto tempo foi feita". `fim === null` só acontece com um timer ainda rodando
 * (apontamento manual sempre nasce com início/fim definidos, ver `Apontamento.java`).
 */
export function rotuloApontamento(apontamento: Apontamento): string {
  if (apontamento.fim === null) {
    return 'Timer iniciado, ainda em andamento'
  }

  const origem = apontamento.origem === 'TIMER' ? 'timer' : 'lançamento manual'
  const descricao = apontamento.descricao ? ` — ${apontamento.descricao}` : ''
  return `${apontamento.minutos} min apontados (${origem})${descricao}`
}
