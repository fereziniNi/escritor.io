import type { ItemNotificacao } from './useNotificacoes'

/** Pilha de toasts no canto (empilha de baixo pra cima) - `aria-live="polite"` pra leitor de tela
 * anunciar sem interromper o que a pessoa estava fazendo. */
export function Notificacoes({ itens }: { itens: ItemNotificacao[] }) {
  if (itens.length === 0) {
    return null
  }

  return (
    <div className="escritorio-notificacoes" aria-live="polite">
      {itens.map((item) => (
        <div key={item.id} className="escritorio-notificacao">
          {item.texto}
        </div>
      ))}
    </div>
  )
}
