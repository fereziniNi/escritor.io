import { describe, expect, it } from 'vitest';
import { contentDisposition } from './content-disposition';

describe('contentDisposition', () => {
  it('manda o nome com acento em filename* (RFC 5987) e um fallback ASCII', () => {
    const cabecalho = contentDisposition('Relatório março.xlsx');
    expect(cabecalho).toContain("filename*=UTF-8''Relat%C3%B3rio%20mar%C3%A7o.xlsx");
    expect(cabecalho).toMatch(/^attachment; filename="Relatorio_marco\.xlsx"; /);
  });

  it('não deixa aspas, quebra de linha ou ponto e vírgula do nome escaparem do cabeçalho', () => {
    const cabecalho = contentDisposition('a"; filename=evil.exe\r\nSet-Cookie: x=1.csv');
    expect(cabecalho).not.toMatch(/[\r\n]/);
    const [, fallback] = /^attachment; filename="([^"]*)"; filename\*=/.exec(cabecalho) ?? [];
    expect(fallback).toMatch(/^[A-Za-z0-9._-]+$/);
    // Dentro de filename* só sobram caracteres percent-encoded.
    const [, codificado] = /filename\*=UTF-8''(.*)$/.exec(cabecalho) ?? [];
    expect(codificado).toMatch(/^[A-Za-z0-9._~%-]+$/);
    expect(decodeURIComponent(codificado!)).not.toMatch(/[\r\n"]/);
  });

  it('tira caminho (../ e barras), limita o tamanho e nunca devolve nome vazio', () => {
    expect(contentDisposition('../../etc/passwd')).toContain('filename="etc_passwd"');
    expect(contentDisposition('')).toContain('filename="arquivo"');
    expect(contentDisposition('"""')).toContain('filename="arquivo"');
    const longo = contentDisposition(`${'a'.repeat(500)}.csv`);
    expect(longo.length).toBeLessThan(400);
    expect(longo).toContain('.csv');
  });
});
