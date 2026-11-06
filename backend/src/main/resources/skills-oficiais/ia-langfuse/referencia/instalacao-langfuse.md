# Langfuse self-host — instalação

Documento de apoio da skill `ia-langfuse` (e entrega para a skill `instalacao-docker-compose`). O arquivo `deploy/langfuse.compose.yml` define o profile `langfuse`.

## Subir (desenvolvimento ou servidor de teste)

1. Crie o arquivo `langfuse.env` (fora do git; `.gitignore` já ignora `*.env`) com um valor **diferente e aleatório** para cada segredo (`openssl rand -hex 32`;
   no PowerShell: `-join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Maximum 256) })`):

   ```
   LANGFUSE_NEXTAUTH_SECRET=
   LANGFUSE_SALT=
   LANGFUSE_ENCRYPTION_KEY=          # exatamente 64 caracteres hexadecimais
   LANGFUSE_DB_PASSWORD=
   LANGFUSE_CLICKHOUSE_PASSWORD=
   LANGFUSE_REDIS_PASSWORD=
   LANGFUSE_MINIO_PASSWORD=
   LANGFUSE_INIT_USER_EMAIL=ti@grupomultiplica.com.br
   LANGFUSE_INIT_USER_PASSWORD=      # senha do primeiro acesso; troque depois no painel
   LANGFUSE_URL_PUBLICA=http://localhost:3100
   ```

2. Suba: `docker compose -f docker-compose.yml -f deploy/langfuse.compose.yml --env-file langfuse.env --profile langfuse up -d`. Na primeira vez leva 2 a 4 minutos
   (migrações do ClickHouse). Confira: `curl http://127.0.0.1:3100/api/public/health` devolve `{"status":"OK",...}`.
3. Abra http://127.0.0.1:3100, entre com o e-mail e a senha de `LANGFUSE_INIT_*`. O cadastro aberto está desligado (`AUTH_DISABLE_SIGNUP=true`): outras pessoas entram por
   convite (Settings > Members).
4. No projeto **Sistema**, Settings > API Keys > Create: copie a *public key* e a *secret key* (a secret só aparece uma vez).
5. No `.env` da API: `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY` (em produção, `LANGFUSE_SECRET_KEY_ARQUIVO`) e `LANGFUSE_URL=http://127.0.0.1:3100` (API fora do compose)
   ou `http://langfuse-web:3000` (API dentro da mesma rede do compose). Reinicie a API.

## Regras

- Versões fixas (`3.227.0`, ClickHouse `25.8-alpine`, Redis `7.4.2-alpine`); subir de versão é decisão consciente: leia as notas de versão do Langfuse e teste fora de produção.
- Painel só em `127.0.0.1:3100`. Para a equipe acessar, ponha o Caddy na frente com HTTPS e defina `LANGFUSE_URL_PUBLICA` com o endereço público (`https://langfuse.exemplo.com.br`).
- O Langfuse tem banco próprio (`langfuse-db`); nunca use o Postgres do sistema para ele.
- Volumes `langfuse_db`, `langfuse_clickhouse_data` e `langfuse_minio_data` entram no backup do servidor (os traços são perdidos sem eles, o sistema não).
- Derrubar sem apagar dados: `docker compose ... --profile langfuse down`. Com `-v` os traços são apagados.

## Para a skill `instalacao-docker-compose`

Copie os serviços `langfuse-web`, `langfuse-worker`, `langfuse-db`, `langfuse-clickhouse`, `langfuse-redis`, `langfuse-minio-preparo`, `langfuse-minio` (todos com
`profiles: ["langfuse"]`) e os quatro volumes para `deploy/docker-compose.yml`, mantendo versões e `AUTH_DISABLE_SIGNUP`. Os segredos passam a vir dos arquivos de segredo
do compose de produção (nunca valor fixo no YAML) e o Caddy publica o painel num subdomínio próprio com HTTPS.
