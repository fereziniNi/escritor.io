import { diffLines } from 'diff'

function linhasDe(valor: string): string[] {
  const linhas = valor.split('\n')
  if (linhas[linhas.length - 1] === '') linhas.pop()
  return linhas
}

/**
 * Diff de um arquivo (ou campo) entre a versão vigente (`antes`) e a proposta (`depois`).
 * `null` em `antes` = arquivo novo (tudo adicionado); `null` em `depois` = arquivo removido (tudo removido).
 */
export function DiffArquivo({ antes, depois, caminho }: { antes: string | null; depois: string | null; caminho: string }) {
  const partes = diffLines(antes ?? '', depois ?? '')
  return (
    <section className="diff-arquivo">
      <h4 className="diff-arquivo-caminho">
        <span>{caminho}</span>
        {antes === null && <span className="diff-selo">novo</span>}
        {depois === null && <span className="diff-selo">removido</span>}
      </h4>
      <pre className="diff-conteudo">
        {partes.flatMap((parte, i) =>
          linhasDe(parte.value).map((linha, j) => (
            <div key={`${i}-${j}`} className={parte.added ? 'diff-adicionada' : parte.removed ? 'diff-removida' : 'diff-igual'}>
              {linha}
            </div>
          )),
        )}
      </pre>
    </section>
  )
}
