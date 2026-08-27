import { Link } from 'react-router'
import { useAuthStore } from '../features/auth/authStore'
import { PontoWidget } from '../features/ponto/PontoWidget'
import { HealthStatus } from './HealthStatus'

export function HomePage() {
  const papel = useAuthStore((estado) => estado.papel)

  return (
    <main>
      <h1>Sistema de Presença, Ponto e Tarefas</h1>
      <HealthStatus />
      <PontoWidget />

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
