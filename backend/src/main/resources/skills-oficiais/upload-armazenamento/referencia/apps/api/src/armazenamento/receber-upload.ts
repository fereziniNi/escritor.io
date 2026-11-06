// origem: skills-modelo/apps/api/src/armazenamento/receber-upload.ts
import { BadRequestException, PayloadTooLargeException, UnsupportedMediaTypeException } from '@nestjs/common';
import busboy from 'busboy';
import { type Request } from 'express';
import { type Readable } from 'node:stream';

/** Folga do multipart (limites, nomes, campos) sobre o tamanho do arquivo, para a checagem antecipada do Content-Length. */
const MARGEM_MULTIPART = 256 * 1024;

export interface UploadRecebido {
  /** Campos de texto que vieram ANTES do arquivo (o campo `escopo` tem de ser enviado antes). */
  campos: Record<string, string>;
  /** O arquivo (campo `arquivo`), como fluxo ainda não lido; null se o corpo não trouxe arquivo. */
  arquivo: { stream: Readable; nomeDoCliente: string } | null;
  /** Depois de consumir o arquivo: espera o fim do corpo; lança 400 se vieram arquivos a mais. */
  concluir(): Promise<void>;
  /** Para de ler o corpo (erro no meio). */
  abortar(): void;
}

/**
 * Lê um upload `multipart/form-data` EM FLUXO (busboy): o arquivo chega como `Readable` e nada é acumulado na memória.
 * - Content-Length declarado acima de `maxBytes` (+ folga) → 413 antes de ler um byte; mas quem manda chunked não declara,
 *   então o teto de verdade é o `limitarTamanho` que o serviço aplica ao fluxo e o `fileSize` do busboy (max + 1);
 * - um só arquivo (campo `arquivo`), até 5 campos de texto de 1 KB; o resto é 400;
 * - o nome do arquivo vem do cliente e é só texto (ver nomeParaExibir).
 */
export function receberUpload(req: Request, maxBytes: number): Promise<UploadRecebido> {
  const tipo = req.get('content-type') ?? '';
  if (!/^multipart\/form-data/i.test(tipo)) throw new UnsupportedMediaTypeException('Envie o arquivo como multipart/form-data');
  const declarado = Number(req.get('content-length'));
  if (Number.isFinite(declarado) && declarado > maxBytes + MARGEM_MULTIPART) throw new PayloadTooLargeException('Arquivo maior que o permitido');

  return new Promise<UploadRecebido>((resolver, rejeitar) => {
    let leitor: busboy.Busboy;
    try {
      leitor = busboy({ headers: req.headers, defParamCharset: 'utf8', limits: { files: 1, fields: 5, fieldSize: 1024, fileSize: maxBytes + 1, parts: 8, headerPairs: 20 } });
    } catch {
      return rejeitar(new BadRequestException('Corpo multipart inválido'));
    }
    const campos: Record<string, string> = {};
    let entregue = false;
    let arquivosAMais = false;
    let arquivoAtual: Readable | null = null;
    const fim = new Promise<void>((ok, falhou) => {
      leitor.once('close', ok);
      leitor.once('error', falhou);
    });
    fim.catch(() => undefined); // o erro é tratado por quem chamar concluir() ou pelo reject abaixo

    const abortar = () => {
      req.unpipe(leitor);
      leitor.destroy();
    };

    leitor.on('field', (nome, valor, info) => {
      if (info.valueTruncated || info.nameTruncated) return rejeitar(new BadRequestException('Campo do formulário grande demais'));
      campos[nome] = valor;
    });
    leitor.on('filesLimit', () => {
      arquivosAMais = true;
    });
    leitor.on('file', (nome, stream, info) => {
      if (nome !== 'arquivo') {
        stream.resume();
        if (!entregue) rejeitar(new BadRequestException('O arquivo deve vir no campo "arquivo"'));
        return;
      }
      entregue = true;
      arquivoAtual = stream;
      resolver({
        campos,
        arquivo: { stream, nomeDoCliente: info.filename ?? '' },
        concluir: async () => {
          await fim.catch(() => {
            throw new BadRequestException('Corpo multipart interrompido ou inválido');
          });
          if (arquivosAMais) throw new BadRequestException('Envie um arquivo por vez');
        },
        abortar,
      });
    });
    leitor.once('close', () => {
      if (!entregue) resolver({ campos, arquivo: null, concluir: () => Promise.resolve(), abortar });
    });
    leitor.once('error', (e) => {
      if (!entregue) rejeitar(new BadRequestException('Corpo multipart inválido'));
      else arquivoAtual?.destroy(e instanceof Error ? e : new Error('multipart inválido'));
    });
    req.once('error', (e) => leitor.destroy(e));
    req.once('aborted', () => leitor.destroy(new Error('cliente desconectou')));
    req.pipe(leitor);
  });
}
