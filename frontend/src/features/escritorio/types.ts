import type { AparenciaAvatar } from './avatar/aparenciaAvatar'

export type TipoZona = 'FOCO' | 'REUNIAO' | 'CAFE' | 'ATENDIMENTO' | 'LIVRE' | 'HAPPY_HOUR' | 'CABINE'

/** OFFLINE é automático (backend marca quem desconecta, nunca escolhido manualmente - não aparece
 * em `OPCOES_STATUS`) - o avatar fica estacionado em "Fora do trabalho" até a pessoa reconectar. */
export type StatusAvatar = 'DISPONIVEL' | 'FOCO' | 'REUNIAO' | 'ALMOCO' | 'AUSENTE' | 'OFFLINE'

export interface Zona {
  id: number
  nome: string
  x: number
  y: number
  largura: number
  altura: number
  tipo: TipoZona
}

export interface MapaAtivo {
  id: number
  nome: string
  larguraTiles: number
  alturaTiles: number
  layoutJson: string
  zonas: Zona[]
}

export interface EstadoPresencaUsuario {
  usuarioId: number
  nome: string
  x: number
  y: number
  status: StatusAvatar
  aparencia: AparenciaAvatar
}

/** Pedido do usuário: "chamar para reunião pela plataforma" - avisa em tempo real quem foi
 * convidado, se estiver online (ver `PresencaWebSocketHandler#avisarConvite` no backend). Datas/
 * horas como texto, não tipos `Date`/`LocalTime` - só o que precisa aparecer no toast. */
export interface ConviteReuniao {
  reuniaoId: number
  titulo: string
  criadorNome: string
  data: string
  horaInicio: string
  horaFim: string
  linkMeet: string | null
}

/** Pedido do usuário: "chat... em tempo real... Não deve conter atraso" - avisa em tempo real
 * quem participa da conversa, se estiver online (ver `PresencaWebSocketHandler#avisarMensagem` no
 * backend); `mensagemId` (não `id`) de propósito, pra não colidir por engano com o `id` de outra
 * coisa em quem consumir isso - quem usa remonta pro formato de `chat/types.ts#Mensagem`. */
export interface MensagemRecebida {
  conversaId: number
  mensagemId: number
  autorId: number
  autorNome: string
  texto: string
  criadoEm: string
}

/** Pedido do usuário: "sempre que alguém finalizar uma tarefa... notificado ao usuário" - avisa em
 * tempo real o responsável e/ou criador do card, se estiverem online (ver
 * `PresencaWebSocketHandler#avisarTarefaConcluida`/`CardService#avisarSeFinalizouATarefa` no
 * backend - "finalizar" é uma heurística: o card entrou na última coluna do projeto). */
export interface TarefaConcluida {
  cardId: number
  cardTitulo: string
  projetoNome: string
  autorNome: string
}

/** Pedido do usuário: "quando qualquer pessoa adicionar uma tarefa nova... deve informar todos os
 * usuários do sistema... em qual projeto foi" - mesmo shape de {@link TarefaConcluida}, broadcast
 * pra todo mundo conectado (exceto quem criou), não um destinatário específico (ver
 * `PresencaWebSocketHandler#avisarNovaTarefa`/`CardService#criar` no backend). */
export interface NovaTarefa {
  cardId: number
  cardTitulo: string
  projetoNome: string
  autorNome: string
}

/** Pedido do usuário: "uma parte para roleta onde será sorteado qual atividade será feita" -
 * resultado da roleta, transmitido em tempo real pra todo mundo conectado (ver
 * `PresencaWebSocketHandler#avisarSorteioHappyHour`/`HappyHourService#sortear` no backend). */
export interface SorteioHappyHour {
  atividadeId: number
  descricao: string
  sorteadoPorNome: string
}

/** Pedido do usuário: "voice, onde podemos falar dentro da sala... ou com a pessoa mais próxima" -
 * sinalização WebRTC (SDP offer/answer ou ICE candidate) relayada por
 * `PresencaWebSocketHandler#tratarSinalRtc` no backend. `sinal` é opaco tanto lá quanto aqui - só
 * `mundo/useVozProximidade.ts` sabe interpretar o conteúdo (`RTCSessionDescriptionInit` ou
 * `RTCIceCandidateInit`). */
export interface SinalRtcRecebido {
  remetenteId: number
  sinal: unknown
}
