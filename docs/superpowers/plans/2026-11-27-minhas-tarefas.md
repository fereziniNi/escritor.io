# Minhas tarefas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Painel "Minhas tarefas" no Escritório: lista única, agrupada por estado, com os cards do usuário de todos os projetos (e tarefas sem projeto), criar e mudar estado sem abrir o projeto.

**Architecture:** Novo `TarefaService` (kanban) lê/grava os mesmos `Card` via `CardService`; estado deriva da posição da coluna. Tarefa sem projeto vive num projeto pessoal escondido (um por usuário, coluna nova `projeto.pessoal_de_usuario_id`, migração V60) que nunca gera notificação e não aparece em listas. Frontend: novo painel no dock, abre o card pelo caminho que o cronômetro ativo já usa.

**Tech Stack:** Spring Boot 4 / JPA / Flyway / JUnit + Mockito + Testcontainers (backend); React + TanStack Query + Vitest + MSW (frontend).

**Spec:** `docs/superpowers/specs/2026-11-27-minhas-tarefas-design.md`

## Global Constraints

- Idioma de código, mensagens e comentários: português (como o resto do repo).
- Backend: `cd backend && ./mvnw -q test` deve ficar verde; testes de controller são `@WebMvcTest` + `@Import({SecurityConfig.class, JwtService.class})` com `@WithMockUser`, e `SecurityConfig` já resolve `UsuarioRepository` sob demanda (não adicionar beans que quebrem o slice).
- `spring.jpa.hibernate.ddl-auto: validate`: toda coluna mapeada precisa existir na migração.
- Migração nova = **V60** (produção está na 59; V1–V59 existem no repo). Só aditiva.
- Não alterar a tela de quadros nem remover nada existente.
- Status do projeto pessoal: `StatusProjeto.ATIVO`.
- Frontend: `cd frontend && npx tsc --noEmit -p . && npx vitest run` verde.
- Commits em português, sem `--no-verify`, terminando com `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Projeto sem nenhuma coluna ao criar tarefa: erro 400 claro, nunca 500 (Task 4).
2. Mudar estado de tarefa já finalizada (`concluidoEm`): 409, nada muda (Task 4).
3. Título só com espaços ou vazio: rejeitado com 400 (Task 5).
4. Duas criações simultâneas da primeira tarefa pessoal: o índice único impede 2 projetos pessoais; a segunda tentativa reaproveita o existente (Task 1 e 4).
5. Lista vazia (usuário sem tarefas): o painel mostra mensagem, não grupos em branco (Task 7).

---

## File Structure

- Create `backend/src/main/resources/db/migration/V60__projeto_pessoal.sql`
- Modify `identidade/domain/Projeto.java` (campo `pessoalDe`, `isPessoal()`, fábrica `pessoalDe(Usuario)`)
- Modify `identidade/repository/ProjetoRepository.java` (`findByPessoalDe`)
- Modify `identidade/service/ProjetoService.java` (`listarVisiveis` esconde pessoais)
- Modify `kanban/service/CardService.java` (sem avisos para projeto pessoal)
- Create `kanban/domain/EstadoTarefa.java` (enum + regra pura de mapeamento)
- Modify `kanban/repository/CardRepository.java` (cards do responsável, não arquivados)
- Create `kanban/service/TarefaService.java`, `kanban/web/TarefaController.java`, `TarefaResponse.java`, `CriarTarefaRequest.java`, `MudarEstadoTarefaRequest.java`, `kanban/domain/TarefaJaFinalizadaException.java`, `ProjetoSemColunasException.java`
- Modify `infra/TratamentoErroGlobal.java` (409 e 400 das duas exceções)
- Create `frontend/src/features/tarefas/{types.ts,api.ts,MinhasTarefasPainel.tsx,MinhasTarefasPainel.test.tsx,corDoProjeto.ts}`
- Modify `frontend/src/features/escritorio/{ui/BarraFerramentas.tsx,EscritorioPage.tsx}`

---

### Task 1: Projeto pessoal (migração, entidade, repositório)

**Files:**
- Create: `backend/src/main/resources/db/migration/V60__projeto_pessoal.sql`
- Modify: `backend/src/main/java/io/escritor/presenca/identidade/domain/Projeto.java`, `.../repository/ProjetoRepository.java`
- Test: `backend/src/test/java/io/escritor/presenca/identidade/repository/ProjetoRepositoryIT.java` (já existe; seguir o padrão dele)

**Interfaces:**
- Produces: `boolean Projeto.isPessoal()`; `static Projeto Projeto.pessoalDe(Usuario dono, LocalDate hoje)` (nome "Pessoal", cliente "Pessoal", `StatusProjeto.ATIVO`, inicio = hoje); `Optional<Projeto> ProjetoRepository.findByPessoalDe(Usuario dono)`.

- [ ] **Step 1: Escrever os testes que falham** em `ProjetoRepositoryIT`: `salvaProjetoPessoalEBuscaPeloDono` (salva `Projeto.pessoalDe(usuario, hoje)`, `findByPessoalDe(usuario)` devolve o mesmo e `isPessoal()` é true) e `segundoProjetoPessoalDoMesmoUsuarioViolaUnicidade` (salvar dois projetos pessoais do mesmo usuário lança `DataIntegrityViolationException` ao `saveAndFlush`).
- [ ] **Step 2: Rodar** `./mvnw -q -Dtest=ProjetoRepositoryIT test`; esperado: falha de compilação (`pessoalDe` não existe).
- [ ] **Step 3: Migração V60:** `ALTER TABLE projeto ADD COLUMN pessoal_de_usuario_id BIGINT REFERENCES usuario (id);` e `CREATE UNIQUE INDEX uk_projeto_pessoal_usuario ON projeto (pessoal_de_usuario_id) WHERE pessoal_de_usuario_id IS NOT NULL;`
- [ ] **Step 4: Entidade e repositório:** `@ManyToOne(fetch = LAZY) @JoinColumn(name = "pessoal_de_usuario_id") Usuario pessoalDe` em `Projeto`, com `isPessoal()` e a fábrica estática acima (construtor privado/pacote que seta o campo); `findByPessoalDe` no repositório.
- [ ] **Step 5: Rodar** o IT novamente; esperado: PASS.
- [ ] **Step 6: Commit** `feat(tarefas): projeto pessoal (V60)`.

---

### Task 2: Projeto pessoal fora das listas

**Files:**
- Modify: `identidade/service/ProjetoService.java` (`listarVisiveis`)
- Test: `backend/src/test/java/io/escritor/presenca/identidade/service/ProjetoServiceTest.java`

**Interfaces:**
- Consumes: `Projeto.isPessoal()` (Task 1).
- Produces: `listarVisiveis(Usuario)` nunca devolve projeto pessoal; `buscarDetalhe` e `usuarioPodeVer` continuam funcionando para o dono (necessário para abrir o card).

- [ ] **Step 1: Teste** `listarVisiveisEscondeProjetoPessoal` (usuário membro de um projeto normal e do seu pessoal → só o normal volta) e `dono_buscaDetalheDoProprioProjetoPessoal` (devolve o detalhe, sem exceção).
- [ ] **Step 2: Rodar** `./mvnw -q -Dtest=ProjetoServiceTest test`; esperado: o primeiro falha.
- [ ] **Step 3: Implementar** o filtro `!projeto.isPessoal()` em `listarVisiveis`.
- [ ] **Step 4: Rodar** e ver PASS; **Commit** `feat(tarefas): projeto pessoal fora de listarVisiveis`.

---

### Task 3: Tarefa pessoal não notifica ninguém

**Files:**
- Modify: `kanban/service/CardService.java` (`criar`, `mover`)
- Test: `backend/src/test/java/io/escritor/presenca/kanban/service/CardServiceTest.java`

**Interfaces:**
- Consumes: `Projeto.isPessoal()`.
- Produces: em projeto pessoal, `criar` e `mover` **não** chamam `presencaWebSocketHandler`, `notificacaoService`, `envioWhatsApp` (nem `avisarSeFinalizouATarefa`/`avisarAdminsPorWhatsapp`); o evento de histórico (`CardEvento`) e o broadcast do projeto (`projetoWebSocketHandler`) continuam.

- [ ] **Step 1: Testes** `criarEmProjetoPessoalNaoNotificaNinguem` e `moverEmProjetoPessoalNaoNotificaNinguem`, ambos com `verifyNoInteractions(presencaWebSocketHandler, notificacaoService, envioWhatsApp)` e verificando que o `CardEvento` foi salvo. Um teste espelho em projeto normal garante que os avisos continuam (`verify(notificacaoService, atLeastOnce())`).
- [ ] **Step 2: Rodar** `./mvnw -q -Dtest=CardServiceTest test`; esperado: os de projeto pessoal falham.
- [ ] **Step 3: Implementar** guardando os blocos de aviso por `!coluna.getProjeto().isPessoal()` (em `criar` e, em `mover`, nos dois avisos dentro do `if` de mudança de coluna).
- [ ] **Step 4: Rodar** a suíte do `CardServiceTest`; PASS. **Commit** `feat(tarefas): tarefa pessoal não notifica ninguém`.

---

### Task 4: Domínio e serviço de tarefas

**Files:**
- Create: `kanban/domain/EstadoTarefa.java`, `TarefaJaFinalizadaException.java`, `ProjetoSemColunasException.java`, `kanban/service/TarefaService.java`, `kanban/web/TarefaResponse.java`
- Modify: `kanban/repository/CardRepository.java`, `infra/TratamentoErroGlobal.java`
- Test: `kanban/domain/EstadoTarefaTest.java`, `kanban/service/TarefaServiceTest.java` (Mockito, mesmo estilo de `CardServiceTest`)

**Interfaces:**
- Produces:
  - `enum EstadoTarefa { A_FAZER, EM_ANDAMENTO, FEITO }`
  - `static EstadoTarefa EstadoTarefa.de(int posicaoDaColuna, int totalDeColunas, boolean concluido)` — `concluido` ⇒ FEITO; 1 coluna ⇒ A_FAZER; posição 0 ⇒ A_FAZER; última ⇒ FEITO; demais ⇒ EM_ANDAMENTO. (`posicaoDaColuna` é o índice 0-based na lista de colunas ordenada por `ordem`.)
  - `static int EstadoTarefa.indiceDaColuna(EstadoTarefa destino, int totalDeColunas)` — A_FAZER → 0; FEITO → `total-1` (com 1 coluna → 0); EM_ANDAMENTO → 1 (com 2 colunas ou menos → `IllegalArgumentException`, tratado como 400 no service).
  - `record TarefaResponse(Long cardId, String titulo, Long projetoId, String projetoNome /* null se pessoal */, boolean pessoal, EstadoTarefa estado, LocalDate prazo, Integer estimativaMinutos, Instant concluidoEm)`
  - `List<TarefaResponse> TarefaService.listarMinhas(Usuario)` — cards do usuário (responsável) não arquivados; ordem: por estado na ordem A_FAZER/EM_ANDAMENTO/FEITO **não é responsabilidade do service** (front agrupa); dentro de cada estado: prazo crescente (nulo por último), depois `criadoEm` crescente; para FEITO: `concluidoEm` decrescente (nulo por último), depois `cardId` decrescente, **limitado a 20**.
  - `TarefaResponse TarefaService.criar(Usuario, String titulo, Long projetoIdOuNull, LocalDate prazo, Integer estimativaMinutos)` — projeto nulo ⇒ obtém ou cria o projeto pessoal do usuário (Projeto + colunas "A fazer"(0), "Em andamento"(1), "Feito"(2), sem limite + `MembroProjeto`); em corrida, ao violar a unicidade, relê o existente. Cria via `CardService.criar(colunaIdDaPrimeiraColuna, titulo.strip(), null, usuario.getId(), prazo, estimativa, usuario)`. Projeto sem colunas ⇒ `ProjetoSemColunasException`.
  - `TarefaResponse TarefaService.mudarEstado(Long cardId, EstadoTarefa destino, Usuario)` — carrega o card, `concluidoEm != null` ⇒ `TarefaJaFinalizadaException`; calcula a coluna destino pela lista ordenada do projeto do card e chama `CardService.mover(cardId, colunaId, indice = final da coluna, usuario)`.
  - `CardRepository.findByResponsavelAndArquivadoFalse(Usuario)`.
  - `TratamentoErroGlobal`: `TarefaJaFinalizadaException` ⇒ 409; `ProjetoSemColunasException` ⇒ 400.

- [ ] **Step 1: Testes de `EstadoTarefa`:** tabela cobrindo 1, 2 e 5 colunas em cada posição, `concluido=true` em coluna do meio ⇒ FEITO, e `indiceDaColuna` para os três destinos (incluindo o erro de EM_ANDAMENTO com 2 colunas).
- [ ] **Step 2: Rodar** `./mvnw -q -Dtest=EstadoTarefaTest test`; falha (não existe). **Step 3: Implementar** o enum e as duas funções puras; rodar; PASS.
- [ ] **Step 4: Testes de `TarefaServiceTest`:** `listaSoCardsDoResponsavelNaoArquivados`; `ordenaPorPrazoNuloPorUltimo`; `feitoVemOrdenadoPorConclusaoELimitadoA20` (25 cards feitos ⇒ 20); `criarSemProjetoCriaProjetoPessoalComTresColunasUmaVez` (duas chamadas ⇒ um `save` de projeto) e reaproveita após `DataIntegrityViolationException`; `criarComProjetoUsaPrimeiraColuna`; `criarEmProjetoSemColunasLancaProjetoSemColunas`; `mudarEstadoMoveParaColunaCorreta`; `mudarEstadoDeTarefaFinalizadaLanca409`.
- [ ] **Step 5: Rodar** `./mvnw -q -Dtest=TarefaServiceTest test`; falha. **Step 6: Implementar** `TarefaService`, `TarefaResponse`, as exceções, a query do repositório e os dois handlers em `TratamentoErroGlobal`; rodar; PASS.
- [ ] **Step 7: Commit** `feat(tarefas): serviço de tarefas e mapeamento de estado`.

---

### Task 5: Endpoints REST

**Files:**
- Create: `kanban/web/TarefaController.java`, `CriarTarefaRequest.java`, `MudarEstadoTarefaRequest.java`
- Test: `backend/src/test/java/io/escritor/presenca/kanban/web/TarefaControllerTest.java` (`@WebMvcTest`, padrão de `CardControllerTest`)

**Interfaces:**
- Consumes: `TarefaService` (Task 4) e `ContextoUsuarioAutenticado.usuarioAtual()`.
- Produces: `GET /tarefas/minhas` ⇒ 200 `List<TarefaResponse>`; `POST /tarefas` body `CriarTarefaRequest(@NotBlank String titulo, Long projetoId, LocalDate prazo, @Positive Integer estimativaMinutos)` ⇒ 201; `PATCH /tarefas/{cardId}/estado` body `MudarEstadoTarefaRequest(@NotNull EstadoTarefa estado)` ⇒ 200. Qualquer autenticado.

- [ ] **Step 1: Testes:** `getMinhasDevolve200ComLista`; `postCriaEDevolve201`; `postComTituloEmBrancoDevolve400` (`"   "` e `""`); `postComEstimativaZeroDevolve400`; `patchDevolve200`; `semAutenticacaoDevolve401`.
- [ ] **Step 2: Rodar** `./mvnw -q -Dtest=TarefaControllerTest test`; falha. **Step 3: Implementar** controller e requests (delegando ao service; `titulo` vai como veio, o service faz `strip`). **Step 4: Rodar**; PASS.
- [ ] **Step 5: Rodar a suíte inteira** `./mvnw -q test`; verde. **Commit** `feat(tarefas): endpoints /tarefas`.

---

### Task 6: Frontend — tipos, API e cor do projeto

**Files:**
- Create: `frontend/src/features/tarefas/types.ts`, `api.ts`, `corDoProjeto.ts`
- Test: `frontend/src/features/tarefas/corDoProjeto.test.ts`

**Interfaces:**
- Produces: `type EstadoTarefa = 'A_FAZER' | 'EM_ANDAMENTO' | 'FEITO'`; `interface Tarefa { cardId: number; titulo: string; projetoId: number; projetoNome: string | null; pessoal: boolean; estado: EstadoTarefa; prazo: string | null; estimativaMinutos: number | null; concluidoEm: string | null }`; `listarMinhasTarefas(): Promise<Tarefa[]>`; `criarTarefa(dados: { titulo: string; projetoId: number | null; prazo: string | null; estimativaMinutos: number | null }): Promise<Tarefa>`; `mudarEstadoTarefa(cardId: number, estado: EstadoTarefa): Promise<Tarefa>` (usar `apiFetch` como `kanban/api.ts`; resposta não-ok lança `Error('Não foi possível mudar o estado')`, exceto 409, que lança `Error('Não foi possível mudar o estado (limite de tarefas em andamento ou tarefa já finalizada)')`); `corDoProjeto(projetoId: number): { fundo: string; texto: string }` determinística (mesmo id ⇒ mesma cor, paleta fixa de 6 pares com contraste legível).

- [ ] **Step 1: Teste** `corDoProjeto` (mesmo id sempre igual; ids diferentes podem repetir mas resultado é um dos 6 pares).
- [ ] **Step 2: Rodar** `npx vitest run src/features/tarefas/corDoProjeto.test.ts`; falha. **Step 3: Implementar** os três arquivos; rodar; PASS. **Commit** `feat(tarefas): api e tipos do frontend`.

---

### Task 7: Frontend — painel "Minhas tarefas"

**Files:**
- Create: `frontend/src/features/tarefas/MinhasTarefasPainel.tsx`, `MinhasTarefasPainel.test.tsx`

**Interfaces:**
- Consumes: Task 6; `listarProjetos` de `features/organizacao/api` (lista de projetos visíveis para o seletor).
- Produces: `MinhasTarefasPainel({ aoAbrirTarefa }: { aoAbrirTarefa: (projetoId: number, cardId: number) => void })`.

Comportamento (testes com MSW, como `ColaboradoresPage.test.tsx`):
- [ ] **Step 1: Testes que falham:** `agrupaPorEstadoComEtiquetaDoProjeto` (3 grupos; item de projeto mostra o nome; item `pessoal` não mostra etiqueta); `prazoVencidoOuHojeFicaEmVermelho` (classe `tarefa-prazo--urgente`); `feitoVemRecolhidoEAbreAoClicar`; `filtraPorProjetoEPorSemProjeto`; `listaVaziaMostraMensagem` ("Você não tem tarefas."); `criaTarefaSemProjetoPorPadrao` (POST com `projetoId: null`) e `criaTarefaComProjetoEscolhido`; `tituloEmBrancoNaoEnvia`; `trocarEstadoChamaPatchEAtualizaALista`; `erroAoTrocarEstadoMostraMensagem`; `clicarNoTituloChamaAoAbrirTarefa(projetoId, cardId)`.
- [ ] **Step 2: Rodar** `npx vitest run src/features/tarefas`; falha.
- [ ] **Step 3: Implementar** o painel: `useQuery(['tarefas'])` (refetch ao voltar o foco da janela, padrão do TanStack), três seções A fazer / Em andamento / Feito (Feito `<details>` recolhido), ordem como vem do backend, etiqueta com `corDoProjeto`, `<select>` de estado por item (`useMutation` + `invalidateQueries(['tarefas'])`), filtro (Todos / cada projeto / Sem projeto) e formulário "Nova tarefa" (título, projeto com "Sem projeto" padrão, prazo opcional). Reaproveitar as classes de `Kanban.css` onde existir equivalente; estilos novos num `MinhasTarefas.css` importado pelo componente.
- [ ] **Step 4: Rodar** os testes e `npx tsc --noEmit -p .`; PASS. **Commit** `feat(tarefas): painel Minhas tarefas`.

---

### Task 8: Ligar o painel ao dock

**Files:**
- Modify: `frontend/src/features/escritorio/ui/BarraFerramentas.tsx` (`PainelId` ganha `'tarefas'` e um botão "✅ Minhas tarefas", mesmo padrão do botão de `'skills'`), `EscritorioPage.tsx` (`TITULO_PAINEL.tarefas = '✅ Minhas tarefas'`; renderizar `<MinhasTarefasPainel aoAbrirTarefa={(projetoId, cardId) => { setSelecaoProjeto({ projetoId, cardId }); setPainelAberto('projetos') }} />`; painel `largo` também para `'tarefas'`)
- Test: `frontend/src/features/escritorio/EscritorioPage.test.tsx`

**Interfaces:**
- Consumes: `MinhasTarefasPainel` (Task 7); `setSelecaoProjeto`/`PainelProjetos` já existentes (abrem o projeto com o card expandido, inclusive para o projeto pessoal, de que o usuário é membro).

- [ ] **Step 1: Teste** `botaoMinhasTarefasAbreOPainel` e `clicarEmUmaTarefaAbreOProjetoComOCard` (mock de `GET /tarefas/minhas`; ao clicar, o painel de Projetos abre com o detalhe do projeto).
- [ ] **Step 2: Rodar** `npx vitest run src/features/escritorio`; falha. **Step 3: Implementar** as duas edições. **Step 4: Rodar** `npx tsc --noEmit -p . && npx vitest run`; tudo verde.
- [ ] **Step 5: Commit** `feat(tarefas): painel no dock do Escritório`.

---

### Task 9: Verificação de ponta a ponta antes do deploy

- [ ] **Step 1:** `cd backend && ./mvnw -q test` e `cd frontend && npx tsc --noEmit -p . && npx vitest run`; tudo verde.
- [ ] **Step 2:** Aplicar as 60 migrações num Postgres limpo (Docker) e conferir `\d projeto` com a coluna e o índice novos.
- [ ] **Step 3:** Conferir que `RelatoriosPage` e `ProjetosPage` obtêm projetos só por `GET /projetos` (logo não mostram o pessoal) e revisar que nenhum caminho de `CardService`/`SessaoTrabalhoService` notifica em projeto pessoal (`grep -n "notificacaoService\|envioWhatsApp\|presencaWebSocketHandler" kanban/service/*.java`).
- [ ] **Step 4:** Abrir PR para `master`. **Deploy só com confirmação do usuário** (a V60 roda no banco de produção): backend `railway up ./backend --path-as-root …` e frontend `railway up ./frontend --path-as-root …`, nesta ordem.
