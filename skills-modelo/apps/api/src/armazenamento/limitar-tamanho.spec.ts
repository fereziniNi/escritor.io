import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { LimiteExcedido, lerCabecalho, limitarTamanho } from './limitar-tamanho';

const ler = async (s: Readable): Promise<Buffer> => {
  const partes: Buffer[] = [];
  for await (const p of s) partes.push(p as Buffer);
  return Buffer.concat(partes);
};

describe('limitarTamanho', () => {
  it('deixa passar até o limite exato', async () => {
    const saida = await ler(limitarTamanho(Readable.from([Buffer.alloc(5), Buffer.alloc(5)]), 10));
    expect(saida.length).toBe(10);
  });

  it('falha com LimiteExcedido assim que passa do limite, sem ler o resto', async () => {
    let lidos = 0;
    function* fonte() {
      for (let i = 0; i < 1000; i++) {
        lidos += 1;
        yield Buffer.alloc(1024);
      }
    }
    await expect(ler(limitarTamanho(Readable.from(fonte()), 3000))).rejects.toBeInstanceOf(LimiteExcedido);
    expect(lidos).toBeLessThan(10);
  });
});

describe('lerCabecalho', () => {
  it('separa os primeiros bytes e devolve um fluxo que repete tudo, na ordem', async () => {
    const todos = Buffer.from('0123456789abcdefghij');
    const { cabecalho, resto } = await lerCabecalho(Readable.from([todos.subarray(0, 7), todos.subarray(7, 12), todos.subarray(12)]), 10);
    expect(cabecalho.length).toBeGreaterThanOrEqual(10);
    expect(cabecalho.equals(todos.subarray(0, cabecalho.length))).toBe(true);
    expect((await ler(resto)).equals(todos)).toBe(true);
  });

  it('arquivo menor que o cabeçalho pedido', async () => {
    const { cabecalho, resto } = await lerCabecalho(Readable.from([Buffer.from('abc')]), 100);
    expect(cabecalho.toString()).toBe('abc');
    expect((await ler(resto)).toString()).toBe('abc');
  });
});
