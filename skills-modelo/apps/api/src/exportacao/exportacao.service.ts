import { Inject, Injectable, StreamableFile } from '@nestjs/common';
import { type Response } from 'express';
import { z } from 'zod';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { type Config } from '../config/config';
import { CONFIG } from '../config/config.module';
import { mascararResposta, podeVerDadosPessoais } from '../lgpd/mascarar-dados.interceptor';
import { type UsuarioAtual } from '../usuarios/usuario-atual';
import { contentDisposition } from './content-disposition';
import { paraCsv } from './csv';
import { paraExcel } from './excel';
import { diaParaArquivo } from './formato';
import { lerLogo } from './logo';
import { paraPdf } from './pdf';
import { type IdentidadeExportacao, type RelatorioTabular } from './relatorio-tabular';

export const FORMATOS = ['xlsx', 'pdf', 'csv'] as const;
export type FormatoExportacao = (typeof FORMATOS)[number];

/** `?formato=xlsx|pdf|csv`, obrigatório. Use na rota: `validarOu400(esquemaExportar, consulta)`. */
export const esquemaExportar = z.object({ formato: z.enum(FORMATOS) });

/** O PDF é desenhado linha a linha e fica pesado: corta antes do CSV e do Excel (e nunca acima de EXPORTACAO_MAX_LINHAS). */
export const MAX_LINHAS_PDF = 2000;

const TIPOS: Record<FormatoExportacao, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
  csv: 'text/csv; charset=utf-8',
};

export interface ArquivoExportado {
  conteudo: Buffer;
  tipo: string;
  contentDisposition: string;
  /** O relatório passou do máximo de linhas e o arquivo saiu cortado. */
  truncado: boolean;
}

export interface PedidoExportacao {
  /** Nome do recurso: vira a ação de auditoria `<recurso>.exportar` e o começo do nome do arquivo. Ex.: `cliente`. */
  recurso: string;
  formato: FormatoExportacao;
  /** Com até `maxLinhas + 1` linhas (uma a mais para o serviço saber que passou do limite): busque no banco com `limit(maxLinhas + 1)`. */
  relatorio: RelatorioTabular;
  /** Nome do arquivo sem extensão e sem data (padrão: o recurso). */
  nomeBase?: string;
  /** Filtros usados, para a trilha (sem dado pessoal). */
  filtros?: Record<string, unknown>;
}

/**
 * Exportação de relatórios (Excel, PDF, CSV) com as regras do padrão Multiplica, na ordem:
 * 1. dado pessoal MASCARADO conforme o papel de quem exporta (a mesma regra da API: o interceptor da skill
 *    lgpd-dados-pessoais não abre um arquivo, então a máscara é aplicada aqui, antes de gerar o arquivo; falha fechada);
 * 2. limite de linhas (EXPORTACAO_MAX_LINHAS; PDF até MAX_LINHAS_PDF), com aviso de corte;
 * 3. geração do arquivo com a identidade (NOME_SISTEMA, logo, cor primária);
 * 4. evento de auditoria `<recurso>.exportar` (formato, linhas, corte, mascarado, filtros). Se a trilha falhar, o arquivo
 *    NÃO sai: exportar sem registro seria vazamento sem rastro.
 */
@Injectable()
export class ExportacaoService {
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
    const mascarar = !podeVerDadosPessoais(ator.papel);
    const limite = pedido.formato === 'pdf' ? Math.min(this.maxLinhas, MAX_LINHAS_PDF) : this.maxLinhas;
    const truncado = pedido.relatorio.linhas.length > limite;
    const linhasBrutas = truncado ? pedido.relatorio.linhas.slice(0, limite) : pedido.relatorio.linhas;
    const relatorio: RelatorioTabular = {
      ...pedido.relatorio,
      // Sem "eu" (idUsuario indefinido): em arquivo de relatório ninguém é "o próprio registro".
      linhas: mascarar ? (mascararResposta(linhasBrutas) as Record<string, unknown>[]) : linhasBrutas,
      ...(pedido.relatorio.totais ? { totais: mascarar ? (mascararResposta(pedido.relatorio.totais) as Record<string, unknown>) : pedido.relatorio.totais } : {}),
    };

    const conteudo =
      pedido.formato === 'xlsx' ? await paraExcel(relatorio, this.identidade) : pedido.formato === 'pdf' ? await paraPdf(relatorio, this.identidade) : paraCsv(relatorio);

    await this.auditoria.registrar({
      acao: `${pedido.recurso}.exportar`,
      atorId: ator.id,
      alvoTipo: pedido.recurso,
      depois: { formato: pedido.formato, linhas: relatorio.linhas.length, truncado, mascarado: mascarar, ...(pedido.filtros ? { filtros: pedido.filtros } : {}) },
    });

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
 * `X-Exportacao-Truncada`. Use na rota com `@Res({ passthrough: true })`. `StreamableFile` não é aberto pelo
 * interceptor de máscara (a máscara já foi aplicada em `exportar`).
 */
export function enviarArquivo(res: Response, arquivo: ArquivoExportado): StreamableFile {
  res.setHeader('Content-Type', arquivo.tipo);
  res.setHeader('Content-Disposition', arquivo.contentDisposition);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Exportacao-Truncada', String(arquivo.truncado));
  // Só vale para quem chama de outra origem (CORS_ORIGENS): deixa o navegador ler o nome e o aviso de corte.
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, X-Exportacao-Truncada');
  return new StreamableFile(arquivo.conteudo);
}
