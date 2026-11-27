import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render as renderizar, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EnviarArquivo } from './EnviarArquivo';

const criado = { id: '3f2b8c1e-9a7d-4c55-8f0e-1b2c3d4e5f60', nome: 'relatorio.pdf', tipo: 'application/pdf', tamanho: 12, escopo: 'PRIVADO', donoId: 'u1', varredura: 'NAO_VARRIDO', criadoEm: '2026-11-05T12:00:00.000Z' };

const json = (status: number, corpo: unknown) => new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } });

function preparar(resposta: () => Response) {
  const chamadas: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      chamadas.push({ url, init });
      return Promise.resolve(resposta());
    }),
  );
  return chamadas;
}

const render = (ui: ReactElement) =>
  renderizar(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>{ui}</QueryClientProvider>);

const pdf = (nome = 'relatorio.pdf', tamanho = 12) => new File([new Uint8Array(tamanho)], nome, { type: 'application/pdf' });

describe('EnviarArquivo', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('só aceita PDF, PNG, JPEG e XLSX no seletor e diz o tamanho máximo', () => {
    render(<EnviarArquivo maxMb={10} />);
    const entrada = screen.getByLabelText('Arquivo') as HTMLInputElement;
    expect(entrada.accept).toBe('.pdf,.png,.jpg,.jpeg,.xlsx');
    expect(screen.getByText(/até 10 MB/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled();
  });

  it('envia multipart com o escopo ANTES do arquivo, com a sessão, e avisa o sucesso', async () => {
    const chamadas = preparar(() => json(201, criado));
    const aoEnviar = vi.fn();
    render(<EnviarArquivo onEnviado={aoEnviar} />);
    await userEvent.upload(screen.getByLabelText('Arquivo'), pdf());
    await userEvent.selectOptions(screen.getByLabelText('Quem pode ver'), 'GESTAO');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(await screen.findByRole('status')).toHaveTextContent('relatorio.pdf');
    expect(aoEnviar).toHaveBeenCalledWith(criado);
    expect(chamadas[0]!.url).toBe('/api/arquivos');
    expect(chamadas[0]!.init.method).toBe('POST');
    expect(chamadas[0]!.init.credentials).toBe('same-origin');
    const corpo = chamadas[0]!.init.body as FormData;
    expect([...corpo.keys()]).toEqual(['escopo', 'arquivo']);
    expect(corpo.get('escopo')).toBe('GESTAO');
  });

  it('arquivo acima do máximo nem sai do navegador (a API confere de novo)', async () => {
    const chamadas = preparar(() => json(201, criado));
    render(<EnviarArquivo maxMb={1} />);
    await userEvent.upload(screen.getByLabelText('Arquivo'), pdf('grande.pdf', 1024 * 1024 + 1));
    expect(screen.getByRole('alert')).toHaveTextContent(/1 MB/);
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled();
    expect(chamadas).toHaveLength(0);
  });

  it.each([
    [413, /tamanho/i],
    [415, /tipo.*não permitido/i],
    [422, /bloqueado/i],
    [429, /muitos envios|aguarde/i],
    [503, /verificar|tente/i],
  ])('erro %i da API vira mensagem clara', async (status, esperado) => {
    preparar(() => json(status, { status, erro: 'texto da API' }));
    render(<EnviarArquivo />);
    await userEvent.upload(screen.getByLabelText('Arquivo'), pdf());
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(esperado);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Enviar' })).toBeEnabled());
  });

  it('API fora do ar mostra mensagem clara', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('falhou'))));
    render(<EnviarArquivo />);
    await userEvent.upload(screen.getByLabelText('Arquivo'), pdf());
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('API indisponível');
  });
});
