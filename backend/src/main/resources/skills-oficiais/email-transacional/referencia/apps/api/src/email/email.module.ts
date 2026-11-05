// origem: skills-modelo/apps/api/src/email/email.module.ts
import { Module } from '@nestjs/common';
import { type Config } from '../config/config';
import { CONFIG } from '../config/config.module';
import { ENVIADOR_EMAIL, type EnviadorEmail, EnviadorLog, EnviadorSmtp } from './enviador-email';
import { ServicoEmail } from './servico-email';

/** Escolhe o enviador por `MAIL_MODE`. A configuração já garantiu que `smtp` tem servidor e remetente e que `log` não roda em produção. */
export function criarEnviador(config: Config): EnviadorEmail {
  if (config.MAIL_MODE === 'log') return new EnviadorLog();
  if (config.SMTP_HOST === undefined || config.EMAIL_REMETENTE === undefined) {
    throw new Error('MAIL_MODE=smtp sem SMTP_HOST ou EMAIL_REMETENTE');
  }
  return new EnviadorSmtp({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    seguro: config.SMTP_SEGURO,
    remetente: config.EMAIL_REMETENTE,
    usuario: config.SMTP_USUARIO,
    senha: config.SMTP_SENHA,
  });
}

@Module({
  providers: [{ provide: ENVIADOR_EMAIL, inject: [CONFIG], useFactory: criarEnviador }, ServicoEmail],
  exports: [ENVIADOR_EMAIL, ServicoEmail],
})
export class EmailModule {}
