import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { inspect } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { ErroConfiguracao, carregarConfig } from './config';
import { Segredo, lerSegredo } from './segredo';

/** Ambiente mínimo válido; cada teste muda só o que interessa. */
const envValido = (extra: Record<string, string | undefined> = {}): NodeJS.ProcessEnv => ({
  DATABASE_URL: 'postgres://app:senha-de-teste@localhost:5432/app',
  ...extra,
});

describe('carregarConfig', () => {
  it('com DATABASE_URL ausente, falha citando o nome da variável', () => {
    const env = envValido({ DATABASE_URL: undefined });
    expect(() => carregarConfig(env)).toThrow(ErroConfiguracao);
    expect(() => carregarConfig(env)).toThrow(/DATABASE_URL/);
  });

  it('lista todas as variáveis inválidas de uma vez, sem mostrar o valor recebido', () => {
    const env = envValido({ DATABASE_URL: 'mysql://nao-serve', PORT: 'abc' });
    try {
      carregarConfig(env);
      expect.unreachable('deveria ter falhado');
    } catch (e) {
      expect(e).toBeInstanceOf(ErroConfiguracao);
      const erro = e as ErroConfiguracao;
      expect(erro.problemas.join('\n')).toMatch(/DATABASE_URL/);
      expect(erro.problemas.join('\n')).toMatch(/PORT/);
      expect(erro.message).not.toContain('mysql://nao-serve');
    }
  });

  it('aplica os padrões e devolve a configuração tipada', () => {
    const config = carregarConfig(envValido());
    expect(config.NODE_ENV).toBe('development');
    expect(config.PORT).toBe(3000);
    expect(config.LOG_LEVEL).toBe('info');
    expect(config.DATABASE_URL.revelar()).toBe('postgres://app:senha-de-teste@localhost:5432/app');
    expect(config.APP_COMMIT).toBe('desconhecido');
  });

  it('o segredo do banco não aparece ao serializar ou logar a configuração', () => {
    const config = carregarConfig(envValido());
    expect(JSON.stringify(config)).not.toContain('senha-de-teste');
    expect(inspect(config, { depth: 5 })).not.toContain('senha-de-teste');
  });
});

describe('Segredo', () => {
  it('só revelar() devolve o valor; JSON, String e inspect mostram [REDACTED]', () => {
    const s = new Segredo('valor-secreto');
    expect(s.revelar()).toBe('valor-secreto');
    expect(JSON.stringify({ s })).toBe('{"s":"[REDACTED]"}');
    expect(String(s)).toBe('[REDACTED]');
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions -- é justamente o caso testado
    expect(`${s}`).toBe('[REDACTED]');
    expect(inspect(s)).not.toContain('valor-secreto');
    expect(inspect({ aninhado: { s } }, { depth: 10 })).not.toContain('valor-secreto');
  });
});

describe('lerSegredo e variáveis *_ARQUIVO', () => {
  let pasta: string | undefined;
  afterEach(() => {
    if (pasta) rmSync(pasta, { recursive: true, force: true });
    pasta = undefined;
  });

  const arquivoCom = (conteudo: string) => {
    pasta = mkdtempSync(path.join(tmpdir(), 'segredo-'));
    const caminho = path.join(pasta, 'valor');
    writeFileSync(caminho, conteudo);
    return caminho;
  };

  it('lê NOME do ambiente', () => {
    expect(lerSegredo({ X: 'do-ambiente' }, 'X')).toBe('do-ambiente');
    expect(lerSegredo({}, 'X')).toBeUndefined();
  });

  it('lê X_ARQUIVO do arquivo, tirando a quebra de linha do fim', () => {
    const caminho = arquivoCom('do-arquivo\n');
    expect(lerSegredo({ X_ARQUIVO: caminho }, 'X')).toBe('do-arquivo');
  });

  it('recusa NOME e NOME_ARQUIVO definidos ao mesmo tempo', () => {
    const caminho = arquivoCom('a');
    expect(() => lerSegredo({ X: 'b', X_ARQUIVO: caminho }, 'X')).toThrow(/X.*X_ARQUIVO/);
  });

  it('erro claro (sem o conteúdo) quando o arquivo não existe', () => {
    expect(() => lerSegredo({ X_ARQUIVO: '/nao/existe/segredo' }, 'X')).toThrow(/X_ARQUIVO/);
  });

  it('carregarConfig aceita DATABASE_URL_ARQUIVO no lugar de DATABASE_URL', () => {
    const caminho = arquivoCom('postgres://app:do-arquivo@db:5432/app\n');
    const config = carregarConfig({ DATABASE_URL_ARQUIVO: caminho });
    expect(config.DATABASE_URL.revelar()).toBe('postgres://app:do-arquivo@db:5432/app');
  });
});
