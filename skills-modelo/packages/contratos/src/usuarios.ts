import { z } from 'zod';

/** Papéis do sistema (iguais aos da API, apps/api/src/usuarios/papel.ts). MAIÚSCULOS, comparação exata. */
export const PAPEIS = ['ADMIN', 'GESTOR', 'USUARIO'] as const;
export type Papel = (typeof PAPEIS)[number];

/** Rótulo para mostrar na tela (o valor guardado e enviado continua o do enum). */
export const ROTULO_PAPEL: Record<Papel, string> = { ADMIN: 'Administrador', GESTOR: 'Gestor', USUARIO: 'Usuário' };

/** Um usuário como a API devolve em /api/usuarios. */
export const esquemaUsuario = z.object({
  id: z.uuid(),
  email: z.string().min(1),
  nome: z.string().min(1),
  papel: z.enum(PAPEIS),
  ativo: z.boolean(),
  criadoEm: z.string().min(1),
});
export type Usuario = z.infer<typeof esquemaUsuario>;

export const esquemaListaUsuarios = z.array(esquemaUsuario);
