// origem: skills-modelo/apps/api/src/auditoria/sanitizar.ts
export const REDACTED = '[REDACTED]';

/** Chave que parece guardar credencial: o valor nunca vai para a trilha, em nenhum nível. */
const CHAVE_SENSIVEL = /(codigo|token|cookie|senha|password|segredo|secret|hmac|hash|authorization|credencial)/i;
const MAX_TEXTO = 500;
const MAX_PROFUNDIDADE = 6;

function limpar(valor: unknown, profundidade: number, vistos: WeakSet<object>): unknown {
  if (valor === null || typeof valor === 'number' || typeof valor === 'boolean') return valor;
  if (typeof valor === 'string') return valor.length > MAX_TEXTO ? `${valor.slice(0, MAX_TEXTO)}…` : valor;
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor.toISOString();
  if (typeof valor === 'bigint') return valor.toString();
  if (typeof valor !== 'object') return null;
  if (profundidade >= MAX_PROFUNDIDADE) return '[profundo demais]';
  if (vistos.has(valor)) return '[circular]';
  vistos.add(valor);
  if (Array.isArray(valor)) return valor.map((v) => limpar(v, profundidade + 1, vistos) ?? null);
  const saida: Record<string, unknown> = {};
  for (const [chave, v] of Object.entries(valor)) {
    if (v === undefined) continue;
    saida[chave] = CHAVE_SENSIVEL.test(chave) ? REDACTED : limpar(v, profundidade + 1, vistos);
  }
  return saida;
}

/**
 * Prepara `antes` e `depois` para o jsonb da trilha. Última barreira (a regra é quem chama não passar segredo):
 * valores de chaves com cara de credencial viram `[REDACTED]`, texto longo é cortado, profundidade e ciclos são contidos.
 * Ausência (undefined/null) vira `null`.
 */
export function sanitizarDetalhes(valor: unknown): unknown {
  if (valor === undefined || valor === null) return null;
  return limpar(valor, 0, new WeakSet());
}

/** `ana.souza@exemplo.com.br` vira `a***@exemplo.com.br`. Dado pessoal na trilha só mascarado (LGPD). Formato estranho vira `***`. */
export function mascararEmail(email: string): string {
  const i = email.lastIndexOf('@');
  if (i < 1 || i === email.length - 1) return '***';
  return `${email[0]}***${email.slice(i)}`;
}
