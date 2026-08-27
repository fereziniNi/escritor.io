# Plano incremental — Fase 1 (E0 + E1)

Backlog ordenado de fatias verticais. Cada fatia é pequena o suficiente para caber num ciclo TDD completo (backend domínio → backend web/repo → frontend) e entrega algo demonstrável. Não pular fatias — cada uma assume que as anteriores estão testadas e verdes.

Fases 2–4 (E2 Kanban, E3 Apontamento, E4 Relatórios, E5 Escritório virtual) serão detalhadas no mesmo formato quando a Fase 1 estiver em produção, conforme o roadmap do PRD (§5) — planejar tudo agora seria especular sobre o que a fase anterior vai ensinar.

---

## S0 — Esqueleto (pré-requisito, não é TDD de domínio)

| # | Fatia | Critério de pronto |
|---|---|---|
| S0.1 ✅ | Scaffold backend: Maven, Spring Boot, Flyway configurado, `docker-compose.yml` com Postgres, endpoint `GET /health` | Teste de integração (Testcontainers) confirma que o app sobe e migra o schema vazio |
| S0.2 ✅ | Scaffold frontend: Vite + TS, TanStack Query provider, chamada à `/health` | Teste de componente confirma renderização do status |

## S1 — E0 Fundação

| # | Fatia | Teste que vem primeiro |
|---|---|---|
| S1.1 ✅ | Entidade `Usuario` + migração Flyway | Repositório: roundtrip de persistência, `email` único rejeita duplicata |
| S1.2 ✅ | `POST /usuarios` (só ADMIN) — cadastro com carga diária, sem senha | Web: 403 para papel não-admin; domínio: `carga_diaria_minutos` deve ser positiva |
| S1.3a ✅ | Entidade `CodigoAcesso` + migração | Domínio: código de 6 dígitos, expira em 10 min, hash nunca é o código em texto puro |
| S1.3b ✅ | `POST /auth/codigo` (solicitar código) — envia e-mail via Mailpit | Serviço: resposta idêntica para e-mail existente ou não; e-mail anterior não expirado é invalidado por um novo pedido |
| S1.3c ✅ | `POST /auth/login` (verificar código) — JWT curto + refresh cookie | Domínio: código expirado/errado/já usado é rejeitado; 5ª tentativa errada mata o código |
| S1.4 ✅ | `POST /auth/refresh` + rotação de refresh token | Web: refresh token usado 2x é rejeitado na segunda vez |
| S1.5 ✅ | Frontend: tela de login (e-mail → código) + guarda de rota por papel | Componente: redireciona se token ausente/expirado |
| S1.6 ✅ | Entidades `Equipe`, `Projeto`, `MembroEquipe`, `ProjetoEquipe` (N:N) | Repositório: vínculo N:N duplicado rejeitado por constraint (`uk_membro_equipe_equipe_usuario`, `uk_projeto_equipe_projeto_equipe`) |
| S1.7 ✅ | CRUD de equipe/projeto/vínculos (ADMIN) + telas correspondentes | Web: só admin cria; domínio: vínculo duplicado é idempotente, não duplica linha |

## S2 — E1 Ponto (núcleo do MVP)

| # | Fatia | Teste que vem primeiro |
|---|---|---|
| S2.1 ✅ | Entidade `RegistroPonto` + migração com `REVOKE UPDATE, DELETE` para o usuário da aplicação | Repositório (Testcontainers): tentativa de `UPDATE` via SQL direto falha por permissão |
| S2.2 ✅ | Encadeamento de hash (`hash_anterior`/`hash`, SHA-256) | Domínio: alterar um campo do registro anterior quebra a verificação da cadeia |
| S2.3 ✅ | Máquina de estados de marcação (`ENTRADA → PAUSA_INICIO → PAUSA_FIM → SAIDA`) | Domínio: tabela de casos válidos/inválidos (ex.: `SAIDA` sem `ENTRADA` aberta é rejeitada) |
| S2.4 ✅ | `POST /ponto/marcar` — usa `momento` do servidor, nunca do cliente | Web: payload com `momento` do cliente é ignorado/rejeitado |
| S2.5 ✅ | `GET /ponto/estado-atual` — qual botão mostrar | Serviço: colaborador em pausa recebe apenas a opção "Retomar" |
| S2.6 ✅ | Frontend: botão dinâmico de marcação | Componente: renderiza a ação certa conforme `estado-atual` mockado |
| S2.7 ✅ | Cálculo de `JornadaDiaria` (minutos trabalhados, saldo) — função pura | Domínio: casos de borda (pausa sem fim, múltiplas pausas, jornada cruzando meia-noite) |
| S2.8 ✅ | Job/view que fecha o dia e marca `INCONSISTENTE` quando falta `SAIDA` até a virada | Domínio: dia sem saída após virada muda de `ABERTA` para `INCONSISTENTE` |
| S2.9 ✅ | `GET /ponto/jornada-do-dia` + saldo acumulado do período | Serviço: saldo acumulado ignora dias não úteis |
| S2.10 ✅ | Frontend: painel do colaborador (jornada do dia + saldo) | Componente: exibe saldo negativo/positivo corretamente |
| S2.11 | `SolicitacaoAjustePonto` — criar solicitação (com ou sem `registro_alvo_id`) | Domínio: justificativa obrigatória; web: colaborador só solicita para si mesmo |
| S2.12 | Aprovação/rejeição pelo gestor — gera **novo** `RegistroPonto` apontando pro original, nunca edita | Domínio: aprovar uma solicitação nunca chama `UPDATE`/`DELETE`, sempre `INSERT` com `substitui_id` |
| S2.13 | Frontend: fila de solicitações pendentes (gestor) + formulário de solicitação (colaborador) | Componente: rollback/erro ao rejeitar sem parecer |
| S2.14 | Espelho do mês (listagem, sem PDF ainda) | Serviço: soma bate com a soma diária calculada em S2.7 |

---

## Definição de pronto (para toda fatia)

- Testes da fatia verdes, incluindo os de camadas anteriores (nenhuma regressão).
- Sem `TODO`/código morto deixado pra depois "porque vai precisar".
- Se a fatia toca `RegistroPonto`, nenhum caminho de código faz `UPDATE`/`DELETE` nessa tabela — isso é verificado por teste, não por revisão manual.
