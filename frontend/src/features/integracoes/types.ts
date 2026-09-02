export type SituacaoWhatsApp = 'CONECTADO' | 'AGUARDANDO_QRCODE' | 'INDISPONIVEL'

export interface EstadoWhatsApp {
  situacao: SituacaoWhatsApp
  qrCodeBase64: string | null
  mensagem: string | null
}
