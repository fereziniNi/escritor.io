// origem: skills-modelo/apps/api/src/fila/papel.spec.ts
import { describe, expect, it } from 'vitest';
import { ErroConfiguracao, carregarConfig } from '../config/config';
import { consomeFila, resolverPapel, servePortaHttp } from './papel';

const env = (extra: Record<string, string | undefined> = {}) =>
  carregarConfig({ DATABASE_URL: 'postgres://app:senha@localhost:5432/app', MAIL_MODE: 'smtp', SMTP_HOST: 'smtp.exemplo.com.br', EMAIL_REMETENTE: 'nao-responda@exemplo.com.br', ...extra });

describe('ROLE', () => {
  it('sem ROLE, development e test (declarados) rodam tudo no mesmo processo', () => {
    expect(resolverPapel(env({ NODE_ENV: 'development' }))).toBe('tudo');
    expect(resolverPapel(env({ NODE_ENV: 'test' }))).toBe('tudo');
  });

  it('sem ROLE, NODE_ENV ausente conta como produção e falha fechado', () => {
    expect(() => resolverPapel(env())).toThrow(/ROLE/);
  });

  it('sem ROLE em produção falha citando ROLE', () => {
    expect(() => resolverPapel(env({ NODE_ENV: 'production' }))).toThrow(/ROLE/);
  });

  it('ROLE explícito vale em qualquer ambiente', () => {
    expect(resolverPapel(env({ NODE_ENV: 'production', ROLE: 'api' }))).toBe('api');
    expect(resolverPapel(env({ NODE_ENV: 'production', ROLE: 'worker' }))).toBe('worker');
    expect(resolverPapel(env({ NODE_ENV: 'development', ROLE: 'migrar' }))).toBe('migrar');
  });

  it('valor desconhecido é recusado pela configuração', () => {
    expect(() => env({ ROLE: 'servidor' })).toThrow(ErroConfiguracao);
    expect(() => env({ ROLE: 'servidor' })).toThrow(/ROLE/);
  });

  it('só worker e tudo consomem a fila; só api e tudo escutam a porta', () => {
    expect(consomeFila('api')).toBe(false);
    expect(consomeFila('worker')).toBe(true);
    expect(consomeFila('tudo')).toBe(true);
    expect(servePortaHttp('api')).toBe(true);
    expect(servePortaHttp('worker')).toBe(false);
    expect(servePortaHttp('tudo')).toBe(true);
  });

  it('ALERTA_EMAIL aceita só um endereço', () => {
    expect(() => env({ ALERTA_EMAIL: 'varios@exemplo.com.br, outro@exemplo.com.br' })).toThrow(/ALERTA_EMAIL/);
    expect(env({ ALERTA_EMAIL: 'ti@grupomultiplica.com.br' }).ALERTA_EMAIL).toBe('ti@grupomultiplica.com.br');
  });
});
