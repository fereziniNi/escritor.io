import type { AparenciaAvatar } from '../avatar/aparenciaAvatar'
import { COR_STATUS, ICONE_STATUS } from '../icones'
import { PixelCharacterSvg } from '../PixelCharacterSvg'
import { OPCOES_STATUS, ROTULO_STATUS } from '../statusAvatar'
import type { StatusAvatar } from '../types'

/**
 * Bolha de perfil/status no canto esquerdo da toolbar - reaproveita `PixelCharacterSvg` (o mesmo
 * personagem que já existia pro mapa em DOM, agora só como ícone estático de UI, não mais
 * desenhado no mundo) em vez de um ícone genérico de "usuário" de alguma lib de UI. A própria
 * bolha do avatar é um botão que abre o editor de personagem (pedido do usuário: "a opção para
 * todos detalhar da melhor maneira possível o avatar") - clicar no próprio personagem pra editar é
 * o mesmo padrão do Gather de referência.
 */
export function MenuUsuario({
  nome,
  aparencia,
  status,
  aoMudarStatus,
  aoAbrirEditorAvatar,
}: {
  nome: string
  aparencia: AparenciaAvatar
  status: StatusAvatar
  aoMudarStatus: (status: StatusAvatar) => void
  aoAbrirEditorAvatar: () => void
}) {
  return (
    <div className="escritorio-menu-usuario">
      <button
        type="button"
        className="escritorio-menu-usuario-avatar"
        aria-label="Editar avatar"
        title="Editar avatar"
        onClick={aoAbrirEditorAvatar}
      >
        <PixelCharacterSvg aparencia={aparencia} corStatus={COR_STATUS[status]} direcao="direita" andando={false} destaque={false} />
      </button>
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
