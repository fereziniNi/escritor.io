import { useState } from 'react'
import { EditarPerfilForm } from './avatar/EditarPerfilForm'
import { EditorAvatarPage } from './avatar/EditorAvatarPage'
import './ConfiguracoesPessoais.css'
import { EscalaPage } from './EscalaPage'

type Aba = 'personagem' | 'escala' | 'perfil'

const ABAS: { id: Aba; rotulo: string }[] = [
  { id: 'personagem', rotulo: '🧑‍🎨 Personagem' },
  { id: 'escala', rotulo: '🗓️ Minha escala' },
  { id: 'perfil', rotulo: '👤 Perfil' },
]

/**
 * Pedido do usuário: "Esse agenda pessoal deve estar em configurações pessoais, ali a pessoa pode
 * editar até o personagem também e outras coisas" (e, depois, "tenha também uma edição de perfil.
 * Nome e email nesse modal") - antes "Minha escala" (padrão semanal + calendário + Google Agenda)
 * era uma opção própria da barra de ferramentas, e editar o personagem era um fluxo à parte
 * (clicar na própria bolha de avatar, canto esquerdo). Agora os três vivem juntos aqui, em abas -
 * um lugar só pra "coisas da própria pessoa". `EscalaPage`/`EditorAvatarPage`/`EditarPerfilForm`
 * continuam existindo como componentes próprios, só reaproveitados como conteúdo de cada aba.
 *
 * <p>`abaInicial` decide em qual aba abre: a barra de ferramentas abre direto em "Minha escala"
 * (ação mais comum no dia a dia); clicar na própria bolha de avatar abre direto em "Personagem"
 * (`EscritorioPage` decide isso, não aqui - each abertura é uma montagem nova deste componente).
 */
export function ConfiguracoesPessoaisPage({
  abaInicial,
  aoEntrarNaReuniao,
}: {
  abaInicial: Aba
  aoEntrarNaReuniao: () => void
}) {
  const [aba, setAba] = useState<Aba>(abaInicial)

  return (
    <div className="configuracoes-pessoais">
      {/* Sem `.pagina` aqui de propósito - cada aba mantém a própria largura de sempre:
          `EditorAvatarPage` não usa `.pagina` (o usuário já tinha pedido pra diminuir a largura do
          editor de personagem, ver `avatar.css`); `EscalaPage` já se envolve em `.pagina` sozinha. */}
      <div className="configuracoes-pessoais-abas" role="tablist" aria-label="Configurações pessoais">
        {ABAS.map((opcao) => (
          <button
            key={opcao.id}
            type="button"
            role="tab"
            aria-selected={aba === opcao.id}
            className={`configuracoes-pessoais-aba${aba === opcao.id ? ' configuracoes-pessoais-aba--ativa' : ''}`}
            onClick={() => setAba(opcao.id)}
          >
            {opcao.rotulo}
          </button>
        ))}
      </div>

      {aba === 'personagem' && <EditorAvatarPage />}
      {aba === 'escala' && <EscalaPage aoEntrarNaReuniao={aoEntrarNaReuniao} />}
      {aba === 'perfil' && <EditarPerfilForm />}
    </div>
  )
}
