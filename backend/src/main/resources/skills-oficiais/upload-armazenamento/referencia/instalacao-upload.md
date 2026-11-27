# Entrega para a skill de instalação (Docker Compose + Caddy)

O upload só funciona em produção se a infraestrutura deixar o corpo da requisição chegar à API. A skill `instalacao-docker-compose`
(que ainda será aplicada) precisa configurar:

1. **Caddy, tamanho do corpo.** O limite de JSON da API (padrão do Express, 100 KB) NÃO vale para multipart; o teto do upload é
   `UPLOAD_MAX_MB` (a API devolve 413). O Caddy na frente tem de aceitar pelo menos `UPLOAD_MAX_MB` mais ~1 MB de margem do multipart,
   senão o proxy corta antes. No bloco do site, antes do `reverse_proxy`:

   ```caddy
   sistema.exemplo.com.br {
       import seguranca
       request_body {
           max_size 12MB      # UPLOAD_MAX_MB=10 + margem; nunca "sem limite"
       }
       reverse_proxy api:3000
   }
   ```
   Com nginx o equivalente é `client_max_body_size 12m;`. Se o proxy tiver tempo limite de leitura curto, aumente-o para o upload
   mais lento esperado (`reverse_proxy { transport http { read_timeout 120s } }`).

2. **Volume do armazenamento local** (`ARMAZENAMENTO_TIPO=local`): volume nomeado montado em `ARMAZENAMENTO_PASTA` (ex.: `/dados/arquivos`)
   no serviço `api`, com dono o usuário não-root da imagem, e incluído no backup. Sem volume, os arquivos somem ao recriar o contêiner.

3. **Segredo do link**: `ARMAZENAMENTO_SEGREDO_URL_ARQUIVO=/run/secrets/segredo_url` (mínimo 32 caracteres). Em produção com `local` a API não sobe sem ele.

4. **ClamAV opcional** (`ANTIVIRUS_HABILITADO=true`): serviço no compose de instalação, em rede interna, sem porta publicada:

   ```yaml
   clamav:
     image: clamav/clamav:1.4.6
     profiles: ["antivirus"]
     environment:
       CLAMD_CONF_StreamMaxLength: 600M   # maior que UPLOAD_MAX_MB
     volumes:
       - clamav:/var/lib/clamav
     healthcheck:
       test: ["CMD-SHELL", "clamdcheck.sh"]
       interval: 15s
       retries: 40
       start_period: 60s
   ```
   Suba com `docker compose --profile antivirus up -d` e defina `CLAMAV_HOST=clamav`. O clamd leva alguns minutos no primeiro start.

5. **S3 / Azure**: bucket ou container PRIVADO (sem acesso público), credencial só com leitura/escrita/remoção nesse bucket, cifragem em
   repouso ligada no provedor. Segredos por `S3_SECRET_KEY_ARQUIVO` e `AZURE_CONNECTION_STRING_ARQUIVO`.
