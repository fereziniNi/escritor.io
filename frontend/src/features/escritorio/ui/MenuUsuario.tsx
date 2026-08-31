import { COR_STATUS, ICONE_STATUS } from '../icones'
import { PixelCharacterSvg } from '../PixelCharacterSvg'
import { OPCOES_STATUS, ROTULO_STATUS } from '../statusAvatar'
import type { StatusAvatar } from '../types'

/**
 * Bolha de perfil/status no canto esquerdo da toolbar - reaproveita `PixelCharacterSvg` (o mesmo
 * personagem que já existia pro mapa em DOM, agora só como ícone estático de UI, não mais
 * desenhado no mundo) em vez de um ícone genérico de "usuário" de alguma lib de UI.
 */
export function MenuUsuario({
  nome,
  status,
  aoMudarStatus,
}: {
  nome: string
  status: StatusAvatar
  aoMudarStatus: (status: StatusAvatar) => void
}) {
  return (
    <div className="escritorio-menu-usuario">
      <span className="escritorio-menu-usuario-avatar" aria-hidden="true">
        <PixelCharacterSvg corCorpo={COR_STATUS[status]} direcao="direita" andando={false} destaque={false} />
      </span>
      <div className="escritorio-menu-usuario-info">
        <span className="escritorio-menu-usuario-nome">{nome}</span>
        <select
          aria-label="Status"
          className="escritorio-menu-usuario-status"
          value={status}
          onChange={(evento) => aoMudarStatus(evento.target.value as StatusAvatar)}
        >
          {OPCOES_STATUS.map((opcao) => (
            <option key={opcao} value={opcao}>
              {ICONE_STATUS[opcao]} {ROTULO_STATUS[opcao]}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
