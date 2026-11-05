// origem: skills-modelo/apps/api/src/config/segredo.ts
import { readFileSync } from 'node:fs';
import { inspect } from 'node:util';

const OCULTO = '[REDACTED]';

/**
 * Valor sensível (senha, chave, URL com senha). Só `revelar()` devolve o valor; JSON, String(), template string e
 * console/inspect mostram [REDACTED]. Defesa em profundidade: se a configuração inteira for logada ou serializada por
 * engano, o segredo não vaza.
 */
export class Segredo {
  readonly #valor: string;

  constructor(valor: string) {
    this.#valor = valor;
  }

  revelar(): string {
    return this.#valor;
  }

  toJSON(): string {
    return OCULTO;
  }

  toString(): string {
    return OCULTO;
  }

  [inspect.custom](): string {
    return OCULTO;
  }
}

/**
 * Lê um valor que pode vir do ambiente (`NOME`) ou de um arquivo (`NOME_ARQUIVO`, ex.: Docker secret em
 * /run/secrets/...). O conteúdo do arquivo perde só os espaços e quebras de linha das pontas. Definir os dois é erro
 * (ambíguo). As mensagens de erro citam o nome da variável e o caminho, nunca o conteúdo.
 */
export function lerSegredo(env: NodeJS.ProcessEnv, nome: string): string | undefined {
  const nomeArquivo = `${nome}_ARQUIVO`;
  const direto = env[nome];
  const caminho = env[nomeArquivo];
  if (caminho !== undefined && caminho !== '') {
    if (direto !== undefined && direto !== '') {
      throw new Error(`${nome} e ${nomeArquivo} definidos ao mesmo tempo: use só um`);
    }
    try {
      return readFileSync(caminho, 'utf8').trim();
    } catch (e) {
      const codigo = (e as NodeJS.ErrnoException).code ?? 'erro';
      throw new Error(`${nomeArquivo}: não foi possível ler ${caminho} (${codigo})`, { cause: e });
    }
  }
  return direto;
}
