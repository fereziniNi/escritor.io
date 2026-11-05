import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { inspect } from 'node:util';
import { describe, expect, it } from 'vitest';
import { carregarConfig } from '../config/config';
import { Segredo } from '../config/segredo';
import { cookieSessao, lerCookie } from './cookie-sessao';
import { dominioPermitido, segredoDoCodigo } from './regras-auth';

const base = (extra: Record<string, string | undefined> = {}): NodeJS.ProcessEnv => ({
  DATABASE_URL: 'postgres://app:senha-de-teste@localhost:5432/app',
  ...extra,
});

const SEGREDO = 'um-segredo-de-teste-com-mais-de-32-caracteres';

describe('configuração do login', () => {
  it('padrões: sessão ociosa 30 min, absoluta 12 h, sem restrição de domínio, sem segredo', () => {
    const c = carregarConfig(base());
    expect(c.AUTH_SESSAO_OCIOSA_MIN).toBe(30);
    expect(c.AUTH_SESSAO_ABSOLUTA_H).toBe(12);
    expect(c.AUTH_DOMINIOS_PERMITIDOS).toEqual([]);
    expect(c.AUTH_SEGREDO_CODIGO).toBeUndefined();
  });

  it('AUTH_DOMINIOS_PERMITIDOS: lista separada por vírgula, em minúsculas e sem espaços', () => {
    const c = carregarConfig(base({ AUTH_DOMINIOS_PERMITIDOS: ' GrupoMultiplica.com.br , exemplo.com.br ' }));
    expect(c.AUTH_DOMINIOS_PERMITIDOS).toEqual(['grupomultiplica.com.br', 'exemplo.com.br']);
  });

  it('domínio inválido (com @, curinga ou espaço no meio) lança citando a variável', () => {
    for (const v of ['@exemplo.com.br', '*.exemplo.com.br', 'exemplo com.br', 'localhost']) {
      expect(() => carregarConfig(base({ AUTH_DOMINIOS_PERMITIDOS: v }))).toThrow(/AUTH_DOMINIOS_PERMITIDOS/);
    }
  });

  it('AUTH_SEGREDO_CODIGO é Segredo (nunca aparece em JSON nem inspect) e tem no mínimo 32 caracteres', () => {
    const c = carregarConfig(base({ AUTH_SEGREDO_CODIGO: SEGREDO }));
    expect(c.AUTH_SEGREDO_CODIGO).toBeInstanceOf(Segredo);
    expect(c.AUTH_SEGREDO_CODIGO?.revelar()).toBe(SEGREDO);
    expect(JSON.stringify(c)).not.toContain(SEGREDO);
    expect(inspect(c)).not.toContain(SEGREDO);
    expect(() => carregarConfig(base({ AUTH_SEGREDO_CODIGO: 'curto' }))).toThrow(/AUTH_SEGREDO_CODIGO/);
  });

  it('AUTH_SEGREDO_CODIGO_ARQUIVO lê o segredo de arquivo', () => {
    const pasta = mkdtempSync(path.join(tmpdir(), 'segredo-'));
    try {
      const arquivo = path.join(pasta, 'auth');
      writeFileSync(arquivo, `${SEGREDO}\n`);
      expect(carregarConfig(base({ AUTH_SEGREDO_CODIGO_ARQUIVO: arquivo })).AUTH_SEGREDO_CODIGO?.revelar()).toBe(SEGREDO);
    } finally {
      rmSync(pasta, { recursive: true, force: true });
    }
  });

  it('tempos de sessão: inteiros positivos; ociosa não pode passar da absoluta', () => {
    const c = carregarConfig(base({ AUTH_SESSAO_OCIOSA_MIN: '15', AUTH_SESSAO_ABSOLUTA_H: '8' }));
    expect(c.AUTH_SESSAO_OCIOSA_MIN).toBe(15);
    expect(c.AUTH_SESSAO_ABSOLUTA_H).toBe(8);
    expect(() => carregarConfig(base({ AUTH_SESSAO_OCIOSA_MIN: '0' }))).toThrow(/AUTH_SESSAO_OCIOSA_MIN/);
    expect(() => carregarConfig(base({ AUTH_SESSAO_ABSOLUTA_H: 'doze' }))).toThrow(/AUTH_SESSAO_ABSOLUTA_H/);
    expect(() => carregarConfig(base({ AUTH_SESSAO_OCIOSA_MIN: '120', AUTH_SESSAO_ABSOLUTA_H: '1' }))).toThrow(/AUTH_SESSAO_OCIOSA_MIN/);
  });
});

describe('segredo do código', () => {
  it('usa AUTH_SEGREDO_CODIGO quando definido', () => {
    expect(segredoDoCodigo(carregarConfig(base({ AUTH_SEGREDO_CODIGO: SEGREDO })))).toBe(SEGREDO);
  });

  it('em produção sem AUTH_SEGREDO_CODIGO a API não sobe', () => {
    const producao = carregarConfig(
      base({ NODE_ENV: 'production', MAIL_MODE: 'smtp', SMTP_HOST: 'smtp.exemplo.com.br', EMAIL_REMETENTE: 'nao-responda@exemplo.com.br' }),
    );
    expect(() => segredoDoCodigo(producao)).toThrow(/AUTH_SEGREDO_CODIGO/);
  });

  it('fora de produção, sem a variável, gera um segredo aleatório por processo (códigos não sobrevivem ao reinício)', () => {
    const a = segredoDoCodigo(carregarConfig(base()));
    expect(a.length).toBeGreaterThanOrEqual(32);
    expect(segredoDoCodigo(carregarConfig(base()))).not.toBe(a);
  });
});

describe('domínios permitidos', () => {
  it('lista vazia: qualquer domínio (quem decide é a tabela usuario)', () => {
    expect(dominioPermitido('ana@qualquer.com', [])).toBe(true);
  });

  it('domínio exato, nunca "termina com" (malgrupomultiplica.com.br não passa)', () => {
    const lista = ['grupomultiplica.com.br'];
    expect(dominioPermitido('ana@grupomultiplica.com.br', lista)).toBe(true);
    expect(dominioPermitido('ana@malgrupomultiplica.com.br', lista)).toBe(false);
    expect(dominioPermitido('ana@sub.grupomultiplica.com.br', lista)).toBe(false);
    expect(dominioPermitido('ana@exemplo.com.br', lista)).toBe(false);
    expect(dominioPermitido('sem-arroba', lista)).toBe(false);
  });
});

describe('cookie de sessão', () => {
  it('em produção: __Host-sessao, HttpOnly, Secure, SameSite=Lax, Path=/ e sem Domain', () => {
    const producao = carregarConfig(
      base({ NODE_ENV: 'production', MAIL_MODE: 'smtp', SMTP_HOST: 'smtp.exemplo.com.br', EMAIL_REMETENTE: 'nao-responda@exemplo.com.br' }),
    );
    const { nome, opcoes } = cookieSessao(producao);
    expect(nome).toBe('__Host-sessao');
    expect(opcoes).toEqual({ httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
  });

  it('fora de produção (http://localhost): "sessao" sem Secure, o resto igual', () => {
    for (const NODE_ENV of ['development', 'test']) {
      const { nome, opcoes } = cookieSessao(carregarConfig(base({ NODE_ENV })));
      expect(nome).toBe('sessao');
      expect(opcoes).toEqual({ httpOnly: true, secure: false, sameSite: 'lax', path: '/' });
    }
  });

  it('lerCookie acha o cookie pelo nome exato e ignora o resto', () => {
    expect(lerCookie('a=1; __Host-sessao=abc_-123; b=2', '__Host-sessao')).toBe('abc_-123');
    expect(lerCookie('sessao=xyz', '__Host-sessao')).toBeUndefined();
    expect(lerCookie('x__Host-sessao=xyz', '__Host-sessao')).toBeUndefined();
    expect(lerCookie(undefined, 'sessao')).toBeUndefined();
    expect(lerCookie('sessao=', 'sessao')).toBeUndefined();
    expect(lerCookie('sessao=%E0%A4%A', 'sessao')).toBeUndefined();
  });
});
