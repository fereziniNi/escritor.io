// origem: skills-modelo/apps/api/src/fila/catalogo.spec.ts
import { describe, expect, it } from 'vitest';
import { FILAS_DO_SISTEMA, NOME_EMAIL_ENVIAR } from './catalogo';
import { INTERVALO_LIMPEZA_S } from './fila';

describe('catálogo de filas: retenção', () => {
  it('email-enviar (payload com o código de login) não fica no banco além da validade do código (10 min)', () => {
    const email = FILAS_DO_SISTEMA[NOME_EMAIL_ENVIAR]!;
    // Esperando na fila (worker parado): some depois de retentionSeconds.
    expect(email.retentionSeconds).toBeDefined();
    expect(email.retentionSeconds! + INTERVALO_LIMPEZA_S).toBeLessThanOrEqual(900);
    // Concluída ou falha: some depois de deleteAfterSeconds (mais a volta da limpeza).
    expect(email.deleteAfterSeconds).toBeDefined();
    expect(email.deleteAfterSeconds! + INTERVALO_LIMPEZA_S).toBeLessThanOrEqual(600);
  });

  it('a limpeza do pg-boss roda pelo menos a cada minuto (o padrão dele é 1 vez por dia)', () => {
    expect(INTERVALO_LIMPEZA_S).toBeLessThanOrEqual(60);
  });
});
