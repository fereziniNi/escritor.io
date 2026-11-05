# Tutorial — Usuários e papéis

## Passos comuns

1. No escritor.io, abra o painel **Skills** e baixe o `.zip` da skill **usuarios-e-papeis**.
2. Extraia o zip em `<seu-projeto>/.claude/skills/` (vale para todos que usam o projeto) ou em `~/.claude/skills/`
   (só para você). Deve ficar `.claude/skills/usuarios-e-papeis/SKILL.md`.
3. Abra o Claude Code na pasta do projeto e confira que a skill aparece (digite `/skills`).
4. Cole o prompt de uso da skill.

## Parte específica desta skill

### Pré-requisitos

| Ferramenta | Versão | Como conferir |
|---|---|---|
| Esqueleto do projeto | skills `novo-projeto-multiplica`, `identidade-visual`, `seguranca` e `email-transacional` já aplicadas | `ls apps/api/src/email` ou `dir apps\api\src\email` |
| Node.js | 22.22 ou mais nova | `node --version` |
| pnpm | 9.15.4 | `pnpm --version` |
| Docker | qualquer versão recente (Postgres de desenvolvimento e dos testes; Mailpit para ver o convite) | `docker version` |

### Variáveis de ambiente

| Nome | Obrigatória | Exemplo | Para que serve |
|---|---|---|---|
| `ADMIN_INICIAL_EMAIL` | recomendada em produção | `ana.souza@grupomultiplica.com.br` | e-mail da primeira pessoa administradora: se não existir nenhum administrador ativo, a API cria (ou reativa) esse usuário como `ADMIN` ao subir. Depois que existe um administrador, a variável não faz mais nada |
| `NOME_SISTEMA` | não (padrão `Sistema`) | `Crédito Multiplica` | nome do sistema que aparece no e-mail de convite (uma linha, até 80 caracteres) |

O e-mail do convite sai pela configuração da skill `email-transacional` (`MAIL_MODE`, `SMTP_*`, `EMAIL_REMETENTE`).

### Dependências

Nenhum pacote novo. Usa o que o esqueleto já traz (NestJS, Drizzle, zod) e as skills `email-transacional`
(convite) e `seguranca` (proteção das rotas que alteram dados). O **login** é de outra skill
(`login-codigo-email`): esta skill deixa pronto o ponto de ligação (`req.usuario`), então a tela de usuários só abre de
verdade depois que o login for aplicado.

### Como verificar que funcionou

1. Abra um terminal **na pasta do projeto** (no VS Code: menu Terminal → Novo terminal; no Windows também serve o PowerShell).
2. Rode `pnpm install`, depois `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build`. Todos terminam sem erro
   (os testes de API sobem um Postgres temporário; o Docker precisa estar aberto).
3. Confira que foi gerada a migração do banco: deve existir um arquivo `.sql` novo em `apps/api/drizzle`.
   - bash / Git Bash / macOS / Linux: `ls apps/api/drizzle`
   - PowerShell: `dir apps\api\drizzle`
4. Veja o primeiro administrador sendo criado. Coloque seu e-mail em `ADMIN_INICIAL_EMAIL` no arquivo `.env`, depois:
   - bash / Git Bash / macOS / Linux: `docker compose up -d postgres mailpit && pnpm --filter api db:migrate && pnpm dev`
   - PowerShell: `docker compose up -d postgres mailpit; pnpm --filter api db:migrate; pnpm dev`
5. Em outro terminal, consulte o banco (deve aparecer uma linha, com seu e-mail em minúsculas, `ADMIN` e `t`):
   `docker compose exec postgres psql -U app -c "select email, papel, ativo from usuario"`
6. Pare e suba de novo a API (`Ctrl+C`, `pnpm dev`) e repita a consulta do passo 5: continua **uma** linha só.
7. Quando o login estiver aplicado, entre com o e-mail do administrador, abra **Admin → Usuários**, convide outra
   pessoa e abra http://localhost:8025 (Mailpit): chega o e-mail "Você foi adicionado ao sistema". Tente desativar
   o único administrador: a tela mostra "Não é possível remover o último administrador ativo".

### Se não funcionar

- **A API não sobe e cita `ADMIN_INICIAL_EMAIL`**: o valor não é um e-mail válido (confira espaços e o `@`).
- **Nada foi criado no banco**: a migração não foi aplicada (rode `pnpm --filter api db:migrate`) ou já existe um administrador
  ativo (a variável só age quando não existe nenhum).
- **"Acesso negado" (403) ou "Não autenticado" (401) na tela de usuários**: o login ainda não preenche `req.usuario`
  (veja a seção do contrato na skill) ou a pessoa não é administradora.

Próximo passo: seguir a ordem de skills indicada pelo Claude Code.
