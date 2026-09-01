import { EspelhoMesPainel } from '../ponto/EspelhoMesPainel'
import { JornadaPainel } from '../ponto/JornadaPainel'
import { PontoWidget } from '../ponto/PontoWidget'

/** Agrupa tudo que era da antiga `HomePage` num único painel do dock - nenhum dos componentes
 * internos mudou, só o lugar de onde são montados. Sem "Solicitar ajuste de ponto" nem a fila de
 * aprovação (pedido do usuário: "pode eliminar no front e no back") - removidos do sistema todo. */
export function PainelPonto() {
  return (
    <div className="pagina">
      <PontoWidget />
      <JornadaPainel />
      <EspelhoMesPainel />
    </div>
  )
}
