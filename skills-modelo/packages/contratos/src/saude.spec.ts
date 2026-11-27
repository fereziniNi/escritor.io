import { describe, expect, it } from 'vitest';
import { esquemaRespostaSaude } from './saude.js';

describe('esquemaRespostaSaude', () => {
  it('aceita a resposta do health e recusa campo faltando', () => {
    expect(esquemaRespostaSaude.parse({ status: 'ok', banco: 'ok', versao: '1.0.0', commit: 'abc1234' })).toBeTruthy();
    expect(esquemaRespostaSaude.safeParse({ status: 'ok', banco: 'ok' }).success).toBe(false);
  });
});
