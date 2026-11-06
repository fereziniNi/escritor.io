# origem: skills-modelo/deploy/gerar-segredos.sh
# Cria deploy/segredos/ com senhas e chaves aleatórias (skill instalacao-docker-compose). Rode UMA vez, na pasta deploy/:
#   Linux:      sh gerar-segredos.sh
#   PowerShell: docker run --rm -v "${PWD}:/deploy" busybox:1.37.0 sh /deploy/gerar-segredos.sh
# Nunca sobrescreve: arquivo que já existe com conteúdo é mantido (rodar de novo só completa o que falta).
# Guarde uma cópia de segredos/ no cofre do cliente: perder dados_chaves = perder os CPFs cifrados.
set -eu
cd "$(dirname "$0")"
umask 077
mkdir -p segredos
chmod 700 segredos

aleatorio_hex() { head -c "$1" /dev/urandom | od -An -tx1 | tr -d ' \n'; }
aleatorio_b64() { head -c 32 /dev/urandom | base64 | tr -d '\n'; }

gravar() {
  if [ -s "segredos/$1" ]; then
    echo "mantido: segredos/$1"
  else
    printf '%s' "$2" > "segredos/$1"
    echo "criado:  segredos/$1"
  fi
}

# Senhas em hexadecimal: entram em URL postgres:// sem precisar de escape.
gravar banco_senha "$(aleatorio_hex 24)"
gravar database_url "postgres://app:$(cat segredos/banco_senha)@banco:5432/app"
gravar database_url_runtime "postgres://app_runtime:$(aleatorio_hex 24)@banco:5432/app"
gravar auth_segredo_codigo "$(aleatorio_hex 32)"
gravar dados_chaves "k1:$(aleatorio_b64)"
gravar dados_chave_indice "$(aleatorio_b64)"
gravar segredo_url "$(aleatorio_hex 32)"
# Senha do SMTP: a TI do cliente escreve neste arquivo (vazio = servidor sem autenticação).
[ -e segredos/smtp_senha ] || { : > segredos/smtp_senha; echo "criado:  segredos/smtp_senha (vazio: preencha se o SMTP tiver usuário)"; }

# A pasta (700) protege os arquivos no servidor; os arquivos ficam legíveis para os processos sem privilégio dos
# contêineres (usuário node da imagem, postgres), que os recebem montados em /run/secrets.
chmod 444 segredos/*
echo "pronto. Faça uma cópia de segredos/ no cofre de senhas do cliente."
