// origem: skills-modelo/apps/api/src/lgpd/mascarar-dados.interceptor.ts
import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor, StreamableFile } from '@nestjs/common';
import { type Request } from 'express';
import { map, type Observable } from 'rxjs';
import { type Papel } from '../usuarios/papel';
import { mascararCpf, mascararCpfEmTexto, mascararEmail } from './mascarar';

/** Quem vê CPF e e-mail completos. Os demais (USUARIO, sem sessão, papel novo) veem mascarado: falha fechada. */
const PAPEIS_QUE_VEEM: readonly Papel[] = ['ADMIN', 'GESTOR'];

export const podeVerDadosPessoais = (papel: Papel | undefined): boolean => papel !== undefined && PAPEIS_QUE_VEEM.includes(papel);

/**
 * Máscara de uma resposta JSON: chave `cpf` → `***.456.789-**`; chave `email` → `a***@dominio`; CPF dentro de qualquer
 * outro texto também. Exceção: o objeto que É o próprio usuário logado (`id` igual ao dele) mantém o e-mail (o perfil
 * "eu" mostra o próprio e-mail).
 */
export function mascararResposta(valor: unknown, idUsuario?: string): unknown {
  if (typeof valor === 'string') return mascararCpfEmTexto(valor);
  if (Array.isArray(valor)) return valor.map((v) => mascararResposta(v, idUsuario));
  // Arquivo (StreamableFile, Buffer) e Date passam como estão: download binário não é JSON.
  if (valor === null || typeof valor !== 'object' || valor instanceof Date || Buffer.isBuffer(valor) || valor instanceof StreamableFile) return valor;
  const objeto = valor as Record<string, unknown>;
  const proprio = idUsuario !== undefined && objeto['id'] === idUsuario;
  return Object.fromEntries(
    Object.entries(objeto).map(([k, v]) => {
      if (k === 'cpf' && typeof v === 'string') return [k, mascararCpf(v)];
      if (k === 'email' && typeof v === 'string') return [k, proprio ? v : mascararEmail(v)];
      return [k, mascararResposta(v, idUsuario)];
    }),
  );
}

/**
 * Global (APP_INTERCEPTOR do LgpdModule): toda resposta de rota para quem não é GESTOR/ADMIN sai mascarada.
 * Rota nova não precisa lembrar de nada. Erros (FiltroErros) não passam por aqui: não ponha dado pessoal em mensagem
 * de erro.
 */
@Injectable()
export class MascararDadosPessoaisInterceptor implements NestInterceptor {
  intercept(contexto: ExecutionContext, proximo: CallHandler): Observable<unknown> {
    if (contexto.getType() !== 'http') return proximo.handle();
    const usuario = contexto.switchToHttp().getRequest<Request>().usuario;
    if (podeVerDadosPessoais(usuario?.papel)) return proximo.handle();
    return proximo.handle().pipe(map((corpo: unknown) => mascararResposta(corpo, usuario?.id)));
  }
}
