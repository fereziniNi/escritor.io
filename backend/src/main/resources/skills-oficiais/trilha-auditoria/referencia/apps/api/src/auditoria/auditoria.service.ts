// origem: skills-modelo/apps/api/src/auditoria/auditoria.service.ts
import { Inject, Injectable } from '@nestjs/common';
import { type ConsultaAuditoria, type EventoAuditoria, FORMATO_ACAO, type PaginaAuditoria, esquemaPaginaAuditoria } from 'contratos';
import { and, desc, eq, gte, lt, lte } from 'drizzle-orm';
import { BANCO, type Db } from '../banco/banco';
import { eventoAuditoria, usuario } from '../banco/esquema';
import { type Config } from '../config/config';
import { CONFIG } from '../config/config.module';
import { exigirPapel, type UsuarioAtual } from '../usuarios/usuario-atual';
import { contextoDaRequisicao } from './contexto-requisicao';
import { exigirPapelRuntime } from './papel-runtime';
import { montarCsv } from './csv';
import { sanitizarDetalhes } from './sanitizar';

/** Máximo de linhas de uma exportação CSV. Acima disso o arquivo sai cortado e a resposta avisa (cabeçalho). */
export const LIMITE_EXPORTACAO = 10_000;

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

const CABECALHO_CSV = ['Id', 'Data e hora (Brasília)', 'Ator', 'Ator (id)', 'Ação', 'Alvo (tipo)', 'Alvo (id)', 'Antes', 'Depois', 'IP', 'Request-id'];

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
   * CSV (BOM UTF-8, separador `;`) com os mesmos filtros, até LIMITE_EXPORTACAO linhas. A exportação em si vira um evento
   * `auditoria.exportar` com os filtros e a quantidade de linhas.
   */
  async exportarCsv(ator: UsuarioAtual | undefined, consulta: ConsultaAuditoria): Promise<{ csv: string; truncado: boolean; nomeArquivo: string }> {
    exigirPapel(ator, 'ADMIN');
    // Cursor e limite da consulta não valem aqui: a exportação pega tudo que bate com os filtros, até LIMITE_EXPORTACAO.
    const filtros = { de: consulta.de, ate: consulta.ate, atorId: consulta.atorId, acao: consulta.acao };
    const linhas = await this.buscar(filtros, LIMITE_EXPORTACAO + 1);
    const truncado = linhas.length > LIMITE_EXPORTACAO;
    const itens = truncado ? linhas.slice(0, LIMITE_EXPORTACAO) : linhas;
    const csv = montarCsv(
      CABECALHO_CSV,
      itens.map((e) => {
        const d = emBrasilia(new Date(e.ocorridoEm));
        return [
          e.id,
          `${d['day']}/${d['month']}/${d['year']} ${d['hour']}:${d['minute']}:${d['second']}`,
          e.atorEmail,
          e.atorId,
          e.acao,
          e.alvoTipo,
          e.alvoId,
          e.antes === null || e.antes === undefined ? null : JSON.stringify(e.antes),
          e.depois === null || e.depois === undefined ? null : JSON.stringify(e.depois),
          e.ip,
          e.requestId,
        ];
      }),
    );
    await this.registrar({
      acao: 'auditoria.exportar',
      atorId: ator.id,
      depois: { filtros: Object.fromEntries(Object.entries(filtros).filter(([, v]) => v !== undefined)), linhas: itens.length, truncado },
    });
    const h = emBrasilia(new Date());
    return { csv, truncado, nomeArquivo: `auditoria-${h['year']}${h['month']}${h['day']}.csv` };
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
      .where(
        and(
          filtros.de ? gte(eventoAuditoria.ocorridoEm, new Date(filtros.de)) : undefined,
          filtros.ate ? lte(eventoAuditoria.ocorridoEm, new Date(filtros.ate)) : undefined,
          filtros.atorId ? eq(eventoAuditoria.atorId, filtros.atorId) : undefined,
          filtros.acao ? eq(eventoAuditoria.acao, filtros.acao) : undefined,
          cursor ? lt(eventoAuditoria.id, Number(cursor)) : undefined,
        ),
      )
      .orderBy(desc(eventoAuditoria.id))
      .limit(quantidade);
    return linhas.map((l) => ({ ...l, id: String(l.id), ocorridoEm: l.ocorridoEm.toISOString() }));
  }
}
