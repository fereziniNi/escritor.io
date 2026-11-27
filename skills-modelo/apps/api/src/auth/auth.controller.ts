import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { RESPOSTA_PEDIR_CODIGO, type UsuarioLogado as UsuarioLogadoResposta, esquemaEntrar, esquemaPedirCodigo } from 'contratos';
import { type CookieOptions, type Request, type Response } from 'express';
import { type Config } from '../config/config';
import { CONFIG } from '../config/config.module';
import { LimitadorJanelaFixa, chaveDeIp, recusarPorLimite } from '../seguranca/limitador';
import { type UsuarioAtual, UsuarioLogado } from '../usuarios/usuario-atual';
import { validarOu400 } from '../usuarios/usuarios.service';
import { AuthService } from './auth.service';
import { cookieSessao, lerCookie } from './cookie-sessao';
import { TEMPO_MINIMO_RESPOSTA_MS, comTempoMinimo } from './regras-auth';
import { ExigirSessao } from './sessao.guard';

/** Pedidos de código por IP a cada 10 min (por instância). Escritório atrás de um IP só: ~30 pessoas entrando juntas. */
export const LIMITE_IP_CODIGO = 30;
/** Tentativas de entrar por IP a cada 10 min (por instância). */
export const LIMITE_IP_ENTRAR = 30;
const JANELA_IP_MS = 10 * 60_000;

const MENSAGEM_FALHA = 'Código inválido ou expirado';

/**
 * Rotas do login (públicas: são elas que autenticam). Toda mutação passa antes pela guarda de origem da skill
 * seguranca. Pedir código responde SEMPRE 202 com o mesmo corpo e nunca antes de 600 ms; entrar também respeita o
 * tempo mínimo e falha sempre com a mesma mensagem.
 */
@Controller('auth')
export class AuthController {
  readonly #limiteCodigo = new LimitadorJanelaFixa(LIMITE_IP_CODIGO, JANELA_IP_MS);
  readonly #limiteEntrar = new LimitadorJanelaFixa(LIMITE_IP_ENTRAR, JANELA_IP_MS);
  private readonly cookie: { nome: string; opcoes: CookieOptions };

  constructor(
    private readonly auth: AuthService,
    @Inject(CONFIG) private readonly config: Config,
  ) {
    this.cookie = cookieSessao(config);
  }

  @Post('codigo')
  @HttpCode(202)
  async pedirCodigo(@Body() corpo: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<typeof RESPOSTA_PEDIR_CODIGO> {
    this.limitar(this.#limiteCodigo, 'codigo', req, res);
    const { email } = validarOu400(esquemaPedirCodigo, corpo);
    await comTempoMinimo(TEMPO_MINIMO_RESPOSTA_MS, () => this.auth.pedirCodigo(email, req.ip));
    return RESPOSTA_PEDIR_CODIGO;
  }

  @Post('entrar')
  @HttpCode(204)
  async entrar(@Body() corpo: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    this.limitar(this.#limiteEntrar, 'entrar', req, res);
    const { email, codigo } = validarOu400(esquemaEntrar, corpo);
    const token = await comTempoMinimo(TEMPO_MINIMO_RESPOSTA_MS, () => this.auth.entrar(email, codigo, req.ip));
    if (token === null) throw new UnauthorizedException(MENSAGEM_FALHA);
    res.cookie(this.cookie.nome, token, { ...this.cookie.opcoes, maxAge: this.config.AUTH_SESSAO_ABSOLUTA_H * 3_600_000 });
  }

  /** Revoga a sessão do cookie (se houver) e apaga o cookie. Sem sessão também responde 204. */
  @Post('sair')
  @HttpCode(204)
  async sair(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.sair(lerCookie(req.get('cookie'), this.cookie.nome), req.ip);
    res.clearCookie(this.cookie.nome, this.cookie.opcoes);
  }

  /** Quem está logado, com o papel lido do banco nesta requisição. Sem sessão válida → 401. */
  @Get('eu')
  @ExigirSessao()
  eu(@UsuarioLogado() u: UsuarioAtual): UsuarioLogadoResposta {
    return { id: u.id, email: u.email, nome: u.nome, papel: u.papel };
  }

  private limitar(limitador: LimitadorJanelaFixa, rota: string, req: Request, res: Response): void {
    const espera = limitador.registrar(`${rota}:${chaveDeIp(req.ip)}`);
    if (espera !== null) recusarPorLimite(res, espera);
  }
}
