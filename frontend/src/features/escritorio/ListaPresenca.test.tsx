import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ListaPresenca } from './ListaPresenca'
import type { EstadoPresencaUsuario, Zona } from './types'

const FOCO: Zona = { id: 1, nome: 'Sala de foco', x: 0, y: 0, largura: 4, altura: 4, tipo: 'FOCO' }
const REUNIAO: Zona = { id: 2, nome: 'Sala de reunião', x: 5, y: 0, largura: 5, altura: 5, tipo: 'REUNIAO' }
const ZONAS = [FOCO, REUNIAO]

const ANA: EstadoPresencaUsuario = { usuarioId: 1, nome: 'Ana', x: 1, y: 1, status: 'FOCO' }
const BETO: EstadoPresencaUsuario = { usuarioId: 2, nome: 'Beto', x: 8, y: 8, status: 'DISPONIVEL' }

describe('ListaPresenca', () => {
  it('agrupa cada usuário na zona onde a posição dele cai', () => {
    render(<ListaPresenca zonas={ZONAS} usuarios={[ANA, BETO]} meuUsuarioId={null} />)

    expect(within(screen.getByTestId('presenca-zona-1')).getByText(/Ana/)).toBeInTheDocument();
    expect(within(screen.getByTestId('presenca-zona-1')).getByText(/Foco/)).toBeInTheDocument();
    expect(within(screen.getByTestId('presenca-zona-aberto')).getByText(/Beto/)).toBeInTheDocument();
  })

  it('marca o próprio usuário na lista', () => {
    render(<ListaPresenca zonas={ZONAS} usuarios={[ANA]} meuUsuarioId={1} />)

    expect(within(screen.getByTestId('presenca-zona-1')).getByText(/\(você\)/)).toBeInTheDocument()
  })

  it('reage a uma troca de zona/status sem precisar de reload - só passar novas props', () => {
    const { rerender } = render(<ListaPresenca zonas={ZONAS} usuarios={[ANA]} meuUsuarioId={null} />)
    expect(within(screen.getByTestId('presenca-zona-1')).getByText(/Ana/)).toBeInTheDocument()

    const anaMovida: EstadoPresencaUsuario = { ...ANA, x: 6, y: 1, status: 'REUNIAO' }
    rerender(<ListaPresenca zonas={ZONAS} usuarios={[anaMovida]} meuUsuarioId={null} />)

    expect(within(screen.getByTestId('presenca-zona-1')).queryByText(/Ana/)).not.toBeInTheDocument()
    expect(within(screen.getByTestId('presenca-zona-2')).getByText(/Ana/)).toBeInTheDocument()
    expect(within(screen.getByTestId('presenca-zona-2')).getByText(/Reunião/)).toBeInTheDocument()
  })

  it('mostra aviso quando ninguém está conectado', () => {
    render(<ListaPresenca zonas={ZONAS} usuarios={[]} meuUsuarioId={null} />)

    expect(screen.getByText('Ninguém conectado.')).toBeInTheDocument()
  })
})
