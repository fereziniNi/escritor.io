import { createHmac, timingSafeEqual } from 'node:crypto';

/** HMAC-SHA256 em hex de `<chave>\n<exp>`: amarra o link a UM objeto e a UM instante de expiração. */
const assinatura = (segredo: string, chave: string, exp: number): string => createHmac('sha256', segredo).update(`${chave}\n${exp}`).digest('hex');

/**
 * URL assinada do armazenamento LOCAL (S3 e Azure usam a do próprio provedor): `<prefixo>/<chave>?exp=<segundos Unix>&sig=<hmac>`.
 * Quem tem o link baixa até `exp`, sem sessão; trocar a chave ou a expiração invalida a assinatura. `agoraMs` existe só para teste.
 */
export function assinarUrlLocal(segredo: string, prefixo: string, chave: string, segundos: number, agoraMs: number = Date.now()): string {
  const exp = Math.floor(agoraMs / 1000) + segundos;
  return `${prefixo}/${chave}?exp=${exp}&sig=${assinatura(segredo, chave, exp)}`;
}

/** true só se `exp` ainda não passou e `sig` é a assinatura de `chave` + `exp` (comparação em tempo constante). */
export function verificarAssinaturaLocal(segredo: string, chave: string, exp: string | null, sig: string | null, agoraMs: number = Date.now()): boolean {
  if (!exp || !sig || !/^\d{1,12}$/.test(exp) || !/^[0-9a-f]{64}$/.test(sig)) return false;
  const expiraEm = Number(exp);
  const esperada = Buffer.from(assinatura(segredo, chave, expiraEm), 'hex');
  const recebida = Buffer.from(sig, 'hex');
  // Confere a assinatura ANTES de olhar o relógio: o tempo de resposta não revela nada sobre ela.
  const confere = esperada.length === recebida.length && timingSafeEqual(esperada, recebida);
  return confere && expiraEm * 1000 > agoraMs;
}
