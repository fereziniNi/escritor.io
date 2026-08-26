import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from '../features/auth/authStore'
import { ProtectedRoute } from './ProtectedRoute'

const ESTADO_INICIAL = useAuthStore.getState()

beforeEach(() => {
  useAuthStore.setState(ESTADO_INICIAL, true)
})

function renderComRota(elemento: ReactNode) {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/" element={<p>Página inicial</p>} />
        <Route path="/admin" element={elemento} />
        <Route path="/login" element={<p>Tela de login</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ProtectedRoute', () => {
  it('redireciona para /login quando não há sessão', () => {
    renderComRota(
      <ProtectedRoute>
        <p>Conteúdo protegido</p>
      </ProtectedRoute>,
    )

    expect(screen.getByText('Tela de login')).toBeInTheDocument()
    expect(screen.queryByText('Conteúdo protegido')).not.toBeInTheDocument()
  })

  it('renderiza o conteúdo quando autenticado', () => {
    useAuthStore.getState().definirSessao('token-fake', 'COLABORADOR')

    renderComRota(
      <ProtectedRoute>
        <p>Conteúdo protegido</p>
      </ProtectedRoute>,
    )

    expect(screen.getByText('Conteúdo protegido')).toBeInTheDocument()
  })

  it('redireciona para fora quando o papel do usuário não está entre os permitidos', () => {
    useAuthStore.getState().definirSessao('token-fake', 'COLABORADOR')

    renderComRota(
      <ProtectedRoute papeisPermitidos={['ADMIN']}>
        <p>Conteúdo só de admin</p>
      </ProtectedRoute>,
    )

    expect(screen.getByText('Página inicial')).toBeInTheDocument()
    expect(screen.queryByText('Conteúdo só de admin')).not.toBeInTheDocument()
  })

  it('renderiza quando o papel do usuário está entre os permitidos', () => {
    useAuthStore.getState().definirSessao('token-fake', 'ADMIN')

    renderComRota(
      <ProtectedRoute papeisPermitidos={['ADMIN']}>
        <p>Conteúdo só de admin</p>
      </ProtectedRoute>,
    )

    expect(screen.getByText('Conteúdo só de admin')).toBeInTheDocument()
  })
})
