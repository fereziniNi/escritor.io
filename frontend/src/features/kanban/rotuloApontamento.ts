import type { Apontamento } from './types'

/**
 * Função pura de propósito (mesmo espírito de `rotuloEvento`): traduz um apontamento (timer ou
 * lançamento manual) pro texto exibido no Histórico do card - pedido do usuário: "eu iniciei o
 * timer de uma atividade... mas ela não ficou marcada no historico!! no historico deve estar o
 * dia hora e quanto tempo foi feita". Desde a remoção do "Iniciar timer" ("Deixe somente os
 * minutos trabalhados"), `fim === null` só pode acontecer num apontamento legado de antes dessa
 * mudança (lançamento manual sempre nasce com início/fim definidos, ver `Apontamento.java`) -
 * mantido aqui só pra exibir esses registros antigos sem quebrar.
 */
export function rotuloApontamento(apontamento: Apontamento): string {
  if (apontamento.fim === null) {
    return 'Timer iniciado, ainda em andamento'
  }

  const origem = apontamento.origem === 'TIMER' ? 'timer' : 'lançamento manual'
  const descricao = apontamento.descricao ? ` — ${apontamento.descricao}` : ''
  return `${apontamento.minutos} min apontados (${origem})${descricao}`
}
