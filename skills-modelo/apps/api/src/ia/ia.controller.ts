import { Body, Controller, HttpCode, Inject, Post, Res } from '@nestjs/common';
import { type Response } from 'express';
import { z } from 'zod';
import { type Config } from '../config/config';
import { CONFIG } from '../config/config.module';
import { LimitadorJanelaFixa, recusarPorLimite } from '../seguranca/limitador';
import { Papeis } from '../usuarios/papeis.guard';
import { type UsuarioAtual, UsuarioLogado } from '../usuarios/usuario-atual';
import { validarOu400 } from '../usuarios/usuarios.service';
import { IaService, type ResumoPublico } from './ia.service';

const esquemaResumir = z.object({ texto: z.string().trim().min(1).max(20_000) });

/**
 * Exemplo de rota de IA. Só GESTOR e ADMIN (custo e dado do cliente); POST, então a checagem de origem da skill seguranca vale;
 * limite de IA_LIMITE_POR_MIN pedidos por minuto por usuário (em memória da instância); cada uso fica na trilha como `ia.resumir`.
 * Toda rota de IA nova segue este molde: papel, limite por usuário, tamanho máximo do texto e auditoria sem o conteúdo.
 */
@Controller('ia')
export class IaController {
  private readonly limite: LimitadorJanelaFixa;

  constructor(
    private readonly ia: IaService,
    @Inject(CONFIG) config: Config,
  ) {
    this.limite = new LimitadorJanelaFixa(config.IA_LIMITE_POR_MIN, 60_000);
  }

  @Post('resumir')
  @HttpCode(200)
  @Papeis('ADMIN', 'GESTOR')
  resumir(@UsuarioLogado() eu: UsuarioAtual, @Body() corpo: unknown, @Res({ passthrough: true }) res: Response): Promise<ResumoPublico> {
    const espera = this.limite.registrar(`ia:${eu.id}`);
    if (espera !== null) recusarPorLimite(res, espera);
    return this.ia.resumir(eu, validarOu400(esquemaResumir, corpo).texto);
  }
}
