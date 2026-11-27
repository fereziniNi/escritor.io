const MAX_NOME = 150;

/** Nome seguro: sem caminho, sem controle, sem aspas; no máximo MAX_NOME caracteres, preservando a extensão. */
function limpar(nome: string): string {
  // Barras viram separador (`../../etc/passwd` → `etc/passwd`); a última parte "etc_passwd" vem do passo seguinte.
  const semPontosSoltos = nome.replace(/\.{2,}/g, '.');
  const semControle = semPontosSoltos.replace(/[\p{Cc}"\\]/gu, '').replace(/^[./\s]+/, '').trim();
  const juntado = semControle.replace(/[/]+/g, '_');
  if (juntado.length <= MAX_NOME) return juntado;
  const extensao = /\.[A-Za-z0-9]{1,8}$/.exec(juntado)?.[0] ?? '';
  return juntado.slice(0, MAX_NOME - extensao.length) + extensao;
}

/** Só ASCII seguro para o `filename` de reserva: sem acento (NFD), espaço e demais vira `_`. */
function reservaAscii(nome: string): string {
  const ascii = nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/^[._-]+|_+$/g, '');
  return /[A-Za-z0-9]/.test(ascii) ? ascii : 'arquivo';
}

/** RFC 5987: tudo fora de [A-Za-z0-9!#$&+.^_`|~-] vira %XX (o encodeURIComponent deixa passar ' ( ) *, que aqui também são codificados). */
const codificar = (nome: string) => encodeURIComponent(nome).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/**
 * Cabeçalho `Content-Disposition: attachment` seguro para qualquer nome de arquivo: `filename` ASCII de reserva
 * (navegadores antigos) + `filename*=UTF-8''...` (RFC 5987/6266) com o nome real. Aspas, quebra de linha, `;` e barras do
 * nome não escapam do cabeçalho (injeção de cabeçalho / troca da extensão). Use SEMPRE que o nome tiver dado de fora.
 */
export function contentDisposition(nomeArquivo: string): string {
  const nome = limpar(nomeArquivo);
  return `attachment; filename="${reservaAscii(nome)}"; filename*=UTF-8''${codificar(nome || 'arquivo')}`;
}
