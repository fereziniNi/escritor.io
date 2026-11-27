// origem: skills-modelo/apps/api/src/saude/saude.controller.ts
import { Controller, Get, HttpStatus, Inject, Res } from '@nestjs/common';
import { type RespostaSaude } from 'contratos';
import { sql } from 'drizzle-orm';
import { type Response } from 'express';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { BANCO, type Db } from '../banco/banco';
import { type Config } from '../config/config';
import { CONFIG } from '../config/config.module';

const PRAZO_PING_BANCO_MS = 2_000;

/**
 * GET /api/health: público, sem dado sensível. 200 com banco respondendo; 503 com o banco fora (o healthcheck do
 * compose e o Caddy tiram a instância de circulação). Versão e commit vêm do build da imagem.
 */
@Controller('health')
export class SaudeController {
  constructor(
    @Inject(BANCO) private readonly db: Db,
    @Inject(CONFIG) private readonly config: Config,
    @InjectPinoLogger(SaudeController.name) private readonly log: PinoLogger,
  ) {}

  @Get()
  async verificar(@Res({ passthrough: true }) res: Response): Promise<RespostaSaude> {
    const bancoOk = await this.pingBanco();
    res.status(bancoOk ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return {
      status: bancoOk ? 'ok' : 'erro',
      banco: bancoOk ? 'ok' : 'erro',
      versao: this.config.APP_VERSAO,
      commit: this.config.APP_COMMIT,
    };
  }

  private async pingBanco(): Promise<boolean> {
    let timer: NodeJS.Timeout | undefined;
    try {
      const prazo = new Promise<never>((_, rejeitar) => {
        timer = setTimeout(() => rejeitar(new Error('prazo do ping ao banco esgotado')), PRAZO_PING_BANCO_MS);
      });
      await Promise.race([this.db.execute(sql`select 1`), prazo]);
      return true;
    } catch (e) {
      const erro = e as { code?: string; message?: string };
      this.log.warn({ erroBanco: { code: erro.code, message: erro.message } }, 'health: banco indisponível');
      return false;
    } finally {
      clearTimeout(timer);
    }
  }
}
