import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import { type Request } from 'express';
import { map, type Observable } from 'rxjs';
import { type Papel } from '../usuarios/papel';
import { mascararCpf, mascararCpfEmTexto, mascararEmail } from './mascarar';

/** Quem vê CPF e e-mail completos. Os demais (USUARIO, sem sessão, papel novo) veem mascarado: falha fechada. */
const PAPEIS_QUE_VEEM: readonly Papel[] = ['ADMIN', 'GESTOR'];

export const podeVerDadosPessoais = (papel: Papel | undefined): boolean => papel !== undefined && PAPEIS_QUE_VEEM.includes(papel);

/** Chaves mascaradas pelo nome: começam com cpf ou email, sem diferenciar maiúsculas (`cpf`, `cpfConjuge`, `emails`, `EmailContato`). */
const CHAVE_CPF = /^cpf/i;
const CHAVE_EMAIL = /^email/i;

/** Objeto literal (o que a rota devolve como JSON). Instância de classe (Date, StreamableFile, Buffer, Decimal...) não é aberta. */
const ehObjetoSimples = (v: object): boolean => {
  const proto = Object.getPrototypeOf(v) as unknown;
  return proto === Object.prototype || proto === null;
};

/** Aplica `mascara` a um texto ou a cada texto de uma lista; o resto segue a máscara geral. */
function mascararCampo(v: unknown, mascara: (t: string) => string, idUsuario: string | undefined): unknown {
  if (typeof v === 'string') return mascara(v);
  if (Array.isArray(v)) return v.map((item) => (typeof item === 'string' ? mascara(item) : mascararResposta(item, idUsuario)));
  return mascararResposta(v, idUsuario);
}

/**
 * Máscara de uma resposta JSON: chave que começa com `cpf` → `***.456.789-**`; chave que começa com `email` →
 * `a***@dominio` (texto ou lista de textos); CPF dentro de qualquer outro texto também. Só objetos literais e listas são
 * percorridos: devolva DTO como objeto literal (instância de classe passa sem máscara, para não destruir Date, arquivo etc.).
 * Exceção: o objeto que É o próprio usuário logado (`id` igual ao dele) mantém os e-mails (o perfil "eu").
 */
export function mascararResposta(valor: unknown, idUsuario?: string): unknown {
  if (typeof valor === 'string') return mascararCpfEmTexto(valor);
  if (Array.isArray(valor)) return valor.map((v) => mascararResposta(v, idUsuario));
  if (valor === null || typeof valor !== 'object' || !ehObjetoSimples(valor)) return valor;
  const objeto = valor as Record<string, unknown>;
  const proprio = idUsuario !== undefined && objeto['id'] === idUsuario;
  return Object.fromEntries(
    Object.entries(objeto).map(([k, v]) => {
      if (CHAVE_CPF.test(k)) return [k, mascararCampo(v, mascararCpf, idUsuario)];
      if (CHAVE_EMAIL.test(k)) return [k, proprio ? v : mascararCampo(v, mascararEmail, idUsuario)];
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
