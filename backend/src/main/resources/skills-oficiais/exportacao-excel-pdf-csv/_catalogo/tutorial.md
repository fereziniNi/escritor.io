# Tutorial — Exportação Excel, PDF e CSV

## Passos comuns

1. No escritor.io, abra o painel **Skills** e baixe o `.zip` da skill **exportacao-excel-pdf-csv**.
2. Extraia o zip em `<seu-projeto>/.claude/skills/` (vale para todos que usam o projeto) ou em `~/.claude/skills/`
   (só para você). Deve ficar `.claude/skills/exportacao-excel-pdf-csv/SKILL.md`.
3. Abra o Claude Code na pasta do projeto e confira que a skill aparece (digite `/skills`).
4. Cole o prompt de uso da skill.

## Parte específica desta skill

### Como funciona para quem usa o sistema

Nas telas com lista aparece o botão **Exportar**, com três opções: **Excel**, **PDF** e **CSV**. O Excel abre pronto, com o
cabeçalho azul da marca, valores em reais (`R$ 1.234,50`) e datas no padrão `05/03/2026`; dá para somar e filtrar. O PDF leva o
nome do sistema, o logo (se houver), a data e a hora de geração e a numeração das páginas, com acentos corretos. O CSV abre no
Excel em português com as colunas separadas e os acentos certos. Quem tem o papel **Usuário** recebe CPF e e-mail pela metade
(`***.456.789-**`), como na tela; **Gestor** e **Administrador** recebem completo. Cada exportação fica registrada na auditoria
(quem, quando e em que formato). Se a lista for muito grande, o arquivo sai cortado (10.000 linhas no Excel e no CSV, 2.000 no
PDF) e o sistema avisa na tela.

### Pré-requisitos

| Ferramenta | Versão | Como conferir |
|---|---|---|
| Esqueleto do projeto | skills `novo-projeto-multiplica`, `identidade-visual`, `seguranca`, `email-transacional`, `usuarios-e-papeis`, `login-codigo-email`, `trilha-auditoria` e `lgpd-dados-pessoais` já aplicadas | `ls apps/api/src/lgpd` ou `dir apps\api\src\lgpd` |
| Node.js | 22.22 ou mais nova | `node --version` |
| pnpm | 9.15.4 | `pnpm --version` |
| Docker | qualquer versão recente (Postgres dos testes) | `docker version` |

### Variáveis de ambiente

| Nome | Obrigatória | Exemplo | Para que serve |
|---|---|---|---|
| `EXPORTACAO_MAX_LINHAS` | não (padrão 10000) | `10000` | máximo de linhas de um arquivo Excel ou CSV (o PDF corta em 2000). Vai de 1 a 100000: o arquivo é montado na memória do servidor |
| `EXPORTACAO_LOGO` | não | `/app/logo.png` | caminho de um logo **PNG ou JPEG** (até 512 KB) que aparece no topo do PDF. Se o arquivo não existir ou não for PNG/JPEG, a API não sobe |
| `NOME_SISTEMA` | não (padrão `Sistema`; já existe) | `Sistema Exemplo` | nome que aparece no topo do Excel e do PDF |

### Dependências

Pacotes novos na API: `exceljs`, `pdfkit` e `@fontsource/inter` (a fonte do PDF, a mesma que o site já usa), mais `@types/pdfkit` e
`pdfjs-dist` só para os testes. Nenhuma migração de banco.

### Como verificar que funcionou

1. Abra um terminal **na pasta do projeto** (no VS Code: menu Terminal → Novo terminal; no Windows também serve o PowerShell).
2. Rode `pnpm install`, depois `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build`. Todos terminam sem erro (os testes sobem um
   Postgres temporário; o Docker precisa estar aberto). Os testes abrem o Excel e o PDF gerados e conferem formatos, acentos e máscara.
3. Veja os arquivos de verdade:
   - bash / Git Bash / macOS / Linux e PowerShell (iguais):
     ```bash
     docker compose up -d postgres mailpit
     pnpm --filter api db:migrate
     pnpm dev
     ```
   Entre como administrador, cadastre um cliente de teste e, no navegador já logado, abra
   `http://localhost:5173/api/clientes/exportar?formato=xlsx` (depois `pdf` e `csv`). O arquivo é baixado: abra o Excel (cabeçalho
   azul, `R$`), o PDF (acentos, "Página 1 de 1") e o CSV (colunas separadas, acentos certos). Entre como um usuário comum e baixe de
   novo: o CPF vem `***.456.789-**`. Em **Admin → Auditoria** aparece a ação `cliente.exportar`.
4. Teste o aviso de corte: coloque `EXPORTACAO_MAX_LINHAS=2` no `.env`, reinicie e exporte uma lista com mais de 2 clientes: o botão
   mostra "foi cortado no limite de linhas".

### Se não funcionar

- **O Excel mostra `Ã§Ã£` no lugar de `ç` e `ã` (CSV)**: o arquivo foi aberto por "Dados → De texto" sem escolher UTF-8, ou foi
  salvo por outro programa sem o BOM. Baixe de novo pelo botão e abra com duplo clique.
- **O CSV abre tudo numa coluna só**: o Excel do computador usa vírgula como separador de lista. Troque em Configurações do
  Windows → Região → formato de lista, ou importe pelo menu Dados escolhendo `;`.
- **Uma célula do Excel começa com um apóstrofo (`'=...`)**: é de propósito. O texto começava com `=`, `+`, `-` ou `@` e foi
  protegido para não virar fórmula.
- **A API não sobe e o erro cita `EXPORTACAO_LOGO`**: o arquivo não existe naquele caminho (no servidor ele precisa estar dentro da
  imagem ou montado como volume) ou não é PNG/JPEG. SVG não é aceito.
- **`formato` inválido (erro 400)**: use `xlsx`, `pdf` ou `csv`, em minúsculas.
- **O arquivo veio cortado**: passou do limite (`X-Exportacao-Truncada`). Restrinja os filtros da tela ou, com decisão do projeto,
  aumente `EXPORTACAO_MAX_LINHAS` (máximo 100000).
- **O Usuário vê o CPF inteiro no arquivo**: confira o papel dele em **Usuários** (Gestor e Administrador veem completo de propósito).

Próximo passo: seguir a ordem de skills indicada pelo Claude Code.
