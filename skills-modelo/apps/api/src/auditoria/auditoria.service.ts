import { Inject, Injectable } from '@nestjs/common';
import { type ConsultaAuditoria, type EventoAuditoria, FORMATO_ACAO, type PaginaAuditoria, esquemaPaginaAuditoria } from 'contratos';
import { and, desc, eq, gte, lt, lte, sql } from 'drizzle-orm';
import { BANCO, type Db } from '../banco/banco';
import { eventoAuditoria, usuario } from '../banco/esquema';
import { type Config } from '../config/config';
import { CONFIG } from '../config/config.module';
import { type FonteLinhas } from '../exportacao/exportacao.service';
import { type RelatorioTabular } from '../exportacao/relatorio-tabular';
import { exigirPapel, type UsuarioAtual } from '../usuarios/usuario-atual';
import { contextoDaRequisicao } from './contexto-requisicao';
import { exigirPapelRuntime } from './papel-runtime';
import { sanitizarDetalhes } from './sanitizar';

export interface NovoEvento {
  /** `grupo.acao` em minúsculas (ex.: `usuario.desativar`). Outro formato é erro de programação e lança. */
  acao: string;
  /** Quem fez. Nulo/ausente: o sistema ou alguém ainda não identificado. */
  atorId?: string | null;
  alvoTipo?: string;
  alvoId?: string;
  /** Estado anterior e posterior do alvo. Passam por `sanitizarDetalhes` (nada de código, token, cookie, segredo). */
  antes?: unknown;
  depois?: unknown;
  /** Por padrão vêm da requisição em andamento (ver contexto-requisicao.ts). */
  ip?: string | null;
  requestId?: string | null;
}

/** Banco ou transação: passe a transação para o evento nascer (e desfazer) junto com a mudança. */
type Executor = Pick<Db, 'insert'>;

/** Colunas da exportação da trilha (Excel, PDF e CSV): tudo texto (data já formatada em Brasília, antes e depois em JSON). */
export const COLUNAS_EXPORTACAO: RelatorioTabular['colunas'] = [
  { chave: 'id', titulo: 'Id', tipo: 'texto' },
  { chave: 'dataHora', titulo: 'Data e hora (Brasília)', tipo: 'texto' },
  { chave: 'ator', titulo: 'Ator', tipo: 'texto' },
  { chave: 'atorId', titulo: 'Ator (id)', tipo: 'texto' },
  { chave: 'acao', titulo: 'Ação', tipo: 'texto' },
  { chave: 'alvoTipo', titulo: 'Alvo (tipo)', tipo: 'texto' },
  { chave: 'alvoId', titulo: 'Alvo (id)', tipo: 'texto' },
  { chave: 'antes', titulo: 'Antes', tipo: 'texto' },
  { chave: 'depois', titulo: 'Depois', tipo: 'texto' },
  { chave: 'ip', titulo: 'IP', tipo: 'texto' },
  { chave: 'requestId', titulo: 'Request-id', tipo: 'texto' },
];

/** Eventos por consulta na exportação em lotes. */
const TAMANHO_LOTE = 500;

const partes = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function emBrasilia(d: Date): Record<string, string> {
  return Object.fromEntries(partes.formatToParts(d).map((p) => [p.type, p.value]));
}

/**
 * Trilha de auditoria. `registrar` é a única porta de escrita; a API só LÊ (listar, exportar). Não existe método para
 * alterar ou apagar evento, e o banco também não deixaria (gatilho + REVOKE no papel de runtime).
 */
@Injectable()
export class AuditoriaService {
  constructor(
    @Inject(BANCO) private readonly db: Db,
    @Inject(CONFIG) config: Config,
  ) {
    // Fora de desenvolvimento sem o papel de runtime lança: a API não sobe (ver papel-runtime.ts).
    exigirPapelRuntime(config);
  }

  /**
   * Grava um evento. IP e request-id vêm da requisição em andamento, ator e alvo de quem chama. Com `executor` (a
   * transação da mudança) o evento só existe se a mudança for confirmada; falhar ao gravar desfaz a mudança.
   * Em fluxos que não podem cair por causa da trilha (login), quem chama captura o erro.
   */
  async registrar(evento: NovoEvento, executor: Executor = this.db): Promise<void> {
    if (evento.acao.length > 64 || !FORMATO_ACAO.test(evento.acao)) {
      throw new Error(`ação de auditoria inválida: use grupo.acao em minúsculas (recebido "${evento.acao.slice(0, 40)}")`);
    }
    const contexto = contextoDaRequisicao();
    await executor.insert(eventoAuditoria).values({
      acao: evento.acao,
      atorId: evento.atorId ?? null,
      alvoTipo: evento.alvoTipo ?? null,
      alvoId: evento.alvoId ?? null,
      antes: sanitizarDetalhes(evento.antes),
      depois: sanitizarDetalhes(evento.depois),
      ip: evento.ip ?? contexto.ip ?? null,
      requestId: evento.requestId ?? contexto.requestId ?? null,
    });
  }

  /** Uma página da trilha, do mais novo para o mais velho. Só ADMIN (conferido aqui e no @Papeis da rota). */
  async listar(ator: UsuarioAtual | undefined, consulta: ConsultaAuditoria): Promise<PaginaAuditoria> {
    exigirPapel(ator, 'ADMIN');
    const linhas = await this.buscar(consulta, consulta.limite + 1, consulta.cursor);
    const temMais = linhas.length > consulta.limite;
    const itens = temMais ? linhas.slice(0, consulta.limite) : linhas;
    return esquemaPaginaAuditoria.parse({ itens, proximoCursor: temMais ? itens[itens.length - 1]!.id : null });
  }

  /**
   * Fonte de linhas para a exportação da trilha (skill exportacao-excel-pdf-csv): os mesmos filtros da listagem (cursor e
   * limite não valem: exporta tudo que bate, até EXPORTACAO_MAX_LINHAS), em lotes por chave (`id` decrescente, o cursor da
   * própria listagem). Só ADMIN. Quem grava o evento `auditoria.exportar` é o `ExportacaoService`, antes de enviar.
   */
  fonteExportacao(ator: UsuarioAtual | undefined, consulta: ConsultaAuditoria): { filtros: Record<string, string>; fonte: FonteLinhas } {
    exigirPapel(ator, 'ADMIN');
    const filtros = { de: consulta.de, ate: consulta.ate, atorId: consulta.atorId, acao: consulta.acao };
    const aplicados = Object.fromEntries(Object.entries(filtros).filter((par): par is [string, string] => par[1] !== undefined));
    return {
      filtros: aplicados,
      fonte: {
        contar: async (max) => {
          const r = await this.db.execute<{ n: number }>(
            sql`select count(*)::int as n from (select 1 from ${eventoAuditoria} where ${this.condicoes(filtros)} limit ${max}) t`,
          );
          return r.rows[0]?.n ?? 0;
        },
        lotes: () => this.lotesParaExportar(filtros),
      },
    };
  }

  private async *lotesParaExportar(filtros: Pick<ConsultaAuditoria, 'de' | 'ate' | 'atorId' | 'acao'>): AsyncGenerator<Record<string, unknown>[]> {
    let cursor: string | undefined;
    for (;;) {
      const eventos = await this.buscar(filtros, TAMANHO_LOTE, cursor);
      if (eventos.length === 0) return;
      yield eventos.map((e) => {
        const d = emBrasilia(new Date(e.ocorridoEm));
        return {
          id: e.id,
          dataHora: `${d['day']}/${d['month']}/${d['year']} ${d['hour']}:${d['minute']}:${d['second']}`,
          ator: e.atorEmail,
          atorId: e.atorId,
          acao: e.acao,
          alvoTipo: e.alvoTipo,
          alvoId: e.alvoId,
          antes: e.antes === null || e.antes === undefined ? null : JSON.stringify(e.antes),
          depois: e.depois === null || e.depois === undefined ? null : JSON.stringify(e.depois),
          ip: e.ip,
          requestId: e.requestId,
        };
      });
      if (eventos.length < TAMANHO_LOTE) return;
      cursor = eventos[eventos.length - 1]!.id;
    }
  }

  private condicoes(filtros: Pick<ConsultaAuditoria, 'de' | 'ate' | 'atorId' | 'acao'>, cursor?: string) {
    return and(
      filtros.de ? gte(eventoAuditoria.ocorridoEm, new Date(filtros.de)) : undefined,
      filtros.ate ? lte(eventoAuditoria.ocorridoEm, new Date(filtros.ate)) : undefined,
      filtros.atorId ? eq(eventoAuditoria.atorId, filtros.atorId) : undefined,
      filtros.acao ? eq(eventoAuditoria.acao, filtros.acao) : undefined,
      cursor ? lt(eventoAuditoria.id, Number(cursor)) : undefined,
    );
  }

  private async buscar(filtros: Pick<ConsultaAuditoria, 'de' | 'ate' | 'atorId' | 'acao'>, quantidade: number, cursor?: string): Promise<EventoAuditoria[]> {
    const linhas = await this.db
      .select({
        id: eventoAuditoria.id,
        ocorridoEm: eventoAuditoria.ocorridoEm,
        atorId: eventoAuditoria.atorId,
        atorEmail: usuario.email,
        acao: eventoAuditoria.acao,
        alvoTipo: eventoAuditoria.alvoTipo,
        alvoId: eventoAuditoria.alvoId,
        antes: eventoAuditoria.antes,
        depois: eventoAuditoria.depois,
        ip: eventoAuditoria.ip,
        requestId: eventoAuditoria.requestId,
      })
      .from(eventoAuditoria)
      .leftJoin(usuario, eq(usuario.id, eventoAuditoria.atorId))
      .where(this.condicoes(filtros, cursor))
      .orderBy(desc(eventoAuditoria.id))
      .limit(quantidade);
    return linhas.map((l) => ({ ...l, id: String(l.id), ocorridoEm: l.ocorridoEm.toISOString() }));
  }
}
