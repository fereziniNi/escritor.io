import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { buscarEstadoAtual } from '../ponto/api'

/**
 * PRD (E5): "ao entrar no mapa sem ponto aberto, exibir sugestão (não automação) de registrar
 * entrada" - só um aviso apontando pra onde a ação de verdade já existe (`PontoWidget`, na
 * `HomePage`), nunca marca ponto sozinho. "Ponto aberto" é o mesmo conceito de `PontoWidget`:
 * `ultimoTipo` nulo (nunca bateu ponto) ou `SAIDA` (already encerrou) - qualquer outro valor
 * (`ENTRADA`/`PAUSA_INICIO`/`PAUSA_FIM`) significa jornada em andamento, sem aviso.
 */
export function SugestaoRegistrarEntrada() {
  const estadoQuery = useQuery({ queryKey: ['ponto', 'estado-atual'], queryFn: buscarEstadoAtual })

  if (estadoQuery.isPending || estadoQuery.isError) {
    return null
  }

  const pontoAberto = estadoQuery.data.ultimoTipo !== null && estadoQuery.data.ultimoTipo !== 'SAIDA'
  if (pontoAberto) {
    return null
  }

  return (
    <p role="alert">
      Você ainda não registrou entrada hoje. <Link to="/">Ir pra tela de ponto</Link>
    </p>
  )
}
