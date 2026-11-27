---
name: versionamento-release
description: Use quando um sistema Multiplica precisar de versão e release - "versionar", "VERSION", "SemVer", "CHANGELOG", "cortar versão", "release", "tag v1.2.3", "publicar imagem no ghcr", "workflow de release", "mostrar a versão no sistema", "versão no rodapé", "APP_VERSAO", "APP_COMMIT". Cobre o VERSION como fonte única, o CHANGELOG em português (Keep a Changelog), o scripts/release.sh (major/minor/patch, árvore limpa, branch principal em dia com o remote, commit, tag e push da tag), o release.yml em tag v* como único publicador da imagem e a versão no /api/health e no rodapé da sidebar.
---

# Versionamento e release (padrão Multiplica)

Todo sistema Multiplica tem **um** número de versão, uma lista de mudanças que o cliente entende e um comando que fecha a versão sem
passo manual esquecido. Os arquivos de `referencia/` são cópia de um projeto-modelo cujo teste (`scripts/release.test.sh`) roda o script
num repositório git temporário. Vem do CambIA (`VERSION`, `scripts/release.sh`), do beyond-credit (`CHANGELOG.md`, `release.yml`) e do
beyond-comite (`CHANGELOG.md`, versão no código). Copie e adapte; não reescreva de memória.

## Padrão Multiplica

1. **`VERSION` na raiz é a fonte**: uma linha `MAJOR.MINOR.PATCH` (SemVer, sem `v`). MAJOR quebra compatibilidade e exige ação do cliente;
   MINOR é funcionalidade nova; PATCH é correção. Todo `package.json` versionado (menos `estagios/`) leva o mesmo número.
2. **`CHANGELOG.md` na raiz, em português, Keep a Changelog**: seção `## [Não publicado]` no topo e, abaixo, `## [X.Y.Z] - AAAA-MM-DD`
   (mais novas primeiro). Grupos: Adicionado, Alterado, Corrigido, Removido, Segurança. Quem entrega algo anota em "Não publicado"
   **no mesmo PR**; texto para o cliente ("Exportação em Excel nos relatórios"), não para o programador ("refactor do service").
3. **`scripts/release.sh <major|minor|patch>`** (bash ≥ 3.2: Linux, macOS de fábrica, Git Bash no Windows) confere **antes de alterar
   qualquer arquivo**: árvore limpa (inclusive arquivo novo sem commit), branch `main` ou `master`, branch **em dia com o remote**
   (`git fetch` e recusa se está atrás ou divergiu de `@{u}`; sem upstream, só `--local`/`--dry-run` rodam), `VERSION` válido, tag
   `vX.Y.Z` ainda inexistente e "Não publicado" com conteúdo. Qualquer falha aborta com mensagem em português e **sem mudar nada**.
4. Depois das conferências, o script, nesta ordem: grava o número em `VERSION` e nos `package.json`; move "Não publicado" para
   `## [X.Y.Z] - data` (deixando "Não publicado" vazio); `git commit` com a mensagem `chore(release): vX.Y.Z`; tag anotada `vX.Y.Z`;
   `git push <remote> <branch> vX.Y.Z`. **Um publicador só por imagem: o script nunca faz `docker push`**; quem publica é o
   `release.yml` (regra 7), disparado pela tag. Falhou o push: nada saiu da máquina e a mensagem diz como repetir ou desfazer
   (`git tag -d vX.Y.Z && git reset --hard HEAD~1`).
5. **Imagem sempre com a tag da versão, nunca `latest`** (é o que o `deploy/docker-compose.yml` da `instalacao-docker-compose` usa:
   `${APP_IMAGEM}:${APP_VERSAO}`), publicada como `ghcr.io/<org>/<app>` (minúsculas) só pelo workflow.
6. **Opções de teste e segurança**: `--dry-run` só mostra o que faria; `--local` faz commit e tag e **para** (sem push);
   `--testar-imagem` faz um `docker build` **local** de prova antes do push (nunca publica; falhou, nada foi enviado). O teste roda em
   repositórios temporários com um remote de mentira (pasta bare) e um `docker` falso: nunca publica nem mexe no seu projeto.
7. **`.github/workflows/release.yml`** dispara em tag `v*`: confere que a tag é o `VERSION`, que o commit está na branch principal e
   que o `CHANGELOG.md` tem a seção da versão; publica `ghcr.io/<org>/<app>:X.Y.Z` com `APP_VERSAO` e `APP_COMMIT`; cria a Release do
   GitHub com as notas daquela seção. Permissões mínimas (`contents: write`, `packages: write`); actions **fixadas pelo SHA** do
   commit, como no `ci.yml` da skill `seguranca` (o CI roda no merge; o release não repete lint nem testes).
8. **A versão aparece onde as pessoas olham**: `APP_VERSAO` e `APP_COMMIT` entram no build (build-args do `Dockerfile` da
   `instalacao-docker-compose` viram `ENV`), o schema de config os valida (`^[A-Za-z0-9._+-]{1,64}$`, padrão `dev` e `desconhecido`),
   `/api/health` devolve `versao` e `commit` e o rodapé da sidebar (`AppShell`, skill `identidade-visual`) mostra `v{versao}`. Em
   desenvolvimento aparece `vdev`; versão real só em imagem construída pelo release.
9. **`.gitattributes`** com `*.sh text eol=lf`: no Windows, `.sh` com CRLF quebra (`\r: command not found`).
10. **Testes** (`scripts/release.test.sh`, 51 verificações): `patch` em `1.4.0` → `1.4.1` em `VERSION` e em todos os `package.json`
    (sem tocar dependências nem `node_modules`), `## [1.4.1] - <data>` com a entrada movida, tag criada no commit de release, árvore
    limpa depois; `minor`/`major`; árvore suja, arquivo novo, branch de feature, changelog vazio e tag existente abortam **sem mudar
    nada**; `--dry-run` não altera; tipo inválido aborta; modo padrão envia branch e tag ao `origin` sem chamar `docker`;
    `--testar-imagem` só faz `docker build`; branch atrás do remote e falta de upstream abortam sem mudar nada.

## Como aplicar

Pré-requisito: esqueleto aplicado e, para a imagem, a skill `instalacao-docker-compose` (o `Dockerfile` com `APP_VERSAO`/`APP_COMMIT`).
Não copie nada dessas skills: `config.ts` (`APP_VERSAO`, `APP_COMMIT`), `saude.controller.ts` e `AppShell.tsx` já fazem a parte da versão
no esqueleto. Ao copiar de `referencia/`, mantenha o caminho e **apague a 1ª linha** (`origem:`); no `.sh`, o `#!/usr/bin/env bash` é a 2ª linha e vira a 1ª.

**Projeto no esqueleto:**

1. TDD: copie **primeiro** `scripts/release.test.sh`; `bash scripts/release.test.sh` falha (falta `scripts/release.sh`).
2. Copie `scripts/release.sh`; o teste passa (`51/51 verificações passaram`). `chmod +x scripts/*.sh` (no Windows basta chamar com `bash`).
3. Crie `VERSION` e `CHANGELOG.md` a partir dos blocos de `referencia/modelos.md` (número inicial `0.1.0`, ou o da versão em produção; ajuste
   a data e o texto da primeira entrada). Se os `package.json` estão em outro número, alinhe-os com `VERSION` num commit à parte.
4. Copie `.gitattributes` (se o projeto já tem um, acrescente só a linha `*.sh text eol=lf`) e `.github/workflows/release.yml`.
5. Confira que `GET /api/health` devolve `versao`/`commit` e o rodapé mostra `v{versao}` (já vem do esqueleto); `pnpm lint && pnpm typecheck && pnpm test`.
6. Ensaio: `bash scripts/release.sh patch --dry-run`. Release real: tudo commitado na branch principal (em dia com o `origin`), "Não
   publicado" preenchido, `bash scripts/release.sh patch` (ou `patch --testar-imagem` para buildar antes de enviar). A imagem sai pelo
   workflow Release (aba Actions); só depois dele terminar a TI troca o `APP_VERSAO`.
7. No GitHub, em Settings → Actions, deixe o `GITHUB_TOKEN` com permissão de escrita em pacotes, e **ligue o pacote ao repositório**
   (primeira publicação) para a TI poder baixar a imagem; imagem privada exige `docker login ghcr.io` no servidor do cliente.

**Projeto existente fora do esqueleto:** mantenha os **valores**: `VERSION` como fonte; `CHANGELOG.md` em português; mesma ordem de
conferências e de passos (nada alterado antes de passar tudo; push por último); tag `vX.Y.Z`; a imagem publicada só pelo CI (um
publicador por tag), com tag da versão e
versão/commit embutidos no build e visíveis no health e na interface. Em Java troque a edição de `package.json` por `pom.xml`/`build.gradle`
(só o `<version>` do projeto, não o do parent) e leia a versão do `VERSION` ou do `MANIFEST`; em Python, o `pyproject.toml`. Registre no `CLAUDE.md`.

**Ao terminar:** no `CLAUDE.md`, acrescente `versionamento-release` em "Skills Multiplica aplicadas", em "Comandos" `bash scripts/release.sh <patch|minor|major>`
e `bash scripts/release.test.sh`, e em "Regras do projeto": toda entrega anota em "Não publicado" do `CHANGELOG.md`; versão só sai por `release.sh`
(nunca editar `VERSION` à mão nem criar tag manual); imagem sempre por tag de versão.

## Referências

Usados sem cópia: `config/config.ts` (`APP_VERSAO`, `APP_COMMIT`), `saude/saude.controller.ts` e `RespostaSaude` em `packages/contratos`
(esqueleto); `Dockerfile` (skill `instalacao-docker-compose`); `componentes/AppShell.tsx` (skill `identidade-visual`);
`.github/workflows/ci.yml` (skill `seguranca`).

- `referencia/scripts/release.sh` — o script (regras 3 a 6). Leia antes de mudar a ordem dos passos.
- `referencia/scripts/release.test.sh` — o teste num repositório temporário (regra 10). Copie primeiro.
- `referencia/.github/workflows/release.yml` — release em tag `v*` (regra 7).
- `referencia/.gitattributes` — fim de linha LF dos `.sh` (regra 9).
- `referencia/modelos.md` — blocos de `VERSION` e `CHANGELOG.md` (regras 1 e 2).

## Checklist de pronto

- [ ] `bash scripts/release.test.sh` termina com todas as verificações passando; `pnpm lint`, `pnpm typecheck`, `pnpm test` limpos.
- [ ] `VERSION` igual à versão de todos os `package.json`; `CHANGELOG.md` com "Não publicado" no topo e versões datadas.
- [ ] `release.sh --dry-run` mostra a versão nova e não altera nada; com árvore suja, aborta sem mudar nada.
- [ ] Release real (ou com `--local` em cópia do projeto) cria o commit `chore(release): vX.Y.Z` e a tag `vX.Y.Z`.
- [ ] Imagem publicada como `ghcr.io/<org>/<app>:X.Y.Z` (nunca `latest`); `docker run` dela mostra `versao` e `commit` no `/api/health`.
- [ ] `release.yml` com actions fixadas por SHA e permissões mínimas; o pacote do ghcr.io está ligado ao repositório.
- [ ] Rodapé da sidebar mostra `vX.Y.Z`.
- [ ] `versionamento-release` listada em "Skills Multiplica aplicadas" no `CLAUDE.md`.
