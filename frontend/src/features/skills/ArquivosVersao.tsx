import { useState } from 'react'
import { Markdown } from './Markdown'
import './skills.css'
import type { Arquivo } from './types'

/** Lista de arquivos de uma versão com visualização somente leitura; `.md` é renderizado como markdown. */
export function ArquivosVersao({ arquivos }: { arquivos: Arquivo[] }) {
  const [caminhoAberto, setCaminhoAberto] = useState<string | null>(null)
  const aberto = arquivos.find((a) => a.caminho === caminhoAberto) ?? null
  return (
    <div className="skills-arquivos">
      <ul>
        {arquivos.map((a) => (
          <li key={a.caminho}>
            <button type="button" className="botao-secundario" onClick={() => setCaminhoAberto(a.caminho)}>
              {a.caminho}
            </button>
          </li>
        ))}
      </ul>
      {aberto === null ? (
        <pre className="skills-arquivo-conteudo">Selecione um arquivo.</pre>
      ) : aberto.caminho.toLowerCase().endsWith('.md') ? (
        <div className="skills-arquivo-markdown">
          <Markdown texto={aberto.conteudo} />
        </div>
      ) : (
        <pre className="skills-arquivo-conteudo">{aberto.conteudo}</pre>
      )}
    </div>
  )
}
