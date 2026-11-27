import { type Papel, type Usuario, esquemaListaUsuarios, esquemaUsuario } from 'contratos';
import { ErroApi, pedir } from '@/lib/api';

/**
 * POST/PATCH em /api/*. O navegador envia o Origin sozinho; a API (skill seguranca) recusa o de outro site.
 * Erro da API vira ErroApi com a mensagem em português que ela devolveu ({ erro }).
 */
async function enviar(metodo: 'POST' | 'PATCH', caminho: string, corpo: object = {}): Promise<Usuario> {
  let res: Response;
  try {
    res = await fetch(caminho, {
      method: metodo,
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(corpo),
    });
  } catch {
    throw new ErroApi(0, 'API indisponível');
  }
  if (!res.ok) {
    const erro = (await res.json().catch(() => null)) as { erro?: string } | null;
    throw new ErroApi(res.status, erro?.erro ?? `Erro ${res.status}`);
  }
  return esquemaUsuario.parse(await res.json());
}

export const listarUsuarios = (): Promise<Usuario[]> => pedir('/api/usuarios', esquemaListaUsuarios);

export const convidarUsuario = (dados: { email: string; nome: string; papel: Papel }): Promise<Usuario> => enviar('POST', '/api/usuarios', dados);

export const alterarPapelUsuario = (id: string, papel: Papel): Promise<Usuario> => enviar('PATCH', `/api/usuarios/${id}/papel`, { papel });

export const desativarUsuario = (id: string): Promise<Usuario> => enviar('POST', `/api/usuarios/${id}/desativar`);

export const reativarUsuario = (id: string): Promise<Usuario> => enviar('POST', `/api/usuarios/${id}/reativar`);
