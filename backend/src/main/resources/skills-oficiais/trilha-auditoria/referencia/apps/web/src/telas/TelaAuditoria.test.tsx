// origem: skills-modelo/estagios/trilha-auditoria/apps/web/src/telas/TelaAuditoria.test.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TelaAuditoria } from './TelaAuditoria';

const ANA = { id: '2c8a8f3e-6f5b-4c5e-9d0f-6a1a3f7b9c11', email: 'ana@exemplo.com.br', nome: 'Ana Souza', papel: 'ADMIN', ativo: true, criadoEm: '2026-11-01T12:00:00.000Z' };
const BETO = { id: '7d1b0c2e-1f3a-4b8d-8e7c-5a9b2c4d6e80', email: 'beto@exemplo.com.br', nome: 'Beto Lima', papel: 'USUARIO', ativo: true, criadoEm: '2026-11-02T12:00:00.000Z' };

const evento = (n: number, extra: Record<string, unknown> = {}) => ({
  id: String(n),
  ocorridoEm: '2026-11-05T15:30:00.000Z',
  atorId: ANA.id,
  atorEmail: ANA.email,
  acao: 'usuario.desativar',
  alvoTipo: 'usuario',
  alvoId: BETO.id,
  antes: { papel: 'USUARIO', ativo: true },
  depois: { papel: 'USUARIO', ativo: false },
  ip: '10.0.0.5',
  requestId: 'req-abcdef12',
  ...extra,
});

const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } });

function renderizar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={cliente}>
      <TelaAuditoria />
    </QueryClientProvider>,
  );
}

/** fetch falso: registra as URLs e responde pelo caminho (sem a query). */
function fetchFalso(respostas: Record<string, (url: URL) => Response> = {}) {
  const urls: URL[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((caminho: string) => {
      const url = new URL(caminho, 'http://localhost');
      urls.push(url);
      const resp = respostas[url.pathname];
      if (resp) return Promise.resolve(resp(url));
      if (url.pathname === '/api/usuarios') return Promise.resolve(json([ANA, BETO]));
      if (url.pathname === '/api/admin/auditoria') return Promise.resolve(json({ itens: [evento(2), evento(1, { acao: 'auth.login', alvoTipo: null, alvoId: null, antes: null, depois: null })], proximoCursor: null }));
      return Promise.resolve(json({ status: 404, erro: 'Não encontrado' }, 404));
    }),
  );
  return urls;
}

describe('TelaAuditoria', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('lista os eventos com data em Brasília, ator, ação, alvo e IP', async () => {
    fetchFalso();
    renderizar();
    const tabela = await screen.findByRole('table');
    expect(within(tabela).getByText('usuario.desativar')).toBeInTheDocument();
    expect(within(tabela).getByText('auth.login')).toBeInTheDocument();
    expect(within(tabela).getAllByText('ana@exemplo.com.br').length).toBeGreaterThan(0);
    expect(within(tabela).getAllByText('10.0.0.5').length).toBeGreaterThan(0);
    // 15:30 UTC = 12:30 em Brasília
    expect(within(tabela).getAllByText(/05\/11\/2026.*12:30/).length).toBeGreaterThan(0);
  });

  it('mostra antes e depois de um evento ao abrir os detalhes', async () => {
    fetchFalso();
    renderizar();
    const linha = (await screen.findByText('usuario.desativar')).closest('tr')!;
    await userEvent.click(within(linha).getByText('Detalhes'));
    expect(within(linha).getByText(/"ativo": false/)).toBeInTheDocument();
    expect(within(linha).getByText(/"ativo": true/)).toBeInTheDocument();
    expect(within(linha).getByText('req-abcdef12')).toBeInTheDocument();
  });

  it('filtra por período, ator e ação: manda os parâmetros certos (dia inteiro no horário de Brasília)', async () => {
    const urls = fetchFalso();
    renderizar();
    await screen.findByRole('table');
    await userEvent.type(screen.getByLabelText('De'), '2026-11-01');
    await userEvent.type(screen.getByLabelText('Até'), '2026-11-05');
    await userEvent.selectOptions(await screen.findByLabelText('Ator'), BETO.id);
    await userEvent.type(screen.getByLabelText('Ação'), 'usuario.desativar');
    await userEvent.click(screen.getByRole('button', { name: 'Filtrar' }));
    await waitFor(() => expect(urls.some((u) => u.searchParams.get('acao') === 'usuario.desativar')).toBe(true));
    const u = urls.filter((x) => x.pathname === '/api/admin/auditoria').at(-1)!;
    expect(u.searchParams.get('de')).toBe('2026-11-01T00:00:00-03:00');
    expect(u.searchParams.get('ate')).toBe('2026-11-05T23:59:59.999-03:00');
    expect(u.searchParams.get('atorId')).toBe(BETO.id);
  });

  it('"Carregar mais" pede a página seguinte com o cursor e junta as linhas', async () => {
    const urls = fetchFalso({
      '/api/admin/auditoria': (url) =>
        url.searchParams.get('cursor') === '2'
          ? json({ itens: [evento(1, { acao: 'auth.logout' })], proximoCursor: null })
          : json({ itens: [evento(3), evento(2)], proximoCursor: '2' }),
    });
    renderizar();
    await screen.findByRole('table');
    await userEvent.click(screen.getByRole('button', { name: 'Carregar mais' }));
    expect(await screen.findByText('auth.logout')).toBeInTheDocument();
    expect(urls.some((u) => u.searchParams.get('cursor') === '2')).toBe(true);
    expect(screen.getAllByText('usuario.desativar')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Carregar mais' })).not.toBeInTheDocument();
  });

  it('exporta CSV com os mesmos filtros e baixa o arquivo', async () => {
    const criar = vi.fn(() => 'blob:csv');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: criar, revokeObjectURL: vi.fn() }));
    const clicar = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const urls = fetchFalso({
      '/api/admin/auditoria/csv': () => new Response('﻿Id;Ação\r\n1;x\r\n', { status: 200, headers: { 'content-type': 'text/csv; charset=utf-8', 'x-exportacao-truncada': 'false' } }),
    });
    renderizar();
    await screen.findByRole('table');
    await userEvent.type(screen.getByLabelText('Ação'), 'auth.login');
    await userEvent.click(screen.getByRole('button', { name: 'Filtrar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }));
    await waitFor(() => expect(clicar).toHaveBeenCalled());
    const csv = urls.find((u) => u.pathname === '/api/admin/auditoria/csv')!;
    expect(csv.searchParams.get('acao')).toBe('auth.login');
    expect(criar).toHaveBeenCalled();
  });

  it('avisa quando a exportação foi cortada no limite', async () => {
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:csv'), revokeObjectURL: vi.fn() }));
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    fetchFalso({
      '/api/admin/auditoria/csv': () => new Response('﻿Id\r\n', { status: 200, headers: { 'content-type': 'text/csv', 'x-exportacao-truncada': 'true' } }),
    });
    renderizar();
    await screen.findByRole('table');
    await userEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }));
    expect(await screen.findByRole('status')).toHaveTextContent('10.000');
  });

  it('mostra a mensagem da API quando a listagem é recusada (403)', async () => {
    fetchFalso({ '/api/admin/auditoria': () => json({ status: 403, erro: 'Acesso negado' }, 403) });
    renderizar();
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso negado');
  });

  it('estado vazio quando nada bate com o filtro', async () => {
    fetchFalso({ '/api/admin/auditoria': () => json({ itens: [], proximoCursor: null }) });
    renderizar();
    expect(await screen.findByText('Nenhum evento')).toBeInTheDocument();
  });

  it('não existe botão de apagar ou editar evento', async () => {
    fetchFalso();
    renderizar();
    await screen.findByRole('table');
    expect(screen.queryByRole('button', { name: /apagar|excluir|remover|editar/i })).not.toBeInTheDocument();
  });
});
