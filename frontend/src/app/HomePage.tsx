import { Link } from 'react-router'
import { FilaAjustesPainel } from '../features/ajustes/FilaAjustesPainel'
import { SolicitarAjusteForm } from '../features/ajustes/SolicitarAjusteForm'
import { useAuthStore } from '../features/auth/authStore'
import { JornadaPainel } from '../features/ponto/JornadaPainel'
import { PontoWidget } from '../features/ponto/PontoWidget'
import { HealthStatus } from './HealthStatus'

export function HomePage() {
  const papel = useAuthStore((estado) => estado.papel)

  return (
    <main>
      <h1>Sistema de Presença, Ponto e Tarefas</h1>
      <HealthStatus />
      <PontoWidget />
      <JornadaPainel />
      <SolicitarAjusteForm />

      {(papel === 'GESTOR' || papel === 'ADMIN') && <FilaAjustesPainel />}

      {papel === 'ADMIN' && (
        <nav>
          <Link to="/admin/equipes">Equipes</Link>
          {' · '}
          <Link to="/admin/projetos">Projetos</Link>
        </nav>
      )}
    </main>
  )
}
