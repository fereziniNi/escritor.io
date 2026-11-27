# Catálogo de Skills — Plataforma (escritor.io) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Painel "Skills" no escritor.io para listar, ver, copiar prompt, baixar, criar, editar, versionar e aprovar skills do Claude Code, com importação das skills oficiais do repositório.

**Architecture:** Módulo backend novo `io.escritor.presenca.skills` (domain/repository/service/web) sobre 4 tabelas (migração V54); versões imutáveis com arquivos; zip gerado em memória; importador no `ApplicationReadyEvent` lendo `classpath:skills-oficiais/`. Feature frontend `features/skills` aberta como painel do dock (`PainelId 'skills'`).

**Tech Stack:** Spring Boot 4.1 / Java 21 / JPA / Flyway / Testcontainers; React 19 + TS + TanStack Query + MSW/Vitest; novas libs front: `react-markdown`, `remark-gfm`, `diff`.

**Spec:** `docs/superpowers/specs/2026-11-05-catalogo-skills-design.md` (§5 é a fonte desta parte). O conteúdo das 14 skills é o plano irmão `2026-11-05-catalogo-skills-conteudo.md`.

## Global Constraints

- Migração nova: `V54__cria_catalogo_skills.sql`; papel de runtime `presenca_app` já recebe grants por default privileges (nada a fazer).
- Slug: `^[a-z0-9]+(-[a-z0-9]+)*$`, 3–64 chars, imutável.
- Toda versão tem `SKILL.md` na raiz com frontmatter YAML: `name` == slug, `description` não vazia.
- Caminho de arquivo: relativo, sem segmento `..`, não começa com `/` ou `\`, só `[A-Za-z0-9._/-]`, ≤ 200 chars, sem duplicados.
- Limites: ≤ 50 arquivos por versão, ≤ 256 KB (262144 bytes UTF-8) por arquivo, ≤ 2 MB (2097152 bytes) por versão.
- Categorias: `FUNDACAO`, `SEGURANCA`, `INTERFACE`, `IA`, `INFRA`, `DADOS`, `OUTRAS`.
- Estados de versão: `PUBLICADA`, `PROPOSTA`, `REJEITADA`.
- Aprovar/rejeitar/oficializar/arquivar: só `GESTOR`/`ADMIN` — checado com `@PreAuthorize` **e** no serviço. GESTOR/ADMIN pode aprovar a própria proposta.
- Uma proposta pendente por skill; nova edição do **mesmo autor** substitui (anterior → `REJEITADA`, motivo "Substituída pelo autor"); de outra pessoa → 409.
- Autor nulo = "Sistema" (importador). Não criar usuário técnico.
- Zip: pasta `<slug>/` com os arquivos + `<slug>/TUTORIAL.md`; `oficiais.zip` = todas oficiais não arquivadas, cada uma em sua pasta.
- Erros de validação/conflito do módulo devolvem corpo `{"mensagem": "..."}` (400/409) para o front exibir.
- Markdown renderizado sem HTML bruto.
- Comentários e mensagens em português, no estilo do projeto (Javadoc citando o pedido do usuário).

## Review Focus

1. Caminho malicioso (`../../etc/x`, `a/../../b`, `C:\x`) em salvar → 400; nunca chega ao zip (teste no validador e no gerador de zip).
2. Duas pessoas editando a mesma skill oficial → a segunda recebe 409 com mensagem dizendo quem tem a proposta pendente (teste no serviço).
3. Nomes/conteúdo com acento (`Instalação.md` é inválido pelo regex; conteúdo "ação" deve sair intacto no zip em UTF-8) (teste no gerador de zip).
4. Colar arquivo maior que 256 KB → 400 com `mensagem` exibida no editor, sem perder o que foi digitado (teste no editor).
5. Skill arquivada não entra em `oficiais.zip` nem na lista padrão, mas abre por slug (teste no serviço de consulta).

---

## File Structure

Backend `backend/src/main/java/io/escritor/presenca/skills/`:
- `domain/Skill.java`, `SkillVersao.java`, `SkillArquivo.java`, `SkillEvento.java` — entidades.
- `domain/CategoriaSkill.java`, `EstadoVersao.java`, `TipoEventoSkill.java` — enums.
- `domain/ArquivoSkill.java` — record `(String caminho, String conteudo)` (valor, usado na validação/zip/requests).
- `domain/ValidadorPacoteSkill.java` — regras de slug/arquivos/limites/frontmatter.
- `domain/SkillInvalidaException.java` (400), `ConflitoSkillException.java` (409), `AcaoSkillNaoPermitidaException.java` (403).
- `repository/SkillRepository.java`, `SkillVersaoRepository.java`, `SkillEventoRepository.java`.
- `service/SkillService.java` — comandos (criar, salvar, aprovar, rejeitar, restaurar, oficializar, arquivar).
- `service/SkillConsultaService.java` — leituras (listar, detalhe, versões, propostas).
- `service/GeradorZipSkill.java` — zip.
- `service/ImportadorSkillsOficiais.java` — carga do classpath.
- `web/SkillController.java` + records de request/response (seção Interfaces da Task 5).
- Modificar: `infra/TratamentoErroGlobal.java`, `notificacao/domain/TipoNotificacao.java`.

Frontend `frontend/src/features/skills/`:
- `types.ts`, `api.ts`, `SkillsPainel.tsx` (navegação interna), `ListaSkills.tsx`, `DetalheSkill.tsx`, `EditorSkill.tsx`, `AprovacoesSkills.tsx`, `Markdown.tsx`, `DiffArquivo.tsx`, `skills.css` + testes `*.test.tsx`.
- Modificar: `features/escritorio/ui/BarraFerramentas.tsx`, `features/escritorio/EscritorioPage.tsx`, `features/notificacoes/NotificacoesPainel.tsx` (ícones dos tipos novos).

---

### Task 1: Esquema, entidades e repositórios

**Files:**
- Create: `backend/src/main/resources/db/migration/V54__cria_catalogo_skills.sql`
- Create: entidades/enums em `skills/domain/`, repositórios em `skills/repository/`
- Test: `backend/src/test/java/io/escritor/presenca/skills/repository/SkillRepositoryIT.java`

**Interfaces:**
- Produces:
  - `Skill(String slug, Usuario criadaPor, Instant criadaEm)`; getters; `definirVigente(SkillVersao)`, `marcarOficial(boolean)`, `marcarArquivada(boolean)`, `registrarHashImportado(String)`; campos `oficial`, `arquivada`, `versaoVigente` (`@OneToOne` nullable, FK `versao_vigente_id`), `hashImportado`.
  - `SkillVersao(Skill skill, int numero, EstadoVersao estado, String nome, String descricao, CategoriaSkill categoria, String promptUso, String tutorialInstalacao, String mensagem, Usuario autor /*nullable*/, Instant criadaEm, List<ArquivoSkill> arquivos)`; `aprovar(Usuario por, Instant em)`, `rejeitar(Usuario por, Instant em, String motivo)`, `getArquivos(): List<SkillArquivo>` ordenado por caminho; `arquivosComoValor(): List<ArquivoSkill>`.
  - `SkillArquivo(SkillVersao versao, String caminho, String conteudo)` (`@OneToMany(cascade=ALL, orphanRemoval)` a partir da versão).
  - `SkillEvento(Skill skill, TipoEventoSkill tipo, Usuario usuario, Instant ocorridoEm, String detalhe)`; `TipoEventoSkill { OFICIALIZADA, OFICIAL_REMOVIDO, ARQUIVADA, DESARQUIVADA }`.
  - `SkillRepository`: `Optional<Skill> findBySlug(String)`, `boolean existsBySlug(String)`, `List<Skill> findAllByOrderBySlugAsc()`.
  - `SkillVersaoRepository`: `List<SkillVersao> findBySkillOrderByNumeroDesc(Skill)`, `Optional<SkillVersao> findBySkillAndNumero(Skill, int)`, `Optional<SkillVersao> findFirstBySkillAndEstado(Skill, EstadoVersao)`, `List<SkillVersao> findByEstadoOrderByCriadaEmAsc(EstadoVersao)`, `int proximoNumero(Skill)` (`@Query select coalesce(max(v.numero),0)+1`).
  - `SkillEventoRepository extends JpaRepository<SkillEvento, Long>`.

- [ ] **Step 1: Escrever a migração V54** com as tabelas `skill`, `skill_versao`, `skill_arquivo`, `skill_evento` (§5.3 do spec, colunas como no Produces acima; `skill_versao.autor_id` e `decidida_por_id` nullable; `UNIQUE(skill_id, numero)`, `UNIQUE(versao_id, caminho)`; `CHECK` de `estado` e `categoria`; FK `skill.versao_vigente_id` adicionada após criar `skill_versao`; índice `(estado, criada_em)` em `skill_versao`). Comentário de cabeçalho citando o pedido do usuário, como as migrações existentes.

- [ ] **Step 2: Escrever o IT que falha** (`SkillRepositoryIT`, mesmo setup do `ColunaRepositoryIT`):
  - `persisteSkillComVersaoEArquivosERecuperaPorSlug` — salva skill + versão 1 com 2 arquivos, define vigente; `findBySlug("login-codigo-email")` traz `versaoVigente.numero == 1` e arquivos `["SKILL.md","referencia/otp.ts"]` em ordem.
  - `slugDuplicadoViolaUnicidade` — `DataIntegrityViolationException`.
  - `proximoNumeroComecaEm1EIncrementa`.
  - `buscaPrimeiraPropostaPendente` — com versões PUBLICADA e PROPOSTA, `findFirstBySkillAndEstado(skill, PROPOSTA)` traz a proposta.

- [ ] **Step 3: Rodar e ver falhar** — `cd backend && ./mvnw verify -Dit.test=SkillRepositoryIT -Dtest=none -Dsurefire.failIfNoSpecifiedTests=false` → FAIL (classes inexistentes).

- [ ] **Step 4: Implementar entidades, enums e repositórios** conforme Interfaces.

- [ ] **Step 5: Rodar de novo** → PASS.

- [ ] **Step 6: Commit** — `feat(skills): esquema e entidades do catálogo de skills`

---

### Task 2: Validação do pacote

**Files:**
- Create: `skills/domain/ValidadorPacoteSkill.java`, `SkillInvalidaException.java`
- Test: `backend/src/test/java/io/escritor/presenca/skills/domain/ValidadorPacoteSkillTest.java`

**Interfaces:**
- Produces: `static void validarSlug(String slug)`; `static void validarArquivos(String slug, List<ArquivoSkill> arquivos)`; ambos lançam `SkillInvalidaException(String mensagem)` com `getMessage()` em português para o usuário. `static Map<String,String> lerFrontmatter(String skillMd)` (usa SnakeYAML, já no classpath do Spring Boot).

- [ ] **Step 1: Testes que falham** (cada um asserta `SkillInvalidaException` e um trecho da mensagem):
  - slugs válidos `"seguranca"`, `"login-codigo-email"`; inválidos `"ab"`, `"Login"`, `"login--x"`, `"-x"`, 65 chars.
  - sem `SKILL.md` → "SKILL.md"; frontmatter ausente; `name: outra` → "name"; `description` vazia → "description".
  - caminhos inválidos: `"../x.md"`, `"a/../../b"`, `"/abs.md"`, `"\\x.md"`, `"C:/x.md"`, `"Instalação.md"`, `"a b.md"`, 201 chars, duplicado.
  - 51 arquivos; arquivo com 262145 bytes; total 2097153 bytes.
  - pacote válido com `SKILL.md` + `referencia/otp.service.ts` passa.

- [ ] **Step 2: Rodar** — `./mvnw test -Dtest=ValidadorPacoteSkillTest` → FAIL.
- [ ] **Step 3: Implementar.** Regex de caminho `^[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)*$` + rejeitar segmento `..` ou `.`; tamanhos em bytes UTF-8. Frontmatter = bloco entre a primeira linha `---` e a próxima `---`.
- [ ] **Step 4: Rodar** → PASS.
- [ ] **Step 5: Commit** — `feat(skills): validação de slug, arquivos e frontmatter`

---

### Task 3: Comandos — criar, salvar, aprovar, rejeitar, restaurar, oficializar, arquivar

**Files:**
- Create: `skills/service/SkillService.java`, `skills/domain/ConflitoSkillException.java`, `AcaoSkillNaoPermitidaException.java`
- Modify: `notificacao/domain/TipoNotificacao.java` (+ `SKILL_PROPOSTA`, `SKILL_APROVADA`, `SKILL_REJEITADA`)
- Test: `backend/src/test/java/io/escritor/presenca/skills/service/SkillServiceTest.java` (Mockito + `Clock.fixed`, como `NotificacaoServiceTest`)

**Interfaces:**
- Consumes: Task 1 entidades/repos, Task 2 validador, `NotificacaoService.registrar(Usuario, TipoNotificacao, String, String)`, `UsuarioRepository.findByPapelAndAtivoTrueOrderByNomeAsc(Papel)`.
- Produces (`SkillService`):
  - record `DadosVersao(String nome, String descricao, CategoriaSkill categoria, String promptUso, String tutorialInstalacao, String mensagem, List<ArquivoSkill> arquivos)`.
  - `SkillVersao criar(String slug, DadosVersao dados, Usuario autor)`
  - `SkillVersao salvar(String slug, DadosVersao dados, Usuario autor)`
  - `SkillVersao restaurar(String slug, int numero, Usuario autor)` — copia a versão `numero` e chama a mesma regra de `salvar` com mensagem `"Restaurada da versão N"`.
  - `SkillVersao aprovar(String slug, int numero, Usuario aprovador)`
  - `SkillVersao rejeitar(String slug, int numero, Usuario aprovador, String motivo)`
  - `void definirOficial(String slug, boolean oficial, Usuario por)`
  - `void definirArquivada(String slug, boolean arquivada, Usuario por)`
  - `SkillVersao importar(String slug, DadosVersao dados, String hash)` — usado pela Task 6 (autor nulo).

- [ ] **Step 1: Testes que falham:**
  - `criarSkillNovaPublicaVersao1ComoVigenteENaoOficial`
  - `criarComSlugExistenteLancaConflito` (409)
  - `salvarEmSkillNaoOficialPublicaNaHora` — nova versão 2 `PUBLICADA` vira vigente.
  - `salvarEmSkillOficialCriaPropostaSemTrocarVigente` + notifica cada GESTOR/ADMIN ativo com `SKILL_PROPOSTA` e texto `"<autor> propôs mudança na skill \"<nome>\""`.
  - `segundaPropostaDeOutraPessoaLancaConflitoCitandoAutor` — mensagem contém o nome do autor da pendente.
  - `novaPropostaDoMesmoAutorSubstituiAAnterior` — anterior `REJEITADA` com motivo `"Substituída pelo autor"`.
  - `aprovarPropostaViraPublicadaEVigenteENotificaAutor` (`SKILL_APROVADA`).
  - `gestorPodeAprovarAPropriaProposta`.
  - `colaboradorNaoPodeAprovarRejeitarOficializarArquivar` → `AcaoSkillNaoPermitidaException`.
  - `rejeitarExigeMotivo` (vazio → `SkillInvalidaException`) e notifica autor (`SKILL_REJEITADA`).
  - `aprovarVersaoQueNaoEPropostaLancaConflito`.
  - `restaurarVersaoAntigaEmSkillOficialViraProposta`.
  - `definirOficialRegistraEvento` / `definirArquivadaRegistraEvento`.
  - `salvarValidaPacote` — arquivo com `../` → `SkillInvalidaException`.
  - `importarCriaOficialComAutorNuloEHash`; `importarComHashIgualNaoFazNada`; `importarComHashDiferenteCriaPropostaDeSistema` (mensagem `"Atualização do repositório"`; se já houver proposta pendente, substitui só se a pendente também for do Sistema, senão não faz nada).
- [ ] **Step 2: Rodar** — `./mvnw test -Dtest=SkillServiceTest` → FAIL.
- [ ] **Step 3: Implementar** `SkillService` (`@Transactional` nos comandos). Papel checado via `usuario.getPapel()` em `GESTOR`/`ADMIN`.
- [ ] **Step 4: Rodar** → PASS.
- [ ] **Step 5: Commit** — `feat(skills): fluxo de versões, propostas e aprovação`

---

### Task 4: Consultas e zip

**Files:**
- Create: `skills/service/SkillConsultaService.java`, `skills/service/GeradorZipSkill.java`
- Test: `.../skills/service/SkillConsultaServiceTest.java`, `.../skills/service/GeradorZipSkillTest.java`

**Interfaces:**
- Produces:
  - `SkillConsultaService.listar(String busca, CategoriaSkill categoria, Boolean soOficiais, boolean incluirArquivadas): List<Skill>` — busca case/acento-insensível em nome e descrição da vigente (filtrar em memória; escala pequena).
  - `Skill buscar(String slug)` (lança `RecursoNaoEncontradoException`, existente).
  - `List<SkillVersao> versoes(String slug)`; `SkillVersao versao(String slug, int numero)`; `Optional<SkillVersao> propostaPendente(Skill)`; `List<SkillVersao> propostasPendentes()`.
  - `GeradorZipSkill.gerar(String slug, SkillVersao versao): byte[]`; `gerarVarias(List<Skill> skills): byte[]` (usa vigente de cada).
- [ ] **Step 1: Testes que falham:**
  - `listarOmiteArquivadasPorPadrao`; `buscaIgnoraAcentoEMaiusculas` (`"seguranca"` acha "Segurança"); `filtraPorCategoriaESoOficiais`.
  - `zipTemPastaDoSlugComArquivosETutorial` — entradas `seguranca/SKILL.md`, `seguranca/referencia/headers.ts`, `seguranca/TUTORIAL.md`; conteúdo "ação" lido de volta igual (UTF-8).
  - `zipDeVariasSkillsUsaVigenteDeCada`.
  - `oficiaisParaZipExcluiArquivadasENaoOficiais` — método `List<Skill> oficiaisNaoArquivadas()` (usado por `GET /skills/oficiais.zip`).
  - `buscarPorSlugEncontraSkillArquivada`.
- [ ] **Step 2: Rodar** → FAIL. **Step 3: Implementar** (`java.util.zip.ZipOutputStream`, `StandardCharsets.UTF_8`). **Step 4: Rodar** → PASS.
- [ ] **Step 5: Commit** — `feat(skills): consultas e geração de zip`

---

### Task 5: API REST

**Files:**
- Create: `skills/web/SkillController.java` e records abaixo
- Modify: `infra/TratamentoErroGlobal.java` (SkillInvalida→400 `{mensagem}`, ConflitoSkill→409 `{mensagem}`, AcaoSkillNaoPermitida→403)
- Test: `.../skills/web/SkillControllerTest.java` (`@WebMvcTest` + `@Import({SecurityConfig.class, JwtService.class})`), `.../skills/web/SkillControllerIT.java` (fluxo ponta a ponta com Postgres: criar → oficializar → propor → aprovar → zip)

**Interfaces (JSON, consumido pelo frontend na Task 7):**
- `SkillResumoResponse(String slug, String nome, String descricao, CategoriaSkill categoria, boolean oficial, boolean arquivada, int versaoVigente, boolean propostaPendente, Instant atualizadaEm)`
- `ArquivoResponse(String caminho, String conteudo)`
- `SkillVersaoResponse(int numero, EstadoVersao estado, String nome, String descricao, CategoriaSkill categoria, String promptUso, String tutorialInstalacao, String mensagem, String autorNome /* "Sistema" se nulo */, Instant criadaEm, String decididaPorNome, Instant decididaEm, String motivoRejeicao, List<ArquivoResponse> arquivos)`
- `VersaoResumoResponse` = mesmo sem `arquivos`, `promptUso`, `tutorialInstalacao`.
- `SkillDetalheResponse(String slug, boolean oficial, boolean arquivada, SkillVersaoResponse vigente, VersaoResumoResponse propostaPendente /*nullable*/)`
- `PropostaResponse(String slug, String nomeSkill, int numero, String autorNome, Instant criadaEm, String mensagem)`
- Requests: `SalvarVersaoRequest(String nome, String descricao, CategoriaSkill categoria, String promptUso, String tutorialInstalacao, String mensagem, List<ArquivoRequest> arquivos)`, `ArquivoRequest(String caminho, String conteudo)`, `CriarSkillRequest(String slug, ...mesmos campos)`, `DecisaoRequest(String motivo)`, `FlagRequest(boolean valor)`.
- Rotas exatamente como §5.4 do spec; `PUT /skills/{slug}/oficial` e `/arquivada` recebem `FlagRequest`. `GET /skills/propostas` mapeado **antes** de `/skills/{slug}`. Zip: `Content-Type: application/zip`, `Content-Disposition: attachment; filename="<slug>.zip"` (e `"skills-oficiais-multiplica.zip"`).
- [ ] **Step 1: Testes que falham** (`SkillControllerTest`): 401 sem auth em `GET /skills`; `GET /skills` devolve lista; `POST /skills` 201; `POST .../aprovar` com `@WithMockUser(roles="COLABORADOR")` → 403; com `GESTOR` → 200; `SkillInvalidaException` → 400 com `$.mensagem`; `ConflitoSkillException` → 409 com `$.mensagem`; zip com headers corretos.
- [ ] **Step 2: Rodar** → FAIL. **Step 3: Implementar.** **Step 4: Rodar** `./mvnw test -Dtest=SkillControllerTest` → PASS.
- [ ] **Step 5: IT** `SkillControllerIT` cobrindo o fluxo completo; `./mvnw verify -Dit.test=SkillControllerIT` → PASS.
- [ ] **Step 6: Commit** — `feat(skills): API REST do catálogo`

---

### Task 6: Importador das skills oficiais

**Files:**
- Create: `skills/service/ImportadorSkillsOficiais.java`
- Create (fixture de teste): `backend/src/test/resources/skills-oficiais-teste/exemplo-teste/{SKILL.md,referencia/a.ts,_catalogo/meta.yml,_catalogo/prompt.md,_catalogo/tutorial.md}`
- Create: `backend/src/main/resources/skills-oficiais/.gitkeep`
- Test: `.../skills/service/ImportadorSkillsOficiaisTest.java`, `.../skills/SkillsOficiaisValidasTest.java`

**Interfaces:**
- Consumes: `SkillService.importar(...)` (Task 3).
- Produces: formato do diretório (o plano de conteúdo escreve nele): `skills-oficiais/<slug>/` = arquivos da skill + `_catalogo/meta.yml` (`nome`, `descricao`, `categoria`), `_catalogo/prompt.md`, `_catalogo/tutorial.md`. `_catalogo/` não vira arquivo da skill. Hash = SHA-256 de todos os caminhos+conteúdos ordenados (incluindo `_catalogo`) — usar `seguranca/HashSha256` existente se servir.
- `ImportadorSkillsOficiais(String raizClasspath /* "skills-oficiais" */, SkillService, ...)`, método `void importarTudo()` chamado em `@EventListener(ApplicationReadyEvent.class)`; propriedade `escritorio.skills.importar-oficiais` (default `true`; `false` nos testes de contexto se atrapalhar).
- [ ] **Step 1: Testes que falham:** `importaFixtureComoOficial`; `segundaExecucaoSemMudancaNaoCriaVersao`; `mudancaNoConteudoGeraProposta`; `SkillsOficiaisValidasTest.todasAsSkillsDoRepositorioPassamNoValidador` (varre `classpath:skills-oficiais/*`; passa vazio hoje e protege o plano de conteúdo).
- [ ] **Step 2: Rodar** → FAIL. **Step 3: Implementar** (`PathMatchingResourcePatternResolver` `classpath*:skills-oficiais/**`, funciona em jar). **Step 4: Rodar** → PASS.
- [ ] **Step 5: Commit** — `feat(skills): importador das skills oficiais do repositório`

---

### Task 7: Frontend — tipos, API, painel e lista

**Files:**
- Create: `frontend/src/features/skills/{types.ts,api.ts,SkillsPainel.tsx,ListaSkills.tsx,skills.css}`
- Modify: `features/escritorio/ui/BarraFerramentas.tsx` (`PainelId` + `'skills'`; botão `🧩`, `aria-label="Skills"`, visível a todos, antes do último botão fixo), `features/escritorio/EscritorioPage.tsx` (`TITULO_PAINEL.skills = '🧩 Skills'`; render `<SkillsPainel papel={papel} />`)
- Test: `features/skills/ListaSkills.test.tsx`, `features/escritorio/ui/BarraFerramentas` (teste existente, se houver, acrescentar botão)

**Interfaces:**
- `types.ts` espelha os records da Task 5 (mesmos nomes de campo) + `type Categoria`, `type EstadoVersao`.
- `api.ts`: `listarSkills(filtro: {busca?: string; categoria?: Categoria; soOficiais?: boolean; arquivadas?: boolean})`, `buscarSkill(slug)`, `listarVersoes(slug)`, `buscarVersao(slug, numero)`, `criarSkill(req)`, `salvarVersao(slug, req)`, `restaurarVersao(slug, numero)`, `aprovar(slug, numero)`, `rejeitar(slug, numero, motivo)`, `definirOficial(slug, valor)`, `definirArquivada(slug, valor)`, `listarPropostas()`, `urlZip(slug, numero?)`, `baixarZip(slug)`, `baixarOficiais()` (usa `apiFetch` + `shared/dispararDownload.ts`). Erros 400/409 lançam `ErroSkill extends Error` com `mensagem` do corpo.
- `SkillsPainel({ papel }: { papel: string | null })` — estado local `tela: {tipo:'lista'} | {tipo:'detalhe', slug} | {tipo:'editor', slug?: string} | {tipo:'aprovacoes'}`.
- `ListaSkills({ aoAbrir, aoNova, aoAprovacoes, podeAprovar })`.
- [ ] **Step 1: Testes que falham** (MSW): mostra nome, descrição e selo "Oficial Multiplica"; indicador "Proposta pendente"; busca digitada chama `/skills?busca=login`; filtro "Só oficiais"; botão "Baixar todas as oficiais" chama `/skills/oficiais.zip`; botão "Aprovações" só com `podeAprovar`; estado vazio "Nenhuma skill encontrada.".
- [ ] **Step 2: Rodar** `cd frontend && npx vitest run src/features/skills` → FAIL. **Step 3: Implementar** (reaproveitar classes de `styles/paineis.css`). **Step 4: Rodar** → PASS; `npm run lint` e `npx tsc -b` limpos.
- [ ] **Step 5: Commit** — `feat(skills): painel Skills com lista e busca`

---

### Task 8: Frontend — detalhe (visão geral, arquivos, histórico)

**Files:**
- Create: `features/skills/{DetalheSkill.tsx,Markdown.tsx}`; Modify: `frontend/package.json` (+ `react-markdown`, `remark-gfm`)
- Test: `features/skills/DetalheSkill.test.tsx`

**Interfaces:**
- `Markdown({ texto }: { texto: string })` — `react-markdown` + `remark-gfm`, sem `rehype-raw`.
- `DetalheSkill({ slug, podeAprovar, aoVoltar, aoEditar })`.
- [ ] **Step 1: Testes que falham:** aba Visão geral mostra prompt e "Copiar prompt" chama `navigator.clipboard.writeText(promptUso)` e mostra "Copiado!"; tutorial renderizado (heading vira `<h2>`); HTML bruto no markdown (`<script>`) não é renderizado como elemento; "Baixar .zip" chama `/skills/<slug>/zip`; aba Arquivos lista caminhos e mostra conteúdo ao clicar; aba Histórico lista versões com estado e "Restaurar" chama `POST .../versoes/1/restaurar`; com `podeAprovar`, botões "Marcar como oficial"/"Arquivar".
- [ ] **Step 2–4:** rodar → FAIL; implementar; rodar → PASS.
- [ ] **Step 5: Commit** — `feat(skills): detalhe com prompt, tutorial, arquivos e histórico`

---

### Task 9: Frontend — editor

**Files:** Create `features/skills/EditorSkill.tsx`; Test `features/skills/EditorSkill.test.tsx`

**Interfaces:** `EditorSkill({ slug?: string, oficial: boolean, inicial?: SkillVersaoResponse, aoSalvar: (v: SkillVersaoResponse) => void, aoCancelar })`. Sem `slug` = criação (campo slug visível). Nova skill começa com `SKILL.md` modelo contendo frontmatter `name: <slug>` / `description:`.
- [ ] **Step 1: Testes que falham:** adicionar/renomear/remover arquivo; `SKILL.md` não tem botão remover; mensagem da alteração obrigatória (botão desabilitado); validação local de caminho (`../x` mostra erro e bloqueia salvar); com `oficial`, aviso "Esta skill é oficial: sua alteração vai para aprovação." e o retorno `estado: 'PROPOSTA'` mostra "Proposta enviada para aprovação"; 400 do servidor mostra a `mensagem` e mantém o texto digitado; 409 idem.
- [ ] **Step 2–4:** rodar → FAIL; implementar (validação local espelha as regras de caminho/slug/limites das Global Constraints); rodar → PASS.
- [ ] **Step 5: Commit** — `feat(skills): editor multi-arquivo`

---

### Task 10: Frontend — aprovações e notificações

**Files:** Create `features/skills/{AprovacoesSkills.tsx,DiffArquivo.tsx}`; Modify `frontend/package.json` (+ `diff`, `@types/diff` se necessário), `features/notificacoes/NotificacoesPainel.tsx` + `types.ts` (ícones `🧩` para os 3 tipos novos); Test `features/skills/AprovacoesSkills.test.tsx`, ajustar `NotificacoesPainel.test.tsx`.

**Interfaces:** `DiffArquivo({ antes: string | null, depois: string | null, caminho })` — linhas adicionadas/removidas (`diffLines`), arquivo novo/removido indicado. `AprovacoesSkills({ aoVoltar })`.
- [ ] **Step 1: Testes que falham:** fila lista propostas (`/skills/propostas`); abrir proposta mostra diff por arquivo contra a vigente (linha adicionada com classe `diff-adicionada`); "Aprovar" chama `POST .../aprovar`; "Rejeitar" exige motivo; notificação `SKILL_PROPOSTA` aparece com 🧩.
- [ ] **Step 2–4:** rodar → FAIL; implementar; rodar → PASS.
- [ ] **Step 5: Commit** — `feat(skills): fila de aprovações com diff`

---

### Task 11: Verificação em navegador real

- [ ] **Step 1:** `cd backend && ./mvnw verify` e `cd frontend && npm test && npm run lint && npm run build` → tudo verde.
- [ ] **Step 2:** `docker compose up -d --build`; login `admin@escritor.io` (código no Mailpit). Fluxo: abrir 🧩 → criar skill `teste-fluxo` → editar (publica na hora) → marcar oficial → editar (vira proposta, notificação chega) → aprovar → baixar zip → extrair em `.claude/skills/` de uma pasta de teste e confirmar que o Claude Code lista a skill. Logar como COLABORADOR (criar via painel Colaboradores) e confirmar que não vê Aprovações nem botões de oficializar.
- [ ] **Step 3:** Atualizar `README.md` (seção "O que o sistema faz hoje" → "Catálogo de skills") e commitar — `docs: catálogo de skills no README`.
