import { type UsuarioLogado, esquemaRespostaPedirCodigo, esquemaUsuarioLogado } from 'contratos';
import { ErroApi } from '@/lib/api';

/** Chamada à API de login. O cookie de sessão (HttpOnly) vai e volta sozinho; o JavaScript nunca o lê. */
async function chamar(metodo: 'GET' | 'POST', caminho: string, corpo?: object): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(caminho, {
      method: metodo,
      headers: corpo ? { accept: 'application/json', 'content-type': 'application/json' } : { accept: 'application/json' },
      credentials: 'same-origin',
      ...(corpo ? { body: JSON.stringify(corpo) } : {}),
    });
  } catch {
    throw new ErroApi(0, 'API indisponível');
  }
  return res;
}

async function erroDe(res: Response): Promise<ErroApi> {
  const corpo = (await res.json().catch(() => null)) as { erro?: string } | null;
  return new ErroApi(res.status, corpo?.erro ?? `Erro ${res.status}`);
}

/** Quem está logado (papel lido do banco pela API), ou null sem sessão válida (401). */
export async function buscarEu(): Promise<UsuarioLogado | null> {
  const res = await chamar('GET', '/api/auth/eu');
  if (res.status === 401) return null;
  if (!res.ok) throw await erroDe(res);
  return esquemaUsuarioLogado.parse(await res.json());
}

/** Pede o código. A API responde sempre a mesma mensagem (não diz se o e-mail tem acesso). */
export async function pedirCodigo(email: string): Promise<string> {
  const res = await chamar('POST', '/api/auth/codigo', { email });
  if (!res.ok) throw await erroDe(res);
  return esquemaRespostaPedirCodigo.parse(await res.json()).mensagem;
}

/** Troca e-mail + código pela sessão (cookie). Código errado ou vencido: ErroApi 401 "Código inválido ou expirado". */
export async function entrar(email: string, codigo: string): Promise<void> {
  const res = await chamar('POST', '/api/auth/entrar', { email, codigo });
  if (!res.ok) throw await erroDe(res);
}

/** Encerra a sessão no servidor (revoga) e apaga o cookie. */
export async function sair(): Promise<void> {
  const res = await chamar('POST', '/api/auth/sair', {});
  if (!res.ok) throw await erroDe(res);
}
