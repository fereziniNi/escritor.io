import { type Readable } from 'node:stream';
import { BlobSASPermissions, BlobServiceClient, type ContainerClient } from '@azure/storage-blob';
import { type Armazenamento, ErroArmazenamento, type OpcoesUrlAssinada } from './armazenamento';
import { exigirChaveValida } from './chave';
import { contentDisposition } from '../exportacao/content-disposition';

export interface OpcoesAzure {
  /** Connection string da conta (com chave: o SAS do link é assinado com ela). É Segredo. */
  connectionString: string;
  container: string;
}

/**
 * Azure Blob Storage. Upload em blocos a partir do stream (4 MiB x 4 em voo = 16 MiB no máximo na memória); se o stream
 * falha, o blob não é confirmado (os blocos não confirmados o Azure descarta). Container PRIVADO; leitura só por SAS curto de
 * UM blob, somente leitura, com `Content-Disposition: attachment`, ou pela API (`abrir`).
 */
export class ArmazenamentoAzure implements Armazenamento {
  private readonly container: ContainerClient;

  constructor(opcoes: OpcoesAzure) {
    this.container = BlobServiceClient.fromConnectionString(opcoes.connectionString).getContainerClient(opcoes.container);
  }

  /** Para dev e testes (Azurite). Em produção o container é criado pela infraestrutura. */
  async criarContainerSeNaoExistir(): Promise<void> {
    await this.container.createIfNotExists();
  }

  async salvar(chave: string, stream: Readable, tipo: string): Promise<void> {
    exigirChaveValida(chave);
    try {
      await this.container.getBlockBlobClient(chave).uploadStream(stream, 4 * 1024 * 1024, 4, { blobHTTPHeaders: { blobContentType: tipo } });
    } catch (e) {
      if (stream.errored) throw stream.errored;
      throw e;
    }
  }

  async abrir(chave: string): Promise<Readable> {
    exigirChaveValida(chave);
    try {
      const r = await this.container.getBlobClient(chave).download();
      if (!r.readableStreamBody) throw new ErroArmazenamento('resposta do Azure sem corpo');
      return r.readableStreamBody as Readable;
    } catch (e) {
      if (e instanceof ErroArmazenamento) throw e;
      throw new ErroArmazenamento('arquivo não encontrado', { cause: e });
    }
  }

  urlAssinada(chave: string, segundos: number, opcoes: OpcoesUrlAssinada = {}): Promise<string> {
    exigirChaveValida(chave);
    return this.container.getBlobClient(chave).generateSasUrl({
      permissions: BlobSASPermissions.parse('r'),
      expiresOn: new Date(Date.now() + segundos * 1000),
      contentDisposition: contentDisposition(opcoes.nomeDownload ?? 'arquivo'),
      ...(opcoes.tipo ? { contentType: opcoes.tipo } : {}),
    });
  }

  async remover(chave: string): Promise<void> {
    exigirChaveValida(chave);
    await this.container.getBlobClient(chave).deleteIfExists();
  }
}
