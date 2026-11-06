import { Controller, Get, Header, Query, Res, StreamableFile } from '@nestjs/common';
import { type PaginaAuditoria, esquemaConsultaAuditoria } from 'contratos';
import { type Response } from 'express';
import { type UsuarioAtual, UsuarioLogado } from '../usuarios/usuario-atual';
import { Papeis } from '../usuarios/papeis.guard';
import { validarOu400 } from '../usuarios/usuarios.service';
import { AuditoriaService } from './auditoria.service';

/**
 * Leitura da trilha, só ADMIN. Só GET: não existe rota para criar, alterar ou apagar evento (quem grava é o código
 * do sistema, pelo AuditoriaService). Sem cache: o conteúdo é sensível.
 */
@Controller('admin/auditoria')
@Papeis('ADMIN')
export class AuditoriaController {
  constructor(private readonly auditoria: AuditoriaService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  listar(@UsuarioLogado() eu: UsuarioAtual, @Query() consulta: unknown): Promise<PaginaAuditoria> {
    return this.auditoria.listar(eu, validarOu400(esquemaConsultaAuditoria, consulta));
  }

  /** Mesmos filtros (cursor e limite são ignorados: exporta tudo, até o máximo de linhas). `X-Exportacao-Truncada: true` quando passou do máximo de linhas. */
  @Get('csv')
  @Header('Cache-Control', 'no-store')
  async exportar(@UsuarioLogado() eu: UsuarioAtual, @Query() consulta: unknown, @Res({ passthrough: true }) res: Response): Promise<StreamableFile> {
    const { csv, truncado, contentDisposition } = await this.auditoria.exportarCsv(eu, validarOu400(esquemaConsultaAuditoria, consulta));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', contentDisposition);
    res.setHeader('X-Exportacao-Truncada', String(truncado));
    return new StreamableFile(csv);
  }
}
