Use a skill exportacao-excel-pdf-csv para criar a exportação de dados deste sistema Multiplica.
Siga o Padrão Multiplica à risca e em TDD: copie os testes primeiro, veja falhar, depois o código.
Monte um RelatorioTabular por recurso e gere Excel (exceljs), PDF (pdfkit com a fonte Inter) e CSV (ponto e vírgula, BOM UTF-8) pelo ExportacaoService, com R$, datas dd/mm/aaaa e cabeçalho na cor primária.
Mascare CPF e e-mail pelo papel de quem exporta, neutralize texto que comece com = + - @, limite as linhas (EXPORTACAO_MAX_LINHAS, aviso de corte) e registre <recurso>.exportar na auditoria.
Entregue o arquivo com Content-Disposition seguro (filename*) e coloque o BotaoExportar na tela indicada.
No fim, rode pnpm lint, pnpm typecheck, pnpm test e pnpm build e mostre o checklist de pronto.
