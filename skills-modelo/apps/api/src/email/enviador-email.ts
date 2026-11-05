import { Logger } from '@nestjs/common';
import { createTransport } from 'nodemailer';
import { type Segredo } from '../config/segredo';

export interface MensagemEmail {
  /** Um único endereço (`ana@exemplo.com.br`), sem nome nem lista. */
  para: string;
  /** Sem quebra de linha. Nunca ponha código, link ou dado pessoal no assunto (aparece em logs e notificações). */
  assunto: string;
  html: string;
  /** Versão só texto da mesma mensagem (`montarEmail` gera as duas). */
  texto: string;
}

export interface EnviadorEmail {
  enviar(m: MensagemEmail): Promise<void>;
}

/** Token de injeção do enviador escolhido por `MAIL_MODE` (`@Inject(ENVIADOR_EMAIL) enviador: EnviadorEmail`). */
export const ENVIADOR_EMAIL = Symbol('ENVIADOR_EMAIL');

/** Falha que repetir não resolve (endereço inválido, SMTP recusou com 5xx): `enviarComRetry` desiste na hora. */
export class ErroEmailPermanente extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ErroEmailPermanente';
  }
}

const ENDERECO_NO_TEXTO = /[^\s@<>,;:"'()]+@[^\s@<>,;:"'()]+/g;

/** `ana.silva@exemplo.com.br` -> `a***@exemplo.com.br`. É o único formato de endereço permitido em log e em erro. */
export function mascararEmail(email: string): string {
  const arroba = email.lastIndexOf('@');
  if (arroba < 1) return '***';
  return `${email[0]}***${email.slice(arroba)}`;
}

/** Mascara todo endereço que aparecer num texto livre (mensagens de erro do servidor SMTP repetem o destinatário). */
const mascararEnderecosEm = (texto: string) => texto.replace(ENDERECO_NO_TEXTO, mascararEmail);

const ENDERECO_UNICO = /^[^\s@<>,;\r\n]+@[^\s@<>,;\r\n]+$/;

function validar(m: MensagemEmail): void {
  if (!ENDERECO_UNICO.test(m.para)) throw new ErroEmailPermanente('destinatário inválido: use um único endereço');
  if (/[\r\n]/.test(m.assunto)) throw new ErroEmailPermanente('assunto não pode ter quebra de linha');
}

/** O que o EnviadorSmtp usa do nodemailer; o teste troca por um transporte de teste. */
export interface Transporte {
  sendMail(mensagem: { from: string; to: string; subject: string; html: string; text: string }): Promise<unknown>;
}

export interface OpcoesSmtp {
  host: string;
  port: number;
  /** true = TLS direto (465). false = STARTTLS; com usuário, o TLS passa a ser obrigatório (a senha nunca vai em claro). */
  seguro: boolean;
  /** `Sistema <nao-responda@exemplo.com.br>` */
  remetente: string;
  usuario?: string;
  senha?: Segredo;
}

/** Envio real por SMTP (nodemailer). Prazos curtos: um SMTP lento não pode segurar quem chamou por muito tempo. */
export class EnviadorSmtp implements EnviadorEmail {
  private readonly transporte: Transporte;

  constructor(
    private readonly opcoes: OpcoesSmtp,
    transporte?: Transporte,
  ) {
    this.transporte =
      transporte ??
      createTransport({
        host: opcoes.host,
        port: opcoes.port,
        secure: opcoes.seguro,
        requireTLS: !opcoes.seguro && opcoes.usuario !== undefined,
        auth: opcoes.usuario !== undefined && opcoes.senha !== undefined ? { user: opcoes.usuario, pass: opcoes.senha.revelar() } : undefined,
        connectionTimeout: 5_000,
        greetingTimeout: 5_000,
        socketTimeout: 10_000,
      });
  }

  async enviar(m: MensagemEmail): Promise<void> {
    validar(m);
    try {
      await this.transporte.sendMail({ from: this.opcoes.remetente, to: m.para, subject: m.assunto, html: m.html, text: m.texto });
    } catch (e) {
      const erro = e as { message?: string; responseCode?: number };
      const texto = `falha ao enviar e-mail para ${mascararEmail(m.para)}: ${mascararEnderecosEm(erro.message ?? 'erro desconhecido')}`;
      const definitivo = typeof erro.responseCode === 'number' && erro.responseCode >= 500 && erro.responseCode < 600;
      // Sem `cause`: o erro original carrega o endereço completo e o comando SMTP.
      throw definitivo ? new ErroEmailPermanente(texto) : new Error(texto);
    }
  }
}

/** Só desenvolvimento e testes (`MAIL_MODE=log`; a configuração recusa em produção). Não envia: registra o destino mascarado. */
export class EnviadorLog implements EnviadorEmail {
  private readonly logger = new Logger('Email');

  enviar(m: MensagemEmail): Promise<void> {
    this.logger.log(`MAIL_MODE=log, e-mail NÃO enviado: para=${mascararEmail(m.para)} assunto="${m.assunto}" texto=${m.texto.length} caracteres`);
    return Promise.resolve();
  }
}
