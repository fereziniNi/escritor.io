# Sistema de Presença, Ponto e Tarefas

Ambiente único onde a equipe registra jornada (ponto), organiza o trabalho dos projetos (quadros de tarefas), agenda a própria escala e enxerga quem está disponível num escritório virtual 2D estilo Gather. Começou como o roadmap de 6 épicos do [PRD](docs/prd.md) (E0 a E5) e depois cresceu além dele — escala com integração ao Google Agenda, avisos no WhatsApp, chat, reuniões com Meet, happy hour, editor de avatar e notificações in-app.

- **Escala:** até ~10 usuários simultâneos
- **Stack:** React + TypeScript (Vite, SPA) / Spring Boot 4.1 + Maven (Java 21+) / PostgreSQL 16 + Flyway / Pixi.js no mapa
- **Metodologia:** TDD, fatia vertical por vez (backend domínio → web/repositório → frontend), verificação em navegador real antes de fechar

## Como rodar

Ver **[DEVELOPMENT.md](DEVELOPMENT.md)** — pré-requisitos, `docker compose up -d --build` pra subir tudo em container, fluxo de dev com backend/frontend na máquina, e o passo a passo das integrações opcionais (WhatsApp via Evolution API, Google Agenda via OAuth2).

Resumo: `docker compose up -d --build` sobe `postgres` + `mailpit` + `backend` + `frontend` (Nginx) + `seed` (cria o ADMIN `admin@escritor.io`). Acesse o frontend (porta 5173 por padrão), informe o e-mail e pegue o código de 6 dígitos no Mailpit (porta 8025). O perfil `whatsapp` (`docker compose --profile whatsapp up -d`) sobe mais 3 containers do Evolution API.

## Documentação

| Documento | Conteúdo | Atualidade |
|---|---|---|
| [docs/prd.md](docs/prd.md) | Visão de produto original, modelo de dados, épicos E0–E6 | Visão inicial — parte já mudou (ver "Divergências" abaixo) |
| [docs/incremental-plan.md](docs/incremental-plan.md) | Backlog das fatias S0–S6.12 (roadmap do PRD) | Histórico — o roadmap foi concluído, o produto seguiu além |
| [docs/architecture.md](docs/architecture.md) | Camadas, regra de dependência, estratégia de persistência/auth | Conceitos válidos; alguns nomes de pacote/porta desatualizados |
| [docs/testing-strategy.md](docs/testing-strategy.md) | Pirâmide de testes, workflow TDD, ferramentas por camada | Válido |
| [docs/adr/](docs/adr/) | Decisões técnicas registradas (ADR 0001–0010) | Válido (cobre até o E1) |

## O que o sistema faz hoje

### Login e organização
Login **passwordless**: e-mail + código de 6 dígitos enviado por e-mail (válido 10 min, uso único, morre após 5 tentativas erradas). Access token JWT curto em memória + refresh token em cookie `httpOnly` com rotação. Papéis `COLABORADOR` / `GESTOR` / `ADMIN` via Spring Security. O ADMIN gerencia colaboradores e a carga diária de cada um pela tela de organização. Toda referência a pessoa no sistema é **por nome** (autocomplete), não por id.

> **Sem o conceito de "Equipe".** O PRD previa equipes N:N com projetos; isso foi removido (migração `V26`). Hoje a atribuição é individual: cada projeto tem seus membros, e a visibilidade sai daí.

### Ponto
Registro de jornada **append-only e auditável**: `ENTRADA` / `PAUSA_INICIO` / `PAUSA_FIM` / `SAIDA`, com `momento` sempre do servidor e hash SHA-256 encadeado ao registro anterior. O banco **revoga `UPDATE`/`DELETE`** na tabela (dois papéis Postgres: `presenca` migra, `presenca_app` roda — ver [ADR 0009](docs/adr/0009-papel-de-banco-separado-para-runtime.md)). O card de ponto no HUD do escritório marca entrada/pausa/saída e mostra um cronômetro digital. A "Jornada de hoje" mostra minutos trabalhados, saldo do dia, saldo acumulado do mês e o tempo somado por tarefa. Dia sem `SAIDA` até a virada vira `INCONSISTENTE`.

> **Sem "solicitação de ajuste de ponto".** O fluxo de solicitar/aprovar correção (PRD E1) foi removido (migração `V25`).

### Projetos e tarefas
Quadro kanban **por projeto** (Quadro foi fundido em Projeto, migração `V27`): colunas/seções com limite de WIP opcional, cards com título, descrição markdown, responsável, prazo e estimativa. Drag-and-drop (`dnd-kit`) com atualização otimista + rollback, posição fracionária (mover é um `UPDATE` só), broadcast em tempo real via `/ws/projeto/{id}`, comentários e histórico automático de eventos por card. Colaborador pode criar projeto e adicionar seções.

> **Sem etiquetas.** Removidas na migração `V28` — card ganhou responsável + tempo estimado no lugar.

### Apontamento de horas
Cronômetro por tarefa (iniciar/parar, no máximo um aberto por usuário) e lançamento manual de tempo. Apontamento é **editável de propósito** (dado de gestão, não de jornada — sem hash, sem `REVOKE`). A "Jornada de hoje" compara total apontado × trabalhado só como informação, nunca bloqueia a marcação de ponto.

### Relatórios
Painel do gestor: saldo de horas por pessoa/período, horas apontadas agregadas por projeto e por card, dias inconsistentes no período, e exportação do espelho do mês em CSV. Visibilidade por papel (`VisibilidadeUsuarioService`): colaborador vê os próprios dados, gestor vê quem está atribuído aos mesmos projetos que ele, admin vê todos. Há também um **resumo diário automático no WhatsApp** com horário configurável pelo admin.

### Escritório virtual
Mapa 2D top-down em tiles, renderizado em **Pixi.js**, servido de `GET /mapas/ativo` (mapa **36×27 tiles**, seedado por migração, sem editor visual). Movimento por **setas ou WASD** com predição local no cliente e envio com throttle (máx. a cada 100 ms); o servidor (`/ws/presenca`, estado vivo **só em memória**) é a autoridade sobre posição e valida os limites. Reconexão automática com backoff exponencial.

- **Zonas (salas):** `FOCO` "Área de trabalho", `REUNIAO` "Sala de reunião", `CAFE` "Café", `HAPPY_HOUR` "Happy Hour", `LIVRE` "Fora do trabalho" e 3 `CABINE` numa coluna à esquerda. Todas com **parede e uma porta** de verdade (colisão client-side; salas de cima abrem pro sul, as de baixo pro norte, cabines pro leste).
- **Status do avatar:** `Trabalhando` (FOCO) / `Reunião` / `Almoço` / `Ausente`, selecionável no dock. `Disponível` é o estado inicial (não selecionável); `Offline` é automático ao desconectar (o avatar fica "estacionado" em "Fora do trabalho"); `Ausente` também dispara sozinho após 5 min sem input.
- **Status automático por zona:** entrar em **qualquer** sala troca o status na hora; sair restaura o status de antes (a menos que tenha sido trocado manualmente lá dentro). Mapa zona → status (`STATUS_POR_ZONA` em `PresencaWebSocketHandler`):

  | Sala | Status |
  |---|---|
  | Área de trabalho (FOCO) | Trabalhando |
  | Sala de reunião (REUNIAO) | Reunião |
  | Café (CAFE) | Almoço |
  | Happy Hour (HAPPY_HOUR) | Almoço |
  | Fora do trabalho (LIVRE) | Ausente |
  | Cabine (CABINE) | Trabalhando |
  | Atendimento (ATENDIMENTO) | Disponível |

  Entrar numa cabine também **escurece só a área do mapa** (modo "isolado"). Ficar no corredor/espaço aberto não muda nada.
- **Lista de presença** ao lado do mapa (quem está em cada sala + status), em tempo real.
- **Voz por proximidade:** WebRTC peer-to-peer entre avatares próximos ou na mesma sala (`useVozProximidade`), com a sinalização relayada pelo `/ws/presenca`. Estava marcado "fora de escopo" no PRD; foi construído.
- **Editor de avatar:** pixel art modular estilo LPC — corpo (masculino/feminino), rosto, cabelo, roupa, acessórios — na tela de configurações pessoais.
- **Sugestão de ponto:** entrar no mapa sem ponto aberto mostra um aviso (nunca automação) sugerindo bater entrada.

### Escala de trabalho + Google Agenda
Painel "Minha escala": calendário no estilo Google Agenda (visões Mês/Semana/Dia), padrão semanal de horários e exceções por dia (tudo como modais sobre o calendário). Cada colaborador pode **conectar a própria conta Google** (OAuth2); a partir daí a escala dele é publicada como eventos no Google Agenda dele (via de mão única — o sistema não lê o Agenda de volta), com republicação automática a cada mudança e um job diário que mantém uma janela de 60 dias à frente. O refresh token de cada usuário é criptografado (AES-256) em repouso.

### Reuniões
Agendar reunião com múltiplos participantes e link do Google Meet; quem tem uma reunião marcada pode "entrar na sala do escritório" (o avatar é teleportado pra Sala de Reunião, status vira Reunião) além de abrir o Meet.

### Chat
Chat "Geral" em tempo real, sem atraso, dentro do escritório.

### Happy Hour
Sala de Happy Hour com mural e uma **roleta** que sorteia a atividade da vez — o resultado é um "momento" compartilhado (toast/alerta) pra todo mundo online.

### Notificações
Sino de notificações in-app: tarefa nova, tarefa concluída, sorteio de happy hour, convite de reunião. Persistidas (migração `V48`), com painel próprio.

### Integração WhatsApp
Opcional, via [Evolution API](https://doc.evolution-api.com) self-hosted (perfil `whatsapp` do compose). Pareamento por QR code direto na plataforma (tela do admin). Quando ligada: bater entrada ou saída avisa o número do chefe; e o resumo diário sai no horário configurado. Envio assíncrono e best-effort — se o gateway cair, o ponto é salvo do mesmo jeito.

## Arquitetura (resumo)

Monorepo (`backend/` + `frontend/`), publicados como processos separados. Organização por **domínio**, não por camada técnica no topo.

**Backend** — `io.escritor.presenca`, um pacote por domínio:
`identidade` · `ponto` · `kanban` (projetos/cards/apontamentos) · `escritorio` (mapa, zonas, `/ws/presenca`, eventos de presença) · `escala` · `googlecalendar` · `reuniao` · `chat` · `happyhour` · `notificacao` · `relatorio` · `seguranca` · `infra`. Dentro de cada um: `domain/` (regras puras, testáveis sem Spring) → `service/` → `web/` + `repository/` (+ `ws/` onde há WebSocket). Nenhuma `@Query` customizada — só métodos derivados do Spring Data. Constraints de banco fazem parte do design (defesa em profundidade): a regra vale no construtor da entidade **e** numa `CHECK`/`UNIQUE` da migração.

**Frontend** — `features/<x>/` espelhando os domínios, cada um com seus hooks de TanStack Query, componentes e testes. TanStack Query pra estado de servidor (com mutações otimistas + rollback), Zustand pra estado só-de-cliente. Depois de logado é **uma tela só** (`/`): o escritório é a home, e ponto/projetos/relatórios/escala/reuniões/etc. abrem como painéis flutuantes do dock, não como rotas.

**WebSocket** — Spring WebSocket nativo, um handler por domínio (`/ws/presenca`, `/ws/projeto/{id}`), sem STOMP. Handshake autenticado por JWT em query param (o WebSocket do browser não deixa mandar header).

**Persistência** — Flyway desde o primeiro commit, migrações imutáveis, hoje em **V51**. Tudo em `timestamptz` (UTC), conversão pra `America/Sao_Paulo` só na apresentação.

## Estado dos testes

- **Backend:** `./mvnw test` (Surefire, unitário — sem Docker) verde. `./mvnw verify` roda também os de integração (Failsafe + Testcontainers, Postgres real). `PresencaWebSocketIT` é conhecido como flaky por timing de `close()` assíncrono e não roda no `mvnw test`.
- **Frontend:** `npm test` — 443 testes verdes (68 arquivos). A precisão de movimento/render do mapa (Pixi/canvas) não é testável em jsdom, então é verificada só em navegador real.

## Divergências em relação aos `docs/`

Os documentos em `docs/` descrevem a visão inicial (PRD) e o roadmap que foi executado até S6.12. O produto evoluiu além disso e alguns pontos **não batem mais**:

- **Equipe** foi removida do modelo (`V26`) — o PRD e o `architecture.md` ainda a descrevem como peça central.
- **Solicitação de ajuste de ponto** (PRD E1) foi removida (`V25`).
- **Quadro** virou parte de **Projeto** (`V27`); **etiquetas** foram removidas (`V28`).
- **Zonas:** o PRD lista 5 tipos (`FOCO/REUNIAO/CAFE/ATENDIMENTO/LIVRE`); hoje são 7 (+`HAPPY_HOUR`, +`CABINE`) e o mapa é 36×27, não 20×15. As salas têm parede/porta (o PRD dizia "chão aberto").
- **Status automático por zona:** o `incremental-plan.md` (S6.7) diz que só `FOCO`/`REUNIAO` mudam o status e que mapear `CAFE→ALMOCO` foi uma decisão de *não fazer*. Hoje **toda** zona mapeia pra um status (tabela acima).
- **Módulos inteiros** ausentes dos docs: escala + Google Agenda, reuniões/Meet, chat, happy hour, notificações, WhatsApp, editor de avatar, voz por proximidade.
- **`architecture.md`:** pacotes `kanban`/`mapa` estão na verdade como `kanban`/`escritorio`; o `docker-compose.yml` sobe a stack inteira, não "só o Postgres"; o mapa usa Pixi.js (decisão que estava "adiada").

O histórico detalhado, fatia por fatia, com o porquê de cada decisão, está no `git log` (os commits `feat(...)`/`fix(...)` são descritivos).
