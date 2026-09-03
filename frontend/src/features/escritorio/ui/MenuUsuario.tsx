import { caminhoMiniatura, type Personagem } from '../avatar/personagens'
import { COR_STATUS, ICONE_STATUS } from '../icones'
import { OPCOES_STATUS, ROTULO_STATUS } from '../statusAvatar'
import type { StatusAvatar } from '../types'

/**
 * Bolha de perfil/status no canto esquerdo da toolbar - mostra o sprite de verdade do personagem
 * escolhido (ver `avatar/personagens.ts`, Kenney RPG Urban Pack CC0) em vez do avatar desenhado à
 * mão que existia antes. A própria bolha é um botão que abre o editor de personagem (pedido do
 * usuário: "a opção para todos detalhar da melhor maneira possível o avatar") - clicar no próprio
 * personagem pra editar é o mesmo padrão do Gather de referência.
 */
export function MenuUsuario({
  nome,
  personagem,
  status,
  aoMudarStatus,
  aoAbrirEditorAvatar,
}: {
  nome: string
  personagem: Personagem
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
        <img src={caminhoMiniatura(personagem)} alt="" width={26} height={26} style={{ imageRendering: 'pixelated' }} />
        <span className="escritorio-menu-usuario-status-ponto" style={{ backgroundColor: COR_STATUS[status] }} aria-hidden="true" />
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
