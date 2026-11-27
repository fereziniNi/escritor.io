// origem: skills-modelo/apps/api/src/armazenamento/chave.ts
import { randomUUID } from 'node:crypto';
import { ErroArmazenamento } from './armazenamento';

/** Extensões que o sistema aceita (as de `tipos.ts`). A extensão da chave vem do TIPO DETECTADO, nunca do nome enviado. */
export type Extensao = 'pdf' | 'png' | 'jpg' | 'xlsx';

const FORMATO_CHAVE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|png|jpg|xlsx)$/;

/** Chave do objeto: `<uuid>.<extensão>`, sorteada no servidor. Não tem barra, ponto duplo nem nada do cliente. */
export const gerarChave = (extensao: Extensao): string => `${randomUUID()}.${extensao}`;

/** Lança se a chave não for exatamente uma chave gerada por `gerarChave`. Toda implementação de Armazenamento chama primeiro. */
export function exigirChaveValida(chave: string): void {
  if (!FORMATO_CHAVE.test(chave)) throw new ErroArmazenamento('chave inválida');
}
