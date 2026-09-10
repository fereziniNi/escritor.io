import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { buscarSorteioAtual, listarAtividades, sortear, sugerirAtividade } from './api'
import type { Atividade } from './types'
import './HappyHour.css'

const CHAVE_ATIVIDADES = ['happy-hour', 'atividades']
const CHAVE_SORTEIO = ['happy-hour', 'sorteio']

/**
 * Pedido do usuário: "ver as atividades para happy hour onde qualquer um pode adicionar uma nova
 * 'atividade' que poderá sugerir" - lista + formulário, mesmo espírito de `ComentariosSecao` do
 * Kanban (REST simples, sem tempo real - quem não estava olhando vê a atividade nova na próxima
 * vez que abrir o painel).
 */
function AtividadesSecao() {
  const queryClient = useQueryClient()
  const [descricao, setDescricao] = useState('')
  const atividadesQuery = useQuery({ queryKey: CHAVE_ATIVIDADES, queryFn: listarAtividades })

  const sugerirMutation = useMutation({
    mutationFn: sugerirAtividade,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHAVE_ATIVIDADES })
      setDescricao('')
    },
  })

  return (
    <div className="happyhour-secao">
      {atividadesQuery.isError && <p className="mensagem-erro">Não foi possível carregar as atividades.</p>}
      {atividadesQuery.data?.length === 0 && <p className="mensagem-vazia">Nenhuma atividade sugerida ainda.</p>}
      {atividadesQuery.data && atividadesQuery.data.length > 0 && (
        <ul className="lista-cartoes" aria-label="Atividades sugeridas">
          {atividadesQuery.data.map((atividade) => (
            <li key={atividade.id} className="cartao-item">
              <div className="cartao-item-cabecalho">
                <span className="cartao-item-titulo">{atividade.descricao}</span>
                {atividade.sorteadaEm !== null && <span className="badge">🎉 Escolhida</span>}
              </div>
              <p className="cartao-item-meta">Sugerida por {atividade.sugeridaPorNome}</p>
            </li>
          ))}
        </ul>
      )}

      <form
        className="formulario"
        onSubmit={(evento) => {
          evento.preventDefault()
          sugerirMutation.mutate(descricao)
        }}
      >
        <div className="campo">
          <label htmlFor="descricao-atividade-happy-hour">Sugerir atividade</label>
          <input
            id="descricao-atividade-happy-hour"
            value={descricao}
            onChange={(evento) => setDescricao(evento.target.value)}
            placeholder="Ex.: Karaokê, boliche, happy hour temático..."
            required
          />
        </div>
        <button type="submit" className="botao-pequeno" disabled={sugerirMutation.isPending}>
          ➕ Sugerir
        </button>
        {sugerirMutation.isError && <p className="mensagem-erro">Não foi possível sugerir a atividade.</p>}
      </form>
    </div>
  )
}

const PALETA_ROLETA = ['#e0546f', '#4472c4', '#e8a33d', '#4f9f6f', '#b8358f', '#3f5a86', '#9c6f38', '#7c6742']

/**
 * Pedido do usuário: "uma parte para roleta onde será sorteado qual atividade será feita" - o
 * resultado é sorteado no SERVIDOR (`POST /happy-hour/sortear`, evita duas pessoas verem
 * respostas diferentes) e chega aqui de dois jeitos: a resposta direta da mutation (quem girou) ou
 * uma refetch desta mesma query, disparada por `EscritorioPage.tsx` quando o evento chega via
 * WebSocket pra quem só está com o painel aberto olhando (`queryClient.invalidateQueries`). Os
 * dois casos convergem na mesma `useQuery` - só reage à MUDANÇA do id sorteado, não reprocessa o
 * mesmo resultado 2x.
 */
function RoletaSecao({ atividades }: { atividades: Atividade[] }) {
  const queryClient = useQueryClient()
  const sorteioQuery = useQuery({ queryKey: CHAVE_SORTEIO, queryFn: buscarSorteioAtual })
  const [rotacaoGraus, setRotacaoGraus] = useState(0)
  const [comAnimacao, setComAnimacao] = useState(false)
  const ultimoIdMostradoRef = useRef<number | undefined>(undefined)

  const sortearMutation = useMutation({
    mutationFn: sortear,
    onSuccess: (atividade) => queryClient.setQueryData(CHAVE_SORTEIO, atividade),
  })

  const atual = sorteioQuery.data ?? null

  useEffect(() => {
    if (!atual || atividades.length === 0 || atual.id === ultimoIdMostradoRef.current) {
      return
    }
    const indice = atividades.findIndex((atividade) => atividade.id === atual.id)
    if (indice === -1) {
      return
    }
    const primeiraVez = ultimoIdMostradoRef.current === undefined
    const anguloPorFatia = 360 / atividades.length
    const anguloDaFatia = indice * anguloPorFatia + anguloPorFatia / 2
    setComAnimacao(!primeiraVez)
    setRotacaoGraus((atualGraus) => {
      // 1ª vez (painel abriu e já tinha um sorteio de antes): mostra parado, sem girar. Depois
      // disso, cada novo sorteio soma voltas extras a partir de um múltiplo "limpo" de 360° pra
      // nunca "rebobinar" pra trás visualmente.
      const base = primeiraVez ? 0 : atualGraus - (atualGraus % 360) + 360 * 3
      return base + (360 - anguloDaFatia)
    })
    ultimoIdMostradoRef.current = atual.id
  }, [atual, atividades])

  const gradiente =
    atividades.length > 0
      ? `conic-gradient(${atividades
          .map((_, indice) => {
            const cor = PALETA_ROLETA[indice % PALETA_ROLETA.length]
            return `${cor} ${(indice * 360) / atividades.length}deg ${((indice + 1) * 360) / atividades.length}deg`
          })
          .join(', ')})`
      : undefined

  return (
    <div className="happyhour-secao happyhour-roleta">
      {atividades.length === 0 ? (
        <p className="mensagem-vazia">Sugira pelo menos uma atividade antes de girar a roleta.</p>
      ) : (
        <>
          <div className="happyhour-roleta-roda-wrap">
            <div
              className="happyhour-roleta-roda"
              style={{ background: gradiente, transform: `rotate(${rotacaoGraus}deg)`, transitionDuration: comAnimacao ? '3s' : '0s' }}
            />
            <span className="happyhour-roleta-ponteiro" aria-hidden="true">
              ▼
            </span>
          </div>
          <ul className="happyhour-roleta-legenda">
            {atividades.map((atividade, indice) => (
              <li key={atividade.id}>
                <span
                  className="happyhour-roleta-swatch"
                  aria-hidden="true"
                  style={{ background: PALETA_ROLETA[indice % PALETA_ROLETA.length] }}
                />
                {atividade.descricao}
              </li>
            ))}
          </ul>
        </>
      )}

      <button
        type="button"
        className="botao-pequeno"
        disabled={atividades.length === 0 || sortearMutation.isPending}
        onClick={() => sortearMutation.mutate()}
      >
        🎲 Girar roleta
      </button>
      {sortearMutation.isError && <p className="mensagem-erro">Não foi possível girar a roleta.</p>}
      {atual && <p className="happyhour-roleta-resultado">🎉 Atividade escolhida: "{atual.descricao}"</p>}
    </div>
  )
}

export function HappyHourPainel() {
  const [aba, setAba] = useState<'atividades' | 'roleta'>('atividades')
  const atividadesQuery = useQuery({ queryKey: CHAVE_ATIVIDADES, queryFn: listarAtividades })

  return (
    <div className="happyhour-painel">
      <div className="happyhour-abas" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={aba === 'atividades'}
          className={`happyhour-aba${aba === 'atividades' ? ' happyhour-aba-ativa' : ''}`}
          onClick={() => setAba('atividades')}
        >
          📋 Atividades
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={aba === 'roleta'}
          className={`happyhour-aba${aba === 'roleta' ? ' happyhour-aba-ativa' : ''}`}
          onClick={() => setAba('roleta')}
        >
          🎡 Roleta
        </button>
      </div>
      {aba === 'atividades' ? <AtividadesSecao /> : <RoletaSecao atividades={atividadesQuery.data ?? []} />}
    </div>
  )
}
