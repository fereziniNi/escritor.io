// origem: skills-modelo/apps/api/src/email/servico-email.ts
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { NOME_EMAIL_ENVIAR } from '../fila/catalogo';
import { ErroSemRetry, Fila } from '../fila/fila';
import { ENVIADOR_EMAIL, ErroEmailPermanente, type EnviadorEmail, type MensagemEmail } from './enviador-email';
import { enviarComRetry } from './enviar-com-retry';

/** Porta de entrada do resto do sistema para mandar e-mail. Nunca injete o EnviadorEmail direto nas regras de negócio. */
@Injectable()
export class ServicoEmail implements OnModuleInit {
  private readonly logger = new Logger('Email');

  constructor(
    @Inject(ENVIADOR_EMAIL) private readonly enviador: EnviadorEmail,
    private readonly fila: Fila,
  ) {}

  /**
   * O envio de verdade acontece na fila: até 5 tentativas com espera crescente (5 s, 10 s, 20 s, 40 s), sobrevive a reinício
   * e, esgotadas as tentativas, avisa ALERTA_EMAIL. ErroEmailPermanente (endereço inválido, SMTP recusou com 5xx) não repete.
   */
  onModuleInit(): void {
    this.fila.registrarTarefa<MensagemEmail>(
      NOME_EMAIL_ENVIAR,
      async (m) => {
        try {
          await this.enviador.enviar(m);
        } catch (e) {
          if (e instanceof ErroEmailPermanente) throw new ErroSemRetry(e.message);
          throw e;
        }
      },
      { tentativas: 5, backoff: true },
    );
  }

  /** Envia agora, com retry curto, e espera o resultado (até ~30 s no pior caso). Lança se esgotar as tentativas. Use em rotinas, não em requisições. */
  enviar(m: MensagemEmail): Promise<void> {
    return enviarComRetry(this.enviador, m);
  }

  /**
   * Dentro de uma requisição HTTP: grava o e-mail na fila (milissegundos) e devolve; quem envia, repete e alerta é a fila.
   * Não lança nunca. `chave` (opcional) evita envio duplicado se a mesma ação for repetida: mesma chave = no máximo um envio.
   * Se nem a fila aceitar (banco fora do ar), cai para o envio em segundo plano com retry curto, só com log da falha.
   */
  disparar(m: MensagemEmail, opcoes: { chave?: string } = {}): void {
    this.fila.enviar(NOME_EMAIL_ENVIAR, m, opcoes).catch((e: unknown) => {
      this.logger.error(`fila indisponível (${(e as Error).message}); enviando em segundo plano sem a fila`);
      this.enviar(m).catch((e2: unknown) => {
        this.logger.error(`e-mail não entregue depois das tentativas: ${(e2 as Error).message}`);
      });
    });
  }
}
