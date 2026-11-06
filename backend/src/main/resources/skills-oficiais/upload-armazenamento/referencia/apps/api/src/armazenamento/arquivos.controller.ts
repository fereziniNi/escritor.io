// origem: skills-modelo/apps/api/src/armazenamento/arquivos.controller.ts
import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { type Request, type Response } from 'express';
import { z } from 'zod';
import { type Config } from '../config/config';
import { CONFIG } from '../config/config.module';
import { contentDisposition } from '../exportacao/content-disposition';
import { LimitadorJanelaFixa, recusarPorLimite } from '../seguranca/limitador';
import { MesmaOrigem } from '../seguranca/origem.guard';
import { Papeis } from '../usuarios/papeis.guard';
import { type UsuarioAtual, UsuarioLogado } from '../usuarios/usuario-atual';
import { validarOu400 } from '../usuarios/usuarios.service';
import { ESCOPOS } from './arquivo.tabela';
import { type ArquivoParaBaixar, type ArquivoPublico, ArquivosService } from './arquivos.service';
import { receberUpload } from './receber-upload';

const esquemaCampos = z.object({ escopo: z.enum(ESCOPOS).default('PRIVADO') });
const esquemaLink = z.object({ exp: z.string().optional(), sig: z.string().optional() });

/**
 * Entrega SEMPRE como anexo, nunca inline: o tipo vem do conteúdo (PDF, PNG, JPEG, XLSX), o `Content-Disposition` é o da
 * skill exportacao-excel-pdf-csv (nome do cliente só como texto seguro), `nosniff` impede o navegador de "adivinhar" outro
 * tipo e a CSP `sandbox` neutraliza qualquer coisa que mesmo assim fosse aberta. Um arquivo enviado nunca roda no domínio do sistema.
 */
function enviarComoAnexo(res: Response, a: ArquivoParaBaixar): StreamableFile {
  res.setHeader('Content-Type', a.tipo);
  res.setHeader('Content-Disposition', contentDisposition(a.nome));
  res.setHeader('Content-Length', String(a.tamanho));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
  // Cliente desconectou no meio: solta o objeto (arquivo aberto ou conexão com o provedor).
  res.on('close', () => {
    if (!res.writableFinished) a.stream.destroy();
  });
  return new StreamableFile(a.stream);
}

@Controller('arquivos')
export class ArquivosController {
  /** Uploads por minuto por usuário (UPLOAD_LIMITE_POR_MIN), em memória da instância. O limite por IP da /api vale além deste. */
  private readonly limiteDeUpload: LimitadorJanelaFixa;

  constructor(
    private readonly arquivos: ArquivosService,
    @Inject(CONFIG) config: Config,
  ) {
    this.limiteDeUpload = new LimitadorJanelaFixa(config.UPLOAD_LIMITE_POR_MIN, 60_000);
  }

  /**
   * Upload `multipart/form-data`: campo `escopo` (opcional, ANTES do arquivo) e campo `arquivo`. A origem é conferida pelo
   * middleware da skill seguranca (POST de outro site → 403). Erro no meio: responde e fecha a conexão (não lê o resto do corpo).
   */
  @Post()
  @Papeis('ADMIN', 'GESTOR', 'USUARIO')
  async enviar(@UsuarioLogado() eu: UsuarioAtual, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<ArquivoPublico> {
    let upload;
    try {
      const espera = this.limiteDeUpload.registrar(`upload:${eu.id}`);
      if (espera !== null) recusarPorLimite(res, espera);
      upload = await receberUpload(req, this.arquivos.limiteBytes);
      if (!upload.arquivo) throw new BadRequestException('Envie o arquivo no campo "arquivo"');
      const { escopo } = validarOu400(esquemaCampos, upload.campos);
      const criado = await this.arquivos.enviar(eu, { stream: upload.arquivo.stream, nomeDoCliente: upload.arquivo.nomeDoCliente, escopo });
      try {
        await upload.concluir();
      } catch (e) {
        await this.arquivos.remover(eu, criado.id); // arquivos a mais ou corpo quebrado: desfaz o que já foi guardado
        throw e;
      }
      return criado;
    } catch (e) {
      upload?.abortar();
      res.setHeader('Connection', 'close');
      res.once('finish', () => req.destroy());
      throw e;
    }
  }

  @Get()
  @Papeis('ADMIN', 'GESTOR', 'USUARIO')
  listar(@UsuarioLogado() eu: UsuarioAtual): Promise<ArquivoPublico[]> {
    return this.arquivos.listar(eu);
  }

  /**
   * Link assinado do armazenamento LOCAL: sem sessão, vale a assinatura (HMAC) e a expiração. Declarado antes das rotas com `:id`.
   * Em S3/Azure o link é o do próprio provedor e esta rota responde 404.
   */
  @Get('assinado/:chave')
  async baixarPorLink(@Param('chave') chave: string, @Query() consulta: unknown, @Res({ passthrough: true }) res: Response): Promise<StreamableFile> {
    const { exp, sig } = validarOu400(esquemaLink, consulta);
    return enviarComoAnexo(res, await this.arquivos.baixarPorLinkLocal(chave, exp ?? null, sig ?? null));
  }

  @Get(':id/download')
  @Papeis('ADMIN', 'GESTOR', 'USUARIO')
  @MesmaOrigem()
  async baixar(@UsuarioLogado() eu: UsuarioAtual, @Param('id', ParseUUIDPipe) id: string, @Res({ passthrough: true }) res: Response): Promise<StreamableFile> {
    return enviarComoAnexo(res, await this.arquivos.baixar(eu, id));
  }

  @Post(':id/link')
  @HttpCode(200)
  @Papeis('ADMIN', 'GESTOR', 'USUARIO')
  link(@UsuarioLogado() eu: UsuarioAtual, @Param('id', ParseUUIDPipe) id: string): Promise<{ url: string; expiraEm: string }> {
    return this.arquivos.linkAssinado(eu, id);
  }

  @Delete(':id')
  @HttpCode(204)
  @Papeis('ADMIN', 'GESTOR', 'USUARIO')
  async remover(@UsuarioLogado() eu: UsuarioAtual, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.arquivos.remover(eu, id);
  }
}
