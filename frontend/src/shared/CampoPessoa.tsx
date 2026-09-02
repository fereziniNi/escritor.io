import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './CampoPessoa.css'
import type { PessoaBasica } from './encontrarPessoaPorNome'

/**
 * Pedido do cliente: "quando for adicionar alguma pessoa ao projeto ou atividade, devemos
 * referenciar o nome dela e não o ID... a pessoa preenchendo o nome e já aparecer as pessoas
 * cadastradas" - input de texto com uma lista de sugestões própria (não `<datalist>` nativo:
 * pedido posterior foi "deixe esse select esteticamente mais bonito", e o menu de um
 * `<datalist>` é desenhado pelo sistema operacional/navegador, fora do alcance de qualquer CSS -
 * então a lista aqui é HTML/CSS nosso, estilizada com a mesma linguagem visual do resto do app,
 * ainda sem depender de nenhuma biblioteca de combobox). Reaproveitado em todo lugar do sistema
 * que referencia uma pessoa (adicionar membro ao projeto, responsável da tarefa, filtro de
 * relatório). Só o campo em si - quem chama decide onde/como mostrar "Pessoa não encontrada"
 * (cada formulário já tem seu próprio padrão de posicionar mensagem de erro), calculando com
 * `encontrarPessoaPorNome`/`existeSugestaoPara` (exportados de `./encontrarPessoaPorNome`).
 *
 * A lista de sugestões é renderizada via `createPortal` em `document.body`, não como filha comum
 * do campo: um `<datalist>` nativo escapa de qualquer `overflow` de ancestral porque o navegador
 * desenha por cima de tudo, mas um `<ul>` absoluto normal não - e este campo é usado dentro do
 * painel flutuante do Escritório, que tem `overflow: hidden`/`overflow-y: auto` (pra cantos
 * arredondados e rolagem do próprio painel). O portal replica o mesmo "por cima de tudo" do
 * nativo, com `position: fixed` recalculada a cada abertura/rolagem/redimensionamento.
 */
export function CampoPessoa({
  id,
  label,
  labelSrOnly = false,
  valor,
  aoMudarValor,
  pessoas,
  obrigatorio = false,
  placeholder = 'Nome da pessoa',
}: {
  id: string
  label: string
  labelSrOnly?: boolean
  valor: string
  aoMudarValor: (texto: string) => void
  pessoas: PessoaBasica[]
  obrigatorio?: boolean
  placeholder?: string
}) {
  const [aberto, setAberto] = useState(false)
  const [indiceAtivo, setIndiceAtivo] = useState(-1)
  const [posicao, setPosicao] = useState<{ top: number; left: number; width: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listaRef = useRef<HTMLUListElement>(null)
  const listaId = `${id}-lista`

  const alvo = valor.trim().toLowerCase()
  const sugestoes = alvo === '' ? pessoas : pessoas.filter((pessoa) => pessoa.nome.toLowerCase().includes(alvo))

  useLayoutEffect(() => {
    if (!aberto) {
      return undefined
    }
    function atualizarPosicao() {
      const retangulo = inputRef.current?.getBoundingClientRect()
      if (retangulo) {
        setPosicao({ top: retangulo.bottom + 4, left: retangulo.left, width: retangulo.width })
      }
    }
    atualizarPosicao()
    // capture:true pra pegar rolagem de qualquer ancestral (ex.: o corpo do painel flutuante),
    // não só da window - eventos de scroll não borbulham, só disparam em fase de captura.
    window.addEventListener('scroll', atualizarPosicao, true)
    window.addEventListener('resize', atualizarPosicao)
    return () => {
      window.removeEventListener('scroll', atualizarPosicao, true)
      window.removeEventListener('resize', atualizarPosicao)
    }
  }, [aberto])

  // Fecha a lista ao clicar fora do campo (ou da lista portalizada) - mesmo padrão de um
  // <select>/<datalist> nativo.
  useEffect(() => {
    if (!aberto) {
      return undefined
    }
    function aoClicarFora(evento: MouseEvent) {
      const alvoClique = evento.target as Node
      if (containerRef.current?.contains(alvoClique) || listaRef.current?.contains(alvoClique)) {
        return
      }
      setAberto(false)
    }
    document.addEventListener('mousedown', aoClicarFora)
    return () => document.removeEventListener('mousedown', aoClicarFora)
  }, [aberto])

  function selecionar(pessoa: PessoaBasica) {
    aoMudarValor(pessoa.nome)
    setAberto(false)
    setIndiceAtivo(-1)
  }

  function aoTeclar(evento: React.KeyboardEvent<HTMLInputElement>) {
    if (evento.key === 'ArrowDown') {
      evento.preventDefault()
      setAberto(true)
      setIndiceAtivo((indice) => Math.min(indice + 1, sugestoes.length - 1))
    } else if (evento.key === 'ArrowUp') {
      evento.preventDefault()
      setIndiceAtivo((indice) => Math.max(indice - 1, 0))
    } else if (evento.key === 'Enter') {
      if (aberto && indiceAtivo >= 0 && sugestoes[indiceAtivo]) {
        evento.preventDefault()
        selecionar(sugestoes[indiceAtivo])
      }
    } else if (evento.key === 'Escape') {
      setAberto(false)
    }
  }

  const opcaoAtivaId = indiceAtivo >= 0 && sugestoes[indiceAtivo] ? `${id}-opcao-${sugestoes[indiceAtivo].id}` : undefined

  return (
    <div className="campo-pessoa" ref={containerRef}>
      <label htmlFor={id} className={labelSrOnly ? 'sr-only' : undefined}>
        {label}
      </label>
      <input
        id={id}
        ref={inputRef}
        role="combobox"
        aria-expanded={aberto}
        aria-controls={listaId}
        aria-autocomplete="list"
        aria-activedescendant={opcaoAtivaId}
        value={valor}
        onChange={(evento) => {
          aoMudarValor(evento.target.value)
          setAberto(true)
          setIndiceAtivo(-1)
        }}
        onFocus={() => setAberto(true)}
        onKeyDown={aoTeclar}
        placeholder={placeholder}
        autoComplete="off"
        required={obrigatorio}
        className="campo-pessoa-input"
      />
      {aberto &&
        sugestoes.length > 0 &&
        posicao &&
        createPortal(
          <ul
            ref={listaRef}
            className="campo-pessoa-lista"
            role="listbox"
            id={listaId}
            style={{ top: posicao.top, left: posicao.left, width: posicao.width }}
          >
            {sugestoes.map((pessoa, indice) => (
              <li
                key={pessoa.id}
                id={`${id}-opcao-${pessoa.id}`}
                role="option"
                aria-selected={indice === indiceAtivo}
                className={indice === indiceAtivo ? 'campo-pessoa-opcao ativa' : 'campo-pessoa-opcao'}
                onMouseDown={(evento) => {
                  // preventDefault evita que o input perca o foco antes do clique registrar.
                  evento.preventDefault()
                  selecionar(pessoa)
                }}
              >
                {pessoa.nome}
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </div>
  )
}
