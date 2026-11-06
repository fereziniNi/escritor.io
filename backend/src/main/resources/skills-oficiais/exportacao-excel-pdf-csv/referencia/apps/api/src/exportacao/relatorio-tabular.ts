// origem: skills-modelo/apps/api/src/exportacao/relatorio-tabular.ts
/**
 * Tipo de cada coluna. Define o formato brasileiro em TODOS os arquivos:
 * - `texto`: como veio (fórmula de planilha neutralizada);
 * - `moeda`: número em reais (Excel `R$ #,##0.00`, PDF `R$ 1.234,50`, CSV `1234,50`);
 * - `data`: `AAAA-MM-DD` (sem mudar de dia por fuso), `Date` ou texto ISO com horário (dia em Brasília) → `dd/mm/aaaa`;
 * - `numero`: inteiro ou decimal (Excel `#,##0` ou `#,##0.00`, PDF `1.500`, CSV `1500` e `2,5`);
 * - `percentual`: fração (0,125 = 12,50%).
 */
export type TipoColuna = 'texto' | 'moeda' | 'data' | 'numero' | 'percentual';

export interface ColunaRelatorio {
  /** Chave da linha. Dado pessoal usa o nome padrão da LGPD (`cpf...`, `email...`): é por ele que a máscara por papel age. */
  chave: string;
  titulo: string;
  tipo: TipoColuna;
}

/** O que os três exportadores recebem: um relatório em tabela, sem saber de banco nem de formato de arquivo. */
export interface RelatorioTabular {
  titulo: string;
  colunas: ColunaRelatorio[];
  linhas: Record<string, unknown>[];
  /** Linha de totais (chave da coluna → valor). A primeira coluna de texto sem total mostra "Total". */
  totais?: Record<string, unknown>;
}

/** Identidade que aparece nos arquivos. `logo`: PNG ou JPEG (só o PDF desenha). */
export interface IdentidadeExportacao {
  nomeSistema: string;
  logo?: Buffer;
}

export const IDENTIDADE_PADRAO: IdentidadeExportacao = { nomeSistema: 'Sistema' };
