// origem: skills-modelo/apps/api/src/clientes/clientes.service.ts
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { BANCO, type Db } from '../banco/banco';
import { cliente } from '../banco/esquema';
import { type ArquivoExportado, ExportacaoService, type FormatoExportacao } from '../exportacao/exportacao.service';
import { type RelatorioTabular } from '../exportacao/relatorio-tabular';
import { CHAVES_LGPD, type ChavesLgpd } from '../lgpd/chaves';
import { normalizarCpf } from '../lgpd/cpf';
import { exigirPapel, type UsuarioAtual } from '../usuarios/usuario-atual';
import { COLUNA_CPF } from './cliente.tabela';

/** O que a API devolve de um cliente. CPF e e-mail completos: o interceptor de máscara cuida de quem não pode vê-los. */
export interface ClientePublico {
  id: string;
  nome: string;
  email: string | null;
  cpf: string | null;
  criadoEm: string;
  encerradoEm: string | null;
  anonimizadoEm: string | null;
}

export interface DadosCliente {
  nome: string;
  email?: string | undefined;
  cpf: string;
}

type Linha = typeof cliente.$inferSelect;
/** Banco ou transação. */
type Executor = Pick<Db, 'update' | 'insert'>;

/** Nome que fica no lugar do nome do titular anonimizado. */
export const NOME_ANONIMIZADO = 'Titular anonimizado';

const iso = (d: Date | null) => (d === null ? null : d.toISOString());

const violouUnicidade = (e: unknown): boolean => {
  const erro = e as { code?: string; cause?: { code?: string } };
  return erro.code === '23505' || erro.cause?.code === '23505';
};

/**
 * Anonimiza um cliente (direito do titular ou retenção): troca nome, apaga e-mail, CPF cifrado e índice, marca
 * `anonimizado_em` e mantém o `id`. Registra `lgpd.anonimizar_titular` na MESMA transação (sem dado pessoal no evento).
 * Usado pela rota do ADMIN e pelo comando de retenção.
 */
export async function anonimizarCliente(
  tx: Executor,
  auditoria: Pick<AuditoriaService, 'registrar'>,
  id: string,
  evento: { atorId: string | null; motivo: 'solicitacao_titular' | 'retencao' },
): Promise<Linha> {
  const [nova] = await tx
    .update(cliente)
    .set({ nome: NOME_ANONIMIZADO, email: null, cpfCifrado: null, cpfIndice: null, anonimizadoEm: new Date() })
    .where(eq(cliente.id, id))
    .returning();
  await auditoria.registrar({ acao: 'lgpd.anonimizar_titular', atorId: evento.atorId, alvoTipo: 'cliente', alvoId: id, depois: { motivo: evento.motivo } }, tx);
  return nova!;
}

/**
 * Exemplo de cadastro com CPF cifrado + índice cego. Cada método confere o papel (o @Papeis da rota é a primeira
 * barreira). Nunca loga nome, e-mail ou CPF; a trilha recebe só o id.
 */
@Injectable()
export class ClientesService {
  constructor(
    @Inject(BANCO) private readonly db: Db,
    @Inject(CHAVES_LGPD) private readonly chaves: ChavesLgpd,
    private readonly auditoria: AuditoriaService,
    private readonly exportacao: ExportacaoService,
  ) {}

  private publico(l: Linha): ClientePublico {
    return {
      id: l.id,
      nome: l.nome,
      email: l.email,
      cpf: l.cpfCifrado === null ? null : this.chaves.chaveiro.decifrar(l.cpfCifrado, COLUNA_CPF),
      criadoEm: l.criadoEm.toISOString(),
      encerradoEm: iso(l.encerradoEm),
      anonimizadoEm: iso(l.anonimizadoEm),
    };
  }

  /** CPF (já validado) → só dígitos → índice cego. */
  private indiceDe(cpf: string): string {
    return this.chaves.indice.calcular(normalizarCpf(cpf)!, COLUNA_CPF);
  }

  async criar(ator: UsuarioAtual, dados: DadosCliente): Promise<ClientePublico> {
    exigirPapel(ator, 'ADMIN', 'GESTOR', 'USUARIO');
    const cpf = normalizarCpf(dados.cpf)!;
    try {
      const nova = await this.db.transaction(async (tx) => {
        const [linha] = await tx
          .insert(cliente)
          .values({ nome: dados.nome, email: dados.email ?? null, cpfCifrado: this.chaves.chaveiro.cifrar(cpf, COLUNA_CPF), cpfIndice: this.indiceDe(cpf) })
          .returning();
        await this.auditoria.registrar({ acao: 'cliente.criar', atorId: ator.id, alvoTipo: 'cliente', alvoId: linha!.id }, tx);
        return linha!;
      });
      return this.publico(nova);
    } catch (e) {
      if (violouUnicidade(e)) throw new ConflictException('Já existe um cliente com este CPF');
      throw e;
    }
  }

  async listar(ator: UsuarioAtual): Promise<ClientePublico[]> {
    exigirPapel(ator, 'ADMIN', 'GESTOR', 'USUARIO');
    const linhas = await this.db.select().from(cliente).orderBy(desc(cliente.criadoEm)).limit(200);
    return linhas.map((l) => this.publico(l));
  }

  /**
   * Lista de clientes em Excel, PDF ou CSV (skill exportacao-excel-pdf-csv). Os campos `cpf` e `email` seguem a mesma
   * máscara da API: USUARIO recebe `***.456.789-**` e `a***@dominio`, GESTOR e ADMIN o completo (o `ExportacaoService`
   * aplica `mascararResposta` antes de gerar o arquivo). Registra `cliente.exportar` na trilha; no máximo
   * EXPORTACAO_MAX_LINHAS clientes (os mais novos), com `X-Exportacao-Truncada` quando passou.
   */
  async exportar(ator: UsuarioAtual, formato: FormatoExportacao): Promise<ArquivoExportado> {
    exigirPapel(ator, 'ADMIN', 'GESTOR', 'USUARIO');
    // Uma linha além do máximo: o ExportacaoService vê que passou e avisa o corte.
    const linhas = await this.db.select().from(cliente).orderBy(desc(cliente.criadoEm)).limit(this.exportacao.maxLinhas + 1);
    const relatorio: RelatorioTabular = {
      titulo: 'Clientes',
      colunas: [
        { chave: 'nome', titulo: 'Nome', tipo: 'texto' },
        { chave: 'email', titulo: 'E-mail', tipo: 'texto' },
        { chave: 'cpf', titulo: 'CPF', tipo: 'texto' },
        { chave: 'criadoEm', titulo: 'Cliente desde', tipo: 'data' },
        { chave: 'situacao', titulo: 'Situação', tipo: 'texto' },
      ],
      linhas: linhas.map((l) => {
        const c = this.publico(l);
        const situacao = c.anonimizadoEm ? 'Anonimizado' : c.encerradoEm ? 'Encerrado' : 'Ativo';
        return { nome: c.nome, email: c.email, cpf: c.cpf, criadoEm: c.criadoEm, situacao };
      }),
    };
    return this.exportacao.exportar(ator, { recurso: 'cliente', formato, relatorio, nomeBase: 'clientes' });
  }

  async obter(ator: UsuarioAtual, id: string): Promise<ClientePublico> {
    exigirPapel(ator, 'ADMIN', 'GESTOR', 'USUARIO');
    return this.publico(await this.linha(id));
  }

  /**
   * Busca exata pelo índice cego: o CPF nunca vai para o banco em claro, nem na consulta. Só GESTOR e ADMIN (quem vê o
   * CPF completo): com o CPF mascarado na mão, 1000 tentativas bastariam para descobri-lo. Toda busca, achando ou não,
   * vira `cliente.buscar_cpf` na trilha, sem o CPF (só se achou e, se achou, o id).
   */
  async buscarPorCpf(ator: UsuarioAtual, cpf: string): Promise<ClientePublico> {
    exigirPapel(ator, 'ADMIN', 'GESTOR');
    const [linha] = await this.db.select().from(cliente).where(eq(cliente.cpfIndice, this.indiceDe(cpf)));
    await this.auditoria.registrar({
      acao: 'cliente.buscar_cpf',
      atorId: ator.id,
      alvoTipo: 'cliente',
      ...(linha ? { alvoId: linha.id } : {}),
      depois: { encontrado: linha !== undefined },
    });
    if (!linha) throw new NotFoundException();
    return this.publico(linha);
  }

  /** Fim do relacionamento: a contagem da retenção começa aqui. */
  async encerrar(ator: UsuarioAtual, id: string): Promise<ClientePublico> {
    exigirPapel(ator, 'ADMIN', 'GESTOR');
    return this.db.transaction(async (tx) => {
      const [atual] = await tx.select().from(cliente).where(eq(cliente.id, id)).for('update');
      if (!atual) throw new NotFoundException();
      if (atual.encerradoEm !== null) throw new ConflictException('Cliente já encerrado');
      const [nova] = await tx.update(cliente).set({ encerradoEm: new Date() }).where(eq(cliente.id, id)).returning();
      await this.auditoria.registrar({ acao: 'cliente.encerrar', atorId: ator.id, alvoTipo: 'cliente', alvoId: id }, tx);
      return this.publico(nova!);
    });
  }

  /** Direito de acesso/portabilidade: tudo que o sistema guarda do titular, decifrado. Só ADMIN; registrado na trilha. */
  async exportarTitular(ator: UsuarioAtual, id: string): Promise<{ geradoEm: string; titular: ClientePublico }> {
    exigirPapel(ator, 'ADMIN');
    const titular = this.publico(await this.linha(id));
    await this.auditoria.registrar({ acao: 'lgpd.exportar_titular', atorId: ator.id, alvoTipo: 'cliente', alvoId: id });
    return { geradoEm: new Date().toISOString(), titular };
  }

  /** Direito de eliminação: anonimiza (mantém o id). Só ADMIN; já anonimizado → 409. */
  async anonimizarTitular(ator: UsuarioAtual, id: string): Promise<ClientePublico> {
    exigirPapel(ator, 'ADMIN');
    return this.db.transaction(async (tx) => {
      const [atual] = await tx.select().from(cliente).where(eq(cliente.id, id)).for('update');
      if (!atual) throw new NotFoundException();
      if (atual.anonimizadoEm !== null) throw new ConflictException('Titular já anonimizado');
      return this.publico(await anonimizarCliente(tx, this.auditoria, id, { atorId: ator.id, motivo: 'solicitacao_titular' }));
    });
  }

  private async linha(id: string): Promise<Linha> {
    const [linha] = await this.db.select().from(cliente).where(eq(cliente.id, id));
    if (!linha) throw new NotFoundException();
    return linha;
  }
}
