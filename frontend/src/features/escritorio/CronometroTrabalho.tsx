import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { buscarEstadoAtual } from '../ponto/api'

function doisDigitos(numero: number): string {
  return String(numero).padStart(2, '0')
}

function formatarHms(totalSegundos: number): string {
  const segundos = Math.max(0, Math.floor(totalSegundos))
  const horas = Math.floor(segundos / 3600)
  const minutos = Math.floor((segundos % 3600) / 60)
  const resto = segundos % 60
  return `${doisDigitos(horas)}:${doisDigitos(minutos)}:${doisDigitos(resto)}`
}

/**
 * Cronômetro do tempo de trabalho hoje, canto superior direito (pedido do usuário: "muito parecido
 * com o digital" - HH:MM:SS). `estado-atual` já devolve `segundosTrabalhadosAteAgora` calculado no
 * servidor - inclui o segmento em andamento (`JornadaDiaria.segundosTrabalhadosAteAgora`, diferente
 * de `minutosTrabalhados` de `/ponto/jornada-do-dia`, que só soma intervalos fechados). Esse valor
 * é só uma foto de quando a requisição respondeu (`estadoQuery.dataUpdatedAt`) - entre uma
 * atualização e outra, o relógio local (`setInterval` de 1s) soma o tempo decorrido desde então,
 * só enquanto a pessoa está trabalhando de verdade (nunca durante pausa/antes de iniciar/depois de
 * encerrar - nesses casos fica parado no valor que já veio do servidor). Mesma query key que
 * `PontoWidget` já usa - qualquer marcação de ponto invalida e este componente atualiza sozinho.
 */
export function CronometroTrabalho() {
  const estadoQuery = useQuery({ queryKey: ['ponto', 'estado-atual'], queryFn: buscarEstadoAtual })

  const trabalhandoAgora = estadoQuery.data?.ultimoTipo === 'ENTRADA' || estadoQuery.data?.ultimoTipo === 'PAUSA_FIM'

  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    if (!trabalhandoAgora) {
      return undefined
    }
    const id = setInterval(() => setAgora(Date.now()), 1000)
    return () => clearInterval(id)
  }, [trabalhandoAgora])

  if (estadoQuery.isPending || estadoQuery.isError) {
    return null
  }

  let segundosTotais = estadoQuery.data.segundosTrabalhadosAteAgora
  if (trabalhandoAgora) {
    segundosTotais += Math.floor((agora - estadoQuery.dataUpdatedAt) / 1000)
  }

  return (
    <div className="escritorio-cronometro fonte-jogo" aria-label="Tempo de trabalho hoje" role="timer">
      {formatarHms(segundosTotais)}
    </div>
  )
}
