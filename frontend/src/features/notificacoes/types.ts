/** Espelha `NotificacoesResponse`/`NotificacaoResponse` do backend (`notificacao/web`). Só os
 * quatro tipos que já viravam toast/alerta passageiro - ver comentário do domínio no backend pra
 * por que mensagem de chat e "alguém está perto" ficam de fora. */
export type TipoNotificacao = 'CONVITE_REUNIAO' | 'TAREFA_CONCLUIDA' | 'NOVA_TAREFA' | 'SORTEIO_HAPPY_HOUR'

export interface Notificacao {
  id: number
  tipo: TipoNotificacao
  texto: string
  link: string | null
  lida: boolean
  criadoEm: string
}

export interface Notificacoes {
  itens: Notificacao[]
  naoLidas: number
}
