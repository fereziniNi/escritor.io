# Tutorial — IA com Claude e rastreio no Langfuse

## Passos comuns

1. No escritor.io, abra o painel **Skills** e baixe o `.zip` da skill **ia-langfuse**.
2. Extraia o zip em `<seu-projeto>/.claude/skills/` (vale para todos que usam o projeto) ou em `~/.claude/skills/`
   (só para você). Deve ficar `.claude/skills/ia-langfuse/SKILL.md`.
3. Abra o Claude Code na pasta do projeto e confira que a skill aparece (digite `/skills`).
4. Cole o prompt de uso da skill.

## Parte específica desta skill

### Como funciona para quem usa o sistema

A IA fica **desligada** em cada ambiente até alguém da TI ligá-la. Ligada, gestores e administradores ganham recursos como "resumir este texto". Cada uso fica
registrado na trilha de auditoria (quem, quando, qual modelo, quanto custou), **sem guardar o texto**. O painel Langfuse (opcional) mostra custo e tempo de cada chamada;
por padrão ele **não** recebe o conteúdo dos textos.

### Pré-requisitos

| Ferramenta | Versão | Como conferir |
|---|---|---|
| Esqueleto do projeto | skills `novo-projeto-multiplica` até `fila-de-tarefas` já aplicadas | `ls apps/api/src/fila` ou `dir apps\api\src\fila` |
| Node.js | 22.22 ou mais nova | `node --version` |
| pnpm | 9.15.4 | `pnpm --version` |
| Docker | qualquer versão recente (Postgres dos testes; Langfuse opcional) | `docker version` |
| Chave da API da Anthropic | só para usar de verdade (os testes não precisam) | console da Anthropic ou chave virtual do LiteLLM da empresa |

### Variáveis de ambiente

| Nome | Obrigatória | Exemplo | Para que serve |
|---|---|---|---|
| `IA_HABILITADA` | não (padrão `false`) | `true` | liga a IA no ambiente; desligada, toda chamada responde "IA desabilitada neste ambiente" |
| `ANTHROPIC_API_KEY` | em produção com a IA ligada | `(segredo; use ANTHROPIC_API_KEY_ARQUIVO)` | chave da API (ou chave virtual do LiteLLM) |
| `LITELLM_URL` | não | `https://litellm.grupomultiplica.com.br` | gateway LiteLLM; as chamadas vão para ele |
| `LLM_MODELO_PADRAO` / `LLM_MODELO_RAPIDO` | não | `claude-sonnet-5-5` / `claude-haiku-5-5` | modelo das tarefas comuns e das rápidas |
| `LLM_MODELO_<TAREFA>` | não | `LLM_MODELO_RESUMO=claude-opus-5-5` | modelo de uma tarefa específica |
| `IA_LIMITE_POR_MIN` | não (padrão 10) | `10` | pedidos de IA por minuto por usuário |
| `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_URL` | não (as três juntas) | `pk-lf-...`, `sk-lf-...`, `http://127.0.0.1:3100` | envia os traços ao Langfuse |
| `LANGFUSE_CAPTURAR_CONTEUDO` | não (padrão `false`) | `false` | `true` envia também prompt e resposta, com CPF, CNPJ, e-mail e chaves mascarados |

### Dependências

Seis pacotes novos na API (versões exatas, o Claude Code instala): `@anthropic-ai/sdk`, `@langfuse/otel` e quatro do OpenTelemetry. Serviços novos só se for usar o Langfuse
local: o arquivo `deploy/langfuse.compose.yml` (profile `langfuse`) sobe o painel, o worker e os bancos dele.

### Como verificar que funcionou

1. Abra um terminal **na pasta do projeto** (no VS Code: menu Terminal → Novo terminal; no Windows também serve o PowerShell).
2. Rode `pnpm install`, depois `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build`. Todos terminam sem erro (o Docker precisa estar aberto: os testes sobem um
   Postgres temporário; nenhum teste chama a API real nem gasta dinheiro).
3. Veja de verdade (opcional, gasta centavos): no arquivo `.env` ponha `IA_HABILITADA=true` e `ANTHROPIC_API_KEY=sua-chave`, depois, em bash, Git Bash, macOS, Linux ou PowerShell:
   ```bash
   docker compose up -d postgres mailpit
   pnpm --filter api db:migrate
   pnpm dev
   ```
   Entre como administrador e use a tela/rota de resumo (`POST /api/ia/resumir`). Na tela de auditoria aparece o evento `ia.resumir` com modelo e custo, sem o texto.
4. Para ver os traços, siga `referencia/instalacao-langfuse.md`: suba o Langfuse, entre em http://127.0.0.1:3100, crie as chaves do projeto, ponha-as no `.env` e reinicie a API.
   Cada resumo aparece como uma "generation" com tokens, custo e tempo.
5. Teste a trava: com `IA_HABILITADA=false` (ou sem a variável), o mesmo pedido responde 503 "IA desabilitada neste ambiente".

### Se não funcionar

- **503 "IA desabilitada neste ambiente"**: a variável `IA_HABILITADA` não está `true` nesse ambiente. É o comportamento esperado até alguém ligar.
- **A API não sobe em produção e o erro cita `ANTHROPIC_API_KEY`**: a IA está ligada sem chave. Defina a chave (ou `ANTHROPIC_API_KEY_ARQUIVO`) ou desligue a IA.
- **Erro 401/403 vindo da IA**: chave errada, vencida ou sem acesso ao modelo; com LiteLLM, confira se a chave virtual tem esse modelo liberado.
- **Erro 429 na rota**: passou de `IA_LIMITE_POR_MIN` pedidos no minuto; espere o tempo de `Retry-After`.
- **O custo aparece vazio**: o modelo não está na tabela `ia/custo.ts`; acrescente a linha com o preço oficial. A chamada funciona normalmente.
- **O Langfuse não recebe nada**: confira as três variáveis `LANGFUSE_*` (faltando uma, nada é enviado) e se `LANGFUSE_URL` é alcançável de onde a API roda; dentro do compose use `http://langfuse-web:3000`.
- **`pnpm install` reclama de `@opentelemetry/api`**: use a versão `1.9.1` exata, não a 1.10.
- **Quero ver o texto no Langfuse**: ponha `LANGFUSE_CAPTURAR_CONTEUDO=true` só se o cliente autorizou por escrito; o texto vai mascarado (CPF, CNPJ, e-mail, chaves).

Próximo passo: seguir a ordem de skills indicada pelo Claude Code.
