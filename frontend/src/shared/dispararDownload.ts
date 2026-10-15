/**
 * Um `<a href>` puro não carrega o header `Authorization` numa navegação normal do navegador
 * (S5.9) - por isso arquivos protegidos (CSV) são buscados via `apiFetch` (que já anexa o token)
 * como `Blob`, e o download é disparado programaticamente com um link temporário apontando pro
 * `Blob` em memória.
 */
export function dispararDownload(blob: Blob, nomeArquivo: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nomeArquivo
  link.click()
  URL.revokeObjectURL(url)
}
