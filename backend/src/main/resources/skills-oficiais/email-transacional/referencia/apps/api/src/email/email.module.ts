// origem: skills-modelo/apps/api/src/email/email.module.ts
import { Module } from '@nestjs/common';
import { type Config } from '../config/config';
import { CONFIG } from '../config/config.module';
import { ENVIADOR_EMAIL, type EnviadorEmail, EnviadorLog, EnviadorSmtp } from './enviador-email';
import { ServicoEmail } from './servico-email';

/**
 * Escolhe o enviador por `MAIL_MODE`. A configuração já garantiu que `smtp` tem servidor e remetente e recusou `log` e porta 25
 * sem TLS com `NODE_ENV=production`. Aqui a mesma regra FALHA FECHADA: só `development` ou `test` DECLARADOS
 * (`NODE_ENV_DECLARADO`) aceitam `log` ou porta 25 sem TLS; NODE_ENV ausente conta como produção e a aplicação não sobe.
 */
export function criarEnviador(config: Config): EnviadorEmail {
  const emDev = config.NODE_ENV_DECLARADO === 'development' || config.NODE_ENV_DECLARADO === 'test';
  if (config.MAIL_MODE === 'log') {
    if (!emDev) throw new Error('MAIL_MODE=log só com NODE_ENV=development ou test declarado (nenhum e-mail seria enviado); use MAIL_MODE=smtp');
    return new EnviadorLog();
  }
  if (!emDev && config.SMTP_PORT === 25 && !config.SMTP_SEGURO) {
    throw new Error('SMTP_PORT=25 sem TLS só com NODE_ENV=development ou test declarado; use 587 (STARTTLS) ou 465 com SMTP_SEGURO=true');
  }
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
