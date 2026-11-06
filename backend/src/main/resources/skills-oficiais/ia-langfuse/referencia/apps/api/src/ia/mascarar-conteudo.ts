// origem: skills-modelo/apps/api/src/ia/mascarar-conteudo.ts
import { mascararCpfEmTexto, mascararEmail } from '../lgpd/mascarar';

// Mascara o texto que vai para o Langfuse (só com LANGFUSE_CAPTURAR_CONTEUDO=true). Reusa a máscara de CPF e de e-mail
// da skill lgpd-dados-pessoais (lgpd/mascarar.ts) e acrescenta CNPJ e segredos, que só aparecem em prompt.

/** Chaves de API: `sk-ant-...`, `sk-lf-...`, `pk-lf-...`, `sk-...` (20+ caracteres de chave depois do prefixo). */
const CHAVE_API = /\b(?:sk|pk)-[A-Za-z0-9][A-Za-z0-9_-]{19,}/g;
/** Cabeçalho `Authorization: Bearer <token>`. */
const BEARER = /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi;
const CNPJ = /(?<![0-9A-Za-z])(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{14})(?![0-9A-Za-z])/g;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;

/** Troca segredos, CNPJ, CPF e e-mail do texto por máscaras. Texto sem nada disso volta idêntico. */
export function mascararTexto(texto: string): string {
  return mascararCpfEmTexto(
    texto
      .replace(CHAVE_API, '[CHAVE]')
      .replace(BEARER, 'Bearer [TOKEN]')
      .replace(CNPJ, '**.***.***/****-**')
      .replace(EMAIL, (e) => mascararEmail(e)),
  );
}
