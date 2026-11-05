import { useState } from 'react'
import { ListaSkills } from './ListaSkills'

type Tela = { tipo: 'lista' } | { tipo: 'detalhe'; slug: string } | { tipo: 'editor'; slug?: string } | { tipo: 'aprovacoes' }

/** Painel 🧩 Skills: navegação interna entre lista, detalhe, editor e aprovações. */
export function SkillsPainel({ papel }: { papel: string | null }) {
  const [tela, setTela] = useState<Tela>({ tipo: 'lista' })
  const podeAprovar = papel === 'GESTOR' || papel === 'ADMIN'

  if (tela.tipo === 'lista') {
    return (
      <ListaSkills
        podeAprovar={podeAprovar}
        aoAbrir={(slug) => setTela({ tipo: 'detalhe', slug })}
        aoNova={() => setTela({ tipo: 'editor' })}
        aoAprovacoes={() => setTela({ tipo: 'aprovacoes' })}
      />
    )
  }

  // Placeholder: as telas de detalhe, editor e aprovações chegam nas próximas tarefas.
  return (
    <div>
      <button type="button" className="botao-secundario" onClick={() => setTela({ tipo: 'lista' })}>
        Voltar
      </button>
      <p className="mensagem-vazia">Em breve.</p>
    </div>
  )
}
