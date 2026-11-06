// origem: skills-modelo/apps/api/src/exportacao/logo.ts
import { readFileSync } from 'node:fs';

const TAMANHO_MAX_LOGO = 512 * 1024;
const ASSINATURA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Logo do PDF: PNG ou JPEG de até 512 KB. Qualquer problema derruba a subida (configuração errada aparece no deploy, não no primeiro PDF). */
export function lerLogo(caminho: string): Buffer {
  let logo: Buffer;
  try {
    logo = readFileSync(caminho);
  } catch {
    throw new Error('EXPORTACAO_LOGO: arquivo não encontrado ou ilegível');
  }
  const png = logo.subarray(0, 8).equals(ASSINATURA_PNG);
  const jpeg = logo[0] === 0xff && logo[1] === 0xd8;
  if (logo.length > TAMANHO_MAX_LOGO || !(png || jpeg)) throw new Error('EXPORTACAO_LOGO: use um PNG ou JPEG de até 512 KB');
  return logo;
}
