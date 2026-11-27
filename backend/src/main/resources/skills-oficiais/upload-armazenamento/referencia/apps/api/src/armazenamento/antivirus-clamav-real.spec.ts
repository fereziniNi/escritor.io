// origem: skills-modelo/apps/api/src/armazenamento/antivirus-clamav-real.spec.ts
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { EICAR_TESTE } from '../../test/clamd-falso';
import { AntivirusClamav } from './antivirus';

/**
 * Contra um clamd de verdade (opcional: o clamd leva 1 a 3 minutos para carregar as assinaturas, por isso não roda no `pnpm test`).
 *   docker compose --profile antivirus up -d clamav     # espere o healthcheck ficar "healthy"
 *   CLAMAV_PORTA_TESTE=3310 pnpm --filter api exec vitest run antivirus-clamav-real
 * O restante da suíte usa um clamd falso que fala o mesmo protocolo (test/clamd-falso.ts).
 */
const porta = Number(process.env['CLAMAV_PORTA_TESTE']);

describe.skipIf(!Number.isInteger(porta) || porta <= 0)('AntivirusClamav contra o clamd real', () => {
  const av = new AntivirusClamav({ host: '127.0.0.1', porta, tempoLimiteMs: 120_000 });

  it('arquivo comum é limpo', async () => {
    expect(await av.verificar(Readable.from([Buffer.from('%PDF-1.7 conteudo inofensivo')]))).toEqual({ limpo: true });
  });

  // O EICAR só é reconhecido no começo do arquivo; a varredura independe do tipo (o tipo é conferido antes, por validarTipo).
  it('assinatura EICAR é detectada pelo nome da ameaça', async () => {
    const r = await av.verificar(Readable.from([Buffer.from(EICAR_TESTE)]));
    expect(r.limpo).toBe(false);
    expect(r.limpo ? '' : r.ameaca).toMatch(/Eicar/i);
  });

  it('arquivo grande, em várias partes, chega inteiro', async () => {
    const parte = Buffer.alloc(1024 * 1024, 0x61);
    expect(await av.verificar(Readable.from([parte, parte, parte, parte, parte]))).toEqual({ limpo: true });
  });
});
