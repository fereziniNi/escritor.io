import { describe, expect, it } from 'vitest';
import { LimitadorJanelaFixa } from './limitador';

describe('LimitadorJanelaFixa', () => {
  it('conta por chave na janela, recusa acima do limite e libera quando a janela vira', () => {
    let agora = 0;
    const limitador = new LimitadorJanelaFixa(2, 60_000, () => agora);
    expect(limitador.registrar('a')).toBeNull();
    expect(limitador.registrar('a')).toBeNull();
    // 3ª na mesma janela: devolve os segundos até liberar (Retry-After).
    expect(limitador.registrar('a')).toBe(60);
    // Outra chave tem contador próprio.
    expect(limitador.registrar('b')).toBeNull();
    agora = 59_500;
    expect(limitador.registrar('a')).toBe(1);
    agora = 60_000;
    expect(limitador.registrar('a')).toBeNull();
  });

  it('não cresce sem limite: janelas vencidas são descartadas quando o mapa passa do teto', () => {
    let agora = 0;
    const limitador = new LimitadorJanelaFixa(1, 1_000, () => agora, 100);
    for (let i = 0; i < 150; i++) limitador.registrar(`ip-${i}`);
    agora = 2_000;
    limitador.registrar('novo');
    expect(limitador.tamanho).toBeLessThanOrEqual(1);
  });
});
