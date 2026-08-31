import { ListaPresenca } from '../ListaPresenca'
import type { EstadoPresencaUsuario, Zona } from '../types'

/**
 * Envolve `ListaPresenca` (contrato/`data-testid`s intactos) num drawer recolhível, acionado pela
 * toolbar - painel de participantes com proporção mais próxima do Gather (drawer que abre/fecha)
 * em vez de uma barra lateral sempre visível ocupando espaço permanentemente.
 */
export function PainelLateral({
  aberto,
  zonas,
  usuarios,
  meuUsuarioId,
  usuariosProximos,
}: {
  aberto: boolean
  zonas: Zona[]
  usuarios: EstadoPresencaUsuario[]
  meuUsuarioId: number | null
  usuariosProximos?: Set<number>
}) {
  if (!aberto) {
    return null
  }

  return (
    <div className="escritorio-painel-lateral">
      <ListaPresenca zonas={zonas} usuarios={usuarios} meuUsuarioId={meuUsuarioId} usuariosProximos={usuariosProximos} />
    </div>
  )
}
