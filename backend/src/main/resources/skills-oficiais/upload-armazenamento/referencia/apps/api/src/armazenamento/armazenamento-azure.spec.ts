// origem: skills-modelo/apps/api/src/armazenamento/armazenamento-azure.spec.ts
import { Readable } from 'node:stream';
import { AzuriteContainer, type StartedAzuriteContainer } from '@testcontainers/azurite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ArmazenamentoAzure } from './armazenamento-azure';
import { gerarChave } from './chave';
import { LimiteExcedido, limitarTamanho } from './limitar-tamanho';

/** Emulador oficial do Azure Blob (Azurite), versão fixada. O SDK pede uma versão de API mais nova que a do Azurite: por isso `--skipApiVersionCheck`. */
const IMAGEM_AZURITE = 'mcr.microsoft.com/azure-storage/azurite:3.34.0';

let azurite: StartedAzuriteContainer;
let azure: ArmazenamentoAzure;

const ler = async (s: Readable): Promise<Buffer> => {
  const partes: Buffer[] = [];
  for await (const p of s) partes.push(p as Buffer);
  return Buffer.concat(partes);
};

beforeAll(async () => {
  azurite = await new AzuriteContainer(IMAGEM_AZURITE).withInMemoryPersistence().withSkipApiVersionCheck().start();
  azure = new ArmazenamentoAzure({ connectionString: azurite.getConnectionString(), container: 'arquivos-teste' });
  await azure.criarContainerSeNaoExistir();
}, 180_000);

afterAll(async () => {
  await azurite?.stop();
});

describe('ArmazenamentoAzure (Azurite em container)', () => {
  it('salva, abre e remove', async () => {
    const chave = gerarChave('pdf');
    const conteudo = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(5 * 1024 * 1024, 0x62)]);
    await azure.salvar(chave, Readable.from([conteudo.subarray(0, 3_000_000), conteudo.subarray(3_000_000)]), 'application/pdf');
    expect((await ler(await azure.abrir(chave))).equals(conteudo)).toBe(true);
    await azure.remover(chave);
    await expect(azure.abrir(chave)).rejects.toThrow();
    await azure.remover(chave);
  }, 60_000);

  it('rejeita chave que não é do servidor', async () => {
    await expect(azure.salvar('../../x.pdf', Readable.from([Buffer.from('a')]), 'application/pdf')).rejects.toThrow(/chave/i);
  });

  it('fluxo que estoura o limite no meio não deixa blob', async () => {
    const chave = gerarChave('png');
    const estourado = limitarTamanho(Readable.from([Buffer.alloc(10), Buffer.alloc(10)]), 15);
    await expect(azure.salvar(chave, estourado, 'image/png')).rejects.toBeInstanceOf(LimiteExcedido);
    await expect(azure.abrir(chave)).rejects.toThrow();
  });

  it('URL assinada (SAS) baixa como anexo', async () => {
    const chave = gerarChave('pdf');
    await azure.salvar(chave, Readable.from([Buffer.from('%PDF-1.7 ola')]), 'application/pdf');
    const url = await azure.urlAssinada(chave, 60, { nomeDownload: 'Relatório.pdf', tipo: 'application/pdf' });
    const res = await fetch(url);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('%PDF-1.7 ola');
    expect(res.headers.get('content-disposition')).toMatch(/^attachment;/);
    await azure.remover(chave);
  });
});
