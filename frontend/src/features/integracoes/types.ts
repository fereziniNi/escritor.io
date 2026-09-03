export type SituacaoWhatsApp = 'CONECTADO' | 'AGUARDANDO_QRCODE' | 'INDISPONIVEL'

export interface EstadoWhatsApp {
  situacao: SituacaoWhatsApp
  qrCodeBase64: string | null
  mensagem: string | null
}

/** `horarioEnvio` vem do backend como "HH:mm:ss" (java.time.LocalTime) - `configurado=false`
 * significa que nenhum admin escolheu um horário ainda (diferente de `habilitado=false`, que é
 * "já configurado, mas pausado de propósito"). */
export interface ConfiguracaoRelatorioDiario {
  configurado: boolean
  horarioEnvio: string | null
  habilitado: boolean
}
