import { useState } from 'react'
import { DetalheSkill } from './DetalheSkill'
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

  if (tela.tipo === 'detalhe') {
    const slug = tela.slug
    return (
      <DetalheSkill
        slug={slug}
        podeAprovar={podeAprovar}
        aoVoltar={() => setTela({ tipo: 'lista' })}
        aoEditar={() => setTela({ tipo: 'editor', slug })}
      />
    )
  }

  // Placeholder: as telas de editor, editor e aprovações chegam nas próximas tarefas.
  return (
    <div>
      <button type="button" className="botao-secundario" onClick={() => setTela({ tipo: 'lista' })}>
        Voltar
      </button>
      <p className="mensagem-vazia">Em breve.</p>
    </div>
  )
}
