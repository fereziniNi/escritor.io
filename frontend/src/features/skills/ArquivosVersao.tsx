import { useState } from 'react'
import { Markdown } from './Markdown'
import './skills.css'
import type { Arquivo } from './types'

const PRINCIPAL = 'SKILL.md'

function ehMarkdown(caminho: string): boolean {
  return caminho.toLowerCase().endsWith('.md')
}

/** Separa o frontmatter YAML (`---` ... `---`) do corpo: sem isso o markdown o desenharia como linha + título. */
function separarFrontmatter(texto: string): { frontmatter: string | null; corpo: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(texto)
  return m ? { frontmatter: m[1], corpo: texto.slice(m[0].length) } : { frontmatter: null, corpo: texto }
}

function MarkdownComFrontmatter({ texto }: { texto: string }) {
  const { frontmatter, corpo } = separarFrontmatter(texto)
  return (
    <>
      {frontmatter !== null && <pre className="skills-frontmatter">{frontmatter}</pre>}
      <Markdown texto={corpo} />
    </>
  )
}

/**
 * Arquivos de uma versão: lista à esquerda (ou em cima, em painel estreito) e visualização somente
 * leitura ao lado; `.md` é renderizado como markdown, o resto em bloco monoespaçado rolável.
 * Abre o SKILL.md (ou o primeiro arquivo) para a tela nunca começar vazia.
 */
export function ArquivosVersao({ arquivos }: { arquivos: Arquivo[] }) {
  const [caminhoAberto, setCaminhoAberto] = useState<string | null>(
    () => (arquivos.find((a) => a.caminho === PRINCIPAL) ?? arquivos[0])?.caminho ?? null,
  )
  const aberto = arquivos.find((a) => a.caminho === caminhoAberto) ?? null
  return (
    <div className="skills-arquivos">
      <nav aria-label="Arquivos da versão">
        <ul className="skills-arquivos-lista">
          {arquivos.map((a) => (
            <li key={a.caminho}>
              <button
                type="button"
                className="skills-arquivo-item"
                aria-current={a.caminho === caminhoAberto ? 'true' : undefined}
                onClick={() => setCaminhoAberto(a.caminho)}
              >
                <span className="skills-arquivo-icone" aria-hidden="true">
                  {ehMarkdown(a.caminho) ? '📝' : '📄'}
                </span>
                {a.caminho}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div className="skills-visor">
        {aberto === null ? (
          <p className="skills-visor-vazio">Selecione um arquivo.</p>
        ) : (
          <>
            <div className="skills-visor-cabecalho">{aberto.caminho}</div>
            {ehMarkdown(aberto.caminho) ? (
              <div className="skills-visor-corpo skills-arquivo-markdown">
                <MarkdownComFrontmatter texto={aberto.conteudo} />
              </div>
            ) : (
              <pre className="skills-arquivo-conteudo">{aberto.conteudo}</pre>
            )}
          </>
        )}
      </div>
    </div>
  )
}
