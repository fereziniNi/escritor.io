import type { ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/** Rebaixa os títulos um nível: o h1 da página é o nome da skill, então `#` vira `<h2>`. */
const TITULOS = {
  h1: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>,
  h2: ({ children }: { children?: ReactNode }) => <h3>{children}</h3>,
  h3: ({ children }: { children?: ReactNode }) => <h4>{children}</h4>,
  h4: ({ children }: { children?: ReactNode }) => <h5>{children}</h5>,
}

/** Renderiza markdown (GFM) sem HTML bruto: sem `rehype-raw`, tags HTML no texto não viram elementos. */
export function Markdown({ texto }: { texto: string }) {
  return (
    <div className="skills-markdown">
      <ReactMarkdown components={TITULOS} remarkPlugins={[remarkGfm]}>{texto}</ReactMarkdown>
    </div>
  )
}
