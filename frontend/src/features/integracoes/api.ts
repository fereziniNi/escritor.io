import { apiFetch } from '../../shared/api/http'
import type { ConfiguracaoRelatorioDiario, EstadoWhatsApp, PreferenciasConteudoRelatorioDiario } from './types'

/** ADMIN-only no backend (`WhatsAppIntegracaoController`) - pedido do cliente: "o codigo QR code
 * poderia ficar na plataforma que voce programou??". */
export async function buscarEstadoWhatsApp(): Promise<EstadoWhatsApp> {
  const response = await apiFetch('/admin/whatsapp/estado')
  if (!response.ok) {
    throw new Error('Não foi possível consultar o status do WhatsApp')
  }
  return response.json()
}

/** ADMIN-only no backend (`ConfiguracaoRelatorioDiarioController`) - pedido do cliente: "o admin
 * pode escolher a hora do dia para receber um documento sobre o que foi feito no dia pelos
 * funcionarios". */
export async function buscarConfiguracaoRelatorioDiario(): Promise<ConfiguracaoRelatorioDiario> {
  const response = await apiFetch('/admin/relatorio-diario')
  if (!response.ok) {
    throw new Error('Não foi possível consultar a configuração do resumo diário')
  }
  return response.json()
}

export async function atualizarConfiguracaoRelatorioDiario(dados: {
  horarioEnvio: string
  habilitado: boolean
  preferencias: PreferenciasConteudoRelatorioDiario
}): Promise<ConfiguracaoRelatorioDiario> {
  const response = await apiFetch('/admin/relatorio-diario', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    // `preferencias` vem "espalhada" no corpo (não aninhada) - é assim que o backend
    // (`AtualizarConfiguracaoRelatorioDiarioRequest`) espera os seis campos `incluir*`.
    body: JSON.stringify({
      horarioEnvio: dados.horarioEnvio,
      habilitado: dados.habilitado,
      incluirPonto: dados.preferencias.ponto,
      incluirTarefasCriadasMovidas: dados.preferencias.tarefasCriadasMovidas,
      incluirTarefasConcluidas: dados.preferencias.tarefasConcluidas,
      incluirReunioes: dados.preferencias.reunioes,
      incluirAusencias: dados.preferencias.ausencias,
      incluirResumoEquipe: dados.preferencias.resumoEquipe,
    }),
  })
  if (!response.ok) {
    throw new Error('Não foi possível salvar o horário do resumo diário')
  }
  return response.json()
}
