const ID_MODELO = /^[A-Za-z0-9._:/-]{1,100}$/;

/** Padrões do padrão Multiplica quando nem LLM_MODELO_<TAREFA> nem LLM_MODELO_PADRAO/RAPIDO estão definidas. */
export const MODELO_PADRAO = 'claude-sonnet-5-5';
export const MODELO_RAPIDO = 'claude-haiku-5-5';

/** `extrair-dados` → `EXTRAIR_DADOS`. */
const sufixo = (tarefa: string): string => tarefa.toUpperCase().replace(/[^A-Z0-9]+/g, '_');

function lerModelo(env: Record<string, string | undefined>, nome: string): string | undefined {
  const valor = env[nome];
  if (valor === undefined || valor === '') return undefined;
  if (!ID_MODELO.test(valor)) throw new Error(`${nome}: id de modelo inválido`);
  return valor;
}

/**
 * Modelo de uma tarefa de IA. Cada tarefa pode ter o próprio modelo em `LLM_MODELO_<TAREFA>` (a tarefa `resumo` lê
 * `LLM_MODELO_RESUMO`); sem ela, a tarefa `rapido` usa `LLM_MODELO_RAPIDO` (padrão claude-haiku-5-5) e as demais usam
 * `LLM_MODELO_PADRAO` (padrão claude-sonnet-5-5). Variável vazia vale como ausente; id com caractere estranho lança erro.
 */
export function modeloPara(tarefa: string, env: Record<string, string | undefined> = process.env): string {
  const proprio = lerModelo(env, `LLM_MODELO_${sufixo(tarefa)}`);
  if (proprio !== undefined) return proprio;
  if (sufixo(tarefa) === 'RAPIDO') return MODELO_RAPIDO;
  return lerModelo(env, 'LLM_MODELO_PADRAO') ?? MODELO_PADRAO;
}
