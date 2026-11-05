import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, count, desc, eq, gt, lt, or, sql } from 'drizzle-orm';
import { BANCO, type Db } from '../banco/banco';
import { codigoLogin, sessao, usuario } from '../banco/esquema';
import { type Config } from '../config/config';
import { CONFIG } from '../config/config.module';
import { escaparHtml, montarEmail } from '../email/modelo-email';
import { ServicoEmail } from '../email/servico-email';
import { type UsuarioAtual } from '../usuarios/usuario-atual';
import { gerarCodigo, hashToken, hmacCodigo, hmacIguais, novoToken } from './cripto-auth';
import {
  INTERVALO_TOQUE_SESSAO_S,
  JANELA_PEDIDOS_MIN,
  MAX_PEDIDOS_POR_EMAIL,
  MAX_TENTATIVAS_POR_CODIGO,
  VALIDADE_CODIGO_MIN,
  dominioPermitido,
  segredoDoCodigo,
} from './regras-auth';
import { type EventoAuth, REGISTRO_EVENTOS, type RegistroEventos } from './registro-eventos';

/** Assunto fixo: nunca o código, nome ou dado pessoal no assunto (aparece em log e em notificação do celular). */
export const ASSUNTO_CODIGO = 'Seu código de acesso';

type Consulta = Pick<Db, 'select'>;

/**
 * Login por código no e-mail e sessão em cookie. Quem chama (AuthController) garante o tempo mínimo de resposta e a
 * resposta idêntica; aqui ficam as regras: domínio, usuário ativo, limite por e-mail com trava no banco, HMAC,
 * tentativas, sessão com hash, validade ociosa e absoluta, papel relido do banco a cada requisição.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger('Auth');
  private readonly segredo: string;

  constructor(
    @Inject(BANCO) private readonly db: Db,
    @Inject(CONFIG) private readonly config: Config,
    private readonly email: ServicoEmail,
    @Inject(REGISTRO_EVENTOS) private readonly eventos: RegistroEventos,
  ) {
    // Em produção sem AUTH_SEGREDO_CODIGO lança aqui: a API não sobe.
    this.segredo = segredoDoCodigo(config);
  }

  /**
   * Pede um código para `email` (já normalizado). Não devolve nada de propósito: fora do domínio, inexistente,
   * desativado, limite estourado e sucesso são iguais para quem chamou. Só envia se o usuário existe, está ativo e
   * pediu menos de 3 códigos nos últimos 10 minutos (contagem e gravação sob trava do e-mail: pedidos simultâneos
   * não furam o limite). Um código novo invalida os anteriores.
   */
  async pedirCodigo(email: string, ip: string | undefined): Promise<void> {
    if (!dominioPermitido(email, this.config.AUTH_DOMINIOS_PERMITIDOS)) return;
    const dono = await this.usuarioAtivoPorEmail(this.db, email);
    if (!dono) return;
    const codigo = gerarCodigo();
    const criado = await this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${email}))`);
      await tx.delete(codigoLogin).where(and(eq(codigoLogin.email, email), lt(codigoLogin.criadoEm, sql`now() - interval '1 day'`)));
      const [recentes] = await tx
        .select({ total: count() })
        .from(codigoLogin)
        .where(and(eq(codigoLogin.email, email), gt(codigoLogin.criadoEm, sql`now() - make_interval(mins => ${JANELA_PEDIDOS_MIN})`)));
      if ((recentes?.total ?? 0) >= MAX_PEDIDOS_POR_EMAIL) return false;
      await tx
        .update(codigoLogin)
        .set({ expiraEm: sql`now()` })
        .where(and(eq(codigoLogin.email, email), eq(codigoLogin.usado, false), gt(codigoLogin.expiraEm, sql`now()`)));
      await tx.insert(codigoLogin).values({
        email,
        hmac: hmacCodigo(this.segredo, email, codigo),
        expiraEm: sql`now() + make_interval(mins => ${VALIDADE_CODIGO_MIN})`,
      });
      return true;
    });
    if (!criado) {
      await this.registrar({ acao: 'auth.limite_codigo', usuarioId: dono.id, email, ip });
      return;
    }
    this.enviarCodigo(email, codigo);
  }

  /**
   * Confere o código e abre a sessão. Devolve o token (vai só para o cookie) ou null em QUALQUER falha, sem dizer
   * qual. A tentativa é contada ANTES de comparar (`tentativas < 5` na própria atualização): a 6ª falha mesmo com o
   * código certo. Comparação em tempo constante.
   */
  async entrar(email: string, codigo: string, ip: string | undefined): Promise<string | null> {
    const r = await this.db.transaction(async (tx) => {
      if (!dominioPermitido(email, this.config.AUTH_DOMINIOS_PERMITIDOS)) return { tipo: 'falha' as const };
      const [pendente] = await tx
        .select({ id: codigoLogin.id, hmac: codigoLogin.hmac })
        .from(codigoLogin)
        .where(and(eq(codigoLogin.email, email), eq(codigoLogin.usado, false), gt(codigoLogin.expiraEm, sql`now()`)))
        .orderBy(desc(codigoLogin.criadoEm))
        .limit(1)
        .for('update');
      if (!pendente) return { tipo: 'falha' as const };
      const [contada] = await tx
        .update(codigoLogin)
        .set({ tentativas: sql`${codigoLogin.tentativas} + 1` })
        .where(and(eq(codigoLogin.id, pendente.id), lt(codigoLogin.tentativas, MAX_TENTATIVAS_POR_CODIGO)))
        .returning({ tentativas: codigoLogin.tentativas });
      if (!contada) return { tipo: 'bloqueado' as const };
      if (!hmacIguais(pendente.hmac, hmacCodigo(this.segredo, email, codigo))) {
        return { tipo: contada.tentativas >= MAX_TENTATIVAS_POR_CODIGO ? ('bloqueado' as const) : ('falha' as const) };
      }
      await tx.update(codigoLogin).set({ usado: true }).where(eq(codigoLogin.id, pendente.id));
      const dono = await this.usuarioAtivoPorEmail(tx, email);
      if (!dono) return { tipo: 'falha' as const };
      // Limpeza: sessões revogadas ou vencidas deste usuário não servem para nada.
      await tx
        .delete(sessao)
        .where(
          and(
            eq(sessao.usuarioId, dono.id),
            or(eq(sessao.revogada, true), lt(sessao.criadaEm, sql`now() - make_interval(hours => ${this.config.AUTH_SESSAO_ABSOLUTA_H})`)),
          ),
        );
      const token = novoToken();
      await tx.insert(sessao).values({ hashToken: hashToken(token), usuarioId: dono.id });
      return { tipo: 'ok' as const, token, usuarioId: dono.id };
    });
    if (r.tipo === 'ok') {
      await this.registrar({ acao: 'auth.login', usuarioId: r.usuarioId, email, ip });
      return r.token;
    }
    await this.registrar({ acao: r.tipo === 'bloqueado' ? 'auth.codigo_bloqueado' : 'auth.falha_login', email, ip });
    return null;
  }

  /** Revoga a sessão do token (se houver uma ativa) e registra o logout. */
  async sair(token: string | undefined, ip: string | undefined): Promise<void> {
    if (token === undefined || token.length > 128) return;
    const [revogada] = await this.db
      .update(sessao)
      .set({ revogada: true })
      .where(and(eq(sessao.hashToken, hashToken(token)), eq(sessao.revogada, false)))
      .returning({ usuarioId: sessao.usuarioId });
    if (revogada) await this.registrar({ acao: 'auth.logout', usuarioId: revogada.usuarioId, ip });
  }

  /**
   * Usuário dono da sessão, lido da tabela `usuario` NESTA requisição (papel atual; desativado = sem sessão), ou null se
   * a sessão não existe, foi revogada, ficou parada mais que AUTH_SESSAO_OCIOSA_MIN ou passou de AUTH_SESSAO_ABSOLUTA_H.
   * O último uso é regravado no máximo uma vez por minuto.
   */
  async usuarioDaSessao(token: string): Promise<UsuarioAtual | null> {
    if (token.length > 128) return null;
    const [linha] = await this.db
      .select({
        sessaoId: sessao.id,
        id: usuario.id,
        email: usuario.email,
        nome: usuario.nome,
        papel: usuario.papel,
        tocar: sql<boolean>`${sessao.ultimoUsoEm} < now() - make_interval(secs => ${INTERVALO_TOQUE_SESSAO_S})`,
      })
      .from(sessao)
      .innerJoin(usuario, eq(usuario.id, sessao.usuarioId))
      .where(
        and(
          eq(sessao.hashToken, hashToken(token)),
          eq(sessao.revogada, false),
          eq(usuario.ativo, true),
          gt(sessao.criadaEm, sql`now() - make_interval(hours => ${this.config.AUTH_SESSAO_ABSOLUTA_H})`),
          gt(sessao.ultimoUsoEm, sql`now() - make_interval(mins => ${this.config.AUTH_SESSAO_OCIOSA_MIN})`),
        ),
      );
    if (!linha) return null;
    if (linha.tocar) await this.db.update(sessao).set({ ultimoUsoEm: sql`now()` }).where(eq(sessao.id, linha.sessaoId));
    return { id: linha.id, email: linha.email, nome: linha.nome, papel: linha.papel };
  }

  /** Usuário ativo com este e-mail (comparação em minúsculas, usa o índice único de `lower(email)`). */
  private async usuarioAtivoPorEmail(q: Consulta, email: string): Promise<UsuarioAtual | null> {
    const [u] = await q
      .select({ id: usuario.id, email: usuario.email, nome: usuario.nome, papel: usuario.papel })
      .from(usuario)
      .where(and(sql`lower(${usuario.email}) = ${email}`, eq(usuario.ativo, true)));
    return u ?? null;
  }

  /** Manda o código pela skill email-transacional, sem esperar o SMTP (o tempo da resposta não depende do envio). */
  private enviarCodigo(email: string, codigo: string): void {
    const nome = this.config.NOME_SISTEMA;
    const { html, texto } = montarEmail(
      ASSUNTO_CODIGO,
      `<p>Use este código para entrar no <strong>${escaparHtml(nome)}</strong>:</p>` +
        `<p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:16px 0;">${codigo}</p>` +
        `<p>Ele vale por ${VALIDADE_CODIGO_MIN} minutos e só pode ser usado uma vez. Se você não pediu, ignore este e-mail: ` +
        `ninguém entra sem o código.</p>`,
      { nomeSistema: nome },
    );
    this.email.disparar({ para: email, assunto: ASSUNTO_CODIGO, html, texto });
  }

  /** Auditoria nunca derruba o login: falha ao registrar vai só para o log. */
  private async registrar(evento: EventoAuth): Promise<void> {
    try {
      await this.eventos.registrarEvento(evento);
    } catch (e) {
      this.logger.error(`falha ao registrar ${evento.acao}: ${(e as Error).message}`);
    }
  }
}
