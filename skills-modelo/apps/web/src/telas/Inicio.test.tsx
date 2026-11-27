import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Inicio } from './Inicio';

function renderizar() {
  // retry: false — no teste, erro aparece na hora em vez de após as novas tentativas.
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={cliente}>
      <Inicio />
    </QueryClientProvider>,
  );
}

const respostaJson = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } });

describe('Inicio', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('mostra a situação da API, do banco e a versão vindas de /api/health', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(respostaJson({ status: 'ok', banco: 'ok', versao: '1.2.3', commit: 'abc1234' }));
    vi.stubGlobal('fetch', fetchFalso);
    renderizar();
    expect(await screen.findByText('API no ar')).toBeInTheDocument();
    expect(screen.getByText('Banco ok')).toBeInTheDocument();
    expect(screen.getByText(/versão 1\.2\.3 \(abc1234\)/)).toBeInTheDocument();
    expect(fetchFalso).toHaveBeenCalledWith('/api/health', expect.anything());
  });

  it('mostra erro quando a API não responde', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    renderizar();
    expect(await screen.findByRole('alert')).toHaveTextContent('API indisponível');
  });
});
