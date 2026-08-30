import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { criarEquipe, listarEquipes } from './api'

export function EquipesPage() {
  const queryClient = useQueryClient()
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')

  const equipesQuery = useQuery({ queryKey: ['equipes'], queryFn: listarEquipes })

  const criarMutation = useMutation({
    mutationFn: () => criarEquipe(nome, descricao),
    onSuccess: () => {
      setNome('')
      setDescricao('')
      queryClient.invalidateQueries({ queryKey: ['equipes'] })
    },
  })

  return (
    <main className="pagina">
      <div className="pagina-cabecalho">
        <h1>👥 Equipes</h1>
      </div>

      <form
        className="secao cartao"
        onSubmit={(evento) => {
          evento.preventDefault()
          criarMutation.mutate()
        }}
      >
        <div className="formulario">
          <div className="campo">
            <label htmlFor="nome-equipe">Nome</label>
            <input id="nome-equipe" value={nome} onChange={(evento) => setNome(evento.target.value)} required />
          </div>

          <div className="campo">
            <label htmlFor="descricao-equipe">Descrição</label>
            <input
              id="descricao-equipe"
              value={descricao}
              onChange={(evento) => setDescricao(evento.target.value)}
            />
          </div>

          <div className="campo-acoes">
            <button type="submit" disabled={criarMutation.isPending}>
              ➕ Criar equipe
            </button>
            {criarMutation.isError && <p className="mensagem-erro">Não foi possível criar a equipe.</p>}
          </div>
        </div>
      </form>

      {equipesQuery.isPending && <p className="mensagem-carregando">Carregando…</p>}
      {equipesQuery.isError && <p className="mensagem-erro">Não foi possível carregar as equipes.</p>}
      {equipesQuery.data?.length === 0 && <p className="mensagem-vazia">Nenhuma equipe cadastrada ainda.</p>}
      <ul className="lista-cartoes">
        {equipesQuery.data?.map((equipe) => (
          <li key={equipe.id} className="cartao-item cartao-item-titulo">
            {equipe.nome}
          </li>
        ))}
      </ul>
    </main>
  )
}
