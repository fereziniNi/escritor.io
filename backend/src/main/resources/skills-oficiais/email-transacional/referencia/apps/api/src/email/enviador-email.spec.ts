// origem: skills-modelo/apps/api/src/email/enviador-email.spec.ts
import { Logger } from '@nestjs/common';
import { createTransport } from 'nodemailer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Segredo } from '../config/segredo';
import { EnviadorLog, EnviadorSmtp, ErroEmailPermanente, mascararEmail, type MensagemEmail } from './enviador-email';

const mensagem: MensagemEmail = {
  para: 'ana.silva@exemplo.com.br',
  assunto: 'Bem-vinda',
  html: '<p>CORPO-SECRETO-123</p>',
  texto: 'CORPO-SECRETO-123',
};

afterEach(() => vi.restoreAllMocks());

describe('mascararEmail', () => {
  it('mantém a 1ª letra e o domínio', () => {
    expect(mascararEmail('ana.silva@exemplo.com.br')).toBe('a***@exemplo.com.br');
  });
  it('entrada sem @ vira ***', () => {
    expect(mascararEmail('qualquer coisa')).toBe('***');
  });
});

describe('EnviadorLog', () => {
  it('só loga: destinatário mascarado e nunca o corpo nem o endereço completo', async () => {
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    await new EnviadorLog().enviar(mensagem);
    const saida = JSON.stringify(log.mock.calls);
    expect(saida).toContain('a***@exemplo.com.br');
    expect(saida).not.toContain('ana.silva');
    expect(saida).not.toContain('CORPO-SECRETO-123');
  });
});

describe('EnviadorLog validação', () => {
  it.each([
    ['para com quebra de linha', { para: 'a@exemplo.com.br\nBcc: x@y.com' }],
    ['assunto com quebra de linha', { assunto: 'oi\r\nBcc: x@y.com' }],
    ['destinatário sem @', { para: 'sem-arroba' }],
  ])('recusa %s como o SMTP e não loga', async (_nome, parcial) => {
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    await expect(new EnviadorLog().enviar({ ...mensagem, ...parcial })).rejects.toBeInstanceOf(ErroEmailPermanente);
    expect(log).not.toHaveBeenCalled();
  });
});

describe('EnviadorSmtp', () => {
  const opcoes = { host: 'localhost', port: 1025, seguro: false, remetente: 'Sistema <nao-responda@exemplo.com.br>' };

  it('monta a mensagem com remetente, html e texto (transporte de teste do nodemailer)', async () => {
    const transporte = createTransport({ jsonTransport: true });
    const spy = vi.spyOn(transporte, 'sendMail');
    await new EnviadorSmtp(opcoes, transporte).enviar(mensagem);
    expect(spy).toHaveBeenCalledOnce();
    const enviado = spy.mock.calls[0]![0] as { from: string; to: string; subject: string; html: string; text: string };
    expect(enviado.from).toBe(opcoes.remetente);
    expect(enviado.to).toBe(mensagem.para);
    expect(enviado.subject).toBe('Bem-vinda');
    expect(enviado.html).toBe(mensagem.html);
    expect(enviado.text).toBe(mensagem.texto);
  });

  it.each([
    ['para com quebra de linha', { para: 'a@exemplo.com.br\nBcc: x@y.com' }],
    ['assunto com quebra de linha', { assunto: 'oi\r\nBcc: x@y.com' }],
    ['destinatário sem @', { para: 'sem-arroba' }],
  ])('recusa %s (injeção de cabeçalho)', async (_nome, parcial) => {
    const enviador = new EnviadorSmtp(opcoes, createTransport({ jsonTransport: true }));
    await expect(enviador.enviar({ ...mensagem, ...parcial })).rejects.toThrow();
  });

  it('o erro do SMTP não carrega destinatário completo nem corpo', async () => {
    const transporte = { sendMail: vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED')) };
    const erro = (await new EnviadorSmtp(opcoes, transporte).enviar(mensagem).catch((e: unknown) => e)) as Error;
    expect(erro.message).toContain('a***@exemplo.com.br');
    expect(erro.message).not.toContain('ana.silva');
    expect(erro.message).not.toContain('CORPO-SECRETO-123');
  });

  it('aceita a senha como Segredo (que nunca aparece em JSON)', () => {
    const senha = new Segredo('senha-smtp-secreta');
    expect(() => new EnviadorSmtp({ ...opcoes, usuario: 'apikey', senha })).not.toThrow();
    expect(JSON.stringify(senha)).not.toContain('senha-smtp-secreta');
  });
});
