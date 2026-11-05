import { describe, expect, it } from 'vitest';
import { LimitadorJanelaFixa, chaveDeIp } from './limitador';

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

  it('com o teto cheio de chaves VIVAS (varredura de IPs), o mapa fica limitado: as mais antigas saem', () => {
    let agora = 0;
    const limitador = new LimitadorJanelaFixa(1, 60_000, () => agora, 100);
    for (let i = 0; i < 1_000; i++) {
      agora = i; // todas dentro da mesma janela de 60 s: nenhuma venceu
      limitador.registrar(`ip-${i}`);
    }
    expect(limitador.tamanho).toBeLessThanOrEqual(100);
    // A mais recente continua contada (2ª requisição dela passa do limite de 1); a mais antiga foi descartada.
    expect(limitador.registrar('ip-999')).not.toBeNull();
    expect(limitador.registrar('ip-0')).toBeNull();
  });
});

describe('chaveDeIp', () => {
  it('IPv4 (também o mapeado em IPv6) é a chave; IPv6 é agrupado pelo prefixo /64', () => {
    expect(chaveDeIp('203.0.113.10')).toBe('203.0.113.10');
    expect(chaveDeIp('::ffff:203.0.113.10')).toBe('203.0.113.10');
    expect(chaveDeIp('2001:db8:1:2:aaaa::1')).toBe('2001:db8:1:2::/64');
    expect(chaveDeIp('2001:db8:1:2:ffff:ffff:ffff:ffff')).toBe('2001:db8:1:2::/64');
    expect(chaveDeIp('2001:DB8:0001:0002::9')).toBe('2001:db8:1:2::/64');
    expect(chaveDeIp('2001:db8::1')).toBe('2001:db8:0:0::/64');
    expect(chaveDeIp('::1')).toBe('0:0:0:0::/64');
    expect(chaveDeIp(undefined)).toBe('desconhecido');
  });
});
