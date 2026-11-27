import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TelaEntrar } from './TelaEntrar';

const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } });
const vazio = (status: number) => new Response(null, { status });

/** fetch falso: responde por "MÉTODO caminho" e registra as chamadas com o corpo. */
function fetchFalso(respostas: Record<string, () => Response>) {
  const chamadas: { chave: string; corpo: unknown }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((caminho: string, opcoes?: RequestInit) => {
      const chave = `${opcoes?.method ?? 'GET'} ${caminho}`;
      chamadas.push({ chave, corpo: opcoes?.body ? JSON.parse(opcoes.body as string) : undefined });
      const r = respostas[chave];
      return Promise.resolve(r ? r() : json({ status: 404, erro: 'Não encontrado' }, 404));
    }),
  );
  return chamadas;
}

const MENSAGEM = { mensagem: 'Se o e-mail tiver acesso, enviamos um código. Ele vale por 10 minutos.' };

async function irParaCodigo(email = 'ana@exemplo.com.br') {
  await userEvent.type(screen.getByLabelText('E-mail'), email);
  await userEvent.click(screen.getByRole('button', { name: 'Receber código' }));
  return screen.findByLabelText('Código');
}

describe('TelaEntrar', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('pede o código pelo e-mail e mostra a mensagem neutra da API', async () => {
    const chamadas = fetchFalso({ 'POST /api/auth/codigo': () => json(MENSAGEM, 202) });
    render(<TelaEntrar nomeSistema="Crédito" aoEntrar={vi.fn()} />);
    await irParaCodigo();
    expect(chamadas).toEqual([{ chave: 'POST /api/auth/codigo', corpo: { email: 'ana@exemplo.com.br' } }]);
    expect(screen.getByRole('status')).toHaveTextContent('Se o e-mail tiver acesso');
    expect(screen.getByText('ana@exemplo.com.br')).toBeInTheDocument();
  });

  it('o campo de código aceita só 6 dígitos e é próprio para código de uso único', async () => {
    fetchFalso({ 'POST /api/auth/codigo': () => json(MENSAGEM, 202) });
    render(<TelaEntrar nomeSistema="Crédito" aoEntrar={vi.fn()} />);
    const campo = await irParaCodigo();
    expect(campo).toHaveAttribute('inputmode', 'numeric');
    expect(campo).toHaveAttribute('autocomplete', 'one-time-code');
    expect(campo).toHaveAttribute('maxlength', '6');
    await userEvent.type(campo, '12ab34-56');
    expect(campo).toHaveValue('123456');
  });

  it('entra com e-mail e código e avisa quem chamou', async () => {
    const chamadas = fetchFalso({ 'POST /api/auth/codigo': () => json(MENSAGEM, 202), 'POST /api/auth/entrar': () => vazio(204) });
    const aoEntrar = vi.fn();
    render(<TelaEntrar nomeSistema="Crédito" aoEntrar={aoEntrar} />);
    await userEvent.type(await irParaCodigo(), '012345');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    await waitFor(() => expect(aoEntrar).toHaveBeenCalledTimes(1));
    expect(chamadas.at(-1)).toEqual({ chave: 'POST /api/auth/entrar', corpo: { email: 'ana@exemplo.com.br', codigo: '012345' } });
  });

  it('código errado: mostra a mensagem da API e deixa tentar de novo', async () => {
    fetchFalso({
      'POST /api/auth/codigo': () => json(MENSAGEM, 202),
      'POST /api/auth/entrar': () => json({ status: 401, erro: 'Código inválido ou expirado' }, 401),
    });
    const aoEntrar = vi.fn();
    render(<TelaEntrar nomeSistema="Crédito" aoEntrar={aoEntrar} />);
    await userEvent.type(await irParaCodigo(), '000000');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Código inválido ou expirado');
    expect(aoEntrar).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Código')).toHaveValue('');
  });

  it('limite de pedidos (429): mostra a mensagem e continua no passo do e-mail', async () => {
    fetchFalso({ 'POST /api/auth/codigo': () => json({ status: 429, erro: 'Muitas requisições; tente de novo em instantes' }, 429) });
    render(<TelaEntrar nomeSistema="Crédito" aoEntrar={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('E-mail'), 'ana@exemplo.com.br');
    await userEvent.click(screen.getByRole('button', { name: 'Receber código' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Muitas requisições');
    expect(screen.queryByLabelText('Código')).not.toBeInTheDocument();
  });

  it('"Usar outro e-mail" volta ao primeiro passo', async () => {
    fetchFalso({ 'POST /api/auth/codigo': () => json(MENSAGEM, 202) });
    render(<TelaEntrar nomeSistema="Crédito" aoEntrar={vi.fn()} />);
    await irParaCodigo();
    await userEvent.click(screen.getByRole('button', { name: 'Usar outro e-mail' }));
    expect(screen.getByLabelText('E-mail')).toHaveValue('ana@exemplo.com.br');
    expect(screen.queryByLabelText('Código')).not.toBeInTheDocument();
  });
});
