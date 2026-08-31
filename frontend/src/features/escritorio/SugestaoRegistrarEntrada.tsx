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
 *
 * <p>As duas situações sem ponto aberto têm textos diferentes de propósito - usuário relatou
 * confusão com "não registrou entrada" aparecendo mesmo depois de já ter trabalhado e encerrado
 * (SAIDA): a frase original era literalmente falsa nesse caso (a pessoa registrou entrada sim, só
 * que também já saiu), então cada estado agora fala a verdade específica dele.
 */
export function SugestaoRegistrarEntrada({ aoClicarRegistrar }: { aoClicarRegistrar: () => void }) {
  const estadoQuery = useQuery({ queryKey: ['ponto', 'estado-atual'], queryFn: buscarEstadoAtual })

  if (estadoQuery.isPending || estadoQuery.isError) {
    return null
  }

  const { ultimoTipo } = estadoQuery.data
  const pontoAberto = ultimoTipo !== null && ultimoTipo !== 'SAIDA'
  if (pontoAberto) {
    return null
  }

  const mensagem = ultimoTipo === 'SAIDA' ? 'Você já encerrou o trabalho por hoje.' : 'Você ainda não registrou entrada hoje.'

  return (
    <p role="alert" className="escritorio-aviso">
      {mensagem}{' '}
      <button type="button" onClick={aoClicarRegistrar}>
        Ir pra tela de ponto
      </button>
    </p>
  )
}
