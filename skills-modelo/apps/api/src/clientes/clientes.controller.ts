import { Body, Controller, Get, Header, HttpCode, Param, ParseUUIDPipe, Post, Query, Res, type StreamableFile } from '@nestjs/common';
import { type Response } from 'express';
import { z } from 'zod';
import { enviarArquivo, esquemaExportar } from '../exportacao/exportacao.service';
import { cpfValido } from '../lgpd/cpf';
import { Papeis } from '../usuarios/papeis.guard';
import { type UsuarioAtual, UsuarioLogado } from '../usuarios/usuario-atual';
import { validarOu400 } from '../usuarios/usuarios.service';
import { type ClientePublico, ClientesService } from './clientes.service';

// CPF com ou sem pontuação, dígitos verificadores conferidos. Inválido → 400 (a mensagem não repete o valor).
const cpf = z.string().refine(cpfValido);
const esquemaCliente = z.object({
  nome: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)).optional(),
  cpf,
});
const esquemaBusca = z.object({ cpf });

/**
 * Exemplo de cadastro com dado pessoal. Toda resposta passa pelo interceptor de máscara: USUARIO vê
 * `***.456.789-**` e `a***@dominio`; GESTOR e ADMIN veem completo. CPF só no corpo (POST), nunca na URL: URL vai
 * para log de proxy e histórico do navegador.
 */
@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientes: ClientesService) {}

  @Get()
  @Papeis('ADMIN', 'GESTOR', 'USUARIO')
  listar(@UsuarioLogado() eu: UsuarioAtual): Promise<ClientePublico[]> {
    return this.clientes.listar(eu);
  }

  @Post()
  @Papeis('ADMIN', 'GESTOR', 'USUARIO')
  criar(@UsuarioLogado() eu: UsuarioAtual, @Body() corpo: unknown): Promise<ClientePublico> {
    return this.clientes.criar(eu, validarOu400(esquemaCliente, corpo));
  }

  /**
   * Busca exata por CPF (índice cego). POST para o CPF ir no corpo. Só GESTOR e ADMIN: quem vê o CPF mascarado
   * (`***.456.789-**`) acharia o CPF completo em no máximo 1000 buscas (só os 3 primeiros dígitos são desconhecidos; os
   * verificadores saem deles). Cada busca fica na trilha (`cliente.buscar_cpf`).
   */
  @Post('busca-cpf')
  @HttpCode(200)
  @Papeis('ADMIN', 'GESTOR')
  buscarPorCpf(@UsuarioLogado() eu: UsuarioAtual, @Body() corpo: unknown): Promise<ClientePublico> {
    return this.clientes.buscarPorCpf(eu, validarOu400(esquemaBusca, corpo).cpf);
  }

  /**
   * Exporta a lista (`?formato=xlsx|pdf|csv`). Declarada ANTES de `:id` (senão `exportar` seria lido como id). A máscara
   * segue o papel de quem pede, igual à lista JSON; fica na trilha como `cliente.exportar`.
   */
  @Get('exportar')
  @Papeis('ADMIN', 'GESTOR', 'USUARIO')
  @Header('Cache-Control', 'no-store')
  async exportar(@UsuarioLogado() eu: UsuarioAtual, @Query() consulta: unknown, @Res({ passthrough: true }) res: Response): Promise<StreamableFile> {
    return enviarArquivo(res, await this.clientes.exportar(eu, validarOu400(esquemaExportar, consulta).formato));
  }

  @Get(':id')
  @Papeis('ADMIN', 'GESTOR', 'USUARIO')
  obter(@UsuarioLogado() eu: UsuarioAtual, @Param('id', ParseUUIDPipe) id: string): Promise<ClientePublico> {
    return this.clientes.obter(eu, id);
  }

  @Post(':id/encerrar')
  @HttpCode(200)
  @Papeis('ADMIN', 'GESTOR')
  encerrar(@UsuarioLogado() eu: UsuarioAtual, @Param('id', ParseUUIDPipe) id: string): Promise<ClientePublico> {
    return this.clientes.encerrar(eu, id);
  }
}
