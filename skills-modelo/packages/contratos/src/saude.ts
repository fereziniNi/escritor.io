import { z } from 'zod';

/** Resposta de GET /api/health. `versao` e `commit` vêm do build da imagem (APP_VERSAO, APP_COMMIT). */
export const esquemaRespostaSaude = z.object({
  status: z.enum(['ok', 'erro']),
  banco: z.enum(['ok', 'erro']),
  versao: z.string().min(1),
  commit: z.string().min(1),
});

export type RespostaSaude = z.infer<typeof esquemaRespostaSaude>;
