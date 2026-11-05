// origem: skills-modelo/packages/contratos/src/auth.ts
import { z } from 'zod';
import { PAPEIS } from './usuarios.js';

/** E-mail como o login compara: sem espaços nas pontas e em minúsculas. */
const email = z.string().trim().toLowerCase().pipe(z.email().max(254));

/** POST /api/auth/codigo */
export const esquemaPedirCodigo = z.object({ email });
export type PedirCodigo = z.infer<typeof esquemaPedirCodigo>;

/** POST /api/auth/entrar. Código: exatamente 6 dígitos, como texto (zeros à esquerda contam). */
export const esquemaEntrar = z.object({ email, codigo: z.string().regex(/^\d{6}$/) });
export type Entrar = z.infer<typeof esquemaEntrar>;

/** GET /api/auth/eu: quem está logado. O papel vem da tabela usuario a cada requisição. */
export const esquemaUsuarioLogado = z.object({
  id: z.uuid(),
  email: z.string().min(1),
  nome: z.string().min(1),
  papel: z.enum(PAPEIS),
});
export type UsuarioLogado = z.infer<typeof esquemaUsuarioLogado>;

/**
 * Corpo do 202 de POST /api/auth/codigo. É SEMPRE este, com ou sem conta, dentro ou fora do domínio, com ou sem limite:
 * a resposta não pode revelar quem tem acesso.
 */
export const RESPOSTA_PEDIR_CODIGO = {
  mensagem: 'Se o e-mail tiver acesso, enviamos um código. Ele vale por 10 minutos.',
} as const;
export const esquemaRespostaPedirCodigo = z.object({ mensagem: z.string().min(1) });
