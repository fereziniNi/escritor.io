import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { criarSkill, ErroSkill, salvarVersao } from './api'
import './skills.css'
import { CATEGORIAS, ROTULO_CATEGORIA, type Categoria, type SkillVersao } from './types'

const ARQUIVO_PRINCIPAL = 'SKILL.md'
const MAX_ARQUIVOS = 50
const MAX_BYTES_ARQUIVO = 262144
const MAX_BYTES_TOTAL = 2097152
const MAX_CAMINHO = 200
const MAX_NOME = 120
const ATRASO_PROPOSTA_MS = 1500
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/
const CAMINHO = /^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/

interface ArquivoEditavel {
  id: number
  caminho: string
  conteudo: string
}

let ultimoId = 0
const gerarId = () => ++ultimoId

function bytes(texto: string): number {
  return new TextEncoder().encode(texto).length
}

/** Modelo inicial do SKILL.md de uma skill nova. */
function modeloSkillMd(slug: string, nome: string): string {
  return `---\nname: ${slug}\ndescription: \n---\n\n# ${nome}`
}

function erroSlug(slug: string): string | null {
  if (slug.length < 3 || slug.length > 64 || !SLUG.test(slug)) {
    return 'O slug deve ter de 3 a 64 caracteres, só letras minúsculas, números e hífens (sem hífen no início, no fim ou duplicado)'
  }
  return null
}

function caminhoValido(caminho: string): boolean {
  return caminho.length <= MAX_CAMINHO && CAMINHO.test(caminho) && caminho.split('/').every((s) => s !== '.' && s !== '..')
}

/** Espelha as regras de ValidadorPacoteSkill (caminho, duplicados, quantidade e limites de tamanho). */
function errosDosArquivos(arquivos: ArquivoEditavel[]): string[] {
  const erros: string[] = []
  if (arquivos.length > MAX_ARQUIVOS) erros.push(`A skill pode ter no máximo ${MAX_ARQUIVOS} arquivos`)
  const vistos = new Set<string>()
  let total = 0
  for (const a of arquivos) {
    if (!caminhoValido(a.caminho)) {
      erros.push(
        `Caminho de arquivo inválido: ${a.caminho} (use caminho relativo com letras, números, ponto, hífen, sublinhado e barra, até 200 caracteres)`,
      )
    } else if (vistos.has(a.caminho)) {
      erros.push(`Caminho duplicado: ${a.caminho}`)
    }
    vistos.add(a.caminho)
    const tamanho = bytes(a.conteudo)
    total += tamanho
    if (tamanho > MAX_BYTES_ARQUIVO) erros.push(`O arquivo ${a.caminho} excede o limite de 256 KB`)
  }
  if (total > MAX_BYTES_TOTAL) erros.push('A skill excede o limite total de 2 MB')
  if (!arquivos.some((a) => a.caminho === ARQUIVO_PRINCIPAL)) erros.push('A skill precisa ter o arquivo SKILL.md na raiz')
  return erros
}

/**
 * Editor multi-arquivo de skill. Sem {@code slug} cria uma skill nova (slug editável, SKILL.md modelo);
 * com slug salva uma nova versão. Skill oficial gera proposta para aprovação. Erros do servidor (400/409)
 * são exibidos sem perder o que foi digitado.
 */
export function EditorSkill({
  slug,
  oficial,
  inicial,
  aoSalvar,
  aoCancelar,
}: {
  slug?: string
  oficial: boolean
  inicial?: SkillVersao
  /** O segundo argumento é o slug da skill (útil na criação, em que a versão devolvida não o traz). */
  aoSalvar: (v: SkillVersao, slug: string) => void
  aoCancelar: () => void
}) {
  const queryClient = useQueryClient()
  const criacao = slug === undefined

  const [slugDigitado, setSlugDigitado] = useState('')
  const [nome, setNome] = useState(inicial?.nome ?? '')
  const [descricao, setDescricao] = useState(inicial?.descricao ?? '')
  const [categoria, setCategoria] = useState<Categoria>(inicial?.categoria ?? 'OUTRAS')
  const [promptUso, setPromptUso] = useState(inicial?.promptUso ?? '')
  const [tutorial, setTutorial] = useState(inicial?.tutorialInstalacao ?? '')
  const [mensagem, setMensagem] = useState('')
  const [skillMdEditado, setSkillMdEditado] = useState(false)
  const [arquivos, setArquivos] = useState<ArquivoEditavel[]>(() =>
    inicial
      ? inicial.arquivos.map((a) => ({ id: gerarId(), ...a }))
      : [{ id: gerarId(), caminho: ARQUIVO_PRINCIPAL, conteudo: modeloSkillMd('', '') }],
  )
  const [novoCaminho, setNovoCaminho] = useState('')
  const [enviada, setEnviada] = useState<{ versao: SkillVersao; slug: string } | null>(null)

  // Dá tempo de ler a confirmação da proposta antes de voltar para o detalhe.
  useEffect(() => {
    if (!enviada) return
    const t = setTimeout(() => aoSalvar(enviada.versao, enviada.slug), ATRASO_PROPOSTA_MS)
    return () => clearTimeout(t)
  }, [enviada, aoSalvar])

  const slugEfetivo = criacao ? slugDigitado : slug

  function atualizarModelo(novoSlug: string, novoNome: string) {
    if (!criacao || skillMdEditado) return
    setArquivos((atual) =>
      atual.map((a) => (a.caminho === ARQUIVO_PRINCIPAL ? { ...a, conteudo: modeloSkillMd(novoSlug, novoNome) } : a)),
    )
  }

  function alterarArquivo(id: number, campos: Partial<ArquivoEditavel>) {
    setArquivos((atual) => atual.map((a) => (a.id === id ? { ...a, ...campos } : a)))
  }

  function adicionarArquivo() {
    const caminho = novoCaminho.trim()
    if (!caminho) return
    setArquivos((atual) => [...atual, { id: gerarId(), caminho, conteudo: '' }])
    setNovoCaminho('')
  }

  const salvar = useMutation({
    mutationFn: () => {
      const dados = {
        nome: nome.trim(),
        descricao: descricao.trim(),
        categoria,
        promptUso,
        tutorialInstalacao: tutorial,
        mensagem: mensagem.trim(),
        arquivos: arquivos.map(({ caminho, conteudo }) => ({ caminho, conteudo })),
      }
      return criacao ? criarSkill({ slug: slugDigitado, ...dados }) : salvarVersao(slug, dados)
    },
    onSuccess: async (versao) => {
      await queryClient.invalidateQueries({ queryKey: ['skills'] })
      if (versao.estado === 'PROPOSTA') {
        setEnviada({ versao, slug: slugEfetivo! })
      } else {
        aoSalvar(versao, slugEfetivo!)
      }
    },
  })

  const errosCampos: string[] = []
  if (criacao) {
    const e = erroSlug(slugDigitado)
    if (e && slugDigitado) errosCampos.push(e)
  }
  if (nome.trim().length > MAX_NOME) errosCampos.push(`O nome da skill pode ter no máximo ${MAX_NOME} caracteres`)
  const errosArquivos = errosDosArquivos(arquivos)
  const erros = [...errosCampos, ...errosArquivos]
  const incompleto =
    (criacao && erroSlug(slugDigitado) !== null) || !nome.trim() || !descricao.trim() || !mensagem.trim()
  const bloqueado = incompleto || erros.length > 0 || salvar.isPending || enviada !== null

  const erroServidor =
    salvar.error instanceof ErroSkill ? salvar.error.mensagem : salvar.error ? 'Não foi possível salvar a skill.' : null

  return (
    <form
      className="skills-editor"
      onSubmit={(e) => {
        e.preventDefault()
        if (!bloqueado) salvar.mutate()
      }}
    >
      <h2>{criacao ? 'Nova skill' : `Editar ${slug}`}</h2>
      {oficial && (
        <p className="mensagem-aviso" role="status">
          Esta skill é oficial: sua alteração vai para aprovação.
        </p>
      )}

      {criacao && (
        <label>
          Slug
          <input
            value={slugDigitado}
            onChange={(e) => {
              setSlugDigitado(e.target.value)
              atualizarModelo(e.target.value, nome)
            }}
          />
        </label>
      )}
      <label>
        Nome
        <input
          value={nome}
          onChange={(e) => {
            setNome(e.target.value)
            atualizarModelo(slugDigitado, e.target.value)
          }}
        />
      </label>
      <label>
        Descrição
        <input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
      </label>
      <label>
        Categoria
        <select value={categoria} onChange={(e) => setCategoria(e.target.value as Categoria)}>
          {CATEGORIAS.map((c) => (
            <option key={c} value={c}>
              {ROTULO_CATEGORIA[c]}
            </option>
          ))}
        </select>
      </label>
      <label>
        Prompt de uso
        <textarea rows={3} value={promptUso} onChange={(e) => setPromptUso(e.target.value)} />
      </label>
      <label>
        Tutorial de instalação
        <textarea rows={6} value={tutorial} onChange={(e) => setTutorial(e.target.value)} />
      </label>

      <fieldset>
        <legend>Arquivos</legend>
        {arquivos.map((a) => {
          const principal = a.caminho === ARQUIVO_PRINCIPAL
          return (
            <div key={a.id} className="skills-editor-arquivo">
              <input
                aria-label={`Caminho de ${a.caminho}`}
                value={a.caminho}
                readOnly={principal}
                onChange={(e) => alterarArquivo(a.id, { caminho: e.target.value })}
              />
              {!principal && (
                <button
                  type="button"
                  className="botao-secundario"
                  aria-label={`Remover ${a.caminho}`}
                  onClick={() => setArquivos((atual) => atual.filter((x) => x.id !== a.id))}
                >
                  Remover
                </button>
              )}
              <textarea
                rows={8}
                aria-label={`Conteúdo de ${a.caminho}`}
                value={a.conteudo}
                onChange={(e) => {
                  alterarArquivo(a.id, { conteudo: e.target.value })
                  if (principal) setSkillMdEditado(true)
                }}
              />
            </div>
          )
        })}
        <div className="linha-botoes">
          <input aria-label="Novo arquivo" placeholder="pasta/arquivo.md" value={novoCaminho} onChange={(e) => setNovoCaminho(e.target.value)} />
          <button type="button" className="botao-secundario" onClick={adicionarArquivo} disabled={!novoCaminho.trim()}>
            Adicionar arquivo
          </button>
        </div>
      </fieldset>

      <label>
        Mensagem da alteração
        <input value={mensagem} onChange={(e) => setMensagem(e.target.value)} />
      </label>

      {erros.map((e) => (
        <p key={e} className="mensagem-erro">
          {e}
        </p>
      ))}
      {erroServidor && <p className="mensagem-erro">{erroServidor}</p>}
      {enviada && <p className="mensagem-aviso" role="status">Proposta enviada para aprovação</p>}

      <div className="linha-botoes">
        <button type="submit" disabled={bloqueado || !slugEfetivo}>
          Salvar
        </button>
        <button type="button" className="botao-secundario" onClick={aoCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
