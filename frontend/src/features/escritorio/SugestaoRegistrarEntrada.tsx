import { useQuery } from '@tanstack/react-query'
import { buscarEstadoAtual } from '../ponto/api'

/**
 * PRD (E5): "ao entrar no mapa sem ponto aberto, exibir sugestão (não automação) de registrar
 * entrada" - só um aviso apontando pra onde a ação de verdade já existe (`PontoWidget`, agora
 * dentro do painel de Ponto do dock, ver `PainelPonto`), nunca marca ponto sozinho. "Ponto
 * aberto" é o mesmo conceito de `PontoWidget`: `ultimoTipo` nulo (nunca bateu ponto) ou `SAIDA`
 * (já encerrou) - qualquer outro valor (`ENTRADA`/`PAUSA_INICIO`/`PAUSA_FIM`) significa jornada em
 * andamento, sem aviso. `aoClicarRegistrar` abre o painel de Ponto (S6, reskin "uma tela só") - já
 * não existe mais uma rota separada pra navegar até lá.
 */
export function SugestaoRegistrarEntrada({ aoClicarRegistrar }: { aoClicarRegistrar: () => void }) {
  const estadoQuery = useQuery({ queryKey: ['ponto', 'estado-atual'], queryFn: buscarEstadoAtual })

  if (estadoQuery.isPending || estadoQuery.isError) {
    return null
  }

  const pontoAberto = estadoQuery.data.ultimoTipo !== null && estadoQuery.data.ultimoTipo !== 'SAIDA'
  if (pontoAberto) {
    return null
  }

  return (
    <p role="alert" className="escritorio-aviso">
      Você ainda não registrou entrada hoje.{' '}
      <button type="button" onClick={aoClicarRegistrar}>
        Ir pra tela de ponto
      </button>
    </p>
  )
}
