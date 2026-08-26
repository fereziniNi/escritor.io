# Arquitetura

Decisões técnicas e estrutura do projeto. Para o *porquê* de cada escolha com alternativas consideradas, ver [adr/](adr/). Este documento descreve o *o quê* e o *como*.

---

## 1. Visão geral

Monorepo com backend e frontend versionados juntos, para permitir que cada fatia incremental (TDD) toque os dois lados no mesmo commit/PR.

```
escritor.io/
├── backend/                # Spring Boot (Maven)
├── frontend/                # React + TypeScript (Vite)
├── docs/                    # este diretório
├── docker-compose.yml       # Postgres local para dev
├── DEVELOPMENT.md
└── README.md
```

Backend e frontend são publicados como aplicações separadas (processos distintos); o monorepo é só sobre versionamento e fluxo de trabalho, não sobre deployment acoplado.

---

## 2. Backend

**Java 21 (LTS) + Spring Boot 4.1.x + Maven.** O projeto usa o Maven Wrapper (`./mvnw`) — não é necessário ter Maven instalado globalmente.

### 2.1 Estrutura de pacotes

Pacote base: `io.escritor.presenca`. Organização por **domínio** (não por camada técnica no topo), porque os domínios do PRD (identidade, ponto, kanban, apontamento, mapa) têm pouco acoplamento entre si e evoluem em fases diferentes do roadmap:

```
io.escritor.presenca
├── identidade/          # Usuario, CodigoAcesso, Equipe, Projeto, MembroEquipe, ProjetoEquipe
│   ├── domain/          # entidades JPA, regras puras (geração/validação de código)
│   ├── web/             # controllers, DTOs
│   ├── service/         # inclui envio de e-mail de login (via seguranca.email)
│   └── repository/
├── ponto/               # RegistroPonto, SolicitacaoAjustePonto, JornadaDiaria
│   ├── domain/          # cálculo de jornada, máquina de estados de marcação, hash encadeado
│   ├── web/
│   ├── service/
│   └── repository/
├── kanban/              # Quadro, Coluna, Card, Etiqueta, Apontamento
│   ├── domain/
│   ├── web/
│   ├── service/
│   └── repository/
├── mapa/                # Mapa, Zona, EventoPresenca, estado em memória
│   ├── domain/
│   ├── ws/
│   └── service/
├── seguranca/           # JWT, filtros, config Spring Security
└── infra/               # config compartilhada (Flyway, WebSocket base, tratamento de erro)
```

Dentro de cada domínio, `domain/` contém as regras que devem ser testáveis **sem Spring context** (funções puras — cálculo de saldo, validação de sequência de marcação, encadeamento de hash). Isso é o que torna o TDD rápido: a maioria dos testes não sobe container nem contexto Spring.

### 2.2 Camadas e regra de dependência

`web` → `service` → `domain` + `repository`. Controllers não conhecem entidades JPA diretamente fora do necessário; DTOs de request/response ficam em `web`. `domain` não depende de `service`, `web` nem `repository` — é a camada mais testada e mais protegida de mudanças externas.

### 2.3 Persistência

- **Flyway** desde o primeiro commit (`backend/src/main/resources/db/migration`), migrações imutáveis (`V{n}__descricao.sql`).
- **Constraints de banco fazem parte do design, não só o Java**: a revogação de `UPDATE`/`DELETE` em `registro_ponto` é feita via `REVOKE` na migração, não apenas por convenção no código — ver PRD §3.2.
- Todos os timestamps em `timestamptz` (UTC); conversão para `America/Sao_Paulo` só na camada de apresentação (DTO/frontend), nunca no armazenamento nem no cálculo.

### 2.4 Autenticação e autorização

- **Login passwordless por e-mail:** não existe senha em nenhum lugar do sistema. `POST /auth/codigo` (email) gera um código numérico de 6 dígitos, guarda só o hash dele em `CodigoAcesso` (mesmo `PasswordEncoder`/BCrypt usado para senha em outros projetos, aqui reaproveitado para hashear o código) e envia por e-mail. `POST /auth/login` (email + código) valida o código e emite os tokens.
- Resposta de `POST /auth/codigo` é **sempre igual** independente de o e-mail existir ou não — evita que a própria API revele quais e-mails estão cadastrados.
- Código válido por 10 minutos, uso único, e **inválido após 5 tentativas erradas de verificação** (não é bloqueio de conta — é o código específico que morre; basta solicitar um novo). Solicitar um novo código antes do anterior expirar invalida o anterior.
- **Access token JWT de curta duração** (~15 min), enviado no header `Authorization: Bearer`, guardado em memória no frontend (não em `localStorage`, para reduzir superfície de XSS).
- **Refresh token** em cookie `httpOnly` + `Secure` + `SameSite=Strict`, usado só no endpoint `/auth/refresh`. Rotação do refresh token a cada uso.
- Autorização por papel (`COLABORADOR`/`GESTOR`/`ADMIN`) via `@PreAuthorize` e configuração de `SecurityFilterChain`, nunca checada só no frontend.
- **E-mail:** Spring Mail (SMTP) atrás de uma interface `EnvioEmail` no pacote `seguranca`, para trocar de provedor sem tocar no fluxo de login. Em dev/teste, o SMTP aponta para o **Mailpit** do `docker-compose.yml` (captura tudo localmente, UI em `http://localhost:8025`, nada sai de verdade).

### 2.5 WebSocket

Um handler nativo do Spring WebSocket por domínio (sem STOMP — desnecessário na escala de 10 usuários):

- `/ws/quadro/{id}` — broadcast de movimentação de card para quem está com o quadro aberto.
- `/ws/presenca` — posição/status de avatares no mapa (estado vivo em memória no servidor, nunca no banco).

Handshake autentica via o mesmo JWT de curta duração (query param ou header conforme suporte do cliente WS). Reconexão no cliente com backoff exponencial (requisito do PRD para o mapa).

---

## 3. Frontend

**React + TypeScript + Vite** (SPA pura — sem SSR, não há requisito de SEO para um app interno).

### 3.1 Gerenciamento de estado

- **TanStack Query** para todo estado que vem do servidor (usuários, jornada, quadros, cards, apontamentos): cache, refetch, e principalmente **mutações otimistas com rollback automático em erro** — é exatamente o critério de aceite do drag-and-drop do kanban (PRD E2).
- **Zustand** para estado puramente de cliente que não é "dado de servidor": posição local do avatar antes de confirmar no servidor, filtros de UI, estado de drag em andamento.
- Nunca duplicar em Zustand o que já é responsabilidade do TanStack Query — se o dado vem de uma API, mora no Query.

### 3.2 Estrutura de pastas

Por feature, espelhando os domínios do backend:

```
frontend/src/
├── features/
│   ├── auth/
│   ├── ponto/
│   ├── kanban/
│   ├── apontamento/
│   └── mapa/
├── shared/
│   ├── api/          # cliente HTTP, interceptors de auth/refresh
│   ├── components/   # componentes puramente visuais reutilizáveis
│   └── ws/           # cliente WebSocket compartilhado
└── app/               # rotas, providers globais (QueryClient, guards de papel)
```

Cada `features/<x>/` contém seus próprios hooks de TanStack Query, componentes e testes — evita o acoplamento de uma pasta `hooks/` ou `components/` genérica crescendo sem limite.

### 3.3 Drag-and-drop e mapa

- Kanban: `dnd-kit`.
- Mapa 2D: canvas puro ou `react-konva` (decisão adiada para a Fase 4/E5 — não bloqueia nada até lá).

---

## 4. Ambientes

- **Dev local:** `docker-compose.yml` na raiz sobe só o Postgres (backend e frontend rodam direto na máquina via `mvn spring-boot:run` / `npm run dev`).
- **Testes de integração backend:** Testcontainers sobe seu próprio Postgres efêmero — independente do container de dev. Ver [testing-strategy.md](testing-strategy.md).
