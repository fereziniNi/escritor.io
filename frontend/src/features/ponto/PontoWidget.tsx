import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { buscarEstadoAtual, marcarPonto } from './api'
import type { TipoRegistroPonto } from './types'

const RÓTULOS: Record<TipoRegistroPonto, string> = {
  ENTRADA: 'Entrada',
  PAUSA_INICIO: 'Iniciar pausa',
  PAUSA_FIM: 'Retomar',
  SAIDA: 'Saída',
}

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

  return (
    <section className="cartao">
      <h3 className="secao-titulo">⏱️ Marcar ponto</h3>
      <div className="linha-botoes">
        {estadoQuery.data.proximasOpcoes.map((tipo) => (
          <button key={tipo} type="button" disabled={marcarMutation.isPending} onClick={() => marcarMutation.mutate(tipo)}>
            {RÓTULOS[tipo]}
          </button>
        ))}
      </div>
      {marcarMutation.isError && <p className="mensagem-erro">Não foi possível registrar a marcação.</p>}
    </section>
  )
}
