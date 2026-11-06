// origem: skills-modelo/apps/api/src/lgpd/mascarar.ts
import { cpfValido } from './cpf';

/**
 * Máscaras de dado pessoal (LGPD). Formato fixo do padrão Multiplica:
 * - CPF: `***.456.789-**` (só os 6 dígitos do meio, como nas publicações oficiais);
 * - e-mail: `a***@exemplo.com.br` (primeira letra + domínio).
 * As skills anteriores (email-transacional em `email/enviador-email.ts` e trilha-auditoria em `auditoria/sanitizar.ts`)
 * têm a própria cópia de `mascararEmail` para funcionar sem esta skill; `mascarar.spec.ts` garante que as três
 * mascaram igual. Código novo usa as daqui.
 */
const CPF_TODO_MASCARADO = '***.***.***-**';

/** `12345678909` ou `123.456.789-09` → `***.456.789-**`. O que não for CPF de 11 dígitos sai todo mascarado. */
export function mascararCpf(cpf: string): string {
  const d = cpf.replace(/\D/g, '');
  if (d.length !== 11) return CPF_TODO_MASCARADO;
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}

/** `ana.souza@exemplo.com.br` → `a***@exemplo.com.br`. Formato estranho (sem usuário ou sem domínio) vira `***`. */
export function mascararEmail(email: string): string {
  const i = email.lastIndexOf('@');
  if (i < 1 || i === email.length - 1) return '***';
  return `${email[0]}***${email.slice(i)}`;
}

/**
 * CPF dentro de um texto: formatado (000.000.000-00) sempre; 11 dígitos soltos só quando são CPF válido (para não
 * mascarar pedido, telefone ou timestamp). Dígitos colados a letra ou a outro dígito não casam (uuid, hash).
 */
const CPF_NO_TEXTO = /(?<![0-9A-Za-z])(\d{3}\.\d{3}\.\d{3}-\d{2}|\d{11})(?![0-9A-Za-z])/g;

/** Troca todo CPF do texto pela máscara (varredura de log, mensagens, respostas). */
export function mascararCpfEmTexto(texto: string): string {
  return texto.replace(CPF_NO_TEXTO, (m) => (m.length === 11 && !cpfValido(m) ? m : mascararCpf(m)));
}
