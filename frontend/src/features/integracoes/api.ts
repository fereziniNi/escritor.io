import { apiFetch } from '../../shared/api/http'
import type { EstadoWhatsApp } from './types'

/** ADMIN-only no backend (`WhatsAppIntegracaoController`) - pedido do cliente: "o codigo QR code
 * poderia ficar na plataforma que voce programou??". */
export async function buscarEstadoWhatsApp(): Promise<EstadoWhatsApp> {
  const response = await apiFetch('/admin/whatsapp/estado')
  if (!response.ok) {
    throw new Error('Não foi possível consultar o status do WhatsApp')
  }
  return response.json()
}
