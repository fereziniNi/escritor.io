import { useAuthStore } from '../auth/authStore'
import { EscalaCalendarioPainel } from '../escala/EscalaCalendarioPainel'
import { EscalaEquipePainel } from '../escala/EscalaEquipePainel'
import { PadraoSemanalForm } from '../escala/PadraoSemanalForm'

/**
 * Pedido do usuário: "calendário individual para indicar os dias que ira trabalhar com opção de
 * deixar sempre a configuração ou poder mudar também o dia e hora. Para que o admin/chefe
 * conseguir ver os momentos em que os funcionários estarão trabalhando" - e, na sessão seguinte,
 * "algo muito parecido com o agenda do google" (`EscalaCalendarioPainel`: Mês/Semana/Dia).
 * `PadraoSemanalForm` e `EscalaCalendarioPainel` são sempre sobre a própria escala (qualquer papel
 * usa); `EscalaEquipePainel` (visão de todo mundo) só entra pra GESTOR/ADMIN, mesmo gate de
 * `RelatoriosPage`.
 */
export function EscalaPage() {
  const papel = useAuthStore((estado) => estado.papel)

  return (
    <div className="pagina">
      <PadraoSemanalForm />
      <EscalaCalendarioPainel />
      {(papel === 'GESTOR' || papel === 'ADMIN') && <EscalaEquipePainel />}
    </div>
  )
}
