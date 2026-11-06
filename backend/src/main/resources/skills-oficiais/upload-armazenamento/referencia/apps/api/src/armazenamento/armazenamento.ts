// origem: skills-modelo/apps/api/src/armazenamento/armazenamento.ts
import { type Readable } from 'node:stream';

/** Opções de `urlAssinada`: o nome só serve para o `Content-Disposition: attachment` da resposta do provedor. */
export interface OpcoesUrlAssinada {
  /** Nome que o navegador sugere ao salvar (pode ter acento: vira `filename*` seguro). */
  nomeDownload?: string;
  /** Tipo gravado no upload; sem ele o provedor usa o que guardou. */
  tipo?: string;
}

/**
 * Onde os arquivos ficam: pasta do servidor, S3 (ou compatível: MinIO, R2) ou Azure Blob. Quem usa (ArquivosService) não
 * sabe qual é; trocar é a variável `ARMAZENAMENTO_TIPO`. Regras de todas as implementações:
 * - `chave` é SEMPRE a gerada pelo servidor (`gerarChave`: uuid + extensão permitida); qualquer outra lança antes de tocar
 *   no disco ou na rede, então nome de arquivo do cliente nunca vira caminho;
 * - `salvar` consome o stream aos poucos (nada de carregar o arquivo inteiro na memória) e, se o stream falhar no meio
 *   (limite de tamanho, cliente desconectou), não deixa objeto pela metade;
 * - `remover` de chave que não existe não é erro (idempotente);
 * - `abrir` de chave que não existe lança.
 */
export interface Armazenamento {
  salvar(chave: string, stream: Readable, tipo: string): Promise<void>;
  abrir(chave: string): Promise<Readable>;
  /** URL temporária que baixa o objeto como anexo, válida por `segundos`. */
  urlAssinada(chave: string, segundos: number, opcoes?: OpcoesUrlAssinada): Promise<string>;
  remover(chave: string): Promise<void>;
}

export const ARMAZENAMENTO = Symbol('ARMAZENAMENTO');

/** Erro de armazenamento (chave inválida, objeto inexistente, provedor fora do ar). A mensagem nunca leva credencial. */
export class ErroArmazenamento extends Error {
  constructor(mensagem: string, opcoes?: { cause?: unknown }) {
    super(mensagem, opcoes);
    this.name = 'ErroArmazenamento';
  }
}
