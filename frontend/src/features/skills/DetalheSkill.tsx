import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { baixarZip, buscarSkill, buscarVersao, definirArquivada, definirOficial, ErroSkill, listarVersoes, restaurarVersao } from './api'
import { ArquivosVersao } from './ArquivosVersao'
import { DiffProposta } from './DiffProposta'
import { Markdown } from './Markdown'
import './skills.css'
import { ROTULO_CATEGORIA, type EstadoVersao } from './types'
import { propostaDeOutro, useUsuarioId } from './usuarioAtual'

type Aba = 'geral' | 'arquivos' | 'historico'

const ROTULO_ESTADO: Record<EstadoVersao, string> = {
  PUBLICADA: 'Publicada',
  PROPOSTA: 'Proposta',
  REJEITADA: 'Rejeitada',
}

function mensagemDoErro(erro: unknown): string {
  if (erro instanceof ErroSkill) return erro.mensagem
  return 'Você não tem permissão ou a operação falhou.'
}

/**
 * Detalhe de uma skill: visão geral (prompt de uso, tutorial, download), arquivos da versão vigente e
 * histórico de versões com restauração. Oficializar/arquivar só aparecem para quem pode aprovar.
 */
export function DetalheSkill({
  slug,
  podeAprovar,
  aoVoltar,
  aoEditar,
}: {
  slug: string
  podeAprovar: boolean
  aoVoltar: () => void
  aoEditar: () => void
}) {
  const queryClient = useQueryClient()
  const [aba, setAba] = useState<Aba>('geral')
  const [avisoCopia, setAvisoCopia] = useState<string | null>(null)
  const [verProposta, setVerProposta] = useState(false)
  const [versaoVista, setVersaoVista] = useState<number | null>(null)
  const meuId = useUsuarioId()
  const promptRef = useRef<HTMLPreElement>(null)

  const detalheQuery = useQuery({ queryKey: ['skills', 'detalhe', slug], queryFn: () => buscarSkill(slug) })
  const versoesQuery = useQuery({
    queryKey: ['skills', 'versoes', slug],
    queryFn: () => listarVersoes(slug),
    enabled: aba === 'historico',
  })

  const numeroProposta = detalheQuery.data?.propostaPendente?.numero
  const propostaQuery = useQuery({
    queryKey: ['skills', 'versao', slug, numeroProposta],
    queryFn: () => buscarVersao(slug, numeroProposta!),
    enabled: verProposta && numeroProposta !== undefined,
  })
  const versaoVistaQuery = useQuery({
    queryKey: ['skills', 'versao', slug, versaoVista],
    queryFn: () => buscarVersao(slug, versaoVista!),
    enabled: versaoVista !== null,
  })

  const aoConcluir = () => queryClient.invalidateQueries({ queryKey: ['skills'] })
  const restaurar = useMutation({ mutationFn: (numero: number) => restaurarVersao(slug, numero), onSuccess: aoConcluir })
  const oficial = useMutation({ mutationFn: (valor: boolean) => definirOficial(slug, valor), onSuccess: aoConcluir })
  const arquivada = useMutation({ mutationFn: (valor: boolean) => definirArquivada(slug, valor), onSuccess: aoConcluir })
  const zip = useMutation({ mutationFn: (numero?: number) => baixarZip(slug, numero) })

  const erroAcao = restaurar.error ?? oficial.error ?? arquivada.error

  if (detalheQuery.isPending) return <p className="mensagem-carregando">Carregando...</p>
  if (detalheQuery.isError) {
    return (
      <div>
        <button type="button" className="botao-secundario" onClick={aoVoltar}>
          Voltar
        </button>
        <p className="mensagem-erro">Não foi possível carregar a skill.</p>
      </div>
    )
  }

  const { vigente, propostaPendente } = detalheQuery.data
  const bloqueadaPorProposta = propostaDeOutro(detalheQuery.data, meuId)
  const motivoBloqueio = propostaPendente ? `Há uma proposta de ${propostaPendente.autorNome} aguardando aprovação` : undefined

  async function copiarPrompt() {
    const texto = vigente.promptUso ?? ''
    try {
      if (!navigator.clipboard) throw new Error('sem clipboard')
      await navigator.clipboard.writeText(texto)
      setAvisoCopia('Copiado!')
    } catch {
      // Sem acesso à área de transferência: seleciona o texto para o usuário copiar à mão.
      if (promptRef.current) {
        const selecao = window.getSelection()
        const intervalo = document.createRange()
        intervalo.selectNodeContents(promptRef.current)
        selecao?.removeAllRanges()
        selecao?.addRange(intervalo)
      }
      setAvisoCopia('Selecione e copie (Ctrl+C)')
    }
  }

  return (
    <div className="skills-detalhe">
      <div className="linha-botoes">
        <button type="button" className="botao-secundario" onClick={aoVoltar}>
          Voltar
        </button>
        <button type="button" onClick={aoEditar} disabled={bloqueadaPorProposta} title={bloqueadaPorProposta ? motivoBloqueio : undefined}>
          Editar
        </button>
        <button type="button" className="botao-secundario" onClick={() => zip.mutate(undefined)} disabled={zip.isPending}>
          Baixar .zip
        </button>
        {podeAprovar && (
          <>
            <button type="button" className="botao-secundario" onClick={() => oficial.mutate(!detalheQuery.data.oficial)} disabled={oficial.isPending}>
              {detalheQuery.data.oficial ? 'Remover selo oficial' : 'Marcar como oficial'}
            </button>
            <button type="button" className="botao-secundario" onClick={() => arquivada.mutate(!detalheQuery.data.arquivada)} disabled={arquivada.isPending}>
              {detalheQuery.data.arquivada ? 'Desarquivar' : 'Arquivar'}
            </button>
          </>
        )}
      </div>

      <h1>{vigente.nome}</h1>
      <p>
        {detalheQuery.data.oficial && <span className="badge">✅ Oficial Multiplica </span>}
        {detalheQuery.data.arquivada && <span className="badge badge-neutro">Arquivada </span>}
        {ROTULO_CATEGORIA[vigente.categoria]} · v{vigente.numero} · {vigente.autorNome}
      </p>
      <p>{vigente.descricao}</p>

      {propostaPendente && (
        <div className="mensagem-aviso" role="status">
          <p>Há uma proposta de {propostaPendente.autorNome} aguardando aprovação</p>
          <button type="button" className="botao-secundario" onClick={() => setVerProposta((v) => !v)}>
            {verProposta ? 'Ocultar proposta' : 'Ver proposta'}
          </button>
        </div>
      )}
      {propostaPendente && verProposta && (
        <div className="skills-proposta-vista">
          <h2>Proposta v{propostaPendente.numero}</h2>
          {propostaQuery.isPending && <p className="mensagem-carregando">Carregando...</p>}
          {propostaQuery.isError && <p className="mensagem-erro">Não foi possível carregar a proposta.</p>}
          {propostaQuery.data && <DiffProposta vigente={vigente} proposta={propostaQuery.data} />}
        </div>
      )}
      {erroAcao && <p className="mensagem-erro">{mensagemDoErro(erroAcao)}</p>}
      {zip.isError && <p className="mensagem-erro">Não foi possível baixar o arquivo.</p>}

      <div role="tablist" className="skills-abas">
        {(
          [
            ['geral', 'Visão geral'],
            ['arquivos', 'Arquivos'],
            ['historico', 'Histórico'],
          ] as const
        ).map(([id, rotulo]) => (
          <button key={id} type="button" role="tab" aria-selected={aba === id} className="botao-secundario" onClick={() => setAba(id)}>
            {rotulo}
          </button>
        ))}
      </div>

      {aba === 'geral' && (
        <div role="tabpanel">
          <h2>Prompt de uso</h2>
          <pre ref={promptRef} className="skills-prompt">
            {vigente.promptUso}
          </pre>
          <button type="button" onClick={copiarPrompt}>
            Copiar prompt
          </button>
          {avisoCopia && <span role="status"> {avisoCopia}</span>}
          <h2>Tutorial de instalação</h2>
          {vigente.tutorialInstalacao ? <Markdown texto={vigente.tutorialInstalacao} /> : <p className="mensagem-vazia">Sem tutorial.</p>}
        </div>
      )}

      {aba === 'arquivos' && (
        <div role="tabpanel">
          <ArquivosVersao arquivos={vigente.arquivos} />
        </div>
      )}

      {aba === 'historico' && (
        <div role="tabpanel">
          {versoesQuery.isPending && <p className="mensagem-carregando">Carregando...</p>}
          {versoesQuery.isError && <p className="mensagem-erro">Não foi possível carregar as versões.</p>}
          <ul className="lista-cartoes">
            {versoesQuery.data?.map((v) => (
              <li key={v.numero} className="cartao-item">
                <span className="cartao-item-titulo">
                  v{v.numero} · {ROTULO_ESTADO[v.estado]}
                </span>
                <span className="cartao-item-meta">
                  {v.autorNome} · {new Date(v.criadaEm).toLocaleString('pt-BR')}
                </span>
                {v.mensagem && <span className="cartao-item-corpo">{v.mensagem}</span>}
                {v.motivoRejeicao && <span className="cartao-item-corpo">Motivo: {v.motivoRejeicao}</span>}
                <span className="linha-botoes">
                  <button type="button" className="botao-secundario" onClick={() => setVersaoVista(v.numero)}>
                    Ver v{v.numero}
                  </button>
                  <button type="button" className="botao-secundario" onClick={() => zip.mutate(v.numero)}>
                    Baixar v{v.numero}
                  </button>
                  <button type="button" className="botao-secundario" onClick={() => restaurar.mutate(v.numero)}
                    disabled={restaurar.isPending || bloqueadaPorProposta}
                    title={bloqueadaPorProposta ? motivoBloqueio : undefined}
                  >
                    Restaurar v{v.numero}
                  </button>
                </span>
              </li>
            ))}
          </ul>
          {versaoVista !== null && (
            <div className="skills-versao-vista">
              <h2>Versão v{versaoVista}</h2>
              {versaoVistaQuery.isPending && <p className="mensagem-carregando">Carregando...</p>}
              {versaoVistaQuery.isError && <p className="mensagem-erro">Não foi possível carregar a versão.</p>}
              {versaoVistaQuery.data && <ArquivosVersao key={versaoVista} arquivos={versaoVistaQuery.data.arquivos} />}
              <button type="button" className="botao-secundario" onClick={() => setVersaoVista(null)}>
                Fechar versão
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
