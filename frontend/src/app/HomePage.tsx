import { Link } from 'react-router'
import { FilaAjustesPainel } from '../features/ajustes/FilaAjustesPainel'
import { SolicitarAjusteForm } from '../features/ajustes/SolicitarAjusteForm'
import { useAuthStore } from '../features/auth/authStore'
import { EspelhoMesPainel } from '../features/ponto/EspelhoMesPainel'
import { JornadaPainel } from '../features/ponto/JornadaPainel'
import { PontoWidget } from '../features/ponto/PontoWidget'
import { HealthStatus } from './HealthStatus'

export function HomePage() {
  const papel = useAuthStore((estado) => estado.papel)

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '1.5rem 1rem 3rem' }}>
      <h1 style={{ fontSize: '1.5rem' }}>🏢 Sistema de Presença, Ponto e Tarefas</h1>

      <nav
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          marginBottom: '1.5rem',
        }}
      >
        <Link
          to="/escritorio"
          style={{
            background: 'var(--cor-acento)',
            color: '#fff',
            padding: '0.5em 1em',
            borderRadius: 999,
            boxShadow: '0 3px 0 var(--cor-acento-escuro)',
          }}
        >
          🎮 Ir pro Escritório
        </Link>
        <Link to="/kanban" style={{ alignSelf: 'center' }}>
          Quadros
        </Link>
        {(papel === 'GESTOR' || papel === 'ADMIN') && (
          <Link to="/relatorios" style={{ alignSelf: 'center' }}>
            Relatórios
          </Link>
        )}
        {papel === 'ADMIN' && (
          <>
            <Link to="/admin/equipes" style={{ alignSelf: 'center' }}>
              Equipes
            </Link>
            <Link to="/admin/projetos" style={{ alignSelf: 'center' }}>
              Projetos
            </Link>
          </>
        )}
      </nav>

      <div className="cartao">
        <HealthStatus />
      </div>
      <div className="cartao">
        <PontoWidget />
      </div>
      <div className="cartao">
        <JornadaPainel />
      </div>
      <div className="cartao">
        <EspelhoMesPainel />
      </div>
      <div className="cartao">
        <SolicitarAjusteForm />
      </div>

      {(papel === 'GESTOR' || papel === 'ADMIN') && (
        <div className="cartao">
          <FilaAjustesPainel />
        </div>
      )}
    </main>
  )
}
