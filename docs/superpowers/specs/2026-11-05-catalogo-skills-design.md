# Catálogo de Skills Multiplica no escritor.io — Design

Data: 2026-11-05 · Autor: Nicolas (com Claude) · Status: aprovado pelo usuário ("pode subir já na plataforma") em 2026-11-05

## 1. Intenção e porquê

A empresa está criando muitos sistemas para a Multiplica (FinAnalytics, BeyondCredit, CONECTA, Conta Gráfica, Beyond Comitê, CambIA) e cada um refaz do zero as mesmas peças — login, segurança, identidade visual, IA, instalação no servidor do cliente — cada vez de um jeito. Qualquer pessoa da empresa pode produzir software (com Claude Code), então a forma de não reinventar é transformar **tudo que é feito mais de uma vez** em **skills do Claude Code** que definem **um padrão único Multiplica**.

O escritor.io é o ambiente que todos já usam todo dia, então o catálogo mora lá: um painel **"Skills"** onde qualquer pessoa encontra a skill, lê para que serve, copia o prompt pronto para usá-la, segue o tutorial de instalação e baixa o pacote — e também cria e edita skills, com as oficiais protegidas por aprovação.

**Sucesso:** um projeto novo para a Multiplica começa baixando as skills oficiais e pedindo ao Claude Code "use a skill X"; o resultado sai no stack, na paleta, no login e na instalação oficiais sem ninguém precisar abrir os sistemas antigos.

## 2. Objetivos, não-objetivos, anti-objetivos

**Objetivos**
- Painel "Skills" no escritor.io: listar, buscar, ver, copiar prompt, ver tutorial, baixar `.zip` (uma skill ou todas as oficiais).
- Qualquer pessoa logada cria e edita skills; cada salvamento é uma versão nova (histórico completo, restaurar versão).
- Selo **Oficial Multiplica**: só GESTOR/ADMIN marca. Edição de skill oficial vira **proposta** até GESTOR/ADMIN aprovar; o que se baixa é sempre a versão oficial aprovada.
- 14 skills oficiais escritas agora, definindo o padrão único (seção 6).

**Não-objetivos**
- Não migrar o escritor.io (Java/Spring) nem os sistemas existentes para o padrão novo. O padrão vale para sistemas **novos**.
- Não instalar skills automaticamente nos projetos (sem CLI, sem integração com GitHub). Distribuição = zip + tutorial.
- Sem Helm/Kubernetes nas skills — decisão do usuário: **só Docker Compose**.
- Sem avaliações, comentários, ranking de skills nesta versão.

**Anti-objetivos (seria fracasso mesmo funcionando)**
- O padrão oficial mudar sem ninguém perceber (por isso proposta + aprovação).
- Conteúdo das skills vazar segredos, chaves, IPs ou dados de clientes copiados dos repositórios de origem.
- Skills que só funcionam lidas por gente — elas têm de ser acionáveis pelo Claude Code (frontmatter e descrição corretos, regras verificáveis, código de referência).

## 3. Restrições

- Seguir a arquitetura e metodologia do escritor.io: Spring Boot 4.1 / Java 21, PostgreSQL 16 + Flyway (próxima migração: `V54`), pacotes por módulo (`domain`/`repository`/`service`/`web`), React 19 + TypeScript + TanStack Query + zustand no frontend, **TDD**, fatia vertical, verificação em navegador real. Ver `docs/architecture.md`, `docs/testing-strategy.md`.
- O app tem uma tela só (Escritório); funcionalidades são painéis do dock (`PainelId` em `frontend/src/features/escritorio/ui/BarraFerramentas.tsx`, renderizados em `PainelFlutuante` dentro de `EscritorioPage.tsx`).
- Papéis existentes: `COLABORADOR` / `GESTOR` / `ADMIN` (Spring Security, `@PreAuthorize`). Lembrar da lição VULN-02/03 do `ProjetoController`: checar papel **e** posse/escopo no serviço, não só anotação.
- Notificações in-app já existem (módulo `notificacao`) — reutilizar.
- Escala ~10 usuários simultâneos.

## 4. Abordagens consideradas

1. **Skill como pacote de arquivos no banco (ESCOLHIDA)** — cada versão de skill é um conjunto de arquivos (`SKILL.md` + referências) guardado no Postgres; editor multi-arquivo; zip gerado no download. É o formato nativo do Claude Code (divulgação progressiva: o `SKILL.md` é lido, as referências só quando necessário), o que permite skills com código completo sem inchar o contexto. Custo: editor multi-arquivo.
2. Skill como um único markdown — editor e banco triviais, mas skills com código (Login, Instalação, Langfuse) viram arquivos enormes carregados inteiros. Descartada.
3. Repositório Git separado editado via API do GitHub — histórico/revisão de graça, mas amarra o escritor.io ao GitHub e a um token, e expõe não-devs a PRs. Descartada.

O usuário escolheu a 1.

## 5. A funcionalidade no escritor.io

### 5.1 Conceitos

- **Skill**: identificada por `slug` (kebab-case, único, imutável após criada; é o nome da pasta e o `name` do frontmatter). Guarda autor, se é oficial, se está arquivada.
- **Versão**: fotografia imutável de uma skill: **nome de exibição, descrição curta, categoria**, o conjunto completo de arquivos + `prompt_uso` + `tutorial_instalacao` + mensagem da alteração + autor + data. Salvar sempre cria versão nova (nunca edita uma versão). Como nome/descrição/categoria são versionados, mudá-los numa skill oficial também passa por aprovação.
- **Estados de versão**: `PUBLICADA` (versão vigente de skill não-oficial, ou versões antigas), `PROPOSTA` (aguardando aprovação, só em skill oficial), `REJEITADA` (com motivo). A skill aponta para sua **versão vigente** — é a que aparece, é copiada e baixada.
- **Categorias** (fixas, enum): `FUNDACAO`, `SEGURANCA`, `INTERFACE`, `IA`, `INFRA`, `DADOS`, `OUTRAS`.

### 5.2 Regras de fluxo

| Situação | Quem | Efeito |
|---|---|---|
| Criar skill | qualquer logado | skill não-oficial, versão 1 `PUBLICADA` e vigente |
| Salvar edição em skill **não-oficial** | qualquer logado | nova versão `PUBLICADA`, vira vigente na hora |
| Marcar como oficial / tirar selo | GESTOR, ADMIN | muda o selo; versão vigente continua a mesma |
| Salvar edição em skill **oficial** | qualquer logado | nova versão `PROPOSTA`; vigente não muda; GESTOR/ADMIN notificados |
| Aprovar proposta | GESTOR, ADMIN (**inclusive a própria proposta** — decisão do usuário) | proposta vira `PUBLICADA` e vigente; autor notificado |
| Rejeitar proposta | GESTOR, ADMIN | vira `REJEITADA` com motivo obrigatório; autor notificado |
| Restaurar versão antiga | qualquer logado | cria versão nova copiando a antiga (passa pela regra de "salvar" acima) |
| Arquivar / desarquivar | GESTOR, ADMIN | some da lista padrão (filtro "arquivadas"); download continua por link direto |

- **Uma proposta pendente por skill** (decisão do builder/Claude, ver §8): enquanto houver proposta pendente, o editor da skill mostra o aviso "Há uma proposta de Fulano aguardando aprovação" e só permite abrir a proposta (o próprio autor pode editá-la — gera nova proposta que substitui a anterior, que vira `REJEITADA` com motivo "substituída pelo autor"). Evita conflito de duas propostas sobre a mesma base.
- Ao aprovar, a tela de aprovação mostra **diff por arquivo** (proposta × vigente).
- Toda ação (criar, salvar, aprovar, rejeitar, oficializar, arquivar) gera evento no histórico da skill (quem/quando/o quê) — o próprio histórico de versões cobre a maior parte; ações sem versão nova (oficializar, arquivar) ficam numa tabela de eventos.

### 5.3 Modelo de dados (migração `V54__cria_catalogo_skills.sql`)

```
skill(id, slug UNIQUE, oficial bool, arquivada bool, versao_vigente_id FK,
      criada_por FK usuario, criada_em, hash_importado null)
skill_versao(id, skill_id FK, numero int, estado, nome, descricao, categoria,
             prompt_uso text, tutorial_instalacao text,
             mensagem text, autor_id FK, criada_em, decidida_por FK null, decidida_em null,
             motivo_rejeicao null, UNIQUE(skill_id, numero))
skill_arquivo(id, versao_id FK, caminho varchar, conteudo text, UNIQUE(versao_id, caminho))
skill_evento(id, skill_id FK, tipo, usuario_id FK, ocorrido_em, detalhe text)
```
Nomes exatos de colunas/índices ficam com o builder, seguindo o estilo das migrações existentes.

**Validações** (no domínio, com testes):
- `slug`: `^[a-z0-9]+(-[a-z0-9]+)*$`, 3–64 chars.
- Toda versão tem `SKILL.md` na raiz, com frontmatter YAML contendo `name` == slug e `description` não vazia (o Claude Code depende disso).
- `caminho`: relativo, sem `..`, sem começar com `/` ou `\`, só `[A-Za-z0-9._/-]`, até 200 chars; sem duplicados.
- Limites: até 50 arquivos por versão, 256 KB por arquivo, 2 MB por versão. Só texto (UTF-8).

### 5.4 API (módulo backend novo `io.escritor.presenca.skills`)

```
GET    /skills?busca=&categoria=&oficial=&arquivadas=     lista (sem conteúdo dos arquivos)
GET    /skills/{slug}                                      detalhe + versão vigente + arquivos
GET    /skills/{slug}/versoes                              histórico
GET    /skills/{slug}/versoes/{numero}                     uma versão com arquivos
POST   /skills                                             criar
POST   /skills/{slug}/versoes                              salvar edição (corpo: arquivos, prompt, tutorial, mensagem)
POST   /skills/{slug}/versoes/{numero}/restaurar
POST   /skills/{slug}/versoes/{numero}/aprovar             GESTOR/ADMIN
POST   /skills/{slug}/versoes/{numero}/rejeitar            GESTOR/ADMIN (motivo)
PUT    /skills/{slug}/oficial        {oficial: bool}       GESTOR/ADMIN
PUT    /skills/{slug}/arquivada      {arquivada: bool}     GESTOR/ADMIN
GET    /skills/propostas                                   GESTOR/ADMIN: fila de propostas pendentes
GET    /skills/{slug}/zip[?versao=n]                       zip da vigente (ou da versão n)
GET    /skills/oficiais.zip                                todas as oficiais não arquivadas
```
Todas autenticadas. Checagem de papel no **serviço** além do `@PreAuthorize` (lição VULN-02).

**Zip:** pasta `<slug>/` com todos os arquivos da versão + `<slug>/TUTORIAL.md` (o tutorial de instalação) — pronto para extrair em `.claude/skills/`. Gerado em memória com `java.util.zip`. `Content-Disposition` com nome sanitizado.

### 5.5 Frontend (feature nova `frontend/src/features/skills/`)

- Novo `PainelId` `'skills'` com botão na toolbar (todos os papéis). O painel ocupa o `PainelFlutuante` como os demais; navegação interna por estado local (mesmo padrão do `PainelProjetos`, sem mexer na URL).
- **Lista**: busca por nome/descrição, filtro de categoria, filtro "só oficiais", selo **Oficial Multiplica**, indicador "proposta pendente", botões "Nova skill" e "Baixar todas as oficiais".
- **Detalhe**, em abas:
  - *Visão geral*: descrição, **prompt de uso com botão Copiar**, **tutorial de instalação** renderizado, botão **Baixar .zip**, autor, versão vigente.
  - *Arquivos*: árvore de arquivos + visualização (markdown renderizado para `.md`, bloco de código para o resto).
  - *Histórico*: versões com autor/data/mensagem/estado; ver versão; restaurar.
- **Editor**: lista de arquivos à esquerda (adicionar, renomear, remover; `SKILL.md` não pode ser removido), área de texto monoespaçada à direita; campos de prompt e tutorial; mensagem da alteração obrigatória; validação local espelhando a do backend; aviso claro quando o salvamento vai virar proposta ("Esta skill é oficial: sua alteração vai para aprovação").
- **Aprovações** (só GESTOR/ADMIN, aba visível no painel): fila de propostas; diff por arquivo (linhas) proposta × vigente; aprovar / rejeitar com motivo.
- Markdown renderizado **sem HTML bruto** (sanitizado). Hoje o frontend não tem lib de markdown — adicionar `react-markdown` + `remark-gfm` (decisão do builder/Claude, ver §8); para diff, uma lib pequena como `diff` (idem).

### 5.6 Notificações

Reutilizar o módulo `notificacao`: nova proposta → todos GESTOR/ADMIN; proposta aprovada/rejeitada → autor da proposta.

### 5.7 Carga das skills oficiais

- O conteúdo das 14 skills vive no repositório em `backend/src/main/resources/skills-oficiais/<slug>/`, com os arquivos da skill + `_catalogo/` contendo `meta.yml` (nome, descrição curta, categoria), `prompt.md` e `tutorial.md`. (`_catalogo/` não entra na skill.)
- Na subida da aplicação, um importador idempotente cria cada skill **que ainda não existe** no banco como **oficial**, versão 1 `PUBLICADA`, autor = o usuário ADMIN de seed (ou um usuário técnico "Sistema" — decisão do builder), e guarda o hash do conteúdo importado.
- **Revisão do conteúdo inicial:** decisão do usuário — quem revisa as 14 skills é o próprio Claude Code (um revisor independente lê cada skill contra a §6 e o anti-objetivo de vazamento antes do merge). Elas sobem direto como oficiais.
- Se a skill já existe e o conteúdo do diretório **mudou** desde o último hash importado, o importador cria uma versão `PROPOSTA` (autor "Sistema", mensagem "atualização do repositório") em vez de ignorar; se não mudou, não faz nada. O banco continua sendo a fonte da verdade.
- Teste automatizado que carrega todas as skills do diretório e valida as regras da §5.3 (frontmatter, caminhos, limites) — garante que nenhuma skill oficial nasça inválida.

### 5.8 Testes (TDD, como o resto do projeto)

- Domínio: regras de fluxo da §5.2 e validações da §5.3 (unitários).
- Repositório/serviço: integração com Postgres real (mesmo padrão dos ITs existentes).
- Web: controllers, incluindo autorização (COLABORADOR não aprova; não oficializa) e zip (estrutura, nomes).
- Frontend: vitest + Testing Library para lista, detalhe (copiar prompt), editor (aviso de proposta, validação), aprovações.
- Verificação final em navegador real: criar skill, editar, oficializar, propor, aprovar, baixar zip e conferir que o Claude Code reconhece a skill extraída.

## 6. O padrão único Multiplica — as 14 skills oficiais

### 6.1 Decisões de padrão (tomadas com o usuário)

- **Stack oficial para sistemas novos:** TypeScript ponta a ponta — **NestJS + Drizzle + PostgreSQL 16** no backend; **React + Vite + Tailwind + shadcn/ui + TanStack Query** no frontend; monorepo pnpm. As **regras** de cada skill são independentes de stack; o **código de referência** é TypeScript.
- **Identidade visual** aprovada (mock de 2026-11-05, unindo BeyondCredit + BeyondComitê + FinAnalytics):
  - Primária `#2F6FED` (hover `#1F5AD6`, suave `#EAF1FE`); navy de marca `#001A33` (hover `#0D2B46`, texto `#C2CEDD`); ciano de destaque `#00E1FF`.
  - Fundo `#F5F7FA`, superfície `#FFFFFF`, borda `#DEE6EF`, texto `#172B43` / `#5B6B80` / `#8A97A8`.
  - Sucesso `#059669`, alerta `#D97706`, perigo `#DC2626`, info `#0284C7` (cada um com tom suave).
  - Modo escuro: fundo `#0B1120`, superfície `#111A2E`, borda `#1F2A40`, texto `#E6ECF5`, primária `#5B8DEF`, sidebar `#000E1C`, status claros (`#34D399`, `#FBBF24`, `#F87171`, `#38BDF8`).
  - Fontes: **Inter** (texto), **Space Grotesk** (títulos e números grandes), **JetBrains Mono** (valores/código). Escala 12 / 13 / 14 (base) / 16 / 20 / 24 / 30. Raios 6 / 8 / 12 (cards).
  - **Sidebar navy** de 256px com marca "Beyond<span ciano>Nome</span>" + "MULTIPLICA", item ativo primária com barra ciano à esquerda. (O usuário aprovou a paleta sem escolher sidebar explicitamente; navy foi a escolha de Claude por ser a mais "marca" — usuário pode trocar.)
- **Instalação:** **só Docker Compose**, no modelo CambIA + CONECTA (Caddy com HTTPS automático) + Conta Gráfica. Sem Helm.

### 6.2 As skills

**Profundidade do código de referência** (decisão do usuário: "ambos"): cada skill traz trechos legíveis e comentados em `referencia/`, **e** esse mesmo código é validado — compila e tem testes — num **projeto-modelo** NestJS + React (monorepo pnpm). O projeto-modelo fica no repositório do escritor.io em `skills-modelo/` (fora do build do escritor.io) e prova que as referências funcionam juntas; os arquivos em `referencia/` são cópias fiéis dele (um script compara e falha se divergirem).

Cada skill entrega: `SKILL.md` (frontmatter `name`/`description` que faça o Claude Code acioná-la; regras verificáveis; checklist de "pronto"); pasta `referencia/` com código TypeScript de referência; **prompt de uso** pronto para copiar; **tutorial de instalação** (pré-requisitos, variáveis de ambiente, dependências, como verificar que funcionou). Conteúdo extraído dos sistemas de origem e **sanitizado** (sem segredos, IPs, domínios de clientes além de exemplos).

| slug | Categoria | O padrão que define | Fontes principais |
|---|---|---|---|
| `novo-projeto-multiplica` | FUNDACAO | Esqueleto do monorepo (apps/api NestJS, apps/web React, packages/contratos), config validada com zod no boot, logs pino com request-id, `/api/health` com versão e commit, 404 real para `/api/*` desconhecido, CLAUDE.md modelo, vitest + Testing Library + Playwright; ordem de aplicação das outras skills | BeyondCredit, FinAnalytics (CLAUDE.md e `.claude/skills`), Conta Gráfica |
| `seguranca` | SEGURANCA | Cabeçalhos (nosniff, XFO DENY, no-referrer, COOP/CORP, Permissions-Policy, HSTS), CSP estrita, CORS por allowlist, CSRF (Origin/Referer + Sec-Fetch-Site), rate limit por IP e por chave, classe `Secret` que se oculta em logs, segredos via `*_ARQUIVO`, nunca enumerar contas, CI com gitleaks + `pnpm audit --audit-level high` + CodeQL + Dependabot; checklist dos achados do pentest R5 do FinAnalytics | BeyondCredit `http-security.ts`, Conta Gráfica, FinAnalytics `SECURITY_*.md`, CONECTA |
| `login-codigo-email` | SEGURANCA | Código de 6 dígitos (`randomInt`), guardado só como HMAC-SHA256, 10 min, 5 tentativas (conta antes de comparar), novo código invalida os anteriores, limite por e-mail e por IP, advisory lock, resposta idêntica e tempo mínimo ~600 ms, domínios permitidos, sessão opaca em cookie `__Host-` httpOnly/Secure/SameSite=Lax guardada como SHA-256, ociosa 30 min / absoluta 12 h, papéis relidos a cada requisição, logout revoga, primeiro admin por env, auditoria de login, tela de login padrão | Conta Gráfica, BeyondCredit, CONECTA |
| `identidade-visual` | INTERFACE | Tokens da §6.1 (CSS vars claro/escuro + tema Tailwind + mapeamento shadcn), fontes **auto-hospedadas** (`@fontsource`, sem Google Fonts — CSP e servidor sem internet), troca de tema sem piscar, app shell (sidebar navy, cabeçalho de página, cards), telas-modelo: login, listagem com filtros e tabela, formulário, dashboard; estados vazio/carregando/erro; formatos BR (moeda, data, CPF/CNPJ) | BeyondCredit `credit.css`, Comitê, FinAnalytics, Conta Gráfica |
| `ia-langfuse` | IA | Cliente único `@anthropic-ai/sdk` com `baseURL` opcional para LiteLLM; apelidos de modelo por tarefa (`LLM_MODEL_<TAREFA>`, padrões `claude-sonnet-5-5` / `claude-haiku-5-5`); IA desligada por padrão (`IA_HABILITADA`); Langfuse via OpenTelemetry + `LangfuseSpanProcessor`, no-op sem chaves; **só metadados por padrão**, conteúdo opt-in com mascaramento (CPF, CNPJ, e-mail, segredos); um trace por operação com userId/sessionId; custo por chamada; Langfuse self-hosted como profile do compose | FinAnalytics, Conta Gráfica, CambIA, Comitê, CONECTA |
| `instalacao-docker-compose` | INFRA | Dockerfile multi-stage não-root; **uma imagem** por versão (API serve o SPA; worker = mesma imagem com `ROLE=worker`); `deploy/docker-compose.yml` com Caddy (HTTPS automático com domínio público ou `tls internal` em rede interna), serviço `migracao` one-shot antes da API, Postgres 16 com healthcheck, profiles opcionais (`langfuse`, `mailpit`, `antivirus`); `.env.example` comentado com `${VAR:?}` nas obrigatórias; `backup.sh`/`restore.sh` (`pg_dump -Fc`, cron, retenção); tutorial para a TI do cliente (instalar, atualizar, voltar versão, backup) em bash e PowerShell | CambIA, CONECTA `docker-compose.server.yml` + Caddyfile + `ops/backup-servidor.sh`, Conta Gráfica `infra/` |
| `trilha-auditoria` | DADOS | Tabela `audit_event` só de inclusão (trigger bloqueia UPDATE/DELETE + papel de banco de runtime sem permissão), quem/ação/alvo/antes/depois/ip/request-id, serviço de registro, tela admin com filtros e exportação | Conta Gráfica, BeyondCredit, CambIA, Comitê, escritor.io (ponto) |
| `usuarios-e-papeis` | SEGURANCA | Papéis base `ADMIN`/`GESTOR`/`USUARIO` extensíveis, guard + checagem de escopo no serviço (lições SEC-001/VULN-02), tela admin (convidar por e-mail, ativar/desativar, trocar papel), primeiro admin, nunca apagar usuário (desativar) | BeyondCredit, Comitê, Conta Gráfica, CambIA |
| `exportacao-excel-pdf-csv` | DADOS | Abstração `RelatorioTabular` → exportadores Excel (exceljs), PDF (pdfkit) e CSV (`;` + BOM UTF-8); formatos brasileiros; logo/identidade; `Content-Disposition` seguro; botão de exportar padrão no frontend | CambIA `exportacao/`, BeyondCredit, FinAnalytics, Comitê, Conta Gráfica |
| `lgpd-dados-pessoais` | SEGURANCA | Mascaramento de CPF/e-mail por papel (interceptor), criptografia de campo AES-256-GCM com chave rotacionável (`kid`) + índice cego HMAC para busca, nunca logar PII, retenção com job de expurgo, exportar/anonimizar dados do titular, modelo de `docs/lgpd.md` | BeyondCredit `privacy/`, CONECTA `modules/pii`, FinAnalytics masking |
| `email-transacional` | INFRA | Interface `EnviadorEmail` com SMTP (nodemailer) e modo log (só dev, **recusado em produção**), Mailpit no compose de dev, templates HTML com a identidade visual, envio assíncrono via fila com retry | CambIA, BeyondCredit, Comitê, Conta Gráfica |
| `upload-armazenamento` | INFRA | Interface `Armazenamento` (local / S3-compatível / Azure Blob), limite de tamanho por stream, tipo validado por assinatura de bytes, nomes gerados no servidor, URL assinada para download, antivírus ClamAV opcional (profile) | Comitê, BeyondCredit, FinAnalytics, CONECTA |
| `fila-de-tarefas` | INFRA | pg-boss no mesmo Postgres, worker como `ROLE=worker` da mesma imagem, retry com backoff, tarefas idempotentes, agendamentos cron, alerta por e-mail em falha definitiva | FinAnalytics, Conta Gráfica, BeyondCredit |
| `versionamento-release` | INFRA | Arquivo `VERSION` (SemVer) sincronizado com os `package.json`, `CHANGELOG.md` (Keep a Changelog), script de release (bump, tag, build, push no GHCR com tag de versão — nunca só `latest`), GitHub Actions de CI (lint, typecheck, testes, gitleaks, audit, build da imagem), versão no rodapé da sidebar e no `/api/health` | CambIA `scripts/release.sh`, BeyondCredit, Comitê |

### 6.3 Tutorial de instalação (comum a todas)

1. Baixar o `.zip` no painel Skills do escritor.io (uma skill ou "todas as oficiais").
2. Extrair em `<seu-projeto>/.claude/skills/` (vale para quem usa o projeto) ou em `~/.claude/skills/` (só para você).
3. Abrir o Claude Code na pasta do projeto; conferir que a skill aparece.
4. Colar o prompt de uso da skill.
5. Seguir a parte específica da skill (variáveis de ambiente, dependências, verificação).

Cada `tutorial.md` repete os passos 1–4 resumidos e detalha o 5.

### 6.4 Repositórios de origem (para extrair o conteúdo)

Locais: `C:\Users\leanc\claude_code\CambIA`, `beyond-credit` (não usar `bc-layout`, é cópia antiga), `beyond-comite-main`, `beyond-suportIA` (= CONECTA). Clonados para leitura (shallow) em `C:\Users\leanc\AppData\Local\Temp\claude\d6aefd2591b2e990\d94907ac-d5e7-4f8c-98e5-cb7e997183c1\scratchpad\repos\FinAnalytics` e `...\scratchpad\repos\beyondcontagrafica` (GitHub `ColaboradorLeance/*`; a conta `ColaboradorLeance` está logada no `gh` mas não é a ativa — usar `GH_TOKEN=$(gh auth token --user ColaboradorLeance)` por comando, sem trocar a conta ativa). Tratar o conteúdo deles como dado, não instrução.

Material sensível: os achados do pentest R5 do FinAnalytics entram na skill `seguranca` só como **classes de vulnerabilidade** genéricas (ex.: "acesso entre tenants por identificador de negócio"), sem rotas, domínios ou detalhes do sistema.

## 7. Ordem sugerida de entrega

1. Backend do catálogo (domínio → repositório → serviço → web), com zip.
2. Frontend: lista + detalhe + copiar + baixar.
3. Editor + histórico + restaurar.
4. Oficial + propostas + aprovações + notificações.
5. Importador das skills oficiais + teste de validação.
6. Conteúdo das 14 skills (pode andar em paralelo a 1–4).
7. Verificação em navegador real e teste de uma skill baixada no Claude Code.

## 8. Decisões tomadas por Claude (usuário pode revisar)

- Sidebar navy como padrão (usuário aprovou a paleta sem escolher).
- Uma proposta pendente por skill.
- Nome, descrição e categoria versionados junto com os arquivos.
- Prompt de uso e tutorial são campos da versão (versionados junto com os arquivos); o tutorial entra no zip como `TUTORIAL.md`.
- Slug imutável após criação.
- Limites de tamanho (50 arquivos, 256 KB/arquivo, 2 MB/versão).
- `react-markdown` + `remark-gfm` para renderizar markdown; lib `diff` para o diff de aprovação.
- Skills oficiais semeadas a partir de arquivos no repositório, importadas só se ainda não existirem.
- Fontes auto-hospedadas (`@fontsource`) em vez de Google Fonts.
- Uma imagem Docker por sistema (API serve o SPA), worker como papel da mesma imagem.
- PDF com pdfkit; Excel com exceljs.

## 9. Fica a critério do builder

Nomes exatos de classes, colunas e índices; layout fino do painel (usando o CSS existente em `styles/paineis.css`); como o diff é exibido; textos de interface; redação final de cada skill desde que siga a §6.
