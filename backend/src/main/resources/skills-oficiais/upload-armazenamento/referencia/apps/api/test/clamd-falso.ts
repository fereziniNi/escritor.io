// origem: skills-modelo/apps/api/test/clamd-falso.ts
import { createServer, type Server, type Socket } from 'node:net';

export type ModoClamd = 'normal' | 'erro' | 'mudo';

const EICAR = 'EICAR-STANDARD-ANTIVIRUS-TEST-FILE';

export interface ClamdFalso {
  porta: number;
  /** Quantos arquivos o servidor recebeu inteiros (protocolo INSTREAM completo). */
  varreduras: () => number;
  modo: (m: ModoClamd) => void;
  parar: () => Promise<void>;
}

/**
 * Servidor TCP que fala o protocolo INSTREAM do clamd: `zINSTREAM\0`, depois blocos [4 bytes de tamanho][dados] e um
 * bloco de tamanho 0. Responde `stream: OK` ou `stream: Eicar-Test-Signature FOUND` (se o conteúdo tiver a assinatura
 * EICAR). Modo `erro` responde como o clamd quando passa de StreamMaxLength; `mudo` nunca responde (timeout).
 */
export async function subirClamdFalso(): Promise<ClamdFalso> {
  let modo: ModoClamd = 'normal';
  let completas = 0;
  const conexoes = new Set<Socket>();
  const servidor: Server = createServer((socket) => {
    conexoes.add(socket);
    socket.on('close', () => conexoes.delete(socket));
    socket.on('error', () => undefined);
    let buffer = Buffer.alloc(0);
    let conteudo = Buffer.alloc(0);
    let comandoLido = false;
    socket.on('data', (parte) => {
      buffer = Buffer.concat([buffer, parte]);
      if (!comandoLido) {
        const fim = buffer.indexOf(0);
        if (fim < 0) return;
        if (buffer.subarray(0, fim).toString() !== 'zINSTREAM') return void socket.destroy();
        buffer = buffer.subarray(fim + 1);
        comandoLido = true;
      }
      while (buffer.length >= 4) {
        const tamanho = buffer.readUInt32BE(0);
        if (tamanho === 0) {
          completas += 1;
          if (modo === 'mudo') return;
          const resposta = modo === 'erro' ? 'INSTREAM size limit exceeded. ERROR' : conteudo.includes(EICAR) ? 'stream: Eicar-Test-Signature FOUND' : 'stream: OK';
          socket.end(`${resposta}\0`);
          return;
        }
        if (buffer.length < 4 + tamanho) return;
        conteudo = Buffer.concat([conteudo, buffer.subarray(4, 4 + tamanho)]);
        buffer = buffer.subarray(4 + tamanho);
      }
    });
  });
  await new Promise<void>((ok) => servidor.listen(0, '127.0.0.1', ok));
  const endereco = servidor.address();
  if (endereco === null || typeof endereco === 'string') throw new Error('clamd falso sem porta');
  return {
    porta: endereco.port,
    varreduras: () => completas,
    modo: (m) => {
      modo = m;
    },
    parar: () =>
      new Promise<void>((ok) => {
        for (const c of conexoes) c.destroy();
        servidor.close(() => ok());
      }),
  };
}

/** Assinatura de teste da indústria (inofensiva) para o clamd real e para o falso. */
export const EICAR_TESTE = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
