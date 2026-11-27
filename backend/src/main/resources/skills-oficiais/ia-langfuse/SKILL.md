---
name: ia-langfuse
description: Use quando um sistema Multiplica precisar chamar um modelo de IA (Claude) — resumir, classificar, extrair dados, responder perguntas, "usar IA", "integrar com a Anthropic", "SDK da Claude", "LiteLLM", "escolher o modelo por tarefa", "controlar custo de IA", "rastrear chamadas de IA", "Langfuse", "observabilidade de IA", "mascarar CPF no prompt", "ligar/desligar a IA por ambiente", "tabela de preço por modelo". Cobre o cliente @anthropic-ai/sdk com IA_HABILITADA desligada por padrão, modeloPara por tarefa (LLM_MODELO_<TAREFA>), gateway LiteLLM, rastreio OpenTelemetry no Langfuse só com metadados (conteúdo mascarado quando ligado), custo por modelo, rota de exemplo POST /api/ia/resumir e o Langfuse self-host no Docker Compose.
---

# IA e Langfuse Multiplica

Toda chamada de IA do sistema passa por **um** cliente (`ClienteIa`, `ia/cliente-ia.ts`): ele decide o modelo pela tarefa, recusa a chamada
quando a IA está desligada no ambiente, calcula o custo e manda um traço (modelo, tokens, custo, duração, usuário) ao **Langfuse** — sem o
texto, a menos que o cliente do sistema autorize. O código de `referencia/` é cópia de um projeto-modelo que compila e passa nos testes
(sem chamada real à API: um servidor HTTP falso faz o papel do modelo): copie e adapte. Vem de FinAnalytics (`anthropic-client.ts`,
`instrumentation.ts`, `observability/masking.ts`), Conta Gráfica (`packages/chat/src/ia`, `docs/observabilidade-ia.md`), CambIA
(`LangfuseRastreio`, perfil compose self-host) e Comitê (`custo-ia.service.ts`). **Cada valor abaixo é fixo**; mudar um é decisão do
cliente, registrada no `CLAUDE.md`.

## Padrão Multiplica

1. **SDK oficial `@anthropic-ai/sdk` `1.6.0` (versão exata), só dentro de `ia/cliente-ia.ts`.** Nada de `fetch` cru para a API, de SDK
   de outro fornecedor, nem de `new Anthropic()` espalhado: o resto do sistema injeta `CLIENTE_IA` e chama `ia.gerar({ tarefa, prompt, ... })`.
2. **`IA_HABILITADA=false` por padrão.** Desligada, `gerar` lança `ErroIaDesabilitada` com a mensagem exata **"IA desabilitada neste ambiente"**
   (a rota responde 503) e nada sai pela rede. Cada ambiente liga a sua (homologação e produção; dev e testes ficam desligados).
3. **Falha fechada.** `IA_HABILITADA=true` com `NODE_ENV` de produção (ou ausente: só `development`/`test` **declarados** relaxam) sem
   `ANTHROPIC_API_KEY` → a API **não sobe** (`exigirConfigIa`). A chave é `Segredo` (`ANTHROPIC_API_KEY_ARQUIVO` em produção); nunca em log,
   resposta, auditoria ou traço.
4. **Modelo por tarefa, nunca no código de negócio.** `modeloPara(tarefa)` lê `LLM_MODELO_<TAREFA>` (`resumo` → `LLM_MODELO_RESUMO`; hífen
   vira `_`); sem ela, a tarefa `rapido` usa `LLM_MODELO_RAPIDO` (padrão **`claude-haiku-5-5`**) e as demais `LLM_MODELO_PADRAO` (padrão
   **`claude-sonnet-5-5`**). Ids sem sufixo de data; variável vazia = ausente; id com caractere fora de `[A-Za-z0-9._:/-]` é recusado.
5. **Gateway LiteLLM opcional.** Com `LITELLM_URL` o SDK usa essa base (`POST {LITELLM_URL}/v1/messages`); `ANTHROPIC_API_KEY` passa a
   ser a chave virtual do LiteLLM. Sem ela, a API da Anthropic. Timeout de 60 s e 2 retentativas do próprio SDK.
6. **Parâmetros para os modelos atuais.** Não envie `temperature`/`top_p`/`top_k`, `budget_tokens` nem pré-preenchimento da resposta
   (400 nos modelos 5.x); `max_tokens` padrão **1024** (o raciocínio adaptativo gasta parte); a resposta é a união dos blocos `text` (blocos
   `thinking` são ignorados). Raciocínio mais fundo ou menos custo: `effort` por tarefa, medido, não por palpite.
   **Resposta cortada ou recusada não é sucesso:** `stop_reason` `max_tokens` ou `refusal` → `gerar` lança `ErroIaResposta` (com
   `motivo`; a mensagem não traz o texto parcial), o rastreio marca erro só com o tipo (`ErroIaResposta`) e o uso real de tokens, e quem
   chama **não audita nem cobra como resultado pronto** (a rota de resumo responde **502**). Nunca devolva texto parcial como se fosse a resposta.
7. **Langfuse é opcional e invisível quando ausente.** O exportador só é registrado com `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`
   (`Segredo`) e `LANGFUSE_URL` **as três**; faltando qualquer uma, tudo é no-op (nada vai à rede). O rastreio usa um provider
   OpenTelemetry **próprio** (não registra global) e nunca derruba a chamada de IA.
8. **Só metadados por padrão (`LANGFUSE_CAPTURAR_CONTEUDO=false`).** O span leva modelo, tokens (entrada/saída/total), custo em dólares,
   duração, `user.id` e `session.id`. **Sem** prompt, resposta nem mensagem de erro (só o **tipo** do erro). Com `true`, prompt e resposta
   vão pelo `mascararTexto`: CPF (`***.456.789-**`), CNPJ, e-mail (`a***@dominio`), chaves `sk-…`/`pk-…` e `Bearer …`. Ligar `true` é decisão do
   cliente, por escrito, e vale só para o ambiente dele. O `mascararTexto` **reusa** `lgpd/mascarar.ts` (skill `lgpd-dados-pessoais`).
9. **Custo por modelo em `ia/custo.ts`** (US$ por milhão de tokens, entrada/saída, conferido em 2026-10-06): `claude-sonnet-5-5` 2/10,
   `claude-haiku-5-5` 0,10/0,50, `claude-opus-5-5` 4/20, `claude-opus-5` 5/25, `claude-fable-5-1` 10/50, `claude-sonnet-4-6` 3/15,
   `claude-haiku-4-5` 1/5 (e demais da tabela). Modelo fora da tabela → custo `null` e **um** aviso no log por modelo, nunca exceção.
   É estimativa pela tarifa cheia (cache e a faixa acima de 100 mil tokens do Haiku 5.5 não entram); com gateway, o oficial é o dele.
10. **Rota de IA segue o molde de `POST /api/ia/resumir`:** papel (`GESTOR`/`ADMIN`), checagem de origem (POST, pela skill `seguranca`), limite
    **`IA_LIMITE_POR_MIN=10`** por usuário (429 + `Retry-After`), texto de 1 a **20.000** caracteres (400 fora disso), `system` que trata o
    texto do usuário como dado (não como instrução) e **auditoria `ia.resumir` sem o conteúdo** (modelo, `usoEntrada`, `usoSaida`, `custoUsd`, `caracteres`).
    Na auditoria, não chame o campo de `tokensEntrada`: a trilha redige toda chave com "token" no nome.
11. **Langfuse self-host:** `deploy/langfuse.compose.yml` (profile `langfuse`): `langfuse-web` e `langfuse-worker` na versão **`3.227.0`**, banco
    próprio, ClickHouse `25.8-alpine`, Redis `7.4.2-alpine`, MinIO (digest fixo); **`AUTH_DISABLE_SIGNUP=true`**; painel em
    **`127.0.0.1:3100`**; todo segredo vem do ambiente **sem valor padrão** (compose recusa subir sem ele); sem telemetria.
12. **Testes (todos no modelo, sem API real):** sem chaves → nenhum exportador; `CAPTURAR_CONTEUDO=false` → span sem input/output;
    `true` → CPF e e-mail mascarados; `modeloPara('resumo')` respeita `LLM_MODELO_RESUMO`; `IA_HABILITADA=false` → "IA desabilitada neste
    ambiente"; com `LITELLM_URL` a chamada vai para a base falsa; modelo desconhecido → custo `null`; produção sem chave não sobe;
    `max_tokens`/`refusal` → `ErroIaResposta` e span de erro sem o texto; rota: 401/403/origem/400/200 com auditoria sem texto/502 sem
    auditoria/429.

## Como aplicar

Pré-requisito: skills anteriores aplicadas, na ordem do catálogo, até `fila-de-tarefas` (10; as opcionais 8 e 9 só se o sistema usa), e `pnpm test` passando. Esta skill usa
`lgpd-dados-pessoais` (`lgpd/mascarar.ts`), `trilha-auditoria` (`AuditoriaService`), `seguranca` (`LimitadorJanelaFixa`, checagem de origem),
`usuarios-e-papeis` (`@Papeis`, `UsuarioLogado`, `validarOu400`, `test/usuario-de-teste.ts`). Ao copiar um arquivo de `referencia/`, mantenha o
mesmo caminho relativo e **apague a 1ª linha** (`origem: ...`).

**Projeto no esqueleto:**

1. Dependências (versões exatas): `pnpm --filter api add -E @anthropic-ai/sdk@1.6.0 @langfuse/otel@6.1.1 @opentelemetry/api@1.9.1 @opentelemetry/core@2.12.0 @opentelemetry/sdk-trace-base@2.12.0 @opentelemetry/sdk-trace-node@2.12.0`.
   O `@opentelemetry/api` **não** pode ser 1.10 (os pacotes `sdk-trace-*` 2.12 pedem `<1.10`).
2. TDD — copie **primeiro** os testes: `apps/api/src/ia/*.spec.ts` (5 arquivos) e `apps/api/test/ia.e2e.spec.ts`. `pnpm --filter api test`: tem de falhar.
3. Código novo: `apps/api/src/ia/` inteiro (`tokens.ts`, `modelo.ts`, `custo.ts`, `mascarar-conteudo.ts`, `rastreio.ts`, `cliente-ia.ts`, `ia.service.ts`,
   `ia.controller.ts`, `ia.module.ts`).
4. Arquivos de skills anteriores — se ainda são os da etapa anterior, **substitua** pelos da referência; se outra skill mexeu neles, faça **só** a mudança descrita:
   - `apps/api/src/config/config.ts`: o bloco "IA e observabilidade" (11 variáveis: `IA_HABILITADA`, `ANTHROPIC_API_KEY`, `LITELLM_URL`, `LLM_MODELO_PADRAO`,
     `LLM_MODELO_RAPIDO`, `IA_LIMITE_POR_MIN`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_URL`, `LANGFUSE_CAPTURAR_CONTEUDO`) no fim do esquema base.
     `.env.example` e `deploy/.env.example`: o bloco "IA" do fim (`test/env-documentadas.spec.ts` exige as duas).
   - `apps/api/src/app.module.ts`: `IaModule` depois do `ArmazenamentoModule`.
5. `deploy/langfuse.compose.yml`: copie como está (a skill `instalacao-docker-compose` incorpora os serviços ao `deploy/docker-compose.yml`; veja `referencia/instalacao-langfuse.md`).
6. `pnpm lint && pnpm typecheck && pnpm test && pnpm build`: limpos (os e2e precisam do Docker para o Postgres).
7. Veja funcionando (opcional, com chave real): em `.env`, `IA_HABILITADA=true` e `ANTHROPIC_API_KEY=...`; `pnpm dev`; entre como ADMIN e rode, no navegador (console) ou
   com o cookie da sessão, `POST /api/ia/resumir` com `{ "texto": "..." }`. Para ver os traços: suba o Langfuse (`referencia/instalacao-langfuse.md`), crie as chaves do
   projeto no painel e preencha `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_URL=http://127.0.0.1:3100`.
8. Para criar uma tarefa de IA sua: injete `@Inject(CLIENTE_IA) ia: ClienteIa`, chame `ia.gerar({ tarefa: 'classificar-chamado', system, prompt, userId })`, escolha o modelo
   com `LLM_MODELO_CLASSIFICAR_CHAMADO` (ou deixe o padrão), e siga o molde da regra 10 se houver rota. Prompt com dado pessoal: envie o mínimo; a máscara do Langfuse não
   protege o que o provedor do modelo recebe.

**Projeto existente fora do esqueleto:** mantenha os **números** e o comportamento: IA desligada por padrão com a mensagem exata, falha fechada em produção, modelo por
tarefa (`LLM_MODELO_<TAREFA>`, padrões sonnet-5-5/haiku-5-5), traço só com metadados, conteúdo mascarado quando ligado, custo `null` para modelo desconhecido, limite
por usuário e auditoria sem conteúdo. Em Java use o SDK Java da Anthropic (`com.anthropic`) e o `opentelemetry-java` com o exportador OTLP do Langfuse; em Python, o `anthropic`
e o OpenTelemetry. `modelo.ts`, `custo.ts`, `mascarar-conteudo.ts` e os testes são a especificação. Registre no `CLAUDE.md` onde ficou cada coisa.

**Ao terminar:** acrescente `ia-langfuse` em "Skills Multiplica aplicadas" do `CLAUDE.md`, as variáveis novas em "Variáveis de ambiente" e, em "Regras do projeto", que
chamada de IA só passa pelo `ClienteIa`, que prompt com dado pessoal precisa de base legal e que `LANGFUSE_CAPTURAR_CONTEUDO` fica `false` salvo decisão escrita.

## Referências

Tudo que um arquivo de `referencia/` importa está em `referencia/` ou nas skills anteriores. De `novo-projeto-multiplica`: `config/config.module.ts` (`CONFIG`),
`config/segredo.ts` (`Segredo`), `test/postgres.ts`. De `usuarios-e-papeis`: `usuarios/papeis.guard.ts` (`@Papeis`), `usuarios/usuario-atual.ts`, `usuarios/usuarios.service.ts`
(`validarOu400`), `test/usuario-de-teste.ts`. De `trilha-auditoria`: `auditoria/auditoria.service.ts` (`registrar`). De `seguranca`: `seguranca/limitador.ts`
(`LimitadorJanelaFixa`, `recusarPorLimite`) e a checagem de origem. De `lgpd-dados-pessoais`: `lgpd/mascarar.ts` (`mascararCpfEmTexto`, `mascararEmail`).

- `referencia/apps/api/src/ia/cliente-ia.ts` — `criarClienteIa`, `ErroIaDesabilitada`, `exigirConfigIa` (regras 1 a 6). Leia antes de chamar o modelo.
- `.../ia/modelo.ts` — `modeloPara` (regra 4). `.../ia/custo.ts` — tabela de preços e `calcularCusto` (regra 9); leia ao adotar um modelo novo.
- `.../ia/rastreio.ts` — OpenTelemetry + Langfuse, atributos do span (regras 7 e 8). `.../ia/mascarar-conteudo.ts` — `mascararTexto` (regra 8).
- `.../ia/ia.module.ts`, `tokens.ts` — ligação ao Nest, falha fechada no boot, descarga no desligamento.
- `.../ia/ia.controller.ts`, `ia.service.ts` — o molde de rota de IA (regra 10).
- `.../ia/*.spec.ts`, `apps/api/test/ia.e2e.spec.ts` — testes (regra 12); passo 2.
- `referencia/apps/api/src/config/config.ts`, `app.module.ts`, `.env.example`, `deploy/.env.example` — versões completas dos arquivos alterados.
- `referencia/deploy/langfuse.compose.yml` — Langfuse self-host (regra 11). `referencia/instalacao-langfuse.md` — subir, criar as chaves, ligar a API e entregar à instalação.

## Checklist de pronto

- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` limpos.
- [ ] Nenhum `fetch`/`new Anthropic()` fora de `ia/cliente-ia.ts`; nenhum id de modelo nem `temperature` no código de negócio.
- [ ] `IA_HABILITADA=false` devolve "IA desabilitada neste ambiente" (503 na rota); `true` em produção sem `ANTHROPIC_API_KEY` não sobe.
- [ ] `modeloPara('resumo')` respeita `LLM_MODELO_RESUMO`; padrões `claude-sonnet-5-5` e `claude-haiku-5-5`.
- [ ] Sem as três variáveis do Langfuse, nada é enviado; com `LANGFUSE_CAPTURAR_CONTEUDO=false` o span não tem prompt nem resposta; com `true`, CPF/e-mail saem mascarados.
- [ ] Modelo fora de `custo.ts` gera custo `null` e um aviso, sem quebrar a chamada.
- [ ] Rota de IA: papel certo, origem, limite por usuário (429), tamanho máximo, auditoria sem o texto.
- [ ] `ANTHROPIC_API_KEY` e `LANGFUSE_SECRET_KEY` só como segredo (`_ARQUIVO` em produção); nada no log nem na auditoria.
- [ ] Langfuse self-host: versões fixas, `AUTH_DISABLE_SIGNUP=true`, porta em `127.0.0.1`, segredos sem padrão.
- [ ] `ia-langfuse` listada em "Skills Multiplica aplicadas" no `CLAUDE.md`.
