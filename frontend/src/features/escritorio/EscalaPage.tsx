import { useAuthStore } from '../auth/authStore'
import { CalendarioExcecoes } from '../escala/CalendarioExcecoes'
import { EscalaEquipePainel } from '../escala/EscalaEquipePainel'
import { PadraoSemanalForm } from '../escala/PadraoSemanalForm'

/**
 * Pedido do usuário: "calendário individual para indicar os dias que ira trabalhar com opção de
 * deixar sempre a configuração ou poder mudar também o dia e hora. Para que o admin/chefe
 * conseguir ver os momentos em que os funcionários estarão trabalhando". `PadraoSemanalForm` e
 * `CalendarioExcecoes` são sempre sobre a própria escala (qualquer papel usa); `EscalaEquipePainel`
 * (visão de todo mundo) só entra pra GESTOR/ADMIN, mesmo gate de `RelatoriosPage`.
 */
export function EscalaPage() {
  const papel = useAuthStore((estado) => estado.papel)

  return (
    <div className="pagina">
      <PadraoSemanalForm />
      <CalendarioExcecoes />
      {(papel === 'GESTOR' || papel === 'ADMIN') && <EscalaEquipePainel />}
    </div>
  )
}
