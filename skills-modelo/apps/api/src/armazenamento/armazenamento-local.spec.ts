import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ArmazenamentoLocal } from './armazenamento-local';
import { gerarChave } from './chave';
import { LimiteExcedido, limitarTamanho } from './limitar-tamanho';

const SEGREDO = 'segredo-de-teste-com-mais-de-32-caracteres';
let pasta: string;
let armazenamento: ArmazenamentoLocal;

const ler = async (s: Readable): Promise<Buffer> => {
  const partes: Buffer[] = [];
  for await (const p of s) partes.push(p as Buffer);
  return Buffer.concat(partes);
};

beforeEach(async () => {
  pasta = await mkdtemp(path.join(tmpdir(), 'arquivos-'));
  armazenamento = new ArmazenamentoLocal({ pasta, segredoUrl: SEGREDO, prefixoUrl: '/api/arquivos/assinado' });
});
afterEach(async () => {
  await rm(pasta, { recursive: true, force: true });
});

describe('ArmazenamentoLocal', () => {
  it('salva, abre e remove', async () => {
    const chave = gerarChave('pdf');
    await armazenamento.salvar(chave, Readable.from([Buffer.from('%PDF-1.7 conteudo')]), 'application/pdf');
    expect((await ler(await armazenamento.abrir(chave))).toString()).toBe('%PDF-1.7 conteudo');
    await armazenamento.remover(chave);
    await expect(armazenamento.abrir(chave)).rejects.toThrow();
    await armazenamento.remover(chave); // remover o que não existe não é erro
  });

  it('chave que não é a gerada pelo servidor nunca vira caminho', async () => {
    for (const ruim of ['../../x.pdf', '..\\..\\x.pdf', '/etc/passwd', 'a/b.pdf', 'x.pdf', 'x.exe', `${gerarChave('pdf')}/..`]) {
      await expect(armazenamento.salvar(ruim, Readable.from([Buffer.from('a')]), 'application/pdf')).rejects.toThrow(/chave/i);
      await expect(armazenamento.abrir(ruim)).rejects.toThrow(/chave/i);
      await expect(armazenamento.remover(ruim)).rejects.toThrow(/chave/i);
    }
    expect(await readdir(pasta)).toEqual([]);
  });

  it('fluxo que falha no meio não deixa arquivo nem temporário', async () => {
    const chave = gerarChave('png');
    const estourado = limitarTamanho(Readable.from([Buffer.alloc(10), Buffer.alloc(10)]), 15);
    await expect(armazenamento.salvar(chave, estourado, 'image/png')).rejects.toBeInstanceOf(LimiteExcedido);
    expect(await readdir(pasta)).toEqual([]);
  });

  it('URL assinada local aponta para a rota do app, com expiração e assinatura', async () => {
    const chave = gerarChave('pdf');
    const url = await armazenamento.urlAssinada(chave, 120);
    expect(url).toMatch(new RegExp(`^/api/arquivos/assinado/${chave.replace('.', '\\.')}\\?exp=\\d+&sig=[0-9a-f]{64}$`));
  });

  it('a pasta é criada só para o dono (0700)', async () => {
    const sub = path.join(pasta, 'novo');
    const outro = new ArmazenamentoLocal({ pasta: sub, segredoUrl: SEGREDO, prefixoUrl: '/p' });
    await outro.salvar(gerarChave('pdf'), Readable.from([Buffer.from('a')]), 'application/pdf');
    if (process.platform !== 'win32') expect((await stat(sub)).mode & 0o777).toBe(0o700);
  });
});
