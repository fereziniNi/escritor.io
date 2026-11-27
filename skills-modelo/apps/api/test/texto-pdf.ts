// Só para testes: lê o texto de cada página de um PDF (pdfjs-dist) para conferir o que foi desenhado.
export async function extrairTextoPdf(pdf: Buffer): Promise<{ texto: string; paginas: number }> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(pdf), useSystemFonts: false, verbosity: 0 }).promise;
  let texto = '';
  for (let n = 1; n <= doc.numPages; n++) {
    const pagina = await doc.getPage(n);
    const conteudo = await pagina.getTextContent();
    texto += conteudo.items.map((i) => ('str' in i ? i.str : '')).join(' ') + '\n';
  }
  return { texto, paginas: doc.numPages };
}
