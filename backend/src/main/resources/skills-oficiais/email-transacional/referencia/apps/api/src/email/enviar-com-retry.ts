// origem: skills-modelo/estagios/email-transacional/apps/api/src/email/enviar-com-retry.ts
import { type EnviadorEmail, ErroEmailPermanente, type MensagemEmail } from './enviador-email';

export interface OpcoesRetry {
  /** Total de tentativas, a 1ª incluída. */
  tentativas?: number;
  /** Espera antes da 2ª tentativa; cresce ×3 a cada nova (500 ms, 1,5 s). */
  esperaInicialMs?: number;
  /** Troque nos testes para não esperar de verdade. */
  dormir?: (ms: number) => Promise<void>;
}

const dormirDeVerdade = (ms: number) =>
  new Promise<void>((resolve) => {
    // unref: uma espera pendente não impede o processo de encerrar.
    setTimeout(resolve, ms).unref();
  });

/**
 * Envia com até 3 tentativas e espera crescente. O tempo total é limitado (prazos do SMTP somados às esperas), mas ainda
 * assim é lento para uma requisição HTTP: no meio de uma requisição use `ServicoEmail.disparar`. ErroEmailPermanente
 * (endereço inválido, SMTP recusou com 5xx) não repete. Quando a skill `fila-de-tarefas` é aplicada, este retry sai e
 * quem repete é a fila.
 */
export async function enviarComRetry(enviador: EnviadorEmail, m: MensagemEmail, opcoes: OpcoesRetry = {}): Promise<void> {
  const { tentativas = 3, esperaInicialMs = 500, dormir = dormirDeVerdade } = opcoes;
  let espera = esperaInicialMs;
  for (let tentativa = 1; ; tentativa++) {
    try {
      await enviador.enviar(m);
      return;
    } catch (e) {
      if (e instanceof ErroEmailPermanente || tentativa >= tentativas) throw e;
      await dormir(espera);
      espera *= 3;
    }
  }
}
