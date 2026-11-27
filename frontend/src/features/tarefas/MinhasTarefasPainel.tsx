import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { listarProjetos } from '../organizacao/api'
import { criarTarefa, listarMinhasTarefas, mudarEstadoTarefa } from './api'
import { finalizarCronometro } from '../kanban/api'
import { corDoProjeto } from './corDoProjeto'
import type { EstadoTarefa, Tarefa } from './types'
import './MinhasTarefas.css'

const ESTADOS: ReadonlyArray<{ valor: EstadoTarefa; rotulo: string }> = [
  { valor: 'A_FAZER', rotulo: 'A fazer' },
  { valor: 'EM_ANDAMENTO', rotulo: 'Em andamento' },
  { valor: 'FEITO', rotulo: 'Feito' },
]

const FILTRO_TODOS = 'todos'
const FILTRO_SEM_PROJETO = 'pessoal'

/** Data de hoje no calendário local como 'YYYY-MM-DD' (sem passar por UTC). */
function hojeLocal(): string {
  const agora = new Date()
  const dois = (n: number) => String(n).padStart(2, '0')
  return `${agora.getFullYear()}-${dois(agora.getMonth() + 1)}-${dois(agora.getDate())}`
}

/** 'YYYY-MM-DD' -> 'DD/MM/YYYY' por manipulação de texto, sem Date. */
function formatarPrazo(prazo: string): string {
  const [ano, mes, dia] = prazo.split('-')
  return `${dia}/${mes}/${ano}`
}

export function MinhasTarefasPainel({ aoAbrirTarefa }: { aoAbrirTarefa: (projetoId: number, cardId: number) => void }) {
  const queryClient = useQueryClient()
  const [filtro, setFiltro] = useState(FILTRO_TODOS)
  const [titulo, setTitulo] = useState('')
  const [projetoNovo, setProjetoNovo] = useState('')
  const [prazoNovo, setPrazoNovo] = useState('')

  // Tarefa cujo mini-formulário de conclusão está aberto (uma por vez) e o texto digitado
  const [concluindoId, setConcluindoId] = useState<number | null>(null)
  const [descricaoConclusao, setDescricaoConclusao] = useState('')

  const tarefasQuery = useQuery({ queryKey: ['tarefas'], queryFn: listarMinhasTarefas })
  const projetosQuery = useQuery({ queryKey: ['projetos'], queryFn: listarProjetos })

  const estadoMutation = useMutation({
    mutationFn: ({ cardId, estado }: { cardId: number; estado: EstadoTarefa }) => mudarEstadoTarefa(cardId, estado),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['tarefas'] }),
  })

  const concluirMutation = useMutation({
    mutationFn: ({ cardId, descricao }: { cardId: number; descricao: string }) => finalizarCronometro(cardId, descricao),
    onSuccess: async () => {
      setConcluindoId(null)
      setDescricaoConclusao('')
      await queryClient.invalidateQueries({ queryKey: ['tarefas'] })
    },
  })

  function abrirConclusao(cardId: number) {
    concluirMutation.reset()
    setDescricaoConclusao('')
    setConcluindoId(cardId)
  }

  function cancelarConclusao() {
    concluirMutation.reset()
    setConcluindoId(null)
    setDescricaoConclusao('')
  }

  const criarMutation = useMutation({
    mutationFn: criarTarefa,
    onSuccess: () => {
      setTitulo('')
      return queryClient.invalidateQueries({ queryKey: ['tarefas'] })
    },
  })

  function enviar(evento: FormEvent) {
    evento.preventDefault()
    const tituloLimpo = titulo.trim()
    if (!tituloLimpo) return
    criarMutation.mutate({
      titulo: tituloLimpo,
      projetoId: projetoNovo === '' ? null : Number(projetoNovo),
      prazo: prazoNovo === '' ? null : prazoNovo,
      estimativaMinutos: null,
    })
  }

  const hoje = hojeLocal()
  const todas = tarefasQuery.data ?? []
  const visiveis = todas.filter((t) => {
    if (filtro === FILTRO_TODOS) return true
    if (filtro === FILTRO_SEM_PROJETO) return t.pessoal
    return !t.pessoal && t.projetoId === Number(filtro)
  })

  function itemDaTarefa(t: Tarefa) {
    const cor = corDoProjeto(t.projetoId)
    const opcoes = ESTADOS.filter((e) => e.valor === t.estado || (t.estadosDisponiveis ?? []).includes(e.valor))
    const urgente = t.estado !== 'FEITO' && t.prazo !== null && t.prazo <= hoje
    const finalizada = t.concluidoEm !== null
    const etapaUnica = opcoes.length === 1
    const rotuloEtapa = opcoes[0]?.rotulo
    const dicaId = `tarefa-dica-${t.cardId}`
    let dicaSeletor: string | undefined
    if (finalizada) dicaSeletor = 'Tarefa já finalizada'
    else if (etapaUnica) dicaSeletor = `Este projeto só tem a etapa "${rotuloEtapa}". Use "Concluir" para finalizar a tarefa.`
    const concluindo = concluindoId === t.cardId
    return (
      <li key={t.cardId} className="tarefa-item">
        <div className="tarefa-item-linha">
          <button type="button" className="tarefa-titulo" onClick={() => aoAbrirTarefa(t.projetoId, t.cardId)}>
            {t.titulo}
          </button>
          <select
            aria-label={`Estado de ${t.titulo}`}
            value={t.estado}
            disabled={etapaUnica || finalizada}
            title={dicaSeletor}
            aria-describedby={dicaSeletor ? dicaId : undefined}
            onChange={(e) => estadoMutation.mutate({ cardId: t.cardId, estado: e.target.value as EstadoTarefa })}
          >
            {opcoes.map((e) => (
              <option key={e.valor} value={e.valor}>
                {e.rotulo}
              </option>
            ))}
          </select>
          {dicaSeletor && (
            <span id={dicaId} className="sr-only">
              {dicaSeletor}
            </span>
          )}
        </div>
        <div className="tarefa-item-meta">
          {!t.pessoal && t.projetoNome && (
            <span className="badge tarefa-etiqueta" style={{ background: cor.fundo, color: cor.texto }}>
              {t.projetoNome}
            </span>
          )}
          {t.prazo && (
            <span className={urgente ? 'tarefa-prazo tarefa-prazo--urgente' : 'tarefa-prazo'}>
              Prazo: {formatarPrazo(t.prazo)}
            </span>
          )}
          {t.estado !== 'FEITO' && !concluindo && (
            <button type="button" className="tarefa-concluir" onClick={() => abrirConclusao(t.cardId)}>
              Concluir
            </button>
          )}
        </div>
        {concluindo && (
          <form
            className="tarefa-concluir-form"
            onSubmit={(e) => {
              e.preventDefault()
              const descricao = descricaoConclusao.trim()
              if (!descricao || concluirMutation.isPending) return
              concluirMutation.mutate({ cardId: t.cardId, descricao })
            }}
          >
            <label htmlFor={`concluir-${t.cardId}`}>O que foi feito?</label>
            <input
              id={`concluir-${t.cardId}`}
              aria-label={`Descrição da conclusão de ${t.titulo}`}
              value={descricaoConclusao}
              onChange={(e) => setDescricaoConclusao(e.target.value)}
              autoFocus
            />
            <div className="tarefa-concluir-acoes">
              <button
                type="submit"
                className="tarefa-concluir tarefa-concluir--confirmar"
                disabled={!descricaoConclusao.trim() || concluirMutation.isPending}
              >
                Confirmar conclusão
              </button>
              <button type="button" className="tarefa-concluir" onClick={cancelarConclusao}>
                Cancelar
              </button>
            </div>
          </form>
        )}
      </li>
    )
  }

  return (
    <div className="minhas-tarefas">
      <form className="minhas-tarefas-form" onSubmit={enviar}>
        <h3>Nova tarefa</h3>
        <div className="campo">
          <label htmlFor="nova-tarefa-titulo">Título da nova tarefa</label>
          <input id="nova-tarefa-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="nova-tarefa-projeto">Projeto da nova tarefa</label>
          <select id="nova-tarefa-projeto" value={projetoNovo} onChange={(e) => setProjetoNovo(e.target.value)}>
            <option value="">Sem projeto</option>
            {(projetosQuery.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="nova-tarefa-prazo">Prazo da nova tarefa</label>
          <input id="nova-tarefa-prazo" type="date" value={prazoNovo} onChange={(e) => setPrazoNovo(e.target.value)} />
        </div>
        <button type="submit" disabled={criarMutation.isPending}>
          Adicionar
        </button>
        {criarMutation.isError && <p className="mensagem-erro" role="alert">{criarMutation.error.message}</p>}
      </form>

      <div className="campo">
        <label htmlFor="tarefas-filtro">Filtrar por projeto</label>
        <select id="tarefas-filtro" value={filtro} onChange={(e) => setFiltro(e.target.value)}>
          <option value={FILTRO_TODOS}>Todos</option>
          {(projetosQuery.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
          <option value={FILTRO_SEM_PROJETO}>Sem projeto</option>
        </select>
      </div>

      {estadoMutation.isError && <p className="mensagem-erro" role="alert">{estadoMutation.error.message}</p>}
      {concluirMutation.isError && <p className="mensagem-erro" role="alert">{concluirMutation.error.message}</p>}
      {tarefasQuery.isError && <p className="mensagem-erro" role="alert">{tarefasQuery.error.message}</p>}

      {tarefasQuery.isSuccess && visiveis.length === 0 && <p className="cartao-item-meta">Você não tem tarefas.</p>}

      {tarefasQuery.isSuccess &&
        visiveis.length > 0 &&
        ESTADOS.map(({ valor, rotulo }) => {
          const itens = visiveis.filter((t) => t.estado === valor)
          if (valor === 'FEITO') {
            return (
              <section key={valor} aria-label={rotulo} className="tarefas-grupo">
                <details>
                  <summary>
                    {rotulo} ({itens.length})
                  </summary>
                  <ul className="tarefas-lista">{itens.map(itemDaTarefa)}</ul>
                </details>
              </section>
            )
          }
          return (
            <section key={valor} aria-label={rotulo} className="tarefas-grupo">
              <h3>
                {rotulo} ({itens.length})
              </h3>
              <ul className="tarefas-lista">{itens.map(itemDaTarefa)}</ul>
            </section>
          )
        })}
    </div>
  )
}
