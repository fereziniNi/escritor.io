import { useQuery } from '@tanstack/react-query'
import { buscarEstadoWhatsApp } from './api'

/**
 * Pedido do cliente: "o codigo QR code poderia ficar na plataforma que voce programou??" - antes
 * o pareamento exigia rodar `curl` na mão (ver DEVELOPMENT.md); agora o admin abre esta tela e vê
 * o QR code direto (backend: `WhatsAppIntegracaoController`/`EvolutionInstanceService`). Só ADMIN
 * chega aqui - o botão que abre este painel já é escondido pro resto (ver `BarraFerramentas`), e o
 * endpoint em si também é `@PreAuthorize("hasRole('ADMIN')")`.
 *
 * `refetchInterval` curto enquanto não conectado: o admin escaneia o QR num celular separado, não
 * tem nenhum evento no navegador pra avisar "conectou" - só descobrir perguntando de novo.
 * Desliga o polling assim que `CONECTADO` (nada mais pra esperar).
 */
export function IntegracaoWhatsAppPage() {
  const estadoQuery = useQuery({
    queryKey: ['whatsapp', 'estado'],
    queryFn: buscarEstadoWhatsApp,
    refetchInterval: (query) => (query.state.data?.situacao === 'CONECTADO' ? false : 3000),
  })

  return (
    <main className="pagina">
      <div className="pagina-cabecalho">
        <h1>📱 WhatsApp</h1>
      </div>

      <section className="secao cartao">
        {estadoQuery.isPending && <p className="mensagem-carregando">Carregando…</p>}
        {estadoQuery.isError && <p className="mensagem-erro">Não foi possível consultar o status do WhatsApp.</p>}

        {estadoQuery.data?.situacao === 'CONECTADO' && (
          <p className="mensagem-sucesso">✅ Conectado! Os avisos de ponto (entrada/saída) já estão sendo enviados.</p>
        )}

        {estadoQuery.data?.situacao === 'AGUARDANDO_QRCODE' &&
          (estadoQuery.data.qrCodeBase64 ? (
            <div className="whatsapp-qrcode">
              <p>
                Abra o WhatsApp no celular que vai <strong>enviar</strong> os avisos (não precisa ser o do chefe - ele só
                recebe) → <strong>Aparelhos conectados</strong> → <strong>Conectar um aparelho</strong> e escaneie:
              </p>
              <img src={estadoQuery.data.qrCodeBase64} alt="QR code para conectar o WhatsApp" width={280} height={280} />
              <p className="mensagem-vazia">Atualiza sozinho assim que você escanear - não precisa recarregar a página.</p>
            </div>
          ) : (
            <p className="mensagem-erro">Não foi possível gerar o QR code agora. Tente novamente em instantes.</p>
          ))}

        {estadoQuery.data?.situacao === 'INDISPONIVEL' && (
          <p className="mensagem-erro">{estadoQuery.data.mensagem ?? 'Integração indisponível.'}</p>
        )}
      </section>
    </main>
  )
}
