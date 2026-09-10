import type { ItemNotificacao } from './useNotificacoes'

/** Pilha de toasts no canto (empilha de baixo pra cima) - `aria-live="polite"` pra leitor de tela
 * anunciar sem interromper o que a pessoa estava fazendo. Pedido do usuário: "chamar para reunião
 * pela plataforma" - um toast pode carregar um botão de ação (ex.: "Entrar no Meet"), além do
 * texto puro que já existia. */
export function Notificacoes({ itens }: { itens: ItemNotificacao[] }) {
  if (itens.length === 0) {
    return null
  }

  return (
    <div className="escritorio-notificacoes" aria-live="polite">
      {itens.map((item) => (
        <div key={item.id} className="escritorio-notificacao">
          <span>{item.texto}</span>
          {item.acao && (
            <button type="button" className="escritorio-notificacao-acao" onClick={item.acao.aoClicar}>
              {item.acao.rotulo}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
