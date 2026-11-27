// origem: skills-modelo/apps/api/src/lgpd/mascarar-dados.spec.ts
import { describe, expect, it } from 'vitest';
import { mascararResposta, podeVerDadosPessoais } from './mascarar-dados.interceptor';

describe('mascararResposta (USUARIO)', () => {
  it('chaves que começam com cpf/email (qualquer caixa), inclusive listas de textos', () => {
    expect(
      mascararResposta({
        cpf: '12345678909',
        cpfConjuge: '529.982.247-25',
        CPF_Responsavel: '12345678909',
        email: 'ana.souza@exemplo.com.br',
        emails: ['bia@exemplo.com.br', 'caio@exemplo.com.br'],
        EmailContato: 'dani@exemplo.com.br',
        cpfs: ['12345678909'],
      }),
    ).toEqual({
      cpf: '***.456.789-**',
      cpfConjuge: '***.982.247-**',
      CPF_Responsavel: '***.456.789-**',
      email: 'a***@exemplo.com.br',
      emails: ['b***@exemplo.com.br', 'c***@exemplo.com.br'],
      EmailContato: 'd***@exemplo.com.br',
      cpfs: ['***.456.789-**'],
    });
  });

  it('CPF dentro de texto livre e em objetos aninhados', () => {
    expect(mascararResposta({ itens: [{ obs: 'cpf 123.456.789-09 ok', dono: { email: 'e@exemplo.com.br' } }] })).toEqual({
      itens: [{ obs: 'cpf ***.456.789-** ok', dono: { email: 'e***@exemplo.com.br' } }],
    });
  });

  it('o próprio usuário (id igual) mantém o e-mail; outro id não', () => {
    expect(mascararResposta({ id: 'u1', email: 'eu@exemplo.com.br' }, 'u1')).toEqual({ id: 'u1', email: 'eu@exemplo.com.br' });
    expect(mascararResposta({ id: 'u2', email: 'ele@exemplo.com.br' }, 'u1')).toEqual({ id: 'u2', email: 'e***@exemplo.com.br' });
  });

  it('instância de classe não é achatada (Date, Buffer, DTO de classe passam como estão)', () => {
    class Dto {
      constructor(readonly cpf: string) {}
    }
    const data = new Date('2026-01-01T00:00:00Z');
    const dto = new Dto('12345678909');
    const r = mascararResposta({ quando: data, arquivo: Buffer.from('x'), dto }) as Record<string, unknown>;
    expect(r['quando']).toBe(data);
    expect(r['dto']).toBe(dto);
    expect(Buffer.isBuffer(r['arquivo'])).toBe(true);
  });

  it('só GESTOR e ADMIN veem completo; USUARIO e sem sessão não', () => {
    expect(podeVerDadosPessoais('ADMIN')).toBe(true);
    expect(podeVerDadosPessoais('GESTOR')).toBe(true);
    expect(podeVerDadosPessoais('USUARIO')).toBe(false);
    expect(podeVerDadosPessoais(undefined)).toBe(false);
  });
});
