// origem: skills-modelo/apps/api/src/usuarios/usuarios.service.ts
import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { mascararEmail } from '../auditoria/sanitizar';
import { BANCO, type Db } from '../banco/banco';
import { usuario } from '../banco/esquema';
import { type Config } from '../config/config';
import { CONFIG } from '../config/config.module';
import { escaparHtml, montarEmail } from '../email/modelo-email';
import { ServicoEmail } from '../email/servico-email';
import { type Papel } from './papel';
import { exigirPapel, type UsuarioAtual } from './usuario-atual';

/** O que a API devolve de um usuário. Nada além disto sai daqui (sem campos internos). */
export interface UsuarioPublico {
  id: string;
  email: string;
  nome: string;
  papel: Papel;
  ativo: boolean;
  criadoEm: string;
}

export interface DadosConvite {
  email: string;
  nome: string;
  papel: Papel;
}

type Linha = typeof usuario.$inferSelect;

const publico = (l: Linha): UsuarioPublico => ({
  id: l.id,
  email: l.email,
  nome: l.nome,
  papel: l.papel,
  ativo: l.ativo,
  criadoEm: l.criadoEm.toISOString(),
});

/** E-mail como é guardado e comparado: sem espaços nas pontas e em minúsculas. */
export const normalizarEmail = (email: string): string => email.trim().toLowerCase();

/** Violação de índice único do Postgres (23505); o Drizzle pode embrulhar o erro do driver em `cause`. */
const violouUnicidade = (e: unknown): boolean => {
  const erro = e as { code?: string; cause?: { code?: string } };
  return erro.code === '23505' || erro.cause?.code === '23505';
};

@Injectable()
export class UsuariosService {
  constructor(
    @Inject(BANCO) private readonly db: Db,
    @Inject(CONFIG) private readonly config: Config,
    private readonly email: ServicoEmail,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** Todos os usuários, ativos e desativados. Só ADMIN (checado aqui e também no @Papeis da rota). */
  async listar(ator: UsuarioAtual): Promise<UsuarioPublico[]> {
    exigirPapel(ator, 'ADMIN');
    const linhas = await this.db.select().from(usuario).orderBy(asc(usuario.criadoEm), asc(usuario.id));
    return linhas.map(publico);
  }

  /**
   * Perfil de UM usuário, com checagem de escopo: ADMIN vê qualquer um; GESTOR e USUARIO só o próprio.
   * Este é o padrão para qualquer dado "de alguém": o @Papeis da rota diz QUEM PODE CHAMAR, esta checagem diz
   * DE QUEM O DADO PODE SER LIDO. Sem ela, qualquer logado leria o dado de qualquer id (SEC-001/VULN-02).
   */
  async perfil(ator: UsuarioAtual, id: string): Promise<UsuarioPublico> {
    exigirPapel(ator, 'ADMIN', 'GESTOR', 'USUARIO');
    if (ator.papel !== 'ADMIN' && ator.id !== id) throw new ForbiddenException();
    const [linha] = await this.db.select().from(usuario).where(eq(usuario.id, id));
    if (!linha) throw new NotFoundException();
    return publico(linha);
  }

  /** Cria o usuário já ativo e avisa por e-mail. O acesso em si é da skill de login (entra com o e-mail). */
  async convidar(ator: UsuarioAtual, dados: DadosConvite): Promise<UsuarioPublico> {
    exigirPapel(ator, 'ADMIN');
    const email = normalizarEmail(dados.email);
    const nome = dados.nome.trim();
    let criada: Linha | undefined;
    try {
      // O usuário e o evento de auditoria nascem na mesma transação: sem trilha, não há convite.
      criada = await this.db.transaction(async (tx) => {
        const [nova] = await tx.insert(usuario).values({ email, nome, papel: dados.papel, ativo: true }).returning();
        await this.auditoria.registrar(
          // Nome nunca vai para a trilha; e-mail só mascarado.
          { acao: 'usuario.convidar', atorId: ator.id, alvoTipo: 'usuario', alvoId: nova!.id, depois: { email: mascararEmail(email), papel: nova!.papel, ativo: nova!.ativo } },
          tx,
        );
        return nova;
      });
    } catch (e) {
      if (violouUnicidade(e)) throw new ConflictException('Já existe um usuário com este e-mail (se estiver desativado, reative-o)');
      throw e;
    }
    this.avisarConvite(criada!);
    return publico(criada!);
  }

  async alterarPapel(ator: UsuarioAtual, id: string, papel: Papel): Promise<UsuarioPublico> {
    exigirPapel(ator, 'ADMIN');
    return this.mudar(ator, 'usuario.alterar_papel', id, { papel }, papel !== 'ADMIN');
  }

  /** Nunca apaga: só marca `ativo = false`. Não desativa o último ADMIN ativo. */
  async desativar(ator: UsuarioAtual, id: string): Promise<UsuarioPublico> {
    exigirPapel(ator, 'ADMIN');
    return this.mudar(ator, 'usuario.desativar', id, { ativo: false }, true);
  }

  async reativar(ator: UsuarioAtual, id: string): Promise<UsuarioPublico> {
    exigirPapel(ator, 'ADMIN');
    return this.mudar(ator, 'usuario.reativar', id, { ativo: true }, false);
  }

  /**
   * Altera a linha numa transação. Quando a mudança pode tirar um ADMIN do conjunto de ADMIN ativos (`tiraAdmin`),
   * trava os ADMIN ativos (FOR UPDATE, em ordem de id, sem deadlock) e recusa se não sobrar outro: duas requisições
   * simultâneas desativando um ao outro não deixam o sistema sem administrador.
   * O evento de auditoria (antes e depois de papel e ativo) é gravado na mesma transação: se a mudança é recusada ou desfeita,
   * não sobra evento; se o evento não puder ser gravado, a mudança não acontece.
   */
  private mudar(
    ator: UsuarioAtual,
    acao: 'usuario.alterar_papel' | 'usuario.desativar' | 'usuario.reativar',
    id: string,
    alteracao: Partial<Pick<Linha, 'papel' | 'ativo'>>,
    tiraAdmin: boolean,
  ): Promise<UsuarioPublico> {
    return this.db.transaction(async (tx) => {
      const admins = tiraAdmin
        ? await tx
            .select({ id: usuario.id })
            .from(usuario)
            .where(and(eq(usuario.papel, 'ADMIN'), eq(usuario.ativo, true)))
            .orderBy(asc(usuario.id))
            .for('update')
        : [];
      const [atual] = await tx.select().from(usuario).where(eq(usuario.id, id)).for('update');
      if (!atual) throw new NotFoundException();
      const eraAdminAtivo = atual.papel === 'ADMIN' && atual.ativo;
      if (tiraAdmin && eraAdminAtivo && admins.every((a) => a.id === id)) {
        throw new ConflictException('Não é possível remover o último administrador ativo');
      }
      const [nova] = await tx.update(usuario).set(alteracao).where(eq(usuario.id, id)).returning();
      await this.auditoria.registrar(
        {
          acao,
          atorId: ator.id,
          alvoTipo: 'usuario',
          alvoId: id,
          antes: { papel: atual.papel, ativo: atual.ativo },
          depois: { papel: nova!.papel, ativo: nova!.ativo },
        },
        tx,
      );
      return publico(nova!);
    });
  }

  private avisarConvite(novo: Linha): void {
    const { html, texto } = montarEmail(
      'Você foi adicionado ao sistema',
      `<p>Olá, ${escaparHtml(novo.nome)}.</p>` +
        `<p>Você foi adicionado ao <strong>${escaparHtml(this.config.NOME_SISTEMA)}</strong>. ` +
        `Para acessar, abra o sistema e entre com seu e-mail (${escaparHtml(novo.email)}).</p>`,
      { nomeSistema: this.config.NOME_SISTEMA },
    );
    // Assunto fixo: sem nome nem dado pessoal (aparece em log e em notificação). disparar() nunca lança nem espera o SMTP.
    this.email.disparar({ para: novo.email, assunto: 'Você foi adicionado ao sistema', html, texto });
  }
}

/** Valida o corpo com zod e responde 400 padrão se falhar. */
export function validarOu400<T>(esquema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false } }, valor: unknown): T {
  const r = esquema.safeParse(valor);
  if (!r.success) throw new BadRequestException('Dados inválidos');
  return r.data;
}
