// origem: skills-modelo/apps/api/src/exportacao/logo.spec.ts
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { lerLogo } from './logo';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const pasta = mkdtempSync(path.join(tmpdir(), 'logo-'));
const arquivo = (nome: string, conteudo: Buffer) => {
  const caminho = path.join(pasta, nome);
  writeFileSync(caminho, conteudo);
  return caminho;
};

afterAll(() => rmSync(pasta, { recursive: true, force: true }));

describe('EXPORTACAO_LOGO (lerLogo): falha fechada na subida', () => {
  it('lê PNG e JPEG', () => {
    expect(lerLogo(arquivo('a.png', PNG))).toEqual(PNG);
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
    expect(lerLogo(arquivo('a.jpg', jpeg))).toEqual(jpeg);
  });

  it('arquivo inexistente → erro que cita EXPORTACAO_LOGO (sem repetir o caminho)', () => {
    expect(() => lerLogo(path.join(pasta, 'nao-existe.png'))).toThrow(/EXPORTACAO_LOGO/);
  });

  it('o que não é PNG nem JPEG (ex.: SVG, que pode levar script) ou passa de 512 KB é recusado', () => {
    expect(() => lerLogo(arquivo('a.svg', Buffer.from('<svg onload="x()"></svg>')))).toThrow(/PNG ou JPEG/);
    expect(() => lerLogo(arquivo('grande.png', Buffer.concat([PNG, Buffer.alloc(513 * 1024)])))).toThrow(/512 KB/);
  });
});
