# Tutorial — Instalação com Docker Compose

## Passos comuns

1. No escritor.io, abra o painel **Skills** e baixe o `.zip` da skill **instalacao-docker-compose**.
2. Extraia o zip em `<seu-projeto>/.claude/skills/` (vale para todos que usam o projeto) ou em `~/.claude/skills/`
   (só para você). Deve ficar `.claude/skills/instalacao-docker-compose/SKILL.md`.
3. Abra o Claude Code na pasta do projeto e confira que a skill aparece (digite `/skills`).
4. Cole o prompt de uso da skill.

## Parte específica desta skill

### O que ela entrega

Tudo o que a TI do cliente precisa para colocar o sistema no ar no servidor dela: uma **imagem** do sistema (um pacote com tudo dentro, uma
por versão), a pasta `deploy/` com a configuração do Docker, o servidor web **Caddy** que cuida do HTTPS sozinho, scripts de **backup** e
**restauração** (e um que prova que o backup volta) e o guia `deploy/INSTALACAO.md`, escrito para a TI, com cada comando em bash (Linux) e
PowerShell (Windows). Ela é a última skill a aplicar: use depois que o sistema estiver pronto.

### Pré-requisitos

| Ferramenta | Versão | Como conferir |
|---|---|---|
| Esqueleto do projeto | skills `novo-projeto-multiplica` até pelo menos `fila-de-tarefas` aplicadas | `ls apps/api/src/fila` ou `dir apps\api\src\fila` |
| Node.js | 22.22 ou mais nova | `node --version` |
| pnpm | 9.15.4 | `pnpm --version` |
| Docker | 24 ou mais nova, com `docker compose` | `docker compose version` |

### Variáveis de ambiente (arquivo `deploy/.env` do servidor)

| Nome | Obrigatória | Exemplo | Para que serve |
|---|---|---|---|
| `DOMINIO` | sim | `sistema.exemplo.com.br` | endereço do sistema (o DNS aponta para o servidor) |
| `CADDY_TLS` | sim | `ti@exemplo.com.br` ou `internal` | e-mail = certificado HTTPS público automático; `internal` = rede interna |
| `APP_IMAGEM` | sim | `registro.exemplo.com.br/sistema` | onde está a imagem |
| `APP_VERSAO` | sim | `1.0.0` | qual versão rodar (nunca `latest`); trocar = atualizar |
| `ALERTA_EMAIL` | sim | `ti@exemplo.com.br` | quem recebe aviso de tarefa que falhou |
| `SMTP_HOST`, `EMAIL_REMETENTE`, `ADMIN_INICIAL_EMAIL` | sim | `smtp.exemplo.com.br` | e-mail e primeira pessoa administradora |
| `UPLOAD_MAX_MB` | não (10) | `10` | tamanho máximo de arquivo; o Caddy acompanha sozinho |
| `COMPOSE_PROFILES` | não | `mailpit` | serviços opcionais: `mailpit` (homologação), `antivirus`, `langfuse` |
| `PORTA_HTTP`, `PORTA_HTTPS` | não (80, 443) | `8443` | só se 80/443 estiverem ocupadas |
| `BACKUP_DIAS` | não (14) | `14` | por quantos dias os backups ficam |

Senhas e chaves **não** vão no `.env`: o script `gerar-segredos.sh` cria a pasta `deploy/segredos/` com valores aleatórios.

### Dependências

Nenhum pacote novo no código. No servidor só o Docker; as imagens usadas são `node:22.22.0-alpine3.22` (build), `caddy:2.10.2-alpine`,
`postgres:16-alpine` e, se ligados, `axllent/mailpit:v1.31.6`, `clamav/clamav:1.4.6` e as do Langfuse.

### Como verificar que funcionou

1. Abra um terminal **na pasta do projeto** (no VS Code: menu Terminal → Novo terminal; no Windows também serve o PowerShell).
2. Rode `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build`: todos sem erro (o Docker precisa estar aberto).
3. Monte a imagem e suba uma instalação de teste no seu computador (bash; no PowerShell troque `$(git rev-parse --short HEAD)` por `teste`
   e o `sh gerar-segredos.sh` por `docker run --rm -v "${PWD}:/deploy" busybox:1.37.0 sh /deploy/gerar-segredos.sh`):
   ```bash
   docker build -t sistema-teste:0.0.1 --build-arg APP_VERSAO=0.0.1 --build-arg APP_COMMIT=$(git rev-parse --short HEAD) .
   cd deploy
   sh gerar-segredos.sh
   cp .env.example .env
   ```
   No `.env` ponha: `DOMINIO=localhost`, `CADDY_TLS=internal`, `APP_IMAGEM=sistema-teste`, `APP_VERSAO=0.0.1`, `PROJETO=sistemateste`,
   `PORTA_HTTPS=8443`, `PORTA_HTTP=8080`, `COMPOSE_PROFILES=mailpit`, `SMTP_HOST=mailpit`, `SMTP_PORT=1025`,
   `EMAIL_REMETENTE=Sistema <nao-responda@exemplo.com.br>` e `ADMIN_INICIAL_EMAIL=` com o seu e-mail. Depois:
   ```bash
   docker compose up -d
   docker compose ps
   curl -k https://localhost:8443/api/health
   ```
   Esperado: `app` e `banco` `healthy`, `migracao` `Exited (0)` e `{"status":"ok","banco":"ok","versao":"0.0.1",...}`
   (PowerShell: `curl.exe -k https://localhost:8443/api/health`).
4. Abra `https://localhost:8443` no navegador (aceite o aviso do certificado de teste), entre com o seu e-mail e pegue o código em
   http://127.0.0.1:8025 (Mailpit). Entrou: login, HTTPS, e-mail e worker funcionando.
5. Rode `sh testar-backup.sh` (bash ou Git Bash): termina com `OK: backup ... restaurado num banco vazio`.
6. Desmonte o teste (apaga os dados **deste teste**): `docker compose down -v`. Nunca rode `down -v` no servidor do cliente.
7. Entregue à TI do cliente a pasta `deploy/` (sem `segredos/`, `backups/` e `.env`) e o guia `deploy/INSTALACAO.md`.
