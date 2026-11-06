// origem: skills-modelo/apps/web/src/componentes/BotaoExportar.test.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render as renderizar, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BotaoExportar } from './BotaoExportar';

function arquivo(cabecalhos: Record<string, string> = {}, status = 200, corpo: BodyInit = 'dados') {
  return new Response(corpo, { status, headers: { 'content-disposition': `attachment; filename="clientes-20261105.csv"; filename*=UTF-8''clientes-20261105.csv`, ...cabecalhos } });
}

function preparar(resposta: () => Response) {
  const chamadas: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      chamadas.push(url);
      return Promise.resolve(resposta());
    }),
  );
  const criar = vi.fn(() => 'blob:arquivo');
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: criar, revokeObjectURL: vi.fn() }));
  const clicar = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    baixados.push(this.download);
  });
  return { chamadas, criar, clicar };
}

const baixados: string[] = [];

const render = (ui: ReactElement) =>
  renderizar(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>{ui}</QueryClientProvider>);

describe('BotaoExportar', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    baixados.length = 0;
  });

  it('abre o menu com Excel, PDF e CSV (e só eles, na ordem pedida)', async () => {
    preparar(() => arquivo());
    render(<BotaoExportar url="/api/clientes/exportar" />);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Exportar' }));
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Excel (.xlsx)', 'PDF', 'CSV']);
  });

  it('formatos limitados pela propriedade', async () => {
    preparar(() => arquivo());
    render(<BotaoExportar url="/api/x" formatos={['csv']} />);
    await userEvent.click(screen.getByRole('button', { name: 'Exportar' }));
    expect(screen.getAllByRole('menuitem')).toHaveLength(1);
  });

  it('pede o arquivo com o formato e os parâmetros, com a sessão (same-origin), e baixa com o nome da API', async () => {
    const { chamadas } = preparar(() => arquivo());
    render(<BotaoExportar url="/api/clientes/exportar" parametros={{ de: '2026-11-01' }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Exportar' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'CSV' }));
    await waitFor(() => expect(baixados).toEqual(['clientes-20261105.csv']));
    const u = new URL(chamadas[0]!, 'http://localhost');
    expect(u.pathname).toBe('/api/clientes/exportar');
    expect(u.searchParams.get('formato')).toBe('csv');
    expect(u.searchParams.get('de')).toBe('2026-11-01');
    expect(await screen.findByRole('status')).toHaveTextContent('clientes-20261105.csv');
  });

  it('usa o nome com acento de filename* quando existe', async () => {
    preparar(() => arquivo({ 'content-disposition': `attachment; filename="Relatorio_marco.xlsx"; filename*=UTF-8''Relat%C3%B3rio%20mar%C3%A7o.xlsx` }));
    render(<BotaoExportar url="/api/x" />);
    await userEvent.click(screen.getByRole('button', { name: 'Exportar' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Excel (.xlsx)' }));
    await waitFor(() => expect(baixados).toEqual(['Relatório março.xlsx']));
  });

  it('avisa quando a API cortou a exportação no limite de linhas', async () => {
    preparar(() => arquivo({ 'x-exportacao-truncada': 'true' }));
    render(<BotaoExportar url="/api/x" />);
    await userEvent.click(screen.getByRole('button', { name: 'Exportar' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'PDF' }));
    expect(await screen.findByRole('status')).toHaveTextContent(/cortad/i);
  });

  it('mostra o erro da API (ex.: 403) e não baixa nada', async () => {
    const { criar } = preparar(() => new Response(JSON.stringify({ status: 403, erro: 'Sem permissão' }), { status: 403, headers: { 'content-type': 'application/json' } }));
    render(<BotaoExportar url="/api/x" />);
    await userEvent.click(screen.getByRole('button', { name: 'Exportar' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'CSV' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Sem permissão');
    expect(criar).not.toHaveBeenCalled();
  });

  it('API fora do ar mostra mensagem clara', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('falhou'))));
    render(<BotaoExportar url="/api/x" />);
    await userEvent.click(screen.getByRole('button', { name: 'Exportar' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'CSV' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('API indisponível');
  });
});
