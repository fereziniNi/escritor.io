import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { buscarSkill, buscarVersao } from './api'
import { BotaoVoltar } from './BotaoVoltar'
import { AprovacoesSkills } from './AprovacoesSkills'
import { DetalheSkill } from './DetalheSkill'
import { EditorSkill } from './EditorSkill'
import { ListaSkills } from './ListaSkills'
import { propostaDeOutro, useUsuarioId } from './usuarioAtual'

type Tela = { tipo: 'lista' } | { tipo: 'detalhe'; slug: string } | { tipo: 'editor'; slug?: string } | { tipo: 'aprovacoes' }

/** Carrega o detalhe da skill (versão vigente) e abre o editor; sem slug abre a criação. */
function EditorDaSkill({ slug, aoSalvar, aoCancelar }: { slug?: string; aoSalvar: (slug: string) => void; aoCancelar: () => void }) {
  const detalheQuery = useQuery({
    queryKey: ['skills', 'detalhe', slug],
    queryFn: () => buscarSkill(slug!),
    enabled: slug !== undefined,
  })
  const meuId = useUsuarioId()
  const pendente = detalheQuery.data?.propostaPendente ?? null
  // Skill oficial com proposta minha pendente: o editor abre a proposta (não a vigente), para o novo
  // envio, que substitui a anterior, não descartar as mudanças já feitas.
  const editaMinhaProposta = pendente !== null && !!detalheQuery.data?.oficial && !propostaDeOutro(detalheQuery.data, meuId)
  const propostaQuery = useQuery({
    queryKey: ['skills', 'versao', slug, pendente?.numero],
    queryFn: () => buscarVersao(slug!, pendente!.numero),
    enabled: editaMinhaProposta,
  })
  if (slug === undefined) {
    return <EditorSkill oficial={false} aoSalvar={(_v, novoSlug) => aoSalvar(novoSlug)} aoCancelar={aoCancelar} />
  }
  if (detalheQuery.isPending) return <p className="mensagem-carregando">Carregando...</p>
  if (detalheQuery.isError) {
    return (
      <div className="skills-tela">
        <BotaoVoltar aoVoltar={aoCancelar} />
        <p className="mensagem-erro">Não foi possível carregar a skill.</p>
      </div>
    )
  }
  if (propostaDeOutro(detalheQuery.data, meuId)) {
    return (
      <div className="skills-tela">
        <BotaoVoltar aoVoltar={aoCancelar} />
        <p className="skills-aviso" role="status">
          Há uma proposta de {pendente?.autorNome} aguardando aprovação. Aguarde a decisão de um gestor antes de editar.
        </p>
      </div>
    )
  }
  if (editaMinhaProposta && propostaQuery.isPending) return <p className="mensagem-carregando">Carregando...</p>
  if (editaMinhaProposta && propostaQuery.isError) {
    return (
      <div className="skills-tela">
        <BotaoVoltar aoVoltar={aoCancelar} />
        <p className="mensagem-erro">Não foi possível carregar sua proposta.</p>
      </div>
    )
  }
  return (
    <div className="skills-tela">
      {editaMinhaProposta && (
        <p className="skills-aviso skills-aviso-info" role="status">
          Você está editando sua proposta pendente (v{pendente.numero})
        </p>
      )}
      <EditorSkill
        slug={slug}
        oficial={detalheQuery.data.oficial}
        inicial={editaMinhaProposta ? propostaQuery.data : detalheQuery.data.vigente}
        aoSalvar={() => aoSalvar(slug)}
        aoCancelar={aoCancelar}
      />
    </div>
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
