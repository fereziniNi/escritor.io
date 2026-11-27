// origem: skills-modelo/apps/api/src/armazenamento/armazenamento-s3.spec.ts
import { Readable } from 'node:stream';
import { MinioContainer, type StartedMinioContainer } from '@testcontainers/minio';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ArmazenamentoS3 } from './armazenamento-s3';
import { gerarChave } from './chave';
import { LimiteExcedido, limitarTamanho } from './limitar-tamanho';

/** MinIO fixado por digest (nunca `latest`): troque o digest conscientemente, rodando este teste. */
const IMAGEM_MINIO = 'cgr.dev/chainguard/minio@sha256:ae73835075ee168f1745cc28d4cf5bbd6a5973e5609b2b2593280aaa495ea113';
const BUCKET = 'arquivos-teste';

let minio: StartedMinioContainer;
let s3: ArmazenamentoS3;

const ler = async (s: Readable): Promise<Buffer> => {
  const partes: Buffer[] = [];
  for await (const p of s) partes.push(p as Buffer);
  return Buffer.concat(partes);
};

beforeAll(async () => {
  minio = await new MinioContainer(IMAGEM_MINIO).start();
  s3 = new ArmazenamentoS3({
    endpoint: minio.getConnectionUrl(),
    regiao: 'us-east-1',
    bucket: BUCKET,
    accessKeyId: minio.getUsername(),
    secretAccessKey: minio.getPassword(),
    forcePathStyle: true,
  });
  await s3.criarBucketSeNaoExistir();
}, 180_000);

afterAll(async () => {
  await minio?.stop();
});

describe('ArmazenamentoS3 (MinIO em container)', () => {
  it('salva, abre e remove (stream grande o bastante para virar multipart)', async () => {
    const chave = gerarChave('pdf');
    const grande = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(11 * 1024 * 1024, 0x61)]);
    await s3.salvar(chave, Readable.from([grande.subarray(0, 6_000_000), grande.subarray(6_000_000)]), 'application/pdf');
    const volta = await ler(await s3.abrir(chave));
    expect(volta.equals(grande)).toBe(true);
    await s3.remover(chave);
    await expect(s3.abrir(chave)).rejects.toThrow();
    await s3.remover(chave); // idempotente
  }, 60_000);

  it('rejeita chave que não é do servidor (nunca vira caminho no bucket)', async () => {
    await expect(s3.salvar('../../x.pdf', Readable.from([Buffer.from('a')]), 'application/pdf')).rejects.toThrow(/chave/i);
    await expect(s3.abrir('pasta/x.pdf')).rejects.toThrow(/chave/i);
  });

  it('fluxo que estoura o limite no meio não deixa objeto', async () => {
    const chave = gerarChave('png');
    const estourado = limitarTamanho(Readable.from([Buffer.alloc(10), Buffer.alloc(10)]), 15);
    await expect(s3.salvar(chave, estourado, 'image/png')).rejects.toBeInstanceOf(LimiteExcedido);
    await expect(s3.abrir(chave)).rejects.toThrow();
  });

  it('URL assinada baixa o objeto como anexo e expira', async () => {
    const chave = gerarChave('pdf');
    await s3.salvar(chave, Readable.from([Buffer.from('%PDF-1.7 ola')]), 'application/pdf');
    const url = await s3.urlAssinada(chave, 2, { nomeDownload: 'Relatório "março".pdf', tipo: 'application/pdf' });
    expect(url).toMatch(/X-Amz-Expires=2/);
    const ok = await fetch(url);
    expect(ok.status).toBe(200);
    expect(await ok.text()).toBe('%PDF-1.7 ola');
    expect(ok.headers.get('content-disposition')).toMatch(/^attachment;/);
    expect(ok.headers.get('content-disposition')).toContain("filename*=UTF-8''Relat%C3%B3rio");
    await new Promise((r) => setTimeout(r, 3500));
    expect((await fetch(url)).status).toBe(403);
    await s3.remover(chave);
  }, 30_000);
});
