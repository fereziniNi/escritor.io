import { describe, expect, it } from 'vitest';
import { paraPdf } from './pdf';
import { type RelatorioTabular } from './relatorio-tabular';
import { extrairTextoPdf } from '../../test/texto-pdf';

const colunas: RelatorioTabular['colunas'] = [
  { chave: 'nome', titulo: 'Descrição', tipo: 'texto' },
  { chave: 'valor', titulo: 'Valor', tipo: 'moeda' },
  { chave: 'dia', titulo: 'Data', tipo: 'data' },
];

describe('paraPdf', () => {
  it('começa com %PDF', async () => {
    const pdf = await paraPdf({ titulo: 'Vazio', colunas, linhas: [] });
    expect(pdf.subarray(0, 4).toString('latin1')).toBe('%PDF');
  });

  it('renderiza ação, ç, ã, é e í (fonte Inter embutida) além de título, sistema e valores no padrão brasileiro', async () => {
    const pdf = await paraPdf(
      {
        titulo: 'Relatório de ações — março',
        colunas,
        linhas: [{ nome: 'Contribuição não é ação: coração, João, Conceição', valor: 1234.5, dia: '2026-03-05' }],
        totais: { valor: 1234.5 },
      },
      { nomeSistema: 'Sistema Exemplo' },
    );
    const { texto } = await extrairTextoPdf(pdf);
    for (const esperado of ['Relatório de ações', 'Contribuição não é ação: coração, João, Conceição', 'Sistema Exemplo', 'R$ 1.234,50', '05/03/2026', 'Total']) {
      expect(texto).toContain(esperado);
    }
  });

  it('pagina: muitas linhas geram várias páginas, com "Página X de Y" e o cabeçalho repetido', async () => {
    const linhas = Array.from({ length: 120 }, (_, i) => ({ nome: `Linha ${i + 1}`, valor: i, dia: '2026-01-01' }));
    const pdf = await paraPdf({ titulo: 'Longo', colunas, linhas });
    const { texto, paginas } = await extrairTextoPdf(pdf);
    expect(paginas).toBeGreaterThan(2);
    expect(texto).toContain(`Página 1 de ${paginas}`);
    expect(texto).toContain(`Página ${paginas} de ${paginas}`);
    expect(texto.match(/Descrição/g)!.length).toBe(paginas);
    expect(texto).toContain('Linha 120');
  });

  it('célula muito longa não estoura a coluna nem derruba a geração', async () => {
    const pdf = await paraPdf({ titulo: 'Longa', colunas, linhas: [{ nome: 'x'.repeat(5000), valor: 1, dia: null }] });
    expect(pdf.length).toBeGreaterThan(500);
  });

  it('aceita logo PNG', async () => {
    // PNG 1x1 transparente.
    const logo = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
    const pdf = await paraPdf({ titulo: 'Com logo', colunas, linhas: [] }, { nomeSistema: 'S', logo });
    expect(pdf.subarray(0, 4).toString('latin1')).toBe('%PDF');
  });
});
