// origem: skills-modelo/apps/api/src/auditoria/auditoria.controller.ts
import { Controller, Get, Header, Query, Res, type StreamableFile } from '@nestjs/common';
import { type PaginaAuditoria, esquemaConsultaAuditoria } from 'contratos';
import { type Response } from 'express';
import { type UsuarioAtual, UsuarioLogado } from '../usuarios/usuario-atual';
import { Papeis } from '../usuarios/papeis.guard';
import { validarOu400 } from '../usuarios/usuarios.service';
import { enviarArquivo, esquemaExportar, ExportacaoService } from '../exportacao/exportacao.service';
import { AuditoriaService, COLUNAS_EXPORTACAO } from './auditoria.service';

/**
 * Leitura da trilha, só ADMIN. Só GET: não existe rota para criar, alterar ou apagar evento (quem grava é o código
 * do sistema, pelo AuditoriaService). Sem cache: o conteúdo é sensível.
 */
@Controller('admin/auditoria')
@Papeis('ADMIN')
export class AuditoriaController {
  constructor(
    private readonly auditoria: AuditoriaService,
    private readonly exportacao: ExportacaoService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  listar(@UsuarioLogado() eu: UsuarioAtual, @Query() consulta: unknown): Promise<PaginaAuditoria> {
    return this.auditoria.listar(eu, validarOu400(esquemaConsultaAuditoria, consulta));
  }

  /**
   * Exporta a trilha em Excel, PDF ou CSV (`?formato=`), com os mesmos filtros (cursor e limite são ignorados: exporta
   * tudo, até EXPORTACAO_MAX_LINHAS). `X-Exportacao-Truncada: true` quando passou. Fica na trilha como `auditoria.exportar`.
   */
  @Get('exportar')
  @Header('Cache-Control', 'no-store')
  async exportar(@UsuarioLogado() eu: UsuarioAtual, @Query() consulta: unknown, @Res({ passthrough: true }) res: Response): Promise<StreamableFile> {
    const { formato } = validarOu400(esquemaExportar, consulta);
    const { filtros, fonte } = this.auditoria.fonteExportacao(eu, validarOu400(esquemaConsultaAuditoria, consulta));
    const arquivo = await this.exportacao.exportar(eu, {
      recurso: 'auditoria',
      formato,
      titulo: 'Auditoria',
      colunas: COLUNAS_EXPORTACAO,
      fonte,
      filtros,
    });
    return enviarArquivo(res, arquivo);
  }
}
