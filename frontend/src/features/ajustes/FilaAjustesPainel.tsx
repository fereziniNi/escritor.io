import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { aprovarSolicitacao, listarPendentes, rejeitarSolicitacao } from './api'

const RÓTULOS_TIPO: Record<string, string> = {
  ENTRADA: 'Entrada',
  PAUSA_INICIO: 'Início de pausa',
  PAUSA_FIM: 'Fim de pausa',
  SAIDA: 'Saída',
}

export function FilaAjustesPainel() {
  const queryClient = useQueryClient()
  const [pareceres, setPareceres] = useState<Record<number, string>>({})

  const pendentesQuery = useQuery({ queryKey: ['ajustes', 'pendentes'], queryFn: listarPendentes })

  const aprovarMutation = useMutation({
    mutationFn: aprovarSolicitacao,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ajustes', 'pendentes'] })
    },
  })

  const rejeitarMutation = useMutation({
    mutationFn: ({ id, parecer }: { id: number; parecer: string }) => rejeitarSolicitacao(id, parecer),
    onSuccess: (_dados, variaveis) => {
      queryClient.invalidateQueries({ queryKey: ['ajustes', 'pendentes'] })
      setPareceres((atual) => {
        const copia = { ...atual }
        delete copia[variaveis.id]
        return copia
      })
    },
  })

  if (pendentesQuery.isPending) {
    return <p>Carregando…</p>
  }

  if (pendentesQuery.isError) {
    return <p>Não foi possível carregar as solicitações pendentes.</p>
  }

  return (
    <section>
      <h2>Solicitações pendentes</h2>
      {pendentesQuery.data.length === 0 && <p>Nenhuma solicitação pendente.</p>}
      <ul>
        {pendentesQuery.data.map((solicitacao) => (
          <li key={solicitacao.id}>
            <p>{solicitacao.usuarioNome}</p>
            <p>
              {RÓTULOS_TIPO[solicitacao.tipoSolicitado]} em {solicitacao.momentoSolicitado}
            </p>
            <p>{solicitacao.justificativa}</p>

            <button type="button" onClick={() => aprovarMutation.mutate(solicitacao.id)}>
              Aprovar
            </button>

            <label htmlFor={`parecer-${solicitacao.id}`}>Parecer</label>
            <input
              id={`parecer-${solicitacao.id}`}
              value={pareceres[solicitacao.id] ?? ''}
              onChange={(evento) =>
                setPareceres((atual) => ({ ...atual, [solicitacao.id]: evento.target.value }))
              }
            />
            <button
              type="button"
              onClick={() =>
                rejeitarMutation.mutate({ id: solicitacao.id, parecer: pareceres[solicitacao.id] ?? '' })
              }
            >
              Rejeitar
            </button>

            {rejeitarMutation.isError && rejeitarMutation.variables?.id === solicitacao.id && (
              <p>Não foi possível rejeitar: informe um parecer.</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
