// origem: skills-modelo/apps/api/src/lgpd/chaveiro.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Criptografia de campo (LGPD): AES-256-GCM.
 * - Chaves em `DADOS_CHAVES="kid1:base64,kid2:base64"` (32 bytes cada, base64 padrão). A PRIMEIRA cifra; as demais só
 *   decifram (rotação: ponha a nova na frente, rode `lgpd:recifrar`, só então retire a antiga).
 * - IV aleatório de 12 bytes por valor; tag de 16 bytes (conferida no tamanho: tag curta é recusada).
 * - AAD = nome da coluna (`cliente.cpf`): um valor cifrado copiado para outra coluna não decifra.
 * - Envelope em texto: `kid:iv:tag:cifra`, cada parte em base64.
 * Mensagens de erro citam posição e kid, nunca a chave nem o conteúdo.
 */
export interface ChaveDados {
  readonly kid: string;
  readonly chave: Buffer;
}

export class ErroChaveiro extends Error {
  override readonly name = 'ErroChaveiro';
}

const ALGORITMO = 'aes-256-gcm';
const TAMANHO_CHAVE = 32;
const TAMANHO_IV = 12;
const TAMANHO_TAG = 16;
const FORMATO_KID = /^[a-z0-9][a-z0-9-]{0,31}$/;
const GERAR = 'gere com: openssl rand -base64 32';

/** base64 PADRÃO e canônico de exatamente 32 bytes (recusa base64url, espaços e lixo, que o Buffer aceitaria calado). */
function chaveDeBase64(texto: string, nome: string): Buffer {
  const chave = Buffer.from(texto, 'base64');
  if (chave.length !== TAMANHO_CHAVE || chave.toString('base64') !== texto) {
    throw new ErroChaveiro(`${nome}: precisa ter 32 bytes em base64 padrão (${GERAR})`);
  }
  if (chave.every((b) => b === chave[0])) throw new ErroChaveiro(`${nome}: todos os bytes iguais não é chave (${GERAR})`);
  return chave;
}

/** Lê `DADOS_CHAVES`: `kid:base64[,kid:base64...]`. Ordem preservada (a primeira é a ativa); kids únicos. */
export function lerChavesDados(texto: string): ChaveDados[] {
  const itens = texto.split(',').map((i) => i.trim());
  if (itens.length === 0 || itens.some((i) => i === '')) throw new ErroChaveiro('DADOS_CHAVES vazia ou com item vazio (formato kid:base64,kid:base64)');
  const chaves = itens.map((item, i) => {
    const sep = item.indexOf(':');
    const kid = sep < 0 ? '' : item.slice(0, sep);
    if (!FORMATO_KID.test(kid)) throw new ErroChaveiro(`chave ${i + 1}: kid inválido (formato kid:base64; kid com a-z, 0-9 e -, até 32)`);
    return { kid, chave: chaveDeBase64(item.slice(sep + 1), `chave ${i + 1} (kid "${kid}")`) };
  });
  if (new Set(chaves.map((c) => c.kid)).size !== chaves.length) throw new ErroChaveiro('DADOS_CHAVES tem kid repetido');
  for (let i = 0; i < chaves.length; i++) {
    for (let j = i + 1; j < chaves.length; j++) {
      if (chaves[i]!.chave.equals(chaves[j]!.chave)) throw new ErroChaveiro(`chaves ${i + 1} e ${j + 1} têm o mesmo valor`);
    }
  }
  return chaves;
}

/** Lê `DADOS_CHAVE_INDICE` (HMAC do índice cego): 32 bytes em base64 padrão. */
export function lerChaveIndice(texto: string): Buffer {
  return chaveDeBase64(texto.trim(), 'DADOS_CHAVE_INDICE');
}

/** A chave do índice tem de ser diferente de todas as de dados (vazar uma não pode comprometer a outra função). */
export function conferirChavesDistintas(dados: readonly ChaveDados[], indice: Buffer): void {
  if (dados.some((c) => c.chave.equals(indice))) {
    throw new ErroChaveiro('DADOS_CHAVE_INDICE tem de ser diferente de todas as chaves de DADOS_CHAVES');
  }
}

export class Chaveiro {
  readonly #chaves: readonly ChaveDados[];

  constructor(chaves: readonly ChaveDados[]) {
    if (chaves.length === 0) throw new ErroChaveiro('nenhuma chave de dados');
    this.#chaves = chaves;
  }

  /** Kid da chave que cifra (a primeira de DADOS_CHAVES). */
  get kidAtivo(): string {
    return this.#chaves[0]!.kid;
  }

  /** Cifra com a chave ativa; `coluna` (ex.: `cliente.cpf`) entra como AAD. */
  cifrar(texto: string, coluna: string): string {
    const { kid, chave } = this.#chaves[0]!;
    const iv = randomBytes(TAMANHO_IV);
    const cifrador = createCipheriv(ALGORITMO, chave, iv, { authTagLength: TAMANHO_TAG });
    cifrador.setAAD(Buffer.from(coluna, 'utf8'));
    const cifra = Buffer.concat([cifrador.update(texto, 'utf8'), cifrador.final()]);
    return [kid, iv.toString('base64'), cifrador.getAuthTag().toString('base64'), cifra.toString('base64')].join(':');
  }

  /** Decifra com a chave do kid do envelope (qualquer uma configurada). AAD diferente ou dado adulterado → ErroChaveiro. */
  decifrar(envelope: string, coluna: string): string {
    const partes = envelope.split(':');
    if (partes.length !== 4) throw new ErroChaveiro(`envelope inválido em ${coluna}`);
    const [kid, iv64, tag64, cifra64] = partes as [string, string, string, string];
    const entrada = this.#chaves.find((c) => c.kid === kid);
    if (!entrada) throw new ErroChaveiro(`chave "${kid.slice(0, 32)}" não configurada em DADOS_CHAVES (${coluna})`);
    const iv = Buffer.from(iv64, 'base64');
    const tag = Buffer.from(tag64, 'base64');
    if (iv.length !== TAMANHO_IV || tag.length !== TAMANHO_TAG) throw new ErroChaveiro(`envelope inválido em ${coluna}`);
    try {
      const decifrador = createDecipheriv(ALGORITMO, entrada.chave, iv, { authTagLength: TAMANHO_TAG });
      decifrador.setAAD(Buffer.from(coluna, 'utf8'));
      decifrador.setAuthTag(tag);
      return Buffer.concat([decifrador.update(Buffer.from(cifra64, 'base64')), decifrador.final()]).toString('utf8');
    } catch {
      throw new ErroChaveiro(`não foi possível decifrar ${coluna} (chave, coluna ou dado não conferem)`);
    }
  }

  /** Kid que cifrou o envelope. */
  kidDe(envelope: string): string {
    return envelope.split(':', 1)[0]!;
  }

  /** Rotação: envelope novo com a chave ativa, ou null se já está nela. */
  recifrar(envelope: string, coluna: string): string | null {
    if (this.kidDe(envelope) === this.kidAtivo) return null;
    return this.cifrar(this.decifrar(envelope, coluna), coluna);
  }
}
