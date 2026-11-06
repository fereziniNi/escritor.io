import { randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { type Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { type Armazenamento, ErroArmazenamento, type OpcoesUrlAssinada } from './armazenamento';
import { exigirChaveValida } from './chave';
import { assinarUrlLocal, verificarAssinaturaLocal } from './url-assinada';

export interface OpcoesLocal {
  /** Pasta dos arquivos (fora de qualquer pasta servida como estático). Criada com permissão 0700. */
  pasta: string;
  /** Segredo do HMAC das URLs assinadas (ARMAZENAMENTO_SEGREDO_URL). */
  segredoUrl: string;
  /** Rota do app que serve o link assinado (ex.: /api/arquivos/assinado). */
  prefixoUrl: string;
}

/**
 * Arquivos numa pasta do servidor (disco do contêiner: monte um volume). Grava num temporário `.tmp-<uuid>` e renomeia no
 * fim, então um upload que cai no meio nunca vira arquivo. O link assinado é do próprio app (HMAC com expiração).
 */
export class ArmazenamentoLocal implements Armazenamento {
  constructor(private readonly opcoes: OpcoesLocal) {}

  private caminho(chave: string): string {
    exigirChaveValida(chave);
    return path.join(this.opcoes.pasta, chave);
  }

  async salvar(chave: string, stream: Readable, _tipo: string): Promise<void> {
    const destino = this.caminho(chave);
    await mkdir(this.opcoes.pasta, { recursive: true, mode: 0o700 });
    const temporario = path.join(this.opcoes.pasta, `.tmp-${randomUUID()}`);
    try {
      await pipeline(stream, createWriteStream(temporario, { flags: 'wx', mode: 0o600 }));
      await rename(temporario, destino);
    } catch (e) {
      await rm(temporario, { force: true });
      throw e;
    }
  }

  async abrir(chave: string): Promise<Readable> {
    const caminho = this.caminho(chave);
    const leitura = createReadStream(caminho);
    // Espera o arquivo abrir: objeto inexistente falha aqui, não no meio da resposta HTTP.
    await new Promise<void>((ok, falhou) => {
      leitura.once('open', () => ok());
      leitura.once('error', (e) => falhou(new ErroArmazenamento('arquivo não encontrado', { cause: e })));
    });
    return leitura;
  }

  urlAssinada(chave: string, segundos: number, _opcoes?: OpcoesUrlAssinada): Promise<string> {
    exigirChaveValida(chave);
    return Promise.resolve(assinarUrlLocal(this.opcoes.segredoUrl, this.opcoes.prefixoUrl, chave, segundos));
  }

  /** Confere o link assinado (`exp` e `sig` da URL) desta chave: assinatura certa e ainda não expirado. */
  verificarLink(chave: string, exp: string | null, sig: string | null): boolean {
    return verificarAssinaturaLocal(this.opcoes.segredoUrl, chave, exp, sig);
  }

  async remover(chave: string): Promise<void> {
    await rm(this.caminho(chave), { force: true });
  }
}
