// origem: skills-modelo/apps/api/src/exportacao/exportacao.service.ts
import { type Readable } from 'node:stream';
import { Inject, Injectable, Logger, StreamableFile } from '@nestjs/common';
import { type Response } from 'express';
import { z } from 'zod';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { type Config } from '../config/config';
import { CONFIG } from '../config/config.module';
import { mascararResposta, podeVerDadosPessoais } from '../lgpd/mascarar-dados.interceptor';
import { type UsuarioAtual } from '../usuarios/usuario-atual';
import { contentDisposition } from './content-disposition';
import { csvEmFluxo } from './csv';
import { excelEmFluxo } from './excel';
import { diaParaArquivo } from './formato';
import { lerLogo } from './logo';
import { paraPdf } from './pdf';
import { type ColunaRelatorio, type IdentidadeExportacao, type Lotes, type MetaRelatorio } from './relatorio-tabular';

export const FORMATOS = ['xlsx', 'pdf', 'csv'] as const;
export type FormatoExportacao = (typeof FORMATOS)[number];

/** `?formato=xlsx|pdf|csv`, obrigatório. Use na rota: `validarOu400(esquemaExportar, consulta)`. */
export const esquemaExportar = z.object({ formato: z.enum(FORMATOS) });

/** O PDF é desenhado na memória, linha a linha: corta antes do CSV e do Excel (e nunca acima de EXPORTACAO_MAX_LINHAS). */
export const MAX_LINHAS_PDF = 2000;

const TIPOS: Record<FormatoExportacao, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
  csv: 'text/csv; charset=utf-8',
};

/**
 * De onde vêm as linhas. O recurso implementa com uma consulta paginada por CHAVE (keyset): nunca `select *` sem limite.
 * - `contar(max)`: quantas linhas existem, contando no máximo `max` (ex.: `select count(*) from (select 1 ... limit max)`).
 *   Serve para o aviso de corte e a trilha SAÍREM ANTES do corpo (o cabeçalho `X-Exportacao-Truncada` precisa ir antes).
 * - `lotes()`: as linhas em lotes de algumas centenas, na ordem do arquivo. O serviço corta no limite e mascara lote a lote.
 */
export interface FonteLinhas {
  contar(max: number): Promise<number>;
  lotes(): Lotes;
}

export interface ArquivoExportado {
  /** Excel e CSV: fluxo (a memória não cresce com as linhas). PDF: Buffer. */
  conteudo: Readable | Buffer;
  tipo: string;
  contentDisposition: string;
  /** O relatório passou do máximo de linhas e o arquivo sai cortado. */
  truncado: boolean;
}

export interface PedidoExportacao extends MetaRelatorio {
  /** Nome do recurso: vira a ação de auditoria `<recurso>.exportar` e o começo do nome do arquivo. Ex.: `cliente`. */
  recurso: string;
  formato: FormatoExportacao;
  fonte: FonteLinhas;
  /** Nome do arquivo sem extensão e sem data (padrão: o recurso). Passa por `contentDisposition`, pode ter dado de fora. */
  nomeBase?: string;
  /** Filtros usados, para a trilha (sem dado pessoal). */
  filtros?: Record<string, unknown>;
}

const PESSOAL = /cpf|e-?mail/i;

/**
 * Chaves de coluna que PARECEM dado pessoal (têm cpf ou email no nome) mas não começam com `cpf`/`email`: a máscara por papel
 * age pelo começo da chave (a mesma regra da API), então essas colunas sairiam em claro. O serviço avisa no log.
 */
export function colunasPessoaisSemMascara(colunas: readonly ColunaRelatorio[]): string[] {
  return colunas.filter((c) => PESSOAL.test(c.chave) && !/^(cpf|email)/i.test(c.chave)).map((c) => c.chave);
}

/** Corta em `limite` linhas no total e aplica `tratar` a cada lote (a máscara). */
async function* cortarETratar(lotes: Lotes, limite: number, tratar: (lote: Record<string, unknown>[]) => Record<string, unknown>[]): Lotes {
  let restantes = limite;
  for await (const lote of lotes) {
    if (restantes <= 0) return;
    const parte = lote.length > restantes ? lote.slice(0, restantes) : lote;
    restantes -= parte.length;
    yield tratar(parte);
  }
}

/**
 * Exportação de relatórios (Excel, PDF, CSV) com as regras do padrão Multiplica, na ordem:
 * 1. limite de linhas (EXPORTACAO_MAX_LINHAS; PDF até MAX_LINHAS_PDF), com aviso de corte;
 * 2. evento de auditoria `<recurso>.exportar` (formato, linhas, corte, mascarado, filtros) ANTES de qualquer byte: se a
 *    trilha falhar, nada é enviado (exportar sem registro seria vazamento sem rastro);
 * 3. dado pessoal MASCARADO conforme o papel de quem exporta, lote a lote (o interceptor da skill lgpd-dados-pessoais não
 *    abre arquivo; falha fechada: papel desconhecido recebe mascarado);
 * 4. geração: Excel e CSV em FLUXO (memória constante), PDF na memória, com a identidade (NOME_SISTEMA, logo, cor primária).
 */
@Injectable()
export class ExportacaoService {
  private readonly log = new Logger(ExportacaoService.name);
  readonly maxLinhas: number;
  private readonly identidade: IdentidadeExportacao;

  constructor(
    @Inject(CONFIG) config: Config,
    private readonly auditoria: AuditoriaService,
  ) {
    this.maxLinhas = config.EXPORTACAO_MAX_LINHAS;
    this.identidade = { nomeSistema: config.NOME_SISTEMA, ...(config.EXPORTACAO_LOGO ? { logo: lerLogo(config.EXPORTACAO_LOGO) } : {}) };
  }

  async exportar(ator: UsuarioAtual, pedido: PedidoExportacao): Promise<ArquivoExportado> {
    const semMascara = colunasPessoaisSemMascara(pedido.colunas);
    if (semMascara.length > 0) {
      this.log.warn(`exportação "${pedido.recurso}": colunas ${semMascara.join(', ')} parecem dado pessoal mas não começam com cpf/email: NÃO serão mascaradas por papel`);
    }
    const mascarar = !podeVerDadosPessoais(ator.papel);
    const limite = pedido.formato === 'pdf' ? Math.min(this.maxLinhas, MAX_LINHAS_PDF) : this.maxLinhas;
    const existentes = await pedido.fonte.contar(limite + 1);
    const truncado = existentes > limite;
    const linhas = Math.min(existentes, limite);

    await this.auditoria.registrar({
      acao: `${pedido.recurso}.exportar`,
      atorId: ator.id,
      alvoTipo: pedido.recurso,
      depois: { formato: pedido.formato, linhas, truncado, mascarado: mascarar, ...(pedido.filtros ? { filtros: pedido.filtros } : {}) },
    });

    // Sem "eu" (idUsuario indefinido): em arquivo de relatório ninguém é "o próprio registro".
    const tratar = (lote: Record<string, unknown>[]) => (mascarar ? (mascararResposta(lote) as Record<string, unknown>[]) : lote);
    const meta: MetaRelatorio = {
      titulo: pedido.titulo,
      colunas: pedido.colunas,
      ...(pedido.totais ? { totais: mascarar ? (mascararResposta(pedido.totais) as Record<string, unknown>) : pedido.totais } : {}),
    };
    const lotes = cortarETratar(pedido.fonte.lotes(), limite, tratar);

    let conteudo: Readable | Buffer;
    if (pedido.formato === 'xlsx') conteudo = excelEmFluxo(meta, lotes, this.identidade);
    else if (pedido.formato === 'csv') conteudo = csvEmFluxo(meta, lotes);
    else {
      const todas: Record<string, unknown>[] = [];
      for await (const lote of lotes) todas.push(...lote);
      conteudo = await paraPdf({ ...meta, linhas: todas }, this.identidade);
    }

    return {
      conteudo,
      tipo: TIPOS[pedido.formato],
      contentDisposition: contentDisposition(`${pedido.nomeBase ?? pedido.recurso}-${diaParaArquivo()}.${pedido.formato}`),
      truncado,
    };
  }
}

/**
 * Resposta HTTP do arquivo: tipo, `Content-Disposition` seguro, sem cache (o conteúdo é sensível) e
 * `X-Exportacao-Truncada`, tudo ANTES do corpo. Use na rota com `@Res({ passthrough: true })`. `StreamableFile` não é aberto
 * pelo interceptor de máscara (a máscara já foi aplicada em `exportar`). Erro no meio do fluxo derruba a conexão (o
 * download falha, não entrega arquivo incompleto como se estivesse bom).
 */
export function enviarArquivo(res: Response, arquivo: ArquivoExportado): StreamableFile {
  res.setHeader('Content-Type', arquivo.tipo);
  res.setHeader('Content-Disposition', arquivo.contentDisposition);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Exportacao-Truncada', String(arquivo.truncado));
  // Só vale para quem chama de outra origem (CORS_ORIGENS): deixa o navegador ler o nome e o aviso de corte.
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, X-Exportacao-Truncada');
  return Buffer.isBuffer(arquivo.conteudo) ? new StreamableFile(arquivo.conteudo) : new StreamableFile(arquivo.conteudo);
}
