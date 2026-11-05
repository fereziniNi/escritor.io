// origem: skills-modelo/apps/api/src/usuarios/usuarios.controller.ts
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { z } from 'zod';
import { PAPEIS } from './papel';
import { Papeis } from './papeis.guard';
import { type UsuarioAtual, UsuarioLogado } from './usuario-atual';
import { UsuariosService, type UsuarioPublico, validarOu400 } from './usuarios.service';

// Papel inválido (inclusive "admin" minúsculo) é 400: o enum do zod compara por igualdade exata.
const papel = z.enum(PAPEIS);
const esquemaConvite = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  nome: z.string().trim().min(1).max(120),
  papel,
});
const esquemaTrocaPapel = z.object({ papel });

/** Rotas de usuários. Cada rota declara o papel; o serviço confere de novo (defesa em profundidade). */
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  @Get()
  @Papeis('ADMIN')
  listar(@UsuarioLogado() eu: UsuarioAtual): Promise<UsuarioPublico[]> {
    return this.usuarios.listar(eu);
  }

  /** Antes de `:id` para "eu" não ser lido como id. Qualquer papel logado. */
  @Get('eu')
  @Papeis(...PAPEIS)
  eu(@UsuarioLogado() eu: UsuarioAtual): Promise<UsuarioPublico> {
    return this.usuarios.perfil(eu, eu.id);
  }

  @Get(':id')
  @Papeis(...PAPEIS)
  perfil(@UsuarioLogado() eu: UsuarioAtual, @Param('id', ParseUUIDPipe) id: string): Promise<UsuarioPublico> {
    return this.usuarios.perfil(eu, id);
  }

  @Post()
  @Papeis('ADMIN')
  convidar(@UsuarioLogado() eu: UsuarioAtual, @Body() corpo: unknown): Promise<UsuarioPublico> {
    return this.usuarios.convidar(eu, validarOu400(esquemaConvite, corpo));
  }

  @Patch(':id/papel')
  @Papeis('ADMIN')
  alterarPapel(@UsuarioLogado() eu: UsuarioAtual, @Param('id', ParseUUIDPipe) id: string, @Body() corpo: unknown): Promise<UsuarioPublico> {
    return this.usuarios.alterarPapel(eu, id, validarOu400(esquemaTrocaPapel, corpo).papel);
  }

  @Post(':id/desativar')
  @HttpCode(200)
  @Papeis('ADMIN')
  desativar(@UsuarioLogado() eu: UsuarioAtual, @Param('id', ParseUUIDPipe) id: string): Promise<UsuarioPublico> {
    return this.usuarios.desativar(eu, id);
  }

  @Post(':id/reativar')
  @HttpCode(200)
  @Papeis('ADMIN')
  reativar(@UsuarioLogado() eu: UsuarioAtual, @Param('id', ParseUUIDPipe) id: string): Promise<UsuarioPublico> {
    return this.usuarios.reativar(eu, id);
  }
}
