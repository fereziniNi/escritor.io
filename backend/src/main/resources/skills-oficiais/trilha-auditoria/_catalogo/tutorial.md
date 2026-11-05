# Tutorial — Trilha de auditoria

## Passos comuns

1. No escritor.io, abra o painel **Skills** e baixe o `.zip` da skill **trilha-auditoria**.
2. Extraia o zip em `<seu-projeto>/.claude/skills/` (vale para todos que usam o projeto) ou em `~/.claude/skills/`
   (só para você). Deve ficar `.claude/skills/trilha-auditoria/SKILL.md`.
3. Abra o Claude Code na pasta do projeto e confira que a skill aparece (digite `/skills`).
4. Cole o prompt de uso da skill.

## Parte específica desta skill

### Como funciona para quem usa o sistema

O administrador abre **Admin → Auditoria** e vê, do mais novo para o mais velho, quem fez o quê: entrou ou saiu do sistema,
errou o código de acesso, convidou alguém, trocou o papel de uma pessoa, desativou ou reativou. Cada linha mostra data e hora
(horário de Brasília), quem fez, a ação, o alvo e o IP; em **Detalhes** aparecem o "antes" e o "depois". Dá para filtrar por
período, pessoa e ação e **Exportar CSV** (abre no Excel). Esses registros **não podem ser editados nem apagados**, nem por
quem administra o sistema. Senhas, códigos de acesso e e-mails completos nunca são guardados ali.

### Pré-requisitos

| Ferramenta | Versão | Como conferir |
|---|---|---|
| Esqueleto do projeto | skills `novo-projeto-multiplica`, `identidade-visual`, `seguranca`, `email-transacional`, `usuarios-e-papeis` e `login-codigo-email` já aplicadas | `ls apps/api/src/auth` ou `dir apps\api\src\auth` |
| Node.js | 22.22 ou mais nova | `node --version` |
| pnpm | 9.15.4 | `pnpm --version` |
| Docker | qualquer versão recente (Postgres de desenvolvimento e dos testes) | `docker version` |

### Variáveis de ambiente

| Nome | Obrigatória | Exemplo | Para que serve |
|---|---|---|---|
| `DATABASE_URL_RUNTIME` ou `DATABASE_URL_RUNTIME_ARQUIVO` | **sim em produção** (sem ela a API sobe, mas avisa no log a cada início); em desenvolvimento pode faltar | `DATABASE_URL_RUNTIME_ARQUIVO=/run/secrets/database_url_runtime` | endereço do banco com o usuário `app_runtime`, que **não pode** alterar nem apagar a auditoria. É o que a API usa. Tem senha: em produção, só em arquivo de segredo, nunca no git nem no chat |
| `DATABASE_URL` | sim (já existia) | `postgres://app:...@postgres:5432/app` | passa a ser o usuário **dono** do banco, usado só pelo serviço de migração (cria tabelas); a API em produção não precisa mais dele |

O usuário `app_runtime` é criado pela migração **sem senha e sem login**. Quem instala dá o login uma vez (veja "Como verificar").
Em desenvolvimento, a senha pode ser de brinquedo (`app_runtime`). Em produção gere uma forte: `openssl rand -hex 24` (bash) ou, no
PowerShell, `$b = New-Object byte[] 24; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); ($b | ForEach-Object { $_.ToString('x2') }) -join ''`
(nunca `Get-Random`).

### Dependências

Nenhum pacote novo. Cria uma tabela (`evento_auditoria`), um gatilho e o papel de banco `app_runtime`, por duas migrações.

### Como verificar que funcionou

1. Abra um terminal **na pasta do projeto** (no VS Code: menu Terminal → Novo terminal; no Windows também serve o PowerShell).
2. Rode `pnpm install`, depois `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build`. Todos terminam sem erro (os testes sobem um
   Postgres temporário; o Docker precisa estar aberto). Os testes de auditoria provam, no banco de verdade, que `UPDATE`, `DELETE`
   e `TRUNCATE` na trilha falham para o usuário da API **e** para o dono.
3. Veja funcionando em desenvolvimento:
   - bash / Git Bash / macOS / Linux:
     ```bash
     docker compose up -d postgres mailpit
     pnpm --filter api db:migrate
     docker compose exec postgres psql -U app -d app -c "ALTER ROLE app_runtime LOGIN PASSWORD 'app_runtime'"
     ```
   - PowerShell:
     ```powershell
     docker compose up -d postgres mailpit
     pnpm --filter api db:migrate
     docker compose exec postgres psql -U app -d app -c "ALTER ROLE app_runtime LOGIN PASSWORD 'app_runtime'"
     ```
   Depois abra o arquivo `.env`, tire o `#` da linha `DATABASE_URL_RUNTIME=...`, rode `pnpm dev`, entre em http://localhost:5173 como
   administrador, convide uma pessoa de teste e desative-a. Abra **Admin → Auditoria**: devem aparecer o login, o convite e a
   desativação, com antes e depois.
4. Prove que a auditoria é imutável (os dois comandos têm de **falhar**):
   ```bash
   docker compose exec postgres psql postgres://app_runtime:app_runtime@localhost:5432/app -c "delete from evento_auditoria"
   docker compose exec postgres psql -U app -d app -c "update evento_auditoria set acao = 'x'"
   ```
   O primeiro responde `permission denied for table evento_auditoria`; o segundo (dono) responde `evento_auditoria é imutável`. No
   PowerShell os comandos são os mesmos.
5. Confira com quem a API está conectada: `docker compose exec postgres psql -U app -d app -c "select usename, count(*) from pg_stat_activity where datname = 'app' group by usename"`
   deve listar `app_runtime` (a API) além de `app`.
6. Exportar: em **Admin → Auditoria**, clique **Exportar CSV**; o arquivo abre no Excel com acentos corretos e colunas separadas.

### Se não funcionar

- **A API não conecta e cita `password authentication failed for user "app_runtime"`**: falta o comando `ALTER ROLE app_runtime LOGIN
  PASSWORD ...` (passo 3), ou a senha do `.env` é outra.
- **`role "app_runtime" does not exist`** ao conectar: a migração ainda não rodou (`pnpm --filter api db:migrate`).
- **A migração falha com `permission denied to create role`**: o usuário dono do banco não pode criar papéis. Peça à TI para criar o
  papel antes (`CREATE ROLE app_runtime NOLOGIN`) e rode a migração de novo.
- **Na API em produção o log diz "DATABASE_URL_RUNTIME não definida"**: a API está usando o usuário dono. Defina a variável (tabela
  acima): sem isso a auditoria só fica protegida pelo gatilho do banco.
- **A tela de Auditoria dá 403**: só administradores (papel ADMIN) enxergam. Peça a um administrador para mudar seu papel em **Usuários**.
- **O CSV abre com acentos quebrados ou numa coluna só**: abra pelo Excel normal (não importe como texto); o arquivo já vem com
  marca UTF-8 e separador `;`. Se o Excel estiver configurado com outro separador, use Dados → De Texto/CSV e escolha ponto e vírgula.
- **"Exportação cortada em 10.000 linhas"**: restrinja o período ou os filtros e exporte de novo.

Próximo passo: seguir a ordem de skills indicada pelo Claude Code.
