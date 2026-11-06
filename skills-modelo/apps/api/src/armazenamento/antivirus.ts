import net from 'node:net';
import { type Readable } from 'node:stream';

/** Resultado da varredura: limpo, ou a ameaça que o ClamAV nomeou. Falha de varredura NÃO é resultado: é `ErroAntivirus`. */
export type ResultadoVarredura = { limpo: true } | { limpo: false; ameaca: string };

export interface Antivirus {
  verificar(stream: Readable): Promise<ResultadoVarredura>;
}

export const ANTIVIRUS = Symbol('ANTIVIRUS');

/** O antivírus não conseguiu dizer se o arquivo é seguro (fora do ar, tempo esgotado, resposta de erro). Quem chama FALHA FECHADO. */
export class ErroAntivirus extends Error {
  constructor(mensagem: string, opcoes?: { cause?: unknown }) {
    super(mensagem, opcoes);
    this.name = 'ErroAntivirus';
  }
}

export interface OpcoesClamav {
  host: string;
  porta: number;
  /** Tempo total da varredura (conexão + envio + resposta). Padrão 60 s. */
  tempoLimiteMs?: number;
}

/**
 * Cliente do clamd por TCP, protocolo INSTREAM: `zINSTREAM\0`, blocos [4 bytes de tamanho][dados], bloco de tamanho 0, e a
 * resposta `stream: OK` / `stream: <ameaça> FOUND` / `... ERROR`. O arquivo vai aos poucos, com pressão de volta, sem ir
 * inteiro para a memória. O clamd recusa fluxo maior que `StreamMaxLength` (padrão 25 MB): ajuste-o para ser maior que
 * UPLOAD_MAX_MB (no contêiner oficial: CLAMD_CONF_StreamMaxLength), senão todo arquivo grande falha FECHADO (ErroAntivirus).
 */
export class AntivirusClamav implements Antivirus {
  constructor(private readonly opcoes: OpcoesClamav) {}

  verificar(stream: Readable): Promise<ResultadoVarredura> {
    const { host, porta, tempoLimiteMs = 60_000 } = this.opcoes;
    return new Promise<ResultadoVarredura>((resolver, rejeitar) => {
      const socket = net.createConnection({ host, port: porta });
      let resposta = '';
      let terminou = false;
      const terminar = (fim: () => void) => {
        if (terminou) return;
        terminou = true;
        clearTimeout(relogio);
        stream.destroy();
        socket.destroy();
        fim();
      };
      const falhar = (motivo: string, causa?: unknown) => terminar(() => rejeitar(new ErroAntivirus(motivo, { cause: causa })));
      const relogio = setTimeout(() => falhar('tempo esgotado esperando o ClamAV'), tempoLimiteMs);

      socket.on('error', (e) => falhar('ClamAV indisponível', e));
      socket.on('data', (parte) => {
        resposta += parte.toString('utf8');
      });
      socket.on('close', () => {
        const texto = resposta.replace(/\0/g, '').trim();
        const achado = /^stream: (.+) FOUND$/.exec(texto);
        if (texto === 'stream: OK') terminar(() => resolver({ limpo: true }));
        else if (achado) terminar(() => resolver({ limpo: false, ameaca: achado[1]! }));
        else falhar(`resposta inesperada do ClamAV${texto ? `: ${texto.slice(0, 80)}` : ' (conexão fechada sem resposta)'}`);
      });

      socket.once('connect', () => {
        void (async () => {
          try {
            socket.write('zINSTREAM\0');
            for await (const parte of stream) {
              const bloco = parte as Buffer;
              const tamanho = Buffer.alloc(4);
              tamanho.writeUInt32BE(bloco.length);
              if (!socket.write(Buffer.concat([tamanho, bloco]))) await new Promise<void>((ok) => socket.once('drain', ok));
            }
            socket.write(Buffer.alloc(4));
          } catch (e) {
            falhar('falha ao enviar o arquivo ao ClamAV', e);
          }
        })();
      });
    });
  }
}
