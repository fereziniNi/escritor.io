import type { PessoaBasica } from './encontrarPessoaPorNome'

/**
 * Pedido do cliente: "quando for adicionar alguma pessoa ao projeto ou atividade, devemos
 * referenciar o nome dela e não o ID... a pessoa preenchendo o nome e já aparecer as pessoas
 * cadastradas" - input de texto com `<datalist>` nativo (digitar mostra as sugestões, sem
 * precisar de um componente de combobox próprio) reaproveitado em todo lugar do sistema que
 * referencia uma pessoa (adicionar membro ao projeto, responsável da tarefa, filtro de
 * relatório). Só o campo em si - quem chama decide onde/como mostrar "Pessoa não encontrada"
 * (cada formulário já tem seu próprio padrão de posicionar mensagem de erro), calculando com
 * `encontrarPessoaPorNome` (exportado de `./encontrarPessoaPorNome`).
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
  const listaId = `${id}-lista`

  return (
    <>
      <label htmlFor={id} className={labelSrOnly ? 'sr-only' : undefined}>
        {label}
      </label>
      <input
        id={id}
        list={listaId}
        value={valor}
        onChange={(evento) => aoMudarValor(evento.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        required={obrigatorio}
      />
      <datalist id={listaId}>
        {pessoas.map((pessoa) => (
          <option key={pessoa.id} value={pessoa.nome} />
        ))}
      </datalist>
    </>
  )
}
