# Tutorial — Login por código no e-mail

## Passos comuns

1. No escritor.io, abra o painel **Skills** e baixe o `.zip` da skill **login-codigo-email**.
2. Extraia o zip em `<seu-projeto>/.claude/skills/` (vale para todos que usam o projeto) ou em `~/.claude/skills/`
   (só para você). Deve ficar `.claude/skills/login-codigo-email/SKILL.md`.
3. Abra o Claude Code na pasta do projeto e confira que a skill aparece (digite `/skills`).
4. Cole o prompt de uso da skill.

## Parte específica desta skill

### Como funciona para quem usa o sistema

A pessoa digita o e-mail e clica em **Receber código**. Se o e-mail estiver cadastrado (e ativo) em **Admin → Usuários**,
chega um e-mail "Seu código de acesso" com 6 números, que valem por 10 minutos. Ela digita o código e entra. Não existe
senha. A tela responde sempre a mesma coisa ("Se o e-mail tiver acesso, enviamos um código"), para ninguém descobrir
quem tem acesso. A sessão acaba depois de 30 minutos sem uso ou 12 horas depois de entrar, ou no botão **Sair**.

### Pré-requisitos

| Ferramenta | Versão | Como conferir |
|---|---|---|
| Esqueleto do projeto | skills `novo-projeto-multiplica`, `identidade-visual`, `seguranca`, `email-transacional` e `usuarios-e-papeis` já aplicadas | `ls apps/api/src/usuarios` ou `dir apps\api\src\usuarios` |
| Node.js | 22.22 ou mais nova | `node --version` |
| pnpm | 9.15.4 | `pnpm --version` |
| Docker | qualquer versão recente (Postgres e Mailpit de desenvolvimento e dos testes) | `docker version` |
| Navegador do Playwright | Chromium, uma vez por máquina (para o teste de login de verdade) | `pnpm --filter web exec playwright install chromium` |

### Variáveis de ambiente

| Nome | Obrigatória | Exemplo | Para que serve |
|---|---|---|---|
| `AUTH_SEGREDO_CODIGO` ou `AUTH_SEGREDO_CODIGO_ARQUIVO` | **sim em produção** (o sistema não sobe sem ela); em dev pode faltar | `AUTH_SEGREDO_CODIGO_ARQUIVO=/run/secrets/auth_segredo_codigo` | chave secreta (mínimo 32 caracteres) usada para guardar os códigos de forma ilegível. Gere com `openssl rand -hex 32` (bash) ou `-join ((1..32) \| % { '{0:x2}' -f (Get-Random -Max 256) })` (PowerShell). A mesma em todas as instâncias; nunca no git nem no chat |
| `AUTH_DOMINIOS_PERMITIDOS` | não (vazia: qualquer e-mail cadastrado) | `grupomultiplica.com.br,exemplo.com.br` | só e-mails destes domínios podem pedir código (domínio exato) |
| `AUTH_SESSAO_OCIOSA_MIN` | não (padrão 30) | `30` | minutos sem uso até a sessão acabar |
| `AUTH_SESSAO_ABSOLUTA_H` | não (padrão 12) | `12` | horas depois do login até a sessão acabar, mesmo em uso |

Também usadas: `ADMIN_INICIAL_EMAIL` (skill `usuarios-e-papeis`: é quem consegue entrar primeiro), as variáveis de
e-mail (skill `email-transacional`: `MAIL_MODE`, `SMTP_*`, `EMAIL_REMETENTE`) e `PROXIES_CONFIAVEIS=1` na instalação
(skill `seguranca`: sem ela o limite por IP vale para o servidor inteiro).

### Dependências

Nenhum pacote novo. Usa o que o esqueleto e as skills anteriores já trazem (NestJS, Drizzle, zod, nodemailer,
Playwright). O login cria duas tabelas novas no banco (`codigo_login` e `sessao`), por migração.

### Como verificar que funcionou

1. Abra um terminal **na pasta do projeto** (no VS Code: menu Terminal → Novo terminal; no Windows também serve o PowerShell).
2. Rode `pnpm install`, depois `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build`. Todos terminam sem erro
   (os testes sobem um Postgres temporário; o Docker precisa estar aberto). Os testes de login demoram um pouco de
   propósito: cada resposta leva pelo menos 0,6 segundo.
3. Teste o login de verdade, automático, num banco novo:
   - bash / Git Bash / macOS / Linux: `docker compose up -d postgres mailpit && pnpm build && cd apps/web && pnpm exec playwright test -c e2e/login-real.config.ts`
   - PowerShell: `docker compose up -d postgres mailpit; pnpm build; cd apps\web; pnpm exec playwright test -c e2e/login-real.config.ts`

   Deve terminar com `1 passed`. (Se o banco de desenvolvimento já tem outro administrador, defina `E2E_EMAIL` com o
   e-mail dele antes do comando.)
4. Ou à mão: coloque seu e-mail em `ADMIN_INICIAL_EMAIL` no `.env`, rode `pnpm --filter api db:migrate` e `pnpm dev`,
   abra http://localhost:5173, digite o e-mail, clique em **Receber código**, abra http://localhost:8025 (Mailpit),
   copie os 6 números e entre. Seu nome aparece no canto de baixo da barra lateral. Clique em **Sair**: volta para a tela
   de entrada.
5. Confira que o banco não guarda o código nem o token (as colunas mostram só sequências longas de letras e números):
   `docker compose exec postgres psql -U app -c "select email, hmac, tentativas, usado from codigo_login"`
6. Confira que produção exige o segredo (deve terminar com erro citando `AUTH_SEGREDO_CODIGO`): suba a API com
   `NODE_ENV=production` sem a variável, ou rode `pnpm --filter api test` e veja o teste "em produção sem
   AUTH_SEGREDO_CODIGO a API não sobe" passando.

### Se não funcionar

- **O e-mail com o código não chega**: o e-mail não está cadastrado ou está desativado em **Usuários**, está fora de
  `AUTH_DOMINIOS_PERMITIDOS`, ou passou de 3 pedidos em 10 minutos (espere). Em dev, confira o Mailpit
  (http://localhost:8025) e se `MAIL_MODE=smtp` está no `.env`; com `MAIL_MODE=log` o código não é enviado.
- **"Código inválido ou expirado"**: o código tem mais de 10 minutos, já foi usado, um código mais novo foi pedido
  (só o último vale) ou houve 5 tentativas erradas. Peça outro.
- **Entra e logo volta para a tela de entrada**: o navegador não guardou o cookie. Em produção o sistema precisa estar
  em **https** (o cookie `__Host-sessao` só existe em https). Em dev, use http://localhost (não o IP da máquina).
- **"Muitas requisições" (429)**: muitos pedidos do mesmo endereço de rede em 10 minutos; espere o tempo indicado.
  Na instalação, confira `PROXIES_CONFIAVEIS=1`.
- **A API não sobe e cita `AUTH_SEGREDO_CODIGO`**: em produção a variável é obrigatória (veja a tabela acima).

Próximo passo: seguir a ordem de skills indicada pelo Claude Code.
