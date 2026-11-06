---
name: exportacao-excel-pdf-csv
description: Use quando um sistema Multiplica precisar exportar dados em Excel (.xlsx), PDF ou CSV — botão Exportar numa tela, relatório para baixar, planilha com cabeçalho na cor da marca, números em reais (R$ 1.234,50), datas dd/mm/aaaa, CSV que abre certo no Excel brasileiro (ponto e vírgula, BOM UTF-8), PDF com logo e paginação e acentos corretos (ação, ç, ã), nome de arquivo com acento no Content-Disposition, proteção contra fórmula maliciosa em planilha (CSV injection), limite de linhas com aviso de corte e exportação que respeita a máscara de CPF e e-mail por papel e fica na auditoria. Cobre RelatorioTabular, paraExcel (exceljs), paraPdf (pdfkit com fonte Inter embutida), paraCsv, contentDisposition, ExportacaoService e o componente BotaoExportar.
---

# Exportação Excel, PDF e CSV Multiplica

Todo sistema Multiplica exporta dados do mesmo jeito: a tela pede, a API monta **um** relatório em tabela (`RelatorioTabular`)
e três exportadores o transformam em arquivo, sempre com **formato brasileiro**, **dado pessoal mascarado conforme o papel**,
**fórmula de planilha neutralizada**, **limite de linhas** e **registro na auditoria**. O código em `referencia/` é cópia de um
projeto-modelo que compila e passa nos testes (leitura do .xlsx de volta, texto extraído do PDF, Postgres real): copie e adapte,
não reescreva de memória. Vem de CambIA (`exportacao/`: RelatorioTabular, Paleta, FormatoBrasileiro), BeyondCredit (`exports/`),
Comitê (`content-disposition.ts`), FinAnalytics (`document-export.ts`) e Conta Gráfica (`csv.ts`, `BotaoExportar.tsx`).
**Cada valor abaixo é fixo**; mudar um deles é decisão registrada no `CLAUDE.md`.

## Padrão Multiplica

1. **Um relatório, três arquivos.** `RelatorioTabular { titulo, colunas: { chave, titulo, tipo }[], linhas, totais? }`, com
   `tipo` em `texto | moeda | data | numero | percentual`. `paraExcel(r, identidade?)` (exceljs) devolve `Promise<Buffer>`,
   `paraPdf(r, identidade?)` (pdfkit) `Promise<Buffer>`, `paraCsv(r)` `Buffer`. Nenhum deles conhece banco, rota ou papel.
   Não escreva um exportador por tela: monte o `RelatorioTabular` e chame o `ExportacaoService`.
2. **Formato brasileiro por tipo de coluna.** Excel: moeda `R$ #,##0.00`, data `dd/mm/yyyy`, percentual `0.00%`, número
   `#,##0` (inteiro) ou `#,##0.00` (decimal), todos como **número e data de verdade** (a planilha soma, ordena e filtra). PDF:
   `R$ 1.234,50`, `1.500`, `12,50%`, `05/03/2026`. CSV: decimal com **vírgula** e sem separador de milhar (`1234,50`, `2,5`,
   `12,50%`), data `05/03/2026`. Data `AAAA-MM-DD` não muda de dia por fuso; instante (ISO com horário, `Date`) vale o dia em
   Brasília (`America/Sao_Paulo`). Nulo vira célula vazia. Percentual recebe a fração (`0.125` = `12,50%`).
3. **CSV para o Excel brasileiro.** UTF-8 **com BOM** (`EF BB BF`), separador **`;`**, fim de linha **CRLF**, célula com `;`, aspas
   ou quebra de linha entre aspas (aspas dobradas). Sem BOM os acentos quebram; com `,` as colunas se misturam.
4. **Fórmula neutralizada em CSV e em Excel.** Todo texto que começa com `=`, `+`, `-`, `@`, tab ou CR ganha um apóstrofo na
   frente (`neutralizarFormula`, `formato.ts`): vale para a célula **de texto** do CSV e do .xlsx (o .xlsx guarda texto como texto,
   mas o arquivo é reexportado para CSV ou colado em outra planilha, onde a fórmula voltaria a valer). Número e data formatados
   (`-1234,50`) **não** levam apóstrofo. Nome de cliente `=HYPERLINK(...)` chega à planilha como texto.
5. **Identidade visual.** Excel: nome do sistema (`NOME_SISTEMA`) no topo, título, "Gerado em dd/mm/aaaa hh:mm (Brasília)",
   cabeçalho com fundo **primária `#2F6FED`** e letra branca em negrito, filtro e linhas congeladas, colunas pela largura do
   conteúdo, linha de totais ("Total" na primeira coluna de texto). PDF: A4 (paisagem com mais de 5 colunas), logo opcional
   (`EXPORTACAO_LOGO`: PNG ou JPEG de até 512 KB; SVG é recusado), nome do sistema, título, cabeçalho da tabela na primária e
   **repetido em cada página**, linhas alternadas, linha de totais, rodapé **"Página X de Y"**. As cores vêm de `COR`
   (`email/modelo-email.ts`, os mesmos tokens do `tokens.css`): nunca hex solto no exportador.
6. **PDF com acentos.** Fonte **Inter** (OFL) embutida, lida do pacote `@fontsource/inter` (`inter-latin-400-normal.woff` e
   `700`), o mesmo que o front hospeda: o pdfkit (via fontkit) abre `.woff`, então **não precisa de outro pacote de fonte**. A
   Helvetica padrão não desenha `ç`, `ã`, `é` com segurança. Teste: o texto extraído do PDF contém `ação`, `Conceição`, `João`.
   Célula longa é cortada com reticências (nunca estoura a coluna nem quebra a página).
7. **`Content-Disposition` seguro**: `contentDisposition("Relatório março.xlsx")` devolve
   `attachment; filename="Relatorio_marco.xlsx"; filename*=UTF-8''Relat%C3%B3rio%20mar%C3%A7o.xlsx` (reserva ASCII + RFC 5987).
   Aspas, `;`, CR/LF, barras e `..` do nome nunca escapam do cabeçalho; nome vazio vira `arquivo`; no máximo 150 caracteres
   (extensão preservada). Nunca monte o cabeçalho à mão com um nome que tenha dado de fora.
8. **Dado pessoal mascarado pelo papel, também no arquivo.** O interceptor da skill `lgpd-dados-pessoais` mascara respostas
   JSON, mas **não abre arquivo**: o `ExportacaoService.exportar` aplica `mascararResposta` às linhas e aos totais antes de gerar
   o arquivo, para quem não é GESTOR/ADMIN (USUARIO e qualquer papel novo: falha fechada). Mesma regra da API:
   **a chave da coluna que começa com `cpf` ou `email` é mascarada** (`***.456.789-**`, `a***@dominio`) e CPF solto em qualquer
   texto também. Por isso dado pessoal entra no relatório sob essas chaves (`cpf`, `cpfConjuge`, `email`). Teste: o CSV, o .xlsx
   e o PDF de USUARIO não contêm o CPF nem o e-mail completos em lugar nenhum.
9. **Auditada.** Cada exportação grava `<recurso>.exportar` (ex.: `cliente.exportar`) com `ator`, `alvo_tipo`, e em `depois`:
   `formato`, `linhas`, `truncado`, `mascarado` e os `filtros` usados (sem dado pessoal). Se a trilha falhar, o **arquivo não
   sai**. Exportação recusada (400, 403) não deixa evento. A exportação da própria trilha (`auditoria.exportar`) usa o mesmo `paraCsv`.
10. **Limite de linhas e corte avisado.** `EXPORTACAO_MAX_LINHAS` (padrão **10.000**, máximo 100.000) para Excel e CSV; o **PDF
    corta em 2.000**. A consulta busca `limite + 1` linhas; passou do limite, o arquivo sai cortado, a resposta leva
    `X-Exportacao-Truncada: true` (e `Access-Control-Expose-Headers`), o evento de auditoria registra `truncado: true` e o
    `BotaoExportar` avisa "foi cortado no limite de linhas". Os arquivos são montados em memória, por isso o teto; para volumes
    maiores, use `ExcelJS.stream.xlsx.WorkbookWriter` e escreva direto na resposta (decisão registrada no `CLAUDE.md`).
11. **Resposta HTTP**: `GET /api/<recurso>/exportar?formato=xlsx|pdf|csv` (formato ausente ou desconhecido: **400**; sem sessão:
    401). Tipos: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `application/pdf`,
    `text/csv; charset=utf-8`. Sempre `Cache-Control: no-store` (conteúdo sensível). A rota `exportar` vem **antes** de `:id`.
    A rota confere o papel (`@Papeis`) **e** o serviço também (`exigirPapel`), como em toda rota da skill `usuarios-e-papeis`.
12. **Botão padrão** `BotaoExportar` (`url`, `parametros?` com os filtros da tela, `formatos?`): menu "Excel (.xlsx)", "PDF", "CSV";
    baixa com o nome vindo da API (`filename*` primeiro), mostra "Arquivo … gerado." ou o aviso de corte, e o erro da API
    (`role="alert"`, ex.: 403). O botão só pede e entrega: conteúdo e máscara vêm prontos do servidor.
13. **Riscos que sobram (aceitos)**: o apóstrofo aparece como caractere literal em texto que começa com `=`, `+`, `-` ou `@` no
    Excel (é o preço da proteção; não use `-` à frente de texto comum); o PDF extraído por copiar-e-colar pode separar `***` do
    resto do CPF mascarado; quem tem papel que vê dado completo e exporta pode repassar o arquivo (por isso a auditoria).

## Como aplicar

Pré-requisito: esqueleto da skill `novo-projeto-multiplica` e as skills `identidade-visual`, `seguranca`, `email-transacional`,
`usuarios-e-papeis`, `login-codigo-email`, `trilha-auditoria` e `lgpd-dados-pessoais` aplicadas (nesta ordem), com `pnpm test`
passando. Ao copiar um arquivo de `referencia/`, mantenha o mesmo caminho relativo e **apague a 1ª linha** (`origem: ...`).

**Projeto no esqueleto:**

1. Dependências em `apps/api` (versões exatas): `pnpm --filter api add -E exceljs@4.4.0 pdfkit@0.20.2 @fontsource/inter@5.3.0`
   e `pnpm --filter api add -D -E @types/pdfkit@0.17.7 pdfjs-dist@6.5.438` (o `pdfjs-dist` só lê o texto do PDF nos testes).
2. TDD, API — copie **primeiro** os testes: `apps/api/src/exportacao/csv.spec.ts`, `excel.spec.ts`, `pdf.spec.ts`,
   `content-disposition.spec.ts`, `logo.spec.ts`, `config-exportacao.spec.ts`, `apps/api/test/texto-pdf.ts` e
   `apps/api/test/exportacao.e2e.spec.ts`. Rode `pnpm --filter api test`: tem de falhar (módulos inexistentes).
3. Código: copie `apps/api/src/exportacao/` inteiro (`relatorio-tabular.ts`, `formato.ts`, `csv.ts`, `excel.ts`, `pdf.ts`,
   `content-disposition.ts`, `logo.ts`, `exportacao.service.ts`, `exportacao.module.ts`, `index.ts`).
4. Arquivos de skills anteriores — se ainda são os da etapa anterior, **substitua** pelos da referência; se outra skill mexeu
   neles, faça **só** a mudança descrita:
   - `apps/api/src/config/config.ts`: as variáveis `EXPORTACAO_MAX_LINHAS` (padrão 10.000, 1 a 100.000) e `EXPORTACAO_LOGO`
     (caminho opcional) no fim do esquema base. `.env.example` e `deploy/.env.example`: o bloco "Exportação" do fim.
   - `apps/api/src/auditoria/auditoria.service.ts` e `auditoria.controller.ts`: o CSV da trilha passa a usar `paraCsv` e
     `contentDisposition` de `exportacao/` e a resposta vira `StreamableFile`. **Apague** `apps/api/src/auditoria/csv.ts` e
     `csv.spec.ts` (o `celulaCsv`/`montarCsv` agora moram em `exportacao/csv.ts`, com os mesmos testes). Em
     `apps/api/test/auditoria.e2e.spec.ts` o cabeçalho esperado ganhou `filename*=UTF-8''...`.
   - `apps/api/src/clientes/` (exemplo da skill `lgpd-dados-pessoais`): `clientes.module.ts` importa `ExportacaoModule`;
     `clientes.service.ts` ganha `exportar(ator, formato)` (monta o `RelatorioTabular` de clientes e chama o
     `ExportacaoService`); `clientes.controller.ts` ganha `GET /api/clientes/exportar` antes de `:id`.
5. Rode `pnpm --filter api test`: passa (precisa do Docker). O e2e prova a máscara por papel nos três formatos, a auditoria, o corte
   (`EXPORTACAO_MAX_LINHAS=4`) e a fórmula neutralizada.
6. TDD, web — copie `apps/web/src/componentes/BotaoExportar.test.tsx`; `pnpm --filter web test` falha. Copie
   `apps/web/src/lib/exportar-api.ts` e `componentes/BotaoExportar.tsx` e use na tela:
   `<BotaoExportar url="/api/clientes/exportar" parametros={filtros} />` (por exemplo no `acoes` do `CabecalhoPagina`).
7. Rode `pnpm lint && pnpm typecheck && pnpm test && pnpm build`: tudo limpo.
8. Veja funcionando, de verdade: `docker compose up -d postgres mailpit`, `pnpm --filter api db:migrate`, `pnpm dev`, entre
   como administrador, crie um cliente e baixe `/api/clientes/exportar?formato=xlsx`, `pdf` e `csv`: abra no Excel e no leitor de
   PDF (acentos, `R$`, cabeçalho azul), confira como usuário comum que o CPF vem `***.456.789-**` e que Admin → Auditoria mostra `cliente.exportar`.
9. Para exportar um recurso novo: monte o `RelatorioTabular` no **serviço** do recurso (`exigirPapel` antes; consulta com
   `limit(exportacao.maxLinhas + 1)`), chame `exportacao.exportar(ator, { recurso, formato, relatorio, filtros })` e devolva
   `enviarArquivo(res, arquivo)` na rota. Escreva o teste de máscara por papel e o de auditoria do recurso novo.
10. Em produção com logo: ponha o PNG na imagem (ou monte como volume) e defina `EXPORTACAO_LOGO=/app/logo.png`; arquivo
    ausente ou inválido é erro de configuração na subida, não no primeiro PDF.

**Projeto existente fora do esqueleto** (outro framework): mantenha os mesmos valores. `RelatorioTabular` e os três exportadores
(`formato.ts`, `csv.ts`, `excel.ts`, `pdf.ts`, `content-disposition.ts`) não dependem de Nest: copie-os e troque só a cor
(`COR` de `modelo-email.ts`) por uma constante do projeto. Em Java use Apache POI/OpenPDF; em Python, openpyxl/reportlab; os
**números** (formatos de célula, CSV com BOM e `;`, apóstrofo na fórmula, limite e cabeçalho de corte, `filename*`) valem em
qualquer stack. A máscara por papel e a auditoria acontecem **antes** de gerar o arquivo. Registre no `CLAUDE.md` onde ficou cada coisa.

**Ao terminar:** acrescente `exportacao-excel-pdf-csv` em "Skills Multiplica aplicadas" do `CLAUDE.md`, `EXPORTACAO_MAX_LINHAS` e
`EXPORTACAO_LOGO` em "Variáveis de ambiente" e, em "Regras do projeto", que toda exportação passa pelo `ExportacaoService` (máscara + auditoria + limite).

## Referências

Tudo que um arquivo de `referencia/` importa está em `referencia/` ou nas skills anteriores. De `novo-projeto-multiplica`:
`config/config.module.ts` (`CONFIG`), `banco/banco.ts` (`BANCO`, `Db`), `test/postgres.ts` (`subirPostgres`),
`apps/web/src/lib/api.ts` (`ErroApi`). De `identidade-visual`: o `Button` do shadcn (`componentes/ui/button.tsx`) e as classes
dos tokens. De `email-transacional`: `email/modelo-email.ts` (`COR`). De `usuarios-e-papeis`: `usuarios/papeis.guard.ts`
(`@Papeis`), `usuario-atual.ts` (`UsuarioAtual`, `@UsuarioLogado`, `exigirPapel`), `usuarios.service.ts` (`validarOu400`),
`test/usuario-de-teste.ts`. De `trilha-auditoria`: `auditoria/auditoria.service.ts` (`registrar`, o CSV da trilha). De
`lgpd-dados-pessoais`: `lgpd/mascarar-dados.interceptor.ts` (`mascararResposta`, `podeVerDadosPessoais`), `lgpd/mascarar.ts`
(o teste usa `mascararCpf`/`mascararEmail`), o exemplo `clientes/`.

- `referencia/apps/api/src/exportacao/relatorio-tabular.ts` — `RelatorioTabular`, `TipoColuna`, `IdentidadeExportacao` (regra 1); passo 3 e para entender o desenho.
- `referencia/apps/api/src/exportacao/formato.ts` — formatos brasileiros, `neutralizarFormula`, dia em Brasília (regras 2 e 4); passo 3.
- `referencia/apps/api/src/exportacao/csv.ts` — `paraCsv`, `celulaCsv`, `montarCsv`, BOM (regras 3 e 4); passo 3.
- `referencia/apps/api/src/exportacao/excel.ts` — `paraExcel` (regras 2 e 5); passo 3.
- `referencia/apps/api/src/exportacao/pdf.ts` — `paraPdf`, a fonte Inter, paginação (regras 5 e 6); passo 3.
- `referencia/apps/api/src/exportacao/content-disposition.ts` — `contentDisposition` (regra 7); passo 3 e em qualquer download com nome de arquivo.
- `referencia/apps/api/src/exportacao/logo.ts` — leitura do logo com falha fechada (regra 5); passo 3.
- `referencia/apps/api/src/exportacao/exportacao.service.ts`, `exportacao.module.ts`, `index.ts` — máscara, limite, auditoria e resposta HTTP (regras 8 a 11); passo 3 e passo 9.
- `referencia/apps/api/src/exportacao/*.spec.ts`, `referencia/apps/api/test/texto-pdf.ts`, `exportacao.e2e.spec.ts` — todos os comportamentos acima; passo 2.
- `referencia/apps/api/src/clientes/clientes.service.ts`, `clientes.controller.ts`, `clientes.module.ts` — exemplo completo de um recurso exportável (regras 8, 9, 11); passos 4 e 9.
- `referencia/apps/api/src/auditoria/auditoria.service.ts`, `auditoria.controller.ts`, `referencia/apps/api/test/auditoria.e2e.spec.ts` — a trilha usando o `paraCsv` (regra 9); passo 4.
- `referencia/apps/api/src/config/config.ts`, `referencia/.env.example`, `referencia/deploy/.env.example` — as duas variáveis novas; passo 4.
- `referencia/apps/web/src/componentes/BotaoExportar.tsx`, `BotaoExportar.test.tsx`, `referencia/apps/web/src/lib/exportar-api.ts` — o botão (regra 12); passo 6.

## Checklist de pronto

- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` saem limpos.
- [ ] O .xlsx lido de volta tem `R$ #,##0.00` na coluna de moeda, `dd/mm/yyyy` na de data e cabeçalho `#2F6FED` com letra branca.
- [ ] O CSV começa com BOM (`EF BB BF`), usa `;`, CRLF e decimal com vírgula e abre com acentos certos no Excel.
- [ ] O PDF começa com `%PDF`, mostra `ação`, `ç`, `ã` corretos (texto extraído), tem cabeçalho repetido e "Página X de Y".
- [ ] `contentDisposition("Relatório março.xlsx")` contém `filename*=UTF-8''Relat%C3%B3rio%20mar%C3%A7o.xlsx`; nome com `"`, `;` ou quebra de linha não escapa.
- [ ] Texto começando com `=`, `+`, `-`, `@` chega à planilha como texto (CSV e Excel).
- [ ] USUARIO exporta CPF e e-mail mascarados nos três formatos; GESTOR e ADMIN, completos.
- [ ] Toda exportação gera `<recurso>.exportar` na auditoria (formato, linhas, corte, mascarado), sem dado pessoal; sem a trilha o arquivo não sai.
- [ ] Acima de `EXPORTACAO_MAX_LINHAS` (PDF: 2.000) o arquivo sai cortado com `X-Exportacao-Truncada: true` e o botão avisa.
- [ ] Sem sessão 401; `formato` ausente ou inválido 400; resposta com `Cache-Control: no-store`.
- [ ] `EXPORTACAO_LOGO` inexistente ou que não é PNG/JPEG de até 512 KB impede a API de subir.
- [ ] `exportacao-excel-pdf-csv` listada em "Skills Multiplica aplicadas" no `CLAUDE.md`.
