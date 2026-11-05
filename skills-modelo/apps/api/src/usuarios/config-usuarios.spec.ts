import { describe, expect, it } from 'vitest';
import { carregarConfig, ErroConfiguracao } from '../config/config';

const base = { DATABASE_URL: 'postgres://u:s@localhost:5432/b' };

describe('configuração de usuários', () => {
  it('ADMIN_INICIAL_EMAIL é opcional e vem normalizado (minúsculas, sem espaços)', () => {
    expect(carregarConfig(base).ADMIN_INICIAL_EMAIL).toBeUndefined();
    expect(carregarConfig({ ...base, ADMIN_INICIAL_EMAIL: '  Ana.Silva@Exemplo.com.BR ' }).ADMIN_INICIAL_EMAIL).toBe('ana.silva@exemplo.com.br');
  });

  it('e-mail inicial inválido derruba o boot citando a variável', () => {
    expect(() => carregarConfig({ ...base, ADMIN_INICIAL_EMAIL: 'isto-nao-e-email' })).toThrow(ErroConfiguracao);
    expect(() => carregarConfig({ ...base, ADMIN_INICIAL_EMAIL: 'isto-nao-e-email' })).toThrow(/ADMIN_INICIAL_EMAIL/);
  });

  it('NOME_SISTEMA tem padrão e recusa quebra de linha', () => {
    expect(carregarConfig(base).NOME_SISTEMA).toBe('Sistema');
    expect(carregarConfig({ ...base, NOME_SISTEMA: 'Crédito Multiplica' }).NOME_SISTEMA).toBe('Crédito Multiplica');
    expect(() => carregarConfig({ ...base, NOME_SISTEMA: 'a\nb' })).toThrow(/NOME_SISTEMA/);
  });
});
