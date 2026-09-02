import { rotuloApontamento } from './rotuloApontamento'
import { rotuloEvento } from './rotuloEvento'
import type { Apontamento, EventoCard } from './types'

export interface LinhaHistorico {
  chave: string
  quando: string
  rotulo: string
}

/**
 * Pedido do usuário: "no historico deve estar o dia hora e quanto tempo foi feita" - o Histórico
 * do card mostrava só eventos de ciclo de vida (`EventoCard`: criação, mudança de coluna/
 * responsável), nunca o tempo apontado. Função pura de propósito (mesmo espírito de
 * `resolverMovimento`/`moverCardOtimista`): mescla os dois tipos de registro numa única linha do
 * tempo, ordenada cronologicamente por quando cada coisa realmente aconteceu - `criadoEm` pro
 * evento, `inicio` pro apontamento (não `criadoEm` dele: um lançamento manual pode registrar um
 * intervalo no passado, e é esse horário que importa pro histórico, não quando foi digitado).
 */
export function mesclarHistorico(eventos: EventoCard[], apontamentos: Apontamento[]): LinhaHistorico[] {
  const linhasEventos: LinhaHistorico[] = eventos.map((evento) => ({
    chave: `evento-${evento.id}`,
    quando: evento.criadoEm,
    rotulo: rotuloEvento(evento),
  }))

  const linhasApontamentos: LinhaHistorico[] = apontamentos.map((apontamento) => ({
    chave: `apontamento-${apontamento.id}`,
    quando: apontamento.inicio,
    rotulo: rotuloApontamento(apontamento),
  }))

  return [...linhasEventos, ...linhasApontamentos].sort(
    (a, b) => new Date(a.quando).getTime() - new Date(b.quando).getTime(),
  )
}
