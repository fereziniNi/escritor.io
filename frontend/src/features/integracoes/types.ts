export type SituacaoWhatsApp = 'CONECTADO' | 'AGUARDANDO_QRCODE' | 'INDISPONIVEL'

export interface EstadoWhatsApp {
  situacao: SituacaoWhatsApp
  qrCodeBase64: string | null
  mensagem: string | null
}

/** Pedido do usuário: "adicionar mais informações no relatório diário, mas deixe personalizado
 * para o admin" - cada campo liga/desliga um bloco de conteúdo do resumo (ver
 * `RelatorioDiarioService` no backend). `ponto`/`tarefasCriadasMovidas` são o comportamento de
 * sempre; os outros três são blocos novos, opt-in. */
export interface PreferenciasConteudoRelatorioDiario {
  ponto: boolean
  tarefasCriadasMovidas: boolean
  tarefasConcluidas: boolean
  reunioes: boolean
  ausencias: boolean
  resumoEquipe: boolean
}

/** `horarioEnvio` vem do backend como "HH:mm:ss" (java.time.LocalTime) - `configurado=false`
 * significa que nenhum admin escolheu um horário ainda (diferente de `habilitado=false`, que é
 * "já configurado, mas pausado de propósito"). */
export interface ConfiguracaoRelatorioDiario {
  configurado: boolean
  horarioEnvio: string | null
  habilitado: boolean
  preferencias: PreferenciasConteudoRelatorioDiario
}
