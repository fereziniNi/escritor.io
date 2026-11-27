import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppShell, type GrupoMenu } from './AppShell';

const grupos: GrupoMenu[] = [
  { titulo: 'Operação', itens: [{ rotulo: 'Painel', para: '/' }, { rotulo: 'Cedentes', para: '/cedentes' }] },
  { titulo: 'Admin', itens: [{ rotulo: 'Usuários', para: '/usuarios' }] },
];

function renderizar(rota: string) {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <AppShell nomeSistema="Crédito" grupos={grupos} usuario={{ nome: 'Ana Souza', papel: 'Gestor' }} versao="1.2.3">
        <p>conteúdo da página</p>
      </AppShell>
    </MemoryRouter>,
  );
}

describe('AppShell', () => {
  beforeEach(() => localStorage.clear());

  it('marca só o item da rota atual com aria-current="page"', () => {
    renderizar('/cedentes');
    expect(screen.getByRole('link', { name: 'Cedentes' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Painel' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Usuários' })).not.toHaveAttribute('aria-current');
  });

  it('mostra a marca, os grupos, o usuário, a versão e o conteúdo', () => {
    renderizar('/');
    expect(screen.getByLabelText('Beyond Crédito, Multiplica')).toBeInTheDocument();
    expect(screen.getByText('Operação')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Ana Souza')).toBeInTheDocument();
    expect(screen.getByText('v1.2.3')).toBeInTheDocument();
    expect(screen.getByText('conteúdo da página')).toBeInTheDocument();
  });

  it('o botão de tema alterna e grava a escolha', async () => {
    renderizar('/');
    await userEvent.click(screen.getByRole('button', { name: /tema/i }));
    expect(localStorage.getItem('multiplica:tema')).toBe('escuro');
    expect(document.documentElement.dataset['theme']).toBe('dark');
  });
});
