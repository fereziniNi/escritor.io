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

Fase atual: **S1 — E0 Fundação** (ver [docs/incremental-plan.md](docs/incremental-plan.md)). E0 está completo: autenticação passwordless de ponta a ponta e CRUD de equipes/projetos. Próximo: E1 Ponto (S2), o núcleo do MVP.

- ✅ S0.1 — backend (`/backend`): Spring Boot 4.1.x + Maven Wrapper, Flyway configurado, `GET /health`, validado por teste de integração com Testcontainers.
- ✅ S0.2 — frontend (`/frontend`): Vite + React + TS, TanStack Query, componente `HealthStatus` consumindo `/health` via proxy de dev, testado com Vitest + Testing Library + MSW. Verificado ponta a ponta num browser real contra o backend rodando de verdade.
- ✅ S1.1 — entidade `Usuario` (`identidade/domain`) + migração Flyway (`V1__create_usuario.sql`), com constraints de banco para papel/carga horária/email único. Testado com Testcontainers (roundtrip de persistência + rejeição de email duplicado).
- ✅ S1.2 — `POST /usuarios` (só ADMIN): Spring Security stateless + `@PreAuthorize`, validação Bean Validation (`carga_diaria_minutos` positiva). Sem senha — ver [ADR 0008](docs/adr/0008-login-passwordless-email.md). Testado com `@WebMvcTest` + `@WithMockUser` (401 sem autenticação, 403 papel errado, 400 payload inválido, 201 admin).
- ✅ S1.3 — login passwordless completo: `CodigoAcesso` (entidade+migração), `POST /auth/codigo` (envia código de 6 dígitos por e-mail via Mailpit, resposta idêntica exista ou não o e-mail), `POST /auth/login` (verifica código, emite JWT de acesso + refresh token em cookie httpOnly). `JwtAuthenticationFilter` liga tudo: testado ponta a ponta contra um servidor real (Testcontainers) — token de ADMIN autoriza, papel errado dá 403, sem token ou token adulterado dá 401.
- ✅ S1.4 — `POST /auth/refresh`: rotaciona o refresh token a cada uso (hash SHA-256, permite busca direta no banco — diferente do código de login, que usa BCrypt). Reuso de um token já rotacionado é detectado e revoga *todos* os refresh tokens ativos daquele usuário (sinal de possível roubo de token), não só o reaproveitado. Testado com Testcontainers (repositório) e `@WebMvcTest` (rotação, reuso, cookie ausente).
- ✅ S1.5 — frontend: `LoginPage` (e-mail → código, TanStack Query + Zustand para a sessão em memória), `ProtectedRoute` (redireciona sem sessão ou papel não permitido) e `SessionBootstrap` (silent refresh via `/auth/refresh` ao carregar a página, usando o cookie httpOnly). Verificado ponta a ponta com Playwright contra o backend real: e-mail não cadastrado → tela de login → código capturado de verdade no Mailpit → login → página inicial → **reload da página mantém a sessão** (prova que o cookie + silent refresh funcionam).
- ✅ S1.6 — entidades `Equipe`, `Projeto`, `MembroEquipe`, `ProjetoEquipe` (N:N), direto do modelo do PRD. Vínculos N:N protegidos por constraint `UNIQUE` no banco. Testado com Testcontainers.
- ✅ S1.7 — CRUD de equipe/projeto (só ADMIN) + telas `EquipesPage`/`ProjetosPage`. `adicionarMembro`/`vincularEquipe` são idempotentes (repetir a chamada não duplica linha). Novo `shared/api/http.ts`: cliente HTTP autenticado que anexa o access token e, em 401, tenta renovar via `/auth/refresh` e repete a chamada uma vez antes de desistir. Verificado ponta a ponta com Playwright + banco real: login admin → criar equipe → criar projeto → vincular equipe ao projeto, com o vínculo confirmado direto no Postgres.

**E0 (Fundação) completo.** Passou por uma revisão de código formal (8 agentes cobrindo correção, reuso, simplificação, eficiência e convenções) logo depois, que encontrou e já teve corrigidos:

- Race condition no refresh de token (chamadas 401 concorrentes derrubavam a sessão inteira) — `shared/api/http.ts` agora deduplica renovações concorrentes.
- Falha de e-mail quebrando a garantia de resposta idêntica exista ou não o e-mail — envio agora é best-effort.
- Falta de cooldown no reenvio de código (permitia griefing de login) — 30s de cooldown.
- `POST /auth/refresh` não conferia se o usuário seguia ativo.
- Canal de tempo em `POST /auth/login` revelando e-mails cadastrados — comparação fantasma para e-mail inexistente.
- Sem como voltar e corrigir o e-mail na tela de login.
- Triplicação de `decodeJwt`+`definirSessao` — unificada em `authStore.autenticarComTokens`.

**E1 — Ponto** (S2 no plano incremental), o núcleo do MVP:

- ✅ S2.1 — entidade `RegistroPonto` (`ponto/domain`) + migração (`V8__create_registro_ponto.sql`). O `REVOKE UPDATE, DELETE` do PRD §3.2 exigiu uma peça de infraestrutura nova: dois papéis de banco (`presenca` só migra, `presenca_app` é quem a aplicação usa em runtime) — dono de tabela ignora `REVOKE` contra si mesmo no Postgres, então sem essa separação a revogação não valeria nada. Ver [ADR 0009](docs/adr/0009-papel-de-banco-separado-para-runtime.md). Provado com um teste de JDBC puro autenticado como `presenca_app` (não dá pra usar `@ServiceConnection`/JPA aqui — essa infra sempre conecta como o dono) e verificado de novo contra um docker-compose real: `UPDATE`/`DELETE` batem "permission denied", `INSERT` continua funcionando.
- ✅ S2.2 — encadeamento de hash SHA-256 (`hash`/`hash_anterior`, `V9__add_hash_encadeado_registro_ponto.sql`). `HashEncadeado` reaproveita o `HashSha256` já usado no refresh token (mesmo requisito: hash rápido e determinístico). `RegistroPonto.hashValido()` detecta um campo alterado direto no banco; `VerificadorCadeiaPonto` detecta os dois jeitos de adulteração: um registro cujo hash não bate mais com seus campos, e um registro com `hash_anterior` fabricado de forma autoconsistente mas que não é o hash real do registro anterior na cadeia.
- ✅ S2.3 — `SequenciaMarcacao`: máquina de estados pura baseada só no tipo do último registro do usuário (não reseta à meia-noite — uma jornada pode atravessar o dia). Quem está em pausa só tem `PAUSA_FIM` como opção válida; `SAIDA` sem `ENTRADA` aberta é rejeitada. 19 casos cobertos via `@ParameterizedTest` com a tabela de transições completa.
- ✅ S2.4 — `POST /ponto/marcar` (`PontoController`/`PontoService`), juntando S2.1–S2.3 num endpoint real. `MarcarPontoRequest` de propósito não tem campo `momento`: é estruturalmente impossível o cliente influenciar o horário, que vem de `Instant.now(clock)` com um `Clock` injetado (permite controlar o tempo em teste). Sequência inválida vira 409 via `SequenciaInvalidaException` + handler em `TratamentoErroGlobal`. Nova peça: `ContextoUsuarioAutenticado`, resolvendo o `Usuario` autenticado a partir do `SecurityContextHolder` num único lugar — corrige o achado do code review anterior sobre parsing manual do principal espalhado pelos controllers.
- ✅ S2.5 — `GET /ponto/estado-atual` (`EstadoAtualPontoResponse`): reaproveita `SequenciaMarcacao.tiposValidosApos` (já testado em S2.3) para expor `ultimoTipo` + `proximasOpcoes`, sem duplicar a regra de transição no controller/serviço. Quem está em `PAUSA_INICIO` recebe só `PAUSA_FIM` como opção ("Retomar" no frontend, S2.6).
- ✅ S2.6 — `PontoWidget` (frontend): botão dinâmico renderizado a partir de `proximasOpcoes` de `GET /ponto/estado-atual`; clicar chama `POST /ponto/marcar` e invalida a query pra buscar o novo estado do servidor (nunca deriva o próximo estado no cliente). Verificado ponta a ponta num browser real (login → Entrada → Iniciar pausa → só "Retomar" some as demais opções → estado sobrevive a um reload). Essa verificação achou um bug real: `/ponto` não estava na allowlist do proxy de dev do Vite (`vite.config.ts`), então em dev a chamada silenciosamente recebia de volta o `index.html` da SPA em vez de JSON — corrigido junto nesta slice.
- ✅ S2.7 — `JornadaDiaria` (função pura em `ponto/domain`): `minutosTrabalhados`/`saldo` a partir de uma lista de `Marcacao` (par tipo+momento, desacoplado da entidade JPA de propósito — não precisa de usuário/hash/origem pra fazer essa conta). Só intervalos fechados contam: uma `ENTRADA` ou `PAUSA_INICIO` sem par ainda (jornada em andamento) simplesmente não soma nem subtrai nada — fechar o dia como `INCONSISTENTE` é responsabilidade da S2.8, não desta função. `Instant` cuida da travessia de meia-noite de graça, sem lógica extra.
