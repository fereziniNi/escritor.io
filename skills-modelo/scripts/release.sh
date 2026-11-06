#!/usr/bin/env bash
# Corta uma versão do sistema (skill versionamento-release). Uso, na raiz do projeto, no bash (Linux, macOS com o bash 3.2 de
# fábrica, ou Git Bash no Windows):
#   scripts/release.sh <major|minor|patch> [--dry-run | --local | --testar-imagem]
#
# O que faz, nesta ordem (todas as conferências vêm ANTES de qualquer alteração):
#   1. exige árvore limpa (nem arquivo novo sem commit), branch principal (main ou master), a branch em dia com o remote
#      (git fetch; recusa se está atrás ou divergiu de @{u}) e novidades em "Não publicado";
#   2. calcula a versão nova a partir de VERSION (SemVer) e recusa se a tag vX.Y.Z já existe;
#   3. grava a versão em VERSION e em todos os package.json versionados (menos estagios/);
#   4. move "Não publicado" do CHANGELOG.md para "## [X.Y.Z] - AAAA-MM-DD" (e deixa "Não publicado" vazio);
#   5. commit "chore(release): vX.Y.Z" e tag anotada vX.Y.Z;
#   6. git push da branch e da tag. QUEM PUBLICA A IMAGEM É O WORKFLOW .github/workflows/release.yml, disparado pela tag:
#      este script nunca faz docker push (um publicador só para cada tag de imagem).
#
# Opções:  --dry-run        só mostra a versão nova e o que seria feito; não muda nada.
#          --local          faz 1 a 5 e para: sem push (é como o scripts/release.test.sh roda).
#          --testar-imagem  antes do push, um docker build LOCAL como prova (não publica nada); se falhar, nada sai da máquina.
# Variável: RELEASE_BRANCHES  branches permitidas (padrão "main master").
# Pré-requisito do passo 6: remote "origin" (a branch com upstream) com permissão de push.
set -euo pipefail

erro() { echo "ERRO: $*" >&2; exit 1; }

TIPO="${1:-}"
MODO="${2:-}"
case "$TIPO" in major | minor | patch) ;; *) erro "uso: scripts/release.sh <major|minor|patch> [--dry-run | --local | --testar-imagem]" ;; esac
case "$MODO" in "" | --dry-run | --local | --testar-imagem) ;; *) erro "opção desconhecida: $MODO (use --dry-run, --local ou --testar-imagem)" ;; esac

cd "$(dirname "$0")/.."
git rev-parse --git-dir >/dev/null 2>&1 || erro "esta pasta não é um repositório git"
command -v node >/dev/null 2>&1 || erro "node não encontrado (ele edita os package.json)"

# 1) conferências
[ -z "$(git status --porcelain)" ] || erro "a árvore de trabalho não está limpa: commite, guarde (git stash) ou descarte o que está pendente antes de cortar uma versão."
RAMO="$(git rev-parse --abbrev-ref HEAD)"
PERMITIDAS="${RELEASE_BRANCHES:-main master}"
case " $PERMITIDAS " in *" $RAMO "*) ;; *) erro "versão só sai da branch principal ($PERMITIDAS); você está em '$RAMO'." ;; esac

# Em dia com o remote: versão cortada de uma branch atrasada ou divergente não sobe (o push seria recusado) ou pula commits.
if UPSTREAM="$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null)"; then
  git fetch -q "${UPSTREAM%%/*}" || erro "git fetch falhou: sem conferir o remote não dá para saber se a branch está em dia."
  ATRAS="$(git rev-list --count "HEAD..@{u}")"
  [ "$ATRAS" = "0" ] || erro "a branch $RAMO está $ATRAS commit(s) atrás de $UPSTREAM (ou divergiu): rode git pull --ff-only e confira antes de cortar a versão."
elif [ "$MODO" = "" ] || [ "$MODO" = "--testar-imagem" ]; then
  erro "a branch $RAMO não tem upstream (git push -u origin $RAMO): sem ele não dá para conferir o remote nem enviar a tag."
fi

[ -f VERSION ] || erro "arquivo VERSION não encontrado na raiz"
ATUAL="$(tr -d '[:space:]' < VERSION)"
[[ "$ATUAL" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]] || erro "VERSION deve ter MAJOR.MINOR.PATCH (ex. 1.4.0); achei '$ATUAL'"
MAJOR="${BASH_REMATCH[1]}"; MINOR="${BASH_REMATCH[2]}"; PATCH="${BASH_REMATCH[3]}"
case "$TIPO" in
  major) NOVA="$((MAJOR + 1)).0.0" ;;
  minor) NOVA="$MAJOR.$((MINOR + 1)).0" ;;
  patch) NOVA="$MAJOR.$MINOR.$((PATCH + 1))" ;;
esac
git rev-parse -q --verify "refs/tags/v$NOVA" >/dev/null && erro "a tag v$NOVA já existe"

[ -f CHANGELOG.md ] || erro "CHANGELOG.md não encontrado na raiz"
grep -q '^## \[Não publicado\]' CHANGELOG.md || erro 'CHANGELOG.md precisa ter a seção "## [Não publicado]"'
NOVIDADES="$(awk '/^## \[Não publicado\]/{f=1;next} /^## \[/{f=0} f && NF' CHANGELOG.md | grep -v '^###' || true)"
[ -n "$NOVIDADES" ] || erro 'a seção "Não publicado" do CHANGELOG.md está vazia: anote o que mudou antes de cortar a versão.'

# package.json versionados (o git já ignora node_modules); estagios/ são cópias de referência, não entram.
# Laço de leitura em vez de mapfile: funciona no bash 3.2 do macOS.
PACOTES=()
while IFS= read -r p; do
  [ -n "$p" ] && PACOTES+=("$p")
done < <(git ls-files -- '*package.json' | grep -v '^estagios/' || true)

DATA="${RELEASE_DATA:-$(date +%Y-%m-%d)}"

echo "==> $ATUAL -> $NOVA ($TIPO) na branch $RAMO, em $DATA"
echo "    package.json: ${PACOTES[*]:-nenhum}"
if [ "$MODO" = "--dry-run" ]; then echo "(--dry-run: nada foi alterado)"; exit 0; fi

# 3) VERSION e package.json (troca só o 1º "version", o do próprio pacote, preservando a formatação)
printf '%s\n' "$NOVA" > VERSION
for arquivo in ${PACOTES[@]+"${PACOTES[@]}"}; do
  node -e '
    const fs = require("fs");
    const [arquivo, nova] = process.argv.slice(1);
    const texto = fs.readFileSync(arquivo, "utf8");
    if (!/"version"\s*:/.test(texto)) { console.log("    (sem campo version, mantido): " + arquivo); process.exit(0); }
    const novo = texto.replace(/("version"\s*:\s*")[^"]*(")/, "$1" + nova + "$2");
    if (JSON.parse(novo).version !== nova) { console.error("não consegui atualizar a versão de " + arquivo); process.exit(1); }
    fs.writeFileSync(arquivo, novo);
  ' "$arquivo" "$NOVA"
done

# 4) CHANGELOG: o que estava em "Não publicado" passa para a versão nova; "Não publicado" fica vazio, no topo.
awk -v versao="$NOVA" -v data="$DATA" '
  /^## \[Não publicado\]/ { print; print ""; print "## [" versao "] - " data; next }
  { print }
' CHANGELOG.md > CHANGELOG.md.novo
mv CHANGELOG.md.novo CHANGELOG.md

# 5) commit e tag
git add VERSION CHANGELOG.md ${PACOTES[@]+"${PACOTES[@]}"}
git commit -q -m "chore(release): v$NOVA"
git tag -a "v$NOVA" -m "Versão $NOVA"
COMMIT="$(git rev-parse --short HEAD)"
echo "==> commit $COMMIT e tag v$NOVA criados"

DESFAZER="para desfazer: git tag -d v$NOVA && git reset --hard HEAD~1"
if [ "$MODO" = "--local" ]; then echo "(--local: sem push. $DESFAZER)"; exit 0; fi

# Prova opcional: a imagem builda nesta máquina. Só build, nunca push (quem publica é o release.yml).
if [ "$MODO" = "--testar-imagem" ]; then
  command -v docker >/dev/null 2>&1 || erro "docker não encontrado. Commit e tag ficaram locais; $DESFAZER"
  echo "==> docker build de prova (local, não publica)"
  docker build -t "release-prova:$NOVA" --build-arg "APP_VERSAO=$NOVA" --build-arg "APP_COMMIT=$COMMIT" . \
    || erro "o build de prova falhou. Nada foi enviado; $DESFAZER"
fi

# 6) push: a tag dispara o release.yml, que publica a imagem X.Y.Z e a Release do GitHub.
git push "${UPSTREAM%%/*}" "$RAMO" "v$NOVA" || erro "o push do git falhou. Commit e tag ficaram locais; repita: git push ${UPSTREAM%%/*} $RAMO v$NOVA (ou $DESFAZER)"
echo "==> v$NOVA enviada. O workflow Release (GitHub Actions) publica a imagem X.Y.Z=$NOVA; acompanhe na aba Actions."
echo "    Na instalação do cliente, depois que o workflow terminar: APP_VERSAO=$NOVA no deploy/.env e docker compose up -d."
