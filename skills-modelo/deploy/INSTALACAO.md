# Instalação do sistema no servidor (guia para a TI do cliente)

O sistema roda em Docker. Tudo fica na pasta `deploy/` (copie-a para o servidor, ex.: `/opt/sistema/deploy`). Não precisa instalar Node,
banco nem servidor web: o Docker baixa tudo. Os comandos aparecem em **bash** (Linux, recomendado) e **PowerShell** (Windows com Docker
Desktop); rode sempre **dentro da pasta `deploy/`**.

| Serviço | O que é | Porta |
|---|---|---|
| `caddy` | servidor web com HTTPS automático, na frente de tudo | 80 e 443 (as únicas abertas) |
| `app` | o sistema (telas e API) | nenhuma: só o `caddy` fala com ele |
| `worker` | tarefas em segundo plano (e-mails, rotinas da noite) | nenhuma |
| `migracao` | prepara o banco a cada subida e termina (aparece como `Exited (0)`: é normal) | nenhuma |
| `banco` | PostgreSQL 16 | nenhuma: acesso só por `docker compose exec banco ...` |
| `mailpit`, `clamav`, `langfuse-*` | opcionais (homologação, antivírus, painel de IA) | `mailpit` e `langfuse` só em 127.0.0.1 |

## 1. Instalar

Pré-requisitos: Docker 24+ com o plugin `docker compose` (`docker compose version`), 2 CPUs, 4 GB de RAM, 20 GB de disco; o DNS do
endereço do sistema apontando para o servidor; portas 80 e 443 liberadas (para certificado público, liberadas para a internet).

1. Gere os segredos (senhas e chaves aleatórias, em `segredos/`). Uma vez só; rodar de novo não troca nada que já existe.

   ```bash
   sh gerar-segredos.sh
   sudo chown -R root:root segredos && sudo chmod 700 segredos
   ```
   ```powershell
   docker run --rm -v "${PWD}:/deploy" busybox:1.37.0 sh /deploy/gerar-segredos.sh
   ```
   **Copie a pasta `segredos/` para o cofre de senhas do cliente.** Sem `segredos/dados_chaves` os CPFs guardados não podem mais ser lidos.
   Segredos que vêm de fora ficam em arquivos que nascem vazios (vazio = não usado): `smtp_senha` (senha do SMTP, se tiver usuário),
   `anthropic_api_key` (IA), `langfuse_secret_key` (chave secreta do projeto no Langfuse), `s3_secret_key` e `azure_connection_string`
   (armazenamento fora do servidor). Os arquivos são só-leitura: para preencher um, libere, escreva só o valor e trave de novo:

   ```bash
   sudo chmod 600 segredos/smtp_senha && sudo sh -c "printf '%s' 'A_SENHA' > segredos/smtp_senha" && sudo chmod 444 segredos/smtp_senha
   ```
   ```powershell
   Set-ItemProperty segredos\smtp_senha IsReadOnly $false; Set-Content -NoNewline -Encoding ascii segredos\smtp_senha 'A_SENHA'; Set-ItemProperty segredos\smtp_senha IsReadOnly $true
   ```
   As senhas da infraestrutura do Langfuse (profile `langfuse`) ficam em `segredos/langfuse.env`, lido só pelos serviços `langfuse-*`.
   Nenhum segredo vai no `.env`: ele é entregue à aplicação.

2. Configure: copie o modelo e preencha (cada linha tem um comentário dizendo o que é).

   ```bash
   cp .env.example .env && chmod 600 .env && nano .env
   ```
   ```powershell
   Copy-Item .env.example .env; notepad .env
   ```
   Obrigatórias: `DOMINIO`, `CADDY_TLS`, `APP_IMAGEM`, `APP_VERSAO`, `SMTP_HOST`, `EMAIL_REMETENTE`, `ADMIN_INICIAL_EMAIL`, `ALERTA_EMAIL`.
   - `CADDY_TLS=ti@exemplo.com.br` (o e-mail da TI): certificado público automático (Let's Encrypt), renovado sozinho.
   - `CADDY_TLS=internal`: rede interna sem acesso da internet. O Caddy emite o próprio certificado; instale a raiz dele nos computadores
     dos usuários (`docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt ./raiz-caddy.crt` e distribua por GPO).
   - `NODE_ENV=production` sempre, **inclusive em homologação** (outro valor é recusado ou deixa o login inseguro).
   - Homologação: `COMPOSE_PROFILES=mailpit`, `SMTP_HOST=mailpit`, `SMTP_PORT=1025`: nenhum e-mail sai; leia em http://127.0.0.1:8025.

3. Se a imagem estiver num registro privado, entre nele: `docker login registro.exemplo.com.br`.

4. Suba:

   ```bash
   docker compose up -d
   docker compose ps
   ```
   (PowerShell: os mesmos comandos.) Em 1 a 2 minutos: `app` e `banco` `healthy`, `migracao` `Exited (0)`, `caddy` e `worker` `Up`.

5. Confira: abra `https://SEU_DOMINIO` no navegador, ou

   ```bash
   curl https://sistema.exemplo.com.br/api/health          # rede interna (tls internal): curl -k ...
   ```
   ```powershell
   Invoke-RestMethod https://sistema.exemplo.com.br/api/health
   ```
   Resposta: `{"status":"ok","banco":"ok","versao":"1.0.0",...}`. Entre com o e-mail de `ADMIN_INICIAL_EMAIL`: o código chega por e-mail.

6. Agende o backup (seção 4) e rode `sh testar-backup.sh` uma vez para provar que ele restaura.

## 2. Atualizar para uma versão nova

1. **Backup antes** (seção 4).
2. No `.env`, troque `APP_VERSAO` (ex.: `1.0.0` → `1.1.0`).
3. `docker compose pull && docker compose up -d` (PowerShell: `docker compose pull; if ($?) { docker compose up -d }`). A `migracao` roda de novo (aplica as mudanças de banco da versão nova)
   e só depois `app` e `worker` são trocados. Fora do ar: alguns segundos.
4. Confira `/api/health`: o campo `versao` mostra a versão nova.

## 3. Voltar para a versão anterior

- **A versão nova não mudou o banco** (as notas da versão dizem): ponha o `APP_VERSAO` anterior no `.env` e `docker compose up -d`.
- **Mudou o banco** (ou na dúvida): a versão antiga pode não entender o banco novo. Volte o `APP_VERSAO` **e** restaure o backup feito
  antes da atualização (seção 5). O que foi feito no sistema depois do backup se perde: combine com o cliente antes.

Nunca use `latest`: é a versão no `.env` que permite saber o que está rodando e voltar.

## 4. Backup

O que entra: o banco inteiro (`pg_dump -Fc`) e os arquivos enviados pelos usuários. Ficam em `backups/` com data e hora, só o dono lê
(`chmod 600`), e os com mais de `BACKUP_DIAS` (padrão 14) são apagados.

```bash
sh backup.sh
# cron do root, todo dia às 2h:  sudo crontab -e  e acrescente
0 2 * * * cd /opt/sistema/deploy && mkdir -p backups && sh backup.sh >> backups/backup.log 2>&1
```
```powershell
$c = Get-Date -Format yyyyMMdd-HHmmss; New-Item -ItemType Directory -Force backups | Out-Null
docker compose exec banco pg_dump -U app -d app -Fc -f /tmp/backup.dump
docker compose cp banco:/tmp/backup.dump "backups/banco-$c.dump"; docker compose exec banco rm /tmp/backup.dump
docker compose run --rm --no-deps --user root -v "${PWD}/backups:/backups" app sh -c "cd /dados/arquivos && tar czf /backups/arquivos-$c.tar.gz ."
# agende no Agendador de Tarefas; apague à mão os com mais de 14 dias
```

- **Leve uma cópia para fora do servidor** (outro disco, nuvem do cliente). Backup só no mesmo disco não protege de perda do servidor.
- O backup **não** leva `segredos/` nem `.env`: guarde-os no cofre (sem `dados_chaves` os CPFs do backup não abrem).
- Uma vez por mês: `sh testar-backup.sh` restaura o último backup num banco de teste, compara com o do sistema e apaga o teste
  (`OK: backup ... restaurado` no fim).

## 5. Restaurar

Troca o banco do sistema pelo do backup **sem apagar o atual antes da hora**: o backup é restaurado num banco ao lado (`app_restaurando`)
com o sistema no ar e conferido; só então o sistema para alguns segundos, o banco atual vira `app_antes_<data>` e o restaurado vira `app`.
Se o backup falhar, nada muda. Os uploads atuais vão para `backups/arquivos-antes-<data>.tar.gz` antes da troca.

```bash
sh restore.sh --confirmar backups/banco-20260301-020000.dump backups/arquivos-20260301-020000.tar.gz
# conferido o sistema, apague o banco anterior (o nome aparece no fim da restauração):
docker compose exec banco dropdb -U app app_antes_20260301_093000
```
```powershell
$d = "backups/banco-20260301-020000.dump"; $t = "backups/arquivos-20260301-020000.tar.gz"; $c = Get-Date -Format yyyyMMdd_HHmmss
docker compose exec banco psql -U app -d postgres -c "DO `$`$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='app_runtime') THEN CREATE ROLE app_runtime NOLOGIN; END IF; END `$`$"
docker compose exec banco psql -U app -d postgres -c "DROP DATABASE IF EXISTS app_restaurando WITH (FORCE)" -c "CREATE DATABASE app_restaurando OWNER app"
docker compose cp $d banco:/tmp/restaurar.dump
docker compose exec banco pg_restore -U app -d app_restaurando --exit-on-error /tmp/restaurar.dump
if (-not $?) { throw "o backup não restaurou: o sistema não foi tocado (apague app_restaurando)" }
docker compose exec banco psql -U app -d app_restaurando -At -c "SELECT count(*) FROM drizzle.__drizzle_migrations"   # tem de ser maior que 0
docker compose run --rm --no-deps --user root -v "${PWD}/backups:/backups" app sh -c "rm -rf /dados/arquivos/.restaurando && mkdir /dados/arquivos/.restaurando && tar xzf /backups/$(Split-Path $t -Leaf) -C /dados/arquivos/.restaurando"
if (-not $?) { throw "os uploads não extraíram: nada foi trocado" }
docker compose stop app worker caddy
docker compose exec banco psql -v ON_ERROR_STOP=1 -U app -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='app' AND pid <> pg_backend_pid()" -c "ALTER DATABASE app RENAME TO app_antes_$c" -c "ALTER DATABASE app_restaurando RENAME TO app"
docker compose run --rm --no-deps --user root -v "${PWD}/backups:/backups" app sh -c "cd /dados/arquivos && tar czf /backups/arquivos-antes-$c.tar.gz --exclude=./.restaurando . && find . -mindepth 1 -maxdepth 1 ! -name .restaurando -exec rm -rf {} + && find .restaurando -mindepth 1 -maxdepth 1 -exec mv {} . \; && rmdir .restaurando && chown -R node:node /dados/arquivos"
docker compose up -d
```

Servidor novo: instale (seção 1) com a **mesma** pasta `segredos/` do servidor antigo, suba uma vez e então restaure. Só conferir um
backup, sem tocar no sistema: `BANCO_DESTINO=conferencia sh restore.sh backups/banco-....dump` (depois `docker compose exec banco dropdb -U app conferencia`).

## 6. Solução de problemas

Primeiro: `docker compose ps` e `docker compose logs --tail 100 <serviço>` (`app`, `worker`, `migracao`, `caddy`, `banco`).

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| `required variable DOMINIO is missing a value` (ou `APP_IMAGEM`, `APP_VERSAO`, `CADDY_TLS`) | linha faltando no `.env` | preencha a variável que a mensagem cita |
| `secret ... file ... not found` | `segredos/` não foi gerada | `sh gerar-segredos.sh` |
| `env file .../segredos/langfuse.env not found` | instalação anterior a este arquivo | `sh gerar-segredos.sh` (reaproveita as senhas `LANGFUSE_*` do `.env`; depois apague essas linhas do `.env`) |
| `migracao` `Exited (1)` e `app` não sobe | migração falhou | `docker compose logs migracao`; corrija e `docker compose up -d` |
| log `Configuração inválida` com a lista `problemas` | variável errada ou faltando no `.env` | cada item diz a variável e o motivo |
| log `ROLE é obrigatória` / `ALERTA_EMAIL é obrigatória` | `.env` antigo ou serviço criado à mão | use o `docker-compose.yml` da versão; preencha `ALERTA_EMAIL` |
| `... e ..._ARQUIVO definidos ao mesmo tempo` | segredo também posto no `.env` | apague a linha do `.env`: segredos ficam só em `segredos/` |
| navegador avisa "certificado inválido" | `CADDY_TLS=internal` sem a raiz instalada, ou DNS/portas erradas para o público | instale a raiz (seção 1) ou confira DNS e portas 80/443; `docker compose logs caddy` |
| erro 502 | `app` fora do ar ou reiniciando | `docker compose logs app` |
| erro 413 ao enviar arquivo | arquivo maior que `UPLOAD_MAX_MB` | aumente no `.env` e `docker compose up -d` (o Caddy acompanha) |
| login: o código não chega | SMTP | `docker compose logs worker` (o e-mail sai pela fila); confira `SMTP_*` e `segredos/smtp_senha` |
| `password authentication failed for user "app_runtime"` | `segredos/database_url_runtime` mudou e a migração não rodou | `docker compose up -d` (a `migracao` aplica a senha nova) |
| todo mundo bloqueado com 429 | escritório inteiro atrás de um IP | aumente `LIMITE_REQ_POR_IP` |
| disco cheio | backups antigos ou logs | `df -h`, `du -sh backups`; `docker system prune` (não apaga volumes) |

Nunca rode `docker compose down -v` em produção: o `-v` apaga o banco e os arquivos.
