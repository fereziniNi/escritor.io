import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } });
const vazio = (status: number) => new Response(null, { status });

const ANA = { id: '2c8a8f3e-6f5b-4c5e-9d0f-6a1a3f7b9c11', email: 'ana@exemplo.com.br', nome: 'Ana Souza', papel: 'GESTOR' };

/** API falsa com estado: só responde /api/auth/eu com 200 depois do POST /api/auth/entrar, até o POST /api/auth/sair. */
function apiFalsa(cenario: { sairFalha?: boolean } = {}) {
  let logado = false;
  const chamadas: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((caminho: string, opcoes?: RequestInit) => {
      const chave = `${opcoes?.method ?? 'GET'} ${caminho}`;
      chamadas.push(chave);
      if (chave === 'GET /api/auth/eu') return Promise.resolve(logado ? json(ANA) : json({ status: 401, erro: 'Não autenticado' }, 401));
      if (chave === 'GET /api/health') return Promise.resolve(json({ status: 'ok', banco: 'ok', versao: '1.2.3', commit: 'abc1234' }));
      if (chave === 'POST /api/auth/codigo') return Promise.resolve(json({ mensagem: 'Se o e-mail tiver acesso, enviamos um código.' }, 202));
      if (chave === 'POST /api/auth/entrar') {
        logado = true;
        return Promise.resolve(vazio(204));
      }
      if (chave === 'POST /api/auth/sair') {
        if (cenario.sairFalha) return Promise.resolve(json({ status: 500, erro: 'Erro interno' }, 500));
        logado = false;
        return Promise.resolve(vazio(204));
      }
      return Promise.resolve(json({ status: 404, erro: 'Não encontrado' }, 404));
    }),
  );
  return chamadas;
}

describe('App: login de verdade no lugar do usuário fixo', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sem sessão vai para /entrar; entra com o código; mostra o usuário da API; Sair encerra e volta para /entrar', async () => {
    const chamadas = apiFalsa();
    render(<App />);

    // 1. Sem sessão: a área logada manda para a tela de entrada.
    await userEvent.type(await screen.findByLabelText('E-mail'), 'ana@exemplo.com.br');
    expect(window.location.pathname).toBe('/entrar');
    await userEvent.click(screen.getByRole('button', { name: 'Receber código' }));
    await userEvent.type(await screen.findByLabelText('Código'), '123456');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    // 2. Logada: nome e papel (rótulo em português) vindos de /api/auth/eu, nunca fixos no código.
    expect(await screen.findByText('Ana Souza')).toBeInTheDocument();
    expect(screen.getByText('Gestor')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
    // Menu Admin só para ADMIN (a API recusa de qualquer forma: esconder não é segurança).
    expect(screen.queryByRole('link', { name: 'Usuários' })).not.toBeInTheDocument();

    // 3. Sair: POST /api/auth/sair e volta para /entrar.
    await userEvent.click(screen.getByRole('button', { name: 'Sair' }));
    expect(await screen.findByLabelText('E-mail')).toBeInTheDocument();
    await waitFor(() => expect(window.location.pathname).toBe('/entrar'));
    expect(chamadas).toContain('POST /api/auth/sair');
    expect(screen.queryByText('Ana Souza')).not.toBeInTheDocument();
  });

  it('Sair que falha no servidor: mostra o erro e não finge que saiu', async () => {
    window.history.replaceState(null, '', '/entrar');
    apiFalsa({ sairFalha: true });
    render(<App />);
    await userEvent.type(await screen.findByLabelText('E-mail'), 'ana@exemplo.com.br');
    await userEvent.click(screen.getByRole('button', { name: 'Receber código' }));
    await userEvent.type(await screen.findByLabelText('Código'), '123456');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('Ana Souza')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Sair' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível sair');
    expect(screen.getByText('Ana Souza')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
  });
});
