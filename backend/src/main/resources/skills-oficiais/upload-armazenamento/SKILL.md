---
name: upload-armazenamento
description: Use quando um sistema Multiplica precisar receber, guardar e entregar arquivos enviados por usuários — upload de PDF, imagem (PNG, JPEG) ou planilha (.xlsx), anexo em cadastro, limite de tamanho do arquivo (erro 413), recusar .exe renomeado para .pdf (erro 415), nome de arquivo do cliente que vira caminho (path traversal, ../../), guardar em pasta do servidor, S3, MinIO ou Azure Blob, link de download temporário (URL assinada), arquivo que só o dono ou o gestor pode ver, antivírus ClamAV e proteção contra XSS armazenado por SVG ou HTML enviado. Cobre a interface Armazenamento, limitarTamanho, validarTipo por assinatura de bytes, ArquivosService, a tabela arquivo, a auditoria arquivo.enviar/baixar/remover e o componente EnviarArquivo.
---

# Upload e armazenamento Multiplica

Todo arquivo enviado por usuário entra e sai do mesmo jeito: a API lê o corpo **em fluxo** com teto de tamanho, descobre o **tipo pelos bytes**
(nunca pelo nome nem pelo `Content-Type`), grava sob uma **chave sorteada no servidor**, guarda os metadados com **dono e escopo** e entrega
**sempre como anexo**. O código de `referencia/` é cópia de um projeto-modelo que compila e passa nos testes (Postgres, MinIO, Azurite e um
ClamAV de verdade): copie e adapte, não reescreva de memória. Vem de Comitê (`storage.interface.ts`, `limitar-tamanho-stream.ts`),
BeyondCredit (`documents/storage`), FinAnalytics (`object-storage.ts`) e CONECTA (antivírus ClamAV). **Cada valor abaixo é fixo**; mudar um
deles é decisão registrada no `CLAUDE.md`.

## Padrão Multiplica

1. **Interface única.** `Armazenamento { salvar(chave, stream, tipo); abrir(chave); urlAssinada(chave, segundos, opcoes?); remover(chave) }`
   com `ArmazenamentoLocal`, `ArmazenamentoS3` (AWS, MinIO, R2) e `ArmazenamentoAzure`, escolhidos por `ARMAZENAMENTO_TIPO=local|s3|azure`
   (padrão `local`). Quem usa só conhece a interface (token `ARMAZENAMENTO`). `remover` de chave inexistente não é erro; `abrir` de inexistente lança.
2. **Chave só do servidor.** `gerarChave(extensao)` = `<uuid v4>.<pdf|png|jpg|xlsx>`. Toda implementação chama `exigirChaveValida` ANTES de tocar
   disco ou rede: `../../x.pdf`, `a/b.pdf`, `x.exe` lançam. O nome do cliente nunca vira caminho: fica só em `arquivo.nome_original`, como texto de
   exibição (sem caminho, sem controle, sem `<` `>`, até 150 caracteres, extensão trocada pela do tipo detectado: `virus.exe` com PDF dentro vira `virus.pdf`).
3. **Tipo pelos bytes.** `validarTipo(cabecalho)` olha os primeiros 16 KB: PDF (`%PDF-x.y`), PNG (8 bytes), JPEG (`FF D8 FF`), XLSX (ZIP cuja 1ª
   entrada é `[Content_Types].xml`, com entradas `xl/` e sem `word/`, `ppt/` nem `vbaProject`). **SVG, HTML, executável e Office com macro são
   recusados** (415, nada gravado). O `Content-Type` e a extensão declarados pelo cliente são ignorados. É checagem de formato, não de segurança do conteúdo.
4. **Tamanho em fluxo.** `UPLOAD_MAX_MB` (padrão **10**, de 1 a 500). `limitarTamanho(stream, bytes)` conta os bytes que de fato chegam e falha no
   primeiro acima do limite (413, nada gravado, origem destruída): não confia em `Content-Length` (chunked não declara). Antes de ler, `Content-Length`
   declarado acima do limite + 256 KB já dá 413. O arquivo nunca é carregado inteiro na memória: busboy → `limitarTamanho` → `lerCabecalho` (16 KB) → `salvar`.
   Upload que falha no meio não deixa objeto (local: temporário `.tmp-` + rename; S3: upload em partes abortado; Azure: blocos não confirmados).
5. **Metadados e dono.** Tabela `arquivo` (`id`, `chave` única, `nome_original`, `tipo`, `tamanho`, `dono_id`, `escopo`, `varredura`, `criado_em`, `removido_em`).
   `escopo` = `PRIVADO` (dono e ADMIN) ou `GESTAO` (também todo GESTOR). `podeVer`/`podeRemover` em `arquivos.service.ts` são a ÚNICA regra, usada na lista
   (SQL) e no acesso: remover é só do dono ou ADMIN. Arquivo que o usuário não pode ver responde **404** (igual a inexistente). A API nunca devolve `chave`.
6. **Autenticado, com origem e limite.** Rotas com `@Papeis('ADMIN','GESTOR','USUARIO')` e `exigirPapel` no serviço; `POST`/`DELETE` passam pela checagem de
   origem da skill `seguranca` (outro site → 403); o download é `@MesmaOrigem()`. Limite por usuário `UPLOAD_LIMITE_POR_MIN` (padrão **20**, acima: 429 com `Retry-After`),
   além do limite por IP da `/api`.
7. **Auditoria.** `arquivo.enviar` (nome, tipo, tamanho, escopo, varredura), `arquivo.baixar` (`via`: `api`, `link` ou `link_local`), `arquivo.remover` e
   `arquivo.bloquear` (antivírus achou ameaça). O evento de envio nasce na mesma transação da linha; o de download é gravado ANTES do primeiro byte (trilha
   falhou, nada é enviado); recusa (404/403) não deixa evento de download. Nunca vai caminho nem conteúdo. Em S3/Azure o navegador baixa direto do provedor:
   a auditoria é a da emissão do link.
8. **Entrega sempre como anexo.** `Content-Type` do tipo detectado, `Content-Disposition: attachment` por `contentDisposition(nome)` (skill
   `exportacao-excel-pdf-csv`), `X-Content-Type-Options: nosniff`, `Content-Security-Policy: sandbox; default-src 'none'`, `Cache-Control: private, no-store`.
   **Nunca inline no domínio do app**: um arquivo enviado não roda ali (XSS armazenado). Imagem na tela? Baixe por `fetch` + `URL.createObjectURL`, não por link direto.
9. **Link assinado.** `POST /api/arquivos/:id/link` → `{ url, expiraEm }`, validade `URL_ASSINADA_SEGUNDOS` (padrão **300**, de 10 a 3600). S3/Azure: URL do
   provedor (presigned/SAS de leitura de UM objeto, com `Content-Disposition: attachment`). Local: `/api/arquivos/assinado/<chave>?exp=<unix>&sig=<hmac>`, HMAC-SHA256
   de `chave\nexp` com `ARMAZENAMENTO_SEGREDO_URL` (Segredo, mínimo 32 caracteres), comparação em tempo constante; sem sessão (vale a assinatura), mas o arquivo tem de
   existir e não estar removido. **Falha fechada**: em produção com `local` sem o segredo a API não sobe (só `NODE_ENV` development/test declarados geram um aleatório).
10. **Antivírus opcional.** `ANTIVIRUS_HABILITADO=true` liga o ClamAV (`CLAMAV_HOST` padrão `clamav`, `CLAMAV_PORTA` 3310; profile `antivirus` no compose, imagem
    `clamav/clamav:1.4.6`). O objeto é gravado, varrido pelo protocolo INSTREAM (em fluxo) e só então ganha a linha em `arquivo`: **sem linha o objeto é inalcançável (quarentena)**.
    Ameaça → 422 + objeto apagado + `arquivo.bloquear`. **Falha fechada**: ClamAV fora do ar, tempo esgotado (60 s) ou resposta de erro → 503, objeto apagado, nada fica.
    O `StreamMaxLength` do clamd tem de ser maior que `UPLOAD_MAX_MB` (o compose usa 600M), senão todo arquivo grande é recusado. Desligado, a linha leva `varredura = NAO_VARRIDO`.
11. **Respostas.** `POST /api/arquivos` (multipart: campo `escopo` ANTES do campo `arquivo`; um arquivo por vez) → 201 com `{ id, nome, tipo, tamanho, escopo, donoId, varredura, criadoEm }`;
    400 (sem arquivo, escopo inválido, mais de um arquivo), 401, 413, 415, 422, 429, 503. `GET /api/arquivos` (até 200, só os visíveis), `GET /api/arquivos/:id/download`,
    `POST /api/arquivos/:id/link`, `DELETE /api/arquivos/:id` (204; some da lista, o objeto sai do armazenamento, a linha fica marcada `removido_em`).
12. **Corpo e proxy (entrega à skill de instalação).** O limite de JSON do Express não vale para multipart; o teto do upload é `UPLOAD_MAX_MB`. O Caddy precisa de
    `request_body { max_size <UPLOAD_MAX_MB + 2>MB }` (nginx: `client_max_body_size`), volume para a pasta local, segredo do link e o serviço ClamAV: tudo em `referencia/instalacao-upload.md`.
13. **Riscos que sobram (aceitos).** Assinatura de bytes não prova que o PDF/XLSX é inofensivo (por isso anexo + antivírus opcional); ZIP é identificado pelas primeiras entradas
    (XLSX forjado com essas entradas passa e vai como anexo); objeto órfão se o processo morrer entre gravar e inserir a linha (vai para o log quando a limpeza falha; faça uma faxina
    periódica de objetos sem linha); o limite por usuário é em memória da instância; link assinado vale para quem o tiver até expirar.

## Como aplicar

Pré-requisito: esqueleto da skill `novo-projeto-multiplica` e as skills `identidade-visual`, `seguranca`, `email-transacional`, `usuarios-e-papeis`, `login-codigo-email`,
`trilha-auditoria`, `lgpd-dados-pessoais` e `exportacao-excel-pdf-csv` aplicadas (nesta ordem), com `pnpm test` passando. Ao copiar um arquivo de `referencia/`, mantenha o
mesmo caminho relativo e **apague a 1ª linha** (`origem: ...`).

**Projeto no esqueleto:**

1. Dependências em `apps/api` (versões exatas): `pnpm --filter api add -E busboy@1.6.0 @aws-sdk/client-s3@3.1163.0 @aws-sdk/lib-storage@3.1163.0 @aws-sdk/s3-request-presigner@3.1163.0 @azure/storage-blob@12.34.0`
   e `pnpm --filter api add -D -E @types/busboy@1.5.5 @testcontainers/minio@12.2.1 @testcontainers/azurite@12.2.1`. Se o projeto só usa um provedor, tire os pacotes e a classe dos outros.
2. TDD, API — copie **primeiro** os testes: em `apps/api/src/armazenamento/` os `*.spec.ts` (`tipos`, `limitar-tamanho`, `url-assinada`, `armazenamento-local`, `antivirus`,
   `armazenamento-s3`, `armazenamento-azure`, `config-armazenamento`, `antivirus-clamav-real`), `apps/api/test/clamd-falso.ts` e `apps/api/test/arquivos.e2e.spec.ts`. `pnpm --filter api test`: tem de falhar.
3. Código: copie `apps/api/src/armazenamento/` inteiro (`armazenamento.ts`, `chave.ts`, `tipos.ts`, `limitar-tamanho.ts`, `url-assinada.ts`, `nome-arquivo.ts`, `armazenamento-local.ts`,
   `armazenamento-s3.ts`, `armazenamento-azure.ts`, `antivirus.ts`, `receber-upload.ts`, `arquivo.tabela.ts`, `arquivos.service.ts`, `arquivos.controller.ts`, `fabrica.ts`, `armazenamento.module.ts`).
4. Arquivos de skills anteriores — se ainda são os da etapa anterior, **substitua** pelos da referência; se outra skill mexeu neles, faça **só** a mudança descrita:
   - `apps/api/src/config/config.ts`: o bloco "Upload e armazenamento" (`ARMAZENAMENTO_*`, `UPLOAD_*`, `URL_ASSINADA_SEGUNDOS`, `S3_*`, `AZURE_*`, `ANTIVIRUS_HABILITADO`, `CLAMAV_*`) no fim do esquema
     base e as regras do `superRefine` (`s3` exige bucket e chaves; `azure` exige connection string e container). `.env.example` e `deploy/.env.example`: o bloco "Upload e armazenamento" do fim.
   - `apps/api/test/auth.e2e.spec.ts`: `ARMAZENAMENTO_SEGREDO_URL` na config `PRODUCAO` (produção com armazenamento local sem o segredo não sobe).
   - `apps/api/src/app.module.ts`: `ArmazenamentoModule` depois do `ClientesModule`. `apps/api/src/banco/esquema.ts`: `export * from '../armazenamento/arquivo.tabela'`.
   - `docker-compose.yml` (dev): o serviço `clamav` com `profiles: ["antivirus"]`, o volume `clamav_dev` e o `StreamMaxLength`.
   - Migração: `pnpm --filter api db:generate -- --name=arquivo` (ver `referencia/migracao-arquivo.md`) e `pnpm --filter api db:migrate`.
5. `pnpm --filter api test` passa (precisa do Docker: Postgres, MinIO e Azurite sobem sozinhos). O ClamAV de verdade é opcional: `docker compose --profile antivirus up -d clamav`, espere o `healthy` e rode
   `CLAMAV_PORTA_TESTE=3310 pnpm --filter api exec vitest run antivirus-clamav-real`.
6. TDD, web — copie `apps/web/src/componentes/EnviarArquivo.test.tsx` (falha), depois `apps/web/src/lib/arquivos-api.ts` e `componentes/EnviarArquivo.tsx`; use `<EnviarArquivo maxMb={10} onEnviado={recarregar} />` na tela
   (o `maxMb` é o `UPLOAD_MAX_MB` da API). Para listar e baixar, siga o padrão de `lib/exportar-api.ts` (`salvarArquivo`) chamando `/api/arquivos` e `/api/arquivos/:id/download`.
7. `pnpm lint && pnpm typecheck && pnpm test && pnpm build`: tudo limpo.
8. Veja funcionando: `docker compose up -d postgres`, `pnpm --filter api db:migrate`, `pnpm dev`, envie um PDF pela tela, confirme a pasta `dados/arquivos` (só nomes uuid), tente enviar um `.exe` renomeado (415) e um arquivo
   acima do limite (413), baixe como outro usuário (404) e veja `arquivo.enviar`/`arquivo.baixar` em Admin → Auditoria.
9. Para guardar arquivo em outro recurso (ex.: anexo de um cliente): injete `ArquivosService` e guarde o `arquivo.id` na tabela do recurso; **a regra de quem acessa o recurso vale também para o arquivo** (confira o recurso antes de
   chamar `baixar`). Não crie outra rota de upload nem outro `salvar`: tudo passa por `ArquivosService.enviar`.
10. Produção: entregue `referencia/instalacao-upload.md` à skill `instalacao-docker-compose` (Caddy `max_size`, volume, segredo do link, ClamAV).

**Projeto existente fora do esqueleto:** mantenha os mesmos valores. `chave.ts`, `tipos.ts`, `limitar-tamanho.ts`, `url-assinada.ts`, `nome-arquivo.ts` e `antivirus.ts` não dependem de Nest: copie-os. Em Java use
Commons FileUpload com `Streaming API`, Tika só com `detect` por bytes; em Python, `python-magic` e `clamd`; os **números** (10 MB, 20 por minuto, 300 s, chave uuid, anexo + nosniff, 404 para o que não pode ver, falha fechada do
antivírus) valem em qualquer stack. Registre no `CLAUDE.md` onde ficou cada coisa.

**Ao terminar:** acrescente `upload-armazenamento` em "Skills Multiplica aplicadas" do `CLAUDE.md`, as variáveis novas em "Variáveis de ambiente" e, em "Regras do projeto", que todo arquivo enviado passa pelo `ArquivosService`
(tipo pelos bytes, nome gerado no servidor, entrega como anexo).

## Referências

Tudo que um arquivo de `referencia/` importa está em `referencia/` ou nas skills anteriores. De `novo-projeto-multiplica`: `config/config.module.ts` (`CONFIG`), `banco/banco.ts` (`BANCO`), `test/postgres.ts`. De `seguranca`:
`seguranca/limitador.ts` (`LimitadorJanelaFixa`, `recusarPorLimite`) e `seguranca/origem.guard.ts` (`MesmaOrigem`). De `usuarios-e-papeis`: `usuarios/papeis.guard.ts`, `usuarios/usuario-atual.ts`, `usuarios/usuario.tabela.ts`,
`test/usuario-de-teste.ts`. De `trilha-auditoria`: `usuarios/usuarios.service.ts` (`validarOu400`). De `exportacao-excel-pdf-csv`: `auditoria/auditoria.service.ts` (`registrar(evento, tx)`) e `exportacao/content-disposition.ts` (`contentDisposition`). De
`identidade-visual`: o `Button` e as classes de `Campo.tsx`; de `exportacao-excel-pdf-csv`, `lib/exportar-api.ts`.

- `referencia/apps/api/src/armazenamento/armazenamento.ts`, `chave.ts` — interface e chave do servidor. Leia antes de qualquer implementação.
- `.../tipos.ts`, `limitar-tamanho.ts`, `nome-arquivo.ts`, `receber-upload.ts` — validação, teto em fluxo, nome seguro, multipart. Leia ao mexer em tipos aceitos ou limites.
- `.../armazenamento-local.ts`, `url-assinada.ts`, `armazenamento-s3.ts`, `armazenamento-azure.ts`, `fabrica.ts` — provedores e o segredo do link. Leia ao trocar de provedor.
- `.../antivirus.ts` e `apps/api/test/clamd-falso.ts` — cliente INSTREAM e o clamd falso dos testes.
- `.../arquivo.tabela.ts`, `arquivos.service.ts`, `arquivos.controller.ts`, `armazenamento.module.ts` — regras de dono/escopo, auditoria e rotas.
- `referencia/apps/api/src/config/config.ts`, `app.module.ts`, `banco/esquema.ts`, `test/auth.e2e.spec.ts`, `.env.example`, `deploy/.env.example`, `docker-compose.yml` — versões completas dos arquivos alterados.
- `referencia/migracao-arquivo.md` — a migração. `referencia/instalacao-upload.md` — Caddy, volume, segredo e ClamAV para a skill de instalação.
- `referencia/apps/web/src/componentes/EnviarArquivo.tsx`, `lib/arquivos-api.ts` (+ teste) — envio na tela.

## Checklist de pronto

- [ ] `.exe` renomeado para `.pdf` → 415; SVG e HTML → 415; nada gravado.
- [ ] Arquivo acima de `UPLOAD_MAX_MB` → 413 sem gravar (com e sem `Content-Length`); exatamente no limite passa.
- [ ] `../../x.pdf` é gravado sob `<uuid>.pdf`; o nome fica só como metadado.
- [ ] Outro usuário e GESTOR (em arquivo `PRIVADO`) recebem 404; remover só dono/ADMIN.
- [ ] Download com `attachment`, `nosniff`, CSP `sandbox` e `no-store`; nenhum arquivo servido inline.
- [ ] Link assinado: adulterado, expirado ou de arquivo removido não baixa; `ARMAZENAMENTO_SEGREDO_URL` obrigatório em produção.
- [ ] `arquivo.enviar`, `arquivo.baixar` e `arquivo.remover` na auditoria, sem caminho nem conteúdo.
- [ ] Limite por usuário (429) e origem de outro site (403) testados.
- [ ] Com antivírus: EICAR → 422 e nada guardado; ClamAV fora do ar → 503 e nada guardado.
- [ ] MinIO/S3 e Azurite (se usados) passam nos testes; bucket/container privado.
- [ ] Caddy com `request_body max_size` e volume do armazenamento entregues à skill de instalação.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` limpos; `CLAUDE.md` atualizado.
