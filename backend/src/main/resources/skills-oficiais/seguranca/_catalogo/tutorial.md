# Tutorial — Segurança

## Passos comuns

1. No escritor.io, abra o painel **Skills** e baixe o `.zip` da skill **seguranca**.
2. Extraia o zip em `<seu-projeto>/.claude/skills/` (vale para todos que usam o projeto) ou em `~/.claude/skills/`
   (só para você). Deve ficar `.claude/skills/seguranca/SKILL.md`.
3. Abra o Claude Code na pasta do projeto e confira que a skill aparece (digite `/skills`).
4. Cole o prompt de uso da skill.

## Parte específica desta skill

### Pré-requisitos

| Ferramenta | Versão | Como conferir |
|---|---|---|
| Esqueleto do projeto | skill `novo-projeto-multiplica` já aplicada (existe `apps/api`) | `ls apps/api` ou `dir apps\api` |
| Node.js | 22.22 ou mais nova | `node --version` |
| pnpm | 9.15.4 | `pnpm --version` |
| Docker | qualquer versão recente (testes com Postgres e validação do Caddy) | `docker version` |
| Repositório no GitHub | para a CI, o Dependabot e o CodeQL rodarem | o projeto tem a aba **Actions** |

### Variáveis de ambiente

| Nome | Obrigatória | Exemplo | Para que serve |
|---|---|---|---|
| `PROXIES_CONFIAVEIS` | sim na instalação (atrás do Caddy); não em dev | `1` | quantos proxies ficam na frente da API; sem isso, atrás do Caddy, todo salvamento dá "Acesso negado" |
| `LIMITE_REQ_POR_IP` | não (padrão 300) | `300` | requisições por minuto por endereço IP; acima disso o sistema pede para esperar (erro 429) |
| `CORS_ORIGENS` | não (padrão: vazio, desligado) | `https://painel.exemplo.com.br` | só se OUTRO sistema, em outro endereço, chamar esta API pelo navegador |

### Dependências

Nenhum pacote npm novo: usa o NestJS, o Express, o zod e o Vite do esqueleto. Na instalação, o Caddy (imagem
`caddy:2`) aplica os cabeçalhos e a CSP. No GitHub, a CI usa as actions oficiais (`checkout`, `setup-node`,
`pnpm/action-setup`, `codeql-action`) e a imagem do gitleaks.

### Como verificar que funcionou

1. Abra um terminal **na pasta do projeto** (no VS Code: menu Terminal → Novo terminal; no Windows também serve o PowerShell).
2. Rode `pnpm install`, depois `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build`. Todos terminam sem erro.
3. Suba o sistema (`docker compose up -d postgres` e `pnpm dev`) e, em outro terminal, confira os cabeçalhos:
   - bash / Git Bash / macOS / Linux: `curl -sI http://localhost:3000/api/health`
   - PowerShell: `(Invoke-WebRequest http://localhost:3000/api/health).Headers`

   Devem aparecer `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` e
   `Cache-Control: no-store`, e **não** pode aparecer `X-Powered-By`.
4. Confira que um site de fora não consegue salvar nada (deve responder `403`):
   - bash: `curl -s -o /dev/null -w "%{http_code}\n" -X POST -H "Origin: https://malicioso.exemplo" http://localhost:3000/api/health`
   - PowerShell: `try { Invoke-WebRequest -Method Post -Headers @{Origin='https://malicioso.exemplo'} http://localhost:3000/api/health } catch { $_.Exception.Response.StatusCode.value__ }`
5. Valide o arquivo do Caddy (deve terminar com `Valid configuration`):
   - bash: `docker run --rm -v "$PWD/deploy/caddy:/etc/caddy" caddy:2 caddy validate --config /etc/caddy/teste/Caddyfile --adapter caddyfile`
   - PowerShell: `docker run --rm -v "${PWD}/deploy/caddy:/etc/caddy" caddy:2 caddy validate --config /etc/caddy/teste/Caddyfile --adapter caddyfile`
6. Depois de enviar ao GitHub: aba **Actions** → a CI aparece com os jobs `lint · typecheck · testes · build`,
   `gitleaks`, `pnpm audit` e `CodeQL`, todos verdes. Em Settings → Code security, ligue Dependabot e Code scanning.
7. Antes da homologação, abra `.claude/skills/seguranca/referencia/checklist-pentest.md` e marque cada item testado.

Próximo passo: seguir a ordem de skills indicada pelo Claude Code (a próxima é `email-transacional`).
