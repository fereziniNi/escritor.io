import { describe, expect, it } from 'vitest';
import { mascararEmail as mascararEmailAuditoria } from '../auditoria/sanitizar';
import { mascararEmail as mascararEmailEnvio } from '../email/enviador-email';
import { cpfValido, normalizarCpf } from './cpf';
import { mascararCpf, mascararCpfEmTexto, mascararEmail } from './mascarar';

describe('cpf', () => {
  it('normaliza para 11 dígitos (com ou sem pontuação); outro tamanho é null', () => {
    expect(normalizarCpf('123.456.789-09')).toBe('12345678909');
    expect(normalizarCpf(' 12345678909 ')).toBe('12345678909');
    expect(normalizarCpf('1234567890')).toBeNull();
    expect(normalizarCpf('123.456.789-0a')).toBeNull();
  });

  it('confere os dígitos verificadores e recusa sequência repetida', () => {
    expect(cpfValido('12345678909')).toBe(true);
    expect(cpfValido('529.982.247-25')).toBe(true);
    expect(cpfValido('12345678900')).toBe(false);
    expect(cpfValido('11111111111')).toBe(false);
    expect(cpfValido('abc')).toBe(false);
  });
});

describe('mascararCpf', () => {
  it('"12345678909" → "***.456.789-**" (só os 6 do meio aparecem)', () => {
    expect(mascararCpf('12345678909')).toBe('***.456.789-**');
    expect(mascararCpf('123.456.789-09')).toBe('***.456.789-**');
  });

  it('valor que não é CPF sai todo mascarado (não revela nada)', () => {
    expect(mascararCpf('123')).toBe('***.***.***-**');
    expect(mascararCpf('')).toBe('***.***.***-**');
  });
});

describe('mascararEmail', () => {
  it('"ana.souza@exemplo.com.br" → "a***@exemplo.com.br"', () => {
    expect(mascararEmail('ana.souza@exemplo.com.br')).toBe('a***@exemplo.com.br');
  });

  it('formato estranho vira "***"', () => {
    expect(mascararEmail('sem-arroba')).toBe('***');
    expect(mascararEmail('@exemplo.com.br')).toBe('***');
    expect(mascararEmail('ana@')).toBe('***');
  });

  it('as cópias das skills anteriores (envio de e-mail e trilha) mascaram igual: não divergir', () => {
    for (const e of ['ana.souza@exemplo.com.br', 'b@grupomultiplica.com.br', 'Joao+tag@sub.exemplo.com.br']) {
      expect(mascararEmailEnvio(e)).toBe(mascararEmail(e));
      expect(mascararEmailAuditoria(e)).toBe(mascararEmail(e));
    }
  });
});

describe('mascararCpfEmTexto (varredura)', () => {
  it('mascara CPF formatado em qualquer lugar do texto', () => {
    expect(mascararCpfEmTexto('cliente 123.456.789-09 criado')).toBe('cliente ***.456.789-** criado');
    expect(mascararCpfEmTexto('a 529.982.247-25 e b 123.456.789-09')).toBe('a ***.982.247-** e b ***.456.789-**');
  });

  it('mascara 11 dígitos soltos quando são CPF válido', () => {
    expect(mascararCpfEmTexto('cpf=12345678909;')).toBe('cpf=***.456.789-**;');
  });

  it('não mexe em números que não são CPF nem em dígitos colados a letras (uuid, hash, timestamp)', () => {
    expect(mascararCpfEmTexto('pedido 12345678900')).toBe('pedido 12345678900');
    expect(mascararCpfEmTexto('t=1793915038030')).toBe('t=1793915038030');
    expect(mascararCpfEmTexto('id a12345678909b')).toBe('id a12345678909b');
  });
});
