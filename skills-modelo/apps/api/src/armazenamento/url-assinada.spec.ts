import { describe, expect, it } from 'vitest';
import { assinarUrlLocal, verificarAssinaturaLocal } from './url-assinada';

const SEGREDO = 'segredo-de-teste-com-mais-de-32-caracteres';
const CHAVE = '3f2b8c1e-9a7d-4c55-8f0e-1b2c3d4e5f60.pdf';
const AGORA = 1_800_000_000_000;

function partes(url: string) {
  const u = new URL(url, 'http://local');
  return { exp: u.searchParams.get('exp'), sig: u.searchParams.get('sig') };
}

describe('URL assinada do armazenamento local', () => {
  it('assina com expiração e a assinatura confere', () => {
    const url = assinarUrlLocal(SEGREDO, '/api/arquivos/assinado', CHAVE, 60, AGORA);
    expect(url.startsWith(`/api/arquivos/assinado/${CHAVE}?exp=`)).toBe(true);
    const { exp, sig } = partes(url);
    expect(Number(exp)).toBe(Math.floor(AGORA / 1000) + 60);
    expect(verificarAssinaturaLocal(SEGREDO, CHAVE, exp, sig, AGORA + 59_000)).toBe(true);
  });

  it('expirada, adulterada, de outra chave ou de outro segredo: recusa', () => {
    const { exp, sig } = partes(assinarUrlLocal(SEGREDO, '/p', CHAVE, 60, AGORA));
    expect(verificarAssinaturaLocal(SEGREDO, CHAVE, exp, sig, AGORA + 61_000)).toBe(false);
    expect(verificarAssinaturaLocal(SEGREDO, CHAVE, String(Number(exp) + 3600), sig, AGORA)).toBe(false);
    expect(verificarAssinaturaLocal(SEGREDO, '00000000-0000-4000-8000-000000000000.pdf', exp, sig, AGORA)).toBe(false);
    expect(verificarAssinaturaLocal('outro-segredo-com-mais-de-32-caracteres!!', CHAVE, exp, sig, AGORA)).toBe(false);
    expect(verificarAssinaturaLocal(SEGREDO, CHAVE, exp, `${sig!.slice(0, -2)}00`, AGORA)).toBe(false);
    expect(verificarAssinaturaLocal(SEGREDO, CHAVE, null, null, AGORA)).toBe(false);
    expect(verificarAssinaturaLocal(SEGREDO, CHAVE, 'abc', sig, AGORA)).toBe(false);
    expect(verificarAssinaturaLocal(SEGREDO, CHAVE, exp, 'curta', AGORA)).toBe(false);
  });
});
