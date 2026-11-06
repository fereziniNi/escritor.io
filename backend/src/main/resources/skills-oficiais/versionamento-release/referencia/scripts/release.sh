# origem: skills-modelo/scripts/release.sh
#!/usr/bin/env bash
# Corta uma versão do sistema (skill versionamento-release). Uso, na raiz do projeto, no bash (Linux, macOS ou Git Bash no Windows):
#   scripts/release.sh <major|minor|patch> [--dry-run | --local]
#
# O que faz, nesta ordem (todas as conferências vêm ANTES de qualquer alteração):
#   1. exige árvore limpa (nem arquivo novo sem commit), branch principal (main ou master) e novidades em "Não publicado";
#   2. calcula a versão nova a partir de VERSION (SemVer) e recusa se a tag vX.Y.Z já existe;
#   3. grava a versão em VERSION e em todos os package.json versionados (menos estagios/);
#   4. move "Não publicado" do CHANGELOG.md para "## [X.Y.Z] - AAAA-MM-DD" (e deixa "Não publicado" vazio);
#   5. commit "chore(release): vX.Y.Z" e tag anotada vX.Y.Z;
#   6. docker build (APP_VERSAO e APP_COMMIT embutidos), docker push de <APP_IMAGEM>:X.Y.Z e git push da branch e da tag.
#
# Opções:  --dry-run  só mostra a versão nova e o que seria feito; não muda nada.
#          --local    faz 1 a 5 e para: sem build, sem push (é como o scripts/release.test.sh roda).
# Variáveis: APP_IMAGEM  imagem sem tag, ex. ghcr.io/minha-org/meu-app (padrão: derivada do remote "origin" do GitHub);
#            RELEASE_BRANCHES  branches permitidas (padrão "main master").
# Pré-requisitos do passo 6: docker aberto e `docker login ghcr.io` feito (token com write:packages); remote "origin" com permissão de push.
# Errou depois do commit (build falhou)? O script diz como desfazer; nada foi publicado enquanto o push não aconteceu.
set -euo pipefail

erro() { echo "ERRO: $*" >&2; exit 1; }

TIPO="${1:-}"
MODO="${2:-}"
case "$TIPO" in major | minor | patch) ;; *) erro "uso: scripts/release.sh <major|minor|patch> [--dry-run | --local]" ;; esac
case "$MODO" in "" | --dry-run | --local) ;; *) erro "opção desconhecida: $MODO (use --dry-run ou --local)" ;; esac

cd "$(dirname "$0")/.."
git rev-parse --git-dir >/dev/null 2>&1 || erro "esta pasta não é um repositório git"
command -v node >/dev/null 2>&1 || erro "node não encontrado (ele edita os package.json)"

# 1) conferências
[ -z "$(git status --porcelain)" ] || erro "a árvore de trabalho não está limpa: commite, guarde (git stash) ou descarte o que está pendente antes de cortar uma versão."
RAMO="$(git rev-parse --abbrev-ref HEAD)"
PERMITIDAS="${RELEASE_BRANCHES:-main master}"
case " $PERMITIDAS " in *" $RAMO "*) ;; *) erro "versão só sai da branch principal ($PERMITIDAS); você está em '$RAMO'." ;; esac

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
mapfile -t PACOTES < <(git ls-files -- '*package.json' | grep -v '^estagios/' || true)

DATA="${RELEASE_DATA:-$(date +%Y-%m-%d)}"
IMAGEM="${APP_IMAGEM:-}"
if [ -z "$IMAGEM" ] && [ "$MODO" = "" ]; then
  ORIGEM="$(git remote get-url origin 2>/dev/null || true)"
  if [[ "$ORIGEM" =~ github\.com[:/]([^/]+)/([^/]+)$ ]]; then
    REPO="${BASH_REMATCH[2]%.git}"
    IMAGEM="$(echo "ghcr.io/${BASH_REMATCH[1]}/$REPO" | tr '[:upper:]' '[:lower:]')"
  else
    erro "defina APP_IMAGEM (ex. ghcr.io/minha-org/meu-app): não consegui derivar do remote origin"
  fi
fi

echo "==> $ATUAL -> $NOVA ($TIPO) na branch $RAMO, em $DATA"
echo "    package.json: ${PACOTES[*]:-nenhum}"
[ "$MODO" != "--local" ] && [ "$MODO" != "--dry-run" ] && echo "    imagem: $IMAGEM:$NOVA"
if [ "$MODO" = "--dry-run" ]; then echo "(--dry-run: nada foi alterado)"; exit 0; fi

# 3) VERSION e package.json (troca só o 1º "version", o do próprio pacote, preservando a formatação)
printf '%s\n' "$NOVA" > VERSION
for arquivo in "${PACOTES[@]}"; do
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
git add VERSION CHANGELOG.md "${PACOTES[@]}"
git commit -q -m "chore(release): v$NOVA"
git tag -a "v$NOVA" -m "Versão $NOVA"
COMMIT="$(git rev-parse --short HEAD)"
echo "==> commit $COMMIT e tag v$NOVA criados"

DESFAZER="para desfazer: git tag -d v$NOVA && git reset --hard HEAD~1"
if [ "$MODO" = "--local" ]; then echo "(--local: sem build e sem push. $DESFAZER)"; exit 0; fi

# 6) imagem e push. A ordem importa: se o build ou o push da imagem falhar, nada do git foi publicado e dá para desfazer.
command -v docker >/dev/null 2>&1 || erro "docker não encontrado. Commit e tag ficaram locais; $DESFAZER"
echo "==> docker build $IMAGEM:$NOVA"
docker build -t "$IMAGEM:$NOVA" --build-arg "APP_VERSAO=$NOVA" --build-arg "APP_COMMIT=$COMMIT" . \
  || erro "o build falhou. Nada foi publicado; $DESFAZER"
docker push "$IMAGEM:$NOVA" || erro "o push da imagem falhou (docker login ghcr.io feito, com write:packages?). Commit e tag ficaram locais; repita o 'docker push $IMAGEM:$NOVA' ou $DESFAZER"
git push origin "$RAMO" "v$NOVA" || erro "o push do git falhou. A imagem $IMAGEM:$NOVA já foi publicada; repita: git push origin $RAMO v$NOVA"
echo "==> v$NOVA publicada: $IMAGEM:$NOVA. Na instalação do cliente, troque APP_VERSAO=$NOVA no deploy/.env e rode docker compose up -d."
