# origem: skills-modelo/scripts/release.test.sh
#!/usr/bin/env bash
# Teste de scripts/release.sh (skill versionamento-release). Roda em repositórios git TEMPORÁRIOS: nada aqui faz push, tag ou
# build de verdade no seu projeto (o push dos casos 9 e 10 vai para um remote "origin" de mentira, uma pasta bare temporária, e
# um "docker" falso no PATH registra se alguém tentou publicar imagem).
# Uso: bash scripts/release.test.sh
set -uo pipefail

AQUI="$(cd "$(dirname "$0")" && pwd)"
TMP_BASE="$(mktemp -d)"
trap 'rm -rf "$TMP_BASE"' EXIT
FALHAS=0
TESTES=0

verifica() { # descrição, comando...
  local descricao="$1"; shift
  TESTES=$((TESTES + 1))
  if "$@" >/dev/null 2>&1; then echo "ok   - $descricao"; else echo "FALHOU - $descricao"; FALHAS=$((FALHAS + 1)); fi
}
igual() { [ "$1" = "$2" ]; }
contem() { grep -qF -- "$2" "$1"; }
nao_contem() { ! grep -qF -- "$2" "$1"; }
versao_de() { node -p "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).version" "$1"; }

# Repositório de exemplo: VERSION 1.4.0, quatro package.json (+ um em node_modules) e um CHANGELOG com entrada em "Não publicado".
novo_repo() {
  local dir="$TMP_BASE/$1"
  mkdir -p "$dir/scripts" "$dir/apps/api" "$dir/apps/web" "$dir/packages/contratos" "$dir/node_modules/lib"
  cp "$AQUI/release.sh" "$dir/scripts/release.sh"
  (
    cd "$dir"
    printf '1.4.0\n' > VERSION
    printf '{\n  "name": "raiz",\n  "version": "1.4.0",\n  "private": true\n}\n' > package.json
    printf '{\n  "name": "api",\n  "version": "1.4.0",\n  "dependencies": {\n    "zod": "4.1.0"\n  }\n}\n' > apps/api/package.json
    printf '{\n  "name": "web",\n  "version": "1.4.0"\n}\n' > apps/web/package.json
    printf '{\n  "name": "contratos",\n  "version": "1.4.0"\n}\n' > packages/contratos/package.json
    printf '{\n  "name": "lib",\n  "version": "9.9.9"\n}\n' > node_modules/lib/package.json
    printf 'node_modules/\n' > .gitignore
    cat > CHANGELOG.md <<'FIM'
# Changelog

Formato Keep a Changelog; versionamento SemVer.

## [Não publicado]

### Adicionado
- Tela de relatórios.

## [1.4.0] - 2026-01-10

### Adicionado
- Exportação em Excel.
FIM
    git init -q -b main
    git config user.email "teste@exemplo.com.br"
    git config user.name "Teste"
    git add -A
    git commit -q -m "estado inicial"
  )
  echo "$dir"
}

# ---------- 1) patch: 1.4.0 -> 1.4.1 ----------
R="$(novo_repo patch)"
(cd "$R" && bash scripts/release.sh patch --local >"$TMP_BASE/saida-patch.txt" 2>&1)
verifica "patch termina com sucesso"                       igual "$?" "0"
verifica "VERSION vira 1.4.1"                              igual "$(cat "$R/VERSION")" "1.4.1"
for p in package.json apps/api/package.json apps/web/package.json packages/contratos/package.json; do
  verifica "$p vira 1.4.1" igual "$(versao_de "$R/$p")" "1.4.1"
done
verifica "dependência do api não é tocada"                 contem "$R/apps/api/package.json" '"zod": "4.1.0"'
verifica "package.json de node_modules não é tocado"       igual "$(versao_de "$R/node_modules/lib/package.json")" "9.9.9"
HOJE="$(date +%Y-%m-%d)"
verifica "CHANGELOG ganha ## [1.4.1] - data"               contem "$R/CHANGELOG.md" "## [1.4.1] - $HOJE"
verifica "entrada passou para a versão nova"               igual "$(awk '/^## \[1\.4\.1\]/{f=1;next} /^## \[/{f=0} f' "$R/CHANGELOG.md" | grep -c 'Tela de relatórios')" "1"
verifica "Não publicado continua, agora vazio"             igual "$(awk '/^## \[Não publicado\]/{f=1;next} /^## \[/{f=0} f' "$R/CHANGELOG.md" | grep -c 'Tela de relatórios')" "0"
verifica "histórico antigo preservado"                     contem "$R/CHANGELOG.md" "## [1.4.0] - 2026-01-10"
verifica "tag v1.4.1 criada"                               igual "$(cd "$R" && git tag -l v1.4.1)" "v1.4.1"
verifica "tag aponta para o commit de release"             igual "$(cd "$R" && git rev-parse 'v1.4.1^{commit}')" "$(cd "$R" && git rev-parse HEAD)"
verifica "mensagem do commit é chore(release): v1.4.1"     igual "$(cd "$R" && git log -1 --format=%s)" "chore(release): v1.4.1"
verifica "árvore limpa depois do release"                  igual "$(cd "$R" && git status --porcelain)" ""

# ---------- 2) minor e major ----------
R="$(novo_repo minor)"; (cd "$R" && bash scripts/release.sh minor --local >/dev/null 2>&1)
verifica "minor: 1.4.0 -> 1.5.0"                           igual "$(cat "$R/VERSION")" "1.5.0"
R="$(novo_repo major)"; (cd "$R" && bash scripts/release.sh major --local >/dev/null 2>&1)
verifica "major: 1.4.0 -> 2.0.0"                           igual "$(cat "$R/VERSION")" "2.0.0"

# ---------- 3) árvore suja: aborta sem mudar nada ----------
R="$(novo_repo suja)"
echo "rascunho" > "$R/rascunho.txt"; (cd "$R" && git add rascunho.txt)
ANTES="$(cd "$R" && git rev-parse HEAD)"
(cd "$R" && bash scripts/release.sh patch --local >"$TMP_BASE/saida-suja.txt" 2>&1); CODIGO=$?
verifica "árvore suja: código de saída diferente de 0"     test "$CODIGO" -ne 0
verifica "árvore suja: mensagem explica"                   contem "$TMP_BASE/saida-suja.txt" "árvore"
verifica "árvore suja: VERSION continua 1.4.0"             igual "$(cat "$R/VERSION")" "1.4.0"
verifica "árvore suja: package.json continua 1.4.0"        igual "$(versao_de "$R/package.json")" "1.4.0"
verifica "árvore suja: nenhum commit novo"                 igual "$(cd "$R" && git rev-parse HEAD)" "$ANTES"
verifica "árvore suja: nenhuma tag"                        igual "$(cd "$R" && git tag -l)" ""
verifica "árvore suja: CHANGELOG intacto"                  nao_contem "$R/CHANGELOG.md" "## [1.4.1]"

# ---------- 4) arquivo novo não commitado também conta como sujo ----------
R="$(novo_repo suja2)"; echo x > "$R/novo.txt"
(cd "$R" && bash scripts/release.sh patch --local >/dev/null 2>&1); CODIGO=$?
verifica "arquivo novo não commitado: aborta"              test "$CODIGO" -ne 0
verifica "arquivo novo não commitado: VERSION intacta"     igual "$(cat "$R/VERSION")" "1.4.0"

# ---------- 5) fora da branch principal ----------
R="$(novo_repo ramo)"; (cd "$R" && git checkout -q -b feat/algo)
(cd "$R" && bash scripts/release.sh patch --local >/dev/null 2>&1); CODIGO=$?
verifica "branch de feature: aborta"                       test "$CODIGO" -ne 0
verifica "branch de feature: VERSION intacta"              igual "$(cat "$R/VERSION")" "1.4.0"

# ---------- 6) "Não publicado" vazio ----------
R="$(novo_repo vazio)"
(cd "$R" && sed -i '/^### Adicionado$/,/^- Tela de relatórios\.$/d' CHANGELOG.md && git commit -q -am "limpa")
(cd "$R" && bash scripts/release.sh patch --local >/dev/null 2>&1); CODIGO=$?
verifica "changelog sem novidades: aborta"                 test "$CODIGO" -ne 0
verifica "changelog sem novidades: VERSION intacta"        igual "$(cat "$R/VERSION")" "1.4.0"

# ---------- 7) tag já existente ----------
R="$(novo_repo tag)"; (cd "$R" && git tag v1.4.1)
(cd "$R" && bash scripts/release.sh patch --local >/dev/null 2>&1); CODIGO=$?
verifica "tag v1.4.1 já existe: aborta"                    test "$CODIGO" -ne 0
verifica "tag já existe: VERSION intacta"                  igual "$(cat "$R/VERSION")" "1.4.0"

# ---------- 8) --dry-run e tipo inválido ----------
R="$(novo_repo seco)"
(cd "$R" && bash scripts/release.sh patch --dry-run >"$TMP_BASE/saida-seco.txt" 2>&1); CODIGO=$?
verifica "--dry-run termina com sucesso"                   igual "$CODIGO" "0"
verifica "--dry-run mostra a versão nova 1.4.1"            contem "$TMP_BASE/saida-seco.txt" "1.4.1"
verifica "--dry-run não muda nada"                         igual "$(cd "$R" && git status --porcelain)$(cat "$R/VERSION")" "1.4.0"
(cd "$R" && bash scripts/release.sh gigante --local >/dev/null 2>&1); CODIGO=$?
verifica "tipo inválido: aborta"                           test "$CODIGO" -ne 0

# Remote de mentira: repositório bare temporário como "origin", com a branch main já enviada (upstream configurado).
com_origin() { # dir do repo
  local bare="$1.git"
  git init -q --bare -b main "$bare"
  (cd "$1" && git remote add origin "$bare" && git push -q -u origin main)
}
# docker falso: só anota que foi chamado (o release.sh nunca pode publicar imagem).
mkdir -p "$TMP_BASE/bin"
printf '#!/usr/bin/env bash
echo "$*" >> "%s/docker-chamado.txt"
' "$TMP_BASE" > "$TMP_BASE/bin/docker"
chmod +x "$TMP_BASE/bin/docker"

# ---------- 9) modo padrão: envia branch e tag; quem publica a imagem é o workflow ----------
R="$(novo_repo publica)"; com_origin "$R"
(cd "$R" && PATH="$TMP_BASE/bin:$PATH" bash scripts/release.sh patch >"$TMP_BASE/saida-publica.txt" 2>&1); CODIGO=$?
verifica "padrão: termina com sucesso"                     igual "$CODIGO" "0"
verifica "padrão: tag v1.4.1 chegou ao origin"             igual "$(git --git-dir="$R.git" tag -l v1.4.1)" "v1.4.1"
verifica "padrão: branch do origin tem o commit de release" igual "$(git --git-dir="$R.git" rev-parse main)" "$(cd "$R" && git rev-parse HEAD)"
verifica "padrão: nenhum docker (nem build nem push)"      test ! -e "$TMP_BASE/docker-chamado.txt"
verifica "padrão: avisa que o workflow publica a imagem"   contem "$TMP_BASE/saida-publica.txt" "workflow"

# ---------- 10) --testar-imagem: só docker build local, nunca push ----------
R="$(novo_repo prova)"; com_origin "$R"
(cd "$R" && PATH="$TMP_BASE/bin:$PATH" bash scripts/release.sh patch --testar-imagem >/dev/null 2>&1); CODIGO=$?
verifica "--testar-imagem: termina com sucesso"            igual "$CODIGO" "0"
verifica "--testar-imagem: chamou docker build"            contem "$TMP_BASE/docker-chamado.txt" "build"
verifica "--testar-imagem: nunca docker push"              nao_contem "$TMP_BASE/docker-chamado.txt" "push"

# ---------- 11) branch atrás do remote: aborta sem mudar nada ----------
R="$(novo_repo atras)"; com_origin "$R"
OUTRO="$TMP_BASE/atras-outro"
git clone -q "$R.git" "$OUTRO" 2>/dev/null
(cd "$OUTRO" && git config user.email "outra@exemplo.com.br" && git config user.name "Outra" && echo y > y.txt && git add y.txt && git commit -q -m "colega" && git push -q origin main)
ANTES="$(cd "$R" && git rev-parse HEAD)"
(cd "$R" && bash scripts/release.sh patch --local >"$TMP_BASE/saida-atras.txt" 2>&1); CODIGO=$?
verifica "atrás do remote: aborta"                         test "$CODIGO" -ne 0
verifica "atrás do remote: mensagem explica"               contem "$TMP_BASE/saida-atras.txt" "atrás"
verifica "atrás do remote: VERSION intacta"                igual "$(cat "$R/VERSION")" "1.4.0"
verifica "atrás do remote: nenhum commit novo"             igual "$(cd "$R" && git rev-parse HEAD)" "$ANTES"

# ---------- 12) modo padrão sem upstream: aborta (não tem para onde enviar nem o que conferir) ----------
R="$(novo_repo sem-upstream)"
(cd "$R" && bash scripts/release.sh patch >/dev/null 2>&1); CODIGO=$?
verifica "sem upstream: aborta"                            test "$CODIGO" -ne 0
verifica "sem upstream: VERSION intacta"                   igual "$(cat "$R/VERSION")" "1.4.0"

echo
echo "$((TESTES - FALHAS))/$TESTES verificações passaram"
[ "$FALHAS" -eq 0 ]
