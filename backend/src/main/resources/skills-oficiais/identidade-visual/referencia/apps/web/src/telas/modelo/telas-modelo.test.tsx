// origem: skills-modelo/apps/web/src/telas/modelo/telas-modelo.test.tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TelaFormulario } from './TelaFormulario';
import { TelaListagem } from './TelaListagem';
import { TelaLogin } from './TelaLogin';
import { TelaPainel } from './TelaPainel';

describe('telas-modelo', () => {
  it('TelaLogin envia e-mail e senha', async () => {
    const aoEntrar = vi.fn();
    render(<TelaLogin nomeSistema="Crédito" aoEntrar={aoEntrar} />);
    await userEvent.type(screen.getByLabelText('E-mail'), 'ana@exemplo.com.br');
    await userEvent.type(screen.getByLabelText('Senha'), 'segredo123');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(aoEntrar).toHaveBeenCalledWith({ email: 'ana@exemplo.com.br', senha: 'segredo123' });
  });

  it('TelaLogin mostra o erro recebido', () => {
    render(<TelaLogin nomeSistema="Crédito" aoEntrar={vi.fn()} erro="Credenciais inválidas" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Credenciais inválidas');
  });

  it('TelaListagem filtra a tabela pela busca e formata moeda', async () => {
    render(<TelaListagem />);
    const tabela = screen.getByRole('table');
    expect(within(tabela).getByText('R$ 500.000,00')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Buscar'), 'beta');
    expect(within(tabela).queryByText('Alfa Ltda')).not.toBeInTheDocument();
    expect(within(tabela).getByText('Beta S.A.')).toBeInTheDocument();
  });

  it('TelaListagem mostra estado vazio quando o filtro não acha nada', async () => {
    render(<TelaListagem />);
    await userEvent.type(screen.getByLabelText('Buscar'), 'zzzz');
    expect(screen.getByText('Nenhum resultado')).toBeInTheDocument();
  });

  it('TelaFormulario valida obrigatórios e formata o CNPJ', async () => {
    const aoSalvar = vi.fn();
    render(<TelaFormulario aoSalvar={aoSalvar} />);
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(screen.getByText('Informe o nome')).toBeInTheDocument();
    expect(aoSalvar).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText('Nome'), 'Alfa Ltda');
    await userEvent.type(screen.getByLabelText('CNPJ'), '11222333000181');
    await userEvent.tab();
    expect(screen.getByLabelText('CNPJ')).toHaveValue('11.222.333/0001-81');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(aoSalvar).toHaveBeenCalledWith({ nome: 'Alfa Ltda', cnpj: '11222333000181' });
  });

  it('TelaPainel mostra indicadores e o gráfico acessível', () => {
    render(<TelaPainel />);
    expect(screen.getByRole('heading', { level: 1, name: 'Painel' })).toBeInTheDocument();
    expect(screen.getByText('Em análise')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /operações por mês/i })).toBeInTheDocument();
  });
});
