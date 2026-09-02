import { ControlesAudioVideo } from './ControlesAudioVideo'
import { MenuUsuario } from './MenuUsuario'
import type { StatusAvatar } from '../types'

export type PainelId = 'ponto' | 'relatorios' | 'projetos' | 'colaboradores'

/**
 * Toolbar inferior - substitui o `.escritorio-dock` antigo (botões com texto+emoji lado a lado)
 * por botões quadrados só com ícone + tooltip nativo (`title`)/`aria-label`, proporção mais perto
 * do dock de controles do Gather. Cada botão continua com nome acessível claro (aria-label) mesmo
 * sem texto visível, então os testes/leitores de tela não perdem nada.
 */
export function BarraFerramentas({
  nome,
  meuStatus,
  aoMudarStatus,
  papel,
  painelAberto,
  aoAbrirPainel,
  participantesAberto,
  aoAlternarParticipantes,
}: {
  nome: string
  meuStatus: StatusAvatar
  aoMudarStatus: (status: StatusAvatar) => void
  papel: string | null
  painelAberto: PainelId | null
  aoAbrirPainel: (id: PainelId) => void
  participantesAberto: boolean
  aoAlternarParticipantes: () => void
}) {
  return (
    <div className="escritorio-toolbar">
      <MenuUsuario nome={nome} status={meuStatus} aoMudarStatus={aoMudarStatus} />

      <span className="escritorio-toolbar-separador" />

      <div className="escritorio-toolbar-grupo" role="group" aria-label="Funções">
        <button
          type="button"
          className={`escritorio-toolbar-botao${participantesAberto ? ' escritorio-toolbar-botao--ativo' : ''}`}
          aria-label="Participantes"
          aria-pressed={participantesAberto}
          title="Quem está no escritório"
          onClick={aoAlternarParticipantes}
        >
          🧭
        </button>
        <button
          type="button"
          className={`escritorio-toolbar-botao${painelAberto === 'ponto' ? ' escritorio-toolbar-botao--ativo' : ''}`}
          aria-label="Ponto"
          title="Ponto"
          onClick={() => aoAbrirPainel('ponto')}
        >
          ⏱️
        </button>
        <button
          type="button"
          className={`escritorio-toolbar-botao${painelAberto === 'projetos' ? ' escritorio-toolbar-botao--ativo' : ''}`}
          aria-label="Projetos"
          title="Projetos"
          onClick={() => aoAbrirPainel('projetos')}
        >
          📁
        </button>
        {(papel === 'GESTOR' || papel === 'ADMIN') && (
          <button
            type="button"
            className={`escritorio-toolbar-botao${painelAberto === 'relatorios' ? ' escritorio-toolbar-botao--ativo' : ''}`}
            aria-label="Relatórios"
            title="Relatórios"
            onClick={() => aoAbrirPainel('relatorios')}
          >
            📊
          </button>
        )}
        {papel === 'ADMIN' && (
          <button
            type="button"
            className={`escritorio-toolbar-botao${painelAberto === 'colaboradores' ? ' escritorio-toolbar-botao--ativo' : ''}`}
            aria-label="Colaboradores"
            title="Colaboradores"
            onClick={() => aoAbrirPainel('colaboradores')}
          >
            🧑‍💼
          </button>
        )}
      </div>

      <span className="escritorio-toolbar-separador" />

      <ControlesAudioVideo />

      <span className="escritorio-toolbar-dica">⬅️⬆️➡️⬇️ ou WASD pra andar</span>
    </div>
  )
}
