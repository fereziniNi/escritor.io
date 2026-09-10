import { ConectarGoogleAgenda } from '../escala/ConectarGoogleAgenda'
import { EscalaCalendarioPainel } from '../escala/EscalaCalendarioPainel'
import { PadraoSemanalForm } from '../escala/PadraoSemanalForm'

/**
 * Pedido do usuário: "calendário individual para indicar os dias que ira trabalhar com opção de
 * deixar sempre a configuração ou poder mudar também o dia e hora" - e, na sessão seguinte, "algo
 * muito parecido com o agenda do google" (`EscalaCalendarioPainel`: Mês/Semana/Dia). Sempre sobre
 * a própria escala, qualquer papel usa.
 *
 * <p>Até aqui também vivia `EscalaEquipePainel` (a visão da equipe, onde o chefe marca reunião) -
 * pedido do usuário: "Queria que o calendario pessoal de horarios ficasse em uma parte e para
 * agendar as reunioes em outra opcao do sistema" - agora é uma opção própria da barra de
 * ferramentas (`ReunioesPage`), não mais uma seção dentro deste painel.
 */
export function EscalaPage({ aoEntrarNaReuniao }: { aoEntrarNaReuniao: () => void }) {
  return (
    <div className="pagina">
      <ConectarGoogleAgenda />
      <PadraoSemanalForm />
      <EscalaCalendarioPainel aoEntrarNaReuniao={aoEntrarNaReuniao} />
    </div>
  )
}
