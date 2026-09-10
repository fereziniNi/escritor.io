export type TipoConversa = 'DIRETA' | 'GERAL'

export interface Mensagem {
  id: number
  conversaId: number
  autorId: number
  autorNome: string
  texto: string
  /** ISO-8601 (`Instant` no backend). */
  criadoEm: string
}

/** Pedido do usuário: "chat no sistema para os funcionários poderem conversar e o chefe conversar
 * com os funcionários, além de ter um grupo geral com todos os funcionários" - `DIRETA` cobre os
 * dois primeiros (é a mesma coisa do ponto de vista do modelo, sem distinção de papel), `GERAL` é
 * o terceiro (fixo, um só, todo mundo entra sozinho na primeira vez que abre o chat - ver
 * `ChatService#garantirParticipacaoNaGeral` no backend). `nome`: pra `DIRETA` já vem calculado
 * pelo backend como o nome do OUTRO participante; pra `GERAL` é sempre "Geral".
 */
export interface Conversa {
  id: number
  tipo: TipoConversa
  nome: string
  ultimaMensagem: Mensagem | null
  naoLidas: number
}
