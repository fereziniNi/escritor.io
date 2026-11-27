// origem: skills-modelo/apps/api/src/armazenamento/antivirus.spec.ts
import { Readable } from 'node:stream';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EICAR_TESTE, type ClamdFalso, subirClamdFalso } from '../../test/clamd-falso';
import { AntivirusClamav, ErroAntivirus } from './antivirus';

let clamd: ClamdFalso;
beforeAll(async () => {
  clamd = await subirClamdFalso();
});
afterAll(async () => {
  await clamd.parar();
});

const fluxo = (...partes: string[]) => Readable.from(partes.map((p) => Buffer.from(p)));

describe('AntivirusClamav (protocolo INSTREAM)', () => {
  it('arquivo limpo → "limpo"; várias partes chegam inteiras', async () => {
    clamd.modo('normal');
    const av = new AntivirusClamav({ host: '127.0.0.1', porta: clamd.porta });
    expect(await av.verificar(fluxo('abc', 'def'.repeat(50_000)))).toEqual({ limpo: true });
  });

  it('assinatura EICAR → infectado, com o nome da ameaça', async () => {
    clamd.modo('normal');
    const av = new AntivirusClamav({ host: '127.0.0.1', porta: clamd.porta });
    expect(await av.verificar(fluxo('inicio ', EICAR_TESTE))).toEqual({ limpo: false, ameaca: 'Eicar-Test-Signature' });
  });

  it('falha fechada: clamd fora do ar, resposta ERROR e silêncio viram ErroAntivirus (nunca "limpo")', async () => {
    const fora = new AntivirusClamav({ host: '127.0.0.1', porta: 1 });
    await expect(fora.verificar(fluxo('x'))).rejects.toBeInstanceOf(ErroAntivirus);

    clamd.modo('erro');
    const comErro = new AntivirusClamav({ host: '127.0.0.1', porta: clamd.porta });
    await expect(comErro.verificar(fluxo('x'))).rejects.toBeInstanceOf(ErroAntivirus);

    clamd.modo('mudo');
    const mudo = new AntivirusClamav({ host: '127.0.0.1', porta: clamd.porta, tempoLimiteMs: 300 });
    await expect(mudo.verificar(fluxo('x'))).rejects.toThrow(/tempo/i);
  });
});
