import { Readable } from 'node:stream';
import { CreateBucketCommand, DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { type Armazenamento, ErroArmazenamento, type OpcoesUrlAssinada } from './armazenamento';
import { exigirChaveValida } from './chave';
import { contentDisposition } from '../exportacao/content-disposition';

export interface OpcoesS3 {
  /** Vazio na AWS; o endereço do MinIO/R2/Wasabi nos compatíveis. */
  endpoint?: string;
  regiao: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** true para MinIO e a maioria dos compatíveis (bucket no caminho, não no host). */
  forcePathStyle?: boolean;
}

/** Tamanho de cada parte do upload em partes (mínimo do S3: 5 MiB). Memória por upload ≈ parte x fila (2) = 10 MiB. */
const TAMANHO_PARTE = 5 * 1024 * 1024;

/**
 * S3 e compatíveis. O upload vai em partes (lib-storage) a partir do stream, sem o arquivo inteiro na memória; se o stream
 * falha no meio, o upload em partes é abortado (nada fica no bucket). O bucket é PRIVADO: o acesso de leitura é só por
 * `urlAssinada` (curta, com `Content-Disposition: attachment`) ou por `abrir` através da API. Cifragem em repouso e política
 * de ciclo de vida do bucket são configuração do bucket, não do código.
 */
export class ArmazenamentoS3 implements Armazenamento {
  private readonly cliente: S3Client;

  constructor(private readonly opcoes: OpcoesS3) {
    this.cliente = new S3Client({
      region: opcoes.regiao,
      ...(opcoes.endpoint ? { endpoint: opcoes.endpoint } : {}),
      forcePathStyle: opcoes.forcePathStyle ?? false,
      credentials: { accessKeyId: opcoes.accessKeyId, secretAccessKey: opcoes.secretAccessKey },
    });
  }

  /** Para dev e testes: cria o bucket se não existir. Em produção o bucket é criado pela infraestrutura. */
  async criarBucketSeNaoExistir(): Promise<void> {
    try {
      await this.cliente.send(new HeadBucketCommand({ Bucket: this.opcoes.bucket }));
    } catch {
      await this.cliente.send(new CreateBucketCommand({ Bucket: this.opcoes.bucket }));
    }
  }

  async salvar(chave: string, stream: Readable, tipo: string): Promise<void> {
    exigirChaveValida(chave);
    const envio = new Upload({
      client: this.cliente,
      params: { Bucket: this.opcoes.bucket, Key: chave, Body: stream, ContentType: tipo },
      partSize: TAMANHO_PARTE,
      queueSize: 2,
      leavePartsOnError: false,
    });
    try {
      await envio.done();
    } catch (e) {
      // Falha do próprio stream (limite de tamanho) chega aqui com o erro original: devolve-o para o serviço decidir (413).
      if (stream.errored) throw stream.errored;
      throw e;
    }
  }

  async abrir(chave: string): Promise<Readable> {
    exigirChaveValida(chave);
    try {
      const r = await this.cliente.send(new GetObjectCommand({ Bucket: this.opcoes.bucket, Key: chave }));
      if (!(r.Body instanceof Readable)) throw new ErroArmazenamento('resposta do S3 sem corpo');
      return r.Body;
    } catch (e) {
      if (e instanceof ErroArmazenamento) throw e;
      throw new ErroArmazenamento('arquivo não encontrado', { cause: e });
    }
  }

  urlAssinada(chave: string, segundos: number, opcoes: OpcoesUrlAssinada = {}): Promise<string> {
    exigirChaveValida(chave);
    return getSignedUrl(
      this.cliente,
      new GetObjectCommand({
        Bucket: this.opcoes.bucket,
        Key: chave,
        // O navegador baixa como anexo, qualquer que seja o tipo: nada abre inline no domínio do bucket.
        ResponseContentDisposition: contentDisposition(opcoes.nomeDownload ?? 'arquivo'),
        ...(opcoes.tipo ? { ResponseContentType: opcoes.tipo } : {}),
      }),
      { expiresIn: segundos },
    );
  }

  async remover(chave: string): Promise<void> {
    exigirChaveValida(chave);
    // DeleteObject do S3 é idempotente: chave inexistente também responde sucesso.
    await this.cliente.send(new DeleteObjectCommand({ Bucket: this.opcoes.bucket, Key: chave }));
  }
}
