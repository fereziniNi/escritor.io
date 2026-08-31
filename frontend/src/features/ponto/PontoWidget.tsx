import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { buscarEstadoAtual, marcarPonto } from './api'
import type { TipoRegistroPonto } from './types'

const RÓTULOS: Record<TipoRegistroPonto, string> = {
  ENTRADA: 'Iniciar trabalho',
  PAUSA_INICIO: 'Pausar',
  PAUSA_FIM: 'Voltar ao trabalho',
  SAIDA: 'Encerrar trabalho',
}

/** Ordem fixa de exibição, independente da ordem em que `proximasOpcoes` chega do backend (é um
 * `Set` serializado - a ordem do array JSON não é uma garantia de UI, ver `SequenciaMarcacao`). */
const ORDEM_BOTOES: TipoRegistroPonto[] = ['ENTRADA', 'PAUSA_INICIO', 'PAUSA_FIM', 'SAIDA']

/**
 * Pedido do usuário: card com "Pausar" e "Encerrar trabalho" enquanto trabalhando; pausar troca
 * pro botão "Voltar ao trabalho" (mantendo "Encerrar trabalho" visível - o backend agora aceita
 * encerrar direto de uma pausa, sem precisar voltar primeiro, ver `SequenciaMarcacao`); encerrar
 * volta pro botão único "Iniciar trabalho". Sem mensagem de "já iniciado" - sempre mostra ação(ões)
 * de verdade, refletindo só o que `proximasOpcoes` libera a cada momento.
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

  const opcoes = ORDEM_BOTOES.filter((tipo) => estadoQuery.data.proximasOpcoes.includes(tipo))

  return (
    <section className="cartao">
      <h3 className="secao-titulo">⏱️ Marcar ponto</h3>
      <div className="linha-botoes">
        {opcoes.map((tipo) => (
          <button key={tipo} type="button" disabled={marcarMutation.isPending} onClick={() => marcarMutation.mutate(tipo)}>
            {RÓTULOS[tipo]}
          </button>
        ))}
      </div>
      {marcarMutation.isError && <p className="mensagem-erro">Não foi possível registrar a marcação.</p>}
    </section>
  )
}
