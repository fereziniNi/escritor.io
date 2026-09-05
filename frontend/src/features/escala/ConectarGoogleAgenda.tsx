import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { buscarEstadoGoogle, desconectarGoogle, iniciarConexaoGoogle } from './api'

/**
 * Pedido do usuário: "algo muito parecido com o agenda do google... ou ate mesmo integrar" - cada
 * usuário conecta a própria conta Google uma vez; a partir daí a escala dele é publicada como
 * eventos no Google Agenda dele mesmo (via mão única, `GoogleCalendarSincronizacaoService` no
 * backend). Sem credenciais da Google configuradas neste ambiente (`habilitado=false`), o widget
 * não renderiza nada - não faz sentido mostrar "Conectar" pra algo que o admin ainda não configurou.
 */
export function ConectarGoogleAgenda() {
  const queryClient = useQueryClient()
  const estadoQuery = useQuery({ queryKey: ['google', 'estado'], queryFn: buscarEstadoGoogle })

  const conectarMutation = useMutation({
    mutationFn: iniciarConexaoGoogle,
    onSuccess: (url) => {
      window.location.href = url
    },
  })
  const desconectarMutation = useMutation({
    mutationFn: desconectarGoogle,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['google', 'estado'] }),
  })

  if (estadoQuery.isPending || estadoQuery.isError || !estadoQuery.data.habilitado) {
    return null
  }

  return (
    <section className="secao cartao">
      <h2 className="secao-titulo">📅 Google Agenda</h2>
      {estadoQuery.data.conectado ? (
        <div className="linha-botoes">
          <p className="mensagem-sucesso">✅ Sua escala está sendo publicada no seu Google Agenda.</p>
          <button
            type="button"
            className="botao-secundario"
            disabled={desconectarMutation.isPending}
            onClick={() => desconectarMutation.mutate()}
          >
            Desconectar
          </button>
        </div>
      ) : (
        <div className="linha-botoes">
          <p className="mensagem-vazia">Conecte sua conta pra ver a sua escala direto no Google Agenda.</p>
          <button type="button" disabled={conectarMutation.isPending} onClick={() => conectarMutation.mutate()}>
            Conectar Google Agenda
          </button>
        </div>
      )}
      {(conectarMutation.isError || desconectarMutation.isError) && (
        <p className="mensagem-erro">Não foi possível falar com o Google Agenda agora - tente de novo em instantes.</p>
      )}
    </section>
  )
}
