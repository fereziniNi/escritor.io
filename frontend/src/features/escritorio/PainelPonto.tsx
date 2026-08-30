import { FilaAjustesPainel } from '../ajustes/FilaAjustesPainel'
import { SolicitarAjusteForm } from '../ajustes/SolicitarAjusteForm'
import { useAuthStore } from '../auth/authStore'
import { EspelhoMesPainel } from '../ponto/EspelhoMesPainel'
import { JornadaPainel } from '../ponto/JornadaPainel'
import { PontoWidget } from '../ponto/PontoWidget'

/** Agrupa tudo que era da antiga `HomePage` num único painel do dock - nenhum dos componentes
 * internos mudou, só o lugar de onde são montados. */
export function PainelPonto() {
  const papel = useAuthStore((estado) => estado.papel)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <PontoWidget />
      <JornadaPainel />
      <EspelhoMesPainel />
      <SolicitarAjusteForm />
      {(papel === 'GESTOR' || papel === 'ADMIN') && <FilaAjustesPainel />}
    </div>
  )
}
