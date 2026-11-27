import { afterEach, describe, expect, it } from 'vitest';

// CSP sem 'unsafe-eval' (deploy/caddy/seguranca.caddy): o zod não pode chamar Function() no navegador, senão toda tela
// registra uma violação de CSP no console. O zod testa Function() ao CRIAR o primeiro esquema de objeto, então a
// configuração (sem-eval.ts) precisa rodar antes de qualquer esquema: é o primeiro import do index.ts.
describe('contratos sob CSP sem eval', () => {
  const original = globalThis.Function;
  afterEach(() => {
    globalThis.Function = original;
  });

  it('importar os contratos e validar nunca chama Function()', async () => {
    let chamadas = 0;
    globalThis.Function = new Proxy(original, {
      apply: (alvo, este, args: unknown[]) => {
        chamadas++;
        return Reflect.apply(alvo, este, args) as unknown;
      },
      construct: (alvo, args: unknown[]) => {
        chamadas++;
        return Reflect.construct(alvo, args) as object;
      },
    });
    const { esquemaRespostaSaude } = await import('./index.js');
    expect(esquemaRespostaSaude.safeParse({ status: 'ok', banco: 'ok', versao: '1', commit: 'a' }).success).toBe(true);
    expect(esquemaRespostaSaude.safeParse({ status: 'ok' }).success).toBe(false);
    expect(chamadas).toBe(0);
  });
});
