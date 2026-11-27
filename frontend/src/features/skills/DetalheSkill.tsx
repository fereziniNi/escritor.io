import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { baixarZip, buscarSkill, buscarVersao, definirArquivada, definirOficial, ErroSkill, listarVersoes, restaurarVersao } from './api'
import { ArquivosVersao } from './ArquivosVersao'
import { BotaoVoltar } from './BotaoVoltar'
import { DiffProposta } from './DiffProposta'
import { Markdown } from './Markdown'
import './skills.css'
import { ROTULO_CATEGORIA, type EstadoVersao } from './types'
import { propostaDeOutro, useUsuarioId } from './usuarioAtual'

type Aba = 'geral' | 'arquivos' | 'historico'
type OrigemCopia = 'topo' | 'bloco'

const ABAS: readonly (readonly [Aba, string])[] = [
  ['geral', 'Visão geral'],
  ['arquivos', 'Arquivos'],
  ['historico', 'Histórico'],
]

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
  const [avisoCopia, setAvisoCopia] = useState<{ texto: string; origem: OrigemCopia } | null>(null)
  const [verProposta, setVerProposta] = useState(false)
  const [versaoVista, setVersaoVista] = useState<number | null>(null)
  const meuId = useUsuarioId()
  const promptRef = useRef<HTMLPreElement>(null)
  const abasRef = useRef<Partial<Record<Aba, HTMLButtonElement | null>>>({})
  const idBase = useId()

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
      <div className="skills-tela">
        <BotaoVoltar aoVoltar={aoVoltar} />
        <p className="mensagem-erro">Não foi possível carregar a skill.</p>
      </div>
    )
  }

  const { vigente, propostaPendente } = detalheQuery.data
  const bloqueadaPorProposta = propostaDeOutro(detalheQuery.data, meuId)
  const motivoBloqueio = propostaPendente ? `Há uma proposta de ${propostaPendente.autorNome} aguardando aprovação` : undefined
  const idAba = (id: Aba) => `${idBase}-aba-${id}`
  const idPainel = (id: Aba) => `${idBase}-painel-${id}`

  async function copiarPrompt(origem: OrigemCopia) {
    const texto = vigente.promptUso ?? ''
    try {
      if (!navigator.clipboard) throw new Error('sem clipboard')
      await navigator.clipboard.writeText(texto)
      setAvisoCopia({ texto: 'Copiado!', origem })
    } catch {
      // Sem acesso à área de transferência: seleciona o texto para o usuário copiar à mão.
      if (promptRef.current) {
        const selecao = window.getSelection()
        const intervalo = document.createRange()
        intervalo.selectNodeContents(promptRef.current)
        selecao?.removeAllRanges()
        selecao?.addRange(intervalo)
      } else {
        setAba('geral')
      }
      setAvisoCopia({ texto: 'Selecione e copie (Ctrl+C)', origem })
    }
  }

  function aoTeclarAbas(evento: KeyboardEvent<HTMLDivElement>) {
    const atual = ABAS.findIndex(([id]) => id === aba)
    let proxima: number
    if (evento.key === 'ArrowRight') proxima = (atual + 1) % ABAS.length
    else if (evento.key === 'ArrowLeft') proxima = (atual - 1 + ABAS.length) % ABAS.length
    else if (evento.key === 'Home') proxima = 0
    else if (evento.key === 'End') proxima = ABAS.length - 1
    else return
    evento.preventDefault()
    const id = ABAS[proxima][0]
    setAba(id)
    abasRef.current[id]?.focus()
  }

  const avisoEm = (origem: OrigemCopia) =>
    avisoCopia?.origem === origem ? (
      <span role="status" className="skills-status">
        {avisoCopia.texto}
      </span>
    ) : null

  const temPrompt = !!vigente.promptUso

  return (
    <div className="skills-detalhe">
      <BotaoVoltar aoVoltar={aoVoltar} />

      <header className="skills-detalhe-cabecalho">
        <h1 className="skills-detalhe-titulo">{vigente.nome}</h1>
        <ul className="skills-chips" aria-label="Informações da skill">
          {detalheQuery.data.oficial && <li className="skills-chip skills-chip-oficial">✓ Oficial Multiplica</li>}
          {detalheQuery.data.arquivada && <li className="skills-chip skills-chip-arquivada">Arquivada</li>}
          <li className="skills-chip skills-chip-categoria">{ROTULO_CATEGORIA[vigente.categoria]}</li>
          <li className="skills-chip">v{vigente.numero}</li>
          <li className="skills-chip">por {vigente.autorNome}</li>
        </ul>
        <p className="skills-detalhe-descricao">{vigente.descricao}</p>

        <div className="skills-detalhe-acoes">
          <div className="skills-acoes">
            <button type="button" className="skills-btn skills-btn-primario" onClick={() => copiarPrompt('topo')} disabled={!temPrompt}>
              <span aria-hidden="true">📋</span>
              Copiar prompt
            </button>
            <button type="button" className="skills-btn skills-btn-secundario" onClick={() => zip.mutate(undefined)} disabled={zip.isPending}>
              <span aria-hidden="true">⬇</span>
              Baixar .zip
            </button>
            <button
              type="button"
              className="skills-btn skills-btn-fantasma"
              onClick={aoEditar}
              disabled={bloqueadaPorProposta}
              title={bloqueadaPorProposta ? motivoBloqueio : undefined}
            >
              <span aria-hidden="true">✎</span>
              Editar
            </button>
            {avisoEm('topo')}
          </div>
          {podeAprovar && (
            <div className="skills-gestao" role="group" aria-label="Ações de gestão">
              <span className="skills-gestao-rotulo" aria-hidden="true">
                Gestão
              </span>
              <button
                type="button"
                className="skills-btn skills-btn-fantasma skills-btn-pequeno"
                onClick={() => oficial.mutate(!detalheQuery.data.oficial)}
                disabled={oficial.isPending}
              >
                {detalheQuery.data.oficial ? 'Remover selo oficial' : 'Marcar como oficial'}
              </button>
              <button
                type="button"
                className="skills-btn skills-btn-fantasma skills-btn-pequeno"
                onClick={() => arquivada.mutate(!detalheQuery.data.arquivada)}
                disabled={arquivada.isPending}
              >
                {detalheQuery.data.arquivada ? 'Desarquivar' : 'Arquivar'}
              </button>
            </div>
          )}
        </div>
      </header>

      {propostaPendente && (
        <div className="skills-aviso" role="status">
          <span aria-hidden="true">⏳</span>
          <p>Há uma proposta de {propostaPendente.autorNome} aguardando aprovação</p>
          <button type="button" className="skills-btn skills-btn-secundario skills-btn-pequeno" onClick={() => setVerProposta((v) => !v)}>
            {verProposta ? 'Ocultar proposta' : 'Ver proposta'}
          </button>
        </div>
      )}
      {propostaPendente && verProposta && (
        <section className="skills-painel-sub skills-proposta-vista">
          <div className="skills-painel-sub-topo">
            <h2>Proposta v{propostaPendente.numero}</h2>
            <span className="skills-versao-meta">diferenças em relação à versão vigente</span>
          </div>
          {propostaQuery.isPending && <p className="mensagem-carregando">Carregando...</p>}
          {propostaQuery.isError && <p className="mensagem-erro">Não foi possível carregar a proposta.</p>}
          {propostaQuery.data && <DiffProposta vigente={vigente} proposta={propostaQuery.data} />}
        </section>
      )}
      {erroAcao && <p className="mensagem-erro">{mensagemDoErro(erroAcao)}</p>}
      {zip.isError && <p className="mensagem-erro">Não foi possível baixar o arquivo.</p>}

      <div role="tablist" aria-label="Seções da skill" className="skills-abas" onKeyDown={aoTeclarAbas}>
        {ABAS.map(([id, rotulo]) => (
          <button
            key={id}
            ref={(el) => {
              abasRef.current[id] = el
            }}
            type="button"
            role="tab"
            id={idAba(id)}
            aria-controls={idPainel(id)}
            aria-selected={aba === id}
            tabIndex={aba === id ? 0 : -1}
            className="skills-aba"
            onClick={() => setAba(id)}
          >
            {rotulo}
          </button>
        ))}
      </div>

      {aba === 'geral' && (
        <div role="tabpanel" id={idPainel('geral')} aria-labelledby={idAba('geral')} tabIndex={0} className="skills-painel-aba">
          <section className="skills-secao">
            <h2 className="skills-secao-titulo">Prompt de uso</h2>
            <p className="skills-secao-ajuda">Cole este texto no Claude Code, dentro do seu projeto, para usar a skill.</p>
            {temPrompt ? (
              <div className="skills-codigo">
                <div className="skills-codigo-barra">
                  <span>Prompt</span>
                  <span className="skills-acoes">
                    {avisoEm('bloco')}
                    <button type="button" className="skills-btn-copiar" onClick={() => copiarPrompt('bloco')}>
                      Copiar
                    </button>
                  </span>
                </div>
                <pre ref={promptRef} className="skills-prompt">
                  {vigente.promptUso}
                </pre>
              </div>
            ) : (
              <p className="mensagem-vazia">Sem prompt de uso.</p>
            )}
          </section>
          <section className="skills-secao">
            <h2 className="skills-secao-titulo">Tutorial de instalação</h2>
            {vigente.tutorialInstalacao ? (
              <div className="skills-cartao-conteudo">
                <Markdown texto={vigente.tutorialInstalacao} />
              </div>
            ) : (
              <p className="mensagem-vazia">Sem tutorial.</p>
            )}
          </section>
        </div>
      )}

      {aba === 'arquivos' && (
        <div role="tabpanel" id={idPainel('arquivos')} aria-labelledby={idAba('arquivos')} tabIndex={0} className="skills-painel-aba">
          <ArquivosVersao arquivos={vigente.arquivos} />
        </div>
      )}

      {aba === 'historico' && (
        <div role="tabpanel" id={idPainel('historico')} aria-labelledby={idAba('historico')} tabIndex={0} className="skills-painel-aba">
          {versoesQuery.isPending && <p className="mensagem-carregando">Carregando...</p>}
          {versoesQuery.isError && <p className="mensagem-erro">Não foi possível carregar as versões.</p>}
          {versoesQuery.data && (
            <ol className="skills-linha-tempo">
              {versoesQuery.data.map((v) => (
                <li key={v.numero} className={`skills-versao skills-versao-${v.estado.toLowerCase()}`}>
                  <div className="skills-versao-topo">
                    <span className="skills-versao-numero">v{v.numero}</span>
                    <span className={`skills-chip skills-chip-${v.estado.toLowerCase()}`}>{ROTULO_ESTADO[v.estado]}</span>
                    {v.numero === vigente.numero && <span className="skills-chip skills-chip-categoria">Vigente</span>}
                    <span className="skills-acoes">
                      <button
                        type="button"
                        className="skills-btn skills-btn-fantasma skills-btn-pequeno"
                        aria-label={`Ver v${v.numero}`}
                        aria-pressed={versaoVista === v.numero}
                        onClick={() => setVersaoVista(v.numero)}
                      >
                        Ver
                      </button>
                      <button
                        type="button"
                        className="skills-btn skills-btn-fantasma skills-btn-pequeno"
                        aria-label={`Baixar v${v.numero}`}
                        onClick={() => zip.mutate(v.numero)}
                      >
                        Baixar
                      </button>
                      <button
                        type="button"
                        className="skills-btn skills-btn-secundario skills-btn-pequeno"
                        aria-label={`Restaurar v${v.numero}`}
                        onClick={() => restaurar.mutate(v.numero)}
                        disabled={restaurar.isPending || bloqueadaPorProposta}
                        title={bloqueadaPorProposta ? motivoBloqueio : undefined}
                      >
                        Restaurar
                      </button>
                    </span>
                  </div>
                  <span className="skills-versao-meta">
                    {v.autorNome} · {new Date(v.criadaEm).toLocaleString('pt-BR')}
                  </span>
                  {v.mensagem && <p className="skills-versao-mensagem">{v.mensagem}</p>}
                  {v.motivoRejeicao && <p className="skills-versao-motivo">Motivo: {v.motivoRejeicao}</p>}
                </li>
              ))}
            </ol>
          )}
          {versaoVista !== null && (
            <section className="skills-painel-sub skills-versao-vista">
              <div className="skills-painel-sub-topo">
                <h2>Versão v{versaoVista}</h2>
                <button type="button" className="skills-btn skills-btn-secundario skills-btn-pequeno" onClick={() => setVersaoVista(null)}>
                  Fechar versão
                </button>
              </div>
              {versaoVistaQuery.isPending && <p className="mensagem-carregando">Carregando...</p>}
              {versaoVistaQuery.isError && <p className="mensagem-erro">Não foi possível carregar a versão.</p>}
              {versaoVistaQuery.data && <ArquivosVersao key={versaoVista} arquivos={versaoVistaQuery.data.arquivos} />}
            </section>
          )}
        </div>
      )}
    </div>
  )
}
