/**
 * Papéis do sistema. Para criar um papel novo: acrescente aqui, gere a migração (`pnpm --filter api db:generate`, o
 * drizzle-kit emite o `ALTER TYPE ... ADD VALUE`) e decida em cada `@Papeis(...)` quem o recebe.
 * Sempre MAIÚSCULO e sempre comparado por igualdade exata: `"admin"` NÃO é `ADMIN`.
 */
export const PAPEIS = ['ADMIN', 'GESTOR', 'USUARIO'] as const;

export type Papel = (typeof PAPEIS)[number];

/** Usado só quando o valor vem de fora (corpo da requisição): confere por igualdade exata, sem normalizar. */
export const ehPapel = (valor: unknown): valor is Papel => typeof valor === 'string' && (PAPEIS as readonly string[]).includes(valor);
