import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { Papel } from '../auth/types'
import { formatarMinutos } from '../ponto/formatarMinutos'
import { atualizarCargaDiaria, criarColaborador, listarColaboradores } from './api'
import type { Colaborador } from './types'

const ROTULO_PAPEL: Record<Papel, string> = { COLABORADOR: 'Colaborador', GESTOR: 'Gestor', ADMIN: 'Admin' }

/**
 * Linha de um colaborador com a carga diária editável - o único campo editável hoje (pedido do
 * usuário: "o admin deve definir [a carga diária] pros outros funcionários, não deve ser
 * padrão"). Estado do rascunho é local (`useState`), só vira uma mutação de verdade ao clicar
 * "Salvar" - evita mandar uma requisição a cada tecla digitada.
 */
function LinhaColaborador({ colaborador }: { colaborador: Colaborador }) {
  const queryClient = useQueryClient()
  const [rascunho, setRascunho] = useState(String(colaborador.cargaDiariaMinutos))

  const salvarMutation = useMutation({
    mutationFn: (minutos: number) => atualizarCargaDiaria(colaborador.id, minutos),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['colaboradores'] }),
  })

  const minutosRascunho = Number(rascunho)
  const rascunhoValido = rascunho.trim() !== '' && Number.isInteger(minutosRascunho) && minutosRascunho > 0
  const mudou = rascunhoValido && minutosRascunho !== colaborador.cargaDiariaMinutos

  return (
    <li className="cartao-item">
      <div className="cartao-item-cabecalho">
        <span className="cartao-item-titulo">{colaborador.nome}</span>
        <span className="badge">{ROTULO_PAPEL[colaborador.papel]}</span>
        {!colaborador.ativo && <span className="badge">Inativo</span>}
      </div>
      <p className="cartao-item-meta">{colaborador.email}</p>

      <div className="campo" style={{ marginTop: '0.5rem' }}>
        <label htmlFor={`carga-diaria-${colaborador.id}`}>Carga diária de {colaborador.nome} (minutos)</label>
        <div className="linha-botoes">
          <input
            id={`carga-diaria-${colaborador.id}`}
            type="number"
            min={1}
            value={rascunho}
            onChange={(evento) => setRascunho(evento.target.value)}
          />
          <button
            type="button"
            disabled={!mudou || salvarMutation.isPending}
            onClick={() => salvarMutation.mutate(minutosRascunho)}
          >
            Salvar
          </button>
        </div>
        <p className="cartao-item-meta">
          Hoje: {formatarMinutos(colaborador.cargaDiariaMinutos)}
          {rascunhoValido && minutosRascunho !== colaborador.cargaDiariaMinutos && ` → ${formatarMinutos(minutosRascunho)}`}
        </p>
        {salvarMutation.isError && <p className="mensagem-erro">Não foi possível atualizar a carga diária.</p>}
        {salvarMutation.isSuccess && !mudou && <p className="mensagem-sucesso">✅ Carga diária atualizada.</p>}
      </div>
    </li>
  )
}

export function ColaboradoresPage() {
  const queryClient = useQueryClient()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [papel, setPapel] = useState<Papel>('COLABORADOR')
  const [cargaDiariaMinutos, setCargaDiariaMinutos] = useState('480')

  const colaboradoresQuery = useQuery({ queryKey: ['colaboradores'], queryFn: listarColaboradores })

  const criarMutation = useMutation({
    mutationFn: () => criarColaborador({ nome, email, papel, cargaDiariaMinutos: Number(cargaDiariaMinutos) }),
    onSuccess: () => {
      setNome('')
      setEmail('')
      setPapel('COLABORADOR')
      setCargaDiariaMinutos('480')
      queryClient.invalidateQueries({ queryKey: ['colaboradores'] })
    },
  })

  return (
    <main className="pagina">
      <div className="pagina-cabecalho">
        <h1>🧑‍💼 Colaboradores</h1>
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
            <label htmlFor="nome-colaborador">Nome</label>
            <input id="nome-colaborador" value={nome} onChange={(evento) => setNome(evento.target.value)} required />
          </div>

          <div className="campo">
            <label htmlFor="email-colaborador">E-mail</label>
            <input
              id="email-colaborador"
              type="email"
              value={email}
              onChange={(evento) => setEmail(evento.target.value)}
              required
            />
          </div>

          <div className="campo">
            <label htmlFor="papel-colaborador">Papel</label>
            <select id="papel-colaborador" value={papel} onChange={(evento) => setPapel(evento.target.value as Papel)}>
              <option value="COLABORADOR">Colaborador</option>
              <option value="GESTOR">Gestor</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>

          <div className="campo">
            <label htmlFor="carga-diaria-colaborador">Carga diária (minutos)</label>
            <input
              id="carga-diaria-colaborador"
              type="number"
              min={1}
              value={cargaDiariaMinutos}
              onChange={(evento) => setCargaDiariaMinutos(evento.target.value)}
              required
            />
          </div>

          <div className="campo-acoes">
            <button type="submit" disabled={criarMutation.isPending}>
              ➕ Criar colaborador
            </button>
            {criarMutation.isError && <p className="mensagem-erro">Não foi possível criar o colaborador.</p>}
          </div>
        </div>
      </form>

      {colaboradoresQuery.isPending && <p className="mensagem-carregando">Carregando…</p>}
      {colaboradoresQuery.isError && <p className="mensagem-erro">Não foi possível carregar os colaboradores.</p>}
      {colaboradoresQuery.data?.length === 0 && <p className="mensagem-vazia">Nenhum colaborador cadastrado ainda.</p>}
      <ul className="lista-cartoes">
        {colaboradoresQuery.data?.map((colaborador) => (
          <LinhaColaborador key={colaborador.id} colaborador={colaborador} />
        ))}
      </ul>
    </main>
  )
}
