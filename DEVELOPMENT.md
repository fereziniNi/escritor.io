# Rodando o projeto localmente

> Backend (S0.1) e frontend (S0.2) já existem como esqueleto — ver [docs/incremental-plan.md](docs/incremental-plan.md).

## Pré-requisitos

- Java 21+ (JDK)
- Node.js 20+ e npm
- Docker (para o Postgres local **e** para os testes do backend via Testcontainers)

Maven **não** precisa estar instalado — o projeto usa o Maven Wrapper (`./mvnw`, `mvnw.cmd` no Windows), que baixa a versão correta automaticamente.

## Banco de dados local

```bash
docker compose up -d
```

Sobe um Postgres em `localhost:5432` e o Mailpit (SMTP fake para o login por e-mail — ver [docs/adr/0008-login-passwordless-email.md](docs/adr/0008-login-passwordless-email.md)) para uso do backend em modo `dev`. Nenhum e-mail sai de verdade: veja os códigos de login recebidos em **http://localhost:8025**. Os testes do backend **não** usam esses containers — Testcontainers sobe os seus próprios efêmeros a cada execução de suíte (ver [docs/adr/0004-testcontainers.md](docs/adr/0004-testcontainers.md)).

Na **primeira** subida (volume `postgres_data` vazio), o Postgres também cria o papel `presenca_app` — o papel de runtime que a aplicação usa, sem privilégio de dono sobre as tabelas (ver [ADR 0009](docs/adr/0009-papel-de-banco-separado-para-runtime.md)). Se você já tinha um volume de antes dessa fatia (S2.1) e o backend falhar ao subir com "role presenca_app does not exist", recrie o volume: `docker compose down -v && docker compose up -d`.

## Backend

```bash
cd backend
./mvnw spring-boot:run     # roda a aplicação em modo dev (requer o Postgres do docker-compose no ar)
./mvnw test                # testes unitários (Surefire) — rápidos, sem Docker
./mvnw verify               # unitários + integração (Failsafe/Testcontainers) — requer Docker ativo
```

No Windows, sem Git Bash/WSL, use `mvnw.cmd` no lugar de `./mvnw`.

`GET /health` (via Spring Boot Actuator) confirma que a aplicação subiu e conseguiu migrar o schema.

## Frontend

```bash
cd frontend
npm install
npm run dev                # servidor de desenvolvimento (proxy /health -> backend em localhost:8080)
npm test                   # testes unitários/componente (Vitest + Testing Library + MSW)
npm run build               # type-check (tsc -b) + build de produção
```

Playwright (E2E) entra na primeira fatia que tiver um fluxo crítico de verdade para cobrir (ver [docs/testing-strategy.md](docs/testing-strategy.md) §4) — ainda não configurado.

O endereço do backend usado pelo proxy de dev é configurável via `VITE_BACKEND_URL` (padrão `http://localhost:8080`) — útil se a porta 8080 já estiver em uso por outro projeto na máquina.

## Subir tudo em container (pra testar sem instalar nada)

Além do fluxo de dev acima (backend/frontend rodando direto na máquina), `docker-compose.yml` também sobe o backend e o frontend como containers — útil pra só testar a aplicação, sem precisar de JDK/Node instalados:

```bash
docker compose up -d --build
```

Isso builda as imagens (`backend/Dockerfile`, `frontend/Dockerfile`) e sobe cinco serviços: `postgres`, `mailpit`, `backend`, `frontend` (Nginx servindo o build de produção, com proxy reverso pras mesmas rotas de API que o Vite usa em dev - ver `frontend/nginx.conf`) e `seed` (roda uma vez, cria o primeiro usuário ADMIN depois que o backend migra o schema - sem isso `POST /usuarios` fica inacessível, porque exige um ADMIN que ainda não existe). O `seed` é idempotente: subir de novo sem apagar o volume não duplica nada.

Acesse `http://localhost:5173`. Login: e-mail `admin@escritor.io`, código chega em `http://localhost:8025` (Mailpit; se remapeada via `.env`, ver Troubleshooting abaixo, use a porta configurada em `MAILPIT_UI_PORT`). Esse usuário já nasce como membro (líder) de uma equipe ("Equipe Geral", id 1) pra já dar pra criar um quadro de teste sem precisar cadastrar mais nada primeiro.

`docker compose down` derruba tudo; `docker compose down -v` também apaga o volume do Postgres (perde os dados, inclusive o seed - a próxima subida recria do zero).

## Integração com WhatsApp

Pedido do cliente: avisar o chefe por WhatsApp sempre que alguém bate entrada ou saída do
expediente (não pausa). A integração usa o [Evolution API](https://doc.evolution-api.com)
(gateway self-hosted de WhatsApp) e fica **desligada por padrão** - ela exige um número de
WhatsApp de verdade pareado via QR code antes de fazer sentido ligar.

### 1. Suba o Evolution API

Fica atrás do perfil `whatsapp` (não sobe com o `docker compose up -d` normal, de propósito - são
mais 4 containers que a maioria do trabalho do dia a dia não precisa):

```bash
docker compose --profile whatsapp up -d
```

Isso sobe `evolution-api` (a API em si) e `evolution-postgres`/`evolution-redis`
(armazenamento próprio do Evolution, separado do Postgres da aplicação).

### 2. Configure e ligue no backend

No `.env` da raiz (o mesmo já usado pra remapear portas - ver Troubleshooting):

```
EVOLUTION_API_KEY=escolha-uma-chave-qualquer
EVOLUTION_CHEFE_NUMERO=5511999999999
EVOLUTION_HABILITADO=true
```

- `EVOLUTION_API_KEY`: qualquer string - é só a senha entre o backend e o `evolution-api`, os dois
  containers usam o mesmo valor (ver `AUTHENTICATION_API_KEY` em `docker-compose.yml`).
- `EVOLUTION_CHEFE_NUMERO`: o WhatsApp que **recebe** os avisos - código do país + DDD + número,
  só dígitos (Brasil: `55` + DDD com 2 dígitos + número, geralmente 12-13 dígitos no total; ex.
  `5511999999999`). Deixe em branco pra manter a integração desligada mesmo com
  `EVOLUTION_HABILITADO=true` (nenhuma mensagem sai sem um número de destino).
- `EVOLUTION_HABILITADO=true`: sem isso, nem o backend tenta enviar nada, nem a tela do passo 3
  abaixo consegue gerar QR code - é o interruptor geral.

Reinicie o backend (`docker compose up -d backend` se estiver em container, ou reinicie o
`./mvnw spring-boot:run` se estiver rodando direto na máquina) pra pegar as novas variáveis.

### 3. Pareie um número de WhatsApp direto na plataforma

Como ADMIN, abra o painel **📱 WhatsApp** na barra de ferramentas do Escritório (só ADMIN vê o
botão). A tela (`IntegracaoWhatsAppPage`, chamando `GET /admin/whatsapp/estado`) mostra o QR code
na hora - o backend cria a instância no Evolution API automaticamente na primeira vez. Escaneie
com o WhatsApp do número que vai **enviar** os avisos (Aparelhos conectados → Conectar um
aparelho) - **não precisa ser o número do chefe**, só o "remetente" (o chefe só recebe mensagem,
não precisa parear nada). A tela atualiza sozinha (poll a cada poucos segundos) e mostra "✅
Conectado" assim que o celular escaneia - não precisa recarregar a página.

<details>
<summary>Alternativa via REST puro (sem abrir o navegador)</summary>

```bash
# Cria a instância e já devolve o QR code em base64 (troque "sua-chave-aqui" pela mesma de
# EVOLUTION_API_KEY no seu .env)
curl -X POST http://localhost:8085/instance/create \
  -H "apikey: sua-chave-aqui" -H "Content-Type: application/json" \
  -d '{"instanceName":"escritorio","integration":"WHATSAPP-BAILEYS","qrcode":true}'
```

A resposta traz `qrcode.base64` (`data:image/png;base64,...`) - copie a parte depois da vírgula,
decodifique e abra como imagem (Unix: `echo "<base64>" | base64 -d > qrcode.png`; PowerShell:
`[IO.File]::WriteAllBytes("qrcode.png", [Convert]::FromBase64String("<base64>"))`). Se o QR
expirar antes de escanear, gere outro com `GET /instance/connect/escritorio` (mesma API key - essa
chamada devolve o QR direto na raiz da resposta, não aninhado em `qrcode` como a de criar).
Confirme que conectou com `GET /instance/connectionState/escritorio` (`state":"open"` = conectado).

</details>

A partir daí, toda vez que alguém bater entrada ou saída (`PontoService.marcar`), o chefe recebe
uma mensagem de texto no número configurado - envio assíncrono e best-effort (ver
`NotificacaoPontoWhatsApp`): se o Evolution API estiver fora do ar, o registro de ponto continua
sendo salvo normalmente, só o aviso que não sai (fica logado como aviso no backend).

## Integração com Google Agenda

Pedido do usuário: "algo muito parecido com o agenda do google. Poderia fazer isso?? Ou ate mesmo
integrar?" - cada funcionário conecta a própria conta Google (OAuth2) e a escala dele (ver painel
"🗓️ Minha escala") passa a ser publicada como eventos no Google Agenda dele mesmo (via de mão
única - não lemos o Google Agenda de volta). Fica **indisponível por padrão** (o widget "Conectar
Google Agenda" nem aparece) até você configurar um Client ID/Secret de verdade.

### 1. Crie as credenciais no Google Cloud Console

1. Crie ou selecione um projeto em [console.cloud.google.com](https://console.cloud.google.com).
2. **APIs & Services → Library** → habilite **Google Calendar API**.
3. **APIs & Services → OAuth consent screen**: tipo "External", preencha nome do app e e-mail de
   suporte, adicione o escopo `.../auth/calendar.events`. Deixe o app em modo **"Testing"** (evita
   precisar de verificação do Google) e adicione como **"Test users"** o e-mail de cada
   colaborador que for testar a conexão (limite de 100 test users - refresh token funciona
   normalmente pra eles).
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**, tipo "Web
   application". Em **Authorized redirect URIs**, adicione exatamente:
   ```
   http://127.0.0.1:5175/integracoes/google/callback
   ```
   (mesma porta do frontend documentada no Troubleshooting - se você remapeou `FRONTEND_PORT`,
   ajuste aqui também).

### 2. Configure e ligue no backend

No `.env` da raiz:

```
GOOGLE_OAUTH_CLIENT_ID=seu-client-id.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=seu-client-secret
GOOGLE_OAUTH_REDIRECT_URI=http://127.0.0.1:5175/integracoes/google/callback
GOOGLE_TOKEN_CHAVE_CRIPTO=<32 bytes em base64, gere com: openssl rand -base64 32>
```

- `GOOGLE_OAUTH_CLIENT_ID`/`GOOGLE_OAUTH_CLIENT_SECRET`: os dois valores do passo 1.4. Sem eles
  (ou em branco), a integração fica desligada - `GET /integracoes/google/estado` devolve
  `habilitado: false` e o widget não aparece pra ninguém, sem quebrar o resto do sistema.
- `GOOGLE_OAUTH_REDIRECT_URI`: precisa bater **exatamente** com a URI cadastrada no passo 1.4.
- `GOOGLE_TOKEN_CHAVE_CRIPTO`: chave AES-256 usada só pra criptografar o refresh token de cada
  usuário em repouso (`ContaGoogleCalendar`/`CriptografiaTokenConverter`) - diferente do refresh
  token da própria sessão (`TokenRenovacao`, só hash), esse precisa voltar em texto claro pra ser
  reenviado à Google, então **nunca reuse a mesma chave de outro segredo** e nunca versione o
  valor real. Trocar essa chave depois de já existir gente conectada invalida os tokens salvos
  (seria preciso reconectar).

Reinicie o backend pra pegar as novas variáveis.

### 3. Conecte uma conta

Qualquer papel (o widget é por usuário, não é ADMIN-only) - abra **🗓️ Minha escala** no Escritório
e clique **Conectar Google Agenda** no topo do painel. Uma tela de consentimento real da Google
abre; depois de autorizar, você volta pro Escritório com um aviso de sucesso e o próprio painel já
aberto. A partir daí, toda vez que a escala (padrão semanal ou uma exceção) muda, ela é publicada
de novo automaticamente (assíncrono - não trava a tela), e um job diário de madrugada mantém a
janela de 60 dias sempre à frente mesmo sem mexer em nada.

## Ciclo de desenvolvimento (TDD)

Ver [docs/testing-strategy.md](docs/testing-strategy.md) para o workflow completo. Resumo: teste de domínio no backend primeiro, depois web/repositório, depois componente no frontend, E2E só para os fluxos críticos listados lá.

## Troubleshooting

- **Porta 5432/8080/5173/1025/8025 já em uso:** as portas do host em `docker-compose.yml` (`postgres`, `backend`, `frontend`, `mailpit`) são configuráveis via `POSTGRES_PORT`/`BACKEND_PORT`/`FRONTEND_PORT`/`MAILPIT_SMTP_PORT`/`MAILPIT_UI_PORT` (padrão 5432/8080/5173/1025/8025). Se houver outro projeto local usando as mesmas portas, crie um `.env` na raiz (já no `.gitignore` — nunca commitar) remapeando só as portas do host:

  ```
  POSTGRES_PORT=5433
  BACKEND_PORT=8082
  FRONTEND_PORT=5175
  MAILPIT_SMTP_PORT=1026
  MAILPIT_UI_PORT=8026
  ```

  A porta do perfil `whatsapp` (`EVOLUTION_API_PORT`, padrão 8085) segue o mesmo mecanismo, mas só
  importa se você subir esse perfil (ver "Integração com WhatsApp" acima).

  O `docker compose up` já lê o `.env` automaticamente. **Não use `docker-compose.override.yml` pra isso** — listas como `ports:` se *concatenam* entre `docker-compose.yml` e o override em vez de substituir, então a porta padrão (5432) continua sendo reivindicada junto com a nova, e o conflito persiste. Rodando backend/frontend direto na máquina (fora de container), aponte `spring.datasource.url` / `VITE_BACKEND_URL` pra essas mesmas portas. As portas padrão do projeto (5432, 8080, 5173, 1025, 8025) continuam sendo as documentadas — o `.env` é só local, pra rodar em paralelo com outro projeto que já as ocupa. Só o `SPRING_MAIL_PORT` do container `backend` (`docker-compose.yml`) fica fixo em `1025` mesmo com `MAILPIT_SMTP_PORT` remapeado - é tráfego container-a-container dentro da rede do compose, não passa pela porta remapeada do host.
