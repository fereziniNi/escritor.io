import PDFDocument from 'pdfkit';
import { COR } from '../email/modelo-email';
import { agoraBrasilia, textoLegivel } from './formato';
import { IDENTIDADE_PADRAO, type IdentidadeExportacao, type RelatorioTabular } from './relatorio-tabular';

/**
 * Fonte embutida: Inter (licença OFL) do pacote `@fontsource/inter`, o mesmo que o front hospeda. O pdfkit lê `.woff`
 * (fontkit abre TTF, OTF, WOFF e WOFF2), então não precisa de outro pacote de fonte. A Helvetica padrão do PDF não tem
 * glifos confiáveis para `ç`, `ã`, `é`; o subconjunto `latin` da Inter cobre todo o português.
 */
const FONTE_NORMAL = require.resolve('@fontsource/inter/files/inter-latin-400-normal.woff');
const FONTE_NEGRITO = require.resolve('@fontsource/inter/files/inter-latin-700-normal.woff');

const ALTURA_LINHA = 20;
const MARGEM = 40;
const RESERVA_RODAPE = 28;
/** Célula com mais que isto é cortada com reticências antes de medir (evita medir texto de 5 mil caracteres). */
const MAX_CARACTERES_CELULA = 300;

const ehNumerico = (tipo: string) => tipo !== 'texto';

/**
 * O relatório em PDF (A4; paisagem quando tem mais de 5 colunas): logo e nome do sistema, título e data de geração no
 * topo, tabela com cabeçalho na cor primária repetido em cada página, listras, linha de totais e rodapé "Página X de Y".
 * Tudo em memória: quem chama limita as linhas (o PDF costuma ter limite menor que o CSV).
 */
export function paraPdf(r: RelatorioTabular, identidade: IdentidadeExportacao = IDENTIDADE_PADRAO): Promise<Buffer> {
  return new Promise<Buffer>((resolver, rejeitar) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: r.colunas.length > 5 ? 'landscape' : 'portrait',
      margin: MARGEM,
      bufferPages: true,
      info: { Title: r.titulo, Producer: identidade.nomeSistema },
    });
    const partes: Buffer[] = [];
    doc.on('data', (p: Buffer) => partes.push(p));
    doc.on('end', () => resolver(Buffer.concat(partes)));
    doc.on('error', rejeitar);

    try {
      doc.registerFont('Inter', FONTE_NORMAL);
      doc.registerFont('Inter-Bold', FONTE_NEGRITO);

      const largura = doc.page.width - 2 * MARGEM;
      // Largura de cada coluna pelo conteúdo (títulos e as primeiras linhas, no máximo 220 pt de texto); sobra ou falta é
      // repartida na proporção. Nenhuma coluna fica abaixo de 40 pt.
      const medir = (texto: string, negrito: boolean) => doc.font(negrito ? 'Inter-Bold' : 'Inter').fontSize(9).widthOfString(texto.slice(0, MAX_CARACTERES_CELULA));
      const ideais = r.colunas.map((c) => {
        let maior = medir(c.titulo, true);
        for (const dados of r.linhas.slice(0, 200)) maior = Math.max(maior, Math.min(medir(textoLegivel(c.tipo, dados[c.chave]), false), 220));
        return Math.max(maior + 12, 40);
      });
      const somaIdeal = ideais.reduce((a, b) => a + b, 0) || 1;
      const larguras = ideais.map((w) => (w / somaIdeal) * largura);
      const limiteInferior = () => doc.page.height - MARGEM - RESERVA_RODAPE;

      let y = MARGEM;
      if (identidade.logo) {
        try {
          doc.image(identidade.logo, MARGEM, y, { fit: [120, 32] });
          y += 40;
        } catch {
          // Logo ilegível não derruba o relatório: segue só com o nome do sistema.
        }
      }
      doc.font('Inter-Bold').fontSize(10).fillColor(COR.primaria).text(identidade.nomeSistema, MARGEM, y, { width: largura, lineBreak: false });
      y += 16;
      doc.font('Inter-Bold').fontSize(16).fillColor(COR.texto).text(r.titulo, MARGEM, y, { width: largura, height: 22, ellipsis: true });
      y += 24;
      doc.font('Inter').fontSize(8).fillColor(COR.texto2).text(`Gerado em ${agoraBrasilia()} (Brasília)`, MARGEM, y, { width: largura, lineBreak: false });
      y += 22;

      const cabecalho = () => {
        doc.rect(MARGEM, y, largura, ALTURA_LINHA).fill(COR.primaria);
        let x = MARGEM;
        r.colunas.forEach((c, i) => {
          doc.font('Inter-Bold').fontSize(9).fillColor(COR.sobrePrimaria).text(c.titulo, x + 5, y + 6, {
            width: larguras[i]! - 10,
            height: 12,
            lineBreak: false,
            ellipsis: true,
            align: ehNumerico(c.tipo) ? 'right' : 'left',
          });
          x += larguras[i]!;
        });
        y += ALTURA_LINHA;
      };

      const linha = (textos: string[], indice: number, negrito: boolean) => {
        if (y + ALTURA_LINHA > limiteInferior()) {
          doc.addPage();
          y = MARGEM;
          cabecalho();
        }
        if (negrito) doc.rect(MARGEM, y, largura, ALTURA_LINHA).fill(COR.borda);
        else if (indice % 2 === 1) doc.rect(MARGEM, y, largura, ALTURA_LINHA).fill(COR.fundo);
        let x = MARGEM;
        r.colunas.forEach((c, i) => {
          const texto = textos[i] ?? '';
          doc.font(negrito ? 'Inter-Bold' : 'Inter').fontSize(9).fillColor(COR.texto).text(texto.length > MAX_CARACTERES_CELULA ? `${texto.slice(0, MAX_CARACTERES_CELULA)}…` : texto, x + 5, y + 6, {
            width: larguras[i]! - 10,
            height: 12,
            lineBreak: false,
            ellipsis: true,
            align: ehNumerico(c.tipo) ? 'right' : 'left',
          });
          x += larguras[i]!;
        });
        doc.moveTo(MARGEM, y + ALTURA_LINHA).lineTo(MARGEM + largura, y + ALTURA_LINHA).lineWidth(0.5).strokeColor(COR.borda).stroke();
        y += ALTURA_LINHA;
      };

      cabecalho();
      r.linhas.forEach((dados, i) => linha(r.colunas.map((c) => textoLegivel(c.tipo, dados[c.chave])), i, false));
      if (r.totais) {
        const totais = r.totais;
        const primeira = r.colunas[0];
        const rotulo = primeira?.tipo === 'texto' && totais[primeira.chave] === undefined;
        linha(
          r.colunas.map((c, i) => (rotulo && i === 0 ? 'Total' : textoLegivel(c.tipo, totais[c.chave]))),
          0,
          true,
        );
      }

      // Rodapé em todas as páginas, com o total de páginas (por isso bufferPages). A margem de baixo é zerada só
      // enquanto escreve, senão o pdfkit abre uma página nova para texto abaixo da margem.
      const { start, count } = doc.bufferedPageRange();
      for (let i = 0; i < count; i++) {
        doc.switchToPage(start + i);
        const margemBaixo = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        const yRodape = doc.page.height - MARGEM - 8;
        doc.font('Inter').fontSize(8).fillColor(COR.texto3);
        doc.text(`${identidade.nomeSistema} · ${r.titulo}`.slice(0, 90), MARGEM, yRodape, { width: largura - 120, lineBreak: false });
        doc.text(`Página ${i + 1} de ${count}`, MARGEM + largura - 110, yRodape, { width: 110, align: 'right', lineBreak: false });
        doc.page.margins.bottom = margemBaixo;
      }
      doc.end();
    } catch (e) {
      rejeitar(new Error('falha ao gerar o PDF', { cause: e }));
    }
  });
}
