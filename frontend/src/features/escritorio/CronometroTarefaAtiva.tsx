import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { buscarCronometroAtivo } from '../kanban/api'
import type { CronometroAtivo } from '../kanban/types'
import { formatarHms } from '../../shared/formatarHms'

/**
 * Pedido do usuário: "O cronometro deve estar abaixo do cronometro de horas trabalhadas,
 * entretanto ele deve ser menor e com cores vermelhas. Se eu clicar nele abre o modal dessa
 * atividade" - widget global da tarefa com o cronômetro (`SessaoTrabalho`) rodando agora, em
 * qualquer projeto. Mesmo espírito de `CronometroTrabalho` (relógio ao vivo, `setInterval` de 1s
 * só enquanto está mesmo rodando), mas some da tela (`return null`) quando não há nada ativo -
 * diferente do de Ponto, que é sempre visível. `refetchInterval` é só um fallback (outra aba/
 * sessão iniciando ou encerrando o cronômetro) - a própria pessoa mexendo pelo board já invalida
 * esta query na hora (`CronometroSecao`, em `ProjetoDetalhePage.tsx`).
 */
export function CronometroTarefaAtiva({ aoClicar }: { aoClicar: (cronometro: CronometroAtivo) => void }) {
  const cronometroQuery = useQuery({
    queryKey: ['cronometro-ativo'],
    queryFn: buscarCronometroAtivo,
    refetchInterval: 20_000,
  })

  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    if (!cronometroQuery.data) {
      return undefined
    }
    const id = setInterval(() => setAgora(Date.now()), 1000)
    return () => clearInterval(id)
  }, [cronometroQuery.data])

  if (!cronometroQuery.data) {
    return null
  }

  const dados = cronometroQuery.data
  const segundosTotais = dados.totalMinutosFechados * 60 + Math.max(0, Math.floor((agora - new Date(dados.iniciadoEm).getTime()) / 1000))

  return (
    <button
      type="button"
      className="escritorio-cronometro-tarefa fonte-jogo"
      onClick={() => aoClicar(dados)}
      aria-label={`Cronômetro ativo: ${dados.cardTitulo}, clique para abrir a tarefa`}
    >
      <span className="escritorio-cronometro-tarefa-titulo">{dados.cardTitulo}</span>
      <span role="timer">{formatarHms(segundosTotais)}</span>
    </button>
  )
}
