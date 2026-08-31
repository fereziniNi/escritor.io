import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { buscarEstadoAtual, marcarPonto } from './api'

/**
 * Pedido do usuário: "quero que remova o saída e iniciar pausa" - o card vira só um "start do
 * dia". Pausa/saída continuam existindo no backend (`SequenciaMarcacao`, PRD E1) - só não têm mais
 * botão aqui; quem mostra quando a pessoa saiu agora é o sistema de presença do mapa (avatar
 * OFFLINE, ver `PresencaWebSocketHandler`), não mais uma marcação formal por esta tela. Depois de
 * "Iniciar trabalho", `proximasOpcoes` nunca mais inclui `ENTRADA` de novo no mesmo dia
 * (`SequenciaMarcacao.tiposValidosApos`) - o card fica só com a mensagem de confirmação.
 */
export function PontoWidget() {
  const queryClient = useQueryClient()

  const estadoQuery = useQuery({ queryKey: ['ponto', 'estado-atual'], queryFn: buscarEstadoAtual })

  const marcarMutation = useMutation({
    mutationFn: marcarPonto,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ponto', 'estado-atual'] })
      queryClient.invalidateQueries({ queryKey: ['ponto', 'jornada-do-dia'] })
    },
  })

  if (estadoQuery.isPending) {
    return <p className="mensagem-carregando">Carregando…</p>
  }

  if (estadoQuery.isError) {
    return <p className="mensagem-erro">Não foi possível carregar o estado da marcação.</p>
  }

  const podeIniciarTrabalho = estadoQuery.data.proximasOpcoes.includes('ENTRADA')

  return (
    <section className="cartao">
      <h3 className="secao-titulo">⏱️ Marcar ponto</h3>
      {podeIniciarTrabalho ? (
        <div className="linha-botoes">
          <button type="button" disabled={marcarMutation.isPending} onClick={() => marcarMutation.mutate('ENTRADA')}>
            Iniciar trabalho
          </button>
        </div>
      ) : (
        <p className="mensagem-sucesso">✅ Trabalho já iniciado hoje.</p>
      )}
      {marcarMutation.isError && <p className="mensagem-erro">Não foi possível registrar a marcação.</p>}
    </section>
  )
}
