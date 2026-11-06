# Tutorial — Versionamento e release

## Passos comuns

1. No escritor.io, abra o painel **Skills** e baixe o `.zip` da skill **versionamento-release**.
2. Extraia o zip em `<seu-projeto>/.claude/skills/` (vale para todos que usam o projeto) ou em `~/.claude/skills/`
   (só para você). Deve ficar `.claude/skills/versionamento-release/SKILL.md`.
3. Abra o Claude Code na pasta do projeto e confira que a skill aparece (digite `/skills`).
4. Cole o prompt de uso da skill.

## Parte específica desta skill

### O que ela entrega

Um jeito único e repetível de "fechar uma versão": o número fica no arquivo `VERSION`, as novidades ficam no `CHANGELOG.md` (em
português) e o comando `scripts/release.sh patch` (ou `minor`, ou `major`) atualiza todos os números, registra no changelog, cria a
marca (tag) no git e publica a imagem do sistema com aquele número. O número aparece em `/api/health` e no rodapé do menu lateral, então
quem usa o sistema e quem faz o suporte sabem qual versão está no ar.

### Pré-requisitos

| Ferramenta | Versão | Como conferir |
|---|---|---|
| Esqueleto do projeto | skills `novo-projeto-multiplica` e `instalacao-docker-compose` aplicadas | `ls Dockerfile` ou `dir Dockerfile` |
| Git | qualquer recente, repositório com remote `origin` no GitHub | `git remote -v` |
| Node.js | 22.22 ou mais nova | `node --version` |
| Bash | no Windows, o que vem com o Git (**Git Bash**); o script não roda no PowerShell puro | `bash --version` |
| Docker | aberto, com `docker login ghcr.io` feito (token com permissão `write:packages`) | `docker version` |

### Variáveis de ambiente

| Nome | Obrigatória | Exemplo | Para que serve |
|---|---|---|---|
| `APP_VERSAO` | não (`dev`) | `1.4.1` | versão gravada no build da imagem; vai para `/api/health` e para o rodapé |
| `APP_COMMIT` | não (`desconhecido`) | `a1b2c3d` | commit gravado no build da imagem |
| `APP_IMAGEM` | só ao rodar `release.sh` | `ghcr.io/minha-org/meu-app` | onde publicar a imagem (padrão: derivada do remote `origin`) |
| `RELEASE_BRANCHES` | não (`main master`) | `main` | branches de onde pode sair versão |

`APP_VERSAO` e `APP_COMMIT` quem preenche é o build (`--build-arg`), nunca o `.env`.

### Dependências

Nenhum pacote novo. O workflow usa as actions `docker/login-action`, `docker/setup-buildx-action` e `docker/build-push-action`, fixadas
pelo SHA do commit.

### Como verificar que funcionou

1. Abra um terminal **na pasta do projeto** (no Windows, abra o **Git Bash**).
2. Rode o teste do script, que usa um repositório temporário e não mexe no seu projeto:
   ```bash
   bash scripts/release.test.sh
   ```
   Esperado: a última linha diz `N/N verificações passaram`.
3. Veja o que um release faria, sem mudar nada:
   ```bash
   bash scripts/release.sh patch --dry-run
   ```
4. Com tudo commitado na branch principal e novidades em "Não publicado" no `CHANGELOG.md`, corte a versão de verdade:
   ```bash
   APP_IMAGEM=ghcr.io/minha-org/meu-app bash scripts/release.sh patch
   ```
   No PowerShell chame o Git Bash: `& "C:\Program Files\Git\bin\bash.exe" scripts/release.sh patch` (defina antes `$env:APP_IMAGEM = "ghcr.io/minha-org/meu-app"`).
5. Confira: `git tag -l` mostra `vX.Y.Z`, o `CHANGELOG.md` tem `## [X.Y.Z] - data` e, com o sistema rodando, `curl http://localhost:3000/api/health`
   (PowerShell: `curl.exe`) mostra `"versao":"X.Y.Z"`; o rodapé do menu lateral mostra `vX.Y.Z`.
