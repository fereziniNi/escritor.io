// origem: skills-modelo/apps/web/src/lib/api.ts
import { type RespostaSaude, esquemaRespostaSaude } from 'contratos';

/** Erro de chamada à API com o status HTTP (0 = sem resposta: rede, API fora do ar). */
export class ErroApi extends Error {
  constructor(
    readonly status: number,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = 'ErroApi';
  }
}

/**
 * GET em /api/* no mesmo host (cookies de sessão vão juntos). Valida a resposta com o esquema do pacote contratos:
 * se a API mudar o formato, o erro aparece aqui, não espalhado pela tela.
 */
export async function pedir<T>(caminho: string, esquema: { parse: (v: unknown) => T }, aceitar: number[] = []): Promise<T> {
  let res: Response;
  try {
    res = await fetch(caminho, { headers: { accept: 'application/json' }, credentials: 'same-origin' });
  } catch {
    throw new ErroApi(0, 'API indisponível');
  }
  if (!res.ok && !aceitar.includes(res.status)) {
    const corpo = (await res.json().catch(() => null)) as { erro?: string } | null;
    throw new ErroApi(res.status, corpo?.erro ?? `Erro ${res.status}`);
  }
  return esquema.parse(await res.json());
}

/** /api/health responde 503 com corpo válido quando o banco está fora: a tela mostra isso, não um erro genérico. */
export const buscarSaude = (): Promise<RespostaSaude> => pedir('/api/health', esquemaRespostaSaude, [503]);
