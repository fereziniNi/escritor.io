// origem: skills-modelo/apps/api/src/fila/alerta-falha.ts
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { type Config } from '../config/config';
import { CONFIG } from '../config/config.module';
import { escaparHtml, montarEmail } from '../email/modelo-email';
import { ServicoEmail } from '../email/servico-email';
import { Fila, type FalhaDefinitiva } from './fila';

const ASSUNTO = 'Falha definitiva em tarefa da fila';

/**
 * Avisa ALERTA_EMAIL quando uma tarefa esgota as tentativas. O e-mail leva só o nome da tarefa, o id, as tentativas e o tipo
 * do erro: nunca o payload (dado pessoal) nem a mensagem do erro. Vai direto por `ServicoEmail.enviar` (com retry), NUNCA
 * pela fila: se a tarefa que falhou for a de e-mail, o alerta não pode depender dela.
 */
@Injectable()
export class AlertaFalhaPorEmail implements OnModuleInit {
  private readonly logger = new Logger('FilaAlerta');

  constructor(
    private readonly fila: Fila,
    private readonly email: ServicoEmail,
    @Inject(CONFIG) private readonly config: Config,
  ) {}

  onModuleInit(): void {
    this.fila.definirAlerta((falha) => this.avisar(falha));
  }

  async avisar(falha: FalhaDefinitiva): Promise<void> {
    const destino = this.config.ALERTA_EMAIL;
    if (destino === undefined) {
      this.logger.error(`tarefa '${falha.tarefa}' (${falha.jobId}) falhou de vez e ALERTA_EMAIL não está definida`);
      return;
    }
    const linhas = [
      ['Sistema', this.config.NOME_SISTEMA],
      ['Tarefa', falha.tarefa],
      ['Id do job', falha.jobId],
      ['Tentativas', String(falha.tentativas)],
      ['Tipo do erro', falha.tipoErro],
    ] as const;
    const corpo = `<p>Uma tarefa esgotou as tentativas e não será repetida sozinha.</p><ul>${linhas
      .map(([k, v]) => `<li><strong>${escaparHtml(k)}:</strong> ${escaparHtml(v)}</li>`)
      .join('')}</ul><p>A mensagem do erro está no log do worker (procure pelo id do job).</p>`;
    const { html, texto } = montarEmail(ASSUNTO, corpo);
    await this.email.enviar({ para: destino, assunto: ASSUNTO, html, texto });
  }
}
