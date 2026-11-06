// origem: skills-modelo/apps/api/src/ia/custo.spec.ts
import { describe, expect, it, vi } from 'vitest';
import { PRECOS_POR_MILHAO, calcularCusto } from './custo';

describe('calcularCusto', () => {
  it('calcula em dólares pela tabela do modelo (sonnet 5.5: US$ 2 / US$ 10 por milhão)', () => {
    expect(calcularCusto('claude-sonnet-5-5', { entrada: 1_000_000, saida: 100_000 })).toBeCloseTo(3, 10);
    expect(calcularCusto('claude-haiku-5-5', { entrada: 2000, saida: 500 })).toBeCloseTo(0.00045, 10);
  });

  it('modelo desconhecido: custo null e um aviso, sem lançar', () => {
    const avisar = vi.fn();
    expect(calcularCusto('modelo-novo-x', { entrada: 10, saida: 10 }, avisar)).toBeNull();
    expect(avisar).toHaveBeenCalledTimes(1);
    expect(String(avisar.mock.calls[0]![0])).toContain('modelo-novo-x');
  });

  it('o aviso de um mesmo modelo desconhecido sai uma vez só', () => {
    const avisar = vi.fn();
    calcularCusto('modelo-repetido', { entrada: 1, saida: 1 }, avisar);
    calcularCusto('modelo-repetido', { entrada: 1, saida: 1 }, avisar);
    expect(avisar).toHaveBeenCalledTimes(1);
  });

  it('a tabela cobre os modelos padrão', () => {
    expect(Object.keys(PRECOS_POR_MILHAO)).toEqual(expect.arrayContaining(['claude-sonnet-5-5', 'claude-haiku-5-5']));
  });
});
