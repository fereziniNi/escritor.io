# Plano incremental — Fases 1 a 3 (E0 + E1 + E2 + E3)

Backlog ordenado de fatias verticais. Cada fatia é pequena o suficiente para caber num ciclo TDD completo (backend domínio → backend web/repo → frontend) e entrega algo demonstrável. Não pular fatias — cada uma assume que as anteriores estão testadas e verdes.

Fases 1 e 2 (E0 + E1 + E2) estão completas e em uso. Fase 3 (E3 Apontamento de horas) está esboçada abaixo (S4), seguindo o mesmo formato — ainda não implementada. E4 (Relatórios) e E5 (Escritório virtual) continuam para depois, conforme o roadmap do PRD (§5) — planejar tudo agora seria especular sobre o que a fase anterior vai ensinar.

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
| S2.11 ✅ | `SolicitacaoAjustePonto` — criar solicitação (com ou sem `registro_alvo_id`) | Domínio: justificativa obrigatória; web: colaborador só solicita para si mesmo |
| S2.12 ✅ | Aprovação/rejeição pelo gestor — gera **novo** `RegistroPonto` apontando pro original, nunca edita | Domínio: aprovar uma solicitação nunca chama `UPDATE`/`DELETE`, sempre `INSERT` com `substitui_id` |
| S2.13 ✅ | Frontend: fila de solicitações pendentes (gestor) + formulário de solicitação (colaborador) | Componente: rollback/erro ao rejeitar sem parecer |
| S2.14 ✅ | Espelho do mês (listagem, sem PDF ainda) | Serviço: soma bate com a soma diária calculada em S2.7 |

## S3 — E2 Kanban (núcleo do MVP)

Regra de visibilidade (PRD §2): um usuário vê quadros das equipes das quais é membro, mais quadros dos projetos aos quais essas equipes estão vinculadas. Um `Quadro` sempre tem `projeto_id` e/ou `equipe_id` preenchido — os dois nulos ao mesmo tempo é combinação inválida, bloqueada por constraint (PRD §3.3).

| # | Fatia | Teste que vem primeiro |
|---|---|---|
| S3.1 ✅ | Entidade `Quadro` + migração com `CHECK` bloqueando `projeto_id`/`equipe_id` ambos nulos | Repositório: quadro sem projeto nem equipe é rejeitado pelo banco; domínio: as três combinações válidas persistem |
| S3.2 ✅ | `GET /quadros` — regra de visibilidade (membro da equipe do quadro, ou de equipe vinculada ao projeto do quadro) | Serviço: colaborador não vê quadro de equipe da qual não é membro, mesmo sabendo o id |
| S3.3 ✅ | `POST /quadros` (só `GESTOR`/`ADMIN`) | Web: 403 pra `COLABORADOR`; domínio: nome obrigatório |
| S3.4 ✅ | Frontend: lista de quadros visíveis ao usuário logado | Componente: mostra só os quadros retornados pela API, nenhum hardcoded |
| S3.5 ✅ | Entidade `Coluna` (`quadro_id`, nome, ordem, `limite_wip` opcional) + `POST /quadros/{id}/colunas` | Domínio: duas colunas do mesmo quadro não podem ter a mesma ordem |
| S3.6 ✅ | Entidade `Card` com posição fracionária + `POST /colunas/{id}/cards` (título, descrição, responsável, prazo, estimativa) | Domínio: nova posição sempre fica estritamente entre os vizinhos (ou nas pontas, se a coluna estiver vazia) |
| S3.7 ✅ | Frontend: quadro com colunas e cards em modo leitura + criar card | Componente: card criado aparece na coluna certa sem reload manual |
| S3.8 ✅ | `PATCH /cards/{id}/mover` (nova coluna + nova posição), sem WebSocket ainda | Domínio: mover um card nunca renumera os outros da coluna, só recalcula a posição do card movido |
| S3.9 ✅ | Frontend: drag-and-drop (`dnd-kit`) com atualização otimista | Componente: card muda de coluna na UI antes da resposta da API chegar |
| S3.10 ✅ | Rollback do drag-and-drop quando a API de mover falha | Componente: card volta pra coluna original se `PATCH /cards/{id}/mover` retornar erro |
| S3.11 ✅ | `/ws/quadro/{id}` — broadcast da movimentação de card | Integração: um segundo cliente conectado ao mesmo quadro recebe o evento e atualiza sem reload |
| S3.12 ✅ | Limite de WIP: mover card pra coluna no limite é rejeitado | Domínio/Web: 409 ao mover pra coluna que já está no `limite_wip`; coluna sem limite (`null`) nunca bloqueia |
| S3.13 ✅ | `Etiqueta` (por quadro) + `CardEtiqueta` (N:N) — criar, aplicar, remover | Domínio: etiqueta de outro quadro não pode ser aplicada a um card deste quadro |
| S3.14 ✅ | Frontend: etiquetas no card (criar, aplicar, remover, exibir no card do quadro) | Componente: etiqueta aplicada aparece no card sem reload |
| S3.15 ✅ | `CardComentario` — criar/listar | Web: 403 pra quem não tem acesso ao quadro do card (mesma regra de visibilidade de S3.2) |
| S3.16 ✅ | Frontend: comentários no card (detalhe do card) | Componente: comentário novo aparece na lista sem reload |
| S3.17 ✅ | `CardEvento` — histórico automático (criação, mudança de coluna, mudança de responsável) | Domínio: mover um card gera o evento sozinho, dentro do mesmo serviço que move — nunca é escrito manualmente por outra camada |
| S3.18 ✅ | Frontend: histórico do card (aba/timeline no detalhe do card) | Componente: exibe os eventos em ordem cronológica com rótulo legível por tipo |

## S4 — E3 Apontamento de horas

PRD §3.4: `Apontamento id, usuario_id, card_id, inicio, fim (nullable = timer rodando), minutos (calculado ao encerrar), descricao, origem: TIMER | MANUAL, criado_em, editado_em`. Diferença fundamental em relação a `RegistroPonto` (S2): **apontamento é editável** — "é dado de gestão, não de jornada" (PRD). Nada de `REVOKE UPDATE/DELETE`, nada de encadeamento de hash, nada de "aprovar gera novo registro" — aqui `UPDATE`/`DELETE` de verdade são o caminho normal, com uma trava simples: só o autor mexe no próprio apontamento. A jornada continua sendo a fonte de verdade pro saldo de ponto (E1); apontamento é uma métrica paralela e informativa, nunca bloqueia nada do fluxo de ponto.

Regra central (PRD): no máximo um timer aberto por usuário — iniciar um novo em qualquer card encerra automaticamente o anterior (calculando os minutos dele antes de abrir o novo), o mesmo espírito de "SAIDA implícita" que já existe conceitualmente pra sequência de marcação (S2.3), mas aplicado a um recurso editável.

| # | Fatia | Teste que vem primeiro |
|---|---|---|
| S4.1 ✅ | Entidade `Apontamento` + migração — sem `REVOKE`/hash (diferente de `RegistroPonto`, é editável de propósito) | Domínio: `fim` antes de `inicio` é rejeitado; timer aberto (`fim` nulo) não tem `minutos` calculado ainda; encerrar calcula `minutos = fim − inicio` |
| S4.2 ✅ | `POST /cards/{id}/apontamentos/timer` — inicia timer pro usuário autenticado nesse card | Serviço: se já existe timer aberto do usuário (em qualquer card), ele é encerrado automaticamente antes de abrir o novo, com os minutos calculados corretamente |
| S4.3 ✅ | `PATCH /apontamentos/{id}/parar` — encerra o timer aberto, calcula `minutos` | Web: parar um apontamento que não é do usuário autenticado, que já está fechado, ou que não existe, é rejeitado (403/409/404) |
| S4.4 ✅ | Frontend: botão de timer no card (Iniciar/Parar) com cronômetro decorrido | Componente: iniciar troca pra "Parar" e mostra o tempo correndo; parar volta pra "Iniciar" |
| S4.5 ✅ | `POST /cards/{id}/apontamentos` (lançamento manual, `origem=MANUAL`) — aceita `inicio`+`fim` (minutos calculado) OU `minutos` direto + `descricao` | Domínio: passar `minutos` E `inicio`/`fim` ao mesmo tempo é rejeitado — ambíguo sobre qual é a fonte da verdade |
| S4.6 ✅ | `PATCH /apontamentos/{id}` e `DELETE /apontamentos/{id}` — só o autor edita/exclui o próprio | Web: 403 pra mexer no apontamento de outro usuário; editar `inicio`/`fim` recalcula `minutos` |
| S4.7 ✅ | Frontend: lista de apontamentos do card (editar/excluir inline) + formulário de lançamento manual | Componente: criar/editar/excluir aparece na lista sem reload manual |
| S4.8 ✅ | `GET /ponto/jornada-do-dia` ganha `totalApontadoMinutos` do dia (reaproveita `JornadaService`, E1) | Serviço: soma só os apontamentos fechados do dia; timer ainda aberto não entra na soma (aparece separado); é um cálculo paralelo ao saldo de ponto, nunca o altera |
| S4.9 | Frontend: `JornadaPainel` (S2.10) mostra "Total apontado hoje" ao lado da jornada, com a diferença sinalizada | Componente: diferença aparece só como informação (positiva ou negativa) — a ação de marcar `SAIDA` continua liberada independente do valor |
| S4.10 | `GET /apontamentos?usuarioId=&inicio=&fim=` — listagem simples por pessoa e período (gestor vê a própria equipe, colaborador só os próprios) | Serviço: colaborador que tenta ver apontamentos de outro usuário recebe 403; gestor só vê membros das equipes que lidera — base mínima pro relatório completo (E4), sem construir agregação por projeto ainda |

---

## Definição de pronto (para toda fatia)

- Testes da fatia verdes, incluindo os de camadas anteriores (nenhuma regressão).
- Sem `TODO`/código morto deixado pra depois "porque vai precisar".
- Se a fatia toca `RegistroPonto`, nenhum caminho de código faz `UPDATE`/`DELETE` nessa tabela — isso é verificado por teste, não por revisão manual.
- Se a fatia toca `Card.posicao` (S3), nenhum caminho de código renumera a coluna inteira pra mover um card — isso é verificado por teste, não por revisão manual.
- Se a fatia toca `Apontamento` (S4), `UPDATE`/`DELETE` são esperados e permitidos — não aplicar por engano a mesma trava de imutabilidade de `RegistroPonto` aqui.
