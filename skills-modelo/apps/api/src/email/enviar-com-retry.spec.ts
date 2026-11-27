import { describe, expect, it, vi } from 'vitest';
import { ErroEmailPermanente, type MensagemEmail } from './enviador-email';
import { enviarComRetry } from './enviar-com-retry';

const m: MensagemEmail = { para: 'ana@exemplo.com.br', assunto: 'Oi', html: '<p>oi</p>', texto: 'oi' };

describe('enviarComRetry', () => {
  it('sucesso na 1ª tentativa: envia uma vez, sem esperar', async () => {
    const dormir = vi.fn().mockResolvedValue(undefined);
    const enviar = vi.fn().mockResolvedValue(undefined);
    await enviarComRetry({ enviar }, m, { dormir });
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(dormir).not.toHaveBeenCalled();
  });

  it('falha duas vezes e entrega na 3ª, com espera crescente entre as tentativas', async () => {
    const dormir = vi.fn().mockResolvedValue(undefined);
    const enviar = vi.fn().mockRejectedValueOnce(new Error('a')).mockRejectedValueOnce(new Error('b')).mockResolvedValue(undefined);
    await enviarComRetry({ enviar }, m, { dormir, esperaInicialMs: 100 });
    expect(enviar).toHaveBeenCalledTimes(3);
    expect(dormir.mock.calls.map((c: unknown[]) => c[0] as number)).toEqual([100, 300]);
  });

  it('esgota 3 tentativas e lança o último erro', async () => {
    const dormir = vi.fn().mockResolvedValue(undefined);
    const enviar = vi.fn().mockRejectedValue(new Error('smtp fora'));
    await expect(enviarComRetry({ enviar }, m, { dormir })).rejects.toThrow('smtp fora');
    expect(enviar).toHaveBeenCalledTimes(3);
  });

  it('erro permanente (ErroEmailPermanente) não repete', async () => {
    const dormir = vi.fn().mockResolvedValue(undefined);
    const enviar = vi.fn().mockRejectedValue(new ErroEmailPermanente('endereço inválido'));
    await expect(enviarComRetry({ enviar }, m, { dormir })).rejects.toThrow('endereço inválido');
    expect(enviar).toHaveBeenCalledTimes(1);
  });
});
