import { Controller, Get, Header, HttpCode, Param, ParseUUIDPipe, Post, Res } from '@nestjs/common';
import { type Response } from 'express';
import { MesmaOrigem } from '../seguranca/origem.guard';
import { Papeis } from '../usuarios/papeis.guard';
import { type UsuarioAtual, UsuarioLogado } from '../usuarios/usuario-atual';
import { type ClientePublico, ClientesService } from './clientes.service';

/**
 * Direitos do titular (LGPD art. 18): exportar (acesso/portabilidade) e anonimizar (eliminação). Só ADMIN, na rota e
 * no serviço; cada uso vira evento na trilha de auditoria. O POST passa pela guarda de origem da skill seguranca; o GET
 * do arquivo tem efeito colateral (registra), então leva `@MesmaOrigem()`.
 */
@Controller('admin/lgpd/titulares')
@Papeis('ADMIN')
export class TitularController {
  constructor(private readonly clientes: ClientesService) {}

  @Get(':id/exportar')
  @MesmaOrigem()
  @Header('Cache-Control', 'no-store')
  async exportar(
    @UsuarioLogado() eu: UsuarioAtual,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ geradoEm: string; titular: ClientePublico }> {
    const dados = await this.clientes.exportarTitular(eu, id);
    res.setHeader('Content-Disposition', `attachment; filename="titular-${id}.json"`);
    return dados;
  }

  @Post(':id/anonimizar')
  @HttpCode(200)
  anonimizar(@UsuarioLogado() eu: UsuarioAtual, @Param('id', ParseUUIDPipe) id: string): Promise<ClientePublico> {
    return this.clientes.anonimizarTitular(eu, id);
  }
}
