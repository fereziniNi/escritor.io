import type { ReactNode } from 'react'
import { Navigate } from 'react-router'
import { useAuthStore } from '../features/auth/authStore'
import type { Papel } from '../features/auth/types'

interface ProtectedRouteProps {
  papeisPermitidos?: Papel[]
  children: ReactNode
}

export function ProtectedRoute({ papeisPermitidos, children }: ProtectedRouteProps) {
  const autenticado = useAuthStore((estado) => estado.autenticado)
  const papel = useAuthStore((estado) => estado.papel)

  if (!autenticado) {
    return <Navigate to="/login" replace />
  }

  if (papeisPermitidos && (papel === null || !papeisPermitidos.includes(papel))) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
