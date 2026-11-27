// origem: skills-modelo/apps/api/src/ia/modelo.spec.ts
import { describe, expect, it } from 'vitest';
import { modeloPara } from './modelo';

describe('modeloPara', () => {
  it('usa os padrões sem variável: padrão = sonnet, rápido = haiku', () => {
    expect(modeloPara('resumo', {})).toBe('claude-sonnet-5-5');
    expect(modeloPara('rapido', {})).toBe('claude-haiku-5-5');
  });

  it('respeita LLM_MODELO_<TAREFA>', () => {
    expect(modeloPara('resumo', { LLM_MODELO_RESUMO: 'claude-opus-5-5' })).toBe('claude-opus-5-5');
    expect(modeloPara('extrair-dados', { LLM_MODELO_EXTRAIR_DADOS: 'claude-haiku-5-5' })).toBe('claude-haiku-5-5');
  });

  it('LLM_MODELO_PADRAO e LLM_MODELO_RAPIDO mudam o padrão das tarefas sem variável própria', () => {
    expect(modeloPara('resumo', { LLM_MODELO_PADRAO: 'claude-opus-5-5' })).toBe('claude-opus-5-5');
    expect(modeloPara('rapido', { LLM_MODELO_RAPIDO: 'claude-sonnet-5-5' })).toBe('claude-sonnet-5-5');
  });

  it('variável vazia vale como ausente e id com caractere estranho é recusado', () => {
    expect(modeloPara('resumo', { LLM_MODELO_RESUMO: '' })).toBe('claude-sonnet-5-5');
    expect(() => modeloPara('resumo', { LLM_MODELO_RESUMO: 'modelo com espaço' })).toThrow(/LLM_MODELO_RESUMO/);
  });

  it('lê process.env quando o ambiente não é passado', () => {
    process.env['LLM_MODELO_TESTE_ENV'] = 'claude-opus-5-5';
    try {
      expect(modeloPara('teste-env')).toBe('claude-opus-5-5');
    } finally {
      delete process.env['LLM_MODELO_TESTE_ENV'];
    }
  });
});
