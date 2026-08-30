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
    return <p className="mensagem-carregando">Carregando…</p>
  }

  if (pendentesQuery.isError) {
    return <p className="mensagem-erro">Não foi possível carregar as solicitações pendentes.</p>
  }

  return (
    <section className="secao">
      <h2 className="secao-titulo">📥 Solicitações pendentes</h2>
      {pendentesQuery.data.length === 0 && <p className="mensagem-vazia">Nenhuma solicitação pendente.</p>}
      <ul className="lista-cartoes">
        {pendentesQuery.data.map((solicitacao) => (
          <li key={solicitacao.id} className="cartao-item">
            <div className="cartao-item-cabecalho">
              <span className="cartao-item-titulo">{solicitacao.usuarioNome}</span>
              <span className="badge">{RÓTULOS_TIPO[solicitacao.tipoSolicitado]}</span>
            </div>
            <div className="cartao-item-corpo">
              <p className="cartao-item-meta">{solicitacao.momentoSolicitado}</p>
              <p>{solicitacao.justificativa}</p>

              <div className="linha-botoes">
                <button type="button" onClick={() => aprovarMutation.mutate(solicitacao.id)}>
                  ✅ Aprovar
                </button>

                <div className="campo" style={{ flex: 1, minWidth: '160px' }}>
                  <label htmlFor={`parecer-${solicitacao.id}`}>Parecer</label>
                  <input
                    id={`parecer-${solicitacao.id}`}
                    value={pareceres[solicitacao.id] ?? ''}
                    onChange={(evento) =>
                      setPareceres((atual) => ({ ...atual, [solicitacao.id]: evento.target.value }))
                    }
                  />
                </div>
                <button
                  type="button"
                  className="botao-perigo"
                  onClick={() =>
                    rejeitarMutation.mutate({ id: solicitacao.id, parecer: pareceres[solicitacao.id] ?? '' })
                  }
                >
                  ❌ Rejeitar
                </button>
              </div>

              {rejeitarMutation.isError && rejeitarMutation.variables?.id === solicitacao.id && (
                <p className="mensagem-erro">Não foi possível rejeitar: informe um parecer.</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
