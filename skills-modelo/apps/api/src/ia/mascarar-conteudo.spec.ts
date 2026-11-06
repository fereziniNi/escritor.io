import { describe, expect, it } from 'vitest';
import { mascararTexto } from './mascarar-conteudo';

describe('mascararTexto', () => {
  it('mascara CPF (formatado e válido solto), CNPJ e e-mail', () => {
    const saida = mascararTexto('CPF 123.456.789-09, solto 12345678909, CNPJ 11.222.333/0001-81 e ana.souza@exemplo.com.br');
    expect(saida).not.toContain('123.456.789-09');
    expect(saida).not.toContain('12345678909');
    expect(saida).toContain('***.456.789-**');
    expect(saida).not.toContain('11.222.333/0001-81');
    expect(saida).not.toContain('11222333000181');
    expect(saida).not.toContain('ana.souza');
    expect(saida).toContain('a***@exemplo.com.br');
  });

  it('mascara CNPJ só com dígitos', () => {
    expect(mascararTexto('cnpj 11222333000181 ok')).not.toContain('11222333000181');
  });

  it('mascara chaves sk-... e tokens Bearer', () => {
    const saida = mascararTexto('chave sk-ant-api03-AbCdEfGhIjKlMnOpQrStUvWxYz0123 e Authorization: Bearer abc.def-123_XYZ=');
    expect(saida).not.toContain('AbCdEfGhIjKlMnOp');
    expect(saida).not.toContain('abc.def-123_XYZ');
    expect(saida).toContain('[CHAVE]');
    expect(saida).toContain('Bearer [TOKEN]');
  });

  it('texto sem dado sensível passa idêntico', () => {
    expect(mascararTexto('Resuma o relatório do mês de março.')).toBe('Resuma o relatório do mês de março.');
  });
});
