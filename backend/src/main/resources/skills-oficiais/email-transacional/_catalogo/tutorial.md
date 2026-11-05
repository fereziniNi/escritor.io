# Tutorial — E-mail transacional

## Passos comuns

1. No escritor.io, abra o painel **Skills** e baixe o `.zip` da skill **email-transacional**.
2. Extraia o zip em `<seu-projeto>/.claude/skills/` (vale para todos que usam o projeto) ou em `~/.claude/skills/`
   (só para você). Deve ficar `.claude/skills/email-transacional/SKILL.md`.
3. Abra o Claude Code na pasta do projeto e confira que a skill aparece (digite `/skills`).
4. Cole o prompt de uso da skill.

## Parte específica desta skill

### Pré-requisitos

| Ferramenta | Versão | Como conferir |
|---|---|---|
| Esqueleto do projeto | skills `novo-projeto-multiplica`, `identidade-visual` e `seguranca` já aplicadas | `ls apps/api` ou `dir apps\api` |
| Node.js | 22.22 ou mais nova | `node --version` |
| pnpm | 9.15.4 | `pnpm --version` |
| Docker | qualquer versão recente (Mailpit de desenvolvimento e testes com Postgres/Mailpit) | `docker version` |
| Servidor SMTP | só para produção: servidor, porta, usuário e senha (peça à TI do cliente) | — |

### Variáveis de ambiente

| Nome | Obrigatória | Exemplo | Para que serve |
|---|---|---|---|
| `MAIL_MODE` | sim em produção (`smtp`); em dev o padrão é `log` | `smtp` | `smtp` envia de verdade; `log` só registra (nada é enviado) e o sistema **recusa subir** com `log` em produção |
| `SMTP_HOST` | sim com `smtp` | `smtp.exemplo.com.br` (dev: `localhost`) | servidor SMTP |
| `SMTP_PORT` | não (padrão 587) | `587` (dev: `1025`) | porta do servidor |
| `SMTP_SEGURO` | não (padrão `false`) | `false` | `true` = TLS direto (porta 465); `false` = STARTTLS (587) |
| `SMTP_USUARIO` | só se o servidor pede login | `apikey` | usuário do SMTP |
| `SMTP_SENHA` ou `SMTP_SENHA_ARQUIVO` | só junto com o usuário | `SMTP_SENHA_ARQUIVO=/run/secrets/smtp_senha` | senha do SMTP; em produção use o arquivo, nunca texto no `.env` |
| `EMAIL_REMETENTE` | sim com `smtp` | `Sistema <nao-responda@exemplo.com.br>` | quem aparece como remetente (domínio do cliente, com SPF e DKIM) |

### Dependências

Pacotes npm novos na API: `nodemailer` 10.3.1, e (desenvolvimento) `@types/nodemailer` 8.0.2 e `testcontainers`
12.2.1. Imagem Docker de desenvolvimento: `axllent/mailpit:v1.31.6` (caixa de entrada falsa, só na sua máquina).

### Como verificar que funcionou

1. Abra um terminal **na pasta do projeto** (no VS Code: menu Terminal → Novo terminal; no Windows também serve o PowerShell).
2. Rode `pnpm install`, depois `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build`. Todos terminam sem erro
   (o teste de e-mail sobe um Mailpit temporário; o Docker precisa estar aberto).
3. Suba o Mailpit e a API em desenvolvimento:
   - bash / Git Bash / macOS / Linux: `docker compose up -d mailpit postgres && cp -n .env.example .env && pnpm dev`
   - PowerShell: `docker compose up -d mailpit postgres; if (-not (Test-Path .env)) { Copy-Item .env.example .env }; pnpm dev`
4. Peça ao Claude Code para disparar um e-mail de teste (ou use a tela do sistema que envia e-mail) e abra
   http://localhost:8025: a mensagem aparece com a faixa azul-marinho, a borda azul e a versão texto na aba **Text**.
5. Confira que o Mailpit só está acessível na sua máquina (deve mostrar `127.0.0.1`):
   - bash: `docker compose ps mailpit`
   - PowerShell: `docker compose ps mailpit`
6. Confira que produção recusa o modo log (deve terminar com erro citando `MAIL_MODE`):
   - bash: `NODE_ENV=production MAIL_MODE=log DATABASE_URL=postgres://a:b@localhost:5432/c pnpm --filter api exec tsx -e "import('./src/config/config').then(m => m.carregarConfig())"`
   - PowerShell: `$env:NODE_ENV='production'; $env:MAIL_MODE='log'; $env:DATABASE_URL='postgres://a:b@localhost:5432/c'; pnpm --filter api exec tsx -e "import('./src/config/config').then(m => m.carregarConfig())"; Remove-Item Env:NODE_ENV, Env:MAIL_MODE, Env:DATABASE_URL`
7. Em produção, antes de entregar: configure as variáveis da tabela, envie um e-mail real para você mesmo e confira
   com a TI do cliente o SPF e o DKIM do domínio do remetente (sem isso o e-mail cai em spam).

Próximo passo: seguir a ordem de skills indicada pelo Claude Code.
