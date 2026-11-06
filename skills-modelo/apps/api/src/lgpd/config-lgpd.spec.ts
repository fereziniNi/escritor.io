import { randomBytes } from 'node:crypto';
import { inspect } from 'node:util';
import { describe, expect, it } from 'vitest';
import { carregarConfig } from '../config/config';
import { carregarChavesLgpd } from './chaves';

const chave = () => randomBytes(32).toString('base64');
const base = (extra: Record<string, string | undefined> = {}): NodeJS.ProcessEnv => ({
  DATABASE_URL: 'postgres://dono:senha-do-dono@localhost:5432/app',
  ...extra,
});
const smtp = { MAIL_MODE: 'smtp', SMTP_HOST: 'smtp.exemplo.com.br', EMAIL_REMETENTE: 'nao-responda@exemplo.com.br' };

describe('configuração LGPD: DADOS_CHAVES e DADOS_CHAVE_INDICE', () => {
  const k1 = chave();
  const k2 = chave();
  const ki = chave();

  it('são Segredo: nunca aparecem ao inspecionar ou serializar a config', () => {
    const c = carregarConfig(base({ DADOS_CHAVES: `k1:${k1},k2:${k2}`, DADOS_CHAVE_INDICE: ki }));
    expect(inspect(c)).not.toContain(k1);
    expect(JSON.stringify(c)).not.toContain(ki);
    expect(c.DADOS_CHAVES?.revelar()).toContain(k1);
  });

  it('chave com tamanho errado é recusada já no carregarConfig, sem mostrar o valor', () => {
    const curta = randomBytes(16).toString('base64');
    try {
      carregarConfig(base({ DADOS_CHAVES: `k1:${curta}`, DADOS_CHAVE_INDICE: ki }));
      expect.unreachable();
    } catch (e) {
      expect((e as Error).message).toMatch(/DADOS_CHAVES/);
      expect((e as Error).message).toMatch(/32 bytes/);
      expect((e as Error).message).not.toContain(curta);
    }
    expect(() => carregarConfig(base({ DADOS_CHAVES: `k1:${k1}`, DADOS_CHAVE_INDICE: randomBytes(20).toString('base64') }))).toThrow(
      /DADOS_CHAVE_INDICE/,
    );
  });

  it('kids repetidos e chave do índice igual a uma chave de dados são recusados', () => {
    expect(() => carregarConfig(base({ DADOS_CHAVES: `k1:${k1},k1:${k2}`, DADOS_CHAVE_INDICE: ki }))).toThrow(/repetid/);
    expect(() => carregarConfig(base({ DADOS_CHAVES: `k1:${k1},k2:${k2}`, DADOS_CHAVE_INDICE: k2 }))).toThrow(/DADOS_CHAVE_INDICE.*diferente/);
  });

  it('as duas andam juntas: uma sem a outra é recusada', () => {
    expect(() => carregarConfig(base({ DADOS_CHAVES: `k1:${k1}` }))).toThrow(/DADOS_CHAVE_INDICE/);
    expect(() => carregarConfig(base({ DADOS_CHAVE_INDICE: ki }))).toThrow(/DADOS_CHAVES/);
  });

  it('RETENCAO_DIAS e RETENCAO_AUDITORIA_IP_DIAS: opcionais, inteiros >= 1', () => {
    expect(carregarConfig(base()).RETENCAO_DIAS).toBeUndefined();
    expect(carregarConfig(base({ RETENCAO_DIAS: '365', RETENCAO_AUDITORIA_IP_DIAS: '730' }))).toMatchObject({ RETENCAO_DIAS: 365, RETENCAO_AUDITORIA_IP_DIAS: 730 });
    expect(() => carregarConfig(base({ RETENCAO_DIAS: '0' }))).toThrow(/RETENCAO_DIAS/);
    expect(() => carregarConfig(base({ RETENCAO_AUDITORIA_IP_DIAS: '1.5' }))).toThrow(/RETENCAO_AUDITORIA_IP_DIAS/);
  });
});

describe('carregarChavesLgpd: falha fechada fora de desenvolvimento', () => {
  it('produção sem chaves → a API não sobe, dizendo o motivo', () => {
    expect(() => carregarChavesLgpd(carregarConfig(base({ NODE_ENV: 'production', ...smtp })))).toThrow(/DADOS_CHAVES/);
  });

  it('NODE_ENV ausente ou vazio conta como produção', () => {
    expect(() => carregarChavesLgpd(carregarConfig(base()))).toThrow(/DADOS_CHAVES/);
    expect(() => carregarChavesLgpd(carregarConfig(base({ NODE_ENV: '' })))).toThrow(/DADOS_CHAVES/);
  });

  it('development e test DECLARADOS sem chaves: chaves aleatórias deste processo (somem ao reiniciar)', () => {
    const a = carregarChavesLgpd(carregarConfig(base({ NODE_ENV: 'development' })));
    const b = carregarChavesLgpd(carregarConfig(base({ NODE_ENV: 'test' })));
    const envelope = a.chaveiro.cifrar('12345678909', 'cliente.cpf');
    expect(a.chaveiro.decifrar(envelope, 'cliente.cpf')).toBe('12345678909');
    expect(() => b.chaveiro.decifrar(envelope, 'cliente.cpf')).toThrow();
    expect(a.indice.calcular('12345678909', 'cliente.cpf')).not.toBe(b.indice.calcular('12345678909', 'cliente.cpf'));
  });

  it('com as chaves: a primeira de DADOS_CHAVES cifra, o índice usa DADOS_CHAVE_INDICE (em qualquer NODE_ENV)', () => {
    const env = { DADOS_CHAVES: `k1:${chave()},k0:${chave()}`, DADOS_CHAVE_INDICE: chave() };
    const prod = carregarChavesLgpd(carregarConfig(base({ NODE_ENV: 'production', ...smtp, ...env })));
    const dev = carregarChavesLgpd(carregarConfig(base({ NODE_ENV: 'development', ...env })));
    expect(prod.chaveiro.kidAtivo).toBe('k1');
    expect(dev.chaveiro.decifrar(prod.chaveiro.cifrar('x', 'c.x'), 'c.x')).toBe('x');
    expect(dev.indice.calcular('12345678909', 'cliente.cpf')).toBe(prod.indice.calcular('12345678909', 'cliente.cpf'));
  });
});
