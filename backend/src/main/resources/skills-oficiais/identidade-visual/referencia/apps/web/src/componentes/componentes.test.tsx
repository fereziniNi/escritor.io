// origem: skills-modelo/apps/web/src/componentes/componentes.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CabecalhoPagina } from './CabecalhoPagina';
import { Cartao } from './Cartao';
import { Carregando, ErroCarregar, EstadoVazio } from './estados';

describe('blocos de página', () => {
  it('CabecalhoPagina mostra título, descrição e ações', () => {
    render(<CabecalhoPagina titulo="Cedentes" descricao="Empresas cadastradas" acoes={<button>Novo</button>} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Cedentes' })).toBeInTheDocument();
    expect(screen.getByText('Empresas cadastradas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Novo' })).toBeInTheDocument();
  });

  it('Cartao agrupa conteúdo com título opcional', () => {
    render(<Cartao titulo="Resumo">dentro</Cartao>);
    expect(screen.getByText('Resumo')).toBeInTheDocument();
    expect(screen.getByText('dentro')).toBeInTheDocument();
  });
});

describe('estados', () => {
  it('EstadoVazio explica e oferece ação', () => {
    render(<EstadoVazio titulo="Nada por aqui" descricao="Cadastre o primeiro." acao={<button>Cadastrar</button>} />);
    expect(screen.getByText('Nada por aqui')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cadastrar' })).toBeInTheDocument();
  });

  it('Carregando é um status acessível', () => {
    render(<Carregando />);
    expect(screen.getByRole('status')).toHaveTextContent('Carregando');
  });

  it('ErroCarregar é um alerta com botão de tentar de novo', async () => {
    const tentar = vi.fn();
    render(<ErroCarregar mensagem="API indisponível" aoTentarDeNovo={tentar} />);
    expect(screen.getByRole('alert')).toHaveTextContent('API indisponível');
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(tentar).toHaveBeenCalledOnce();
  });
});
