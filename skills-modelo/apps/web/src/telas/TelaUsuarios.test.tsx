import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TelaUsuarios } from './TelaUsuarios';

const ana = { id: '2c8a8f3e-6f5b-4c5e-9d0f-6a1a3f7b9c11', email: 'ana@exemplo.com.br', nome: 'Ana Souza', papel: 'ADMIN', ativo: true, criadoEm: '2026-11-05T12:00:00.000Z' };
const beto = { id: '7d1b0c2e-1f3a-4b8d-8e7c-5a9b2c4d6e80', email: 'beto@exemplo.com.br', nome: 'Beto Lima', papel: 'USUARIO', ativo: true, criadoEm: '2026-11-04T12:00:00.000Z' };
const cris = { id: '9e2f1a3b-4c5d-4e6f-8a7b-1c2d3e4f5a6b', email: 'cris@exemplo.com.br', nome: 'Cris Dias', papel: 'GESTOR', ativo: false, criadoEm: '2026-11-03T12:00:00.000Z' };

const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } });

function renderizar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={cliente}>
      <TelaUsuarios />
    </QueryClientProvider>,
  );
}

/** fetch falso: responde a lista e registra cada chamada (método, caminho, corpo). */
function fetchFalso(respostas: Record<string, () => Response> = {}) {
  const chamadas: { metodo: string; caminho: string; corpo: unknown }[] = [];
  const fn = vi.fn((caminho: string, opcoes?: RequestInit) => {
    const metodo = opcoes?.method ?? 'GET';
    chamadas.push({ metodo, caminho, corpo: opcoes?.body ? JSON.parse(opcoes.body as string) : undefined });
    const chave = `${metodo} ${caminho}`;
    const resposta = respostas[chave];
    if (resposta) return Promise.resolve(resposta());
    if (chave === 'GET /api/usuarios') return Promise.resolve(json([ana, beto, cris]));
    return Promise.resolve(json({ ...beto }));
  });
  vi.stubGlobal('fetch', fn);
  return chamadas;
}

describe('TelaUsuarios', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lista os usuários com papel, situação e e-mail', async () => {
    fetchFalso();
    renderizar();
    const tabela = await screen.findByRole('table');
    expect(within(tabela).getByText('Ana Souza')).toBeInTheDocument();
    expect(within(tabela).getByText('beto@exemplo.com.br')).toBeInTheDocument();
    expect(within(tabela).getAllByText('Ativo')).toHaveLength(2);
    expect(within(tabela).getByText('Desativado')).toBeInTheDocument();
  });

  it('mostra erro quando a API recusa a listagem', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ status: 403, erro: 'Acesso negado' }, 403)));
    renderizar();
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso negado');
  });

  it('convida: envia e-mail, nome e papel por POST e mostra o aviso', async () => {
    const chamadas = fetchFalso({ 'POST /api/usuarios': () => json({ ...beto, id: 'a1b2c3d4-0000-4000-8000-000000000001' }, 201) });
    renderizar();
    await screen.findByRole('table');
    await userEvent.type(screen.getByLabelText('E-mail'), 'dora@exemplo.com.br');
    await userEvent.type(screen.getByLabelText('Nome'), 'Dora Reis');
    await userEvent.selectOptions(screen.getByLabelText('Papel'), 'GESTOR');
    await userEvent.click(screen.getByRole('button', { name: 'Convidar' }));
    await waitFor(() => expect(chamadas.some((c) => c.metodo === 'POST' && c.caminho === '/api/usuarios')).toBe(true));
    const post = chamadas.find((c) => c.metodo === 'POST')!;
    expect(post.corpo).toEqual({ email: 'dora@exemplo.com.br', nome: 'Dora Reis', papel: 'GESTOR' });
    expect(await screen.findByRole('status')).toHaveTextContent('Convite enviado');
  });

  it('mostra a mensagem da API quando o e-mail já existe (409)', async () => {
    fetchFalso({ 'POST /api/usuarios': () => json({ status: 409, erro: 'Já existe um usuário com este e-mail' }, 409) });
    renderizar();
    await screen.findByRole('table');
    await userEvent.type(screen.getByLabelText('E-mail'), 'ana@exemplo.com.br');
    await userEvent.type(screen.getByLabelText('Nome'), 'Ana');
    await userEvent.click(screen.getByRole('button', { name: 'Convidar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Já existe um usuário com este e-mail');
  });

  it('troca o papel com PATCH no valor do enum (não no rótulo)', async () => {
    const chamadas = fetchFalso();
    renderizar();
    const linha = (await screen.findByText('Beto Lima')).closest('tr')!;
    await userEvent.selectOptions(within(linha).getByLabelText('Papel de Beto Lima'), 'GESTOR');
    await waitFor(() => expect(chamadas.some((c) => c.metodo === 'PATCH')).toBe(true));
    const patch = chamadas.find((c) => c.metodo === 'PATCH')!;
    expect(patch.caminho).toBe(`/api/usuarios/${beto.id}/papel`);
    expect(patch.corpo).toEqual({ papel: 'GESTOR' });
  });

  it('desativa e reativa por POST (nunca há botão de apagar)', async () => {
    const chamadas = fetchFalso();
    renderizar();
    const linhaBeto = (await screen.findByText('Beto Lima')).closest('tr')!;
    await userEvent.click(within(linhaBeto).getByRole('button', { name: 'Desativar' }));
    await waitFor(() => expect(chamadas.some((c) => c.caminho === `/api/usuarios/${beto.id}/desativar`)).toBe(true));
    const linhaCris = screen.getByText('Cris Dias').closest('tr')!;
    await userEvent.click(within(linhaCris).getByRole('button', { name: 'Reativar' }));
    await waitFor(() => expect(chamadas.some((c) => c.caminho === `/api/usuarios/${cris.id}/reativar`)).toBe(true));
    expect(screen.queryByRole('button', { name: /apagar|excluir|remover/i })).not.toBeInTheDocument();
  });

  it('mostra o erro de "último administrador" (409) ao desativar', async () => {
    fetchFalso({ [`POST /api/usuarios/${ana.id}/desativar`]: () => json({ status: 409, erro: 'Não é possível remover o último administrador ativo' }, 409) });
    renderizar();
    const linha = (await screen.findByText('Ana Souza')).closest('tr')!;
    await userEvent.click(within(linha).getByRole('button', { name: 'Desativar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('último administrador');
  });
});
