import type { AparenciaAvatar } from '../avatar/aparenciaAvatar'
import { ControlesAudioVideo } from './ControlesAudioVideo'
import { MenuUsuario } from './MenuUsuario'
import type { StatusAvatar } from '../types'

export type PainelId =
  | 'ponto'
  | 'configuracoes'
  | 'reunioes'
  | 'relatorios'
  | 'projetos'
  | 'colaboradores'
  | 'whatsapp'
  // Pedido do usuário: sala "Happy Hour" no mapa - painel sem botão próprio na toolbar (mesmo
  // padrão de `abrirEditorDePersonagem`/`entrarNaReuniao`, que chamam `setPainelAberto` direto) -
  // só abre pelo mural (`MuralHappyHour`) quando a pessoa está dentro da zona.
  | 'happyHour'
  // Pedido do usuário: "algo relacionado à notificação para ver as últimas que chegaram no
  // sistema" - sem botão próprio aqui na toolbar (pedido posterior: "tirar o botão de notificação
  // do menu e deixar na parte superior... eu não quero que fique o botão! Inove") - abre pelo
  // `SinoDeNotificacoes` (flutuante, canto superior), ver `EscritorioPage.tsx`.
  | 'notificacoes'

/**
 * Toolbar inferior - substitui o `.escritorio-dock` antigo (botões com texto+emoji lado a lado)
 * por botões quadrados só com ícone + tooltip nativo (`title`)/`aria-label`, proporção mais perto
 * do dock de controles do Gather. Cada botão continua com nome acessível claro (aria-label) mesmo
 * sem texto visível, então os testes/leitores de tela não perdem nada.
 */
export function BarraFerramentas({
  nome,
  meuAparencia,
  meuStatus,
  aoMudarStatus,
  papel,
  painelAberto,
  aoAbrirPainel,
  aoAbrirEditorAvatar,
  micAtivo,
  aoAlternarMic,
}: {
  nome: string
  meuAparencia: AparenciaAvatar
  meuStatus: StatusAvatar
  aoMudarStatus: (status: StatusAvatar) => void
  papel: string | null
  painelAberto: PainelId | null
  aoAbrirPainel: (id: PainelId) => void
  aoAbrirEditorAvatar: () => void
  micAtivo: boolean
  aoAlternarMic: () => void
}) {
  return (
    <div className="escritorio-toolbar">
      <MenuUsuario
        nome={nome}
        aparencia={meuAparencia}
        status={meuStatus}
        aoMudarStatus={aoMudarStatus}
        aoAbrirEditorAvatar={aoAbrirEditorAvatar}
      />

      <span className="escritorio-toolbar-separador" />

      <div className="escritorio-toolbar-grupo" role="group" aria-label="Funções">
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
        {/* Pedido do usuário: "onde o usuário do sistema (independente) vai conseguir marcar e
            entrar nas reuniões do meet" - deixou de ser GESTOR/ADMIN só. */}
        <button
          type="button"
          className={`escritorio-toolbar-botao${painelAberto === 'reunioes' ? ' escritorio-toolbar-botao--ativo' : ''}`}
          aria-label="Reuniões"
          title="Reuniões"
          onClick={() => aoAbrirPainel('reunioes')}
        >
          🤝
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
        {papel === 'ADMIN' && (
          <button
            type="button"
            className={`escritorio-toolbar-botao${painelAberto === 'whatsapp' ? ' escritorio-toolbar-botao--ativo' : ''}`}
            aria-label="WhatsApp"
            title="WhatsApp"
            onClick={() => aoAbrirPainel('whatsapp')}
          >
            📱
          </button>
        )}
        {/* Pedido do usuário: "na ordem esse botao fique por ultimo" - sempre o último do grupo,
            depois de qualquer botão restrito por papel (GESTOR/ADMIN só veem os de cima). */}
        <button
          type="button"
          className={`escritorio-toolbar-botao${painelAberto === 'configuracoes' ? ' escritorio-toolbar-botao--ativo' : ''}`}
          aria-label="Configurações pessoais"
          title="Configurações pessoais"
          onClick={() => aoAbrirPainel('configuracoes')}
        >
          ⚙️
        </button>
      </div>

      <span className="escritorio-toolbar-separador" />

      <ControlesAudioVideo micAtivo={micAtivo} aoAlternarMic={aoAlternarMic} />

      <span className="escritorio-toolbar-dica">⬅️⬆️➡️⬇️ ou WASD pra andar</span>
    </div>
  )
}
