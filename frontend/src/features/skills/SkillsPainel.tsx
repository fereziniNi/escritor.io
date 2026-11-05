import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { buscarSkill } from './api'
import { AprovacoesSkills } from './AprovacoesSkills'
import { DetalheSkill } from './DetalheSkill'
import { EditorSkill } from './EditorSkill'
import { ListaSkills } from './ListaSkills'

type Tela = { tipo: 'lista' } | { tipo: 'detalhe'; slug: string } | { tipo: 'editor'; slug?: string } | { tipo: 'aprovacoes' }

/** Carrega o detalhe da skill (versão vigente) e abre o editor; sem slug abre a criação. */
function EditorDaSkill({ slug, aoSalvar, aoCancelar }: { slug?: string; aoSalvar: (slug: string) => void; aoCancelar: () => void }) {
  const detalheQuery = useQuery({
    queryKey: ['skills', 'detalhe', slug],
    queryFn: () => buscarSkill(slug!),
    enabled: slug !== undefined,
  })
  if (slug === undefined) {
    return <EditorSkill oficial={false} aoSalvar={(_v, novoSlug) => aoSalvar(novoSlug)} aoCancelar={aoCancelar} />
  }
  if (detalheQuery.isPending) return <p className="mensagem-carregando">Carregando...</p>
  if (detalheQuery.isError) {
    return (
      <div>
        <button type="button" className="botao-secundario" onClick={aoCancelar}>
          Voltar
        </button>
        <p className="mensagem-erro">Não foi possível carregar a skill.</p>
      </div>
    )
  }
  return (
    <EditorSkill
      slug={slug}
      oficial={detalheQuery.data.oficial}
      inicial={detalheQuery.data.vigente}
      aoSalvar={() => aoSalvar(slug)}
      aoCancelar={aoCancelar}
    />
  )
}

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

  if (tela.tipo === 'editor') {
    return (
      <EditorDaSkill
        slug={tela.slug}
        aoSalvar={(slug) => setTela({ tipo: 'detalhe', slug })}
        aoCancelar={() => setTela(tela.slug ? { tipo: 'detalhe', slug: tela.slug } : { tipo: 'lista' })}
      />
    )
  }

  return <AprovacoesSkills aoVoltar={() => setTela({ tipo: 'lista' })} />
}
