import { type DestinationStream } from 'pino';
import { cpfValido } from './cpf';
import { mascararCpf, mascararCpfEmTexto } from './mascarar';

/**
 * Nunca logar dado pessoal. Duas barreiras (a regra principal continua sendo NÃO passar o dado ao logger):
 * 1. `redact` do pino com os campos abaixo (no topo do objeto logado e um nível abaixo): o valor vira `[REDACTED]`.
 * 2. `destinoSemDadosPessoais`: cada linha pronta é varrida e todo CPF que sobrou (na mensagem, num campo qualquer, na
 *    mensagem ou na pilha de um erro) sai mascarado (`***.456.789-**`). Só CPF: e-mail, nome ou telefone em texto livre
 *    NÃO são achados pela varredura (só pelo `redact`, quando estão num campo com o nome certo).
 */
const CAMPOS = ['cpf', 'email', 'telefone', 'celular', 'dataNascimento', 'rg'];
export const CAMPOS_PESSOAIS_LOG: readonly string[] = CAMPOS.flatMap((c) => [c, `*.${c}`]);

function varrer(valor: unknown): unknown {
  if (typeof valor === 'string') return mascararCpfEmTexto(valor);
  // CPF como número (11 dígitos) só se for CPF válido; vira texto mascarado.
  if (typeof valor === 'number' && Number.isInteger(valor) && String(valor).length === 11 && cpfValido(String(valor))) return mascararCpf(String(valor));
  if (Array.isArray(valor)) return valor.map(varrer);
  if (valor !== null && typeof valor === 'object') return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, varrer(v)]));
  return valor;
}

/** Uma linha de log (JSON do pino + `\n`) com todo CPF mascarado. Linha sem CPF passa idêntica (sem parse). */
export function redigirLinhaLog(linha: string): string {
  const varrida = mascararCpfEmTexto(linha);
  if (varrida === linha) return linha;
  const fim = linha.endsWith('\n') ? '\n' : '';
  try {
    return `${JSON.stringify(varrer(JSON.parse(linha) as unknown))}${fim}`;
  } catch {
    return varrida;
  }
}

/** O que o pino usa do destino além de `write` (sonic-boom): esvaziar o buffer no desligamento e fechar. */
type DestinoCompleto = DestinationStream & { flushSync?: () => void; end?: () => void };

/**
 * Embrulha o destino do pino (stdout em produção, memória nos testes) com a varredura de CPF. Repassa `flushSync` e `end`
 * quando o destino original os tem: sem isso, as últimas linhas antes de a API cair poderiam se perder.
 */
export function destinoSemDadosPessoais(destino: DestinoCompleto): DestinoCompleto {
  const embrulho: DestinoCompleto = { write: (linha: string) => destino.write(redigirLinhaLog(linha)) };
  if (typeof destino.flushSync === 'function') embrulho.flushSync = () => destino.flushSync!();
  if (typeof destino.end === 'function') embrulho.end = () => destino.end!();
  return embrulho;
}
