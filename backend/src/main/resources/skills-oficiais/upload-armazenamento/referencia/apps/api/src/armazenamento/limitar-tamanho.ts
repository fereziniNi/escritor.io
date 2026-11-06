// origem: skills-modelo/apps/api/src/armazenamento/limitar-tamanho.ts
import { Readable } from 'node:stream';

/** O corpo passou do tamanho permitido. O serviço traduz em 413. */
export class LimiteExcedido extends Error {
  constructor(readonly limiteBytes: number) {
    super(`o arquivo passa de ${limiteBytes} bytes`);
    this.name = 'LimiteExcedido';
  }
}

/**
 * Conta os bytes conforme passam e falha com `LimiteExcedido` no primeiro byte acima de `bytes`, destruindo a origem: o
 * resto nunca é lido nem guardado. Não confie no `Content-Length` (um cliente fora do navegador declara pouco e manda
 * muito em chunked); este fluxo vale para o que de fato chega. `medida.bytes` acompanha o total que passou (tamanho final).
 */
export function limitarTamanho(origem: Readable, bytes: number, medida: { bytes: number } = { bytes: 0 }): Readable {
  let total = 0;
  async function* passar(): AsyncGenerator<Buffer> {
    for await (const parte of origem) {
      const bloco = parte as Buffer;
      total += bloco.length;
      medida.bytes = total;
      if (total > bytes) {
        origem.destroy();
        throw new LimiteExcedido(bytes);
      }
      yield bloco;
    }
  }
  return Readable.from(passar(), { objectMode: false });
}

/**
 * Lê só o começo do fluxo (pelo menos `minimo` bytes, ou tudo se for menor) e devolve um fluxo novo que repete esse começo
 * e segue com o resto. Serve para olhar a assinatura de bytes ANTES de gravar qualquer coisa, sem guardar o arquivo na memória.
 */
export async function lerCabecalho(origem: Readable, minimo: number): Promise<{ cabecalho: Buffer; resto: Readable }> {
  const iterador = origem[Symbol.asyncIterator]();
  const partes: Buffer[] = [];
  let lidos = 0;
  let acabou = false;
  while (lidos < minimo) {
    const proximo = await iterador.next();
    if (proximo.done) {
      acabou = true;
      break;
    }
    const bloco = proximo.value as Buffer;
    partes.push(bloco);
    lidos += bloco.length;
  }
  const cabecalho = Buffer.concat(partes);
  async function* repetir(): AsyncGenerator<Buffer> {
    try {
      if (cabecalho.length > 0) yield cabecalho;
      if (acabou) return;
      for (;;) {
        const proximo = await iterador.next();
        if (proximo.done) return;
        yield proximo.value as Buffer;
      }
    } finally {
      // Consumidor desistiu (erro ao gravar): solta a origem.
      if (!acabou) await iterador.return?.();
    }
  }
  return { cabecalho, resto: Readable.from(repetir(), { objectMode: false }) };
}
