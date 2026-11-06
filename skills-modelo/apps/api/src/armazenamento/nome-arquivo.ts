import { type Extensao } from './chave';

const MAX_NOME = 150;

/**
 * Nome para EXIBIR (metadado), nunca para achar o arquivo: sem caminho (`../../x.pdf` vira `x.pdf`), sem caractere de
 * controle nem `<` `>`, no máximo 150 caracteres, e com a extensão do TIPO DETECTADO (um PDF enviado como `virus.exe` fica
 * `virus.pdf`). Na tela o nome sai como texto (React escapa); no download vai por `contentDisposition`.
 */
export function nomeParaExibir(nomeDoCliente: string, extensao: Extensao): string {
  const ultimaParte = nomeDoCliente.split(/[\\/]/).pop() ?? '';
  const limpo = ultimaParte.replace(/[\p{Cc}<>]/gu, '').trim();
  const semExtensao = limpo.replace(/\.[A-Za-z0-9]{1,8}$/, '').replace(/^\.+/, '').trim();
  const base = semExtensao.slice(0, MAX_NOME - extensao.length - 1).trim();
  return `${base || 'arquivo'}.${extensao}`;
}
