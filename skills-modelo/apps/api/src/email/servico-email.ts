import { Inject, Injectable, Logger } from '@nestjs/common';
import { ENVIADOR_EMAIL, type EnviadorEmail, type MensagemEmail } from './enviador-email';
import { enviarComRetry } from './enviar-com-retry';

/** Porta de entrada do resto do sistema para mandar e-mail. Nunca injete o EnviadorEmail direto nas regras de negócio. */
@Injectable()
export class ServicoEmail {
  private readonly logger = new Logger('Email');

  constructor(@Inject(ENVIADOR_EMAIL) private readonly enviador: EnviadorEmail) {}

  /** Envia com retry e espera o resultado (até ~30 s no pior caso). Lança se esgotar as tentativas. Use em rotinas, não em requisições. */
  enviar(m: MensagemEmail): Promise<void> {
    return enviarComRetry(this.enviador, m);
  }

  /**
   * Dentro de uma requisição HTTP: devolve na hora, envia em segundo plano com retry e só registra a falha no log
   * (endereço mascarado, sem corpo). Não lança nunca. A resposta ao usuário não pode depender do SMTP.
   */
  disparar(m: MensagemEmail): void {
    this.enviar(m).catch((e: unknown) => {
      this.logger.error(`e-mail não entregue depois das tentativas: ${(e as Error).message}`);
    });
  }
}
