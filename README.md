# Sistema de Presença, Ponto e Tarefas

Ambiente único onde a equipe registra jornada (ponto), organiza tarefas (kanban) e enxerga quem está disponível (escritório virtual 2D, estilo Gather). Ver visão de produto completa em [docs/prd.md](docs/prd.md).

- **Escala:** até 10 usuários simultâneos
- **Stack:** React + TypeScript (Vite) / Spring Boot + Maven / PostgreSQL
- **Metodologia:** TDD, desenvolvimento incremental full-stack (fatia vertical por vez, front e back juntos)

## Documentação

| Documento | Conteúdo |
|---|---|
| [docs/prd.md](docs/prd.md) | Visão de produto, modelo de dados, épicos, roadmap |
| [docs/architecture.md](docs/architecture.md) | Stack, estrutura de pastas, camadas, decisões de arquitetura |
| [docs/testing-strategy.md](docs/testing-strategy.md) | Pirâmide de testes, ferramentas por camada, workflow TDD |
| [docs/incremental-plan.md](docs/incremental-plan.md) | Backlog de fatias verticais da Fase 1 (E0+E1), em ordem de execução |
| [docs/adr/](docs/adr/) | Registro das decisões técnicas (ADRs) e o porquê de cada uma |
| [DEVELOPMENT.md](DEVELOPMENT.md) | Como rodar o projeto localmente |

## Status

Fase atual: **S0 — esqueleto** (ver [docs/incremental-plan.md](docs/incremental-plan.md)).

- ✅ S0.1 — backend (`/backend`): Spring Boot 4.1.x + Maven Wrapper, Flyway configurado, `GET /health`, validado por teste de integração com Testcontainers.
- ✅ S0.2 — frontend (`/frontend`): Vite + React + TS, TanStack Query, componente `HealthStatus` consumindo `/health` via proxy de dev, testado com Vitest + Testing Library + MSW. Verificado ponta a ponta num browser real contra o backend rodando de verdade.
- ✅ S1.1 — entidade `Usuario` (`identidade/domain`) + migração Flyway (`V1__create_usuario.sql`), com constraints de banco para papel/carga horária/email único. Testado com Testcontainers (roundtrip de persistência + rejeição de email duplicado).
- ✅ S1.2 — `POST /usuarios` (só ADMIN): Spring Security stateless + `@PreAuthorize`, validação Bean Validation (`carga_diaria_minutos` positiva). Sem senha — ver [ADR 0008](docs/adr/0008-login-passwordless-email.md). Testado com `@WebMvcTest` + `@WithMockUser` (401 sem autenticação, 403 papel errado, 400 payload inválido, 201 admin).
- ✅ S1.3 — login passwordless completo: `CodigoAcesso` (entidade+migração), `POST /auth/codigo` (envia código de 6 dígitos por e-mail via Mailpit, resposta idêntica exista ou não o e-mail), `POST /auth/login` (verifica código, emite JWT de acesso + refresh token em cookie httpOnly). `JwtAuthenticationFilter` liga tudo: testado ponta a ponta contra um servidor real (Testcontainers) — token de ADMIN autoriza, papel errado dá 403, sem token ou token adulterado dá 401.
- ⬜ S1.4 — próxima fatia: `POST /auth/refresh` com rotação de refresh token.
