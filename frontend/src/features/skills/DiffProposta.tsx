import { DiffArquivo } from './DiffArquivo'
import './skills.css'
import { ROTULO_CATEGORIA, type SkillVersao } from './types'

/** Campos versionados além dos arquivos, comparados como texto. */
function camposTexto(v: SkillVersao): [string, string][] {
  return [
    ['Nome', v.nome],
    ['Descrição', v.descricao],
    ['Categoria', ROTULO_CATEGORIA[v.categoria]],
    ['Prompt de uso', v.promptUso ?? ''],
    ['Tutorial de instalação', v.tutorialInstalacao ?? ''],
  ]
}

export function DiffProposta({ vigente, proposta }: { vigente: SkillVersao; proposta: SkillVersao }) {
  const camposAntes = camposTexto(vigente)
  const camposAlterados = camposTexto(proposta)
    .map(([rotulo, valor], i) => ({ rotulo, antes: camposAntes[i][1], depois: valor }))
    .filter((c) => c.antes !== c.depois)
  const antes = new Map(vigente.arquivos.map((a) => [a.caminho, a.conteudo]))
  const depois = new Map(proposta.arquivos.map((a) => [a.caminho, a.conteudo]))
  const caminhos = [...new Set([...antes.keys(), ...depois.keys()])].sort()
  const arquivosAlterados = caminhos.filter((c) => antes.get(c) !== depois.get(c))

  if (camposAlterados.length === 0 && arquivosAlterados.length === 0) {
    return <p className="mensagem-vazia">Nenhuma diferença em relação à versão vigente.</p>
  }
  return (
    <div className="diff-proposta">
      {camposAlterados.map((c) => (
        <DiffArquivo key={c.rotulo} caminho={c.rotulo} antes={c.antes} depois={c.depois} />
      ))}
      {arquivosAlterados.map((c) => (
        <DiffArquivo key={c} caminho={c} antes={antes.get(c) ?? null} depois={depois.get(c) ?? null} />
      ))}
    </div>
  )
}
