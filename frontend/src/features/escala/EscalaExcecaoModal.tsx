import type { ReactNode } from 'react'
import './Escala.css'

/**
 * Pedido do usuário: "quero que tenha um modal dentro desse modal para determinar as horas que
 * vao ser trabalhadas. E depois que preenchido ele some" - o formulário de exceção de um dia
 * (`FormularioExcecaoDoDia`) era só um bloco inline abaixo do calendário; agora abre como um
 * popup por cima de tudo, do jeito que o Google Agenda faz ao clicar num horário. Fecha
 * automaticamente ao salvar/remover com sucesso (`aoSalvar`/`aoRemover` em
 * `EscalaCalendarioPainel` já zeram a seleção no `onSuccess`) ou clicando fora.
 *
 * Não reaproveita `PainelFlutuante` (o modal externo "Minha escala") de propósito: os dois
 * registrariam um listener de Esc na `window`, e como o painel externo já está montado primeiro,
 * o dele sempre dispararia e fecharia TUDO, não só este popup - por isso aqui só fecha por clique
 * fora ou pelos botões do próprio formulário, sem atalho de teclado.
 */
export function EscalaExcecaoModal({ aoFechar, children }: { aoFechar: () => void; children: ReactNode }) {
  return (
    <div className="escala-excecao-modal-fundo" onClick={aoFechar}>
      <div
        className="escala-excecao-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Horário do dia"
        onClick={(evento) => evento.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
